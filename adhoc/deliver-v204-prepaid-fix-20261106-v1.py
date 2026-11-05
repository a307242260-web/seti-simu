from pathlib import Path
import hashlib,json,os,subprocess,tempfile
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='d4d430e140c654060333cb8c52d98fed032265ed';folder=Path('reports/ai-foundation-20261105/third-round-teacher-v1');sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def git(*args,data=None,index=None):
 env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
 if index:env['GIT_INDEX_FILE']=index
 r=subprocess.run(['git',*args],cwd=repo,input=data,env=env,capture_output=True)
 if r.returncode:raise RuntimeError(r.stdout.decode()+r.stderr.decode())
 return r.stdout
assert git('rev-parse','HEAD').decode().strip()==base;assert git('symbolic-ref','--short','HEAD').decode().strip()=='dev'
shared=sha(repo/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()
proof=json.loads((stage/folder/'v204-current-source-admission-20261106-v1.json').read_text());assert proof['sourceAdmitted'] and proof['newAutonomousRuns']==0
for n,h in {**proof['runtimeSourceHashes'],**proof['ownedSourceHashes'],**proof['evidenceSha256']}.items():assert sha(stage/n)==h,n
files=set(proof['ownedSourceHashes'])|{proof['manifest'],'docs/human405-third-round-prepaid-fix-20261106.md','adhoc/human405-third-round-progress-20261106-v3.json'}
files|={str(p.relative_to(stage))for p in(stage/folder).glob('v204-*20261106-v*')if p.is_file()}
for pattern in ['v203-first-landing-*20261106-v*','v203-critical-decision-*20261106-v*','v203-third-round-critical-*20261106-v*','v203-actual-before-*-20261106-v1.json']:
 files|={str(p.relative_to(stage))for p in(stage/folder).glob(pattern)if p.is_file()}
for name in ['control-v203-first-landing-capital-20261106-v1.js','control-v203-first-landing-capital-20261106-v2.js','review-v203-critical-decisions-20261106-v1.js','verify-v204-prepaid-endpoints-20261106-v1.js','benchmark-third-round-decision-20261106-v1.js','gate-v204-prepaid-source-20261106-v1.js','verify-v204-admission-snapshot-20261106-v1.py','verify-v204-admission-snapshot-20261106-v2.py','deliver-v204-prepaid-fix-20261106-v1.py','v204-prepaid-capital-contract-20261106-v1.md','v203-third-round-results-delivery-receipt-20261106-v2.json']:files.add('adhoc/'+name)
old={}
for row in git('ls-tree','-rz',base).split(b'\0'):
 if row:
  meta,name=row.split(b'\t',1);mode,kind,digest=meta.decode().split();old[name.decode()]=(mode,digest)
blob=lambda b:hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
files={n for n in files if old.get(n,('',None))[1]!=blob((stage/n).read_bytes())}
for n in files:
 p=stage/n;target=repo/n
 if target.exists():assert target.read_bytes()==p.read_bytes()or blob(target.read_bytes())==old.get(n,('',None))[1],'overlapping foreign edit:'+n
 if p.suffix=='.json':json.loads(p.read_text())
 if p.suffix=='.js':subprocess.run(['node','--check',n],cwd=stage,check=True)
 if p.suffix=='.py':compile(p.read_text(),n,'exec')
manifest='adhoc/v204-prepaid-fix-delivery-manifest-20261106-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'sourceAdmitted':True,'sourceVersion':'V204/V28','sharedIndexSha256':shared,'sharedStageEntriesSha256':entries,'filesSha256':{n:sha(stage/n) for n in sorted(files)},'newAutonomousRuns':0,'developmentAligned':False,'goalStatus':'active'},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_V204')!='1':print(json.dumps({'preflight':'passed','files':len(files),'sourceAdmitted':True,'runtimeFilesChanged':len([n for n in files if n.startswith('randomizer/')])}));raise SystemExit(0)
index=str(Path(tempfile.mkdtemp(prefix='seti-v204-prepaid-index-'))/'index');git('read-tree',base,index=index)
for n in sorted(files):
 digest=git('hash-object','-w','--stdin',data=(stage/n).read_bytes(),index=index).decode().strip();git('update-index','--add','--cacheinfo',old.get(n,('100644',None))[0],digest,n,index=index)
assert set(git('diff','--cached','--name-only',base,index=index).decode().splitlines())==files
tree=git('write-tree',index=index).decode().strip()
for n in files:assert git('show',tree+':'+n)==(stage/n).read_bytes(),n
for n in sorted(files):p=repo/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((stage/n).read_bytes())
git('commit','-m','修正登陆计分卡导致电脑预投入漏计并保留第三轮差距证据',index=index)
commit=git('rev-parse','HEAD').decode().strip();assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files
assert sha(repo/'.git/index')==shared;assert hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for n,h in {**proof['runtimeSourceHashes'],**proof['ownedSourceHashes']}.items():assert sha(repo/n)==h,n
receipt={'commit':commit,'files':len(files),'privateIndex':index,'sharedIndexByteAndEntriesExact':True,'sourceAdmitted':True,'runtime':'V204/V28','newAutonomousRuns':0,'goalStatus':'active'};Path('/private/tmp/seti-v204-prepaid-delivery-20261106-v1.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
