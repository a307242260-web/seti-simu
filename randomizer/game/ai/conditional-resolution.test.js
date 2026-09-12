"use strict";
const assert = require("node:assert/strict");
const outcomeModel = require("./outcome-model");
const expectedScore = require("./expected-score-evaluator");
const evaluator = require("./heuristic-evaluator");
const seatId = "p1";
function observation(score = 0, terminal = false) {
  return outcomeModel.createDecisionObservation({
    publicState: { roundNumber: 1, terminal, players: [{ playerId: seatId, score, finalScore: score,
      resources: { score }, income: {}, techState: { ownedTiles: {} } }], board: {} },
    selfState: { id: seatId, hand: [], reservedCards: [] },
  }, { seatId, stateVersion: 1, decisionVersion: 1 });
}
const actions = ["a-detour", "z-direct"].map((actionId) => ({
  actionId, family: "choose_payment", phase: "conditional", actorId: seatId, target: {}, payload: {},
}));
function context(terminal = false, longerScore = 0) {
  return { seatId, legalActions: actions, actionOutcomes: actions.map((action, index) => ({
    schemaVersion: outcomeModel.OUTCOME_SCHEMA_VERSION, actionId: action.actionId,
    status: "settled", rootObservation: observation(), leaves: [{
      leafId: action.actionId, status: "settled", observation: observation(index ? 0 : longerScore, terminal),
      actionChain: [action.actionId], executionStepCount: index ? 1 : 4,
    }],
  })) };
}
const choose = (ctx) => evaluator.selectLegalAction(ctx, { evaluateAction: expectedScore.evaluateOutcome });
assert.equal(choose(context()).actionId, "z-direct", "同收益条件决策优先较少实际提交，不反复绕行");
assert.equal(choose({ ...context(), legalActions: [...actions].reverse() }).actionId, "z-direct");
assert.equal(choose(context(false, 1)).actionId, "a-detour", "执行长度不能压过实际收益");
assert.equal(choose(context(true)).actionId, "a-detour", "同正式分终局仍沿用原稳定排序");
assert.deepEqual(expectedScore.evaluateOutcome(context(), actions[0]).score, 0, "不增加固定动作分");
const leaves = context();
leaves.actionOutcomes[0].leaves.push({ ...leaves.actionOutcomes[0].leaves[0], leafId: "z-short", executionStepCount: 2 });
assert.equal(expectedScore.evaluateOutcome(leaves, actions[0]).selectedLeafId, "z-short", "叶选择与根排序使用相同执行长度");
const alienChoices = ["display", "blind", "cancel"].map(source => ({
  actionId: `alien-${source}`, family: "choose_card", phase: "conditional", actorId: seatId,
  target: { kind: "residual-domain", source, choiceId: `amiba:${source}${source === "display" ? ":6" : ""}` },
}));
const alienInput = { focalSeatId: seatId, branchObservation: observation(),
  legalSuccessors: alienChoices, routeTargetId: "land:saturn:satellite:titan",
  routePlanId: "probe:rocket:11:land:saturn:satellite:titan" };
const sources = input => expectedScore.selectSecondaryAgentSuccessors(input).map(a => a.target.source).sort();
const originalChoices = JSON.stringify(alienChoices);
assert.deepEqual(sources(alienInput), ["display"], "普通探测目标的外星拿牌局部优先展示牌");
assert.deepEqual(sources({ ...alienInput, legalSuccessors: [...alienChoices].reverse() }), ["display"]);
assert.deepEqual(sources({ ...alienInput, legalSuccessors: alienChoices.slice(1) }), ["blind"]);
assert.deepEqual(sources({ ...alienInput, legalSuccessors: alienChoices.slice(2) }), ["cancel"]);
assert.deepEqual(sources({ ...alienInput, routeTargetId: "card:acquire:public-1", routePlanId: "card:acquire:public-1" }),
  ["blind", "display"], "卡身份目标保留两条真实拿牌分支");
assert.deepEqual(sources({ ...alienInput, routeResultTargetIds: ["card:acquire:public-1"] }), ["blind", "display"]);
assert.deepEqual(sources({ ...alienInput, routePlanId: "data:card:b1:pick:b2" }), ["blind", "display"]);
assert.deepEqual(sources({ ...alienInput, routeTargetId: "unknown:goal", routePlanId: "unknown:plan" }), ["blind", "display"]);
const rootPicks = expectedScore.enumerateSecondaryAgentRootTargets({ rootObservation: observation(), legalActions: alienChoices });
assert.deepEqual([...new Set(rootPicks.flatMap(target => target.compatibleActionIds))], ["alien-display"]);
const otherOwner = alienChoices.map(a => ({ ...a, actorId: "p2" }));
const otherRoots = expectedScore.enumerateSecondaryAgentRootTargets({ rootObservation: observation(), legalActions: otherOwner });
assert.equal(new Set(otherRoots.flatMap(target => target.compatibleActionIds)).size, 3, "不替其他席位贪心拿牌");
assert.equal(JSON.stringify(alienChoices), originalChoices, "筛选不修改原始合法集");
console.log("conditional resolution tests passed");
