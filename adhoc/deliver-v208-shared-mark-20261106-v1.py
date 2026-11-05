from pathlib import Path
import hashlib,json,os,subprocess,tempfile
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='acf6694909d8e93f62ed7683071d6ca8637e9293';folder=Path('reports/ai-foundation-20261105/third-round-teacher-v1');sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def git(*args,data=None,index=None):
 env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
 if index:env['GIT_INDEX_FILE']=index
 r=subprocess.run(['git',*args],cwd=repo,input=data,env=env,capture_output=True)
 if r.returncode:raise RuntimeError(r.stdout.decode()+r.stderr.decode())
 return r.stdout
assert git('rev-parse','HEAD').decode().strip()==base
assert git('symbolic-ref','--short','HEAD').decode().strip()=='dev'
shared=sha(repo/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()
proof=json.loads((stage/folder/'v208-current-source-admission-20261106-v1.json').read_text());assert proof['sourceAdmitted'] and proof['newAutonomousRuns']==0
for n,h in {**proof['runtimeSourceHashes'],**proof['ownedSourceHashes'],**proof['evidenceSha256']}.items():assert sha(stage/n)==h,n
assert sha(stage/proof['manifest'])==proof['manifestSha256'];assert sha(stage/proof['validationOverlay'])==proof['validationOverlaySha256']
files=set(proof['ownedSourceHashes'])|{'docs/ai-design.md','docs/human405-third-round-shared-mark-ledger-20261106.md','adhoc/human405-third-round-progress-20261106-v5.json','adhoc/deliver-v208-shared-mark-20261106-v1.py','adhoc/benchmark-third-round-decision-20261106-v2.js'}
for p in (stage/'reports/ai-foundation-20261106').glob('candidate-v20[5678]-*'):
 files|={str(x.relative_to(stage))for x in p.rglob('*')if x.is_file()}
files|={str(p.relative_to(stage))for p in(stage/folder).iterdir()if p.is_file()and p.name.startswith(('v205-','v206-','v207-','v208-'))}
files|={str(p.relative_to(stage))for p in(stage/'adhoc').iterdir()if p.is_file()and any(t in p.name for t in ['v205-','v206-','v207-','v208-'])and '20261106' in p.name}
old={}
for row in git('ls-tree','-rz',base).split(b'\0'):
 if row:
  meta,name=row.split(b'\t',1);mode,kind,digest=meta.decode().split();old[name.decode()]=(mode,digest)
blob=lambda b:hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
files={n for n in files if old.get(n,('',None))[1]!=blob((stage/n).read_bytes())}
for n in proof['runtimeSourceHashes']:
 if n not in files:assert sha(repo/n)==proof['runtimeSourceHashes'][n] and blob((stage/n).read_bytes())==old[n][1],n
for n in sorted(files):
 p=stage/n;target=repo/n
 if target.exists():assert target.read_bytes()==p.read_bytes()or blob(target.read_bytes())==old.get(n,('',None))[1],'overlapping foreign edit:'+n
 if p.suffix=='.json':json.loads(p.read_text())
 if p.suffix=='.js':subprocess.run(['node','--check',n],cwd=stage,check=True,capture_output=True)
 if p.suffix=='.py':compile(p.read_text(),n,'exec')
manifest='adhoc/v208-shared-mark-delivery-manifest-20261106-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'sourceAdmitted':True,'runtime':'V208/V32','sharedIndexSha256':shared,'sharedStageEntriesSha256':entries,'filesSha256':{n:sha(stage/n)for n in sorted(files)},'newAutonomousRuns':0,'developmentAligned':False,'goalStatus':'active'},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_V208')!='1':print(json.dumps({'preflight':'passed','files':len(files),'sourceAdmitted':True,'sharedIndexSha256':shared}));raise SystemExit(0)
index=str(Path(tempfile.mkdtemp(prefix='seti-v208-shared-mark-index-'))/'index');git('read-tree',base,index=index)
for n in sorted(files):
 digest=git('hash-object','-w','--stdin',data=(stage/n).read_bytes(),index=index).decode().strip();git('update-index','--add','--cacheinfo',old.get(n,('100644',None))[0],digest,n,index=index)
assert set(git('diff','--cached','--name-only',base,index=index).decode().splitlines())==files
tree=git('write-tree',index=index).decode().strip()
for n in files:assert git('show',tree+':'+n)==(stage/n).read_bytes(),n
for n in sorted(files):p=repo/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((stage/n).read_bytes())
git('commit','-m','统一研究跨线与待领取标记的价值账本并保留失败证据',index=index)
commit=git('rev-parse','HEAD').decode().strip();show=git('show','--name-only','--stat','HEAD');(Path('/private/tmp')/'seti-v208-commit-show-20261106-v1.log').write_bytes(show)
assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files
assert sha(repo/'.git/index')==shared;assert hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for n,h in {**proof['runtimeSourceHashes'],**proof['ownedSourceHashes']}.items():assert sha(repo/n)==h,n
receipt={'commit':commit,'files':len(files),'privateIndex':index,'sharedIndexByteAndEntriesExact':True,'sourceAdmitted':True,'runtime':'V208/V32','newAutonomousRuns':0,'goalStatus':'active'};Path('/private/tmp/seti-v208-shared-mark-delivery-20261106-v1.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
