"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const evaluator = require("./expected-score-evaluator");

assert.deepEqual(evaluator.DEFAULT_PARAMETERS.resourceValues, {
  credits: 5,
  energy: 5,
  availableData: 2.5,
  publicity: 2.5,
  ordinaryCard: 2.5,
  alienCard: 10 / 3,
});
assert.ok(Object.isFrozen(evaluator.DEFAULT_PARAMETERS));

const observation = {
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
const state = evaluator.evaluateState(observation, "blue");
assert.equal(state.realized, 10);
assert.ok(Math.abs(state.leftoverSalvage - 25.5) < 1e-9);
assert.ok(Math.abs(state.value - 35.5) < 1e-9);

const portfolio = evaluator.selectBestPlanPortfolio([
  { id: "route-a", consumes: { credits: 1 }, terminalGain: 8, exclusiveKeys: ["rocket-1"] },
  { id: "route-b", consumes: { credits: 1 }, terminalGain: 7, exclusiveKeys: ["rocket-1"] },
  { id: "data", consumes: { energy: 1 }, terminalGain: 6 },
], { credits: 2, energy: 1 });
assert.deepEqual(portfolio.selectedPlans.map((plan) => plan.id), ["route-a", "data"]);
assert.equal(portfolio.score, 14);
assert.equal(portfolio.consumed.credits, 1);

function action(family, overrides = {}) {
  return {
    family,
    phase: overrides.phase || "main",
    actionId: `${family}:fixture`,
    target: overrides.target || {},
    payload: overrides.payload || {},
  };
}
const context = { seatId: "blue", observation };
const trade = evaluator.evaluateAction(context, action("quick_trade", {
  phase: "quick",
  payload: { cost: { energy: 2 }, gain: { credits: 1 } },
}));
assert.equal(trade.score, -5);

const scan = evaluator.evaluateAction(context, action("scan"));
assert.ok(Math.abs(scan.score - 2.25) < 1e-9);
assert.equal(scan.parameterVersion, evaluator.PARAMETER_VERSION);
assert.equal(scan.evaluationModel, evaluator.EVALUATION_MODEL);
assert.equal(scan.selectedPlans[0].kind, "data");

const blueData = evaluator.evaluateAction(context, action("place_data", {
  phase: "quick",
  target: { blueSlot: 2 },
}));
assert.equal(blueData.realizedDelta, 2);
assert.equal(blueData.score, 2);

const land = evaluator.evaluateAction({
  ...context,
  observation: {
    ...observation,
    publicState: {
      ...observation.publicState,
      board: { planets: { planets: { mars: { landings: 0 } } } },
    },
  },
}, action("land", { target: { planetId: "mars" } }));
assert.equal(land.realizedDelta, 6);
assert.ok(land.score > scan.score);

const source = fs.readFileSync(path.resolve(__dirname, "expected-score-evaluator.js"), "utf8");
for (const forbidden of ["action" + "Graph", "candidate." + "score", "document.", "localStorage"]) {
  assert.equal(source.includes(forbidden), false, `新估值器不得读取 ${forbidden}`);
}

console.log("expected-score-evaluator.test.js ok");
