from pathlib import Path
import hashlib,json,re
w=Path(__file__).resolve().parents[1];f=Path('reports/ai-foundation-20261105/third-round-teacher-v1');mp=Path('reports/ai-foundation-20261106/candidate-v214-income-scalar-class-v1/manifest.json');sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();m=json.loads((w/mp).read_text());out=w/f/'v214-current-source-admission-20261106-v1.json';assert not out.exists();gate=json.loads((w/f/'v214-current-source-serial-gate-20261106-v1.json').read_text());assert gate['status']=='complete'and len(gate['rows'])==409 and gate['measuredUniqueRoots']==324
for n,h in m['baseRuntimeHashes'].items():assert sha(w/n)==m['sourceHashes'].get(n,h),n
for n,h in m['sourceHashes'].items():assert sha(w/n)==h,n
runtime={};seen=set()
for row in gate['rows']:
 e=json.loads((w/row['evidence']).read_text());assert e['candidateSourceManifestSha256']==sha(w/mp);assert sha(w/e['fixture'])==e['fixtureSha256'];assert sha(w/e['rawPath'])==e['rawSha256'];assert e['complete']and e['decisionGatePassed']and e['rootAndRngUnchanged']and e['nativeInputs']<=256 and e['milliseconds']<=600
 for n,h in e['sourceHashes'].items():assert sha(w/n)==h,n;assert runtime.get(n,h)==h,n;runtime[n]=h
 seen.add(row['identity'])
assert len(seen)==324
full=(w/f/'v214-full-node-20261106-v1.log').read_text();assert re.search(r'SUMMARY unit passed=180 failed=0 total=180',full);assert re.search(r'SUMMARY fullFlow passed=1 failed=0 total=1',full)
browser=(w/f/'v214-browser-related-20261106-v1.log').read_text();assert 'SUMMARY browserSmoke passed=16 failed=0 total=16'in browser
snapPath=f/'v214-admission-independent-snapshot-20261106-v1.json';snap=json.loads((w/snapPath).read_text());assert snap['status']=='passed'and snap['testsPassed']==18 and len(snap['fixtureHashes'])==298
assert snap['ownedSourceHashes']==m['sourceHashes']
for n,h in snap['logsSha256'].items():assert sha(w/n)==h,n
au=(w/f/'v214-state-input-audit-20261106-v1.log').read_text();assert au.count('[PASS]')==51 and au.count('[FAIL]')==1 and 'Cannot add property aomomo'in au
failures={}
for v,name in [(209,'computer-income-analysis'),(210,'preparation-copy'),(211,'unfunded-research'),(212,'investment-scalar-cache'),(213,'company-module')]:
 p=Path(f'reports/ai-foundation-20261106/candidate-v{v}-{name}-v1/failure-20261106-v1.json');assert(w/p).exists();failures[str(v)]=str(p)
files=[p for p in(w/f).iterdir()if p.is_file()and p.name.startswith('v214-')]
result={'status':'source-admitted','sourceAdmitted':True,'baseCommit':m['baseCommit'],'runtime':'V214/V33','scope':'Shared Browser/Simulation production; known computer3/data3 currency-income plus fixed analysis, prepaid inert research/pink/yellow triggers. Readonly preparation copies, lazily resolved company module and certified ordinary-income scalar classes preserve V209 values. No new autonomous result.','manifest':str(mp),'manifestSha256':sha(w/mp),'runtimeSourceHashes':runtime,'ownedSourceHashes':m['sourceHashes'],'namedCases':409,'uniqueNativeRoots':324,'allComplete':True,'maxNativeInputs':max(r['nativeInputs']for r in gate['rows']),'maxMilliseconds':max(r['milliseconds']for r in gate['rows']),'unitPassed':180,'unitFailed':0,'fullFlowPassed':1,'independentSnapshot':{'path':str(snapPath),'tests':18,'fixtures':298},'browserRelatedPassed':16,'inputAudit':{'pass':51,'fail':1,'legacyAomomoFailureUnchanged':True,'allGreen':False},'legacyHeuristicFullPageTimeoutUnresolved':True,'failedCandidatesRetained':failures,'removedUnhelpfulScalarCache':'V212 investmentFor64-entry cache is absent from V214; V214 reuses only certified within-income-choice after values, successful module reference and preexisting admitted caches.','nativeNodeEquivalenceAndBudgetsUnchanged':True,'newAutonomousRuns':0,'lastAutonomousRecord':'reports/research/a121adb0.697b888b.quick-400.json','lastR3Assets':{'score':76,'tech':5,'incomeCreditsEnergyCards':[7,2,1],'scanIncome':1},'teacherR3Assets':{'score':105,'tech':6,'incomeCreditsEnergyCards':[7,4,1],'scanIncome':1},'developmentAligned':False,'baseline':'V41 unchanged','goalStatus':'active','evidenceSha256':{str(p.relative_to(w)):sha(p)for p in sorted(files)}}
out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'out':str(out.relative_to(w)),'sourceAdmitted':True,'uniqueRoots':324,'maxInputs':result['maxNativeInputs'],'maxMilliseconds':result['maxMilliseconds']}))
