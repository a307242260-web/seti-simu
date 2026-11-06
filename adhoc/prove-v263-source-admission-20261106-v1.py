from pathlib import Path
import hashlib,json,gzip,re,subprocess
P=Path(__file__).resolve().parents[1];F=Path('reports/ai-foundation-20261105/third-round-teacher-v1')
read=lambda n:json.loads((P/n).read_text());sha=lambda n:hashlib.sha256((P/n).read_bytes()).hexdigest()
mp=Path('reports/ai-foundation-20261106/candidate-v263-research-order-mark-v1/manifest.json');m=read(mp);op=mp.parent/'validation-overlay-20261106-v1.json';overlay=read(op)
assert overlay['sourceManifest']==str(mp)and overlay['sourceManifestSha256']==sha(mp)and overlay['runtimeChanged']is False
owned={**m['sourceHashes'],**overlay['validationSourceHashes']};runtime={**m['baseRuntimeHashes'],**owned}
assert list(overlay['validationSourceHashes'])==['tools/browser-smoke-inventory.js']
for n,h in overlay['originalSourceHashes'].items():assert h==m['baseRuntimeHashes'][n]
for n,h in runtime.items():assert sha(n)==h,n
g=read(F/'v263-current-source-serial-gate-20261106-v1.json');assert g['status']=='complete'and g['allClosed']and g['cases']==len(g['rows'])==785 and g['measuredUniqueRoots']==628
evidence={str(mp):sha(mp),str(op):sha(op)};unique={}
for r in g['rows']:
 e=read(r['evidence']);assert e['candidateSourceManifestSha256']==sha(mp)and e['fixtureSha256']==sha(e['fixture'])and e['rawSha256']==sha(e['rawPath'])
 assert e['searchVersion']=='seti-complete-decision-search-v263'and e['valueModel']=='seti-purpose-capital-state-value-v47'
 assert e['complete']and e['decisionGatePassed']and e['rootAndRngUnchanged']and e['nativeInputs']<=256 and e['milliseconds']<=600
 assert len(e['diagnostics']['limits'])==4 and all(v is None for v in e['diagnostics']['limits'].values())
 for n,h in e['sourceHashes'].items():assert sha(n)==h,n
 for n in [e['fixture'],r['fixture']]:
  f=read(n);identity=hashlib.sha256(json.dumps([f['seatId'],f['compositionEnvelope']],ensure_ascii=False,separators=(',',':')).encode()).hexdigest();assert identity==r['identity']
 if r['identity']not in unique:
  raw=json.loads(gzip.decompress((P/e['rawPath']).read_bytes()));assert raw['complete']and raw['unresolved']==[]and raw['value']==e['value']and raw['actionId']==e['actionId']and raw['diagnostics']['nativeExecutions']==e['nativeInputs'];unique[r['identity']]=e
 for n in [r['evidence'],r['fixture'],e['fixture'],e['rawPath']]:evidence[n]=sha(n)
