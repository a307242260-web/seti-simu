'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict'), zlib = require('node:zlib'), crypto = require('node:crypto');
const proto = require('./prototype-human405-atplanet-capital-20261031-v1');
const values = require('../randomizer/game/ai/state-value');
const { createSimulationRuleComposition } = require('../randomizer/training/simulation-rule-composition');
const { createSeededRandom } = require('../randomizer/game/random');
const { buildRuleObservation } = require('../randomizer/app/rule-observation');
const folder = 'reports/ai-foundation-20261023/', output = folder+'human405-atplanet-full-reward-prototype-20261031-v1.json';
assert(!fs.existsSync(output), 'Reuse prototype checkpoint');
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'), rows = [];
for (const step of [24,35,36,38,39,43,62]) {
  const source = folder+`human405-v99-native-witness-comparison-step${step}-20261031-v1.json`;
  const report = JSON.parse(fs.readFileSync(source)); assert.equal(sha(report.rawPath), report.rawSha256);
  for (const [p, h] of Object.entries(report.sourceHashes)) assert.equal(sha(p), h, p);
  const raw = JSON.parse(zlib.gunzipSync(fs.readFileSync(report.rawPath)));
  for (const r of raw) {
    const before = structuredClone(r.observation), base = values.evaluateStateValue(r.observation, 'player-white');
    const purpose = proto.atPlanetCapital(r.observation, 'player-white');
    assert.deepEqual(r.observation, before);
    rows.push({ step, name: r.name, source, sourceSha256: sha(source), boundary: r.observation.informationBoundary || null,
      base, purpose, withPurpose: base.total + purpose.value });
  }
}
// Native teacher35 is the same deployed-Mars situation after the other seats'
// mandatory PASS chains. Its actual fixed orbit/pick/scan/income witness is an
// independent source for the missing reward-chain value.
const fixture = 'adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-035-20261030-v1.json';
const f = JSON.parse(fs.readFileSync(fixture)), seed = f.source.seed;
const k = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (s,v) => buildRuleObservation(s,seed,v?.playerId) });
k.newGame({ seed }); const c = k.composition; let continuity;
try {
  assert(c.lifecycle.restore(f.compositionEnvelope).ok); const unchanged = c.lifecycle.save().envelope;
  const observation = c.projection({ role: 'player', playerId: f.seatId }).state;
  const before = values.evaluateStateValue(observation, f.seatId), forecast = proto.atPlanetCapital(observation, f.seatId);
  const native = rows.find(r => r.step === 35 && r.name === 'student-best');
  assert.equal(before.total, 52); assert.equal(forecast.value, 5.5);
  assert.equal(before.total + forecast.value, native.base.total);
  assert.equal(native.purpose.value, 0, 'consumed probe cannot retain the same mission forecast');
  assert.deepEqual(c.lifecycle.save().envelope, unchanged);
  continuity = { source: fixture, before, forecast, afterActualNativeWitness: native.base,
    afterMissionForecast: native.purpose.value, originalAndRngUnchanged: true,
    scope: 'Scalar reward-chain continuity on this native witness. Pick ties may select a different income card; no identity equivalence or global value theorem claimed.' };
} finally { c.dispose(); }
const b117 = rows.find(r => r.step === 24 && r.name === 'teacher-first'), dlc9 = rows.find(r => r.step === 24 && r.name === 'student-best');
assert.equal(b117.base.total, 52); assert.equal(b117.purpose.value, 5.5);
assert.equal(b117.withPurpose, 57.5); assert.equal(dlc9.withPurpose, 57);
// Resource funding is checked by exact native exchange coefficients, never by
// spending the same endpoint credit on an energy purchase as well.
assert.equal(proto.funding({ credits: 2, energy: 1 }, { credits: 1, energy: 3 }, values.DEFAULT_WEIGHTS), null);
assert.deepEqual(proto.funding({ credits: 3, energy: 1 }, { credits: 1, energy: 2 }, values.DEFAULT_WEIGHTS).spend,
  { credits: 3, energy: 1 });
const sourceHashes = Object.fromEntries(Object.keys(require.cache).filter(p=>p.startsWith(process.cwd()+'/randomizer/')).sort().map(p=>[p.slice(process.cwd().length+1),sha(p)]));
const report = { schemaVersion: 'seti-human405-atplanet-full-reward-hypothesis-v1', sourceCommit: '0dc7785da8a4dce7bc81eabbb7dc92dcf6faf58f',
  sourceHashes, prototype: 'adhoc/prototype-human405-atplanet-capital-20261031-v1.js',
  prototypeSha256: sha('adhoc/prototype-human405-atplanet-capital-20261031-v1.js'), rows, continuity,
  productionAdmitted: false, baselineEligible: false, goalStatus: 'active',
  findings: ['Native B11752 plus one currently funded Mars mission5.5 becomes57.5 versus DLC9line57. The missing term follows the native reward chain, not a card-specific bonus.',
    'Mission quotes include native fees, exchange loss, capped data, known public pick/income with card consumption, and compatible held/paid technology terms. Unknown cards are counted only; mandatory unresolved unknown income declines a quote.',
    'Only one at-location mission is valued, max not sum across probes/targets. Sector completion, species rewards, future launches, public replacement identities and additional movement remain excluded.',
    'This is an unadmitted hypothesis. Native requested-seat land-cost correctness, full/compact input design, old bound/typed proof guards, arbitrary hidden worlds, all cold gates and autonomous behavior must be validated before production use.'] };
fs.writeFileSync(output, JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ output, B117: b117.withPurpose, DLC9: dlc9.withPurpose,
  continuity: { before: continuity.before.total, forecast: continuity.forecast.value, after: continuity.afterActualNativeWitness.total },
  rows: rows.map(r=>({step:r.step,name:r.name,base:r.base.total,purpose:r.purpose.value,withPurpose:r.withPurpose})) }));
