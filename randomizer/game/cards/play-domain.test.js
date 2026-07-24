"use strict";

const assert = require("node:assert/strict");
const playDomain = require("./play-domain");
const cardEffects = require("./effects");
const data = require("../data");

assert.equal(playDomain.REACHABLE_PLAY_EFFECT_TYPES.length, 46);
assert.deepEqual(playDomain.SLICE_EFFECT_TYPES, [
  cardEffects.EFFECT_TYPES.SCAN_NEBULA,
  cardEffects.EFFECT_TYPES.SCAN_COLOR_CHOICE,
]);

function createRoot(cardId) {
  const card = {
    id: `instance:${cardId}`,
    cardId,
    price: 2,
    cardTypeCode: cardEffects.getRuntimeCardTypeCode({ cardId }),
  };
  const nebulaDataState = data.createDefaultNebulaDataState();
  data.fillNebulaData(nebulaDataState, "sector-4-a", { source: "test" });
  data.fillNebulaData(nebulaDataState, "sector-3-a", { source: "test" });
  return {
    playerState: {
      currentPlayerId: "p1",
      players: [{
        id: "p1",
        color: "brown",
        resources: {
          credits: 10, energy: 10, publicity: 0, score: 0,
          availableData: 0, computerCapacity: 5, handSize: 1,
        },
        income: {},
        hand: [card],
        reservedCards: [],
        mainActionCompleted: false,
      }],
    },
    cardState: { discardPile: [], publicCards: [] },
    rocketState: {},
    solarState: { sectorBySlot: {} },
    nebulaDataState,
    planetStatsState: {},
    techGameState: {},
    alienGameState: {},
    turnState: {},
    match: {},
  };
}

function createHarness(root, browserAdapter) {
  const executors = new Map();
  playDomain.createExperimentalCardPlayDomain({
    runtime: {
      registerExecutor(type, executor) {
        executors.set(type, typeof executor === "function" ? { execute: executor } : executor);
      },
    },
    commitWorkingState(state) {
      return structuredClone(browserAdapter ? root : state);
    },
  });
  return {
    executors,
    invoke(operation, state, ...args) {
      return operation(state, ...args, browserAdapter ? { workingRoot: root } : root);
    },
  };
}

function actionFor(root) {
  const player = root.playerState.players[0];
  const card = player.hand[0];
  return {
    family: "play_card",
    actorId: player.id,
    target: { cardInstanceId: card.id },
    payload: { cost: cardEffects.getCardPlayCost(card) },
  };
}

function runFixedScan(browserAdapter) {
  const root = createRoot("b_1.webp");
  const state = browserAdapter ? { committed: true } : root;
  const harness = createHarness(root, browserAdapter);
  const action = actionFor(root);
  const play = harness.invoke(
    harness.executors.get(playDomain.EFFECT_TYPES.PLAY).execute,
    state,
    { ownerId: "p1", payload: { action } },
  );
  assert.equal(play.ok, true);
  assert.equal(root.playerState.players[0].resources.credits, 8);
  assert.equal(root.playerState.players[0].hand.length, 0);
  assert.equal(root.playerState.players[0].reservedCards.length, 1);
  assert.equal(play.spawnedEffects.length, 2);
  const scan = harness.invoke(
    harness.executors.get(playDomain.EFFECT_TYPES.FIXED_NEBULA_SCAN).execute,
    state,
    { ownerId: "p1", payload: play.spawnedEffects[0].effect.payload },
  );
  assert.equal(scan.ok, true);
  assert.equal(
    data.listNebulaTokens(root.nebulaDataState, "sector-4-a")[0].replacedByPlayerColor,
    "brown",
  );
  assert.equal(root.playerState.players[0].resources.availableData, 1);
  return {
    player: {
      credits: root.playerState.players[0].resources.credits,
      availableData: root.playerState.players[0].resources.availableData,
      hand: root.playerState.players[0].hand.map((card) => card.id),
      reserved: root.playerState.players[0].reservedCards.map((card) => card.id),
      mainActionCompleted: root.playerState.players[0].mainActionCompleted,
    },
    scan: data.listNebulaTokens(root.nebulaDataState, "sector-4-a").map((token) => ({
      slotIndex: token.slotIndex,
      replacedByPlayerId: token.replacedByPlayerId || null,
    })),
    playEvents: play.events,
    scanEvents: scan.events,
  };
}

assert.deepEqual(
  runFixedScan(true),
  runFixedScan(false),
  "Browser working adapter 与 Simulation 直根必须命中同一 owner 并产生同根结果",
);

{
  const root = createRoot("b_3.webp");
  const harness = createHarness(root, false);
  const action = actionFor(root);
  const play = harness.invoke(
    harness.executors.get(playDomain.EFFECT_TYPES.PLAY).execute,
    root,
    { ownerId: "p1", payload: { action } },
  );
  assert.equal(play.ok, true);
  assert.equal(play.spawnedEffects.length, 4);
  const decision = play.spawnedEffects[0].effect;
  assert.equal(decision.kind, "decision");
  const executor = harness.executors.get(playDomain.EFFECT_TYPES.COLOR_NEBULA_SCAN);
  const choices = harness.invoke(executor.getLegalChoices, root, decision);
  assert.deepEqual(choices.map((choice) => choice.target.nebulaId), ["sector-4-a", "sector-3-a"]);
  const resolved = harness.invoke(executor.resolveDecision, root, decision, choices[0]);
  assert.equal(resolved.ok, true);
  assert.equal(
    data.listNebulaTokens(root.nebulaDataState, "sector-4-a")[0].replacedByPlayerColor,
    "brown",
  );
  assert.equal(resolved.history[0].choiceId, "sector-4-a");
}

{
  const root = createRoot("dlc_2.png");
  const before = structuredClone(root);
  const harness = createHarness(root, false);
  const action = actionFor(root);
  const result = harness.invoke(
    harness.executors.get(playDomain.EFFECT_TYPES.PLAY).execute,
    root,
    { ownerId: "p1", payload: { action } },
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, "CARD_PLAY_SLICE_UNSUPPORTED");
  assert.deepEqual(root, before, "未覆盖类型必须在费用和实体迁移前 fail-closed");
}

console.log("card play domain representative slice tests passed");
