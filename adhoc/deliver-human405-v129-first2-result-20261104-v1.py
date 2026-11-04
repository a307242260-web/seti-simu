import pathlib,subprocess,os,tempfile,json,hashlib,gzip
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='28f4e95ca1e9022f9db49342ada94c37b6f4f98f';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/'
def git(*a,data=None,env=None):return subprocess.check_output(['git',*a],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
manifest='adhoc/human405-v129-first2-result-manifest-20261104-v1.json';prior_manifest=json.loads((root/manifest).read_text())if(root/manifest).exists()else None;prior_manifest_hash=sha(root/manifest)if prior_manifest else None
if prior_manifest:assert prior_manifest['baseCommit']==base
assert git('rev-parse','HEAD').decode().strip()==base;ih=sha(root/'.git/index');eh=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();assert ih=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49'
record='reports/research/35f648b3.28f4e95c.quick-400.json';r=read(record);v=read(folder+'v129-first2-native-verification-20261104-v1.json');assert not v['goalAchieved'] and v['goalStatus']=='active';assert v['actionsIdenticalToV125'] and v['finalNativeStateSessionRngIdenticalToV125'] and v['allNativeInputsAndRngReplayed'] and v['allSearchesComplete'] and v['allRoundAssetsVerifiedFromNativeCheckpoints'] and v['allRoundEndsExcludePickAndIncome'];assert [x['score']for x in v['rounds']]==[27,35];assert v['maxNativeInputs']<=256 and v['maxRootAndSearchMs']<=600
for k in ['record','save','trace']:assert sha(stage/v[k])==v[k+'Sha256']
files={record,r['savePath'],r['agentTracePath'],record+'.round-ends.jsonl','reports/iteration/ai-search-v129-white-first2-20261104/35f648b3.28f4e95c.quick-400.action-log.html','reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html','docs/ai-design.md','docs/ai-funded-travel-v129-20261104.md','adhoc/human405-two-rounds-progress-20261104-v6.json','adhoc/verify-human405-v129-first2-20261104-v1.js','adhoc/capture-v129-mission-choice-root-20261104-v1.js','adhoc/witness-v129-mission-assets-20261104-v1.js','adhoc/diagnose-v129-first-blue-choice-20261104-v1.js','adhoc/prepare-v129-first2-root-overlays-20261104-v1.js','adhoc/deliver-human405-v129-first2-result-20261104-v1.py'}
for name in ['v129-first2-live-20261104-v1.log','v129-first2-record-inventory-20261104-v1.log','v129-first2-registry-build-20261104-v1.log','v129-first2-native-verification-20261104-v1.json','v129-first2-native-verification-20261104-v1.log','v129-mission-choice-root-20261104-v1.log','v129-mission-choice-cold-20261104-v1.log','v129-orbit-land-native-assets-20261104-v1.json','v129-orbit-land-native-assets-20261104-v1.log','v129-first-blue-choice-diagnosis-20261104-v1.json','v129-first-blue-choice-diagnosis-20261104-v1.log']:files.add(folder+name)
for row in v['rounds']:assert sha(stage/row['checkpointPath'])==row['checkpointSha256'];files.add(row['checkpointPath'])
w=read(folder+'v129-orbit-land-native-assets-20261104-v1.json');assert w['originalRootAndRngUnchanged'] and len(w['rows'])==2
for pkey,hkey in [('evidence','evidenceSha256'),('rawPath','rawSha256'),('fixture','fixtureSha256')]:assert sha(stage/w[pkey])==w[hkey];files.add(w[pkey])
a=read(w['evidence']);raw=json.loads(gzip.decompress((stage/a['rawPath']).read_bytes()));assert raw['complete'] and not raw['unresolved'];assert a['nativeInputs']<=256 and a['milliseconds']<=600
assert {x['goal']:x['searchValue']for x in w['rows']}=={'orbit':60,'land':62}
d=read(folder+'v129-first-blue-choice-diagnosis-20261104-v1.json');assert d['blue2CandidatePresent'] and not d['productionFixed'] and d['selectedBlue1']==62 and d['teacherStyleBlue2']==61 and len(d['choices'])==12;assert sha(stage/d['record'])==d['recordSha256']
sources={**v['sourceHashes'],**a['sourceHashes'],**w['sourceHashes']}
for p,h in sources.items():assert sha(stage/p)==h and hashlib.sha256(git('show',base+':'+p)).hexdigest()==h,p
checked=0
for entry in git('ls-tree','-rz',base).split(b'\0'):
 if not entry:continue
 meta,name=entry.split(b'\t',1);p=name.decode()
 if p.startswith(('randomizer/','tools/','assets/')):
  b=(stage/p).read_bytes();assert hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==meta.decode().split()[2],p;checked+=1
versions=read('reports/iteration/versions.json');new=next(x for x in versions['versions']if x['id']=='ai-search-v129-white-first2-20261104');assert new['baselineEligible']is False;oldv=json.loads(git('show',base+':reports/iteration/versions.json'));assert [x for x in versions['versions']if x['id']!=new['id']]==oldv['versions'];reg=read('reports/iteration/registry.json');assert reg['currentBaseline']=='ai-search-v41-baseline-20261029';assert all(x['versionId']!=new['id']for x in reg['bestOf']['topByAvg']);assert next(x for x in reg['versions']if x['id']==new['id'])['isHead']is False
assert (stage/'reports/robot-iteration.html').read_text().count('ai-search-v129-white-first2-20261104')>0
assert (stage/'reports/iteration/ai-search-v129-white-first2-20261104/35f648b3.28f4e95c.quick-400.action-log.html').exists()
overlays=json.loads(pathlib.Path('/private/tmp/seti-v129-first2-root-overlays-20261104/overlays.json').read_text())
for p,o in overlays.items():assert sha(root/p) in [o['beforeSha256'],o['sha256']] and sha(o['path'])==o['sha256']
work=json.loads(pathlib.Path(overlays['reports/iteration/versions.json']['path']).read_text());before=json.loads((root/'reports/iteration/versions.json').read_text());assert [x for x in work['versions']if x['id']!=new['id']]==[x for x in before['versions']if x['id']!=new['id']];assert any(x['id']=='perf-baseline-lowload-20260913'for x in work['versions'])
for p in files:
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
proof=folder+'v129-first2-result-source-check-20261104-v1.json';(stage/proof).write_text(json.dumps({'sourceCommit':base,'runtimeSourceHashes':sources,'runtimeToolsAssetsUnchanged':checked,'standardRuns':1,'native95ActionsAndRngMatched':True,'roundEnd':'before-PASS-card-and-next-income','boardScores':[27,35],'teacherCurrentRulesScores':[15,34],'wallMs':v['wallMs'],'firstTechnologyDiagnostic':{'blue2Present':True,'blue1':62,'blue2':61,'productionFixed':False},'missionDiagnostic':{'orbit':60,'land':62,'differentBoundaryWarning':True},'goalStatus':'active','goalAchieved':False,'baselineUnchanged':'ai-search-v41-baseline-20261029'},indent=2)+'\n');files.add(proof)
manifest='adhoc/human405-v129-first2-result-manifest-20261104-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'files':{p:sha(stage/p)for p in sorted(files)},'workingTreeOverlays':overlays,'sharedIndexSha256':ih,'sharedIndexEntriesSha256':eh,'goalStatus':'active','goalAchieved':False},indent=2)+'\n');files.add(manifest)
old=set(git('ls-tree','-r','--name-only',base).decode().splitlines())
for p in files:
 if(root/p).exists() and p not in overlays and(root/p).read_bytes()!=(stage/p).read_bytes():assert (p in old and(root/p).read_bytes()==git('show',base+':'+p))or(prior_manifest and(sha(root/p)==prior_manifest['files'].get(p)or p==manifest and sha(root/p)==prior_manifest_hash)),p
if os.environ.get('SETI_DELIVER_V129_RESULT')!='1':print(json.dumps({'preflight':True,'files':len(files),'runtimeSources':len(sources),'foreignV1Preserved':True,'goalStatus':'active'}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-v129-result-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 b=(stage/p).read_bytes();dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(pathlib.Path(overlays[p]['path']).read_bytes()if p in overlays else b);blob=git('hash-object','-w','--stdin',data=b,env=env).decode().strip();git('update-index','--add','--cacheinfo','100644',blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files;git('diff','--cached','--check',env=env);git('commit','-m','登记v129自主两轮及原生资产对照，定位首轮蓝科技一分估值差',env=env);commit=git('rev-parse','HEAD').decode().strip();assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==files;print(git('show','--name-only','--stat','--format=short','HEAD').decode());assert sha(root/'.git/index')==ih and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==eh
for p,o in overlays.items():assert sha(root/p)==o['sha256']
result={'commit':commit,'privateIndex':private,'files':len(files),'sharedIndexUnchanged':True,'foreignV1Preserved':True,'goalStatus':'active'};pathlib.Path('/private/tmp/seti-v129-result-delivery-20261104.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
