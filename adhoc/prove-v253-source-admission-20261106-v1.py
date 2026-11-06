from pathlib import Path
import hashlib,json,gzip
P=Path(__file__).resolve().parents[1];F=Path('reports/ai-foundation-20261105/third-round-teacher-v1');sha=lambda n:hashlib.sha256((P/n).read_bytes()).hexdigest();read=lambda n:json.loads((P/n).read_text())
mp='reports/ai-foundation-20261106/candidate-v253-needed-research-sides-v1/manifest.json';m=read(mp);g=read(F/'v253-current-source-serial-gate-20261106-v1.json');evidence={mp:sha(mp)}
assert g['status']=='complete' and g['cases']==576 and len(g['rows'])==576 and g['measuredUniqueRoots']==485 and g['allClosed']
runtime={**m['baseRuntimeHashes'],**m['sourceHashes']}
for n,h in runtime.items():assert sha(n)==h,n
unique={}
for r in g['rows']:
 e=read(r['evidence']);assert e['candidateSourceManifestSha256']==sha(mp)
 assert e['fixtureSha256']==sha(e['fixture']) and e['rawSha256']==sha(e['rawPath'])
 assert e['searchVersion']=='seti-complete-decision-search-v253' and e['valueModel']=='seti-purpose-capital-state-value-v43'
 assert e['complete'] and e['decisionGatePassed'] and e['rootAndRngUnchanged'] and e['nativeInputs']<=256 and e['milliseconds']<=600
 assert all(v is None for v in e['diagnostics']['limits'].values()) and len(e['diagnostics']['limits'])==4
 for n,h in e['sourceHashes'].items():assert sha(n)==h,n
 f=read(e['fixture']);identity=hashlib.sha256(json.dumps([f['seatId'],f['compositionEnvelope']],ensure_ascii=False,separators=(',',':')).encode()).hexdigest();assert identity==r['identity']
 unique[identity]=e
 for n in [r['evidence'],e['fixture'],e['rawPath']]:evidence[n]=sha(n)
assert len(unique)==485
pre=read(F/'v253-isolated-source-tree-20261106-v1.json');post=read(F/'v253-isolated-source-tree-post-validation-20261106-v1.json');assert pre['snapshotTree']==post['snapshotTree']=='446e75a5336d001f426b92f7b89c08604260f547';assert post['runtimeAssetToolsExactToStagedTree'] and post['sharedIndexPreserved']
log=(P/F/'v253-full-node-20261106-v1.log').read_text();assert 'SUMMARY unit passed=193 failed=0 total=193' in log and 'SUMMARY fullFlow passed=1 failed=0 total=1' in log
log=(P/F/'v253-browser-20261106-v1.log').read_text();assert 'SUMMARY browserSmoke passed=8 failed=0 total=8' in log
log=(P/F/'v253-input-audit-20261106-v1.log').read_text();assert log.count('[PASS]')==54 and log.count('[FAIL]')==1 and 'aomomo' in log
comparison=read(F/'v253-cold-roots-v239-comparison-20261106-v1.json');assert not comparison['changes'] and sum(comparison['byRound'][r]['roots']for r in ['1','2'])==304
parity=read(F/'v253-v250-complete-graph-parity-20261106-v1.json');assert not parity['differences'] and len(parity['rows'])==485 and all(r['allGraphFieldsEqual']for r in parity['rows'])
for n in ['v253-current-source-serial-gate-20261106-v1.json','v253-isolated-source-tree-20261106-v1.json','v253-isolated-source-tree-post-validation-20261106-v1.json','v253-full-node-20261106-v1.log','v253-browser-20261106-v1.log','v253-input-audit-20261106-v1.log','v253-cold-roots-v239-comparison-20261106-v1.json','v253-v250-complete-graph-parity-20261106-v1.json','v250-input-enumeration-order-control-20261106-v1.json','v250-scalar-order-red-test-20261106-v1.log']:
 evidence[str(F/n)]=sha(F/n)
r={'status':'source-admitted','sourceAdmitted':True,'baseCommit':m['baseCommit'],'runtime':'V253/V43','manifest':mp,'manifestSha256':sha(mp),'snapshotTree':post['snapshotTree'],'runtimeSourceHashes':runtime,'ownedSourceHashes':m['sourceHashes'],'namedCases':576,'uniqueNativeRoots':485,'allComplete':True,'maxNativeInputs':g['maxNativeInputs'],'maxMilliseconds':g['maxMilliseconds'],'fullNode':{'unitPassed':193,'fullFlowPassed':1,'failed':0},'browserRelatedPassed':8,'inputAudit':{'passed':54,'failed':1,'legacyAomomoOnly':True},'firstTwoRoundRegression':comparison['byRound'],'completeDefaultGraphParity':485,'fourProductionBudgetsStillNull':True,'nativeStateActorSessionRngAndIntentEquivalenceUnchanged':True,'sourceSnapshotBeforeAfterExact':True,'firstFailedCandidatesRetained':True,'newAutonomousRuns':0,'developmentAligned':False,'lastActualR3':{'version':'V237','board':82,'tech':5,'income':'6C3E1card+1scan'},'teacherR3':{'board':105,'tech':6,'income':'7C4E1card+1scan'},'baseline':'V41','goalStatus':'active','next':'Publish admitted source; exactly one standard same-start teacher-third-round experiment, then continue development learning and second-round-end review.','evidenceSha256':evidence}
out=F/'v253-current-source-admission-20261106-v1.json';assert not(P/out).exists();(P/out).write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:v for k,v in r.items()if k not in ['runtimeSourceHashes','ownedSourceHashes','evidenceSha256','firstTwoRoundRegression']}))
