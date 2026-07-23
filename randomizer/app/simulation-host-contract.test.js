"use strict";

const assert = require("node:assert/strict");
const { createSimulationEnv } = require("./simulation-env");
const {
  ACTION_SCHEMA_VERSION,
  OBSERVATION_SCHEMA_VERSION,
} = require("./simulation-contract");

function assertZeroReward(reward) {
  assert.equal(reward.immediateScoreDelta, 0);
  assert.equal(reward.terminalScoreDelta, 0);
  assert.deepEqual(reward.resourceDelta, {
    credits: 0,
    energy: 0,
    publicity: 0,
    availableData: 0,
    additionalPublicScan: 0,
    handCount: 0,
  });
}

const env = createSimulationEnv();
const initial = env.reset({
  seed: "simulation-host-contract",
  activePlayerCount: 4,
  episodeId: "contract-episode",
});
assert.equal(initial.schemaVersion, OBSERVATION_SCHEMA_VERSION);
assert.equal(initial.terminal, false);
assert.ok(initial.decision?.actorPlayerId);
assert.equal(initial.publicState.currentPlayerId, initial.decision.currentPlayerId);

const legal = env.legalActions();
assert.ok(legal.length > 0, "reset 后必须暴露当前策略边界的 legal set");
for (const [maskIndex, action] of legal.entries()) {
  assert.equal(action.schemaVersion, ACTION_SCHEMA_VERSION);
  assert.equal(action.actorPlayerId, initial.decision.actorPlayerId);
  assert.equal(action.maskIndex, maskIndex);
  assert.equal(Number.isSafeInteger(action.stateVersion), true);
  assert.equal(Number.isSafeInteger(action.decisionVersion), true);
}
assert.deepEqual(
  env.legalActions("not-current-owner"),
  [],
  "非 decision owner 不得取得可提交 legal action",
);

const authorityBeforeInvalid = env.createCheckpoint().coreState.committedState;
const replayBeforeInvalid = env.getReplay().steps.length;
const current = legal[0];
for (const [submitted, code] of [
  [{ ...current, actionId: "unknown-action" }, "SIMULATION_ACTION_NOT_LEGAL"],
  [{ ...current, schemaVersion: "seti-rl-action-v0" }, "SIMULATION_ACTION_SCHEMA_MISMATCH"],
  [{ ...current, actorPlayerId: "other-player" }, "SIMULATION_ACTION_ACTOR_MISMATCH"],
  [{ ...current, stateVersion: current.stateVersion + 1 }, "SIMULATION_ACTION_STALE"],
  [{ ...current, target: { tampered: true } }, "SIMULATION_ACTION_DESCRIPTOR_MISMATCH"],
]) {
  const rejected = env.step(submitted);
  assert.equal(rejected.ok, false, `${code} 必须 fail-closed`);
  assert.equal(rejected.failure?.code, code);
  assert.equal(rejected.replayEvent, null);
  assert.equal(rejected.terminated, false);
  assert.equal(rejected.truncated, false);
  assertZeroReward(rejected.reward);
  assert.equal(env.createCheckpoint().coreState.committedState, authorityBeforeInvalid);
  assert.equal(env.getReplay().steps.length, replayBeforeInvalid);
}

const accepted = env.step(current);
assert.equal(accepted.ok, true, accepted.error);
assert.equal(accepted.actionId, current.actionId);
assert.equal(accepted.actorPlayerId, current.actorPlayerId);
assert.equal(accepted.done, accepted.observation.terminal);
assert.equal(accepted.terminated, accepted.observation.terminal);
assert.equal(accepted.truncated, false);
assert.equal(accepted.replayEvent.stepIndex, replayBeforeInvalid);
assert.equal(env.getReplay().steps.length, replayBeforeInvalid + 1);
for (const value of [
  accepted.reward.immediateScoreDelta,
  accepted.reward.terminalScoreDelta,
  ...Object.values(accepted.reward.resourceDelta),
]) assert.equal(Number.isFinite(value), true, "reward delta 必须是有限数值");

assert.throws(
  () => env.loadReplay({ schemaVersion: "seti-rl-replay-v0" }),
  /不支持的 replay schema/,
);
assert.throws(
  () => env.loadCheckpoint({ schemaVersion: "seti-rl-checkpoint-v0" }),
  /不支持的 checkpoint schema/,
);
env.dispose();

const terminalFixtureSource = createSimulationEnv();
terminalFixtureSource.reset({ seed: "simulation-host-terminal", activePlayerCount: 4 });
const terminalCheckpoint = structuredClone(terminalFixtureSource.createCheckpoint());
const lastAction = terminalFixtureSource.legalActions()[0];
terminalFixtureSource.dispose();
delete terminalCheckpoint.replaySteps;
const terminalCommitted = JSON.parse(terminalCheckpoint.coreState.committedState);
terminalCommitted.turn.gameEnded = true;
terminalCommitted.turn.gameEndReason = "simulation-host-contract";
terminalCheckpoint.coreState.committedState = JSON.stringify(terminalCommitted);
terminalCheckpoint.coreState.compositionEnvelope.committedState = terminalCheckpoint.coreState.committedState;
terminalCheckpoint.coreState.compositionEnvelope.session = null;

const terminalEnv = createSimulationEnv();
terminalEnv.loadCheckpoint(terminalCheckpoint);
assert.equal(terminalEnv.isTerminal(), true);
assert.equal(terminalEnv.observe().terminal, true);
assert.equal(terminalEnv.observe().decision, null);
assert.deepEqual(terminalEnv.legalActions(), []);
const terminalReplayLength = terminalEnv.getReplay().steps.length;
const terminalRejected = terminalEnv.step(lastAction);
assert.equal(terminalRejected.ok, false);
assert.equal(terminalRejected.failure?.code, "SIMULATION_TERMINAL");
assert.equal(terminalRejected.terminated, true);
assert.equal(terminalRejected.truncated, false);
assert.equal(terminalEnv.getReplay().steps.length, terminalReplayLength);

terminalEnv.dispose();
terminalEnv.dispose();
for (const operation of [
  () => terminalEnv.observe(),
  () => terminalEnv.legalActions(),
  () => terminalEnv.step(lastAction),
  () => terminalEnv.createCheckpoint(),
  () => terminalEnv.getReplay(),
  () => terminalEnv.reset({ seed: "after-dispose" }),
]) {
  assert.throws(operation, (error) => error.code === "SIMULATION_ENV_DISPOSED");
}

console.log("simulation host public contract tests passed");
