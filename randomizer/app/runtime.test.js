"use strict";

const assert = require("node:assert/strict");
const runtime = require("./runtime");

const state = runtime.createRuntime({
  aiDifficulty: "weak_start",
  defaultActivePlayerCount: 3,
  alienTypeIds: ["九折", "虫"],
  industryCardFiles: ["层云核心.png", "图灵系统.png"],
});

assert.equal(state.startScreen.aiDifficulty, "weak_start");
assert.equal(state.startScreen.activePlayerCount, 3);
assert.deepEqual(state.startScreen.selectedAlienIds, ["九折", "虫"]);
assert.deepEqual(state.startScreen.selectedIndustryLabels, ["层云核心", "图灵系统"]);

state.pending.discardAction = { count: 2 };
state.actionLog.entries.push({ id: 1 });
state.selection.currentPlayerId = "player-white";

assert.deepEqual(state.pending.discardAction, { count: 2 });
assert.equal(state.actionLog.entries.length, 1);
assert.equal(state.selection.currentPlayerId, "player-white");
assert.deepEqual(state.pending.type1TriggerEvents, []);

console.log("runtime tests passed");
