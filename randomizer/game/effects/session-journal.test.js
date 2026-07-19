"use strict";

const assert = require("node:assert/strict");
const effectSession = require("./session-runtime");

function clone(value) {
  return structuredClone(value);
}

function createState() {
  return {
    version: 7,
    value: 0,
    hiddenCard: null,
    rngState: { algorithm: "fixture-v1", state: 17, cursor: 0 },
  };
}

function actionGroup(effects) {
  return () => ({ groupId: "main", ownerId: "p1", effects });
}

function submitCurrentDecision(runtime, session, choice) {
  const decision = runtime.inspect(session).decision;
  return runtime.resolveDecision(session, {
    decisionId: decision.decisionId,
    decisionVersion: decision.decisionVersion,
    choice,
  });
}

function createRuntime() {
  const runtime = effectSession.createRuntime({
    getStateVersion: (state) => state.version,
  });
  runtime.registerExecutor("add", (state, effect) => ({
    ok: true,
    nextState: { ...state, value: state.value + effect.payload.amount },
    events: [{ type: "value_added", amount: effect.payload.amount }],
    history: [{ label: effect.payload.label, source: effect.groupKind }],
  }));
  runtime.registerExecutor("draw", (state) => {
    const cursor = state.rngState.cursor + 1;
    const result = `card-${state.rngState.state}-${cursor}`;
    return {
      ok: true,
      nextState: {
        ...state,
        hiddenCard: result,
        rngState: { ...state.rngState, cursor },
      },
      rng: [{ cursor, result }],
      events: [{ type: "hidden_card_drawn" }],
      irreversible: { code: "hidden_card_reveal", reason: "抽牌已向玩家揭示" },
    };
  });
  runtime.registerExecutor("rng-step", (state) => {
    const cursor = state.rngState.cursor + 1;
    const result = (state.rngState.state * 31 + cursor) % 97;
    return {
      ok: true,
      nextState: {
        ...state,
        value: state.value + result,
        rngState: { ...state.rngState, cursor },
      },
      rng: [{ cursor, result }],
      events: [{ type: "rng_applied", result }],
    };
  });
  runtime.registerExecutor("choose", {
    getLegalChoices: () => [{ amount: 2 }, { amount: 5 }],
    resolveDecision: (state, _effect, choice) => ({
      ok: true,
      nextState: { ...state, value: state.value + choice.amount },
      events: [{ type: "choice_applied", amount: choice.amount }],
    }),
  });
  runtime.registerExecutor("reject-choice", {
    getLegalChoices: () => [{ id: "confirmed-by-owner" }],
    resolveDecision: () => ({
      ok: false,
      code: "FIXTURE_DECISION_FAILED",
      message: "决策执行失败",
    }),
  });
  return runtime;
}

(function testReplayOnlyContainsConfirmedExternalChoices() {
  const runtime = createRuntime();
  const dispatched = runtime.dispatchAction(createState(), { family: "fixture", actorId: "p1" }, actionGroup([
    { type: "add", payload: { amount: 1, label: "确定性环境效果" } },
    { type: "choose", kind: "decision", ownerId: "p1" },
  ]));
  runtime.drain(dispatched.session);
  assert.deepEqual(
    dispatched.session.journal.replay.map((step) => step.kind),
    ["action"],
    "确定性 Effect 只能写 event/history，不能伪装成外部 replay step",
  );
  assert.equal(dispatched.session.journal.events.length, 1);
  assert.equal(submitCurrentDecision(runtime, dispatched.session, { amount: 2 }).ok, true);
  assert.deepEqual(dispatched.session.journal.replay.map((step) => step.kind), ["action", "decision"]);
  assert.deepEqual(dispatched.session.journal.replay.map((step) => step.cursor), [0, 1]);

  const failed = runtime.dispatchAction(createState(), { family: "fixture-fail", actorId: "p1" }, actionGroup([
    { type: "reject-choice", kind: "decision", ownerId: "p1" },
  ]));
  runtime.drain(failed.session);
  assert.equal(submitCurrentDecision(runtime, failed.session, { id: "confirmed-by-owner" }).ok, false);
  assert.equal(failed.session.phase, "aborted");
  assert.deepEqual(failed.session.workingState, failed.session.baseState, "屏障前失败必须完整恢复 baseState");
  assert.equal(failed.session.journal.decisions.length, 0, "执行失败的 choice 不是已确认 decision");
  assert.deepEqual(failed.session.journal.replay.map((step) => step.kind), ["action"]);
})();

