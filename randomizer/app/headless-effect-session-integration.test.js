"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHeadlessEnv } = require("./headless-env");

function chooseFastAction(actions) {
  return actions.find((action) => action.family === "pass")
    || actions.find((action) => action.family === "end_turn")
    || actions[0]
    || null;
}

const source = fs.readFileSync(path.join(__dirname, "headless-env.js"), "utf8");
const stepSource = source.slice(source.indexOf("    step(action) {"), source.indexOf("    isTerminal() {"));
assert.match(stepSource, /effectSessionHost\.submit\(selector\)/, "step 必须只向 Effect Session 提交 Standard Action/Decision");
for (const forbidden of [
  "executeHeadlessTurnAction(selector",
  "executeHeadlessConditionalAction(selector",
  "runAiPendingStep",
  "recoverPendingAction",
  "skipHeadlessActionEffect",
]) {
  assert.equal(stepSource.includes(forbidden), false, `step 热路径不得引用 ${forbidden}`);
}

const seed = "effect-session-training-full-game-v1";
const env = createHeadlessEnv();
env.reset({ seed, activePlayerCount: 4 });
for (let stepIndex = 0; stepIndex < 200 && !env.isTerminal(); stepIndex += 1) {
  const action = chooseFastAction(env.legalActions());
  assert.ok(action, `第 ${stepIndex} 步必须存在 Standard Action/Decision`);
  const result = env.step(action);
  assert.equal(result.ok, true, result.error || `第 ${stepIndex} 步执行失败`);
  assert.ok(result.replayEvent.effectSessionJournal, "每个外部输入必须关联同一 Effect Session journal");
  assert.equal(
    result.replayEvent.effectSessionJournal.replay.every((entry) => entry.confirmed === true),
    true,
    "journal 只能暴露已确认 Action/Decision",
  );
}
assert.equal(env.isTerminal(), true, "固定 seed 完整对局必须终局");
const replay = env.getReplay();
assert.equal(replay.steps.length > 0, true);
assert.equal(replay.steps.every((step) => step.effectSessionJournal), true);

const replayEnv = createHeadlessEnv();
assert.deepEqual(replayEnv.loadReplay(replay), replay.finalStateSummary, "Effect Session action/decision trace 必须可重放");
assert.deepEqual(replayEnv.getReplay().steps, replay.steps, "重放后的 events/journal 必须一致");
replayEnv.dispose();
env.dispose();

const checkpointSource = createHeadlessEnv();
checkpointSource.reset({ seed: "effect-session-nonzero-fork", activePlayerCount: 4 });
const firstChoice = checkpointSource.legalActions()[0];
assert.equal(checkpointSource.step(firstChoice).ok, true);
const checkpoint = checkpointSource.createCheckpoint();
assert.ok(checkpoint.effectSessionCheckpoint, "非零 pending 边界必须保存 Effect Session checkpoint");
const checkpointObservation = checkpointSource.observe();
const checkpointActions = checkpointSource.legalActions();
checkpointSource.dispose();

const forks = [createHeadlessEnv(), createHeadlessEnv()];
const forkResults = forks.map((fork) => {
  assert.deepEqual(fork.loadCheckpoint(checkpoint), checkpointObservation);
  assert.deepEqual(fork.legalActions(), checkpointActions);
  const result = fork.step(checkpointActions[0]);
  assert.equal(result.ok, true, result.error);
  return {
    observation: result.observation,
    legalActions: result.legalActions,
    replay: fork.getReplay(),
    checkpoint: fork.createCheckpoint(),
  };
});
assert.deepEqual(forkResults[0], forkResults[1], "非零 checkpoint 两个 fork 的 state/legal/events/journal/RNG 必须一致");
forks.forEach((fork) => fork.dispose());

console.log("headless Effect Session integration tests passed");
