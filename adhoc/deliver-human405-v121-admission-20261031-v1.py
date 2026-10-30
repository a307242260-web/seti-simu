"""Deliver the tested winning-income recovery source through a private index."""
import hashlib,json,gzip,os,pathlib,subprocess,tarfile,tempfile,shutil
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='9fa77f5cac52b8e73ea8dc704b9ce20246a1bcd2'
def git(*args,data=None,env=None):return subprocess.check_output(['git',*args],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
assert git('rev-parse','HEAD').decode().strip()==base
assert git('symbolic-ref','--short','HEAD').decode().strip()=='dev'
index_hash=sha(root/'.git/index');entries_hash=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()
assert index_hash=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49'
assert entries_hash=='9e3d88268694038e1c8b530e6f372baae5a0157d269d9e4e7916841980040c30'
teacher_path='reports/ai-foundation-20261023/human405-round1-v121-audit-20261030-v1.json';compat_path='reports/ai-foundation-20261023/human405-v121-compat-cold-20261031-v1.json'
t,c=read(teacher_path),read(compat_path);assert len(t['rows'])==32 and not t['speedOverruns'] and not t['unactionableRoots'];assert len(c['rows'])==13 and not c['overruns']
bound=[r['evidencePath'] for r in t['rows']+c['rows']]+[f'reports/ai-foundation-20261023/human405-v121-native-bound-controls-teacher-{n}-20261030-v1.json' for n in [24,39]]
files={teacher_path,compat_path,*bound}
for p in bound:
 r=read(p)
 for source,h in r['sourceHashes'].items():assert sha(stage/source)==h,(p,source)
 if r.get('rawPath'):assert sha(stage/r['rawPath'])==r['rawSha256'];files.add(r['rawPath'])
 if p in bound[-2:]:assert r['sameBestAsFreshNativePolicy'] and r['sourceRootAndRngUnchanged']
runtime=['randomizer/game/ai/analysis-port.js','randomizer/game/ai/decision-search.js','randomizer/solar-system/core.js','randomizer/index.html','tools/browser-smoke-inventory.js','tools/node-test-inventory.js','randomizer/game/ai/winning-income-plan.test.js']
files.update(runtime)
files.update(['docs/ai-design.md','docs/ai-search-agent-contract-20261023.md','docs/ai-winning-income-recovery-20261031.md','docs/human405-round1-v119-trial-20261031.md',
 'adhoc/human405-v120-winning-income-design-20261031-v1.json','adhoc/verify-human405-identity-solar-20261031-v2.js','adhoc/deliver-human405-v121-admission-20261031-v1.py',
 'reports/ai-foundation-20261023/human405-v121-identity-solar-differential-20261031-v1.json','reports/ai-foundation-20261023/human405-v121-syntax-20261031-v1.json'])
files.update(['adhoc/cleanup-human405-rebuildable-snapshots-20261031-v1.py','reports/ai-foundation-20261023/human405-verified-temporary-cleanup-20261031-v1.json'])
logs={k:f'reports/ai-foundation-20261023/human405-v121-{k}-20261031-v1.log' for k in ['node-full','chrome-eight','value-input-audit','native-teacher24','native-teacher39','identity-solar-differential','round1-cold','compat-cold']}
assert 'unit passed=154 failed=0 total=154' in (stage/logs['node-full']).read_text();assert 'fullFlow passed=1 failed=0 total=1' in (stage/logs['node-full']).read_text()
assert 'browserSmoke passed=8 failed=0 total=8' in (stage/logs['chrome-eight']).read_text()
failures=[l for l in (stage/logs['value-input-audit']).read_text().splitlines() if l.startswith('[FAIL]')];assert len(failures)==1 and 'decisionObs' in failures[0] and 'aomomo' in failures[0]
files.update(logs.values())
for p in ['reports/ai-foundation-20261023/human405-v121-identity-solar-differential-20261031-v1.json','reports/ai-foundation-20261023/human405-v121-syntax-20261031-v1.json']:
 for source,h in read(p)['sourceHashes'].items():assert sha(stage/source)==h
historical='reports/ai-foundation-20261023/human405-v120-cold-case-105-20261031-v1.json';archive='adhoc/human405-v120-overrun-source-20261031-v1.json.gz';a=json.loads(gzip.decompress((stage/archive).read_bytes()));h=read(historical)
assert a['baseCommit']==base and not a['admitted'] and h['milliseconds']>600
for source,digest in h['sourceHashes'].items():
 data=a['files'][source].encode() if source in a['files'] else git('show',base+':'+source);assert hashlib.sha256(data).hexdigest()==digest
assert sha(stage/h['rawPath'])==h['rawSha256'];files.update([historical,h['rawPath'],archive])
checkpoint='adhoc/human405-round1-progress-20261031-v31.json'
progress={'schemaVersion':'seti-human405-round1-goal-checkpoint-v2','date':'2026-10-31','goalStatus':'active','phase':'v121-recovery-fix-admitted-awaiting-once-standard-r1','baseCommit':base,'candidateVersion':'v121','candidateValue':'v5','singlePointAdmitted':True,'fullGameAdmitted':False,'coldRoots':45,'coldOverruns':[],'unit':154,'fullFlow':1,'chrome':8,'teacherFirstInputMatches':25,'teacherNodes':32,'lastAutonomousRecord':'reports/research/12231ee9.2fb2b091.quick-200.json','lastAutonomousScore':11,'newAutonomousRun':False,'baselineUnchanged':'ai-search-v41-baseline-20261029','recoveryFix':{'openingInputs':89,'nativeMaterializedIncomeInputs':9,'nativePathInputs':12,'value':60,'perInputNativeAndAICheckpointRestorePassed':True,'invalidatedByChangedMoneyOrHand':True,'globalInputNodeTimeBudgetsPassed':True},'remainingStrategicSteps':[24,38,39,43,62],'nativeOrderSteps':[25,56],'documentation':'docs/ai-winning-income-recovery-20261031.md','nextSafeAction':'Run exactly one robot_iterate white-only R1 at the exact admitted commit. Preserve source/RNG and all256/600 gates; compare endpoint via native replay and current V5 against previous11/46.5, v99 13/53.5 and teacher15/56. Mark experiment baselineEligible:false and keep v41 baseline; no v119 rerun.','knownAuditFailure':failures[0]}
(stage/checkpoint).write_text(json.dumps(progress,ensure_ascii=False,indent=2)+'\n');files.add(checkpoint)
base_tree={}
for row in git('ls-tree','-r','-z',base).split(b'\0'):
 if row:
  header,name=row.split(b'\t',1);mode,kind,blob=header.decode().split();base_tree[name.decode()]=(mode,blob)
def same_base(p):
 if p not in base_tree:return False
 data=(stage/p).read_bytes();return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==base_tree[p][1]
files={p for p in files if not same_base(p)}
for p in files:
 assert (stage/p).is_file()
 if (root/p).exists() and (root/p).read_bytes()!=(stage/p).read_bytes():
  if p=='adhoc/deliver-human405-v121-admission-20261031-v1.py':
   previous=json.loads((root/'adhoc/human405-v121-admission-delivery-manifest-20261031-v1.json').read_text());assert previous['baseCommit']==base and sha(root/p)==previous['files'][p]
  else:assert (root/p).read_bytes()==git('show',base+':'+p),('overlapping root modification',p)
manifest='adhoc/human405-v121-admission-delivery-manifest-20261031-v1.json'
(stage/manifest).write_text(json.dumps({'baseCommit':base,'snapshot':str(stage),'files':{p:sha(stage/p) for p in sorted(files)},'runtimePaths':runtime,'sourceBoundReports':bound,'historicalReport':{'report':historical,'sourceArchive':archive,'sha256':sha(stage/archive)},'sharedIndexSha256Before':index_hash,'sharedIndexEntriesSha256Before':entries_hash,'singlePointAdmitted':True,'fullGameAdmitted':False,'goalStatus':'active'},ensure_ascii=False,indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_V121')!='1':print(json.dumps({'phase':'preflight','files':len(files),'sourceBoundReports':len(bound),'coldRoots':45,'goalStatus':'active'}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-human405-v121-admission-index-',dir='/private/tmp'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 data=(stage/p).read_bytes();destination=root/p;destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(data)
 blob=git('hash-object','-w','--stdin',data=data,env=env).decode().strip();git('update-index','--add','--cacheinfo',base_tree.get(p,('100644',None))[0],blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files
git('diff','--cached','--check',env=env);tree=git('write-tree',env=env).decode().strip()
snapshot=pathlib.Path(tempfile.mkdtemp(prefix='seti-human405-v121-staged-20261031-',dir='/private/tmp'))
archive_process=subprocess.Popen(['git','archive',tree],cwd=root,stdout=subprocess.PIPE,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**env))
with tarfile.open(fileobj=archive_process.stdout,mode='r|') as stream:
 for member in stream:
  destination=snapshot/member.name;assert not pathlib.PurePosixPath(member.name).is_absolute() and '..' not in pathlib.PurePosixPath(member.name).parts;assert destination.resolve().is_relative_to(snapshot)
  if member.isdir():destination.mkdir(parents=True,exist_ok=True)
  elif member.isfile():
   destination.parent.mkdir(parents=True,exist_ok=True)
   with destination.open('wb') as handle:shutil.copyfileobj(stream.extractfile(member),handle)
   destination.chmod(member.mode)
  else:raise ValueError(member.name)
assert archive_process.wait()==0
for p in files:assert sha(snapshot/p)==sha(stage/p)
for p in bound:
 for source,digest in json.loads((snapshot/p).read_text())['sourceHashes'].items():assert sha(snapshot/source)==digest
for test in ['randomizer/game/ai/winning-income-plan.test.js','randomizer/game/ai/analysis-port.test.js']:subprocess.run(['node',test],cwd=snapshot,check=True,timeout=60)
assert sha(root/'.git/index')==index_hash
git('commit','-m','保留获胜收入计划的原生执行前缀，修复逐输入恢复改路',env=env);commit=git('rev-parse','HEAD').decode().strip()
assert git('rev-parse','HEAD^{tree}').decode().strip()==tree
assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==files
print(git('show','--name-only','--stat','--format=short','HEAD').decode());assert sha(root/'.git/index')==index_hash
assert hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries_hash
print(json.dumps({'commit':commit,'snapshot':str(snapshot),'privateIndex':private,'tree':tree,'files':len(files),'sharedIndexUnchanged':True,'goalStatus':'active'}))
