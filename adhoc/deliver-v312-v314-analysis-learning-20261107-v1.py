from pathlib import Path
import json,hashlib,subprocess,os,shutil
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='54003149657d51934be79dee4344e730163c60f7';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();paths=set()
directories=['analysis-lazy-explanations-v1','analysis-lazy-regions-v1','analysis-lazy-trace-contexts-v1','analysis-fixed-trace-context-v1','case152-native-distribution-v1','case152-stationary-prototype-v1']
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
names=[p.name for p in(stage/'adhoc').iterdir()if p.is_file()and re.search(r'(?:v312|v313|v314|v311-v314).*20261107',p.name)and p.suffix in ['.js','.py','.md']]
for n in names:
 if n.endswith('.js'):subprocess.run(['node','--check',str(stage/'adhoc'/n)],check=True,capture_output=True)
paths.update('adhoc/'+n for n in names);paths.update(['adhoc/case152-fixed-tail-next-contract-20261107-v1.md','adhoc/human405-third-round-progress-20261107-v20.json','docs/human405-analysis-lazy-learning-20261107.md','docs/ai-analysis-plan-values.md','adhoc/deliver-v312-v314-analysis-learning-20261107-v1.py'])
F=Path('reports/ai-foundation-20261105/third-round-teacher-v1');paths.update(str(p.relative_to(stage))for p in(stage/F).iterdir()if p.is_file()and p.name.startswith(('v312-cold-','v313-cold-','v314-cold-')))
assert all(n.startswith(('adhoc/','reports/','docs/'))for n in paths)
shared=sha(repo/'.git/index');assert shared=='d01a449eea57aa1efd899d9490d7560eb2045de4b16d8c9627c4505a254a51bb';assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()==base
inventory=[]
for n in sorted(paths):
 src=stage/n;dst=repo/n;assert src.is_file()and not src.is_symlink(),n
 if dst.exists():
  assert dst.is_file(),n
  if sha(dst)==sha(src):continue
  assert n=='docs/ai-analysis-plan-values.md','overlapping root change: '+n
  expected=hashlib.sha256(subprocess.check_output(['git','cat-file','blob',base+':'+n],cwd=repo)).hexdigest()
  assert sha(dst)==expected=='14f51a796cdf861f348558815201f5c086cc1950f99aa12a923d52c128e78d96','foreign owned-doc overlap'
  inventory.append({'path':n,'sha256':sha(src),'bytes':src.stat().st_size,'previousSha256':expected})
 else:inventory.append({'path':n,'sha256':sha(src),'bytes':src.stat().st_size})
assert inventory
rp=Path('/private/tmp/seti-v312-v314-analysis-learning-delivery-20261107-v1.json');index=Path('/private/tmp/seti-v312-v314-analysis-learning-20261107-v1.index');assert not rp.exists()and not index.exists();r={'status':'validated-before-copy','baseCommit':base,'sharedIndexSha256':shared,'scope':'V312/V313/V314 exact lazy analysis explanations/regions/trace contexts frozen sources and unique first cold gates: hard132 passes599.8 but case152805/1679.3 fails. Full805 policy diagnostics; in-memory restricted R4 fixed-tail proofs805to654,37tails385Native plus385independent full-state replays. Evidence/docs/snapshots only; no Production promotion, new source version or autonomous score. Owned explanatory doc updated only from exact HEAD bytes.','privateIndex':str(index),'files':inventory};rp.write_text(json.dumps(r,indent=2)+'\n')
for item in inventory:
 src=stage/item['path'];dst=repo/item['path'];dst.parent.mkdir(parents=True,exist_ok=True)
 if item.get('previousSha256'):
  assert sha(dst)==item['previousSha256'];dst.write_bytes(src.read_bytes())
 else:
  with dst.open('xb')as f:f.write(src.read_bytes())
 shutil.copymode(src,dst);assert sha(dst)==item['sha256']
env={**os.environ,'GIT_INDEX_FILE':str(index),'GIT_OPTIONAL_LOCKS':'0'}
def git(*args):return subprocess.check_output(['git',*args],cwd=repo,env=env)
git('read-tree',base);git('add','--',*[x['path']for x in inventory]);tree=git('write-tree').decode().strip();assert set(git('diff','--cached','--name-only','-z',base).decode().strip('\0').split('\0'))=={x['path']for x in inventory}
for item in inventory:assert hashlib.sha256(git('cat-file','blob',tree+':'+item['path'])).hexdigest()==item['sha256']
proof=json.loads((repo/'reports/ai-foundation-20261107/autonomous-first3-harness-v1/production-validation-20261107-v2.json').read_text())
for n,h in proof['productionRuntimeHashes'].items():assert hashlib.sha256(git('cat-file','blob',tree+':'+n)).hexdigest()==h,n
assert sha(repo/'.git/index')==shared;r.update(status='copied-and-private-index-verified',snapshotTree=tree,filesVerified=len(inventory),bytes=sum(x['bytes']for x in inventory),productionRuntimeUnchanged=True,sharedIndexPreserved=True);rp.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:r[k]for k in ['status','snapshotTree','filesVerified','bytes','productionRuntimeUnchanged','sharedIndexPreserved']}))
