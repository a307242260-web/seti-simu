"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { createSimulationRuleComposition } = require("../../training/simulation-rule-composition");
const { createSeededRandom } = require("../random");
const { buildRuleObservation } = require("../../app/rule-observation");
const industry = require("../industry");
const { createAnalysisPort } = require("./analysis-port");
const { searchDecision } = require("./decision-search");
const { createStateValueEvaluator, evaluateHandCountDelta } = require("./state-value");
const f = JSON.parse(fs.readFileSync(path.resolve(__dirname,
  "../../../adhoc/ai-decision-corpus-20261023-v1/case-008-20261023-v1.json")));
const seed = f.source.seed, seatId = f.seatId, source = JSON.parse(f.compositionEnvelope.committedState);
const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId) });
kernel.newGame({ seed }); const comp = kernel.composition;
const evaluators = [createStateValueEvaluator(seatId), createStateValueEvaluator(seatId, { weights: { credits: 0.1, handSize: 0.07 } })];
function pendingFor(label, mutate = () => {}) {
  const state = structuredClone(source), owner = state.players.players.find(p => p.id === seatId);
  owner.initialSelection.industry = { id: `industry:${label}.png` }; industry.ensurePlayerIndustryState(owner);
  industry.initializeHeliosPassiveMarkers(owner); industry.clearStrategyPassiveSlots(owner); mutate(state, owner);
  const restored = comp.lifecycle.restore({ ...f.compositionEnvelope, committedState: JSON.stringify(state) });
  assert(restored.ok, JSON.stringify(restored));
  assert(comp.inputPort.submitAction(comp.inputPort.enumerateActions({}).find(action => action.family === "pass")).ok);
  assert.equal(comp.inspect().session.decision.choices[0].target.kind, "pass-reserve-card");
  return comp.lifecycle.save().envelope;
}
let leaves = 0;
function check(label, mutate) {
  const before = pendingFor(label, mutate);
  const port = createAnalysisPort({ composition: comp, seatId, maxCacheEntries: 0 }), root = port.openRoot();
  assert.equal(typeof port.passReserveChoiceSpec, "function");
  const proof = port.passReserveChoiceSpec(root); assert(proof, label);
  for (const action of root.legalActions) {
    const child = port.expand(root, action.actionId); assert.equal(child.status, "other-owner");
    for (const evaluate of evaluators) assert.equal(evaluate(child.observation), evaluateHandCountDelta(evaluate, root.observation, 1), label);
    leaves += 1;
  }
  for (const evaluate of evaluators) {
    const raw = searchDecision({ port, root, evaluate });
    const reduced = searchDecision({ port, root, evaluate, cardChoiceEquivalence: true });
    assert(raw.complete && reduced.complete); assert.equal(reduced.actionId, raw.actionId); assert.equal(reduced.value, raw.value);
    assert.equal(reduced.lines[0].distance, raw.lines[0].distance); assert.equal(reduced.diagnostics.transitions, 1);
    assert.equal(reduced.lines[0].localPlan.expectedStatus, "other-owner");
    for (const row of reduced.roots.filter(row => row.actionId !== reduced.actionId)) {
      assert.equal(row.value, null); assert.equal(row.target, null);
      assert.equal(reduced.lines[row.prunedByPlan.witness.node].status, "other-owner");
    }
  }
  assert.deepEqual(comp.lifecycle.save().envelope, before); port.close();
}
for (const label of Object.keys(industry.INDUSTRY_DEFINITIONS)) check(label);
for (const cardId of ["b_114.webp", "dlc_9.png"]) check("异星实验室", (_state, player) => {
  const index = player.hand.findIndex(card => card.cardId === cardId);
  player.reservedCards.push(player.hand.splice(index, 1)[0]); player.resources.handSize = player.hand.length;
});
function declined(mutate) {
  pendingFor("异星实验室", mutate);
  const port = createAnalysisPort({ composition: comp, seatId }), root = port.openRoot();
  assert.equal(port.passReserveChoiceSpec(root), null); port.close();
}
declined(state => { state.turn.passedPlayerIds = state.turn.activePlayerIds.filter(id => id !== seatId); });
declined((state, player) => { player.resources.score = Math.min(...state.finalScoring.thresholds); });
declined((state, player) => {
  state.players.players.find(p => p.id !== seatId).reservedCards.push(player.hand.shift()); player.resources.handSize = player.hand.length;
});
pendingFor("异星实验室", state => { state.turn.cardTurnEventBonuses = [{ id: "reserve-event", playerId: seatId,
  duration: "turn", eventType: "pass_reserve_pick", rewards: [{ id: "reserve-credit", type: "gain_resources", options: { gain: { credits: 5 } } }] }]; });
const observed = createAnalysisPort({ composition: comp, seatId }), root = observed.openRoot();
assert.equal(observed.passReserveChoiceSpec(root), null);
const leaf = observed.expand(root, root.legalActions[0].actionId);
assert.equal(evaluators[0](leaf.observation), evaluateHandCountDelta(evaluators[0], root.observation, 1) + 5);
const actual = searchDecision({ port: observed, root, evaluate: evaluators[0], cardChoiceEquivalence: true });
assert(actual.complete); assert.equal(actual.diagnostics.transitions, root.legalActions.length, "额外奖励存在时仍逐个执行");
observed.close(); comp.dispose();
console.log(JSON.stringify({ passReserveChoice: "passed", companies: 11, inertTaskModels: 2, physicalLeaves: leaves, extraRewardRejected: true }));
