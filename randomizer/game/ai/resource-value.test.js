"use strict";

const assert = require("node:assert/strict");
const evaluator = require("./expected-score-evaluator");
const outcome = require("./outcome-model");
const port = require("./policy-port");
const policy = require("./heuristic-policy").createHeuristicPolicy();
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

const units = { score: 1, credits: 10, energy: 8, ordinaryCard: 6, publicity: 4,
  availableData: 6, movement: 5, alienCard: 12, additionalPublicScan: 0 };
for (const [resource, base] of Object.entries(units)) {
  for (let round = 1; round <= 4; round += 1) {
    close(evaluator.resourceUnitValue(resource, round, 4),
      base * (["credits", "energy"].includes(resource) ? 1 - (round - 1) / 6 : 1));
  }
  close(evaluator.resourceUnitValue(resource, 1, 1), base);
}
close(evaluator.resourceUnitValue("credits", -1), 10);
close(evaluator.resourceUnitValue("credits", 8), 5);
assert.throws(() => evaluator.resourceUnitValue("not-a-resource"), /未知估值资源/);
close(evaluator.incomeFutureValue({ credits: 1 }, 1), 20);
close(evaluator.incomeFutureValue({ energy: 1 }, 1), 16);
close(evaluator.incomeFutureValue({ credits: 1 }, 2), 35 / 3);
close(evaluator.incomeFutureValue({ energy: 1 }, 3), 4);
close(evaluator.incomeFutureValue({ credits: 99, energy: 99, handSize: 99 }, 4), 0);
close(evaluator.incomeFutureValue({ credits: 1 }, 1, 1), 0);
close(evaluator.incomeFutureValue({ publicity: 1, availableData: 1, handSize: 1 }, 1), 48);

const seatId = "resource-seat";
function observation(roundNumber, income = {}, hand = []) {
  return outcome.createDecisionObservation({
    publicState: { roundNumber, board: {}, players: [{ id: seatId,
      resources: { score: 0 }, income, techState: { ownedTiles: {} } }] },
    selfState: { id: seatId, hand },
  }, { seatId, stateVersion: 1, decisionVersion: 1 });
}
for (let round = 1; round <= 4; round += 1) {
  const root = observation(round);
  const income = { credits: 1, energy: 1, publicity: 1, handSize: 1, availableData: 1 };
  const leaf = observation(round, income);
  const expected = evaluator.incomeFutureValue(income, round);
  const facts = evaluator.evaluateStrategicFactsBreakdown(
    outcome.createStrategicFacts(root, seatId), outcome.createStrategicFacts(leaf, seatId),
  );
  close(facts.infrastructure.incomeValue, expected);
  close(evaluator.evaluateStateValue(leaf, seatId).components.incomeValue, expected * 1.4);
  const action = { actionId: "income", family: "place_data", target: {}, payload: {} };
  const result = evaluator.evaluateOutcome({ seatId, actionOutcomes: [{
    schemaVersion: outcome.OUTCOME_SCHEMA_VERSION,
    actionId: action.actionId, status: "settled", confidence: "high", rootObservation: root,
    leaves: [{ leafId: "income-leaf", observation: leaf, actionChain: [action.actionId] }],
  }] }, action);
  if (round < 4) close(result.incomeValue, expected);
  else assert.equal(result.selectable, false, "末轮纯增加收入轨没有未来价值");
}

// 插收入有立即领取，随后再按每个真实发放窗口计价。
for (const [round, expectedId] of [[1, "money"], [4, "card"]]) {
  const hand = [{ id: "money", incomeCode: 0 }, { id: "card", incomeCode: 2 }];
  const legalActions = hand.map((card) => ({
    schemaVersion: port.STANDARD_ACTION_SCHEMA_VERSION, actionId: card.id,
    family: "choose_payment", phase: "conditional", actorId: seatId,
    stateVersion: 1, decisionVersion: 1,
    target: { kind: "discard-hand-cards", cardInstanceId: card.id }, payload: {},
  }));
  const context = port.createDecisionContext({
    requestId: `income-r${round}`, seatId, stateVersion: 1, decisionVersion: 1,
    observation: observation(round, {}, hand), legalActions, actionOutcomes: [],
  });
  assert.equal(policy.decide(context).actionId, expectedId);
}
console.log("resource value tests passed");
