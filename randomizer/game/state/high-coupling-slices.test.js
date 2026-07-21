"use strict";

const assert = require("node:assert/strict");
const stateStore = require("./state-store");
const highCoupling = require("./high-coupling-slices");
const cards = require("../cards/deck");
const rockets = require("../rockets");
const planetStats = require("../planet-stats");
const techBoard = require("../tech/board-state");
const techCatalog = require("../tech/catalog");
const playerTech = require("../tech/player-tech");

const TECH_TILE_ID = techCatalog.TILE_IDS_BY_TYPE.orange[0];

function card(instance, cardId) {
  return {
    id: instance,
    cardId,
    set: "basic",
    src: `host/${cardId}`,
    cardName: `展示 ${cardId}`,
    faceUp: true,
    price: 1,
    cardTypeCode: 2,
    discardActionCode: 0,
    scanActionCode: 0,
    incomeCode: 0,
    cardEffectState: { completedTaskIds: [], consumedTriggerIds: [] },
  };
}

function createState() {
  const board = techBoard.createBoardState();
  for (const stack of Object.values(board.stacks)) {
    stack.bonusQueue = ["credits"];
    stack.bonusId = "credits";
  }
  return stateStore.createCommittedGameState({
    gameId: "seti-84",
    rulesetVersion: "prototype-2026-07",
    seed: 84,
    rngState: { owner: "test", state: 84 },
    sequences: { rocket: 2, card: 3 },
    match: { playerOrder: ["p1", "p2"] },
    turn: {
      activePlayerCount: 2,
      turnOrderPlayerIds: ["p1", "p2"],
      activePlayerIds: ["p1", "p2"],
      passedPlayerIds: [],
      completedTurnPlayerIds: [],
      startPlayerId: "p1",
      currentPlayerId: "p1",
    },
    players: {
      currentPlayerId: "p1",
      players: [
        {
          id: "p1", color: "blue", colorLabel: "蓝色", name: "展示名称",
          resources: { credits: 10, energy: 10, handSize: 1, score: 0 },
          income: {}, scoreSources: {},
          hand: [card("card-1-hand", "b_1.webp")],
          reservedCards: [card("card-2-reserved", "b_2.webp")],
          techState: playerTech.createPlayerTechState(),
        },
        {
          id: "p2", color: "green", resources: { credits: 10, energy: 10, handSize: 0, score: 0 },
          income: {}, scoreSources: {}, hand: [], reservedCards: [],
          techState: playerTech.createPlayerTechState(),
        },
      ],
    },
    solarSystem: {},
    pieces: {
      nextRocketId: 2,
      activeRocketId: 1,
      rockets: [{
        id: 1, playerId: "p1", color: "blue", playerSequence: 1,
        surface: "solar-board", sectorX: 0, sectorY: 1, slotIndex: 1,
        tokenSrc: "host/rocket.png", label: "R1",
      }],
      playerRocketSequences: { p1: new Set([1]), p2: new Set() },
      statusNote: "仅供展示",
    },
    planets: {
      planets: {
        mars: { orbitMarkers: [], landingMarkers: [], satelliteLandings: [] },
      },
    },
    data: {},
    cards: {
      publicCards: [null, null, null], discardPile: [],
      drawPileCardIds: ["b_3.webp"], passReservePiles: {},
      ui: { selectionActive: true, discardSelectionActive: true, discardRemaining: 1 },
      selectedCardIds: ["card-1-hand"],
    },
    tech: {
      board,
      ui: { pendingTileId: TECH_TILE_ID, selectedTileId: TECH_TILE_ID, statusNote: "请选择" },
    },
    aliens: {},
    finalScoring: {},
  });
}

function bytes(store) {
  const serialized = store.serialize();
  assert.equal(serialized.ok, true, JSON.stringify(serialized));
  return serialized.serialized;
}

