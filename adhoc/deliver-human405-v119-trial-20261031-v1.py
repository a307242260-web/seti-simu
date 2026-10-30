"""Commit one standard trial and native recovery evidence, preserving V1 edits."""
import hashlib,json,os,pathlib,subprocess
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu')
base='2fb2b0912620ff4c655db65c27ba000dd5b5ca8d'
def git(*args,data=None,env=None):return subprocess.check_output(['git',*args],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
assert git('rev-parse','HEAD').decode().strip()==base
assert git('symbolic-ref','--short','HEAD').decode().strip()=='dev'
index_hash=sha(root/'.git/index');entries_hash=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()
assert index_hash=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49'
assert entries_hash=='9e3d88268694038e1c8b530e6f372baae5a0157d269d9e4e7916841980040c30'
verification='reports/ai-foundation-20261023/human405-v119-standard-r1-verification-20261031-v1.json'
counter='reports/ai-foundation-20261023/human405-v119-movement-recovery-counterexample-20261031-v1.json'
v,q=read(verification),read(counter);actual=v['actual'];record=read(actual['recordPath'])
assert v['sourceCommit']==base and v['actual']['final']['score']==11 and v['teacher']['score']==15
assert actual['exactFinalCommittedStateSessionRng'] and actual['passiveOpponentsOnly'] and actual['strictNativeReplay']
assert record['scenarioResult']['firstRoundSettled'] and not record['terminal']
assert actual['maxNativeInputs']==80 and actual['maxMilliseconds']<=600
assert q['sameNativeValueObservation'] and q['warm']['nativeValue']==60 and q['cold']['value']==48
assert q['rootAndRngUnchanged'] and not q['productionFixed']
files={verification,counter,actual['recordPath'],actual['savePath'],actual['tracePath'],q['fixture'],
 'reports/iteration/ai-search-v119-white-r1-20261031/12231ee9.2fb2b091.quick-200.action-log.html',
 'reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html',
 'docs/ai-design.md','docs/human405-round1-v119-admission-20261031.md','docs/human405-round1-v119-trial-20261031.md',
 'adhoc/human405-round1-progress-20261031-v30.json','adhoc/verify-human405-v119-trial-20261031-v1.js',
 'adhoc/diagnose-human405-v119-movement-recovery-20261031-v1.js','adhoc/prepare-human405-v119-trial-root-overlays-20261031-v1.js',
 'adhoc/deliver-human405-v119-trial-20261031-v1.py',
 'reports/ai-foundation-20261023/human405-v119-standard-r1-verification-20261031-v1.log',
 'reports/ai-foundation-20261023/human405-v119-standard-r1-20261031-v1.log',
 'reports/ai-foundation-20261023/human405-v119-movement-recovery-counterexample-20261031-v2.log',
 'reports/ai-foundation-20261023/human405-v119-registry-build-20261031-v2.log'}
sources={}
for report in [v,q]:
 for p,h in report['sourceHashes'].items():
  assert sha(stage/p)==h
  data=git('show',base+':'+p);assert hashlib.sha256(data).hexdigest()==h,p;sources[p]=h
for name in ['record','save','trace']:
 p=actual[name+'Path'];assert sha(stage/p)==actual[name+'Sha256']
assert sha(stage/q['fixture'])==q['fixtureSha256']
versions=read('reports/iteration/versions.json');new=next(v for v in versions['versions'] if v['id']=='ai-search-v119-white-r1-20261031')
assert new['baselineEligible'] is False and new['head']=='2fb2b091'
old=json.loads(git('show',base+':reports/iteration/versions.json'))
assert [x for x in versions['versions'] if x['id']!=new['id']]==old['versions']
registry=read('reports/iteration/registry.json');assert registry['currentBaseline']=='ai-search-v41-baseline-20261029'
overlays=json.loads(pathlib.Path('/private/tmp/seti-human405-r1-v119-trial-root-overlays-20261031/overlays.json').read_text())
for p,overlay in overlays.items():
 assert sha(root/p) in (overlay['beforeSha256'],overlay['sha256']);assert sha(overlay['path'])==overlay['sha256']
work=json.loads(pathlib.Path(overlays['reports/iteration/versions.json']['path']).read_text());prior=json.loads((root/'reports/iteration/versions.json').read_text())
assert [x for x in work['versions'] if x['id']!=new['id']]==[x for x in prior['versions'] if x['id']!=new['id']]
assert any(x['id']=='perf-baseline-lowload-20260913' for x in work['versions'])
check='reports/ai-foundation-20261023/human405-v119-trial-runtime-source-check-20261031-v1.json'
(stage/check).write_text(json.dumps({'sourceCommit':base,'runtimeSourceHashes':sources,'runtimeFilesChecked':len(sources),
 'strictNativeReplay':True,'standardAutonomousRuns':1,'same23Opening':True,'passiveOpponentsOnly':True,
 'singlePointGatePassed':True,'strategyAccepted':False,'baselineUnchanged':'ai-search-v41-baseline-20261029','goalStatus':'active'},indent=2)+'\n');files.add(check)
manifest='adhoc/human405-v119-trial-delivery-manifest-20261031-v1.json'
(stage/manifest).write_text(json.dumps({'baseCommit':base,'snapshot':str(stage),'files':{p:sha(stage/p) for p in sorted(files)},
 'workingTreeOverlays':overlays,'sourceBoundReports':[verification,counter],'sharedIndexSha256Before':index_hash,
 'sharedIndexEntriesSha256Before':entries_hash,'goalStatus':'active','strategyAccepted':False,'baselineEligible':False},ensure_ascii=False,indent=2)+'\n');files.add(manifest)
for p in files:
 if (root/p).exists() and p not in overlays:
  if (root/p).read_bytes()==(stage/p).read_bytes():continue
  if p==manifest:
   previous=read(manifest);assert previous['baseCommit']==base
   continue
  if p in ['adhoc/deliver-human405-v119-trial-20261031-v1.py','reports/iteration/ai-search-v119-white-r1-20261031/12231ee9.2fb2b091.quick-200.action-log.html'] and (root/p).read_bytes()!=(stage/p).read_bytes():
   previous=json.loads((root/manifest).read_text());assert previous['baseCommit']==base and sha(root/p)==previous['files'][p]
   continue
  assert (root/p).read_bytes() in ((stage/p).read_bytes(),git('show',base+':'+p)),('overlapping root edit',p)
for p in ['adhoc/verify-human405-v119-trial-20261031-v1.js','adhoc/diagnose-human405-v119-movement-recovery-20261031-v1.js','adhoc/prepare-human405-v119-trial-root-overlays-20261031-v1.js']:
 subprocess.run(['node','--check',p],cwd=stage,check=True)
if os.environ.get('SETI_DELIVER_V119_TRIAL')!='1':
 print(json.dumps({'phase':'preflight','files':len(files),'runtimeImportsVerified':len(sources),'foreignV1Preserved':True,'goalStatus':'active'}));raise SystemExit(0)
private='/private/tmp/seti-human405-v119-trial-delivery-20261031-v2.index';assert not pathlib.Path(private).exists()
env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 data=(stage/p).read_bytes();destination=root/p;destination.parent.mkdir(parents=True,exist_ok=True)
 destination.write_bytes(pathlib.Path(overlays[p]['path']).read_bytes() if p in overlays else data)
 blob=git('hash-object','-w','--stdin',data=data,env=env).decode().strip();git('update-index','--add','--cacheinfo','100644',blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files
git('diff','--cached','--check',env=env);assert sha(root/'.git/index')==index_hash
git('commit','-m','记录白席首轮回退与移动计划恢复反例，保留旧基线',env=env)
commit=git('rev-parse','HEAD').decode().strip()
assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==files
print(git('show','--name-only','--stat','--format=short','HEAD').decode())
assert sha(root/'.git/index')==index_hash
assert hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries_hash
for p,overlay in overlays.items():assert sha(root/p)==overlay['sha256']
print(json.dumps({'commit':commit,'files':len(files),'runtimeSourceCommit':base,'strategyAccepted':False,'foreignV1Preserved':True,'sharedIndexUnchanged':True,'goalStatus':'active'}))
