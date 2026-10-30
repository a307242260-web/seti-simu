'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict'), crypto = require('node:crypto'), zlib = require('node:zlib');
const { createSimulationRuleComposition } = require('../randomizer/training/simulation-rule-composition');
const { createSeededRandom } = require('../randomizer/game/random');
const { buildRuleObservation } = require('../randomizer/app/rule-observation');
const { createAnalysisPort } = require('../randomizer/game/ai/analysis-port');
const search = require('../randomizer/game/ai/decision-search'), values = require('../randomizer/game/ai/state-value');
const agent = require('../randomizer/game/ai/search-agent');
const fixture = 'adhoc/ai-decision-corpus-20261031-v98-pass-boundary-v1/autonomous-before-pass-20261031-v1.json';
const output = 'reports/ai-foundation-20261023/human405-v99-autonomous-pass-root-cold-20261031-v1.json';
assert(!fs.existsSync(output), 'Reuse recorded cold sample');
assert.equal(search.VERSION, 'seti-complete-decision-search-v99');
const f = JSON.parse(fs.readFileSync(fixture)), seed = f.source.seed;
const k = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (s, viewer) => buildRuleObservation(s, seed, viewer?.playerId) });
k.newGame({ seed }); const c = k.composition;
assert(c.lifecycle.restore(f.compositionEnvelope).ok);
const before = c.lifecycle.save().envelope, port = createAnalysisPort({ composition: c, seatId: f.seatId, maxCacheEntries: 0 });
try {
  const at = performance.now(), root = port.openRoot();
  const result = search.searchDecision({ port, root, evaluate: values.createStateValueEvaluator(f.seatId), ...agent.OPTIONS, budget: agent.BUDGET });
  const milliseconds = performance.now() - at;
  assert(result.complete && result.unresolved.length === 0, result.stopReason);
  const chosen = root.legalActions.find(a => a.actionId === result.actionId);
  assert.equal(chosen.family, 'research_tech', 'native counterexample must stop preferring PASS');
  assert.deepEqual(c.lifecycle.save().envelope, before);
  const rawPath = output.replace('.json', '.raw.json.gz'), bytes = zlib.gzipSync(JSON.stringify(result) + '\n');
  fs.writeFileSync(rawPath, bytes);
  const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  const report = { schemaVersion: 'seti-human405-pass-root-gate-v1', searchVersion: search.VERSION,
    fixture, fixtureSha256: sha(fixture), complete: true, rootAndRngUnchanged: true, chosen,
    value: result.value, nativeInputs: result.diagnostics.nativeExecutions, milliseconds,
    within256Inputs600ms: result.diagnostics.nativeExecutions <= 256 && milliseconds <= 600,
    rawPath, rawSha256: sha(rawPath), sourceHashes: Object.fromEntries(Object.keys(require.cache)
      .filter(p => p.startsWith(process.cwd() + '/randomizer/')).sort().map(p => [p.slice(process.cwd().length + 1), sha(p)])),
    scope: 'One fresh cold sample from the previous autonomous native PASS root, no game rerun or forced human prefix.' };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ output, action: chosen.family, value: result.value, native: report.nativeInputs, milliseconds, gate: report.within256Inputs600ms }));
  assert(report.within256Inputs600ms);
} finally { port.close(); c.dispose(); }
