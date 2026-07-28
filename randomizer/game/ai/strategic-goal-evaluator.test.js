"use strict";

const assert = require("node:assert/strict");
const outcomeModel = require("./outcome-model");
const evaluator = require("./expected-score-evaluator");

const seatId = "strategic-seat";

function observation({
  score = 0,
  resources = {},
  income = {},
  ownedTechIds = [],
  roundNumber = 1,
} = {}) {
  return outcomeModel.createDecisionObservation({
    publicState: {
      roundNumber,
      players: [{
        id: seatId,
        resources: {
          score,
          credits: 0,
          energy: 0,
          publicity: 0,
          availableData: 0,
          ...resources,
        },
        income,
        techState: {
          ownedTiles: Object.fromEntries(ownedTechIds.map((tileId) => [tileId, true])),
          disabledTiles: {},
          blueBoardSlots: {},
        },
      }],
      board: {},
    },
    selfState: { id: seatId, hand: [] },
  }, { seatId, stateVersion: 1, decisionVersion: 1 });
}

function action(actionId, family = "scan") {
  return { actionId, family, phase: "main", target: {} };
}

function evaluate(candidateAction, before, after, status = "settled") {
  return evaluator.evaluateAction({
    seatId,
    actionOutcomes: [{
      schemaVersion: outcomeModel.OUTCOME_SCHEMA_VERSION,
      actionId: candidateAction.actionId,
      status,
      confidence: status === "settled" ? "high" : "none",
      rootObservation: before,
      leaves: status === "settled"
        ? [{ leafId: `${candidateAction.actionId}:leaf`, actionChain: [candidateAction.actionId], observation: after }]
        : [],
    }],
  }, candidateAction);
}

{
  const before = observation();
  const result = evaluate(
    action("scan:resources"),
    before,
    observation({ resources: { credits: 2, availableData: 2 } }),
  );
  assert.equal(result.score, null,
    "钱、电、宣传、数据和手牌库存本身不得冒充分数、科技或收入目标");
}

{
  const result = evaluate(
    action("orbit:score", "orbit"),
    observation({ score: 4 }),
    observation({ score: 13 }),
  );
  assert.equal(result.score, 9);
  assert.equal(result.actualScoreDelta, 9);
  assert.deepEqual(result.reasonCodes, ["strategic-goal-score"]);
}

{
  const result = evaluate(
    action("orbit:round-four-score", "orbit"),
    observation({ score: 4, roundNumber: 4 }),
    observation({ score: 13, roundNumber: 4 }),
  );
  assert.equal(result.score, 9, "分数价值不得随轮次下降");
}

{
  const result = evaluate(
    action("research:tech", "research_tech"),
    observation({ roundNumber: 2 }),
    observation({ roundNumber: 2, ownedTechIds: ["orange2"] }),
  );
  assert.equal(result.techValue, 15,
    "第2轮获得科技可覆盖当前轮及剩余两轮，初版每轮价值5分");
  assert.equal(result.score, 15);
  assert.deepEqual(result.gainedTechIds, ["orange2"]);
}

{
  const result = evaluate(
    action("research:round-four-tech", "research_tech"),
    observation({ roundNumber: 4 }),
    observation({ roundNumber: 4, ownedTechIds: ["orange2"] }),
  );
  assert.equal(result.techValue, 5, "第4轮科技只剩当前轮价值，必须低于第2轮");
}

{
  const result = evaluate(
    action("place-data:income", "place_data"),
    observation({ roundNumber: 2 }),
    observation({ roundNumber: 2, income: { credits: 1 } }),
  );
  assert.equal(result.incomeValue, 15,
    "第2轮增加1信用收入应计效果即时结算及第3、4轮轮初收入，共15分长期价值");
  assert.equal(result.score, 15);
  assert.deepEqual(result.incomeDelta, {
    credits: 1,
    energy: 0,
    publicity: 0,
    availableData: 0,
    handSize: 0,
    additionalPublicScan: 0,
  });
}

{
  const result = evaluate(
    action("place-data:round-four-income", "place_data"),
    observation({ roundNumber: 4 }),
    observation({ roundNumber: 4, income: { credits: 1 } }),
  );
  assert.equal(result.incomeValue, 5, "第4轮新增信用收入只计效果自身的当前轮窗口");
}

{
  const result = evaluate(
    action("card:combined", "play_card"),
    observation({ roundNumber: 3, score: 2 }),
    observation({
      roundNumber: 3,
      score: 7,
      ownedTechIds: ["blue1"],
      income: { energy: 1 },
    }),
  );
  assert.equal(result.actualScoreDelta, 5);
  assert.equal(result.techValue, 10);
  assert.equal(result.incomeValue, 10);
  assert.equal(result.score, 25,
    "同一真实叶的分数、科技和收入可以合并，但中间资源不得重复计分");
}

{
  const before = observation();
  const result = evaluate(action("scan:unresolved"), before, before, "unresolved");
  assert.equal(result.selectable, false);
  assert.equal(result.score, null);
}

console.log("strategic goal evaluator tests passed");
