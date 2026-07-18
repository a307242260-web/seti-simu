"use strict";

const assert = require("node:assert/strict");
const { createActionRuntime } = require("./action-runtime");

const players = [
  { id: "p1", color: "white", colorLabel: "白", resources: {} },
  { id: "p2", color: "yellow", colorLabel: "黄", resources: {} },
];

const setupSelectionState = {
  phase: "selecting",
  currentPlayerId: null,
  offersByPlayerId: {},
  confirmedPlayerIds: [],
};

const state = {
  playerState: {
    players: structuredClone(players),
    currentPlayerId: "p1",
  },
  turnState: {
    activePlayerIds: ["p1", "p2"],
    startPlayerId: "p1",
    roundNumber: 1,
  },
  pendingState: {
    actionEffectFlow: { currentIndex: 0 },
  },
  rocketState: {
    statusNote: "",
  },
  startScreenState: {
    selectedIndustryLabels: ["层云核心", "图灵系统"],
  },
  actionLogState: {
    entries: [],
  },
};

const calls = [];

const runtime = createActionRuntime({
  setupSelectionState,
  ...state,
  INITIAL_SELECTION_REQUIRED: { initial: 2 },
  INITIAL_CARD_COUNT: 6,
  INITIAL_SELECTION_CARD_SIZE: {
    industry: { width: 1, height: 1 },
    initial: { width: 1, height: 1 },
  },
  MIN_START_INDUSTRY_POOL_SIZE: 2,
  INITIAL_SELECTION_INDUSTRY_OPTION_COUNT: 2,
  INDUSTRY_CARD_FILES: ["层云核心.png", "图灵系统.png", "深空联合.png", "火星协议.png"],
  ACTION_LOG_DEFAULT_LABELS: { analyze: "分析" },
  shuffleList: (items) => [...items],
  getCurrentPlayer: () => state.playerState.players.find((player) => player.id === state.playerState.currentPlayerId) || null,
  getPlayerById: (playerId) => state.playerState.players.find((player) => player.id === playerId) || null,
  getPlayerLabelById: (playerId) => state.playerState.players.find((player) => player.id === playerId)?.colorLabel || null,
  ensurePublicCardsFilledRespectingDelayedRefills: () => calls.push("fillPublic"),
  renderReservedCards: () => calls.push("renderReserved"),
  renderPublicCards: () => calls.push("renderPublic"),
  renderDebugPlayerSwitch: () => calls.push("renderSwitch"),
  renderPlayerStats: () => calls.push("renderStats"),
  renderPlayerHand: () => calls.push("renderHand"),
  renderTechBoard: () => calls.push("renderTech"),
  renderSectorNebulaDataBoard: () => calls.push("renderSector"),
  syncPlanetOrbitLandMarkers: () => calls.push("syncMarkers"),
  renderAlienPanels: () => calls.push("renderAliens"),
  renderRockets: () => calls.push("renderRockets"),
  syncInteractionFocusChrome: () => calls.push("syncFocus"),
  updateActionButtons: () => calls.push("updateButtons"),
  renderStateReadout: () => calls.push("renderReadout"),
  schedulePersistentGameStateSave: (options) => calls.push(["save", options.label]),
  resolveInitialSelectionEffects: () => ({ ok: true, message: "初始效果已结算", pendingIncomeIncreases: [] }),
  applyIndustryRoundStartBonuses: () => ({ ok: true, message: "", results: [] }),
  startInitialIncomeEffectFlow: () => false,
  applyIndustryStartupPassives: () => calls.push("startupPassives"),
  appendConfirmedActionLogEntry: (entry) => state.actionLogState.entries.push(entry),
  isInitialIncomeFlowActive: () => false,
  renderActionLog: () => calls.push("renderActionLog"),
  refreshLatestActionLogRecoverySnapshot: (label) => calls.push(["refreshSnapshot", label]),
  scrollToPlayerCommandPanel: () => calls.push("scrollToCommand"),
  normalizeActionLogText: (value) => String(value || ""),
  industry: {
    shouldInitializeStrategyPassiveMarkers: () => false,
    shouldInitializeHeliosPassiveMarkers: () => false,
    shouldInitializeAlienLabPanels: () => false,
    shouldInitializeFutureSpan: () => false,
    shouldInitializePiratesRaidMarkers: () => false,
  },
  canStartMainAction: () => true,
  getAnalyzeActionOptionsForPlayer: (_player, options) => ({ fromAnalyze: true, ...options }),
  createActionLogImpactSnapshot: () => ({ before: true }),
  abilities: {
    executeAbility(abilityId, _context, options) {
      calls.push(["ability", abilityId, options || null]);
      return { ok: true, message: `${abilityId} ok` };
    },
  },
  createActionContext: () => ({ ok: true }),
  actions: {
    execute(actionId, _context, options) {
      calls.push(["action", actionId, options || null]);
      return { ok: true, message: `${actionId} ok` };
    },
  },
  startPlanetRewardEffectFlow: () => false,
  startLaunchSectorFinishEffectFlow: () => false,
  settleCardTasksAfterEffect: () => calls.push("settleTasks"),
  maybeAutoExecuteAomomoRewardEffects: () => calls.push("autoAomomo"),
  startResearchTechEffectFlow: () => calls.push("startResearchFlow"),
  syncTechSelectionChrome: () => calls.push("syncTechSelection"),
  finalizeTechTakeResult: () => calls.push("finalizeTechTake"),
  renderRocketElement: (rocket) => calls.push(["renderRocket", rocket]),
  recordAtomicActionHistory: (actionId) => calls.push(["recordHistory", actionId]),
  startAnalyzeDataRewardFlow: () => false,
  executeActionEffect: (effect) => {
    calls.push(["executeEffect", effect]);
    return { ok: true };
  },
  getCurrentActionEffect: () => ({ id: "effect-1" }),
  maybeApplyIndustryLaunchScan: () => calls.push("industryLaunchScan"),
  maybeConsumeAlienLabPanelForMainAction: () => calls.push("consumeAlienLab"),
  markActionPending: () => calls.push("markPending"),
  beginScanAction: () => ({ ok: true, via: "scan" }),
  beginPlayCardSelection: () => ({ ok: true, via: "play" }),
  researchTechForCurrentPlayer: () => ({ ok: true, via: "tech" }),
  orbitForCurrentPlayer: () => ({ ok: true, via: "orbit" }),
  landForCurrentPlayer: () => ({ ok: true, via: "land" }),
  analyzeDataForCurrentPlayer: () => ({ ok: true, via: "analyze" }),
  passForCurrentPlayer: () => ({ ok: true, via: "pass" }),
  endCurrentTurn: () => ({ ok: true, via: "end-turn" }),
  getCurrentActionEffectIndex: () => 0,
  runQuickTrade: (tradeId, options) => ({ ok: true, tradeId, options }),
  confirmDataPlacement: (target, blueSlot) => ({ ok: true, target, blueSlot }),
  standardActionAdapter: {
    enumerate(_context, request) {
      calls.push(["standard-enumerate", request]);
      return [{
        schemaVersion: "seti-standard-action-v1",
        actionId: "scan:shared-action-id",
        actorId: "p2",
        family: "scan",
        phase: "main",
        stateVersion: 0,
        decisionVersion: 0,
        target: { kind: "standard-scan" },
        payload: {},
        summary: "扫描",
      }];
    },
    execute(_context, action) {
      calls.push(["standard-execute", action.actionId]);
      return { ok: true, action };
    },
    executeLegacy(_context, family, selector) {
      calls.push(["standard-legacy", family, selector]);
      return { ok: true, tradeId: selector.tradeId };
    },
  },
});

