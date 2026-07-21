"use strict";

const assert = require("node:assert/strict");
const { createRuntime, SCHEMA_VERSION } = require("./session-runtime");

function createHarness(options = {}) {
  let authority = options.authority || { version: 1, value: 0, legalTechs: ["orange", "blue"] };
  const runtime = createRuntime({
    readCommittedState: () => authority,
    validateState: (state) => state.value < 100
      ? { ok: true }
      : { ok: false, code: "VALUE_TOO_LARGE", message: "value 越界" },
    projectState: (state, viewer) => ({ value: state.value, viewer }),
    maxDrainSteps: options.maxDrainSteps || 30,
  });
  runtime.registerExecutor("add", (state, effect) => ({
    ok: true,
    nextState: { ...state, value: state.value + effect.payload.amount },
    events: [{ type: "added", amount: effect.payload.amount }],
    log: effect.payload.label || `+${effect.payload.amount}`,
    spawnedEffects: effect.payload.spawnedEffects || [],
  }));
  runtime.registerExecutor("choose-tech", {
    getLegalChoices(state) {
      return state.legalTechs.map((tech) => ({ tech }));
    },
    resolveDecision(state, effect, choice) {
      return {
        ok: true,
        nextState: { ...state, chosenTech: choice.tech },
        events: [{ type: "tech-chosen", tech: choice.tech }],
      };
    },
  });
  runtime.registerExecutor("remove-tech", (state, effect) => ({
    ok: true,
    nextState: {
      ...state,
      legalTechs: state.legalTechs.filter((tech) => tech !== effect.payload.tech),
    },
  }));
  runtime.registerExecutor("reveal", (state) => ({
    ok: true,
    nextState: { ...state, revealed: "alien-x" },
    rng: [{ cursor: 4, result: "alien-x" }],
    irreversible: { code: "hidden_revealed", reason: "外星人已展示给玩家" },
  }));
  runtime.registerExecutor("explode", () => {
    throw new Error("boom");
  });
  runtime.registerExecutor("loop", (state) => ({
    ok: true,
    nextState: state,
    spawnedEffects: [{ type: "loop" }],
  }));
  return {
    runtime,
    get authority() { return authority; },
    setAuthority(next) { authority = next; },
  };
}

function actionGroup(effects) {
  return () => ({ groupId: "main", effects });
}

(function testEmptyEffectGroupFailsClosed() {
  const { runtime } = createHarness();
  const committed = { version: 1, value: 0, legalTechs: [] };
  const result = runtime.dispatchAction(committed, { family: "test" }, actionGroup([]));
  assert.equal(result.code, "EFFECT_GROUP_INVALID");
  assert.equal(result.session.phase, "aborted");
  assert.deepEqual(result.session.workingState, committed);
  assert.deepEqual(result.session.journal.effects, []);
})();

(function testNestedInsertionOrderAndAtomicCommit() {
  const { runtime } = createHarness();
  const dispatched = runtime.dispatchAction(
    { version: 1, value: 0, legalTechs: [] },
    { family: "test" },
    actionGroup([
      {
        type: "add",
        payload: {
          amount: 1,
          label: "parent",
          spawnedEffects: [
            { priority: "deferred", effect: { type: "add", payload: { amount: 8, label: "deferred" } } },
            { priority: "trigger", effect: { type: "add", payload: { amount: 4, label: "trigger" } } },
            {
              priority: "direct",
              effect: {
                type: "add",
                payload: {
                  amount: 2,
                  label: "direct",
                  spawnedEffects: [{ type: "add", payload: { amount: 3, label: "nested" } }],
                },
              },
            },
          ],
        },
      },
      { type: "add", payload: { amount: 16, label: "original" } },
    ]),
  );
  assert.equal(dispatched.ok, true);
  assert.equal(dispatched.session.schemaVersion, SCHEMA_VERSION);
  assert.equal(runtime.drain(dispatched.session).ok, true);
  assert.equal(dispatched.session.phase, "completed");
  assert.equal(dispatched.session.committedState.value, 34);
  assert.deepEqual(dispatched.session.journal.logs, ["parent", "direct", "nested", "trigger", "deferred", "original"]);
})();

