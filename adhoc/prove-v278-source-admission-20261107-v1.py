from pathlib import Path
import hashlib,json,gzip,subprocess,re
P=Path(__file__).resolve().parents[1];F=Path('reports/ai-foundation-20261105/third-round-teacher-v1');D=Path('reports/ai-foundation-20261107/public-alien-offer-v1');mp=D/'source-manifest-20261107-v1.json';read=lambda n:json.loads((P/n).read_text());sha=lambda n:hashlib.sha256((P/n).read_bytes()).hexdigest();m=read(mp);expected={**m['baseRuntimeHashes'],**m['sourceHashes']};evidence={str(mp):sha(mp)};cache={}
def digest(n):
 if n not in cache:cache[n]=sha(n)
 return cache[n]
assert m['baseCommit']=='992a7fc310ebe26b74e1344358cab5cb300ec059'
for n,h in expected.items():assert sha(n)==h,n
for n in ['randomizer/game/ai/state-value.js','randomizer/game/ai/resource-demand.js','randomizer/game/ai/local-decision-plans.js','randomizer/game/ai/goal-movement.js','randomizer/game/ai/card-pick-planning.js','randomizer/game/ai/known-symbol-capital.js']:
 assert(P/n).read_bytes()==subprocess.check_output(['git','show',m['baseCommit']+':'+n],cwd=P)
# No alien-card draw/gameplay implementation changed: only the public projection.
name='randomizer/game/aliens/amiba.js';before=subprocess.check_output(['git','show',m['baseCommit']+':'+name],cwd=P).decode();after=(P/name).read_text();a='  function getPublicTraceState(';b='  // Private quote ledgers';assert before[:before.index(a)]==after[:after.index(a)] and before[before.index(b):]==after[after.index(b):]
g=read(D/'serial-cold-gate-20261107-v1.json');assert g['status']=='complete'and g['allClosed']and g['cases']==len(g['rows'])==1161 and g['measuredUniqueRoots']==751;unique={}
for row in g['rows']:
 e=read(row['evidence']);assert e['candidateSourceManifestSha256']==sha(mp)and e['fixtureSha256']==digest(e['fixture'])and e['rawSha256']==digest(e['rawPath']);assert e['complete']and e['decisionGatePassed']and e['rootAndRngUnchanged']and e['nativeInputs']<=256 and e['milliseconds']<=600;assert len(e['diagnostics']['limits'])==4 and all(v is None for v in e['diagnostics']['limits'].values())
 for n,h in e['sourceHashes'].items():assert digest(n)==h,n
 f=read(e['fixture']);identity=hashlib.sha256(json.dumps([f['seatId'],f['compositionEnvelope']],ensure_ascii=False,separators=(',',':')).encode()).hexdigest();assert identity==row['identity']
 if identity not in unique:
  raw=json.loads(gzip.decompress((P/e['rawPath']).read_bytes()));assert raw['complete']and not raw['unresolved']and raw['value']==e['value']and raw['actionId']==e['actionId']and raw['diagnostics']['nativeExecutions']==e['nativeInputs'];unique[identity]=e
 for n in [row['evidence'],e['fixture'],e['rawPath']]:evidence[n]=digest(n)
