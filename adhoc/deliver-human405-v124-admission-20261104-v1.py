import pathlib,subprocess,os,json,tempfile,hashlib,gzip
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='66dff952852a88499a7cd4b7a062a25040e799ef';folder='reports/ai-foundation-20261104/two-rounds-teacher-v1/'
def git(*a,data=None,env=None):return subprocess.check_output(['git',*a],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
assert git('rev-parse','HEAD').decode().strip()==base;ih=sha(root/'.git/index');eh=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();assert ih=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49'
assert 'unit passed=158 failed=0 total=158' in (stage/(folder+'v124-node-full-20261104-v1.log')).read_text();assert 'fullFlow passed=1 failed=0 total=1' in (stage/(folder+'v124-node-full-20261104-v1.log')).read_text();assert 'browserSmoke passed=10 failed=0 total=10' in (stage/(folder+'v124-chrome-ten-20261104-v1.log')).read_text()
fails=[line for line in (stage/(folder+'v124-value-input-audit-20261104-v1.log')).read_text().splitlines() if line.startswith('[FAIL]')];assert len(fails)==1 and 'decisionObs' in fails[0] and 'aomomo' in fails[0]
gate=read(folder+'v124-first2-cold-gate-20261104-v1.json');assert len(gate['rows'])==81 and not gate['overruns'];assert gate['maxInputs']<=256 and gate['maxMilliseconds']<=600
runtime=['randomizer/game/ai/state-value.js','randomizer/game/ai/decision-search.js','randomizer/index.html','randomizer/game/ai/conditional-research-capital.test.js','tools/research-human405-round1.js','tools/run_research_validation.js','tools/research-human405-full.test.js','tools/research-human405-first2.test.js','tools/robot-ai-generation.test.js','tools/node-test-inventory.js','tools/browser-smoke-inventory.js']
files=set(runtime+['docs/ai-design.md','docs/robot-iteration-registry.md','docs/human405-two-rounds-plan-20261104.md','adhoc/extract-human405-two-rounds-20261104-v1.js','adhoc/capture-human405-round-end-assets-20261104-v1.js','adhoc/benchmark-human405-decision-20261104-v1.js','adhoc/benchmark-human405-first2-corpus-20261104-v1.js','adhoc/human405-two-rounds-progress-20261104-v1.json','adhoc/deliver-human405-v124-admission-20261104-v1.py'])
for directory in [folder,'adhoc/human405-two-rounds-20261104-v1']:
 for p in (stage/directory).rglob('*'):
  if p.is_file():files.add(str(p.relative_to(stage)))
for p in (stage/'reports/ai-foundation-20261023').glob('human405-v124-*-20261104-v1*'):files.add(str(p.relative_to(stage)))
sources={}
for row in gate['rows']:
 p=row['evidence'];r=read(p);assert row['complete'] and row['rootAndRngUnchanged'];assert sha(stage/r['fixture'])==r['fixtureSha256'];assert r['rawPath'] in files and sha(stage/r['rawPath'])==r['rawSha256'];raw=json.loads(gzip.decompress((stage/r['rawPath']).read_bytes()));assert raw['complete'] and not raw['unresolved'];assert raw['diagnostics']['nativeExecutions']<=256 and r['milliseconds']<=600
 for p,h in r['sourceHashes'].items():
  if p in sources:assert sources[p]==h;continue
  assert sha(stage/p)==h;sources[p]=h
canonical=read(folder+'canonical-round-end-assets-20261104-v1.json');t=canonical['sources']['teacher']['rounds'][1];a=canonical['sources']['aiV123']['rounds'][1];assert [t['resources'][k] for k in ['credits','energy','availableData']]==[4,1,0];assert [a['resources'][k] for k in ['credits','energy','availableData']]==[1,1,0];assert not t['hand'] and not a['hand'];assert len(t['probes'])==1 and not a['probes'];assert len(t['sectorWins'])==1 and not a['sectorWins']
for data in canonical['sources'].values():
 assert sha(stage/data['source'])==data['sourceSha256']
 for r in data['rounds']:assert sha(stage/r['checkpoint'])==r['checkpointSha256']
# Native baseline predates the model fix; its production sources are anchored to66dff952.
baseline=read(folder+'teacher-v123-two-round-comparison-20261104-v1.json');assert len(baseline['roots'])==67
for p,h in baseline['sourceHashes'].items():assert hashlib.sha256(git('show',base+':'+p)).hexdigest()==h,p
checked=0
for entry in git('ls-tree','-rz',base).split(b'\0'):
 if not entry:continue
 meta,name=entry.split(b'\t',1);p=name.decode()
 if p.startswith(('randomizer/','tools/','assets/')) and p not in files:
  b=(stage/p).read_bytes();assert hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==meta.decode().split()[2],p;checked+=1
for p in files:
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
proof=folder+'v124-admission-source-check-20261104-v1.json';(stage/proof).write_text(json.dumps({'baseCommit':base,'runtimeSourceHashes':sources,'verifiedUnchangedCodeDataFiles':checked,'unit':158,'fullFlow':1,'chrome':10,'coldRoots':81,'maxInputs':gate['maxInputs'],'maxMilliseconds':gate['maxMilliseconds'],'legacyValueInputFailure':fails,'userRoundEnd':'before-PASS-card-and-next-income','goalStatus':'active','autonomousFirst2RunPending':True,'baselineUnchanged':'ai-search-v41-baseline-20261029'},indent=2)+'\n');files.add(proof)
manifest='adhoc/human405-v124-admission-manifest-20261104-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'snapshot':str(stage),'files':{p:sha(stage/p) for p in sorted(files)},'sharedIndexSha256':ih,'sharedIndexEntriesSha256':eh,'goalStatus':'active'},indent=2)+'\n');files.add(manifest)
old=set(git('ls-tree','-r','--name-only',base).decode().splitlines())
for p in files:
 if (root/p).exists() and (root/p).read_bytes()!=(stage/p).read_bytes():assert p in old and (root/p).read_bytes()==git('show',base+':'+p),('overlap',p)
if os.environ.get('SETI_DELIVER_V124')!='1':print(json.dumps({'preflight':True,'files':len(files),'coldRoots':81,'unchangedCodeDataFiles':checked,'goalStatus':'active'}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-v124-admission-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 b=(stage/p).read_bytes();d=root/p;d.parent.mkdir(parents=True,exist_ok=True);d.write_bytes(b);blob=git('hash-object','-w','--stdin',data=b,env=env).decode().strip();git('update-index','--add','--cacheinfo','100644',blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files;git('diff','--cached','--check',env=env);git('commit','-m','修正条件科技资本，新增前两轮PASS前资产对照与独立验收',env=env);commit=git('rev-parse','HEAD').decode().strip();assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==files;print(git('show','--name-only','--stat','--format=short','HEAD').decode());assert sha(root/'.git/index')==ih and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==eh
print(json.dumps({'commit':commit,'privateIndex':private,'files':len(files),'sharedIndexUnchanged':True,'goalStatus':'active'}))
