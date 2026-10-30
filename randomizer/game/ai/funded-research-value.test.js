'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const values = require('./state-value');
const demand = require('./resource-demand');
const catalog = require('../tech/catalog');
const resolver = require('../tech/resolver');
const industry = require('../industry/catalog');
const { createSimulationRuleComposition } = require('../../training/simulation-rule-composition');
const { createSeededRandom } = require('../random');
const { buildRuleObservation } = require('../../app/rule-observation');
const { createAnalysisPort } = require('./analysis-port');
const read = n => JSON.parse(fs.readFileSync(path.resolve(__dirname,
  `../../../adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-${String(n).padStart(3, '0')}-20261030-v1.json`)));
const f = read(35), seed = f.source.seed, seatId = f.seatId;
const k = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (s, viewer) => buildRuleObservation(s, seed, viewer?.playerId) });
k.newGame({ seed });
const c = k.composition;
assert(c.lifecycle.restore(f.compositionEnvelope).ok);
const original = c.lifecycle.save().envelope;
const port = createAnalysisPort({ composition: c, seatId, maxCacheEntries: 0 });
try {
  const root = port.openRoot(), observation = root.observation;
  const player = observation.publicState.players.find(p => p.playerId === seatId);
  assert.equal(player.researchPublicityCost, catalog.RESEARCH_PUBLICITY_COST);
  assert.equal(player.publicity, 7);
  const before = values.evaluateStateValue(observation, seatId);
  assert.equal(before.components.researchPotential, 9.5);
  assert.equal(before.total, 52);
  assert.deepEqual(values.evaluateStateValue(port.valueObservation(root), seatId), before);
  const started = port.expand(root, root.legalActions.find(a => a.family === 'research_tech').actionId);
  const choice = started.legalActions.find(a => a.target.tileId === 'blue1' && a.target.blueSlot === 1);
  assert(choice);
  const after = port.expand(started, choice.actionId), taken = values.evaluateStateValue(after.observation, seatId);
  assert.equal(taken.total, before.total, 'funded forecast matches this native acquisition before later blue data rewards');
  assert.equal(taken.components.researchPotential, 0);
  assert.notDeepEqual(after.observation.publicState.board.rockets, observation.publicState.board.rockets,
    'research really rotates geometry; this model does not claim unchanged probe routes');
  assert.deepEqual(c.lifecycle.save().envelope, original);
  // A fresh lazy native successor lets a bound query run without projecting
  // unrelated route observations. The subsequent explicit read is the control.
  port.setResourcePlanning(true);
  const prepare = port.expand(root, root.legalActions.find(a => a.family === 'place_data').actionId);
  const query = port.expand(prepare, prepare.legalActions.find(a => a.target.target === 'computer').actionId);
  assert.equal(query.status, 'stable');
  const projectedBefore = port.getDiagnostics().observationCount;
  assert.equal(port.postMainValueBound(query), null);
  assert.equal(port.getDiagnostics().observationCount, projectedBefore);
  assert.equal(query.observation.selfState.playerId, seatId);
  assert(port.getDiagnostics().observationCount > projectedBefore);

  const params = { hand: observation.selfState.hand, techState: player.techState,
    supply: observation.publicState.board.techSupply, round: 1, publicity: 7, researchCost: player.researchPublicityCost };
  const input = structuredClone(params);
  assert.equal(values.researchCapital({ ...params, publicity: 5 }), 0);
  assert.equal(values.researchCapital({ ...params, round: 4 }), 0);
  assert.equal(values.researchCapital({ ...params, round: 3, passed: true }), 0);
  assert.equal(values.researchCapital({ ...params, hand: [], passed: true }), values.researchCapital({ ...params, hand: [], round: 2 }));
  const onlyPurple = { stacks: { purple4: params.supply.stacks.purple4 } };
  const shared = { ...params, supply: onlyPurple };
  const held = values.handCapital(params.hand, params.techState, onlyPurple, 1);
  const gross = values.researchCapital({ ...shared, hand: [] });
  assert(held > 0); assert(gross > held);
  assert.equal(held + values.researchCapital(shared), gross,
    'a paid purpose and a held free-research card cannot each claim purple4');
  assert.equal(values.researchCapital({ ...shared, hand: [...params.hand, ...params.hand] }), values.researchCapital(shared));
  const hiddenA = { ...shared, supply: { stacks: { purple4: { ...onlyPurple.stacks.purple4, bonusId: 'bonus_3f', bonusHidden: true } } } };
  const hiddenB = { ...shared, supply: { stacks: { purple4: { ...onlyPurple.stacks.purple4, bonusId: 'bonus_1p', bonusHidden: true } } } };
  assert.equal(values.researchCapital(hiddenA), values.researchCapital(hiddenB));
  for (const weights of [values.DEFAULT_WEIGHTS, { ...values.DEFAULT_WEIGHTS, publicity: 2, energy: 3 },
    { ...values.DEFAULT_WEIGHTS, publicity: 0, handSize: 2 }]) {
    for (const publicity of [0, 5, 6, 7, 12]) {
      const actual = values.researchCapital({ ...params, publicity }, weights);
      assert(actual <= values.researchCapitalCeiling(params, weights));
    }
  }
  assert.deepEqual(params, input);
  const missingFee = structuredClone(observation);
  delete missingFee.publicState.players.find(p => p.playerId === seatId).researchPublicityCost;
  assert.throws(() => values.evaluateStateValue(missingFee, seatId), /researchPublicityCost/);
  assert.equal(values.evaluateStateValue({ ...missingFee, terminal: true }, seatId).total, player.finalScore);

  // Verify public fees against the actual native resolver for ordinary,
  // discounted and public alien-panel company states.
  const state = JSON.parse(original.committedState), native = state.players.players.find(p => p.id === seatId);
  for (const [label, definition] of Object.entries(industry.INDUSTRY_DEFINITIONS)) {
    const testState = structuredClone(state), p = testState.players.players.find(p => p.id === seatId);
    p.initialSelection.industry = { id: `industry:${label}.png` };
    if (definition.passiveIds.includes('alien_lab_panels')) p.industryAlienLabPanels = { pink: true };
    const publicPlayer = buildRuleObservation(testState, seed, seatId).publicState.players.find(p => p.playerId === seatId);
    assert.equal(publicPlayer.researchPublicityCost, resolver.getResearchPublicityCost(p));
    const facts = { ...params, hand: p.hand, techState: p.techState, supply: testState.tech, publicity: p.resources.publicity,
      researchCost: publicPlayer.researchPublicityCost };
    assert.equal(demand.heldAndResearchCapital(testState, p),
      values.handCapital(p.hand, p.techState, testState.tech, 1) + values.researchCapital(facts));
  }
  assert.equal(native.resources.publicity, 7);
  // The canonical passed-player set is authoritative; legacy player flags do
  // not track it in these saves. Full V and native plan previews must agree.
  const passedState = structuredClone(state), green = passedState.players.players.find(p => p.id === 'player-green');
  green.resources.publicity = 8;
  assert(passedState.turn.passedPlayerIds.includes(green.id));
  const passedView = buildRuleObservation(passedState, seed, green.id);
  const passedValue = values.evaluateStateValue(passedView, green.id);
  assert.equal(passedValue.components.handPotential + passedValue.components.researchPotential,
    demand.heldAndResearchCapital(passedState, green), 'passed-seat forecast must use the canonical passed-player set');

} finally { port.close(); c.dispose(); }
// Native publicity threshold controls for both typed income and blue plans.
// These are valid checkpoint variants; the plans themselves use real inputs.
for (const kind of ['income', 'blue-data']) {
  const fixture = read(37), kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
    trustedProjectionReader: true, projectCounterfactualState: (s, viewer) => buildRuleObservation(s, seed, viewer?.playerId) });
  kernel.newGame({ seed }); const composition = kernel.composition;
  assert(composition.lifecycle.restore(fixture.compositionEnvelope).ok);
  const decision = composition.inspect().session.decision, pick = decision.choices.find(a => a.summary === 'b_2.webp');
  assert(pick); assert(composition.inputPort.submitDecision({ decisionId: decision.decisionId,
    decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice: pick }).ok);
  const envelope = composition.lifecycle.save().envelope, state = JSON.parse(envelope.committedState);
  const native = state.players.players.find(p => p.id === seatId); native.resources.publicity = 5;
  if (kind === 'blue-data') native.techState.blueBoardSlots.blue2 = 2;
  assert(composition.lifecycle.restore({ ...envelope, committedState: JSON.stringify(state) }).ok);
  const before = composition.lifecycle.save().envelope, p = createAnalysisPort({ composition, seatId, maxCacheEntries: 0 });
  try {
    p.setResourcePlanning(true); p.setCardPickPlanning(true); const root = p.openRoot();
    const requirements = require('../production-kernel').getResourceGoalRequirements(state, seatId);
    const goal = demand.catalog({ state, seatId, requirements, actions: root.legalActions }).find(g => g.kind === kind);
    assert(goal); const local = require('./local-decision-plans');
    const preview = kind === 'income' ? local.incomeCompletion({ state, seatId, goal }) : local.blueCompletion({ state, seatId, goal });
    assert(preview.selected);
    const first = root.legalActions.find(a => a.family === 'place_data'); assert(first);
    const actual = p.expandResourcePlan(root, { id: goal.id, goal, operation: {}, firstActionId: first.actionId }, () => null);
    assert(actual.complete);
    const start = values.evaluateStateValue(root.observation, seatId), end = values.evaluateStateValue(actual.node.observation, seatId);
    assert.equal(start.components.researchPotential, 0); assert(end.components.researchPotential > 0);
    assert.equal(end.total - start.total, preview.netGain);
    if (kind === 'income') { const proof = p.incomePlanSummary(root); assert(proof); assert.equal(proof.netGain, preview.netGain); }
    assert.deepEqual(composition.lifecycle.save().envelope, before);
  } finally { p.close(); composition.dispose(); }
}
console.log(JSON.stringify({ fundedResearch: 'passed', nativeAcquisitionContinuity: true,
  fullCompactEqual: true, publicNativeFees: true, sharedFreeCardTarget: true, hiddenBonusIgnored: true,
  sourceAndRngUnchanged: true, nativeIncomeAndBlueThresholds: true }));