assert len(unique)==628
pre=read(F/'v263-isolated-source-tree-20261106-v1.json');post=read(F/'v263-isolated-source-tree-post-validation-20261106-v1.json')
assert pre['snapshotTree']=='37bc4d79d6c100b75ac6defd0949b17a4a38ab76'and post['snapshotTree']=='b2c6c48fbaf71648aaea4c5e91f6eaba87f70cfd'
assert pre['ownedSourceHashes']==m['sourceHashes']and post['ownedSourceHashes']==owned and pre['sharedIndexPreserved']and post['sharedIndexPreserved']and post['runtimeUnchangedFromFrozenCandidate']
assert post['validationOverlaySha256']==sha(op)
log=(P/F/'v263-full-node-final-20261106-v1.log').read_text();assert 'SUMMARY unit passed=199 failed=0 total=199'in log and 'SUMMARY fullFlow passed=1 failed=0 total=1'in log and not re.search(r'^FAIL ',log,re.M)
log=(P/F/'v263-browser-related-20261106-v3.log').read_text();assert 'SUMMARY browserSmoke passed=10 failed=0 total=10'in log and 'PASS production-research-order-mark'in log
audit=(P/F/'v263-input-audit-20261106-v1.log').read_text();assert audit.count('[PASS]')==55 and audit.count('[FAIL]')==1
fail=[l for l in audit.splitlines()if'[FAIL]'in l];assert len(fail)==1 and'Cannot add property aomomo'in fail[0]and'Cannot add property aomomo'in(P/F/'v262-input-audit-20261106-v1.log').read_text()
comparison=read(F/'v263-cold-roots-v262-comparison-20261106-v1.json');selected=read(F/'v263-first-two-selected-plan-regression-20261106-v1.json')
assert comparison['pairedRoots']==596 and len(comparison['changes'])==27 and all(r['after']['value']>=r['before']['value']for r in comparison['changes'])
assert comparison['byRound']['1']=={'roots':93,'valueChanged':0,'choiceChanged':0}and comparison['byRound']['2']=={'roots':211,'valueChanged':0,'choiceChanged':0}
assert selected['roots']==304 and not selected['changes']
native=read(F/'v263-native-learning-provenance-20261106-v1.json');assert native['nativeInputs']==56 and native['newSearchCalls']==0 and native['newAutonomousRuns']==0 and native['controlBranchesRestored']
for n,h in native['filesSha256'].items():assert sha(n)==h,n
fixture=read(F/'v263-research-order-mark-native-fixture-20261106-v1.json');control=read(fixture['source']);analysis=read(fixture['analysisControl']);assert sha(fixture['source'])==fixture['sourceSha256']and sha(fixture['analysisControl'])==fixture['analysisControlSha256']
assert fixture['compositionEnvelope']==analysis['nextTurnEnvelope']
for name,b in fixture['branches'].items():assert b['afterResearchEnvelope']==control['branches'][name]['afterResearchEnvelope']and b['rootAndRngRestored']
for n in ['v263-current-source-serial-gate-20261106-v1.json','v263-isolated-source-tree-20261106-v1.json','v263-isolated-source-tree-post-validation-20261106-v1.json','v263-full-node-final-20261106-v1.log','v263-browser-related-20261106-v3.log','v263-input-audit-20261106-v1.log','v263-cold-roots-v262-comparison-20261106-v1.json','v263-first-two-selected-plan-regression-20261106-v1.json','v263-native-learning-provenance-20261106-v1.json','v263-research-order-mark-red-20261106-v1.log']:
 evidence[str(F/n)]=sha(F/n)
out=F/'v263-current-source-admission-20261106-v1.json';assert not(P/out).exists()
r={'status':'source-admitted','sourceAdmitted':True,'baseCommit':m['baseCommit'],'runtime':'V263/V47','manifest':str(mp),'manifestSha256':sha(mp),'validationOverlay':str(op),'validationOverlaySha256':sha(op),'runtimeSourceHashes':runtime,'ownedSourceHashes':owned,'frozenPreValidationTree':pre['snapshotTree'],'finalValidationTree':post['snapshotTree'],'productionRuntimeUnchangedByValidationOverlay':True,'namedCases':785,'uniqueNativeRoots':628,'allComplete':True,'maxNativeInputs':g['maxNativeInputs'],'maxMilliseconds':g['maxMilliseconds'],'fullUnitPassed':199,'fullFlowPassed':1,'browserRelatedPassed':10,'inputAudit':{'passed':55,'failed':1,'legacyAomomoOnly':True,'failure':fail[0]},'firstTwoSelectedPlanContractsUnchanged':304,'pairedHistoricalRoots':596,'pairedR3ValueChanges':27,'pairedR3ChoiceChanges':2,'newLatestV262AndControlRoots':32,'nativeLearningInputs':56,'newAutonomousRuns':0,'developmentAligned':False,'lastActualR3':{'version':'V262','board':75,'tech':6,'income':'7C2E1card+1scan','milliseconds':4228},'bestActualR3':{'version':'V256','board':87,'tech':6,'income':'7C2E1card+1scan'},'nativeFixedControlNotAutonomous':{'board':81,'tech':6,'income':'7C3E1card+1scan','heldFirstExtraSecuredC1':4},'fourProductionBudgetsStillNull':True,'nativeIdentityAndResourcePruningUnchanged':True,'baseline':'V41','goalStatus':'active','next':'Publish isolated source and run the unique standard controlled R3 once; independently replay inputs and compare before-PASS assets. Continue R3 learning, R2-end decisions and autonomous first3. Known future orange1 free-probe/mission composition still needs review if development remains short.','evidenceSha256':evidence}
(P/out).write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in r.items()if k not in ['runtimeSourceHashes','ownedSourceHashes','evidenceSha256']},ensure_ascii=False))
