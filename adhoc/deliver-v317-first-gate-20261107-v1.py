from pathlib import Path
import json,hashlib,subprocess,os,shutil
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='681f442a2c744e8e4fd43e453f2bcf0c7eb7fb1c';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();paths=set()
prefix=Path('reports/ai-foundation-20261107')
cases=['identity-walk','slot-local','probe-key','income-first','choice-id-prefilter','static-occupancy','static-occupancy-v317']
directories=[prefix/('case152-'+n+'-v1') for n in cases]+[prefix/'teacher125-v317-hotspots-v1']
for d in directories:
 assert (stage/d).is_dir()
 paths.update(str(p.relative_to(stage)) for p in (stage/d).rglob('*') if p.is_file())
d=prefix/'case152-static-occupancy-v317-v1';mp=stage/d/'source-manifest-20261107-v1.json';m=json.loads(mp.read_text())
assert sha(mp)=='6b5d3364e51f7e72f733ff75787115c3e8b23800a14d34163909340a47bf04a2'
ws=Path('/private/tmp/seti-v317-case152-static-occupancy-20261107-v1')
for n,h in {**m['baseRuntimeHashes'],**m['sourceHashes']}.items():assert sha(ws/n)==h,n
for n in m['changedSources']:assert sha(stage/d/'source-snapshot'/n)==m['sourceHashes'][n],n
parent=Path('/private/tmp/seti-v316-case152-pending-copy-20261107-v1')
prior=json.loads((stage/m['parentManifest']).read_text());assert sha(stage/m['parentManifest'])==m['parentManifestSha256']
for n,h in {**prior['baseRuntimeHashes'],**prior['sourceHashes']}.items():assert sha(parent/n)==h,n
gate=json.loads((stage/d/'serial-cold-gate-20261107-v1.json').read_text())
assert gate['status']=='failed-gate' and gate['manifestSha256']==sha(mp) and gate['cases']==1258 and len(gate['rows'])==40 and gate['measuredUniqueRoots']==38
assert gate['failure']['label']=='actual-v256-125'
for row in gate['rows']:
 raw=row['evidence'];q=json.loads((stage/raw).read_text())
 assert sha(stage/q['fixture'])==q['fixtureSha256'] and sha(stage/q['rawPath'])==q['rawSha256'] and sha(mp)==q['candidateSourceManifestSha256']
 assert q['rootAndRngUnchanged'] and q['complete'] and row['decisionGatePassed']==q['decisionGatePassed']
 paths.update([raw,q['rawPath']])
names=[p.name for p in (stage/'adhoc').iterdir() if p.is_file() and any('-'+n+'-' in p.name for n in cases) and 'case152' in p.name and 'v316-' in p.name and p.suffix=='.js']
assert len(names)==12,names
paths.update('adhoc/'+n for n in names)
paths.update(['adhoc/freeze-v317-case152-static-occupancy-20261107-v1.py','adhoc/gate-v317-static-occupancy-20261107-v1.js','adhoc/verify-v317-case152-static-occupancy-20261107-v1.js','adhoc/profile-v317-teacher125-native-path-20261107-v1.js','adhoc/profile-v317-teacher125-swap-20261107-v1.js','adhoc/inspect-v317-teacher125-swap-facts-20261107-v1.js','adhoc/teacher125-after-v317-next-20261107-v1.md','adhoc/human405-third-round-progress-20261107-v25.json','docs/human405-v317-first-gate-20261107.md','adhoc/deliver-v317-first-gate-20261107-v1.py'])
for n in paths:
 if n.endswith('.js'):subprocess.run(['node','--check',str(stage/n)],check=True,capture_output=True)
 if n.endswith('.py'):compile((stage/n).read_text(),n,'exec')
assert all(n.startswith(('adhoc/','reports/','docs/'))for n in paths)
shared=sha(repo/'.git/index');assert shared=='d01a449eea57aa1efd899d9490d7560eb2045de4b16d8c9627c4505a254a51bb';assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()==base
inventory=[]
for n in sorted(paths):
 src=stage/n;dst=repo/n;assert src.is_file()and not src.is_symlink(),n
 if dst.exists():assert dst.is_file()and sha(dst)==sha(src),'overlapping root change: '+n
 else:inventory.append({'path':n,'sha256':sha(src),'bytes':src.stat().st_size})
assert inventory
rp=Path('/private/tmp/seti-v317-first-gate-delivery-20261107-v1.json');index=Path('/private/tmp/seti-v317-first-gate-20261107-v1.index');assert not rp.exists()and not index.exists();r={'status':'validated-before-copy','baseCommit':base,'sharedIndexSha256':shared, 'scope':'Evidence only: frozen V317, exact static occupancy and descriptor controls. First 39 labels pass, actual125 is first failure at 127/672.664ms; all 38 distinct first samples plus swap quote diagnosis. No production change, promotion or autonomous score.','privateIndex':str(index),'files':inventory};rp.write_text(json.dumps(r,indent=2)+'\n')
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
