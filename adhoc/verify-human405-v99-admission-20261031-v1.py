"""Read existing evidence; never starts a search or an autonomous experiment."""
import hashlib
import json
import pathlib

stage = pathlib.Path(__file__).resolve().parents[1]
folder = 'reports/ai-foundation-20261023/'
def read(p): return json.loads((stage/p).read_text())
def sha(p): return hashlib.sha256((stage/p).read_bytes()).hexdigest()
teacher_path = folder+'human405-round1-v99-audit-20261030-v1.json'
legacy_path = folder+'round1-v99-compat-corpus-20261029-v1.json'
teacher, legacy = read(teacher_path), read(legacy_path)
assert len(teacher['rows']) == 32 and not teacher['speedOverruns'] and not teacher['unactionableRoots']
assert legacy['passed'] == 10 and legacy['failed'] == 0
extras = [folder+'round1-v99-compat-'+x+'-20261029-v1.json' for x in ['step317', 'terminal-root']]
controls = [folder+'human405-v99-native-bound-controls-'+kind+'-'+str(n)+'-20261030-v1.json'
    for kind, n in [('teacher',24),('teacher',35),('teacher',36),('teacher',39),('teacher',44),('teacher',58),('legacy',105),('legacy',152),('autonomous',43)]]
pass_root_path = folder+'human405-v99-autonomous-pass-root-cold-20261031-v1.json'
source_reports = [teacher_path, legacy_path]+extras+controls+[r['evidencePath'] for r in teacher['rows']]+[pass_root_path]
sources = {}
for path in source_reports:
    report = read(path)
    for p, expected in report['sourceHashes'].items():
        assert sha(p) == expected, (path, p)
        if p in sources: assert sources[p] == expected
        sources[p] = expected
    for row in report.get('rows', [report]):
        if row.get('rawPath'): assert sha(row['rawPath']) == row['rawSha256']
rows = [{'id':'teacher-'+str(r['step']), 'native':r['evidenceNativeInputs'], 'milliseconds':r['milliseconds'],
    'complete':r['graphClosed'], 'originalAndRngUnchanged':r['rootAndRngUnchanged']} for r in teacher['rows']]
rows += [{'id':r['caseId'], 'native':r['diagnostics']['nativeExecutions'], 'milliseconds':r['rootAndSearchMilliseconds'],
    'complete':r['complete'], 'originalAndRngUnchanged':r['rootUnchanged']} for r in legacy['rows']]
for path in extras:
    r = read(path)
    rows.append({'id':path, 'native':r['diagnostics']['nativeExecutions'], 'milliseconds':r['rootAndSearchMilliseconds'],
        'complete':r['complete'], 'originalAndRngUnchanged':r['rootAndRngUnchanged']})
pass_root = read(pass_root_path)
rows.append({'id':'prior-autonomous-pass-43', 'native':pass_root['nativeInputs'], 'milliseconds':pass_root['milliseconds'],
    'complete':pass_root['complete'], 'originalAndRngUnchanged':pass_root['rootAndRngUnchanged']})
assert pass_root['chosen']['family'] == 'research_tech'
assert len(rows) == 45 and all(r['complete'] and r['originalAndRngUnchanged'] and r['native'] <= 256 and r['milliseconds'] <= 600 for r in rows)
proofs = [read(p) for p in controls]
assert all(p['sameBestAsFreshNativePolicy'] and p['sourceRootAndRngUnchanged'] for p in proofs)
for p in proofs:
    for c in p['controls']:
        assert c['nativeBestValue'] <= c['upperBound']
        assert c['actualMaximumPublicity'] <= c['bound']['maximumPublicity']
    for c in p['proofControls']: assert c['nativeValue'] == c['predictedValue']
logs = {'fullNode': folder+'human405-v99-full-node-20261031-v2.log',
    'relatedNode': folder+'human405-v99-related-node-20261031-v1.log',
    'browser': folder+'human405-v99-browser-smokes-20261031-v1.log',
    'valueInputs': folder+'human405-v99-v-input-audit-20261031-v1.log'}
text = {k:(stage/p).read_text() for k,p in logs.items()}
assert 'SUMMARY unit passed=151 failed=0 total=151' in text['fullNode']
assert 'SUMMARY fullFlow passed=1 failed=0 total=1' in text['fullNode']
assert 'SUMMARY unit passed=5 failed=0 total=5' in text['relatedNode']
assert 'SUMMARY browserSmoke passed=7 failed=0 total=7' in text['browser']
assert 'independent-pass-investment-window:' in text['valueInputs']
failures = [x for x in text['valueInputs'].splitlines() if '[FAIL]' in x]
assert len(failures) == 1 and 'aomomo' in failures[0]
old_teacher = read(folder+'human405-round1-v98-audit-20261030-v1.json')
changes = [{'step':r['step'], 'before':p['student'], 'after':r['student'], 'beforeValue':p['studentValue'], 'afterValue':r['studentValue']}
    for r,p in zip(teacher['rows'],old_teacher['rows']) if r['student'] != p['student'] or r['studentValue'] != p['studentValue']]
assert next(r for r in teacher['rows'] if r['step'] == 58)['category'] == 'same-first-input'
output = folder+'human405-v99-admission-20261031-v1.json'
report = {'schemaVersion':'seti-human405-pass-window-admission-v1', 'baseCommit':'88af65dbc83aa69092ebd8500218bba0371f12d5',
    'searchVersion':'seti-complete-decision-search-v99', 'valueModel':'seti-purpose-capital-state-value-v4',
    'sourceHashes':sources, 'sourceReports':source_reports, 'pointRows':rows,
    'all45CompleteWithin256NativeInputs600ms':True, 'maxNativeInputs':max(r['native'] for r in rows),
    'maxMilliseconds':max(r['milliseconds'] for r in rows),
    'nativeControls':{'reports':controls,'numericSources':sum(len(p['controls']) for p in proofs),
        'typedSources':sum(len(p['proofControls']) for p in proofs),'freshNativeRoots':len(proofs),
        'allBestActionsAndValuesPreserved':True,'allPublicityCeilingsChecked':True},
    'validation':{'unit':151,'fullFlow':1,'chrome':7,'logs':logs,'logHashes':{k:sha(p) for k,p in logs.items()},
        'valueInputs':'All independent current-model paths and the new PASS window path pass; sole pre-existing frozen-aomomo failure retained with exit1.',
        'initialFullNodeFailures':'3 synthetic test observations lacked mandatory passingPlayerIds. Fixtures updated without weakening the strict production input contract; related5 and final full suite pass.'},
    'teacherFirstInputMatches':teacher['categoryCounts']['same-first-input'], 'teacherChangesFromV98':changes,
    'candidateAdmitted':True,'autonomousRun':False,'baselineEligible':False,'goalStatus':'active',
    'scope':'Cold samples and independent native continuation proofs, not a new autonomous or full-game score claim.',
    'acceptedBaseline':'ai-search-v41-baseline-20261029',
    'next':'Deliver source, then exactly one standard original23-opening autonomous white R1; compare full native endpoints and remaining teacher choices.'}
(stage/output).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'output':output,'points':45,'maxNative':report['maxNativeInputs'],'maxMs':report['maxMilliseconds'],
    'numeric':report['nativeControls']['numericSources'],'typed':report['nativeControls']['typedSources'],
    'teacherMatches':report['teacherFirstInputMatches'],'admitted':True,'goalStatus':'active'}))
