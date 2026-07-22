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
    cardTriggerAction: null,
    cardTaskCompletion: null,
    actionEffectFlow: null,
  };
  const calls = { started: 0, updated: 0, rendered: 0 };
  const runtime = createCardTriggerRuntime({
    HISTORY_SOURCE_QUICK: "quick",
    SCORE_SOURCE_KEYS: { TASK_CARD: "task_card" },
    pendingState,
    els: {},
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
    data: {
      ensurePlayerDataState: (target) => target.dataState || {},
    },
    isCardSelectionActive: () => false,
    players: {
      getCurrentPlayer: (state) => state.players.find((entry) => entry.id === state.currentPlayerId) || null,
    },
    activateNextActionEffectIfIdle: () => false,
    finishActionEffectFlow: () => {},
    updateActionButtons: () => { calls.updated += 1; },
    renderStateReadout: () => { calls.rendered += 1; },
    renderActionEffectBar: () => {},
    blockManualAiPendingInputIfNeeded: () => null,
    isActionEffectFlowActive: () => false,
    hasActivePendingSubFlow: () => false,
    getPendingAmibaSymbolChoice: () => null,
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
    formatChongGain: (gain) => Object.entries(gain).map(([key, value]) => `${key}:${value}`).join(" + "),
  });
  const workingRoot = {
    match: {},
    alienGameState: {},
    cardState,
    nebulaDataState: {},
    playerState: { currentPlayerId: null, players: [player] },
    rocketState: { statusNote: "", rockets: [] },
    turnState: { roundNumber: 1 },
  };
  return { runtime, workingRoot, player, cardState, pendingState, calls };
}

{
  const { runtime, workingRoot, player } = createHarness();
  const isolatedPlayer = {
    id: "p2",
    color: "red",
    dataState: { poolTokens: [{ id: "d1" }], placedTokens: [{ id: "d2" }] },
  };
  const isolatedRoot = {
    ...workingRoot,
    playerState: { currentPlayerId: isolatedPlayer.id, players: [isolatedPlayer] },
  };
  assert.deepEqual(runtime.buildPlayerDataTotals(isolatedRoot), { p2: 2, red: 2 });
  assert.equal(Object.hasOwn(runtime.buildPlayerDataTotals(isolatedRoot), player.id), false);
  assert.throws(() => runtime.buildPlayerDataTotals(null), /explicit workingRoot/);
}

{
  const { runtime, workingRoot, pendingState, calls } = createHarness();
  runtime.enqueueType1TriggerEvents(workingRoot, [{ type: "scan", sectorX: 2 }]);
  assert.deepEqual(workingRoot.match.type1TriggerEvents, [{ type: "scan", sectorX: 2 }]);

  workingRoot.match.cardTriggerContinuation = { matches: [{ id: "trigger" }] };
  assert.equal(runtime.cancelCardTriggerChoice(workingRoot), true);
  assert.equal(workingRoot.match.cardTriggerContinuation, undefined);
  assert.ok(calls.updated > 0);
}

{
  const { runtime, workingRoot, player, cardState, calls } = createHarness();
  const card = { id: "task-card", label: "任务牌" };
  player.reservedCards.push(card);
  workingRoot.match.cardTaskCompletionContinuation = {
    ready: {
      card,
      task: { id: "task-1" },
      effects: [{ id: "reward", type: "gain_resources" }],
    },
  };
  const result = runtime.confirmCardTaskCompletion(workingRoot);
  assert.equal(result, true);
  assert.equal(player.completedTaskCount, 1);
  assert.equal(player.reservedCards.length, 0);
  assert.equal(cardState.discardPile[0], card);
  assert.equal(calls.started, 1);
}

{
  const { runtime } = createHarness();
  const effects = runtime.buildChongRewardQueueEffects(
    { gain: { score: 2, energy: 1 } },
    "chong-test",
    "虫族测试",
  );
  assert.equal(effects[0].label, "虫族测试：score:2 + energy:1");
}

console.log("card-trigger-runtime tests passed");
