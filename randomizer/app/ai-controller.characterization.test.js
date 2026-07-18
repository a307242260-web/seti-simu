"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { createAiControllerHarness } = require("./ai-controller-test-harness");

const controllerPath = path.resolve(__dirname, "ai-controller.js");
delete globalThis.SetiAppAiController;
delete require.cache[controllerPath];
const nodeEntry = require(controllerPath);

assert.equal(typeof nodeEntry.createAiController, "function");
assert.equal(
  globalThis.SetiAppAiController,
  nodeEntry,
  "传统 script 全局入口与 CommonJS 入口必须指向同一个模块对象",
);

const expectedControllerApi = [
  "configureAiAutoBattle",
  "configureDefaultAiOpponent",
  "createAiControlSnapshot",
  "getAiAutoBattleAnalysis",
  "getAiAutoBattleProgress",
  "getAiAutoBattleReport",
  "getAiStrategyWeights",
  "isAiAutomationPaused",
  "isAiAutoBattlePlayer",
  "restoreAiControlSnapshot",
  "runAiAutoBattle",
  "runAiAutoBattleBatch",
  "runAiAutomationStep",
  "runAiNonTurnAutomationStep",
  "runAiStrategyABTest",
  "runAiStrategyTuningCycle",
];

const apiHarness = createAiControllerHarness(null);
for (const methodName of expectedControllerApi) {
  assert.equal(
    typeof apiHarness.controller[methodName],
    "function",
    `createAiController() 应继续返回 ${methodName}()`,
  );
}

assert.equal(
  apiHarness.controller.configureAiAutoBattle({
    playerIds: [apiHarness.blue.id],
    stepDelayMs: 25,
    maxBugRepeats: 5,
    maxMovesPerTurn: 2,
    strategyWeights: { scan: 1.3, pass: 0.7 },
    suppressAutoSchedule: true,
  }).ok,
  true,
);

const snapshot = apiHarness.controller.createAiControlSnapshot();
assert.deepEqual(Object.keys(snapshot).sort(), [
  "aiDifficulty",
  "enabled",
  "lastPausedOnBug",
  "maxBugRepeats",
  "maxMovesPerTurn",
  "pausedOnBug",
  "playerIds",
  "stepDelayMs",
  "strategyWeights",
  "version",
]);
assert.equal(snapshot.version, 1);
assert.equal(snapshot.enabled, true);
assert.deepEqual(snapshot.playerIds, [apiHarness.blue.id]);
assert.equal(snapshot.pausedOnBug, false);
assert.equal(snapshot.stepDelayMs, 25);
assert.equal(snapshot.maxBugRepeats, 5);
assert.equal(snapshot.maxMovesPerTurn, 2);
assert.equal(snapshot.strategyWeights.scan, 1.3);

const restored = createAiControllerHarness(null);
const restoredResult = restored.controller.restoreAiControlSnapshot({
  ...snapshot,
  running: true,
  pausedOnBug: true,
});
assert.deepEqual(Object.keys(restoredResult).sort(), [
  "clearedPausedOnBug",
  "enabled",
  "message",
  "ok",
  "pausedOnBug",
  "playerIds",
]);
assert.equal(restoredResult.ok, true);
assert.equal(restoredResult.clearedPausedOnBug, true);
assert.equal(restored.controller.isAiAutoBattlePlayer(restored.blue.id), true);
assert.equal(restored.controller.isAiAutoBattlePlayer(restored.white.id), false);
assert.equal(restored.controller.isAiAutomationPaused(), false);
assert.equal(restored.controller.getAiAutoBattleReport().running, false);

const pausedRestore = createAiControllerHarness(null);
const pausedResult = pausedRestore.controller.restoreAiControlSnapshot(
  { ...snapshot, pausedOnBug: true },
  { restorePausedOnBug: true },
);
assert.equal(pausedResult.ok, true);
assert.equal(pausedRestore.controller.isAiAutomationPaused(), true);

const fallbackHarness = createAiControllerHarness(null);
fallbackHarness.controller.configureAiAutoBattle({
  playerIds: [fallbackHarness.blue.id],
  suppressAutoSchedule: true,
});
const missingResult = fallbackHarness.controller.restoreAiControlSnapshot(null);
assert.equal(missingResult.ok, true);
assert.equal(missingResult.defaulted, true);
assert.equal(missingResult.missing, true);
const manualResult = fallbackHarness.controller.restoreAiControlSnapshot({
  enabled: false,
  playerIds: [],
});
assert.equal(manualResult.ok, true);
assert.equal(manualResult.disabled, true);
const invalidResult = fallbackHarness.controller.restoreAiControlSnapshot({
  enabled: true,
  playerIds: ["missing-player"],
});
assert.equal(invalidResult.ok, true);
assert.equal(invalidResult.defaulted, true);
assert.equal(invalidResult.invalidPlayerIds, true);

