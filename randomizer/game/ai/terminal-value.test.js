"use strict";

const assert = require("node:assert/strict");
const outcomeModel = require("./outcome-model");
const expectedScore = require("./expected-score-evaluator");
const evaluator = require("./heuristic-evaluator");
const continuation = require("./plan-continuation");

const seatId = "terminal-seat";
function observation({ terminal = false, finalScore = 20, rich = false } = {}) {
  return outcomeModel.createDecisionObservation({
    publicState: {
      terminal,
      roundNumber: 4,
      players: [{
        id: seatId,
        finalScore,
        securedEndGameBonus: 3,
        resources: {
          score: 7,
          credits: rich ? 10 : 0,
          energy: rich ? 10 : 0,
          publicity: rich ? 6 : 0,
          availableData: rich ? 6 : 0,
        },
        income: rich ? { credits: 3, energy: 3, availableData: 3 } : {},
        techState: { ownedTiles: rich ? { blue1: true, blue2: true } : {} },
        dataProgress: rich ? { computerSlots: [1, 2, 3, 4, 5, 6], blueBonusCount: 4 } : {},
      }],
      board: { aliens: { slots: rich ? [{
        revealed: false,
        traces: { blue: { playerId: seatId, firstPlaced: true, extraCount: 2 } },
      }] : [] } },
    },
    selfState: {
      id: seatId,
      hand: rich ? [{ id: "unplayed-launch", cardId: "b_117.webp" }] : [],
      reservedCards: rich ? [{ id: "reserved-launch", cardId: "b_117.webp" }] : [],
    },
  }, { seatId, stateVersion: 1, decisionVersion: 1 });
}

const root = observation();
const sparse = observation({ terminal: true });
const rich = observation({ terminal: true, rich: true });
const rootFacts = outcomeModel.createStrategicFacts(root, seatId);
for (const leaf of [sparse, rich]) {
  const value = expectedScore.evaluateState(leaf, seatId);
  assert.equal(value.realizedScore, 20, "终局读取正式分而非基础分");
  assert.equal(value.securedEndGameBonus, 0, "已锁定分不得在终局重复累计");
  const delta = expectedScore.evaluateStrategicFactsBreakdown(
    rootFacts, outcomeModel.createStrategicFacts(leaf, seatId),
  );
  assert.equal(delta.total, 10, "终局增量 = 正式分20 - 根基础分7 - 根锁定分3");
  assert.equal(delta.publicityResearchValue, 0, "终局宣传不得兑换未来研究价值");
  assert.equal(delta.infrastructure.total, 0);
  const v = expectedScore.evaluateStateValue(leaf, seatId);
  assert.equal(v.total, 20, "终局 V 只能是正式分");
  for (const [key, amount] of Object.entries(v.components)) {
    assert.equal(amount, key === "scoreValue" ? 20 : 0, `终局 V 分项 ${key}`);
  }
}

function priority(branchObservation, routeTargetIds = []) {
  return expectedScore.evaluateSecondaryAgentSearchPriority({
    focalSeatId: seatId,
    rootObservation: root,
    branchObservation,
    currentAction: { actionId: "analyze:final", family: "analyze", actorId: seatId },
    routeTargetIds,
  }).sortKey;
}
assert.deepEqual(priority(rich, ["data:analyze"]), priority(sparse),
  "终局搜索优先级不受目标完成、库存或数据轨推进影响");
assert.ok(priority(observation({ terminal: true, finalScore: 21 }))[2] > priority(rich)[2]);

