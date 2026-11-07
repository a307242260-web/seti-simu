from pathlib import Path
import hashlib,json,os,subprocess
stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');rp=Path('/private/tmp/seti-v314-case152-closure-delivery-20261107-v1.json');r=json.loads(rp.read_text());assert r['status']=='copied-and-private-index-verified';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();assert sha(repo/'.git/index')==r['sharedIndexSha256'];assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()==r['baseCommit'];env={**os.environ,'GIT_INDEX_FILE':r['privateIndex'],'GIT_OPTIONAL_LOCKS':'0'}
def git(*args):return subprocess.check_output(['git',*args],cwd=repo,env=env)
assert git('write-tree').decode().strip()==r['snapshotTree'];D='reports/ai-foundation-20261107/case152-completed-prefix-v1/';items={i['path']:i for i in r['files']}
paths=['docs/human405-case152-fixed-closure-20261107.md','adhoc/case152-timing-next-contract-20261107-v1.md','adhoc/human405-third-round-progress-20261107-v21.json','adhoc/profile-v314-case152-blue-stop-ties-20261107-v1.js','adhoc/materialize-v314-case152-tie-safe-20261107-v14.js','adhoc/verify-v314-case152-tie-safe-native-20261107-v14.js','adhoc/extend-v314-case152-delivery-ties-20261107-v1.py']+[D+n for n in ['fixed-blue-stop-ties-20261107-v1.json','local-decision-plans-tie-safe-prototype-20261107-v14.js','combined-tie-safe-proofs-20261107-v14.json','combined-tie-safe-proofs-20261107-v14.checkpoint.json','combined-tie-safe-independent-20261107-v14.json','tie-boundary-audit-20261107-v1.json','blue-stop-ties-20261107-v1.log','tie-safe-20261107-v14.log','tie-safe-independent-20261107-v14.log']]
for n in paths:
 src=stage/n;dst=repo/n;assert src.is_file()and not src.is_symlink();assert sha(dst)==items[n]['sha256'] if n in items else not dst.exists(),n
 if n.endswith('.js'):subprocess.run(['node','--check',str(src)],check=True,capture_output=True)
for n in paths:
 src=stage/n;dst=repo/n;dst.parent.mkdir(parents=True,exist_ok=True)
 if n in items:assert sha(dst)==items[n]['sha256'];dst.write_bytes(src.read_bytes())
 else:
  with dst.open('xb')as f:f.write(src.read_bytes())
 items[n]={'path':n,'sha256':sha(src),'bytes':src.stat().st_size};assert sha(dst)==items[n]['sha256']
git('add','--',*paths);tree=git('write-tree').decode().strip();assert set(git('diff','--cached','--name-only','-z',r['baseCommit']).decode().strip('\0').split('\0'))==set(items)
for n,item in items.items():assert hashlib.sha256(git('cat-file','blob',tree+':'+n)).hexdigest()==item['sha256'],n
proof=json.loads((repo/'reports/ai-foundation-20261107/autonomous-first3-harness-v1/production-validation-20261107-v2.json').read_text());assert len(proof['productionRuntimeHashes'])==339
for n,h in proof['productionRuntimeHashes'].items():assert hashlib.sha256(git('cat-file','blob',tree+':'+n)).hexdigest()==h,n
assert sha(repo/'.git/index')==r['sharedIndexSha256'];r.update(snapshotTree=tree,files=sorted(items.values(),key=lambda x:x['path']),filesVerified=len(items),bytes=sum(x['bytes']for x in items.values()),tieBoundaryAudit='9 equal primary ties; conservative291/900.345ms,777 inputs verified via57 exact previous+8 independent32 Native. Prototype256/818 is not admission evidence.',productionRuntimeUnchanged=True,sharedIndexPreserved=True);rp.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:r[k]for k in ['status','snapshotTree','filesVerified','bytes','tieBoundaryAudit']}))
