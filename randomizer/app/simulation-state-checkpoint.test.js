"use strict";

const assert = require("node:assert/strict");
const { createSimulationEnv } = require("./simulation-env");

const source = createSimulationEnv();
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
const committedState = JSON.parse(checkpoint.coreState.committedState);
const randomState = committedState.meta.rngState;
assert.equal(randomState.algorithm, "seti-simulation-mulberry32-v1");
assert.equal(Number.isSafeInteger(randomState.state), true);
assert.equal(Object.hasOwn(checkpoint, "runtimeState"), false, "RNG 必须由 committed meta 唯一持有");
assert.deepEqual(Object.keys(committedState.meta.sequences).sort(), [
  "actionLog", "card", "dataToken", "finalMark", "handCard", "historyStep",
  "nebulaReplacement", "nebulaToken", "rocket",
]);
source.dispose();

const fork = createSimulationEnv();
assert.deepEqual(fork.loadCheckpoint(structuredClone(checkpoint)), observation);
assert.deepEqual(fork.legalActions(), legalActions);
const restored = fork.createCheckpoint();
assert.equal(restored.replayCursor.stepIndex, checkpoint.replayCursor.stepIndex);
assert.deepEqual(JSON.parse(restored.coreState.committedState).meta.rngState, randomState);

const forkNextAction = fork.legalActions()[0];
const forkNextResult = fork.step(forkNextAction);
assert.equal(forkNextResult.ok, true, forkNextResult.error);
const forkContinuationCheckpoint = fork.createCheckpoint();
fork.dispose();

const sourceContinuation = createSimulationEnv();
sourceContinuation.loadCheckpoint(structuredClone(checkpoint));
const sourceNextAction = sourceContinuation.legalActions()[0];
assert.deepEqual(sourceNextAction, forkNextAction);
const sourceNextResult = sourceContinuation.step(sourceNextAction);
assert.equal(sourceNextResult.ok, true, sourceNextResult.error);
assert.deepEqual(sourceNextResult.observation, forkNextResult.observation);
assert.deepEqual(sourceNextResult.legalActions, forkNextResult.legalActions);
assert.deepEqual(sourceNextResult.reward, forkNextResult.reward);
assert.deepEqual(sourceContinuation.createCheckpoint(), forkContinuationCheckpoint);
sourceContinuation.dispose();

const unknownSequenceCheckpoint = structuredClone(checkpoint);
const unknownCommittedState = JSON.parse(unknownSequenceCheckpoint.coreState.committedState);
unknownCommittedState.meta.sequences.unknownClosure = 1;
unknownSequenceCheckpoint.coreState.committedState = JSON.stringify(unknownCommittedState);
const unknownSequenceFork = createSimulationEnv();
assert.throws(
  () => unknownSequenceFork.loadCheckpoint(unknownSequenceCheckpoint),
  /唯一序列与 committed meta 不一致/,
  "未注册闭包状态必须 fail-closed",
);
unknownSequenceFork.dispose();

const invalidCheckpoint = structuredClone(checkpoint);
delete invalidCheckpoint.replaySteps;
invalidCheckpoint.coreState = { version: 999, committedState: "{}" };
const invalidFork = createSimulationEnv();
assert.throws(
  () => invalidFork.loadCheckpoint(invalidCheckpoint),
  /checkpoint coreState 反序列化失败：RECOVERY_SNAPSHOT_VERSION_UNSUPPORTED/,
);
invalidFork.dispose();

console.log("simulation committed-state checkpoint tests passed");
