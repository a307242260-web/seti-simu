"use strict";

const assert = require("node:assert/strict");
const stateStore = require("./state-store");
const lowCoupling = require("./low-coupling-slices");
const adapter = require("./legacy-state-adapter");
const solar = require("../../solar-system/core");
const planetStats = require("../planet-stats");
const alienState = require("../aliens/state");
const finalScoring = require("../final-scoring");

function createState() {
  return stateStore.createCommittedGameState({
    gameId: "seti-83",
    rulesetVersion: "prototype-2026-07",
    seed: 83,
    rngState: { owner: "test", state: 83 },
    sequences: { rocket: 2 },
    match: { status: "playing", playerOrder: ["p1", "p2"] },
    turn: {
      roundNumber: 2,
      turnNumber: 3,
      actionCycleNumber: 1,
      activePlayerCount: 2,
      turnOrderPlayerIds: ["p1", "p2"],
      activePlayerIds: ["p1", "p2"],
      startPlayerId: "p1",
      currentPlayerId: "p1",
      passedPlayerIds: [],
      completedTurnPlayerIds: [],
    },
    players: {
      players: [
        { id: "p1", color: "blue", resources: { score: 25 } },
        { id: "p2", color: "green", resources: { score: 10 } },
      ],
    },
    solarSystem: {
      wheelSteps: [0, 1, 2, 3, 0],
      rotation: { wheel1Steps: 1, wheel2Steps: 2, wheel3Steps: 3, wheel4Steps: 0, rotationCount: 1 },
      sectorBySlot: { 1: 2, 2: 1, 3: 4, 4: 3 },
      aomomoActive: false,
    },
    pieces: {
      activeRocketId: "rocket-1",
      rockets: [{ id: "rocket-1", playerId: "p1", surface: "solar" }],
      playerRocketSequences: { p1: [1] },
    },
    planets: {
      planets: {
        mars: {
          orbits: 1,
          landings: 0,
          orbitMarkers: [{ sequence: 1, displayed: true, displaySlot: 1, playerId: "p1", color: "blue" }],
          landingMarkers: [],
          satelliteLandings: [],
        },
      },
    },
    data: {
      nebulae: {
        n1: {
          tokens: [{
            id: "data-1", slotIndex: 1, playerId: "p1", playerColor: "blue",
            playerLabel: "蓝色", playerTokenSrc: "token.png", percentX: 10, percentY: 20,
          }],
          playerTokenCounts: { blue: 1 },
          lastReplacedPlayerId: "p1",
          lastReplacedPlayerColor: "blue",
        },
      },
      sectorExtraMarks: {},
      sectorSettlements: { sectors: {}, winsByPlayerId: {} },
    },
    cards: {},
    tech: {},
    aliens: {
      revealPoolAlienIds: ["alien-a", "alien-b"],
      neutralScoreTraceMarks: {},
      aliens: {
        1: {
          revealed: false,
          traces: {
            yellow: { firstPlaced: true, ownerPlayerColor: "blue", extraCount: 1, extraMarkers: [{ ownerPlayerColor: "blue", playerLabel: "蓝色" }] },
          },
        },
      },
    },
    finalScoring: {
      thresholds: [25, 50, 70],
      tiles: {
        a: {
          id: "a",
          marks: [{
            id: "mark-1", tileId: "a", playerId: "p1", playerColor: "blue",
            playerLabel: "蓝色", tokenSrc: "token.png", threshold: 25, slotIndex: 1, slot3Order: null,
            placedAt: "2026-07-19T00:00:00.000Z",
          }],
        },
      },
      tileVariants: { a: 1 },
      pendingMarks: [{ id: "pending-p2-25", playerId: "p2", threshold: 25 }],
    },
  });
}

function bytes(store) {
  const serialized = store.serialize();
  assert.equal(serialized.ok, true);
  return serialized.serialized;
}

(function testOwnershipMatrixCoversEveryLowCouplingLegacyGroup() {
  assert.deepEqual(lowCoupling.LOW_COUPLING_SLICES, [
    "match", "turn", "solarSystem", "planets", "data", "aliens", "finalScoring",
  ]);
  for (const fragment of ["solarSystem.", "match.", "turn.", "planets.", "data.", "aliens.", "finalScoring."]) {
    assert.ok(Object.keys(lowCoupling.FIELD_OWNERSHIP).some((key) => key.startsWith(fragment)), fragment);
  }
})();

