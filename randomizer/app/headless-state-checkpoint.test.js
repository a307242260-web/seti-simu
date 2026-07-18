"use strict";

const assert = require("node:assert/strict");
const { createHeadlessEnv } = require("./headless-env");

const source = createHeadlessEnv();
source.reset({ seed: "seti82-non-zero-checkpoint", activePlayerCount: 4 });
const action = source.legalActions()[0];
assert.ok(action, "非零 checkpoint 夹具必须存在 policy action");
const stepResult = source.step(action);
assert.equal(stepResult.ok, true, stepResult.error || "夹具必须跨过真实 policy action");
const checkpoint = source.createCheckpoint();
const observation = source.observe();
const legalActions = source.legalActions();
assert.equal(checkpoint.replayCursor.stepIndex > 0, true);
assert.equal(checkpoint.coreState.version, 2);
assert.equal(typeof checkpoint.coreState.committedState, "string");
assert.equal(Object.hasOwn(checkpoint.coreState, "state"), false, "checkpoint 不得长期双写旧 12 切片");
const randomState = checkpoint.runtimeState.randomState;
source.dispose();

const fork = createHeadlessEnv();
assert.deepEqual(fork.loadCheckpoint(structuredClone(checkpoint)), observation);
assert.deepEqual(fork.legalActions(), legalActions);
const restored = fork.createCheckpoint();
assert.equal(restored.replayCursor.stepIndex, checkpoint.replayCursor.stepIndex);
assert.equal(restored.runtimeState.randomState, randomState);
fork.dispose();

const invalidCheckpoint = structuredClone(checkpoint);
delete invalidCheckpoint.replaySteps;
invalidCheckpoint.coreState = { version: 999, committedState: "{}" };
const invalidFork = createHeadlessEnv();
assert.throws(
  () => invalidFork.loadCheckpoint(invalidCheckpoint),
  /checkpoint coreState 反序列化失败：RECOVERY_SNAPSHOT_VERSION_UNSUPPORTED/,
);
invalidFork.dispose();

console.log("headless committed-state checkpoint tests passed");
