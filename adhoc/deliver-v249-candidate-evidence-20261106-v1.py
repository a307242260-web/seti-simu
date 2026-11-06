from pathlib import Path
import hashlib,json,os,shutil,subprocess

stage=Path(__file__).resolve().parents[1]
root=Path('/Users/bilibili/code/seti-simu')
manifest=Path('adhoc/v249-candidate-evidence-delivery-manifest-20261106-v1.json')
m=json.loads((stage/manifest).read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(root/'.git/index')==m['sharedIndexSha256']
assert subprocess.check_output(['git','-C',str(root),'rev-parse','HEAD']).decode().strip()==m['baseCommit']
for name,digest in m['owned'].items():
    assert sha(stage/name)==digest,name
    target=root/name
    if target.exists():assert sha(target)==digest,name
    else:target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(stage/name,target)
shutil.copyfile(stage/manifest,root/manifest)
index=Path('/private/tmp/seti-v249-evidence-private-20261106-v1.index')
assert not index.exists()
env={**os.environ,'GIT_INDEX_FILE':str(index)}
def git(*args,input=None):
    return subprocess.check_output(['git','-C',str(root),*args],input=input,env=env).decode().strip()
git('read-tree',m['baseCommit'])
git('--work-tree='+str(stage),'add','--pathspec-from-file=/private/tmp/seti-v249-evidence-paths-20261106-v1.nul','--pathspec-file-nul')
names=set(git('diff','--cached','--name-only','-z').strip('\0').split('\0'))
assert names==set(m['owned'])|{str(manifest)}
assert not any(n.startswith(('randomizer/','tools/','reports/iteration/'))for n in names)
tree=git('write-tree')
commit=git('commit-tree',tree,'-p',m['baseCommit'],input='保存第三轮固定计划候选与首次性能证据，保留生产版本\n'.encode())
git('update-ref','refs/heads/dev',commit,m['baseCommit'])
assert git('rev-parse','HEAD')==commit
actual=set(git('show','--pretty=format:','--name-only','-z','HEAD').strip('\0').split('\0'))
assert actual==names
assert sha(root/'.git/index')==m['sharedIndexSha256']
for folder in ['randomizer','tools','reports/iteration']:
    assert git('rev-parse',m['baseCommit']+':'+folder)==git('rev-parse',commit+':'+folder),folder
git('push','origin','dev')
receipt={'commit':commit,'base':m['baseCommit'],'files':len(names),'pushedOriginDev':True,'sharedIndexPreserved':True,'productionTreeUnchanged':True,'baselineAndRegistryUnchanged':True,'goalStatus':'active','manifest':str(manifest),'manifestSha256':sha(stage/manifest)}
Path('/private/tmp/seti-v249-candidate-evidence-delivery-20261106-v1.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt))
