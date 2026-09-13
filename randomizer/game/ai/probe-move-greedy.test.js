"use strict";
const assert = require("node:assert/strict");
const evaluator = require("./expected-score-evaluator");
const model = require("./outcome-model");
const seatId = "p1";
const outward = { actionId: "move:z-out", family: "move", phase: "quick", actorId: seatId,
  target: { rocketId: 1, deltaX: 0, deltaY: 1 } };
const alternate = { ...outward, actionId: "move:a-left", target: { rocketId: 1, deltaX: -1, deltaY: 0 } };
const goal = { requirementId: "rocket:1:land:mars:planet:", targetId: "land:mars:planet:",
  sourceId: "rocket:1", rocketId: 1, planetId: "mars", endpointFamily: "land", endpointTarget: { type: "planet" },
  required: { credits: 0, energy: 2, movementPoints: 2, movementSteps: 2 },
  gap: { credits: 0, energy: 0 }, targetBenefit: { score: 10, grossEquivalentValue: 10 },
  nextStep: { family: "move", ...outward.target },
  movementNextSteps: [outward, alternate].map(a => ({ family: a.family, ...a.target })) };
const observation = { ...model.createDecisionObservation({ perspectivePlayerId: seatId,
  publicState: { roundNumber: 1, players: [{ playerId: seatId, credits: 10, energy: 10,
    resources: { credits: 10, energy: 10 }, income: {}, techState: { ownedTiles: {} } }], board: {} },
  selfState: { playerId: seatId, hand: [], reservedCards: [] },
}, { seatId }), probeRouteRequirements: { candidates: [goal] } };
const legal = [alternate, outward];
const before = JSON.stringify({ observation, legal });
function selected(actions = legal) {
  return evaluator.selectSecondaryAgentSuccessors({ focalSeatId: seatId, branchObservation: observation,
    legalSuccessors: actions, routeTargetId: goal.targetId, routePlanId: `probe:${goal.requirementId}` });
}
assert.deepEqual(selected().map(a => a.actionId), [outward.actionId], "目录首选不按actionId抢先");
assert.deepEqual(selected([alternate]).map(a => a.actionId), [alternate.actionId], "首选不可用仍保留合法替代");
assert.deepEqual(selected([...legal].reverse()).map(a => a.actionId), [outward.actionId]);
const roots = evaluator.enumerateSecondaryAgentRootTargets({ focalSeatId: seatId,
  rootObservation: observation, legalActions: legal });
assert.deepEqual(roots.find(r => r.targetId === goal.targetId)?.compatibleActionIds, [outward.actionId]);
assert.equal(JSON.stringify({ observation, legal }), before);
assert(selected().every(a => !a.targetEquivalentChoiceCount), "有损策略不得记为等价省略");
const second = { ...goal, requirementId: "rocket:1:land:venus:planet:", targetId: "land:venus:planet:",
  planetId: "venus", nextStep: { family: "move", ...alternate.target } };
observation.probeRouteRequirements.candidates.push(second);
assert.deepEqual(selected().map(a => a.actionId), [outward.actionId]);
const secondBound = evaluator.selectSecondaryAgentSuccessors({ focalSeatId: seatId,
  branchObservation: observation, legalSuccessors: legal,
  routeTargetId: second.targetId, routePlanId: `probe:${second.requirementId}` });
assert.deepEqual(secondBound.map(a => a.actionId), [alternate.actionId],
  "不同目标各自保留方向，不跨目标合并");
const free = legal.map(a => ({ ...a, family: "choose_target", phase: "conditional" }));
goal.movementNextSteps = free.map(a => ({ family: a.family, ...a.target }));
observation.probeRouteRequirements.candidates = [goal];
observation.probeRouteRequirements.movementContext = { phase: "card", cardRemaining: 2 };
assert.deepEqual(selected(free).map(a => a.actionId).sort(), free.map(a => a.actionId).sort(),
  "免费条件移动不在本次普通move筛选范围");
console.log("probe move greedy tests passed");
const skip = {actionId:"choose_target:skip",family:"choose_target",phase:"conditional",actorId:seatId,target:{skip:true}};
const secondMoves = [1,-1].map((dx,i)=>({actionId:`choose_target:second-${i}`,family:"choose_target",phase:"conditional",actorId:seatId,
  target:{rocketId:2,deltaX:dx,deltaY:0}}));
const secondary = secondMoves.map((action,i)=>({...goal,requirementId:`rocket:2:${i?"land":"orbit"}:venus:planet:`,
  targetId:`${i?"land":"orbit"}:venus:planet:`,sourceId:"rocket:2",rocketId:2,planetId:"venus",endpointFamily:i?"land":"orbit",
  targetBenefit:{score:i?10:30,grossEquivalentValue:i?10:30},
  nextStep:{family:"choose_target",...action.target},movementNextSteps:[{family:"choose_target",...action.target}]}));
const companyObservation = structuredClone(observation);
companyObservation.probeRouteRequirements = {movementContext:{phase:"company",companyRemaining:1,usedRocketIds:[1]},
  candidates:[{...goal,movementNextSteps:[{family:"choose_target",skip:true}]},...secondary]};
const selectCompany = (actions,state=companyObservation) => evaluator.selectSecondaryAgentSuccessors({focalSeatId:seatId,
  branchObservation:state,legalSuccessors:actions,routeTargetId:goal.targetId,routePlanId:`probe:${goal.requirementId}`});
const companyActions=[skip,...secondMoves];
const frozenInput=JSON.stringify(companyObservation);
assert.deepEqual(selectCompany(companyActions).map(a=>a.actionId),[skip.actionId,secondMoves[0].actionId]);
assert.deepEqual(selectCompany([...companyActions].reverse()).map(a=>a.actionId),[skip.actionId,secondMoves[0].actionId]);
assert.deepEqual(selectCompany([skip,secondMoves[1]]).map(a=>a.actionId),[skip.actionId,secondMoves[1].actionId]);
assert.deepEqual(selectCompany([skip]).map(a=>a.actionId),[skip.actionId]);
assert(selectCompany(companyActions).every(a=>a.routePlanId===`probe:${goal.requirementId}` && !a.targetEquivalentChoiceCount));
assert.equal(selectCompany(companyActions)[1].movementPreparation.rocketId,2);
assert.equal(JSON.stringify(companyObservation),frozenInput);
console.log("secondary company probe greedy contracts passed");
