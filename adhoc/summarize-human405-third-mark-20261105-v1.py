"""Summarize saved V193 checks, preserving first cold samples and known failures."""
from pathlib import Path
import gzip
import hashlib
import json

stage=Path(__file__).resolve().parents[1];folder=Path('reports/ai-foundation-20261105/third-round-teacher-v1')
output=stage/folder/'v193-research-mark-review-20261105-v1.json';evidence={}
sha=lambda p:hashlib.sha256((stage/p).read_bytes()).hexdigest()
def read(p):
    evidence[str(p)]=sha(p);return json.loads((stage/p).read_text())
manifest_path=Path('reports/ai-foundation-20261105/candidate-v193-research-mark-20261105-v1/manifest.json');manifest=read(manifest_path)
for name,digest in manifest['sourceHashes'].items():assert sha(manifest_path.parent/name)==digest
roots=[]
for label in ['case-105','teacher-r3-first-white','teacher-r3-after-amiba-reveal','teacher-r3-before-safety-protocol']:
    path=folder/f'v193-cold-{label}-20261105-v1.json';r=read(path)
    assert r['complete'] and r['decisionGatePassed'] and r['rootAndRngUnchanged'] and not r['candidateAdmitted']
    assert sha(r['fixture'])==r['fixtureSha256'] and sha(r['rawPath'])==r['rawSha256'] and sha(r['candidateSourceManifest'])==r['candidateSourceManifestSha256']
    for name,digest in r['sourceHashes'].items():assert sha(name)==digest,name
    raw=json.loads(gzip.decompress((stage/r['rawPath']).read_bytes()));assert raw['unresolved']==[]
    root={k:r[k]for k in ['label','actionId','value','nativeInputs','milliseconds','decisionGatePassed']}
    if label=='teacher-r3-before-safety-protocol':
        protocol=next(p for p in raw['roots']if p['actionId']=='play_card:201c00de');assert protocol['value']==101.5 and r['value']==117
        root['protocolValue']=protocol['value'];root['v192ProtocolValue']=94.5
    roots.append(root)
proof=read(folder/'v193-independent-candidate-verification-20261105-v1.json');assert proof['status']=='passed' and proof['manifestSha256']==sha(manifest_path)
for name,digest in proof['logsSha256'].items():assert sha(name)==digest;evidence[name]=digest
classification=read(folder/'v193-probe-regression-classification-20261105-v1.json');assert classification['sameMissingIncomePlanFailureAsV193']
assert sha(classification['log'])==classification['logSha256']
logs=['v193-research-mark-red-20261105-v1.log','v193-research-mark-test-20261105-v1.log','v193-research-mark-test-20261105-v2.log','v193-marker-focused-tests-20261105-v1.log','v193-probe-capital-regression-20261105-v1.log','v193-state-input-audit-20261105-v1.log']
for name in logs:evidence[str(folder/name)]=sha(folder/name)
assert 'unit passed=14 failed=1 total=15' in (stage/folder/logs[3]).read_text()
assert '"nativeNetValue":6.5' in (stage/folder/logs[2]).read_text()
assert '"controlledComputerPrefixBeatsIncome":true' in (stage/folder/logs[4]).read_text()
baseline=Path('reports/ai-foundation-20261104/two-rounds-teacher-v2/v189-value-input-audit-20261105-v1.log');evidence[str(baseline)]=sha(baseline)
old=(stage/baseline).read_text().splitlines();new=(stage/folder/logs[5]).read_text().splitlines()
failures=lambda lines:[line for line in lines if line.startswith('[FAIL]')]
assert failures(old)==failures(new) and len(failures(new))==1 and 'aomomo' in failures(new)[0]
assert sum(line.startswith('[PASS]')for line in new)==49
result={'status':'active','previousGoalTurnClassification':'progress','productionRuntime':'V189/V22','candidate':'V193/V23','candidateAdmitted':False,'productionChanged':False,'newAutonomousRuns':0,'baselineChanged':False,'candidateManifest':str(manifest_path),'coldRoots':roots,'nativeMarkerGrowth':7,'nativeResearchControlInputs':2,'nativeResearchNetValue':6.5,'relatedRegression':{'firstBatchPassed':14,'firstBatchFailed':1,'failureWasPresentOnExactV192':True,'correctedProbeTestPassed':True,'independentChangedBehaviorTestsPassed':4},'stateInputAudit':{'passed':49,'failed':1,'failureExactV189Baseline':failures(new)[0],'fullAuditPassed':False},'nextIssues':['funded-continuing-research-trigger-and-known-symbol-movement','continuous-scan-value-of-purple2-and-orange2','first113-ordinary-landing-vs-DLC31-order-and-wallet-tradeoff','joint-blue-board-capacity-in-existing-paid-and-held-forecast','complete-source-admission-and-same-state-autonomous-third-round','second-round-end-review-after-third-round-learning'],'interpretation':'Existing claimed D growth is repaired. Protocol branch still loses101.5 to117, and the first113 choice changes to ordinary landing102.25. These are local model results, not autonomous game scores or proof of third-round alignment.','evidenceSha256':evidence}
payload=json.dumps(result,ensure_ascii=False,indent=2)+'\n'
if output.exists():assert output.read_text()==payload
else:output.write_text(payload)
print(json.dumps({'output':str(output.relative_to(stage)),'fourKeyColdGatesPassed':True,'productionChanged':False,'goalStatus':'active','auditFullGreen':False}))
