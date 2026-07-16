"use strict";

const assert = require("node:assert/strict");
const { createCardRuntime } = require("./card-runtime");

function createHarness() {
  const player = { id: "p1", hand: [] };
  const effect = { id: "pass-effect", label: "PASS 精选", result: null };
  const cardState = { publicCards: [], discardPile: [] };
  const pendingState = {
    cardSelectionAction: null,
    passReserveSelection: null,
    passReserveSelectionDismissed: false,
  };
  const calls = { completed: 0, chrome: 0 };
  const runtime = createCardRuntime({
    pendingState,
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
    syncPassReserveSelectionChrome: () => { calls.chrome += 1; },
  });
  return { runtime, player, effect, pendingState, calls };
}

{
  const { runtime, pendingState } = createHarness();
  pendingState.cardSelectionAction = { type: "public_scan" };
  runtime.cancelCardSelection();
  assert.equal(pendingState.cardSelectionAction, null);
}

{
  const { runtime, player, effect, pendingState, calls } = createHarness();
  pendingState.passReserveSelection = {
    effectId: effect.id,
    playerId: player.id,
    roundNumber: 2,
    selectedCardId: "reserve-1",
  };
  const dismissed = runtime.dismissPassReserveSelectionOverlay();
  assert.equal(dismissed.dismissed, true);
  assert.ok(pendingState.passReserveSelection);

  const result = runtime.confirmPassReserveSelection();
  assert.equal(result.ok, true);
  assert.equal(player.hand[0].id, "reserve-1");
  assert.equal(pendingState.passReserveSelection, null);
  assert.equal(calls.completed, 1);
}

console.log("card-runtime tests passed");
