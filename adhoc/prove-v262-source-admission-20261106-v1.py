from pathlib import Path
import hashlib,json,gzip,re
P=Path(__file__).resolve().parents[1];F=Path('reports/ai-foundation-20261105/third-round-teacher-v1');sha=lambda n:hashlib.sha256((P/n).read_bytes()).hexdigest();read=lambda n:json.loads((P/n).read_text())
mp='reports/ai-foundation-20261106/candidate-v262-blue-analysis-secured-scope-v1/manifest.json';m=read(mp);g=read(F/'v262-current-source-serial-gate-20261106-v1.json');evidence={mp:sha(mp)}
assert g['status']=='complete'and g['cases']==728 and len(g['rows'])==728 and g['measuredUniqueRoots']==596 and g['allClosed']
runtime={**m['baseRuntimeHashes'],**m['sourceHashes']}
for n,h in runtime.items():assert sha(n)==h,n
unique={}
for r in g['rows']:
 e=read(r['evidence']);assert e['candidateSourceManifestSha256']==sha(mp)
 assert e['fixtureSha256']==sha(e['fixture'])and e['rawSha256']==sha(e['rawPath'])
 assert e['searchVersion']=='seti-complete-decision-search-v262'and e['valueModel']=='seti-purpose-capital-state-value-v46'
 assert e['complete']and e['decisionGatePassed']and e['rootAndRngUnchanged']and e['nativeInputs']<=256 and e['milliseconds']<=600
 assert len(e['diagnostics']['limits'])==4 and all(v is None for v in e['diagnostics']['limits'].values())
 for n,h in e['sourceHashes'].items():assert sha(n)==h,n
 for fp in [e['fixture'],r['fixture']]:
  f=read(fp);identity=hashlib.sha256(json.dumps([f['seatId'],f['compositionEnvelope']],ensure_ascii=False,separators=(',',':')).encode()).hexdigest();assert identity==r['identity']
 raw=json.loads(gzip.decompress((P/e['rawPath']).read_bytes()));assert raw['complete']and raw['unresolved']==[]and raw['diagnostics']['nativeExecutions']==e['nativeInputs']and raw['value']==e['value']and raw['actionId']==e['actionId'];unique[identity]=e
 for n in [r['evidence'],r['fixture'],e['fixture'],e['rawPath']]:evidence[n]=sha(n)
assert len(unique)==596
pre=read(F/'v262-isolated-source-tree-20261106-v1.json');post=read(F/'v262-isolated-source-tree-post-validation-20261106-v1.json')
assert pre['snapshotTree']==post['snapshotTree']=='209de1f985a9ac37049bdcc8895827fe0150f8ca'
assert post['runtimeAssetToolsExactToStagedTree']and post['sharedIndexPreserved']and post['ownedSourceHashes']==m['sourceHashes']
log=(P/F/'v262-full-node-20261106-v1.log').read_text();assert 'SUMMARY unit passed=198 failed=0 total=198' in log and 'SUMMARY fullFlow passed=1 failed=0 total=1' in log and not re.search(r'^FAIL ',log,re.M)
log=(P/F/'v262-browser-20261106-v1.log').read_text();assert 'SUMMARY browserSmoke passed=9 failed=0 total=9'in log
audit=(P/F/'v262-input-audit-20261106-v1.log').read_text();assert audit.count('[PASS]')==55 and audit.count('[FAIL]')==1
fail=[line for line in audit.splitlines()if'[FAIL]'in line];oldAudit=(P/F/'v258-input-audit-20261106-v1.log').read_text();assert len(fail)==1 and 'decisionObs(装配后)'in fail[0]and'Cannot add property aomomo'in fail[0]and'Cannot add property aomomo'in oldAudit
comparison=read(F/'v262-cold-roots-v258-comparison-20261106-v1.json');assert comparison['pairedRoots']==595 and len(comparison['changes'])==37 and all(x['after']['value']>=x['before']['value']for x in comparison['changes'])
assert comparison['byRound']['1']=={'roots':93,'valueChanged':0,'choiceChanged':0}and comparison['byRound']['2']=={'roots':211,'valueChanged':0,'choiceChanged':0}
selected=read(F/'v262-first-two-selected-plan-regression-20261106-v1.json');assert selected['roots']==304 and not selected['changes']
graphs=read(F/'v262-paired-failed-candidate-graphs-20261106-v1.json');assert len(graphs['comparisons'])==5
assert all(not r['changes']and not r['diagnosticChanges']and r['nativeInputsUnchanged']for r in graphs['comparisons'])
for v,ms in [(259,641.9478330000001),(260,639.8043329999999),(261,618.9456660000001)]:
 gate=read(F/f'v{v}-current-source-serial-gate-20261106-v1.json');assert gate['status']=='failed-gate'and gate['failure']['milliseconds']==ms and gate['failure']['nativeInputs']==175
 for n in [F/f'v{v}-current-source-serial-gate-20261106-v1.json',gate['failure']['evidence']]:evidence[str(n)]=sha(n)
