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
  dataProgress = null,
  alienSlots = [],
  securedEndGameBonus = 0,
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
        ...(dataProgress ? { dataProgress } : {}),
        securedEndGameBonus,
      }],
      board: { aliens: { slots: alienSlots } },
    },
    selfState: { id: seatId, hand: [] },
  }, { seatId, stateVersion: 1, decisionVersion: 1 });
}

{
  const result = evaluate(
    action("play-card:secured-final-score", "play_card"),
    observation({ score: 10, securedEndGameBonus: 0 }),
    observation({ score: 10, securedEndGameBonus: 8 }),
  );
  assert.equal(result.actualScoreDelta, 8,
    "正式终局计分器已经锁定的卡牌分必须作为一级分数，不等待整局 terminal");
  assert.equal(result.score, 8);
}

{
  const root = observation({
    dataProgress: { computerSlots: [1, 2, 3, 4], analyzeReady: false },
  });
  const closer = observation({
    dataProgress: { computerSlots: [1, 2, 3, 4, 5], analyzeReady: false },
  });
  const unrelated = observation({
    resources: { credits: 1 },
    dataProgress: { computerSlots: [1, 2, 3, 4], analyzeReady: false },
  });
  const place = action("place-data:slot-5", "place_data");
  const closerPriority = evaluator.evaluateSecondaryAgentSearchPriority({
      rootObservation: root,
      branchObservation: closer,
      focalSeatId: seatId,
      currentAction: place,
    });
  const unrelatedPriority = evaluator.evaluateSecondaryAgentSearchPriority({
      rootObservation: root,
      branchObservation: unrelated,
      focalSeatId: seatId,
      currentAction: action("industry:credit", "industry"),
    });
  const firstDifferentIndex = closerPriority.sortKey.findIndex(
    (value, index) => value !== unrelatedPriority.sortKey[index],
  );
  assert.ok(
    firstDifferentIndex >= 0
      && closerPriority.sortKey[firstDifferentIndex] > unrelatedPriority.sortKey[firstDifferentIndex],
    "填入下一计算机槽必须作为 beam 路线进度，但不能进入一级叶值",
  );
  assert.equal(
    evaluator.evaluateStrategicFactsPriority(
      outcomeModel.createStrategicFacts(root, seatId),
      outcomeModel.createStrategicFacts(closer, seatId),
    ),
    0,
    "数据槽进度不得直接折算为分数、科技或收入",
  );
}

{
  const corner = {
    ...action("corner:publicity", "card_corner"),
    payload: { kind: "resource" },
  };
  const before = observation({ resources: { publicity: 0 } });
  const immediate = observation({ resources: { publicity: 1 } });
  const distant = observation({
    resources: { publicity: 1 },
    score: 6,
  });
  const result = evaluator.evaluateAction({
    seatId,
    legalActions: [corner],
    actionOutcomes: [{
      schemaVersion: outcomeModel.OUTCOME_SCHEMA_VERSION,
      actionId: corner.actionId,
      status: "settled",
      confidence: "high",
      rootObservation: before,
      leaves: [{
        leafId: "unrelated-publicity-corner",
        actionChain: [corner.actionId, "land:distant"],
        secondaryAgentTrace: [
          { family: "card_corner", target: corner.target, payload: corner.payload },
          { family: "land", target: { planetId: "mars" }, payload: {} },
        ],
        rootActionObservation: immediate,
        rootActionLegalSuccessors: [{ family: "end_turn", target: {}, payload: {} }],
        observation: distant,
      }],
    }],
  }, corner);
  assert.equal(result.score, null,
    "只获得宣传的卡角不得把跨回合后的无关登陆收益归因给自己");
  assert.deepEqual(result.reasonCodes, ["card-corner-did-not-directly-unlock-agent"]);
}

{
  const ready = observation({
    resources: { credits: 4, energy: 0 },
    dataProgress: { computerSlots: [1, 2, 3, 4, 5, 6], analyzeReady: true },
  });
  const locked = evaluator.selectSecondaryAgentRouteTarget({
    focalSeatId: seatId,
    currentAction: { ...action("place-data:slot-6", "place_data"), actorId: seatId },
    rootObservation: observation(),
    branchObservation: ready,
    routeTargetId: null,
  });
  assert.equal(locked, "data:analyze", "第6格完成后必须锁定正式分析路线");
  const energyTrade = {
    ...action("trade:energy", "quick_trade"),
    actorId: seatId,
    target: { tradeId: "credits-for-energy" },
  };
  const endTurn = { ...action("end-turn", "end_turn"), actorId: seatId };
  assert.deepEqual(
    evaluator.selectSecondaryAgentSuccessors({
      focalSeatId: seatId,
      branchObservation: ready,
      legalSuccessors: [endTurn, energyTrade],
      routeTargetId: locked,
    }).map((candidate) => candidate.actionId),
    [energyTrade.actionId],
    "分析 ready 但缺电时应把换电当作目标手段，而不是提前结束路线",
  );
  const analyze = { ...action("analyze:data", "analyze"), actorId: seatId };
  assert.deepEqual(
    evaluator.selectSecondaryAgentSuccessors({
      focalSeatId: seatId,
      branchObservation: observation({
        resources: { credits: 2, energy: 1 },
        dataProgress: { computerSlots: [1, 2, 3, 4, 5, 6], analyzeReady: true },
      }),
      legalSuccessors: [endTurn, analyze],
      routeTargetId: locked,
    }).map((candidate) => candidate.actionId),
    [analyze.actionId],
    "跨回合返回本席后必须继续正式分析",
  );
  assert.equal(evaluator.selectSecondaryAgentRouteTarget({
    focalSeatId: seatId,
    currentAction: analyze,
    rootObservation: ready,
    branchObservation: observation(),
    routeTargetId: locked,
  }), null, "分析提交后数据目标应释放，继续搜索后续真实一级收益");
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
          rootActionSettledLegalSuccessors: candidateAction.family === "quick_trade"
            ? [{ family: "orbit", target: { planetId: "mars" }, payload: {} }]
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
          rootActionSettledLegalSuccessors: [
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
          rootActionSettledLegalSuccessors: [
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
        rootActionSettledLegalSuccessors: [placeData],
        observation: after,
      }],
    }],
  }, trade);
  assert.equal(result.score, null,
    "转换后的下一代理在转换前已经合法时，不能把遥远路线收益反复归因给当前转换");
  assert.deepEqual(result.reasonCodes, ["quick-trade-did-not-directly-unlock-agent"]);
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
