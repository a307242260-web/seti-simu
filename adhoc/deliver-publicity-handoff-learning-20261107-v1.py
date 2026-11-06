from pathlib import Path
import hashlib,json,os,shutil,subprocess

stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='8190a6718a15f441a076c9fab5a43b4aca3634a2';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert stage!=repo and (stage/'.git').is_file()
dirs=['publicity-deferral-learning-v1','publicity-deferral-capacity-v1','publicity-handoff-v1','publicity-base-scalar-reuse-v1','publicity-reachability-v1','publicity-inert-removal-v1'];paths=set()
for name in dirs:
 d=Path('reports/ai-foundation-20261107')/name
 paths.update(str(p.relative_to(stage))for p in (stage/d).rglob('*')if p.is_file())
 m=json.loads((stage/d/'source-manifest-20261107-v1.json').read_text())
 for n,h in m['sourceHashes'].items():assert sha(stage/d/'source-snapshot'/n)==h,(name,n)
F=Path('reports/ai-foundation-20261105/third-round-teacher-v1')
paths.update(str(p.relative_to(stage))for p in(stage/F).iterdir()if p.is_file()and any(p.name.startswith('v'+str(v)+'-')for v in range(279,285)))
paths.update(str(p.relative_to(stage))for p in(stage/'adhoc').iterdir()if p.is_file()and any('v'+str(v)in p.name for v in range(279,285)))
paths.update(['adhoc/control-v278-publicity-deferral-commutation-20261107-v1.js','adhoc/capture-v278-and-publicity-commutation-roots-20261107-v1.js','adhoc/human405-third-round-progress-20261107-v6.json','adhoc/deliver-publicity-handoff-learning-20261107-v1.py','docs/human405-publicity-handoff-learning-20261107.md'])
assert all(n.startswith(('adhoc/','reports/','docs/'))for n in paths)
mp=Path('reports/ai-foundation-20261107/publicity-inert-removal-v1/source-manifest-20261107-v1.json');m=json.loads((stage/mp).read_text())
for n,h in m['sourceHashes'].items():assert sha(stage/n)==h,n
shared=sha(repo/'.git/index');assert shared=='d01a449eea57aa1efd899d9490d7560eb2045de4b16d8c9627c4505a254a51bb'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()==base
inventory=[]
for n in sorted(paths):
 src=stage/n;dst=repo/n;digest=sha(src);assert src.is_file()and not src.is_symlink(),n
 if dst.exists():assert dst.is_file()and sha(dst)==digest,'different root file: '+n
 inventory.append({'path':n,'sha256':digest,'bytes':src.stat().st_size,'alreadyPresent':dst.exists()})
receipt=Path('/private/tmp/seti-publicity-handoff-learning-delivery-20261107-v1.json');assert not receipt.exists()
receipt.write_text(json.dumps({'status':'validated-before-copy','baseCommit':base,'sharedIndexSha256':shared,'scope':'Evidence, frozen failed source snapshots, Native controls and helpers only. No runtime promotion or new autonomous score.','files':inventory},indent=2)+'\n')
for item in inventory:
 src=stage/item['path'];dst=repo/item['path'];dst.parent.mkdir(parents=True,exist_ok=True)
 if not dst.exists():
  with dst.open('xb')as f:f.write(src.read_bytes())
  shutil.copymode(src,dst)
 assert sha(dst)==item['sha256'],item['path']
index=Path('/private/tmp/seti-publicity-handoff-learning-20261107-v1.index');assert not index.exists();env={**os.environ,'GIT_INDEX_FILE':str(index),'GIT_OPTIONAL_LOCKS':'0'}
def git(*args):return subprocess.check_output(['git',*args],cwd=repo,env=env)
git('read-tree',base);git('add','--',*sorted(paths));tree=git('write-tree').decode().strip();changed=git('diff','--cached','--name-only','-z',base).decode().strip('\0').split('\0');assert set(changed)==paths
for item in inventory:assert hashlib.sha256(git('cat-file','blob',tree+':'+item['path'])).hexdigest()==item['sha256'],item['path']
assert sha(repo/'.git/index')==shared
r=json.loads(receipt.read_text());r.update(status='copied-and-private-index-verified-not-yet-committed',snapshotTree=tree,privateIndex=str(index),filesVerified=len(inventory),bytes=sum(x['bytes']for x in inventory),productionRuntimeUnchanged=True,sharedIndexPreserved=True);receipt.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:r[k]for k in ['status','snapshotTree','privateIndex','filesVerified','bytes','productionRuntimeUnchanged','sharedIndexPreserved']}))