assert len(unique)==751
s=read(F/'v278-isolated-source-tree-20261107-v1.json');assert s['ownedSourceHashes']==m['sourceHashes']and s['sharedIndexPreserved']and s['runtimeAssetToolsExactToStagedTree']and s['noUnstagedOrUntrackedRuntimeInputs']
for n,h in expected.items():assert hashlib.sha256(subprocess.check_output(['git','show',s['snapshotTree']+':'+n],cwd=P)).hexdigest()==h,n
node=(P/D/'full-node-20261107-v1.log').read_text();assert 'SUMMARY unit passed=203 failed=0 total=203'in node and 'SUMMARY fullFlow passed=1 failed=0 total=1'in node and not re.search(r'^FAIL ',node,re.M)
unit=(P/D/'frozen-public-offer-unit-20261107-v1.log').read_text();assert '"publicAlienOffer":"passed"'in unit and '"hiddenWorlds":6'in unit and '"rootAndRngUnchanged":true'in unit
browser=(P/D/'browser-20261107-v2.log').read_text();assert 'SUMMARY browserSmoke passed=4 failed=0 total=4'in browser
for n in ['production-start-button','production-public-alien-offer','production-anonymous-data-continuation','production-known-postdraw-tail']:assert 'PASS '+n+' 'in browser
audit=(P/D/'input-audit-20261107-v3.log').read_text();assert audit.count('[PASS]')==59 and audit.count('[FAIL]')==1;failure=next(l for l in audit.splitlines()if'[FAIL]'in l);assert 'Cannot add property aomomo'in failure;assert '[PASS] independent-public-alien-acquisition:'in audit
comparison=read(D/'cold-contract-comparison-v277-20261107-v1.json');graphs=read(D/'first-two-graph-regression-20261107-v1.json');assert comparison['pairedRoots']==726 and comparison['firstTwoRoots']==304 and not comparison['firstTwoSelectedContractChanges'] and graphs['roots']==304 and not graphs['changes'];assert all(x['round']==3 for x in comparison['changes'])
red=(P/D/'before-fix-public-offer-20261107-v1.log').read_text();assert 'public Native display9 must be visible'in red and 'AssertionError'in red
native=read(D/'pending-native-projection-diagnostic-20261107-v1.json');assert len(native['rows'])==5 and all(r['portValue']==r['nativeValue']for r in native['rows']);assert [r['nativeValue']['total']for r in native['rows']]==[138,130,139.5,131.5,140]
for p in(P/D).rglob('*'):
 if p.is_file():evidence[str(p.relative_to(P))]=sha(p.relative_to(P))
evidence[str(F/'v278-isolated-source-tree-20261107-v1.json')]=sha(F/'v278-isolated-source-tree-20261107-v1.json')
for n,h in expected.items():assert sha(n)==h,n
out=F/'v278-current-source-admission-20261107-v1.json';assert not(P/out).exists();r={'status':'source-admitted','sourceAdmitted':True,'baseCommit':m['baseCommit'],'runtime':'V278/V48','manifest':str(mp),'manifestSha256':sha(mp),'snapshotTree':s['snapshotTree'],'runtimeSourceHashes':expected,'ownedSourceHashes':m['sourceHashes'],'namedCases':1161,'uniqueNativeRoots':751,'allComplete':True,'maxNativeInputs':g['maxNativeInputs'],'maxMilliseconds':g['maxMilliseconds'],'fullUnitPassed':203,'fullFlowPassed':1,'browserRelatedPassed':4,'inputAudit':{'passed':59,'failed':1,'legacyAomomoOnly':True,'failure':failure},'pairedHistoricalRoots':726,'firstTwoFullGraphsActionsValuesAndPlansUnchangedFromV277':304,'inheritedFirstTwoTimingChangesFromV274StillNeedAutonomousAssetCheck':3,'firstTwoAutonomousAssetsVerifiedForThisSource':False,'measuredThirdRoundChanges':comparison['changes'],'publicDisplayModelKnownAtRoot':9,'acquiredNativeKnownInstance':'alien-amiba-9-5','blindAndNewRefillOpaque':True,'hiddenDeckWorlds':6,'nativeFivePrefixValueParity':[138,130,139.5,131.5,140],'newAutonomousRuns':0,'developmentAligned':False,'fourProductionBudgetsStillNull':True,'nativePhysicalIdentityAndResourcePruningUnchanged':True,'knowledgeAddedToPolicyIdentitiesAndMemoization':True,'performanceMarginMilliseconds':600-g['maxMilliseconds'],'baseline':'V41','goalStatus':'active','next':'Publish isolated source then unique registered controlled teacherR3 and independent Native replay. Continue heldAmiba9 futurelaunch purpose, R3 technology/income, inheritedfirst-two assets, R2-end and original23 autonomousfirst3.','evidenceSha256':evidence};(P/out).write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:r[k]for k in ['status','runtime','namedCases','uniqueNativeRoots','maxNativeInputs','maxMilliseconds','fullUnitPassed','fullFlowPassed','browserRelatedPassed','firstTwoFullGraphsActionsValuesAndPlansUnchangedFromV277','newAutonomousRuns','goalStatus']},ensure_ascii=False))
