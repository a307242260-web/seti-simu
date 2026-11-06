from pathlib import Path
import hashlib,json,os,subprocess,tempfile
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='02701e180f41ee796cc855d25a7d143279f20c03';F=Path('reports/ai-foundation-20261105/third-round-teacher-v1')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();read=lambda p:json.loads(p.read_text())
def git(*args,data=None,index=None):
 env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
 if index:env['GIT_INDEX_FILE']=index
 r=subprocess.run(['git',*args],cwd=repo,input=data,env=env,capture_output=True)
 if r.returncode:raise RuntimeError(r.stdout.decode()+r.stderr.decode())
 return r.stdout
assert git('rev-parse','HEAD').decode().strip()==base and git('symbolic-ref','--short','HEAD').decode().strip()=='dev'
shared=sha(repo/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();assert shared=='d01a449eea57aa1efd899d9490d7560eb2045de4b16d8c9627c4505a254a51bb'
proof=read(stage/F/'v263-current-source-admission-20261106-v1.json');assert proof['sourceAdmitted']and proof['namedCases']==785 and proof['uniqueNativeRoots']==628 and proof['fullUnitPassed']==199 and proof['fullFlowPassed']==1 and proof['browserRelatedPassed']==10 and proof['newAutonomousRuns']==0
owned=proof['ownedSourceHashes'];native=read(stage/F/'v263-native-learning-provenance-20261106-v1.json')
for n,h in proof['runtimeSourceHashes'].items():
 assert sha(stage/n)==h,n
 if n not in owned:assert sha(repo/n)==h,n
for n,h in proof['evidenceSha256'].items():assert sha(stage/n)==h,n
files=set(owned)|set(native['filesSha256'])|{'docs/ai-design.md','docs/human405-research-order-mark-learning-20261106.md','adhoc/human405-third-round-progress-20261106-v31.json',str(F/'v262-browser-baseline-start-control-20261106-v1.log')}
files|={str(p.relative_to(stage))for p in(stage/'adhoc').glob('*v263*')if p.is_file()}
files|={str(p.relative_to(stage))for p in(stage/F).glob('v263-*')if p.is_file()}
candidate=stage/Path(proof['manifest']).parent;files|={str(p.relative_to(stage))for p in candidate.rglob('*')if p.is_file()}
files.discard('adhoc/v263-research-order-source-delivery-manifest-20261106-v1.json')
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
manifest='adhoc/v263-research-order-source-delivery-manifest-20261106-v1.json';assert manifest not in files
delivery={'baseCommit':base,'sourceAdmission':str(F/'v263-current-source-admission-20261106-v1.json'),'sourceAdmissionSha256':sha(stage/F/'v263-current-source-admission-20261106-v1.json'),'sourceAdmitted':True,'nativeLearningInputs':56,'newAutonomousRuns':0,'runtime':'V263/V47','namedCases':785,'uniqueNativeRoots':628,'maxNativeInputs':256,'maxMilliseconds':597.93775,'unitPassed':199,'fullFlowPassed':1,'browserPassed':10,'firstTwoSelectedContractsUnchanged':304,'inputAuditKnownAomomoFailurePreserved':True,'sharedIndexSha256':shared,'sharedEntriesSha256':entries,'filesSha256':{n:sha(stage/n)for n in sorted(files)},'goalStatus':'active','baselineUnchanged':'V41'}
(stage/manifest).write_text(json.dumps(delivery,indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_V263_SOURCE')!='1':print(json.dumps({'preflight':'passed','files':len(files),'sharedIndexPreserved':True,'sourceAdmitted':True,'newAutonomousRuns':0}));raise SystemExit(0)
for n in sorted(files):p=repo/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((stage/n).read_bytes())
index=str(Path(tempfile.mkdtemp(prefix='seti-v263-source-index-'))/'index');git('read-tree',base,index=index);names=sorted(files);digests=git('hash-object','-w','--stdin-paths',data=''.join(str(stage/n)+'\n'for n in names).encode(),index=index).decode().splitlines();assert len(digests)==len(names)
git('update-index','--index-info',data=''.join(old.get(n,('100644',None))[0]+' '+d+'\t'+n+'\n'for n,d in zip(names,digests)).encode(),index=index)
assert set(git('diff','--cached','--name-only',base,index=index).decode().splitlines())==files;tree=git('write-tree',index=index).decode().strip()
for n in files:assert git('show',tree+':'+n)==(stage/n).read_bytes(),n
assert not git('diff-tree','--no-commit-id','--name-only','-r',proof['finalValidationTree'],tree,'--','randomizer','tools','assets').strip()
git('commit','-m','补齐联合研究顺序与触发完成后的终局标记估值',index=index);commit=git('rev-parse','HEAD').decode().strip()
assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files
Path('/private/tmp/seti-v263-source-commit-show-20261106-v1.log').write_bytes(git('show','--name-only','--stat','HEAD'))
assert sha(repo/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for n,h in proof['runtimeSourceHashes'].items():assert sha(repo/n)==h,n
receipt={'commit':commit,'files':len(files),'runtime':'V263/V47','sourceAdmitted':True,'nativeLearningInputs':56,'namedCases':785,'uniqueRoots':628,'maxNativeInputs':256,'maxMilliseconds':597.93775,'unitPassed':199,'fullFlowPassed':1,'browserPassed':10,'firstTwoSelectedContractsUnchanged':304,'sharedIndexExact':True,'sourceMatchesValidatedTree':True,'newAutonomousRuns':0,'goalStatus':'active','baselineUnchanged':'V41'}
Path('/private/tmp/seti-v263-source-delivery-20261106-v1.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
