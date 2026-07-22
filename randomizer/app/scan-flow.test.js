"use strict";

const assert = require("node:assert/strict");
const { createScanFlowHelpers } = require("./scan-flow");
const { createDecisionSessionStore } = require("../game/effects/decision-session-store");
const { attachDecisionState } = require("./test-decision-state");

function createBaseHarness() {
  const pendingState = {
    actionEffectFlow: { delayedPublicRefills: [] },
    cardSelectionAction: null,
    handScanAction: null,
  };
  const cardState = {
    publicCards: [],
  };
  const rocketState = {
    statusNote: "",
  };
  const player = {
    id: "p1",
    color: "white",
    colorLabel: "白色",
    resources: {
      additionalPublicScan: 0,
      credits: 3,
    },
    hand: [],
  };
  const calls = {
    picker: [],
    history: [],
    confirmSync: 0,
    handSync: 0,
    cardSync: 0,
    statsRender: 0,
    publicRender: 0,
    actionButtons: 0,
    publicControls: 0,
    stateReadout: 0,
    discardPublic: [],
    abilityPlayers: [],
  };
  const decisionSessions = createDecisionSessionStore();
  attachDecisionState(pendingState, decisionSessions);
  const workingRoot = {
    match: {},
    alienGameState: {},
    cardState,
    nebulaDataState: {},
    playerState: { currentPlayerId: "p1", players: [player] },
    rocketState,
    solarState: { aomomoActive: false, sectorBySlot: {} },
    turnState: { roundNumber: 1, turnNumber: 1 },
  };

  const helpers = createScanFlowHelpers({
    decisionSessions,
    clearPendingAmibaSymbolChoice() {},
    clearPendingRunezuSymbolBranch() {},
    clearPendingRunezuFaceSymbolPlacement() {},
    getPendingYichangdianCornerAction() { return null; },
    clearPendingAmibaCardGain() {},
    clearPendingAomomoCardGain() {},
    clearPendingRunezuCardGain() {},
    clearPendingAmibaTraceRemoval() {},
    cards: {
      getCardLabel: (card) => card.cardName || card.id,
      setSelectionActive: (_state, active) => {
        calls.lastSelectionActive = active;
      },
    },
    players: {
      getCurrentPlayer: (state) => state.players.find((entry) => entry.id === state.currentPlayerId),
      canAfford: () => true,
      spendResources: (target, cost) => {
        target.spent = cost;
      },
    },
    data: {
      NEBULA_IDS: ["n1", "n2"],
      getNebulaColor: () => "blue",
      getNebulaLabel: (id) => `Sector ${id}`,
      isSectorReadyToSettle: (_state, id) => id === "n1",
      getSectorRanking: () => [{ playerId: "p1", count: 1 }],
      getSectorWinMarkerConfig: () => ({ firstKind: "circle" }),
    },
    scanEffects: {
      EFFECT_TYPES: {
        SECTOR_FINISH_SCAN: "sector_finish_scan",
        PUBLIC_CARD_SCAN: "public_card_scan",
      },
      canExecuteScan: () => ({ ok: true }),
      getStandardScanCost: () => ({ credits: 1 }),
      buildScanEffectQueue: (_player, options) => [{ id: `scan-${options.scanRunId}`, status: "pending" }],
    },
    abilities: {
      executeAbility(_abilityId, actionContext, options) {
        const target = actionContext.playerState.players
          .find((entry) => entry.id === actionContext.playerState.currentPlayerId);
        calls.abilityPlayers.push(target);
        target.resources.credits -= Number(options.cost?.credits || 0);
        return { ok: true, message: "扫描支付成功", cost: options.cost, commands: [{ type: "scan-cost" }] };
      },
      chain: {
        startAbilityChain(id, label, effects) {
          return { id, label, effects, currentIndex: 0 };
        },
      },
    },
    planetRewards: {
      EFFECT_TYPES: {
        GAIN_RESOURCES: "gain_resources",
        ALIEN_TRACE: "alien_trace",
      },
    },
    historyCommands: {
      createResourceSpendCommand: (_target, cost) => ({ type: "spend", cost }),
    },
    pendingState,
    cardState,
    nebulaDataState: {},
    rocketState,
    playerState: { currentPlayerId: "p1", players: [player] },
    els: { appWrap: { classList: { toggle() {} } } },
    PUBLIC_SCAN_MAX_BONUS_CARDS: 2,
    SECTOR_FINISH_ICON_BY_COLOR: { blue: "blue_finish" },
    SECTOR_WIN_REWARDS: { n1: { first: [{ resource: "score", amount: 2 }] } },
    getPublicScanChoicesForCard: (card) => ({
      ok: true,
      scanCode: card.scanActionCode || 1,
      scanLabel: "蓝色扫描",
      choices: [{ nebulaId: "n1", label: "Sector n1", description: "choice" }],
    }),
    renderStateReadout: () => { calls.stateReadout += 1; },
    renderPlayerStats: () => { calls.statsRender += 1; },
    renderPublicCards: () => { calls.publicRender += 1; },
    renderPlayerHand: () => {},
    updatePublicCardControls: () => { calls.publicControls += 1; },
    updateActionButtons: () => { calls.actionButtons += 1; },
    syncPublicScanConfirmButton: () => { calls.confirmSync += 1; },
    syncCardSelectionChrome: () => { calls.cardSync += 1; },
    syncHandScanSelectionChrome: () => { calls.handSync += 1; },
    openScanTargetPicker: (_workingRoot, config) => {
      calls.picker.push(config);
      return { ok: true, config };
    },
    beginEffectHistoryStep: (label) => { calls.history.push(label); },
    endEffectHistoryStep: () => {},
    recordHistoryCommand: (command) => { calls.history.push(command); },
    recordAbilityCommands: () => {},
    isTechTilePickingActive: () => false,
    isCardSelectionActive: () => false,
    isDiscardSelectionActive: () => false,
    isPlayCardSelectionActive: () => false,
    isMovePaymentSelectionActive: () => false,
    isHandScanSelectionActive: (root) => root?.match?.handScanContinuation != null,
    discardPublicScanCard: (payload) => {
      calls.discardPublic.push(payload);
      return { ok: true };
    },
    getFlowMarkedNebulaIds: () => ["n1"],
    normalizeResourceCost: (cost) => cost || {},
    createActionContext: (workingRoot) => ({ playerState: workingRoot.playerState }),
    canStartMainAction: () => true,
    getMainActionStartBlockReason: () => null,
    HISTORY_SOURCE_MAIN: "main",
    startActionLogDraft: () => {},
    actionHistory: {
      beginSession: () => {},
      beginStep: () => {},
      endStep: () => ({ id: "scan-cost-step", label: "扫描费用" }),
      rollbackSession: () => {},
    },
    clearHistoryStepOrderForSource: () => {},
    removeActionLogStepsBySource: () => {},
    maybeConsumeAlienLabPanelForMainAction: (_family, result) => result,
    rememberHistoryStep: () => {},
    appendActionLogStep: () => {},
    actionLogOptionsFromHistoryStep: () => ({}),
    createScanRunId: () => "production-run",
    assignEffectFlowOwner: () => {},
    enrichScanResultEvents: () => {},
    renderSectors: () => {},
    insertActionEffectsAfterCurrent: () => {},
    completeCurrentActionEffect: () => {},
    finishAutomaticRewardEffect: (_effect, result) => result,
    setActiveEffectFlowOwner: () => {},
    getNormalTokenAssetForPlayer: () => "",
    renderSectorNebulaDataBoard: () => {},
    renderAlienPanels: () => {},
    renderRockets: () => {},
    assignEffectOwner: (effect) => effect,
    activateNextActionEffect: () => {},
    getPendingOwnerFields: () => ({}),
    withPendingOwnerPlayer: (_pending, callback) => callback(),
    confirmIndustryHeliosRemoveTech: () => ({ ok: true }),
    isActionEffectFlowActive: () => false,
    skipActionEffectWithMessage: (_effect, message) => ({ ok: true, skipped: true, message }),
    getCurrentActionEffect: () => null,
    applyAomomoScanCostAndBonus: (_pending, result) => result,
    maybeReturnPlayedCardToHandAfterSectorScan: () => {},
    maybeCompleteActionEffectFromScan: () => {},
    markCurrentActionIrreversible: () => {},
    syncInteractionFocusChrome: () => {},
    openYichangdianCornerPicker: () => ({ ok: true }),
    rollbackPendingIndustryQuickAction: () => {},
    beginCardSelection: (pending) => ({ ok: true, pending }),
  });

  return {
    helpers,
    calls,
    pendingState,
    cardState,
    rocketState,
    player,
    decisionSessions,
    workingRoot,
  };
}

