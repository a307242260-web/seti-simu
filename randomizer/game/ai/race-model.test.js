"use strict";

const assert = require("node:assert/strict");
const raceModel = require("./race-model");

{
  const order = raceModel.buildActionWindowOrder({
    turnOrderPlayerIds: ["white", "blue", "yellow", "red"],
    activePlayerIds: ["white", "blue", "yellow", "red"],
    startPlayerId: "yellow",
    passedPlayerIds: [],
    completedTurnPlayerIds: [],
  }, "white");
  assert.deepEqual(order, ["yellow", "red"], "round order should rotate from the start player");
}

{
  const order = raceModel.buildActionWindowOrder({
    turnOrderPlayerIds: ["white", "blue", "yellow", "red"],
    activePlayerIds: ["white", "blue", "yellow", "red"],
    startPlayerId: "yellow",
    passedPlayerIds: ["red"],
    completedTurnPlayerIds: ["yellow"],
  }, "white");
  assert.deepEqual(order, [], "passed and already-completed players should not act before the actor this cycle");
}

{
  const order = raceModel.buildActionWindowOrder({
    turnOrderPlayerIds: ["white", "blue", "yellow", "red"],
    activePlayerIds: ["white", "blue", "yellow", "red"],
    startPlayerId: "yellow",
    passedPlayerIds: [],
    completedTurnPlayerIds: ["yellow", "red", "white"],
  }, "white");
  assert.deepEqual(
    order,
    ["blue", "yellow", "red"],
    "a completed actor should see the rest of this cycle and the next-cycle players before its next action",
  );
}

{
  const result = raceModel.estimateRaceOutcome({
    actorEta: 2,
    opponentEtas: [{ playerId: "blue", eta: 2 }],
    reusableValue: 7,
    exclusiveValue: 12,
    fallbackValue: 4,
  });
  assert.equal(result.outcome, "opponent_tie_break");
  assert.equal(result.actorWins, false, "an ETA tie should be awarded to the opponent");
  assert.equal(result.raceAdjustedValue, 11);
  assert.equal(result.exclusiveValueAtRisk, 8);
}

{
  const result = raceModel.estimateRaceOutcome({
    actorEta: 3,
    opponentEtas: [
      { playerId: "blue", eta: 1 },
      { playerId: "red", eta: 4 },
    ],
    reusableValue: 5,
    exclusiveValue: 10,
    fallbackValue: 3,
  });
  assert.equal(result.outcome, "opponent_first");
  assert.deepEqual(result.fastestOpponentIds, ["blue"]);
  assert.equal(result.raceAdjustedValue, 8, "losing a race should retain reusable and fallback value");
}

{
  const result = raceModel.estimateRaceOutcome({
    actorEta: 1,
    opponentEtas: [{ playerId: "blue", eta: 2 }],
    reusableValue: 5,
    exclusiveValue: 10,
    fallbackValue: 3,
  });
  assert.equal(result.outcome, "actor_first");
  assert.equal(result.actorWins, true);
  assert.equal(result.raceAdjustedValue, 15);
}

assert.equal(require("./index").raceModel, raceModel, "AI aggregate should expose the shared race model");

console.log("race-model tests passed");
