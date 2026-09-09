"use strict";

const assert = require("node:assert/strict");
const evaluator = require("./heuristic-evaluator");
const expectedScore = require("./expected-score-evaluator");

function descriptor(actionId) {
  return { actionId, family: "pass", phase: "main", actorId: "p1" };
}

const context = {
  seatId: "p1",
  observation: { selfState: { id: "p1" } },
  legalActions: [descriptor("z-low"), descriptor("a-high")],
};
const before = structuredClone(context);
const selected = evaluator.selectLegalAction(context, {
  evaluateAction: (_current, action) => ({
    score: action.actionId === "a-high" ? 8 : 2,
    status: "settled",
    selectable: true,
  }),
});
assert.equal(selected.actionId, "a-high", "排序只能消费 action outcome 的 leaf value");
assert.deepEqual(context, before, "估值与排序不得修改 observation/legal descriptors");

const tied = evaluator.selectLegalAction({
  ...context,
  legalActions: [descriptor("z-action"), descriptor("a-action")],
}, {
  evaluateAction: () => ({ score: 5, status: "settled", selectable: true }),
});
assert.equal(tied.actionId, "a-action", "同 V 必须使用稳定 actionId tie-break，不依赖枚举顺序");

const unresolved = evaluator.selectLegalAction({
  ...context,
  legalActions: [descriptor("z-action"), descriptor("a-action")],
}, {
  evaluateAction: () => ({ score: null, status: "unresolved" }),
});
assert.equal(unresolved, null, "失败或 unresolved 候选必须 fail closed，不能被稳定 tie-break 误选");

const goalBeforePass = evaluator.selectLegalAction({
  ...context,
  legalActions: [descriptor("pass"), { ...descriptor("move"), family: "move" }],
}, {
  evaluateAction: (_current, candidate) => ({
    score: candidate.family === "move" ? 1 : 0,
    status: "settled",
    selectable: true,
    priorityClass: candidate.family === "move" ? 3 : 0,
  }),
});
assert.equal(goalBeforePass.actionId, "move", "已解析正分路线的下一步必须优先于 PASS");

const primaryBeforeCost = evaluator.selectLegalAction({
  ...context,
  legalActions: [descriptor("pass"), descriptor("score-with-cost")],
}, {
  evaluateAction: (_current, action) => (
    action.actionId === "pass"
      ? { score: 0, sortKey: [0, 0], status: "settled", selectable: true }
      : { score: 5, sortKey: [5, -14], status: "settled", selectable: true }
  ),
});
assert.equal(primaryBeforeCost.actionId, "score-with-cost",
  "正一级收益必须胜过0分PASS，资源成本只在同一级收益路线间比较");

const targetObservation = {
  probeRouteRequirements: {
    candidates: [{
      requirementId: "launch:orbit:mars:planet:",
      sourceId: "launch",
      targetId: "orbit:mars:planet:",
      nextStep: { family: "launch" },
      required: { credits: 2, energy: 3 },
      gap: { credits: 0, energy: 0 },
      targetBenefit: { score: 3 },
    }],
  },
  dataAnalyzeRequirements: null,
  publicState: {
    players: [{
      id: "p1",
      resources: {
        credits: 4,
        energy: 4,
        publicity: 0,
        availableData: 0,
      },
      handCount: 0,
    }],
  },
};
const targetSuccessors = [
  { actionId: "launch", family: "launch", phase: "main", actorId: "p1" },
  { actionId: "scan", family: "scan", phase: "main", actorId: "p1" },
  { actionId: "research", family: "research_tech", phase: "main", actorId: "p1" },
];
const boundProbe = expectedScore.selectSecondaryAgentSuccessors({
  focalSeatId: "p1",
  branchObservation: targetObservation,
  legalSuccessors: targetSuccessors,
  routeTargetId: "orbit:mars:planet:",
  routePlanId: "probe:launch:orbit:mars:planet:",
});
assert.deepEqual(
  boundProbe.map((action) => [action.actionId, action.routeTargetId]),
  [["launch", "orbit:mars:planet:"]],
  "目标未完成时只能生成直接推进该正式目标的 action",
);
assert.deepEqual(expectedScore.selectSecondaryAgentSuccessors({
  focalSeatId: "p1",
  branchObservation: targetObservation,
  legalSuccessors: targetSuccessors.slice(1),
  routeTargetId: "orbit:mars:planet:",
  routePlanId: "probe:launch:orbit:mars:planet:",
}), [], "目标不可达时必须结束路线，不得退回无关 legal actions");

const rebound = expectedScore.selectSecondaryAgentSuccessors({
  focalSeatId: "p1",
  branchObservation: targetObservation,
  legalSuccessors: targetSuccessors,
  routeTargetId: null,
});
assert.deepEqual(
  rebound.map((action) => [action.actionId, action.routeTargetId]),
  [
    ["launch", "orbit:mars:planet:"],
    ["research", null],
    ["scan", null],
  ],
  "统一搜索未绑定分支 = 目标路线动作（launch 绑定）+ 未绑定后继按立即价值截断"
    + "（research/scan 不绑定，凭需求放行）",
);

