from pathlib import Path
import hashlib,json,shutil
stage=Path(__file__).resolve().parents[1];previous='reports/ai-foundation-20261105/candidate-v198-known-symbol-20261105-v1/manifest.json';prior=json.loads((stage/previous).read_text());dest=stage/'reports/ai-foundation-20261105/candidate-v199-amiba-analysis-20261105-v1';assert not(dest/'manifest.json').exists(),'preserve frozen candidate'
files=set(prior['sourceHashes'])|{'randomizer/game/ai/ready-analysis-capital.js','randomizer/game/ai/amiba-analysis-capital.js','randomizer/game/ai/amiba-analysis-capital.test.js','randomizer/game/aliens/amiba.js','randomizer/app/rule-observation.js','tools/audit_v_state_inputs.js','adhoc/third-round-amiba-analysis-contract-20261105-v1.md'};sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for n,h in prior['baseRuntimeHashes'].items():
 if n not in files:assert sha(stage/n)==h,n
for name in sorted(files):
 p=dest/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(stage/name,p)
m={**prior,'baseCommit':'b8160e6f7739432b30f978c60e11db999f657fe4','searchVersion':'seti-complete-decision-search-v199','valueModel':'seti-purpose-capital-state-value-v26','sourceHashes':{n:sha(stage/n)for n in sorted(files)},'priorCandidate':previous,'scope':'Current funded ready Amiba analysis using public occupancy and draw counts, formal blue rewards/locked region and shared portfolio opportunity cost; one currency-blue tail. Unknown cards never supply identity, income gains or funding. Narrow final anonymous income consumption floor retains already-funded pure-resource mission value. No native successor, entity allocation or new pruning bound.'};(dest/'manifest.json').write_text(json.dumps(m,indent=2)+'\n');print(str((dest/'manifest.json').relative_to(stage)))
