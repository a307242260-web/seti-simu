from pathlib import Path
import hashlib,json,os,subprocess,tempfile
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='32c3a8fe4b0993caa4f8a376bf83135b1f2877d8';F=Path('reports/ai-foundation-20261105/third-round-teacher-v1');sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def git(*args,data=None,index=None):
 env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
 if index:env['GIT_INDEX_FILE']=index
 r=subprocess.run(['git',*args],cwd=repo,input=data,env=env,capture_output=True)
 if r.returncode:raise RuntimeError(r.stdout.decode()+r.stderr.decode())
 return r.stdout
assert git('rev-parse','HEAD').decode().strip()==base
assert git('symbolic-ref','--short','HEAD').decode().strip()=='dev'
shared=sha(repo/'.git/index');assert shared=='d01a449eea57aa1efd899d9490d7560eb2045de4b16d8c9627c4505a254a51bb'
entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()
progress=json.loads((stage/'adhoc/human405-third-round-progress-20261106-v27.json').read_text());assert progress['newNativeControlInputs']==49 and progress['newAutonomousRuns']==0 and progress['goalStatus']=='active'
for n,h in progress['evidenceSha256'].items():assert sha(stage/n)==h,n
for v,name in [(259,'analysis-publicity-preparation'),(260,'default-weight-proof')]:
 d=stage/f'reports/ai-foundation-20261106/candidate-v{v}-{name}-v1';m=json.loads((d/'manifest.json').read_text())
 for n,h in m['sourceHashes'].items():assert sha(d/'source-snapshot'/n)==h,n
 assert progress['candidateGates'][str(v)]['sourceAdmitted']is False
central=['reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html'];preserved={n:sha(repo/n)for n in central}
sourcePreserved={n:sha(repo/n)for n in json.loads((stage/'reports/ai-foundation-20261106/candidate-v260-default-weight-proof-v1/manifest.json').read_text())['baseRuntimeHashes']if(repo/n).exists()}
files={'docs/ai-design.md','docs/human405-analysis-publicity-learning-20261106.md','adhoc/human405-third-round-progress-20261106-v27.json','adhoc/summarize-v259-v260-publicity-learning-20261106-v1.py','adhoc/deliver-v259-v260-publicity-learning-20261106-v1.py'}
files|={str(p.relative_to(stage))for p in(stage/F).iterdir()if p.is_file()and p.name.startswith(('v259-','v260-','v258-actual-goal-switch','v258-analysis-publicity'))}
files|={str(p.relative_to(stage))for d in(stage/'reports/ai-foundation-20261106').iterdir()if d.is_dir()and d.name.startswith(('candidate-v259-','candidate-v260-'))for p in d.rglob('*')if p.is_file()}
files|={str(p.relative_to(stage))for p in(stage/'adhoc').iterdir()if p.is_file()and any(v in p.name for v in ['v259-','v260-','v258-actual-goal-switch','v258-analysis-publicity'])and'20261106'in p.name}
manifest='adhoc/v259-v260-learning-delivery-manifest-20261106-v1.json';files.discard(manifest)
old={}
for row in git('ls-tree','-rz',base).split(b'\0'):
 if row:meta,n=row.split(b'\t',1);mode,kind,digest=meta.decode().split();old[n.decode()]=(mode,digest)
blob=lambda b:hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
files={n for n in files if old.get(n,('',None))[1]!=blob((stage/n).read_bytes())}
assert not any(n.startswith(('randomizer/','tools/','assets/'))for n in files),'failed candidates must not enter production paths'
for n in sorted(files):
 p=stage/n;target=repo/n
 if target.exists():assert target.read_bytes()==p.read_bytes()or blob(target.read_bytes())==old.get(n,('',None))[1],'overlap:'+n
 if p.suffix=='.json':json.loads(p.read_text())
 if p.suffix=='.js':subprocess.run(['node','--check',str(p)],check=True,capture_output=True)
 if p.suffix=='.py':compile(p.read_text(),str(p),'exec')
(stage/manifest).write_text(json.dumps({'baseCommit':base,'sharedIndexSha256':shared,'sharedStageEntriesSha256':entries,'filesSha256':{n:sha(stage/n)for n in sorted(files)},'publishedRuntime':'V258/V46','candidateRuntimeInstalled':False,'newNativeControls':49,'newAutonomousRuns':0,'goalStatus':'active','baseline':'V41','experimentCenterUntouched':True},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_PUBLICITY_LEARNING')!='1':print(json.dumps({'preflight':'passed','files':len(files),'candidateRuntimeInstalled':False,'sharedIndexPreserved':True}));raise SystemExit(0)
index=str(Path(tempfile.mkdtemp(prefix='seti-publicity-learning-delivery-index-'))/'index');git('read-tree',base,index=index);names=sorted(files);digests=git('hash-object','-w','--stdin-paths',data=''.join(str(stage/n)+'\n'for n in names).encode(),index=index).decode().splitlines();assert len(digests)==len(names)
for n,d in zip(names,digests):assert d==blob((stage/n).read_bytes()),n
git('update-index','--index-info',data=''.join(old.get(n,('100644',None))[0]+' '+d+'\t'+n+'\n'for n,d in zip(names,digests)).encode(),index=index)
assert set(git('diff','--cached','--name-only',base,index=index).decode().splitlines())==files
tree=git('write-tree',index=index).decode().strip()
for n in files:assert git('show',tree+':'+n)==(stage/n).read_bytes(),n
for n in sorted(files):target=repo/n;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((stage/n).read_bytes())
git('commit','-m','记录第三轮宣传筹资缺口及两版冷测失败证据',index=index)
commit=git('rev-parse','HEAD').decode().strip();Path('/private/tmp/seti-publicity-learning-delivery-show-20261106-v1.log').write_bytes(git('show','--name-only','--stat','HEAD'))
assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files
assert sha(repo/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for n,h in {**preserved,**sourcePreserved}.items():assert sha(repo/n)==h,n
receipt={'commit':commit,'privateIndex':index,'files':len(files),'publishedRuntime':'V258/V46','candidateRuntimeInstalled':False,'sourceUnchanged':True,'sharedIndexByteAndEntriesExact':True,'experimentCenterAndForeignVersionPreserved':True,'newAutonomousRuns':0,'goalStatus':'active'}
Path('/private/tmp/seti-publicity-learning-delivery-20261106-v1.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
