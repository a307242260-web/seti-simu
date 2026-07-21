const assert = require("node:assert/strict");

const { createInitialCardPendingRuntime } = require("./ai/initial-card-pending");
const { createInteractionPendingRuntime } = require("./ai/interaction-pending");
const { createActionExecutor } = require("./ai/action-executor");
const { createAutomationRuntime } = require("./ai/automation-runtime");

function contextWith(overrides = {}) {
  const fallback = () => null;
  return new Proxy(overrides, {
    get(target, key) {
      return Object.prototype.hasOwnProperty.call(target, key) ? target[key] : fallback;
    },
  });
}

function createRoot(id, roundNumber = 1) {
  return {
    playerState: {
      currentPlayerId: id,
      players: [{ id, colorLabel: id, resources: {}, hand: [], reservedCards: [] }],
    },
    turnState: { roundNumber, turnNumber: 1, activePlayerIds: [id] },
    rocketState: { rockets: [] },
    alienGameState: { id: `alien-${id}` },
    cardState: { id: `card-${id}`, publicCards: [] },
    techGameState: { board: {}, ui: {} },
    finalScoringState: {},
  };
}

const players = {
  getCurrentPlayer: (playerState) => (
    playerState.players.find((player) => player.id === playerState.currentPlayerId) || null
  ),
};

{
  const runtime = createInitialCardPendingRuntime(contextWith({
    AI_STYLE_SEAT_ORDER: ["route", "scanner"],
    ai: { heuristicEvaluator: { selectScoredItem: () => null } },
    getAiAutoBattlePlayerIds: () => ["a", "b"],
    players,
    rocketActions: {},
    state: {},
  }));
  const rootA = createRoot("a", 1);
  rootA.turnState.activePlayerIds = ["a", "b"];
  const rootB = createRoot("b", 2);
  rootB.turnState.activePlayerIds = ["b", "a"];
  assert.deepEqual(runtime.getOrderedAiAutoBattlePlayerIds(rootA), ["a", "b"]);
  assert.deepEqual(runtime.getOrderedAiAutoBattlePlayerIds(rootB), ["b", "a"]);
  assert.throws(() => runtime.getOrderedAiAutoBattlePlayerIds(), /explicit workingRoot/);
}

{
  const aiAutoBattleState = { turnMoveCounts: {}, turnCardCornerMoveCounts: {}, maxMovesPerTurn: 3 };
  const runtime = createInteractionPendingRuntime(contextWith({
    ai: { heuristicEvaluator: { selectScoredItem: () => null } },
    aiAutoBattleState,
    players,
    rocketActions: { getRocketsForPlayer: () => [] },
    state: {},
  }));
  const rootA = createRoot("a", 1);
  const rootB = createRoot("b", 2);
  runtime.incrementAiMoveCountThisTurn(rootB);
  assert.equal(runtime.getAiMoveCountThisTurn(rootA), 0);
  assert.equal(runtime.getAiMoveCountThisTurn(rootB), 1);
  assert.throws(() => runtime.getAiMoveCountThisTurn(), /explicit workingRoot/);
}

{
  const calls = [];
  const runtime = createActionExecutor(contextWith({
    ai: { heuristicEvaluator: { selectScoredItem: () => null } },
    dispatchRuntimeAction: (workingRoot, request) => {
      calls.push({ workingRoot, request });
      return { ok: true, rootId: workingRoot.playerState.currentPlayerId };
    },
    players,
    state: {},
  }));
  const rootB = createRoot("b", 2);
  const descriptor = { schemaVersion: "seti-standard-action-v1", family: "pass" };
  assert.equal(runtime.executeAiTurnAction(rootB, { standardAction: descriptor }).rootId, "b");
  assert.equal(calls[0].workingRoot, rootB);
  assert.throws(() => runtime.executeAiTurnAction(null, { standardAction: descriptor }), /explicit workingRoot/);
}

{
  const rootB = createRoot("b", 2);
  const runtime = createAutomationRuntime(contextWith({
    ai: { heuristicPolicy: {}, selectionEvaluator: {} },
    isGameEnded: () => false,
    players,
    rocketActions: { getRocketsForPlayer: () => [] },
    runAiTurnActionDecision: (workingRoot) => ({ ok: true, rootId: workingRoot.playerState.currentPlayerId }),
    state: {},
  }));
  assert.equal(runtime.runAiAutomationStep(rootB).rootId, "b");
  assert.throws(() => runtime.runAiAutomationStep(), /explicit workingRoot/);
}

console.log("AI runtime working-root tests passed");
