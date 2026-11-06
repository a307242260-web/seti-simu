from pathlib import Path
import json,hashlib,subprocess,os,shutil
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='22f260371c7e555a8ad297cf2e8100020a5b8d3d';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
mp=stage/'reports/ai-foundation-20261107/r4-company-tail-v1/source-manifest-20261107-v1.json';m=json.loads(mp.read_text());assert sha(mp)=='159313ab1c166bbd088950dced0dbd6708a8ec92b5829c4575b19e82bde95d1d'
for n,h in m['sourceHashes'].items():assert sha(stage/n)==h,n
names=['profile-v301-geometry-keys-20261107-v1.js','prototype-v301-shared-probe-ceiling-20261107-v1.js','prototype-v301-quiet-end-no-pending-20261107-v1.js','profile-v301-current-runtime-hotspots-20261107-v1.js','prototype-v301-resource-blue-reuse-20261107-v1.js','prototype-v301-resource-blue-reuse-20261107-v2.js','profile-v301-full-blue-input-repetition-20261107-v1.js']
for n in names:subprocess.run(['node','--check',str(stage/'adhoc'/n)],check=True,capture_output=True)
paths=['adhoc/'+n for n in names]+['adhoc/v302-shared-probe-ceiling-contract-20261107-v1.md','adhoc/human405-third-round-progress-20261107-v13.json','docs/human405-hard132-cpu-investigation-20261107.md','adhoc/deliver-hard132-cpu-investigation-20261107-v1.py']
d=Path('reports/ai-foundation-20261107/local-portfolio-reuse-diagnostic-v1')
for p in (stage/d).iterdir():
 if not p.is_file():continue
 dst=repo/d/p.name
 if dst.exists():assert sha(dst)==sha(p),p.name
 else:paths.append(str(p.relative_to(stage)))
assert len(paths)==len(set(paths))
shared=sha(repo/'.git/index');assert shared=='d01a449eea57aa1efd899d9490d7560eb2045de4b16d8c9627c4505a254a51bb';assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()==base
inventory=[]
for n in sorted(paths):
 src=stage/n;assert src.is_file()and not src.is_symlink();assert not(repo/n).exists(),n;inventory.append({'path':n,'sha256':sha(src),'bytes':src.stat().st_size})
rp=Path('/private/tmp/seti-hard132-cpu-investigation-delivery-20261107-v1.json');index=Path('/private/tmp/seti-hard132-cpu-investigation-20261107-v1.index');assert not rp.exists()and not index.exists();r={'status':'validated-before-copy','baseCommit':base,'sharedIndexSha256':shared,'scope':'Evidence only, no runtime edit or SOURCE admission, no autonomous game','privateIndex':str(index),'files':inventory};rp.write_text(json.dumps(r,indent=2)+'\n')
for item in inventory:
 src=stage/item['path'];dst=repo/item['path'];dst.parent.mkdir(parents=True,exist_ok=True)
 with dst.open('xb')as f:f.write(src.read_bytes())
 shutil.copymode(src,dst);assert sha(dst)==item['sha256']
env={**os.environ,'GIT_INDEX_FILE':str(index),'GIT_OPTIONAL_LOCKS':'0'}
def git(*args):return subprocess.check_output(['git',*args],cwd=repo,env=env)
git('read-tree',base);git('add','--',*paths);tree=git('write-tree').decode().strip();assert set(git('diff','--cached','--name-only','-z',base).decode().strip('\0').split('\0'))==set(paths)
for item in inventory:assert hashlib.sha256(git('cat-file','blob',tree+':'+item['path'])).hexdigest()==item['sha256']
proof=json.loads((repo/'reports/ai-foundation-20261107/autonomous-first3-harness-v1/production-validation-20261107-v2.json').read_text())
for n,h in proof['productionRuntimeHashes'].items():assert hashlib.sha256(git('cat-file','blob',tree+':'+n)).hexdigest()==h,n
assert sha(repo/'.git/index')==shared;r.update(status='copied-and-private-index-verified',snapshotTree=tree,filesVerified=len(paths),productionRuntimeUnchanged=True,sharedIndexPreserved=True);rp.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:r[k]for k in ['status','snapshotTree','filesVerified','productionRuntimeUnchanged','sharedIndexPreserved']}))
