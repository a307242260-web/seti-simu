"use strict";

const assert = require("node:assert/strict");
const { createRuntime } = require("./session-runtime");
const { createResearchTechRuntime } = require("./research-tech-session");
const {
  createCommittedGameState,
  createStateStore,
} = require("../state/state-store");

function createState(overrides = {}) {
  return createCommittedGameState({
    gameId: "effect-store-stage6",
    rulesetVersion: "prototype-2026-07",
    seed: 86,
    rngState: { algorithm: "fixture", cursor: 0, state: 86 },
    sequences: { card: 2, rocket: 1 },
    match: { status: "playing", playerOrder: ["p1", "p2"] },
    turn: { round: 1, turn: 1, currentPlayerId: "p1" },
    players: {
      p1: { resources: { credits: 5 }, hand: ["card-a"], techTileIds: [] },
      p2: { resources: { credits: 5 }, hand: [], techTileIds: [] },
    },
    solarSystem: { rotation: 0 },
    pieces: { rockets: { r1: { id: "r1", ownerId: "p1", location: "earth" } } },
    planets: { mars: { orbitMarkers: [] } },
    data: {},
    cards: { drawPile: ["card-b"], discardPile: [], taskFacts: [] },
    tech: { supply: { orange: ["orange-1"] } },
    aliens: {},
    finalScoring: {},
    ...overrides,
  });
}

function committedBytes(store) {
  const serialized = store.serialize();
  assert.equal(serialized.ok, true);
  return serialized.serialized;
}

function instrumentStore(store) {
  const counters = { compareAndCommit: 0, legacyDirectWrite: 0 };
  return {
    counters,
    getSnapshot: store.getSnapshot,
    beginWorkingCopy: store.beginWorkingCopy,
    compareAndCommit(baseVersion, candidate, metadata) {
      counters.compareAndCommit += 1;
      return store.compareAndCommit(baseVersion, candidate, metadata);
    },
    replaceCommittedSlices() {
      counters.legacyDirectWrite += 1;
      throw new Error("旧 committed 切片直写不得被调用");
    },
  };
}

function createMutationRuntime(store) {
  const runtime = createRuntime({ stateStore: store });
  runtime.registerExecutor("mutate", (state, effect) => {
    if (effect.payload.fail) throw new Error(`poison:${effect.payload.step}`);
    const nextState = structuredClone(state);
    const step = effect.payload.step;
    if (step === "research-pay") nextState.players.p1.resources.credits -= 2;
    if (step === "research-take") {
      nextState.tech.supply.orange = [];
      nextState.players.p1.techTileIds.push("orange-1");
    }
    if (step === "research-reward") nextState.cards.discardPile.push("research-reward");
    if (step === "card-pay") nextState.players.p1.resources.credits -= 1;
    if (step === "card-move") {
      nextState.players.p1.hand = [];
      nextState.cards.discardPile.push("card-a");
    }
    if (step === "card-task") nextState.cards.taskFacts.push("card-a:task-ready");
    if (step === "board-move") nextState.pieces.rockets.r1.location = "mars";
    if (step === "board-orbit") {
      nextState.planets.mars.orbitMarkers.push({ pieceId: "r1", ownerId: "p1" });
    }
    return {
      ok: true,
      nextState,
      events: [{ type: step }],
      history: [{ label: step }],
    };
  });
  return runtime;
}

function dispatchSteps(runtime, family, steps, meta = {}) {
  return runtime.dispatchStoredAction(
    { family, actorId: "p1" },
    () => ({
      groupId: family,
      ownerId: "p1",
      effects: steps.map((step) => ({ type: "mutate", payload: step })),
    }),
    meta,
  );
}

(function testRepresentativeChainsCommitAllSlicesThroughOneCas() {
  const cases = [
    {
      family: "research_tech",
      steps: ["research-pay", "research-take", "research-reward"],
      assertState(state) {
        assert.equal(state.players.p1.resources.credits, 3);
        assert.deepEqual(state.players.p1.techTileIds, ["orange-1"]);
        assert.deepEqual(state.tech.supply.orange, []);
        assert.deepEqual(state.cards.discardPile, ["research-reward"]);
      },
    },
    {
      family: "play_card",
      steps: ["card-pay", "card-move", "card-task"],
      assertState(state) {
        assert.equal(state.players.p1.resources.credits, 4);
        assert.deepEqual(state.players.p1.hand, []);
        assert.deepEqual(state.cards.discardPile, ["card-a"]);
        assert.deepEqual(state.cards.taskFacts, ["card-a:task-ready"]);
      },
    },
    {
      family: "orbit",
      steps: ["board-move", "board-orbit"],
      assertState(state) {
        assert.equal(state.pieces.rockets.r1.location, "mars");
        assert.deepEqual(state.planets.mars.orbitMarkers, [{ pieceId: "r1", ownerId: "p1" }]);
      },
    },
  ];

  for (const proofCase of cases) {
    const authority = createStateStore(createState());
    const events = [];
    authority.subscribe((event) => events.push(event));
    const store = instrumentStore(authority);
    const runtime = createMutationRuntime(store);
    const before = committedBytes(authority);
    const dispatched = dispatchSteps(
      runtime,
      proofCase.family,
      proofCase.steps.map((step) => ({ step })),
      { sessionId: `${proofCase.family}-session` },
    );
    assert.equal(dispatched.ok, true);
    assert.equal(committedBytes(authority), before, "queue 未 drain 前不得提交");
    assert.equal(runtime.drain(dispatched.session).ok, true);
    assert.equal(dispatched.session.phase, "completed");
    assert.equal(store.counters.compareAndCommit, 1);
    assert.equal(store.counters.legacyDirectWrite, 0);
    assert.equal(events.length, 1);
    assert.deepEqual(dispatched.session.committedState, events[0].snapshot);
    assert.deepEqual(events[0].metadata.journal, dispatched.session.journal);
    assert.equal(events[0].metadata.sessionId, `${proofCase.family}-session`);
    proofCase.assertState(authority.getSnapshot());
  }
})();

