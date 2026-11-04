'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { createSimulationRuleComposition } = require('../randomizer/training/simulation-rule-composition');
const { createSeededRandom } = require('../randomizer/game/random');
const { buildRuleObservation } = require('../randomizer/app/rule-observation');
const ruleComposition = require('../randomizer/game/rule-composition');
const data = require('../randomizer/game/data');
const cards = require('../randomizer/game/cards/deck');
const values = require('../randomizer/game/ai/state-value');
const prototype = require('./prototype-v152-research-income-capital-20261104-v1');
const owner = s => s.players.players.find(p => p.id === 'player-white');
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const read = p => JSON.parse(fs.readFileSync(p));
const source = 'reports/ai-foundation-20261104/two-rounds-teacher-v2/v148-first-launch-timing-native-20261104-v1.json';
const witness = read(source), seed = read(witness.fixture).source.seed, seatId = 'player-white';
const out = process.env.SETI_RESEARCH_INCOME_OUTPUT || 'reports/ai-foundation-20261104/two-rounds-teacher-v2/v152-research-income-native-controls-20261104-v2.json';
assert(!fs.existsSync(out), 'Evidence already exists; inspect it rather than repeat unchanged controls.');
const base = witness.freeFirstTurn.envelope;
const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (s, viewer) => buildRuleObservation(s, seed, viewer?.playerId) });
kernel.newGame({ seed });
const c = kernel.composition, legal = () => c.inspect().session?.decision?.choices || c.inputPort.enumerateActions({});
const envelopeState = e => e.session?.session?.workingState || JSON.parse(e.committedState);
const observation = () => c.projection({ role: 'player', playerId: seatId }).state;
const report = { sourceCommit: '03e58e0de42f09c4e9c19298c9595330beb02999', source,
  sourceSha256: sha(fs.readFileSync(source)), prototypeSha256: sha(fs.readFileSync('adhoc/prototype-v152-research-income-capital-20261104-v1.js')),
  status: 'running', goalStatus: 'active', goalAchieved: false, rows: [],
  scope: 'Independent scalar prototype and individually submitted native research/pick/data/income controls. Official hidden-information sanitizer masks all new cards and uncovered bonuses. No autonomous game, production edit or pruning claim.' };
