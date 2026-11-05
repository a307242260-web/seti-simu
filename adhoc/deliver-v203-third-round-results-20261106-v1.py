from pathlib import Path
import hashlib,json,os,subprocess,tempfile
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='697b888b1d513f28d9d5ff7739facd1832c80750';folder=Path('reports/ai-foundation-20261105/third-round-teacher-v1')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def git(*args,data=None,index=None):
 env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
 if index:env['GIT_INDEX_FILE']=index
 r=subprocess.run(['git',*args],cwd=repo,input=data,env=env,capture_output=True)
 if r.returncode:raise RuntimeError(r.stdout.decode()+r.stderr.decode())
 return r.stdout
assert git('rev-parse','HEAD').decode().strip()==base
assert git('symbolic-ref','--short','HEAD').decode().strip()=='dev'
shared=sha(repo/'.git/index');assert shared=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49'
r=json.loads((stage/folder/'v203-third-round-development-comparison-20261106-v1.json').read_text());assert not r['developmentAligned'] and r['autonomousExperiments']==1
central={'reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html'}
rootVersions=json.loads((repo/'reports/iteration/versions.json').read_text());rootRows={v['id']:v for v in rootVersions['versions']}
files={'reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html','docs/human405-third-round-v203-result-20261106.md','adhoc/human405-third-round-progress-20261106-v2.json','adhoc/deliver-v203-third-round-results-20261106-v1.py','adhoc/summarize-v203-teacher-r3-result-20261106-v1.js','adhoc/verify-v203-standard-r3-native-20261106-v1.js','adhoc/verify-v203-standard-r3-native-20261106-v2.js',r['recordPath'],r['savePath'],r['tracePath']}
files|={str(p.relative_to(stage))for p in(stage/folder).glob('v203-*20261106-v*')if p.is_file() and p.name.startswith(('v203-standard-r3-','v203-third-round-development-','v203-third-round-comparison-','v203-register-metadata-','v203-report-metadata-'))}
files|={str(p.relative_to(stage))for p in(stage/'reports/iteration/ai-search-v203-teacher-r3-20261106').rglob('*')if p.is_file()}
files|={str(p.relative_to(stage))for p in(stage/'reports/research').glob('a121adb0.697b888b.quick-400.json*')if p.is_file()}
assert not any(n.startswith(('randomizer/','tools/','assets/')) for n in files)
proof=json.loads((stage/folder/'v203-current-source-admission-20261105-v1.json').read_text())
for n,h in {**proof['runtimeSourceHashes'],**proof['ownedSourceHashes']}.items():assert sha(stage/n)==h,n
oldv=json.loads(git('show',base+':reports/iteration/versions.json'));newv=json.loads((stage/'reports/iteration/versions.json').read_text());oldrows={v['id']:v for v in oldv['versions']};newrows={v['id']:v for v in newv['versions']}
assert set(newrows)-set(oldrows)=={'ai-search-v203-teacher-r3-20261106'}
for n,v in oldrows.items():assert newrows[n]==v,n
assert newrows['ai-search-v203-teacher-r3-20261106']['baselineEligible'] is False
for n in set(rootRows)&set(oldrows):assert rootRows[n]==oldrows[n],n
assert set(rootRows)-set(oldrows)=={'perf-baseline-lowload-20260913'}
preservedCentral={n:sha(repo/n) for n in central}
assert json.loads((stage/'reports/iteration/registry.json').read_text())['generations']['v2']['currentBaseline']=='ai-search-v41-baseline-20261029'
assert sha(stage/r['recordPath'])==r['recordSha256'];assert sha(stage/r['savePath'])==r['saveSha256'];assert sha(stage/r['tracePath'])==r['traceSha256']
for n in files:
 source=stage/n;assert source.exists(),n
 target=repo/n
 if n not in central and target.exists() and target.read_bytes()!=source.read_bytes():assert git('show',base+':'+n)==target.read_bytes(),'overlapping edit:'+n
 if source.suffix=='.json':json.loads(source.read_text())
 if source.suffix=='.js':subprocess.run(['node','--check',n],cwd=stage,check=True)
 if source.suffix=='.py':compile(source.read_text(),n,'exec')
manifest='adhoc/v203-third-round-results-delivery-20261106-v1.json'
(stage/manifest).write_text(json.dumps({'baseCommit':base,'sharedIndexSha256':shared,'filesSha256':{n:sha(stage/n) for n in sorted(files)},'autonomousRuns':1,'developmentAligned':False,'goalStatus':'active'},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_V203_RESULTS')!='1':print(json.dumps({'preflight':'passed','files':len(files),'oldVersionsUnchanged':len(oldrows),'sourceUnchanged':True}));raise SystemExit(0)
index=str(Path(tempfile.mkdtemp(prefix='seti-v203-results-index-'))/'index');git('read-tree',base,index=index)
for n in sorted(files):
 digest=git('hash-object','-w','--stdin',data=(stage/n).read_bytes(),index=index).decode().strip();git('update-index','--add','--cacheinfo','100644',digest,n,index=index)
assert set(git('diff','--cached','--name-only',base,index=index).decode().splitlines())==files
tree=git('write-tree',index=index).decode().strip()
for n in files:assert git('show',tree+':'+n)==(stage/n).read_bytes()
for n in sorted(files-central):p=repo/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((stage/n).read_bytes())
git('commit','-m','登记V203同状态第三轮试跑及原生资产差距',index=index)
commit=git('rev-parse','HEAD').decode().strip();assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files
assert sha(repo/'.git/index')==shared
for n,h in preservedCentral.items():assert sha(repo/n)==h,n
rootVersions['versions'].append(newrows['ai-search-v203-teacher-r3-20261106'])
(repo/'reports/iteration/versions.json').write_text(json.dumps(rootVersions,ensure_ascii=False,indent=2)+'\n')
subprocess.run(['node','tools/robot_iterate.js','build'],cwd=repo,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
merged=json.loads((repo/'reports/iteration/versions.json').read_text());mergedRows={v['id']:v for v in merged['versions']}
for n,v in rootRows.items():assert mergedRows[n]==v,n
assert sha(repo/'.git/index')==shared
receipt={'commit':commit,'privateIndex':index,'files':len(files),'sharedIndexUnchanged':True,'developmentAligned':False,'autonomousRuns':1}
Path('/private/tmp/seti-v203-r3-results-delivery-20261106-v1.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
