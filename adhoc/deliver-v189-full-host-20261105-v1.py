import pathlib,subprocess,os,tempfile,json,hashlib
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='981b500807d98030e91d6b2fafd4c519b15fb702';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/'
def git(*a,data=None,env=None):return subprocess.check_output(['git',*a],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
assert git('rev-parse','HEAD').decode().strip()==base
proof=json.loads((stage/(folder+'v189-first2-result-source-check-20261105-v1.json')).read_text())
for p,h in proof['runtimeSourceHashes'].items():assert sha(stage/p)==h and sha(root/p)==h,p
files={'tools/research-human405-full.js','tools/research-human405-full.test.js','tools/run_research_validation.js','docs/robot-iteration-registry.md','adhoc/deliver-v189-full-host-20261105-v1.py'};logs=['v189-full-continuation-test-20261105-v1.log','v189-full-research-human405-first2-20261105-v1.log','v189-full-research-world-resume-20261105-v1.log','v189-full-research-search-statistics-20261105-v1.log','v189-full-robot-ai-generation-20261105-v1.log'];files.update(folder+x for x in logs);assert '"first125NotRerun":true'in(stage/(folder+logs[0])).read_text()
shared=sha(root/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();foreign={p:sha(root/p)for p in ['reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html']}
for p in files:
 if(root/p).exists()and(root/p).read_bytes()!=(stage/p).read_bytes():assert(root/p).read_bytes()==git('show',base+':'+p),p
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
manifest='adhoc/v189-full-host-manifest-20261105-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'files':{p:sha(stage/p)for p in sorted(files)},'runtimeSourceHashes':proof['runtimeSourceHashes'],'runtimeUnchanged':True,'sourceInputs':125,'testsPassed':5,'sourceRoundScores':[15,50],'fullRuns':0,'sharedIndexSha256':shared,'sharedEntriesSha256':entries,'foreignWorkingHashes':foreign},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_V189_FULL_HOST')!='1':print(json.dumps({'preflight':True,'files':len(files),'runtimeUnchanged':True,'toolsTestsPassed':5}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-v189-full-host-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 h=git('hash-object','-w','--stdin',data=(stage/p).read_bytes(),env=env).decode().strip();git('update-index','--add','--cacheinfo','100644',h,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files;git('diff','--cached','--check',env=env)
for p in sorted(files):dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes((stage/p).read_bytes())
git('commit','-m','增加V189已验证前两轮的严格终局续跑入口并保留轮末统计口径',env=env);commit=git('rev-parse','HEAD').decode().strip();assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files;assert not git('diff','--name-only',base,commit,'--','randomizer','assets').strip();assert sha(root/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for p,h in foreign.items():assert sha(root/p)==h
r={'commit':commit,'privateIndex':private,'stage':str(stage),'runtimeUnchanged':True,'sourceRecord':'reports/research/e01243ba.93989585.quick-400.json','sourceInputs':125,'sharedIndexUnchanged':True};pathlib.Path('/private/tmp/seti-v189-full-host-20261105-v1.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
