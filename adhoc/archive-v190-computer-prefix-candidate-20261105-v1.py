from pathlib import Path
import hashlib,json,shutil
stage=Path(__file__).resolve().parents[1];dest=stage/'reports/ai-foundation-20261105/candidate-v190-computer-prefix-20261105-v1';manifest=dest/'manifest.json'
assert not manifest.exists(),'reuse frozen candidate source; do not overwrite'
files=['randomizer/game/ai/resource-demand.js','randomizer/game/ai/local-decision-plans.js','randomizer/game/ai/analysis-port.js','randomizer/game/ai/decision-search.js','randomizer/game/ai/computer-prefix-plan.test.js','randomizer/game/ai/winning-income-plan.test.js','tools/node-test-inventory.js','adhoc/third-round-computer-prefix-contract-20261105-v1.md','adhoc/benchmark-third-round-decision-20261105-v1.js']
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
previous=json.loads((stage/'reports/ai-foundation-20261104/two-rounds-teacher-v2/v189-first2-result-source-check-20261105-v1.json').read_text())
changed=set(files)
for p,h in previous['runtimeSourceHashes'].items():
 if p not in changed:assert sha(stage/p)==h,p
hashes={p:sha(stage/p)for p in files}
for p in files:
 target=dest/p;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(stage/p,target)
manifest.write_text(json.dumps({'baseCommit':'c5e8ca89fe9964a1832cc41051cf63c3bd30acc5','searchVersion':'seti-complete-decision-search-v190','valueModel':'seti-purpose-capital-state-value-v22','status':'candidate-unadmitted','sourceHashes':hashes,'baseRuntimeHashes':previous['runtimeSourceHashes'],'scope':'Greedy funded computer prefix only; no future trigger capital yet; no new autonomous game. Changed winning-income test after exact-root policy ablation confirmed new9input held-research path60.1667 vs legacy13input blind-income53.6667. Old test/failure retained.','productionBudgets':{'transitions':None,'nodes':None,'frontier':None,'milliseconds':None}},indent=2)+'\n')
print(str(manifest.relative_to(stage)))
