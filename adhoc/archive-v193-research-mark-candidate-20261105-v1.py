from pathlib import Path
import hashlib
import json
import shutil

stage=Path(__file__).resolve().parents[1]
prior=json.loads((stage/'reports/ai-foundation-20261105/candidate-v192-computer-prefix-20261105-v1/manifest.json').read_text())
dest=stage/'reports/ai-foundation-20261105/candidate-v193-research-mark-20261105-v1'
assert not (dest/'manifest.json').exists(), 'preserve frozen candidate'
files=set(prior['sourceHashes'])|{'randomizer/game/ai/state-value.js','randomizer/game/ai/probe-capital.js','randomizer/game/ai/research-mark-capital.test.js','randomizer/game/ai/probe-capital-value.test.js','adhoc/third-round-research-mark-contract-20261105-v1.md'}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for name,digest in prior['baseRuntimeHashes'].items():
    if name not in files:assert sha(stage/name)==digest,name
for name in sorted(files):
    target=dest/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(stage/name,target)
manifest={'baseCommit':'5f234dac2e10de6d13ef4e1fdd60d6679eab2fe7','searchVersion':'seti-complete-decision-search-v193','valueModel':'seti-purpose-capital-state-value-v23','status':'candidate-unadmitted','sourceHashes':{name:sha(stage/name)for name in sorted(files)},'baseRuntimeHashes':prior['baseRuntimeHashes'],'priorCandidate':'reports/ai-foundation-20261105/candidate-v192-computer-prefix-20261105-v1/manifest.json','scope':'Existing claimed D1/D2 growth in the same funded paid/held research portfolio; second research reprices marker growth after the first. No new future mark or continuing-trigger forecast. Legacy post-main capital bound declines an owned D mark. Retain V192 computer-prefix and strict scalar tail. Probe regression test preserves explicit native income counterfactual and validates preferred shorter computer prefix.','productionBudgets':prior['productionBudgets']}
(dest/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(str((dest/'manifest.json').relative_to(stage)))
