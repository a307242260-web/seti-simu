import pathlib,subprocess,os,tempfile,json,hashlib
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='7b7b2e5eadc907111b1cf9baeeb1840d0d828a54'
def git(*a,data=None,env=None):return subprocess.check_output(['git',*a],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
assert git('rev-parse','HEAD').decode().strip()==base;ih=sha(root/'.git/index');eh=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();assert ih=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49'
record='reports/research/788d8a64.1a78d5d3.full.json';r=read(record);v=read('reports/ai-foundation-20261104/v123-white-full-verification-20261104-v1.json');assert r['terminal'] and r['summary']['scores']['player-white']==80 and v['all103ContinuationNativeInputsReplayed'] and v['allRoundNativeStateSessionRngMatched'] and v['allSearchGraphsComplete'];assert sha(stage/record)==v['recordSha256'] and sha(stage/r['savePath'])==v['saveSha256'];assert r['wallMsIncludingSourceRound1']==v['wallMsIncludingSourceRound1'] and len(v['overruns'])==3
files={record,r['savePath'],r['agentTracePath'],r['roundSummariesPath'],'reports/iteration/ai-search-v123-white-full-20261104/788d8a64.1a78d5d3.full.action-log.html','reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html','docs/ai-v123-white-full-20261104.md','adhoc/verify-v123-white-full-20261104-v1.js','adhoc/prepare-v123-full-root-overlays-20261104-v1.js','adhoc/deliver-v123-white-full-result-20261104-v1.py'}
for row in r['rounds']:assert sha(stage/row['checkpointPath'])==row['checkpointSha256'];files.add(row['checkpointPath'])
old=set(git('ls-tree','-r','--name-only',base).decode().splitlines())
for p in (stage/'reports/ai-foundation-20261104').iterdir():
 if p.is_file() and str(p.relative_to(stage)) not in old:files.add(str(p.relative_to(stage)))
versions=read('reports/iteration/versions.json');new=next(x for x in versions['versions'] if x['id']=='ai-search-v123-white-full-20261104');assert new['baselineEligible'] is False;oldv=json.loads(git('show',base+':reports/iteration/versions.json'));assert [x for x in versions['versions'] if x['id']!=new['id']]==oldv['versions'];reg=read('reports/iteration/registry.json');assert reg['currentBaseline']=='ai-search-v41-baseline-20261029';assert all(x['versionId']!=new['id'] for x in reg['bestOf']['topByAvg']);rr=next(x for x in reg['versions'] if x['id']==new['id'])['results'][0];assert rr['comparisonScope']=='white-only-full-game' and rr['scores']['player-white']==80 and rr['scoreSource']=='save-final'
overlays=json.loads(pathlib.Path('/private/tmp/seti-v123-full-root-overlays-20261104/overlays.json').read_text())
for p,o in overlays.items():assert sha(root/p)==o['beforeSha256'] and sha(o['path'])==o['sha256']
w=json.loads(pathlib.Path(overlays['reports/iteration/versions.json']['path']).read_text());before=json.loads((root/'reports/iteration/versions.json').read_text());assert [x for x in w['versions'] if x['id']!=new['id']]==before['versions'];assert any(x['id']=='perf-baseline-lowload-20260913' for x in w['versions'])
strategy=read('reports/ai-foundation-20261023/human405-v123-completion-runtime-source-check-20261031-v1.json')['runtimeSourceHashes'];checked={}
for p,h in strategy.items():
 if p.startswith('randomizer/'):assert sha(stage/p)==h and hashlib.sha256(git('show',base+':'+p)).hexdigest()==h;checked[p]=h
proof='reports/ai-foundation-20261104/v123-full-result-source-check-20261104-v1.json';(stage/proof).write_text(json.dumps({'trialCommit':'1a78d5d35d76c42855c922ec0c44901039392780','strategySourceCommit':'945301446ad6e2198fbf3b9e6a284602d078a037','strategyHashes':checked,'standardFullRuns':1,'first64InputsNotRerun':True,'allContinuationAndRoundSnapshotsReplayed':True,'fullGameScore':80,'gameExecutionMillisecondsIncludingHistoricalR1':r['wallMsIncludingSourceRound1'],'taskWaitingTimeIsNotGameExecutionTime':True,'baselineUnchanged':'ai-search-v41-baseline-20261029','singlePointOverruns':3},indent=2)+'\n');files.add(proof)
for p in files:
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
manifest='adhoc/v123-white-full-delivery-manifest-20261104-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'files':{p:sha(stage/p) for p in sorted(files)},'workingTreeOverlays':overlays,'sharedIndexSha256':ih,'sharedIndexEntriesSha256':eh,'strategyFrozen':True,'experimentComplete':True},indent=2)+'\n');files.add(manifest)
for p in files:
 if (root/p).exists() and p not in overlays and (root/p).read_bytes()!=(stage/p).read_bytes():assert p in old and (root/p).read_bytes()==git('show',base+':'+p),p
if os.environ.get('SETI_DELIVER_FULL_RESULT')!='1':print(json.dumps({'preflight':True,'files':len(files),'strategyFilesChecked':len(checked),'whiteScore':80,'foreignV1Preserved':True}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-v123-full-result-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 b=(stage/p).read_bytes();d=root/p;d.parent.mkdir(parents=True,exist_ok=True);d.write_bytes(pathlib.Path(overlays[p]['path']).read_bytes() if p in overlays else b);blob=git('hash-object','-w','--stdin',data=b,env=env).decode().strip();git('update-index','--add','--cacheinfo','100644',blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files;git('diff','--cached','--check',env=env);git('commit','-m','记录v123白席整局80分与四轮发展，归档完整重放和超标节点',env=env);commit=git('rev-parse','HEAD').decode().strip();assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==files;print(git('show','--name-only','--stat','--format=short','HEAD').decode());assert sha(root/'.git/index')==ih and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==eh
for p,o in overlays.items():assert sha(root/p)==o['sha256']
print(json.dumps({'commit':commit,'privateIndex':private,'files':len(files),'sharedIndexUnchanged':True,'foreignV1Preserved':True,'whiteScore':80}))
