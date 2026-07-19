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
  };
  const decisionSessions = createDecisionSessionStore();
  attachDecisionState(pendingState, decisionSessions);

  const helpers = createScanFlowHelpers({
    decisionSessions,
    cards: {
      getCardLabel: (card) => card.cardName || card.id,
      setSelectionActive: (_state, active) => {
        calls.lastSelectionActive = active;
      },
    },
    players: {
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
    playerState: { players: [player] },
    PUBLIC_SCAN_MAX_BONUS_CARDS: 2,
    SECTOR_FINISH_ICON_BY_COLOR: { blue: "blue_finish" },
    SECTOR_WIN_REWARDS: { n1: { first: [{ resource: "score", amount: 2 }] } },
    getCurrentPlayer: () => player,
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
    openScanTargetPicker: (config) => {
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
    isHandScanSelectionActive: () => pendingState.handScanAction != null,
    discardPublicScanCard: (payload) => {
      calls.discardPublic.push(payload);
      return { ok: true };
    },
    resolvePlayerReference: (entry) => (entry?.playerId === "p1" ? player : null),
    getFlowMarkedNebulaIds: () => ["n1"],
    normalizeResourceCost: (cost) => cost || {},
    createActionContext: () => ({}),
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
  const { helpers } = createBaseHarness();
  const effects = helpers.buildScanFinalizeFollowupEffects("run-1");
  assert.equal(effects.length, 1);
  assert.equal(effects[0].type, "sector_finish_scan");
  assert.equal(effects[0].playerId, "p1");
  assert.equal(effects[0].icon, "blue_finish");
}

{
  const { helpers, pendingState, cardState, rocketState, calls } = createBaseHarness();
  pendingState.cardSelectionAction = { type: "public_scan", maxSelectable: 1 };
  cardState.publicCards = [{ id: "pub-1", cardName: "Public 1" }];
  const result = helpers.handlePublicScanCardClick(0);
  assert.equal(result.ok, true);
  assert.equal(pendingState.cardSelectionAction, null);
  assert.equal(calls.cardSync, 1);
  assert.equal(calls.picker.length, 1);
  assert.match(rocketState.statusNote, /Public 1/);
}

{
  const { helpers, pendingState, cardState, player, rocketState, calls, decisionSessions } = createBaseHarness();
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
  const result = helpers.confirmPublicScanSelection();
  assert.equal(result.ok, true);
  assert.equal(calls.discardPublic.length, 2);
  assert.equal(decisionSessions.peek("public_scan_queue").items.length, 2);
  assert.equal(decisionSessions.peek("public_scan_queue").deferPublicRefill, true);
  assert.match(rocketState.statusNote, /已弃除 2 张牌/);
  assert.equal(calls.picker.length, 1);
}

{
  const { helpers, pendingState, player, rocketState, calls } = createBaseHarness();
  player.hand = [{ id: "hand-1", cardName: "Hand 1" }];
  const begin = helpers.beginHandScan();
  assert.equal(begin.ok, true);
  assert.equal(pendingState.handScanAction.type, "hand_scan");
  assert.equal(calls.handSync, 1);
  assert.match(rocketState.statusNote, /请选择一张手牌/);

  helpers.cancelHandScanSelection();
  assert.equal(pendingState.handScanAction, null);
  assert.equal(calls.handSync, 2);
  assert.match(rocketState.statusNote, /已取消手牌扫描/);
}

{
  const { helpers, pendingState, player, rocketState, calls } = createBaseHarness();
  player.hand = [{ id: "hand-1", cardName: "Hand 1" }];
  pendingState.handScanAction = { type: "hand_scan", player };
  const result = helpers.handleHandScanCardClick(0);
  assert.equal(result.ok, true);
  assert.equal(pendingState.handScanAction, null);
  assert.equal(calls.picker.length, 1);
  assert.match(rocketState.statusNote, /Hand 1/);
}

console.log("scan-flow tests passed");
