"use strict";

const assert = require("node:assert/strict");
const effectSession = require("./session-runtime");
const standardAction = require("../actions/standard-action");
const { createQuickActionCoordinator } = require("./quick-action-session");

function clone(value) {
  return structuredClone(value);
}

function createState() {
  return {
    version: 1,
    actorId: "p1",
    stateVersion: 1,
    decisionVersion: 1,
    value: 0,
    credits: 3,
    legalTargets: ["orange", "blue"],
    quickKinds: ["add-two", "remove-blue", "choose-boost"],
  };
}

function createStandardRegistry(counters = {}) {
  const registry = standardAction.createRegistry({
    getAuthority: (state) => ({
      actorId: state.actorId,
      stateVersion: state.stateVersion,
      decisionVersion: state.decisionVersion,
    }),
  });
  registry.register(standardAction.createOptionDefinition("quick_trade", {
    getOptions: (state) => ({
      ok: true,
      choices: state.quickKinds.map((kind) => ({ target: { kind } })),
    }),
    canExecute: () => ({ ok: true }),
    execute: () => {
      counters.legacyExecute = (counters.legacyExecute || 0) + 1;
      return { ok: true };
    },
  }));
  registry.register(standardAction.createOptionDefinition("launch", {
    getOptions: () => ({ ok: true, choices: [{ target: { kind: "main" } }] }),
    canExecute: () => ({ ok: true }),
    execute: () => ({ ok: true }),
  }));
  return registry;
}

function createHarness(options = {}) {
  const counters = {};
  const registry = createStandardRegistry(counters);
  const runtime = effectSession.createRuntime({
    getStateVersion: (state) => state.version,
    projectState: (state) => clone(state),
  });
  runtime.registerExecutor("add", (state, effect) => ({
    ok: true,
    nextState: { ...state, value: state.value + effect.payload.amount },
    history: [{ source: effect.groupKind, amount: effect.payload.amount }],
    log: effect.payload.label,
  }));
  runtime.registerExecutor("remove-blue", (state) => ({
    ok: true,
    nextState: {
      ...state,
      decisionVersion: state.decisionVersion + 1,
      legalTargets: state.legalTargets.filter((target) => target !== "blue"),
    },
  }));
  runtime.registerExecutor("choose-target", {
    getLegalChoices: (state) => state.legalTargets.map((target) => ({ target })),
    resolveDecision: (state, _effect, choice) => ({
      ok: true,
      nextState: { ...state, chosenTarget: choice.target },
    }),
  });
  runtime.registerExecutor("choose-boost", {
    getLegalChoices: () => [{ amount: 2 }, { amount: 3 }],
    resolveDecision: (state, _effect, choice) => ({
      ok: true,
      nextState: { ...state, value: state.value + choice.amount },
    }),
  });

  const buildEffectGroup = options.buildEffectGroup || ((_state, action) => {
    switch (action.target.kind) {
      case "add-two":
        return { effects: [{ type: "add", payload: { amount: 2, label: "quick" } }] };
      case "remove-blue":
        return { effects: [{ type: "remove-blue" }] };
      case "choose-boost":
        return {
          effects: [{
            type: "choose-boost",
            kind: "decision",
            ownerId: action.actorId,
            decisionKind: "quick_boost",
            allowQuickActions: true,
          }],
        };
      default:
        return { ok: false, code: "QUICK_KIND_UNKNOWN", message: "未知 quick kind" };
    }
  });
  const coordinator = createQuickActionCoordinator({ runtime, registry, buildEffectGroup });
  return { runtime, registry, coordinator, counters };
}

function actionGroup(effects) {
  return () => ({ groupId: "main", ownerId: "p1", effects });
}

function getAction(registry, state, family, kind) {
  return registry.enumerate(state, { family })
    .find((action) => action.target?.kind === kind);
}

