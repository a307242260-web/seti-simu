from pathlib import Path
import hashlib,json,os,subprocess,tempfile
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='d0ee6893c3392f9b0425ec9457e74e8ccbfbd08e';folder=Path('reports/ai-foundation-20261105/third-round-teacher-v1');sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def git(*args,data=None,index=None):
 env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
 if index:env['GIT_INDEX_FILE']=index
 r=subprocess.run(['git',*args],cwd=repo,input=data,env=env,capture_output=True)
 if r.returncode:raise RuntimeError(r.stdout.decode()+r.stderr.decode())
 return r.stdout
assert git('rev-parse','HEAD').decode().strip()==base;assert git('symbolic-ref','--short','HEAD').decode().strip()=='dev';shared=sha(repo/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()
proof=json.loads((stage/folder/'v258-current-source-admission-20261106-v1.json').read_text());assert proof['sourceAdmitted']and proof['newAutonomousRuns']==0 and proof['uniqueNativeRoots']==595 and not proof['developmentAligned']
for n,h in {**proof['runtimeSourceHashes'],**proof['ownedSourceHashes']}.items():assert sha(stage/n)==h,n
for n,h in proof['evidenceSha256'].items():assert sha(stage/n)==h,n
central=['reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html'];preserved={n:sha(repo/n)for n in central}
files=set(proof['ownedSourceHashes'])|{'docs/ai-design.md','docs/human405-company-income-priority-20261106.md','adhoc/human405-third-round-progress-20261106-v26.json','adhoc/deliver-v258-company-income-source-20261106-v1.py'}
files|={str(p.relative_to(stage))for p in(stage/folder).iterdir()if p.is_file()and p.name.startswith(tuple(f'v{n}-'for n in range(257,259)))}
files|={str(p.relative_to(stage))for parent in(stage/'reports/ai-foundation-20261106').iterdir()if parent.is_dir()and any(parent.name.startswith(f'candidate-v{n}-')for n in range(257,259))for p in parent.rglob('*')if p.is_file()}
files|={str(p.relative_to(stage))for p in(stage/'adhoc').iterdir()if p.is_file()and any(f'v{n}-'in p.name for n in range(257,259))and'20261106'in p.name}
# All linked admission evidence, including earlier failure fixtures, must be present.
files|=set(proof['evidenceSha256'])
files.add('adhoc/control-v256-energy-income-finance-20261106-v1.js')
files|={str(p.relative_to(stage))for p in(stage/folder).glob('v256-energy-income-*')if p.is_file()}
files|={str(p.relative_to(stage))for p in(stage/folder).glob('v256-cold-energy-income-*')if p.is_file()}
manifest='adhoc/v258-research-symbol-source-delivery-manifest-20261106-v1.json';files.discard(manifest)
old={}
for row in git('ls-tree','-rz',base).split(b'\0'):
 if row:meta,n=row.split(b'\t',1);mode,kind,digest=meta.decode().split();old[n.decode()]=(mode,digest)
blob=lambda b:hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest();files={n for n in files if old.get(n,('',None))[1]!=blob((stage/n).read_bytes())}
assert {n for n in files if n.startswith(('randomizer/','tools/'))}==set(proof['ownedSourceHashes'])
for n in sorted(files):
 p=stage/n;target=repo/n
 if target.exists():assert target.read_bytes()==p.read_bytes()or blob(target.read_bytes())==old.get(n,('',None))[1],'overlap:'+n
 if p.suffix=='.json':json.loads(p.read_text())
 if p.suffix=='.js':subprocess.run(['node','--check',n],cwd=stage,check=True,capture_output=True)
 if p.suffix=='.py':compile(p.read_text(),n,'exec')
(stage/manifest).write_text(json.dumps({'baseCommit':base,'sharedIndexSha256':shared,'sharedStageEntriesSha256':entries,'filesSha256':{n:sha(stage/n)for n in sorted(files)},'runtime':'V258/V46','sourceAdmitted':True,'autonomousRuns':0,'developmentAligned':False,'coldNamedCases':727,'coldUniqueRoots':595,'maxNativeInputs':256,'maxMilliseconds':proof['maxMilliseconds'],'currentUnitBusinessObligationsPassed':197,'initialFullUnitPassed':196,'initialFullUnitFailed':1,'fullFlowPassed':1,'finalRelatedPassed':4,'browserPassed':8,'inputAuditPassed':55,'legacyInputAuditFailures':1,'experimentCenterUntouched':True,'goalStatus':'active'},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_V258')!='1':print(json.dumps({'preflight':'passed','files':len(files),'sourceAdmitted':True,'foreignIndexPreserved':True,'experimentCenterUntouched':True}));raise SystemExit(0)
index=str(Path(tempfile.mkdtemp(prefix='seti-v258-delivery-index-'))/'index');git('read-tree',base,index=index);names=sorted(files);digests=git('hash-object','-w','--stdin-paths',data=''.join(str(stage/n)+'\n'for n in names).encode(),index=index).decode().splitlines();assert len(digests)==len(names)
for n,digest in zip(names,digests):assert digest==blob((stage/n).read_bytes()),n
git('update-index','--index-info',data=''.join(old.get(n,('100644',None))[0]+' '+d+'\t'+n+'\n'for n,d in zip(names,digests)).encode(),index=index);assert set(git('diff','--cached','--name-only',base,index=index).decode().splitlines())==files;tree=git('write-tree',index=index).decode().strip()
for n in files:assert git('show',tree+':'+n)==(stage/n).read_bytes(),n
for n in sorted(files):p=repo/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((stage/n).read_bytes())
git('commit','-m','按统一价值贪心协调公司换牌与固定收入准备',index=index);commit=git('rev-parse','HEAD').decode().strip();Path('/private/tmp/seti-v258-delivery-commit-show-20261106-v1.log').write_bytes(git('show','--name-only','--stat','HEAD'));assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files;assert sha(repo/'.git/index')==shared;assert hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for n,h in preserved.items():assert sha(repo/n)==h,n
for n,h in {**proof['runtimeSourceHashes'],**proof['ownedSourceHashes']}.items():assert sha(repo/n)==h,n
receipt={'commit':commit,'privateIndex':index,'files':len(files),'sourceAdmitted':True,'sharedIndexByteAndEntriesExact':True,'experimentCenterAndForeignVersionPreserved':True,'runtime':'V258/V46','newAutonomousRuns':0,'developmentAligned':False,'goalStatus':'active'};Path('/private/tmp/seti-v258-research-symbol-source-delivery-20261106-v1.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
