from pathlib import Path
import hashlib,json,gzip,subprocess
P=Path(__file__).resolve().parents[1];F=Path('reports/ai-foundation-20261105/third-round-teacher-v1');sha=lambda n:hashlib.sha256((P/n).read_bytes()).hexdigest();read=lambda n:json.loads((P/n).read_text())
mp='reports/ai-foundation-20261106/candidate-v258-company-income-greedy-order-v1/manifest.json';m=read(mp);g=read(F/'v258-current-source-serial-gate-20261106-v1.json');evidence={mp:sha(mp)}
assert g['status']=='complete' and g['cases']==727 and len(g['rows'])==727 and g['measuredUniqueRoots']==595 and g['allClosed']
runtime={**m['baseRuntimeHashes'],**m['sourceHashes']}
for n,h in runtime.items():assert sha(n)==h,n
unique={}
for r in g['rows']:
 e=read(r['evidence']);assert e['candidateSourceManifestSha256']==sha(mp)
 assert e['fixtureSha256']==sha(e['fixture']) and e['rawSha256']==sha(e['rawPath'])
 assert e['searchVersion']=='seti-complete-decision-search-v258' and e['valueModel']=='seti-purpose-capital-state-value-v46'
 assert e['complete'] and e['decisionGatePassed'] and e['rootAndRngUnchanged'] and e['nativeInputs']<=256 and e['milliseconds']<=600
 assert all(v is None for v in e['diagnostics']['limits'].values()) and len(e['diagnostics']['limits'])==4
 for n,h in e['sourceHashes'].items():assert sha(n)==h,n
 f=read(e['fixture']);identity=hashlib.sha256(json.dumps([f['seatId'],f['compositionEnvelope']],ensure_ascii=False,separators=(',',':')).encode()).hexdigest();assert identity==r['identity']
 raw=json.loads(gzip.decompress((P/e['rawPath']).read_bytes()));assert raw['complete'] and raw['unresolved']==[] and raw['diagnostics']['nativeExecutions']==e['nativeInputs'] and raw['value']==e['value'] and raw['actionId']==e['actionId'];unique[identity]=e
 alias=read(r['fixture']);aliasIdentity=hashlib.sha256(json.dumps([alias['seatId'],alias['compositionEnvelope']],ensure_ascii=False,separators=(',',':')).encode()).hexdigest();assert aliasIdentity==r['identity']
 for n in [r['evidence'],r['fixture'],e['fixture'],e['rawPath']]:evidence[n]=sha(n)
assert len(unique)==g['measuredUniqueRoots']
pre=read(F/'v258-isolated-source-tree-20261106-v1.json');validated=read(F/'v258-isolated-validated-source-tree-20261106-v1.json');post=read(F/'v258-isolated-validated-source-tree-post-validation-20261106-v1.json');assert pre['snapshotTree']=='daa4b4268abb4aeb44c5995845645b070fa94367';assert validated['snapshotTree']==post['snapshotTree']=='a05a5ef6e771ade7375c7a548568b9094f1b1bd1';assert post['runtimeAssetToolsExactToStagedTree'] and post['sharedIndexPreserved']
overlay=read(F/'v258-validation-overlay-20261106-v1.json');assert not overlay['runtimeChanged'] and overlay['sourceManifestSha256']==sha(mp)
for n,h in overlay['validationSourceHashes'].items():
 assert n.endswith('.test.js') and sha(n)==h,n
 original=subprocess.check_output(['git','show',m['baseCommit']+':'+n],cwd=P);assert hashlib.sha256(original).hexdigest()==overlay['originalSourceHashes'][n]
