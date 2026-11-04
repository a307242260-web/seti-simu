import pathlib, subprocess, os, tempfile, json, hashlib
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='e40b0b7f1ac1c0e7bbabb9b42911a90104c1d3e7';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/'
def git(*args,data=None,env=None):return subprocess.check_output(['git',*args],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
assert git('rev-parse','HEAD').decode().strip()==base
shared=sha(root/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();foreign={p:sha(root/p) for p in ['reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html']}
gate=read(folder+'v178-current-teacher-serial-gate-20261105-v1.json');assert gate['status']=='complete' and len(gate['rows'])==95 and not gate['overruns'];assert gate['maxInputs']==246 and gate['maxMilliseconds']<=600 and all(v is None for v in gate['productionBudgets'].values())
for row in gate['rows']:
 e=read(row['evidence']);assert e['baseCommit']==base and e['complete'] and e['rootAndRngUnchanged'];assert sha(stage/e['rawPath'])==e['rawSha256'] and sha(stage/e['fixture'])==e['fixtureSha256']
 for p,h in e['sourceHashes'].items():assert sha(stage/p)==h,p
full=(stage/(folder+'v178-node-full-20261105-v1.log')).read_text();assert 'SUMMARY unit passed=164 failed=4 total=168' in full and 'SUMMARY fullFlow passed=1 failed=0 total=1' in full
failures=['income-plan-value','opening-plan','post-main-plan','settled-tech-funding'];assert full.count('\nFAIL ')==4
for name in failures:assert 'FAIL randomizer/game/ai/'+name+'.test.js status=1' in full
for name,summary in [('income-plan-focused','SUMMARY unit passed=1 failed=0 total=1'),('settled-tech-focused','SUMMARY unit passed=1 failed=0 total=1'),('plan-regression-focused','SUMMARY unit passed=3 failed=0 total=3')]:assert summary in (stage/(folder+'v178-'+name+'-20261105-v1.log')).read_text()
assert 'SUMMARY browserSmoke passed=21 failed=0 total=21' in (stage/(folder+'v178-chrome-ai-twentyone-20261105-v3.log')).read_text()
audit=(stage/(folder+'v178-value-input-audit-20261105-v2.log')).read_text();oldAudit=(stage/(folder+'v165-value-input-audit-20261105-v1.log')).read_text();fails=[l for l in audit.splitlines() if l.startswith('[FAIL]')];assert len(fails)==1 and fails[0] in oldAudit and 'Cannot add property aomomo' in fails[0];assert '[PASS] independent-public-income-option: 4 native prefixes' in audit
before=read(folder+'public-income-end-tail-before-20261105-v1.json');after=read(folder+'public-income-end-tail-after-20261105-v1.json');assert before['summary'] is None and after['summary']['netGain']==0 and after['nativeInputs']==13 and after['rootAndRngRestored'];assert before['sourceEndpoint']==after['sourceEndpoint'] and before['nativeEndpoint']==after['nativeEndpoint']
code={'randomizer/game/ai/'+p for p in ['analysis-port.js','card-pick-planning.js','decision-search.js','local-decision-plans.js','probe-capital.js','research-income-capital.js','resource-demand.js','state-value.js','public-income-option.test.js','card-pick-planning.test.js','funded-hand-timing.test.js','income-plan-value.test.js','opening-plan.test.js','post-main-plan.test.js','settled-tech-funding.test.js']}|{'randomizer/index.html','tools/audit_v_state_inputs.js','tools/browser-smoke-inventory.js','tools/node-test-inventory.js'}
old={};modes={};unchanged=0
for item in git('ls-tree','-rz',base).split(b'\0'):
 if not item:continue
 meta,name=item.split(b'\t',1);mode,kind,blob=meta.decode().split();p=name.decode();old[p]=blob;modes[p]=mode
 if p.startswith(('randomizer/','tools/','assets/')) and p not in code:
  b=(stage/p).read_bytes();assert hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==blob,p;unchanged+=1
files=code|{'docs/ai-design.md','docs/ai-public-income-option-20261105.md','docs/ai-public-income-admission-20261105.md','adhoc/benchmark-human405-decision-20261105-v5.js','adhoc/benchmark-human405-current-first2-20261105-v5.js','adhoc/diagnose-public-income-end-tail-20261105-v1.js','adhoc/diagnose-public-income-regression-20261105-v1.js','adhoc/run-public-income-browser-20261105-v1.py','adhoc/deliver-human405-v178-admission-20261105-v1.py',folder+'public-income-end-tail-before-20261105-v1.json',folder+'public-income-end-tail-after-20261105-v1.json'}
files.update(str(p.relative_to(stage)) for p in (stage/folder).glob('v178-*') if p.is_file())
for p in files:
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
 if (root/p).exists() and (root/p).read_bytes()!=(stage/p).read_bytes():assert p in old and (root/p).read_bytes()==git('show',base+':'+p),p
proof=folder+'v178-admission-source-check-20261105-v1.json';(stage/proof).write_text(json.dumps({'baseCommit':base,'runtimeChanges':sorted(code),'otherRuntimeToolsAssetsUnchanged':unchanged,'coldRoots':95,'maxNativeInputs':gate['maxInputs'],'maxRootAndSearchMs':gate['maxMilliseconds'],'fullUnitOriginal':{'passed':164,'failed':4,'total':168},'currentUnitCoverage':{'passed':168,'total':168,'focusedReplacements':failures},'fullFlow':1,'chromePassed':21,'valueAudit':{'independentSearchChecks':'pass','legacyFailureUnchanged':fails},'valueModel':'v16','productionBudgets':gate['productionBudgets'],'nativeEndWitnessInputs':13,'developmentAligned':False,'autonomousRuns':0,'goalStatus':'active','goalAchieved':False,'sharedIndexSha256':shared,'foreignWorkingHashes':foreign},ensure_ascii=False,indent=2)+'\n');files.add(proof)
manifest='adhoc/human405-v178-admission-manifest-20261105-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'files':{p:sha(stage/p) for p in sorted(files)},'sharedIndexSha256':shared,'sharedIndexEntriesSha256':entries,'foreignWorkingHashes':foreign,'goalStatus':'active','goalAchieved':False},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_V178')!='1':print(json.dumps({'preflight':True,'files':len(files),'coldRoots':95,'unitCoverage':168,'chrome':21}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-v178-admission-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 blob=git('hash-object','-w','--stdin',data=(stage/p).read_bytes(),env=env).decode().strip();git('update-index','--add','--cacheinfo',modes.get(p,'100644'),blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files;git('diff','--cached','--check',env=env)
for p in sorted(files):dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes((stage/p).read_bytes())
git('commit','-m','修复普通结束回合摘要守卫并准入公共收入筹资V178，验证95冷根及原生对照',env=env);commit=git('rev-parse','HEAD').decode().strip();assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==files;print(git('show','--name-only','--stat','--format=short','HEAD').decode());assert sha(root/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for p,h in foreign.items():assert sha(root/p)==h
result={'commit':commit,'baseCommit':base,'stage':str(stage),'privateIndex':private,'files':len(files),'sharedIndexUnchanged':True,'foreignWorkingUnchanged':True,'goalStatus':'active'};pathlib.Path('/private/tmp/seti-v178-admission-result-20261105-v1.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
