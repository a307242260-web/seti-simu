"use strict";

const assert = require("node:assert/strict");
const { createHeadlessEnv } = require("./headless-env");

function chooseFastTerminalAction(actions) {
  return actions.find((action) => action.kind === "pass")
    || actions.find((action) => action.kind === "end-turn")
    || actions[0]
    || null;
}

function playFastFourPlayerGame(seed) {
  const env = createHeadlessEnv();
  env.reset({ seed, activePlayerCount: 4 });
  for (let stepIndex = 0; stepIndex < 100 && !env.isTerminal(); stepIndex += 1) {
    const actions = env.legalActions();
    const action = chooseFastTerminalAction(actions);
    assert.ok(action, `第 ${stepIndex} 步应存在合法动作`);
    const result = env.step(action);
    assert.equal(result.ok, true, result.error || `第 ${stepIndex} 步执行失败`);
  }
  assert.equal(env.isTerminal(), true, "4 人局应在步数上限内到达 terminal");
  return env;
}

const seed = "headless-four-player-smoke-v1";
assert.equal(globalThis.document, undefined, "Node headless 启动前不应存在 document");
const sourceEnv = playFastFourPlayerGame(seed);
assert.equal(globalThis.document, undefined, "Node headless 运行时不应安装 fake document");
const replay = sourceEnv.getReplay();
assert.equal(replay.seed, seed);
assert.equal(replay.steps.length > 0, true);
assert.equal(replay.finalStateSummary.terminal, true);
assert.equal(
  replay.finalStateSummary.players.every((player) => Number.isFinite(player.finalScore)),
  true,
  "terminal observation 应包含现有终局结算生成的总分",
);

sourceEnv.dispose();
assert.equal(globalThis.document, undefined, "dispose 后不应残留 document");

const replayEnv = createHeadlessEnv();
const replayObservation = replayEnv.loadReplay(replay);
assert.equal(replayEnv.isTerminal(), true);
assert.deepEqual(replayObservation, replay.finalStateSummary);
assert.deepEqual(replayEnv.getReplay().steps, replay.steps);
replayEnv.dispose();
assert.equal(globalThis.document, undefined, "replay dispose 后不应残留 document");

const actorValidationEnv = createHeadlessEnv();
actorValidationEnv.reset({ seed: "headless-actor-validation", activePlayerCount: 4 });
const legalAction = actorValidationEnv.legalActions()[0];
assert.ok(legalAction);
const rejected = actorValidationEnv.step({
  ...legalAction,
  actorPlayerId: "not-the-current-player",
});
assert.equal(rejected.ok, false);
assert.match(rejected.error, /动作执行者不匹配/);
actorValidationEnv.dispose();

console.log("headless-env tests passed");
