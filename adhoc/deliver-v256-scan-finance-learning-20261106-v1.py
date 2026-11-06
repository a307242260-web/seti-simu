from pathlib import Path
import hashlib,json,os,subprocess,tempfile
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='30d37abc03bd62e48e9878f3e5d31acf5ea2c6d0';F=Path('reports/ai-foundation-20261105/third-round-teacher-v1');sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def git(*args,data=None,index=None):
 env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'}
 if index:env['GIT_INDEX_FILE']=index
 r=subprocess.run(['git',*args],cwd=repo,input=data,env=env,capture_output=True)
 if r.returncode:raise RuntimeError(r.stdout.decode()+r.stderr.decode())
 return r.stdout
assert git('rev-parse','HEAD').decode().strip()==base;assert git('symbolic-ref','--short','HEAD').decode().strip()=='dev';shared=sha(repo/'.git/index');assert shared=='d01a449eea57aa1efd899d9490d7560eb2045de4b16d8c9627c4505a254a51bb';entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()
progress=json.loads((stage/'adhoc/human405-third-round-progress-20261106-v25.json').read_text());assert progress['newNativeInputs']==107 and progress['newAutonomousExperiments']==0 and progress['sourceRuntimeUnchanged'];
for n,h in progress['evidenceSha256'].items():assert sha(stage/n)==h,n
proof=json.loads((stage/F/'v256-current-source-admission-20261106-v1.json').read_text())
for n,h in {**proof['runtimeSourceHashes'],**proof['ownedSourceHashes']}.items():assert sha(stage/n)==sha(repo/n)==h,n
preserve={n:sha(repo/n)for n in ['reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html']}
files={'docs/ai-design.md','docs/human405-third-round-scan-finance-learning-20261106.md','adhoc/human405-third-round-progress-20261106-v25.json','adhoc/deliver-v256-scan-finance-learning-20261106-v1.py','adhoc/control-v256-first-landing-finance-20261106-v1.js','adhoc/summarize-v256-purple-scan-cycle-20261106-v1.js'}
files|={f'adhoc/control-v256-purple-scan-cycle-20261106-v{i}.js'for i in range(1,5)}
files|={str(p.relative_to(stage))for p in (stage/F).glob('v256-purple-scan-cycle-*')if p.is_file()}
files|={str(p.relative_to(stage))for p in (stage/F).glob('v256-first-landing-finance-*')if p.is_file()}
old={}
for row in git('ls-tree','-rz',base).split(b'\0'):
 if row:meta,n=row.split(b'\t',1);mode,kind,digest=meta.decode().split();old[n.decode()]=(mode,digest)
blob=lambda b:hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
files={n for n in files if old.get(n,('',None))[1]!=blob((stage/n).read_bytes())};assert not any(n.startswith(('randomizer/','tools/','assets/'))for n in files)
for n in files:
 if (repo/n).exists():assert (repo/n).read_bytes()==(stage/n).read_bytes()or blob((repo/n).read_bytes())==old.get(n,('',None))[1],'overlap:'+n
 if n.endswith('.json'):json.loads((stage/n).read_text())
 if n.endswith('.js'):subprocess.run(['node','--check',n],cwd=stage,capture_output=True,check=True)
 if n.endswith('.py'):compile((stage/n).read_text(),n,'exec')
manifest='adhoc/v256-scan-finance-learning-delivery-manifest-20261106-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'filesSha256':{n:sha(stage/n)for n in sorted(files)},'runtimeUnchanged':True,'newAutonomousRuns':0,'newSearchCalls':0,'nativeInputs':107,'goalStatus':'active','sharedIndexSha256':shared,'experimentCenterUnchanged':True},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_V256_LEARNING')!='1':print(json.dumps({'preflight':'passed','files':len(files),'runtimeUnchanged':True,'newAutonomousRuns':0,'nativeInputs':107}));raise SystemExit(0)
index=str(Path(tempfile.mkdtemp(prefix='seti-v256-learning-index-'))/'index');git('read-tree',base,index=index);names=sorted(files);digests=git('hash-object','-w','--stdin-paths',data=''.join(str(stage/n)+'\n'for n in names).encode(),index=index).decode().splitlines();assert len(names)==len(digests)
for n,d in zip(names,digests):assert d==blob((stage/n).read_bytes())
git('update-index','--index-info',data=''.join(old.get(n,('100644',None))[0]+' '+d+'\t'+n+'\n'for n,d in zip(names,digests)).encode(),index=index);assert set(git('diff','--cached','--name-only',base,index=index).decode().splitlines())==files;tree=git('write-tree',index=index).decode().strip()
for n in names:assert git('show',tree+':'+n)==(stage/n).read_bytes();(repo/n).parent.mkdir(parents=True,exist_ok=True);(repo/n).write_bytes((stage/n).read_bytes())
git('commit','-m','核验第三轮连续扫描与登陆融资差异',index=index);commit=git('rev-parse','HEAD').decode().strip();Path('/private/tmp/seti-v256-scan-finance-learning-commit-show-20261106-v1.log').write_bytes(git('show','--name-only','--stat','HEAD'));assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files
assert sha(repo/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for n,h in preserve.items():assert sha(repo/n)==h,n
receipt={'commit':commit,'files':len(files),'runtimeUnchanged':True,'newAutonomousRuns':0,'newNativeInputs':107,'sharedIndexAndCenterPreserved':True,'goalStatus':'active'};Path('/private/tmp/seti-v256-scan-finance-learning-delivery-20261106-v1.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
