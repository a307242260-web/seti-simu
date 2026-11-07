from pathlib import Path
import hashlib,json,os,subprocess,sys
stage=Path(__file__).resolve().parents[1]
repo=Path('/Users/bilibili/code/seti-simu')
candidate=Path('/private/tmp/seti-v323-committed-computer-recovery-20261107-v1')
prefix=Path('reports/ai-foundation-20261107')
d=prefix/'committed-computer-recovery-v323-v1'
base='2f333e67402df00c4442a82ee04d3a7e41828cb7'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
blob=lambda b:hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
read=lambda p:json.loads((stage/p).read_text())
index=Path('/private/tmp/seti-v323-source-admission-20261107-v1.index')
receipt=Path('/private/tmp/seti-v323-source-admission-delivery-20261107-v1.json')
proof_name=d/'source-admission-proof-20261107-v1.json'
pre_name=d/'source-admission-precheck-20261107-v1.json'
shared=sha(repo/'.git/index')
assert shared=='d01a449eea57aa1efd899d9490d7560eb2045de4b16d8c9627c4505a254a51bb'
env={**os.environ,'GIT_INDEX_FILE':str(index),'GIT_OPTIONAL_LOCKS':'0'}
def git(*args,data=None):return subprocess.check_output(['git',*args],cwd=repo,env=env,input=data)
def tree_entries(ref,*scope):
 out={}
 for row in git('ls-tree','-r','-z',ref,'--',*scope).split(b'\0'):
  if row:
   a,p=row.split(b'\t',1);mode,kind,oid=a.decode().split();assert kind=='blob';out[p.decode()]=(mode,oid)
 return out
assert git('rev-parse','HEAD').decode().strip()==base and git('symbolic-ref','--short','HEAD').decode().strip()=='dev'
pre=read(pre_name);assert pre['sourceBase']==base and pre['rootCases']==1258 and pre['distinctRoots']==818
m=read(pre['manifest']);assert sha(stage/pre['manifest'])==pre['manifestSha256']
old=tree_entries(base);scope=('randomizer/','tools/','assets/')
runtime=set(pre['changedTrackedFiles']+pre['newTestFiles'])
assert len(runtime)==69
frozen={**m['baseRuntimeHashes'],**m['sourceHashes']}
for n,h in frozen.items():assert sha(candidate/n)==h,n
assert all(n.startswith(scope) and n in frozen for n in runtime)
expected={}
for n in set(x for x in old if x.startswith(scope))|runtime:
 p=candidate/n
 mode=old.get(n,('100755' if p.stat().st_mode&0o111 else '100644',''))[0]
 if mode=='120000':
  assert p.is_symlink(),n
  data=os.readlink(p).encode()
 else:
  assert p.is_file(),n
  assert bool(p.stat().st_mode&0o111)==(mode=='100755'),n
  data=p.read_bytes()
 expected[n]=mode,blob(data)
assert len(expected)==978
assert {n for n,v in expected.items() if old.get(n)!=v}==runtime
files={n:candidate/n for n in runtime}
for n in m["sourceHashes"]:
 if not n.startswith(scope):files[n]=candidate/n
dirs=['income-before-amiba-v319-hotspots-v1','income-before-amiba-scalar-work-v1','income-before-amiba-scalar-v320-v1','income-before-amiba-prepaid-trace-v1','income-before-amiba-prepaid-trace-v321-v1','teacher-r3-after-amiba-v321-hotspots-v1','teacher-r3-after-amiba-scan-coordinate-v1','teacher-r3-after-amiba-scan-coordinate-v322-v1','v322-winning-continuation-v1','committed-computer-recovery-v323-v1']
for folder in dirs:
 for p in (stage/prefix/folder).rglob('*'):
  if p.is_file() and p!=stage/proof_name:
   if p.name.startswith(('v320-','v321-','v322-','v323-')) and '-cli-' in p.name and p.suffix=='.log' and 'after-amiba-reveal' not in p.name and 'income-before-amiba' not in p.name:continue
   files[str(p.relative_to(stage))]=p
for folder in ['income-before-amiba-scalar-v320-v1','income-before-amiba-prepaid-trace-v321-v1','teacher-r3-after-amiba-scan-coordinate-v322-v1']:
 gp=prefix/folder/'serial-cold-gate-20261107-v1.json';g=read(gp)
 assert g['status'] in {'failed-gate','complete'} and sha(stage/g['manifest'])==g['manifestSha256']
 for row in g['rows']:
  q=read(row['evidence']);assert q['fixtureSha256']==sha(stage/q['fixture']) and q['rawSha256']==sha(stage/q['rawPath']) and q['candidateSourceManifestSha256']==g['manifestSha256']
  for n in [row['evidence'],q['rawPath']]:files[n]=stage/n
