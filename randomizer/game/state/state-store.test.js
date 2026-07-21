"use strict";

const assert = require("node:assert/strict");
const {
  SCHEMA_VERSION,
  REQUIRED_ROOT_SLICES,
  createCommittedGameState,
  createStateStore,
} = require("./state-store");

function createState(overrides = {}) {
  return createCommittedGameState({
    gameId: "game-seti-71",
    rulesetVersion: "prototype-2026-07",
    seed: 71,
    rngState: { algorithm: "mulberry32", cursor: 0, state: 1234 },
    sequences: { cardInstance: 4, rocket: 2, event: 9 },
    match: { status: "playing", playerOrder: ["p1", "p2"] },
    turn: { round: 2, turn: 4, actionCycle: 1, currentPlayerId: "p1" },
    players: {
      p1: { resources: { credits: 5, energy: 2 }, techTileIds: [] },
      p2: { resources: { credits: 3, energy: 4 }, techTileIds: [] },
    },
    solarSystem: { rotation: 3 },
    pieces: { probes: {} },
    planets: { mars: { orbiters: [], landers: [] } },
    data: { pool: [] },
    cards: { deck: ["c4", "c3"], market: ["c1"], discard: [] },
    tech: { supply: { orange: ["t1"] } },
    aliens: { revealed: [] },
    finalScoring: { tiles: [] },
    ...overrides,
  });
}

function committedBytes(store) {
  const serialized = store.serialize();
  assert.equal(serialized.ok, true);
  return serialized.serialized;
}

(function testSchemaIsFrozenAndExplicit() {
  assert.equal(SCHEMA_VERSION, "seti-committed-game-state-v1");
  assert.deepEqual(REQUIRED_ROOT_SLICES, [
    "meta", "match", "turn", "players", "solarSystem", "pieces", "planets",
    "data", "cards", "tech", "aliens", "finalScoring",
  ]);
})();

(function testSnapshotsNeverExposeMutableAuthority() {
  const store = createStateStore(createState());
  const first = store.getSnapshot();
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.players.p1.resources), true);
  assert.throws(() => {
    first.players.p1.resources.credits = 99;
  }, TypeError);
  const second = store.getSnapshot();
  assert.notEqual(first, second);
  assert.equal(second.players.p1.resources.credits, 5);
})();

(function testMultiSliceCommitIsAtomicAndVersioned() {
  const store = createStateStore(createState());
  const working = store.beginWorkingCopy(0);
  assert.equal(working.ok, true);
  working.state.players.p1.resources.credits -= 3;
  working.state.players.p1.techTileIds.push("t1");
  working.state.tech.supply.orange = [];
  working.state.cards.discard.push("research-reward");
  const committed = store.compareAndCommit(working.baseVersion, working.state);
  assert.equal(committed.ok, true);
  assert.equal(committed.stateVersion, 1);
  assert.equal(committed.snapshot.players.p1.resources.credits, 2);
  assert.deepEqual(committed.snapshot.players.p1.techTileIds, ["t1"]);
  assert.deepEqual(committed.snapshot.tech.supply.orange, []);
  assert.deepEqual(committed.snapshot.cards.discard, ["research-reward"]);
})();

(function testVersionConflictAllowsOnlyFirstWriter() {
  const store = createStateStore(createState());
  const left = store.beginWorkingCopy(0);
  const right = store.beginWorkingCopy(0);
  left.state.turn.turn = 5;
  right.state.turn.turn = 6;
  assert.equal(store.compareAndCommit(0, left.state).ok, true);
  assert.deepEqual(store.compareAndCommit(0, right.state), {
    ok: false,
    code: "STATE_VERSION_CONFLICT",
    baseVersion: 0,
    currentVersion: 1,
  });
  assert.equal(store.getSnapshot().turn.turn, 5);
})();

