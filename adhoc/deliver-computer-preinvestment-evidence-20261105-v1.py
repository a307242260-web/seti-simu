import pathlib,subprocess,os,tempfile,json,hashlib
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='a3a5cb95d348e17fc5b318a64b92d88de6aa85d0';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/';own='ai-search-v178-white-first2-20261105'
def git(*args,data=None,env=None):return subprocess.check_output(['git',*args],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
assert git('rev-parse','HEAD').decode().strip()==base
shared=sha(root/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()
g180=read(folder+'v180-current-teacher-serial-gate-20261105-v1.json');g181=read(folder+'v181-current-teacher-serial-gate-20261105-v1.json')
assert g180['status']=='complete' and g180['uniqueRoots']==169 and not g180['overruns'] and g180['maxInputs']==252
assert g181['status']=='complete' and g181['uniqueRoots']==169 and len(g181['overruns'])==1 and g181['overruns'][0]['label']=='case-105' and g181['maxMilliseconds']==623.224334
for g in [g180,g181]:
 for row in g['rows']:
  e=read(row['evidence']);assert e['complete'] and e['rootAndRngUnchanged'];assert sha(stage/e['rawPath'])==e['rawSha256']
  if g is g181:
   for p,h in e['sourceHashes'].items():assert sha(stage/p)==h,p
full=(stage/(folder+'v180-node-full-20261105-v1.log')).read_text();assert 'SUMMARY unit passed=157 failed=13 total=170' in full and 'SUMMARY fullFlow passed=1 failed=0 total=1' in full
assert 'SUMMARY unit passed=4 failed=0 total=4' in (stage/(folder+'v181-arithmetic-focused-20261105-v1.log')).read_text()
assert 'SUMMARY browserSmoke passed=2 failed=0 total=2' in (stage/(folder+'v181-computer-browser-20261105-v2.log')).read_text()
assert len(read(folder+'v181-computer-input-parity-20261105-v1.json')['rows'])==3
assert read(folder+'v179-computer-preinvestment-suffix-native-20261105-v1.json')['nativeInputs']==46
old={};modes={};productionChecked=0
for item in git('ls-tree','-rz',base).split(b'\0'):
 if not item:continue
 meta,name=item.split(b'\t',1);mode,kind,blob=meta.decode().split();p=name.decode();old[p]=blob;modes[p]=mode
 if p.startswith(('randomizer/','tools/','assets/')):
  data=(root/p).read_bytes();assert hashlib.sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest()==blob,p;productionChecked+=1
for p in ['reports/iteration/versions.json','reports/iteration/registry.json']:
 r=read(p);previous=json.loads(git('show',base+':'+p));assert len(r['versions'])==len(previous['versions'])
 for a,b in zip(r['versions'],previous['versions']):assert a==b if a['id']!=own else {**a,'summary':b['summary']}==b
assert read('reports/iteration/registry.json')['currentBaseline']=='ai-search-v41-baseline-20261029'
files={'docs/ai-design.md','docs/ai-computer-preinvestment-20261105.md','adhoc/computer-preinvestment-contract-20261105-v1.md','adhoc/human405-two-rounds-progress-20261105-v12.json','adhoc/benchmark-human405-decision-20261105-v7.js','adhoc/benchmark-human405-current-first2-20261105-v7.js','adhoc/profile-human405-decision-20261105-v1.js','adhoc/witness-computer-preinvestment-suffix-20261105-v1.js','adhoc/audit-computer-preinvestment-inputs-20261105-v1.js','adhoc/prepare-v181-candidate-center-overlays-20261105-v1.js','adhoc/deliver-computer-preinvestment-evidence-20261105-v1.py','reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html'}
for stem in ['archive-computer-preinvestment-candidate','materialize-computer-preinvestment-candidate']:
 for v in [1,2]:files.add('adhoc/'+stem+'-20261105-v'+str(v)+'.py')
for pattern in ['v180-*','v181-*','v179-computer-preinvestment-suffix-native-20261105-v1.*']:files.update(str(p.relative_to(stage)) for p in (stage/folder).glob(pattern) if p.is_file())
bundles=['reports/ai-foundation-20261104/candidate-v180-computer-preinvestment-20261105-v1/','reports/ai-foundation-20261104/candidate-v181-computer-preinvestment-20261105-v1/']
for bundle in bundles:
 m=read(bundle+'manifest.json');assert m['baseCommit']==base and not m['admitted'] and m['officialRuns']==0
 for p,h in m['overlayFiles'].items():assert sha(stage/(bundle+p))==h,p
 files.update(str(p.relative_to(stage)) for p in (stage/bundle).rglob('*') if p.is_file())
files={p for p in files if p not in old or hashlib.sha1(('blob '+str((stage/p).stat().st_size)+'\0').encode()+(stage/p).read_bytes()).hexdigest()!=old[p]}
assert not any(p.startswith(('randomizer/','tools/','assets/')) for p in files)
overlays=json.loads(pathlib.Path('/private/tmp/seti-v181-candidate-center-overlays-20261105-v1/overlays.json').read_text())
for p,o in overlays.items():assert sha(root/p)==o['beforeSha256'] and sha(o['path'])==o['sha256']
work=json.loads(pathlib.Path(overlays['reports/iteration/versions.json']['path']).read_text());original=json.loads((root/'reports/iteration/versions.json').read_text());assert len(work['versions'])==len(original['versions']) and any(v['id']=='perf-baseline-lowload-20260913' for v in work['versions'])
for a,b in zip(work['versions'],original['versions']):assert a==b if a['id']!=own else {**a,'summary':b['summary']}==b
exempt=[b+'randomizer/game/ai/decision-search.js' for b in bundles]
for p in exempt:
 bad=[line for line in (stage/p).read_text().splitlines() if line!=line.rstrip()];assert len(bad)==2 and all(not line.strip() for line in bad)
for p in files:
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
 if (root/p).exists() and p not in overlays and (root/p).read_bytes()!=(stage/p).read_bytes():assert p in old and (root/p).read_bytes()==git('show',base+':'+p),p
proof=folder+'v181-candidate-delivery-source-check-20261105-v1.json';(stage/proof).write_text(json.dumps({'baseCommit':base,'productionUnchanged':True,'productionRuntime':'v178 / V16','productionTrackedRuntimeToolsAssetsChecked':productionChecked,'candidates':['v180 / V18','v181 / V18'],'candidateAdmitted':False,'officialRuns':0,'v180Cold':{'uniqueRoots':169,'maxInputs':252,'maxMs':g180['maxMilliseconds'],'overruns':0},'v181Cold':{'uniqueRoots':169,'maxInputs':252,'maxMs':g181['maxMilliseconds'],'overruns':1},'v180FullNode':{'passed':157,'failed':13,'fullFlowPassed':1},'v181FocusedPassed':4,'v181ChromePassed':2,'v181InputParityCheckpoints':3,'fullAuditPassed':False,'versionAndRecordCountsUnchanged':True,'foreignV1Preserved':True,'baselineUnchanged':'ai-search-v41-baseline-20261029','whitespaceExemptions':exempt,'goalStatus':'active','goalAchieved':False},indent=2)+'\n');files.add(proof)
manifestPath='adhoc/computer-preinvestment-delivery-manifest-20261105-v1.json';(stage/manifestPath).write_text(json.dumps({'baseCommit':base,'files':{p:sha(stage/p) for p in sorted(files)},'workingTreeOverlays':overlays,'sharedIndexSha256':shared,'sharedIndexEntriesSha256':entries,'goalStatus':'active','goalAchieved':False},indent=2)+'\n');files.add(manifestPath)
if os.environ.get('SETI_DELIVER_COMPUTER_EVIDENCE')!='1':print(json.dumps({'preflight':True,'files':len(files),'productionUnchanged':True}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-computer-evidence-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 blob=git('hash-object','-w','--stdin',data=(stage/p).read_bytes(),env=env).decode().strip();git('update-index','--add','--cacheinfo',modes.get(p,'100644'),blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files
git('diff','--cached','--check','--','.',*[':(exclude)'+p for p in exempt],env=env)
for p in sorted(files):dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(pathlib.Path(overlays[p]['path']).read_bytes() if p in overlays else (stage/p).read_bytes())
git('commit','-m','记录计算机预投入估值与首轮决策修正，保留回归及623毫秒超时待解',env=env);commit=git('rev-parse','HEAD').decode().strip();names=set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines());assert names==files
assert sha(root/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
assert not git('diff','--name-only',base,commit,'--','randomizer','tools','assets').strip()
for p,o in overlays.items():assert sha(root/p)==o['sha256']
result={'commit':commit,'baseCommit':base,'stage':str(stage),'privateIndex':private,'files':len(files),'sharedIndexUnchanged':True,'foreignV1Preserved':True,'productionUnchanged':True,'candidateAdmitted':False,'goalStatus':'active'};pathlib.Path('/private/tmp/seti-computer-evidence-delivery-20261105-v1.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
