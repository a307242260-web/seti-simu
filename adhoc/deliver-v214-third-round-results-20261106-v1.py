from pathlib import Path
import hashlib,json,os,subprocess,tempfile
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='341f6fad2f04956b58078543c40a0fcf3c2fd6e2';folder=Path('reports/ai-foundation-20261105/third-round-teacher-v1');vid='ai-search-v214-teacher-r3-20261106';central={'reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html'};sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def git(*args,data=None,index=None):
 env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
 if index:env['GIT_INDEX_FILE']=index
 r=subprocess.run(['git',*args],cwd=repo,input=data,env=env,capture_output=True)
 if r.returncode:raise RuntimeError(r.stdout.decode()+r.stderr.decode())
 return r.stdout
assert git('rev-parse','HEAD').decode().strip()==base;assert git('symbolic-ref','--short','HEAD').decode().strip()=='dev';shared=sha(repo/'.git/index');entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()
proof=json.loads((stage/folder/'v214-current-source-admission-20261106-v1.json').read_text());r=json.loads((stage/folder/'v214-third-round-development-comparison-20261106-v2.json').read_text());verify=json.loads((stage/folder/'v214-standard-r3-native-verification-20261106-v1.json').read_text());assert not r['developmentAligned']and r['autonomousExperiments']==1 and verify['prePassAndFinalNativeStateSessionRngExact']and verify['nativeInputs']==60
for n,h in {**proof['runtimeSourceHashes'],**proof['ownedSourceHashes']}.items():assert sha(stage/n)==h and sha(repo/n)==h,n
for n,h in [(r['recordPath'],r['recordSha256']),(r['savePath'],r['saveSha256']),(r['tracePath'],r['traceSha256'])]:assert sha(stage/n)==h,n
oldVersions=json.loads(git('show',base+':reports/iteration/versions.json'));oldRows={v['id']:v for v in oldVersions['versions']};newVersions=json.loads((stage/'reports/iteration/versions.json').read_text());newRows={v['id']:v for v in newVersions['versions']};rootVersions=json.loads((repo/'reports/iteration/versions.json').read_text());rootRows={v['id']:v for v in rootVersions['versions']}
assert set(newRows)-set(oldRows)=={vid}
for n,v in oldRows.items():assert newRows[n]==v,n;assert rootRows[n]==v,n
assert newRows[vid]['baselineEligible'] is False and newRows[vid]['head']=='341f6fad';assert vid not in rootRows
foreign=set(rootRows)-set(oldRows);assert foreign=={'perf-baseline-lowload-20260913'}
registry=json.loads((stage/'reports/iteration/registry.json').read_text());assert registry['generations']['v2']['currentBaseline']=='ai-search-v41-baseline-20261029';view=next(v for v in registry['versions']if v['id']==vid);assert len(view['results'])==1 and view['results'][0]['reportExists']and not view['results'][0].get('missingRecord')
visual=json.loads((stage/folder/'v214-third-round-visual-verification-20261106-v1.json').read_text());assert visual['rows']==60 and visual['mainInputs']==58 and visual['boundaryInputs']==2 and sha(stage/visual['report'])==visual['reportSha256']
files=central|{'docs/ai-design.md','docs/human405-third-round-v214-result-20261106.md','adhoc/human405-third-round-progress-20261106-v7.json','adhoc/deliver-v214-third-round-results-20261106-v1.py',r['recordPath'],r['savePath'],r['tracePath']}
files|={str(p.relative_to(stage))for p in(stage/folder).glob('v214-*20261106-v*')if p.is_file()}
files|={str(p.relative_to(stage))for p in(stage/'reports/iteration'/vid).rglob('*')if p.is_file()}
files|={str(p.relative_to(stage))for p in(stage/'reports/research').glob('768b7f09.341f6fad.quick-400.json*')if p.is_file()}
files|={str(p.relative_to(stage))for p in(stage/'adhoc').iterdir()if p.is_file()and'v214-'in p.name and'20261106'in p.name}
files.discard('adhoc/v214-third-round-results-delivery-manifest-20261106-v1.json')
old={}
for row in git('ls-tree','-rz',base).split(b'\0'):
 if row:meta,n=row.split(b'\t',1);mode,kind,digest=meta.decode().split();old[n.decode()]=(mode,digest)
