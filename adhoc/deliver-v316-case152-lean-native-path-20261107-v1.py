from pathlib import Path
import json,hashlib,subprocess,os,shutil
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='f2179e28fd45be8a9904e05d386a0962dfbb4617';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();paths=set()
cases=['after-scalar-profile','rotation-reuse','validator-paths','planet-location','analysis-journal','score-readonly-data','first-blue-quote','route-gap','pending-copy','lean-proof-path-v315','pending-copy-v316']
for n in cases:
 d=Path('reports/ai-foundation-20261107')/('case152-'+n+'-v1')
 assert (stage/d).is_dir(),d
 paths.update(str(p.relative_to(stage)) for p in (stage/d).rglob('*') if p.is_file() and not p.name.endswith('.checkpoint.json'))
 for report in (stage/d).glob('*-proofs*.json'):
  if report.name.endswith('.checkpoint.json'):continue
  a=json.loads(report.read_text());assert a['fullNativeEnvelopeAndRankParity'] and a['prototypeNativeInputs']==256 and a['materializedNativeInputs']==785
  assert sha(stage/a['checkpoint'])==sha(repo/a['checkpoint'])==a['checkpointSha256']==sha(stage/a['generatedCheckpointName'])
for v,name in [(315,'lean-proof-path'),(316,'pending-copy')]:
 d=Path('reports/ai-foundation-20261107')/f'case152-{name}-v{v}-v1'
 mp=stage/d/'source-manifest-20261107-v1.json';m=json.loads(mp.read_text())
 ws=Path(f'/private/tmp/seti-v{v}-case152-{name}-20261107-v1')
 for n,h in {**m['baseRuntimeHashes'],**m['sourceHashes']}.items():assert sha(ws/n)==h,n
 for n in m['changedSources']:assert sha(stage/d/'source-snapshot'/n)==m['sourceHashes'][n],n
 for label in ['corpus-case-152','actual-v256-132']:
  raw=Path('reports/ai-foundation-20261105/third-round-teacher-v1')/f'v{v}-cold-{label}-20261107-v1.json'
  q=json.loads((stage/raw).read_text())
  assert sha(stage/q['fixture'])==q['fixtureSha256'] and sha(stage/q['rawPath'])==q['rawSha256']
  assert sha(mp)==q['candidateSourceManifestSha256']
  assert q['decisionGatePassed']==(label=='actual-v256-132')
  paths.update([str(raw),q['rawPath']])
latest=Path('reports/ai-foundation-20261107/analysis-lazy-trace-contexts-v1/source-manifest-20261107-v1.json');m=json.loads((stage/latest).read_text());assert sha(stage/latest)=='eded403ee0a90b8eb180adc2de639eeab3c39aac3fa68aacc056e9e265f51a91'
for n,h in {**m['baseRuntimeHashes'],**m['sourceHashes']}.items():assert sha(stage/n)==h,n
names=[p.name for p in (stage/'adhoc').iterdir() if p.is_file() and any('-'+n in p.name for n in cases) and 'case152' in p.name and p.suffix=='.js']
assert len(names)==26,names
names.append("profile-v314-case152-after-scalar-runtime-20261107-v1.js")
paths.update('adhoc/'+n for n in names)
paths.update(['adhoc/freeze-v315-case152-lean-proof-path-20261107-v1.py','adhoc/freeze-v316-case152-pending-copy-20261107-v1.py','adhoc/case152-after-v316-next-20261107-v1.md','adhoc/human405-third-round-progress-20261107-v24.json','docs/human405-case152-lean-native-path-20261107.md','adhoc/deliver-v316-case152-lean-native-path-20261107-v1.py'])
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
rp=Path('/private/tmp/seti-v316-case152-lean-native-path-delivery-20261107-v1.json');index=Path('/private/tmp/seti-v316-case152-lean-native-path-20261107-v1.index');assert not rp.exists()and not index.exists();r={'status':'validated-before-copy','baseCommit':base,'sharedIndexSha256':shared, 'scope':'Evidence only: two distinct frozen candidates; four first cold results, case152 fails time in both and step132 passes. All 65 exact existing witness rows, 237 timing results, validator and pending Session controls. No promotion or autonomous score.','privateIndex':str(index),'files':inventory};rp.write_text(json.dumps(r,indent=2)+'\n')
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
