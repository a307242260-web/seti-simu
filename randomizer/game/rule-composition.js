(function (root, factory) {
  "use strict";

  let stateStore = root.SetiStateStore;
  let standardAction = root.SetiStandardAction;
  let effectSession = root.SetiEffectSession;
  if ((!stateStore || !standardAction || !effectSession) && typeof require === "function") {
    stateStore = stateStore || require("./state/state-store");
    standardAction = standardAction || require("./actions/standard-action");
    effectSession = effectSession || require("./effects/session-runtime");
  }

  const api = factory(stateStore, standardAction, effectSession);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiRuleComposition = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (
  stateStore,
  standardAction,
  effectSession,
) {
  "use strict";

  if (!stateStore) throw new Error("SetiStateStore is required before SetiRuleComposition");
  if (!standardAction) throw new Error("SetiStandardAction is required before SetiRuleComposition");
  if (!effectSession) throw new Error("SetiEffectSession is required before SetiRuleComposition");

  const SCHEMA_VERSION = "seti-rule-composition-v1";
  const TERMINAL_PHASES = new Set(["completed", "aborted", "irreversible_locked"]);

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function fail(code, message, details = {}) {
    return { ok: false, code, message, ...clone(details) };
  }

  function requireFunction(value, label) {
    if (typeof value !== "function") throw new TypeError(`RuleComposition 缺少 ${label}`);
    return value;
  }

  function createCanonicalRoot(options = {}) {
    return stateStore.createCommittedGameState(clone(options));
  }

  function defaultAuthority(committedRoot) {
    return {
      actorId: committedRoot?.turn?.currentPlayerId || null,
      stateVersion: committedRoot?.meta?.stateVersion ?? null,
      decisionVersion: committedRoot?.turn?.decisionVersion ?? 0,
    };
  }

  function createRuleComposition(options = {}) {
    const initialRoot = options.initialRoot
      ? clone(options.initialRoot)
      : createCanonicalRoot(options.initialState || {});
    const store = stateStore.createStateStore(initialRoot, {
      invariantValidators: options.invariantValidators || [],
    });
    const getAuthority = options.getAuthority || defaultAuthority;
    const buildEffectGroup = requireFunction(options.buildEffectGroup, "buildEffectGroup(root, action)");
    const registry = standardAction.createRegistry({ getAuthority });
    const runtime = effectSession.createRuntime({
      stateStore: store,
      validateState: options.validateState,
      projectState: options.projectState,
      maxDrainSteps: options.maxDrainSteps,
    });
    let activeSession = null;
    let lastResult = null;

    for (const definition of options.actionDefinitions || []) registry.register(definition);
    for (const [type, executor] of Object.entries(options.effectExecutors || {})) {
      runtime.registerExecutor(type, executor);
    }

    function committedSnapshot() {
      return store.getSnapshot();
    }

    function ruleRoot() {
      return activeSession ? clone(activeSession.workingState) : committedSnapshot();
    }

    function inspect() {
      if (!activeSession) {
        return Object.freeze({
          ok: true,
          schemaVersion: SCHEMA_VERSION,
          phase: "idle",
          stateVersion: committedSnapshot().meta.stateVersion,
        });
      }
      return clone(runtime.inspect(activeSession));
    }

    function publishTerminal(result) {
      if (!activeSession || !TERMINAL_PHASES.has(activeSession.phase)) return result;
      const session = activeSession;
      lastResult = session.phase === "completed"
        ? {
          ok: true,
          phase: session.phase,
          committedState: clone(session.committedState),
          journal: clone(session.journal),
          commitResult: clone(session.commitResult),
        }
        : fail(
          session.failure?.code || "RULE_SESSION_TERMINATED",
          session.failure?.message || "Rule Session 未完成",
          {
            phase: session.phase,
            failure: clone(session.failure),
            journal: clone(session.journal),
            irreversibleBarrier: clone(session.irreversibleBarrier),
          },
        );
      activeSession = null;
      return clone(lastResult);
    }

    function finishRuntimeCall(result, autoDrain) {
      if (!result?.ok) return publishTerminal(result);
      if (autoDrain && activeSession && !TERMINAL_PHASES.has(activeSession.phase)) {
        const drained = runtime.drain(activeSession);
        if (!drained?.ok) return publishTerminal(drained);
      }
      return publishTerminal({ ok: true, phase: inspect().phase, inspection: inspect() });
    }

    function enumerateActions(request = {}) {
      return clone(registry.enumerate(ruleRoot(), clone(request)) || []);
    }

    function submitAction(action, dispatchOptions = {}) {
      if (activeSession) return fail("RULE_SESSION_ACTIVE", "已有 Rule Session 等待完成");
      const dispatched = runtime.dispatchStandardAction(
        clone(action),
        registry,
        (workingRoot, acceptedAction) => buildEffectGroup(workingRoot, acceptedAction),
        clone(dispatchOptions.meta || {}),
      );
      if (!dispatched?.ok) return clone(dispatched);
      activeSession = dispatched.session;
      lastResult = null;
      return finishRuntimeCall(dispatched, dispatchOptions.autoDrain !== false);
    }

    function submitQuickAction(action, dispatchOptions = {}) {
      if (!activeSession) return fail("RULE_SESSION_REQUIRED", "Quick Action 需要活跃 Rule Session");
      const validation = registry.validate(clone(activeSession.workingState), clone(action));
      if (!validation?.ok) return clone(validation);
      const dispatched = runtime.dispatchQuickAction(
        activeSession,
        clone(action),
        (workingRoot, acceptedAction) => buildEffectGroup(workingRoot, acceptedAction),
        clone(dispatchOptions.runtime || {}),
      );
      return finishRuntimeCall(dispatched, dispatchOptions.autoDrain !== false);
    }

    function resolveDecision(submission, resolveOptions = {}) {
      if (!activeSession) return fail("RULE_SESSION_REQUIRED", "当前没有等待输入的 Rule Session");
      return finishRuntimeCall(
        runtime.resolveDecision(activeSession, clone(submission)),
        resolveOptions.autoDrain !== false,
      );
    }

    function advance() {
      if (!activeSession) return fail("RULE_SESSION_REQUIRED", "当前没有可推进的 Rule Session");
      return finishRuntimeCall(runtime.advance(activeSession), false);
    }

    function drain() {
      if (!activeSession) return fail("RULE_SESSION_REQUIRED", "当前没有可推进的 Rule Session");
      return finishRuntimeCall(runtime.drain(activeSession), false);
    }

    function abort(reason = {}) {
      if (!activeSession) return fail("RULE_SESSION_REQUIRED", "当前没有可中止的 Rule Session");
      return finishRuntimeCall(runtime.abort(activeSession, clone(reason)), false);
    }

    function undoLastEffect() {
      if (!activeSession) return fail("RULE_SESSION_REQUIRED", "当前没有可撤销的 Rule Session");
      return finishRuntimeCall(runtime.undoLastEffect(activeSession), false);
    }

    function observe(viewer = null) {
      if (!activeSession) {
        const state = committedSnapshot();
        return clone({
          schemaVersion: SCHEMA_VERSION,
          phase: "idle",
          state: options.projectState ? options.projectState(clone(state), viewer, inspect()) : state,
          decision: null,
        });
      }
      return clone(runtime.observe(activeSession, viewer));
    }

    function createCheckpoint() {
      if (!activeSession) return { ok: true, checkpoint: null };
      return clone(runtime.createCheckpoint(activeSession));
    }

    function restoreCheckpoint(checkpoint) {
      if (!checkpoint) {
        activeSession = null;
        return { ok: true, phase: "idle" };
      }
      const currentVersion = committedSnapshot().meta.stateVersion;
      if (checkpoint?.session?.baseVersion !== currentVersion) {
        return fail("RULE_CHECKPOINT_STALE", "Rule Session checkpoint 的 baseVersion 已过期", {
          baseVersion: checkpoint?.session?.baseVersion ?? null,
          currentVersion,
        });
      }
      const restored = runtime.restoreCheckpoint(clone(checkpoint));
      if (!restored?.ok) return clone(restored);
      activeSession = restored.session;
      lastResult = null;
      return { ok: true, phase: activeSession.phase, inspection: inspect() };
    }

    function serializeCommittedState() {
      return clone(store.serialize());
    }

    function restoreCommittedState(serialized, metadata = null) {
      if (activeSession) return fail("RULE_SESSION_ACTIVE", "活跃 Rule Session 期间不得替换 committed root");
      const loaded = store.deserialize(serialized);
      if (!loaded?.ok) return clone(loaded);
      lastResult = null;
      return clone(store.restore(loaded.state, metadata));
    }

    return Object.freeze({
      schemaVersion: SCHEMA_VERSION,
      enumerateActions,
      submitAction,
      submitQuickAction,
      resolveDecision,
      advance,
      drain,
      abort,
      undoLastEffect,
      inspect,
      observe,
      getCommittedSnapshot: committedSnapshot,
      getLastResult: () => clone(lastResult),
      createCheckpoint,
      restoreCheckpoint,
      serializeCommittedState,
      restoreCommittedState,
      subscribeCommits: (listener) => store.subscribe(listener),
    });
  }

  return Object.freeze({ SCHEMA_VERSION, createCanonicalRoot, createRuleComposition });
});
