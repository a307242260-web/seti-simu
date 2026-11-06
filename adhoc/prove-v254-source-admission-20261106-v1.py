from pathlib import Path
import hashlib,json,gzip
P=Path(__file__).resolve().parents[1];F=Path('reports/ai-foundation-20261105/third-round-teacher-v1');sha=lambda n:hashlib.sha256((P/n).read_bytes()).hexdigest();read=lambda n:json.loads((P/n).read_text())
mp='reports/ai-foundation-20261106/candidate-v254-known-blue-data-v1/manifest.json';m=read(mp);g=read(F/'v254-current-source-serial-gate-20261106-v1.json');evidence={mp:sha(mp)}
assert g['status']=='complete' and g['cases']==645 and len(g['rows'])==645 and g['measuredUniqueRoots']==543 and g['allClosed']
runtime={**m['baseRuntimeHashes'],**m['sourceHashes']}
for n,h in runtime.items():assert sha(n)==h,n
unique={}
for r in g['rows']:
 e=read(r['evidence']);assert e['candidateSourceManifestSha256']==sha(mp)
 assert e['fixtureSha256']==sha(e['fixture']) and e['rawSha256']==sha(e['rawPath'])
 assert e['searchVersion']=='seti-complete-decision-search-v254' and e['valueModel']=='seti-purpose-capital-state-value-v44'
 assert e['complete'] and e['decisionGatePassed'] and e['rootAndRngUnchanged'] and e['nativeInputs']<=256 and e['milliseconds']<=600
 assert all(v is None for v in e['diagnostics']['limits'].values()) and len(e['diagnostics']['limits'])==4
 for n,h in e['sourceHashes'].items():assert sha(n)==h,n
 f=read(e['fixture']);identity=hashlib.sha256(json.dumps([f['seatId'],f['compositionEnvelope']],ensure_ascii=False,separators=(',',':')).encode()).hexdigest();assert identity==r['identity']
 raw=json.loads(gzip.decompress((P/e['rawPath']).read_bytes()));assert raw['complete'] and raw['unresolved']==[] and raw['diagnostics']['nativeExecutions']==e['nativeInputs'] and raw['value']==e['value'] and raw['actionId']==e['actionId'];unique[identity]=e
 for n in [r['evidence'],e['fixture'],e['rawPath']]:evidence[n]=sha(n)
assert len(unique)==543
pre=read(F/'v254-isolated-source-tree-20261106-v1.json');post=read(F/'v254-isolated-source-tree-post-validation-20261106-v1.json');assert pre['snapshotTree']==post['snapshotTree']=='2a8c4c0ab431630659a5e78384cce1ee7e5fbf4d';assert post['runtimeAssetToolsExactToStagedTree'] and post['sharedIndexPreserved']
log=(P/F/'v254-full-node-20261106-v1.log').read_text();assert 'SUMMARY unit passed=194 failed=0 total=194' in log and 'SUMMARY fullFlow passed=1 failed=0 total=1' in log
log=(P/F/'v254-browser-20261106-v1.log').read_text();assert 'SUMMARY browserSmoke passed=5 failed=0 total=5' in log
log=(P/F/'v254-input-audit-20261106-v1.log').read_text();assert log.count('[PASS]')==55 and log.count('[FAIL]')==1 and 'aomomo' in log
comparison=read(F/'v254-cold-roots-v253-comparison-20261106-v1.json');assert not comparison['changes'] and sum(comparison['byRound'][r]['roots']for r in ['1','2'])==304
for n in ['v254-current-source-serial-gate-20261106-v1.json','v254-isolated-source-tree-20261106-v1.json','v254-isolated-source-tree-post-validation-20261106-v1.json','v254-full-node-20261106-v1.log','v254-browser-20261106-v1.log','v254-input-audit-20261106-v1.log','v254-cold-roots-v253-comparison-20261106-v1.json','v254-known-blue-data-native-control-20261106-v1.json','v254-blue-data-analysis-test-20261106-v5.log','v254-blue-data-analysis-red-20261106-v1.log','v254-income-equal-value-native-20261106-v1.json','v253-actual-cold-root-catalog-20261106-v1.json']:
 evidence[str(F/n)]=sha(F/n)
r={'status':'source-admitted','sourceAdmitted':True,'baseCommit':m['baseCommit'],'runtime':'V254/V44','manifest':mp,'manifestSha256':sha(mp),'snapshotTree':post['snapshotTree'],'runtimeSourceHashes':runtime,'ownedSourceHashes':m['sourceHashes'],'namedCases':645,'uniqueNativeRoots':543,'allComplete':True,'maxNativeInputs':g['maxNativeInputs'],'maxMilliseconds':g['maxMilliseconds'],'fullNode':{'unitPassed':194,'fullFlowPassed':1,'failed':0},'browserRelatedPassed':5,'inputAudit':{'passed':55,'failed':1,'legacyAomomoOnly':True},'firstTwoRoundRegression':comparison['byRound'],'pairedHistoricalRootsUnchanged':485,'actualV253ColdRootsChecked':68,'fourProductionBudgetsStillNull':True,'nativeStateActorSessionRngAndIntentEquivalenceUnchanged':True,'sourceSnapshotBeforeAfterExact':True,'firstFailedCandidatesRetained':True,'newAutonomousRuns':0,'developmentAligned':False,'lastActualR3':{'version':'V253','board':72,'tech':4,'income':'6C3E2card+1scan'},'teacherR3':{'board':105,'tech':6,'income':'7C4E1card+1scan'},'baseline':'V41','goalStatus':'active','next':'Publish verified blue-trigger and public-counter fix. Test an equal-value income tie policy consistently in initial/pending plans before another autonomous experiment. No new game merely for this source parity; third-round learning, R2-end review and autonomousfirst3 remain.','evidenceSha256':evidence}
out=F/'v254-current-source-admission-20261106-v1.json';assert not(P/out).exists();(P/out).write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:v for k,v in r.items()if k not in ['runtimeSourceHashes','ownedSourceHashes','evidenceSha256','firstTwoRoundRegression']}))
