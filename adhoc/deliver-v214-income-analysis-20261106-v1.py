from pathlib import Path
import hashlib,json,os,subprocess,tempfile
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='32b1122dfca2c78634adb141f0dfc70c652f1f0e';folder=Path('reports/ai-foundation-20261105/third-round-teacher-v1');sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def git(*args,data=None,index=None):
 env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
 if index:env['GIT_INDEX_FILE']=index
 r=subprocess.run(['git',*args],cwd=repo,input=data,env=env,capture_output=True)
 if r.returncode:raise RuntimeError(r.stdout.decode()+r.stderr.decode())
 return r.stdout
assert git('rev-parse','HEAD').decode().strip()==base;assert git('symbolic-ref','--short','HEAD').decode().strip()=='dev'
shared=sha(repo/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();proof=json.loads((stage/folder/'v214-current-source-admission-20261106-v1.json').read_text());assert proof['sourceAdmitted']and proof['newAutonomousRuns']==0
for n,h in {**proof['runtimeSourceHashes'],**proof['ownedSourceHashes'],**proof['evidenceSha256']}.items():assert sha(stage/n)==h,n
assert sha(stage/proof['manifest'])==proof['manifestSha256']
files=set(proof['ownedSourceHashes'])|{'docs/ai-design.md','docs/human405-third-round-income-analysis-20261106.md','adhoc/human405-third-round-progress-20261106-v6.json','adhoc/deliver-v214-income-analysis-20261106-v1.py'}
for version in range(209,215):
 for p in(stage/'reports/ai-foundation-20261106').glob(f'candidate-v{version}-*'):files|={str(x.relative_to(stage))for x in p.rglob('*')if x.is_file()}
files|={str(p.relative_to(stage))for p in(stage/folder).iterdir()if p.is_file()and p.name.startswith(tuple(f'v{v}-'for v in range(209,215)))}
files|={str(p.relative_to(stage))for p in(stage/'adhoc').iterdir()if p.is_file()and any(f'v{v}-'in p.name for v in range(209,215))and'20261106'in p.name}
files.discard('adhoc/v214-income-analysis-delivery-manifest-20261106-v1.json')
def parse_tree(data):
 result={}
 for row in data.split(b'\0'):
  if row:
   meta,name=row.split(b'\t',1);mode,kind,digest=meta.decode().split();result[name.decode()]=(mode,digest)
 return result
old=parse_tree(git('ls-tree','-rz',base));blob=lambda b:hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest();files={n for n in files if old.get(n,('',None))[1]!=blob((stage/n).read_bytes())}
for n in proof['runtimeSourceHashes']:
 if n not in files:assert sha(repo/n)==proof['runtimeSourceHashes'][n]and blob((stage/n).read_bytes())==old[n][1],n
for n in sorted(files):
 p=stage/n;target=repo/n
 if target.exists():assert target.read_bytes()==p.read_bytes()or blob(target.read_bytes())==old.get(n,('',None))[1],'overlapping foreign edit:'+n
 if p.suffix=='.json':json.loads(p.read_text())
 if p.suffix=='.js':subprocess.run(['node','--check',n],cwd=stage,check=True,capture_output=True)
 if p.suffix=='.py':compile(p.read_text(),n,'exec')
manifest='adhoc/v214-income-analysis-delivery-manifest-20261106-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'sourceAdmitted':True,'runtime':'V214/V33','sharedIndexSha256':shared,'sharedStageEntriesSha256':entries,'filesSha256':{n:sha(stage/n)for n in sorted(files)},'newAutonomousRuns':0,'developmentAligned':False,'goalStatus':'active'},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_V214')!='1':print(json.dumps({'preflight':'passed','files':len(files),'sharedIndexSha256':shared,'sourceAdmitted':True}));raise SystemExit(0)
index=str(Path(tempfile.mkdtemp(prefix='seti-v214-income-index-'))/'index');git('read-tree',base,index=index);names=sorted(files)
assert all('\n'not in n for n in names)
digests=git('hash-object','-w','--stdin-paths',data=''.join(str(stage/n)+'\n'for n in names).encode(),index=index).decode().splitlines();assert len(digests)==len(names)
for n,digest in zip(names,digests):assert digest==blob((stage/n).read_bytes()),n
records=''.join(old.get(n,('100644',None))[0]+' '+digest+'\t'+n+'\n'for n,digest in zip(names,digests));git('update-index','--index-info',data=records.encode(),index=index)
assert set(git('diff','--cached','--name-only',base,index=index).decode().splitlines())==files
tree=git('write-tree',index=index).decode().strip();actual=parse_tree(git('ls-tree','-rz',tree))
for n,digest in zip(names,digests):assert actual[n]==(old.get(n,('100644',None))[0],digest),n
for n in names:p=repo/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((stage/n).read_bytes())
git('commit','-m','补齐电脑收入分析固定计划并消除重复准备估值开销',index=index);commit=git('rev-parse','HEAD').decode().strip();Path('/private/tmp/seti-v214-commit-show-20261106-v1.log').write_bytes(git('show','--name-only','--stat','HEAD'));assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files
assert sha(repo/'.git/index')==shared;assert hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for n,h in {**proof['runtimeSourceHashes'],**proof['ownedSourceHashes']}.items():assert sha(repo/n)==h,n
receipt={'commit':commit,'files':len(files),'privateIndex':index,'sharedIndexByteAndEntriesExact':True,'sourceAdmitted':True,'runtime':'V214/V33','newAutonomousRuns':0,'goalStatus':'active'};Path('/private/tmp/seti-v214-income-analysis-delivery-20261106-v1.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
