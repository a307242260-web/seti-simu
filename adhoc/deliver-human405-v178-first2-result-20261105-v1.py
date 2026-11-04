import pathlib,subprocess,os,tempfile,json,hashlib,re
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='9491f13ba33be484b737123b8c25172602b67b00';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/';own='ai-search-v178-white-first2-20261105'
def git(*args,data=None,env=None):return subprocess.check_output(['git',*args],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
assert git('rev-parse','HEAD').decode().strip()==base
shared=sha(root/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()
record='reports/research/e987ead2.9491f13b.quick-400.json';r=read(record);v=read(folder+'v178-first2-native-verification-20261105-v1.json');assert v['sourceCommit']==base and v['goalStatus']=='active' and not v['goalAchieved']
for k in ['allNativeInputsAndRngReplayed','allRoundAssetsVerifiedFromNativeCheckpoints','allRoundEndsExcludePickAndIncome','allSearchesComplete','allDecisionGatesPassed']:assert v[k],k
assert v['wallMs']==4180 and r['steps']==115 and v['searches']==76 and v['standardRuns']==1 and v['maxNativeInputs']==246 and v['maxRootAndSearchMs']<=600 and not v['actualOverruns']
for k in ['record','save','trace']:assert sha(stage/v[k])==v[k+'Sha256']
comparison=read(folder+'v178-first2-development-comparison-20261105-v1.json');audit=read(folder+'v178-round-assets-audit-20261105-v1.json');control=read(folder+'v178-round2-reserve-choice-native-20261105-v1.json');assert comparison['allAssetSummariesMatchBothNativeCheckpoints'] and comparison['roundEnd']=='before-PASS-card-and-next-income';assert [row['ai']['score'] for row in comparison['rows']]==[15,43]
assert audit['round1AllComparedAssetsEqual'] and audit['bothRoundsSpecificTechnologyAndSixIncomesEqual'] and audit['controlledRound2PinkAndBlueTracesEqualTeacher'];assert audit['actualRound2AssetDeltas']=={'credits':-3,'energy':-1,'availableData':1,'probes':-1,'sectorWins':-1,'firstPinkTraces':-1}
assert control['status']=='complete' and control['nativeInputs']==93 and control['rootAndRngRestored'] and control['controlledTeacherRound2']['teacherAssetsMatch'];assert control['controlledTeacherRound2']['nativeInputs']==33;assert all(x['value']['total']==60 and x['value']['components']['handPotential']==0 for x in control['nativeChoiceValues'])
for p,h in v['sourceHashes'].items():assert sha(stage/p)==h and hashlib.sha256(git('show',base+':'+p)).hexdigest()==h,p
old={};modes={};checked=0
for item in git('ls-tree','-rz',base).split(b'\0'):
 if not item:continue
 meta,name=item.split(b'\t',1);mode,kind,blob=meta.decode().split();p=name.decode();old[p]=blob;modes[p]=mode
 if p.startswith(('randomizer/','tools/','assets/')):
  b=(stage/p).read_bytes();assert hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==blob,p;checked+=1
versions=read('reports/iteration/versions.json');previous=json.loads(git('show',base+':reports/iteration/versions.json'));assert [row for row in versions['versions'] if row['id']!=own]==previous['versions'];assert next(row for row in versions['versions'] if row['id']==own)['baselineEligible'] is False
reg=read('reports/iteration/registry.json');assert reg['currentBaseline']=='ai-search-v41-baseline-20261029';entry=next(row for row in reg['versions'] if row['id']==own);assert entry['isHead'] is False and all(row['versionId']!=own for row in reg['bestOf']['topByAvg']);result=next(x for x in entry['results'] if x['recordFile']==pathlib.Path(record).name);assert result['reportExists'];report=result['reportPath'];html=(stage/report).read_text();assert '白色玩家 · 11 个回合' in html and 'R1·T1' in html and 'R2·T9' in html
files={record,r['savePath'],r['agentTracePath'],record+'.round-ends.jsonl',report,'reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html','docs/ai-design.md','docs/ai-public-income-admission-20261105.md','adhoc/human405-two-rounds-progress-20261105-v10.json','adhoc/verify-human405-v178-first2-20261105-v1.js','adhoc/compare-v178-first2-development-20261105-v1.js','adhoc/diagnose-v178-round2-reserve-choice-20261105-v1.js','adhoc/verify-v178-round-assets-20261105-v1.js','adhoc/prepare-v178-first2-root-overlays-20261105-v1.js','adhoc/deliver-human405-v178-first2-result-20261105-v1.py'}
files.update(str(p.relative_to(stage)) for p in (stage/folder).glob('v178-*') if p.is_file())
for row in v['rounds']:assert sha(stage/row['checkpointPath'])==row['checkpointSha256'];files.add(row['checkpointPath'])
overlays=json.loads(pathlib.Path('/private/tmp/seti-v178-first2-root-overlays-20261105/overlays.json').read_text())
for p,o in overlays.items():assert sha(root/p)==o['beforeSha256'] and sha(o['path'])==o['sha256']
work=json.loads(pathlib.Path(overlays['reports/iteration/versions.json']['path']).read_text());original=json.loads((root/'reports/iteration/versions.json').read_text());assert [row for row in work['versions'] if row['id']!=own]==original['versions'];assert any(row['id']=='perf-baseline-lowload-20260913' for row in work['versions'])
# Only newly changed artifacts enter this result commit; prior admission evidence is immutable.
files={p for p in files if p not in old or hashlib.sha1(('blob '+str((stage/p).stat().st_size)+'\0').encode()+(stage/p).read_bytes()).hexdigest()!=old[p]}
for p in files:
 if (root/p).exists() and p not in overlays and (root/p).read_bytes()!=(stage/p).read_bytes():assert p in old and (root/p).read_bytes()==git('show',base+':'+p),p
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
proof=folder+'v178-first2-result-source-check-20261105-v1.json';(stage/proof).write_text(json.dumps({'sourceCommit':base,'runtimeSourceHashes':v['sourceHashes'],'runtimeToolsAssetsUnchanged':checked,'standardRuns':1,'nativeInputsAndRngMatched':115,'boardScores':[15,43],'teacherScores':[15,34],'specificTechnologyAndSixIncomesEqualBothRounds':True,'round1AllComparedAssetsEqual':True,'round2AssetDeltas':audit['actualRound2AssetDeltas'],'controlledNextDifferenceInputs':93,'bothPublicReserveCardsRetainedAndTied':60,'wallMs':4180,'maxNativeInputs':246,'maxRootAndSearchMs':v['maxRootAndSearchMs'],'roundEnd':'before-PASS-card-and-next-income','developmentFullyAligned':False,'goalStatus':'active','goalAchieved':False,'baselineUnchanged':'ai-search-v41-baseline-20261029','foreignV1Preserved':True},indent=2)+'\n');files.add(proof)
manifest='adhoc/human405-v178-first2-result-manifest-20261105-v1.json';(stage/manifest).write_text(json.dumps({'sourceCommit':base,'files':{p:sha(stage/p) for p in sorted(files)},'workingTreeOverlays':overlays,'sharedIndexSha256':shared,'sharedIndexEntriesSha256':entries,'goalStatus':'active','goalAchieved':False},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_V178_RESULT')!='1':print(json.dumps({'preflight':True,'files':len(files),'runtimeSources':len(v['sourceHashes']),'foreignV1Preserved':True,'scores':[15,43]}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-v178-result-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 blob=git('hash-object','-w','--stdin',data=(stage/p).read_bytes(),env=env).decode().strip();git('update-index','--add','--cacheinfo',modes.get(p,'100644'),blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files;git('diff','--cached','--check',env=env)
for p in sorted(files):dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(pathlib.Path(overlays[p]['path']).read_bytes() if p in overlays else (stage/p).read_bytes())
git('commit','-m','登记V178自主两轮15及43分并核对科技收入，定位轮初工具牌同值与预投入差距',env=env);commit=git('rev-parse','HEAD').decode().strip();assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==files;print(git('show','--name-only','--stat','--format=short','HEAD').decode());assert sha(root/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for p,o in overlays.items():assert sha(root/p)==o['sha256']
result={'commit':commit,'sourceCommit':base,'stage':str(stage),'privateIndex':private,'files':len(files),'sharedIndexUnchanged':True,'foreignV1Preserved':True,'goalStatus':'active'};pathlib.Path('/private/tmp/seti-v178-first2-result-delivery-20261105-v1.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
