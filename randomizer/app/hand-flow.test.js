"use strict";

const assert = require("node:assert/strict");
const { createHandFlow } = require("./hand-flow");

function makeClassList() {
  return { toggle() {} };
}

function makeEls() {
  return {
    appWrap: { classList: makeClassList() },
    playerHandPanel: { classList: makeClassList(), scrollIntoView() {} },
    handScanCancel: {},
    movePaymentConfirm: {},
    movePaymentCancel: {},
    playCardActionButton: {},
    playCardSelectionCancel: {},
    handCardPlayActionButton: {},
    cardCornerActionButton: {},
    discardSelectionBackdrop: { setAttribute() {} },
    discardSelectionCancel: {},
  };
}

function createCards() {
  return {
    setPlayCardSelectionActive(cardState, active) {
      cardState.playCardSelectionActive = active;
    },
    setDiscardSelectionActive(cardState, active, count = 0) {
      cardState.discardSelectionActive = active;
      cardState.discardRemaining = count;
    },
    getDiscardRemaining(cardState) {
      return cardState.discardRemaining || 0;
    },
    getCardLabel(card) {
      return card?.label || card?.id || "卡牌";
    },
    discardFromHandAtIndex(player, index) {
      const rounded = Math.round(index);
      if (!player?.hand?.[rounded]) return { ok: false, message: "无效的手牌位置" };
      const [card] = player.hand.splice(rounded, 1);
      player.resources.handSize = player.hand.length;
      return { ok: true, card };
    },
    addToDiscardPile(cardState, card) {
      cardState.discardPile.push(card);
    },
  };
}

