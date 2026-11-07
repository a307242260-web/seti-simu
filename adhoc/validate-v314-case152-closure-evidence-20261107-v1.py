from pathlib import Path
import collections,hashlib,json,re,subprocess
root=Path(__file__).resolve().parents[1];D=root/'reports/ai-foundation-20261107/case152-completed-prefix-v1';A=root/'reports/ai-foundation-20261107/case152-prefix-alias-diagnostic-v1';out=D/'case152-closure-evidence-20261107-v1.json'
read=lambda p:json.loads(p.read_text());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();mp=root/'reports/ai-foundation-20261107/analysis-lazy-trace-contexts-v1/source-manifest-20261107-v1.json';m=read(mp);assert len(m['sourceHashes'])==179
for n,h in m['sourceHashes'].items():assert sha(root/n)==h,n
b=read(A/'envelope-prefix-aliases-20261107-v1.json');assert b['aliasStatistics']['strictRepeated']==b['aliasStatistics']['envelopeOnlyRepeated']==0
alias=read(A/'identity-prefix-aliases-20261107-v2.json');assert alias['identityStatistics']['exactRepeated']==alias['identityStatistics']['logicalRepeated']==4
residual=read(A/'residual-tail-rejections-20261107-v3.json');rs=residual['tailReasons'];completed=[r for r in rs if r['reason']=='blue-tail-live-probe-needs-native-continuation'];assert len(rs)==87 and len(completed)==21 and all(r['intent']['path']==[] and r['intent']['goal']['timing']=='advance-before-rotation' for r in completed)
steps=[('completed-prefix-prototype-20261107-v1.json',507),('fixed-blue-prefix-prototype-20261107-v2.json',320),('r4-energy-bound-prototype-20261107-v3.json',320),('combined-native-proofs-20261107-v5.json',260),('combined-analysis-priority-proofs-20261107-v6.json',260),('combined-analysis-chain-priority-proofs-20261107-v7.json',260),('combined-movement-defer-proofs-20261107-v8.json',256),('combined-fast-stationary-proofs-20261107-v9.json',256),('combined-objective-memo-proofs-20261107-v10.json',256),('combined-rotated-distances-proofs-20261107-v11.json',256),('combined-rotated-geometry-proofs-20261107-v12.json',256),('combined-affordable-prefix-proofs-20261107-v13.json',256)]
ref=read(D/'combined-independent-native-verification-20261107-v5.json');assert ref['status']=='passed'and ref['allStateSessionRngExact']and ref['independentNativeInputs']==785 and len(ref['rows'])==65;assert sha(root/ref['checkpoint'])==ref['checkpointSha256'];assert sha(root/ref['report'])==ref['reportSha256']
sig=lambda r:hashlib.sha256(json.dumps(r,sort_keys=True,separators=(',',':')).encode()).hexdigest();authority=collections.Counter(map(sig,read(root/ref['checkpoint'])['rows']))
rows=[]
for n,count in steps:
 d=read(D/n);assert d.get('prototypeNativeInputs',d.get('nativeInputs'))==count,n
 row={'report':str((D/n).relative_to(root)),'sha256':sha(D/n),'NativeInputs':count,'diagnosticMilliseconds':d.get('diagnostics',{}).get('milliseconds')}
 if 'checkpoint'in d:
  assert sha(root/d['checkpoint'])==d['checkpointSha256'];cp=read(root/d['checkpoint']);assert len(cp['rows'])==65 and sum(len(r['actions'])for r in cp['rows'])==785
  current=collections.Counter(map(sig,cp['rows']));row.update(proofRowsSharedWithIndependentReference=sum((authority&current).values()),materializedNativeInputs=d['materializedNativeInputs'],newNativeSubmissionsDuringMaterialization=d['actualAdditionalNativeExecutions'])
 rows.append(row)
assert next(r for r in rows if 'combined-fast-stationary' in r['report'])['proofRowsSharedWithIndependentReference']==65
old=(root/'randomizer/game/effects/probe-turn-session.js').read_text();new=(D/'probe-turn-shared-payments-prototype-20261107-v4.js').read_text()
def body(s):
 a=s.index('function getMovePaymentChoices(');indent=s[s.rfind('\n',0,a)+1:a];end=re.search(r'^'+re.escape(indent)+r'}$',s[a:],re.M);assert end;return [l.strip()for l in s[a:a+end.end()].splitlines()]
assert body(old)==body(new),'shared Native payment enumeration body must remain unchanged'
files=[p for p in(root/'adhoc').iterdir()if p.suffix=='.js'and re.search(r'v314-case152-.*20261107',p.name)]+list(D.glob('*.js'))
for p in files:subprocess.run(['node','--check',str(p)],check=True,capture_output=True)
r={'status':'passed-diagnostic-evidence-only','goalStatus':'active','formal':'V278/V48','frozenCandidate':'V314/V54/Resource25','sourceHashesUnchanged':179,'oldGateStillFailed':True,'sourceAdmitted':False,'newAutonomousRuns':0,'newScore':False,'baseline':'V41','prefixAliasProbe':b['aliasStatistics'],'fullIdentityProbe':alias['identityStatistics'],'completedPaidPrefixFalseRejections':21,'steps':rows,'independentProofs':65,'independentReplayNativeInputs':785,'currentBestPrototype':'v9','currentBestPrototypeNativeInputs':256,'currentBestPrototypeDiagnosticMilliseconds':next(r['diagnosticMilliseconds']for r in rows if 'combined-fast-stationary' in r['report']),'originalPaymentEnumeratorBodyUnchanged':True,'sourceSyntaxChecks':len(files),'profileScopeNote':'The v1 CPU profile metadata inherited materialization wording from its template; its zero proof rows and zero materialization fields are authoritative. Both CPU profiles are diagnosis only; v2 metadata has the corrected scope.'};assert not out.exists();out.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:r[k]for k in ['status','currentBestPrototypeNativeInputs','currentBestPrototypeDiagnosticMilliseconds','independentProofs','independentReplayNativeInputs','sourceSyntaxChecks']}))
