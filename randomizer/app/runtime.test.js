"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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

state.decisions.open("discard_action", { count: 2 });
state.actionLog.entries.push({ id: 1 });
state.selection.currentPlayerId = "player-white";

assert.equal(state.decisions.peek("discard_action").count, 2);
assert.equal(state.actionLog.entries.length, 1);
assert.equal(state.selection.currentPlayerId, "player-white");
assert.equal(Object.hasOwn(state, "pending"), false);
assert.equal(state.ui.passReserveSelectionDismissed, false);
assert.equal(state.ui.passReserveSelectedCardId, null);
assert.equal(state.ui.alienRevealConfirmation, null);
assert.equal(state.ui.jiuzheOpportunityOpen, false);
assert.equal(state.browserHost.scanRunSequence, 0);

console.log("runtime tests passed");