for n in ['v262-current-source-serial-gate-20261106-v1.json','v262-isolated-source-tree-20261106-v1.json','v262-isolated-source-tree-post-validation-20261106-v1.json','v262-full-node-20261106-v1.log','v262-browser-20261106-v1.log','v262-input-audit-20261106-v1.log','v262-cold-roots-v258-comparison-20261106-v1.json','v262-first-two-selected-plan-regression-20261106-v1.json','v262-paired-failed-candidate-graphs-20261106-v1.json','v262-secured-scope-red-20261106-v1.log','v262-secured-scope-functional-20261106-v1.log','v261-current-investment-red-20261106-v1.log','v261-investment-functional-20261106-v1.log','v261-combined-functional-20261106-v1.log']:
 evidence[str(F/n)]=sha(F/n)
for n in m['sourceHashes']:evidence[n]=sha(n)
r={'status':'source-admitted','sourceAdmitted':True,'baseCommit':m['baseCommit'],'runtime':'V262/V46','manifest':mp,'manifestSha256':sha(mp),'snapshotTree':post['snapshotTree'],'runtimeSourceHashes':runtime,'ownedSourceHashes':m['sourceHashes'],'namedCases':728,'uniqueNativeRoots':596,'allComplete':True,'maxNativeInputs':g['maxNativeInputs'],'maxMilliseconds':g['maxMilliseconds'],'fullUnitPassed':198,'fullFlowPassed':1,'browserRelatedPassed':9,'inputAudit':{'passed':55,'failed':1,'legacyAomomoOnly':True,'failure':fail[0]},'firstTwoRoundRegression':comparison['byRound'],'pairedHistoricalRoots':595,'historicalChanges':comparison['changes'],'actualV256ColdRootsChecked':78,'firstTwoSelectedPlanContractsUnchanged':304,'fiveRetainedFullCandidateGraphsUnchanged':True,'fourProductionBudgetsStillNull':True,'nativeStateActorSessionRngAndIntentIdentityRulesUnchanged':True,'runtimeAndValidationSnapshotBeforeAfterExact':True,'firstFailedCandidatesRetained':[259,260,261],'newAutonomousRuns':0,'developmentAligned':False,'lastActualR3':{'version':'V256','board':87,'tech':6,'income':'7C2E1card+1scan'},'teacherR3':{'board':105,'tech':6,'income':'7C4E1card+1scan'},'baseline':'V41','goalStatus':'active','next':'Publish admitted V262 source and run exactly one standard controlled R3 from a clean source commit. Actual non-inherited142/148 choices changed, so a new standard run is justified. Independently Native-replay all accepted inputs and compare before-PASS score, exact technology/slot, six incomes and assets; then continue R3 learning, R2-end review and autonomous first3.','evidenceSha256':evidence}
out=F/'v262-current-source-admission-20261106-v1.json';assert not(P/out).exists();(P/out).write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:v for k,v in r.items()if k not in ['runtimeSourceHashes','ownedSourceHashes','evidenceSha256','historicalChanges','firstTwoRoundRegression']}))
