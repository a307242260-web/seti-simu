"use strict";

const assert = require("node:assert/strict");
const { buildDecision, createHeadlessEnv } = require("./headless-env");

function createApi(ownerState, currentPlayerId = "player-blue") {
  return {
    getTurnState: () => ({ gameEnded: false, currentPlayerId }),
    getHeadlessDecisionOwnerState: () => structuredClone(ownerState),
  };
}

function assertDecision(ownerState, expected, legalActorPlayerId = expected.actorPlayerId) {
  const decision = buildDecision(
    createApi(ownerState),
    [{
      actorPlayerId: legalActorPlayerId,
      decisionType: expected.decisionType || "conditional_choice",
    }],
  );
  assert.deepEqual(decision, {
    actorPlayerId: expected.actorPlayerId,
    pendingOwnerPlayerId: expected.pendingOwnerPlayerId || null,
    effectOwnerPlayerId: expected.effectOwnerPlayerId || null,
    currentPlayerId: expected.currentPlayerId,
    source: expected.source,
    decisionType: expected.decisionType || "conditional_choice",
    choiceCount: 1,
  });
}

assertDecision({
  actorPlayerId: "player-green",
  pendingOwnerPlayerId: "player-green",
  effectOwnerPlayerId: "player-brown",
  currentPlayerId: "player-blue",
  source: "pending_owner",
}, {
  actorPlayerId: "player-green",
  pendingOwnerPlayerId: "player-green",
  effectOwnerPlayerId: "player-brown",
  currentPlayerId: "player-blue",
  source: "pending_owner",
}, "player-blue");

assertDecision({
  actorPlayerId: "player-brown",
  pendingOwnerPlayerId: null,
  effectOwnerPlayerId: "player-brown",
  currentPlayerId: "player-blue",
  source: "effect_owner",
}, {
  actorPlayerId: "player-brown",
  effectOwnerPlayerId: "player-brown",
  currentPlayerId: "player-blue",
  source: "effect_owner",
});

assertDecision({
  actorPlayerId: "player-blue",
  pendingOwnerPlayerId: null,
  effectOwnerPlayerId: null,
  currentPlayerId: "player-blue",
  source: "current_player",
}, {
  actorPlayerId: "player-blue",
  currentPlayerId: "player-blue",
  source: "current_player",
  decisionType: "turn_action",
});

const ended = buildDecision({
  getTurnState: () => ({ gameEnded: true, currentPlayerId: "player-blue" }),
}, []);
assert.equal(ended, null);

const replaySource = createHeadlessEnv();
const replayConfig = { seed: "decision-owner-replay-parity", activePlayerCount: 4 };
const preObservation = replaySource.reset(replayConfig);
const chosenAction = replaySource.legalActions()[0];
const stepResult = replaySource.step(chosenAction);
assert.equal(stepResult.ok, true);
const replay = replaySource.getReplay();
replaySource.dispose();

const replayTarget = createHeadlessEnv();
const replayPreObservation = replayTarget.reset(replayConfig);
assert.deepEqual(
  replayPreObservation.decision,
  preObservation.decision,
  "replay 前 decision owner context 必须一致",
);
const replayPostObservation = replayTarget.loadReplay(replay);
assert.deepEqual(
  replayPostObservation.decision,
  stepResult.observation.decision,
  "replay 后 decision owner context 必须一致",
);
replayTarget.dispose();

console.log("headless decision owner tests passed");