blob=lambda b:hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest();files={n for n in files if old.get(n,('',None))[1]!=blob((stage/n).read_bytes())};assert not any(n.startswith(('randomizer/','tools/','assets/'))for n in files)
for n in sorted(files):
 p=stage/n;target=repo/n
 if n not in central and target.exists():assert target.read_bytes()==p.read_bytes()or blob(target.read_bytes())==old.get(n,('',None))[1],'overlapping edit:'+n
 if p.suffix=='.json':json.loads(p.read_text())
 if p.suffix=='.js':subprocess.run(['node','--check',n],cwd=stage,check=True,capture_output=True)
 if p.suffix=='.py':compile(p.read_text(),n,'exec')
preservedCentral={n:sha(repo/n)for n in central};manifest='adhoc/v214-third-round-results-delivery-manifest-20261106-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'sharedIndexSha256':shared,'sharedStageEntriesSha256':entries,'filesSha256':{n:sha(stage/n)for n in sorted(files)},'autonomousRuns':1,'developmentAligned':False,'sourceUnchanged':True,'foreignWorkingVersionsPreserved':sorted(foreign),'goalStatus':'active'},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_V214_RESULTS')!='1':print(json.dumps({'preflight':'passed','files':len(files),'oldVersionsExact':len(oldRows),'sourceUnchanged':True,'foreignPreserved':sorted(foreign)}));raise SystemExit(0)
index=str(Path(tempfile.mkdtemp(prefix='seti-v214-results-index-'))/'index');git('read-tree',base,index=index);names=sorted(files);digests=git('hash-object','-w','--stdin-paths',data=''.join(str(stage/n)+'\n'for n in names).encode(),index=index).decode().splitlines();assert len(digests)==len(names)
for n,digest in zip(names,digests):assert digest==blob((stage/n).read_bytes()),n
git('update-index','--index-info',data=''.join(old.get(n,('100644',None))[0]+' '+d+'\t'+n+'\n'for n,d in zip(names,digests)).encode(),index=index);assert set(git('diff','--cached','--name-only',base,index=index).decode().splitlines())==files
tree=git('write-tree',index=index).decode().strip()
for n in files:assert git('show',tree+':'+n)==(stage/n).read_bytes(),n
for n in sorted(files-central):p=repo/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((stage/n).read_bytes())
git('commit','-m','登记V214第三轮82分结果并提供逐输入图解复盘',index=index);commit=git('rev-parse','HEAD').decode().strip();Path('/private/tmp/seti-v214-results-commit-show-20261106-v1.log').write_bytes(git('show','--name-only','--stat','HEAD'));assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files
assert sha(repo/'.git/index')==shared;assert hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for n,h in preservedCentral.items():assert sha(repo/n)==h,n
rootVersions['versions'].insert(0,newRows[vid]);(repo/'reports/iteration/versions.json').write_text(json.dumps(rootVersions,ensure_ascii=False,indent=2)+'\n');env=dict(os.environ,GIT_OPTIONAL_LOCKS='0');env.pop('GIT_INDEX_FILE',None);build=subprocess.run(['node','tools/robot_iterate.js','build'],cwd=repo,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT);Path('/private/tmp/seti-v214-root-center-merge-20261106-v1.log').write_bytes(build.stdout);assert build.returncode==0,build.stdout.decode()
merged=json.loads((repo/'reports/iteration/versions.json').read_text());mergedRows={v['id']:v for v in merged['versions']}
for n,v in rootRows.items():assert mergedRows[n]==v,n
assert mergedRows[vid]==newRows[vid];assert json.loads((repo/'reports/iteration/registry.json').read_text())['generations']['v2']['currentBaseline']=='ai-search-v41-baseline-20261029';assert sha(repo/'.git/index')==shared;assert hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for n,h in proof['runtimeSourceHashes'].items():assert sha(repo/n)==h,n
receipt={'commit':commit,'privateIndex':index,'files':len(files),'sourceCommit':base,'sharedIndexByteAndEntriesExact':True,'foreignWorkingVersionsPreserved':sorted(foreign),'workingVersionCount':len(mergedRows),'autonomousRuns':1,'developmentAligned':False,'sourceUnchanged':True,'goalStatus':'active'};Path('/private/tmp/seti-v214-r3-results-delivery-20261106-v1.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
