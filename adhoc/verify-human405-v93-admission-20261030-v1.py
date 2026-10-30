"""Aggregate existing v93 point/proof checkpoints; never starts a simulation."""
import hashlib
import json
import pathlib
import re
import subprocess

stage = pathlib.Path(__file__).resolve().parents[1]
folder = 'reports/ai-foundation-20261023/'
def read(p): return json.loads((stage/p).read_text())
def sha(p): return hashlib.sha256((stage/p).read_bytes()).hexdigest()
def write(p, data): (stage/p).write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')

teacher_path=folder+'human405-round1-v93-audit-20261030-v1.json'
legacy_path=folder+'round1-v93-compat-corpus-20261029-v1.json'
extra_paths=[folder+'round1-v93-compat-'+name+'-20261029-v1.json' for name in ['step317','terminal-root']]
teacher,legacy=read(teacher_path),read(legacy_path)
assert len(teacher['rows'])==32 and not teacher['speedOverruns'] and not teacher['unactionableRoots']
assert legacy['passed']==10 and legacy['failed']==0
bound_reports=[folder+'human405-v93-native-bound-controls-'+name+'-20261030-v1.json' for name in ['teacher-24','teacher-39','teacher-44','legacy-105','legacy-152']]
source_bound=[teacher_path,legacy_path]+bound_reports+[r['evidencePath'] for r in teacher['rows']]
hashes={}
for path in source_bound:
    report=read(path)
    for name,expected in report['sourceHashes'].items():
        assert sha(name)==expected, (path,name)
        if name in hashes: assert hashes[name]==expected
        hashes[name]=expected
    for row in report.get('rows',[report]):
        if row.get('rawPath'): assert sha(row['rawPath'])==row['rawSha256']
rows=[{'id':'teacher-'+str(r['step']),'inputs':r['evidenceNativeInputs'],'ms':r['milliseconds'],'complete':r['graphClosed'],'rootAndRngUnchanged':r['rootAndRngUnchanged']} for r in teacher['rows']]
rows += [{'id':r['caseId'],'inputs':r['diagnostics']['nativeExecutions'],'ms':r['rootAndSearchMilliseconds'],'complete':r['complete'],'rootAndRngUnchanged':r['rootUnchanged']} for r in legacy['rows']]
for p in extra_paths:
    r=read(p);assert sha(r['rawPath'])==r['rawSha256']
    rows.append({'id':p,'inputs':r['diagnostics']['nativeExecutions'],'ms':r['rootAndSearchMilliseconds'],'complete':r['complete'],'rootAndRngUnchanged':r.get('rootAndRngUnchanged',r.get('rootUnchanged'))})
assert len(rows)==44
assert all(r['complete'] and r['inputs']<=256 and r['ms']<600 for r in rows)
assert all(r['rootAndRngUnchanged'] for r in rows)
proofs=[read(p) for p in bound_reports]
assert all(p['sameBestAsFreshNativePolicy'] and p['sourceRootAndRngUnchanged'] for p in proofs)
logs={
 'relatedNode':('human405-v93-related-node-20261030-v1.log','/private/tmp/seti-human405-v93-targeted-20261030-v2.log'),
 'searchBrowser':('human405-v93-search-browser-smokes-20261030-v1.log','/private/tmp/seti-human405-v93-search-browser-smokes-20261030-v1.log'),
 'valueInputs':('human405-v93-v-input-audit-20261030-v1.log','/private/tmp/seti-human405-v93-v-input-audit-20261030-v1.log')}
for name,(destination,source) in logs.items():
    text=pathlib.Path(source).read_text();(stage/folder/destination).write_text(text)
    if name=='relatedNode': assert 'SUMMARY unit passed=7 failed=0 total=7' in text
    if name=='searchBrowser': assert 'SUMMARY browserSmoke passed=6 failed=0 total=6' in text
    if name=='valueInputs':
        failures=[line for line in text.splitlines() if '[FAIL]' in line]
        assert len(failures)==1 and 'aomomo' in failures[0]
modified=['randomizer/game/ai/card-pick-planning.js','randomizer/game/ai/resource-demand.js','randomizer/game/ai/decision-search.js','randomizer/game/ai/card-pick-planning.test.js','tools/browser-smoke-inventory.js']
for p in modified: subprocess.run(['node','--check',p],cwd=stage,check=True,capture_output=True)
output=folder+'human405-v93-admission-20261030-v1.json'
report={'schemaVersion':'seti-human405-v93-point-admission-v1','baseCommit':'306ab81c3224ef42f490f765a34890fe2defdeba',
 'searchVersion':'seti-complete-decision-search-v93','valueModelUnchanged':'seti-purpose-capital-state-value-v2',
 'change':'Propagate already committed own income into fixed known-card acquisition; use shared existing income utility and known future payment deficit only as equal-value tie break. No card search or probe value bonus.',
 'sourceHashes':hashes,'teacherReport':teacher_path,'legacyReport':legacy_path,'extraReports':extra_paths,'pointRows':rows,
 'all44CompleteWithin256NativeInputs600ms':True,'maxNativeInputs':max(r['inputs'] for r in rows),'maxMilliseconds':max(r['ms'] for r in rows),
 'timingScope':'One cold sample per root; historical case152596.182ms leaves little timing margin. No statistical or full-game guarantee.',
 'nativeControls':{'reports':bound_reports,'numericSources':sum(len(p['controls']) for p in proofs),'typedSources':sum(len(p['proofControls']) for p in proofs),'freshNativeRoots':len(proofs),'allSameBestActionAndValue':True},
 'validation':{'relatedNodePassed':7,'searchBrowserPassed':6,'modifiedJavaScriptSyntaxPassed':len(modified),'logs':{k:folder+v[0] for k,v in logs.items()},
 'valueInputAudit':'All independent paths pass; the sole known legacy frozen-aomomo failure remains; command exits1.',
 'fullNodeRegression':'Not repeated for this narrow selector change. Last full source v92 has150unit+1fullFlow; this v93 report claims only the7 related units run here.'},
 'teacherFirstInputMatches':teacher['categoryCounts']['same-first-input'],'teacherStep40':next(r for r in teacher['rows'] if r['step']==40),
 'autonomousRun':False,'baselineEligible':False,'goalStatus':'active',
 'remaining':['B117 and deployed-probe future purpose value at root24 remains unresolved.','Other8 current teacher first-input differences need causal strategic classification; internal use or scalar equality is insufficient.','Standard one-run white-only R1 after source delivery; v41 full-game baseline remains unchanged.']}
write(output,report)
print(json.dumps({'output':output,'teacherMatches':report['teacherFirstInputMatches'],'points':len(rows),'maxNativeInputs':report['maxNativeInputs'],'maxMs':report['maxMilliseconds'],'nativeControls':report['nativeControls']},ensure_ascii=False))
