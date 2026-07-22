"use strict";

const assert = require("node:assert/strict");
const { createDebugRuntime } = require("./debug-runtime");
const { createCompositionDecisionAccess } = require("../game/effects/composition-decision-access");
const { attachDecisionState } = require("./test-decision-state");

function createClassList() {
  const values = new Set();
  return {
    toggle(token, force) {
      if (force === true || (force !== false && !values.has(token))) values.add(token);
      else if (force === false || values.has(token)) values.delete(token);
    },
    contains(token) {
      return values.has(token);
    },
  };
}

function createElement() {
  return {
    hidden: false,
    textContent: "",
    innerHTML: "",
    disabled: false,
    dataset: {},
    attributes: {},
    children: [],
    style: {
      values: new Map(),
      setProperty(name, value) {
        this.values.set(name, value);
      },
    },
    classList: createClassList(),
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    replaceChildren(...nodes) {
      this.children = [...nodes];
    },
    scrollIntoView() {},
  };
}

function createButtonElement() {
  return {
    ...createElement(),
    type: "button",
    title: "",
  };
}

function createDocument() {
  return {
    createElement(tag) {
      return tag === "button" ? createButtonElement() : createElement();
    },
  };
}

function createBaseContext() {
  const appWrap = createElement();
  const debugToggle = createElement();
  const debugPlayerSwitchButton = createElement();
  const debugPlayerMenu = createElement();
  const debugSectorWinButton = createElement();
  const scanTargetActions = createElement();
  const scanTargetTitle = createElement();
  const scanTargetSubtitle = createElement();
  const scanTargetCancel = createElement();
  const scanTargetOverlay = createElement();
  const playersState = {
    players: [
      { id: "p1", color: "white", colorLabel: "白色", name: "白色玩家", resources: { score: 0 }, hand: [] },
      { id: "p2", color: "yellow", colorLabel: "黄色", name: "黄色玩家", resources: { score: 0 }, hand: [] },
    ],
    currentPlayerId: "p1",
  };
  const callLog = [];
  const compositionDecisions = createCompositionDecisionAccess();
  const pendingState = attachDecisionState({}, compositionDecisions);
  const context = {
    compositionDecisions,
    window: {
      requestAnimationFrame(fn) {
        fn();
      },
      prompt() {
        return null;
      },
    },
    document: createDocument(),
    els: {
      appWrap,
      debugToggle,
      debugPlayerSwitchButton,
      debugPlayerMenu,
      debugSectorWinButton,
      scanTargetActions,
      scanTargetTitle,
      scanTargetSubtitle,
      scanTargetCancel,
      scanTargetOverlay,
    },
    players: {
      RESOURCE_LIMITS: { availableData: 2 },
      getCurrentPlayer(state) {
        return state.players.find((player) => player.id === state.currentPlayerId) || null;
      },
      getPlayerColorDefinition(color) {
        return { label: color === "white" ? "白" : "黄", uiColor: color === "white" ? "#fff" : "#ff0" };
      },
      gainResources(player, gain) {
        player.resources = { ...(player.resources || {}), ...gain };
      },
    },
    cards: {
      setSelectionActive() {},
      setDiscardSelectionActive() {},
      setPlayCardSelectionActive() {},
      addCardToHand(player, card) {
        player.hand.push(card);
      },
      getCatalogEntriesByInputRange(input) {
        return input === "b_1" ? [{ key: "b_1" }] : [];
      },
      createCardInstance(entry, id) {
        return { ...entry, id };
      },
      getCardLabel(card) {
        return card.key || card.id;
      },
    },
    tech: {
      setTechSelectionActive() {},
      cancelPendingTake() {},
    },
    data: {
      NEBULA_IDS: ["S1"],
      listNebulaTokens() {
        return [{ slotIndex: 0 }, { slotIndex: 1 }];
      },
      getNebulaCapacity() {
        return 2;
      },
      getNebulaLabel() {
        return "扇区 S1";
      },
      getNextReplaceableNebulaToken(_state, _sectorId) {
        return { id: "token-1" };
      },
      replaceNextNebulaDataToken() {
        return { ok: true, extra: false };
      },
      addSectorExtraMark() {
        return { ok: true, extra: true };
      },
      gainData() {
        return { ok: true, message: "数据 +1" };
      },
      fillAllNebulaData() {
        return { ok: true, message: "填充完成", results: [] };
      },
      clearNebulaData() {},
    },
    aliens: {
      TRACE_TYPES: ["pink", "yellow", "blue"],
    },
    playerState: playersState,
    turnState: {
      activePlayerIds: ["p1", "p2"],
      roundNumber: 1,
    },
    rocketState: {
      statusNote: "",
      activeRocketId: null,
    },
    techGameState: { board: {}, ui: {} },
    nebulaDataState: {},
    alienGameState: { aomomo: {} },
    cardState: {},
    pendingState,
    uiRuntimeState: {
      passReserveSelectionDismissed: false,
      debugAlienTraceModeActive: false,
      sectorWinDebugActive: false,
      industryFreeMoveState: null,
    },
    DEBUG_QUICK_SECTOR_SCAN_EXTRA_LIMIT: 2,
    getCurrentPlayer() {
      return playersState.players.find((player) => player.id === playersState.currentPlayerId) || null;
    },
    getInterfacePlayer() {
      return playersState.players.find((player) => player.id === playersState.currentPlayerId) || null;
    },
    getPlayerAgentLabel(id) {
      return id === "p1" ? "人类" : "AI";
    },
    getActivePlayers() {
      return playersState.players;
    },
    getPlayerById(id) {
      return playersState.players.find((player) => player.id === id) || null;
    },
    getPlayerByColor(color) {
      return playersState.players.find((player) => player.color === color) || null;
    },
    getNormalTokenAssetForPlayer(player) {
      return `${player.color}.png`;
    },
    getRoundOrderPlayerIds() {
      return ["p1", "p2"];
    },
    getDisplayedTurnNumber() {
      return 2;
    },
    getFirstEligiblePlayerId() {
      return "p1";
    },
    isPlayerPassedThisRound() {
      return false;
    },
    hasPlayerCompletedThisTurn() {
      return false;
    },
    isAiAutoBattlePlayer(id) {
      return id === "p2";
    },
    createAiControlSnapshot() {
      return { enabled: true, playerIds: ["p2"] };
    },
    restoreAiControlSnapshot() {
      callLog.push("restoreAi");
      return { ok: true };
    },
    scheduleAiAutoStepIfNeeded() {
      callLog.push("scheduleAi");
    },
    resolvePlayerReference({ playerId }) {
      return playersState.players.find((player) => player.id === playerId) || null;
    },
    isCardSelectionActive() {
      return false;
    },
    isDiscardSelectionActive() {
      return false;
    },
    isPlayCardSelectionActive() {
      return false;
    },
    isTechTilePickingActive() {
      return false;
    },
    renderRoundStatus() {
      callLog.push("renderRoundStatus");
    },
    renderPlayerStats() {
      callLog.push("renderPlayerStats");
    },
    renderPlayerHand() {
      callLog.push("renderPlayerHand");
    },
    renderPublicCards() {
      callLog.push("renderPublicCards");
    },
    renderReservedCards() {
      callLog.push("renderReservedCards");
    },
    renderAlienPanels() {
      callLog.push("renderAlienPanels");
    },
    renderTechBoard() {
      callLog.push("renderTechBoard");
    },
    renderRockets() {
      callLog.push("renderRockets");
    },
    renderWheels() {
      callLog.push("renderWheels");
    },
    renderSectorNebulaDataBoard() {
      callLog.push("renderSectorNebulaDataBoard");
    },
    renderStateReadout() {
      callLog.push("renderStateReadout");
    },
    updatePublicCardControls() {
      callLog.push("updatePublicCardControls");
    },
    updateActionButtons() {
      callLog.push("updateActionButtons");
    },
    schedulePersistentGameStateSave(options) {
      callLog.push(["save", options.label]);
    },
    clearMoveRocketHighlight() {
      callLog.push("clearMoveRocketHighlight");
    },
    getMovableTokensForPlayer(playerId) {
      return playerId ? [{ id: `rocket-${playerId}`, playerId }] : [];
    },
    resolveCompletedSectorSettlements() {
      return { ok: true, message: "完成结算", participantAwardMessage: "奖励" };
    },
    isGameEnded() {
      return false;
    },
    clearTransientStateForRecovery() {
      callLog.push("clearTransient");
    },
    advanceTurnAfterPlayerAction() {
      playersState.currentPlayerId = "p2";
      return { gameEnded: false, roundAdvanced: false };
    },
    applyIndustryRoundStartBonuses() {
      return { ok: true, message: "轮开始收入" };
    },
    maybeStartFundamentalismRoundStartIncomeFlow() {
      callLog.push("maybeStartIncome");
    },
    maybeOpenActionBriefingForCompletedCycle() {
      return false;
    },
    maybeAutoOpenFinalResultDialog() {
      callLog.push("openFinal");
    },
    resize() {
      callLog.push("resize");
    },
    callLog,
  };
  context.workingRoot = {
    playerState: context.playerState,
    turnState: context.turnState,
    rocketState: context.rocketState,
    techGameState: context.techGameState,
    nebulaDataState: context.nebulaDataState,
    alienGameState: context.alienGameState,
    cardState: context.cardState,
  };
  return context;
}

