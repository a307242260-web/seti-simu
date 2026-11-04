import pathlib,subprocess,os,tempfile,json,hashlib
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='7da81a85e675bd08abe393108450a6d0cb7510c7';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/';own='ai-search-v148-white-first2-20261104'
def git(*a,data=None,env=None):return subprocess.check_output(['git',*a],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
assert git('rev-parse','HEAD').decode().strip()==base
shared=sha(root/'.git/index');assert shared=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49';entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()
record='reports/research/d421cdf5.7da81a85.quick-400.json';r=read(record);v=read(folder+'v148-first2-native-verification-20261104-v1.json')
assert not v['goalAchieved']and v['goalStatus']=='active'and v['sourceCommit']==base
assert all(v[k]for k in ['allNativeInputsAndRngReplayed','allSearchesComplete','allRoundAssetsVerifiedFromNativeCheckpoints','allRoundEndsExcludePickAndIncome']);assert [x['score']for x in v['rounds']]==[16,44]
assert v['maxNativeInputs']<=256 and v['maxRootAndSearchMs']<=600 and v['wallMs']==3060
for k in ['record','save','trace']:assert sha(stage/v[k])==v[k+'Sha256']
assert r['steps']==89 and v['searches']==50 and v['standardRuns']==1
files={record,r['savePath'],r['agentTracePath'],record+'.round-ends.jsonl','reports/iteration/'+own+'/d421cdf5.7da81a85.quick-400.action-log.html','reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html','docs/ai-design.md','docs/ai-funded-hand-timing-v148-20261104.md','adhoc/human405-two-rounds-progress-20261104-v10.json','adhoc/verify-human405-v148-first2-20261104-v1.js','adhoc/prepare-v148-first2-root-overlays-20261104-v1.js','adhoc/deliver-human405-v148-first2-result-20261104-v1.py'}
for name in ['v148-first2-live-20261104-v1.log','v148-first2-record-inventory-20261104-v1.log','v148-first2-native-verification-20261104-v1.json','v148-first2-native-verification-20261104-v1.log','v148-first2-choice-diagnosis-20261104-v1.json']:files.add(folder+name)
files.add('adhoc/witness-v148-technology-native-20261104-v1.js')
for step in [44,77]:
 wpath=folder+f'v148-step{step}-technology-native-witness-20261104-v1.json';w=read(wpath);assert w['originalRootAndRngUnchanged']and len(w['rows'])==2 and sha(stage/w['fixture'])==w['fixtureSha256'];assert w['recordSha256']==v['recordSha256'];files.update([wpath,wpath.replace('.json','.log'),w['fixture']])
for row in v['rounds']:assert sha(stage/row['checkpointPath'])==row['checkpointSha256'];files.add(row['checkpointPath'])
for p,h in v['sourceHashes'].items():assert sha(stage/p)==h and hashlib.sha256(git('show',base+':'+p)).hexdigest()==h,p
old={};checked=0
for entry in git('ls-tree','-rz',base).split(b'\0'):
 if not entry:continue
 meta,name=entry.split(b'\t',1);p=name.decode();old[p]=meta.decode().split()[2]
 if p.startswith(('randomizer/','tools/','assets/')):
  b=(stage/p).read_bytes();assert hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==old[p],p;checked+=1
versions=read('reports/iteration/versions.json');new=next(x for x in versions['versions']if x['id']==own);assert new['baselineEligible']is False
oldv=json.loads(git('show',base+':reports/iteration/versions.json'));assert [x for x in versions['versions']if x['id']!=own]==oldv['versions']
reg=read('reports/iteration/registry.json');assert reg['currentBaseline']=='ai-search-v41-baseline-20261029';assert all(x['versionId']!=own for x in reg['bestOf']['topByAvg']);assert next(x for x in reg['versions']if x['id']==own)['isHead']is False
assert own in(stage/'reports/robot-iteration.html').read_text()
overlays=json.loads(pathlib.Path('/private/tmp/seti-v148-first2-root-overlays-20261104/overlays.json').read_text())
for p,o in overlays.items():assert sha(root/p)==o['beforeSha256']and sha(o['path'])==o['sha256']
work=json.loads(pathlib.Path(overlays['reports/iteration/versions.json']['path']).read_text());before=json.loads((root/'reports/iteration/versions.json').read_text());assert [x for x in work['versions']if x['id']!=own]==before['versions'];assert any(x['id']=='perf-baseline-lowload-20260913'for x in work['versions'])
proof=folder+'v148-first2-result-source-check-20261104-v1.json';(stage/proof).write_text(json.dumps({'sourceCommit':base,'runtimeSourceHashes':v['sourceHashes'],'runtimeToolsAssetsUnchanged':checked,'standardRuns':1,'nativeInputsAndRngMatched':89,'roundEnd':'before-PASS-card-and-next-income','boardScores':[16,44],'teacherCurrentRulesScores':[15,34],'wallMs':3060,'maxNativeInputs':v['maxNativeInputs'],'maxRootAndSearchMs':v['maxRootAndSearchMs'],'goalStatus':'active','goalAchieved':False,'baselineUnchanged':'ai-search-v41-baseline-20261029'},indent=2)+'\n');files.add(proof)
manifest='adhoc/human405-v148-first2-result-manifest-20261104-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'files':{p:sha(stage/p)for p in sorted(files)},'workingTreeOverlays':overlays,'sharedIndexSha256':shared,'sharedIndexEntriesSha256':entries,'goalStatus':'active','goalAchieved':False},indent=2)+'\n');files.add(manifest)
for p in files:
 if(root/p).exists()and p not in overlays and(root/p).read_bytes()!=(stage/p).read_bytes():assert p in old and(root/p).read_bytes()==git('show',base+':'+p),p
for p in files:
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
if os.environ.get('SETI_DELIVER_V148_RESULT')!='1':print(json.dumps({'preflight':True,'files':len(files),'runtimeSources':len(v['sourceHashes']),'foreignV1Preserved':True,'goalStatus':'active'}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-v148-result-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 b=(stage/p).read_bytes();blob=git('hash-object','-w','--stdin',data=b,env=env).decode().strip();git('update-index','--add','--cacheinfo','100644',blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files;git('diff','--cached','--check',env=env)
for p in sorted(files):
 dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(pathlib.Path(overlays[p]['path']).read_bytes()if p in overlays else(stage/p).read_bytes())
git('commit','-m','登记v148自主两轮16与44分，核验科技收入及剩余资产差距',env=env);commit=git('rev-parse','HEAD').decode().strip();assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==files
print(git('show','--name-only','--stat','--format=short','HEAD').decode());assert sha(root/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for p,o in overlays.items():assert sha(root/p)==o['sha256']
result={'commit':commit,'sourceCommit':base,'privateIndex':private,'files':len(files),'sharedIndexUnchanged':True,'foreignV1Preserved':True,'goalStatus':'active'};pathlib.Path('/private/tmp/seti-v148-first2-result-delivery-20261104.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
