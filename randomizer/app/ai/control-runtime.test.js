"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

const runtimePath = path.resolve(__dirname, "control-runtime.js");
delete globalThis.SetiAppAiControlRuntime;
delete require.cache[runtimePath];
const moduleEntry = require(runtimePath);

assert.equal(globalThis.SetiAppAiControlRuntime, moduleEntry);
assert.equal(typeof moduleEntry.createAiControlRuntime, "function");
assert.deepEqual(
  Array.from({ length: 4 }, () => moduleEntry.createAiSeededRandom("seti-stage-1")()),
  Array.from({ length: 4 }, () => moduleEntry.createAiSeededRandom("seti-stage-1")()),
);
const firstRandom = moduleEntry.createAiSeededRandom("seti-stage-1");
const secondRandom = moduleEntry.createAiSeededRandom("seti-stage-1");
assert.deepEqual(
  Array.from({ length: 4 }, () => firstRandom()),
  Array.from({ length: 4 }, () => secondRandom()),
);
assert.equal(moduleEntry.getAiBatchSeed({ seed: "batch" }, 2), "batch:3");

function createHarness(options = {}) {
  const white = { id: "player-white", color: "white", colorLabel: "白色" };
  const blue = { id: "player-blue", color: "blue", colorLabel: "蓝色" };
  const players = [white, blue];
  const playerState = {
    players,
    currentPlayerId: options.currentPlayerId || white.id,
  };
  const turnState = {
    activePlayerIds: players.map((player) => player.id),
    activePlayerCount: players.length,
    startPlayerId: white.id,
  };
  const state = { ...(options.state || {}) };
  const scheduled = [];
  const logs = [];
  const bugs = [];
  const rocketState = {};
  const getPlayerById = (playerId) => players.find((player) => player.id === playerId) || null;
  const getPlayerByColor = (color) => players.find((player) => player.color === color) || null;
  const runtime = moduleEntry.createAiControlRuntime({
    window: {
      setTimeout(callback, delay) {
        scheduled.push({ callback, delay });
      },
    },
    state,
    playerState,
    turnState,
    rocketState,
    DEFAULT_ACTIVE_PLAYER_COUNT: 2,
    DEFAULT_INITIAL_PLAYER_COLOR: "white",
    getCurrentActionEffect: () => options.currentEffect || null,
    getCurrentPlayer: () => getPlayerById(playerState.currentPlayerId),
    getEffectOwnerPlayer: (effect) => getPlayerById(effect?.ownerPlayerId),
    getPlayerByColor,
    getPlayerById,
    getPlayerLabelById: (playerId) => getPlayerById(playerId)?.colorLabel || playerId,
    isGameEnded: () => false,
    isUiBlockingAiAutomation: () => false,
    isIndustryHandSelectionActive: () => false,
    recordAiAutoBattleLog(type, message, details) {
      logs.push({ type, message, details });
    },
    recordAiAutoBattleBug(message, details) {
      const bug = { message, details };
      bugs.push(bug);
      return bug;
    },
    renderStateReadout: () => {},
    runAiAutomationStep: () => options.stepResult || { ok: true, done: true },
    resetGameForAiAutoBattle: () => ({ ok: true }),
    setTurnStatePlayerOrder: () => {},
    startInitialSelection: () => {},
    updateActionButtons: () => {},
  });
  return { blue, bugs, logs, playerState, rocketState, runtime, scheduled, state, white };
}

{
  const harness = createHarness();
  assert.equal(harness.runtime.configureAiAutoBattle({
    playerIds: [harness.blue.id],
    suppressAutoSchedule: true,
  }).ok, true);
  assert.equal(harness.runtime.getAiStrategyWeights().engine, 1.3);
  assert.equal(harness.runtime.getAiStrategyWeights().scan, 1.18);

  harness.runtime.configureAiAutoBattle({
    playerIds: [harness.blue.id],
    aiDifficulty: "weak_start",
    suppressAutoSchedule: true,
  });
  assert.equal(harness.blue.aiDifficulty, "weak_start");
  assert.equal(harness.runtime.getAiStrategyWeights(harness.blue).engine, 1.22);
  assert.equal(harness.runtime.getAiStrategyWeights(harness.blue).scan, 1.08);

  harness.runtime.configureAiAutoBattle({
    playerIds: [harness.blue.id],
    aiDifficulty: "weak_start",
    strategyWeights: { engine: 1.31, scan: 1.21 },
    suppressAutoSchedule: true,
  });
  assert.equal(harness.runtime.getAiStrategyWeights(harness.blue).engine, 1.31);
  assert.equal(harness.runtime.getAiStrategyWeights(harness.blue).scan, 1.21);

  const snapshot = harness.runtime.createAiControlSnapshot();
  assert.equal(snapshot.version, 1);
  assert.deepEqual(snapshot.playerIds, [harness.blue.id]);
  assert.equal(snapshot.strategyWeights.engine, 1.31);

  const restored = createHarness();
  const result = restored.runtime.restoreAiControlSnapshot({ ...snapshot, pausedOnBug: true });
  assert.equal(result.ok, true);
  assert.equal(result.clearedPausedOnBug, true);
  assert.equal(restored.runtime.isAiAutoBattlePlayer(restored.blue.id), true);
  assert.equal(restored.runtime.isAiAutomationPaused(), false);
}

{
  const harness = createHarness({
    state: {
      pendingAlienTraceAction: { playerId: "player-white" },
      alienTracePickerState: {
        mode: "fangzhou-use",
        targetPlayerId: "player-blue",
      },
    },
  });
  assert.equal(
    harness.runtime.getPendingAutomationPlayerId(),
    harness.white.id,
    "痕迹 pending 必须保持在外星人 owner 判定中的既有优先级",
  );
  harness.state.pendingAlienTraceAction = null;
  assert.equal(harness.runtime.getPendingAutomationPlayerId(), harness.blue.id);
  harness.runtime.configureAiAutoBattle({
    playerIds: [harness.blue.id],
    suppressAutoSchedule: true,
  });
  harness.runtime.scheduleAiAutoStepIfNeeded();
  assert.equal(harness.scheduled.length, 1);
  assert.equal(harness.scheduled[0].delay, 0);
}

{
  const harness = createHarness({
    currentPlayerId: "player-blue",
    stepResult: { ok: false, blocked: true, message: "测试阻塞" },
  });
  harness.runtime.configureAiAutoBattle({
    playerIds: [harness.blue.id],
    suppressAutoSchedule: true,
  });
  harness.runtime.scheduleAiAutoStepIfNeeded();
  harness.scheduled[0].callback();
  assert.equal(harness.runtime.isAiAutomationPaused(), true);
  assert.equal(harness.bugs.length, 1);
  assert.match(harness.rocketState.statusNote, /测试阻塞/);
}

console.log("app/ai/control-runtime.test.js ok");
