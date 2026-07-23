"use strict";

const assert = require("node:assert/strict");
const outcomeModel = require("./outcome-model");
const evaluator = require("./expected-score-evaluator");

const seatId = "probe-seat";

function observation(resources, summary = null, rockets = []) {
  return outcomeModel.createDecisionObservation({
    publicState: {
      players: [{ id: seatId, resources }],
      board: { rockets },
    },
    selfState: { id: seatId, hand: [] },
  }, { seatId, stateVersion: 1, decisionVersion: 1, probeRouteSummary: summary });
}

function action(actionId, family, rocketId = 1) {
  return { actionId, family, target: { rocketId } };
}

function evaluationFor(candidateAction, summary, finalResources = {}) {
  const root = observation({
    score: 0, credits: 4, energy: 4, publicity: 0, availableData: 0,
  }, null, [
    { id: 1, playerId: seatId, surface: "solar-board", sectorX: 0, sectorY: 0 },
    { id: 2, playerId: seatId, surface: "solar-board", sectorX: 2, sectorY: 0 },
  ]);
  const leaf = observation({
    score: 0, credits: 4, energy: 4, publicity: 0, availableData: 0,
    ...finalResources,
  }, summary);
  return evaluator.evaluateAction({
    seatId,
    actionOutcomes: [{
      schemaVersion: outcomeModel.OUTCOME_SCHEMA_VERSION,
      actionId: candidateAction.actionId,
      status: "settled",
      confidence: "high",
      rootObservation: root,
      leaves: [{ leafId: "route-leaf", actionChain: summary.routeOutcomeRef.split("→"), observation: leaf }],
    }],
  }, candidateAction);
}

const routeBase = {
  currentOutcomeRef: "move:1→choose_payment:1",
  endpointActionId: "orbit:1",
  endpointKind: "orbit",
  endpointPlanetId: "mars",
  goalScoreGain: 20,
  routeCost: { credits: 0, energy: 3, movementSteps: 2 },
  resourceGap: { credits: 0, energy: 0, movementSteps: 1 },
  remainingResources: { credits: 4, energy: 1 },
  publicityOutcomeRefs: ["move:2→choose_payment:2"],
};

const publicityRoute = evaluationFor(action("move:1", "move"), {
  ...routeBase,
  nextActionId: "move:1",
  nextActionFamily: "move",
  routeOutcomeRef: "move:1→choose_payment:1→move:2→choose_payment:2→orbit:1",
  currentDelta: { energy: -1 },
  remainingRouteDelta: { energy: -2, publicity: 1, realizedScore: 20 },
  publicityAlongRoute: 1,
  endpointDelta: { energy: -1, realizedScore: 20 },
});
assert.equal(publicityRoute.goalScoreGain, 20);
assert.equal(publicityRoute.score, 20);
assert.equal(publicityRoute.probeRouteSummary.publicityAlongRoute, 1,
  "沿途宣传只保留标准叶事实，不能直接进入目标得分");

const landingRoute = evaluationFor(action("move:land", "move"), {
  ...routeBase,
  nextActionId: "move:land",
  nextActionFamily: "move",
  routeOutcomeRef: "move:land→choose_payment:land→land:1→choose_target:trace",
  endpointActionId: "land:1",
  endpointKind: "land",
  goalScoreGain: 18,
  currentDelta: { energy: -1 },
  remainingRouteDelta: { energy: -2, availableData: 2, realizedScore: 18 },
  publicityAlongRoute: 0,
  publicityOutcomeRefs: [],
  endpointDelta: { energy: -2, availableData: 2, realizedScore: 18 },
});
assert.equal(landingRoute.score, 18, "着陆目标只读取完整标准 Decision 链兑现的真实分数");

const shortRoute = evaluationFor(action("move:short", "move"), {
  ...routeBase,
  nextActionId: "move:short",
  nextActionFamily: "move",
  routeOutcomeRef: "move:short→orbit:1",
  goalScoreGain: 10,
  currentDelta: { energy: -1 },
  remainingRouteDelta: { realizedScore: 10 },
  publicityAlongRoute: 0,
  endpointDelta: { realizedScore: 10 },
});
const longRoute = evaluationFor(action("move:long", "move"), {
  ...routeBase,
  nextActionId: "move:long",
  nextActionFamily: "move",
  routeOutcomeRef: "move:long→move:extra→orbit:1",
  goalScoreGain: 10,
  currentDelta: { energy: -1 },
  remainingRouteDelta: { realizedScore: 10 },
  publicityAlongRoute: 0,
  endpointDelta: { realizedScore: 10 },
});
assert.equal(shortRoute.score, longRoute.score, "路径长短本身不得折价");

const pass = evaluationFor(action("pass:1", "pass"), {
  ...routeBase,
  nextActionId: "move:1",
  nextActionFamily: "move",
  routeOutcomeRef: "move:1→orbit:1",
  currentDelta: {},
  remainingRouteDelta: { realizedScore: 99 },
  publicityAlongRoute: 0,
  endpointDelta: { realizedScore: 99 },
});
assert.equal(pass.score, 0, "PASS 不得继承探测器未来路线值");
assert.equal(pass.probeRouteSummary, null);

const firstProbe = evaluationFor(action("move:probe-1", "move", 1), {
  ...routeBase,
  nextActionId: "move:probe-1",
  nextActionFamily: "move",
  routeOutcomeRef: "move:probe-1→orbit:shared",
  goalScoreGain: 6,
  currentDelta: {},
  remainingRouteDelta: { realizedScore: 6 },
  publicityAlongRoute: 0,
  endpointDelta: { realizedScore: 6 },
});
assert.equal(firstProbe.score, 6);
assert.equal(firstProbe.probeRouteSummary.nextActionId, "move:probe-1",
  "多探测器候选只归因当前 next action，不在 Vroot 汇总重复终点收益");

const noEndpoint = evaluationFor(action("move:loop", "move"), {
  ...routeBase,
  nextActionId: "move:loop",
  nextActionFamily: "move",
  routeOutcomeRef: "move:loop→move:back",
  endpointActionId: null,
  endpointKind: null,
  goalScoreGain: 0,
  currentDelta: { energy: -1 },
  remainingRouteDelta: { publicity: 1 },
  publicityAlongRoute: 1,
  endpointDelta: null,
});
assert.equal(noEndpoint.score, null, "没有正收益终点的循环不得形成探测器推荐");

console.log("probe route evaluator tests passed");