for n,h in pre['evidenceSha256'].items():
 assert sha(stage/n)==h,n
 files[n]=stage/n
for pattern in ['profile-v319-*','build-v319-probe-scalar-work-*','build-v319-known-mission-data-window-*','build-v319-probe-geometry-index-*','diagnose-v319-probe-scalar-work-*','*v320*probe-scalar-work-*','verify-v320-cold-graph-parity-*','build-v320-prepaid-trace-reward-*','diagnose-v320-prepaid-trace-reward-*','*v321*prepaid-trace-*','verify-v321-cold-graph-parity-*','profile-v321-teacher-r3-after-amiba-*','build-v321-scan-coordinate-query-*','diagnose-v321-scan-coordinate-query-*','*v322*scan-coordinate-*','verify-v322-cold-graph-parity-*','compare-v322-first-two-production-roots-*','inspect-v322-production-diff-*','diagnose-v322-committed-computer-*','compare-v323-*','inspect-v323-*','*v323*committed-computer-*','prepare-v323-source-admission-*','deliver-v323-source-admission-*','human405-third-round-progress-20261107-v27.json','prepare-v323-autonomous-first3-*','verify-v323-autonomous-first3-*']:
 for p in (stage/'adhoc').glob(pattern):files[str(p.relative_to(stage))]=p
doc='docs/human405-v320-v322-native-queries-20261107.md';files[doc]=stage/doc
files={n:p for n,p in files.items() if old.get(n,('',None))[1]!=blob(p.read_bytes())}
for n,p in files.items():
 assert p.is_file(),n
 if n in runtime or n.startswith('adhoc/') or '/source-snapshot/' in n:
  if p.suffix=='.js':subprocess.run(['node','--check',str(p)],check=True,capture_output=True)
  if p.suffix=='.py':compile(p.read_text(),n,'exec')
 if n not in runtime:
  target=repo/n
  if target.exists():assert target.is_file() and blob(target.read_bytes()) in {old.get(n,('',None))[1],blob(p.read_bytes())},n
assert set(n for n in files if n.startswith(scope))==runtime
if '--stage' not in sys.argv:
 print(json.dumps({'status':'preflight-complete','files':len(files)+1,'runtimeAndTests':len(runtime),'trackedRuntimeAssetTools':len(expected),'base':base,'sharedIndexPreserved':True}))
 raise SystemExit(0)
assert not index.exists() and not receipt.exists() and not (stage/proof_name).exists()
git('read-tree',base)
def add(payload):
 names=sorted(payload)
 oids=git('hash-object','-w','--stdin-paths',data=''.join(str(payload[n])+'\n'for n in names).encode()).decode().splitlines()
 assert len(oids)==len(names)
 expected_rows=[]
 for n,oid in zip(names,oids):
  p=payload[n];mode=old.get(n,('100755' if p.stat().st_mode&0o111 else '100644',''))[0]
  assert oid==blob(p.read_bytes()),n
  expected_rows.append(f'{mode} {oid}\t{n}\n')
 git('update-index','--index-info',data=''.join(expected_rows).encode())
 return git('write-tree').decode().strip()
tree=add(files)
actual=tree_entries(tree,'randomizer','tools','assets');assert actual==expected
tree_all=tree_entries(tree)
assert all(tree_all[n][1]==blob((candidate/n).read_bytes()) for n in frozen)
subtrees={key:git('rev-parse',tree+':'+key).decode().strip()for key in ('randomizer','tools','assets')}
proof={k:v for k,v in pre.items() if k!='evidenceSha256'}
proof.update(status='source-admitted',sourceAdmitted=True,gitSnapshotWithRuntime=tree,gitRuntimeAssetToolSubtrees=subtrees,fullCommittedRuntimeScopeExact=True,changedRuntimeTestAndToolFiles=len(runtime),precheck=str(pre_name),precheckSha256=sha(stage/pre_name),sharedIndexSha256=shared,sharedIndexUnchanged=sha(repo/'.git/index')==shared)
(stage/proof_name).write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')
tree=add({str(proof_name):stage/proof_name});files[str(proof_name)]=stage/proof_name
assert all(git('rev-parse',tree+':'+n).decode().strip()==h for n,h in subtrees.items())
assert set(git('diff','--cached','--name-only','-z',base).decode().strip('\0').split('\0'))==set(files)
assert sha(repo/'.git/index')==shared
r={'status':'exact-source-staged','baseCommit':base,'snapshotTree':tree,'runtimeSubtrees':subtrees,'index':str(index),'sourceAdmission':str(proof_name),'sourceAdmissionSha256':sha(stage/proof_name),'sharedIndexSha256':shared,'files':sorted(files),'runtimeFiles':sorted(runtime),'productionWorktreeRuntimeFilesWritten':0}
receipt.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in r.items() if k not in ['files','runtimeFiles']},ensure_ascii=False))
