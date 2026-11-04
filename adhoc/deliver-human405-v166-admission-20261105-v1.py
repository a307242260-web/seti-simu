import pathlib, subprocess, os, tempfile, json, hashlib
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='9854966767cb748a69c69ca0190df378fd3eae25';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/'
def git(*args,data=None,env=None):return subprocess.check_output(['git',*args],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
assert git('rev-parse','HEAD').decode().strip()==base
shared=sha(root/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();foreign={p:sha(root/p) for p in ['reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html']}
gate=read(folder+'v166-current-teacher-serial-gate-20261105-v1.json');assert gate['status']=='complete' and len(gate['rows'])==95 and not gate['overruns'];assert gate['maxInputs']<=256 and gate['maxMilliseconds']<=600 and all(v is None for v in gate['productionBudgets'].values())
for row in gate['rows']:
 e=read(row['evidence']);assert e['baseCommit']==base and e['rootAndRngUnchanged'] and e['complete'];assert sha(stage/e['rawPath'])==e['rawSha256'];assert sha(stage/e['fixture'])==e['fixtureSha256']
 for p,h in e['sourceHashes'].items():assert sha(stage/p)==h,p
full=(stage/(folder+'v166-node-full-20261105-v1.log')).read_text();focused=(stage/(folder+'v166-funding-focused-20261105-v1.log')).read_text();flow=(stage/(folder+'v166-full-flow-with-git-20261105-v1.log')).read_text();chrome=(stage/(folder+'v166-chrome-ai-twenty-20261105-v1.log')).read_text()
assert 'SUMMARY unit passed=166 failed=1 total=167' in full;assert full.count('\nFAIL ')==1 and 'FAIL randomizer/game/ai/card-pick-planning.test.js status=1' in full;assert 'SUMMARY unit passed=2 failed=0 total=2' in focused;assert 'SUMMARY fullFlow passed=1 failed=0 total=1' in flow;assert 'SUMMARY browserSmoke passed=20 failed=0 total=20' in chrome
native=read(folder+'v165-public-refill-funding-native-20261105-v2.json');assert native['status']=='complete' and native['nativeInputs']==105 and native['originalRootAndRngRestored'];assert native['catalogCounts']=={'0':62,'1':62,'2':58}
repro=read(folder+'v165-blue-exchange-funding-reproduction-20261105-v1.json');assert not repro['oldCapacity'] and repro['oldBlueFunding'] is None and repro['nativeInputs']==6 and repro['nativeResearchSucceeded'] and repro['rootAndRngRestored']
code={'randomizer/game/ai/resource-demand.js','randomizer/game/ai/decision-search.js','randomizer/game/ai/resource-demand.test.js','randomizer/game/ai/card-pick-planning.test.js','randomizer/index.html','tools/browser-smoke-inventory.js'}
old={};modes={};unchanged=0
for item in git('ls-tree','-rz',base).split(b'\0'):
 if not item:continue
 meta,name=item.split(b'\t',1);mode,kind,blob=meta.decode().split();p=name.decode();old[p]=blob;modes[p]=mode
 if p.startswith(('randomizer/','tools/','assets/')) and p not in code:
  data=(stage/p).read_bytes();assert hashlib.sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest()==blob,p;unchanged+=1
files=code|{'docs/ai-design.md','docs/ai-blue-exchange-funding-20261105.md','adhoc/benchmark-human405-decision-20261105-v3.js','adhoc/benchmark-human405-current-first2-20261105-v3.js','adhoc/reproduce-v165-blue-exchange-funding-20261105-v1.js','adhoc/witness-v165-public-refill-funding-20261105-v1.js','adhoc/witness-v165-public-refill-funding-20261105-v2.js','adhoc/deliver-human405-v166-admission-20261105-v1.py'}
for pattern in ['v166-*','v165-public-refill-funding-native-20261105-v*.*','v165-blue-exchange-funding-reproduction-20261105-v1.*','v165-post-orbit-computer-funding-root-20261105-v1.json']:
 files.update(str(p.relative_to(stage)) for p in (stage/folder).glob(pattern) if p.is_file())
for p in files:
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
 if (root/p).exists() and (root/p).read_bytes()!=(stage/p).read_bytes():assert p in old and (root/p).read_bytes()==git('show',base+':'+p),p
proof=folder+'v166-admission-source-check-20261105-v1.json';(stage/proof).write_text(json.dumps({'baseCommit':base,'runtimeChanges':sorted(code),'otherRuntimeToolsAssetsUnchanged':unchanged,'coldRoots':95,'maxNativeInputs':gate['maxInputs'],'maxRootAndSearchMs':gate['maxMilliseconds'],'fullUnitOriginal':{'passed':166,'failed':1,'total':167},'currentUnitCoverage':{'passed':167,'total':167,'focusedReplacements':['card-pick-planning.test.js','resource-demand.test.js'],'reason':'Original company-start test now disables blue2 to require the income source; active blue2 can fund research through exchange. Current resource-demand includes native execution, cold recovery and disabled/short-wallet controls.'},'fullFlowWithGit':1,'chromePassed':20,'newValueInputs':False,'valueModel':'v15','productionBudgets':gate['productionBudgets'],'catalogIncomeCounts':native['catalogCounts'],'nativeRefillControls':105,'nativeCounterexampleInputs':6,'earliestRoot39ActionStillPlaceData':True,'developmentAligned':False,'autonomousRuns':0,'goalStatus':'active','goalAchieved':False,'sharedIndexSha256':shared,'foreignWorkingHashes':foreign},ensure_ascii=False,indent=2)+'\n');files.add(proof)
manifest='adhoc/human405-v166-admission-manifest-20261105-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'files':{p:sha(stage/p) for p in sorted(files)},'sharedIndexSha256':shared,'sharedIndexEntriesSha256':entries,'foreignWorkingHashes':foreign,'goalStatus':'active','goalAchieved':False},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_V166')!='1':print(json.dumps({'preflight':True,'files':len(files),'coldRoots':95,'unitCoverage':167,'chrome':20}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-v166-admission-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 blob=git('hash-object','-w','--stdin',data=(stage/p).read_bytes(),env=env).decode().strip();git('update-index','--add','--cacheinfo',modes.get(p,'100644'),blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files;git('diff','--cached','--check',env=env)
for p in sorted(files):dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes((stage/p).read_bytes())
git('commit','-m','补齐蓝槽跨币种筹资候选并验证原生兑换研究及95个冷根',env=env);commit=git('rev-parse','HEAD').decode().strip();assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==files;print(git('show','--name-only','--stat','--format=short','HEAD').decode());assert sha(root/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for p,h in foreign.items():assert sha(root/p)==h
result={'commit':commit,'baseCommit':base,'stage':str(stage),'privateIndex':private,'files':len(files),'sharedIndexUnchanged':True,'foreignWorkingUnchanged':True,'goalStatus':'active'};pathlib.Path('/private/tmp/seti-v166-admission-result-20261105-v1.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