(function testResearchFacadeStartsFromStateStoreWorkingCopy() {
  const authority = createStateStore(createState());
  const store = instrumentStore(authority);
  const research = createResearchTechRuntime({
    stateStore: store,
    actionRegistry: {
      validate(state, action) {
        return state.meta.stateVersion === action.stateVersion
          ? { ok: true }
          : { ok: false, code: "STANDARD_ACTION_STALE", message: "action 已过期" };
      },
    },
    rotate(state) {
      state.solarSystem.rotation += 1;
      return { ok: true, nextState: state };
    },
    listChoices: (state) => state.tech.supply.orange.map((tileId) => ({ tileId })),
    place(state, choice) {
      state.tech.supply.orange = state.tech.supply.orange.filter((tileId) => tileId !== choice.tileId);
      state.players.p1.techTileIds.push(choice.tileId);
      return { ok: true, nextState: state, placement: choice };
    },
    buildImmediateRewards: () => [{ credits: 2 }],
    applyImmediateReward(state, reward) {
      state.players.p1.resources.credits += reward.credits;
      return { ok: true, nextState: state };
    },
  });
  const dispatched = research.dispatch(null, {
    family: "research_tech",
    actorId: "p1",
    stateVersion: authority.getSnapshot().meta.stateVersion,
  });
  assert.equal(research.drain(dispatched.session).ok, true);
  const decision = research.inspect(dispatched.session).decision;
  assert.deepEqual(decision.choices, [{ tileId: "orange-1" }]);
  assert.equal(research.resolveDecision(dispatched.session, {
    decisionId: decision.decisionId,
    decisionVersion: decision.decisionVersion,
    choice: { tileId: "orange-1" },
  }).ok, true);
  assert.equal(research.drain(dispatched.session).ok, true);
  const committed = authority.getSnapshot();
  assert.equal(committed.solarSystem.rotation, 1);
  assert.deepEqual(committed.tech.supply.orange, []);
  assert.deepEqual(committed.players.p1.techTileIds, ["orange-1"]);
  assert.equal(committed.players.p1.resources.credits, 7);
  assert.equal(store.counters.compareAndCommit, 1);
  assert.equal(store.counters.legacyDirectWrite, 0);
})();

(function testStandardActionMustValidateBeforeQueueAndCommitOnce() {
  const authority = createStateStore(createState());
  const store = instrumentStore(authority);
  const runtime = createMutationRuntime(store);
  const before = committedBytes(authority);
  let validationCalls = 0;
  let groupCalls = 0;
  const registry = {
    validate(state, action) {
      validationCalls += 1;
      assert.equal(state.meta.stateVersion, authority.getSnapshot().meta.stateVersion);
      return action.stateVersion === state.meta.stateVersion
        ? { ok: true }
        : { ok: false, code: "STANDARD_ACTION_STALE", message: "action 已过期" };
    },
  };
  const buildGroup = (_state, action) => {
    groupCalls += 1;
    return {
      effects: [{ type: "mutate", payload: { step: "research-pay", family: action.family } }],
    };
  };

  const stale = runtime.dispatchStandardAction(
    { family: "scan", actorId: "p1", stateVersion: 99 },
    registry,
    buildGroup,
  );
  assert.equal(stale.ok, false);
  assert.equal(stale.code, "STANDARD_ACTION_STALE");
  assert.equal(groupCalls, 0, "非法 Action 不得创建 Effect Group");
  assert.equal(store.counters.compareAndCommit, 0);
  assert.equal(committedBytes(authority), before);

  const dispatched = runtime.dispatchStandardAction(
    { family: "scan", actorId: "p1", stateVersion: 0 },
    registry,
    buildGroup,
    { sessionId: "standard-main-chain" },
  );
  assert.equal(dispatched.ok, true);
  assert.equal(validationCalls, 2);
  assert.equal(groupCalls, 1);
  assert.equal(committedBytes(authority), before, "queue drain 前权威状态必须不变");
  assert.equal(runtime.drain(dispatched.session).ok, true);
  assert.equal(dispatched.session.phase, "completed");
  assert.equal(store.counters.compareAndCommit, 1, "完整 Session 只能提交一次");
})();

