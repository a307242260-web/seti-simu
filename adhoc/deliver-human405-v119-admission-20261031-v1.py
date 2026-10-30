"""Verify and deliver only the admitted source and its reproducible evidence."""
import hashlib, json, os, pathlib, re, subprocess, tarfile, tempfile, io
stage=pathlib.Path(__file__).resolve().parents[1]
root=pathlib.Path('/Users/bilibili/code/seti-simu')
base='5d250c4b8d8a1254f8aece9ac8fe856eb6c74093'
def git(*args,data=None,env=None):
 return subprocess.check_output(['git',*args],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
assert git('rev-parse','HEAD').decode().strip()==base
assert git('symbolic-ref','--short','HEAD').decode().strip()=='dev'
index_hash=sha(root/'.git/index')
entries_hash=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()
assert index_hash=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49'
assert entries_hash=='9e3d88268694038e1c8b530e6f372baae5a0157d269d9e4e7916841980040c30'
teacher_path='reports/ai-foundation-20261023/human405-round1-v119-audit-20261030-v1.json'
compat_path='reports/ai-foundation-20261023/human405-v119-compat-cold-20261031-v1.json'
teacher,compat=read(teacher_path),read(compat_path)
assert len(teacher['rows'])==32 and not teacher['speedOverruns'] and not teacher['unactionableRoots']
assert len(compat['rows'])==13 and not compat['overruns']
proofs=[f'reports/ai-foundation-20261023/human405-v119-native-bound-controls-{kind}-{number}-20261030-v1.json' for kind,number in [('teacher',39),('legacy',105),('legacy',152)]]
bound=[r['evidencePath'] for r in teacher['rows']+compat['rows']]+proofs
files={teacher_path,compat_path,*bound}
for p in bound:
 r=read(p)
 for source,h in r['sourceHashes'].items():assert sha(stage/source)==h,(p,source)
 if r.get('rawPath'):
  assert sha(stage/r['rawPath'])==r['rawSha256'];files.add(r['rawPath'])
 if p in proofs:assert r['sameBestAsFreshNativePolicy'] and r['sourceRootAndRngUnchanged']
overlays=[]
for line in git('ls-tree','-r',base).decode().splitlines():
 meta,name=line.split('\t');p=stage/name
 if not p.is_file() or not name.startswith(('randomizer/','tools/','docs/ai-design.md','adhoc/audit-human405-mission-cold-case-20261031-v1.js')):continue
 data=p.read_bytes();blob=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
 if blob!=meta.split()[2]:overlays.append(name)
assert len(overlays)==28,len(overlays)
files.update(overlays)
files.update(['randomizer/game/ai/probe-capital.js','randomizer/game/ai/probe-capital-value.test.js','randomizer/game/ai/quiet-end-visit-value.test.js',
 'docs/human405-round1-v119-admission-20261031.md','adhoc/verify-human405-mission-bounds-20261031-v1.js',
 'adhoc/verify-human405-identity-solar-20261031-v1.js','adhoc/human405-v119-reference-sources-20261031-v1.json.gz',
 'adhoc/deliver-human405-v119-admission-20261031-v1.py',
 'reports/ai-foundation-20261023/human405-v119-identity-solar-differential-20261031-v2.json',
 'reports/ai-foundation-20261023/human405-v119-syntax-20261031-v1.json'])
logs=['node-full','chrome-seven','value-input-audit','native-teacher39','native-legacy105','native-legacy152','differential']
log_paths={k:f'reports/ai-foundation-20261023/human405-v119-{k}-20261031-v{2 if k=="differential" else 1}.log' for k in logs}
assert 'unit passed=153 failed=0 total=153' in (stage/log_paths['node-full']).read_text()
assert 'fullFlow passed=1 failed=0 total=1' in (stage/log_paths['node-full']).read_text()
assert 'browserSmoke passed=7 failed=0 total=7' in (stage/log_paths['chrome-seven']).read_text()
failures=[s for s in (stage/log_paths['value-input-audit']).read_text().splitlines() if s.startswith('[FAIL]')]
assert len(failures)==1 and 'decisionObs' in failures[0] and 'aomomo' in failures[0]
files.update(log_paths.values())
files.add('reports/ai-foundation-20261023/human405-v119-chrome-hotpath-diagnostic-20261031-v1.log')
diff=read('reports/ai-foundation-20261023/human405-v119-identity-solar-differential-20261031-v2.json')
assert diff['geometryChecks']==9100 and diff['identityChecks']==1440
for p,h in diff['sourceHashes'].items():assert sha(stage/p)==h
checkpoint='adhoc/human405-round1-progress-20261031-v29.json'
progress={'schemaVersion':'seti-human405-round1-goal-checkpoint-v2','date':'2026-10-31','goalStatus':'active',
 'phase':'v119-admitted-awaiting-once-standard-white-r1-trial','candidateVersion':'v119','candidateValue':'v5',
 'singlePointAdmitted':True,'fullGameAdmitted':False,'coldRoots':45,'coldOverruns':[],
 'teacherFirstInputMatches':25,'teacherNodes':32,'remainingStrategicSteps':[24,38,39,43,62],
 'nativeOrderSteps':[25,56],'newAutonomousRun':False,'baselineUnchanged':'ai-search-v41-baseline-20261029',
 'documentation':'docs/human405-round1-v119-admission-20261031.md',
 'nextSafeAction':'Run robot_iterate once on the exact admitted commit with scenario=human405-white-round1-v1, then set baselineEligible:false before final registry build; compare native white R1 endpoint and outstanding teacher differences. No claim of alignment or score improvement before that run.',
 'validation':{'unit':153,'fullFlow':1,'chrome':7,'nativeBoundControlRoots':3,'geometryDifferential':9100,'identityDifferential':1440},
 'knownAuditFailure':failures[0]}
(stage/checkpoint).write_text(json.dumps(progress,ensure_ascii=False,indent=2)+'\n');files.add(checkpoint)
for p in files:
 assert (stage/p).is_file(),p
 if (root/p).exists() and (root/p).read_bytes()!=(stage/p).read_bytes():
  if p=='adhoc/deliver-human405-v119-admission-20261031-v1.py':
   previous=json.loads((root/'adhoc/human405-v119-admission-delivery-manifest-20261031-v1.json').read_text())
   assert previous['baseCommit']==base and previous['files'][p]==sha(root/p)
   continue
  assert git('cat-file','-e',base+':'+p)==b''
  assert (root/p).read_bytes()==git('show',base+':'+p),('foreign root modification',p)
manifest_path='adhoc/human405-v119-admission-delivery-manifest-20261031-v1.json'
manifest={'baseCommit':base,'singlePointAdmitted':True,'fullGameAdmitted':False,'goalStatus':'active',
 'files':{p:sha(stage/p) for p in sorted(files)},'runtimeOverlays':overlays,
 'sourceBoundReports':bound,'sharedIndexSha256Before':index_hash,'sharedIndexEntriesSha256Before':entries_hash,
 'coldRoots':45,'coldOverruns':[],'validation':progress['validation'],'knownAuditFailure':failures[0],
 'baselineUnchanged':progress['baselineUnchanged']}
(stage/manifest_path).write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');files.add(manifest_path)
if os.environ.get('SETI_DELIVER_V119')!='1':
 print(json.dumps({'phase':'verified-preflight','files':len(files),'sourceBoundReports':len(bound),'singlePointAdmitted':True,'goalStatus':'active'}));raise SystemExit(0)
private='/private/tmp/seti-human405-v119-admission-20261031-v2.index';assert not pathlib.Path(private).exists()
env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 data=(stage/p).read_bytes();destination=root/p;destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(data)
 blob=git('hash-object','-w','--stdin',data=data,env=env).decode().strip()
 git('update-index','--add','--cacheinfo','100644',blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files
git('diff','--cached','--check',env=env)
tree=git('write-tree',env=env).decode().strip()
snapshot=pathlib.Path(tempfile.mkdtemp(prefix='seti-human405-v119-staged-20261031-',dir='/private/tmp'))
with tarfile.open(fileobj=io.BytesIO(git('archive',tree)),mode='r:') as archive:
 for member in archive:
  destination=snapshot/member.name
  assert not pathlib.PurePosixPath(member.name).is_absolute() and '..' not in pathlib.PurePosixPath(member.name).parts
  assert destination.resolve().is_relative_to(snapshot)
  if member.isdir():destination.mkdir(parents=True,exist_ok=True)
  elif member.isfile():
   destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(archive.extractfile(member).read());destination.chmod(member.mode)
  elif member.issym():
   assert (destination.parent/member.linkname).resolve().is_relative_to(snapshot)
   destination.parent.mkdir(parents=True,exist_ok=True);destination.symlink_to(member.linkname)
  else:raise ValueError(member.name)
for p in files:assert sha(snapshot/p)==sha(stage/p)
for p in ['randomizer/game/ai/analysis-port.test.js','randomizer/game/ai/probe-capital-value.test.js']:
 subprocess.run(['node',p],cwd=snapshot,check=True,timeout=60)
for p in bound:
 for source,h in json.loads((snapshot/p).read_text())['sourceHashes'].items():assert sha(snapshot/source)==h
assert sha(root/'.git/index')==index_hash
git('commit','-m','接入探测用途估值并收束准备计划，完成白席首轮试跑准入',env=env)
commit=git('rev-parse','HEAD').decode().strip()
assert git('rev-parse','HEAD^{tree}').decode().strip()==tree
assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==files
print(git('show','--name-only','--stat','--format=short','HEAD').decode())
assert sha(root/'.git/index')==index_hash
print(json.dumps({'commit':commit,'snapshot':str(snapshot),'tree':tree,'files':len(files),'sharedIndexUnchanged':True,'singlePointAdmitted':True,'goalStatus':'active'}))
