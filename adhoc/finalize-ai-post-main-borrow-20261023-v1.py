"""Verify and package existing bounded diagnostics; never reruns searches."""
import gzip
import hashlib
import json
import pathlib
import subprocess

stage=pathlib.Path.cwd()
base='17e92a1316721fec5e3dcb461bcd9909a8b71bf7'
output='reports/ai-foundation-20261023/post-main-borrow-validation-v1.json'
assert not (stage/output).exists(), 'Reuse existing validation checkpoint'
sha=lambda b:hashlib.sha256(b).hexdigest()
def load(p):
    data=(stage/p).read_bytes()
    return json.loads(gzip.decompress(data) if str(p).endswith('.gz') else data)
def dump(p,d):
    (stage/p).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
files=set()
def package(d):
    p=d['rawPath'];data=(stage/p).read_bytes();assert sha(data)==d['rawSha256']
    if not p.endswith('.gz'):
        packed=gzip.compress(data,mtime=0);p+='.gz';(stage/p).write_bytes(packed)
        d.update(rawPath=p,rawSha256=sha(packed),rawEncoding='gzip',rawUncompressedSha256=sha(data))
    else: assert sha(gzip.decompress(data))==d['rawUncompressedSha256']
    files.add(p)
def verify_runtime(d):
    for p,expected in d['sourceHashes'].items():assert sha((stage/p).read_bytes())==expected,(p,expected)

corpus_path='reports/ai-foundation-20261023/decision-corpus-audit-v24.json';corpus=load(corpus_path);verify_runtime(corpus)
assert len(corpus['rows'])==8 and corpus['passed']==4
for row in corpus['rows']: assert row['rootUnchanged'];package(row)
dump(corpus_path,corpus);files.add(corpus_path)
profile_path='reports/ai-foundation-20261023/late-semantic-case062-v10.json';profile=load(profile_path);verify_runtime(profile);assert profile['rootUnchanged'];package(profile);dump(profile_path,profile);files.add(profile_path)
actual_path='reports/ai-foundation-20261023/post-main-borrow-actual-window-v1.json';actual=load(actual_path);verify_runtime(actual)
assert sha((stage/actual['checkpointPath']).read_bytes())==actual['checkpointSha256'];files.add(actual['checkpointPath'])
for row in actual['rows']:assert row['rootUnchanged'];package(row)
files.add(actual_path)
for v in [1,2]:
    p=f'reports/ai-foundation-20261023/identity-projections-case062-v{v}.json';d=load(p)
    assert d['searchGraphMatchesReference'] and d['rootUnchanged']
    assert d['originalAnalysisSha256']==sha(subprocess.check_output(['git','-C','/Users/bilibili/code/seti-simu','show',base+':randomizer/game/ai/analysis-port.js']))
    for name,expected in d['sourceHashes'].items():assert sha(subprocess.check_output(['git','-C','/Users/bilibili/code/seti-simu','show',base+':'+name]))==expected
    driver=f'adhoc/diagnose-ai-identity-projections-20261023-v{v}.js';assert sha((stage/driver).read_bytes())==d['driverSha256'];files.add(p)
node_path='reports/ai-foundation-20261023/post-main-borrow-full-node-v1.log';node=(stage/node_path).read_text()
assert 'SUMMARY unit passed=131 failed=0 total=131' in node and 'SUMMARY fullFlow passed=1 failed=0 total=1' in node
unit_path='reports/ai-foundation-20261023/post-main-borrow-unit-v2.log';unit=(stage/unit_path).read_text();controlled=json.loads(unit.strip().splitlines()[-1]);assert controlled['postMainBorrow']=='passed'
browser_path='reports/ai-foundation-20261023/post-main-borrow-browser-v1.log';assert 'SUMMARY browserSmoke passed=3 failed=0 total=3' in (stage/browser_path).read_text()
audit_path='reports/ai-foundation-20261023/state-value-input-audit-v25.log';audit=(stage/audit_path).read_text();independent=[line for line in audit.splitlines() if line.startswith('[PASS] independent')];failures=[line for line in audit.splitlines() if line.startswith('[FAIL]')]
assert len(independent)==27 and any('independent-post-main-borrow' in line for line in independent)
assert len(failures)==1 and 'aomomo' in failures[0]
syntax_path='reports/ai-foundation-20261023/post-main-borrow-syntax-v1.json';syntax=load(syntax_path);assert len(syntax['rows'])==10
for row in syntax['rows']: assert row['exitCode']==0 and sha((stage/row['path']).read_bytes())==row['sha256']
files.update([node_path,unit_path,browser_path,audit_path,syntax_path])
changed=['randomizer/game/ai/analysis-port.js','randomizer/game/ai/decision-search.js','randomizer/game/ai/post-main-borrow.test.js','randomizer/index.html','tools/node-test-inventory.js','tools/audit_v_state_inputs.js',
 'docs/ai-post-main-borrow-proof-20261023.md','docs/ai-implementation-20261022.md','docs/ai-development-workflow.md','docs/ai-interface-inventory-20261022.md','docs/ai-search-agent-contract-20261023.md',
 'adhoc/diagnose-ai-identity-projections-20261023-v1.js','adhoc/diagnose-ai-identity-projections-20261023-v2.js','adhoc/benchmark-ai-post-main-borrow-20261023-v1.js','adhoc/audit-ai-decision-corpus-20261023-v24.js','adhoc/profile-ai-late-semantic-case062-20261023-v10.js',
 'adhoc/ai-post-main-upper-bound-next-20261023-v1.md','adhoc/finalize-ai-post-main-borrow-20261023-v1.py','adhoc/deliver-ai-post-main-borrow-20261023-v1.py']
