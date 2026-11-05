import pathlib,subprocess,os,tempfile,json,hashlib
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='bdb1f76e93f801e52748e3665ffc555d90937e08';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/';archive='reports/ai-foundation-20261104/candidate-v188-sector-mission-20261105-v1/'
def git(*args,data=None,env=None):return subprocess.check_output(['git',*args],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def blob(b):return hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
assert git('rev-parse','HEAD').decode().strip()==base
m=json.loads((stage/archive/'manifest.json').read_text());assert m['candidateAdmitted'] is False and m['sourceAdmissionRefused'] and m['newAutonomousRuns']==0 and m['maxRootAndSearchMs']>600
for p,h in m['sourceFiles'].items():assert sha(stage/p)==h and sha(stage/archive/'files'/p)==h
shared=sha(root/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();foreign={p:sha(root/p)for p in ['reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html']};old={};modes={}
for item in git('ls-tree','-rz',base).split(b'\0'):
 if not item:continue
 meta,name=item.split(b'\t',1);mode,kind,h=meta.decode().split();p=name.decode();old[p]=h;modes[p]=mode
 if p.startswith(('randomizer/','tools/','assets/')):assert blob((root/p).read_bytes())==h,p
files={'docs/ai-design.md','docs/ai-sector-mission-composition-20261105.md','adhoc/human405-two-rounds-progress-20261105-v20.json','adhoc/sector-mission-composition-contract-20261105-v1.md','adhoc/benchmark-human405-current-first2-20261105-v12.js','adhoc/benchmark-human405-decision-20261105-v12.js','adhoc/run-sector-mission-browser-20261105-v1.py','adhoc/deliver-sector-mission-admission-20261105-v1.py','adhoc/deliver-v188-candidate-archive-20261105-v1.py','adhoc/diagnose-v187-known-swap-capital-20261105-v1.js','adhoc/profile-v187-sector-mission-prefix-20261105-v1.js','adhoc/profile-v188-case105-20261105-v1.js','adhoc/summarize-v188-case105-profile-20261105-v1.js'}
files.update(str(p.relative_to(stage))for p in(stage/archive).rglob('*')if p.is_file());files.update(str(p.relative_to(stage))for pattern in ['v187-*','v188-*']for p in(stage/folder).glob(pattern)if p.is_file());files={p for p in files if p not in old or blob((stage/p).read_bytes())!=old[p]};assert not any(p.startswith(('randomizer/','tools/','assets/'))for p in files)
for p in files:
 if(root/p).exists()and(root/p).read_bytes()!=(stage/p).read_bytes():assert p in old and blob((root/p).read_bytes())==old[p],p
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
manifest='adhoc/v188-candidate-archive-delivery-manifest-20261105-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'files':{p:sha(stage/p)for p in sorted(files)},'sharedIndexSha256':shared,'sharedIndexEntriesSha256':entries,'foreignWorkingHashes':foreign,'productionRuntimeUnchanged':'V187/V21','candidateAdmitted':False,'goalStatus':'active'},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_V188_ARCHIVE')!='1':print(json.dumps({'preflight':True,'files':len(files),'productionRuntimeUnchanged':True}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-v188-archive-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 h=git('hash-object','-w','--stdin',data=(stage/p).read_bytes(),env=env).decode().strip();git('update-index','--add','--cacheinfo',modes.get(p,'100644'),h,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files
legacy=archive+'files/randomizer/game/ai/decision-search.js'
trailing=lambda content:[(i+1,line)for i,line in enumerate(content.decode().splitlines())if line!=line.rstrip()]
assert trailing((stage/legacy).read_bytes())==trailing(git('show',base+':randomizer/game/ai/decision-search.js')) and len(trailing((stage/legacy).read_bytes()))==2
git('diff','--cached','--check','--','.',':(exclude)'+legacy,env=env)
for p in sorted(files):dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes((stage/p).read_bytes())
git('commit','-m','归档V188条件扫描资本修复与308冷根，保留608毫秒未准入证据',env=env);commit=git('rev-parse','HEAD').decode().strip();assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files
assert not git('diff','--name-only',base,commit,'--','randomizer','tools','assets').strip();assert sha(root/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for p,h in foreign.items():assert sha(root/p)==h
result={'commit':commit,'baseCommit':base,'privateIndex':private,'stage':str(stage),'files':len(files),'productionRuntimeUnchanged':'V187/V21','candidateRuntime':'V188/V22','candidateAdmitted':False,'goalStatus':'active','sharedIndexUnchanged':True};pathlib.Path('/private/tmp/seti-v188-candidate-archive-20261105-v1.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