{
  const context = createBaseContext();
  const runtime = createDebugRuntime(context);
  runtime.setDebugOpen(context.workingRoot, true);
  assert.equal(context.els.debugToggle.attributes["aria-expanded"], "true");
  runtime.renderDebugPlayerSwitch(context.workingRoot);
  assert.equal(context.els.debugPlayerMenu.children.length, 2);
  const switchResult = runtime.switchCurrentPlayerColor(context.workingRoot, "yellow");
  assert.equal(switchResult.ok, true);
  assert.equal(context.playerState.currentPlayerId, "p2");
}

{
  const context = createBaseContext();
  const runtime = createDebugRuntime(context);
  const openResult = runtime.openDebugQuickSectorScanPicker(context.workingRoot);
  assert.equal(openResult.ok, true);
  assert.equal(context.workingRoot.match.scanTargetContinuation.type, "debug_quick_sector_scan");
  runtime.handleDebugQuickSectorScanChoice(context.workingRoot, { debugSectorScanStep: "player", playerId: "p1" });
  assert.equal(context.els.scanTargetTitle.textContent, "快速扫描扇区");
  const runResult = runtime.runDebugQuickSectorScan(context.workingRoot, "p1", "S1", 2);
  assert.equal(runResult.ok, true);
  assert.equal(context.rocketState.statusNote.includes("快速扫描扇区"), true);
}

{
  const context = createBaseContext();
  const runtime = createDebugRuntime(context);
  const toggleResult = runtime.toggleSectorWinDebug(context.workingRoot);
  assert.equal(toggleResult.active, true);
  assert.equal(context.els.debugSectorWinButton.attributes["aria-pressed"], "true");
  const incomeResult = runtime.addDebugIncome(context.workingRoot);
  assert.equal(incomeResult.ok, true);
  assert.equal(context.callLog.includes("renderStateReadout"), true);
}

{
  const context = createBaseContext();
  context.pendingState.discardAction = { playerId: "p2" };
  const runtime = createDebugRuntime(context);
  const aiResult = runtime.handleAiTakeoverFailsafe(context.workingRoot);
  assert.equal(aiResult.ok, true);
  const skipResult = runtime.handleForceSkipTurnFailsafe(context.workingRoot);
  assert.equal(skipResult.ok, true);
  assert.equal(context.callLog.some((entry) => Array.isArray(entry) && entry[0] === "save"), true);
}

console.log("debug-runtime tests passed");