(function testDeterministicBoundaryInterruptAndJournalIsolation() {
  const { runtime, registry, coordinator, counters } = createHarness();
  const dispatched = runtime.dispatchAction(createState(), { family: "test", actorId: "p1" }, actionGroup([
    { type: "add", payload: { amount: 1, label: "main-1" } },
    { type: "add", payload: { amount: 4, label: "main-2" } },
  ]));
  assert.equal(runtime.advance(dispatched.session).ok, true);
  const quick = getAction(registry, dispatched.session.workingState, "quick_trade", "add-two");
  assert.equal(coordinator.interrupt(dispatched.session, quick, { allowAtBoundary: true }).ok, true);
  assert.equal(runtime.drain(dispatched.session).ok, true);
  assert.equal(dispatched.session.committedState.value, 7);
  assert.deepEqual(dispatched.session.journal.logs, ["main-1", "quick", "main-2"]);
  assert.deepEqual(
    dispatched.session.journal.effects.map((entry) => entry.groupKind),
    ["action", "quick", "action"],
  );
  assert.deepEqual(
    dispatched.session.journal.history.map((entry) => entry.source),
    ["action", "quick", "action"],
  );
  assert.deepEqual(dispatched.session.journal.actions.map((entry) => entry.groupKind), ["action", "quick"]);
  assert.equal(counters.legacyExecute || 0, 0, "旧 quick execute/history 路径不得参与 Effect Session");
})();

(function testAwaitingDecisionInterruptRevalidatesAndRejectsWithoutSideEffects() {
  const { runtime, registry, coordinator } = createHarness();
  const dispatched = runtime.dispatchAction(createState(), { family: "test", actorId: "p1" }, actionGroup([{
    type: "choose-target",
    kind: "decision",
    ownerId: "p1",
    decisionKind: "choose_target",
    allowQuickActions: true,
  }]));
  runtime.drain(dispatched.session);
  const before = runtime.inspect(dispatched.session).decision;
  const quick = getAction(registry, dispatched.session.workingState, "quick_trade", "remove-blue");
  assert.equal(coordinator.interrupt(dispatched.session, quick).ok, true);
  assert.ok(dispatched.session.revision > before.decisionVersion, "interrupt 接受时旧 decisionVersion 立即失效");
  assert.equal(runtime.drain(dispatched.session).ok, true);
  const after = runtime.inspect(dispatched.session).decision;
  assert.deepEqual(after.choices, [{ target: "orange" }]);
  assert.notEqual(after.decisionVersion, before.decisionVersion);

  const stableCheckpoint = clone(dispatched.session);
  assert.equal(runtime.resolveDecision(dispatched.session, {
    decisionId: before.decisionId,
    decisionVersion: before.decisionVersion,
    ownerId: before.ownerId,
    choice: { target: "blue" },
  }).code, "EFFECT_DECISION_STALE");
  assert.deepEqual(dispatched.session, stableCheckpoint, "stale choice 拒绝必须无副作用");
  assert.equal(runtime.resolveDecision(dispatched.session, {
    decisionId: after.decisionId,
    decisionVersion: after.decisionVersion,
    ownerId: after.ownerId,
    choice: { target: "blue" },
  }).code, "EFFECT_DECISION_NOT_LEGAL");
  assert.deepEqual(dispatched.session, stableCheckpoint, "过期合法项拒绝必须无副作用");
  assert.equal(runtime.resolveDecision(dispatched.session, {
    decisionId: after.decisionId,
    decisionVersion: after.decisionVersion,
    ownerId: after.ownerId,
    choice: { target: "orange" },
  }).ok, true);
  assert.equal(dispatched.session.committedState.chosenTarget, "orange");
})();

