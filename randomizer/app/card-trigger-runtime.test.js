"use strict";

const assert = require("node:assert/strict");
const { createCardTriggerRuntime } = require("./card-trigger-runtime");
const { createDecisionSessionStore } = require("../game/effects/decision-session-store");

function createHarness() {
  const player = {
    id: "p1",
    color: "white",
    completedTaskCount: 0,
    reservedCards: [],
  };
  const cardState = { publicCards: [], discardPile: [] };
  const pendingState = {
    cardTriggerAction: null,
    cardTaskCompletion: null,
    actionEffectFlow: null,
  };
  const decisionSessions = createDecisionSessionStore();
  const calls = { started: 0, updated: 0, rendered: 0 };
  const runtime = createCardTriggerRuntime({
    HISTORY_SOURCE_QUICK: "quick",
    pendingState,
    decisionSessions,
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
  return { runtime, player, cardState, pendingState, decisionSessions, calls };
}

{
  const { runtime, pendingState, decisionSessions, calls } = createHarness();
  runtime.enqueueType1TriggerEvents([{ type: "scan", sectorX: 2 }]);
  assert.deepEqual(decisionSessions.peek("type1_trigger_queue").events, [{ type: "scan", sectorX: 2 }]);

  decisionSessions.open("card_trigger_action", { matches: [{ id: "trigger" }] });
  assert.equal(runtime.cancelCardTriggerChoice(), true);
  assert.equal(decisionSessions.peek("card_trigger_action"), null);
  assert.ok(calls.updated > 0);
}

{
  const { runtime, player, cardState, decisionSessions, calls } = createHarness();
  const card = { id: "task-card", label: "任务牌" };
  player.reservedCards.push(card);
  decisionSessions.open("card_task_completion", {
    ready: {
      card,
      task: { id: "task-1" },
      effects: [{ id: "reward", type: "gain_resources" }],
    },
  });
  const result = runtime.confirmCardTaskCompletion();
  assert.equal(result, true);
  assert.equal(player.completedTaskCount, 1);
  assert.equal(player.reservedCards.length, 0);
  assert.equal(cardState.discardPile[0], card);
  assert.equal(calls.started, 1);
}

console.log("card-trigger-runtime tests passed");
