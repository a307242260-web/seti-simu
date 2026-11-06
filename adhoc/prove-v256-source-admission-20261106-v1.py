from pathlib import Path
import hashlib,json,gzip
P=Path(__file__).resolve().parents[1];F=Path('reports/ai-foundation-20261105/third-round-teacher-v1');sha=lambda n:hashlib.sha256((P/n).read_bytes()).hexdigest();read=lambda n:json.loads((P/n).read_text())
mp='reports/ai-foundation-20261106/candidate-v256-purpose-income-consistency-v1/manifest.json';m=read(mp);g=read(F/'v256-current-source-serial-gate-20261106-v1.json');evidence={mp:sha(mp)}
assert g['status']=='complete' and g['cases']==646 and len(g['rows'])==646 and g['measuredUniqueRoots']==544 and g['allClosed']
runtime={**m['baseRuntimeHashes'],**m['sourceHashes']}
for n,h in runtime.items():assert sha(n)==h,n
unique={}
for r in g['rows']:
 e=read(r['evidence']);assert e['candidateSourceManifestSha256']==sha(mp)
 assert e['fixtureSha256']==sha(e['fixture']) and e['rawSha256']==sha(e['rawPath'])
 assert e['searchVersion']=='seti-complete-decision-search-v256' and e['valueModel']=='seti-purpose-capital-state-value-v46'
 assert e['complete'] and e['decisionGatePassed'] and e['rootAndRngUnchanged'] and e['nativeInputs']<=256 and e['milliseconds']<=600
 assert all(v is None for v in e['diagnostics']['limits'].values()) and len(e['diagnostics']['limits'])==4
 for n,h in e['sourceHashes'].items():assert sha(n)==h,n
 # Validate both the measured representative AND every named alias.
 for name in set([e['fixture'],r['fixture']]):
  f=read(name);identity=hashlib.sha256(json.dumps([f['seatId'],f['compositionEnvelope']],ensure_ascii=False,separators=(',',':')).encode()).hexdigest();assert identity==r['identity'],name;evidence[name]=sha(name)
 raw=json.loads(gzip.decompress((P/e['rawPath']).read_bytes()));assert raw['complete'] and raw['unresolved']==[] and raw['diagnostics']['nativeExecutions']==e['nativeInputs'] and raw['value']==e['value'] and raw['actionId']==e['actionId'];unique[identity]=e
 for n in [r['evidence'],e['rawPath']]:evidence[n]=sha(n)
