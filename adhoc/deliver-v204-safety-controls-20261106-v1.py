from pathlib import Path
import hashlib,json,os,subprocess,tempfile
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='151920f3af305282edc65d5b554f815d8a72d71b';folder=Path('reports/ai-foundation-20261105/third-round-teacher-v1');sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def git(*args,data=None,index=None):
 env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
 if index:env['GIT_INDEX_FILE']=index
 r=subprocess.run(['git',*args],cwd=repo,input=data,env=env,capture_output=True)
 if r.returncode:raise RuntimeError(r.stdout.decode()+r.stderr.decode())
 return r.stdout
assert git('rev-parse','HEAD').decode().strip()==base;shared=sha(repo/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()
proof=json.loads((repo/folder/'v204-current-source-admission-20261106-v1.json').read_text())
for n,h in proof['runtimeSourceHashes'].items():assert sha(stage/n)==h and sha(repo/n)==h,n
control=json.loads((stage/folder/'v204-actual-safety-choice-native-20261106-v1.json').read_text());follow=json.loads((stage/folder/'v204-safety-research-followup-native-20261106-v1.json').read_text());assert control['nativeInputs']==13 and control['rootAndRngRestored'];assert follow['nativeInputs']==7 and follow['previouslyAcceptedInputs']==3 and follow['rootAndRngRestored'];assert follow['valueBefore']['total']==100 and follow['valueAfter']['total']==109
assert sha(stage/control['checkpoint'])==control['checkpointSha256'];assert sha(stage/control['recordPath'])==control['recordSha256']
files={'docs/human405-third-round-safety-followup-20261106.md','adhoc/human405-third-round-progress-20261106-v4.json','adhoc/deliver-v204-safety-controls-20261106-v1.py','adhoc/control-v204-actual-safety-choice-20261106-v1.js'}
files|={'adhoc/control-v204-safety-research-followup-20261106-v'+str(v)+'.js'for v in [1,2,3]}
files|={str(p.relative_to(stage))for pattern in ['v204-actual-safety-*-20261106-v1*','v204-safety-research-followup-*-20261106-v*']for p in(stage/folder).glob(pattern)if p.is_file()}
assert not any(n.startswith(('randomizer/','tools/'))for n in files)
for n in files:
 p=stage/n;assert p.is_file(),n
 if(repo/n).exists():assert(repo/n).read_bytes()==p.read_bytes(),'overlap:'+n
 if p.suffix=='.js':subprocess.run(['node','--check',n],cwd=stage,check=True)
 if p.suffix=='.py':compile(p.read_text(),n,'exec')
 if p.suffix=='.json':json.loads(p.read_text())
manifest='adhoc/v204-safety-controls-delivery-manifest-20261106-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'nativeInputs':20,'newAutonomousRuns':0,'sourceUnchanged':True,'sharedIndexSha256':shared,'sharedStageEntriesSha256':entries,'filesSha256':{n:sha(stage/n)for n in sorted(files)},'goalStatus':'active'},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_V204_SAFETY')!='1':print(json.dumps({'preflight':'passed','files':len(files),'nativeInputs':20,'runtimeChanged':False}));raise SystemExit(0)
index=str(Path(tempfile.mkdtemp(prefix='seti-v204-safety-index-'))/'index');git('read-tree',base,index=index)
for n in sorted(files):
 digest=git('hash-object','-w','--stdin',data=(stage/n).read_bytes(),index=index).decode().strip();git('update-index','--add','--cacheinfo','100644',digest,n,index=index)
assert set(git('diff','--cached','--name-only',base,index=index).decode().splitlines())==files
tree=git('write-tree',index=index).decode().strip()
for n in files:assert git('show',tree+':'+n)==(stage/n).read_bytes(),n
for n in sorted(files):p=repo/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((stage/n).read_bytes())
git('commit','-m','原生核验安全协议后续研究与新B标记的漏计差距',index=index);commit=git('rev-parse','HEAD').decode().strip();assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files
assert sha(repo/'.git/index')==shared;assert hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
receipt={'commit':commit,'files':len(files),'privateIndex':index,'nativeInputs':20,'newAutonomousRuns':0,'sharedIndexByteAndEntriesExact':True,'runtimeChanged':False,'goalStatus':'active'};Path('/private/tmp/seti-v204-safety-controls-delivery-20261106-v1.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
