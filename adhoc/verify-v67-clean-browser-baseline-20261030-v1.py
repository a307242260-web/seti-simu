from pathlib import Path
import subprocess,json,gzip,hashlib
root=Path('/Users/bilibili/code/seti-simu');b=Path(__file__).resolve().parents[1];base='7422f7550414bd648d0edef58e53aaf2ee141ea1'
snapshot=json.loads(gzip.decompress((b/'adhoc/human405-v92-candidate-source-20261030-v1.json.gz').read_bytes()))
paths=[p for p in snapshot['files'] if p=='randomizer/index.html' or p.startswith('randomizer/') and p.endswith('.js') and not p.endswith('.test.js')]
saved={p:(b/p).read_bytes() for p in paths};log=b/'reports/ai-foundation-20261023/human405-v67-clean-browser-parity-20261030-v1.log';out=b/'reports/ai-foundation-20261023/human405-v67-clean-browser-parity-20261030-v1.json';assert not out.exists()
try:
 hashes={}
 for p in paths:
  data=subprocess.check_output(['git','show',base+':'+p],cwd=root);(b/p).write_bytes(data);hashes[p]=hashlib.sha256(data).hexdigest()
 with log.open('w') as stdout:r=subprocess.run(['node','tools/run_browser_smokes.js','--match','production-browser-full-parity'],cwd=b,stdout=stdout,stderr=subprocess.STDOUT)
 out.write_text(json.dumps({'baseCommit':base,'runtimeVersion':'v67','scope':'Clean private runtime overlay restored from HEAD; source baseline, not the shared working tree with two missing files.','sourceHashes':hashes,'exitCode':r.returncode,'log':str(log.relative_to(b))},indent=2)+'\n');print(json.dumps({'exitCode':r.returncode,'log':str(log.relative_to(b))}))
finally:
 for p,data in saved.items():(b/p).write_bytes(data)