(function testEveryRepresentativeStepFailureLeavesCommittedBytesUnchanged() {
  const steps = ["research-pay", "research-take", "research-reward"];
  for (let failedIndex = 0; failedIndex < steps.length; failedIndex += 1) {
    const authority = createStateStore(createState());
    const store = instrumentStore(authority);
    const runtime = createMutationRuntime(store);
    const before = committedBytes(authority);
    const dispatched = dispatchSteps(runtime, "research_tech", steps.map((step, index) => ({
      step,
      fail: index === failedIndex,
    })));
    const result = runtime.drain(dispatched.session);
    assert.equal(result.ok, false);
    assert.equal(dispatched.session.phase, "aborted");
    assert.equal(store.counters.compareAndCommit, 0);
    assert.equal(store.counters.legacyDirectWrite, 0);
    assert.equal(committedBytes(authority), before, `第 ${failedIndex + 1} 步失败污染 committed bytes`);
  }
})();

(function testTwoSessionsAtOneVersionOnlyFirstCanCommit() {
  const authority = createStateStore(createState());
  const store = instrumentStore(authority);
  const runtime = createRuntime({ stateStore: store });
  runtime.registerExecutor("choose-turn", {
    getLegalChoices: () => [{ turn: 2 }, { turn: 3 }],
    resolveDecision(state, _effect, choice) {
      return { ok: true, nextState: { ...state, turn: { ...state.turn, turn: choice.turn } } };
    },
  });
  const createGroup = () => ({
    effects: [{ type: "choose-turn", kind: "decision", ownerId: "p1" }],
  });
  const left = runtime.dispatchStoredAction({ family: "choose", actorId: "p1" }, createGroup);
  const right = runtime.dispatchStoredAction({ family: "choose", actorId: "p1" }, createGroup);
  runtime.drain(left.session);
  runtime.drain(right.session);
  const leftDecision = runtime.inspect(left.session).decision;
  const rightDecision = runtime.inspect(right.session).decision;
  assert.equal(runtime.resolveDecision(left.session, {
    decisionId: leftDecision.decisionId,
    decisionVersion: leftDecision.decisionVersion,
    choice: { turn: 2 },
  }).ok, true);
  const conflict = runtime.resolveDecision(right.session, {
    decisionId: rightDecision.decisionId,
    decisionVersion: rightDecision.decisionVersion,
    choice: { turn: 3 },
  });
  assert.equal(conflict.code, "STATE_VERSION_CONFLICT");
  assert.equal(right.session.phase, "aborted");
  assert.equal(authority.getSnapshot().turn.turn, 2);
  assert.equal(authority.getSnapshot().meta.stateVersion, 1);
  assert.equal(store.counters.compareAndCommit, 2, "两个 writer 都只能通过唯一 CAS 争用权威状态");
})();

(function testInvariantAbortAndIrreversibleFailureNeverBypassStore() {
  const invariantStore = createStateStore(createState(), {
    invariantValidators: [(state) => state.players.p1.resources.credits >= 0
      ? { ok: true }
      : { ok: false, code: "NEGATIVE_CREDITS" }],
  });
  const instrumentedInvariant = instrumentStore(invariantStore);
  const invariantRuntime = createRuntime({ stateStore: instrumentedInvariant });
  invariantRuntime.registerExecutor("overspend", (state) => ({
    ok: true,
    nextState: {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, resources: { credits: -1 } },
      },
    },
  }));
  const beforeInvariant = committedBytes(invariantStore);
  const invalid = invariantRuntime.dispatchStoredAction(
    { family: "overspend", actorId: "p1" },
    () => ({ effects: [{ type: "overspend" }] }),
  );
  assert.equal(invariantRuntime.drain(invalid.session).code, "NEGATIVE_CREDITS");
  assert.equal(invalid.session.phase, "aborted");
  assert.equal(committedBytes(invariantStore), beforeInvariant);

  const barrierStore = createStateStore(createState());
  const instrumentedBarrier = instrumentStore(barrierStore);
  const barrierRuntime = createRuntime({ stateStore: instrumentedBarrier });
  barrierRuntime.registerExecutor("reveal", (state) => ({
    ok: true,
    nextState: { ...state, aliens: { revealed: ["alien-x"] } },
    irreversible: { code: "alien_revealed", reason: "已向玩家显示" },
  }));
  barrierRuntime.registerExecutor("explode", () => { throw new Error("after reveal"); });
  const beforeBarrier = committedBytes(barrierStore);
  const locked = barrierRuntime.dispatchStoredAction(
    { family: "reveal", actorId: "p1" },
    () => ({ effects: [{ type: "reveal" }, { type: "explode" }] }),
  );
  assert.equal(barrierRuntime.drain(locked.session).code, "EFFECT_SESSION_IRREVERSIBLE_LOCKED");
  assert.equal(locked.session.phase, "irreversible_locked");
  assert.equal(instrumentedBarrier.counters.compareAndCommit, 0);
  assert.equal(committedBytes(barrierStore), beforeBarrier);
})();

console.log("StateStore Effect Session stage 6 tests passed");
