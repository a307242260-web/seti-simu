from pathlib import Path
import hashlib,json,os,subprocess,tempfile

stage=Path(__file__).resolve().parents[1]
repo=Path('/Users/bilibili/code/seti-simu')
base='494b9f3b492d42b0205141edd57188793e93c225'
F='reports/ai-foundation-20261105/third-round-teacher-v1/'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda p:json.loads(p.read_text())
def git(*args,data=None,index=None):
    env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
    if index:env['GIT_INDEX_FILE']=index
    r=subprocess.run(['git',*args],cwd=repo,input=data,env=env,capture_output=True)
    if r.returncode:raise RuntimeError(r.stdout.decode()+r.stderr.decode())
    return r.stdout

assert git('rev-parse','HEAD').decode().strip()==base
assert git('symbolic-ref','--short','HEAD').decode().strip()=='dev'
shared=sha(repo/'.git/index')
entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()
proof=read(stage/F/'v262-committed-source-experiment-verification-20261106-v1.json')
for n,h in proof['runtimeAndOwnedSourceHashes'].items():assert sha(stage/n)==sha(repo/n)==h,n
files=['adhoc/control-v262-orange-choice-20261106-v1.js','adhoc/control-v262-orange-recorded-tail-20261106-v1.js','adhoc/deliver-v262-orange-controls-20261106-v1.py','adhoc/human405-third-round-progress-20261106-v30.json','docs/human405-third-round-v262-orange-control-20261106.md']
for stem,count in [('v262-orange-choice-native-control',12),('v262-orange-recorded-tail-native-control',8)]:
    n=F+stem+'-20261106-v1.json'
    x=read(stage/n)
    assert x['nativeInputs']==count and x['rootAndRngRestored']
    assert x['newSearchCalls']==0 and x['newAutonomousRuns']==0
    assert sha(stage/x['source'])==x['sourceSha256']
    files.extend([n,F+stem+'-cli-20261106-v1.log'])
assert read(stage/F/'v262-orange-recorded-tail-native-control-20261106-v1.json')['recordedTailEndpoint']['value']==136.5
assert read(stage/'adhoc/human405-third-round-progress-20261106-v30.json')['goalStatus']=='active'
for n in files:
    p=stage/n;target=repo/n
    assert not target.exists() or target.read_bytes()==p.read_bytes(),'overlap:'+n
    if p.suffix=='.json':json.loads(p.read_text())
    if p.suffix=='.js':subprocess.run(['node','--check',n],cwd=stage,check=True,capture_output=True)
    if p.suffix=='.py':compile(p.read_text(),n,'exec')
receipt={'parent':base,'filesSha256':{n:sha(stage/n) for n in files},'nativeControlInputs':20,'newSearchCalls':0,'newAutonomousRuns':0,'sourceRuntimeUnchanged':True,'goalStatus':'active','sharedIndexSha256':shared,'sharedEntriesSha256':entries}
if os.environ.get('SETI_DELIVER_ORANGE_CONTROL')!='1':
    print(json.dumps({'preflight':'passed',**receipt}));raise SystemExit(0)
for n in files:
    p=repo/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((stage/n).read_bytes())
index=str(Path(tempfile.mkdtemp(prefix='seti-v262-orange-index-'))/'index')
git('read-tree',base,index=index)
digests=git('hash-object','-w','--stdin-paths',data=''.join(str(stage/n)+'\n' for n in files).encode(),index=index).decode().splitlines()
assert len(digests)==len(files)
git('update-index','--index-info',data=''.join('100644 '+digest+'\t'+n+'\n' for n,digest in zip(files,digests)).encode(),index=index)
assert set(git('diff','--cached','--name-only',base,index=index).decode().splitlines())==set(files)
tree=git('write-tree',index=index).decode().strip()
for n in files:assert git('show',tree+':'+n)==(stage/n).read_bytes()
git('commit','-m','核验橙色科技同根取舍并排除牌面扫描发射假设',index=index)
receipt['commit']=git('rev-parse','HEAD').decode().strip()
assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==set(files)
Path('/private/tmp/seti-v262-orange-control-commit-show-20261106-v1.log').write_bytes(git('show','--name-only','--stat','HEAD'))
assert sha(repo/'.git/index')==shared
assert hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for n,h in proof['runtimeAndOwnedSourceHashes'].items():assert sha(repo/n)==h,n
receipt['sharedIndexExact']=True
Path('/private/tmp/seti-v262-orange-control-delivery-20261106-v1.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt))