(function testOwnershipAndPurificationExcludeUiSessionsAndNormalizeIds() {
  const purified = highCoupling.purifyHighCouplingSlices(createState());
  assert.deepEqual(highCoupling.HIGH_COUPLING_SLICES, ["players", "pieces", "cards", "tech"]);
  assert.equal(Object.hasOwn(purified.players, "currentPlayerId"), false);
  assert.equal(Object.hasOwn(purified.players.players[0], "colorLabel"), false);
  assert.equal(Object.hasOwn(purified.players.players[0].hand[0], "src"), false);
  assert.equal(Object.hasOwn(purified.pieces, "statusNote"), false);
  assert.equal(Object.hasOwn(purified.pieces, "nextRocketId"), false);
  assert.deepEqual(purified.pieces.playerRocketSequences, { p1: [1], p2: [] });
  assert.equal(Object.hasOwn(purified.cards, "ui"), false);
  assert.equal(Object.hasOwn(purified.cards, "selectedCardIds"), false);
  assert.equal(Object.hasOwn(purified.tech, "ui"), false);
  assert.ok(purified.tech.stacks[TECH_TILE_ID]);
  assert.equal(purified.meta.sequences.rocket, 2);
  assert.equal(purified.meta.sequences.card, 3);
  assert.equal(JSON.stringify(purified).includes("cardTaskState"), false);
  assert.equal(JSON.stringify(purified).includes("setupSelectionState"), false);
})();

