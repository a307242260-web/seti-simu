from pathlib import Path
import hashlib,json,os,subprocess,tempfile
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='bf38ed045fc68d6e63dc7d6734720543f0ac988e';F='reports/ai-foundation-20261105/third-round-teacher-v1/';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def git(*args,data=None,index=None):
 env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
 if index:env['GIT_INDEX_FILE']=index
 return subprocess.check_output(['git',*args],cwd=repo,env=env,input=data)
assert git('rev-parse','HEAD').decode().strip()==base
shared=sha(repo/'.git/index');assert shared=='d01a449eea57aa1efd899d9490d7560eb2045de4b16d8c9627c4505a254a51bb'
proof=json.loads((stage/F/'v253-committed-source-experiment-verification-20261106-v1.json').read_text())
for n,h in proof['runtimeAndOwnedSourceHashes'].items():assert sha(stage/n)==sha(repo/n)==h,n
files=['docs/human405-third-round-v253-tech-learning-20261106.md','adhoc/human405-third-round-progress-20261106-v21.json','adhoc/control-v253-first-tech-pair-20261106-v1.js','adhoc/measure-teacher-purple2-native-20261106-v1.js','adhoc/deliver-v253-tech-learning-20261106-v1.py',F+'v253-first-tech-pair-native-control-20261106-v1.json',F+'v253-first-tech-pair-control-cli-20261106-v1.log',F+'v253-teacher-purple2-native-ledger-20261106-v1.json']
pair=json.loads((stage/files[5]).read_text());assert [len(pair['branches'][k]['steps'])for k in ['purple1','purple2']]==[22,23];assert all(b['rootAndRngRestored']and b['allPredeclaredInputsAccepted']for b in pair['branches'].values())
ledger=json.loads((stage/files[7]).read_text());assert ledger['inputs']==129 and ledger['finalNativeSessionRngExact']and ledger['rootAndRngRestored']
for n in files:
 assert not(repo/n).exists(),'overlap:'+n
 if n.endswith('.json'):json.loads((stage/n).read_text())
 if n.endswith('.js'):subprocess.run(['node','--check',n],cwd=stage,check=True)
central={n:sha(repo/n)for n in ['reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html']}
if os.environ.get('SETI_DELIVER_V253_LEARNING')!='1':print(json.dumps({'preflight':'passed','files':len(files),'productionSourceUnchanged':True}));raise SystemExit()
index=str(Path(tempfile.mkdtemp(prefix='seti-v253-learning-index-'))/'index');git('read-tree',base,index=index)
for n in files:
 digest=git('hash-object','-w','--stdin',data=(stage/n).read_bytes(),index=index).decode().strip();git('update-index','--add','--cacheinfo','100644,'+digest+','+n,index=index)
assert set(git('diff','--cached','--name-only',base,index=index).decode().splitlines())==set(files)
for n in files:p=repo/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((stage/n).read_bytes())
git('commit','-m','核验紫色科技连续扫描与研究牌收入取舍',index=index);commit=git('rev-parse','HEAD').decode().strip();names=git('show','--pretty=format:','--name-only','--stat','HEAD').decode();Path('/private/tmp/seti-v253-learning-commit-show-20261106-v1.log').write_text(names)
assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==set(files);assert sha(repo/'.git/index')==shared
for n,h in central.items():assert sha(repo/n)==h
print(json.dumps({'commit':commit,'files':len(files),'sharedIndexPreserved':True,'productionAndCenterUnchanged':True,'goalStatus':'active'}))
