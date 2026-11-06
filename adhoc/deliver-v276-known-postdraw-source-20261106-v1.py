from pathlib import Path
import hashlib,json,os,subprocess,tempfile
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='21486ce48f3c226cdc914c8dc96f768985cfc9d9';F=Path('reports/ai-foundation-20261105/third-round-teacher-v1');sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();read=lambda p:json.loads(p.read_text())
def git(*args,data=None,index=None):
 env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
 if index:env['GIT_INDEX_FILE']=index
 r=subprocess.run(['git',*args],cwd=repo,input=data,env=env,capture_output=True)
 if r.returncode:raise RuntimeError(r.stdout.decode()+r.stderr.decode())
 return r.stdout
assert git('rev-parse','HEAD').decode().strip()==base and git('symbolic-ref','--short','HEAD').decode().strip()=='dev';shared=sha(repo/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();assert shared=='d01a449eea57aa1efd899d9490d7560eb2045de4b16d8c9627c4505a254a51bb'
proof=read(stage/F/'v276-current-source-admission-20261106-v1.json');assert proof['sourceAdmitted'] and proof['namedCases']==1033 and proof['uniqueNativeRoots']==705 and proof['fullUnitBusinessObligationsPassed']==201 and proof['newAutonomousRuns']==0;owned=proof['ownedSourceHashes']
for n,h in proof['runtimeSourceHashes'].items():
 assert sha(stage/n)==h,n
 if n not in owned:assert sha(repo/n)==h,n
for n,h in proof['evidenceSha256'].items():assert sha(stage/n)==h,n
files=set(owned)|set(proof['evidenceSha256'])|{str(F/'v276-current-source-admission-20261106-v1.json'),'docs/ai-design.md','docs/human405-postdraw-known-data-learning-20261106.md','adhoc/human405-third-round-progress-20261106-v39.json','adhoc/human405-third-round-progress-20261106-v40.json'}
for version in [274,275,276]:
 files|={str(p.relative_to(stage))for p in(stage/'adhoc').glob('*v'+str(version)+'*')if p.is_file()}
 files|={str(p.relative_to(stage))for p in(stage/F).glob('v'+str(version)+'-*')if p.is_file()}
for folder in ['reports/ai-foundation-20261106/analysis-blue-choice-v1','reports/ai-foundation-20261106/known-postdraw-data-v1','reports/ai-foundation-20261106/candidate-v275-known-postdraw-data-v1','reports/ai-foundation-20261106/candidate-v276-known-postdraw-blue-v1']:
 files|={str(p.relative_to(stage))for p in(stage/folder).rglob('*')if p.is_file()}
manifest='adhoc/v276-known-postdraw-source-delivery-manifest-20261106-v1.json';files.discard(manifest);old={}
for row in git('ls-tree','-rz',base).split(b'\0'):
 if row:meta,n=row.split(b'\t',1);mode,kind,digest=meta.decode().split();old[n.decode()]=(mode,digest)
blob=lambda b:hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest();files={n for n in files if old.get(n,('',None))[1]!=blob((stage/n).read_bytes())}
for n in sorted(files):
 p=stage/n;target=repo/n
 if target.exists():assert target.read_bytes()==p.read_bytes() or blob(target.read_bytes())==old.get(n,('',None))[1],'overlap:'+n
 if p.suffix=='.json':json.loads(p.read_text())
 if p.suffix=='.js':subprocess.run(['node','--check',n],cwd=stage,check=True,capture_output=True)
 if p.suffix=='.py':compile(p.read_text(),n,'exec')
assert {n for n in files if n.startswith(('randomizer/','tools/','assets/'))}=={n for n in owned if n.startswith(('randomizer/','tools/','assets/'))};assert not any(n.startswith('reports/iteration/')or n=='reports/robot-iteration.html'for n in files)
(stage/manifest).write_text(json.dumps({'baseCommit':base,'sourceAdmission':str(F/'v276-current-source-admission-20261106-v1.json'),'sourceAdmissionSha256':sha(stage/F/'v276-current-source-admission-20261106-v1.json'),'runtime':'V276/V48','sourceAdmitted':True,'namedCases':1033,'uniqueNativeRoots':705,'newAutonomousRuns':0,'firstTwoAutonomousAssetsVerifiedForThisSource':False,'baselineUnchanged':'V41','sharedIndexSha256':shared,'sharedEntriesSha256':entries,'filesSha256':{n:sha(stage/n)for n in sorted(files)},'goalStatus':'active'},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_V276_SOURCE')!='1':print(json.dumps({'preflight':'passed','files':len(files),'sharedIndexPreserved':True,'newAutonomousRuns':0}));raise SystemExit(0)
for n in sorted(files):p=repo/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((stage/n).read_bytes())
index=str(Path(tempfile.mkdtemp(prefix='seti-v276-source-index-'))/'index');git('read-tree',base,index=index);names=sorted(files);digests=git('hash-object','-w','--stdin-paths',data=''.join(str(stage/n)+'\n'for n in names).encode(),index=index).decode().splitlines();assert len(digests)==len(names);git('update-index','--index-info',data=''.join(old.get(n,('100644',None))[0]+' '+d+'\t'+n+'\n'for n,d in zip(names,digests)).encode(),index=index);assert set(git('diff','--cached','--name-only',base,index=index).decode().splitlines())==files;tree=git('write-tree',index=index).decode().strip()
for n in files:assert git('show',tree+':'+n)==(stage/n).read_bytes(),n
assert not git('diff-tree','--no-commit-id','--name-only','-r',proof['snapshotTree'],tree,'--','randomizer','tools','assets').strip()
git('commit','-m','保留抽牌后的已知数据计划并修正蓝槽准备排序',index=index);commit=git('rev-parse','HEAD').decode().strip();assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files;Path('/private/tmp/seti-v276-source-commit-show-20261106-v1.log').write_bytes(git('show','--name-only','--stat','HEAD'));assert sha(repo/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
receipt={'commit':commit,'files':len(files),'runtime':'V276/V48','sourceAdmitted':True,'namedCases':1033,'uniqueRoots':705,'maxNativeInputs':256,'maxMilliseconds':589.905,'unitBusinessObligationsPassed':201,'fullFlowPassed':1,'browserPassed':2,'firstTwoAutonomousAssetsVerified':False,'sharedIndexExact':True,'sourceMatchesValidatedTree':True,'newAutonomousRuns':0,'goalStatus':'active','baselineUnchanged':'V41'};Path('/private/tmp/seti-v276-source-delivery-20261106-v1.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
