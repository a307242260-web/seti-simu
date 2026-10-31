"""Deliver final R1 learning evidence with a private index and preserved V1 edits."""
import hashlib,json,os,pathlib,subprocess,tempfile
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='945301446ad6e2198fbf3b9e6a284602d078a037'
def git(*args,data=None,env=None):return subprocess.check_output(['git',*args],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
assert git('rev-parse','HEAD').decode().strip()==base
assert git('symbolic-ref','--short','HEAD').decode().strip()=='dev'
ih=sha(root/'.git/index');eh=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();assert ih=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49' and eh=='9e3d88268694038e1c8b530e6f372baae5a0157d269d9e4e7916841980040c30'
prefix='reports/ai-foundation-20261023/';auditpath=prefix+'human405-v123-round1-learning-audit-20261031-v1.json';verification=prefix+'human405-v123-standard-r1-verification-20261031-v1.json';audit=read(auditpath);v=read(verification);actual=v['actual'];record=read(actual['recordPath'])
assert audit['sourceCommit']==base and audit['round1LearningEvidenceComplete'] and audit['goalCompletionReadyAfterDelivery'];assert not audit['withinRound1UnresolvedDefects'] and all(x['proved'] for x in audit['requirements']);assert audit['knownPassCardFixed']
assert v['sourceCommit']==base and actual['final']['score']==27 and actual['final']['value']['total']==63 and v['teacher']['score']==15
assert v['sharedNativeActionPrefixInputs']==64 and v['exactFullNativeStateSessionRngWithV121'];assert record['gitCommit']==base[:8] and record['scenarioResult']['firstRoundSettled'] and not record['terminal'];assert actual['maxNativeInputs']==89 and actual['maxMilliseconds']<=600
old=set(git('ls-tree','-r','--name-only',base).decode().splitlines())
files={auditpath,verification,actual['recordPath'],actual['savePath'],actual['tracePath'],
'reports/iteration/ai-search-v123-white-r1-20261031/19bd7474.94530144.quick-200.action-log.html',
'reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html',
'docs/ai-design.md','docs/ai-known-pass-card-20261031.md','docs/human405-round1-v123-learning-review-20261031.md','adhoc/human405-round1-progress-20261031-v34.json',
'adhoc/verify-human405-v123-trial-20261031-v1.js','adhoc/verify-human405-v123-teacher-round1-20261031-v1.js','adhoc/compare-human405-v123-native-witnesses-20261031-v1.js','adhoc/verify-human405-v123-paid-move-order-20261031-v1.js','adhoc/audit-human405-v123-round1-learning-20261031-v1.js','adhoc/prepare-human405-v123-trial-root-overlays-20261031-v1.js','adhoc/deliver-human405-v123-completion-20261031-v1.py'}
for p in (stage/prefix).iterdir():
 relative=str(p.relative_to(stage))
 if p.is_file() and p.name.startswith('human405-v123-') and relative not in old and p.name!='human405-v123-native-witness-step62-20261031-v1.log':files.add(relative)
sources={}
for p,h in audit['evidenceSha256'].items():
 assert sha(stage/p)==h
 if p not in old:files.add(p)
 if not p.endswith('.json'):continue
 r=read(p)
 for source,digest in r.get('sourceHashes',{}).items():
  if source in sources:assert sources[source]==digest;continue
  assert sha(stage/source)==digest and hashlib.sha256(git('show',base+':'+source)).hexdigest()==digest,(p,source);sources[source]=digest
 if r.get('rawPath'):
  assert sha(stage/r['rawPath'])==r['rawSha256']
  if r['rawPath'] not in old:files.add(r['rawPath'])
for name in ['record','save','trace']:assert sha(stage/actual[name+'Path'])==actual[name+'Sha256']
versions=read('reports/iteration/versions.json');new=next(x for x in versions['versions'] if x['id']=='ai-search-v123-white-r1-20261031');assert new['baselineEligible'] is False and new['head']==base[:8];oldv=json.loads(git('show',base+':reports/iteration/versions.json'));assert [x for x in versions['versions'] if x['id']!=new['id']]==oldv['versions'];assert read('reports/iteration/registry.json')['currentBaseline']=='ai-search-v41-baseline-20261029'
overlays=json.loads(pathlib.Path('/private/tmp/seti-human405-r1-v123-trial-root-overlays-20261031/overlays.json').read_text())
for p,o in overlays.items():assert sha(root/p)==o['beforeSha256'] and sha(o['path'])==o['sha256']
w=json.loads(pathlib.Path(overlays['reports/iteration/versions.json']['path']).read_text());prior=json.loads((root/'reports/iteration/versions.json').read_text());assert [x for x in w['versions'] if x['id']!=new['id']]==prior['versions'];assert any(x['id']=='perf-baseline-lowload-20260913' for x in w['versions'])
check=prefix+'human405-v123-completion-runtime-source-check-20261031-v1.json'
(stage/check).write_text(json.dumps({'sourceCommit':base,'runtimeSourceHashes':sources,'sourceFilesChecked':len(sources),'standardAutonomousRuns':1,'exact64InputNativeReplayStateSessionRng':True,'all32TeacherStatesVerified':True,'all7DifferencesClassified':True,'withinRound1UnresolvedDefects':[],'baselineUnchanged':'ai-search-v41-baseline-20261029','goalCompletionReadyAfterDelivery':True,'runtimeCodeUnchangedFromAdmittedCommit':True},indent=2)+'\n');files.add(check)
for p in files:
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
manifest='adhoc/human405-v123-completion-delivery-manifest-20261031-v1.json'
(stage/manifest).write_text(json.dumps({'baseCommit':base,'snapshot':str(stage),'files':{p:sha(stage/p) for p in sorted(files)},'workingTreeOverlays':overlays,'sharedIndexSha256Before':ih,'sharedIndexEntriesSha256Before':eh,'goalCompletionReadyAfterDelivery':True,'baselineEligible':False},ensure_ascii=False,indent=2)+'\n');files.add(manifest)
for p in files:
 if (root/p).exists() and p not in overlays and (root/p).read_bytes()!=(stage/p).read_bytes():assert p in old and (root/p).read_bytes()==git('show',base+':'+p),('overlapping root edit',p)
if os.environ.get('SETI_DELIVER_V123_COMPLETION')!='1':print(json.dumps({'phase':'preflight','files':len(files),'verifiedSourceFiles':len(sources),'foreignV1Preserved':True,'goalCompletionReadyAfterDelivery':True}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-human405-v123-completion-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 b=(stage/p).read_bytes();dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(pathlib.Path(overlays[p]['path']).read_bytes() if p in overlays else b);blob=git('hash-object','-w','--stdin',data=b,env=env).decode().strip();git('update-index','--add','--cacheinfo','100644',blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files
git('diff','--cached','--check',env=env);assert sha(root/'.git/index')==ih
git('commit','-m','完成405分教师首轮逐节点学习验收，登记v123白席27分复盘',env=env)
commit=git('rev-parse','HEAD').decode().strip();assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==files
print(git('show','--name-only','--stat','--format=short','HEAD').decode());assert sha(root/'.git/index')==ih and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==eh
for p,o in overlays.items():assert sha(root/p)==o['sha256']
print(json.dumps({'commit':commit,'privateIndex':private,'files':len(files),'sharedIndexUnchanged':True,'foreignV1Preserved':True,'goalCompletionReadyAfterDelivery':True}))
