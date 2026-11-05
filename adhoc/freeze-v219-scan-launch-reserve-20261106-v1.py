from pathlib import Path
import hashlib,json,subprocess
w=Path(__file__).resolve().parents[1];sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();proof=json.loads((w/'reports/ai-foundation-20261105/third-round-teacher-v1/v218-current-source-admission-20261106-v1.json').read_text());names=['randomizer/game/ai/local-decision-plans.js','randomizer/game/ai/analysis-port.js','randomizer/game/ai/decision-search.js','randomizer/game/ai/scan-launch-plan.test.js','tools/node-test-inventory.js','tools/browser-smoke-inventory.js'];folder=w/'reports/ai-foundation-20261106/candidate-v219-scan-launch-reserve-v1'
for n,h in proof['runtimeSourceHashes'].items():
 if n not in names:assert sha(w/n)==h,n
for n in names:subprocess.run(['node','--check',n],cwd=w,check=True)
m={'schemaVersion':'seti-frozen-candidate-source-v1','baseCommit':'5659fd16b036065734fc708ba2e52001ba4caa03','candidate':'V219/V37','searchVersion':'seti-complete-decision-search-v219','valueModel':'seti-purpose-capital-state-value-v37','candidateAdmitted':False,'baseRuntimeHashes':proof['runtimeSourceHashes'],'sourceHashes':{n:sha(w/n)for n in names},'newAutonomousRuns':0,'scope':'Retain standard scan goals, add explicit purple4 launch reserve variants only when extra energy is missing and current Production launch capacity/earth availability permits. Fixed resource preparation and native launch; exact intent flag tracked, incomplete launch goals infeasible. Native state identity, actor/session/RNG, resource lower bounds and four null budgets unchanged. No scalar evaluator or native rules changes.'}
assert not folder.exists();folder.mkdir(parents=True)
for n in names:p=folder/'source-files'/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((w/n).read_bytes())
(folder/'manifest.json').write_text(json.dumps(m,indent=2)+'\n');print(json.dumps({'frozen':str(folder.relative_to(w)),'files':len(names)}))