const conversionObservation = {
  ...targetObservation,
  outcomeProjection: {
    assets: {
      credits: 0,
      energy: 0,
      publicity: 0,
      ordinaryCards: 4,
      alienCards: 0,
    },
  },
  probeRouteRequirements: {
    candidates: [{
      requirementId: "launch:orbit:mars:planet:",
      sourceId: "launch",
      targetId: "orbit:mars:planet:",
      nextStep: { family: "launch" },
      required: { credits: 1, energy: 1 },
      gap: { credits: 1, energy: 1 },
      targetBenefit: { score: 3 },
    }],
  },
};
const conversionRoutes = expectedScore.selectSecondaryAgentSuccessors({
  focalSeatId: "p1",
  branchObservation: conversionObservation,
  legalSuccessors: [
    {
      actionId: "cards-credit",
      family: "quick_trade",
      phase: "quick",
      actorId: "p1",
      target: { tradeId: "cards-for-credit" },
      payload: { cost: { handSize: 2 }, gain: { credits: 1 } },
    },
    {
      actionId: "cards-energy",
      family: "quick_trade",
      phase: "quick",
      actorId: "p1",
      target: { tradeId: "cards-for-energy" },
      payload: { cost: { handSize: 2 }, gain: { energy: 1 } },
    },
  ],
  routeTargetId: "orbit:mars:planet:",
  routePlanId: "probe:launch:orbit:mars:planet:",
});
assert.deepEqual(
  conversionRoutes.map((action) => action.actionId),
  ["cards-energy"],
  "资源规划必须按最终资源向量归并等成本排列，并用稳定首步表示同一方案",
);

// 开普勒22第三次结算已经结束：第四次仍可扫描，不代表第三次目标仍可完成。
const sectorGoal = "sector:win:sector-3-a:3";
const sectorInput = {
  focalSeatId: "p1", routeTargetId: sectorGoal, routePlanId: "sector:standard-scan:sector-3-a",
  branchObservation: { ...targetObservation, sectorWinRequirements: {
    candidates: [{ targetId: "sector:win:sector-3-a:4", sectorId: "sector-3-a", nextSettlementNumber: 4 }],
    standardScanCost: { credits: 1, energy: 2 }, wins: [],
  } },
};
const scanAction = { actionId: "scan-expired", family: "scan", phase: "main", actorId: "p1" };
const endAction = { actionId: "end-expired", family: "end_turn", phase: "turn_control", actorId: "p1" };
const energyTrade = { actionId: "trade-expired", family: "quick_trade", phase: "quick", actorId: "p1",
  target: { tradeId: "credits-for-energy" }, payload: { cost: { credits: 2 }, gain: { energy: 1 } } };
const selectSector = (input, actions) => expectedScore.selectSecondaryAgentSuccessors({
  ...input, legalSuccessors: actions,
});
const sectorBefore = structuredClone(sectorInput);
for (const action of [scanAction, endAction, energyTrade]) {
  assert.deepEqual(selectSector(sectorInput, [action]), [], "过期结算不得继续扫描、等待或交易");
}
const validSectorInput = structuredClone(sectorInput);
validSectorInput.branchObservation.sectorWinRequirements.candidates[0].targetId = sectorGoal;
validSectorInput.branchObservation.sectorWinRequirements.candidates[0].nextSettlementNumber = 3;
for (const action of [scanAction, endAction]) {
  assert.deepEqual(selectSector(validSectorInput, [action]).map(a => a.actionId), [action.actionId]);
}
validSectorInput.branchObservation.outcomeProjection = {
  assets: { credits: 4, energy: 1, ordinaryCards: 0 },
};
assert.deepEqual(selectSector(validSectorInput, [energyTrade]).map(a => a.actionId), [energyTrade.actionId]);
const pendingReward = { actionId: "confirm-expired", family: "accept_optional_effect", phase: "conditional",
  actorId: "p1", target: { kind: "residual-domain", choiceId: "confirm:reward" } };
assert.deepEqual(selectSector(sectorInput, [pendingReward]).map(a => a.actionId), [pendingReward.actionId],
  "结算期间不能因下一次目录变化截断当前奖励");
const wonInput = structuredClone(sectorInput);
wonInput.branchObservation.sectorWinRequirements.wins.push({ sectorId: "sector-3-a", settlementNumber: 3 });
assert.equal(expectedScore.completesSecondaryAgentRouteTarget({
  ...wonInput, action: scanAction, targetId: sectorGoal,
}), true);
assert.equal(expectedScore.completesSecondaryAgentRouteTarget({
  ...sectorInput, action: scanAction, targetId: sectorGoal,
}), false);
const missingSector = structuredClone(sectorInput);
delete missingSector.branchObservation.sectorWinRequirements;
assert.throws(() => selectSector(missingSector, [scanAction]), /SECTOR_GOAL_REQUIREMENTS_MISSING/);
assert.throws(() => selectSector(sectorInput, [{ ...scanAction, actorId: "p2" }]), /opponent action/);
assert.deepEqual(sectorInput, sectorBefore);

console.log("heuristic evaluator outcome behavior tests passed");
