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
    legalActions: [candidateAction],
    actionOutcomes: [{
      schemaVersion: outcomeModel.OUTCOME_SCHEMA_VERSION,
      actionId: candidateAction.actionId,
      status,
      confidence: status === "settled" ? "high" : "none",
      rootObservation: before,
      leaves: status === "settled"
        ? [{
          leafId: `${candidateAction.actionId}:leaf`,
          actionChain: [candidateAction.actionId],
          secondaryAgentTrace: candidateAction.family === "quick_trade"
            ? [
              { family: "quick_trade", target: candidateAction.target, payload: {} },
              { family: "orbit", target: { planetId: "mars" }, payload: {} },
            ]
            : [],
          observation: after,
        }]
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
    action("trade-then-orbit", "quick_trade"),
    observation({ score: 4, resources: { credits: 2, energy: 0 } }),
    observation({ score: 13, resources: { credits: 0, energy: 1 } }),
  );
  assert.equal(result.primaryValue, 9, "快速转换后的目标分仍按实际一级收益计算");
  assert.equal(result.opportunityCost, 1, "2份资源换1份资源必须体现1份净机会成本");
  assert.equal(result.score, 8, "必要转换可以完成目标，但路线价值必须扣除真实净损耗");
}

{
  const candidateAction = action("trade-route-dominance", "quick_trade");
  const before = observation({ score: 4 });
  const after = observation({ score: 13 });
  const result = evaluator.evaluateAction({
    seatId,
    actionOutcomes: [{
      schemaVersion: outcomeModel.OUTCOME_SCHEMA_VERSION,
      actionId: candidateAction.actionId,
      status: "settled",
      confidence: "high",
      rootObservation: before,
      leaves: [
        {
          leafId: "wasteful",
          actionChain: ["quick_trade:a", "quick_trade:b", "orbit:c"],
          quickTradeCount: 2,
          secondaryAgentDepth: 3,
          secondaryAgentTrace: [
            { family: "quick_trade", target: { tradeId: "credits-for-energy" }, payload: {} },
            { family: "orbit", target: { planetId: "mars" }, payload: {} },
          ],
          observation: after,
        },
        {
          leafId: "direct",
          actionChain: ["quick_trade:a", "orbit:c"],
          quickTradeCount: 1,
          secondaryAgentDepth: 2,
          secondaryAgentTrace: [
            { family: "quick_trade", target: { tradeId: "credits-for-energy" }, payload: {} },
            { family: "orbit", target: { planetId: "mars" }, payload: {} },
          ],
          observation: after,
        },
      ],
    }],
  }, candidateAction);
  assert.equal(result.selectedLeafId, "direct",
    "同一一级结果必须保留转换更少、代理更短的达成路线");
  assert.equal(result.quickTradeCount, 1);
}

{
  const trade = action("trade-without-purpose", "quick_trade");
  const placeData = {
    ...action("place-data-already-legal", "place_data"),
    target: { slotId: "slot-1" },
  };
  const before = observation({ income: { credits: 0 } });
  const after = observation({ income: { credits: 1 } });
  const result = evaluator.evaluateAction({
    seatId,
    legalActions: [trade, placeData],
    actionOutcomes: [{
      schemaVersion: outcomeModel.OUTCOME_SCHEMA_VERSION,
      actionId: trade.actionId,
      status: "settled",
      confidence: "high",
      rootObservation: before,
      leaves: [{
        leafId: "trade-before-already-legal-placement",
        actionChain: [trade.actionId, placeData.actionId],
        quickTradeCount: 1,
        secondaryAgentTrace: [
          { family: "quick_trade", target: { tradeId: "credits-for-energy" }, payload: {} },
          { family: placeData.family, target: placeData.target, payload: placeData.payload },
        ],
        observation: after,
      }],
    }],
  }, trade);
  assert.equal(result.score, null,
    "转换后的下一代理在转换前已经合法时，不能把遥远路线收益反复归因给当前转换");
  assert.deepEqual(result.reasonCodes, ["quick-trade-did-not-unlock-next-agent"]);
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
  assert.equal(result.incomeValue, 10,
    "第2轮增加1信用收入只计第3、4轮两次尚未发生的轮初收入，共10分长期价值");
  assert.equal(result.score, 10);
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
  assert.equal(result.score, null, "第4轮行动阶段之后已经没有轮初收入窗口，纯收入轨路线不可选");
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
  assert.equal(result.incomeValue, 5);
  assert.equal(result.score, 20,
    "同一真实叶的分数、科技和收入可以合并，但中间资源不得重复计分");
}

{
  const before = observation();
  const result = evaluate(action("scan:unresolved"), before, before, "unresolved");
  assert.equal(result.selectable, false);
  assert.equal(result.score, null);
}

console.log("strategic goal evaluator tests passed");
