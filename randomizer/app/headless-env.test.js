"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createHeadlessEnv } = require("./headless-env");
const { TURN_ACTION_FAMILIES, CONDITIONAL_FAMILIES } = require("./headless-contract");

const headlessEnvSource = fs.readFileSync(__filename.replace(/\.test\.js$/, ".js"), "utf8");
assert.equal(headlessEnvSource.includes("buildAiTurnActionCandidates"), false, "legalActions 热路径不得构建 heuristic candidates");
assert.equal(headlessEnvSource.includes("runAiSelectedTurnAction"), false, "step 热路径不得二次构建 selector candidates");
assert.equal(headlessEnvSource.includes("runAiPendingStep"), false, "effect drain 热路径不得回退浏览器 pending resolver");
assert.equal(headlessEnvSource.includes("runHeadlessActionEffectStep"), false, "effect drain 热路径不得调用 heuristic AI effect resolver");

function chooseFastTerminalAction(actions) {
  return actions.find((action) => action.family === "pass")
    || actions.find((action) => action.family === "end_turn")
    || actions[0]
    || null;
}

function playFastFourPlayerGame(seed) {
  const env = createHeadlessEnv();
  env.reset({ seed, activePlayerCount: 4 });
  for (let stepIndex = 0; stepIndex < 100 && !env.isTerminal(); stepIndex += 1) {
    const action = chooseFastTerminalAction(env.legalActions());
    assert.ok(action, `第 ${stepIndex} 步应存在合法动作`);
    const result = env.step(action);
    assert.equal(result.ok, true, result.error || `第 ${stepIndex} 步执行失败`);
  }
  assert.equal(env.isTerminal(), true, "4 人局应在步数上限内到达 terminal");
  return env;
}

function collectKeys(value, output = []) {
  if (!value || typeof value !== "object") return output;
  for (const [key, item] of Object.entries(value)) {
    output.push(key);
    collectKeys(item, output);
  }
  return output;
}

const seed = "headless-four-player-smoke-v2";
assert.equal(globalThis.document, undefined, "Node headless 启动前不应存在 document");
const sourceEnv = playFastFourPlayerGame(seed);
assert.equal(globalThis.document, undefined, "Node headless 运行时不应安装 fake document");
const replay = sourceEnv.getReplay();
assert.equal(replay.seed, seed);
assert.equal(replay.steps.length > 0, true);
assert.equal(replay.finalStateSummary.terminal, true);
assert.equal(
  replay.finalStateSummary.publicState.players.every((player) => Number.isFinite(player.finalScore)),
  true,
  "terminal observation 应包含现有终局结算生成的总分",
);
assert.equal(Array.isArray(replay.environmentEvents), true);
assert.equal(replay.steps.every((step) => Array.isArray(step.environmentEvents)), true);

sourceEnv.dispose();
assert.equal(globalThis.document, undefined, "dispose 后不应残留 document");

const replayEnv = createHeadlessEnv();
const replayObservation = replayEnv.loadReplay(replay);
assert.equal(replayEnv.isTerminal(), true);
assert.deepEqual(replayObservation, replay.finalStateSummary);
assert.deepEqual(replayEnv.getReplay().steps, replay.steps);
replayEnv.dispose();

const observationEnv = createHeadlessEnv();
const opening = observationEnv.reset({ seed: "headless-observation-v2", activePlayerCount: 4 });
const actorId = opening.decision.actorPlayerId;
const opponentId = opening.publicState.activePlayerIds.find((playerId) => playerId !== actorId);
const actorObservation = observationEnv.observe(actorId);
const opponentObservation = observationEnv.observe(opponentId);
assert.equal(actorObservation.perspectivePlayerId, actorId);
assert.equal(opponentObservation.perspectivePlayerId, opponentId);
assert.ok(actorObservation.selfState.hand.length > 0);
assert.ok(opponentObservation.selfState.hand.length > 0);
assert.equal("hand" in actorObservation.publicState.players[0], false, "公开玩家摘要不得泄漏手牌内容");
assert.deepEqual(observationEnv.legalActions(opponentId), [], "非 decision owner 不得看到可执行动作");
const forbiddenKeys = new Set(["score", "actionGraph", "net", "plannerShadow", "drawPileCardIds", "recoverySnapshot", "ui", "overlay", "dataset"]);
const actionKeys = collectKeys(observationEnv.legalActions());
assert.equal(actionKeys.some((key) => forbiddenKeys.has(key)), false, "legal candidate 不得包含 AI/UI 诊断字段");
const stableActions = observationEnv.legalActions();
assert.equal(new Set(stableActions.map((action) => action.actionId)).size, stableActions.length, "legal actionId 必须唯一");
assert.deepEqual(observationEnv.legalActions(), stableActions, "同一决策点的 actionId/maskIndex 必须稳定");
const observationKeys = collectKeys(actorObservation);
assert.equal(observationKeys.some((key) => ["actionGraph", "net", "plannerShadow", "drawPileCardIds", "recoverySnapshot", "ui", "overlay", "dataset"].includes(key)), false);
const legalAction = observationEnv.legalActions()[0];
assert.equal(legalAction.schemaVersion, "seti-rl-action-v2");
assert.ok([...TURN_ACTION_FAMILIES, ...CONDITIONAL_FAMILIES].includes(legalAction.family));
assert.equal(actorObservation.decision.decisionType, legalAction.decisionType);
assert.equal(CONDITIONAL_FAMILIES.some((family) => family.startsWith("pending")), false);

const wrongActor = observationEnv.step({ ...legalAction, actorPlayerId: "not-the-current-player" });
assert.equal(wrongActor.ok, false);
assert.match(wrongActor.error, /动作执行者不匹配/);
const illegal = observationEnv.step({ ...legalAction, actionId: "not-legal" });
assert.equal(illegal.ok, false);
assert.match(illegal.error, /不在当前 legalActions/);
const stale = observationEnv.step({ ...legalAction, stateVersion: legalAction.stateVersion - 1 });
assert.equal(stale.ok, false);
assert.match(stale.error, /动作版本已失效/);

const checkpoint = observationEnv.createCheckpoint();
const checkpointObservation = observationEnv.observe();
const checkpointActions = observationEnv.legalActions();
observationEnv.dispose();
const restoredEnv = createHeadlessEnv();
assert.deepEqual(restoredEnv.loadCheckpoint(checkpoint), checkpointObservation);
assert.deepEqual(restoredEnv.legalActions(), checkpointActions);
restoredEnv.dispose();
assert.equal(globalThis.document, undefined, "checkpoint dispose 后不应残留 document");

console.log("headless-env tests passed");
