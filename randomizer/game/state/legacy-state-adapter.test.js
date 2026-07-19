"use strict";

const assert = require("node:assert/strict");
const stateStore = require("./state-store");
const adapter = require("./legacy-state-adapter");

function createLegacySnapshot(overrides = {}) {
  return {
    version: 1,
    meta: { entryId: 7, currentPlayerId: "p2" },
    state: {
      solarState: { rotation: 3 },
      nebulaDataState: { pool: ["d1"] },
      alienGameState: { aliens: { 1: { revealed: true } } },
      finalScoringState: { tiles: { a: { marks: [] } }, pendingMarks: [{ id: "decision" }] },
      playerState: { players: [{ id: "p1" }, { id: "p2" }], currentPlayerId: "p2" },
      turnState: { roundNumber: 3, turnNumber: 8 },
      rocketState: {
        nextRocketId: 9,
        activeRocketId: "rocket-8",
        rockets: [{ id: "rocket-8", playerId: "p2" }],
        playerRocketSequences: { p1: new Set([3, 1]), p2: new Set([2]) },
        statusNote: "仅供 UI 展示",
      },
      planetStatsState: { mars: { orbiters: ["p1"] } },
      techGameState: { board: { supply: ["t1"] }, ui: { pendingTileId: "t1" } },
      cardState: { drawPileCardIds: ["c2", "c1"], ui: { selectionActive: true } },
      cardTaskState: { byCardId: { c1: { progress: 2 } } },
      setupSelectionState: { active: true, selectedIndustryId: "industry-a" },
      ...overrides,
    },
    runtime: { aiControl: { enabled: true } },
  };
}

(function testOwnershipAndDeletionContractAreExplicit() {
  assert.equal(adapter.ADAPTER_CONTRACT.target, stateStore.SCHEMA_VERSION);
  assert.match(adapter.ADAPTER_CONTRACT.source, /12 legacy state slices/);
  assert.match(adapter.ADAPTER_CONTRACT.deleteWhen, /no supported v1 artifact remains/);
  assert.equal(adapter.ADAPTER_CONTRACT.owner, "SETI-71");
  assert.equal(adapter.ADAPTER_CONTRACT.expiresOn, "2026-08-31");
  assert.equal(adapter.CURRENT_RUNTIME_ADAPTER_CONTRACT.owner, "SETI-71");
  assert.equal(adapter.CURRENT_RUNTIME_ADAPTER_CONTRACT.expiresOn, "2026-08-31");
  assert.equal(adapter.FIELD_OWNERSHIP.cardTaskState, "derived:excluded");
  assert.equal(adapter.FIELD_OWNERSHIP.setupSelectionState, "session-owned:excluded");
  assert.equal(adapter.FIELD_OWNERSHIP["runtime.aiControl"], "host-only:excluded");
})();

(function testCurrentRuntimeBoundaryRejectsDerivedAndSessionSlices() {
  const source = createLegacySnapshot().state;
  const { cardTaskState, setupSelectionState, ...runtimeSlices } = source;
  const adapted = adapter.adaptCurrentRuntimeStateSlices(runtimeSlices, {
    seed: 82,
    rngState: { algorithm: "test", state: 123 },
  });
  assert.equal(adapted.ok, true);
  assert.equal(adapted.sourceVersion, "runtime-working-projection-v1");
  assert.equal(JSON.stringify(adapted.state).includes("cardTaskState"), false);
  assert.equal(JSON.stringify(adapted.state).includes("setupSelectionState"), false);
  assert.equal(adapter.adaptCurrentRuntimeStateSlices(source).code, "CURRENT_RUNTIME_STATE_FORBIDDEN_SLICE");
  assert.equal(adapter.adaptCurrentRuntimeStateSlices({ ...runtimeSlices, unknownState: {} }).code,
    "CURRENT_RUNTIME_STATE_SLICE_UNKNOWN");
})();

(function testLegacyToCommittedToLegacyRoundTrip() {
  const source = createLegacySnapshot();
  const adapted = adapter.adaptLegacySnapshot(source, {
    seed: 82,
    rngState: { algorithm: "test", state: 123 },
  });
  assert.equal(adapted.ok, true);
  assert.equal(adapted.state.meta.schemaVersion, stateStore.SCHEMA_VERSION);
  assert.equal(adapted.state.meta.sequences.rocket, 9);
  assert.deepEqual(adapted.state.pieces.playerRocketSequences, { p1: [1, 3], p2: [2] });
  assert.equal(adapted.state.turn.currentPlayerId, "p2");
  assert.equal(Object.hasOwn(adapted.state.players, "currentPlayerId"), false);
  assert.equal(Object.hasOwn(adapted.state.pieces, "statusNote"), false);
  assert.equal(Object.hasOwn(adapted.state.tech, "ui"), false);
  assert.equal(Object.hasOwn(adapted.state.cards, "ui"), false);
  assert.equal(Object.hasOwn(adapted.state.finalScoring, "pendingMarks"), false);
  assert.equal(JSON.stringify(adapted.state).includes("aiControl"), false);
  assert.equal(JSON.stringify(adapted.state).includes("cardTaskState"), false);
  assert.equal(JSON.stringify(adapted.state).includes("setupSelectionState"), false);

  const projected = adapter.projectCommittedStateToLegacySlices(adapted.state, {
    hostState: {
      rocketState: { statusNote: "host note" },
      techGameState: { ui: { cheatModeEnabled: true } },
      cardState: { ui: { selectionActive: false } },
    },
  });
  assert.equal(projected.ok, true);
  assert.deepEqual(projected.state.solarState, source.state.solarState);
  assert.deepEqual(projected.state.playerState, source.state.playerState);
  assert.deepEqual(projected.state.turnState, source.state.turnState);
  assert.deepEqual(projected.state.rocketState.playerRocketSequences, source.state.rocketState.playerRocketSequences);
  assert.equal(projected.state.rocketState.nextRocketId, 9);
  assert.equal(projected.state.rocketState.statusNote, "host note");
  assert.deepEqual(projected.state.techGameState.ui, { cheatModeEnabled: true });
  assert.deepEqual(projected.state.cardState.ui, { selectionActive: false });
  assert.deepEqual(projected.state.finalScoringState.pendingMarks, []);
  assert.equal(Object.hasOwn(projected.state, "cardTaskState"), false);
  assert.equal(Object.hasOwn(projected.state, "setupSelectionState"), false);
})();

