"use strict";
const assert = require("node:assert/strict");
const evaluator = require("./expected-score-evaluator");
const seat = "player-green";
const planId = "probe:rocket:1:land:mars:planet:";
const targetId = "land:mars:planet:";
const landed = { type: "land", playerId: seat, planetId: "mars", markerKind: "land", satelliteId: null };
const land = { actionId: "land:entry", actorId: seat, family: "land", phase: "main", target: { select: true } };
const move = { actionId: "move:other", actorId: seat, family: "move", phase: "quick",
  target: { rocketId: 5, deltaX: -1, deltaY: 0 } };
const goals = [
  { requirementId: "rocket:5:land:mars:planet:", targetId, rocketId: 5, planetId: "mars",
    sourceId: "rocket:5", endpointTarget: { type: "planet" },
    nextStep: { family: "move", rocketId: 5, deltaX: -1, deltaY: 0 } },
  { requirementId: "rocket:1:land:mars:planet:", targetId, rocketId: 1, planetId: "mars",
    sourceId: "rocket:1", endpointTarget: { type: "planet" },
    nextStep: { family: "land", rocketId: 1, planetId: "mars", target: { type: "planet" } } },
];
const select = (candidates, actions, target = targetId) => evaluator.selectSecondaryAgentSuccessors({
  focalSeatId: seat, routeTargetId: target, routePlanId: planId,
  branchObservation: { probeRouteRequirements: { candidates }, selfState: { hand: [] } },
  legalSuccessors: actions,
});
for (const candidates of [goals, [...goals].reverse()]) {
  const selected = select(candidates, [move, land]);
  assert.deepEqual(selected.map((action) => action.actionId), [land.actionId]);
  assert.equal(selected[0].routePlanId, planId);
  assert.deepEqual(select(candidates, [move, land], "income:gain:0,0,0,0,0,0")
    .map((action) => action.actionId), [land.actionId]);
}
assert.deepEqual(select([goals[0]], [move, land]), [], "来源消失不能换火箭");
const choices = [1, 5].map((rocketId) => ({ actionId: `land-choice:${rocketId}`, actorId: seat,
  family: "choose_target", phase: "conditional", target: { rocketId, planetId: "mars",
    choiceId: `land:${rocketId}:mars:planet:`, landTarget: { type: "planet", rocketId } } }));
assert.deepEqual(select(goals, choices).map((action) => action.target.rocketId), [1]);
assert.deepEqual(select(goals, [choices[1]]), []);
const complete = (executionEvents, action = land, target = targetId) => evaluator.completesSecondaryAgentRouteTarget({
  action, targetId: target, planId, focalSeatId: seat, executionEvents,
});
assert.equal(complete([]), false, "请求选靶不是完成");
assert.equal(complete([landed]), true, "单目标直连使用正式事件");
assert.equal(complete([landed], choices[0]), true, "多目标选靶使用同一事件");
assert.equal(complete([{ ...landed, playerId: "player-white" }]), false);
assert.equal(complete([{ ...landed, planetId: "venus" }]), false);
assert.equal(complete([landed], choices[0], "land:mars:satellite:phobos"), false);
assert.equal(complete([{ ...landed, markerKind: "satellite", satelliteId: "phobos" }], choices[0],
  "land:mars:satellite:phobos"), true);
const advance = (id, events) => evaluator.advanceSecondaryAgentRoutePlan({ planId: id,
  focalSeatId: seat, executionEvents: events });
const launchPlan = "probe:launch:land:mars:planet:";
const launch = { type: "launch", playerId: seat, rocketId: 7 };
assert.equal(advance(launchPlan, []), launchPlan);
assert.equal(advance(launchPlan, [{ ...launch, playerId: "player-white" }]), launchPlan);
assert.equal(advance(launchPlan, [launch, { ...launch, rocketId: 8 }]), "probe:rocket:7:land:mars:planet:");
assert.equal(advance(planId, [launch]), planId);
assert.throws(() => advance(launchPlan, [{ ...launch, rocketId: null }]), /PROBE_LAUNCH_ID_MISSING/);
console.log("probe source binding tests passed");
