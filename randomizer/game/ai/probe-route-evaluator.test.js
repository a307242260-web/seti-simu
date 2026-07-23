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
assert.equal(publicityRoute.currentActionDelta, -5);
assert.equal(publicityRoute.remainingRouteNet, 12.5);
assert.equal(publicityRoute.qProbe, 7.5);
assert.equal(publicityRoute.publicityAlongRoute, 1, "沿途宣传只来自真实 checkpoint 的 publicity delta");

const landingRoute = evaluationFor(action("move:land", "move"), {
  ...routeBase,
  nextActionId: "move:land",
  nextActionFamily: "move",
  routeOutcomeRef: "move:land→choose_payment:land→land:1→choose_target:trace",
  endpointActionId: "land:1",
  endpointKind: "land",
  currentDelta: { energy: -1 },
  remainingRouteDelta: { energy: -2, availableData: 2, realizedScore: 18 },
  publicityAlongRoute: 0,
  publicityOutcomeRefs: [],
  endpointDelta: { energy: -2, availableData: 2, realizedScore: 18 },
});
assert.equal(landingRoute.qProbe, 8, "着陆完整 Decision 链的即时资源和分数必须共同进入真实净值");

const shortRoute = evaluationFor(action("move:short", "move"), {
  ...routeBase,
  nextActionId: "move:short",
  nextActionFamily: "move",
  routeOutcomeRef: "move:short→orbit:1",
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
  currentDelta: { energy: -1 },
  remainingRouteDelta: { realizedScore: 10 },
  publicityAlongRoute: 0,
  endpointDelta: { realizedScore: 10 },
});
assert.equal(shortRoute.qProbe, longRoute.qProbe, "路径长短本身不得折价");

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
assert.equal(pass.qProbe, null, "PASS 不得继承探测器未来路线值");
assert.equal(pass.remainingRouteNet, 0);

const firstProbe = evaluationFor(action("move:probe-1", "move", 1), {
  ...routeBase,
  nextActionId: "move:probe-1",
  nextActionFamily: "move",
  routeOutcomeRef: "move:probe-1→orbit:shared",
  currentDelta: {},
  remainingRouteDelta: { realizedScore: 6 },
  publicityAlongRoute: 0,
  endpointDelta: { realizedScore: 6 },
});
assert.equal(firstProbe.qProbe, 6);
assert.equal(firstProbe.probeRouteSummary.nextActionId, "move:probe-1",
  "多探测器候选只归因当前 next action，不在 Vroot 汇总重复终点收益");

const noEndpoint = evaluationFor(action("move:loop", "move"), {
  ...routeBase,
  nextActionId: "move:loop",
  nextActionFamily: "move",
  routeOutcomeRef: "move:loop→move:back",
  endpointActionId: null,
  endpointKind: null,
  currentDelta: { energy: -1 },
  remainingRouteDelta: { publicity: 1 },
  publicityAlongRoute: 1,
  endpointDelta: null,
});
assert.equal(noEndpoint.score, null, "没有正收益终点的循环不得形成探测器推荐");

console.log("probe route evaluator tests passed");
