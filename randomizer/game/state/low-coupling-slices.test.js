"use strict";

const assert = require("node:assert/strict");
const stateStore = require("./state-store");
const lowCoupling = require("./low-coupling-slices");
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

function createStore(initialState = createState()) {
  return stateStore.createStateStore(lowCoupling.purifyLowCouplingSlices(initialState), {
    invariantValidators: [lowCoupling.validateLowCouplingInvariants],
  });
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

(function testAllInvariantFailuresRejectCandidateAndLeaveCommittedBytesUnchanged() {
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
    const store = createStore();
    const before = bytes(store);
    const candidate = structuredClone(store.getSnapshot());
    const slices = Object.fromEntries(lowCoupling.LOW_COUPLING_SLICES.map((key) => [key, candidate[key]]));
    testCase.mutate(slices);
    const result = store.validate(candidate);
    assert.equal(result.ok, false, testCase.code);
    assert.equal(result.code, testCase.code, JSON.stringify(result));
    assert.equal(bytes(store), before, testCase.code);
    assert.equal(store.getSnapshot().meta.stateVersion, 0);
  }
})();

(function testDomainBehaviorsProduceOneValidPurifiedCandidateAndRecoveryParity() {
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
  const store = createStore(initial);
  const working = structuredClone(store.getSnapshot());
  const wheelIds = solar.getNextOrbitWheelIds(working.solarSystem.rotation.rotationCount);
  working.solarSystem.rotation = solar.applySolarOrbitRotation(working.solarSystem);
  working.turn.turnNumber += 1;
  working.turn.currentPlayerId = "p2";
  assert.equal(planetStats.addPlanetOrbitMarker(
    working.planets, "mars", { id: "p1", color: "blue" },
  ).ok, true);
  for (const traceType of ["yellow", "pink", "blue"]) {
    assert.equal(alienState.placeFirstTrace(working.aliens, 1, traceType, "blue").ok, true);
  }
  assert.equal(alienState.revealAlien(working.aliens, 1, "alien-a").ok, true);
  assert.equal(finalScoring.placeDirectMarkAtSlot(
    working.finalScoring,
    "a",
    { id: "p1", color: "blue", colorLabel: "蓝色" },
    1,
    { threshold: 25, tokenSrc: "host-token.png", placedAt: "2026-07-19T00:00:00.000Z" },
  ).ok, true);
  const candidate = lowCoupling.purifyLowCouplingSlices(working);
  const validation = store.validate(candidate);
  assert.equal(validation.ok, true, JSON.stringify(validation));
  assert.ok(wheelIds.length > 0);
  assert.equal(candidate.turn.turnNumber, 4);
  assert.equal(candidate.turn.currentPlayerId, "p2");
  assert.equal(candidate.planets.planets.mars.orbitMarkers.length, 1);
  assert.equal(candidate.aliens.aliens[1].revealed, true);
  assert.equal(candidate.finalScoring.tiles.a.marks.length, 1);
  assert.equal(Object.hasOwn(candidate.finalScoring.tiles.a.marks[0], "tokenSrc"), false);
  assert.equal(Object.hasOwn(candidate.finalScoring.tiles.a.marks[0], "placedAt"), false);

  const serialized = store.serialize(candidate);
  const recovered = store.deserialize(serialized.serialized);
  assert.equal(recovered.ok, true);
  assert.deepEqual(recovered.state, candidate);
  assert.equal(recovered.state.planets.planets.mars.orbitMarkers.length, 1);
  assert.deepEqual(
    solar.rotationToWheelSteps(recovered.state.solarSystem.rotation),
    solar.rotationToWheelSteps(candidate.solarSystem.rotation),
  );
  assert.equal(recovered.state.aliens.aliens[1].revealed, true);
  assert.equal(recovered.state.finalScoring.tiles.a.marks[0].playerId, "p1");
})();

console.log("low coupling state tests passed");
