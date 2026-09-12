"use strict";
const assert = require("node:assert/strict"), evaluator = require("./expected-score-evaluator");
const model = require("./outcome-model");
const seat = "p1";
const observation = model.createDecisionObservation({ perspectivePlayerId: seat,
  publicState: { roundNumber: 4, players: [{ playerId: seat, credits: 2, energy: 0,
    income: {}, techState: { ownedTiles: {} } }], board: {} },
  selfState: { playerId: seat, hand: [0, 1, 2, 3].map(i => ({ id: `card-${i}`, cardId: `test-${i}`, set: "basic" })), reservedCards: [] },
}, { seatId: seat });
const trade = (id, cost) => ({ actionId: `quick_trade:${id}`, family: "quick_trade", phase: "quick",
  actorId: seat, target: { tradeId: id }, payload: { cost, gain: { energy: 1 } } });
const cash = trade("credits-for-energy", { credits: 2 }), cards = trade("cards-for-energy", { handSize: 2 });
const legal = [cash, cards];
function state(nextStep) {
  const own = structuredClone(observation);
  own.dataAnalyzeRequirements = { computerPlacedCount: 5, availableData: 1, nextStep,
    nextCost: { energy: 2 }, acquisitionPlans: nextStep === "acquire_data"
      ? [{ kind: "scan", planId: "data:scan", nextCost: { energy: 2 }, resultTargetIds: ["data:analyze"] }] : [] };
  return own;
}
function select(own, actions = legal, plan = "data:analyze") {
  return evaluator.selectSecondaryAgentSuccessors({ focalSeatId: seat, branchObservation: own,
    legalSuccessors: actions, routeTargetId: "data:analyze", routePlanId: plan });
}
for (const nextStep of ["place_data", "analyze", "acquire_data"]) {
  const own = state(nextStep), before = JSON.stringify({ own, legal });
  assert.deepEqual(select(own).map(a => a.actionId), [cash.actionId], nextStep);
  assert.deepEqual(select(own, [...legal].reverse()).map(a => a.actionId), [cash.actionId]);
  assert.deepEqual(select(own, [cards]).map(a => a.actionId), [cards.actionId]);
  const roots = evaluator.enumerateSecondaryAgentRootTargets({ focalSeatId: seat,
    rootObservation: own, legalActions: legal }).filter(r => r.targetId === "data:analyze");
  assert(roots.length);
  assert(roots.every(r => JSON.stringify(r.compatibleActionIds) === JSON.stringify([cash.actionId])));
  assert(select(own).every(a => !a.targetEquivalentChoiceCount));
  assert.equal(JSON.stringify({ own, legal }), before);
  Object.assign(own.outcomeProjection.assets, { energy: 2 });
  assert.deepEqual(select(own), [], "资源已满足时不额外交易");
}
const own = state("acquire_data");
const play = { actionId: "play:data", actorId: seat, family: "play_card", phase: "main", target: { cardInstanceId: "card-0" } };
const corner = { actionId: "corner:data", actorId: seat, family: "card_corner", phase: "quick", target: { cardInstanceId: "card-1" }, payload: { kind: "resource", multiplier: 1 } };
own.dataAnalyzeRequirements.acquisitionPlans.push({ kind: "card", planId: "data:card:card-0", cardInstanceId: "card-0" },
  { kind: "card_corner", planId: "data:corner:card-1", cardInstanceId: "card-1" });
assert.deepEqual(select(own, [...legal, play, corner]).map(a => a.actionId).sort(), [cash.actionId, play.actionId, corner.actionId].sort());
assert.deepEqual(select(own, [...legal, play, corner], "data:card:card-0").map(a => a.actionId), [play.actionId]);
console.log("data resource greedy contracts passed");
