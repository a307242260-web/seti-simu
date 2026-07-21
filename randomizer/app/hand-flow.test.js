"use strict";

const assert = require("node:assert/strict");
const { createHandFlow } = require("./hand-flow");
const { createDecisionSessionStore } = require("../game/effects/decision-session-store");

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
  const events = overrides.events || {};
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
    events,
    decisionSessions: overrides.decisionSessions || createDecisionSessionStore(),
    pendingState,
    cardState,
    rocketState,
    alienGameState: {},
    turnState: {},
    solarState: {},
    els: makeEls(),
    players: {
      getCurrentPlayer(playerState) {
        return playerState?.players?.find((entry) => entry.id === playerState.currentPlayerId) || null;
      },
      canAfford(currentPlayer, cost = {}) {
        return (Number(currentPlayer.resources.credits || 0) >= Number(cost.credits || 0))
          && (Number(currentPlayer.resources.energy || 0) >= Number(cost.energy || 0));
      },
      spendResources(currentPlayer, cost = {}) {
        if (!this.canAfford(currentPlayer, cost)) return { ok: false, message: "资源不足" };
        for (const [key, value] of Object.entries(cost)) {
          currentPlayer.resources[key] = Number(currentPlayer.resources[key] || 0) - Number(value || 0);
        }
        return { ok: true };
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
    cardEffects: {
      getCardModel(card) {
        return card?.model || null;
      },
      buildPlayEffects(card) {
        return card?.playEffects || [];
      },
      getTemporaryTasks(card) {
        return card?.temporaryTasks || [];
      },
      ensureCardEffectState(card) {
        card.effectStateReady = true;
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
    fangzhou: overrides.fangzhou || null,
    banrenma: overrides.banrenma || null,
    chong: overrides.chong || null,
    amiba: overrides.amiba || null,
    aomomo: overrides.aomomo || null,
    runezu: overrides.runezu || null,
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
    markActionPending() {
      events.markedPending = (events.markedPending || 0) + 1;
    },
    renderPlayerHand() {},
    renderPlayerStats() {},
    renderReservedCards() {
      events.renderReservedCards = (events.renderReservedCards || 0) + 1;
    },
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
    executeCardEffectMove(_deltaX, _deltaY, _rocketId, payment) {
      events.cardEffectMovePayment = payment;
      return { ok: true, payment };
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
    applyIndustryPlayCardPassives() {
      return { ok: true };
    },
    buildPlayCardEffectFlowQueue(_workingRoot, _player, _card, effects) {
      return { effects: effects || [], deferredEndEffects: [] };
    },
    createImmediatePlayCardEvent(card, player, cost) {
      return { type: "immediatePlayCard", cardId: card.id, playerId: player.id, cost };
    },
    createPlayCardEvent(card, player, cost) {
      return { type: "playCard", cardId: card.id, playerId: player.id, cost };
    },
    recordPlayCardStart(_player, card) {
      events.recordedPlayCard = card.id;
    },
    startPlayCardEffectFlow(flowId, label, effects, payload) {
      events.startedPlayFlow = { flowId, label, effects, payload };
    },
    appendIndustryPlayPassiveStatus(_workingRoot, result) {
      events.lastIndustryPassiveResult = result;
    },
    recordMainActionIrreversibleBarrier(label, message, code) {
      events.irreversibleBarrier = { label, message, code };
    },
    renderFangzhouCardDisplays() {
      events.renderFangzhou = (events.renderFangzhou || 0) + 1;
    },
    getFangzhouCard1RewardTargetOptions() {
      return { targetPlayerId: player.id };
    },
    getTargetPlayerOptions() {
      return [{ id: player.id }];
    },
    buildFangzhouCard1EffectQueue(effect, label) {
      return [{ id: "fangzhou-effect", label, options: { effect } }];
    },
    applyIncomeFromCard() {
      events.incomeApplied = (events.incomeApplied || 0) + 1;
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
    getCardTypeCode(card) {
      return Number(card?.typeCode || 0);
    },
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
  const boundPlayer = {
    id: "bound-player",
    color: "white",
    resources: { credits: 9, energy: 0, handSize: 1 },
    hand: [{ id: "poison-card", label: "闭包毒牌", price: 1, typeCode: 4 }],
  };
  const context = createBaseContext(boundPlayer);
  const handFlow = createHandFlow(context);
  const workingPlayer = structuredClone(boundPlayer);
  workingPlayer.id = "working-player";
  workingPlayer.hand[0].id = "working-card";
  const workingRoot = {
    playerState: { currentPlayerId: "working-player", players: [workingPlayer] },
    cardState: { playCardSelectionActive: false, discardSelectionActive: false, discardPile: [], publicCards: [] },
    alienGameState: {},
    rocketState: { statusNote: "" },
    turnState: { roundNumber: 2, turnNumber: 3 },
  };
  const beforeBoundPlayer = structuredClone(boundPlayer);
  const beforeBoundCardState = structuredClone(context.cardState);
  const result = handFlow.executeStandardPlayCard(workingRoot, {
    family: "play_card",
    actorId: "working-player",
    target: { cardInstanceId: "working-card" },
  });
  assert.equal(result.ok, true);
  assert.equal(workingPlayer.resources.credits, 8);
  assert.equal(workingPlayer.hand.length, 0);
  assert.equal(workingRoot.cardState.discardPile[0].id, "working-card");
  assert.equal(result.history[0].beforePlayer.id, "working-player");
  assert.equal(result.history[0].beforeCardState.discardPile.length, 0);
  assert.equal(result.events.every((event) => event.playerId === "working-player"), true);
  assert.deepEqual(boundPlayer, beforeBoundPlayer, "生产 play_card 不得写入闭包绑定玩家");
  assert.deepEqual(context.cardState, beforeBoundCardState, "生产 play_card 不得写入闭包绑定 cardState");
}

{
  const boundPlayer = {
    id: "bound-player",
    color: "white",
    resources: { credits: 1, publicity: 0, handSize: 1 },
    hand: [{ id: "bound-card", label: "闭包角标", cornerAction: { actionKind: "reward", label: "宣传", reward: { gain: { publicity: 2 } } } }],
  };
  const context = createBaseContext(boundPlayer);
  const handFlow = createHandFlow(context);
  const workingPlayer = structuredClone(boundPlayer);
  workingPlayer.id = "working-player";
  workingPlayer.hand[0].id = "working-card";
  const workingRoot = {
    playerState: { currentPlayerId: "working-player", players: [workingPlayer] },
    cardState: { discardPile: [], publicCards: [] },
    alienGameState: {},
    rocketState: { statusNote: "" },
    turnState: { roundNumber: 2, turnNumber: 7 },
  };
  const boundBefore = structuredClone({ player: boundPlayer, cardState: context.cardState });
  const result = handFlow.executeStandardCardCornerAction(workingRoot, {
    family: "card_corner",
    actorId: "working-player",
    target: { cardInstanceId: "working-card" },
  });
  assert.equal(result.ok, true);
  assert.equal(workingPlayer.hand.length, 0);
  assert.equal(workingPlayer.resources.publicity, 2);
  assert.equal(workingRoot.cardState.discardPile[0].id, "working-card");
  assert.equal(workingRoot.turnState.turnNumber, 7, "card_corner quick 不得消耗主行动或推进回合");
  assert.deepEqual(boundPlayer, boundBefore.player, "生产 card_corner 不得写入闭包绑定玩家");
  assert.deepEqual(context.cardState, boundBefore.cardState, "生产 card_corner 不得写入闭包绑定 cardState");
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
    resources: { credits: 0, energy: 1, handSize: 0 },
    hand: [],
  };
  const events = {};
  const decisionSessions = createDecisionSessionStore();
  decisionSessions.open("move_payment", {
      player,
      deltaX: 1,
      deltaY: 0,
      rocketId: 7,
      requiredMovePoints: 1,
      selectedHandIndices: [],
      cardMoveEffectContext: { terrainRequired: 2, poolUsed: 1 },
  });
  const context = createBaseContext(player, { events, decisionSessions });
  const handFlow = createHandFlow(context);
  const result = handFlow.confirmMovePayment({ automated: true });
  assert.equal(result.ok, true);
  assert.equal(events.cardEffectMovePayment.terrainRequired, 2);
  assert.equal(events.cardEffectMovePayment.poolUsed, 1);
  assert.equal(events.cardEffectMovePayment.energyCost, 1);
  assert.equal(decisionSessions.peek("move_payment"), null);
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

{
  const player = {
    id: "player-1",
    color: "white",
    resources: { credits: 3, energy: 0, handSize: 1 },
    hand: [{ id: "play-card", label: "普通牌", price: 2, typeCode: 4 }],
  };
  const context = createBaseContext(player);
  const handFlow = createHandFlow(context);
  assert.equal(handFlow.beginPlayCardSelection().ok, true);
  assert.equal(handFlow.handlePlayCardSelect(0).ok, true);
  const result = handFlow.confirmPlayCardSelection();
  assert.equal(result.ok, true);
  assert.equal(player.resources.credits, 1);
  assert.equal(player.hand.length, 0);
  assert.equal(context.cardState.discardPile.length, 1);
}

{
  const player = {
    id: "player-1",
    color: "white",
    resources: { credits: 3, energy: 0, score: 1, handSize: 1 },
    hand: [{ id: "alien-card", label: "虫牌", price: 1, typeCode: 2 }],
    reservedCards: [],
  };
  const context = createBaseContext(player, {
    chong: {
      isChongCard(card) {
        return card.id === "alien-card";
      },
      getCardTask() {
        return { id: "task-1" };
      },
      buildImmediateEffects() {
        return [{ id: "effect-1" }];
      },
    },
  });
  const handFlow = createHandFlow(context);
  assert.equal(handFlow.beginPlayCardSelection().ok, true);
  assert.equal(handFlow.handlePlayCardSelect(0).ok, true);
  const result = handFlow.confirmPlayCardSelection();
  assert.equal(result.ok, true);
  assert.equal(player.hand.length, 0);
  assert.equal(player.reservedCards.length, 1);
  assert.equal(player.reservedCards[0].chongCard, true);
  assert.equal(context.events.startedPlayFlow.flowId, "chong-play-card-effects");
}

{
  const player = {
    id: "player-1",
    color: "white",
    resources: { credits: 5, energy: 0, handSize: 1 },
    hand: [{ id: "fangzhou-2", label: "方舟高级牌" }],
  };
  const context = createBaseContext(player, {
    fangzhou: {
      CARD2_PLAY_COST: { credits: 3 },
      isFangzhouCard2(card) {
        return card.id === "fangzhou-2";
      },
      flipCard1Reward() {
        return { ok: true, effect: { id: "reward-1" }, label: "翻开奖励" };
      },
    },
  });
  const handFlow = createHandFlow(context);
  assert.equal(handFlow.beginPlayCardSelection().ok, true);
  assert.equal(handFlow.handlePlayCardSelect(0).ok, true);
  const result = handFlow.confirmPlayCardSelection();
  assert.equal(result.ok, true);
  assert.equal(player.resources.credits, 2);
  assert.equal(context.cardState.discardPile.length, 1);
  assert.equal(context.events.startedPlayFlow.flowId, "fangzhou-card2-play-effects");
  assert.equal(context.events.irreversibleBarrier.code, "fangzhou_card1_flip");
}

{
  const player = {
    id: "player-1",
    color: "white",
    resources: { credits: 0, energy: 0, handSize: 1 },
    hand: [{ id: "income-card", label: "收入牌" }],
  };
  const context = createBaseContext(player);
  const handFlow = createHandFlow(context);
  assert.equal(handFlow.beginDiscardSelection(1, { type: "income", player }).ok, true);
  const result = handFlow.handleHandCardDiscard(0);
  assert.equal(result.ok, true);
  assert.equal(context.events.incomeApplied, 1);
}

{
  const player = {
    id: "player-1",
    color: "white",
    resources: { credits: 0, energy: 0, handSize: 1 },
    hand: [{ id: "initial-income-card", label: "初始收入牌" }],
  };
  const effect = { id: "initial-income-player-1-1", status: "active", result: null };
  const context = createBaseContext(player);
  context.isIncomeDiscardActionType = (type) => type === "initial_income";
  context.getCurrentActionEffect = () => effect;
  context.completeCurrentActionEffect = () => {
    context.events.completedInitialIncome = (context.events.completedInitialIncome || 0) + 1;
    effect.status = "completed";
  };
  context.applyIncomeFromCard = () => ({
    ok: true,
    gain: { credits: 1 },
    message: "初始收入完成",
  });
  const handFlow = createHandFlow(context);
  assert.equal(handFlow.beginDiscardSelection(1, {
    type: "initial_income",
    player,
    fromEffectFlow: true,
  }).ok, true);
  const result = handFlow.handleHandCardDiscard(0);
  assert.equal(result.ok, true);
  assert.equal(context.events.completedInitialIncome, 1);
  assert.equal(effect.status, "completed");
  assert.equal(effect.result.payload.gain.credits, 1);
}

console.log("hand-flow tests passed");