(function testMainAndQuickActionsShareOneReplayCursor() {
  const runtime = createRuntime();
  const dispatched = runtime.dispatchAction(createState(), { family: "main", actorId: "p1" }, actionGroup([
    { type: "add", payload: { amount: 1, label: "main" } },
    { type: "choose", kind: "decision", ownerId: "p1", allowQuickActions: true },
  ]));
  runtime.advance(dispatched.session);
  const quick = runtime.dispatchQuickAction(
    dispatched.session,
    { family: "quick_trade", actorId: "p1" },
    () => ({ effects: [{ type: "add", payload: { amount: 3, label: "quick" } }] }),
    { allowAtBoundary: true },
  );
  assert.equal(quick.ok, true);
  runtime.drain(dispatched.session);
  assert.deepEqual(
    dispatched.session.journal.replay.map((step) => [step.cursor, step.groupKind]),
    [[0, "action"], [1, "quick"]],
  );
  assert.deepEqual(
    dispatched.session.journal.history.map((entry) => entry.source),
    ["action", "quick"],
    "main/quick history 必须由同一个 session journal 排序",
  );
})();

(function testBarrierAllowsPostBarrierUndoButRejectsFakeRollback() {
  const runtime = createRuntime();
  const dispatched = runtime.dispatchAction(createState(), { family: "reveal", actorId: "p1" }, actionGroup([
    { type: "draw" },
    { type: "add", payload: { amount: 9, label: "屏障后确定性奖励" } },
    { type: "choose", kind: "decision", ownerId: "p1" },
  ]));
  assert.equal(runtime.advance(dispatched.session).ok, true);
  const revealedState = clone(dispatched.session.workingState);
  assert.equal(runtime.advance(dispatched.session).ok, true);
  runtime.drain(dispatched.session);
  assert.equal(dispatched.session.workingState.value, 9);

  const undo = runtime.undoLastEffect(dispatched.session);
  assert.equal(undo.ok, true);
  assert.deepEqual(dispatched.session.workingState, revealedState, "只能撤销屏障后的确定性 Effect");
  const blockedUndo = runtime.undoLastEffect(dispatched.session);
  assert.equal(blockedUndo.code, "EFFECT_UNDO_IRREVERSIBLE_BARRIER");
  const blockedAbort = runtime.abort(dispatched.session, { message: "模拟 crash" });
  assert.equal(blockedAbort.code, "EFFECT_SESSION_IRREVERSIBLE_LOCKED");
  assert.equal(dispatched.session.phase, "irreversible_locked");
  assert.deepEqual(dispatched.session.workingState, revealedState, "揭示后不得恢复旧牌堆并声称回滚成功");
})();

(function testNonZeroCheckpointForkKeepsRngAndReplayParity() {
  const runtime = createRuntime();
  const dispatched = runtime.dispatchAction(createState(), { family: "fork", actorId: "p1" }, actionGroup([
    { type: "rng-step" },
    { type: "choose", kind: "decision", ownerId: "p1" },
    { type: "rng-step" },
  ]), { sessionId: "fork-session" });
  runtime.drain(dispatched.session);
  assert.equal(dispatched.session.workingState.rngState.cursor, 1);
  const checkpointResult = runtime.createCheckpoint(dispatched.session);
  assert.equal(checkpointResult.ok, true);
  assert.equal(checkpointResult.checkpoint.replayCursor, 1);

  function finishFork() {
    const restored = runtime.restoreCheckpoint(checkpointResult.checkpoint);
    assert.equal(restored.ok, true);
    assert.equal(submitCurrentDecision(runtime, restored.session, { amount: 5 }).ok, true);
    assert.equal(runtime.drain(restored.session).ok, true);
    return restored.session;
  }

  const left = finishFork();
  const right = finishFork();
  assert.deepEqual(left.committedState, right.committedState);
  assert.deepEqual(left.journal.rng, right.journal.rng);
  assert.deepEqual(left.journal.replay, right.journal.replay);
  assert.equal(left.committedState.rngState.cursor, 2);
  assert.equal(left.journal.replay.length, 2);
})();

(function testCrashOrTimeoutCannotReplayUnconfirmedDecision() {
  const runtime = createRuntime();
  const dispatched = runtime.dispatchAction(createState(), { family: "timeout", actorId: "p1" }, actionGroup([
    { type: "choose", kind: "decision", ownerId: "p1" },
  ]));
  runtime.drain(dispatched.session);
  const checkpoint = runtime.createCheckpoint(dispatched.session).checkpoint;
  const replay = runtime.getConfirmedReplay(checkpoint);
  assert.equal(replay.ok, true);
  assert.deepEqual(replay.steps.map((step) => step.kind), ["action"]);
  assert.equal(checkpoint.replayCursor, 1, "尚未 resolve 的 UI/Policy choice 不得推进 replay cursor");

  const timedOut = runtime.abort(dispatched.session, { code: "HOST_TIMEOUT", message: "等待选择超时" });
  assert.equal(timedOut.ok, false);
  assert.equal(dispatched.session.phase, "aborted");
  assert.deepEqual(dispatched.session.workingState, dispatched.session.baseState);
})();

console.log("effect session journal stage 5 tests passed");
