import pathlib,subprocess,os,tempfile,json,hashlib,gzip,functools,re
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='ad1033609639f165adcbc1e74df72e8659bfd743';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/'
def git(*a,data=None,env=None):return subprocess.check_output(['git',*a],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def digest(b):return hashlib.sha256(b).hexdigest()
def read(p):return json.loads((stage/p).read_text())
@functools.lru_cache(maxsize=None)
def base_bytes(p):return git('show',base+':'+p)
assert git('rev-parse','HEAD').decode().strip()==base
before=json.loads(pathlib.Path('/private/tmp/seti-v165-stage-code-deltas-20261105-v1.json').read_text());assert before['baseCommit']==base
shared=sha(root/'.git/index');assert shared==before['sharedIndexSha256']=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49';entries=digest(git('ls-files','--stage','-z'))
for p,h in before['foreignHashes'].items():assert sha(root/p)==h,p
core=set(before['paths']);files=core|{'adhoc/deliver-human405-v165-admission-20261105-v1.py'}
for pattern in ['adhoc/*20261105*.js','adhoc/*20261105*.py','adhoc/*20261105*.json',folder+'*20261105*']:
 files.update(str(p.relative_to(stage))for p in stage.glob(pattern)if p.is_file())
archives={}
for version in [162,163,164]:
 d=stage/f'reports/ai-foundation-20261104/rejected-v{version}-runtime-20261105-v1';m=read(str(d.relative_to(stage))+'/manifest.json');assert m['baseCommit']==base and not m['admitted']and m['officialRuns']==0
 for p,h in m['overlayFiles'].items():assert sha(d/p)==h,p
 for p,h in m['allLoadedRuntimeHashes'].items():assert digest((d/p).read_bytes()if p in m['overlayFiles']else base_bytes(p))==h,(version,p)
 archives[version]=(d,m);files.update(str(p.relative_to(stage))for p in d.rglob('*')if p.is_file())
matrix=read(folder+'v165-test-coverage-matrix-20261105-v1.json');assert matrix['unitCovered']==167 and matrix['unitUnresolved']==0 and matrix['fullFlowCovered']==1
suite=matrix['fullSuite'];assert sha(stage/suite['log'])==suite['sha256'];log=(stage/suite['log']).read_text();assert 'SUMMARY unit passed=166 failed=1 total=167'in log and 'SUMMARY fullFlow passed=1 failed=0 total=1'in log
assert re.findall(r'^FAIL (.+?) status=',log,re.M)==['randomizer/game/ai/funded-movement-tail.test.js']
focused=matrix['focusedResolution'];assert sha(stage/focused['test'])==focused['currentTestSha256']and sha(stage/focused['log'])==focused['logSha256'];native=read(focused['log']);assert native['nativeControlledPlans']==20 and native['nativeControlledInputs']==122 and native['rootAndRngUnchanged']and native['rootValue']==71
for p,h in matrix['currentTestHashes'].items():assert sha(stage/p)==h,p
assert sha(stage/'tools/node-test-inventory.js')==matrix['currentInventorySha256']
chrome=(stage/(folder+'v165-chrome-ai-nineteen-20261105-v2.log')).read_text();assert 'SUMMARY browserSmoke passed=19 failed=0 total=19'in chrome
fails=[l for l in(stage/(folder+'v165-value-input-audit-20261105-v1.log')).read_text().splitlines()if l.startswith('[FAIL]')];prior=[l for l in(stage/(folder+'v161-value-input-audit-20261105-v1.log')).read_text().splitlines()if l.startswith('[FAIL]')];assert fails==prior and len(fails)==1 and 'aomomo'in fails[0]
assert '[PASS] independent-mission-data-continuation:'in(stage/(folder+'v165-value-input-audit-20261105-v1.log')).read_text()
gate=read(folder+'v165-current-teacher-serial-gate-20261105-v1.json');assert gate['status']=='complete'and len(gate['rows'])==90 and not gate['overruns']and all(v is None for v in gate['productionBudgets'].values())
cold=[];sources={}
for row in gate['rows']:
 r=read(row['evidence']);assert r['searchVersion'].endswith('v165')and r['valueModel'].endswith('v15')and r['complete']and r['rootAndRngUnchanged']and r['nativeInputs']<=256 and r['milliseconds']<=600
 assert sha(stage/r['fixture'])==r['fixtureSha256']and sha(stage/r['rawPath'])==r['rawSha256'];raw=json.loads(gzip.decompress((stage/r['rawPath']).read_bytes()));assert raw['complete']and not raw['unresolved']and raw['diagnostics']['nativeExecutions']==r['nativeInputs']and all(v is None for v in raw['diagnostics']['limits'].values())
 for p,h in r['sourceHashes'].items():assert sha(stage/p)==h,p;sources[p]=h
 cold.append(r);files.update([row['evidence'],r['rawPath'],r['fixture']])
assert max(r['nativeInputs']for r in cold)==241 and max(r['milliseconds']for r in cold)==541.229208
for name,version,roots,inputs in [('mission-data-continuation-native-20261105-v2',None,80,285),('v162-mission-data-continuation-native-20261105-v1',162,80,285),('v164-mission-data-continuation-native-20261105-v1',164,80,555)]:
 r=read(folder+name+'.json');assert r['status']=='complete'and len(r['rows'])==roots and r['nativeInputs']==inputs and r['originalRootAndRngRestored']
 assert sha(stage/r['source'])==r['sourceSha256']
 for p,h in r['sourceHashes'].items():
  if version is None:b=base_bytes(p)
  else:d,m=archives[version];b=(d/p).read_bytes()if p in m['overlayFiles']else base_bytes(p)
  assert digest(b)==h,(name,p)
assert '"nativeInputs":580'in(stage/(folder+'v165-computer-income-regression-20261105-v1.log')).read_text()
old={};modes={};unchanged=0
for e in git('ls-tree','-rz',base).split(b'\0'):
 if not e:continue
 meta,name=e.split(b'\t',1);p=name.decode();mode,kind,blob=meta.decode().split();old[p]=blob;modes[p]=mode
 if p.startswith(('randomizer/','tools/','assets/'))and p not in core:
  b=(stage/p).read_bytes();assert hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==blob,p;unchanged+=1
for p in sorted(files):
 if p.endswith('.js'):subprocess.run(['node','--check',str(stage/p)],check=True,stdout=subprocess.DEVNULL)
proof=folder+'v165-admission-source-check-20261105-v1.json';(stage/proof).write_text(json.dumps({'baseCommit':base,'runtimeSourceHashes':sources,'unchangedCodeDataFiles':unchanged,'testCoverageMatrix':folder+'v165-test-coverage-matrix-20261105-v1.json','unitCovered':167,'fullSuiteUnitPassed':166,'fullSuiteFailedThenFocusedResolved':1,'fullFlowPassed':1,'chromePassed':19,'coldRoots':90,'maxNativeInputs':241,'maxMilliseconds':541.229208,'nativeFixedDataRoots':80,'nativeFixedDataPlans':75,'nativeFixedDataInputs':555,'completeMissionAndActualGreedyInputs':25,'nativeMovementPlans':20,'nativeMovementInputs':122,'knownLegacyAuditFailure':fails,'productionBudgets':gate['productionBudgets'],'roundEnd':'before-PASS-card-and-next-income','newAutonomousRunPending':True,'baselineUnchanged':'ai-search-v41-baseline-20261029','goalStatus':'active','goalAchieved':False},indent=2)+'\n');files.add(proof)
deltas=set()
for p in files:
 b=(stage/p).read_bytes()
 if old.get(p)!=hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest():deltas.add(p)
manifest='adhoc/human405-v165-admission-manifest-20261105-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'files':{p:sha(stage/p)for p in sorted(files)},'changedFiles':sorted(deltas),'sharedIndexSha256':shared,'sharedIndexEntriesSha256':entries,'foreignRegistryHashes':before['foreignHashes'],'byteExactArchiveWhitespaceExclusions':[162,163,164],'goalStatus':'active','goalAchieved':False},indent=2)+'\n');deltas.add(manifest)
for p in deltas:
 if(root/p).exists()and(root/p).read_bytes()!=(stage/p).read_bytes():assert p in old and(root/p).read_bytes()==base_bytes(p),('overlap',p)
if os.environ.get('SETI_DELIVER_V165')!='1':print(json.dumps({'preflight':True,'files':len(deltas),'unitCoverage':167,'coldRoots':90,'maxNativeInputs':241,'maxMilliseconds':541.229208,'runtimeSources':len(sources)}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-v165-admission-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(deltas):
 blob=git('hash-object','-w','--stdin',data=(stage/p).read_bytes(),env=env).decode().strip();git('update-index','--add','--cacheinfo',modes.get(p,'100644'),blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==deltas;git('diff','--cached','--check','--','.',*[':(exclude)'+str(d.relative_to(stage))+'/**'for d,m in archives.values()],env=env)
for p in sorted(deltas):
 dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes((stage/p).read_bytes())
git('commit','-m','补计任务后固定收入与蓝槽筹资，统一选牌及真实填格后的收入判断',env=env);commit=git('rev-parse','HEAD').decode().strip();print(git('show','--name-only','--stat','--format=short','HEAD').decode());assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==deltas
assert sha(root/'.git/index')==shared and digest(git('ls-files','--stage','-z'))==entries
for p,h in before['foreignHashes'].items():assert sha(root/p)==h,p
result={'commit':commit,'baseCommit':base,'privateIndex':private,'files':len(deltas),'sharedIndexUnchanged':True,'foreignRegistryUnchanged':True,'goalStatus':'active','newAutonomousRunPending':True};pathlib.Path('/private/tmp/seti-v165-admission-result-20261105-v1.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
