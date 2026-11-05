from pathlib import Path
import hashlib,json,os,subprocess,tempfile
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='5659fd16b036065734fc708ba2e52001ba4caa03';folder=Path('reports/ai-foundation-20261105/third-round-teacher-v1');sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def git(*args,data=None,index=None):
 env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
 if index:env['GIT_INDEX_FILE']=index
 r=subprocess.run(['git',*args],cwd=repo,input=data,env=env,capture_output=True)
 if r.returncode:raise RuntimeError(r.stdout.decode()+r.stderr.decode())
 return r.stdout
assert git('rev-parse','HEAD').decode().strip()==base;assert git('symbolic-ref','--short','HEAD').decode().strip()=='dev';shared=sha(repo/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()
prior=json.loads((stage/folder/'v218-current-source-admission-20261106-v1.json').read_text());progress=json.loads((stage/'adhoc/human405-third-round-progress-20261106-v10.json').read_text());assert not progress['candidateAdmitted']and progress['newAutonomousRuns']==0
for n,h in {**prior['runtimeSourceHashes'],**prior['ownedSourceHashes']}.items():assert sha(repo/n)==h,n
central=['reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html'];preserved={n:sha(repo/n)for n in central}
folders=['candidate-v219-scan-launch-reserve-v1','candidate-v220-amiba-plain-end-v1','candidate-v221-symbol-signature-v1','candidate-v222-joint-research-options-v1','candidate-v223-identity-without-subtree-cache-v1','candidate-v224-amiba-currency-tail-v1','candidate-v225-amiba-currency-blue-tail-v1']
for name in folders:
 d=stage/'reports/ai-foundation-20261106'/name;m=json.loads((d/'manifest.json').read_text());assert not m['candidateAdmitted']
 for n,h in m['sourceHashes'].items():assert sha(d/'source-files'/n)==h,(name,n)
 fail=json.loads((d/'failure-20261106-v1.json').read_text());assert not fail['candidateAdmitted'];assert sha(stage/fail['evidence'])==fail['evidenceSha256']
gate=json.loads((stage/folder/'v225-current-source-serial-gate-20261106-v3.json').read_text());assert gate['status']=='failed-gate'and len(gate['rows'])==504 and gate['failure']['nativeInputs']==311
for prefix in ['v219-','v220-','v221-','v222-','v223-','v224-','v225-']:
 for p in(stage/folder).glob(prefix+'cold-*.json'):
  e=json.loads(p.read_text());assert sha(stage/e['fixture'])==e['fixtureSha256'];assert sha(stage/e['rawPath'])==e['rawSha256'];assert e['complete']and e['rootAndRngUnchanged']
files={'docs/ai-design.md','docs/human405-third-round-scan-launch-20261106.md','adhoc/human405-third-round-progress-20261106-v10.json','adhoc/deliver-v225-scan-candidate-evidence-20261106-v1.py'}
files|={str(p.relative_to(stage))for p in(stage/folder).iterdir()if p.is_file()and p.name.startswith(('v219-','v220-','v221-','v222-','v223-','v224-','v225-'))}
files|={str(p.relative_to(stage))for n in folders for p in(stage/'reports/ai-foundation-20261106'/n).rglob('*')if p.is_file()}
files|={str(p.relative_to(stage))for p in(stage/'adhoc').iterdir()if p.is_file()and any(v in p.name for v in ['v219-','v220-','v221-','v222-','v223-','v224-','v225-'])and'20261106'in p.name}
# Unexecuted prospective admission/delivery scripts remain private until there is an admitted source.
files-={str(p.relative_to(stage))for p in(stage/'adhoc').iterdir()if p.is_file()and p.name.startswith(('prove-v223-','prove-v225-','deliver-v223-','deliver-v225-scan-launch-','verify-v225-admission-snapshot-','verify-v225-amiba-stress-','verify-v225-full-native-identity-'))}
manifest='adhoc/v225-scan-candidate-evidence-delivery-manifest-20261106-v1.json';files.discard(manifest)
old={}
for row in git('ls-tree','-rz',base).split(b'\0'):
 if row:meta,n=row.split(b'\t',1);mode,kind,digest=meta.decode().split();old[n.decode()]=(mode,digest)
blob=lambda b:hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest();files={n for n in files if old.get(n,('',None))[1]!=blob((stage/n).read_bytes())}
assert not any(n.startswith(('randomizer/','tools/'))for n in files)
for n in sorted(files):
 p=stage/n;target=repo/n
 if target.exists():assert target.read_bytes()==p.read_bytes()or blob(target.read_bytes())==old.get(n,('',None))[1],'overlap:'+n
 if p.suffix=='.json':json.loads(p.read_text())
 if p.suffix=='.js':subprocess.run(['node','--check',n],cwd=stage,check=True,capture_output=True)
 if p.suffix=='.py':compile(p.read_text(),n,'exec')
(stage/manifest).write_text(json.dumps({'baseCommit':base,'sharedIndexSha256':shared,'sharedStageEntriesSha256':entries,'filesSha256':{n:sha(stage/n)for n in sorted(files)},'productionRuntime':'V218/V37 unchanged','candidate':'V225/V37 not admitted','sourceChanged':False,'autonomousRuns':0,'namedColdCasesCompleted':504,'namedColdCasesPlanned':573,'uniqueColdRoots':415,'failureNativeInputs':311,'failureMilliseconds':565.5611250000001,'nativeControlInputs':{'V223PlainEnd':106,'V225CurrencyTail':32},'experimentCenterUntouched':True,'goalStatus':'active'},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_V225_EVIDENCE')!='1':print(json.dumps({'preflight':'passed','files':len(files),'productionSourceUnchanged':True,'foreignIndexPreserved':True,'experimentCenterUntouched':True}));raise SystemExit(0)
index=str(Path(tempfile.mkdtemp(prefix='seti-v225-evidence-index-'))/'index');git('read-tree',base,index=index);names=sorted(files);digests=git('hash-object','-w','--stdin-paths',data=''.join(str(stage/n)+'\n'for n in names).encode(),index=index).decode().splitlines();assert len(digests)==len(names)
for n,digest in zip(names,digests):assert digest==blob((stage/n).read_bytes()),n
git('update-index','--index-info',data=''.join(old.get(n,('100644',None))[0]+' '+d+'\t'+n+'\n'for n,d in zip(names,digests)).encode(),index=index);assert set(git('diff','--cached','--name-only',base,index=index).decode().splitlines())==files;tree=git('write-tree',index=index).decode().strip()
# Read every staged blob back from the private tree before materializing the evidence.
for n in files:assert git('show',tree+':'+n)==(stage/n).read_bytes(),n
for n in sorted(files):p=repo/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((stage/n).read_bytes())
git('commit','-m','记录扫描发射计划与固定尾部的原生验收及首次失败',index=index);commit=git('rev-parse','HEAD').decode().strip();Path('/private/tmp/seti-v225-evidence-commit-show-20261106-v1.log').write_bytes(git('show','--name-only','--stat','HEAD'));assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files;assert sha(repo/'.git/index')==shared;assert hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for n,h in preserved.items():assert sha(repo/n)==h,n
for n,h in {**prior['runtimeSourceHashes'],**prior['ownedSourceHashes']}.items():assert sha(repo/n)==h,n
receipt={'commit':commit,'privateIndex':index,'files':len(files),'sourceChanged':False,'candidateAdmitted':False,'sharedIndexByteAndEntriesExact':True,'experimentCenterAndForeignVersionPreserved':True,'productionRuntime':'V218/V37','newAutonomousRuns':0,'developmentAligned':False,'goalStatus':'active'};Path('/private/tmp/seti-v225-scan-candidate-evidence-delivery-20261106-v1.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