runtime.startInitialSelection();
assert.equal(setupSelectionState.currentPlayerId, "p1");
assert.equal(Object.keys(setupSelectionState.offersByPlayerId).length, 2);

const offer1 = runtime.getInitialSelectionOffer("p1");
offer1.selectedIndustryId = offer1.industryOptions[0].id;
offer1.selectedInitialIds = offer1.initialOptions.slice(0, 2).map((card) => card.id);
runtime.confirmInitialSelectionForCurrentPlayer();
assert.equal(setupSelectionState.currentPlayerId, "p2");

state.playerState.currentPlayerId = "p2";
const offer2 = runtime.getInitialSelectionOffer("p2");
offer2.selectedIndustryId = offer2.industryOptions[0].id;
offer2.selectedInitialIds = offer2.initialOptions.slice(0, 2).map((card) => card.id);
runtime.confirmInitialSelectionForCurrentPlayer();
assert.equal(setupSelectionState.phase, "complete");
assert.equal(state.rocketState.statusNote.includes("游戏开始"), true);

const launchResult = runtime.dispatchAction({ kind: "launch" });
assert.equal(launchResult.ok, true);
assert.equal(calls.some((entry) => Array.isArray(entry) && entry[0] === "ability" && entry[1] === "launchProbe"), true);

const effectResult = runtime.dispatchAction({ kind: "effect_step", effectIndex: 0 });
assert.equal(effectResult.ok, true);
assert.equal(calls.some((entry) => Array.isArray(entry) && entry[0] === "executeEffect"), true);

const quickTradeResult = runtime.dispatchAction({ kind: "quick_trade", payload: { tradeId: "trade-1", keep: true } });
assert.equal(quickTradeResult.tradeId, "trade-1");

const standardListing = runtime.dispatchAction({ kind: "standard_enumerate" });
assert.equal(standardListing.ok, true);
assert.equal(standardListing.candidates[0].actionId, "scan:shared-action-id");
const standardExecution = runtime.dispatchAction({
  standardAction: structuredClone(standardListing.candidates[0]),
});
assert.equal(standardExecution.ok, true);
assert.deepEqual(
  calls.filter((entry) => Array.isArray(entry) && entry[0] === "standard-execute").at(-1),
  ["standard-execute", "scan:shared-action-id"],
);

console.log("action-runtime tests passed");
