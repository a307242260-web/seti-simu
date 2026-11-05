from pathlib import Path
import hashlib,json,os,subprocess,tempfile
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='e2dfeb9f74725a41f2c31f44a632d7e1822799e1';folder=Path('reports/ai-foundation-20261105/third-round-teacher-v1');sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def git(*args,data=None,index=None):
 env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
 if index:env['GIT_INDEX_FILE']=index
 r=subprocess.run(['git',*args],cwd=repo,input=data,env=env,capture_output=True)
 if r.returncode:raise RuntimeError(r.stdout.decode()+r.stderr.decode())
 return r.stdout
assert git('rev-parse','HEAD').decode().strip()==base;assert git('symbolic-ref','--short','HEAD').decode().strip()=='dev';shared=sha(repo/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();proof=json.loads((stage/folder/'v218-current-source-admission-20261106-v1.json').read_text());assert proof['sourceAdmitted']and proof['newAutonomousRuns']==0 and proof['uniqueNativeRoots']==387 and not proof['developmentAligned'];prior=json.loads((stage/folder/'v214-current-source-admission-20261106-v1.json').read_text())
for n,h in {**prior['runtimeSourceHashes'],**prior['ownedSourceHashes']}.items():assert sha(repo/n)==h,n
for n,h in {**proof['runtimeSourceHashes'],**proof['ownedSourceHashes']}.items():assert sha(stage/n)==h,n
for n,h in proof['evidenceSha256'].items():assert sha(stage/n)==h,n
central=['reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html'];preserved={n:sha(repo/n)for n in central}
files=set(proof['ownedSourceHashes'])|{'docs/ai-design.md','docs/human405-third-round-earned-mark-analysis-20261106.md','adhoc/deliver-v218-earned-mark-analysis-20261106-v1.py','adhoc/human405-third-round-progress-20261106-v8.json'}
files|={str(p.relative_to(stage))for p in(stage/folder).iterdir()if p.is_file()and p.name.startswith(('v215-','v216-','v217-','v218-'))}
files|={str(p.relative_to(stage))for n in ['candidate-v215-earned-mark-analysis-v1','candidate-v216-analysis-private-copy-v1','candidate-v217-research-mark-scalar-v1','candidate-v218-public-symbol-ownership-v1']for p in(stage/'reports/ai-foundation-20261106'/n).rglob('*')if p.is_file()}
files|={str(p.relative_to(stage))for p in(stage/'adhoc').iterdir()if p.is_file()and any(v in p.name for v in ['v215-','v216-','v217-','v218-'])and'20261106'in p.name}
files|={str(p.relative_to(stage))for p in(stage/folder).iterdir()if p.is_file()and p.name.startswith(('v214-actual123-corner-safety-purple2-','v214-pending-analysis-review-'))}
files|={str(p.relative_to(stage))for p in(stage/'adhoc').iterdir()if p.is_file()and p.name.startswith(('control-v214-actual123-corner-safety-purple2-','review-v214-pending-analysis-'))}
files-={'adhoc/prove-v215-source-admission-20261106-v1.py','adhoc/prove-v216-source-admission-20261106-v1.py','adhoc/verify-v216-admission-snapshot-20261106-v1.py','adhoc/deliver-v216-earned-mark-analysis-20261106-v1.py'}
manifest='adhoc/v218-earned-mark-analysis-delivery-manifest-20261106-v1.json';files.discard(manifest)
old={}
for row in git('ls-tree','-rz',base).split(b'\0'):
 if row:meta,n=row.split(b'\t',1);mode,kind,digest=meta.decode().split();old[n.decode()]=(mode,digest)
blob=lambda b:hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest();files={n for n in files if old.get(n,('',None))[1]!=blob((stage/n).read_bytes())}
for n in sorted(files):
 p=stage/n;target=repo/n
 if target.exists():assert target.read_bytes()==p.read_bytes()or blob(target.read_bytes())==old.get(n,('',None))[1],'overlap:'+n
 if p.suffix=='.json':json.loads(p.read_text())
 if p.suffix=='.js':subprocess.run(['node','--check',n],cwd=stage,check=True,capture_output=True)
 if p.suffix=='.py':compile(p.read_text(),n,'exec')
(stage/manifest).write_text(json.dumps({'baseCommit':base,'sharedIndexSha256':shared,'sharedStageEntriesSha256':entries,'filesSha256':{n:sha(stage/n)for n in sorted(files)},'autonomousRuns':0,'runtime':'V218/V37','developmentAligned':False,'V215FailureRetained':True,'experimentCenterUntouched':True,'goalStatus':'active'},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_V218')!='1':print(json.dumps({'preflight':'passed','files':len(files),'sourceAdmitted':True,'foreignIndexPreserved':True,'experimentCenterUntouched':True}));raise SystemExit(0)
index=str(Path(tempfile.mkdtemp(prefix='seti-v218-delivery-index-'))/'index');git('read-tree',base,index=index);names=sorted(files);digests=git('hash-object','-w','--stdin-paths',data=''.join(str(stage/n)+'\n'for n in names).encode(),index=index).decode().splitlines();assert len(digests)==len(names)
for n,digest in zip(names,digests):assert digest==blob((stage/n).read_bytes()),n
git('update-index','--index-info',data=''.join(old.get(n,('100644',None))[0]+' '+d+'\t'+n+'\n'for n,d in zip(names,digests)).encode(),index=index);assert set(git('diff','--cached','--name-only',base,index=index).decode().splitlines())==files;tree=git('write-tree',index=index).decode().strip()
for n in files:assert git('show',tree+':'+n)==(stage/n).read_bytes(),n
for n in sorted(files):p=repo/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((stage/n).read_bytes())
git('commit','-m','修复已达线标记误挡分析并降低公开痕迹复制开销',index=index);commit=git('rev-parse','HEAD').decode().strip();Path('/private/tmp/seti-v218-delivery-commit-show-20261106-v1.log').write_bytes(git('show','--name-only','--stat','HEAD'));assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files;assert sha(repo/'.git/index')==shared;assert hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for n,h in preserved.items():assert sha(repo/n)==h,n
for n,h in {**proof['runtimeSourceHashes'],**proof['ownedSourceHashes']}.items():assert sha(repo/n)==h,n
receipt={'commit':commit,'privateIndex':index,'files':len(files),'sourceAdmitted':True,'sharedIndexByteAndEntriesExact':True,'experimentCenterAndForeignVersionPreserved':True,'runtime':'V218/V37','newAutonomousRuns':0,'developmentAligned':False,'goalStatus':'active'};Path('/private/tmp/seti-v218-earned-mark-delivery-20261106-v1.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