{
  const { helpers, pendingState } = createBaseHarness();
  const card = { id: "c1", cardName: "Card 1" };
  const registered = helpers.registerDelayedPublicRefill("run-1", 2, card);
  assert.equal(registered.cardLabel, "Card 1");
  const updated = helpers.registerDelayedPublicRefill("run-1", 2, { id: "c1b", cardName: "Card 1B" });
  assert.equal(updated.cardLabel, "Card 1B");
  assert.equal(helpers.getDelayedPublicRefillSlots("run-1").length, 1);
  assert.equal(helpers.cloneDelayedPublicRefills(pendingState.actionEffectFlow)[0].slotIndex, 2);
  helpers.clearDelayedPublicRefillSlots("run-1");
  assert.deepEqual(helpers.getDelayedPublicRefillSlots("run-1"), []);
}

{
  const { helpers, workingRoot } = createBaseHarness();
  const effects = helpers.buildScanFinalizeFollowupEffects(workingRoot, "run-1");
  assert.equal(effects.length, 1);
  assert.equal(effects[0].type, "sector_finish_scan");
  assert.equal(effects[0].playerId, "p1");
  assert.equal(effects[0].icon, "blue_finish");
}

{
  const { helpers, pendingState, cardState, rocketState, calls, workingRoot } = createBaseHarness();
  pendingState.cardSelectionAction = { type: "public_scan", maxSelectable: 1 };
  cardState.publicCards = [{ id: "pub-1", cardName: "Public 1" }];
  const result = helpers.handlePublicScanCardClick(workingRoot, 0);
  assert.equal(result.ok, true);
  assert.equal(pendingState.cardSelectionAction, null);
  assert.equal(calls.cardSync, 1);
  assert.equal(calls.picker.length, 1);
  assert.match(rocketState.statusNote, /Public 1/);
}

