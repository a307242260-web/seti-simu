"use strict";

const assert = require("node:assert/strict");
const { createCardRuntime } = require("./card-runtime");
const { createDecisionSessionStore } = require("../game/effects/decision-session-store");
const { attachDecisionState } = require("./test-decision-state");

function createHarness() {
  const player = { id: "p1", hand: [] };
  const effect = { id: "pass-effect", label: "PASS 精选", result: null };
  const cardState = { publicCards: [], discardPile: [] };
  const pendingState = {
    cardSelectionAction: null,
    passReserveSelection: null,
  };
  const uiRuntimeState = { passReserveSelectionDismissed: false };
  const calls = { completed: 0, chrome: 0 };
  const decisionSessions = createDecisionSessionStore();
  attachDecisionState(pendingState, decisionSessions);
  const runtime = createCardRuntime({
    decisionSessions,
    pendingState,
    uiRuntimeState,
    cardState,
    playerState: { players: [player] },
    turnState: { roundNumber: 2 },
    rocketState: { statusNote: "" },
    els: {},
    renderRuntime: { renderPublicCards: () => {} },
    hideCardHoverPreview: () => {},
    cards: {
      setSelectionActive: () => {},
      getCardLabel: (card) => card.label || card.id,
      pickPassReserveCard: (_state, target, _round, cardId) => {
        const card = { id: cardId, label: "预留牌" };
        target.hand.push(card);
        return { ok: true, card, message: "PASS 精选完成" };
      },
    },
    players: {},
    getCurrentPlayer: () => player,
    getPlayerById: () => player,
    getCurrentActionEffect: () => effect,
    getMovableTokensForPlayer: () => [{ id: "rocket-1" }],
    structuredClone,
    beginEffectHistoryStep: () => {},
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
  return { runtime, player, effect, pendingState, uiRuntimeState, calls, decisionSessions };
}

{
  const { runtime, pendingState, decisionSessions } = createHarness();
  const result = runtime.beginCardCornerFreeMove(
    { label: "免费移动", movementPoints: 1 },
    { id: "card-1", label: "测试牌" },
    [{ type: "card_discard" }],
  );
  assert.equal(result.ok, true);
  const session = decisionSessions.peek("card_corner_free_move");
  assert.equal(session.action.label, "免费移动");
  assert.equal(session.discardedCardLabel, "测试牌");
  assert.deepEqual(session.deferredEvents, [{ type: "card_discard" }]);
  assert.equal(Object.hasOwn(pendingState, "cardCornerFreeMove"), false);
}

{
  const { runtime, pendingState } = createHarness();
  pendingState.cardSelectionAction = { type: "public_scan" };
  runtime.cancelCardSelection();
  assert.equal(pendingState.cardSelectionAction, null);
}

{
  const { runtime, player, effect, uiRuntimeState, decisionSessions, calls } = createHarness();
  decisionSessions.open("pass_reserve_selection", {
    effectId: effect.id,
    playerId: player.id,
    roundNumber: 2,
    selectedCardId: "reserve-1",
  });
  const dismissed = runtime.dismissPassReserveSelectionOverlay();
  assert.equal(dismissed.dismissed, true);
  assert.equal(uiRuntimeState.passReserveSelectionDismissed, true);
  assert.ok(decisionSessions.peek("pass_reserve_selection"));

  const result = runtime.confirmPassReserveSelection();
  assert.equal(result.ok, true);
  assert.equal(player.hand[0].id, "reserve-1");
  assert.equal(decisionSessions.peek("pass_reserve_selection"), null);
  assert.equal(uiRuntimeState.passReserveSelectionDismissed, false);
  assert.equal(calls.completed, 1);
}

console.log("card-runtime tests passed");
