from pathlib import Path
import hashlib
import json
import shutil
stage=Path(__file__).resolve().parents[1];prior=json.loads((stage/'reports/ai-foundation-20261105/candidate-v196-research-trigger-20261105-v1/manifest.json').read_text())
dest=stage/'reports/ai-foundation-20261105/candidate-v197-stationary-prefix-20261105-v1';assert not(dest/'manifest.json').exists(),'preserve frozen source'
files=set(prior['sourceHashes'])|{'randomizer/game/ai/ready-analysis-capital.test.js','randomizer/game/ai/stationary-computer-tail.test.js','adhoc/third-round-stationary-prefix-contract-20261105-v1.md'};sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for name,digest in prior['baseRuntimeHashes'].items():
 if name not in files:assert sha(stage/name)==digest,name
for name in sorted(files):
 p=dest/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(stage/name,p)
manifest={**prior,'searchVersion':'seti-complete-decision-search-v197','sourceHashes':{name:sha(stage/name)for name in sorted(files)},'priorCandidate':'reports/ai-foundation-20261105/candidate-v196-research-trigger-20261105-v1/manifest.json','scope':prior['scope']+' V197 proves stationary held-data tails only after per-boundary movement and native acquisition policy checks, and sums audited quiet-tail values on the existing exact default ledger grid. No income/general pruning proof widening; tests verify six fractional native tails and unchanged complete268-input graph choice/value within256.'}
(dest/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(str((dest/'manifest.json').relative_to(stage)))
