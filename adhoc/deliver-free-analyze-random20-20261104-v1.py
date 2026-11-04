import pathlib,subprocess,os,tempfile,json,hashlib
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='6eff6f3da26e2d680e2963184def68fb387d3d5a'
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def git(*a,data=None,env=None):return subprocess.check_output(['git',*a],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
assert git('rev-parse','HEAD').decode().strip()==base
shared=sha(root/'.git/index');assert shared=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49'
entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()
foreign={p:sha(root/p)for p in ['reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html']}
files=['randomizer/index.html','tools/browser-smoke-inventory.js','docs/fixed-boards.md','adhoc/generate-free-analyze-random20-20261104-v1.js','adhoc/deliver-free-analyze-random20-20261104-v1.py','reports/fixed-boards/free-analyze-random20-20261104-v1.json','reports/fixed-boards/free-analyze-random20-generation-20261104-v1.log','reports/fixed-boards/free-analyze-random20-browser-20261104-v1.log']
r=json.loads((stage/files[5]).read_text());assert r['status']=='complete'and len(r['boards'])==20 and r['repeatableOpenings']==20 and len(set(b['seed']for b in r['boards']))==20
for p,h in r['sourceHashes'].items():assert hashlib.sha256(git('show',base+':'+p)).hexdigest()==h,p
smoke=(stage/files[7]).read_text();assert 'SUMMARY browserSmoke passed=20 failed=0 total=20'in smoke and smoke.count('PASS production-fixed-board-random20-')==20
for p in files[:3]:assert(root/p).read_bytes()==git('show',base+':'+p),p
for p in files:
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
manifest='reports/fixed-boards/free-analyze-random20-delivery-20261104-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'files':{p:sha(stage/p)for p in files},'nativeRecreatedBoards':20,'chromePassed':20,'selection':'white DeepSpace availability only; no card/income/board-quality filtering','sourceModulesVerified':len(r['sourceHashes']),'sharedIndexSha256':shared,'sharedEntriesSha256':entries,'foreignRegistryHashes':foreign,'scope':'20 additional menu presets; current AI runtime untouched'},ensure_ascii=False,indent=2)+'\n');files.append(manifest)
if os.environ.get('SETI_DELIVER_RANDOM20')!='1':print(json.dumps({'preflight':True,'files':len(files),'nativeBoards':20,'chromePassed':20}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-random20-private-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in files:
 b=(stage/p).read_bytes();dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(b);blob=git('hash-object','-w','--stdin',data=b,env=env).decode().strip();git('update-index','--add','--cacheinfo','100644',blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==set(files)
git('diff','--cached','--check',env=env);git('commit','-m','新增20个免电分析随机盘面并逐局验证浏览器开局',env=env)
commit=git('rev-parse','HEAD').decode().strip();assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==set(files)
print(git('show','--name-only','--stat','--format=short','HEAD').decode());assert sha(root/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for p,h in foreign.items():assert sha(root/p)==h,p
result={'commit':commit,'privateIndex':private,'sharedIndexUnchanged':True,'foreignRegistriesUnchanged':True,'files':files};pathlib.Path('/private/tmp/seti-random20-delivery-result-20261104-v1.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'commit':commit,'privateIndex':private,'files':len(files),'sharedIndexUnchanged':True,'foreignRegistriesUnchanged':True}))
