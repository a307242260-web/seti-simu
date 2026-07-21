"use strict";

const assert = require("node:assert/strict");
const evaluator = require("./heuristic-evaluator");
const expectedEvaluator = require("./expected-score-evaluator");

const context = Object.freeze({
  seatId: "blue",
  observation: {
    publicState: {
      roundNumber: 3,
      players: [{ playerId: "blue", credits: 4, energy: 2, publicity: 5, availableData: 1 }],
      board: {
        publicCards: [{ id: "public-1", cardId: "card-public", price: 3 }],
        techSupply: {
          stacks: {
            orange2: {
              tileId: "orange2",
              techType: "orange",
              stackIndex: 2,
              bonusId: "bonus_1c",
              firstTakeClaimedBy: null,
            },
          },
        },
      },
    },
    selfState: {
      hand: [{ id: "hand-1", cardId: "card-hand", price: 2 }],
    },
  },
});

assert.deepEqual(evaluator.evaluateAction(context, {
  family: "play_card",
  payload: { handIndex: 0 },
}), {
  score: 0,
  cardId: "card-hand",
  price: 2,
  roundNumber: 3,
  resources: { credits: 4, energy: 2, publicity: 5, availableData: 1 },
});

assert.deepEqual(evaluator.evaluateAction(context, {
  family: "research_tech",
  target: { tileId: "orange2" },
}), {
  score: 0,
  tileId: "orange2",
  techType: "orange",
  stackIndex: 2,
  bonusId: "bonus_1c",
  firstTake: true,
  roundNumber: 3,
  resources: { credits: 4, energy: 2, publicity: 5, availableData: 1 },
});

assert.equal(JSON.stringify(context).includes("score"), false, "估值结果不得回写 DecisionContext");

const scoreObservation = {
  publicState: {
    roundNumber: 1,
    players: [{
      playerId: "blue",
      score: 10,
      credits: 1,
      energy: 1,
      availableData: 2,
      publicity: 2,
      handCount: 2,
    }],
  },
  selfState: { playerId: "blue", privateAlienCards: [{ id: "alien-1" }] },
};
const evaluatedState = expectedEvaluator.evaluateState(scoreObservation, "blue");
assert.equal(evaluatedState.realized, 10);
assert.ok(Math.abs(evaluatedState.leftoverSalvage - 25.5) < 1e-9);

const portfolio = expectedEvaluator.selectBestPlanPortfolio([
  { id: "route-a", consumes: { credits: 1 }, terminalGain: 8, exclusiveKeys: ["rocket-1"] },
  { id: "route-b", consumes: { credits: 1 }, terminalGain: 7, exclusiveKeys: ["rocket-1"] },
  { id: "data", consumes: { energy: 1 }, terminalGain: 6 },
], { credits: 2, energy: 1 });
assert.deepEqual(portfolio.selectedPlans.map((plan) => plan.id), ["route-a", "data"]);
assert.equal(portfolio.score, 14);

const scanEvaluation = expectedEvaluator.evaluateAction(
  { seatId: "blue", observation: scoreObservation },
  { family: "scan", phase: "main", actionId: "scan:fixture", target: {}, payload: {} },
);
assert.ok(Math.abs(scanEvaluation.score - 2.25) < 1e-9);
assert.equal(scanEvaluation.evaluationModel, expectedEvaluator.EVALUATION_MODEL);

console.log("heuristic-evaluator.test.js ok");