function createBaseContext(player, overrides = {}) {
  const cardState = overrides.cardState || {
    playCardSelectionActive: false,
    discardSelectionActive: false,
    discardRemaining: 0,
    discardPile: [],
    publicCards: [],
  };
  const pendingState = overrides.pendingState || {
    playCardSelection: null,
    discardAction: null,
    movePayment: null,
    handScanAction: null,
    handCardPlayAction: null,
    cardCornerQuickAction: null,
    futureSpanPlayBeforePlayer: null,
    actionEffectFlow: null,
  };
  const rocketState = overrides.rocketState || { statusNote: "", activeRocketId: null };
  const cards = overrides.cards || createCards();
  const abilities = overrides.abilities || {
    executeAbility(_id, _ctx, options) {
      player.resources.energy -= Number(options?.cost?.energy || 0);
      return { ok: true, message: "移动成功", rocket: null, events: [] };
    },
  };

  return {
    pendingState,
    cardState,
    rocketState,
    alienGameState: {},
    turnState: {},
    solarState: {},
    els: makeEls(),
    players: {
      canAfford(currentPlayer, cost = {}) {
        return (Number(currentPlayer.resources.credits || 0) >= Number(cost.credits || 0))
          && (Number(currentPlayer.resources.energy || 0) >= Number(cost.energy || 0));
      },
      gainResources(currentPlayer, gain = {}) {
        for (const [key, value] of Object.entries(gain)) {
          currentPlayer.resources[key] = Number(currentPlayer.resources[key] || 0) + Number(value || 0);
        }
      },
    },
    cards,
    quickTrades: {
      finalizeTradeAfterDiscard() {
        return { ok: true, message: "交易完成" };
      },
    },
    data: {
      gainData() {
        return { ok: true };
      },
    },
    industry: {
      getFutureSpanCard() {
        return null;
      },
      markFutureSpanPlaying() {
        return { ok: true };
      },
    },
    abilities,
    historyCommands: {
      createDiscardHandCardCommand() {
        return { undo() {} };
      },
      createRestorePlayerCommand() {
        return {};
      },
      createRestoreObjectCommand() {
        return {};
      },
      createRestorePublicCardsCommand() {
        return {};
      },
    },
    quickActionHistory: {
      undoLastStep() {},
      hasUndoableStep() {
        return false;
      },
      commitSession() {},
    },
    scanEffects: {},
    fangzhou: null,
    runezu: null,
    solar: {},
    rocketActions: {
      canMoveRocket() {
        return { ok: true };
      },
    },
    MOVE_ENERGY_COST: 1,
    HISTORY_SOURCE_QUICK: "quick",
    SCORE_SOURCE_KEYS: {
      CARD_QUICK: "card_quick",
      ALIEN_CARD_QUICK: "alien_card_quick",
    },
    getCurrentPlayer() {
      return player;
    },
    getPlayerById() {
      return player;
    },
    getPlayerByColor() {
      return player;
    },
    getGameplayLockReason() {
      return null;
    },
    isTechTilePickingActive() {
      return false;
    },
    isCardSelectionActive() {
      return false;
    },
    isDiscardSelectionActive() {
      return Boolean(cardState.discardSelectionActive);
    },
    isPlayCardSelectionActive() {
      return Boolean(cardState.playCardSelectionActive);
    },
    isIndustryHandSelectionActive() {
      return false;
    },
    hasActivePendingSubFlow() {
      return false;
    },
    getHandCardPlayActionForCard(card) {
      if (!card) return null;
      return { actionKind: "play", label: "打出", cost: { credits: Number(card.price || 0) } };
    },
    getCardCornerQuickActionForCard(card) {
      return card?.cornerAction || null;
    },
    canUseCardCornerQuickAction() {
      return true;
    },
    shouldQueueCardCornerMoveQuickAction() {
      return false;
    },
    canPayForMove(_player, required) {
      return required <= 2 ? { ok: true } : { ok: false, message: "移动力不足" };
    },
    getRequiredMovePointsForUi() {
      return 2;
    },
    isMovePaymentCard(card) {
      return Number(card?.discardActionCode) === 2;
    },
    playerHasMovePaymentCard(currentPlayer) {
      return currentPlayer.hand.some((card) => Number(card.discardActionCode) === 2);
    },
    hasPlayableFutureSpanCard() {
      return false;
    },
    getStandardPlayCardActionBlockReason() {
      return null;
    },
    getCardPlayCost(card) {
      return card?.price ? { credits: Number(card.price) } : {};
    },
    formatCardPlayCost(cost) {
      return String(cost.credits || cost.energy || 0);
    },
    handleHandCardPlay(index) {
      return { ok: true, handIndex: index };
    },
    getPlayCardBeforePlayerSnapshot() {
      return structuredClone(player);
    },
    restoreObjectSnapshot(target, snapshot) {
      for (const key of Object.keys(target)) delete target[key];
      Object.assign(target, structuredClone(snapshot));
    },
    releaseFutureSpanAfterPlayWithHistory() {},
    markActionPending() {},
    renderPlayerHand() {},
    renderPlayerStats() {},
    renderPublicCards() {},
    renderInitialSelectionArea() {},
    renderAlienPanels() {},
    renderStateReadout() {},
    updatePublicCardControls() {},
    updatePlayerHandPanelTitle() {},
    updateActionButtons() {},
    setQuickPanelOpen() {},
    syncInteractionFocusChrome() {},
    openScanTargetPicker(config) {
      return { ok: true, config };
    },
    getPublicScanChoicesForCard() {
      return { ok: true, scanLabel: "蓝色扫描", scanCode: "blue", choices: [{ id: "a" }, { id: "b" }] };
    },
    executeFreeMoveForScanAction4() {
      return { ok: true };
    },
    executeFreeMoveForCardCorner() {
      return { ok: true };
    },
    executeFreeMoveForCardTrigger() {
      return { ok: true };
    },
    executeIndustryFreeMove() {
      return { ok: true };
    },
    createActionContext() {
      return {};
    },
    recordMoveActionHistory() {},
    renderRocketElement() {},
    clearMoveRocketHighlight() {},
    beginQuickActionStep() {},
    completeQuickActionStep() {},
    clearHistoryStepOrderForSource() {},
    addScoreSourceFromGain() {},
    isAlienFamilyCard() {
      return false;
    },
    applyFangzhouCard1Rewards() {
      return { ok: true, message: "方舟奖励" };
    },
    applyRunezuSymbolReward() {
      return { ok: true, message: "符文奖励" };
    },
    settleCardTasksAfterEffect() {},
    formatCardCornerRewardMessage() {
      return "宣传+2";
    },
    createCardCornerTriggerEventFields() {
      return {};
    },
    canStartCardCornerFreeMove() {
      return { ok: true, rocketsForPlayer: [{ id: 1 }] };
    },
    beginCardCornerFreeMove() {
      return { ok: true };
    },
    startCardCornerMoveEffectFlow() {},
    rollbackPendingIndustryQuickAction() {},
    continuePendingDataPlacementAfterBonus() {},
    applyIncomeFromCard() {
      return { ok: true, message: "收入完成" };
    },
    beginEffectHistoryStep() {},
    recordHistoryCommand() {},
    getCurrentActionEffect() {
      return null;
    },
    completeCurrentActionEffect() {},
    isIncomeDiscardActionType(type) {
      return type === "income";
    },
    scrollToPlayerCommandPanel() {},
    blockManualAiMovePayment() {
      return { ok: false, blocked: true };
    },
    blockIncompatiblePendingQuickAction() {
      return null;
    },
    recordQuickHistoryCommand() {},
    recordQuickTradeCompletion() {},
    formatPlanetRewardGain() {
      return "";
    },
    getDiscardCornerRewardMultiplier() {
      return 1;
    },
    requestAnimationFrame(callback) {
      callback();
    },
  };
}

