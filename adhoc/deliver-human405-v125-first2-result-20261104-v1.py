import pathlib,subprocess,os,tempfile,json,hashlib,gzip
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='4ec5d3d723826c5a4784c08f96daae998d434081';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/'
def git(*a,data=None,env=None):return subprocess.check_output(['git',*a],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
assert git('rev-parse','HEAD').decode().strip()==base;ih=sha(root/'.git/index');eh=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();assert ih=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49'
record='reports/research/756a2bff.4ec5d3d7.quick-400.json';r=read(record);v=read(folder+'v125-first2-native-verification-20261104-v1.json');assert not v['goalAchieved'] and v['goalStatus']=='active';assert v['all95ActionsIdenticalToV124'] and v['endingNativeStateAndRngIdenticalToV124'] and v['allNativeInputsAndRngReplayed'] and v['allSearchesComplete'] and v['allRoundEndsExcludePickAndIncome'];assert [x['score'] for x in v['rounds']]==[27,35];assert v['maxNativeInputs']<=256 and v['maxRootAndSearchMs']<=600
for k in ['record','save','trace']:assert sha(stage/v[k])==v[k+'Sha256']
files={record,r['savePath'],r['agentTracePath'],record+'.round-ends.jsonl','reports/iteration/ai-search-v125-white-first2-20261104/756a2bff.4ec5d3d7.quick-400.action-log.html','reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html','docs/ai-design.md','docs/human405-conditional-scan-v125-20261104.md','adhoc/human405-two-rounds-progress-20261104-v3.json','adhoc/verify-human405-v125-first2-20261104-v1.js','adhoc/capture-v125-research-preparation-root-20261104-v1.js','adhoc/prepare-v125-first2-root-overlays-20261104-v1.js','adhoc/deliver-human405-v125-first2-result-20261104-v1.py'}
for n in ['v125-first2-live-20261104-v1.log','v125-first2-record-inventory-20261104-v1.log','v125-first2-registry-build-20261104-v1.log','v125-first2-native-verification-20261104-v1.json','v125-first2-native-verification-20261104-v1.log','v125-research-preparation-root-20261104-v1.log','v125-dlc37-choice-diagnosis-20261104-v1.json']:files.add(folder+n)
for row in v['rounds']:assert sha(stage/row['checkpointPath'])==row['checkpointSha256'];files.add(row['checkpointPath'])
d=read(folder+'v125-dlc37-choice-diagnosis-20261104-v1.json');assert d['knownCardCandidatePresent'] and not d['productionFixed'];assert d['dlc37Play']['value']==66 and d['selectedResearch']['value']==68.5 and d['dlc37Play']['completion']=='complete' and d['selectedResearch']['completion']=='complete';a=read(d['sourceEvidence']);assert sha(stage/a['fixture'])==a['fixtureSha256'] and sha(stage/a['rawPath'])==a['rawSha256'];raw=json.loads(gzip.decompress((stage/a['rawPath']).read_bytes()));assert raw['complete'] and not raw['unresolved'];files.update([d['sourceEvidence'],a['fixture'],a['rawPath']])
sources={**v['sourceHashes'],**a['sourceHashes']}
for p,h in sources.items():assert sha(stage/p)==h and hashlib.sha256(git('show',base+':'+p)).hexdigest()==h,p
for entry in git('ls-tree','-rz',base).split(b'\0'):
 if not entry:continue
 meta,name=entry.split(b'\t',1);p=name.decode()
 if p.startswith(('randomizer/','tools/','assets/')):
  b=(stage/p).read_bytes();assert hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==meta.decode().split()[2],p
versions=read('reports/iteration/versions.json');new=next(x for x in versions['versions'] if x['id']=='ai-search-v125-white-first2-20261104');assert new['baselineEligible'] is False;oldv=json.loads(git('show',base+':reports/iteration/versions.json'));assert [x for x in versions['versions'] if x['id']!=new['id']]==oldv['versions'];reg=read('reports/iteration/registry.json');assert reg['currentBaseline']=='ai-search-v41-baseline-20261029';assert all(x['versionId']!=new['id'] for x in reg['bestOf']['topByAvg']);assert next(x for x in reg['versions'] if x['id']==new['id'])['isHead'] is False
overlays=json.loads(pathlib.Path('/private/tmp/seti-v125-first2-root-overlays-20261104/overlays.json').read_text())
for p,o in overlays.items():assert sha(root/p)==o['beforeSha256'] and sha(o['path'])==o['sha256']
w=json.loads(pathlib.Path(overlays['reports/iteration/versions.json']['path']).read_text());before=json.loads((root/'reports/iteration/versions.json').read_text());assert [x for x in w['versions'] if x['id']!=new['id']]==before['versions'];assert any(x['id']=='perf-baseline-lowload-20260913' for x in w['versions'])
for p in files:
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
proof=folder+'v125-first2-result-source-check-20261104-v1.json';(stage/proof).write_text(json.dumps({'sourceCommit':base,'runtimeSourceHashes':sources,'runtimeToolsAssetsUnchanged':True,'standardRuns':1,'native95ActionsAndRngMatched':True,'roundEnd':'before-PASS-card-and-next-income','boardScores':[27,35],'teacherCurrentRulesScores':[15,34],'wallMs':v['wallMs'],'actualChoiceDiagnostic':{'DLC37Complete':66,'selectedBlue4Complete':68.5,'notAClaimOfGlobalFutureOptimality':True},'goalStatus':'active','goalAchieved':False,'baselineUnchanged':'ai-search-v41-baseline-20261029'},indent=2)+'\n');files.add(proof)
manifest='adhoc/human405-v125-first2-result-manifest-20261104-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'files':{p:sha(stage/p) for p in sorted(files)},'workingTreeOverlays':overlays,'sharedIndexSha256':ih,'sharedIndexEntriesSha256':eh,'goalStatus':'active','goalAchieved':False},indent=2)+'\n');files.add(manifest)
old=set(git('ls-tree','-r','--name-only',base).decode().splitlines())
for p in files:
 if (root/p).exists() and p not in overlays and (root/p).read_bytes()!=(stage/p).read_bytes():assert p in old and (root/p).read_bytes()==git('show',base+':'+p),p
if os.environ.get('SETI_DELIVER_V125_RESULT')!='1':print(json.dumps({'preflight':True,'files':len(files),'runtimeSources':len(sources),'foreignV1Preserved':True,'goalStatus':'active'}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-v125-result-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 b=(stage/p).read_bytes();d=root/p;d.parent.mkdir(parents=True,exist_ok=True);d.write_bytes(pathlib.Path(overlays[p]['path']).read_bytes() if p in overlays else b);blob=git('hash-object','-w','--stdin',data=b,env=env).decode().strip();git('update-index','--add','--cacheinfo','100644',blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files;git('diff','--cached','--check',env=env);git('commit','-m','登记v125自主两轮与原生对照，定位DLC37仍被舍弃的估值差',env=env);commit=git('rev-parse','HEAD').decode().strip();assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==files;print(git('show','--name-only','--stat','--format=short','HEAD').decode());assert sha(root/'.git/index')==ih and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==eh
for p,o in overlays.items():assert sha(root/p)==o['sha256']
print(json.dumps({'commit':commit,'privateIndex':private,'files':len(files),'sharedIndexUnchanged':True,'foreignV1Preserved':True,'goalStatus':'active'}))
