'use strict';
// Read saved, independently replayed native observations. No new search or game.
const fs = require('node:fs'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const value = require('../randomizer/game/ai/state-value');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const comparisonPath = 'reports/ai-foundation-20261023/human405-b117-prefix-r1-comparison-20261031-v1.json';
const comparison = read(comparisonPath), output = 'reports/ai-foundation-20261023/human405-r1-capital-ledger-20261031-v1.json';
assert(!fs.existsSync(output), 'Reuse saved ledger');
function traces(row) {
  assert.equal(sha(row.tracePath), row.traceSha256); assert(row.strictNativeReplay);
  return fs.readFileSync(row.tracePath, 'utf8').trim().split('\n').map(JSON.parse);
}
const controlled = traces(comparison.intervention), control = traces(comparison.control);
const at = (rows, opening, input) => rows[input - opening - 1];
function snapshot(trace) {
  assert.equal(trace.context.seatId, 'player-white');
  const o = trace.context.observation, p = o.publicState.players.find(p => p.playerId === 'player-white');
  return { value: value.evaluateStateValue(o, 'player-white'), wallet: { credits: p.credits, energy: p.energy, publicity: p.publicity, availableData: p.availableData },
    income: p.income, technology: p.techState, probes: o.publicState.board.rockets };
}
const beforeResearch = snapshot(at(controlled, 27, 35)), afterResearch = snapshot(at(controlled, 27, 41));
const afterOrbit = snapshot(at(controlled, 27, 53)), controlFirstTurnEnd = snapshot(at(control, 23, 36));
assert.deepEqual(beforeResearch.probes.map(p => p.id), afterResearch.probes.map(p => p.id));
assert.notDeepEqual(beforeResearch.probes, afterResearch.probes);
assert.equal(beforeResearch.value.total, 42); assert.equal(afterResearch.value.total, 53.5);
const delta = (a, b) => Object.fromEntries(Object.keys(a.value.components).map(k => [k, b.value.components[k] - a.value.components[k]]));
const report = { schemaVersion: 'seti-human405-native-capital-ledger-v1', comparisonPath, comparisonSha256: sha(comparisonPath),
  modelVersion: beforeResearch.value.modelVersion, researchChangesNativeGeometry: true, beforeResearch, afterResearch, afterOrbit, controlFirstTurnEnd,
  nativeResearchInputs: comparison.intervention.whiteActions.filter(e => e.input >= 35 && e.input <= 40),
  researchDelta: { total: afterResearch.value.total - beforeResearch.value.total, components: delta(beforeResearch, afterResearch) },
  orbitTurnDelta: { total: afterOrbit.value.total - afterResearch.value.total, components: delta(afterResearch, afterOrbit) },
  sourceHashes: { 'randomizer/game/ai/state-value.js': sha('randomizer/game/ai/state-value.js') },
  findings: ['The recorded B117 continuation buys blue1 from retained7publicity before orbit. This later research turn adds11.5V: score7, resources-3, technology potential7.5; research rotates the board/probe geometry, while the wallet remains3credits/1energy.',
    'This demonstrates a second omission to investigate: current fixed publicity weights do not represent the funded later technology purpose, while already-owned blue1 immediately receives7.5technology potential.',
    'The next orbit turn adds7.5V in this recorded world. It includes later public choices/replacements and cannot be credited blindly at the initial root.',
    'These are saved native path ledgers, not a new evaluator, an admissible bound, a guarantee of future affordability or an instruction to imitate teacher actions. Shared budgets, research-induced rotation and known-information reward dependencies must be proved before combining research and probe forecasts.'],
  productionChange: false, baselineEligible: false, goalStatus: 'active' };
assert.deepEqual(report.researchDelta, { total: 11.5, components: { realizedScore: 7, currentEndGameBonus: 0, resources: -3, hand: 0, income: 0, technologyPotential: 7.5, handPotential: 0 } });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, researchDelta: report.researchDelta, orbitTurnDelta: report.orbitTurnDelta }));
