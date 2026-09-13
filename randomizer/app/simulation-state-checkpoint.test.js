"use strict";

const assert = require("node:assert/strict");
const { createSimulationEnv } = require("./simulation-env");

{
  const original = createSimulationEnv();
  const restored = createSimulationEnv();
  try {
    original.reset({ seed: "report", activePlayerCount: 3 });
    const action = original.legalActions()[0];
    assert.equal(original.step(action).ok, true);
    const checkpoint = original.createCheckpoint();
    const state = JSON.parse(checkpoint.coreState.committedState);
    assert.equal(state.turn.activePlayerIds.length, 3);
    assert.ok(state.turn.activePlayerIds.includes(state.turn.currentPlayerId));
    restored.loadCheckpoint(checkpoint);
    assert.deepEqual(restored.legalActions(), original.legalActions());
    assert.deepEqual(restored.createCheckpoint(), checkpoint);
  } finally { original.dispose(); restored.dispose(); }
}

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
  "alienEntity", "card", "dataToken", "finalMark",
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
const forkNextCheckpoint = fork.createCheckpoint();
fork.dispose();

const sourceNext = createSimulationEnv();
sourceNext.loadCheckpoint(structuredClone(checkpoint));
const sourceNextAction = sourceNext.legalActions()[0];
assert.deepEqual(sourceNextAction, forkNextAction);
const sourceNextResult = sourceNext.step(sourceNextAction);
assert.equal(sourceNextResult.ok, true, sourceNextResult.error);
assert.deepEqual(sourceNextResult.observation, forkNextResult.observation);
assert.deepEqual(sourceNextResult.legalActions, forkNextResult.legalActions);
assert.deepEqual(sourceNextResult.reward, forkNextResult.reward);
assert.deepEqual(sourceNext.createCheckpoint(), forkNextCheckpoint);
sourceNext.dispose();

{
  const env = createSimulationEnv();
  const saved = structuredClone(checkpoint);
  delete saved.replaySteps;
  env.loadCheckpoint(saved);
  const reference = env.createCounterfactualFork().composition;
  const observed = env.createCounterfactualFork().composition;
  try {
    const held = observed.projection({ role: "simulation" });
    const heldValue = structuredClone(held);
    assert.equal(Object.isFrozen(held.state.meta), true);
    const advance = composition => {
      const decision = composition.inspect().session.decision;
      assert.ok(decision);
      const result = composition.inputPort.submitDecision({ decisionId: decision.decisionId,
        decisionVersion: decision.decisionVersion, ownerId: decision.ownerId,
        choice: decision.choices[0] }, { skipProjection: true });
      assert.equal(result.ok, true, JSON.stringify(result.failure));
    };
    advance(reference);
    advance(observed);
    assert.deepEqual(observed.lifecycle.save().envelope, reference.lifecycle.save().envelope,
      "完整观察不能冻结可变规则状态或改变正式执行结果");
    observed.projection({ role: "simulation" });
    assert.deepEqual(held, heldValue, "继续执行和复读不能改变先前完整快照");
  } finally { reference.dispose(); observed.dispose(); env.dispose(); }
}

const unknownSequenceCheckpoint = structuredClone(checkpoint);
const unknownCommittedState = JSON.parse(unknownSequenceCheckpoint.coreState.committedState);
unknownCommittedState.meta.sequences.unknownClosure = 1;
unknownSequenceCheckpoint.coreState.committedState = JSON.stringify(unknownCommittedState);
unknownSequenceCheckpoint.coreState.compositionEnvelope.committedState = unknownSequenceCheckpoint.coreState.committedState;
const unknownSequenceFork = createSimulationEnv();
assert.throws(
  () => unknownSequenceFork.loadCheckpoint(unknownSequenceCheckpoint),
  /唯一序列目录与 committed meta 不一致/,
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

// 世界配置属于权威检查点；不能因 replaySteps 存在而重新开局覆盖隐藏牌序。
{
  const env = createSimulationEnv();
  const saved = structuredClone(checkpoint);
  const state = JSON.parse(saved.coreState.committedState);
  state.cards.drawPileCardIds.reverse();
  for (const species of Object.values(state.aliens)) {
    if (species?.initialConfiguration?.cardDeck) species.initialConfiguration.cardDeck.reverse();
  }
  saved.coreState.committedState = JSON.stringify(state);
  saved.coreState.compositionEnvelope.committedState = saved.coreState.committedState;
  try {
    env.loadCheckpoint(saved);
    assert.deepEqual(JSON.parse(env.createCheckpoint().coreState.committedState),
      state, "恢复必须保留完整权威状态，包括剩余普通牌序及外星配置");
  } finally { env.dispose(); }
}

{
  const env = createSimulationEnv();
  env.loadCheckpoint(structuredClone(checkpoint));
  const before = env.createCheckpoint();
  const saved = structuredClone(checkpoint);
  const state = JSON.parse(saved.coreState.committedState);
  state.meta.worldVersion = "unknown-world-version";
  saved.coreState.committedState = JSON.stringify(state);
  saved.coreState.compositionEnvelope.committedState = saved.coreState.committedState;
  try {
    assert.throws(() => env.loadCheckpoint(saved), /WORLD_VERSION_UNSUPPORTED/);
    assert.deepEqual(env.createCheckpoint(), before, "拒绝不兼容世界前不得重置当前对局");
    const brokenSession = structuredClone(checkpoint);
    brokenSession.coreState.compositionEnvelope.session.session.workingState.meta.seed = "another-world";
    assert.throws(() => env.loadCheckpoint(brokenSession), /WORLD_SESSION_SEED_MISMATCH/);
    assert.deepEqual(env.createCheckpoint(), before, "拒绝跨世界工作快照前不得重置当前对局");
  } finally { env.dispose(); }
}

console.log("simulation committed-state checkpoint tests passed");