const priorityHarness = createAiControllerHarness("blue", {
  pendingAlienTraceAction: {
    playerId: "player-blue",
    playerColor: "blue",
  },
});
priorityHarness.controller.configureAiAutoBattle({
  playerIds: [priorityHarness.blue.id],
  suppressAutoSchedule: true,
});
const priorityResult = priorityHarness.controller.runAiAutomationStep();
assert.equal(priorityResult.ok, true);
assert.equal(priorityResult.progressed, true);
assert.equal(
  priorityHarness.getHandled()?.type,
  "skip",
  "外星人使用 pending 必须先于痕迹 pending 与顶层行动",
);

const humanOwnerHarness = createAiControllerHarness("white");
humanOwnerHarness.controller.configureAiAutoBattle({
  playerIds: [humanOwnerHarness.blue.id],
  suppressAutoSchedule: true,
});
const humanOwnerResult = humanOwnerHarness.controller.runAiAutomationStep();
assert.equal(humanOwnerResult.ok, false);
assert.equal(humanOwnerResult.blocked, true);
assert.match(humanOwnerResult.message, /玩家.*手动处理|白色|white/i);

const report = apiHarness.controller.getAiAutoBattleReport({
  includeAnalysis: false,
  includeDiagnostics: false,
});
assert.deepEqual(Object.keys(report).sort(), [
  "aiDifficulty",
  "aiDifficultyLabel",
  "bugs",
  "enabled",
  "lastSummary",
  "logs",
  "pausedOnBug",
  "pendingState",
  "playerIds",
  "playerResults",
  "running",
  "strategyTuningHistory",
  "strategyTuningRecommendation",
  "strategyWeights",
]);
assert.equal(Array.isArray(report.logs), true);
assert.equal(Array.isArray(report.bugs), true);
assert.equal(Array.isArray(report.playerResults), true);
assert.equal(report.logs.every((entry) => (
  typeof entry.type === "string"
  && typeof entry.message === "string"
  && Object.prototype.hasOwnProperty.call(entry, "roundNumber")
  && Object.prototype.hasOwnProperty.call(entry, "turnNumber")
)), true);

async function runAsyncCharacterization() {
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
  });
  const abResult = await harness.controller.runAiStrategyABTest({
    games: 1,
    maxSteps: 1,
    aiDifficulty: "weak_start",
    stopOnBlocked: false,
    recordABResult: false,
    recordStrategyTuning: false,
  });
  assert.deepEqual(Object.keys(abResult).sort(), [
    "aiDifficulty",
    "baseline",
    "baselineWeights",
    "comparison",
    "games",
    "ok",
    "recommendation",
    "seedBase",
    "seeds",
    "strategyABHistoryEntry",
    "strategyTuningRecommendation",
    "tuned",
    "tunedWeights",
  ]);
  assert.equal(abResult.aiDifficulty, "weak_start");
  assert.equal(abResult.baselineWeights.engine, 1.22);
  assert.equal(abResult.baselineWeights.scan, 1.08);
  assert.equal(abResult.baselineWeights.pass, 0.82);
  assert.equal(abResult.baseline.gamesRun, 1);
  assert.equal(abResult.tuned.gamesRun, 1);
  assert.equal(harness.blue.aiDifficulty, "weak_start");
  assert.equal(harness.controller.getAiStrategyWeights(harness.blue).engine, 1.22);

  const batchKeys = Object.keys(abResult.baseline).sort();
  assert.deepEqual(batchKeys, [
    "gamesRequested",
    "gamesRun",
    "ok",
    "samples",
    "stoppedEarly",
    "strategyTuningHistoryEntry",
    "strategyTuningRecommendation",
    "summary",
  ]);
  assert.equal(Array.isArray(abResult.baseline.samples), true);
  assert.deepEqual(Object.keys(abResult.baseline.samples[0]).sort(), [
    "analysis",
    "bugCount",
    "finalScoreMarkDecisions",
    "gameIndex",
    "grandStrategyPassiveDecisions",
    "grandStrategyPickDecisions",
    "initialIncomeDiscardDecisions",
    "lowMarkPlayerDiagnostics",
    "lowMarkPlayerDiagnosticsList",
    "pendingState",
    "playerResults",
    "seed",
    "summary",
    "tailLogs",
  ]);

  const tuningResult = await harness.controller.runAiStrategyTuningCycle({
    games: 1,
    abGames: 1,
    maxSteps: 1,
    aiDifficulty: "weak_start",
    stopOnBlocked: false,
    continueOnBaselineBlocked: true,
    recordBaselineTuning: false,
    recordABResult: false,
    recordABBatchTuning: false,
  });
  assert.deepEqual(Object.keys(tuningResult).sort(), [
    "abGames",
    "abTest",
    "aiDifficulty",
    "appliedWeights",
    "baselineBatch",
    "baselineWeights",
    "games",
    "ok",
    "originalWeights",
    "recommendation",
    "seedBase",
    "selectedVariant",
    "selectedWeights",
    "tunedWeights",
  ]);
}

runAsyncCharacterization()
  .then(() => console.log("app/ai-controller.characterization.test.js ok"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
