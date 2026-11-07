from pathlib import Path
import json,hashlib,subprocess,os,shutil
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='147484890443c8c692e5d97ea4dcc279c9e4ab3e';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();paths=set()
directories=['case152-prefix-alias-diagnostic-v1','case152-completed-prefix-v1']
for name in directories:
 d=Path('reports/ai-foundation-20261107')/name;paths.update(str(p.relative_to(stage))for p in(stage/d).rglob('*')if p.is_file())
 mp=stage/d/'source-manifest-20261107-v1.json'
 if mp.exists():
  m=json.loads(mp.read_text())
  for n,h in m['sourceHashes'].items():assert sha(stage/d/'source-snapshot'/n)==h,(name,n)
latest=Path('reports/ai-foundation-20261107/analysis-lazy-trace-contexts-v1/source-manifest-20261107-v1.json');m=json.loads((stage/latest).read_text());assert sha(stage/latest)=='eded403ee0a90b8eb180adc2de639eeab3c39aac3fa68aacc056e9e265f51a91'
for n,h in m['sourceHashes'].items():assert sha(stage/n)==h,n
for n,h in m['baseRuntimeHashes'].items():assert sha(stage/n)==m['sourceHashes'].get(n,h),n
import re
names=[p.name for p in(stage/'adhoc').iterdir()if p.is_file()and re.search(r'v314-case152-.*20261107',p.name)and p.suffix in ['.js','.py']]
for n in names:
 if n.endswith('.js'):subprocess.run(['node','--check',str(stage/'adhoc'/n)],check=True,capture_output=True)
paths.update('adhoc/'+n for n in names);paths.update(['adhoc/case152-completed-prefix-proof-contract-20261107-v1.md','adhoc/case152-timing-next-contract-20261107-v1.md','adhoc/human405-third-round-progress-20261107-v21.json','docs/human405-case152-fixed-closure-20261107.md','adhoc/deliver-v314-case152-closure-20261107-v1.py'])
assert all(n.startswith(('adhoc/','reports/','docs/'))for n in paths)
shared=sha(repo/'.git/index');assert shared=='d01a449eea57aa1efd899d9490d7560eb2045de4b16d8c9627c4505a254a51bb';assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()==base
inventory=[]
for n in sorted(paths):
 src=stage/n;dst=repo/n;assert src.is_file()and not src.is_symlink(),n
 if dst.exists():assert dst.is_file()and sha(dst)==sha(src),'overlapping root change: '+n
 else:inventory.append({'path':n,'sha256':sha(src),'bytes':src.stat().st_size})
assert inventory
rp=Path('/private/tmp/seti-v314-case152-closure-delivery-20261107-v1.json');index=Path('/private/tmp/seti-v314-case152-closure-20261107-v1.index');assert not rp.exists()and not index.exists();r={'status':'validated-before-copy','baseCommit':base,'sharedIndexSha256':shared,'scope':'Case152 evidence only:650+ fixed preparation prototype steps reduced654 to256 Native;65 materialized and independently replayed785-input proofs, strict movement bounds, current818ms prototype, two CPU profiles and rejected optimization variants. Formal V278, frozen V314 source and all production runtime/index bytes retained. No admission, promotion or autonomous score.','privateIndex':str(index),'files':inventory};rp.write_text(json.dumps(r,indent=2)+'\n')
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