{
  const { helpers, pendingState, cardState, player, rocketState, calls, workingRoot } = createBaseHarness();
  pendingState.cardSelectionAction = {
    type: "public_scan",
    selectedSlots: [0, 1],
    maxSelectable: 2,
    minSelectable: 1,
    player,
    scanRunId: "scan-1",
    deferPublicRefill: true,
  };
  cardState.publicCards = [
    { id: "pub-1", cardName: "Public 1" },
    { id: "pub-2", cardName: "Public 2" },
  ];
  const result = helpers.confirmPublicScanSelection(workingRoot);
  assert.equal(result.ok, true);
  assert.equal(calls.discardPublic.length, 2);
  assert.equal(workingRoot.match.publicScanContinuation.items.length, 2);
  assert.equal(workingRoot.match.publicScanContinuation.deferPublicRefill, true);
  assert.match(rocketState.statusNote, /已弃除 2 张牌/);
  assert.equal(calls.picker.length, 1);
}

{
  const { helpers, pendingState, player, rocketState, calls, workingRoot } = createBaseHarness();
  player.hand = [{ id: "hand-1", cardName: "Hand 1" }];
  const begin = helpers.beginHandScan(workingRoot);
  assert.equal(begin.ok, true);
  assert.equal(workingRoot.match.handScanContinuation.type, "hand_scan");
  assert.equal(workingRoot.match.handScanContinuation.playerId, player.id);
  assert.equal(calls.handSync, 1);
  assert.match(rocketState.statusNote, /请选择一张手牌/);

  helpers.cancelHandScanSelection(workingRoot);
  assert.equal(workingRoot.match.handScanContinuation, undefined);
  assert.equal(calls.handSync, 2);
  assert.match(rocketState.statusNote, /已取消手牌扫描/);
}

{
  const { helpers, pendingState, player, rocketState, calls, workingRoot } = createBaseHarness();
  player.hand = [{ id: "hand-1", cardName: "Hand 1" }];
  workingRoot.match.handScanContinuation = { type: "hand_scan", playerId: player.id };
  const result = helpers.handleHandScanCardClick(workingRoot, 0);
  assert.equal(result.ok, true);
  assert.equal(workingRoot.match.handScanContinuation, undefined);
  assert.equal(calls.picker.length, 1);
  assert.match(rocketState.statusNote, /Hand 1/);
}

{
  const { helpers, player: boundPlayer, cardState: boundCardState, rocketState: boundRocketState } = createBaseHarness();
  boundPlayer.resources.credits = 99;
  const beforeBoundPlayer = structuredClone(boundPlayer);
  const beforeBoundCardState = structuredClone(boundCardState);
  const beforeBoundRocketState = structuredClone(boundRocketState);
  const workingPlayer = {
    id: "working-player",
    color: "blue",
    resources: { credits: 4, additionalPublicScan: 0 },
    hand: [],
  };
  const workingRoot = {
    playerState: { currentPlayerId: "working-player", players: [workingPlayer] },
    turnState: { roundNumber: 3, turnNumber: 5 },
    rocketState: { statusNote: "" },
  };
  const result = helpers.executeMainScanAction(workingRoot, {
    family: "scan",
    actorId: "working-player",
    target: { kind: "standard-scan" },
  });
  assert.equal(result.ok, true);
  assert.equal(workingPlayer.resources.credits, 3);
  assert.equal(result.effects[0].id, "scan-production-run");
  assert.deepEqual(boundPlayer, beforeBoundPlayer, "生产 scan 不得写入闭包绑定玩家");
  assert.deepEqual(boundCardState, beforeBoundCardState, "生产 scan 不得写入闭包绑定 cardState");
  assert.deepEqual(boundRocketState, beforeBoundRocketState, "生产 scan 不得写入闭包绑定 rocketState");
}

