"""Deliver source-bound R1 evidence; preserve foreign V1 and shared index."""
import hashlib,json,os,pathlib,subprocess,tempfile
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='85e94cc4327cac0e6a103e184c4a47e13a9aa578'
def git(*args,data=None,env=None):return subprocess.check_output(['git',*args],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
assert git('rev-parse','HEAD').decode().strip()==base
assert git('symbolic-ref','--short','HEAD').decode().strip()=='dev'
ih=sha(root/'.git/index');eh=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()
assert ih=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49'
assert eh=='9e3d88268694038e1c8b530e6f372baae5a0157d269d9e4e7916841980040c30'
prefix='reports/ai-foundation-20261023/'
verification=prefix+'human405-v121-standard-r1-verification-20261031-v1.json'
auditpath=prefix+'human405-v121-round1-learning-audit-20261031-v3.json'
v=read(verification);audit=read(auditpath);actual=v['actual'];record=read(actual['recordPath'])
assert v['sourceCommit']==base and actual['final']['score']==27 and actual['final']['value']['total']==63
assert actual['strictNativeReplay'] and actual['exactFinalCommittedStateSessionRng'] and actual['passiveOpponentsOnly']
assert v['exactNativeStateSessionRngBeforeChangedInput'] and v['sharedNativeActionPrefixInputs']==26
assert record['scenarioResult']['firstRoundSettled'] and not record['terminal']
assert actual['maxNativeInputs']==89 and actual['maxMilliseconds']<=600
assert not audit['round1LearningEvidenceComplete'] and len(audit['withinRound1UnresolvedDefects'])==1
files={verification,auditpath,actual['recordPath'],actual['savePath'],actual['tracePath'],
'reports/iteration/ai-search-v121-white-r1-20261031/f1e61527.85e94cc4.quick-200.action-log.html',
'reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html',
'docs/human405-round1-v121-learning-review-20261031.md','adhoc/human405-round1-progress-20261031-v32.json',
'adhoc/verify-human405-v121-trial-20261031-v1.js','adhoc/verify-human405-v121-teacher-round1-20261031-v1.js',
'adhoc/compare-human405-v121-native-witnesses-20261031-v1.js','adhoc/verify-human405-v121-paid-move-order-20261031-v1.js',
'adhoc/audit-human405-v121-round1-learning-20261031-v1.js','adhoc/reproduce-human405-known-pass-card-20261031-v1.js',
'adhoc/prepare-human405-v121-trial-root-overlays-20261031-v1.js','adhoc/deliver-human405-v121-trial-20261031-v1.py'}
for suffix in ['standard-r1-verification-20261031-v1.log','teacher-round1-native-replay-20261031-v1.log','standard-r1-20261031-v1.log','round1-learning-audit-20261031-v4.log','known-pass-card-before-20261031-v1.log','paid-move-order-20261031-v1.log','registry-build-20261031-v2.log']:
 files.add(prefix+'human405-v121-'+suffix)
for step in [24,38,39,43,56,62]:files.add(prefix+'human405-v121-native-witness-step'+str(step)+'-20261031-v1.log')
old=set(git('ls-tree','-r','--name-only',base).decode().splitlines());sources={}
for p,h in audit['evidenceSha256'].items():
 assert sha(stage/p)==h
 if p not in old:files.add(p)
 report=read(p)
 for source,digest in report.get('sourceHashes',{}).items():
  if source in sources:
   assert sources[source]==digest;continue
  assert sha(stage/source)==digest and hashlib.sha256(git('show',base+':'+source)).hexdigest()==digest,source
  sources[source]=digest
 if report.get('rawPath') and report['rawPath'] not in old:
  assert sha(stage/report['rawPath'])==report['rawSha256'];files.add(report['rawPath'])
for name in ['record','save','trace']:assert sha(stage/actual[name+'Path'])==actual[name+'Sha256']
versions=read('reports/iteration/versions.json');new=next(x for x in versions['versions'] if x['id']=='ai-search-v121-white-r1-20261031');assert new['baselineEligible'] is False and new['head']=='85e94cc4'
oldv=json.loads(git('show',base+':reports/iteration/versions.json'));assert [x for x in versions['versions'] if x['id']!=new['id']]==oldv['versions']
assert read('reports/iteration/registry.json')['currentBaseline']=='ai-search-v41-baseline-20261029'
overlays=json.loads(pathlib.Path('/private/tmp/seti-human405-r1-v121-trial-root-overlays-20261031/overlays.json').read_text())
for p,o in overlays.items():assert sha(root/p)==o['beforeSha256'] and sha(o['path'])==o['sha256']
w=json.loads(pathlib.Path(overlays['reports/iteration/versions.json']['path']).read_text());prior=json.loads((root/'reports/iteration/versions.json').read_text());assert [x for x in w['versions'] if x['id']!=new['id']]==prior['versions'];assert any(x['id']=='perf-baseline-lowload-20260913' for x in w['versions'])
check=prefix+'human405-v121-trial-runtime-source-check-20261031-v1.json'
(stage/check).write_text(json.dumps({'sourceCommit':base,'runtimeSourceHashes':sources,'runtimeFilesChecked':len(sources),'standardAutonomousRuns':1,'strictNativeReplay':True,'singlePointGatePassed':True,'baselineUnchanged':'ai-search-v41-baseline-20261029','goalStatus':'active','knownPassCardMaskUnfixed':True},indent=2)+'\n');files.add(check)
manifest='adhoc/human405-v121-trial-delivery-manifest-20261031-v1.json'
(stage/manifest).write_text(json.dumps({'baseCommit':base,'snapshot':str(stage),'files':{p:sha(stage/p) for p in sorted(files)},'workingTreeOverlays':overlays,'sharedIndexSha256Before':ih,'sharedIndexEntriesSha256Before':eh,'goalStatus':'active','baselineEligible':False},ensure_ascii=False,indent=2)+'\n');files.add(manifest)
for p in files:
 if (root/p).exists() and p not in overlays and (root/p).read_bytes()!=(stage/p).read_bytes():
  assert p in old and (root/p).read_bytes()==git('show',base+':'+p),('overlapping root edit',p)
for p in files:
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
if os.environ.get('SETI_DELIVER_V121_TRIAL')!='1':print(json.dumps({'phase':'preflight','files':len(files),'runtimeImportsVerified':len(sources),'foreignV1Preserved':True,'goalStatus':'active'}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-human405-v121-trial-delivery-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 data=(stage/p).read_bytes();dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(pathlib.Path(overlays[p]['path']).read_bytes() if p in overlays else data)
 blob=git('hash-object','-w','--stdin',data=data,env=env).decode().strip();git('update-index','--add','--cacheinfo','100644',blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files
git('diff','--cached','--check',env=env);assert sha(root/'.git/index')==ih
git('commit','-m','记录白席首轮27分与逐节点复盘，补充PASS已知牌遮蔽反例',env=env)
commit=git('rev-parse','HEAD').decode().strip();assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==files
print(git('show','--name-only','--stat','--format=short','HEAD').decode());assert sha(root/'.git/index')==ih and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==eh
for p,o in overlays.items():assert sha(root/p)==o['sha256']
print(json.dumps({'commit':commit,'files':len(files),'sourceCommit':base,'sharedIndexUnchanged':True,'foreignV1Preserved':True,'goalStatus':'active'}))
