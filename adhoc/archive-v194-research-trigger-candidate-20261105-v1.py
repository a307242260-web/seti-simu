from pathlib import Path
import hashlib
import json
import shutil
stage=Path(__file__).resolve().parents[1];prior=json.loads((stage/'reports/ai-foundation-20261105/candidate-v193-research-mark-20261105-v1/manifest.json').read_text())
dest=stage/'reports/ai-foundation-20261105/candidate-v194-research-trigger-20261105-v1';assert not(dest/'manifest.json').exists(),'preserve frozen source'
files=set(prior['sourceHashes'])|{'randomizer/game/ai/research-trigger-capital.js','randomizer/game/ai/research-trigger-capital.test.js','randomizer/game/cards/effects.js','randomizer/game/aliens/amiba.js','randomizer/game/production-kernel.js','randomizer/app/simulation-contract.js','randomizer/app/rule-observation.js','randomizer/index.html','tools/browser-smoke-inventory.js','adhoc/third-round-research-trigger-contract-20261105-v1.md'}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for name,digest in prior['baseRuntimeHashes'].items():
 if name not in files:assert sha(stage/name)==digest,name
for name in sorted(files):
 p=dest/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(stage/name,p)
manifest={'baseCommit':'d80f8330e90e2fd4af9ad907e23ae93041774ea2','searchVersion':'seti-complete-decision-search-v194','valueModel':'seti-purpose-capital-state-value-v24','status':'candidate-unadmitted','sourceHashes':{name:sha(stage/name)for name in sorted(files)},'baseRuntimeHashes':prior['baseRuntimeHashes'],'priorCandidate':'reports/ai-foundation-20261105/candidate-v193-research-mark-20261105-v1/manifest.json','scope':'Expose own consumed trigger state, revealed current Amiba symbols and pending native effect ownership through the common public observation. Quote one-shot typed research-symbol rules in the same funded paid/held portfolio, with shared consumption and formal symbol movement. No new marks or unknown card identities. Pending effects and unsupported research rules decline forecast; old capital upper bound declines active research triggers.','productionBudgets':prior['productionBudgets']}
(dest/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(str((dest/'manifest.json').relative_to(stage)))