const persist = () => fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
let allInputs = 0;
function submit(action) {
  assert(action, 'Required native input missing');
  const d = c.inspect().session?.decision;
  const result = d ? c.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion,
    ownerId: d.ownerId, choice: action }) : action.phase === 'quick'
    ? c.inputPort.submitQuickAction(action) : c.inputPort.submitAction(action);
  assert(result.ok, JSON.stringify(result));
  allInputs++;
  return { actionId: action.actionId, family: action.family, target: action.target };
}
function makeState(spec) {
  const state = JSON.parse(base.committedState), p = owner(state);
  state.turn.roundNumber = spec.round;
  state.turn.currentPlayerId = seatId;
  Object.assign(p.resources, { credits: spec.credits, energy: spec.energy, publicity: spec.publicity });
  for (const key of Object.keys(p.blueBonusResources || {})) p.blueBonusResources[key] = Math.min(p.blueBonusResources[key], p.resources[key]);
  while (p.dataState.poolTokens.length > spec.stock) { p.dataState.poolTokens.pop(); p.dataState.discardedCount++; }
  p.resources.availableData = p.dataState.poolTokens.length;
  if (spec.onlyIncomeCode != null) {
    const zones = [state.cards.publicCards, state.cards.discardPile, ...Object.values(state.cards.passReservePiles)];
    const allBefore = zones.flat().filter(Boolean).map(c => c.id).sort();
    const card = zones.flat().find(c => c && cards.getIncomeCodeForCard(c) === spec.onlyIncomeCode);
    assert(card, 'Control needs a real conserved card with income code ' + spec.onlyIncomeCode);
    const zone = zones.find(zone => zone.some(c => c?.id === card.id));
    const at = zone.findIndex(c => c?.id === card.id);
    zone[at] = state.cards.publicCards[0];
    state.cards.publicCards[0] = card;
    state.cards.discardPile.push(...state.cards.publicCards.slice(1).filter(Boolean));
    state.cards.publicCards = [card, null, null];
    assert.deepEqual([state.cards.publicCards, state.cards.discardPile, ...Object.values(state.cards.passReservePiles)].flat().filter(Boolean).map(c => c.id).sort(), allBefore);
  }
  return state;
}
try {
  const specs = [];
  for (const round of [1, 2]) for (const credits of [0, 2, 4]) for (const energy of [0, 1, 2])
    for (const publicity of [5, 7]) for (const stock of [3, 4]) specs.push({ round, credits, energy, publicity, stock });
  for (const onlyIncomeCode of [0, 1, 2]) for (const round of [1, 3])
    for (const credits of [0, 2]) for (const energy of [0, 1]) for (const publicity of [6, 12])
      specs.push({ onlyIncomeCode, round, credits, energy, publicity, stock: 4 });
  // Each source is a fresh canonical control, not a history reached by the AI.
  for (const [index, spec] of specs.entries()) {
    const state = makeState(spec), unchanged = JSON.stringify(state), start = performance.now();
    const quote = prototype.researchIncomeCapital(state, seatId), quoteMs = performance.now() - start;
    assert.equal(JSON.stringify(state), unchanged);
    const e = { ...base, committedState: JSON.stringify(state) };
    const restored = c.lifecycle.restore(e); assert(restored.ok, JSON.stringify(restored));
    const root = c.lifecycle.save().envelope, rootObs = observation(), before = values.evaluateStateValue(rootObs, seatId);
    const row = { index, spec, quoteMs, available: quote.available, reason: quote.reason,
      netGain: quote.netGain, selected: quote.selected, rootSha256: sha(JSON.stringify(root)), nativePlans: [] };
    report.pending = { index, spec }; persist();
    for (const plan of quote.plans) {
      assert(c.lifecycle.restore(root).ok);
      assert.equal(prototype.total(plan.before), before.total);
      const steps = [];
      steps.push(submit(legal().find(a => a.family === 'research_tech')));
      steps.push(submit(legal().find(a => a.target?.tileId === plan.tileId && (a.target.blueSlot ?? null) === plan.blueSlot)));
      steps.push(submit(legal().find(a => a.family === 'choose_card' && a.target?.cardInstanceId === plan.incomeCardId)));
      for (let n = 0; n < plan.placements; n++) {
        steps.push(submit(legal().find(a => a.family === 'place_data')));
        steps.push(submit(legal().find(a => a.target?.target === 'computer')));
      }
      steps.push(submit(legal().find(a => a.family === 'choose_card' && a.target?.cardInstanceId === plan.incomeCardId)));
      assert(!c.inspect().session, 'All mandatory income choices must be closed');
      const finalEnvelope = c.lifecycle.save().envelope, finalState = envelopeState(finalEnvelope), p = owner(finalState);
      const rawView = observation();
      const masked = ruleComposition.sanitizeHiddenInformationObservation(rootObs, rawView, { code: 'hidden_research_income_control' });
      const after = values.evaluateStateValue(masked, seatId);
      assert.equal(after.total - before.total, plan.netGain, JSON.stringify({ spec, plan, before, after }));
      assert.equal(prototype.total(plan.after), after.total);
      assert.deepEqual(p.resources, plan.assets.resources);
      assert.deepEqual(p.income, plan.assets.income);
      assert.deepEqual(p.techState, plan.assets.tech);
      assert.deepEqual(data.listComputerPlacedTokens(p).map(t => t.placementSlot), plan.assets.computerSlots);
      assert.equal(steps.length, plan.nativeInputLowerBound);
      row.nativePlans.push({ tileId: plan.tileId, blueSlot: plan.blueSlot, incomeCardId: plan.incomeCardId,
        netGain: plan.netGain, before, after, steps, finalEnvelopeSha256: sha(JSON.stringify(finalEnvelope)),
        newlyDrawnCardsMasked: masked.selfState.hand.filter(c => c.hidden).length,
        newlyUncoveredBonusMasked: masked.publicState.board.techSupply.stacks[plan.tileId].bonusHidden === true });
      assert(c.lifecycle.restore(root).ok);
      assert.deepEqual(c.lifecycle.save().envelope, root);
    }
    report.rows.push(row); report.pending = null; report.nativeInputs = allInputs; persist();
    if ((index + 1) % 20 === 0) console.log(JSON.stringify({ checkedControls: index + 1, nativePlans: report.rows.reduce((n, r) => n + r.nativePlans.length, 0), nativeInputs: allInputs }));
  }
  assert(c.lifecycle.restore(base).ok); assert.deepEqual(c.lifecycle.save().envelope, base);
  report.status = 'complete'; report.originalRootAndRngUnchanged = true;
  report.nativePlans = report.rows.reduce((n, row) => n + row.nativePlans.length, 0);
  report.fundedControls = report.rows.filter(row => row.available).length;
  report.unfundedOrInsufficientControls = report.rows.length - report.fundedControls;
  report.maxQuoteMs = Math.max(...report.rows.map(r => r.quoteMs));
  report.sourceHashes = Object.fromEntries(Object.keys(require.cache).filter(p => p.startsWith(process.cwd() + '/randomizer/')).sort().map(p => [p.slice(process.cwd().length + 1), sha(fs.readFileSync(p))]));
  persist();
  console.log(JSON.stringify({ status: report.status, controls: report.rows.length, funded: report.fundedControls,
    nativePlans: report.nativePlans, nativeInputs: report.nativeInputs, maxQuoteMs: report.maxQuoteMs,
    allKnownEndpointValuesAndAssetsEqual: true, originalRootAndRngUnchanged: true }));
} catch (error) {
  report.status = 'failed'; report.nativeInputs = allInputs; report.error = error.stack; persist(); throw error;
} finally { c.dispose(); }
