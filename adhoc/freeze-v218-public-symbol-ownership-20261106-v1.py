from pathlib import Path
import hashlib,json,subprocess
w=Path(__file__).resolve().parents[1];sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();proof=json.loads((w/'reports/ai-foundation-20261105/third-round-teacher-v1/v214-current-source-admission-20261106-v1.json').read_text());names=['randomizer/game/aliens/amiba.js','randomizer/game/ai/research-trigger-capital.js','randomizer/game/ai/known-symbol-capital.js','randomizer/game/ai/research-trigger-capital.test.js','randomizer/game/end-game-scoring.js','randomizer/game/ai/probe-capital.js','randomizer/game/ai/amiba-analysis-capital.js','randomizer/game/ai/state-value.js','randomizer/game/ai/decision-search.js','randomizer/game/ai/amiba-analysis-capital.test.js','randomizer/game/ai/research-mark-capital.test.js','tools/node-test-inventory.js','tools/browser-smoke-inventory.js','tools/audit_v_state_inputs.js'];folder=w/'reports/ai-foundation-20261106/candidate-v218-public-symbol-ownership-v1'
for n,h in proof['runtimeSourceHashes'].items():
 if n not in names:assert sha(w/n)==h,n
for n in names:subprocess.run(['node','--check',n],cwd=w,check=True)
m={'schemaVersion':'seti-frozen-candidate-source-v1','baseCommit':'e2dfeb9f74725a41f2c31f44a632d7e1822799e1','candidate':'V218/V37','searchVersion':'seti-complete-decision-search-v218','valueModel':'seti-purpose-capital-state-value-v37','candidateAdmitted':False,'baseRuntimeHashes':proof['runtimeSourceHashes'],'sourceHashes':{n:sha(w/n) for n in names},'newAutonomousRuns':0,'scope':'Correct already-earned stable pending B mark income-analysis guard; formally expose next unclaimed followingThreshold, preserve source choice identity and reject new thresholds. Use readonly public trace inputs and copy only candidate blue/symbol write paths. Bound64 raw formal research-mark scalar maps keyed by full tech/mark JSON; funding, triggers, new marks and native nodes never cached; Readonly native public symbol/trace borrows; detached observation snapshots remain default, private symbol-location copies for trigger/symbol/analysis ledgers. Whole-purpose parity against frozen V217 required. No native entity, observation fabrication, node equivalence, budget, research or symbol policy changes.'}
if folder.exists():
 assert json.loads((folder/'manifest.json').read_text())==m
 for n,h in m['sourceHashes'].items():assert sha(folder/'source-files'/n)==h,n
 print(json.dumps({'frozen':str(folder.relative_to(w)),'files':len(names),'reused':True}));raise SystemExit(0)
folder.mkdir(parents=True)
for n in names:
 p=folder/'source-files'/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((w/n).read_bytes())
(folder/'manifest.json').write_text(json.dumps(m,indent=2)+'\n');print(json.dumps({'frozen':str(folder.relative_to(w)),'files':len(names)}))