const actions = ["a-rich-low", "z-official-high"].map((actionId) => ({
  actionId, family: "choose_reward", phase: "conditional", actorId: seatId,
  target: {}, payload: {},
}));
function outcome(action, leaves) {
  return {
    schemaVersion: outcomeModel.OUTCOME_SCHEMA_VERSION,
    actionId: action.actionId, status: "settled", confidence: "high",
    rootObservation: root, leaves,
  };
}
function leaf(leafId, actionId, obs) {
  return {
    leafId, status: "settled", observation: obs,
    actionChain: [actionId, `finish:${leafId}`],
    rootActionObservation: root,
  };
}
for (const vStateValueEnabled of [false, true]) {
  const outcomes = [
    outcome(actions[0], [leaf("rich-low", actions[0].actionId, rich)]),
    outcome(actions[1], [leaf("official-high", actions[1].actionId,
      observation({ terminal: true, finalScore: 21 }))]),
  ];
  for (const legalActions of [actions, [...actions].reverse()]) {
    const context = { seatId, observation: root, legalActions, actionOutcomes: outcomes };
    const chosen = evaluator.selectLegalAction(context, {
      evaluateAction: (ctx, action) => expectedScore.evaluateOutcome(ctx, action, { vStateValueEnabled }),
    });
    assert.equal(chosen.actionId, actions[1].actionId, "正式分较高的叶必须胜过富资源低分叶");
    const snapshot = continuation.extractPlanSnapshot({
      seatId, rootObservation: root, legalActions, actionOutcomes: outcomes, chosenAction: chosen,
    }, { light: true });
    assert.equal(snapshot.plan.nextActionId, "finish:official-high", "计划必须来自正式分优胜叶");
    const partial = outcomes.map((item) => ({ ...item,
      searchCompleteness: { status: "incomplete", reasons: ["node-budget"] } }));
    const partialChoice = evaluator.selectLegalAction({ ...context, actionOutcomes: partial }, {
      evaluateAction: (ctx, action) => expectedScore.evaluateOutcome(ctx, action, { vStateValueEnabled }),
    });
    assert.equal(partialChoice.actionId, chosen.actionId, "搜索未穷尽不应丢弃已有真实结果");
    const partialPlan = continuation.extractPlanSnapshot({
      seatId, rootObservation: root, legalActions, actionOutcomes: partial, chosenAction: partialChoice,
    }, { light: true });
    assert.equal(partialPlan.plan.nextActionId, snapshot.plan.nextActionId,
      "完整性不替代可用性；计划仍取同一真实优胜叶");
  }
  const ties = [leaf("a-sparse", actions[0].actionId, sparse), leaf("z-rich", actions[0].actionId, rich)];
  for (const leaves of [ties, [...ties].reverse()]) {
    const result = expectedScore.evaluateOutcome({
      seatId, actionOutcomes: [outcome(actions[0], leaves)],
    }, actions[0], { vStateValueEnabled });
    assert.equal(result.selectedLeafId, "a-sparse", "同正式分叶不按库存打破平局，V 开关与枚举顺序不影响结果");
  }
}
// 外星估值：已有正式分只计一次，只有新增未揭示首痕迹补未来奖励预期。
{
  function alienObservation({ first = 0, extra = 0, revealed = false, round = 1,
    score = 0, secured = 0, reverse = false } = {}) {
    const slots = [{ slotId: 1, revealed, traces: Object.fromEntries(
      ["yellow", "pink", "blue"].map((color, index) => [color, {
        firstPlaced: index < first, ownerPlayerColor: index < first ? "red" : null,
        extraCount: index === 0 ? extra : 0,
        extraMarkers: index === 0 ? Array.from({ length: extra }, () => ({ ownerPlayerColor: "red" })) : [],
      }]),
    ) }, { slotId: 2, revealed: false, traces: {} }];
    return outcomeModel.createDecisionObservation({ publicState: { roundNumber: round,
      players: [{ id: seatId, color: "red", resources: { score }, securedEndGameBonus: secured }],
      board: { aliens: { slots: reverse ? slots.reverse() : slots } } },
      selfState: { id: seatId, hand: [] } }, { seatId });
  }
  function value(rootObs, leafObs) {
    const action = { actionId: "trace", family: "choose_target", phase: "conditional" };
    const result = expectedScore.evaluateOutcome({ seatId, actionOutcomes: [{
      schemaVersion: outcomeModel.OUTCOME_SCHEMA_VERSION, actionId: action.actionId, status: "settled",
      rootObservation: rootObs, leaves: [{ leafId: "leaf", status: "settled", observation: leafObs }],
    }] }, action);
    const priority = expectedScore.evaluateStrategicFactsBreakdown(
      outcomeModel.createStrategicFacts(rootObs, seatId), outcomeModel.createStrategicFacts(leafObs, seatId),
    );
    assert.equal(result.primaryValue, priority.primaryValue, "完整叶与轻量优先级使用同一外星预期");
    return result.primaryValue;
  }
  for (const round of [1, 2, 4]) {
    const rootObs = alienObservation({ round });
    const firstObs = alienObservation({ round, first: 1, score: 5, secured: 2 });
    assert.equal(value(rootObs, firstObs), 12, "即时5+锁定2+未揭示首痕迹预期5");
    assert.equal(value(firstObs, firstObs), 0, "已有首痕迹不能重复加预期");
    assert.equal(value(firstObs, alienObservation({ round, first: 1, score: 8, secured: 2, extra: 1 })), 3);
    assert.equal(value(rootObs, alienObservation({ round, revealed: true })), 0, "公共揭示不发个人分");
    assert.equal(value(firstObs, alienObservation({ round, first: 1, score: 5, secured: 2, revealed: true })), 0,
      "已有首痕迹揭示不另加分，也不凭既有预期消失惩罚主评分");
    for (const first of [1, 2, 3]) {
      const leaf = alienObservation({ round, first, reverse: true });
      assert.equal(value(rootObs, leaf), first * 5, "按slotId匹配且凑齐没有额外溢价");
      assert.equal(expectedScore.evaluateStateValue(leaf, seatId).components.alienValue, first * 5);
      const revealed = alienObservation({ round, first, revealed: true, score: 9 });
      assert.equal(value(rootObs, revealed), 9, "已兑现叶只按正式收益，不保留未揭示预期");
      assert.equal(expectedScore.evaluateStateValue(revealed, seatId).components.alienValue, 0);
    }
  }
}
console.log("terminal value tests passed");
