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

state.actionLog.entries.push({ id: 1 });
state.selection.currentPlayerId = "player-white";

assert.equal(Object.hasOwn(state, "decisions"), false);
assert.equal(state.actionLog.entries.length, 1);
assert.equal(state.selection.currentPlayerId, "player-white");
assert.equal(Object.hasOwn(state, "pending"), false);
assert.equal(state.ui.passReserveSelectionDismissed, false);
assert.equal(state.ui.passReserveSelectedCardId, null);
assert.deepEqual(state.ui.probeSectorSelectedRocketIds, []);
assert.equal(state.ui.alienRevealConfirmation, null);
assert.equal(state.ui.jiuzheOpportunityOpen, false);
assert.equal(state.browserHost.scanRunSequence, 0);

{
  const p1 = { id: "p1", color: "white" };
  const p2 = { id: "p2", color: "blue" };
  const playerState = { currentPlayerId: "p1", players: [p1, p2] };
  const ui = { effectExecutionPlayerId: null };
  const flow = { defaultPlayerId: "p2", effects: [{}] };
  const owners = runtime.createPlayerEffectOwnerRuntime({
    players: { getCurrentPlayer: (stateValue) => stateValue.players.find((player) => player.id === stateValue.currentPlayerId) },
    uiRuntimeState: ui,
    createReadoutRoot: () => ({ playerState }),
    getPlayerByColor(rootOrColor, explicitColor = null) {
      const stateValue = explicitColor ? rootOrColor.playerState : playerState;
      const color = explicitColor || rootOrColor;
      return stateValue.players.find((player) => player.color === color) || null;
    },
    getCurrentPlayer: (root) => root ? root.playerState.players.find((player) => player.id === root.playerState.currentPlayerId) : p1,
    getActionEffectFlow: () => flow,
  });
  const workingRoot = { playerState, rocketState: {}, turnState: {} };
  assert.equal(owners.resolvePlayerReference({ playerColor: "blue" }), p2);
  assert.equal(owners.getEffectOwnerPlayer(workingRoot, {}), p2);
  assert.equal(owners.getEffectOwnerPlayer(workingRoot, { playerId: "p1" }), p1);
  const explicit = { playerId: "p1" };
  assert.equal(owners.assignEffectOwner(explicit, "p2"), explicit);
  owners.assignEffectFlowOwner(flow, "p1");
  assert.equal(flow.effects[0].playerId, "p1");
  const observed = owners.withPendingOwnerPlayer(workingRoot, { playerId: "p2" }, (owner) => {
    assert.equal(ui.effectExecutionPlayerId, "p2");
    return owner.id;
  });
  assert.equal(observed, "p2");
  assert.equal(ui.effectExecutionPlayerId, null);
}

console.log("runtime tests passed");
