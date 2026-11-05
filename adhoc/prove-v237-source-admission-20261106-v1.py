from pathlib import Path
import hashlib,json,re
w=Path(__file__).resolve().parents[1];F=Path('reports/ai-foundation-20261105/third-round-teacher-v1');mp=Path('reports/ai-foundation-20261106/candidate-v237-public-income-quantity-v1/manifest.json');read=lambda p:json.loads((w/p).read_text());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();m=read(mp);out=w/F/'v237-current-source-admission-20261106-v1.json';assert not out.exists();hashes={}
def checked(name,expected):
 if name not in hashes:hashes[name]=sha(w/name)
 assert hashes[name]==expected,name
for n,h in m['baseRuntimeHashes'].items():checked(n,m['sourceHashes'].get(n,h))
for n,h in m['sourceHashes'].items():checked(n,h)
gate=read(F/'v237-current-source-serial-gate-20261106-v1.json');assert gate['status']=='complete'and len(gate['rows'])==574
runtime={};seen=set()
for row in gate['rows']:
 e=read(row['evidence']);assert e['candidateSourceManifestSha256']==sha(w/mp);checked(e['fixture'],e['fixtureSha256']);checked(e['rawPath'],e['rawSha256']);assert e['complete']and e['decisionGatePassed']and e['rootAndRngUnchanged']and e['nativeInputs']<=256 and e['milliseconds']<=600
 assert len(e['diagnostics']['limits'])==4 and all(v is None for v in e['diagnostics']['limits'].values())
 for n,h in e['sourceHashes'].items():checked(n,h);assert runtime.get(n,h)==h;runtime[n]=h
 seen.add(row['identity'])
assert len(seen)==gate['measuredUniqueRoots']==483
full=(w/F/'v237-full-node-20261106-v1.log').read_text();assert 'SUMMARY unit passed=186 failed=0 total=186'in full;assert 'SUMMARY fullFlow passed=1 failed=0 total=1'in full
browser=(w/F/'v237-browser-20261106-v1.log').read_text();assert 'SUMMARY browserSmoke passed=5 failed=0 total=5'in browser
snapshot=F/'v237-admission-independent-snapshot-20261106-v1.json';snap=read(snapshot);assert snap['status']=='passed'and snap['testsPassed']==26 and len(snap['fixtureHashes'])==319 and snap['ownedSourceHashes']==m['sourceHashes']
for n,h in {**snap['logsSha256'],**snap['fixtureHashes']}.items():checked(n,h)
audit=(w/F/'v237-input-audit-20261106-v1.log').read_text();assert audit.count('[PASS]')==51 and audit.count('[FAIL]')==1 and 'Cannot add property aomomo'in audit
comparison=read(F/'v237-cold-roots-v230-comparison-20261106-v1.json');assert comparison['uniqueRoots']==483
for round in ['1','2']:assert comparison['byRound'][round]['valueChanged']==comparison['byRound'][round]['choiceChanged']==0
assert sum(comparison['byRound'][r]['roots']for r in ['1','2'])==304
current=read(F/'v237-public-income-gap-revalue-20261106-v1.json');rows={r['name']:r for r in current['rows']};assert rows['DLC31']['before']['total']==rows['DLC31']['nativeAfterSwap']['total']==123.58333333333333;assert rows['ordinary']['before']['total']==rows['ordinary']['nativeAfterSwap']['total']==118.58333333333333
controls={}
for line in full.splitlines():
 try:r=json.loads(line)
 except (ValueError,TypeError):continue
 if isinstance(r,dict):
  for key in ['publicAmibaIncomeSwap','publicAmibaFixedCurrencyTail','publicAmibaBlindIncome','publicIncomeOption']:
   if key in r:controls[key]=r
assert controls['publicAmibaIncomeSwap']['nativeIncomeControlInputs']==6
assert controls['publicAmibaFixedCurrencyTail']['fullNativeChoiceValueAndRealizationMatch']
assert controls['publicAmibaBlindIncome']['exactUnknownBoundaryValueAndRealization']
assert controls['publicIncomeOption']['committedSwapColdRecovery']==3 and controls['publicIncomeOption']['preparedInputs']==13
for n,text in [('v231-public-income-red-20261106-v1.log','known, free public income'),('v231-fixed-income-red-20261106-v1.log','assert(spec.incomeTail.realizesForecast)'),('v236-anonymous-selection-red-20261106-v1.log','anonymous quantity is a value promise')]:assert text in(w/F/n).read_text()
assert sha(w/'randomizer/game/ai/analysis-port.js')==m['baseRuntimeHashes']['randomizer/game/ai/analysis-port.js']
files=[p for p in(w/F).iterdir()if p.is_file()and p.name.startswith(tuple(f'v{n}-'for n in range(231,238)))]
result={'status':'source-admitted','sourceAdmitted':True,'baseCommit':m['baseCommit'],'runtime':'V237/V42','manifest':str(mp),'manifestSha256':sha(w/mp),'scope':m['scope'],'runtimeSourceHashes':runtime,'ownedSourceHashes':m['sourceHashes'],'namedCases':574,'uniqueNativeRoots':483,'allComplete':True,'maxNativeInputs':gate['maxNativeInputs'],'maxMilliseconds':gate['maxMilliseconds'],'unitPassed':186,'unitFailed':0,'fullFlowPassed':1,'browserRelatedPassed':5,'independentSnapshot':{'path':str(snapshot),'tests':26,'fixtures':319},'nativeControlResults':controls,'firstTwoRoundRegression':{'roots':304,'changedValues':0,'changedChoices':0},'thirdRoundRootChanges':comparison['byRound']['3'],'sameNativePublicIncomeQuote':{'beforeAndAfter':123.58333333333333,'ordinaryBranchBeforeAndAfter':118.58333333333333,'anonymousMetadataIndependent':True,'allThreeNativeSwapMenusRecovered':True,'flatIncomePreparationActuallyExecuted':True,'abstractSupplierCannotProduceExecutableSelection':True},'inputAudit':{'pass':51,'fail':1,'legacyAomomoFailureUnchanged':True,'allGreen':False},'legacyHeuristicFullPageTimeoutUnresolved':True,'fourProductionBudgetsStillNull':True,'nativeStateActorSessionRngAndIntentEquivalenceUnchanged':True,'firstFailuresRetained':['V231-old-root762ms-and-unrealized-income','V232-old-root739ms','V233-old-root648ms','V234-old-root642ms','V235-income-root625ms','V236-all-cold-passed-but-anonymous-execution-selection-withheld'],'newAutonomousRuns':0,'lastAutonomousRecord':'reports/research/768b7f09.341f6fad.quick-400.json','lastR3Assets':{'score':82,'tech':5,'incomeCreditsEnergyCards':[6,3,1],'scanIncome':1},'teacherR3Assets':{'score':105,'tech':6,'incomeCreditsEnergyCards':[7,4,1],'scanIncome':1},'developmentAligned':False,'baseline':'ai-search-v41-baseline-20261029 unchanged','nextWork':'Run one standard R3-only experiment on the committed admitted source, from the exact teacher start. Continue R3 node learning, then review R2 end and autonomous first3.','goalStatus':'active','evidenceSha256':{str(p.relative_to(w)):sha(p)for p in sorted(files)}}
out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'out':str(out.relative_to(w)),'sourceAdmitted':True,'cases':574,'roots':483,'maxInputs':gate['maxNativeInputs'],'maxMilliseconds':gate['maxMilliseconds'],'unit':186,'browser':5,'newAutonomousRuns':0}))