(function testPurificationMovesSessionDerivedAndHostFieldsOutOfAuthority() {
  const purified = lowCoupling.purifyLowCouplingSlices(createState());
  assert.equal(Object.hasOwn(purified.solarSystem, "wheelSteps"), false);
  assert.equal(Object.hasOwn(purified.planets.planets.mars, "orbits"), false);
  assert.equal(Object.hasOwn(purified.planets.planets.mars.orbitMarkers[0], "sequence"), false);
  assert.equal(Object.hasOwn(purified.planets.planets.mars.orbitMarkers[0], "displayed"), false);
  assert.equal(Object.hasOwn(purified.data.nebulae.n1, "playerTokenCounts"), false);
  assert.equal(Object.hasOwn(purified.data.nebulae.n1.tokens[0], "playerTokenSrc"), false);
  assert.equal(Object.hasOwn(purified.aliens.aliens[1].traces.yellow.extraMarkers[0], "playerLabel"), false);
  assert.equal(Object.hasOwn(purified.finalScoring, "pendingMarks"), false);
  assert.deepEqual(purified.finalScoring.tiles.a.marks[0], {
    id: "mark-1", tileId: "a", playerId: "p1", playerColor: "blue",
    threshold: 25, slotIndex: 1, slot3Order: null,
  });
})();

(function testLowCouplingMutationUsesWorkingCopyAndSingleAtomicCommit() {
  const store = lowCoupling.createLowCouplingStateStore(createState());
  const before = store.getSnapshot();
  const result = lowCoupling.mutateLowCouplingSlices(store, (slices) => {
    slices.solarSystem.rotation.rotationCount += 1;
    slices.turn.turnNumber += 1;
    slices.turn.currentPlayerId = "p2";
    slices.planets.planets.mars.landingMarkers.push({ playerId: "p2", color: "green" });
    slices.data.sectorExtraMarks["sector-1"] = [{ playerId: "p1", color: "blue" }];
    slices.aliens.aliens[1].revealed = true;
    slices.finalScoring.tiles.a.marks.push({
      id: "mark-2", tileId: "a", playerId: "p2", playerColor: "green",
      threshold: 50, slotIndex: 2, slot3Order: null,
    });
    return "board-turn-alien-final";
  });
  assert.equal(result.ok, true);
  assert.equal(result.stateVersion, 1);
  assert.equal(result.result, "board-turn-alien-final");
  assert.equal(before.meta.stateVersion, 0);
  assert.equal(before.turn.turnNumber, 3);
  assert.equal(result.snapshot.turn.currentPlayerId, "p2");
  assert.equal(result.snapshot.planets.planets.mars.landingMarkers.length, 1);
  assert.equal(result.snapshot.finalScoring.tiles.a.marks.length, 2);
})();

(function testAllInvariantAndOwnershipFailuresLeaveCommittedBytesUnchanged() {
  const cases = [
    {
      code: "STATE_PLAYER_REFERENCE_INVALID",
      mutate(slices) { slices.planets.planets.mars.orbitMarkers.push({ playerId: "missing" }); },
    },
    {
      code: "STATE_ACTIVE_PLAYER_COUNT_MISMATCH",
      mutate(slices) { slices.turn.activePlayerCount = 1; },
    },
    {
      code: "STATE_ALIEN_TRACE_COUNT_MISMATCH",
      mutate(slices) { slices.aliens.aliens[1].traces.yellow.extraCount = 2; },
    },
    {
      code: "STATE_DATA_SLOT_DUPLICATE",
      mutate(slices) { slices.data.nebulae.n1.tokens.push({ id: "data-2", slotIndex: 1 }); },
    },
    {
      code: "STATE_FINAL_SLOT_OCCUPIED",
      mutate(slices) {
        slices.finalScoring.tiles.a.marks.push({
          id: "mark-2", playerId: "p2", playerColor: "green", slotIndex: 1,
        });
      },
    },
    {
      code: "STATE_HOST_FIELD_FORBIDDEN",
      mutate(slices) { slices.finalScoring.pendingMarks = []; },
    },
  ];
  for (const testCase of cases) {
    const store = lowCoupling.createLowCouplingStateStore(createState());
    const before = bytes(store);
    const result = lowCoupling.mutateLowCouplingSlices(store, testCase.mutate);
    assert.equal(result.ok, false, testCase.code);
    assert.equal(result.code, testCase.code, JSON.stringify(result));
    assert.equal(bytes(store), before, testCase.code);
    assert.equal(store.getSnapshot().meta.stateVersion, 0);
  }

  const protectedStore = lowCoupling.createLowCouplingStateStore(createState());
  const protectedBefore = bytes(protectedStore);
  const protectedResult = lowCoupling.mutateLowCouplingSlices(protectedStore, (_slices, root) => {
    root.cards.injected = true;
  });
  assert.equal(protectedResult.code, "STATE_SLICE_OWNERSHIP_VIOLATION");
  assert.equal(bytes(protectedStore), protectedBefore);
})();

