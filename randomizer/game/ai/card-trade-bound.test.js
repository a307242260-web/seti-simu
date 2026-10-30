"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createSimulationRuleComposition } = require("../../training/simulation-rule-composition");
const { createSeededRandom } = require("../random");
const { buildRuleObservation } = require("../../app/rule-observation");
const { createAnalysisPort } = require("./analysis-port");
const { searchDecision } = require("./decision-search");
const { createStateValueEvaluator, evaluateHandCountDelta, supportsLegacyValueProof } = require("./state-value");

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
    for (const [index, evaluate] of evaluators.entries()) {
      const reduced = searchDecision({ port, root: selection, evaluate, cardChoiceEquivalence: true });
      assert.equal(reduced.complete, true);
      if(supportsLegacyValueProof(selection.observation)){
      assert.equal(reduced.diagnostics.transitions, 1, "同值、同一步长的取牌出口只执行一个真实见证");
      assert.equal(reduced.actionId, selection.legalActions.map(action => action.actionId).sort()[0]);
      assert.equal(reduced.value, values[index]);
      assert.equal(reduced.lines[0].distance, 1);
      assert.equal(reduced.lines[0].localPlan.kind, "card-choice");
      assert.equal(reduced.diagnostics.cardChoiceExcludedActions, selection.legalActions.length - 1);
      for (const row of reduced.roots.filter(row => row.actionId !== reduced.actionId)) {
        assert.equal(row.value, null);
        assert.equal(row.target, null);
        assert.equal(row.completion, "proof-pruned");
        assert.equal(reduced.lines[row.prunedByPlan.witness.node].status, "information-barrier");
      }
      }else{
        const native=searchDecision({port,root:selection,evaluate});assert(native.complete);
        assert.equal(reduced.value,native.value);assert.equal(reduced.actionId,native.actionId);assert.equal(reduced.lines[0].distance,native.lines[0].distance);
        assert.equal(reduced.diagnostics.transitions,selection.legalActions.length);assert.equal(reduced.diagnostics.cardChoiceProofNodes,0);
        assert(reduced.roots.every(row=>row.target!=null),'model-incompatible quantity equivalence must execute every real choice');
      }
    }
  }
  assert.deepEqual(comp.lifecycle.save().envelope, initial);
  port.close();
  assert.throws(() => port.cardTradeBound(pending), /ANALYSIS_NODE_INVALID/);
}

// 支付出口仍全部保留；跨真实两次点选和确认复用同一份完整竞争证据。
function actualPaymentRun(equivalence, reuse) {
  const startedAt = performance.now();
  assert.equal(comp.lifecycle.restore(initial).ok, true);
  assert.equal(comp.inputPort.submitQuickAction(comp.inputPort.enumerateActions({})
    .find(action => action.target?.tradeId === "cards-for-pick-card")).ok, true);
  const port = createAnalysisPort({ composition: comp, seatId, maxCacheEntries: 0 });
  const records = [], actions = [], searches = [];
  let continuation = null;
  for (let i = 0; i < 4; i += 1) {
    const root = port.openRoot();
    const result = searchDecision({ port, root, evaluate: evaluators[0], cardChoiceEquivalence: equivalence,
      resourceDominance: true, cardTradePruning: true, modelKey: `payment-exit-model:${evaluators[0].modelKey}`,
      continuation: reuse ? continuation : null });
    assert.equal(result.complete, true);
    if (i === 0) {
      assert.equal(result.lines[0].edges.length, 10, "十个支付集合均得到精确完成值，不能随取牌出口一起省略");
      assert.equal(result.diagnostics.selectionMacros, 10);
      assert.equal(result.diagnostics.resourceDominance, "disabled-for-selection-certificate");
      assert.equal(result.diagnostics.cardTradePruning, "disabled-for-selection-certificate");
      assert(result.selectionContinuation);
    }
    if (reuse && i > 0 && i < 3) {
      assert.equal(result.diagnostics.continuation, "hit");
      assert.equal(result.reusedCoverage.exitCount, 10);
    }
    continuation = result.selectionContinuation;
    records.push(result.diagnostics.transitions);
    actions.push(result.actionId);
    searches.push({ ...result, selectionContinuation: undefined });
    port.close();
    const decision = comp.inspect().session.decision;
    const choice = decision.choices.find(action => action.actionId === result.actionId);
    assert(choice);
    const submitted = comp.inputPort.submitDecision({ decisionId: decision.decisionId,
      decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice });
    assert.equal(submitted.ok, true);
  }
  assert.notEqual(comp.inspect().phase, "awaiting_input");
  const envelope = comp.lifecycle.save().envelope;
  return { records, actions, searches, envelope, milliseconds: performance.now() - startedAt };
}
const originalPayment = actualPaymentRun(false, false);
const originalReusedPayment = actualPaymentRun(false, true);
const equivalentPayment = actualPaymentRun(true, false);
const reusedPayment = actualPaymentRun(true, true);
assert.deepEqual(equivalentPayment.actions, originalPayment.actions);
assert.deepEqual(reusedPayment.actions, originalPayment.actions);
assert.deepEqual(originalReusedPayment.actions, originalPayment.actions);
assert.deepEqual(equivalentPayment.envelope, originalPayment.envelope);
assert.deepEqual(reusedPayment.envelope, originalPayment.envelope);
assert.deepEqual(originalReusedPayment.envelope, originalPayment.envelope);
assert.deepEqual(originalPayment.records, [70, 72, 74, 4]);
assert.deepEqual(originalReusedPayment.records, [70, 0, 0, 4]);
assert.deepEqual(equivalentPayment.records, originalPayment.records,"incompatible cardinality proof must retain all native payment/card choices");
assert.deepEqual(reusedPayment.records, originalReusedPayment.records);

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
const observedResult = searchDecision({ port: observed, root: observedPending, evaluate: evaluators[0], cardChoiceEquivalence: true });
assert.equal(observedResult.complete, true);
assert.equal(observedResult.diagnostics.cardChoiceExcludedActions, 0);
assert.equal(observedResult.diagnostics.transitions, observedPending.legalActions.length);
observed.close();
comp.dispose();
assert.equal(leaves, 90);
console.log(`card trade information bounds match all ${leaves} formal leaves and reject extra rewards`);