delta=subprocess.check_output(['git','diff','--name-only',pre['snapshotTree'],post['snapshotTree']],cwd=P,text=True).splitlines();assert set(delta)==set(overlay['validationSourceHashes'])
log=(P/F/'v258-full-node-20261106-v1.log').read_text();assert 'SUMMARY unit passed=196 failed=1 total=197' in log and 'SUMMARY fullFlow passed=1 failed=0 total=1' in log and 'FAIL randomizer/game/ai/amiba-blind-income.test.js' in log
log=(P/F/'v258-final-related-node-20261106-v1.log').read_text();assert 'SUMMARY unit passed=4 failed=0 total=4' in log and 'publicAmibaBlindIncome' in log
log=(P/F/'v258-browser-20261106-v1.log').read_text();assert 'SUMMARY browserSmoke passed=8 failed=0 total=8' in log
log=(P/F/'v258-input-audit-20261106-v1.log').read_text();assert log.count('[PASS]')==55 and log.count('[FAIL]')==1 and 'aomomo' in log
comparison=read(F/'v258-cold-roots-v256-comparison-20261106-v1.json');assert not any(c['after']['value']<c['before']['value']for c in comparison['changes']) and sum(comparison['byRound'][r]['roots']for r in ['1','2'])==304
selected=read(F/'v258-first-two-selected-plan-regression-20261106-v1.json');assert selected['roots']==304 and not selected['changes']
assert sum(not row['actualInheritedPlan']for row in comparison['actualV256ColdChecks'])==24
assert all(row['actualInheritedPlan']or row['actionSame']and row['valueSame']for row in comparison['actualV256ColdChecks'])
for n in ['v258-current-source-serial-gate-20261106-v1.json','v258-isolated-source-tree-20261106-v1.json','v258-isolated-validated-source-tree-20261106-v1.json','v258-isolated-validated-source-tree-post-validation-20261106-v1.json','v258-validation-overlay-20261106-v1.json','v258-final-related-node-20261106-v1.log','v258-full-node-20261106-v1.log','v258-browser-20261106-v1.log','v258-input-audit-20261106-v1.log','v258-cold-roots-v256-comparison-20261106-v1.json','v258-first-two-selected-plan-regression-20261106-v1.json','v257-company-income-priority-red-20261106-v1.log','v257-company-income-not-admitted-20261106-v1.json','v256-energy-income-finance-control-20261106-v1.json','v256-actual-cold-root-catalog-20261106-v1.json']:
 evidence[str(F/n)]=sha(F/n)
r={'status':'source-admitted','sourceAdmitted':True,'baseCommit':m['baseCommit'],'runtime':'V258/V46','manifest':mp,'manifestSha256':sha(mp),'snapshotTree':post['snapshotTree'],'runtimeSourceHashes':runtime,'ownedSourceHashes':{**m['sourceHashes'],**overlay['validationSourceHashes']},'namedCases':727,'uniqueNativeRoots':g['measuredUniqueRoots'],'allComplete':True,'maxNativeInputs':g['maxNativeInputs'],'maxMilliseconds':g['maxMilliseconds'],'nodeVerification':{'initialFullUnitPassed':196,'initialFullUnitFailed':1,'fullFlowPassed':1,'validationOnlyObsoleteShapeAssertion':'proofs.size>=14; all Native behavior checks retained','finalRelatedUnitPassed':4,'allCurrentUnitBusinessObligationsPassed':197,'initialFailureRetained':True,'doesNotClaimOneGreenFullRun':True},'browserRelatedPassed':8,'inputAudit':{'passed':55,'failed':1,'legacyAomomoOnly':True},'firstTwoRoundRegression':comparison['byRound'],'pairedHistoricalRoots':comparison['pairedRoots'],'historicalChanges':comparison['changes'],'actualV256ColdRootsChecked':78,'actualV256NonInheritedChoiceAndValueUnchanged':24,'firstTwoSelectedPlanContractsUnchanged':304,'fourProductionBudgetsStillNull':True,'nativeStateActorSessionRngAndIntentIdentityRulesUnchanged':True,'coldSnapshotTree':pre['snapshotTree'],'runtimeSnapshotBeforeAfterExact':True,'finalValidationSnapshotBeforeAfterExact':True,'validationOnlyTestDelta':delta,'firstFailedCandidatesRetained':True,'newAutonomousRuns':0,'developmentAligned':False,'lastActualR3':{'version':'V256','board':87,'tech':6,'income':'7C2E1card+1scan'},'teacherR3':{'board':105,'tech':6,'income':'7C4E1card+1scan'},'baseline':'V41','goalStatus':'active','next':'Publish admitted greedy preparation repair. No new game merely for an unselected-branch correction: all24 non-inherited actual V256 decisions and544 paired historical fresh roots preserve first choices/values. Investigate the actual149/150 inherited-goal versus fresh-root difference with Native controlled continuations before changing candidates/forecast. R3 learning, R2-end review and autonomous first3 remain; V41 baseline unchanged.','evidenceSha256':evidence}
out=F/'v258-current-source-admission-20261106-v1.json';assert not(P/out).exists();(P/out).write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:v for k,v in r.items()if k not in ['runtimeSourceHashes','ownedSourceHashes','evidenceSha256','firstTwoRoundRegression']}))
