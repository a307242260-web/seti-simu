import pathlib,subprocess,os,tempfile,json,hashlib,gzip,re
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='99a23861f4e38200ee8609f3bb9c5d89b6b96b9c';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/'
def git(*a,data=None,env=None):return subprocess.check_output(['git',*a],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
assert git('rev-parse','HEAD').decode().strip()==base
shared=sha(root/'.git/index');assert shared=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49';entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();foreign={p:sha(root/p)for p in ['reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html']}
core='''randomizer/game/ai/state-value.js
randomizer/game/ai/probe-capital.js
randomizer/game/ai/ready-analysis-capital.js
randomizer/game/ai/ready-analysis-capital.test.js
randomizer/game/ai/resource-demand.js
randomizer/game/ai/analysis-port.js
randomizer/game/ai/decision-search.js
randomizer/game/ai/inert-sector-task.test.js
randomizer/game/ai/post-main-income.test.js
randomizer/index.html
tools/node-test-inventory.js
tools/browser-smoke-inventory.js
docs/ai-ready-analysis-capital-20261104.md
docs/ai-design.md'''.splitlines()
files=set(core+['adhoc/deliver-human405-v151-admission-20261104-v1.py','adhoc/human405-two-rounds-progress-20261104-v10.json']);archives={}
for version in [149,150]:
 d=stage/f'reports/ai-foundation-20261104/rejected-v{version}-runtime-20261104-v1';m=json.loads((d/'manifest.json').read_text());assert m['baseCommit']==base and not m['admitted'];archives[version]=(d,m)
 for p,h in m['archivedHashes'].items():assert sha(d/p)==h
 for p in d.rglob('*'):
  if p.is_file():files.add(str(p.relative_to(stage)))
sources={};loaded={};cold=[]
def check(path,version,final=False):
 r=read(path);assert r['complete']and r['rootAndRngUnchanged'];assert sha(stage/r['fixture'])==r['fixtureSha256']and sha(stage/r['rawPath'])==r['rawSha256'];raw=json.loads(gzip.decompress((stage/r['rawPath']).read_bytes()));assert raw['complete']and not raw['unresolved']and r['nativeInputs']==raw['diagnostics']['nativeExecutions'];assert all(x is None for x in raw['diagnostics']['limits'].values());files.update([path,r['rawPath']])
 for p,h in r['sourceHashes'].items():
  key=(version,p)
  if key in loaded:assert loaded[key]==h;continue
  loaded[key]=h
  if final:assert sha(stage/p)==h,p;sources[p]=h
  else:
   d,m=archives[version];expected=sha(d/p)if(d/p).exists()else hashlib.sha256(git('show',base+':'+p)).hexdigest();assert h==expected,(version,p)
 if final:assert r['nativeInputs']<=256 and r['milliseconds']<=600;cold.append(r)
 return r
for version,label in [(149,'serial-case-105'),(149,'profile-case105')]:check(f'reports/ai-foundation-20261023/human405-v{version}-cold-{label}-20261104-v1.json',version)
g150=read(folder+'v150-current-teacher-serial-gate-20261104-v1.json');assert g150['status']=='complete'and len(g150['rows'])==81 and len(g150['overruns'])==1 and g150['overruns'][0]['nativeInputs']==261
for row in g150['rows']:check(row['evidence'],150)
g=read(folder+'v151-current-teacher-serial-gate-20261104-v1.json');assert g['status']=='complete'and len(g['rows'])==81 and not g['overruns'];assert all(x is None for x in g['productionBudgets'].values())
for row in g['rows']:check(row['evidence'],151,True)
for label in ['actual044-funding','actual050-funding','actual-v148-077-ready-analysis']:check(f'reports/ai-foundation-20261023/human405-v151-cold-{label}-20261104-v1.json',151,True)
assert len(cold)==84
for p in(stage/folder).glob('v1*'):
 match=re.match(r'v(\d+)-',p.name)
 if p.is_file()and match and 149<=int(match.group(1))<=151 and p.suffix!='.cpuprofile':files.add(str(p.relative_to(stage)))
files.add(folder+'v148-ready-analysis-capital-red-20261104-v1.log')
p=read(folder+'v150-held-quote-parity-20261104-v1.json');assert p['allRootsEqual']and p['allLinesEqual']and p['beforeInputs']==p['afterInputs']==256
profile=read(folder+'v149-ready-analysis-hotpath-summary-20261104-v1.json');compressed=stage/(folder+'v149-ready-analysis-hotpath-20261104-v1.cpuprofile.gz');assert hashlib.sha256(gzip.decompress(compressed.read_bytes())).hexdigest()==profile['profileSha256']
assert next(x for x in g['rows']if x['label']=='teacher-092')['actionId']=='research_tech:806ccfc8'and next(x for x in g['rows']if x['label']=='teacher-092')['value']==90
if os.environ.get('SETI_PROVENANCE_ONLY')=='1':print(json.dumps({'archives':2,'sourceBindings':len(loaded),'coldRoots':84,'maxInputs':max(x['nativeInputs']for x in cold),'maxMilliseconds':max(x['milliseconds']for x in cold)}));raise SystemExit(0)
full=(stage/(folder+'v151-node-full-20261104-v2.log')).read_text();assert 'SUMMARY unit passed=162 failed=0 total=162'in full and 'SUMMARY fullFlow passed=1 failed=0 total=1'in full
chrome=(stage/(folder+'v151-chrome-ai-fourteen-20261104-v2.log')).read_text();assert 'SUMMARY browserSmoke passed=14 failed=0 total=14'in chrome
fails=[x for x in(stage/(folder+'v151-value-input-audit-20261104-v1.log')).read_text().splitlines()if x.startswith('[FAIL]')];assert len(fails)==1 and 'aomomo'in fails[0]and 'decisionObs'in fails[0]
assert '"nativeFundedControls":176,"unfunded":16,"nativeInputs":824'in full
assert 'seti-purpose-capital-state-value-v9'in(stage/'randomizer/game/ai/state-value.js').read_text()and 'seti-complete-decision-search-v151'in(stage/'randomizer/game/ai/decision-search.js').read_text()
old={};checked=0
for entry in git('ls-tree','-rz',base).split(b'\0'):
 if not entry:continue
 meta,name=entry.split(b'\t',1);p=name.decode();old[p]=meta.decode().split()[2]
 if p.startswith(('randomizer/','tools/','assets/'))and p not in core:
  b=(stage/p).read_bytes();assert hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==old[p],p;checked+=1
for p in core:
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
proof=folder+'v151-admission-source-check-20261104-v1.json';(stage/proof).write_text(json.dumps({'baseCommit':base,'runtimeSourceHashes':sources,'unchangedCodeDataFiles':checked,'coldRoots':84,'maxInputs':max(x['nativeInputs']for x in cold),'maxMilliseconds':max(x['milliseconds']for x in cold),'unitPassed':162,'fullFlowPassed':1,'chromePassed':14,'nativeControls':192,'moneyOrderControls':168,'analysisReadinessBoundControls':3,'knownLegacyAuditFailure':fails,'rejectedDrafts':[149,150],'productionBudgets':g['productionBudgets'],'roundEnd':'before-PASS-card-and-next-income','baselineUnchanged':'ai-search-v41-baseline-20261029','newAutonomousRunPending':True,'goalStatus':'active','goalAchieved':False},indent=2)+'\n');files.add(proof)
deltas=set()
for p in files:
 b=(stage/p).read_bytes();blob=hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
 if old.get(p)!=blob:deltas.add(p)
manifest='adhoc/human405-v151-admission-manifest-20261104-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'files':{p:sha(stage/p)for p in sorted(files)},'changedFiles':sorted(deltas),'sharedIndexSha256':shared,'sharedIndexEntriesSha256':entries,'foreignRegistryHashes':foreign,'goalStatus':'active','goalAchieved':False},indent=2)+'\n');deltas.add(manifest)
for p in deltas:
 if(root/p).exists()and(root/p).read_bytes()!=(stage/p).read_bytes():assert p in old and(root/p).read_bytes()==git('show',base+':'+p),('overlap',p)
if os.environ.get('SETI_DELIVER_V151')!='1':print(json.dumps({'preflight':True,'files':len(deltas),'coldRoots':84,'runtimeSources':len(sources)}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-v151-admission-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(deltas):
 b=(stage/p).read_bytes();blob=git('hash-object','-w','--stdin',data=b,env=env).decode().strip();git('update-index','--add','--cacheinfo','100644',blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==deltas;git('diff','--cached','--check','--','.',*[f':(exclude){d.relative_to(stage)}/**'for d,m in archives.values()],env=env)
for p in sorted(deltas):
 dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes((stage/p).read_bytes())
git('commit','-m','统一已就绪分析与研究资金估值，验证原生次序及v151搜索门槛',env=env);commit=git('rev-parse','HEAD').decode().strip();assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==deltas;print(git('show','--name-only','--stat','--format=short','HEAD').decode());assert sha(root/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for p,h in foreign.items():assert sha(root/p)==h,p
result={'commit':commit,'privateIndex':private,'files':len(deltas),'sharedIndexUnchanged':True,'foreignRegistryUnchanged':True,'goalStatus':'active'};pathlib.Path('/private/tmp/seti-v151-admission-result-20261104-v1.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