(function testResearchCardMovementAndPiecePlanetConversionCommitAtomically() {
  const store = highCoupling.createHighCouplingStateStore(createState());
  const before = store.getSnapshot();
  const result = highCoupling.mutateHighCouplingSlices(store, (slices) => {
    const player = slices.players.players[0];
    const supply = techBoard.consumeFromSupplySlot(slices.tech, TECH_TILE_ID, player.id);
    assert.equal(supply.ok, true);
    assert.equal(playerTech.recordPlayerTake(player.techState, TECH_TILE_ID).ok, true);

    const discarded = cards.discardFromHandAtIndex(player, 0);
    assert.equal(discarded.ok, true);
    cards.addToDiscardPile(slices.cards, discarded.card);

    const removed = rockets.removeRocket(slices.pieces, 1);
    assert.equal(removed.ok, true);
    const orbit = planetStats.addPlanetOrbitMarker(
      { planets: { mars: { orbits: 0, landings: 0, ...slices.planets.planets.mars } } },
      "mars",
      player,
    );
    assert.equal(orbit.ok, true);
    orbit.marker.sourcePieceId = 1;
    return { researched: TECH_TILE_ID, discarded: discarded.card.id, convertedPiece: 1 };
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.stateVersion, 1);
  assert.equal(before.tech.stacks[TECH_TILE_ID].remaining, 4);
  assert.equal(before.players.players[0].hand.length, 1);
  assert.equal(before.pieces.rockets.length, 1);
  assert.equal(result.snapshot.tech.stacks[TECH_TILE_ID].remaining, 3);
  assert.equal(result.snapshot.players.players[0].techState.ownedTiles[TECH_TILE_ID], true);
  assert.equal(result.snapshot.players.players[0].hand.length, 0);
  assert.equal(result.snapshot.players.players[0].resources.handSize, 0);
  assert.equal(result.snapshot.cards.discardPile[0].id, "card-1-hand");
  assert.equal(result.snapshot.pieces.rockets.length, 0);
  assert.equal(result.snapshot.pieces.activeRocketId, null);
  assert.equal(result.snapshot.planets.planets.mars.orbitMarkers[0].sourcePieceId, 1);
})();

(function testInvariantFailuresAreZeroPollutionAcrossAllCoupledSlices() {
  const cases = [
    {
      code: "STATE_CARD_INSTANCE_ID_INVALID",
      mutate(slices) { slices.cards.discardPile.push(cloneCard(slices.players.players[0].hand[0])); },
    },
    {
      code: "STATE_TECH_OWNERSHIP_INVALID",
      mutate(slices) { slices.players.players[0].techState.ownedTiles.unknown = true; },
    },
    {
      code: "STATE_TECH_LEGACY_FIELD_FORBIDDEN",
      mutate(slices) { slices.players.players[0].techState.ownedTileByType = { blue: TECH_TILE_ID }; },
    },
    {
      code: "STATE_TECH_LEGACY_FIELD_FORBIDDEN",
      mutate(slices) { slices.players.players[0].techState.blueBoardSlot = 1; },
    },
    {
      code: "STATE_TECH_SUPPLY_OWNERSHIP_MISMATCH",
      mutate(slices) { slices.tech.stacks[TECH_TILE_ID].remaining -= 1; },
    },
    {
      code: "STATE_PIECE_PLANET_MISMATCH",
      mutate(slices) {
        slices.planets.planets.mars.orbitMarkers.push({ playerId: "p1", sourcePieceId: 1 });
      },
    },
    {
      code: "STATE_HOST_FIELD_FORBIDDEN",
      mutate(slices) { slices.tech.ui = { pendingTileId: TECH_TILE_ID }; },
    },
  ];
  for (const testCase of cases) {
    const store = highCoupling.createHighCouplingStateStore(createState());
    const before = bytes(store);
    const working = store.beginWorkingCopy(0);
    testCase.mutate(Object.fromEntries(highCoupling.COORDINATED_SLICES.map((key) => [key, working.state[key]])));
    const result = store.compareAndCommit(working.baseVersion, working.state);
    assert.equal(result.ok, false, testCase.code);
    assert.equal(result.code, testCase.code, JSON.stringify(result));
    if (testCase.code === "STATE_CARD_INSTANCE_ID_INVALID") {
      assert.match(result.errors[0].message, /players\.players\[0\]\.hand\[0\]/);
      assert.match(result.errors[0].message, /cards\.discardPile\[0\]/);
    }
    assert.equal(bytes(store), before, testCase.code);
    assert.equal(store.getSnapshot().meta.stateVersion, 0);
  }
})();

(function testCardTaskIndexRebuildsFromCommittedAndWorkingStateButNeverSerializes() {
  const cardEffects = {
    getCardModel: () => ({ cardType: 2, tasks: [{ id: "task-1" }], triggers: [{ id: "trigger-1" }] }),
    ensureCardEffectState: (target) => target.cardEffectState,
    getRuntimeCardTypeCode: () => 2,
    collectReadyTasks: (player) => player.reservedCards.map((reserved) => ({
      card: reserved,
      task: { id: "task-1" },
    })),
  };
  const store = highCoupling.createHighCouplingStateStore(createState());
  const committedIndex = highCoupling.rebuildCardTaskIndex(store.getSnapshot(), "p1", {}, cardEffects);
  assert.equal(committedIndex.readyType2Tasks.length, 1);
  assert.equal(committedIndex.type1ReservedCards.length, 1);
  const working = store.beginWorkingCopy(0);
  working.state.players.players[0].reservedCards = [];
  const workingIndex = highCoupling.rebuildCardTaskIndex(working.state, "p1", {}, cardEffects);
  assert.equal(workingIndex.readyType2Tasks.length, 0);
  assert.equal(store.getSnapshot().players.players[0].reservedCards.length, 1);
  assert.equal(bytes(store).includes("readyType2Tasks"), false);
})();

(function testPlayerSpecificFangzhouCardsMayShareDefinitionButNotInstanceId() {
  const state = createState();
  const sharedDefinition = {
    cardId: "fangzhou_blue_3",
    set: "alien:方舟:card2",
    fangzhouCard2: true,
  };
  state.players.players[1].hand.push({
    ...sharedDefinition,
    id: "fangzhou-card2-p2-blue-3",
  });
  state.players.players[1].resources.handSize = 1;
  state.cards.discardPile.push({
    ...sharedDefinition,
    id: "fangzhou-card2-p1-blue-3",
  });
  const validStore = highCoupling.createHighCouplingStateStore(state);
  assert.equal(validStore.validate(validStore.getSnapshot()).ok, true);

  const invalid = createState();
  invalid.cards.discardPile.push({
    ...invalid.players.players[0].hand[0],
    id: "different-instance-same-basic-card",
  });
  const result = highCoupling.createHighCouplingStateStore(createState()).validate(
    highCoupling.purifyHighCouplingSlices(invalid),
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, "STATE_CARD_LOCATION_CONFLICT");
})();

(function testRecoveryAndStaleWriterParity() {
  const store = highCoupling.createHighCouplingStateStore(createState());
  const stale = store.beginWorkingCopy(0);
  assert.equal(highCoupling.mutateHighCouplingSlices(store, (slices) => {
    slices.players.players[0].resources.credits -= 1;
  }).ok, true);
  stale.state.players.players[0].resources.credits = 99;
  assert.equal(store.compareAndCommit(stale.baseVersion, stale.state).code, "STATE_VERSION_CONFLICT");
  const serialized = store.serialize();
  assert.equal(serialized.ok, true);
  const recovered = store.deserialize(serialized.serialized);
  assert.equal(recovered.ok, true);
  assert.deepEqual(recovered.state, store.getSnapshot());
})();

function cloneCard(value) {
  return structuredClone(value);
}

console.log("high coupling state tests passed");
