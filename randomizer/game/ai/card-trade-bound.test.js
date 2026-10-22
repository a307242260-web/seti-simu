"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createSimulationRuleComposition } = require("../../training/simulation-rule-composition");
const { createSeededRandom } = require("../random");
const { buildRuleObservation } = require("../../app/rule-observation");
const { createAnalysisPort } = require("./analysis-port");
const { createStateValueEvaluator, evaluateHandCountDelta } = require("./state-value");

const initial = JSON.parse(fs.readFileSync(path.resolve(__dirname,
  "../../../reports/ai-foundation-20261022/analysis-root-input-v2.json"))).coreState.compositionEnvelope;
const state = JSON.parse(initial.committedState), seatId = state.turn.currentPlayerId;
const seed = "card-trade-bound-v1";
const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId) });
kernel.newGame({ seed });
const comp = kernel.composition;
const evaluators = [createStateValueEvaluator(seatId), createStateValueEvaluator(seatId, {
  weights: { credits: 0.1, energy: 0.2, publicity: 0.3, availableData: 0.4, handSize: 0.07 },
})];
let leaves = 0;
for (const tradeId of ["credits-for-card", "energy-for-card", "publicity-for-card", "cards-for-pick-card"]) {
  assert.equal(comp.lifecycle.restore(initial).ok, true);
  const port = createAnalysisPort({ composition: comp, seatId, maxCacheEntries: 0 });
  const root = port.openRoot();
  assert.equal(port.cardTradeBound(root), null);
  const action = root.legalActions.find(action => action.target?.tradeId === tradeId);
  assert(action);
  const pending = port.expand(root, action.actionId);
  const bound = port.cardTradeBound(pending);
  assert.equal(bound.handDelta, tradeId === "cards-for-pick-card" ? -1 : 1);
  const values = evaluators.map(evaluate => evaluateHandCountDelta(evaluate, pending.observation, bound.handDelta));
  const selections = [];
  if (tradeId === "cards-for-pick-card") {
    const ids = port.selectionSpec(pending).cardIds;
    // 全部20种原始有序支付，而非只检查组合代表。
    for (const a of ids) for (const b of ids) if (a !== b) selections.push(port.expandSelection(pending, [a, b]).node);
  } else selections.push(pending);
  for (const selection of selections) {
    const nextBound = port.cardTradeBound(selection);
    assert.equal(nextBound.handDelta, 1);
    for (const [index, evaluate] of evaluators.entries()) {
      assert.equal(evaluateHandCountDelta(evaluate, selection.observation, nextBound.handDelta), values[index]);
    }
    for (const choice of selection.legalActions) {
      const leaf = port.expand(selection, choice.actionId);
      assert.equal(leaf.status, "information-barrier");
      for (const [index, evaluate] of evaluators.entries()) assert.equal(evaluate(leaf.observation), values[index],
        "整数/分数权重均与真实边界叶逐位相同，不用可能下溢的增量加法估计上界");
      leaves += 1;
    }
  }
  assert.deepEqual(comp.lifecycle.save().envelope, initial);
  port.close();
  assert.throws(() => port.cardTradeBound(pending), /ANALYSIS_NODE_INVALID/);
}

// 取牌事件奖励确实会越过简单手牌上界，必须拒绝该证明。
const bonus = structuredClone(state);
bonus.turn.cardTurnEventBonuses = [{ id: "draw-credit-test", playerId: seatId, duration: "turn",
  eventType: "quick_trade_card_selected", rewards: [{ id: "draw-credit", type: "gain_resources",
    options: { gain: { credits: 5 } } }] }];
assert.equal(comp.lifecycle.restore({ ...initial, committedState: JSON.stringify(bonus) }).ok, true);
const observed = createAnalysisPort({ composition: comp, seatId });
const observedRoot = observed.openRoot();
const draw = observedRoot.legalActions.find(action => action.target?.tradeId === "credits-for-card");
const observedPending = observed.expand(observedRoot, draw.actionId);
assert.equal(observed.cardTradeBound(observedPending), null);
const naive = evaluateHandCountDelta(evaluators[0], observedPending.observation, 1);
const rewarded = observed.expand(observedPending, observedPending.legalActions[0].actionId);
assert.equal(evaluators[0](rewarded.observation), naive + 5);
observed.close();
comp.dispose();
assert.equal(leaves, 90);
console.log(`card trade information bounds match all ${leaves} formal leaves and reject extra rewards`);
