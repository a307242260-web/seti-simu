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
    const createActionRegistry = options.createActionRegistry;
    const createInitialState = options.createInitialState;
    const fallbackEffectGroup = options.createEffectGroup;
    if (typeof stateStoreApi?.createStateStore !== "function") {
      throw new TypeError("Rule Composition 缺少 StateStore factory");
    }
    if (typeof effectRuntimeApi?.createRuntime !== "function") {
      throw new TypeError("Rule Composition 缺少 Effect runtime factory");
    }
    if (typeof createActionRegistry !== "function") {
      throw new TypeError("Rule Composition 缺少 createActionRegistry()，registry 必须由 composition 内部创建");
    }
    if (typeof createInitialState !== "function") {
      throw new TypeError("Rule Composition 缺少 createInitialState()");
    }
    if (typeof fallbackEffectGroup !== "function" && !(options.effectDomains || []).length) {
      throw new TypeError("Rule Composition 缺少 production Effect domain 或 createEffectGroup()");
    }

    if (typeof options.projectState !== "function") {
      throw new TypeError("Rule Composition 缺少只读 projectState()，禁止向 Browser 暴露 canonical root");
    }

    const actionRegistry = createActionRegistry();
    if (!actionRegistry?.enumerate || !actionRegistry?.validate) {
      throw new TypeError("createActionRegistry() 未返回 Standard Action registry");
    }
    const storeOptions = Object.freeze({ invariantValidators: [...(options.invariantValidators || [])] });
    let store = stateStoreApi.createStateStore(
      clone(createInitialState(clone(options.initialOptions || {}))),
      storeOptions,
    );
    let runtime = null;
    let activeSession = null;
    let activeFamily = null;
    const listeners = new Set();
    let unsubscribeStore = null;
    let effectDomainByFamily = new Map();

    function actionContext(state) {
      return typeof options.createActionContext === "function"
        ? options.createActionContext(state)
        : state;
    }

    function executeRegisteredAction(state, action) {
      if (typeof actionRegistry.execute !== "function") {
        return fail("RULE_COMPOSITION_ACTION_EXECUTOR_MISSING", "Standard Action registry 缺少 execute()");
      }
      const nextState = clone(state);
      const result = actionRegistry.execute(actionContext(nextState), clone(action));
      if (!result || result.ok !== true) {
        return result?.ok === false
          ? result
          : fail("RULE_COMPOSITION_ACTION_EXECUTION_FAILED", "Standard Action execute() 未返回成功结果");
      }
      const { commands: _hostUndoCommands, ...serializableResult } = result;
      return { ...clone(serializableResult), nextState };
    }

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
          options.projectState(clone(state), clone(viewer), clone(inspection))
        ),
      });
      if (typeof options.installEffectExecutors === "function") {
        options.installEffectExecutors(Object.freeze({
          register: next.registerExecutor,
          executeRegisteredAction,
        }));
      } else {
        for (const [type, executor] of Object.entries(options.effectExecutors || {})) {
          next.registerExecutor(type, executor);
        }
      }
      const nextDomains = new Map();
      for (const descriptor of options.effectDomains || []) {
        if (typeof descriptor?.create !== "function") {
          throw new TypeError("Effect domain 缺少 create() factory");
        }
        const domain = descriptor.create({
          ...(descriptor.options || {}),
          runtime: next,
          executeRegisteredAction,
        });
        if (typeof domain?.createEffectGroup !== "function") {
          throw new TypeError("Effect domain 缺少 createEffectGroup()");
        }
        const families = descriptor.families || domain.actionFamilies || [];
        for (const family of families) {
          if (nextDomains.has(family)) throw new Error(`重复 Effect domain family: ${family}`);
          nextDomains.set(family, domain);
        }
      }
      effectDomainByFamily = nextDomains;
      return next;
    }

    function createProductionEffectGroup(workingState, action) {
      const domain = effectDomainByFamily.get(action?.family);
      if (domain) return domain.createEffectGroup(clone(workingState), clone(action));
      return typeof fallbackEffectGroup === "function"
        ? fallbackEffectGroup(clone(workingState), clone(action))
        : fail("RULE_COMPOSITION_EFFECT_DOMAIN_MISSING", `没有 production Effect domain: ${action?.family || "<missing>"}`);
    }

    function installStore(initialState) {
      unsubscribeStore?.();
      store = stateStoreApi.createStateStore(clone(initialState), storeOptions);
      runtime = createRuntime();
      activeSession = null;
      activeFamily = null;
      bindStoreEvents();
    }

    runtime = createRuntime();
    bindStoreEvents();

    function committedProjection(viewer = null) {
      const state = store.getSnapshot();
      const projected = options.projectState(clone(state), clone(viewer), null);
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
        {
          enumerate: (state, request) => actionRegistry.enumerate(actionContext(clone(state)), request),
          validate: (state, candidate) => actionRegistry.validate(actionContext(clone(state)), candidate),
        },
        createProductionEffectGroup,
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
      const action = (actionRegistry.enumerate(actionContext(clone(committed)), clone(submitOptions.request || {})) || [])
        .find((candidate) => candidate.actionId === actionId);
      return action
        ? submitAction(action, submitOptions)
        : fail("RULE_COMPOSITION_ACTION_NOT_LEGAL", "actionId 不在当前 committed projection 的合法 Action 中", { actionId });
    }

    function submitQuickAction(action, submitOptions = {}) {
      if (!activeSession) return submitAction(action, submitOptions);
      const validation = actionRegistry.validate(actionContext(clone(activeSession.workingState)), clone(action));
      if (!validation?.ok) return deepFreeze(clone(validation));
      const result = runtime.dispatchQuickAction(
        activeSession,
        clone(action),
        createProductionEffectGroup,
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
      return deepFreeze(clone(actionRegistry.enumerate(actionContext(clone(state)), clone(request)) || []));
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

    function validateRestore(envelope) {
      if (envelope?.schemaVersion !== SAVE_SCHEMA_VERSION) {
        return fail("RULE_COMPOSITION_SAVE_SCHEMA_UNSUPPORTED", "旧版或未知 Browser 存档 schema 被拒绝");
      }
      const loaded = store.deserialize(envelope.committedState);
      if (!loaded?.ok) return deepFreeze(clone(loaded));
      let restoredSession = null;
      if (envelope.session != null) {
        restoredSession = runtime.restoreCheckpoint(clone(envelope.session));
        if (!restoredSession?.ok) return deepFreeze(clone(restoredSession));
        if (restoredSession.session.baseVersion !== loaded.state.meta.stateVersion) {
          return fail("RULE_COMPOSITION_SESSION_STALE", "Effect Session checkpoint 与 committed state 版本不一致", {
            baseVersion: restoredSession.session.baseVersion,
            stateVersion: loaded.state.meta.stateVersion,
          });
        }
      }
      return { ok: true, state: loaded.state, session: restoredSession?.session || null };
    }

    function restore(envelope) {
      const validated = validateRestore(envelope);
      if (!validated.ok) return validated;
      installStore(validated.state);
      if (validated.session) {
        const restored = runtime.restoreCheckpoint(clone(envelope.session));
        if (!restored?.ok) throw new Error("已预验证的 Effect Session 恢复失败");
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
    const lifecycle = Object.freeze({ newGame, save, validateRestore, restore });

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