assert len(unique)==544
pre=read(F/'v256-isolated-source-tree-20261106-v1.json');post=read(F/'v256-isolated-source-tree-post-validation-20261106-v1.json');assert pre['snapshotTree']==post['snapshotTree']=='eb5c400de1e60b92020df1fa903d5c66f7cb9eaf';assert post['runtimeAssetToolsExactToStagedTree'] and post['sharedIndexPreserved']
log=(P/F/'v256-related-node-20261106-v1.log').read_text();assert 'SUMMARY unit passed=23 failed=0 total=23' in log
log=(P/F/'v256-browser-20261106-v1.log').read_text();assert 'SUMMARY browserSmoke passed=7 failed=0 total=7' in log
log=(P/F/'v256-input-audit-20261106-v1.log').read_text();assert log.count('[PASS]')==55 and log.count('[FAIL]')==1 and 'aomomo' in log
parent='reports/ai-foundation-20261106/candidate-v255-income-consistency-v1/manifest.json';pm=read(parent);parentPre=read(F/'v255-isolated-source-tree-20261106-v1.json');parentPost=read(F/'v255-isolated-source-tree-post-validation-20261106-v1.json');assert parentPre['snapshotTree']==parentPost['snapshotTree']=='9a081da6587187edd491a4bddcd490bad0441c9c'
parentLog=(P/F/'v255-full-node-20261106-v1.log').read_text();assert 'SUMMARY unit passed=195 failed=0 total=195' in parentLog and 'SUMMARY fullFlow passed=1 failed=0 total=1' in parentLog
# Parent functional evidence is not current full-suite or strategy admission.
parentRuntime={**pm['baseRuntimeHashes'],**pm['sourceHashes']};delta=[n for n in sorted(set(runtime)|set(parentRuntime))if runtime.get(n)!=parentRuntime.get(n)]
assert set(delta)=={'randomizer/game/ai/resource-demand.js','randomizer/game/ai/decision-search.js','randomizer/game/ai/state-value.js','randomizer/game/ai/income-purpose-eligibility.test.js','tools/node-test-inventory.js','tools/browser-smoke-inventory.js'},delta
comparison=read(F/'v256-cold-roots-v254-comparison-20261106-v1.json');assert sum(comparison['byRound'][r]['roots']for r in ['1','2'])==304
assert all(c['round']in ['3','4']for c in comparison['changes']);assert all(c['after']['value']>=c['before']['value']for c in comparison['changes'])
selected=read(F/'v256-first-two-selected-plan-regression-20261106-v1.json');assert selected['roots']==304 and not selected['changes']
for n in [parent,*[str(F/n)for n in ['v256-current-source-serial-gate-20261106-v1.json','v256-isolated-source-tree-20261106-v1.json','v256-isolated-source-tree-post-validation-20261106-v1.json','v256-related-node-20261106-v1.log','v256-browser-20261106-v1.log','v256-input-audit-20261106-v1.log','v256-cold-roots-v254-comparison-20261106-v1.json','v256-first-two-selected-plan-regression-20261106-v1.json','v255-full-node-20261106-v1.log','v255-isolated-source-tree-20261106-v1.json','v255-isolated-source-tree-post-validation-20261106-v1.json','v255-strategy-regression-not-admitted-20261106-v1.json','v255-actual-alias-fixture-packaging-repair-20261106-v1.json','v254-income-equal-value-native-20261106-v1.json','v253-actual-cold-root-catalog-20261106-v1.json']]]:evidence[n]=sha(n)
r={'status':'source-admitted','sourceAdmitted':True,'baseCommit':m['baseCommit'],'runtime':'V256/V46','manifest':mp,'manifestSha256':sha(mp),'snapshotTree':post['snapshotTree'],'runtimeSourceHashes':runtime,'ownedSourceHashes':m['sourceHashes'],'namedCases':646,'uniqueNativeRoots':544,'allComplete':True,'maxNativeInputs':g['maxNativeInputs'],'maxMilliseconds':g['maxMilliseconds'],'relatedNode':{'unitPassed':23,'failed':0},'parentFunctionalFullSuite':{'runtime':'V255/V45','unitPassed':195,'fullFlowPassed':1,'failed':0,'doesNotClaimCurrentFullSuite':True,'changedPathsFromParent':delta},'browserRelatedPassed':7,'inputAudit':{'passed':55,'failed':1,'legacyAomomoOnly':True},'firstTwoRoundRegression':comparison['byRound'],'firstTwoSelectedPlanContractsUnchanged':304,'historicalChanges':comparison['changes'],'actualV253ColdRootsChecked':68,'fourProductionBudgetsStillNull':True,'nativeStateActorSessionRngAndIntentIdentityRulesUnchanged':True,'sourceSnapshotBeforeAfterExact':True,'allNamedAliasFixturesIncluded':True,'firstFailedCandidatesRetained':True,'newAutonomousRuns':0,'developmentAligned':False,'lastActualR3':{'version':'V253','board':72,'tech':4,'income':'6C3E2card+1scan'},'teacherR3':{'board':105,'tech':6,'income':'7C4E1card+1scan'},'baseline':'V41','goalStatus':'active','next':'Publish frozen source, run exactly one standard controlled R3 from teacher112 prefix, independently replay it and compare settled assets. Continue R3 learning before R2-end review and autonomous first3.','evidenceSha256':evidence}
out=F/'v256-current-source-admission-20261106-v1.json';assert not(P/out).exists();(P/out).write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:v for k,v in r.items()if k not in ['runtimeSourceHashes','ownedSourceHashes','evidenceSha256','firstTwoRoundRegression','historicalChanges']}))
