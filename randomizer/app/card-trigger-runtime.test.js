"use strict";

const assert = require("node:assert/strict");
const { createCardTriggerRuntime } = require("./card-trigger-runtime");

function createHarness() {
  const player = {
    id: "p1",
    color: "white",
    completedTaskCount: 0,
    reservedCards: [],
  };
  const cardState = { publicCards: [], discardPile: [] };
  const pendingState = {
    type1TriggerEvents: [],
    cardTriggerAction: null,
    cardTaskCompletion: null,
    actionEffectFlow: null,
  };
  const calls = { started: 0, updated: 0, rendered: 0 };
  const runtime = createCardTriggerRuntime({
    HISTORY_SOURCE_QUICK: "quick",
    pendingState,
    els: {},
    rocketState: { statusNote: "" },
    cardState,
    playerState: { players: [player] },
    cardEffects: {
      completeTask(card, taskId) {
        card.completedTaskId = taskId;
      },
    },
    cards: {
      getCardLabel: (card) => card.label || card.id,
      addToDiscardPile(state, card) {
        state.discardPile.push(card);
      },
    },
    isCardSelectionActive: () => false,
    getCurrentPlayer: () => null,
    activateNextActionEffectIfIdle: () => false,
    finishActionEffectFlow: () => {},
    updateActionButtons: () => { calls.updated += 1; },
    renderStateReadout: () => { calls.rendered += 1; },
    renderActionEffectBar: () => {},
    blockManualAiPendingInputIfNeeded: () => null,
    isActionEffectFlowActive: () => false,
    hasActivePendingSubFlow: () => false,
    getPendingOwnerPlayer: () => player,
    structuredClone,
    runezu: {},
    beginQuickActionStep: () => {},
    recordQuickHistoryCommand: () => {},
    historyCommands: {
      createRestorePlayerCommand: () => ({}),
      createRestorePublicCardsCommand: () => ({}),
    },
    completeQuickActionStep: () => {},
    renderPlayerStats: () => {},
    renderPublicCards: () => {},
    startCardEffectFlow: () => {
      calls.started += 1;
      return true;
    },
  });
  return { runtime, player, cardState, pendingState, calls };
}

{
  const { runtime, pendingState, calls } = createHarness();
  runtime.enqueueType1TriggerEvents([{ type: "scan", sectorX: 2 }]);
  assert.deepEqual(pendingState.type1TriggerEvents, [{ type: "scan", sectorX: 2 }]);

  pendingState.cardTriggerAction = { matches: [{ id: "trigger" }] };
  assert.equal(runtime.cancelCardTriggerChoice(), true);
  assert.equal(pendingState.cardTriggerAction, null);
  assert.ok(calls.updated > 0);
}

{
  const { runtime, player, cardState, pendingState, calls } = createHarness();
  const card = { id: "task-card", label: "任务牌" };
  player.reservedCards.push(card);
  pendingState.cardTaskCompletion = {
    ready: {
      card,
      task: { id: "task-1" },
      effects: [{ id: "reward", type: "gain_resources" }],
    },
  };
  const result = runtime.confirmCardTaskCompletion();
  assert.equal(result, true);
  assert.equal(player.completedTaskCount, 1);
  assert.equal(player.reservedCards.length, 0);
  assert.equal(cardState.discardPile[0], card);
  assert.equal(calls.started, 1);
}

console.log("card-trigger-runtime tests passed");
