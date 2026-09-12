"use strict";
const assert = require("node:assert/strict");
const evaluator = require("./expected-score-evaluator");
const outcomeModel = require("./outcome-model");
const continuation = require("./plan-continuation");
const wanted = { id: "wanted-launch", cardId: "b_117.webp" };
const other = { id: "other-launch", cardId: "b_117.webp" };
function observe(publicCards = [other, wanted], hand = [], score = 0) {
  return outcomeModel.createDecisionObservation({
    publicState: { roundNumber: 2, players: [{ playerId: "p1", score, credits: 3, energy: 3,
      publicity: 3, mainActionCompleted: true, income: {}, techState: { ownedTiles: {} }, dataProgress: {} }],
    board: { publicCards, planets: { planets: {} }, techSupply: { stacks: {} }, aliens: { slots: [] } } },
    selfState: { playerId: "p1", hand, reservedCards: [] },
  }, { seatId: "p1" });
}
const before = observe();
const trade = { family: "quick_trade", phase: "quick", actorId: "p1", actionId: "trade",
  target: { tradeId: "energy-for-card" }, payload: {} };
const targetId = `card:acquire:${wanted.id}`;
const targets = evaluator.enumerateSecondaryAgentRootTargets({ rootObservation: before,
  focalSeatId: "p1", legalActions: [trade] });
assert(targets.some(t => t.targetId === targetId && t.compatibleActionIds.includes(trade.actionId)));
assert.equal(evaluator.completesSecondaryAgentRouteTarget({ action: trade, targetId,
  focalSeatId: "p1", branchObservation: before }), false, "尚未入手不能按离手完成");
const acquired = observe([other], [wanted]);
assert.equal(evaluator.completesSecondaryAgentRouteTarget({ action: trade, targetId,
  focalSeatId: "p1", branchObservation: acquired }), true);
assert.equal(evaluator.completesSecondaryAgentRouteTarget({ action: trade, targetId,
  focalSeatId: "p1", branchObservation: observe([wanted], [other]) }), false);
assert.equal(evaluator.completesSecondaryAgentRouteTarget({ action: trade, targetId,
  focalSeatId: "other-player", branchObservation: acquired }), false);
const choices = [other, wanted].map((card, slotIndex) => ({ family: "choose_card", phase: "conditional",
  actorId: "p1", actionId: `pick:${card.id}`, target: { kind: "trade-card-selection", source: "public",
    cardInstanceId: card.id, slotIndex }, payload: {} }));
choices.push({ family: "choose_card", phase: "conditional", actorId: "p1", actionId: "blind",
  target: { kind: "trade-card-selection", source: "blind" }, payload: {} });
const selected = evaluator.selectSecondaryAgentSuccessors({ branchObservation: before,
  focalSeatId: "p1", routeTargetId: targetId, routePlanId: targetId,
  currentAction: trade, legalSuccessors: choices });
assert.deepEqual(selected.map(a => a.actionId), [`pick:${wanted.id}`]);
assert.deepEqual(evaluator.selectSecondaryAgentRouteTarget({ routeTargetId: targetId,
  routePlanId: targetId, branchObservation: before, focalSeatId: "p1", currentAction: trade }),
{ targetId, planId: targetId });
const steps = continuation.compilePlanSteps([{ ...continuation.capturePlanStep({ action: trade, observation: before }),
  routeTargetId: targetId, routePlanId: targetId }]);
const plan = { schemaVersion: continuation.PLAN_SCHEMA_VERSION, nextActionId: trade.actionId, steps };
assert.equal(continuation.planReuseCheck(plan, before, [trade]).hit, true);
assert.equal(continuation.planReuseCheck(plan, observe([other, { ...wanted, id: "replacement" }]), [trade]).hit, false);
assert.equal(continuation.planReuseCheck(plan, observe([wanted, other]), [trade]).hit, true,
  "支付前依赖目标牌身份，不因尚未选择的公共槽变化失效");
