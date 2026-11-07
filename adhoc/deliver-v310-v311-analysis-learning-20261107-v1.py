from pathlib import Path
import json,hashlib,subprocess,os,shutil
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='9ad064d43d67182c521afadbecc1c0019bdcf74a';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();paths=set()
directories=['analysis-region-prefix-v1','analysis-target-trace-copy-v1','trigger-description-v1','analysis-explanation-use-v1']
for name in directories:
 d=Path('reports/ai-foundation-20261107')/name;paths.update(str(p.relative_to(stage))for p in(stage/d).rglob('*')if p.is_file())
 mp=stage/d/'source-manifest-20261107-v1.json'
 if mp.exists():
  m=json.loads(mp.read_text())
  for n,h in m['sourceHashes'].items():assert sha(stage/d/'source-snapshot'/n)==h,(name,n)
latest=Path('reports/ai-foundation-20261107/analysis-target-trace-copy-v1/source-manifest-20261107-v1.json');m=json.loads((stage/latest).read_text());assert sha(stage/latest)=='a5d30c320886448e0d7f7d90f48f41e2f530536e6c9869db35b44ae0fc78bd02'
for n,h in m['sourceHashes'].items():assert sha(stage/n)==h,n
for n,h in m['baseRuntimeHashes'].items():assert sha(stage/n)==m['sourceHashes'].get(n,h),n
names=['profile-v309-trigger-description-20261107-v1.js','profile-v309-unused-trigger-gains-20261107-v1.js','prototype-v309-analysis-region-prefix-20261107-v1.js','gate-v310-analysis-region-prefix-20261107-v1.js','gate-v311-analysis-target-trace-copy-20261107-v1.js','profile-v311-analysis-explanation-use-20261107-v1.js','compare-v309-v311-cold-roots-20261107-v1.js']
for n in names:subprocess.run(['node','--check',str(stage/'adhoc'/n)],check=True,capture_output=True)
paths.update('adhoc/'+n for n in names);paths.update(['adhoc/prepare-v310-analysis-region-prefix-20261107-v1.py','adhoc/add-v310-region-prefix-browser-20261107-v1.py','adhoc/add-v310-ready-reference-browser-20261107-v1.py','adhoc/freeze-v310-analysis-region-prefix-20261107-v1.py','adhoc/freeze-v311-analysis-target-trace-copy-20261107-v1.py','adhoc/v310-analysis-region-prefix-contract-20261107-v1.md','adhoc/v311-analysis-target-trace-copy-contract-20261107-v1.md','adhoc/v312-analysis-explanation-next-contract-20261107-v1.md','adhoc/human405-third-round-progress-20261107-v19.json','docs/human405-analysis-prefix-learning-20261107.md','docs/ai-analysis-plan-values.md','adhoc/deliver-v310-v311-analysis-learning-20261107-v1.py'])
F=Path('reports/ai-foundation-20261105/third-round-teacher-v1');paths.update(str(p.relative_to(stage))for p in(stage/F).iterdir()if p.is_file()and p.name.startswith(('v310-cold-','v311-cold-')))
assert all(n.startswith(('adhoc/','reports/','docs/'))for n in paths)
shared=sha(repo/'.git/index');assert shared=='d01a449eea57aa1efd899d9490d7560eb2045de4b16d8c9627c4505a254a51bb';assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()==base
inventory=[]
for n in sorted(paths):
 src=stage/n;dst=repo/n;assert src.is_file()and not src.is_symlink(),n
 if dst.exists():assert dst.is_file()and sha(dst)==sha(src),'overlapping root change: '+n
 else:inventory.append({'path':n,'sha256':sha(src),'bytes':src.stat().st_size})
assert inventory
rp=Path('/private/tmp/seti-v310-v311-analysis-learning-delivery-20261107-v1.json');index=Path('/private/tmp/seti-v310-v311-analysis-learning-20261107-v1.index');assert not rp.exists()and not index.exists();r={'status':'validated-before-copy','baseCommit':base,'sharedIndexSha256':shared,'scope':'V310/V311 exact local regional symbol preparation and target trace copying source snapshots, two failed unique first cold gates, Native/Browser/source-reference/full-root proofs, rejected small optimizations and observed explanation-read diagnostic only; no Production promotion or autonomous score. Candidate runtime docs stay under snapshot.','privateIndex':str(index),'files':inventory};rp.write_text(json.dumps(r,indent=2)+'\n')
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
