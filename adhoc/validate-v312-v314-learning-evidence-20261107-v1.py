from pathlib import Path
import json,hashlib,re,subprocess
root=Path(__file__).resolve().parents[1]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda p:json.loads(p.read_text())
D=root/'reports/ai-foundation-20261107';out=D/'case152-stationary-prototype-v1/delivery-validation-20261107-v1.json';assert not out.exists()
versions=[]
for v,name,owned,tests in [(312,'analysis-lazy-explanations-v1',167,16),(313,'analysis-lazy-regions-v1',173,17),(314,'analysis-lazy-trace-contexts-v1',179,18)]:
 d=D/name;m=read(d/'source-manifest-20261107-v1.json');assert len(m['sourceHashes'])==owned
 for n,h in m['sourceHashes'].items():assert sha(d/'source-snapshot'/n)==h,(v,n)
 if v==314:
  for n,h in m['sourceHashes'].items():assert sha(root/n)==h,n
 log=(d/'related-node-20261107-v1.log').read_text();assert f'SUMMARY unit passed={tests} failed=0 total={tests}'in log
 assert 'SUMMARY browserSmoke passed=10 failed=0 total=10'in(d/'browser-smokes-20261107-v1.log').read_text()
 audit=(d/'input-audit-20261107-v1.log').read_text();assert len(re.findall(r'^\[PASS\]',audit,re.M))==65;assert len(re.findall(r'^\[FAIL\]',audit,re.M))==1;assert 'aomomo'in audit
 gate=read(d/'serial-cold-gate-20261107-v1.json');assert gate['status']=='failed-gate'and not gate['candidateAdmitted'];versions.append({'version':v,'ownedFrozenHashes':owned,'NodePassed':tests,'ChromePassed':10,'auditPass':65,'oldAuditFail':1,'firstNative':gate['rows'][0]['nativeInputs'],'firstMilliseconds':gate['rows'][0]['milliseconds'],'firstPassed':gate['rows'][0]['decisionGatePassed']})
gate=read(D/'analysis-lazy-trace-contexts-v1/serial-cold-gate-20261107-v1.json');assert len(gate['rows'])==25 and gate['measuredUniqueRoots']==24;assert gate['failure']['nativeInputs']==805
paired=read(D/'analysis-lazy-trace-contexts-v1/paired-v311-v314-cold-roots-20261107-v1.json');assert paired['allSerializedRootsExact']and paired['rootCount']==15
for n in ['native-input-policy-diagnostic-20261107-v3.json','native-tail-rejection-diagnostic-20261107-v4.json']:
 d=read(D/'case152-native-distribution-v1'/n);assert d['nativeInputs']==805 and d['fullSerializedRootsExact']and d['sourceAndRngPreserved'];assert sha(root/d['checkpoint'])==d['checkpointSha256']
P=D/'case152-stationary-prototype-v1';proof=read(P/'ordering-native-proof-20261107-v3.json');independent=read(P/'ordering-independent-native-verification-20261107-v4.json');assert proof['prototypeNativeInputs']==654 and len(proof['proofs'])==37 and proof['materializedNativeInputs']==385 and proof['rootAndRngRestored'];assert independent['allStateSessionRngExact']and independent['status']=='passed'and independent['independentNativeInputs']==385
assert sha(root/independent['report'])==independent['reportSha256'];assert sha(root/independent['checkpoint'])==independent['checkpointSha256'];cp=read(root/proof['checkpoint']);assert len(cp['rows'])==37 and sum(len(r['actions'])for r in cp['rows'])==385
for name in ['prototype','localPrototype']:assert sha(root/proof[name])==proof[name+'Sha256']
helpers=[p for p in(root/'adhoc').iterdir()if p.suffix=='.js'and re.search(r'(?:v312|v313|v314|v311-v314).*20261107',p.name)]
for p in helpers:subprocess.run(['node','--check',str(p)],check=True,capture_output=True)
for p in P.glob('*prototype*.js'):subprocess.run(['node','--check',str(p)],check=True,capture_output=True)
r={'status':'passed-evidence-only','scope':'No new source admission or runtime promotion. Validates retained frozen source/test logs/cold outcomes/diagnostic checkpoints and independently replayed prototype proofs, no search or game rerun.','versions':versions,'V314NamedCases':25,'V314UniqueRoots':24,'V314FailureNative':805,'prototypeNative':654,'prototypeProofs':37,'NativeMaterialized':385,'independentNativeReplay':385,'fullSource179Exact':True,'hard132SerializedRoots15Exact':True,'helperSyntaxChecks':len(helpers),'newAiQueries':0,'newAutonomousRuns':0,'ProductionVersion':'V278/V48','baseline':'V41'}
out.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
