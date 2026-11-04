import pathlib,subprocess,os,tempfile,json,hashlib
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='0f67d6269e4fab877e046bca496791f7375b99ad';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/';bundle='reports/ai-foundation-20261104/candidate-v179-known-sector-analysis-20261105-v1/';own='ai-search-v178-white-first2-20261105'
def git(*args,data=None,env=None):return subprocess.check_output(['git',*args],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
assert git('rev-parse','HEAD').decode().strip()==base
shared=sha(root/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();gate=read(folder+'v179-current-teacher-serial-gate-20261105-v1.json');assert gate['status']=='complete' and len(gate['rows'])==172 and gate['uniqueRoots']==169 and gate['maxInputs']==240 and gate['maxMilliseconds']<=600 and not gate['overruns']
manifest=read(bundle+'manifest.json');assert manifest['baseCommit']==base and not manifest['admitted'] and manifest['officialRuns']==0
for name,h in manifest['overlayFiles'].items():assert sha(stage/(bundle+name))==h and sha(stage/name)==h,name
for name,h in manifest['allLoadedRuntimeHashes'].items():assert sha(stage/name)==h,name
for row in gate['rows']:
 e=read(row['evidence']);assert e['baseCommit']==base and e['complete'] and e['rootAndRngUnchanged'];assert sha(stage/e['rawPath'])==e['rawSha256']
 for name,h in e['sourceHashes'].items():assert sha(stage/name)==h,name
full=(stage/(folder+'v179-node-full-20261105-v1.log')).read_text();assert 'SUMMARY unit passed=163 failed=6 total=169' in full and 'SUMMARY fullFlow passed=1 failed=0 total=1' in full and full.count('\nFAIL ')==6
for name in ['v179-analysis-preparation-focused-20261105-v2.log','v179-sector-card-money-focused-20261105-v1.log']:assert 'SUMMARY unit passed=1 failed=0 total=1' in (stage/(folder+name)).read_text()
for name,count in [('v178-scan-analysis-preparation-native-20261105-v2.json',24),('v178-known-sector-card-continuation-native-20261105-v2.json',10),('v179-first-round-analysis-tradeoff-native-20261105-v1.json',19)]:
 r=read(folder+name);assert r['status']=='complete' and r['nativeInputs']==count and r['rootAndRngRestored']
roots=read(folder+'v178-all-white-decision-roots-20261105-v1.json');assert roots['status']=='complete' and len(roots['rows'])==76 and roots['finalNativeStateAndRngReplayed']
old={};modes={};productionChecked=0
for item in git('ls-tree','-rz',base).split(b'\0'):
 if not item:continue
 meta,name=item.split(b'\t',1);mode,kind,blob=meta.decode().split();p=name.decode();old[p]=blob;modes[p]=mode
 if p.startswith(('randomizer/','tools/','assets/')):
  b=(root/p).read_bytes();assert hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==blob,p;productionChecked+=1
versions=read('reports/iteration/versions.json');previous=json.loads(git('show',base+':reports/iteration/versions.json'));assert len(versions['versions'])==len(previous['versions']) and not any(v['id'].startswith('ai-search-v179') for v in versions['versions'])
for a,b in zip(versions['versions'],previous['versions']):assert a==b if a['id']!=own else {**a,'summary':b['summary']}==b
reg=read('reports/iteration/registry.json');assert reg['currentBaseline']=='ai-search-v41-baseline-20261029' and 'V179' in next(v for v in reg['versions'] if v['id']==own)['summary'];assert len(next(v for v in reg['versions'] if v['id']==own)['results'])==1
files={'docs/ai-design.md','docs/ai-known-sector-analysis-20261105.md','adhoc/human405-two-rounds-progress-20261105-v11.json','adhoc/known-sector-analysis-plan-contract-20261105-v1.md','adhoc/benchmark-human405-decision-20261105-v6.js','adhoc/benchmark-human405-current-first2-20261105-v6.js','adhoc/capture-v178-all-white-roots-20261105-v1.js','adhoc/prepare-v179-candidate-center-overlays-20261105-v1.js','adhoc/archive-known-sector-analysis-candidate-20261105-v1.py','adhoc/materialize-known-sector-analysis-candidate-20261105-v1.py','adhoc/run-known-sector-analysis-browser-20261105-v1.py','adhoc/deliver-v179-candidate-evidence-20261105-v1.py','reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html'}
for pattern in ['v179-*','v178-all-white-decision-roots-20261105-v1.*','v178-actual-step???-20261105-v1.json','v178-controlled-dlc5-r2-opening*','v178-cold-controlled-dlc5-r2-opening*','v178-scan-analysis-preparation-native-20261105-v*.*','v178-known-sector-card-continuation-native-20261105-v*.*']:
 files.update(str(p.relative_to(stage)) for p in (stage/folder).glob(pattern) if p.is_file())
for pattern in ['witness-v178-scan-analysis-preparation-20261105-v*.js','witness-v178-known-sector-card-continuation-20261105-v*.js','witness-v179-first-round-analysis-tradeoff-20261105-v1.js']:files.update(str(p.relative_to(stage)) for p in (stage/'adhoc').glob(pattern))
files.update(str(p.relative_to(stage)) for p in (stage/bundle).rglob('*') if p.is_file())
files={p for p in files if p not in old or hashlib.sha1(('blob '+str((stage/p).stat().st_size)+'\0').encode()+(stage/p).read_bytes()).hexdigest()!=old[p]};assert not any(p.startswith(('randomizer/','tools/','assets/')) for p in files)
overlays=json.loads(pathlib.Path('/private/tmp/seti-v179-candidate-center-overlays-20261105-v1/overlays.json').read_text())
for p,o in overlays.items():assert sha(root/p)==o['beforeSha256'] and sha(o['path'])==o['sha256']
work=json.loads(pathlib.Path(overlays['reports/iteration/versions.json']['path']).read_text());original=json.loads((root/'reports/iteration/versions.json').read_text());assert len(work['versions'])==len(original['versions']) and any(v['id']=='perf-baseline-lowload-20260913' for v in work['versions'])
for a,b in zip(work['versions'],original['versions']):assert a==b if a['id']!=own else {**a,'summary':b['summary']}==b
exempt=[bundle+'randomizer/game/ai/decision-search.js'];lines=(stage/exempt[0]).read_text().splitlines();bad=[x for x in lines if x!=x.rstrip()];assert len(bad)==2 and all(not x.strip() for x in bad)
for p in files:
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
 if (root/p).exists() and p not in overlays and (root/p).read_bytes()!=(stage/p).read_bytes():assert p in old and (root/p).read_bytes()==git('show',base+':'+p),p
proof=folder+'v179-candidate-delivery-source-check-20261105-v1.json';(stage/proof).write_text(json.dumps({'baseCommit':base,'productionUnchanged':True,'productionRuntime':'v178 / V16','productionTrackedRuntimeToolsAssetsChecked':productionChecked,'candidateOnly':'v179 / V17','candidateAdmitted':False,'candidateSourceModules':len(manifest['allLoadedRuntimeHashes']),'candidateOverlayFiles':len(manifest['overlayFiles']),'namedColdCases':172,'uniqueColdRoots':169,'maxInputs':240,'maxMs':gate['maxMilliseconds'],'fullNodePassed':163,'fullNodeFailed':6,'fullFlowPassed':1,'candidateChromeRun':False,'candidateOfficialRuns':0,'actualV178RecordUnchanged':'e987ead2.9491f13b.quick-400.json','baselineUnchanged':'ai-search-v41-baseline-20261029','versionAndRecordCountsUnchanged':True,'foreignV1Preserved':True,'exactArchiveWhitespaceExemptions':exempt,'archiveWhitespaceReason':'Two inherited blank-line spaces in exact decision-search source; preserve runtime SHA. All other new artifacts retain strict diff check.','goalStatus':'active','goalAchieved':False},indent=2)+'\n');files.add(proof)
manifestPath='adhoc/v179-candidate-evidence-delivery-manifest-20261105-v1.json';(stage/manifestPath).write_text(json.dumps({'baseCommit':base,'files':{p:sha(stage/p) for p in sorted(files)},'workingTreeOverlays':overlays,'sharedIndexSha256':shared,'sharedIndexEntriesSha256':entries,'whitespaceExemptions':exempt,'goalStatus':'active','goalAchieved':False},indent=2)+'\n');files.add(manifestPath)
if os.environ.get('SETI_DELIVER_V179_EVIDENCE')!='1':print(json.dumps({'preflight':True,'files':len(files),'productionUnchanged':True,'candidateAdmitted':False}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-v179-evidence-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 blob=git('hash-object','-w','--stdin',data=(stage/p).read_bytes(),env=env).decode().strip();git('update-index','--add','--cacheinfo',modes.get(p,'100644'),blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files;git('diff','--cached','--check','--','.',*[':(exclude)'+p for p in exempt],env=env)
for p in sorted(files):dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(pathlib.Path(overlays[p]['path']).read_bytes() if p in overlays else (stage/p).read_bytes())
git('commit','-m','归档扇区分析准备候选及169冷根证据，保留首轮分流与计算机预投入待核验项',env=env);commit=git('rev-parse','HEAD').decode().strip();assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==files;print(git('show','--name-only','--stat','--format=short','HEAD').decode());assert sha(root/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for p,o in overlays.items():assert sha(root/p)==o['sha256']
assert not git('diff','--name-only',base,commit,'--','randomizer','tools','assets').strip()
result={'commit':commit,'baseCommit':base,'stage':str(stage),'privateIndex':private,'files':len(files),'sharedIndexUnchanged':True,'foreignV1Preserved':True,'productionUnchanged':True,'candidateAdmitted':False,'goalStatus':'active'};pathlib.Path('/private/tmp/seti-v179-candidate-evidence-delivery-20261105-v1.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
