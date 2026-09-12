"use strict";
const assert = require("node:assert/strict");
const evaluator = require("./expected-score-evaluator");
const model = require("./outcome-model");
const seat = "p1";
const goal = { requirementId: "rocket:1:land:jupiter:planet:", targetId: "land:jupiter:planet:",
  sourceId: "rocket:1", rocketId: 1, planetId: "jupiter", endpointFamily: "land",
  endpointTarget: { type: "planet" }, nextStep: { family: "land", rocketId: 1, planetId: "jupiter" },
  required: { credits: 0, energy: 2, movementSteps: 0, movementPoints: 0 },
  gap: { credits: 0, energy: 2 }, targetBenefit: { score: 12, grossEquivalentValue: 12 } };
const hand = [0, 1, 2, 3].map(i => ({ id: `card-${i}`, cardId: `test-${i}`, set: "basic" }));
const observation = { ...model.createDecisionObservation({ perspectivePlayerId: seat,
  publicState: { roundNumber: 4, players: [{ playerId: seat, credits: 2, energy: 0,
    resources: { credits: 2, energy: 0 }, income: {}, techState: { ownedTiles: {} } }], board: {} },
  selfState: { playerId: seat, hand, reservedCards: [] },
}, { seatId: seat }), probeRouteRequirements: { candidates: [goal] } };
const trade = (id, cost) => ({ actionId: `quick_trade:${id}`, family: "quick_trade", phase: "quick",
  actorId: seat, target: { tradeId: id }, payload: { cost, gain: { energy: 1 } } });
const cash = trade("credits-for-energy", { credits: 2 });
const cards = trade("cards-for-energy", { handSize: 2 });
const legal = [cash, cards];
const select = (actions, state = observation) => evaluator.selectSecondaryAgentSuccessors({ focalSeatId: seat,
  branchObservation: state, legalSuccessors: actions,
  routeTargetId: goal.targetId, routePlanId: `probe:${goal.requirementId}` });
const before = JSON.stringify({ observation, legal });
assert.deepEqual(select(legal).map(a => a.actionId), [cash.actionId]);
assert.deepEqual(select([...legal].reverse()).map(a => a.actionId), [cash.actionId]);
assert.deepEqual(select([cards]).map(a => a.actionId), [cards.actionId], "首选不合法仍有替代");
const roots = evaluator.enumerateSecondaryAgentRootTargets({ focalSeatId: seat,
  rootObservation: observation, legalActions: legal });
assert.deepEqual(roots.find(r => r.targetId === goal.targetId)?.compatibleActionIds, [cash.actionId]);
assert(select(legal).every(a => !a.targetEquivalentChoiceCount));
assert.equal(JSON.stringify({ observation, legal }), before);
const afterCash = structuredClone(observation);
Object.assign(afterCash.outcomeProjection.assets, { credits: 0, energy: 1 });
assert.deepEqual(select([cards], afterCash).map(a => a.actionId), [cards.actionId], "第二步继续补齐能量");
const ready = structuredClone(afterCash);
Object.assign(ready.outcomeProjection.assets, { energy: 2, ordinaryCards: 2 });
ready.selfState.hand = ready.selfState.hand.slice(2);
assert.deepEqual(select([cards], ready), [], "已满足目标资源不再交易");
console.log("probe resource greedy tests passed");
