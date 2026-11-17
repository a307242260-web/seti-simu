"use strict";
// Fresh current-policy game from the verified23-input opening. Historical
// frozen continuations keep their own source and checkpoint contracts.
const assert = require("node:assert/strict");
const first = require("./research-human405-round1");
const ID = "human405-white-current-full-v1";
const IDS = Object.freeze([ID]);
function describe(identity, options = {}) {
  if (identity.flags?.scenario !== ID) throw Error("RESEARCH_SCENARIO_UNKNOWN");
  if (!options.full) throw Error("WHITE_CURRENT_FULL_REQUIRES_FULL_MODE");
  const base = first.describe({ ...identity, flags: { ...identity.flags, scenario: first.FIRST_THREE_ROUNDS_ID } });
  return { ...base, id: ID, originalOpeningInputs: 23, stopAfterRound: null,
    autonomousScope: "rounds1-4", comparisonScope: "white-only-current-full-game",
    scoreSemantics: "terminal-score-with-passive-opponents", baselineEligible: false,
    decisionGate: { ...base.decisionGate, enforcement: "reject-before-input" }, gameMillisecondsTarget: 180000 };
}
function createEnvironment(options = {}, metadata = {}) { return first.createEnvironment(options, metadata); }
function initialize(env, config, metadata) {
  assert.equal(metadata.id, ID, "RESEARCH_SCENARIO_UNKNOWN");
  assert.equal(metadata.openingInputs, 23, "WHITE_CURRENT_FULL_OPENING_COUNT_DRIFT");
  return first.initialize(env, config, { ...metadata, id: first.FIRST_THREE_ROUNDS_ID });
}
function settled(observation) { return observation.terminal === true || observation.publicState.terminal === true; }
module.exports = { ID, IDS, describe, createEnvironment, initialize, settled };
