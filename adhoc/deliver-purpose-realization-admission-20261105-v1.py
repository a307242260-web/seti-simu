import pathlib,subprocess,os,tempfile,json,hashlib
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='b27a537503a1bcb9ea7aeb3649ad514a36ab997b';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/'
def git(*args,data=None,env=None):return subprocess.check_output(['git',*args],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
def blob(b):return hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
assert git('rev-parse','HEAD').decode().strip()==base
shared=sha(root/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();foreign={p:sha(root/p) for p in ['reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html']}
g=read(folder+'v186-current-teacher-serial-gate-20261105-v1.json');assert g['status']=='complete' and len(g['rows'])==225 and g['uniqueRoots']==189 and not g['overruns'] and g['maxInputs']<=256 and g['maxMilliseconds']<=600 and all(x is None for x in g['productionBudgets'].values());loaded={}
for row in g['rows']:
 e=read(row['evidence']);assert e['baseCommit']==base and e['complete'] and e['rootAndRngUnchanged'] and sha(stage/e['rawPath'])==e['rawSha256'] and sha(stage/e['fixture'])==e['fixtureSha256']
 for p,h in e['sourceHashes'].items():assert sha(stage/p)==h,p;assert p not in loaded or loaded[p]==h;loaded[p]=h
extra=read(folder+'v186-cold-controlled-after-analysis-20261105-v1.json');assert extra['baseCommit']==base and extra['complete'] and extra['rootAndRngUnchanged'] and extra['nativeInputs']<=256 and extra['milliseconds']<=600
for p,h in extra['sourceHashes'].items():assert sha(stage/p)==h and loaded[p]==h,p
extraIdentity=subprocess.check_output(['node','-e',"const fs=require('node:fs'),crypto=require('node:crypto'),q=JSON.parse(fs.readFileSync(process.argv[1]));process.stdout.write(crypto.createHash('sha256').update(JSON.stringify([q.seatId,q.compositionEnvelope])).digest('hex'));",extra['fixture']],cwd=stage).decode();assert extraIdentity not in {r['nativeEnvelopeSha256'] for r in g['rows']}
full=(stage/(folder+'v186-node-full-20261105-v1.log')).read_text();assert 'SUMMARY unit passed=170 failed=0 total=170' in full and 'SUMMARY fullFlow passed=1 failed=0 total=1' in full and '\nFAIL ' not in full
chrome=(stage/(folder+'v186-chrome-ai-twentyfour-20261105-v1.log')).read_text();assert 'SUMMARY browserSmoke passed=24 failed=0 total=24' in chrome and '\nFAIL ' not in chrome
assert len([line for line in chrome.splitlines() if line.startswith('PASS production-')])==24 and 'PASS production-purpose-realization ' in chrome
parity=read(folder+'v186-primary-value-and-choice-parity-20261105-v1.json');assert parity['all225NamedPrimaryValuesUnchanged'] and not parity['changedNativeInputs'] and len(parity['changedActions'])==7
native=read(folder+'v186-root91-selected-native-20261105-v1.json');assert native['status']=='complete' and native['nativeInputs']==11 and native['rootAndRngRestored'] and native['summaryRealizationMatchesActualNativeEnd'] and native['endpoint']['score']==32
w=read(folder+'v186-cold-serial-actual-v184-091-20261105-v1.json');assert w['actionId']=='place_data:8fd12fd3' and w['nativeInputs']==20 and w['value']==85.08333333333333
assert '"play_card"' in (stage/(folder+'v186-after-analysis-cold-inspection-20261105-v1.json')).read_text()
audit=(stage/(folder+'v186-value-input-audit-20261105-v1.log')).read_text();oldAudit=(stage/(folder+'v185-value-input-audit-20261105-v1.log')).read_text();fails=lambda text:[x for x in text.splitlines() if x.startswith('[FAIL]')];assert fails(audit)==fails(oldAudit) and len(fails(audit))==1 and sum(x.startswith('[PASS] independent-') for x in audit.splitlines())==45
old={};modes={};code=set();unchanged=0
for item in git('ls-tree','-rz',base).split(b'\0'):
 if not item:continue
 meta,name=item.split(b'\t',1);mode,kind,h=meta.decode().split();p=name.decode();old[p]=h;modes[p]=mode
 if p.startswith(('randomizer/','tools/','assets/')):
  assert blob((root/p).read_bytes())==h,p
  if blob((stage/p).read_bytes())!=h:code.add(p)
  else:unchanged+=1
expected={'randomizer/game/ai/state-value.js','randomizer/game/ai/state-value.test.js','randomizer/game/ai/decision-search.js','randomizer/game/ai/analysis-port.js','randomizer/game/ai/analysis-port.test.js','randomizer/game/ai/sector-card-capital.test.js','tools/node-test-inventory.js','tools/browser-smoke-inventory.js'};assert code==expected,code
files=code|{'docs/ai-design.md','docs/ai-purpose-realization-20261105.md','adhoc/human405-two-rounds-progress-20261105-v16.json','adhoc/purpose-realization-tie-contract-20261105-v2.md','adhoc/benchmark-human405-current-first2-20261105-v10.js','adhoc/benchmark-human405-decision-20261105-v10.js','adhoc/replay-v186-root91-selected-20261105-v1.js','adhoc/run-realization-browser-20261105-v1.py','adhoc/deliver-purpose-realization-admission-20261105-v1.py'}
files.update(str(p.relative_to(stage)) for p in (stage/folder).glob('v186-*') if p.is_file())
for p in files:
 if (root/p).exists() and (root/p).read_bytes()!=(stage/p).read_bytes():assert p in old and blob((root/p).read_bytes())==old[p],p
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
proof=folder+'v186-admission-source-check-20261105-v1.json';(stage/proof).write_text(json.dumps({'baseCommit':base,'runtimeChanges':sorted(code),'otherRuntimeToolsAssetsUnchanged':unchanged,'runtimeSourceHashes':loaded,'coldNamedCases':225,'coldUniqueRoots':189,'additionalAfterAnalysisColdRoots':1,'coldRoot91NativeInputs':20,'maxNativeInputs':max(g['maxInputs'],extra['nativeInputs']),'maxRootAndSearchMs':max(g['maxMilliseconds'],extra['milliseconds']),'fullUnitPassed':170,'fullFlowPassed':1,'chromePassed':24,'currentIndependentValueInputChecks':45,'legacyAuditFailureUnchanged':fails(audit),'sourceAdmitted':True,'officialRuns':0,'lastAutonomousRecord':'reports/research/ea6138c1.11437f11.quick-400.json','lastAutonomousScores':[15,25],'teacherScores':[15,34],'nativeControlInputs':11,'nativeControlScore':32,'totalNativeReplayInputsIncludingFailedToolAttempt':22,'controlsAreNotAutonomousResults':True,'baselineUnchanged':'ai-search-v41-baseline-20261029','goalStatus':'active','goalAchieved':False},ensure_ascii=False,indent=2)+'\n');files.add(proof)
manifest='adhoc/purpose-realization-admission-manifest-20261105-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'files':{p:sha(stage/p) for p in sorted(files)},'sharedIndexSha256':shared,'sharedIndexEntriesSha256':entries,'foreignWorkingHashes':foreign,'goalStatus':'active','goalAchieved':False},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_REALIZATION')!='1':print(json.dumps({'preflight':True,'files':len(files),'runtimeChanges':len(code),'runtimeSources':len(loaded),'coldRoots':190,'unitCoverage':170,'chrome':24}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-realization-admission-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 h=git('hash-object','-w','--stdin',data=(stage/p).read_bytes(),env=env).decode().strip();git('update-index','--add','--cacheinfo',modes.get(p,'100644'),h,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files;git('diff','--cached','--check',env=env)
for p in sorted(files):dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes((stage/p).read_bytes())
git('commit','-m','同值时优先兑现目的资本并保留复用证据，准入V186及190冷根',env=env);commit=git('rev-parse','HEAD').decode().strip();assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files
assert sha(root/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for p,h in foreign.items():assert sha(root/p)==h
result={'commit':commit,'baseCommit':base,'privateIndex':private,'stage':str(stage),'files':len(files),'runtimeChanges':len(code),'sharedIndexUnchanged':True,'foreignWorkingUnchanged':True,'sourceAdmitted':True,'productionRuntime':'V186/V20','officialRuns':0,'goalStatus':'active'};pathlib.Path('/private/tmp/seti-realization-admission-20261105-v1.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
