from pathlib import Path
import hashlib,json,os,shutil,subprocess
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='b6049e7cb9bd2175e4bf49b195a0b779ddef7459';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();sources={}
D=Path('reports/ai-foundation-20261107/autonomous-first3-harness-v1');proof=json.loads((stage/D/'production-validation-20261107-v2.json').read_text());assert proof['complete'] and proof['newAutonomousRuns']==0 and proof['newAiQueries']==0
for name in ['next-income-probe-joint-v1','probe-replacement-bound-v1','probe-replacement-witness-v1','probe-witness-source-order-v1','autonomous-first3-harness-v1']:
 d=Path('reports/ai-foundation-20261107')/name
 for p in(stage/d).rglob('*'):
  if p.is_file():sources[str(p.relative_to(stage))]=p
 if(stage/d/'source-manifest-20261107-v1.json').exists():
  m=json.loads((stage/d/'source-manifest-20261107-v1.json').read_text())
  for n,h in m['sourceHashes'].items():assert sha(stage/d/'source-snapshot'/n)==h,(name,n)
F=Path('reports/ai-foundation-20261105/third-round-teacher-v1')
for p in(stage/F).iterdir():
 if p.is_file() and any(p.name.startswith('v'+str(v)+'-') for v in range(294,297)):sources[str(p.relative_to(stage))]=p
for p in(stage/'adhoc').iterdir():
 if p.is_file() and (any('v'+str(v) in p.name for v in range(294,297)) or p.name=='profile-v293-runtime-hotspots-20261107-v1.js' or 'autonomous-first3' in p.name):sources[str(p.relative_to(stage))]=p
for n in ['docs/human405-autonomous-first3-harness-20261107.md','adhoc/human405-third-round-progress-20261107-v10.json']:sources[n]=stage/n
live=set(proof['sourceHashes'])
for n,h in proof['sourceHashes'].items():
 src=stage/D/'source-snapshot'/n;assert sha(src)==h,n;sources[n]=src
assert live=={'tools/research-human405-round1.js','tools/run_research_validation.js','tools/robot-iteration-lib.js','tools/node-test-inventory.js','reports/iteration/page-template.html','docs/robot-iteration-registry.md','tools/robot-ai-generation.test.js','tools/research-human405-first3.test.js'}
assert all(n in live or n.startswith(('adhoc/','reports/','docs/'))for n in sources)
shared=sha(repo/'.git/index');assert shared=='d01a449eea57aa1efd899d9490d7560eb2045de4b16d8c9627c4505a254a51bb'
def plain(*args):return subprocess.check_output(['git',*args],cwd=repo)
assert plain('rev-parse','HEAD').decode().strip()==base
for n,h in proof['productionRuntimeHashes'].items():assert hashlib.sha256(plain('show',base+':'+n)).hexdigest()==h,n
tracked=set(plain('ls-tree','-r','--name-only',base).decode().splitlines());inventory=[]
for n,src in sorted(sources.items()):
 dst=repo/n;assert src.is_file() and not src.is_symlink(),n
 if dst.exists():
  assert dst.is_file() and not dst.is_symlink(),n
  if sha(dst)==sha(src):continue
  assert n in live and n in tracked and dst.read_bytes()==plain('show',base+':'+n),'overlapping root change: '+n
 inventory.append({'path':n,'source':str(src),'sha256':sha(src),'bytes':src.stat().st_size})
assert inventory
receipt=Path('/private/tmp/seti-autonomous-first3-harness-delivery-20261107-v1.json');assert not receipt.exists();index=Path('/private/tmp/seti-autonomous-first3-harness-20261107-v1.index');assert not index.exists()
r={'status':'validated-before-copy','baseCommit':base,'sharedIndexSha256':shared,'scope':'8 validated harness/report/document/test files plus failed candidate evidence only; no AI runtime promotion, no new score or registry rows','files':inventory};receipt.write_text(json.dumps(r,indent=2)+'\n')
for item in inventory:
 src=Path(item['source']);dst=repo/item['path'];dst.parent.mkdir(parents=True,exist_ok=True)
 if dst.exists():assert item['path'] in live;dst.write_bytes(src.read_bytes())
 else:
  with dst.open('xb') as f:f.write(src.read_bytes())
 shutil.copymode(src,dst);assert sha(dst)==item['sha256']
env={**os.environ,'GIT_INDEX_FILE':str(index),'GIT_OPTIONAL_LOCKS':'0'}
def git(*args):return subprocess.check_output(['git',*args],cwd=repo,env=env)
git('read-tree',base);git('add','--',*[x['path']for x in inventory]);tree=git('write-tree').decode().strip();changed=git('diff','--cached','--name-only','-z',base).decode().strip('\0').split('\0');assert set(changed)=={x['path']for x in inventory}
for item in inventory:assert hashlib.sha256(git('cat-file','blob',tree+':'+item['path'])).hexdigest()==item['sha256'],item['path']
for n,h in proof['productionRuntimeHashes'].items():assert hashlib.sha256(git('cat-file','blob',tree+':'+n)).hexdigest()==h,n
assert sha(repo/'.git/index')==shared
r.update(status='copied-and-private-index-verified-not-yet-committed',snapshotTree=tree,privateIndex=str(index),filesVerified=len(inventory),bytes=sum(x['bytes']for x in inventory),productionRuntimeUnchanged=True,sharedIndexPreserved=True);receipt.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:r[k]for k in ['status','snapshotTree','privateIndex','filesVerified','bytes','productionRuntimeUnchanged','sharedIndexPreserved']}))