{
  const { helpers } = createBaseHarness();
  assert.throws(
    () => helpers.handlePublicScanCardClick(undefined, 0),
    /explicit workingRoot/,
    "stateful scan operation 缺 root 必须立即失败",
  );
}

{
  const { helpers, cardState: boundCardState, rocketState: boundRocketState, workingRoot } = createBaseHarness();
  const beforeBoundCardState = structuredClone(boundCardState);
  const beforeBoundRocketState = structuredClone(boundRocketState);
  const isolatedRoot = structuredClone(workingRoot);
  isolatedRoot.cardState.publicCards = [{ id: "isolated-card", cardName: "Isolated" }];

  const result = helpers.handlePublicScanCardClick(isolatedRoot, 0);

  assert.equal(result.ok, true);
  assert.match(isolatedRoot.rocketState.statusNote, /Isolated/);
  assert.deepEqual(boundCardState, beforeBoundCardState, "隔离 root 操作不得读取或写入绑定 cardState");
  assert.deepEqual(boundRocketState, beforeBoundRocketState, "隔离 root 操作不得写入绑定 rocketState");
}

{
  const { helpers, pendingState, player: boundPlayer, workingRoot } = createBaseHarness();
  boundPlayer.hand = [{ id: "bound-hand", cardName: "Bound Hand" }];
  const beforeBoundPlayer = structuredClone(boundPlayer);
  const isolatedRoot = structuredClone(workingRoot);
  const isolatedPlayer = isolatedRoot.playerState.players[0];
  isolatedPlayer.hand = [{ id: "isolated-hand", cardName: "Isolated Hand" }];

  const result = helpers.beginHandScan(isolatedRoot);

  assert.equal(result.ok, true);
  assert.equal(isolatedRoot.match.handScanContinuation.playerId, isolatedPlayer.id, "手牌扫描 continuation 必须绑定 working root 玩家 ID");
  assert.deepEqual(boundPlayer, beforeBoundPlayer, "手牌扫描不得读取或改写闭包基线玩家");
}

{
  const { helpers, calls, player: boundPlayer, workingRoot } = createBaseHarness();
  const beforeBoundPlayer = structuredClone(boundPlayer);
  const isolatedRoot = structuredClone(workingRoot);
  const isolatedPlayer = isolatedRoot.playerState.players[0];

  const result = helpers.replaceNebulaDataForCurrentPlayer(isolatedRoot, "n1");

  assert.equal(result.ok, true);
  assert.equal(calls.abilityPlayers.at(-1), isolatedPlayer, "星云替换 ability context 必须使用 working root 玩家");
  assert.deepEqual(boundPlayer, beforeBoundPlayer, "星云替换不得读取或改写闭包基线玩家");
}

{
  const { helpers, player: boundPlayer, workingRoot } = createBaseHarness();
  boundPlayer.color = "white";
  boundPlayer.colorLabel = "闭包白色";
  const isolatedRoot = structuredClone(workingRoot);
  const isolatedPlayer = isolatedRoot.playerState.players[0];
  isolatedPlayer.color = "blue";
  isolatedPlayer.colorLabel = "隔离蓝色";

  const target = helpers.getSectorFinishWinnerTarget(isolatedRoot, "n1");
  const rewards = helpers.buildSectorSettlementRewardEffects(isolatedRoot, {
    ok: true,
    sectorId: "n1",
    settlementNumber: 1,
    participants: [{ playerId: isolatedPlayer.id }],
    winner: { playerId: isolatedPlayer.id },
  });

  assert.equal(target.playerColor, "blue", "扇区赢家必须从 working root 解析");
  assert.equal(target.playerLabel, "隔离蓝色");
  assert.ok(rewards.every((effect) => effect.playerColor === "blue"), "参与/赢家奖励必须指向 working root 玩家");
  assert.match(rewards[0].label, /隔离蓝色/);
}

console.log("scan-flow tests passed");
