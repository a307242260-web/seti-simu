"use strict";

const assert = require("node:assert/strict");
const {
  createTurnState,
  getRoundOrderPlayerIds,
  createTurnFlowController,
} = require("./turn-flow");

const basePlayers = [
  { id: "p1", color: "white", colorLabel: "白" },
  { id: "p2", color: "yellow", colorLabel: "黄" },
  { id: "p3", color: "blue", colorLabel: "蓝" },
];

const initialTurnState = createTurnState(basePlayers, { activePlayerCount: 3, currentPlayerId: "p2" });
assert.deepEqual(initialTurnState.activePlayerIds, ["p1", "p2", "p3"]);
assert.equal(initialTurnState.startPlayerId, "p1");
assert.deepEqual(getRoundOrderPlayerIds({
  ...initialTurnState,
  startPlayerId: "p2",
}), ["p2", "p3", "p1"]);

const turnState = createTurnState(basePlayers, { activePlayerCount: 3, currentPlayerId: "p1" });
const playerState = { players: structuredClone(basePlayers), currentPlayerId: "p1" };

const controller = createTurnFlowController({
  players: {
    PLAYER_COLOR_IDS: ["white", "yellow", "blue"],
    createPlayerState: ({ players, currentPlayerColor }) => ({
      players: players.map((player, index) => ({
        id: `p${index + 1}`,
        color: player.color,
        colorLabel: player.color,
      })),
      currentPlayerId: currentPlayerColor === "white" ? "p1" : "p2",
    }),
  },
  turnState,
  playerState,
  uiRuntimeState: { finalResultAutoOpened: true },
  solarState: {},
  nebulaDataState: {},
  alienGameState: {},
  finalScoringState: {},
  rocketState: { statusNote: "" },
  planetStatsState: {},
  techGameState: {},
  cardState: {},
  setupSelectionState: {},
  pendingState: {},
  cards: {
    discardUnusedPassReserveCards: () => {},
    createCardState: () => ({ cards: [] }),
  },
  industry: {
    resetAllRoundIndustryRuntimeState: () => {},
    resetAllIndustryActionMarks: () => {},
  },
  finalScoring: {
    createFinalScoringState: () => ({ scores: [] }),
  },
  solar: {
    createBaselineState: () => ({ baseline: true }),
  },
  data: {
    createDefaultNebulaDataState: () => ({ nebula: true }),
    clearNebulaData: () => {},
  },
  aliens: {
    createDefaultAlienState: () => ({ aliens: true }),
  },
  rocketActions: {
    createRocketState: () => ({ rockets: [] }),
  },
  planetStats: {
    createPlanetStatsState: () => ({ planets: [] }),
  },
  tech: {
    createState: () => ({ tech: [] }),
    setupBoardBonuses: () => {},
  },
  cardTaskStateModule: {
    createTaskState: () => ({ tasks: [] }),
  },
  clearTransientStateForRecovery: () => {},
  restoreMutableObject: (target, source) => {
    Object.keys(target).forEach((key) => delete target[key]);
    Object.assign(target, source);
  },
  resetScanRunSequence: () => {},
  resetActionLog: () => {},
  randomizeWheels: () => {},
  randomizeSectors: () => {},
  fillNebulaDataBoard: () => {},
  renderWheels: () => {},
  renderSectorNebulaDataBoard: () => {},
  randomizeFinalScores: () => {},
  randomizeAliens: () => {},
  renderRoundStatus: () => {},
  renderRotateStateToken: () => {},
  renderDebugPlayerSwitch: () => {},
  refreshHelpers: {
    refreshBoardState: () => {},
    refreshPlayerPanels: () => {},
    refreshAfterPendingChange: () => {},
  },
  cancelIndustryAbilityFlow: () => {},
  closeFinalResultDialog: () => {},
  preparePassReservePilesForCurrentGame: () => {},
  initializeCardGame: () => {},
  configureDefaultAiOpponent: () => {},
  startInitialSelection: () => {},
  renderStateReadout: () => {},
  resize: () => {},
  clearPersistentGameState: () => {},
  schedulePersistentGameStateSave: () => {},
  seedDefaultReferenceRockets: () => {},
  getPlayerById: (playerId) => playerState.players.find((player) => player.id === playerId) || null,
  computePlayerFinalScoreBreakdown: (player) => ({ totalScore: player.id === "p1" ? 10 : 8 }),
  defaultActivePlayerCount: 3,
  defaultInitialPlayerColor: "white",
  defaultInitialHandCount: 5,
  finalRoundNumber: 2,
  finalScoreIds: ["a", "b"],
  normalizeAiDifficulty: (value) => value || "laughable",
  startScreenState: { aiDifficulty: "laughable" },
  historyStepOrder: [],
  cardTaskState: {},
  setPersistentGameSaveSuspended: () => {},
  els: { spinButton: { classList: { remove() {} } }, startAiDifficulty: { value: "laughable" } },
});

const firstAdvance = controller.advanceTurnAfterPlayerAction("p1", { passed: false });
assert.equal(firstAdvance.nextPlayerId, "p2");
assert.equal(turnState.turnNumber, 2);

turnState.passedPlayerIds = ["p1", "p2"];
turnState.roundNumber = 1;
turnState.turnNumber = 3;
turnState.actionCycleNumber = 1;
turnState.completedTurnPlayerIds = ["p1", "p2"];
playerState.currentPlayerId = "p3";
const nextRoundAdvance = controller.advanceTurnAfterPlayerAction("p3", { passed: true });
assert.equal(nextRoundAdvance.roundAdvanced, true);
assert.equal(turnState.roundNumber, 2);
assert.equal(turnState.turnNumber, 1);

turnState.passedPlayerIds = ["p1", "p2"];
turnState.roundNumber = 2;
turnState.turnNumber = 2;
turnState.completedTurnPlayerIds = ["p1", "p2"];
playerState.currentPlayerId = "p3";
const gameEndAdvance = controller.advanceTurnAfterPlayerAction("p3", { passed: true });
assert.equal(gameEndAdvance.gameEnded, true);
assert.equal(turnState.gameEnded, true);
assert.deepEqual(gameEndAdvance.finalScoreLines, ["白：10 分", "黄：8 分", "蓝：8 分"]);

console.log("turn-flow tests passed");
