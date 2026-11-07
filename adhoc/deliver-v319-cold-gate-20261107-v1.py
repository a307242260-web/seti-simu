from pathlib import Path
import json,hashlib,subprocess,os,shutil
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='c9666951afe6dd86bca66d2e2d2c9b94dd9473a6';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();paths=set()
prefix=Path('reports/ai-foundation-20261107')
checks=[
 ('teacher125-research-quotes-v318-v1','seti-v318-teacher125-research-quotes-20261107-v1','a4f5673be01445cdfff37891799eb2c183560de3dace958a4cc363f79e7f718d',184,148,717.73125),
 ('income-before-amiba-probe-v319-v1','seti-v319-income-before-amiba-probe-20261107-v1','6c56ce1d9ad240e6677eedd241d01993a84eb3a9a1637919818334e2c9a15949',1,1,610.175083)]
dirs=['teacher125-research-quotes-v1','income-before-amiba-v318-hotspots-v1','income-before-amiba-probe-ref-v1']+[x[0] for x in checks]
for directory in dirs:
 d=stage/prefix/directory;assert d.is_dir()
 paths.update(str(p.relative_to(stage)) for p in d.rglob('*') if p.is_file())
for directory,workspace,manifest_hash,labels,unique,failure_ms in checks:
 d=prefix/directory;mp=stage/d/'source-manifest-20261107-v1.json';m=json.loads(mp.read_text())
 assert sha(mp)==manifest_hash and sha(stage/m['parentManifest'])==m['parentManifestSha256']
 parent=json.loads((stage/m['parentManifest']).read_text());ws=Path('/private/tmp')/workspace
 assert set(m['changedSources'])=={n for n,h in m['sourceHashes'].items() if parent['sourceHashes'].get(n)!=h}
 for n,h in {**m['baseRuntimeHashes'],**m['sourceHashes']}.items():assert sha(ws/n)==h,n
 for n in m['changedSources']:assert sha(stage/d/'source-snapshot'/n)==m['sourceHashes'][n],n
 gate=json.loads((stage/d/'serial-cold-gate-20261107-v1.json').read_text())
 assert gate['status']=='failed-gate' and gate['manifestSha256']==sha(mp) and gate['cases']==1258 and len(gate['rows'])==labels and gate['measuredUniqueRoots']==unique
 assert gate['failure']['label']=='income-before-amiba' and gate['failure']['nativeInputs']==98 and abs(gate['failure']['milliseconds']-failure_ms)<1e-6
 assert sum(r['decisionGatePassed'] for r in gate['rows'])==labels-1
 for row in gate['rows']:
  raw=row['evidence'];q=json.loads((stage/raw).read_text())
  assert sha(stage/q['fixture'])==q['fixtureSha256'] and sha(stage/q['rawPath'])==q['rawSha256'] and sha(mp)==q['candidateSourceManifestSha256']
  assert q['rootAndRngUnchanged'] and q['complete'] and row['decisionGatePassed']==q['decisionGatePassed']
  paths.update([raw,q['rawPath']])
helpers=set()
for glob in ('*v317-teacher125-research-quote*20261107*.js','build-v318-income-before-amiba*20261107*.js','diagnose-v318-income-before-amiba*20261107*.js'):
 helpers.update(p.name for p in (stage/'adhoc').glob(glob))
assert len(helpers)==24,len(helpers)
paths.update('adhoc/'+n for n in helpers)
paths.update(['adhoc/freeze-v318-teacher125-research-quotes-20261107-v1.py','adhoc/freeze-v319-income-before-amiba-probe-20261107-v1.py','adhoc/gate-v318-research-quotes-20261107-v1.js','adhoc/gate-v319-funded-probe-scalar-20261107-v1.js','adhoc/verify-v318-research-quotes-gate-parity-20261107-v1.js','adhoc/verify-v319-funded-probe-scalar-20261107-v1.js','adhoc/profile-v318-income-before-amiba-native-path-20261107-v1.js','adhoc/human405-third-round-progress-20261107-v26.json','docs/human405-v318-v319-probe-quotes-20261107.md','adhoc/deliver-v319-cold-gate-20261107-v1.py'])
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
rp=Path('/private/tmp/seti-v319-cold-gate-delivery-20261107-v1.json');index=Path('/private/tmp/seti-v319-cold-gate-20261107-v1.index');assert not rp.exists()and not index.exists();r={'status':'validated-before-copy','baseCommit':base,'sharedIndexSha256':shared, 'scope':'Evidence only: V318 research quotes and V319 affordable probe quotes. V318 passes 183 labels and V319 first cold is 98 inputs/610.175083ms. No production change, promotion or autonomous score.','privateIndex':str(index),'files':inventory};rp.write_text(json.dumps(r,indent=2)+'\n')
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