(function testStaleWritersOnlyIncrementVersionOnTheWinner() {
  const store = lowCoupling.createLowCouplingStateStore(createState());
  const stale = store.beginWorkingCopy(0);
  assert.equal(lowCoupling.mutateLowCouplingSlices(store, (slices) => {
    slices.turn.turnNumber = 4;
  }).ok, true);
  stale.state.turn.turnNumber = 99;
  const conflict = store.compareAndCommit(stale.baseVersion, stale.state);
  assert.equal(conflict.code, "STATE_VERSION_CONFLICT");
  assert.equal(store.getSnapshot().meta.stateVersion, 1);
  assert.equal(store.getSnapshot().turn.turnNumber, 4);
})();

(function testLegacyDomainBehaviorsRunAgainstOneWorkingCopyAndRecoverWithParity() {
  const initial = createState();
  initial.planets = {
    planets: Object.fromEntries(planetStats.PLANET_IDS.map((planetId) => [planetId, {
      orbitMarkers: [], landingMarkers: [], satelliteLandings: [],
    }])),
  };
  initial.aliens = alienState.createDefaultAlienState();
  initial.aliens.aliens[1].assignedAlienId = "alien-a";
  initial.finalScoring = {
    thresholds: [25, 50, 70],
    tiles: { a: { id: "a", marks: [] } },
    tileVariants: { a: 1 },
  };
  const store = lowCoupling.createLowCouplingStateStore(initial);
  const result = adapter.mutateLegacyLowCouplingSlices(store, (legacy) => {
    const wheelIds = solar.getNextOrbitWheelIds(legacy.solarState.rotation.rotationCount);
    const rotation = solar.applySolarOrbitRotation(legacy.solarState);
    legacy.solarState.rotation = rotation;
    legacy.solarState.wheelSteps = solar.rotationToWheelSteps(rotation);
    legacy.turnState.turnNumber += 1;
    legacy.turnState.currentPlayerId = "p2";
    assert.equal(planetStats.addPlanetOrbitMarker(
      legacy.planetStatsState, "mars", { id: "p1", color: "blue" },
    ).ok, true);
    for (const traceType of ["yellow", "pink", "blue"]) {
      assert.equal(alienState.placeFirstTrace(legacy.alienGameState, 1, traceType, "blue").ok, true);
    }
    assert.equal(alienState.revealAlien(legacy.alienGameState, 1, "alien-a").ok, true);
    assert.equal(finalScoring.placeDirectMarkAtSlot(
      legacy.finalScoringState,
      "a",
      { id: "p1", color: "blue", colorLabel: "蓝色" },
      1,
      { threshold: 25, tokenSrc: "host-token.png", placedAt: "2026-07-19T00:00:00.000Z" },
    ).ok, true);
    return { wheelIds };
  });
  assert.equal(result.ok, true);
  assert.equal(result.stateVersion, 1);
  assert.ok(result.result.wheelIds.length > 0);
  const committed = store.getSnapshot();
  assert.equal(committed.turn.turnNumber, 4);
  assert.equal(committed.turn.currentPlayerId, "p2");
  assert.equal(committed.planets.planets.mars.orbitMarkers.length, 1);
  assert.equal(committed.aliens.aliens[1].revealed, true);
  assert.equal(committed.finalScoring.tiles.a.marks.length, 1);
  assert.equal(Object.hasOwn(committed.finalScoring.tiles.a.marks[0], "tokenSrc"), false);
  assert.equal(Object.hasOwn(committed.finalScoring.tiles.a.marks[0], "placedAt"), false);

  const serialized = store.serialize();
  const recovered = adapter.deserializeRecoverySnapshot({
    version: adapter.COMMITTED_RECOVERY_VERSION,
    committedState: serialized.serialized,
  });
  assert.equal(recovered.ok, true);
  assert.deepEqual(recovered.state, committed);
  const projected = adapter.projectCommittedStateToLegacySlices(recovered.state);
  assert.equal(projected.ok, true);
  assert.equal(projected.state.planetStatsState.planets.mars.orbits, 1);
  assert.equal(projected.state.planetStatsState.planets.mars.orbitMarkers[0].sequence, 1);
  assert.deepEqual(projected.state.solarState.wheelSteps, solar.rotationToWheelSteps(committed.solarSystem.rotation));
  assert.equal(projected.state.alienGameState.aliens[1].revealed, true);
  assert.equal(projected.state.finalScoringState.tiles.a.marks[0].playerId, "p1");
  assert.deepEqual(projected.state.finalScoringState.pendingMarks, []);
})();

console.log("low coupling state tests passed");
