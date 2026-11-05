from pathlib import Path
import hashlib,json,os,subprocess,tempfile
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='85c78b17248df28e13406319c085abc85549b080';folder=Path('reports/ai-foundation-20261105/third-round-teacher-v1');sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();blob=lambda b:hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
def git(*args,data=None,private=None):
 env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
 if private:env['GIT_INDEX_FILE']=private
 r=subprocess.run(['git',*args],cwd=repo,input=data,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if r.returncode:raise RuntimeError(r.stdout.decode()+r.stderr.decode())
 return r.stdout
assert git('rev-parse','HEAD').decode().strip()==base;assert git('symbolic-ref','--short','HEAD').decode().strip()=='dev'
shared=sha(repo/'.git/index');assert shared=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49'
proof=json.loads((stage/folder/'v203-current-source-admission-20261105-v1.json').read_text());assert proof['sourceAdmitted']and proof['newAutonomousRuns']==0 and proof['measuredUnionRoots']==314
for n,h in {**proof['runtimeSourceHashes'],**proof['ownedSourceHashes'],**proof['evidenceSha256']}.items():assert sha(stage/n)==h,n
old={}
for row in git('ls-tree','-rz',base).split(b'\0'):
 if row:
  meta,name=row.split(b'\t',1);mode,kind,digest=meta.decode().split();old[name.decode()]=(mode,digest)
owned=set(proof['ownedSourceHashes'])
# The independent snapshot must not rely on another unowned source change.
for name,(_,digest)in old.items():
 if name.startswith(('randomizer/','tools/','assets/'))and name not in owned:assert(stage/name).exists()and blob((stage/name).read_bytes())==digest,name
files=owned|{'docs/ai-design.md','docs/robot-iteration-registry.md','docs/human405-third-round-plan-20261105.md','docs/human405-third-round-admission-20261105.md','adhoc/human405-third-round-progress-20261106-v1.json'}
new_scripts='''control-v203-safety-versus-corner-20261105-v1.js gate-v203-current-source-20261105-v1.js diagnose-v203-browser-full-parity-20261105-v1.js verify-v203-search-browser-parity-20261105-v1.js verify-v203-remaining-browser-smokes-20261105-v1.js verify-v203-remaining-browser-smokes-20261105-v2.js verify-v203-remaining-browser-smokes-20261105-v3.js verify-v203-remaining-browser-smokes-20261105-v4.js inspect-v203-corner-probe85-20261105-v1.js control-v203-corner-probe85-20261105-v1.js verify-v203-admission-snapshot-20261105-v1.py build-v203-admission-proof-20261105-v1.py deliver-v203-source-admission-20261106-v1.py third-round-standard-scenario-contract-20261105-v1.md'''.split();files|={'adhoc/'+n for n in new_scripts};files|={str(p.relative_to(stage))for p in(stage/folder).iterdir()if p.is_file()};files={n for n in files if old.get(n,('',None))[1]!=blob((stage/n).read_bytes())}
for name in files:
 target=repo/name;source=stage/name
 if target.exists():assert target.read_bytes()==source.read_bytes()or blob(target.read_bytes())==old.get(name,('',None))[1],'overlapping foreign edit:'+name
 if source.suffix=='.js':subprocess.run(['node','--check',name],cwd=stage,check=True)
 if source.suffix=='.py':compile(source.read_text(),name,'exec')
 if source.suffix=='.json':json.loads(source.read_text())
manifest_path='adhoc/v203-source-admission-delivery-manifest-20261106-v1.json';manifest={'baseCommit':base,'sourceAdmitted':True,'runtime':'V203/V27','sourceAdmission':str(folder/'v203-current-source-admission-20261105-v1.json'),'sharedIndexSha256':shared,'filesSha256':{n:sha(stage/n)for n in sorted(files)},'goalStatus':'active','newAutonomousRuns':0};(stage/manifest_path).write_text(json.dumps(manifest,indent=2)+'\n');files.add(manifest_path)
if os.environ.get('SETI_DELIVER_V203_ADMISSION')!='1':print(json.dumps({'preflight':'passed','files':len(files),'sourceAdmitted':True,'runtimeChanges':len([n for n in files if n.startswith('randomizer/')]),'sharedIndexUnchanged':True}));raise SystemExit(0)
private=str(Path(tempfile.mkdtemp(prefix='seti-v203-admission-index-'))/'index');git('read-tree',base,private=private)
for name in sorted(files):
 digest=git('hash-object','-w','--stdin',data=(stage/name).read_bytes(),private=private).decode().strip();git('update-index','--add','--cacheinfo',old.get(name,('100644',None))[0],digest,name,private=private)
assert set(git('diff','--cached','--name-only',base,private=private).decode().splitlines())==files
blanks=lambda lines:[line for line in lines if line and not line.strip()]
assert blanks((stage/'randomizer/game/ai/decision-search.js').read_text().splitlines())==blanks(git('show',base+':randomizer/game/ai/decision-search.js').decode().splitlines())
git('diff','--cached','--check','--','.',f':(exclude){folder}/*.log',':(exclude)randomizer/game/ai/decision-search.js',private=private)
tree=git('write-tree',private=private).decode().strip()
for name in files:assert git('show',tree+':'+name)==(stage/name).read_bytes(),name
for name in sorted(files):target=repo/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((stage/name).read_bytes())
git('commit','-m','准入V203共享搜索并增加教师同状态第三轮标准实验',private=private);commit=git('rev-parse','HEAD').decode().strip();assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files
assert sha(repo/'.git/index')==shared
for name,h in {**proof['runtimeSourceHashes'],**proof['ownedSourceHashes']}.items():assert sha(repo/name)==h,name
result={'commit':commit,'privateIndex':private,'sourceAdmitted':True,'runtime':'V203/V27','files':len(files),'sharedIndexUnchanged':True,'stage':str(stage),'goalStatus':'active','newAutonomousRuns':0};Path('/private/tmp/seti-v203-source-admission-delivery-20261106-v1.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
