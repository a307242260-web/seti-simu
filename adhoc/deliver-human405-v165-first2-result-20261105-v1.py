import pathlib, subprocess, os, tempfile, json, hashlib
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='b7cd4c9afea2fc4165c7201633039735e5c0b5ac';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/';own='ai-search-v165-white-first2-20261105'
def git(*a,data=None,env=None):return subprocess.check_output(['git',*a],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
assert git('rev-parse','HEAD').decode().strip()==base
shared=sha(root/'.git/index');assert shared=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49';entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()
record='reports/research/3d794d7d.b7cd4c9a.quick-400.json';r=read(record);v=read(folder+'v165-first2-native-verification-20261105-v1.json');assert v['sourceCommit']==base and v['goalStatus']=='active' and not v['goalAchieved']
assert all(v[k] for k in ['allNativeInputsAndRngReplayed','allSearchesComplete','allRoundAssetsVerifiedFromNativeCheckpoints','allRoundEndsExcludePickAndIncome','allDecisionGatesPassed']);assert not v['actualOverruns']
assert [x['score'] for x in v['rounds']]==[21,54] and v['wallMs']==3127 and r['steps']==93 and v['searches']==54 and v['standardRuns']==1
assert v['maxNativeInputs']<=256 and v['maxRootAndSearchMs']<=600
for k in ['record','save','trace']:assert sha(stage/v[k])==v[k+'Sha256']
files={record,r['savePath'],r['agentTracePath'],record+'.round-ends.jsonl',f'reports/iteration/{own}/3d794d7d.b7cd4c9a.quick-400.action-log.html','reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html','docs/ai-design.md','docs/ai-mission-data-continuation-20261105.md','docs/human405-first2-v165-progress-20261105.md','adhoc/human405-two-rounds-progress-20261105-v7.json','adhoc/verify-human405-v165-first2-20261105-v1.js','adhoc/prepare-v165-first2-root-overlays-20261105-v1.js','adhoc/audit-v165-actual-development-20261105-v1.js','adhoc/compare-v165-first2-development-20261105-v1.js','adhoc/deliver-human405-v165-first2-result-20261105-v1.py','adhoc/witness-v165-round1-branch-endpoints-20261105-v1.js'}
for pattern in [folder+'v165-first2-*',folder+'v165-actual-development-*',folder+'ai-v165-step*-20261105-v1.json',folder+'v165-research-list-*',folder+'v165-official-first2-*',folder+'v165-round1-branch-endpoints-*']:
 files.update(str(p.relative_to(stage)) for p in stage.glob(pattern) if p.is_file())
for row in v['rounds']:assert sha(stage/row['checkpointPath'])==row['checkpointSha256'];files.add(row['checkpointPath'])
audit=read(folder+'v165-actual-development-audit-20261105-v1.json');assert audit['actualNativeInputsReplayed']==93 and len(audit['rows'])==9
assert audit['conclusions']['firstLaterDivergence']==39 and audit['conclusions']['root39FactsMatchTeacher'] and audit['conclusions']['incomeTotalDistance']==15 and audit['conclusions']['orbitTotalDistance']==16 and audit['conclusions']['dlc9DiscardedForDataAt67'] and audit['conclusions']['orange4ObtainedByPaidResearchAt78']
for row in audit['rows']:assert sha(stage/row['fixture'])==row['fixtureSha256']
comparison=read(folder+'v165-first2-development-comparison-20261105-v1.json');assert comparison['allAssetSummariesMatchBothNativeCheckpoints'] and comparison['roundEnd']=='before-PASS-card-and-next-income'
assert all(x['technologyCountDelta']==-1 and x['incomeDelta']['credits']==-2 and x['incomeDelta']['energy']==1 and x['incomeDelta']['handSize']==0 for x in comparison['rows'])
control=read(folder+'v165-round1-branch-endpoints-native-20261105-v1.json');assert control['status']=='complete' and control['nativeInputs']==37 and control['originalRootAndRngRestored'];assert [p['after']['total']for p in control['plans']]==[64.5,65.5];assert sha(stage/control['source'])==control['sourceSha256']
for p,h in control['sourceHashes'].items():assert sha(stage/p)==h and hashlib.sha256(git('show',base+':'+p)).hexdigest()==h,p
for p,h in v['sourceHashes'].items():assert sha(stage/p)==h and hashlib.sha256(git('show',base+':'+p)).hexdigest()==h,p
old={};modes={};checked=0
for entry in git('ls-tree','-rz',base).split(b'\0'):
 if not entry:continue
 meta,name=entry.split(b'\t',1);p=name.decode();mode,kind,blob=meta.decode().split();old[p]=blob;modes[p]=mode
 if p.startswith(('randomizer/','tools/','assets/')):
  b=(stage/p).read_bytes();assert hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==blob,p;checked+=1
versions=read('reports/iteration/versions.json');new=next(x for x in versions['versions'] if x['id']==own);assert new['baselineEligible'] is False
oldv=json.loads(git('show',base+':reports/iteration/versions.json'));assert [x for x in versions['versions'] if x['id']!=own]==oldv['versions']
reg=read('reports/iteration/registry.json');assert reg['currentBaseline']=='ai-search-v41-baseline-20261029';assert all(x['versionId']!=own for x in reg['bestOf']['topByAvg']);assert next(x for x in reg['versions'] if x['id']==own)['isHead'] is False;assert own in (stage/'reports/robot-iteration.html').read_text()
overlays=json.loads(pathlib.Path('/private/tmp/seti-v165-first2-root-overlays-20261105/overlays.json').read_text())
for p,o in overlays.items():assert sha(root/p)==o['beforeSha256'] and sha(o['path'])==o['sha256']
work=json.loads(pathlib.Path(overlays['reports/iteration/versions.json']['path']).read_text());before=json.loads((root/'reports/iteration/versions.json').read_text());assert [x for x in work['versions'] if x['id']!=own]==before['versions'];assert any(x['id']=='perf-baseline-lowload-20260913' for x in work['versions'])
proof=folder+'v165-first2-result-source-check-20261105-v1.json';(stage/proof).write_text(json.dumps({'sourceCommit':base,'runtimeSourceHashes':v['sourceHashes'],'runtimeToolsAssetsUnchanged':checked,'standardRuns':1,'nativeInputsAndRngMatched':93,'roundEnd':'before-PASS-card-and-next-income','boardScores':[21,54],'teacherScores':[15,34],'wallMs':3127,'maxNativeInputs':v['maxNativeInputs'],'maxRootAndSearchMs':v['maxRootAndSearchMs'],'developmentAligned':False,'firstLaterDivergence':39,'root39IncomeLandAndOrbitValue':64.5,'incomeDistance':15,'orbitDistance':16,'dlc9DiscardedAt67':True,'orange4PaidResearchAt78':True,'goalStatus':'active','goalAchieved':False,'baselineUnchanged':'ai-search-v41-baseline-20261029'},indent=2)+'\n');files.add(proof)
for p in files:
 if (root/p).exists() and p not in overlays and (root/p).read_bytes()!=(stage/p).read_bytes():assert p in old and (root/p).read_bytes()==git('show',base+':'+p),p
for p in files:
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
deltas=set()
for p in files:
 b=(stage/p).read_bytes()
 if old.get(p)!=hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest():deltas.add(p)
manifest='adhoc/human405-v165-first2-result-manifest-20261105-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'files':{p:sha(stage/p) for p in sorted(files)},'changedFiles':sorted(deltas),'workingTreeOverlays':overlays,'sharedIndexSha256':shared,'sharedIndexEntriesSha256':entries,'goalStatus':'active','goalAchieved':False},indent=2)+'\n');deltas.add(manifest)
if os.environ.get('SETI_DELIVER_V165_RESULT')!='1':print(json.dumps({'preflight':True,'files':len(deltas),'runtimeSources':len(v['sourceHashes']),'foreignV1Preserved':True,'goalStatus':'active'}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-v165-result-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(deltas):
 blob=git('hash-object','-w','--stdin',data=(stage/p).read_bytes(),env=env).decode().strip();git('update-index','--add','--cacheinfo',modes.get(p,'100644'),blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==deltas;git('diff','--cached','--check',env=env)
for p in sorted(deltas):
 dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(pathlib.Path(overlays[p]['path']).read_bytes() if p in overlays else (stage/p).read_bytes())
git('commit','-m','登记v165自主两轮与完整资产，定位同值路径输入距离及新补牌筹资差异',env=env);commit=git('rev-parse','HEAD').decode().strip();assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==deltas;print(git('show','--name-only','--stat','--format=short','HEAD').decode());assert sha(root/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for p,o in overlays.items():assert sha(root/p)==o['sha256']
result={'commit':commit,'sourceCommit':base,'privateIndex':private,'files':len(deltas),'sharedIndexUnchanged':True,'foreignV1Preserved':True,'goalStatus':'active'};pathlib.Path('/private/tmp/seti-v165-first2-result-delivery-20261105.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
