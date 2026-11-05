import pathlib,subprocess,os,tempfile,json,hashlib
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='bdb1f76e93f801e52748e3665ffc555d90937e08';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/'
def git(*args,data=None,env=None):return subprocess.check_output(['git',*args],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
def blob(b):return hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
assert git('rev-parse','HEAD').decode().strip()==base
shared=sha(root/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();foreign={p:sha(root/p) for p in ['reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html']}
g=read(folder+'v188-current-teacher-serial-gate-20261105-v1.json');assert g['status']=='complete' and len(g['rows'])==391 and not g['overruns'] and g['maxInputs']<=256 and g['maxMilliseconds']<=600 and all(x is None for x in g['productionBudgets'].values());assert g['uniqueRoots']==len({r['nativeEnvelopeSha256'] for r in g['rows']});loaded={}
for row in g['rows']:
 e=read(row['evidence']);assert e['baseCommit']==base and e['complete'] and e['rootAndRngUnchanged'] and sha(stage/e['rawPath'])==e['rawSha256'] and sha(stage/e['fixture'])==e['fixtureSha256']
 for p,h in e['sourceHashes'].items():assert sha(stage/p)==h,p;assert p not in loaded or loaded[p]==h;loaded[p]=h
assert {r['label'] for r in read(folder+'v187-all-white-search-roots-20261105-v1.json')['rows']} <= {r['label'] for r in g['rows']}
full=(stage/(folder+'v188-node-full-20261105-v1.log')).read_text();assert 'SUMMARY unit passed=172 failed=0 total=172' in full and 'SUMMARY fullFlow passed=1 failed=0 total=1' in full and '\nFAIL ' not in full
chrome=(stage/(folder+'v188-chrome-ai-twentysix-20261105-v1.log')).read_text();assert 'SUMMARY browserSmoke passed=26 failed=0 total=26' in chrome and '\nFAIL ' not in chrome
assert len([line for line in chrome.splitlines() if line.startswith('PASS production-')])==26 and 'PASS production-sector-mission-composition ' in chrome
native=read(folder+'v187-sector-mission-prefix-native-20261105-v1.json');assert native['nativeInputs']==21 and native['status']=='complete' and native['rootAndRngRestored'] and native['searchQueries']==0
assert '"sectorMissionComposition":"passed"' in (stage/(folder+'v188-sector-mission-regression-after-20261105-v1.log')).read_text()
audit=(stage/(folder+'v188-value-input-audit-20261105-v1.log')).read_text();oldAudit=(stage/(folder+'v187-value-input-audit-20261105-v1.log')).read_text();fails=lambda text:[x for x in text.splitlines() if x.startswith('[FAIL]')];assert fails(audit)==fails(oldAudit) and len(fails(audit))==1 and sum(x.startswith('[PASS] independent-') for x in audit.splitlines())==47
old={};modes={};code=set();unchanged=0
for item in git('ls-tree','-rz',base).split(b'\0'):
 if not item:continue
 meta,name=item.split(b'\t',1);mode,kind,h=meta.decode().split();p=name.decode();old[p]=h;modes[p]=mode
 if p.startswith(('randomizer/','tools/','assets/')):
  assert blob((root/p).read_bytes())==h,p
  if blob((stage/p).read_bytes())!=h:code.add(p)
  else:unchanged+=1
new={'randomizer/game/ai/sector-mission-composition.test.js'}
for p in new:assert p not in old and not (root/p).exists();code.add(p)
expected={'randomizer/index.html','randomizer/game/ai/state-value.js','randomizer/game/ai/sector-card-capital.js','randomizer/game/ai/decision-search.js','randomizer/game/ai/known-movement-tool.test.js','tools/node-test-inventory.js','tools/browser-smoke-inventory.js','tools/audit_v_state_inputs.js'}|new;assert code==expected,code
files=code|{'docs/ai-design.md','docs/ai-sector-mission-composition-20261105.md','adhoc/human405-two-rounds-progress-20261105-v20.json','adhoc/sector-mission-composition-contract-20261105-v1.md','adhoc/benchmark-human405-current-first2-20261105-v12.js','adhoc/benchmark-human405-decision-20261105-v12.js','adhoc/run-sector-mission-browser-20261105-v1.py','adhoc/deliver-sector-mission-admission-20261105-v1.py','adhoc/diagnose-v187-known-swap-capital-20261105-v1.js','adhoc/profile-v187-sector-mission-prefix-20261105-v1.js'}
files.update(str(p.relative_to(stage)) for pattern in ['v187-*','v188-*'] for p in (stage/folder).glob(pattern) if p.is_file())
files={p for p in files if p not in old or blob((stage/p).read_bytes())!=old[p]}
for p in files:
 if (root/p).exists() and (root/p).read_bytes()!=(stage/p).read_bytes():assert p in old and blob((root/p).read_bytes())==old[p],p
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
proof=folder+'v188-admission-source-check-20261105-v1.json';(stage/proof).write_text(json.dumps({'baseCommit':base,'runtimeChanges':sorted(code),'otherRuntimeToolsAssetsUnchanged':unchanged,'runtimeSourceHashes':loaded,'coldNamedCases':391,'coldUniqueRoots':g['uniqueRoots'],'maxNativeInputs':g['maxInputs'],'maxRootAndSearchMs':g['maxMilliseconds'],'fullUnitPassed':172,'fullFlowPassed':1,'chromePassed':26,'currentIndependentValueInputChecks':47,'legacyAuditFailureUnchanged':fails(audit),'sourceAdmitted':True,'officialRuns':0,'lastAutonomousRecord':'reports/research/c5ea5600.72bbd878.quick-400.json','lastAutonomousScores':[15,44],'teacherScores':[15,34],'nativeSectorMissionPrefixInputs':21,'noRefillOrSameTokenReuse':True,'controlsAreNotAutonomousResults':True,'baselineUnchanged':'ai-search-v41-baseline-20261029','goalStatus':'active','goalAchieved':False},ensure_ascii=False,indent=2)+'\n');files.add(proof)
manifest='adhoc/sector-mission-admission-manifest-20261105-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'files':{p:sha(stage/p) for p in sorted(files)},'sharedIndexSha256':shared,'sharedIndexEntriesSha256':entries,'foreignWorkingHashes':foreign,'goalStatus':'active','goalAchieved':False},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_SECTOR_MISSION')!='1':print(json.dumps({'preflight':True,'files':len(files),'runtimeChanges':len(code),'runtimeSources':len(loaded),'coldRoots':g['uniqueRoots'],'unitCoverage':172,'chrome':26}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-sector-mission-admission-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 h=git('hash-object','-w','--stdin',data=(stage/p).read_bytes(),env=env).decode().strip();git('update-index','--add','--cacheinfo',modes.get(p,'100644'),h,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files;git('diff','--cached','--check',env=env)
for p in sorted(files):dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes((stage/p).read_bytes())
git('commit','-m','保留条件扫描后的筹资探测用途并避免重算旧信号，准入V188',env=env);commit=git('rev-parse','HEAD').decode().strip();assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files
assert sha(root/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for p,h in foreign.items():assert sha(root/p)==h
result={'commit':commit,'baseCommit':base,'privateIndex':private,'stage':str(stage),'files':len(files),'runtimeChanges':len(code),'sharedIndexUnchanged':True,'foreignWorkingUnchanged':True,'sourceAdmitted':True,'productionRuntime':'V188/V22','officialRuns':0,'goalStatus':'active'};pathlib.Path('/private/tmp/seti-sector-mission-admission-20261105-v1.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