function outcome(settled, score = 1) {
  return evaluator.evaluateOutcome({ seatId: "p1", observation: before, legalActions: [trade],
    actionOutcomes: [{ schemaVersion: evaluator.OUTCOME_SCHEMA_VERSION, actionId: trade.actionId,
      status: "settled", rootObservation: before, leaves: [{ leafId: "leaf", observation: observe([other], [wanted], score),
        rootRouteTargetId: targetId, rootActionSettledObservation: settled, terminalReason: "pass" }] }] }, trade);
}
assert.equal(outcome(acquired).selectable, true);
assert.equal(outcome(before).selectable, false, "不能用后来取得牌代替根交易的正式入手证据");
assert.equal(outcome(acquired, 0).selectable, false, "取得普通牌目标不凭空产生primary收益或绕过无收益过滤");
console.log("public card acquisition goal tests passed");

// 同一取牌目标的公司根、条件选择与复用，不复制正式公司结算。
for (const abilityId of ["mission_publicity_pick_income", "fenwick_publicity_pick_corner",
  "deepspace_swap_cards", "future_span_pick_advance", "strategy_pick_card"]) {
  const action = { family: "industry", phase: "quick", actorId: "p1",
    actionId: abilityId, target: { abilityId }, payload: {} };
  const own = structuredClone(before);
  own.selfState.companyState = { abilityId, roundMarkRound: 0, roundMarkTurn: 0,
    futureSpan: { card: { id: "parked" }, targetScore: 20, playing: false },
    strategyPassiveSlots: { yellow: true, red: true, blue: true } };
  const roots = evaluator.enumerateSecondaryAgentRootTargets({ rootObservation: own,
    focalSeatId: "p1", legalActions: [action] });
  assert(roots.some(root => root.targetId === targetId && root.compatibleActionIds.includes(action.actionId)));
  assert.equal(evaluator.allowsQuickActionTiming({ observation: own, action,
    legalActions: [action], routeTargetId: targetId, routePlanId: targetId }), true);
  assert.deepEqual(evaluator.selectSecondaryAgentSuccessors({ branchObservation: own,
    focalSeatId: "p1", currentAction: action, routeTargetId: targetId, routePlanId: targetId,
    legalSuccessors: [action] }).map(a => a.actionId), [action.actionId]);
  const publicChoices = choices.slice(0, 2).map(choice => ({ ...choice,
    target: { cardInstanceId: choice.target.cardInstanceId, slotIndex: choice.target.slotIndex } }));
  assert.deepEqual(evaluator.selectSecondaryAgentSuccessors({ branchObservation: own,
    focalSeatId: "p1", currentAction: action, routeTargetId: targetId, routePlanId: targetId,
    legalSuccessors: publicChoices }).map(a => a.actionId), [`pick:${wanted.id}`]);
  const handChoices = publicChoices.map(choice => ({ ...choice,
    target: { cardInstanceId: choice.target.cardInstanceId } }));
  assert.equal(evaluator.selectSecondaryAgentSuccessors({ branchObservation: own,
    focalSeatId: "p1", currentAction: action, routeTargetId: targetId, routePlanId: targetId,
    legalSuccessors: handChoices }).length, 2, "交换手牌不按公共目标误过滤");
  assert.equal(evaluator.selectSecondaryAgentSuccessors({ branchObservation: acquired,
    focalSeatId: "p1", currentAction: action, routeTargetId: targetId, routePlanId: targetId,
    legalSuccessors: publicChoices }).length, 2, "已入手后的奖励选择不强制再取原目标");
  for (const next of [action, publicChoices[1]]) {
    const compiled = continuation.compilePlanSteps([{ ...continuation.capturePlanStep({ action: next, observation: own }),
      routeTargetId: targetId, routePlanId: targetId }]);
    const planned = { schemaVersion: continuation.PLAN_SCHEMA_VERSION, nextActionId: next.actionId, steps: compiled };
    assert.equal(continuation.planReuseCheck(planned, own, [next]).hit, true);
    for (const mutate of [
      state => { state.selfState.companyState.roundMarkRound = 2; },
      state => { state.selfState.companyState.futureSpan.targetScore = 22; },
      state => { state.selfState.companyState.strategyPassiveSlots.yellow = false; },
      state => { state.selfState.hand.push({ id: "new-hand" }); },
      state => { state.publicState.players[0].publicity = 1; },
    ]) {
      const changed = structuredClone(own); mutate(changed);
      assert.equal(continuation.planReuseCheck(planned, changed, [next]).hit, false,
        "即使描述符仍合法，费用/手牌/公司收益条件变化也必须失效");
    }
  }
}
console.log("company acquisition policy and plan dependencies passed");
