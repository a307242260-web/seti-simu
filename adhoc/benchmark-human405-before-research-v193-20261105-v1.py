"""One new baseline decision, on the existing clean V193 reconstruction; no game rollout."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
stage=Path(__file__).resolve().parents[1];folder=Path('reports/ai-foundation-20261105/third-round-teacher-v1')
fixture=folder/'teacher-r3-before-first-research-root-20261105-v1.json';output=folder/'v193-cold-teacher-r3-before-first-research-20261105-v1.json'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
if(stage/output).exists():
 r=json.loads((stage/output).read_text());assert r['fixtureSha256']==sha(stage/fixture)and r['rawSha256']==sha(stage/r['rawPath']);print(json.dumps({'reused':True,'output':str(output)}));raise SystemExit(0)
proof=json.loads((stage/folder/'v193-independent-candidate-verification-20261105-v1.json').read_text());clean=Path(proof['snapshot']);manifest_path=Path(proof['manifest']);manifest=json.loads((stage/manifest_path).read_text())
for name,digest in manifest['baseRuntimeHashes'].items():assert sha(clean/name)==manifest['sourceHashes'].get(name,digest),name
for name,digest in manifest['sourceHashes'].items():assert sha(clean/name)==digest,name
target=clean/fixture;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((stage/fixture).read_bytes())
if not(clean/manifest_path.parent).exists():shutil.copytree(stage/manifest_path.parent,clean/manifest_path.parent)
assert sha(clean/manifest_path)==proof['manifestSha256']
log=folder/'v193-before-first-research-baseline-cli-20261105-v1.log';assert not(stage/log).exists()
with(stage/log).open('wb')as stream:
 result=subprocess.run(['node','adhoc/benchmark-third-round-decision-20261105-v1.js','teacher-r3-before-first-research',str(fixture)],cwd=clean,env=dict(os.environ,SETI_CANDIDATE_SOURCE_MANIFEST=str(manifest_path)),stdout=stream,stderr=subprocess.STDOUT,timeout=55)
assert result.returncode==0,(stage/log).read_text()[:1500]
r=json.loads((clean/output).read_text());assert r['complete']and r['rootAndRngUnchanged']
for path in [output,Path(r['rawPath'])]:assert not(stage/path).exists();shutil.copyfile(clean/path,stage/path)
print(json.dumps({k:r[k]for k in ['label','actionId','value','nativeInputs','milliseconds','decisionGatePassed']}))
