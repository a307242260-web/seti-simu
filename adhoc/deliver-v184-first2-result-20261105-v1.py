import pathlib,subprocess,os,tempfile,json,hashlib
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='11437f119e0c7cf3f13c20409a1259c5f3199e68';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/';own='ai-search-v184-white-first2-20261105';record='reports/research/ea6138c1.11437f11.quick-400.json'
def git(*args,data=None,env=None):return subprocess.check_output(['git',*args],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
def blob(b):return hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
assert git('rev-parse','HEAD').decode().strip()==base
shared=sha(root/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();r=read(record);v=read(folder+'v184-first2-native-verification-20261105-v1.json');assert v['sourceCommit']==base and v['goalStatus']=='active' and not v['goalAchieved']
for k in ['allNativeInputsAndRngReplayed','allRoundAssetsVerifiedFromNativeCheckpoints','allRoundEndsExcludePickAndIncome','allSearchesComplete','allDecisionGatesPassed']:assert v[k],k
assert v['wallMs']==3823 and r['steps']==92 and v['searches']==53 and v['standardRuns']==1 and v['maxNativeInputs']==252 and v['maxRootAndSearchMs']<=600 and not v['actualOverruns']
for k in ['record','save','trace']:assert sha(stage/v[k])==v[k+'Sha256']
comparison=read(folder+'v184-first2-development-comparison-20261105-v1.json');assert comparison['allAssetSummariesMatchBothNativeCheckpoints'] and comparison['roundEnd']=='before-PASS-card-and-next-income';assert [row['ai']['score'] for row in comparison['rows']]==[15,25]
for row in comparison['rows']:assert row['ai']['technology']==row['teacher']['technology'] and row['ai']['income']==row['teacher']['income']
control=read(folder+'v184-round2-purpose-realization-native-20261105-v1.json');assert control['status']=='complete' and control['nativeInputs']==21 and control['rootAndRngRestored'];assert [x['endpoint']['score'] for x in control['rows']]==[25,29,30,34];assert control['actualSearch']['nativeInputs']==20 and control['actualSearch']['value']==control['before']['value']['total']
roots=read(folder+'v184-all-white-search-roots-20261105-v1.json');assert roots['status']=='complete' and len(roots['rows'])==53 and roots['nativeReplayedInputs']==69 and roots['finalNativeStateAndRngReplayed'] and roots['autonomousRuns']==0 and roots['searchReruns']==0
for row in roots['rows']:assert sha(stage/row['fixture'])==row['fixtureSha256']
for p,h in v['sourceHashes'].items():assert sha(stage/p)==h and hashlib.sha256(git('show',base+':'+p)).hexdigest()==h,p
old={};modes={};checked=0
for item in git('ls-tree','-rz',base).split(b'\0'):
 if item:
  meta,name=item.split(b'\t',1);mode,kind,h=meta.decode().split();p=name.decode();old[p]=h;modes[p]=mode
  if p.startswith(('randomizer/','tools/','assets/')):assert blob((stage/p).read_bytes())==h and blob((root/p).read_bytes())==h,p;checked+=1
versions=read('reports/iteration/versions.json');previous=json.loads(git('show',base+':reports/iteration/versions.json'));assert [x for x in versions['versions'] if x['id']!=own]==previous['versions'];assert next(x for x in versions['versions'] if x['id']==own)['baselineEligible'] is False
reg=read('reports/iteration/registry.json');assert reg['currentBaseline']=='ai-search-v41-baseline-20261029';entry=next(x for x in reg['versions'] if x['id']==own);assert entry['isHead'] is False and len(entry['results'])==1;result=entry['results'][0];assert result['recordFile']==pathlib.Path(record).name and result['reportExists'];report=result['reportPath'];html=(stage/report).read_text();assert 'R1·T1' in html and 'R2·T1' in html
same=[p for p in (stage/'reports/research').glob('*.json') if not p.name.endswith('.checkpoint.json') and (lambda q:q.get('gitCommit')==base[:8] and q.get('scenario',{}).get('id')=='human405-white-first2-v1')(json.loads(p.read_text()))];assert len(same)==1
files={record,r['savePath'],r['agentTracePath'],report,'reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html','docs/ai-design.md','docs/ai-computer-analysis-admission-20261105.md','docs/human405-v184-first2-result-20261105.md','adhoc/human405-two-rounds-progress-20261105-v14.json','adhoc/witness-v184-round2-purpose-realization-20261105-v1.js','adhoc/capture-v184-search-roots-20261105-v1.js','adhoc/trace-current-winning-income-window-20261105-v1.js','adhoc/prepare-v184-first2-root-overlays-20261105-v1.js','adhoc/deliver-v184-first2-result-20261105-v1.py'}
files.update(str(p.relative_to(stage)) for p in (stage/'reports/research').glob(pathlib.Path(record).name+'.*') if p.is_file())
files.update(str(p.relative_to(stage)) for p in (stage/folder).glob('v184-*') if p.is_file())
files.update(str(p.relative_to(stage)) for p in (stage/folder).glob('v183-winning-income-window-*-native-20261105-v1.json') if p.is_file())
for row in v['rounds']:assert sha(stage/row['checkpointPath'])==row['checkpointSha256'];files.add(row['checkpointPath'])
files={p for p in files if p not in old or blob((stage/p).read_bytes())!=old[p]}
assert not any(p.startswith(('randomizer/','tools/','assets/')) for p in files)
overlays=json.loads(pathlib.Path('/private/tmp/seti-v184-first2-root-overlays-20261105/overlays.json').read_text())
for p,o in overlays.items():assert sha(root/p)==o['beforeSha256'] and sha(o['path'])==o['sha256']
work=json.loads(pathlib.Path(overlays['reports/iteration/versions.json']['path']).read_text());original=json.loads((root/'reports/iteration/versions.json').read_text());assert [x for x in work['versions'] if x['id']!=own]==original['versions'];assert any(x['id']=='perf-baseline-lowload-20260913' for x in work['versions'])
for p in files:
 if (root/p).exists() and p not in overlays and (root/p).read_bytes()!=(stage/p).read_bytes():assert p in old and blob((root/p).read_bytes())==old[p],p
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
proof=folder+'v184-first2-result-source-check-20261105-v1.json';(stage/proof).write_text(json.dumps({'sourceCommit':base,'runtimeSourceHashes':v['sourceHashes'],'runtimeToolsAssetsUnchanged':checked,'standardRuns':1,'nativeReplayAfterOpeningInputs':69,'actualInputs':92,'boardScores':[15,25],'teacherScores':[15,34],'specificTechnologyAndSixIncomesEqualBothRounds':True,'sourcePassedButAlignmentFailed':True,'controlledKnownPurposesNativeInputs':21,'controlledScores':[25,29,30,34],'actualRoot91NativeInputs':20,'sameValueChosenPass':True,'actualSearchRootsCaptured':53,'wallMs':3823,'maxNativeInputs':252,'maxRootAndSearchMs':v['maxRootAndSearchMs'],'roundEnd':'before-PASS-card-and-next-income','developmentFullyAligned':False,'goalStatus':'active','goalAchieved':False,'baselineUnchanged':'ai-search-v41-baseline-20261029','foreignV1Preserved':True},indent=2)+'\n');files.add(proof)
manifest='adhoc/v184-first2-result-delivery-manifest-20261105-v1.json';(stage/manifest).write_text(json.dumps({'sourceCommit':base,'files':{p:sha(stage/p) for p in sorted(files)},'workingTreeOverlays':overlays,'sharedIndexSha256':shared,'sharedIndexEntriesSha256':entries,'goalStatus':'active','goalAchieved':False},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_V184_RESULT')!='1':print(json.dumps({'preflight':True,'files':len(files),'runtimeSources':len(v['sourceHashes']),'foreignV1Preserved':True,'scores':[15,25]}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-v184-result-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 h=git('hash-object','-w','--stdin',data=(stage/p).read_bytes(),env=env).decode().strip();git('update-index','--add','--cacheinfo',modes.get(p,'100644'),h,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files;git('diff','--cached','--check',env=env)
for p in sorted(files):dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(pathlib.Path(overlays[p]['path']).read_bytes() if p in overlays else (stage/p).read_bytes())
git('commit','-m','记录V184自主两轮15及25分，定位未兑现目的与分析后数据资本遗漏',env=env);commit=git('rev-parse','HEAD').decode().strip();assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files
assert sha(root/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for p,o in overlays.items():assert sha(root/p)==o['sha256']
assert not git('diff','--name-only',base,commit,'--','randomizer','tools','assets').strip()
result={'commit':commit,'sourceCommit':base,'stage':str(stage),'privateIndex':private,'files':len(files),'sharedIndexUnchanged':True,'foreignV1Preserved':True,'baselineUnchanged':'ai-search-v41-baseline-20261029','goalStatus':'active'};pathlib.Path('/private/tmp/seti-v184-first2-result-delivery-20261105-v1.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
