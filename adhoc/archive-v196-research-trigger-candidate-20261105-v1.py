from pathlib import Path
import hashlib
import json
import shutil
stage=Path(__file__).resolve().parents[1];prior=json.loads((stage/'reports/ai-foundation-20261105/candidate-v195-research-trigger-20261105-v1/manifest.json').read_text())
dest=stage/'reports/ai-foundation-20261105/candidate-v196-research-trigger-20261105-v1';assert not(dest/'manifest.json').exists(),'preserve frozen source'
files=set(prior['sourceHashes'])|{'randomizer/game/ai/probe-data-capital-key.test.js'};sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for name,digest in prior['baseRuntimeHashes'].items():
 if name not in files:assert sha(stage/name)==digest,name
for name in sorted(files):
 p=dest/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(stage/name,p)
manifest={**prior,'searchVersion':'seti-complete-decision-search-v196','sourceHashes':{name:sha(stage/name)for name in sorted(files)},'priorCandidate':'reports/ai-foundation-20261105/candidate-v195-research-trigger-20261105-v1/manifest.json','scope':prior['scope']+' V196 adds the available-data balance to the local mission investment scalar key; native-geometric wallet controls reproduce the old2data/3data capital collision and verify every supported mission against its ledger.'}
(dest/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(str((dest/'manifest.json').relative_to(stage)))