(function testResearchProofCaseReadsWorkingStateInOrder() {
  const { runtime } = createHarness();
  runtime.registerExecutor("rotate", (state) => ({
    ok: true,
    nextState: { ...state, rotation: (state.rotation || 0) + 1 },
  }));
  runtime.registerExecutor("place-tech", (state) => ({
    ok: true,
    nextState: { ...state, placed: `${state.chosenTech}@${state.rotation}` },
  }));
  const dispatched = runtime.dispatchAction(
    { version: 1, value: 0, legalTechs: ["orange", "blue"], rotation: 0 },
    { family: "research_tech" },
    actionGroup([
      { type: "rotate" },
      { type: "choose-tech", kind: "decision", ownerId: "p1", decisionKind: "choose_tech" },
      { type: "place-tech" },
      { type: "add", payload: { amount: 5, label: "reward" } },
    ]),
  );
  assert.equal(runtime.drain(dispatched.session).ok, true);
  const decision = runtime.inspect(dispatched.session).decision;
  assert.equal(dispatched.session.phase, "awaiting_input");
  assert.deepEqual(decision.choices, [{ tech: "orange" }, { tech: "blue" }]);
  assert.equal(runtime.resolveDecision(dispatched.session, {
    decisionId: decision.decisionId,
    decisionVersion: decision.decisionVersion,
    choice: { tech: "blue" },
  }).ok, true);
  assert.equal(runtime.drain(dispatched.session).ok, true);
  assert.equal(dispatched.session.committedState.placed, "blue@1");
  assert.equal(dispatched.session.committedState.value, 5);
})();

(function testQuickInterruptRevalidatesDecision() {
  const { runtime } = createHarness();
  const dispatched = runtime.dispatchAction(
    { version: 1, value: 0, legalTechs: ["orange", "blue"] },
    { family: "research_tech" },
    actionGroup([
      {
        type: "choose-tech",
        kind: "decision",
        ownerId: "p1",
        decisionKind: "choose_tech",
        allowQuickActions: true,
      },
    ]),
  );
  runtime.drain(dispatched.session);
  const before = runtime.inspect(dispatched.session).decision;
  assert.equal(runtime.dispatchQuickAction(
    dispatched.session,
    { family: "quick_trade" },
    actionGroup([{ type: "remove-tech", payload: { tech: "blue" } }]),
  ).ok, true);
  assert.equal(runtime.drain(dispatched.session).ok, true);
  const after = runtime.inspect(dispatched.session).decision;
  assert.deepEqual(after.choices, [{ tech: "orange" }]);
  assert.notEqual(after.decisionVersion, before.decisionVersion);
  const stale = runtime.resolveDecision(dispatched.session, {
    decisionId: before.decisionId,
    decisionVersion: before.decisionVersion,
    choice: { tech: "blue" },
  });
  assert.equal(stale.code, "EFFECT_DECISION_STALE");
  const illegal = runtime.resolveDecision(dispatched.session, {
    decisionId: after.decisionId,
    decisionVersion: after.decisionVersion,
    choice: { tech: "blue" },
  });
  assert.equal(illegal.code, "EFFECT_DECISION_NOT_LEGAL");
})();

(function testQuickInterruptAtDeterministicBoundaryResumesOriginalQueue() {
  const { runtime } = createHarness();
  const dispatched = runtime.dispatchAction(
    { version: 1, value: 0, legalTechs: [] },
    { family: "test" },
    actionGroup([
      { type: "add", payload: { amount: 1, label: "original-1" } },
      { type: "add", payload: { amount: 4, label: "original-2" } },
    ]),
  );
  assert.equal(runtime.advance(dispatched.session).ok, true);
  assert.equal(runtime.dispatchQuickAction(
    dispatched.session,
    { family: "quick_trade" },
    actionGroup([{ type: "add", payload: { amount: 2, label: "quick" } }]),
    { allowAtBoundary: true },
  ).ok, true);
  assert.equal(runtime.drain(dispatched.session).ok, true);
  assert.equal(dispatched.session.committedState.value, 7);
  assert.deepEqual(dispatched.session.journal.logs, ["original-1", "quick", "original-2"]);
})();

(function testAwaitingDecisionCannotCommitAndObservationSharesWorkingState() {
  const { runtime } = createHarness();
  const dispatched = runtime.dispatchAction(
    { version: 1, value: 0, legalTechs: ["orange"] },
    { family: "test" },
    actionGroup([
      { type: "add", payload: { amount: 7 } },
      { type: "choose-tech", kind: "decision", ownerId: "p1" },
    ]),
  );
  runtime.drain(dispatched.session);
  assert.equal(dispatched.session.phase, "awaiting_input");
  assert.equal(dispatched.session.committedState, null);
  assert.deepEqual(runtime.observe(dispatched.session, "browser").state, { value: 7, viewer: "browser" });
  assert.deepEqual(runtime.observe(dispatched.session, "policy").state, { value: 7, viewer: "policy" });
})();

(function testExecutorFailureRollsBackWithoutPollutingBase() {
  const { runtime } = createHarness();
  const committed = { version: 1, value: 2, legalTechs: [] };
  const dispatched = runtime.dispatchAction(committed, { family: "test" }, actionGroup([
    { type: "add", payload: { amount: 3 } },
    { type: "explode" },
  ]));
  const result = runtime.drain(dispatched.session);
  assert.equal(result.code, "EFFECT_EXECUTOR_THROWN");
  assert.equal(dispatched.session.phase, "aborted");
  assert.deepEqual(dispatched.session.workingState, committed);
  assert.deepEqual(committed, { version: 1, value: 2, legalTechs: [] });
})();

