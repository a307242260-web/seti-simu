from pathlib import Path
import hashlib,json,re
w=Path(__file__).resolve().parents[1];f=Path('reports/ai-foundation-20261105/third-round-teacher-v1');mp=Path('reports/ai-foundation-20261106/candidate-v229-public-amiba-blind-income-v1/manifest.json');sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();read=lambda p:json.loads((w/p).read_text());m=read(mp);out=w/f/'v229-current-source-admission-20261106-v1.json';assert not out.exists()
for n,h in m['baseRuntimeHashes'].items():assert sha(w/n)==m['sourceHashes'].get(n,h),n
for n,h in m['sourceHashes'].items():assert sha(w/n)==h,n
gate=read(f/'v229-current-source-serial-gate-20261106-v1.json');assert gate['status']=='complete'and len(gate['rows'])==573
runtime={};seen=set()
for row in gate['rows']:
 e=read(row['evidence']);assert e['candidateSourceManifestSha256']==sha(w/mp);assert e['fixtureSha256']==sha(w/e['fixture']);assert e['rawSha256']==sha(w/e['rawPath']);assert e['complete']and e['decisionGatePassed']and e['rootAndRngUnchanged']and e['nativeInputs']<=256 and e['milliseconds']<=600
 for n,h in e['sourceHashes'].items():assert sha(w/n)==h,n;assert runtime.get(n,h)==h,n;runtime[n]=h
 seen.add(row['identity'])
assert len(seen)==gate['measuredUniqueRoots']==483
full=(w/f/'v229-full-node-20261106-v1.log').read_text();assert 'SUMMARY unit passed=184 failed=0 total=184'in full;assert 'SUMMARY fullFlow passed=1 failed=0 total=1'in full
browser=(w/f/'v229-browser-related-20261106-v1.log').read_text();assert 'SUMMARY browserSmoke passed=5 failed=0 total=5'in browser
snapPath=f/'v229-admission-independent-snapshot-20261106-v1.json';snap=read(snapPath);assert snap['status']=='passed'and snap['testsPassed']==23 and len(snap['fixtureHashes'])==317 and snap['ownedSourceHashes']==m['sourceHashes']
for n,h in snap['logsSha256'].items():assert sha(w/n)==h,n
for n,h in snap['fixtureHashes'].items():assert sha(w/n)==h,n
audit=(w/f/'v229-state-input-audit-20261106-v1.log').read_text();assert audit.count('[PASS]')==51 and audit.count('[FAIL]')==1 and 'Cannot add property aomomo'in audit
identity=read(f/'v229-full-native-identity-parity-20261106-v1.json');assert identity['status']=='passed'and identity['roots']==483 and identity['allNativeRootBytesUnchanged']and identity['currentSourceSha256']==sha(w/'randomizer/game/ai/analysis-port.js')
portfolio=read(f/'v229-joint-research-purpose-parity-20261106-v1.json');assert portfolio['status']=='passed'and portfolio['roots']==483 and portfolio['allNativeRootBytesUnchanged']and portfolio['currentSourceSha256']==sha(w/'randomizer/game/ai/state-value.js')
controls=[]
for name,count,inputs in [('v229-amiba-dlc-all-native-controls-20261106-v1.json',36,119),('v229-amiba-blind-income-native-controls-20261106-v1.json',14,42)]:
 c=read(f/name);assert c['status']=='passed'and c['proofCount']==count and c['additionalNativeInputs']==inputs and c['allRootChoicesValuesAndRealizationsEqualFullNative']and c['rootAndRngUnchanged'];assert all(v is None for v in c['productionBudgets'].values());controls.append({'path':str(f/name),'proofs':count,'nativeControlInputs':inputs})
comment=read(f/'v229-native-controls-comment-only-source-parity-20261106-v1.json');assert comment['status']=='passed'and comment['frozenSha256']==sha(w/'randomizer/game/ai/decision-search.js')
for r in comment['reports']:assert sha(w/r['path'])==r['sha256']
primary=read(f/'v229-cold-dlc31-setup-15-20261106-v1.json');assert primary['nativeInputs']==233 and primary['decisionGatePassed']
files=[p for p in(w/f).iterdir()if p.is_file()and p.name.startswith(('v226-','v227-','v228-','v229-'))]
result={'status':'source-admitted','sourceAdmitted':True,'baseCommit':m['baseCommit'],'runtime':'V229/V37','manifest':str(mp),'manifestSha256':sha(w/mp),'scope':m['scope'],'runtimeSourceHashes':runtime,'ownedSourceHashes':m['sourceHashes'],'namedCases':573,'uniqueNativeRoots':483,'allComplete':True,'maxNativeInputs':max(r['nativeInputs']for r in gate['rows']),'maxMilliseconds':max(r['milliseconds']for r in gate['rows']),'primaryDLC31':{'nativeInputs':233,'milliseconds':primary['milliseconds'],'sameAllRootValuesAndRealizationsAsV225':True},'unitPassed':184,'unitFailed':0,'fullFlowPassed':1,'browserRelatedPassed':5,'independentSnapshot':{'path':str(snapPath),'tests':23,'fixtures':317},'nativeProofControls':controls,'proofRuntimeCommentParity':str(f/'v229-native-controls-comment-only-source-parity-20261106-v1.json'),'wholePurposeParityRoots':483,'fullCanonicalIdentityParityRoots':483,'inputAudit':{'pass':51,'fail':1,'legacyAomomoFailureUnchanged':True,'allGreen':False},'legacyHeuristicFullPageTimeoutUnresolved':True,'fourProductionBudgetsStillNull':True,'nativeStateActorSessionRngAndIntentEquivalenceUnchanged':True,'firstFailuresRetained':['V219','V220','V221','V222','V223','V224','V225','V226','V227','V228'],'newAutonomousRuns':0,'lastAutonomousRecord':'reports/research/768b7f09.341f6fad.quick-400.json','lastR3Assets':{'score':82,'tech':5,'incomeCreditsEnergyCards':[6,3,1],'scanIncome':1},'teacherR3Assets':{'score':105,'tech':6,'incomeCreditsEnergyCards':[7,4,1],'scanIncome':1},'developmentAligned':False,'baseline':'V41 unchanged','nextWork':'Known public income option funded by anonymous hand quantity; then exact R3 development, R2 end review and autonomous first3. No new game until strategy source admitted.','goalStatus':'active','evidenceSha256':{str(p.relative_to(w)):sha(p)for p in sorted(files)}}
out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'out':str(out.relative_to(w)),'sourceAdmitted':True,'namedCases':573,'uniqueRoots':483,'maxInputs':result['maxNativeInputs'],'maxMilliseconds':result['maxMilliseconds'],'unit':184,'browser':5,'newAutonomousRuns':0}))
