"""Admit only source-bound PASS-knowledge fix after cold and shared-runtime checks."""
import hashlib,json,pathlib,subprocess,os,tempfile,gzip
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='aeb6462c952a11914811ce423025b56791faaf80'
def git(*args,data=None,env=None):return subprocess.check_output(['git',*args],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
assert git('rev-parse','HEAD').decode().strip()==base
assert git('symbolic-ref','--short','HEAD').decode().strip()=='dev'
ih=sha(root/'.git/index');eh=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();assert ih=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49' and eh=='9e3d88268694038e1c8b530e6f372baae5a0157d269d9e4e7916841980040c30'
prefix='reports/ai-foundation-20261023/'
a=read(prefix+'human405-round1-v123-audit-20261030-v1.json');c=read(prefix+'human405-v123-compat-cold-20261031-v1.json');cross=read(prefix+'human405-v123-cold-admission-crosscheck-20261031-v1.json');assert len(a['rows'])==32 and len(c['rows'])==13 and not a['speedOverruns'] and not c['overruns'];assert cross['sameActionValueAndNativeInputsAsV121'] and cross['maxInputs']<=256 and cross['slowest'][2]<=600
node=(stage/(prefix+'human405-v123-node-full-20261031-v1.log')).read_text();chrome=(stage/(prefix+'human405-v123-chrome-nine-20261031-v1.log')).read_text()
assert 'SUMMARY unit passed=155 failed=0 total=155' in node and 'SUMMARY fullFlow passed=1 failed=0 total=1' in node and 'positiveKnownPurposeValueDelta' in node
assert 'SUMMARY browserSmoke passed=9 failed=0 total=9' in chrome and 'PASS production-known-pass-card' in chrome
value=(stage/(prefix+'human405-v123-value-input-audit-20261031-v1.log')).read_text();fails=[s for s in value.splitlines() if s.startswith('[FAIL]')];assert len(fails)==1 and 'decisionObs' in fails[0] and 'aomomo' in fails[0]
geometry=read(prefix+'human405-v123-identity-solar-differential-20261031-v1.json');assert geometry['geometryChecks']==9100 and geometry['identityChecks']==1440
old=read(prefix+'human405-v122-cold-case-105-20261031-v1.json');assert old['complete'] and old['nativeInputs']==241 and old['milliseconds']>600
archive=json.loads(gzip.decompress((stage/'adhoc/human405-v122-overrun-source-20261031-v1.json.gz').read_bytes()));assert archive['baseCommit']==base
old_sources={}
for p,h in archive['sourceHashes'].items():
 data=archive['overlays'][p].encode() if p in archive['overlays'] else git('show',base+':'+p);assert hashlib.sha256(data).hexdigest()==h;old_sources[p]=h
assert old['sourceHashes']==old_sources
runtime=['randomizer/game/rule-composition.js','randomizer/game/ai/analysis-port.js','randomizer/game/ai/decision-search.js','randomizer/solar-system/core.js','randomizer/index.html','randomizer/game/ai/known-pass-card.test.js','tools/node-test-inventory.js','tools/browser-smoke-inventory.js']
files=set(runtime+['docs/ai-design.md','docs/ai-known-pass-card-20261031.md','adhoc/human405-v122-known-pass-design-20261031-v1.json','adhoc/human405-v122-overrun-source-20261031-v1.json.gz','adhoc/human405-v122-case105-profile-20261031-v1.cpuprofile.gz','adhoc/verify-human405-identity-solar-20261031-v3.js','adhoc/audit-human405-v122-compat-cold-20261031-v1.js','adhoc/audit-human405-v123-compat-cold-20261031-v1.js','adhoc/deliver-human405-v123-admission-20261031-v1.py','adhoc/human405-round1-progress-20261031-v33.json'])
for p in (stage/prefix).iterdir():
 if p.is_file() and (p.name.startswith(('human405-v122-','human405-v123-','human405-round1-v122-','human405-round1-v123-'))):files.add(str(p.relative_to(stage)))
assert not any('/versions.json' in p or '/registry.json' in p or p.endswith('robot-iteration.html') for p in files)
verified_sources={}
for p in sorted(files):
 if not p.endswith('.json'):continue
 r=read(p)
 for source,h in r.get('sourceHashes',{}).items():
  if 'v122' in pathlib.Path(p).name and source.startswith('randomizer/'):
   assert old_sources[source]==h;continue
  assert sha(stage/source)==h,(p,source)
  verified_sources[source]=h
 if r.get('rawPath'):assert r['rawPath'] in files and sha(stage/r['rawPath'])==r['rawSha256']
for row in a['rows']+c['rows']:assert row['evidencePath'] in files
for p in runtime:
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
# Compare the entire tested tracked code/data surface against the exact proposed tree.
tracked={}
for entry in git('ls-tree','-rz',base).split(b'\0'):
 if not entry:continue
 info,path=entry.split(b'\t',1);p=path.decode();blob=info.decode().split()[2]
 if p.startswith(('randomizer/','tools/','assets/','adhoc/')):
  if p not in files:
   b=(stage/p).read_bytes();assert hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==blob,('foreign test dependency',p)
  tracked[p]=blob
proof=prefix+'human405-v123-tested-snapshot-proof-20261031-v1.json'
(stage/proof).write_text(json.dumps({'baseCommit':base,'exactTrackedCodeDataFiles':len(tracked),'selectedChanges':{p:sha(stage/p) for p in runtime},'sourceBoundReportsVerified':True,'node':{'unit':155,'fullFlow':1},'chrome':9,'legacyValueInputFailure':fails,'goalStatus':'active','fullGameAdmitted':False,'nextAction':'one standard robot_iterate white R1 after commit'},ensure_ascii=False,indent=2)+'\n');files.add(proof)
manifest='adhoc/human405-v123-admission-delivery-manifest-20261031-v1.json'
(stage/manifest).write_text(json.dumps({'baseCommit':base,'snapshot':str(stage),'files':{p:sha(stage/p) for p in sorted(files)},'sharedIndexSha256Before':ih,'sharedIndexEntriesSha256Before':eh,'goalStatus':'active','fullGameAdmitted':False,'baselineUnchanged':'ai-search-v41-baseline-20261029'},ensure_ascii=False,indent=2)+'\n');files.add(manifest)
for p in files:
 if (root/p).exists() and (root/p).read_bytes()!=(stage/p).read_bytes():assert (root/p).read_bytes()==git('show',base+':'+p),('overlapping root edit',p)
if os.environ.get('SETI_DELIVER_V123_ADMISSION')!='1':print(json.dumps({'phase':'preflight','files':len(files),'exactTestedCodeDataFiles':len(tracked),'goalStatus':'active'}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-human405-v123-admission-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 b=(stage/p).read_bytes();dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(b);blob=git('hash-object','-w','--stdin',data=b,env=env).decode().strip();git('update-index','--add','--cacheinfo','100644',blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files
git('diff','--cached','--check',env=env);assert sha(root/'.git/index')==ih
git('commit','-m','保留PASS已知选牌及科技用途，减少轮盘字段重复构造',env=env)
commit=git('rev-parse','HEAD').decode().strip();assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==files
print(git('show','--name-only','--stat','--format=short','HEAD').decode());assert sha(root/'.git/index')==ih and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==eh
print(json.dumps({'commit':commit,'privateIndex':private,'files':len(files),'sharedIndexUnchanged':True,'goalStatus':'active','nextAction':'one standard white R1'}))