(function testSerializationIsDeterministicAndExplicitlyDeserialized() {
  const source = createLegacySnapshot();
  const first = adapter.serializeLegacySnapshot(source);
  const second = adapter.serializeLegacySnapshot(source);
  assert.equal(first.ok, true);
  assert.equal(first.serialized, second.serialized);
  const recovered = adapter.deserializeRecoverySnapshot({
    version: 2,
    committedState: first.serialized,
  });
  assert.equal(recovered.ok, true);
  assert.equal(recovered.state.meta.schemaVersion, stateStore.SCHEMA_VERSION);
})();

(function testStageTwoCommittedSnapshotsArePurifiedOnTheStageThreeBoundary() {
  const source = createLegacySnapshot({
    solarState: {
      wheelSteps: [0, 1, 2, 3, 0],
      rotation: { wheel1Steps: 1, wheel2Steps: 2, wheel3Steps: 3, wheel4Steps: 0 },
    },
    planetStatsState: {
      planets: {
        mars: {
          orbits: 1,
          landings: 0,
          orbitMarkers: [{ sequence: 1, displayed: true, displaySlot: 1, playerId: "p1" }],
          landingMarkers: [],
          satelliteLandings: [],
        },
      },
    },
  });
  const stageTwo = stateStore.createCommittedGameState({
    gameId: "stage-two",
    rulesetVersion: "legacy-recovery-v1",
    seed: 82,
    rngState: { owner: "test" },
    sequences: { rocket: 9 },
    match: {},
    turn: { ...source.state.turnState, currentPlayerId: "p2" },
    players: { players: [{ id: "p1" }, { id: "p2" }] },
    solarSystem: source.state.solarState,
    pieces: { rockets: [], playerRocketSequences: {} },
    planets: source.state.planetStatsState,
    data: {}, cards: {}, tech: {}, aliens: {}, finalScoring: { pendingMarks: [] },
  });
  const recovered = adapter.deserializeRecoverySnapshot({
    version: 2,
    committedState: JSON.stringify(stageTwo),
  });
  assert.equal(recovered.ok, true);
  assert.equal(Object.hasOwn(recovered.state.solarSystem, "wheelSteps"), false);
  assert.equal(Object.hasOwn(recovered.state.planets.planets.mars, "orbits"), false);
  assert.equal(Object.hasOwn(recovered.state.finalScoring, "pendingMarks"), false);
  const projected = adapter.projectCommittedStateToLegacySlices(recovered.state);
  assert.deepEqual(projected.state.solarState.wheelSteps, [0, 1, 2, 3, 0]);
  assert.equal(projected.state.planetStatsState.planets.mars.orbits, 1);
  assert.equal(projected.state.planetStatsState.planets.mars.orbitMarkers[0].sequence, 1);
})();

(function testFailClosedMatrix() {
  const missing = createLegacySnapshot();
  delete missing.state.planetStatsState;
  assert.equal(adapter.adaptLegacySnapshot(missing).code, "LEGACY_STATE_SLICE_MISSING");
  assert.equal(adapter.adaptLegacySnapshot("{bad json").code, "LEGACY_SNAPSHOT_JSON_INVALID");
  assert.equal(adapter.adaptLegacySnapshot({ ...createLegacySnapshot(), version: 0 }).code,
    "LEGACY_SNAPSHOT_VERSION_UNSUPPORTED");
  assert.equal(adapter.deserializeRecoverySnapshot({ version: 999, committedState: "{}" }).code,
    "RECOVERY_SNAPSHOT_VERSION_UNSUPPORTED");
  assert.equal(adapter.deserializeRecoverySnapshot({ version: 2 }).code,
    "RECOVERY_COMMITTED_STATE_MISSING");

  const badSet = createLegacySnapshot({
    rocketState: {
      ...createLegacySnapshot().state.rocketState,
      playerRocketSequences: { p1: { 1: true } },
    },
  });
  assert.equal(adapter.adaptLegacySnapshot(badSet).code, "LEGACY_STATE_ADAPT_FAILED");
})();

console.log("legacy state adapter tests passed");
