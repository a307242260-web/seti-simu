import pathlib,subprocess,os,tempfile,json,hashlib
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='c4098165e3d5a1be83c4d31fb82257a98942c4c6';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/'
def git(*args,data=None,env=None):return subprocess.check_output(['git',*args],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
def blob(data):return hashlib.sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest()
assert git('rev-parse','HEAD').decode().strip()==base
shared=sha(root/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();foreign={p:sha(root/p) for p in ['reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html']}
gate=read(folder+'v184-current-teacher-serial-gate-20261105-v1.json');assert gate['status']=='complete' and gate['uniqueRoots']==169 and len(gate['rows'])==172 and not gate['overruns'] and gate['maxInputs']==252 and gate['maxMilliseconds']<=600 and all(v is None for v in gate['productionBudgets'].values())
loaded={}
for row in gate['rows']:
 e=read(row['evidence']);assert e['baseCommit']==base and e['complete'] and e['rootAndRngUnchanged'] and sha(stage/e['rawPath'])==e['rawSha256'] and sha(stage/e['fixture'])==e['fixtureSha256']
 for p,h in e['sourceHashes'].items():assert sha(stage/p)==h,p;assert p not in loaded or loaded[p]==h;loaded[p]=h
full=(stage/(folder+'v184-node-full-20261105-v1.log')).read_text();assert 'SUMMARY unit passed=170 failed=0 total=170' in full and 'SUMMARY fullFlow passed=1 failed=0 total=1' in full and '\nFAIL ' not in full
chrome=read(folder+'v184-browser-coverage-20261105-v1.json');assert chrome['passed']==23 and chrome['failed']==0 and len(set(chrome['uniqueChecks']))==23
for r in chrome['evidence']:assert sha(stage/r['path'])==r['sha256']
assert 'SUMMARY browserSmoke passed=19 failed=0 total=19' in (stage/(folder+'v184-chrome-ai-remaining19-20261105-v3.log')).read_text()
audit=(stage/(folder+'v184-value-input-audit-20261105-v1.log')).read_text();previous=(stage/(folder+'v178-value-input-audit-20261105-v2.log')).read_text();fails=[l for l in audit.splitlines() if l.startswith('[FAIL]')];assert len(fails)==1 and 'Cannot add property aomomo' in fails[0] and fails[0] in previous
for name in ['probe-plan-native-fallback','pass-investment-window','mission-data-continuation','public-income-option','known-sector-analysis']:assert '[PASS] independent-'+name+':' in audit
old={};modes={}
for item in git('ls-tree','-rz',base).split(b'\0'):
 if item:
  meta,name=item.split(b'\t',1);mode,kind,h=meta.decode().split();old[name.decode()]=h;modes[name.decode()]=mode
code=set()
for directory in ['randomizer','tools']:
 for p in (stage/directory).rglob('*'):
  if p.is_file():
   name=str(p.relative_to(stage))
   if old.get(name)!=blob(p.read_bytes()):code.add(name)
assert all(p=='randomizer/index.html' or p.startswith('randomizer/game/ai/') or p in ['tools/audit_v_state_inputs.js','tools/browser-smoke-inventory.js','tools/node-test-inventory.js'] for p in code)
unchanged=0
for p,h in old.items():
 if p.startswith(('randomizer/','tools/','assets/')) and p not in code:assert blob((stage/p).read_bytes())==h,p;unchanged+=1
files=code|{'docs/ai-design.md','docs/ai-computer-preinvestment-20261105.md','docs/ai-computer-analysis-admission-20261105.md','adhoc/human405-two-rounds-progress-20261105-v13.json','adhoc/identity-subtree-reuse-contract-20261105-v1.md','adhoc/benchmark-human405-decision-20261105-v8.js','adhoc/benchmark-human405-current-first2-20261105-v8.js','adhoc/verify-identity-subtree-reuse-20261105-v1.js','adhoc/audit-income-analysis-cost-gap-20261105-v1.js','adhoc/trace-current-winning-income-window-20261105-v1.js','adhoc/archive-identity-subtree-candidate-20261105-v1.py','adhoc/materialize-identity-subtree-candidate-20261105-v1.py','adhoc/archive-income-analysis-input-candidate-20261105-v1.py','adhoc/materialize-income-analysis-input-candidate-20261105-v1.py','adhoc/archive-income-analysis-input-candidate-20261105-v2.py','adhoc/materialize-income-analysis-input-candidate-20261105-v2.py','adhoc/run-current-computer-analysis-browser-20261105-v1.py','adhoc/resume-current-computer-browser-20261105-v1.js','adhoc/verify-human405-v184-first2-20261105-v1.js','adhoc/compare-v184-first2-development-20261105-v1.js','adhoc/deliver-computer-analysis-admission-20261105-v1.py'}
for pattern in ['v182-*','v183-*','v184-*']:files.update(str(p.relative_to(stage)) for p in (stage/folder).glob(pattern) if p.is_file())
bundles=['reports/ai-foundation-20261104/candidate-v182-identity-subtree-reuse-20261105-v1/','reports/ai-foundation-20261104/candidate-v183-income-analysis-input-20261105-v1/','reports/ai-foundation-20261104/candidate-v183-income-analysis-input-20261105-v2/']
for bundle in bundles:
 manifest=read(bundle+'manifest.json');assert manifest['baseCommit']==base and not manifest['admitted']
 for p,h in manifest['overlayFiles'].items():assert sha(stage/(bundle+p))==h,p
 files.update(str(p.relative_to(stage)) for p in (stage/bundle).rglob('*') if p.is_file())
files.update(str(p.relative_to(stage)) for p in (stage/'reports/ai-foundation-20261104/test-review-v183-20261105-v1').rglob('*') if p.is_file())
exempt=[b+'randomizer/game/ai/decision-search.js' for b in bundles]
for p in exempt:
 bad=[l for l in (stage/p).read_text().splitlines() if l!=l.rstrip()];assert len(bad)==2 and all(not l.strip() for l in bad)
files={p for p in files if p not in old or blob((stage/p).read_bytes())!=old[p]}
for p in files:
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
 if (root/p).exists() and (root/p).read_bytes()!=(stage/p).read_bytes():assert p in old and blob((root/p).read_bytes())==old[p],p
proof=folder+'v184-admission-source-check-20261105-v1.json';(stage/proof).write_text(json.dumps({'baseCommit':base,'runtimeChanges':sorted(code),'otherRuntimeToolsAssetsUnchanged':unchanged,'runtimeSourceHashes':loaded,'coldNamedCases':172,'coldUniqueRoots':169,'maxNativeInputs':gate['maxInputs'],'maxRootAndSearchMs':gate['maxMilliseconds'],'fullUnit':{'passed':170,'failed':0,'total':170},'fullFlow':1,'chromePassed':23,'valueAudit':{'allIndependentSearchInputs':'pass','legacyUnchangedFailure':fails},'valueModel':'v18','productionBudgets':gate['productionBudgets'],'sourceAdmitted':True,'newAutonomousRuns':0,'lastAutonomousRecord':'reports/research/e987ead2.9491f13b.quick-400.json','baselineUnchanged':'ai-search-v41-baseline-20261029','developmentAligned':False,'goalStatus':'active','goalAchieved':False,'sharedIndexSha256':shared,'foreignWorkingHashes':foreign},ensure_ascii=False,indent=2)+'\n');files.add(proof)
manifestPath='adhoc/computer-analysis-admission-manifest-20261105-v1.json';(stage/manifestPath).write_text(json.dumps({'baseCommit':base,'files':{p:sha(stage/p) for p in sorted(files)},'sharedIndexSha256':shared,'sharedIndexEntriesSha256':entries,'foreignWorkingHashes':foreign,'whitespaceExemptions':exempt,'goalStatus':'active','goalAchieved':False},indent=2)+'\n');files.add(manifestPath)
if os.environ.get('SETI_DELIVER_COMPUTER_ADMISSION')!='1':print(json.dumps({'preflight':True,'files':len(files),'runtimeChanges':len(code),'runtimeSources':len(loaded),'coldRoots':169,'unitCoverage':170,'chrome':23}));raise SystemExit(0)
assert git('rev-parse','HEAD').decode().strip()==base and sha(root/'.git/index')==shared
for p,h in foreign.items():assert sha(root/p)==h
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-computer-admission-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 h=git('hash-object','-w','--stdin',data=(stage/p).read_bytes(),env=env).decode().strip();git('update-index','--add','--cacheinfo',modes.get(p,'100644'),h,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files;git('diff','--cached','--check','--','.',*[':(exclude)'+p for p in exempt],env=env)
for p in sorted(files):dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes((stage/p).read_bytes())
git('commit','-m','统一计算机预投入与收入准备估值并准入V184，验证170测试及169冷根',env=env);commit=git('rev-parse','HEAD').decode().strip();assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files
assert sha(root/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for p,h in foreign.items():assert sha(root/p)==h
result={'commit':commit,'baseCommit':base,'stage':str(stage),'privateIndex':private,'files':len(files),'runtimeChanges':len(code),'sharedIndexUnchanged':True,'foreignWorkingUnchanged':True,'sourceAdmitted':True,'productionRuntime':'v184 / V18','newAutonomousRuns':0,'goalStatus':'active'};pathlib.Path('/private/tmp/seti-computer-analysis-admission-20261105-v1.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
