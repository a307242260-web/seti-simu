from pathlib import Path
import hashlib,json,os,subprocess,tempfile
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='43bf8cfcec92790deea7225cd1766fcf3a4eb1ad';F=Path('reports/ai-foundation-20261105/third-round-teacher-v1');sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();read=lambda p:json.loads(p.read_text());id='ai-search-v276-teacher-r3-20261106'
def git(*args,data=None,index=None):
 env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
 if index:env['GIT_INDEX_FILE']=index
 r=subprocess.run(['git',*args],cwd=repo,input=data,env=env,capture_output=True)
 if r.returncode:raise RuntimeError(r.stdout.decode()+r.stderr.decode())
 return r.stdout
assert git('rev-parse','HEAD').decode().strip()==base;assert git('symbolic-ref','--short','HEAD').decode().strip()=='dev';shared=sha(repo/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();proof=read(stage/F/'v276-committed-source-experiment-verification-20261106-v1.json');assert proof['status']=='passed-source-and-experiment-provenance'and proof['newAutonomousExperiments']==1
for n,h in proof['runtimeAndOwnedSourceHashes'].items():assert sha(stage/n)==sha(repo/n)==h,n
recordPath='reports/research/c1769e51.43bf8cfc.quick-400.json';record=read(stage/recordPath);assert sha(stage/recordPath)==proof['recordSha256'];assert record['stopReason']=='third-round-settled'and record['wallMs']==4482 and record['steps']==177
native=read(stage/F/'v276-standard-r3-native-verification-20261106-v1.json');assert native['prePassAndFinalNativeStateSessionRngExact']and native['nativeInputs']==65 and native['allSearchEvidenceCompleteAndPassed']
plan=read(stage/F/'v276-center-merge-20261107-v1.json');assert plan['allExistingVersionObjectsUnchanged']and plan['workingV1RegistryByteEquivalent']and plan['workingPageCodeOutsideRegistryUnchanged'];prepared=Path(plan['preparedDirectory']);central=set(plan['beforeFileHashes'])
for n in central:assert sha(prepared/n)==plan['afterFileHashes'][n];assert sha(repo/n)in[plan['beforeFileHashes'][n],plan['afterFileHashes'][n]],'center changed after preparation:'+n
ownVersion=next(v for v in read(stage/'reports/iteration/versions.json')['versions']if v['id']==id);assert ownVersion['baselineEligible']is False and ownVersion['aiGeneration']=='v2';assert read(stage/'reports/iteration/registry.json')['generations']['v2']['currentBaseline']=='ai-search-v41-baseline-20261029'
files={'docs/human405-postdraw-known-data-learning-20261106.md','docs/ai-design.md','docs/human405-third-round-v276-result-20261107.md','reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html','adhoc/deliver-v276-r3-results-20261107-v1.py','adhoc/human405-third-round-progress-20261107-v1.json',record['savePath']}
files|={str(p.relative_to(stage))for p in(stage/'adhoc').glob('*v276*')if p.is_file()}
files|={str(p.relative_to(stage))for p in(stage/F).glob('v276-*')if p.is_file()}
files|={str(p.relative_to(stage))for p in(stage/'reports/research').glob('c1769e51.43bf8cfc.quick-400*')if p.is_file()}
files|={str(p.relative_to(stage))for p in(stage/'reports/iteration'/id).glob('*')if p.is_file()}
manifest='adhoc/v276-r3-results-delivery-manifest-20261106-v1.json';files.discard(manifest)
old={}
for row in git('ls-tree','-rz',base).split(b'\0'):
 if row:meta,n=row.split(b'\t',1);mode,kind,digest=meta.decode().split();old[n.decode()]=(mode,digest)
blob=lambda b:hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest();files={n for n in files if old.get(n,('',None))[1]!=blob((stage/n).read_bytes())};assert not any(n.startswith(('randomizer/','tools/','assets/'))for n in files)
for n in sorted(files):
 p=stage/n;target=repo/n
 if n not in central and target.exists():assert target.read_bytes()==p.read_bytes()or blob(target.read_bytes())==old.get(n,('',None))[1],'overlap:'+n
 if p.suffix=='.json':json.loads(p.read_text())
 if p.suffix=='.js':subprocess.run(['node','--check',n],cwd=stage,check=True,capture_output=True)
 if p.suffix=='.py':compile(p.read_text(),n,'exec')
(stage/manifest).write_text(json.dumps({'baseCommit':base,'record':recordPath,'recordSha256':sha(stage/recordPath),'sourceRuntimeUnchanged':True,'autonomousExperiments':1,'thirdRoundSettled':True,'newAcceptedInputs':65,'boardScore':79,'tech':6,'maxNativeInputs':170,'maxMilliseconds':505.15791699999977,'developmentAligned':False,'baselineUnchanged':'ai-search-v41-baseline-20261029','sharedIndexSha256':shared,'sharedStageEntriesSha256':entries,'filesSha256':{n:sha(stage/n)for n in sorted(files)},'workingCenterPreservation':plan,'privateIndexCenterContainsOnlyOwnVersion':True,'goalStatus':'active'},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_V276_RESULTS')!='1':print(json.dumps({'preflight':'passed','files':len(files),'newAutonomousExperiments':1,'sourceUnchanged':True,'foreignIndexAndV1CenterPreserved':True}));raise SystemExit(0)
# Only owned artifacts are copied; center keeps the old V1/data/page outside
# embedded registry, while staging uses the independently built own snapshot.
for n in sorted(files-central):p=repo/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((stage/n).read_bytes())
for n in central:(repo/n).write_bytes((prepared/n).read_bytes());assert sha(repo/n)==plan['afterFileHashes'][n]
workingVersions=read(repo/'reports/iteration/versions.json');beforeVersions=read(prepared/'before/reports/iteration/versions.json');workingRegistry=read(repo/'reports/iteration/registry.json');beforeRegistry=read(prepared/'before/reports/iteration/registry.json')
for entry in beforeVersions['versions']:assert next(v for v in workingVersions['versions']if v['id']==entry['id'])==entry
for entry in beforeRegistry['versions']:assert next(v for v in workingRegistry['versions']if v['id']==entry['id'])==entry
assert workingRegistry['generations']['v1']==beforeRegistry['generations']['v1'];assert workingRegistry['generations']['v2']['currentBaseline']=='ai-search-v41-baseline-20261029';assert len(workingVersions['versions'])==197
index=str(Path(tempfile.mkdtemp(prefix='seti-v276-results-index-'))/'index');git('read-tree',base,index=index);names=sorted(files);digests=git('hash-object','-w','--stdin-paths',data=''.join(str(stage/n)+'\n'for n in names).encode(),index=index).decode().splitlines();assert len(digests)==len(names)
for n,digest in zip(names,digests):assert digest==blob((stage/n).read_bytes()),n
git('update-index','--index-info',data=''.join(old.get(n,('100644',None))[0]+' '+d+'\t'+n+'\n'for n,d in zip(names,digests)).encode(),index=index);assert set(git('diff','--cached','--name-only',base,index=index).decode().splitlines())==files;tree=git('write-tree',index=index).decode().strip()
for n in files:assert git('show',tree+':'+n)==(stage/n).read_bytes(),n
stagedVersions=json.loads(git('show',tree+':reports/iteration/versions.json'));assert len(stagedVersions['versions'])==196 and not any(v['id']=='perf-baseline-lowload-20260913'for v in stagedVersions['versions']);assert any(v['id']=='perf-baseline-lowload-20260913'for v in workingVersions['versions'])
git('commit','-m','记录V276第三轮79分及首次分歧并保留版本隔离',index=index);commit=git('rev-parse','HEAD').decode().strip();Path('/private/tmp/seti-v276-results-commit-show-20261106-v1.log').write_bytes(git('show','--name-only','--stat','HEAD'));assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files;assert sha(repo/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for n,h in proof['runtimeAndOwnedSourceHashes'].items():assert sha(repo/n)==h,n
receipt={'commit':commit,'sourceCommit':base,'files':len(files),'sharedIndexExact':True,'foreignWorkingVersionAndV1RegistryPreserved':True,'workingPageCodeOutsideRegistryPreserved':True,'workingCenterVersions':197,'committedCenterVersions':196,'sourceRuntimeUnchanged':True,'record':recordPath,'newAutonomousExperiments':1,'thirdRoundSettled':True,'boardScore':79,'tech':6,'maxNativeInputs':170,'maxMilliseconds':505.15791699999977,'developmentAligned':False,'baselineUnchanged':'ai-search-v41-baseline-20261029','goalStatus':'active','nextStudy':'actual156 Amiba2 window137 to139 beats unknown second species138.5 but actualR3 drops7points and1E income. Study concrete funded preparation and downstream value; verify first-two assets then R2-end and original23 first3. Highest V25687, teacher105, goal active.'};Path('/private/tmp/seti-v276-results-delivery-20261106-v1.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