(function testNestedAndNonQuickInterruptsFailClosed() {
  const { runtime, registry, coordinator } = createHarness();
  const dispatched = runtime.dispatchAction(createState(), { family: "test", actorId: "p1" }, actionGroup([{
    type: "choose-target",
    kind: "decision",
    ownerId: "p1",
    allowQuickActions: true,
  }]));
  runtime.drain(dispatched.session);
  const quick = getAction(registry, dispatched.session.workingState, "quick_trade", "choose-boost");
  assert.equal(coordinator.interrupt(dispatched.session, quick).ok, true);
  assert.equal(runtime.advance(dispatched.session).ok, true);
  assert.equal(dispatched.session.phase, "awaiting_input");
  const checkpoint = clone(dispatched.session);
  const nested = getAction(registry, dispatched.session.workingState, "quick_trade", "add-two");
  assert.equal(coordinator.interrupt(dispatched.session, nested).code, "EFFECT_INTERRUPT_NESTED_UNSUPPORTED");
  assert.deepEqual(dispatched.session, checkpoint);

  const mainAction = getAction(registry, dispatched.session.workingState, "launch", "main");
  assert.equal(coordinator.createEffectGroup(dispatched.session.workingState, mainAction).code, "EFFECT_QUICK_ACTION_FAMILY_INVALID");
  assert.deepEqual(dispatched.session, checkpoint);

  const quickDecision = runtime.inspect(dispatched.session).decision;
  assert.equal(runtime.resolveDecision(dispatched.session, {
    decisionId: quickDecision.decisionId,
    decisionVersion: quickDecision.decisionVersion,
    ownerId: quickDecision.ownerId,
    choice: { amount: 2 },
  }).ok, true);
  assert.equal(runtime.drain(dispatched.session).ok, true);
  assert.equal(dispatched.session.phase, "awaiting_input", "quick group 完成后必须恢复原 DecisionEffect");
})();

(function testMalformedQuickGroupAndRunningEffectHaveNoInterruptSideEffects() {
  const malformed = createHarness({
    buildEffectGroup: () => ({ effects: [{ type: "add" }, { payload: { amount: 9 } }] }),
  });
  const dispatched = malformed.runtime.dispatchAction(
    createState(),
    { family: "test", actorId: "p1" },
    actionGroup([{ type: "add", payload: { amount: 1, label: "main" } }]),
  );
  const quick = getAction(malformed.registry, dispatched.session.workingState, "quick_trade", "add-two");
  const checkpoint = clone(dispatched.session);
  assert.equal(
    malformed.coordinator.interrupt(dispatched.session, quick, { allowAtBoundary: true }).code,
    "EFFECT_QUICK_GROUP_INVALID",
  );
  assert.deepEqual(dispatched.session, checkpoint, "非法 quick group 不得消耗 id、写 journal 或改 queue");

  const running = createHarness();
  let runningSession;
  let reentryResult;
  const runningQuick = getAction(running.registry, createState(), "quick_trade", "add-two");
  running.runtime.registerExecutor("try-reentry", (state) => {
    reentryResult = running.coordinator.interrupt(runningSession, runningQuick, { allowAtBoundary: true });
    return { ok: true, nextState: { ...state, value: state.value + 1 } };
  });
  const runningDispatch = running.runtime.dispatchAction(
    createState(),
    { family: "test", actorId: "p1" },
    actionGroup([{ type: "try-reentry" }]),
  );
  runningSession = runningDispatch.session;
  assert.equal(running.runtime.advance(runningSession).ok, true);
  assert.equal(reentryResult.code, "EFFECT_INTERRUPT_NOT_ALLOWED", "同步 Effect 内重入必须 fail-closed");
  assert.equal(runningSession.committedState.value, 1);
  assert.deepEqual(runningSession.journal.actions.map((entry) => entry.groupKind), ["action"]);
})();

(function testBrowserPolicyFixedTraceParity() {
  function run(viewer) {
    const { runtime, registry, coordinator } = createHarness();
    const dispatched = runtime.dispatchAction(createState(), { family: "test", actorId: "p1" }, actionGroup([{
      type: "choose-target",
      kind: "decision",
      ownerId: "p1",
      allowQuickActions: true,
    }]));
    runtime.drain(dispatched.session);
    const quick = getAction(registry, dispatched.session.workingState, "quick_trade", "remove-blue");
    coordinator.interrupt(dispatched.session, quick);
    runtime.drain(dispatched.session);
    const observation = runtime.observe(dispatched.session, viewer);
    const decision = observation.decision;
    runtime.resolveDecision(dispatched.session, {
      decisionId: decision.decisionId,
      decisionVersion: decision.decisionVersion,
      ownerId: decision.ownerId,
      choice: clone(decision.choices[0]),
    });
    return {
      observation,
      committedState: clone(dispatched.session.committedState),
      journal: clone(dispatched.session.journal),
    };
  }
  const browser = run("browser");
  const policy = run("policy");
  assert.deepEqual(policy, browser);
})();

console.log("quick action effect session tests passed");
