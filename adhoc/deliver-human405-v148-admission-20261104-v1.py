import pathlib,subprocess,os,tempfile,json,hashlib,gzip,re
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='ec6b09f0056c6bf0d1cf299e543c3f1f991c70f9';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/'
def git(*a,data=None,env=None):return subprocess.check_output(['git',*a],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
assert git('rev-parse','HEAD').decode().strip()==base
shared=sha(root/'.git/index');assert shared=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49'
entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();foreign={p:sha(root/p)for p in ['reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html']}
core='''randomizer/game/ai/state-value.js
randomizer/game/ai/probe-capital.js
randomizer/game/ai/resource-demand.js
randomizer/game/ai/analysis-port.js
randomizer/game/ai/card-pick-planning.js
randomizer/game/ai/decision-search.js
randomizer/game/production-kernel.js
randomizer/index.html
randomizer/game/ai/funded-hand-timing.test.js
randomizer/game/ai/funded-research-value.test.js
randomizer/game/ai/card-pick-planning.test.js
randomizer/game/ai/probe-capital-value.test.js
randomizer/game/ai/blue-column-purpose.test.js
randomizer/game/ai/company-card-trade.test.js
randomizer/game/ai/income-plan-value.test.js
randomizer/game/ai/movement-preview-copy.test.js
randomizer/game/ai/resource-demand.test.js
randomizer/game/ai/probe-travel-tail.test.js
randomizer/game/ai/goal-movement.test.js
randomizer/game/ai/winning-income-plan.test.js
tools/node-test-inventory.js
tools/browser-smoke-inventory.js
docs/ai-design.md'''.splitlines()
files=set(core+['docs/ai-funded-hand-timing-v148-20261104.md','adhoc/deliver-human405-v148-admission-20261104-v1.py','adhoc/witness-v129-first-blue-native-20261104-v1.js','adhoc/human405-two-rounds-20261104-v2/ai-v129-step044-first-blue-20261104-v1.json'])
archives={}
for d in sorted((stage/'reports/ai-foundation-20261104').glob('rejected-v1*-runtime*-20261104-v1')):
 manifest=d/'manifest.json'
 if not manifest.exists():continue
 m=json.loads(manifest.read_text());version=int(re.search(r'rejected-v(\d+)',d.name).group(1))
 if not 130<=version<=147:continue
 archives[version]=(d,m)
 for p,h in (m['sourceHashes']if version in [130,131]else m['runtimeHashes']).items():assert sha(d/p)==h,(version,p)
 for p in d.rglob('*'):
  if p.is_file():files.add(str(p.relative_to(stage)))
assert set(archives)==set(range(130,148)),set(archives)
source_cache={};final_sources={};cold=[]
def check_evidence(path,version,final=False):
 r=read(path);assert r['complete']and r['rootAndRngUnchanged'];assert sha(stage/r['fixture'])==r['fixtureSha256'];assert sha(stage/r['rawPath'])==r['rawSha256'];raw=json.loads(gzip.decompress((stage/r['rawPath']).read_bytes()));assert raw['complete']and not raw['unresolved'];assert r['nativeInputs']==raw['diagnostics']['nativeExecutions'];assert all(v is None for v in r['diagnostics']['limits'].values());files.update([path,r['rawPath']])
 for p,h in r['sourceHashes'].items():
  key=(version,p)
  if key in source_cache:assert source_cache[key]==h;continue
  source_cache[key]=h
  if final:assert sha(stage/p)==h,p;final_sources[p]=h
  else:
   d,m=archives[version];src=d/p;expected=sha(src)if src.exists()else hashlib.sha256(git('show',m['baseCommit']+':'+p)).hexdigest();assert expected==h,(version,p)
 if final:assert r['nativeInputs']<=256 and r['milliseconds']<=600;cold.append(r)
 return r
for version in [130,131,144,147]:
 p=folder+f'v{version}-current-teacher-serial-gate-20261104-v1.json';g=read(p);assert g['status']=='complete'and len(g['rows'])==81;files.update([p,p.replace('.json','.log')])
 for row in g['rows']:check_evidence(row['evidence'],version)
for version in [144,147]:
 for n in ['044','050']:check_evidence(f'reports/ai-foundation-20261023/human405-v{version}-cold-actual{n}-funding-20261104-v1.json',version)
for version in range(132,148):
 p=f'reports/ai-foundation-20261023/human405-v{version}-cold-serial-case-105-20261104-v1.json';check_evidence(p,version)
gatepath=folder+'v148-current-teacher-serial-gate-20261104-v1.json';g=read(gatepath);assert g['status']=='complete'and len(g['rows'])==81 and not g['overruns'];assert all(v is None for v in g['productionBudgets'].values())
for row in g['rows']:check_evidence(row['evidence'],148,True)
for n in ['044','050']:check_evidence(f'reports/ai-foundation-20261023/human405-v148-cold-actual{n}-funding-20261104-v1.json',148,True)
if os.environ.get('SETI_ARCHIVES_ONLY')=='1':print(json.dumps({'archivesVerified':len(archives),'sourceBindingsVerified':len(source_cache),'coldRootsVerified':len(cold),'maxInputs':max(r['nativeInputs']for r in cold),'maxMilliseconds':max(r['milliseconds']for r in cold)}));raise SystemExit(0)
full=(stage/(folder+'v148-node-full-20261104-v1.log')).read_text();assert 'SUMMARY unit passed=161 failed=0 total=161'in full and 'SUMMARY fullFlow passed=1 failed=0 total=1'in full
chrome=(stage/(folder+'v148-chrome-ai-thirteen-20261104-v1.log')).read_text();assert 'SUMMARY browserSmoke passed=13 failed=0 total=13'in chrome
fails=[l for l in(stage/(folder+'v148-value-input-audit-20261104-v1.log')).read_text().splitlines()if l.startswith('[FAIL]')];assert len(fails)==1 and 'aomomo'in fails[0]and 'decisionObs'in fails[0]
for name in ['v129-first-blue-native-witness-20261104-v1.json','v129-first-blue-native-witness-20261104-v1.log','v129-orbit-land-native-assets-20261104-v1.json','v129-unfunded-hand-timing-native-red-20261104-v1.log','v129-unfunded-hand-native-red-source-20261104-v1.json','v129-unfunded-hand-native-red-test-20261104-v1.js']:
 assert(stage/(folder+name)).exists(),name;files.add(folder+name)
# Preserve source-bound failed samples and native proofs, without admitting them.
for p in (stage/folder).glob('v1*'):
 match=re.match(r'v(\d+)-',p.name)
 if p.is_file()and match and 130<=int(match.group(1))<=148 and p.name not in ['v130-before-period-name-state-value-20261104-v1.js','v130-pure-local-variable-rename-20261104-v1.json','v130-funding-profile-summary-20261104-v1.json']:files.add(str(p.relative_to(stage)))
for p in(stage/'adhoc').glob('*20261104-v1.js'):
 if re.match(r'(compare-v1(3[6-9]|4[0-8])-identity|verify-v14[234]-|diagnose-v1(32|36)-)',p.name):files.add(str(p.relative_to(stage)))
for v in [129,131,144,147]:
 name={129:'v129-unfunded-hand-native-red-source-20261104-v1.json',131:'v131-income-catalog-red-source-20261104-v1.json',144:'v144-data-income-preview-red-source-20261104-v1.json',147:'v147-actual-budget-reservation-red-source-20261104-v1.json'}[v];r=read(folder+name);assert sha(stage/r['testArchive'])==r['testSha256']
assert '4.5 !== 2.5'in(stage/(folder+'v129-unfunded-hand-timing-native-red-20261104-v1.log')).read_text()
assert 'actual256-input closure must not be rejected'in(stage/(folder+'v147-actual-budget-reservation-red-20261104-v1.log')).read_text()
assert 'canonical meta.sequences'in(stage/(folder+'v144-data-income-preview-red-20261104-v1.log')).read_text()
proof=read(folder+'v148-identity-native-parity-20261104-v1.json');assert proof['completeAllRootAndLineParity']and proof['exactPrefixGraphParity']and proof['byteEquivalentDurablePlanKeys']and proof['certificateRows']==24
assert sha(stage/proof['afterSource'])==proof['afterSourceSha256']
geo=read(folder+'v144-requested-endpoint-native-parity-20261104-v1.json');assert geo['nativeQueries']==94 and geo['allRequestedQueriesEqual']and geo['completeDirectoriesUnchanged'];assert sha(stage/geo['currentSource'])==geo['currentSourceSha256']
# Every other tracked code/data file must still be the exact delivery base.
old={};checked=0
for entry in git('ls-tree','-rz',base).split(b'\0'):
 if not entry:continue
 meta,name=entry.split(b'\t',1);p=name.decode();old[p]=meta.decode().split()[2]
 if p.startswith(('randomizer/','tools/','assets/'))and p not in core:
  b=(stage/p).read_bytes();assert hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==old[p],p;checked+=1
for p in core:
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
proofpath=folder+'v148-admission-source-check-20261104-v1.json';(stage/proofpath).write_text(json.dumps({'baseCommit':base,'runtimeSourceHashes':final_sources,'unchangedCodeDataFiles':checked,'coldRoots':len(cold),'maxInputs':max(r['nativeInputs']for r in cold),'maxMilliseconds':max(r['milliseconds']for r in cold),'unitPassed':161,'fullFlowPassed':1,'relatedChromePassed':13,'legacyAuditFailure':fails,'preservedDrafts':sorted(archives),'productionBudget':g['productionBudgets'],'stateIdentityAndPersistedKeysUnchanged':True,'originalRootAndRngUnchanged':True,'userBoundary':'before-PASS-card-and-next-income','goalStatus':'active','goalAchieved':False,'newAutonomousRunPending':True,'baselineUnchanged':'ai-search-v41-baseline-20261029'},indent=2)+'\n');files.add(proofpath)
# Include already-tracked evidence in the proof manifest, but write only deltas.
deltas=set()
for p in files:
 b=(stage/p).read_bytes();blob=hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
 if old.get(p)!=blob:deltas.add(p)
manifest='adhoc/human405-v148-admission-manifest-20261104-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'files':{p:sha(stage/p)for p in sorted(files)},'changedFiles':sorted(deltas),'sharedIndexSha256':shared,'sharedIndexEntriesSha256':entries,'foreignRegistryHashes':foreign,'goalStatus':'active'},indent=2)+'\n');deltas.add(manifest)
for p in deltas:
 if(root/p).exists()and(root/p).read_bytes()!=(stage/p).read_bytes():assert p in old and(root/p).read_bytes()==git('show',base+':'+p),('overlap',p)
if os.environ.get('SETI_DELIVER_V148')!='1':print(json.dumps({'preflight':True,'files':len(deltas),'coldRoots':len(cold),'runtimeSources':len(final_sources),'goalStatus':'active'}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-v148-admission-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(deltas):
 b=(stage/p).read_bytes();blob=git('hash-object','-w','--stdin',data=b,env=env).decode().strip();git('update-index','--add','--cacheinfo','100644',blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==deltas
git('diff','--cached','--check','--','.',*[f':(exclude){d.relative_to(stage)}/**'for d,m in archives.values()],env=env)
for p in sorted(deltas):
 dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes((stage/p).read_bytes())
git('commit','-m','按实际支付轮次评估持牌科技，统一收入准备并验收v148',env=env);commit=git('rev-parse','HEAD').decode().strip();assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==deltas
print(git('show','--stat','--format=short','HEAD').decode());assert sha(root/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for p,h in foreign.items():assert sha(root/p)==h,p
result={'commit':commit,'privateIndex':private,'files':len(deltas),'sharedIndexUnchanged':True,'foreignRegistryUnchanged':True,'goalStatus':'active'};pathlib.Path('/private/tmp/seti-v148-admission-result-20261104-v1.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
