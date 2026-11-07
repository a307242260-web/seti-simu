from pathlib import Path
import json,hashlib,subprocess,os,shutil
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='0ce04dc8161579260286575443248a61a8de15d0';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();paths=set()
directories=['research-comparison-loop-v1','research-single-window-v1','joint-research-repetition-v1','post-research-comparison-runtime-v1']
for name in directories:
 d=Path('reports/ai-foundation-20261107')/name;paths.update(str(p.relative_to(stage))for p in(stage/d).rglob('*')if p.is_file())
 mp=stage/d/'source-manifest-20261107-v1.json'
 if mp.exists():
  m=json.loads(mp.read_text())
  for n,h in m['sourceHashes'].items():assert sha(stage/d/'source-snapshot'/n)==h,(name,n)
latest=Path('reports/ai-foundation-20261107/research-single-window-v1/source-manifest-20261107-v1.json');m=json.loads((stage/latest).read_text());assert sha(stage/latest)=='3f947eb9b9330dd8bfdb3a55695dd0659ccb1f79d9ab0112cc65758d89bc7ad5'
for n,h in m['sourceHashes'].items():assert sha(stage/n)==h,n
for n,h in m['baseRuntimeHashes'].items():assert sha(stage/n)==m['sourceHashes'].get(n,h),n
names=['profile-v307-joint-research-repetition-20261107-v1.js','profile-v307-validated-joint-key-20261107-v1.js','gate-v308-research-comparison-20261107-v1.js','gate-v309-research-single-window-20261107-v1.js','profile-v309-current-runtime-hotspots-20261107-v1.js','compare-v307-v309-cold-roots-20261107-v1.js']
for n in names:subprocess.run(['node','--check',str(stage/'adhoc'/n)],check=True,capture_output=True)
paths.update('adhoc/'+n for n in names);paths.update(['adhoc/freeze-v308-research-comparison-20261107-v1.py','adhoc/freeze-v309-research-single-window-20261107-v1.py','adhoc/summarize-v309-cpu-20261107-v1.py','adhoc/v308-research-comparison-contract-20261107-v1.md','adhoc/v309-research-single-window-contract-20261107-v1.md','adhoc/human405-third-round-progress-20261107-v18.json','docs/human405-research-comparison-learning-20261107.md','adhoc/deliver-v308-v309-research-learning-20261107-v1.py'])
F=Path('reports/ai-foundation-20261105/third-round-teacher-v1');paths.update(str(p.relative_to(stage))for p in(stage/F).iterdir()if p.is_file()and p.name.startswith(('v308-cold-','v309-cold-')))
assert all(n.startswith(('adhoc/','reports/','docs/'))for n in paths)
shared=sha(repo/'.git/index');assert shared=='d01a449eea57aa1efd899d9490d7560eb2045de4b16d8c9627c4505a254a51bb';assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()==base
inventory=[]
for n in sorted(paths):
 src=stage/n;dst=repo/n;assert src.is_file()and not src.is_symlink(),n
 if dst.exists():assert dst.is_file()and sha(dst)==sha(src),'overlapping root change: '+n
 else:inventory.append({'path':n,'sha256':sha(src),'bytes':src.stat().st_size})
assert inventory
rp=Path('/private/tmp/seti-v308-v309-research-learning-delivery-20261107-v1.json');index=Path('/private/tmp/seti-v308-v309-research-learning-20261107-v1.index');assert not rp.exists()and not index.exists();r={'status':'validated-before-copy','baseCommit':base,'sharedIndexSha256':shared,'scope':'V308/V309 exact research comparison/window source snapshots, two failed unique first cold gates, meaningful negative cache diagnostic and typed inputs, Native/Browser/complete-root proofs and current CPU only; no Production promotion or autonomous score. Candidate runtime docs stay under snapshot.','privateIndex':str(index),'files':inventory};rp.write_text(json.dumps(r,indent=2)+'\n')
for item in inventory:
 src=stage/item['path'];dst=repo/item['path'];dst.parent.mkdir(parents=True,exist_ok=True)
 with dst.open('xb')as f:f.write(src.read_bytes())
 shutil.copymode(src,dst);assert sha(dst)==item['sha256']
env={**os.environ,'GIT_INDEX_FILE':str(index),'GIT_OPTIONAL_LOCKS':'0'}
def git(*args):return subprocess.check_output(['git',*args],cwd=repo,env=env)
git('read-tree',base);git('add','--',*[x['path']for x in inventory]);tree=git('write-tree').decode().strip();assert set(git('diff','--cached','--name-only','-z',base).decode().strip('\0').split('\0'))=={x['path']for x in inventory}
for item in inventory:assert hashlib.sha256(git('cat-file','blob',tree+':'+item['path'])).hexdigest()==item['sha256']
proof=json.loads((repo/'reports/ai-foundation-20261107/autonomous-first3-harness-v1/production-validation-20261107-v2.json').read_text())
for n,h in proof['productionRuntimeHashes'].items():assert hashlib.sha256(git('cat-file','blob',tree+':'+n)).hexdigest()==h,n
assert sha(repo/'.git/index')==shared;r.update(status='copied-and-private-index-verified',snapshotTree=tree,filesVerified=len(inventory),bytes=sum(x['bytes']for x in inventory),productionRuntimeUnchanged=True,sharedIndexPreserved=True);rp.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:r[k]for k in ['status','snapshotTree','filesVerified','bytes','productionRuntimeUnchanged','sharedIndexPreserved']}))
