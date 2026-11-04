import pathlib, subprocess, os, tempfile, json, hashlib
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='92dc86691c903f7876102af13e5dcb4133e4a8b2';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/';own='ai-search-v166-white-first2-20261105'
def git(*args,data=None,env=None):return subprocess.check_output(['git',*args],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
assert git('rev-parse','HEAD').decode().strip()==base
shared=sha(root/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()
record='reports/research/8b8b00a9.92dc8669.quick-400.json';r=read(record);v=read(folder+'v166-first2-native-verification-20261105-v1.json');assert v['sourceCommit']==base and v['goalStatus']=='active' and not v['goalAchieved']
for k in ['allNativeInputsAndRngReplayed','allRoundAssetsVerifiedFromNativeCheckpoints','allRoundEndsExcludePickAndIncome','allSearchesComplete','allDecisionGatesPassed','actionsIdenticalToV165','finalNativeStateSessionRngIdenticalToV165']:assert v[k],k
assert v['wallMs']==3113 and r['steps']==93 and v['searches']==54 and v['standardRuns']==1;assert v['maxNativeInputs']==186 and v['maxRootAndSearchMs']<=600;assert not v['actualOverruns']
for k in ['record','save','trace']:assert sha(stage/v[k])==v[k+'Sha256']
files={record,r['savePath'],r['agentTracePath'],record+'.round-ends.jsonl',f'reports/iteration/{own}/8b8b00a9.92dc8669.quick-400.action-log.html','reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html','docs/ai-design.md','docs/ai-blue-exchange-funding-20261105.md','adhoc/human405-two-rounds-progress-20261105-v8.json','adhoc/verify-human405-v166-first2-20261105-v1.js','adhoc/compare-v166-first2-development-20261105-v1.js','adhoc/prepare-v166-first2-root-overlays-20261105-v1.js','adhoc/deliver-human405-v166-first2-result-20261105-v1.py'}
for pattern in ['v166-first2-*','v166-official-first2-*','v166-research-list-*']:files.update(str(p.relative_to(stage)) for p in (stage/folder).glob(pattern) if p.is_file())
for row in v['rounds']:assert sha(stage/row['checkpointPath'])==row['checkpointSha256'];files.add(row['checkpointPath'])
comparison=read(folder+'v166-first2-development-comparison-20261105-v1.json');assert comparison['allAssetSummariesMatchBothNativeCheckpoints'] and comparison['roundEnd']=='before-PASS-card-and-next-income';assert [row['ai']['score'] for row in comparison['rows']]==[21,54]
assert all(row['technologyCountDelta']==-1 and row['incomeDelta']['credits']==-2 and row['incomeDelta']['energy']==1 and row['incomeDelta']['handSize']==0 for row in comparison['rows'])
for p,h in v['sourceHashes'].items():assert sha(stage/p)==h and hashlib.sha256(git('show',base+':'+p)).hexdigest()==h,p
old={};modes={};checked=0
for entry in git('ls-tree','-rz',base).split(b'\0'):
 if not entry:continue
 meta,name=entry.split(b'\t',1);mode,kind,blob=meta.decode().split();p=name.decode();old[p]=blob;modes[p]=mode
 if p.startswith(('randomizer/','tools/','assets/')):
  data=(stage/p).read_bytes();assert hashlib.sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest()==blob,p;checked+=1
versions=read('reports/iteration/versions.json');previous=json.loads(git('show',base+':reports/iteration/versions.json'));assert [row for row in versions['versions'] if row['id']!=own]==previous['versions'];new=next(row for row in versions['versions'] if row['id']==own);assert new['baselineEligible'] is False
reg=read('reports/iteration/registry.json');assert reg['currentBaseline']=='ai-search-v41-baseline-20261029';assert next(row for row in reg['versions'] if row['id']==own)['isHead'] is False;assert all(row['versionId']!=own for row in reg['bestOf']['topByAvg']);assert own in (stage/'reports/robot-iteration.html').read_text()
overlays=json.loads(pathlib.Path('/private/tmp/seti-v166-first2-root-overlays-20261105/overlays.json').read_text())
for p,o in overlays.items():assert sha(root/p)==o['beforeSha256'] and sha(o['path'])==o['sha256']
work=json.loads(pathlib.Path(overlays['reports/iteration/versions.json']['path']).read_text());original=json.loads((root/'reports/iteration/versions.json').read_text());assert [row for row in work['versions'] if row['id']!=own]==original['versions'];assert any(row['id']=='perf-baseline-lowload-20260913' for row in work['versions'])
for p in files:
 if (root/p).exists() and p not in overlays and (root/p).read_bytes()!=(stage/p).read_bytes():assert p in old and (root/p).read_bytes()==git('show',base+':'+p),p
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
proof=folder+'v166-first2-result-source-check-20261105-v1.json';(stage/proof).write_text(json.dumps({'sourceCommit':base,'runtimeSourceHashes':v['sourceHashes'],'runtimeToolsAssetsUnchanged':checked,'standardRuns':1,'nativeInputsAndRngMatched':93,'boardScores':[21,54],'teacherScores':[15,34],'technologyCounts':[1,2],'teacherTechnologyCounts':[2,3],'incomeCreditsEnergyCards':[4,3,1],'teacherIncomeCreditsEnergyCards':[6,2,1],'wallMs':3113,'maxNativeInputs':186,'maxRootAndSearchMs':v['maxRootAndSearchMs'],'allActionsAndFinalStateIdenticalToV165':True,'roundEnd':'before-PASS-card-and-next-income','developmentAligned':False,'goalStatus':'active','goalAchieved':False,'baselineUnchanged':'ai-search-v41-baseline-20261029','foreignV1Preserved':True},indent=2)+'\n');files.add(proof)
manifest='adhoc/human405-v166-first2-result-manifest-20261105-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'files':{p:sha(stage/p) for p in sorted(files)},'workingTreeOverlays':overlays,'sharedIndexSha256':shared,'sharedIndexEntriesSha256':entries,'goalStatus':'active','goalAchieved':False},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_V166_RESULT')!='1':print(json.dumps({'preflight':True,'files':len(files),'runtimeSources':len(v['sourceHashes']),'foreignV1Preserved':True}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-v166-result-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 blob=git('hash-object','-w','--stdin',data=(stage/p).read_bytes(),env=env).decode().strip();git('update-index','--add','--cacheinfo',modes.get(p,'100644'),blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files;git('diff','--cached','--check',env=env)
for p in sorted(files):dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(pathlib.Path(overlays[p]['path']).read_bytes() if p in overlays else (stage/p).read_bytes())
git('commit','-m','登记v166自主两轮及完整资产对照，确认筹资修复尚未改善发展分流',env=env);commit=git('rev-parse','HEAD').decode().strip();assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==files;print(git('show','--name-only','--stat','--format=short','HEAD').decode());assert sha(root/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for p,o in overlays.items():assert sha(root/p)==o['sha256']
result={'commit':commit,'sourceCommit':base,'privateIndex':private,'files':len(files),'sharedIndexUnchanged':True,'foreignV1Preserved':True,'goalStatus':'active'};pathlib.Path('/private/tmp/seti-v166-first2-result-delivery-20261105.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
