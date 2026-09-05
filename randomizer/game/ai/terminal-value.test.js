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
  }
  const ties = [leaf("a-sparse", actions[0].actionId, sparse), leaf("z-rich", actions[0].actionId, rich)];
  for (const leaves of [ties, [...ties].reverse()]) {
    const result = expectedScore.evaluateOutcome({
      seatId, actionOutcomes: [outcome(actions[0], leaves)],
    }, actions[0], { vStateValueEnabled });
    assert.equal(result.selectedLeafId, "a-sparse", "同正式分叶不按库存打破平局，V 开关与枚举顺序不影响结果");
  }
}
console.log("terminal value tests passed");