(function testAllFailClosedCasesLeaveAuthorityByteEquivalent() {
  const invariant = (state) => state.players.p1.resources.credits >= 0
    ? { ok: true }
    : { ok: false, code: "NEGATIVE_CREDITS", path: "$.players.p1.resources.credits" };
  const cases = [
    {
      expected: "STATE_CANDIDATE_VERSION_MISMATCH",
      mutate(state) { state.meta.stateVersion = 99; },
    },
    {
      expected: "STATE_SLICE_MISSING",
      mutate(state) { delete state.cards; },
    },
    {
      expected: "NEGATIVE_CREDITS",
      mutate(state) { state.players.p1.resources.credits = -1; },
    },
    {
      expected: "STATE_NOT_SERIALIZABLE",
      mutate(state) { state.cards.bad = () => true; },
    },
    {
      expected: "STATE_NON_PLAIN_OBJECT",
      mutate(state) { state.cards.bad = new Map([["x", 1]]); },
    },
    {
      expected: "STATE_CYCLIC_REFERENCE",
      mutate(state) { state.cards.bad = state.cards; },
    },
    {
      expected: "STATE_NON_FINITE_NUMBER",
      mutate(state) { state.cards.bad = Number.NaN; },
    },
  ];

  for (const testCase of cases) {
    const store = createStateStore(createState(), { invariantValidators: [invariant] });
    const before = committedBytes(store);
    const working = store.beginWorkingCopy(0).state;
    testCase.mutate(working);
    const result = store.compareAndCommit(0, working);
    assert.equal(result.ok, false, testCase.expected);
    assert.equal(result.code, testCase.expected, JSON.stringify(result));
    assert.equal(committedBytes(store), before, testCase.expected);
    assert.equal(store.getSnapshot().meta.stateVersion, 0, testCase.expected);
  }
})();

(function testUnknownRootAndRuntimeObjectsAreRejected() {
  const store = createStateStore(createState());
  const working = store.beginWorkingCopy().state;
  working.pending = { overlay: "choose-tech" };
  assert.equal(store.validate(working).code, "STATE_ROOT_FIELD_UNKNOWN");

  delete working.pending;
  Object.defineProperty(working.cards, "hostCallback", {
    enumerable: true,
    get() { return "do-not-call"; },
  });
  assert.equal(store.validate(working).code, "STATE_ACCESSOR_OR_HIDDEN_FIELD");
})();

(function testCanonicalSerializationAndUnknownSchemaRejection() {
  const initial = createState();
  const store = createStateStore(initial);
  const serialized = store.serialize();
  assert.equal(serialized.ok, true);
  assert.equal(serialized.serialized, store.serialize(store.getSnapshot()).serialized);
  const roundTrip = store.deserialize(serialized.serialized);
  assert.equal(roundTrip.ok, true);
  assert.deepEqual(roundTrip.state, store.getSnapshot());
  assert.equal(store.deserialize("{broken").code, "STATE_DESERIALIZE_FAILED");

  for (const schemaVersion of ["seti-committed-game-state-v0", "unknown-v0", null]) {
    const rejected = createState();
    rejected.meta.schemaVersion = schemaVersion;
    const result = store.deserialize(JSON.stringify(rejected));
    assert.equal(result.ok, false);
    assert.equal(result.code, "STATE_SCHEMA_VERSION_UNSUPPORTED");
  }
})();

(function testSubscriberCannotMutateOrRollbackCommittedState() {
  const store = createStateStore(createState());
  const events = [];
  const unsubscribe = store.subscribe((event) => {
    events.push(event);
    assert.throws(() => { event.snapshot.turn.turn = 999; }, TypeError);
    throw new Error("host renderer failed");
  });
  const working = store.beginWorkingCopy().state;
  working.turn.turn = 8;
  const committed = store.compareAndCommit(0, working);
  assert.equal(committed.ok, true);
  assert.equal(store.getSnapshot().turn.turn, 8);
  assert.equal(events.length, 1);
  assert.deepEqual({
    type: events[0].type,
    previousVersion: events[0].previousVersion,
    stateVersion: events[0].stateVersion,
  }, { type: "committed", previousVersion: 0, stateVersion: 1 });
  unsubscribe();
})();

console.log("state-store tests passed");
