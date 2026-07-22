"use strict";

const assert = require("node:assert/strict");
const { createCardRuntime } = require("./card-runtime");

function createHarness() {
  const player = { id: "p1", hand: [] };
  const effect = { id: "pass-effect", label: "PASS 精选", result: null };
  const cardState = { publicCards: [], discardPile: [] };
  const pendingState = {
    passReserveSelection: null,
  };
  const uiRuntimeState = { passReserveSelectionDismissed: false, passReserveSelectedCardId: null };
  const calls = { completed: 0, chrome: 0, roots: [] };
  const recordInactive = (workingRoot) => {
    calls.roots.push(workingRoot);
    return false;
  };
  const runtime = createCardRuntime({
    pendingState,
    uiRuntimeState,
    els: {},
    renderRuntime: { renderPublicCards: () => {} },
    hideCardHoverPreview: () => {},
    cards: {
      setSelectionActive: () => {},
      getCardLabel: (card) => card.label || card.id,
      getPassReservePile: () => [{ id: "reserve-1", label: "预留牌" }],
      pickPassReserveCard: (_state, target, _round, cardId) => {
        const card = { id: cardId, label: "预留牌" };
        target.hand.push(card);
        return { ok: true, card, message: "PASS 精选完成" };
      },
      blindDraw: (activeCardState, activePlayerState, target) => ({
        ok: true,
        card: { activeCardState, activePlayerState, target },
      }),
    },
    players: {
      getCurrentPlayer: (state) => state.players.find((entry) => entry.id === state.currentPlayerId) || null,
    },
    getCurrentActionEffect: () => effect,
    rocketActions: {
      getMovableTokensForPlayer: () => [{ id: "rocket-1" }],
      getActiveRocket: () => null,
    },
    structuredClone,
    beginEffectHistoryStep: () => {},
    getGameplayLockReason: (workingRoot) => {
      calls.roots.push(workingRoot);
      return null;
    },
    isTechTilePickingActive: recordInactive,
    isCardSelectionActive: recordInactive,
    isDiscardSelectionActive: recordInactive,
    isPlayCardSelectionActive: recordInactive,
    isHandScanSelectionActive: recordInactive,
    isMovePaymentSelectionActive: recordInactive,
    isIndustryHandSelectionActive: recordInactive,
    hasActivePendingSubFlow: recordInactive,
    recordHistoryCommand: () => {},
    historyCommands: {
      createRestorePlayerCommand: () => ({}),
      createRestoreObjectCommand: () => ({}),
    },
    completeCurrentActionEffect: () => { calls.completed += 1; },
    syncCardSelectionChrome: () => { calls.chrome += 1; },
    renderPlayerHand: () => {},
    renderPlayerStats: () => {},
    renderPublicCards: () => {},
    updatePublicCardControls: () => {},
    updateActionButtons: () => {},
    maybeContinuePendingTurnEndRevealFlow: () => {},
    renderStateReadout: () => {},
    continueAfterCardTriggerResolution: () => false,
    activateMoveMode: () => {},
    selectDefaultRocketForCurrentPlayer: () => {},
    syncPassReserveSelectionChrome: () => { calls.chrome += 1; },
  });
  const workingRoot = {
    match: {},
    cardState,
    playerState: { currentPlayerId: player.id, players: [player] },
    turnState: { roundNumber: 2 },
    rocketState: { statusNote: "" },
  };
  return { runtime, workingRoot, player, effect, pendingState, uiRuntimeState, calls };
}

{
  const { runtime, workingRoot, calls } = createHarness();
  assert.equal(runtime.canUseCardCornerQuickAction(workingRoot), true);
  assert.ok(calls.roots.length >= 9);
  assert.ok(calls.roots.every((root) => root === workingRoot), "卡牌快速行动门禁必须显式读取同一 workingRoot");
}

{
  const { runtime, workingRoot, player } = createHarness();
  const isolatedPlayer = { id: "p2", hand: [] };
  const isolatedRoot = {
    ...workingRoot,
    cardState: { publicCards: [{ id: "isolated-card" }], discardPile: [] },
    playerState: { currentPlayerId: isolatedPlayer.id, players: [isolatedPlayer] },
  };
  const result = runtime.drawBasicCardToPlayer(isolatedRoot);
  assert.equal(result.card.activeCardState, isolatedRoot.cardState);
  assert.equal(result.card.activePlayerState, isolatedRoot.playerState);
  assert.equal(result.card.target, isolatedPlayer);
  assert.equal(player.hand.length, 0);
  assert.throws(() => runtime.cancelCardSelection(null), /explicit workingRoot/);
}

{
  const { runtime, workingRoot, pendingState } = createHarness();
  const result = runtime.beginCardCornerFreeMove(
    workingRoot,
    { label: "免费移动", movementPoints: 1 },
    { id: "card-1", label: "测试牌" },
    [{ type: "card_discard" }],
  );
  assert.equal(result.ok, true);
  const session = workingRoot.match.cardCornerFreeMoveContinuation;
  assert.equal(session.action.label, "免费移动");
  assert.equal(session.discardedCardLabel, "测试牌");
  assert.deepEqual(session.deferredEvents, [{ type: "card_discard" }]);
  assert.equal(Object.hasOwn(pendingState, "cardCornerFreeMove"), false);
}

{
  const { runtime, workingRoot, pendingState, uiRuntimeState } = createHarness();
  workingRoot.match.cardSelectionContinuation = { type: "public_scan" };
  uiRuntimeState.cardSelectionType = "public_scan";
  runtime.cancelCardSelection(workingRoot);
  assert.equal(workingRoot.match.cardSelectionContinuation, undefined);
  assert.equal(uiRuntimeState.cardSelectionType, null);
}

{
  const { runtime, workingRoot, player, effect, uiRuntimeState, calls } = createHarness();
  workingRoot.match.passReserveContinuation = {
    effectId: effect.id,
    playerId: player.id,
    roundNumber: 2,
  };
  runtime.selectPassReserveCard(workingRoot, "reserve-1");
  const dismissed = runtime.dismissPassReserveSelectionOverlay(workingRoot);
  assert.equal(dismissed.dismissed, true);
  assert.equal(uiRuntimeState.passReserveSelectionDismissed, true);
  assert.ok(workingRoot.match.passReserveContinuation);

  assert.equal(workingRoot.match.passReserveContinuation.selectedCardId, undefined);
  assert.equal(uiRuntimeState.passReserveSelectedCardId, "reserve-1");
  const result = runtime.confirmPassReserveSelection(workingRoot, "reserve-1");
  assert.equal(result.ok, true);
  assert.equal(player.hand[0].id, "reserve-1");
  assert.equal(workingRoot.match.passReserveContinuation, undefined);
  assert.equal(uiRuntimeState.passReserveSelectionDismissed, false);
  assert.equal(uiRuntimeState.passReserveSelectedCardId, null);
  assert.equal(calls.completed, 1);
}

console.log("card-runtime tests passed");
