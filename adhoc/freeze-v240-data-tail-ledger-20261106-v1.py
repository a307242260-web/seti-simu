from pathlib import Path
import hashlib,json,subprocess
w=Path(__file__).resolve().parents[1];sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();base='bc898c2d33e87527fd09071bef21af4cc1448f49';F=Path('reports/ai-foundation-20261105/third-round-teacher-v1');prior=json.loads((w/F/'v239-current-source-admission-20261106-v1.json').read_text());names=['randomizer/game/ai/local-decision-plans.js','randomizer/game/ai/decision-search.js','randomizer/game/ai/exact-data-tail-arithmetic.test.js','tools/node-test-inventory.js'];runtime=prior['runtimeSourceHashes']
for n,h in runtime.items():
 if n not in names:assert sha(w/n)==h,n
for n in names:subprocess.run(['node','--check',n],cwd=w,check=True)
folder=w/'reports/ai-foundation-20261106/candidate-v240-data-tail-ledger-v1';assert not folder.exists();folder.mkdir(parents=True)
m={'schemaVersion':'seti-frozen-candidate-source-v1','baseCommit':base,'candidate':'V240/V43','searchVersion':'seti-complete-decision-search-v240','valueModel':'seti-purpose-capital-state-value-v43','candidateAdmitted':False,'baseRuntimeHashes':runtime,'sourceHashes':{n:sha(w/n)for n in names},'newAutonomousRuns':0,'scope':'Only sum already quoted default-model fixed income/computer/blue/end deltas with the existing exact integer value ledger. One-ULP drift previously made the existing strict proof gate reject an otherwise Native-verified six-input tail. No new search option, pruning bound, information continuation, semantic state equivalence, unknown identity, budget or value-model change. Complete Native states/actor/session/RNG/intent remain; all four budgets null. V239 actual first484-input/1036ms failure and current model controls retained. Free-alien known-tail horizon remains investigation only, not implemented by this candidate.'}
for n in names:p=folder/'source-files'/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((w/n).read_bytes())
(folder/'manifest.json').write_text(json.dumps(m,indent=2)+'\n');print(folder.relative_to(w))
