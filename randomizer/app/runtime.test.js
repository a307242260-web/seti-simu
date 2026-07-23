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

{
  const restoredSequences = [];
  const adapter = runtime.createBrowserWorkingStateAdapter({
    initialGameState: {
      createSessionState: (_modules, options) => ({ playerState: {}, turnState: {}, match: {}, options }),
      restoreSessionState(target, source, replace) {
        replace(target.playerState, source.playerState);
        replace(target.turnState, source.turnState);
      },
    },
    ruleModules: {},
    defaultInitialPlayerColor: "blue",
    defaultActivePlayerCount: 4,
    finalScoreIds: ["a"],
    restoreSequences: (sequences) => restoredSequences.push(sequences),
  });
  const created = adapter.createWorkingState({ seed: "seed-1" });
  assert.equal(created.options.activePlayerCount, 4);
  assert.equal(created.meta.seed, "seed-1");
  assert.equal(adapter.validateSessionBoundary({ match: { jiuzheOpportunityQueue: [] } }).ok, false);
  const target = { playerState: { old: true }, turnState: { old: true } };
  adapter.restoreWorkingState(target, {
    playerState: { currentPlayerId: "p1" }, turnState: { roundNumber: 2 }, meta: { sequences: { card: 3 } },
  }, { reason: "restore" });
  assert.equal(target.playerState.currentPlayerId, "p1");
  assert.deepEqual(restoredSequences, []);
}

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
  const root = { match: { landTargetContinuation: { id: "land" } } };
  const uiRuntimeState = { publicCardSelectedSlots: [1], cardSelectionType: null };
  const matchRuntime = runtime.createBrowserMatchRuntime({
    createReadoutRoot: () => root,
    uiRuntimeState,
  });
  assert.deepEqual(matchRuntime.getPendingLandTargetDecision(), { id: "land" });
  assert.equal(matchRuntime.getPendingDiscardDecision(), null);
  const player = { id: "p1", color: "blue" };
  const effect = { id: "effect-1" };
  const pending = matchRuntime.setPendingCardSelectionDecision(root, {
    type: "public_scan", player, effect, selectedSlots: [0], maxSelectable: 2,
  });
  assert.deepEqual(pending, {
    type: "public_scan", playerId: "p1", playerColor: "blue", effectId: "effect-1", maxSelectable: 2,
  });
  assert.deepEqual(uiRuntimeState.publicCardSelectedSlots, []);
  assert.equal(uiRuntimeState.cardSelectionType, "public_scan");
  matchRuntime.setActionEffectFlow(root, { id: "flow" });
  assert.deepEqual(matchRuntime.getActionEffectFlow(), { id: "flow" });
  matchRuntime.setPendingCardSelectionDecision(root, null);
  assert.equal(matchRuntime.getPendingCardSelectionDecision(), null);
}

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

{
  const human = { id: "human", color: "white", colorLabel: "白色" };
  const bot = { id: "bot", color: "blue", colorLabel: "蓝色" };
  const playerState = { currentPlayerId: "bot", players: [human, bot] };
  const browserHostState = { scanRunSequence: 0 };
  const context = runtime.createBrowserContextRuntime({
    players: {
      getCurrentPlayer: (stateValue) => stateValue.players.find((player) => player.id === stateValue.currentPlayerId),
      getPlayerColorDefinition: (color) => ({ label: color === "blue" ? "蓝色" : "白色" }),
    },
    industry: { getPlayerIndustryLabel: (player) => player.id === "human" ? "人类公司" : null },
    browserHostState,
    createReadoutRoot: () => ({ playerState, turnState: { activePlayerIds: ["human", "bot"] } }),
    getPlayerById: (id) => playerState.players.find((player) => player.id === id) || null,
    getRoundOrderPlayerIds: () => ["bot", "human"],
    isAiPlayer: (id) => id === "bot",
    isAiAutomationPaused: () => false,
  });
  assert.equal(context.getInterfacePlayer(), human);
  assert.equal(context.createScanRunId("sector"), "sector-1");
  context.resetScanRunSequence();
  assert.equal(browserHostState.scanRunSequence, 0);
  assert.deepEqual(context.getActivePlayers(), [human, bot]);
  assert.equal(context.getPlayerDisplayLabel(bot), "蓝色(电脑)");
  assert.equal(context.getPlayerDisplayLabel(human), "白色-人类公司");
  assert.equal(context.getPlayerActionLabel(null, { playerColor: "blue" }), "蓝色");
  assert.deepEqual(context.getTargetPlayerOptions(human), { targetPlayerId: "human", targetPlayerColor: "white" });
  assert.equal(context.getPlayerRoundOrderNumber("human"), 2);
}

{
  const players = {
    normalizePlayerColor: (color) => color,
    getCurrentPlayer: (state) => state.players[0],
  };
  const root = { playerState: { players: [{ id: "p1", color: "white" }] }, rocketState: {}, turnState: {} };
  const lookup = runtime.createPlayerLookupRuntime({
    players,
    uiRuntimeState: {},
    createReadoutRoot: () => root,
  });
  assert.equal(lookup.getCurrentPlayer().id, "p1");
  assert.equal(lookup.getPlayerById(root, "p1").color, "white");
  assert.equal(lookup.getPlayerByColor("white").id, "p1");
}

console.log("runtime tests passed");
