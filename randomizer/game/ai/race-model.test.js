"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const raceModel = require("./race-model");

function loadAppNamedFunction(functionName) {
  const source = fs.readFileSync(path.join(__dirname, "..", "..", "app.js"), "utf8");
  const start = source.indexOf(`function ${functionName}(`);
  assert.ok(start >= 0, `app.js should define ${functionName}`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] !== "}") continue;
    depth -= 1;
    if (depth === 0) {
      const functionSource = source.slice(start, index + 1);
      return Function(`"use strict"; return (${functionSource});`)();
    }
  }
  assert.fail(`could not extract ${functionName} from app.js`);
}

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

{
  const actionWindow = raceModel.buildActionWindowOrder({
    turnOrderPlayerIds: ["green", "brown", "white", "blue"],
    activePlayerIds: ["green", "brown", "white", "blue"],
    startPlayerId: "green",
    passedPlayerIds: [],
    completedTurnPlayerIds: ["green", "brown"],
  }, "brown");
  assert.deepEqual(
    actionWindow,
    ["white", "blue", "green"],
    "B2 deferral should expose every opponent acting before Brown's next action",
  );

  const result = raceModel.estimateRaceOutcome({
    actorEta: 3,
    opponentEtas: [{
      playerId: "green",
      eta: 0.75,
      scoreDeficit: 1,
      actsBeforeActorNext: true,
    }],
    reusableValue: 0,
    exclusiveValue: 24,
    fallbackValue: 16,
  });
  assert.equal(result.outcome, "opponent_first");
  assert.equal(result.raceAdjustedValue, 16, "losing B2 slot 2 should retain slot-3 fallback value");
  assert.equal(result.exclusiveValueAtRisk, 8, "only the real 6x-to-4x B2 slot loss is at risk");
}

{
  const scoreB2RaceAdjustment = loadAppNamedFunction("scoreAiB2FinalTileRaceAdjustment");
  assert.equal(
    scoreB2RaceAdjustment("b2", 2, true, 16, 0, 8),
    8,
    "production B2 slot-2 wiring should cap a faster-opponent adjustment at 8 real points",
  );
  assert.equal(
    scoreB2RaceAdjustment("b2", 3, true, 16, 0, 8),
    0,
    "production B2 slot-3 wiring should not apply an exclusive-slot race adjustment",
  );
  assert.equal(
    scoreB2RaceAdjustment("d1", 2, true, 16, 0, 8),
    0,
    "production non-B2 final tiles should retain their existing scoring",
  );
  assert.equal(
    scoreB2RaceAdjustment("b2", 2, false, 16, 0, 8),
    0,
    "production B2 scoring should not adjust when the actor is expected to win the deferred race",
  );
}

assert.equal(require("./index").raceModel, raceModel, "AI aggregate should expose the shared race model");

console.log("race-model tests passed");