files.update(changed)
report={'schemaVersion':'seti-ai-post-main-borrow-validation-v1','date':'2026-10-23','baseCommit':base,'snapshot':str(stage),'searchVersion':'seti-complete-decision-search-v26',
 'scope':'Post-main Turing continuation simulation. Exact identities, all payment entity sets, tie policy, boundaries and fixed global budgets preserved.',
 'controlled':controlled['rows'],'sharedFactory':{'passed':True,'actualInputs':2,'mandatoryChoicesAfterFirstInput':8,'source':'final post-main-borrow.test.js and targeted unit-v2 log'},
 'node':{'command':'node tools/run_node_tests.js','unitPassed':131,'fullFlowPassed':1,'logPath':node_path,'finalTargetLogPath':unit_path,
 'scopeNote':'Production runtime stayed frozen through full regression. The new unit was then extended with shared-factory actual-click assertions; the final superset unit passed separately. Other tests are unchanged.'},
 'browser':{'passed':3,'logPath':browser_path},'syntaxPath':syntax_path,
 'valueAudit':{'logPath':audit_path,'exitCode':1,'independentPassed':len(independent),'legacyFailures':failures},
 'fixedGate':{'path':corpus_path,'passed':4,'failed':4,'budget':corpus['budget']},
 'original062':{'path':profile_path,'complete':profile['complete'],'transitions':profile['diagnostics']['transitions'],'nodes':profile['diagnostics']['nodes'],'unresolved':profile['unresolvedCount'],'milliseconds':profile['milliseconds'],
 'eligibleProofNodes':profile['diagnostics']['postMainBorrowProofNodes'],'executedBorrowMacros':profile['diagnostics']['postMainBorrowMacros'],'limitation':'Different FIFO prefix and still incomplete; no total-work or speed claim.'},
 'actualPostMainWindow':{'path':actual_path,'rows':[{k:r[k] for k in ['enabled','complete','milliseconds','unresolved']}|{'transitions':r['diagnostics']['transitions'],'nodes':r['diagnostics']['nodes']} for r in actual['rows']],
 'limitation':'Both off/on remain incomplete; same-process sequential timing does not establish speed improvement.'},
 'diagnosticProjectionScope':'Both identity projection reports bind the base commit runtime and leave the exact search graph unchanged. They are not production projections or speed benchmarks.',
 'newSearchFullGames':0,'newSearchFinalScores':None,'fullGame180SecondAcceptance':'Not run; necessary decision coverage remains incomplete.',
 'nextDesignPath':'adhoc/ai-post-main-upper-bound-next-20261023-v1.md','sourceHashes':{p:sha((stage/p).read_bytes()) for p in changed},
 'evidenceHashes':{p:sha((stage/p).read_bytes()) for p in sorted(files) if p not in changed}}
dump(output,report);files.add(output)
dump('adhoc/ai-resource-scope-stage36-snapshot-20261023.json',{'baseCommit':base,'snapshot':str(stage),'validationPath':output,'files':{p:sha((stage/p).read_bytes()) for p in sorted(files)},
 'notes':'Isolated archive base with explicit own overlay. Runtime imports bound to final sources; diagnostic projections separately bind base. Shared worktree/index excluded.'})
print(json.dumps({'files':len(files),'controlled':report['controlled'],'fixedGate':report['fixedGate'],'newSearchFullGames':0},ensure_ascii=False))
