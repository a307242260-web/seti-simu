from pathlib import Path
import json,hashlib,subprocess,os,shutil
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='7c60dbc08b2833aaa81352fcbf732f64c484b56f';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();D=Path('reports/ai-foundation-20261107/research-mark-prefix-reuse-v1');mp=stage/D/'source-manifest-20261107-v1.json';m=json.loads(mp.read_text());assert sha(mp)=='fb5f92474320086ee33b2dfcf792498dad522538a3ee17da0daa265b72b6a44c'
for n,h in m['sourceHashes'].items():assert sha(stage/n)==h and sha(stage/D/'source-snapshot'/n)==h,n
names=['prototype-v303-research-mark-prefix-20261107-v1.js','verify-v304-browser-mark-failure-20261107-v1.js','gate-v304-research-mark-prefix-20261107-v1.js','prototype-v304-research-mark-score-ceiling-20261107-v1.js']
for n in names:subprocess.run(['node','--check',str(stage/'adhoc'/n)],check=True,capture_output=True)
paths=['adhoc/'+n for n in names]+['adhoc/freeze-v304-research-mark-prefix-20261107-v1.py','adhoc/v304-research-mark-prefix-contract-20261107-v1.md','adhoc/human405-third-round-progress-20261107-v15.json','docs/human405-research-mark-prefix-cpu-20261107.md','adhoc/deliver-v304-research-mark-prefix-learning-20261107-v1.py']
paths += [str(p.relative_to(stage))for p in(stage/D).rglob('*')if p.is_file()]
extra=Path('reports/ai-foundation-20261107/research-mark-score-ceiling-v1');paths += [str(p.relative_to(stage))for p in(stage/extra).rglob('*')if p.is_file()]
F=Path('reports/ai-foundation-20261105/third-round-teacher-v1');paths += [str(p.relative_to(stage))for p in(stage/F).iterdir()if p.is_file()and p.name.startswith('v304-cold-')]
assert len(paths)==len(set(paths));assert all(n.startswith(('adhoc/','reports/','docs/'))for n in paths)
shared=sha(repo/'.git/index');assert shared=='d01a449eea57aa1efd899d9490d7560eb2045de4b16d8c9627c4505a254a51bb';assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()==base
inventory=[]
for n in sorted(paths):
 src=stage/n;dst=repo/n;assert src.is_file()and not src.is_symlink(),n
 if dst.exists():assert sha(dst)==sha(src),'overlapping root change: '+n
 else:inventory.append({'path':n,'sha256':sha(src),'bytes':src.stat().st_size})
rp=Path('/private/tmp/seti-research-mark-prefix-learning-delivery-20261107-v1.json');index=Path('/private/tmp/seti-research-mark-prefix-learning-20261107-v1.index');assert not rp.exists()and not index.exists();r={'status':'validated-before-copy','baseCommit':base,'sharedIndexSha256':shared,'scope':'V304 failed first cold, verified isolated candidate snapshots, stale Browser assertion repair and unimplemented score-ceiling prototype only. No Production promotion or autonomous score.','privateIndex':str(index),'files':inventory};rp.write_text(json.dumps(r,indent=2)+'\n')
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
