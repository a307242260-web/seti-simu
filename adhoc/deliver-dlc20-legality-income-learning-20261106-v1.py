from pathlib import Path
import hashlib,json,os,subprocess,tempfile
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='374242cc5c01a1024e66cd133665e1abdc50342b';folder=Path('reports/ai-foundation-20261106/dlc20-alien-legality-v1');sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();read=lambda p:json.loads(p.read_text())
def git(*args,data=None,index=None):
 env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
 if index:env['GIT_INDEX_FILE']=index
 r=subprocess.run(['git',*args],cwd=repo,input=data,env=env,capture_output=True)
 if r.returncode:raise RuntimeError(r.stdout.decode()+r.stderr.decode())
 return r.stdout
assert git('rev-parse','HEAD').decode().strip()==base
assert git('symbolic-ref','--short','HEAD').decode().strip()=='dev'
shared=sha(repo/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();proof=read(stage/folder/'verification-20261106-v1.json');assert proof['status']=='verified-rule-repair-and-fixed-native-learning'and proof['newAutonomousExperiments']==0 and proof['unitPassed']==7 and proof['fullFlowPassed']==1 and proof['browserRelatedPassed']==3
runtime=read(stage/'reports/ai-foundation-20261105/third-round-teacher-v1/v263-committed-source-experiment-verification-20261106-v1.json')['runtimeAndOwnedSourceHashes'];own=proof['productionHashes'];assert set(own)=={'randomizer/game/cards/play-domain.js','randomizer/index.html','tools/browser-smoke-inventory.js'}
for n,h in runtime.items():assert sha(repo/n)==h and sha(stage/n)==own.get(n,h),n
plan=read(stage/folder/'center-annotation-20261106-v1.json');prepared=Path(plan['preparedDirectory']);central=set(plan['beforeFileHashes'])
for n in central:assert sha(repo/n)==plan['beforeFileHashes'][n] and sha(prepared/n)==plan['afterFileHashes'][n],n
files=set(own)|{'randomizer/game/cards/play-domain.test.js','docs/ai-design.md','docs/human405-third-round-v263-result-20261106.md','docs/human405-dlc20-income-learning-20261106.md','adhoc/human405-third-round-progress-20261106-v33.json','adhoc/control-v263-income-and-dlc20-20261106-v1.js','adhoc/prove-dlc20-legality-income-learning-20261106-v1.js','adhoc/prepare-dlc20-score-disclosure-20261106-v1.js','adhoc/deliver-dlc20-legality-income-learning-20261106-v1.py','reports/iteration/ai-search-v263-teacher-r3-20261106/20fa9816.7a747f86.quick-400.action-log.html'}|central
files|={str(p.relative_to(stage))for p in(stage/folder).iterdir()if p.is_file()}
manifest='adhoc/dlc20-legality-income-delivery-manifest-20261106-v1.json'
assert manifest not in files
old={}
for row in git('ls-tree','-rz',base).split(b'\0'):
 if row:meta,n=row.split(b'\t',1);mode,kind,digest=meta.decode().split();old[n.decode()]=(mode,digest)
blob=lambda b:hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
for n in sorted(files):
 p=stage/n;target=repo/n
 if n not in central and target.exists():assert target.read_bytes()==p.read_bytes()or blob(target.read_bytes())==old.get(n,('',None))[1],'foreign overlapping changes:'+n
 if p.suffix=='.json':json.loads(p.read_text())
 if p.suffix=='.js':subprocess.run(['node','--check',n],cwd=stage,check=True,capture_output=True)
 if p.suffix=='.py':compile(p.read_text(),n,'exec')
for record in ['reports/research/20fa9816.7a747f86.quick-400.json','seti-saves/seti-save-research-ai-search-v263-teacher-r3-20261106-7a747f86-quick-400-v78.json']:assert(stage/record).read_bytes()==git('show',base+':'+record),'historical raw evidence unchanged'
(stage/manifest).write_text(json.dumps({'baseCommit':base,'sharedIndexSha256':shared,'sharedStageEntriesSha256':entries,'filesSha256':{n:sha(stage/n)for n in sorted(files)},'productionChanges':list(own),'nativeInputs':20,'newAutonomousRuns':0,'unitPassed':7,'fullFlowPassed':1,'browserRelatedPassed':3,'broaderBrowserParity':'same timeout on candidate and unmodified baseline, not passed','historicalScoreAnnotatedNotRewritten':True,'foreignCenterPreservation':plan,'goalStatus':'active'},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_DLC20_LEGALITY')!='1':print(json.dumps({'preflight':'passed','files':len(files),'runtimeChanges':list(own),'sharedIndexExact':True,'newAutonomousRuns':0}));raise SystemExit(0)
for n in sorted(files-central):p=repo/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((stage/n).read_bytes())
for n in central:(repo/n).write_bytes((prepared/n).read_bytes());assert sha(repo/n)==plan['afterFileHashes'][n]
working=read(repo/'reports/iteration/registry.json');before=read(prepared/'before/reports/iteration/registry.json');assert working['generations']==before['generations'];assert len(working['versions'])==194
for entry in before['versions']:
 if entry['id']!='ai-search-v263-teacher-r3-20261106':assert next(v for v in working['versions']if v['id']==entry['id'])==entry
index=str(Path(tempfile.mkdtemp(prefix='seti-dlc20-fix-index-'))/'index');git('read-tree',base,index=index);names=sorted(files);digests=git('hash-object','-w','--stdin-paths',data=''.join(str(stage/n)+'\n'for n in names).encode(),index=index).decode().splitlines();assert len(digests)==len(names)
for n,digest in zip(names,digests):assert digest==blob((stage/n).read_bytes()),n
git('update-index','--index-info',data=''.join(old.get(n,('100644',None))[0]+' '+d+'\t'+n+'\n'for n,d in zip(names,digests)).encode(),index=index);assert set(git('diff','--cached','--name-only',base,index=index).decode().splitlines())==files;tree=git('write-tree',index=index).decode().strip()
for n in files:assert git('show',tree+':'+n)==(stage/n).read_bytes(),n
for n,h in runtime.items():assert hashlib.sha256(git('show',tree+':'+n)).hexdigest()==own.get(n,h),n
assert len(json.loads(git('show',tree+':reports/iteration/registry.json'))['versions'])==193
assert not any(v['id']=='perf-baseline-lowload-20260913'for v in json.loads(git('show',tree+':reports/iteration/versions.json'))['versions'])
git('commit','-m','修复DLC20外星牌合法性并记录电收入的扫描分析用途',index=index);commit=git('rev-parse','HEAD').decode().strip();Path('/private/tmp/seti-dlc20-fix-commit-show-20261106-v1.log').write_bytes(git('show','--name-only','--stat','HEAD'));assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files;assert sha(repo/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
receipt={'commit':commit,'files':len(files),'sharedIndexExact':True,'foreignV1Preserved':True,'sourceSnapshotVerified':True,'unitPassed':7,'fullFlowPassed':1,'browserRelatedPassed':3,'broaderBrowserParity':'same timeout on candidate and baseline','fixedNativeInputs':20,'newAutonomousRuns':0,'historical80Annotated':True,'goalStatus':'active'};Path('/private/tmp/seti-dlc20-fix-delivery-20261106-v1.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
