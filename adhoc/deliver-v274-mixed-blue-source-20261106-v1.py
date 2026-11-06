from pathlib import Path
import hashlib,json,os,subprocess,tempfile
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='c267098f92c4ed66fc238b5843c4c59d047a9172';F=Path('reports/ai-foundation-20261105/third-round-teacher-v1')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();read=lambda p:json.loads(p.read_text())
def git(*args,data=None,index=None):
 env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
 if index:env['GIT_INDEX_FILE']=index
 r=subprocess.run(['git',*args],cwd=repo,input=data,env=env,capture_output=True)
 if r.returncode:raise RuntimeError(r.stdout.decode()+r.stderr.decode())
 return r.stdout
assert git('rev-parse','HEAD').decode().strip()==base and git('symbolic-ref','--short','HEAD').decode().strip()=='dev'
shared=sha(repo/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();assert shared=='d01a449eea57aa1efd899d9490d7560eb2045de4b16d8c9627c4505a254a51bb'
proof=read(stage/F/'v274-current-source-admission-20261106-v1.json');assert proof['sourceAdmitted']and proof['namedCases']==951 and proof['uniqueNativeRoots']==695 and proof['fullUnitPassed']==201 and proof['fullFlowPassed']==1 and proof['browserRelatedPassed']==2 and proof['newAutonomousRuns']==0
owned=proof['ownedSourceHashes']
for n,h in proof['runtimeSourceHashes'].items():
 assert sha(stage/n)==h,n
 if n not in owned:assert sha(repo/n)==h,n
for n,h in proof['evidenceSha256'].items():assert sha(stage/n)==h,n
files=set(owned)|set(proof['evidenceSha256'])|{'docs/ai-design.md','docs/human405-mixed-blue-analysis-learning-20261106.md','adhoc/human405-third-round-progress-20261106-v37.json','adhoc/capture-deferred-analysis-main-20261106-v1.js','adhoc/check-mixed-analysis-following-mark-20261106-v3.js'}
D=stage/'reports/ai-foundation-20261106/mixed-blue-analysis-v1'
files|={str(p.relative_to(stage))for p in D.rglob('*')if p.is_file()and 'source-delivery-cli'not in p.name}
for version in range(265,275):
 files|={str(p.relative_to(stage))for p in(stage/'adhoc').glob('*v'+str(version)+'*')if p.is_file()}
 files|={str(p.relative_to(stage))for p in(stage/F).glob('v'+str(version)+'-*')if p.is_file()}
 for candidate in(stage/'reports/ai-foundation-20261106').glob('candidate-v'+str(version)+'-mixed-blue-v*'):
  files|={str(p.relative_to(stage))for p in candidate.rglob('*')if p.is_file()}
files|={str(p.relative_to(stage))for p in(stage/'adhoc').glob('mixed-blue-analysis-contract-20261106-v*.md')if p.is_file()}
files.discard('adhoc/check-mixed-analysis-following-mark-20261106-v2.js')
files.discard('adhoc/v274-mixed-blue-source-delivery-manifest-20261106-v1.json')
old={}
for row in git('ls-tree','-rz',base).split(b'\0'):
 if row:meta,n=row.split(b'\t',1);mode,kind,digest=meta.decode().split();old[n.decode()]=(mode,digest)
blob=lambda b:hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
files={n for n in files if old.get(n,('',None))[1]!=blob((stage/n).read_bytes())}
for n in sorted(files):
 p=stage/n;target=repo/n
 if target.exists():assert target.read_bytes()==p.read_bytes()or blob(target.read_bytes())==old.get(n,('',None))[1],'overlap:'+n
 if p.suffix=='.json':json.loads(p.read_text())
 if p.suffix=='.js':subprocess.run(['node','--check',n],cwd=stage,check=True,capture_output=True)
 if p.suffix=='.py':compile(p.read_text(),n,'exec')
assert {n for n in files if n.startswith(('randomizer/','tools/','assets/'))}=={n for n in owned if n.startswith(('randomizer/','tools/','assets/'))}
manifest='adhoc/v274-mixed-blue-source-delivery-manifest-20261106-v1.json';assert manifest not in files
delivery={'baseCommit':base,'sourceAdmission':str(F/'v274-current-source-admission-20261106-v1.json'),'sourceAdmissionSha256':sha(stage/F/'v274-current-source-admission-20261106-v1.json'),'sourceAdmitted':True,'newDeferredFixtureNativeInputs':2,'independentReplayInputs':0,'quotedRouteNativeInputs':7,'newAutonomousRuns':0,'runtime':'V274/V48','namedCases':951,'uniqueNativeRoots':695,'maxNativeInputs':256,'maxMilliseconds':579.935125,'unitPassed':201,'fullFlowPassed':1,'browserPassed':2,'firstTwoSelectedContractsUnchanged':304,'inputAuditKnownAomomoFailurePreserved':True,'sharedIndexSha256':shared,'sharedEntriesSha256':entries,'filesSha256':{n:sha(stage/n)for n in sorted(files)},'goalStatus':'active','baselineUnchanged':'V41'}
(stage/manifest).write_text(json.dumps(delivery,indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_V274_SOURCE')!='1':print(json.dumps({'preflight':'passed','files':len(files),'sharedIndexPreserved':True,'sourceAdmitted':True,'newAutonomousRuns':0}));raise SystemExit(0)
for n in sorted(files):p=repo/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((stage/n).read_bytes())
index=str(Path(tempfile.mkdtemp(prefix='seti-v274-source-index-'))/'index');git('read-tree',base,index=index);names=sorted(files);digests=git('hash-object','-w','--stdin-paths',data=''.join(str(stage/n)+'\n'for n in names).encode(),index=index).decode().splitlines();assert len(digests)==len(names)
git('update-index','--index-info',data=''.join(old.get(n,('100644',None))[0]+' '+d+'\t'+n+'\n'for n,d in zip(names,digests)).encode(),index=index)
assert set(git('diff','--cached','--name-only',base,index=index).decode().splitlines())==files;tree=git('write-tree',index=index).decode().strip()
for n in files:assert git('show',tree+':'+n)==(stage/n).read_bytes(),n
assert not git('diff-tree','--no-commit-id','--name-only','-r',proof['snapshotTree'],tree,'--','randomizer','tools','assets').strip()
git('commit','-m','修复多物种分析报价并保留已付分析数据',index=index);commit=git('rev-parse','HEAD').decode().strip()
assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files
Path('/private/tmp/seti-v274-source-commit-show-20261106-v1.log').write_bytes(git('show','--name-only','--stat','HEAD'))
assert sha(repo/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for n,h in proof['runtimeSourceHashes'].items():assert sha(repo/n)==h,n
receipt={'commit':commit,'files':len(files),'runtime':'V274/V48','sourceAdmitted':True,'newDeferredFixtureNativeInputs':2,'independentReplayInputs':0,'quotedRouteNativeInputs':7,'namedCases':951,'uniqueRoots':695,'maxNativeInputs':256,'maxMilliseconds':579.935125,'unitPassed':201,'fullFlowPassed':1,'browserPassed':2,'firstTwoSelectedContractsUnchanged':304,'sharedIndexExact':True,'sourceMatchesValidatedTree':True,'newAutonomousRuns':0,'goalStatus':'active','baselineUnchanged':'V41'}
Path('/private/tmp/seti-v274-source-delivery-20261106-v1.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
