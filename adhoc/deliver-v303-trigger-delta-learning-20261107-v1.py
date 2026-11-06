from pathlib import Path
import json,hashlib,subprocess,os,shutil
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='f818291c51e441180a249a2e5b1fb4774e093e8c';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();D=Path('reports/ai-foundation-20261107/trigger-cache-capacity-v1');mp=stage/D/'source-manifest-20261107-v1.json';m=json.loads(mp.read_text());assert sha(mp)=='06179c22561171cc3071db3d76e60cb00b3261b8c200028d89f2bcd1a182cc43'
for n,h in m['sourceHashes'].items():assert sha(stage/n)==h and sha(stage/D/'source-snapshot'/n)==h,n
names=['profile-v301-trigger-cache-capacity-20261107-v1.js','prototype-v301-trigger-delta-memo-20261107-v1.js','verify-trigger-delta-reference-reproduction-20261107-v1.js','gate-v303-trigger-delta-memo-20261107-v1.js','prototype-v303-closed-computer-allocation-20261107-v1.js']
for n in names:subprocess.run(['node','--check',str(stage/'adhoc'/n)],check=True,capture_output=True)
paths=['adhoc/'+n for n in names]+['adhoc/freeze-v303-trigger-delta-memo-20261107-v1.py','adhoc/v303-trigger-delta-memo-contract-20261107-v1.md','adhoc/human405-third-round-progress-20261107-v14.json','docs/human405-trigger-delta-cpu-20261107.md','adhoc/deliver-v303-trigger-delta-learning-20261107-v1.py']
paths += [str(p.relative_to(stage))for p in(stage/D).rglob('*')if p.is_file()]
F=Path('reports/ai-foundation-20261105/third-round-teacher-v1');paths += [str(p.relative_to(stage))for p in(stage/F).iterdir()if p.is_file()and p.name.startswith('v303-cold-')]
assert len(paths)==len(set(paths));assert all(n.startswith(('adhoc/','reports/','docs/'))for n in paths)
shared=sha(repo/'.git/index');assert shared=='d01a449eea57aa1efd899d9490d7560eb2045de4b16d8c9627c4505a254a51bb';assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()==base
inventory=[]
for n in sorted(paths):
 src=stage/n;dst=repo/n;assert src.is_file()and not src.is_symlink(),n
 if dst.exists():assert sha(dst)==sha(src),'overlapping root change: '+n
 else:inventory.append({'path':n,'sha256':sha(src),'bytes':src.stat().st_size})
rp=Path('/private/tmp/seti-trigger-delta-learning-delivery-20261107-v1.json');index=Path('/private/tmp/seti-trigger-delta-learning-20261107-v1.index');assert not rp.exists()and not index.exists();r={'status':'validated-before-copy','baseCommit':base,'sharedIndexSha256':shared,'scope':'V303 failed first cold and verified isolated candidate snapshots only. No Production promotion or autonomous score.','privateIndex':str(index),'files':inventory};rp.write_text(json.dumps(r,indent=2)+'\n')
for item in inventory:
 src=stage/item['path'];dst=repo/item['path'];dst.parent.mkdir(parents=True,exist_ok=True)
 with dst.open('xb')as f:f.write(src.read_bytes())
 shutil.copymode(src,dst);assert sha(dst)==item['sha256']
env={**os.environ,'GIT_INDEX_FILE':str(index),'GIT_OPTIONAL_LOCKS':'0'}
def git(*args):return subprocess.check_output(['git',*args],cwd=repo,env=env)
git('read-tree',base);git('add','--',*[item['path']for item in inventory]);tree=git('write-tree').decode().strip();assert set(git('diff','--cached','--name-only','-z',base).decode().strip('\0').split('\0'))=={x['path']for x in inventory}
for item in inventory:assert hashlib.sha256(git('cat-file','blob',tree+':'+item['path'])).hexdigest()==item['sha256']
proof=json.loads((repo/'reports/ai-foundation-20261107/autonomous-first3-harness-v1/production-validation-20261107-v2.json').read_text())
for n,h in proof['productionRuntimeHashes'].items():assert hashlib.sha256(git('cat-file','blob',tree+':'+n)).hexdigest()==h,n
assert sha(repo/'.git/index')==shared;r.update(status='copied-and-private-index-verified',snapshotTree=tree,filesVerified=len(inventory),productionRuntimeUnchanged=True,sharedIndexPreserved=True);rp.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:r[k]for k in ['status','snapshotTree','filesVerified','productionRuntimeUnchanged','sharedIndexPreserved']}))
