from pathlib import Path
import hashlib,json,os,shutil,subprocess
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='a6591b8337d05e29a7b0ef78e6128c9ce0de8dca';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();paths=set()
for name in ['final-round-proof-audit-v1','r4-company-tail-v1','local-portfolio-reuse-diagnostic-v1']:
 d=Path('reports/ai-foundation-20261107')/name;paths.update(str(p.relative_to(stage))for p in(stage/d).rglob('*')if p.is_file())
 if(stage/d/'source-manifest-20261107-v1.json').exists():
  m=json.loads((stage/d/'source-manifest-20261107-v1.json').read_text())
  for n,h in m['sourceHashes'].items():assert sha(stage/d/'source-snapshot'/n)==h,(name,n)
F=Path('reports/ai-foundation-20261105/third-round-teacher-v1');paths.update(str(p.relative_to(stage))for p in(stage/F).iterdir()if p.is_file()and any(p.name.startswith('v'+str(v)+'-')for v in range(300,302)))
extra=['verify-r4-company-tail-prototype-20261107-v1.js','control-v299-final-round-capital-bound-20261107-v1.js','control-v299-final-round-capital-bound-20261107-v2.js','verify-v299-final-round-bound-controls-20261107-v1.js']
paths.update(str(p.relative_to(stage))for p in(stage/'adhoc').iterdir()if p.is_file()and(any('v'+str(v)in p.name for v in range(300,302))or p.name in extra))
paths.update(['docs/human405-r4-proof-domain-and-fixed-tail-20261107.md','adhoc/human405-third-round-progress-20261107-v12.json','adhoc/deliver-r4-proof-tail-learning-20261107-v1.py'])
assert all(n.startswith(('adhoc/','reports/','docs/'))for n in paths)
latest=Path('reports/ai-foundation-20261107/r4-company-tail-v1/source-manifest-20261107-v1.json');m=json.loads((stage/latest).read_text())
for n,h in m['sourceHashes'].items():assert sha(stage/n)==h,n
shared=sha(repo/'.git/index');assert shared=='d01a449eea57aa1efd899d9490d7560eb2045de4b16d8c9627c4505a254a51bb';assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()==base
inventory=[]
for n in sorted(paths):
 src=stage/n;dst=repo/n;assert src.is_file()and not src.is_symlink(),n
 if dst.exists():assert dst.is_file()and sha(dst)==sha(src),'overlapping root change: '+n
 else:inventory.append({'path':n,'sha256':sha(src),'bytes':src.stat().st_size})
assert inventory
receipt=Path('/private/tmp/seti-r4-proof-tail-learning-delivery-20261107-v1.json');assert not receipt.exists();receipt.write_text(json.dumps({'status':'validated-before-copy','baseCommit':base,'sharedIndexSha256':shared,'scope':'Controlled Native counterexamples, source snapshots and failed first gates only; no Production promotion or autonomous score.','files':inventory},indent=2)+'\n')
for item in inventory:
 src=stage/item['path'];dst=repo/item['path'];dst.parent.mkdir(parents=True,exist_ok=True)
 with dst.open('xb')as f:f.write(src.read_bytes())
 shutil.copymode(src,dst);assert sha(dst)==item['sha256']
index=Path('/private/tmp/seti-r4-proof-tail-learning-20261107-v1.index');assert not index.exists();env={**os.environ,'GIT_INDEX_FILE':str(index),'GIT_OPTIONAL_LOCKS':'0'}
def git(*args):return subprocess.check_output(['git',*args],cwd=repo,env=env)
git('read-tree',base);git('add','--',*[x['path']for x in inventory]);tree=git('write-tree').decode().strip();changed=git('diff','--cached','--name-only','-z',base).decode().strip('\0').split('\0');assert set(changed)=={x['path']for x in inventory}
for item in inventory:assert hashlib.sha256(git('cat-file','blob',tree+':'+item['path'])).hexdigest()==item['sha256'],item['path']
production=json.loads((repo/'reports/ai-foundation-20261107/autonomous-first3-harness-v1/production-validation-20261107-v2.json').read_text())
for n,h in production['productionRuntimeHashes'].items():assert hashlib.sha256(git('cat-file','blob',tree+':'+n)).hexdigest()==h,n
assert sha(repo/'.git/index')==shared
r=json.loads(receipt.read_text());r.update(status='copied-and-private-index-verified-not-yet-committed',snapshotTree=tree,privateIndex=str(index),filesVerified=len(inventory),bytes=sum(x['bytes']for x in inventory),productionRuntimeUnchanged=True,sharedIndexPreserved=True);receipt.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:r[k]for k in ['status','snapshotTree','privateIndex','filesVerified','bytes','productionRuntimeUnchanged','sharedIndexPreserved']}))
