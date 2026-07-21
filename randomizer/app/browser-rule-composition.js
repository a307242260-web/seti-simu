(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserRuleComposition = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SAVE_SCHEMA_VERSION = "seti-browser-rule-composition-save-v1";
  const TERMINAL_PHASES = new Set(["completed", "aborted", "irreversible_locked"]);

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function deepFreeze(value) {
    if (value == null || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
  }

  function fail(code, message, details = {}) {
    return deepFreeze({ ok: false, code, message, ...clone(details) });
  }

  function requireFunction(owner, key, label) {
    if (typeof owner?.[key] !== "function") throw new TypeError(`${label} 缺少 ${key}()`);
    return owner[key].bind(owner);
  }

  function createBrowserRuleComposition(options = {}) {
    const stateStoreApi = options.stateStoreApi;
    const effectRuntimeApi = options.effectRuntimeApi;
    const actionRegistry = options.actionRegistry;
    const createInitialState = options.createInitialState;
    const createEffectGroup = options.createEffectGroup;
    if (typeof stateStoreApi?.createStateStore !== "function") {
      throw new TypeError("Rule Composition 缺少 StateStore factory");
    }
    if (typeof effectRuntimeApi?.createRuntime !== "function") {
      throw new TypeError("Rule Composition 缺少 Effect runtime factory");
    }
    if (!actionRegistry?.enumerate || !actionRegistry?.validate) {
      throw new TypeError("Rule Composition 缺少唯一 Standard Action registry");
    }
    if (typeof createInitialState !== "function") {
      throw new TypeError("Rule Composition 缺少 createInitialState()");
    }
    if (typeof createEffectGroup !== "function") {
      throw new TypeError("Rule Composition 缺少 createEffectGroup()");
    }

    let store = stateStoreApi.createStateStore(clone(createInitialState(clone(options.initialOptions || {}))));
    let runtime = null;
    let activeSession = null;
    let activeFamily = null;
    const listeners = new Set();
    let unsubscribeStore = null;

    function publish(event) {
      const frozen = deepFreeze(clone(event));
      for (const listener of [...listeners]) {
        try { listener(frozen); } catch (_error) { /* 已成立的规则状态不受宿主监听器影响。 */ }
      }
    }

    function bindStoreEvents() {
      unsubscribeStore?.();
      unsubscribeStore = store.subscribe((event) => publish({ source: "committed", event }));
    }

    function createRuntime() {
      const next = effectRuntimeApi.createRuntime({
        stateStore: store,
        validateState: (state) => store.validate(state),
        projectState: (state, viewer, inspection) => (
          typeof options.projectState === "function"
            ? options.projectState(clone(state), clone(viewer), clone(inspection))
            : clone(state)
        ),
      });
      for (const [type, executor] of Object.entries(options.effectExecutors || {})) {
        next.registerExecutor(type, executor);
      }
      return next;
    }

    function installStore(initialState) {
      unsubscribeStore?.();
      store = stateStoreApi.createStateStore(clone(initialState));
      runtime = createRuntime();
      activeSession = null;
      activeFamily = null;
      bindStoreEvents();
    }

    runtime = createRuntime();
    bindStoreEvents();

    function committedProjection(viewer = null) {
      const state = store.getSnapshot();
      const projected = typeof options.projectState === "function"
        ? options.projectState(clone(state), clone(viewer), null)
        : clone(state);
      return deepFreeze({ phase: "idle", stateVersion: state.meta.stateVersion, state: projected });
    }

    function projection(viewer = null) {
      if (!activeSession) return committedProjection(viewer);
      return deepFreeze(runtime.observe(activeSession, clone(viewer)));
    }

    function inspect() {
      return deepFreeze({
        phase: activeSession?.phase || "idle",
        family: activeFamily,
        session: activeSession ? runtime.inspect(activeSession) : null,
      });
    }

    function finishIfTerminal() {
      if (!activeSession || !TERMINAL_PHASES.has(activeSession.phase)) return null;
      const terminal = deepFreeze({
        ok: activeSession.phase === "completed",
        phase: activeSession.phase,
        family: activeFamily,
        stateVersion: store.getSnapshot().meta.stateVersion,
        failure: clone(activeSession.failure),
        journal: clone(activeSession.journal),
      });
      activeSession = null;
      activeFamily = null;
      publish({ source: "session", event: terminal });
      return terminal;
    }

    function advanceSession(result, autoDrain = true) {
      if (!result?.ok) return finishIfTerminal() || deepFreeze(clone(result));
      if (activeSession && autoDrain && !TERMINAL_PHASES.has(activeSession.phase)) {
        const drained = runtime.drain(activeSession);
        if (!drained?.ok) return finishIfTerminal() || deepFreeze(clone(drained));
      }
      return finishIfTerminal() || deepFreeze({ ok: true, projection: projection() });
    }

    function submitAction(action, submitOptions = {}) {
      if (activeSession) return fail("RULE_COMPOSITION_SESSION_ACTIVE", "已有规则 Session 正在执行");
      const dispatched = runtime.dispatchStandardAction(
        clone(action),
        actionRegistry,
        (workingState, acceptedAction) => createEffectGroup(clone(workingState), clone(acceptedAction)),
        { source: "browser-input", ...clone(submitOptions.metadata || {}) },
      );
      if (!dispatched?.ok) return deepFreeze(clone(dispatched));
      activeSession = dispatched.session;
      activeFamily = action.family;
      publish({ source: "session", event: { type: "opened", family: activeFamily } });
      return advanceSession(dispatched, submitOptions.autoDrain !== false);
    }

    function submitActionById(actionId, submitOptions = {}) {
      if (activeSession) return fail("RULE_COMPOSITION_SESSION_ACTIVE", "已有规则 Session 正在执行");
      const committed = store.getSnapshot();
      const action = (actionRegistry.enumerate(committed, clone(submitOptions.request || {})) || [])
        .find((candidate) => candidate.actionId === actionId);
      return action
        ? submitAction(action, submitOptions)
        : fail("RULE_COMPOSITION_ACTION_NOT_LEGAL", "actionId 不在当前 committed projection 的合法 Action 中", { actionId });
    }

    function submitQuickAction(action, submitOptions = {}) {
      if (!activeSession) return submitAction(action, submitOptions);
      const validation = actionRegistry.validate(clone(activeSession.workingState), clone(action));
      if (!validation?.ok) return deepFreeze(clone(validation));
      const result = runtime.dispatchQuickAction(
        activeSession,
        clone(action),
        (workingState, acceptedAction) => createEffectGroup(clone(workingState), clone(acceptedAction)),
        { source: "browser-quick-input", ...clone(submitOptions.metadata || {}) },
      );
      return advanceSession(result, submitOptions.autoDrain !== false);
    }

    function submitDecision(submission, submitOptions = {}) {
      if (!activeSession) return fail("RULE_COMPOSITION_SESSION_REQUIRED", "当前没有等待输入的规则 Session");
      return advanceSession(
        runtime.resolveDecision(activeSession, clone(submission)),
        submitOptions.autoDrain !== false,
      );
    }

    function enumerateActions(request = {}) {
      const state = activeSession ? activeSession.workingState : store.getSnapshot();
      return deepFreeze(clone(actionRegistry.enumerate(clone(state), clone(request)) || []));
    }

    function advance() {
      if (!activeSession) return fail("RULE_COMPOSITION_SESSION_REQUIRED", "当前没有可推进的规则 Session");
      return advanceSession(runtime.advance(activeSession), false);
    }

    function abort(reason = {}) {
      if (!activeSession) return fail("RULE_COMPOSITION_SESSION_REQUIRED", "当前没有可中止的规则 Session");
      return advanceSession(runtime.abort(activeSession, clone(reason)), false);
    }

    function save() {
      const serialized = store.serialize();
      if (!serialized.ok) return deepFreeze(clone(serialized));
      const session = activeSession ? runtime.createCheckpoint(activeSession) : null;
      if (session?.ok === false) return deepFreeze(clone(session));
      return deepFreeze({
        ok: true,
        envelope: {
          schemaVersion: SAVE_SCHEMA_VERSION,
          committedState: serialized.serialized,
          session: clone(session?.checkpoint || null),
        },
      });
    }

    function restore(envelope) {
      if (envelope?.schemaVersion !== SAVE_SCHEMA_VERSION) {
        return fail("RULE_COMPOSITION_SAVE_SCHEMA_UNSUPPORTED", "旧版或未知 Browser 存档 schema 被拒绝");
      }
      const loaded = store.deserialize(envelope.committedState);
      if (!loaded?.ok) return deepFreeze(clone(loaded));
      let restoredSession = null;
      if (envelope.session != null) {
        const temporaryStore = stateStoreApi.createStateStore(clone(loaded.state));
        const temporaryRuntime = effectRuntimeApi.createRuntime({ stateStore: temporaryStore });
        for (const [type, executor] of Object.entries(options.effectExecutors || {})) {
          temporaryRuntime.registerExecutor(type, executor);
        }
        restoredSession = temporaryRuntime.restoreCheckpoint(clone(envelope.session));
        if (!restoredSession?.ok) return deepFreeze(clone(restoredSession));
      }
      installStore(loaded.state);
      if (restoredSession) {
        const restored = runtime.restoreCheckpoint(clone(envelope.session));
        if (!restored?.ok) return deepFreeze(clone(restored));
        activeSession = restored.session;
        activeFamily = activeSession.journal?.actions?.[0]?.action?.family || null;
      }
      publish({ source: "lifecycle", event: { type: "restored" } });
      return deepFreeze({ ok: true, projection: projection() });
    }

    function newGame(initialOptions = {}) {
      let initialState;
      try { initialState = createInitialState(clone(initialOptions)); }
      catch (error) { return fail("RULE_COMPOSITION_NEW_GAME_FAILED", error?.message || "新局状态创建失败"); }
      const previousVersion = store.getSnapshot().meta.stateVersion;
      if (initialState?.meta) initialState.meta.stateVersion = previousVersion + 1;
      try { installStore(initialState); }
      catch (error) { return fail("RULE_COMPOSITION_NEW_GAME_INVALID", error?.message || "新局状态无效"); }
      publish({ source: "lifecycle", event: { type: "new_game" } });
      return deepFreeze({ ok: true, projection: committedProjection() });
    }

    const inputPort = Object.freeze({
      enumerateActions,
      submitAction,
      submitActionById,
      submitQuickAction,
      submitDecision,
      advance,
      abort,
    });
    const lifecycle = Object.freeze({ newGame, save, restore });

    return Object.freeze({
      SAVE_SCHEMA_VERSION,
      inputPort,
      lifecycle,
      projection,
      inspect,
      subscribe(listener) {
        if (typeof listener !== "function") throw new TypeError("Rule Composition subscriber 必须是函数");
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      dispose() {
        unsubscribeStore?.();
        unsubscribeStore = null;
        listeners.clear();
      },
    });
  }

  return Object.freeze({ SAVE_SCHEMA_VERSION, createBrowserRuleComposition });
});
