import pathlib,subprocess,os,tempfile,json,hashlib
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='ba59a814e8bd829c8ee1a71a56ce1a6a9edffccf';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/';archive='reports/ai-foundation-20261104/candidate-v185-sector-data-tail-20261105-v1/'
def git(*args,data=None,env=None):return subprocess.check_output(['git',*args],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def blob(b):return hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
assert git('rev-parse','HEAD').decode().strip()==base
shared=sha(root/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();foreign={p:sha(root/p) for p in ['reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html']}
m=json.loads((stage/(archive+'manifest.json')).read_text());assert not m['admitted'] and m['officialRuns']==0 and m['fullUnitPassed']==170 and m['fullFlowPassed']==1 and m['uniqueColdRoots']==189
subprocess.run(['python3','adhoc/materialize-sector-data-tail-candidate-20261105-v1.py','--verify-only'],cwd=stage,check=True)
old={};modes={};changed=[]
for item in git('ls-tree','-rz',base).split(b'\0'):
 if not item:continue
 meta,name=item.split(b'\t',1);mode,kind,h=meta.decode().split();p=name.decode();old[p]=h;modes[p]=mode
 if p.startswith(('randomizer/','tools/','assets/')):
  assert blob((root/p).read_bytes())==h,p
  if blob((stage/p).read_bytes())!=h:changed.append(p)
assert set(changed)=={'randomizer/game/ai/state-value.js','randomizer/game/ai/decision-search.js','randomizer/game/ai/sector-card-capital.test.js'}
for p,h in m['allLoadedRuntimeHashes'].items():assert sha(stage/p)==h,p
files={str(p.relative_to(stage)) for p in (stage/archive).rglob('*') if p.is_file()}
files.update(str(p.relative_to(stage)) for p in (stage/folder).glob('v185-*') if p.is_file())
files.update(['docs/ai-design.md','docs/ai-sector-data-tail-20261105.md','adhoc/sector-data-tail-contract-20261105-v1.md','adhoc/purpose-realization-tie-design-20261105-v1.md','adhoc/human405-two-rounds-progress-20261105-v15.json','adhoc/benchmark-human405-current-first2-20261105-v9.js','adhoc/witness-v185-round2-purpose-realization-20261105-v1.js','adhoc/archive-sector-data-tail-candidate-20261105-v1.py','adhoc/materialize-sector-data-tail-candidate-20261105-v1.py','adhoc/deliver-sector-data-tail-candidate-20261105-v1.py'])
assert not any(p.startswith(('randomizer/','tools/','assets/')) for p in files)
for p in files:
 if (root/p).exists() and (root/p).read_bytes()!=(stage/p).read_bytes():assert p in old and blob((root/p).read_bytes())==old[p],p
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
# Only the copied decision-search file inherits two whitespace-only lines;
# preserve byte-identical measured source, prove those lines predate this patch.
exempt=archive+'randomizer/game/ai/decision-search.js';copied=(stage/exempt).read_text().splitlines();original=git('show',base+':randomizer/game/ai/decision-search.js').decode().splitlines()
assert [(i,l) for i,l in enumerate(copied) if l.rstrip()!=l]==[(i,l) for i,l in enumerate(original) if l.rstrip()!=l]
manifest='adhoc/sector-data-tail-candidate-delivery-20261105-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'files':{p:sha(stage/p) for p in sorted(files)},'productionUnchanged':True,'sharedIndexSha256':shared,'sharedIndexEntriesSha256':entries,'foreignRegistries':foreign,'admitted':False,'officialRuns':0,'goalStatus':'active','goalAchieved':False},ensure_ascii=False,indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_SECTOR_DATA_TAIL')!='1':print(json.dumps({'preflight':True,'files':len(files),'candidateSources':changed,'productionUnchanged':True}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-sector-data-tail-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 h=git('hash-object','-w','--stdin',data=(stage/p).read_bytes(),env=env).decode().strip();git('update-index','--add','--cacheinfo',modes.get(p,'100644'),h,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files
git('diff','--cached','--check','--','.',':(exclude)'+exempt,env=env)
for p in sorted(files):dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes((stage/p).read_bytes())
git('commit','-m','归档V185数据尾部资本修复及189冷根验证，保留同值PASS待处理',env=env);commit=git('rev-parse','HEAD').decode().strip();assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files
assert sha(root/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for p,h in foreign.items():assert sha(root/p)==h,p
assert not git('diff','--name-only',base,commit,'--','randomizer','tools','assets').strip()
result={'commit':commit,'privateIndex':private,'files':len(files),'productionRuntime':'V184/V18','candidateRuntime':'V185/V19','candidateArchive':archive+'manifest.json','admitted':False,'officialRuns':0,'sharedIndexUnchanged':True,'foreignRegistriesUnchanged':True,'goalStatus':'active'};pathlib.Path('/private/tmp/seti-sector-data-tail-delivery-20261105-v1.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
