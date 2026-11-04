import pathlib,subprocess,json,hashlib,os,tempfile
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='36e5cc8d602577fec07f163b569caeb7310d60e5'
def git(*a,data=None,env=None):return subprocess.check_output(['git',*a],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
assert git('rev-parse','HEAD').decode().strip()==base
index=sha(root/'.git/index');assert index=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49';entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()
files={'tools/research-human405-full.js','tools/research-human405-full.test.js','tools/run_research_validation.js','tools/robot-iteration-lib.js','tools/robot_iterate.js','tools/robot-ai-generation.test.js','tools/node-test-inventory.js','docs/robot-iteration-registry.md','reports/ai-foundation-20261104/v123-full-host-tests-20261104-v1.log','reports/ai-foundation-20261104/v123-full-final-resume-test-20261104-v1.log','adhoc/deliver-v123-full-host-20261104-v1.py'}
assert 'SUMMARY unit passed=6 failed=0 total=6' in (stage/'reports/ai-foundation-20261104/v123-full-host-tests-20261104-v1.log').read_text();assert 'SUMMARY unit passed=1 failed=0 total=1' in (stage/'reports/ai-foundation-20261104/v123-full-final-resume-test-20261104-v1.log').read_text()
checked=0
for row in git('ls-tree','-rz',base).split(b'\0'):
 if not row:continue
 meta,name=row.split(b'\t',1);p=name.decode()
 if not p.startswith(('randomizer/','tools/','assets/')) or p in files:continue
 b=(stage/p).read_bytes();assert hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==meta.decode().split()[2],p;checked+=1
for p in files:
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
proof='reports/ai-foundation-20261104/v123-full-host-source-proof-20261104-v1.json'
(stage/proof).write_text(json.dumps({'baseCommit':base,'unchangedTrackedCodeDataFiles':checked,'changes':{p:sha(stage/p) for p in sorted(files)},'strategyUnchangedFromV123':True,'resumeSource':'reports/research/19bd7474.94530144.quick-200.json','first64InputsNotRerun':True,'nodeTests':6,'finalResumeTest':1,'sharedIndexSha256':index,'sharedEntriesSha256':entries},indent=2)+'\n');files.add(proof)
for p in files:
 if (root/p).exists() and (root/p).read_bytes()!=(stage/p).read_bytes():assert (root/p).read_bytes()==git('show',base+':'+p),p
if os.environ.get('SETI_DELIVER_FULL_HOST')!='1':print(json.dumps({'files':len(files),'codeDataFilesChecked':checked,'preflight':True}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-v123-full-host-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 b=(stage/p).read_bytes();d=root/p;d.parent.mkdir(parents=True,exist_ok=True);d.write_bytes(b);blob=git('hash-object','-w','--stdin',data=b,env=env).decode().strip();git('update-index','--add','--cacheinfo','100644',blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files;git('diff','--cached','--check',env=env)
git('commit','-m','新增白席整局原档续跑与逐轮检查点，隔离四AI榜单',env=env);commit=git('rev-parse','HEAD').decode().strip();print(git('show','--name-only','--stat','--format=short','HEAD').decode());assert sha(root/'.git/index')==index and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
print(json.dumps({'commit':commit,'privateIndex':private,'files':len(files),'sharedIndexUnchanged':True}))