{
  const player = {
    id: "player-1",
    color: "white",
    resources: { credits: 3, energy: 2, handSize: 2, publicity: 0 },
    hand: [{ id: "card-1", label: "卡 1", price: 2 }, { id: "card-2", label: "卡 2", price: 1 }],
  };
  const handFlow = createHandFlow(createBaseContext(player));
  const start = handFlow.beginPlayCardSelection();
  assert.equal(start.ok, true);
  assert.equal(handFlow.handlePlayCardSelect(0).ok, true);
  assert.deepEqual(handFlow.getPendingPlayCardSelection().handIndex, 0);
  handFlow.cancelPlayCardSelection();
  assert.equal(handFlow.getPendingPlayCardSelection(), null);
}

{
  const player = {
    id: "player-1",
    color: "white",
    resources: { credits: 0, energy: 0, handSize: 2 },
    hand: [{ id: "discard-1", label: "弃牌 A" }, { id: "discard-2", label: "弃牌 B" }],
  };
  const context = createBaseContext(player);
  const handFlow = createHandFlow(context);
  assert.equal(handFlow.beginDiscardSelection(1).ok, true);
  const result = handFlow.handleHandCardDiscard(0);
  assert.equal(result.ok, true);
  assert.equal(player.hand.length, 1);
  assert.equal(context.cardState.discardPile.length, 1);
}

{
  const player = {
    id: "player-1",
    color: "white",
    resources: { credits: 0, energy: 1, handSize: 2 },
    hand: [
      { id: "move-card", label: "移动牌", discardActionCode: 2 },
      { id: "other-card", label: "普通牌" },
    ],
  };
  const context = createBaseContext(player);
  const handFlow = createHandFlow(context);
  assert.equal(handFlow.beginMovePaymentSelection(1, 0, 7).ok, true);
  handFlow.handleHandCardMovePayment(0);
  const result = handFlow.confirmMovePayment();
  assert.equal(result.ok, true);
  assert.equal(player.hand.length, 1);
  assert.equal(player.resources.energy, 0);
}

{
  const player = {
    id: "player-1",
    color: "white",
    resources: { credits: 0, energy: 0, handSize: 1, publicity: 0 },
    hand: [{
      id: "corner-card",
      label: "角标牌",
      cornerAction: {
        actionKind: "resource",
        label: "宣传奖励",
        reward: { gain: { publicity: 2 } },
      },
    }],
  };
  const handFlow = createHandFlow(createBaseContext(player));
  assert.equal(handFlow.handleHandCardCornerQuickAction(0).ok, true);
  const result = handFlow.confirmCardCornerQuickAction();
  assert.equal(result.ok, true);
  assert.equal(player.hand.length, 0);
  assert.equal(player.resources.publicity, 2);
}

console.log("hand-flow tests passed");
