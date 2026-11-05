from pathlib import Path
import hashlib
import json
import shutil
stage=Path(__file__).resolve().parents[1];prior=json.loads((stage/'reports/ai-foundation-20261105/candidate-v194-research-trigger-20261105-v1/manifest.json').read_text())
dest=stage/'reports/ai-foundation-20261105/candidate-v195-research-trigger-20261105-v1';assert not(dest/'manifest.json').exists(),'preserve frozen source'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for name,digest in prior['baseRuntimeHashes'].items():
 if name not in prior['sourceHashes']:assert sha(stage/name)==digest,name
for name in sorted(prior['sourceHashes']):
 p=dest/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(stage/name,p)
manifest={**prior,'searchVersion':'seti-complete-decision-search-v195','sourceHashes':{name:sha(stage/name)for name in sorted(prior['sourceHashes'])},'priorCandidate':'reports/ai-foundation-20261105/candidate-v194-research-trigger-20261105-v1/manifest.json','scope':prior['scope']+' V195 uses an explicit zero-origin score-delta ledger for mission balance wallets, retaining native reward/value semantics and adding partial-wallet plus active-trigger/native-launch regression. V194 fifth-root exception remains separate.'}
(dest/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(str((dest/'manifest.json').relative_to(stage)))