(function testUnknownExecutorFailsClosed() {
  const { runtime } = createHarness();
  const dispatched = runtime.dispatchAction(
    { version: 1, value: 0, legalTechs: [] },
    { family: "test" },
    actionGroup([{ type: "legacy-fallback" }]),
  );
  const result = runtime.advance(dispatched.session);
  assert.equal(result.code, "EFFECT_EXECUTOR_NOT_REGISTERED");
  assert.equal(dispatched.session.phase, "aborted");
})();

(function testMalformedExecutorResultFailsClosed() {
  const { runtime } = createHarness();
  runtime.registerExecutor("bad-events", (state) => ({ ok: true, nextState: state, events: {} }));
  const dispatched = runtime.dispatchAction(
    { version: 1, value: 0, legalTechs: [] },
    { family: "test" },
    actionGroup([{ type: "bad-events" }]),
  );
  const result = runtime.advance(dispatched.session);
  assert.equal(result.code, "EFFECT_RESULT_INVALID");
  assert.equal(dispatched.session.phase, "aborted");
})();

(function testIrreversibleBarrierRejectsFakeRollback() {
  const { runtime } = createHarness();
  const dispatched = runtime.dispatchAction(
    { version: 1, value: 0, legalTechs: [] },
    { family: "test" },
    actionGroup([{ type: "reveal" }, { type: "explode" }]),
  );
  const result = runtime.drain(dispatched.session);
  assert.equal(result.code, "EFFECT_SESSION_IRREVERSIBLE_LOCKED");
  assert.equal(dispatched.session.phase, "irreversible_locked");
  assert.equal(dispatched.session.workingState.revealed, "alien-x");
  assert.deepEqual(dispatched.session.journal.rng, [{ cursor: 4, result: "alien-x" }]);
})();

(function testInspectPublishesUndoBarrierAndEffectProgress() {
  const { runtime } = createHarness();
  const dispatched = runtime.dispatchAction(
    { version: 1, value: 0, legalTechs: [] },
    { family: "test" },
    actionGroup([
      { type: "add", payload: { amount: 1 } },
      { type: "reveal" },
      { type: "add", payload: { amount: 2 } },
    ]),
  );
  runtime.advance(dispatched.session);
  const beforeBarrier = runtime.inspect(dispatched.session);
  assert.equal(beforeBarrier.controls.canUndo, true);
  assert.deepEqual(beforeBarrier.progress, {
    completedEffects: 1,
    remainingEffects: 2,
    totalEffects: 3,
    currentEffectId: beforeBarrier.currentEffect.effectId,
    currentEffectType: "reveal",
  });
  runtime.advance(dispatched.session);
  const afterBarrier = runtime.inspect(dispatched.session);
  assert.equal(afterBarrier.controls.canUndo, false);
  assert.equal(afterBarrier.controls.undoDisabledReason, "不可越过隐藏信息屏障撤销");
  assert.equal(runtime.undoLastEffect(dispatched.session).code, "EFFECT_UNDO_IRREVERSIBLE_BARRIER");
})();

(function testConcurrentCommittedVersionConflict() {
  const harness = createHarness();
  const dispatched = harness.runtime.dispatchAction(
    harness.authority,
    { family: "test" },
    actionGroup([{ type: "add", payload: { amount: 1 } }]),
  );
  harness.setAuthority({ ...harness.authority, version: 2 });
  const result = harness.runtime.drain(dispatched.session);
  assert.equal(result.code, "EFFECT_SESSION_VERSION_CONFLICT");
  assert.equal(dispatched.session.phase, "aborted");
})();

(function testInvariantFailureAbortsAtCommit() {
  const { runtime } = createHarness();
  const dispatched = runtime.dispatchAction(
    { version: 1, value: 99, legalTechs: [] },
    { family: "test" },
    actionGroup([{ type: "add", payload: { amount: 1 } }]),
  );
  const result = runtime.drain(dispatched.session);
  assert.equal(result.code, "VALUE_TOO_LARGE");
  assert.equal(dispatched.session.phase, "aborted");
})();

(function testDrainLimitFailsClosed() {
  const { runtime } = createHarness({ maxDrainSteps: 3 });
  const dispatched = runtime.dispatchAction(
    { version: 1, value: 0, legalTechs: [] },
    { family: "test" },
    actionGroup([{ type: "loop" }]),
  );
  const result = runtime.drain(dispatched.session);
  assert.equal(result.code, "EFFECT_DRAIN_LIMIT_EXCEEDED");
  assert.equal(dispatched.session.phase, "aborted");
})();

console.log("effect session runtime tests passed");
