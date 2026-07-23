(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiRuleComposition = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SAVE_SCHEMA_VERSION = "seti-rule-composition-save-v1";
  const TERMINAL_PHASES = new Set(["completed", "aborted", "irreversible_locked"]);

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function deepFreeze(value) {
    if (value == null || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
  }

  function stableSerialize(value) {
    if (value == null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }

  function stableHash(value) {
    const input = stableSerialize(value);
    let hash = 0x811c9dc5;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function fail(code, message, details = {}) {
    return deepFreeze({ ok: false, code, message, ...clone(details) });
  }

  function requireFunction(owner, key, label) {
    if (typeof owner?.[key] !== "function") throw new TypeError(`${label} 缺少 ${key}()`);
    return owner[key].bind(owner);
  }

  function createRuleComposition(options = {}) {
    const stateStoreApi = options.stateStoreApi;
    const effectRuntimeApi = options.effectRuntimeApi;
    const createActionRegistry = options.createActionRegistry;
    const createInitialState = options.createInitialState;
    const executeOwnerInput = options.executeOwnerInput;
    const stateAdapter = options.stateAdapter || null;
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
    if (!(options.effectDomains || []).length) {
      throw new TypeError("Rule Composition 缺少 production Effect domain");
    }

    if (typeof options.projectState !== "function") {
      throw new TypeError("Rule Composition 缺少只读 projectState()，禁止向 Browser 暴露 canonical root");
    }

    const actionRegistry = createActionRegistry();
    if (!actionRegistry?.enumerate || !actionRegistry?.validate) {
      throw new TypeError("createActionRegistry() 未返回 Standard Action registry");
    }
    if (stateAdapter && (typeof stateAdapter.createWorkingState !== "function"
      || typeof stateAdapter.createCommittedState !== "function"
      || typeof stateAdapter.restoreWorkingState !== "function")) {
      throw new TypeError("Rule Composition stateAdapter 缺少 working/committed/restore 原子协议");
    }
    const storeOptions = Object.freeze({ invariantValidators: [...(options.invariantValidators || [])] });
    let workingState = stateAdapter
      ? stateAdapter.createWorkingState(clone(options.initialOptions || {}))
      : null;
    let store = stateStoreApi.createStateStore(
      clone(createInitialState(clone(options.initialOptions || {}), workingState)),
      storeOptions,
    );
    if (stateAdapter) stateAdapter.restoreWorkingState(workingState, store.getSnapshot(), { reason: "initial" });
    let runtime = null;
    let activeSession = null;
    let activeFamily = null;
    let lastActionResult = null;
    let activeOwnerInputWorkingState = null;
    let transactionWorkingState = null;
    const listeners = new Set();
    let unsubscribeStore = null;
    let effectDomainByFamily = new Map();
    let drainEffectGroupFactory = null;
    let lastCounterfactualDiagnostics = null;

    function actionContext(state) {
      if (stateAdapter) {
        return typeof options.createActionContext === "function"
          ? options.createActionContext(workingState)
          : workingState;
      }
      return typeof options.createActionContext === "function"
        ? options.createActionContext(state)
        : state;
    }

    function runWithWorkingStateContext(state, operation) {
      const previousWorkingState = transactionWorkingState;
      transactionWorkingState = state;
      try {
        return typeof options.runWithWorkingState === "function"
          ? options.runWithWorkingState(state, operation)
          : operation();
      } finally {
        transactionWorkingState = previousWorkingState;
      }
    }

    function executeRegisteredAction(state, action) {
      if (typeof actionRegistry.execute !== "function") {
        return fail("RULE_COMPOSITION_ACTION_EXECUTOR_MISSING", "Standard Action registry 缺少 execute()");
      }
      const nextState = clone(state);
      const beforeWorkingState = stateAdapter ? clone(workingState) : null;
      const workingContext = actionContext(nextState);
      const result = runWithWorkingStateContext(
        workingContext,
        () => actionRegistry.execute(workingContext, clone(action)),
      );
      if (!result || result.ok !== true) {
        if (stateAdapter) stateAdapter.restoreWorkingState(workingState, beforeWorkingState, { reason: "action_rejected" });
        return result?.ok === false
          ? result
          : fail("RULE_COMPOSITION_ACTION_EXECUTION_FAILED", "Standard Action execute() 未返回成功结果");
      }
      const committedState = stateAdapter
        ? stateAdapter.createCommittedState(workingState, nextState)
        : nextState;
      const validation = store.validate(committedState);
      if (!validation.ok) {
        if (stateAdapter) stateAdapter.restoreWorkingState(workingState, beforeWorkingState, { reason: "state_invalid" });
        return deepFreeze(clone(validation));
      }
      const {
        commands: _undoCommands,
        history: _legacyUndoHistory,
        ...serializableResult
      } = result;
      lastActionResult = clone(serializableResult);
      return { ...clone(serializableResult), nextState: committedState };
    }

    function publish(event) {
      const frozen = deepFreeze(clone(event));
      for (const listener of [...listeners]) {
        try { listener(frozen); } catch (_error) { /* 已成立的规则状态不受宿主监听器影响。 */ }
      }
    }

    function bindStoreEvents() {
      unsubscribeStore?.();
      unsubscribeStore = store.subscribe((event) => {
        stateAdapter?.onCommitted?.(workingState, clone(event.snapshot), clone(event));
        publish({ source: "committed", event });
      });
    }

    function createRuntime() {
      const next = effectRuntimeApi.createRuntime({
        stateStore: store,
        validateState: (state) => store.validate(state),
        projectState: (state, viewer, inspection) => (
          options.projectState(
            clone(stateAdapter && options.projectWorkingState ? workingState : state),
            clone(viewer),
            clone(inspection),
            { stateVersion: state?.meta?.stateVersion ?? store.getSnapshot().meta.stateVersion },
          )
        ),
      });
      const contextualizeExecutor = (executor) => {
        const wrap = (operation) => (state, ...args) => {
          const workingContext = actionContext(state);
          return runWithWorkingStateContext(
            workingContext,
            () => operation(state, ...args, workingContext),
          );
        };
        if (typeof executor === "function") return wrap(executor);
        if (!executor || typeof executor !== "object") return executor;
        return Object.fromEntries(Object.entries(executor).map(([key, value]) => [
          key,
          typeof value === "function" ? wrap(value) : value,
        ]));
      };
      const registerContextualExecutor = (type, executor) => (
        next.registerExecutor(type, contextualizeExecutor(executor))
      );
      const nextDomains = new Map();
      let nextDrainEffectGroupFactory = null;
      for (const descriptor of options.effectDomains || []) {
        if (typeof descriptor?.create !== "function") {
          throw new TypeError("Effect domain 缺少 create() factory");
        }
        const domain = descriptor.create({
          ...(descriptor.options || {}),
          runtime: Object.freeze({ ...next, registerExecutor: registerContextualExecutor }),
          executeRegisteredAction,
          commitWorkingState(state, context = {}) {
            return stateAdapter
              ? stateAdapter.createCommittedState(workingState, state, clone(context))
              : clone(state);
          },
        });
        if (typeof domain?.createEffectGroup !== "function") {
          throw new TypeError("Effect domain 缺少 createEffectGroup()");
        }
        if (typeof domain.createDrainEffectGroup === "function") {
          if (nextDrainEffectGroupFactory) throw new Error("多个 Effect domain 声明 deterministic drain owner");
          nextDrainEffectGroupFactory = domain.createDrainEffectGroup.bind(domain);
        }
        const families = descriptor.families || domain.actionFamilies || [];
        for (const family of families) {
          if (nextDomains.has(family)) throw new Error(`重复 Effect domain family: ${family}`);
          nextDomains.set(family, domain);
        }
      }
      effectDomainByFamily = nextDomains;
      drainEffectGroupFactory = nextDrainEffectGroupFactory;
      return next;
    }

    function createProductionEffectGroup(workingState, action) {
      const domain = effectDomainByFamily.get(action?.family);
      if (domain) return domain.createEffectGroup(clone(workingState), clone(action));
      return fail("RULE_COMPOSITION_EFFECT_DOMAIN_MISSING", `没有 production Effect domain: ${action?.family || "<missing>"}`);
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
      const projected = options.projectState(
        clone(stateAdapter && options.projectWorkingState ? workingState : state),
        clone(viewer),
        null,
        { stateVersion: state.meta.stateVersion },
      );
      return deepFreeze({ phase: "idle", stateVersion: state.meta.stateVersion, state: projected });
    }

    function projection(viewer = null) {
      if (!activeSession) return committedProjection(viewer);
      return deepFreeze({
        ...runtime.observe(activeSession, clone(viewer)),
        stateVersion: store.getSnapshot().meta.stateVersion,
      });
    }

    function inspect() {
      return deepFreeze({
        phase: activeSession?.phase || "idle",
        family: activeFamily,
        session: activeSession ? runtime.inspect(activeSession) : null,
      });
    }

    function readStateSource(viewer = null) {
      if (stateAdapter && typeof stateAdapter.createProjectionState !== "function") {
        throw new TypeError("Rule Composition 未配置 canonical state source");
      }
      const committed = store.getSnapshot();
      const projectedState = stateAdapter
        ? stateAdapter.createProjectionState(workingState, committed)
        : (activeSession ? runtime.observe(activeSession, clone(viewer))?.state : committed);
      const inspection = activeSession ? runtime.inspect(activeSession) : null;
      const observation = activeSession ? runtime.observe(activeSession, clone(viewer)) : null;
      return deepFreeze({
        source: {
          kind: activeSession ? "working" : "committed",
          stateVersion: committed.meta.stateVersion,
          sessionId: inspection?.sessionId || null,
          sessionRevision: inspection?.revision ?? null,
          phase: inspection?.phase || "idle",
        },
        state: clone(projectedState),
        decision: clone(observation?.decision || inspection?.decision || null),
      });
    }

    function finishIfTerminal() {
      if (!activeSession || !TERMINAL_PHASES.has(activeSession.phase)) return null;
      const terminal = deepFreeze({
        ...clone(lastActionResult || {}),
        ok: activeSession.phase === "completed",
        phase: activeSession.phase,
        family: activeFamily,
        stateVersion: store.getSnapshot().meta.stateVersion,
        failure: clone(activeSession.failure),
        journal: clone(activeSession.journal),
      });
      activeSession = null;
      activeFamily = null;
      lastActionResult = null;
      publish({ source: "session", event: terminal });
      return terminal;
    }

    function advanceSession(result, autoDrain = true) {
      if (!result?.ok) return finishIfTerminal() || deepFreeze(clone(result));
      if (activeSession && autoDrain && !TERMINAL_PHASES.has(activeSession.phase)) {
        const drained = runtime.drain(activeSession);
        if (!drained?.ok) return finishIfTerminal() || deepFreeze(clone(drained));
      }
      return finishIfTerminal() || deepFreeze({
        ok: true,
        projection: projection(),
        journal: clone(activeSession?.journal || null),
      });
    }

    function submitAction(action, submitOptions = {}) {
      if (activeSession) return fail("RULE_COMPOSITION_SESSION_ACTIVE", "已有规则 Session 正在执行");
      lastActionResult = null;
      const beforeWorkingState = stateAdapter ? clone(workingState) : null;
      const dispatched = runtime.dispatchStandardAction(
        clone(action),
        {
          enumerate: (state, request) => {
            const workingContext = actionContext(clone(state));
            return runWithWorkingStateContext(
              workingContext,
              () => actionRegistry.enumerate(workingContext, request),
            );
          },
          validate: (state, candidate) => {
            const workingContext = actionContext(clone(state));
            return runWithWorkingStateContext(
              workingContext,
              () => actionRegistry.validate(workingContext, candidate),
            );
          },
        },
        createProductionEffectGroup,
        { source: "browser-input", ...clone(submitOptions.metadata || {}) },
      );
      if (!dispatched?.ok) {
        if (stateAdapter) stateAdapter.restoreWorkingState(workingState, beforeWorkingState, { reason: "action_dispatch_rejected" });
        return deepFreeze(clone(dispatched));
      }
      activeSession = dispatched.session;
      activeFamily = action.family;
      publish({ source: "session", event: { type: "opened", family: activeFamily } });
      const result = advanceSession(dispatched, submitOptions.autoDrain !== false);
      if (result?.ok === false && stateAdapter && !activeSession) {
        stateAdapter.restoreWorkingState(workingState, beforeWorkingState, { reason: "action_session_aborted" });
      }
      return result;
    }

    function beginDrain(submitOptions = {}) {
      if (activeSession) return fail("RULE_COMPOSITION_SESSION_ACTIVE", "已有规则 Session 正在执行");
      if (!drainEffectGroupFactory) {
        return fail("RULE_COMPOSITION_DRAIN_UNAVAILABLE", "没有 Effect domain 声明 deterministic drain owner");
      }
      lastActionResult = null;
      const internalAction = { family: "environment_drain", phase: "internal", actorId: null };
      const dispatched = runtime.dispatchAction(
        store.getSnapshot(),
        internalAction,
        drainEffectGroupFactory,
        { source: "composition-drain", ...clone(submitOptions.metadata || {}) },
      );
      if (!dispatched?.ok) return deepFreeze(clone(dispatched));
      activeSession = dispatched.session;
      activeFamily = internalAction.family;
      activeSession.journal.actions = [];
      activeSession.journal.replay = [];
      publish({ source: "session", event: { type: "opened", family: activeFamily } });
      return advanceSession(dispatched, submitOptions.autoDrain !== false);
    }

    function submitActionById(actionId, submitOptions = {}) {
      if (activeSession) return fail("RULE_COMPOSITION_SESSION_ACTIVE", "已有规则 Session 正在执行");
      const committed = store.getSnapshot();
      const workingContext = actionContext(clone(committed));
      const action = (runWithWorkingStateContext(
        workingContext,
        () => actionRegistry.enumerate(workingContext, clone(submitOptions.request || {})),
      ) || [])
        .find((candidate) => candidate.actionId === actionId);
      return action
        ? submitAction(action, submitOptions)
        : fail("RULE_COMPOSITION_ACTION_NOT_LEGAL", "actionId 不在当前 committed projection 的合法 Action 中", { actionId });
    }

    function submitQuickAction(action, submitOptions = {}) {
      if (!activeSession) return submitAction(action, submitOptions);
      const workingContext = actionContext(clone(activeSession.workingState));
      const validation = runWithWorkingStateContext(
        workingContext,
        () => actionRegistry.validate(workingContext, clone(action)),
      );
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
      const workingContext = actionContext(clone(state));
      return deepFreeze(clone(runWithWorkingStateContext(
        workingContext,
        () => actionRegistry.enumerate(workingContext, clone(request)),
      ) || []));
    }

    function advance() {
      if (!activeSession) return fail("RULE_COMPOSITION_SESSION_REQUIRED", "当前没有可推进的规则 Session");
      return advanceSession(runtime.advance(activeSession), false);
    }

    function abort(reason = {}) {
      if (!activeSession) return fail("RULE_COMPOSITION_SESSION_REQUIRED", "当前没有可中止的规则 Session");
      return advanceSession(runtime.abort(activeSession, clone(reason)), false);
    }

    function submitOwnerInput(command, submitOptions = {}) {
      if (typeof executeOwnerInput !== "function") {
        return fail("RULE_COMPOSITION_OWNER_INPUT_UNAVAILABLE", "Rule Composition 未配置 Browser owner input executor");
      }
      if (!command?.kind || typeof command.kind !== "string") {
        return fail("RULE_COMPOSITION_OWNER_INPUT_INVALID", "Browser owner input 缺少 kind");
      }
      const nestedWorkingState = activeOwnerInputWorkingState || transactionWorkingState;
      if (nestedWorkingState) {
        try {
          const nestedResult = runWithWorkingStateContext(
            nestedWorkingState,
            () => executeOwnerInput(nestedWorkingState, command),
          );
          // 嵌套 owner input 仍在同一个 Composition 事务内；结果可能携带仅供事务内消费的
          // undo command 函数，不能提前跨端口 structuredClone/deepFreeze。
          return nestedResult || { ok: true };
        } catch (error) {
          return fail("RULE_COMPOSITION_OWNER_INPUT_THROWN", error?.message || "Browser owner input 执行异常");
        }
      }
      const beforeWorkingState = stateAdapter ? clone(workingState) : null;
      const committedBefore = store.getSnapshot();
      let result;
      try {
        activeOwnerInputWorkingState = actionContext(clone(committedBefore));
        result = runWithWorkingStateContext(
          activeOwnerInputWorkingState,
          () => executeOwnerInput(activeOwnerInputWorkingState, clone(command)),
        );
      } catch (error) {
        if (stateAdapter) stateAdapter.restoreWorkingState(workingState, beforeWorkingState, { reason: "owner_input_thrown" });
        return fail("RULE_COMPOSITION_OWNER_INPUT_THROWN", error?.message || "Browser owner input 执行异常");
      } finally {
        activeOwnerInputWorkingState = null;
      }
      if (!result || result.ok === false) {
        if (stateAdapter) stateAdapter.restoreWorkingState(workingState, beforeWorkingState, { reason: "owner_input_rejected" });
        return result?.ok === false
          ? deepFreeze(clone(result))
          : fail("RULE_COMPOSITION_OWNER_INPUT_FAILED", "Browser owner input 未返回成功结果");
      }
      if (activeSession || !stateAdapter || submitOptions.commit === false) {
        return deepFreeze(clone(result));
      }
      const committedBoundary = store.getSnapshot();
      const candidate = stateAdapter.createCommittedState(workingState, committedBoundary, {
        source: "browser-owner-input",
        commandKind: command.kind,
      });
      const validation = store.validate(candidate);
      if (!validation.ok) {
        stateAdapter.restoreWorkingState(workingState, beforeWorkingState, { reason: "owner_input_state_invalid" });
        return deepFreeze(clone(validation));
      }
      const committedSerialized = store.serialize(committedBoundary);
      const candidateSerialized = store.serialize(candidate);
      if (!candidateSerialized.ok) {
        stateAdapter.restoreWorkingState(workingState, beforeWorkingState, { reason: "owner_input_serialize_failed" });
        return deepFreeze(clone(candidateSerialized));
      }
      if (committedSerialized.ok && committedSerialized.serialized === candidateSerialized.serialized) {
        return deepFreeze(clone(result));
      }
      const committed = store.compareAndCommit(
        committedBoundary.meta.stateVersion,
        candidate,
        { source: "browser-owner-input", commandKind: command.kind },
      );
      if (!committed.ok) {
        stateAdapter.restoreWorkingState(workingState, beforeWorkingState, { reason: "owner_input_commit_rejected" });
        return deepFreeze(clone(committed));
      }
      return deepFreeze({ ...clone(result), stateVersion: store.getSnapshot().meta.stateVersion });
    }

    function save(saveOptions = {}) {
      let committed = store.getSnapshot();
      let saveState = activeSession && typeof stateAdapter?.createSavedState === "function"
        ? stateAdapter.createSavedState(committed, workingState, clone(saveOptions))
        : committed;
      if (!activeSession && stateAdapter) {
        const candidate = stateAdapter.createCommittedState(workingState, committed, clone(saveOptions));
        candidate.meta.stateVersion = committed.meta.stateVersion;
        const committedSerialized = store.serialize(committed);
        const candidateSerialized = store.serialize(candidate);
        if (!candidateSerialized.ok) return deepFreeze(clone(candidateSerialized));
        if (!committedSerialized.ok || committedSerialized.serialized !== candidateSerialized.serialized) {
          const settled = store.compareAndCommit(
            committed.meta.stateVersion,
            candidate,
            { source: "browser-composition-save-stable-boundary" },
          );
          if (!settled.ok) return deepFreeze(clone(settled));
          committed = store.getSnapshot();
          saveState = committed;
        } else {
          saveState = candidate;
        }
      }
      const validation = store.validate(saveState);
      if (!validation.ok) return deepFreeze(clone(validation));
      const serialized = store.serialize(saveState);
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
      const allowedKeys = ["schemaVersion", "committedState", "session"];
      const unknownKeys = Object.keys(envelope).filter((key) => !allowedKeys.includes(key));
      if (unknownKeys.length) {
        return fail("RULE_COMPOSITION_SAVE_FIELDS_UNSUPPORTED", "Browser 规则存档包含未知字段", { unknownKeys });
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

    function restore(envelope, restoreOptions = {}) {
      let validated;
      if (restoreOptions.trustedFork === true) {
        try {
          const state = JSON.parse(envelope.committedState);
          const restoredSession = envelope.session == null
            ? null
            : runtime.restoreCheckpoint(clone(envelope.session));
          if (restoredSession?.ok === false) return deepFreeze(clone(restoredSession));
          validated = { ok: true, state, session: restoredSession?.session || null };
        } catch (error) {
          return fail("RULE_COMPOSITION_FORK_RESTORE_FAILED", error?.message || "内存 fork checkpoint 损坏");
        }
      } else {
        validated = validateRestore(envelope);
      }
      if (!validated.ok) return validated;
      if (restoreOptions.inPlace === true) {
        const restoredStore = restoreOptions.trustedFork === true
          ? store.restoreForkSnapshot(validated.state)
          : store.restore(validated.state, { source: "composition-in-memory-fork" });
        if (!restoredStore?.ok) return deepFreeze(clone(restoredStore));
        activeSession = null;
        activeFamily = null;
        lastActionResult = null;
      } else {
        installStore(validated.state);
      }
      if (stateAdapter) stateAdapter.restoreWorkingState(workingState, validated.state, {
        reason: restoreOptions.inPlace === true ? "counterfactual_restore" : "restore",
      });
      if (validated.session) {
        const restored = runtime.restoreCheckpoint(clone(envelope.session));
        if (!restored?.ok) throw new Error("已预验证的 Effect Session 恢复失败");
        activeSession = restored.session;
        activeFamily = activeSession.journal?.actions?.[0]?.action?.family || null;
      }
      if (restoreOptions.silent !== true) {
        publish({ source: "lifecycle", event: { type: "restored" } });
      }
      return deepFreeze({ ok: true, projection: projection() });
    }

    function newGame(initialOptions = {}) {
      let initialState;
      let nextWorkingState = null;
      try {
        nextWorkingState = stateAdapter ? stateAdapter.createWorkingState(clone(initialOptions)) : null;
        initialState = createInitialState(clone(initialOptions), nextWorkingState);
      }
      catch (error) { return fail("RULE_COMPOSITION_NEW_GAME_FAILED", error?.message || "新局状态创建失败"); }
      const previousVersion = store.getSnapshot().meta.stateVersion;
      if (initialState?.meta) initialState.meta.stateVersion = previousVersion + 1;
      try { installStore(initialState); }
      catch (error) { return fail("RULE_COMPOSITION_NEW_GAME_INVALID", error?.message || "新局状态无效"); }
      if (stateAdapter) stateAdapter.restoreWorkingState(workingState, nextWorkingState, {
        reason: "new_game",
        committedState: initialState,
      });
      publish({ source: "lifecycle", event: { type: "new_game" } });
      return deepFreeze({ ok: true, projection: committedProjection() });
    }

    function evaluateCounterfactualOutcomes(actions = [], evaluateOptions = {}) {
      const legalActions = clone(actions);
      const viewer = clone(evaluateOptions.viewer || null);
      const rootObservation = projection(viewer).state;
      if (typeof options.createCounterfactualFork !== "function") {
        return deepFreeze(legalActions.map((action) => ({
          schemaVersion: "seti-action-outcome-v1",
          actionId: action.actionId,
          status: "unresolved",
          confidence: "none",
          code: "COUNTERFACTUAL_FORK_UNAVAILABLE",
          rootObservation,
          leaves: [],
        })));
      }
      const saved = save();
      if (!saved?.ok) {
        return deepFreeze(legalActions.map((action) => ({
          schemaVersion: "seti-action-outcome-v1",
          actionId: action.actionId,
          status: "failed",
          confidence: "none",
          code: saved?.code || "COUNTERFACTUAL_ROOT_SAVE_FAILED",
          rootObservation,
          leaves: [],
        })));
      }
      const canonicalBefore = stableSerialize(saved.envelope);
      const maxDepth = Math.max(1, Number(evaluateOptions.maxDepth) || 4);
      const maxLeaves = Math.max(1, Number(evaluateOptions.maxLeaves) || 12);
      const timing = {
        forkMilliseconds: 0,
        executionMilliseconds: 0,
        projectionMilliseconds: 0,
      };
      const now = () => (
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now()
      );
      let reusableFork = null;
      if (options.reuseCounterfactualFork === true) {
        const forkStartedAt = now();
        reusableFork = options.createCounterfactualFork(clone(saved.envelope), {
          branchKey: stableHash({ canonicalBefore, pool: true }),
        });
        timing.forkMilliseconds += now() - forkStartedAt;
      }

      function explore(envelope, action, chain, depth, leaves) {
        if (depth > maxDepth || leaves.length >= maxLeaves) {
          return { unresolved: true, code: "COUNTERFACTUAL_BRANCH_LIMIT" };
        }
        let fork;
        try {
          const branchKey = stableHash({ canonicalBefore, actionId: action.actionId, chain });
          const forkStartedAt = now();
          fork = reusableFork || options.createCounterfactualFork(clone(envelope), { branchKey });
          const composition = fork?.composition || fork;
          if (reusableFork) {
            reusableFork.resetBranch?.(branchKey);
            const restored = composition.lifecycle.restore(clone(envelope), {
              silent: true,
              inPlace: true,
              trustedFork: true,
            });
            if (!restored?.ok) {
              return {
                failed: true,
                code: restored?.code || "COUNTERFACTUAL_FORK_RESTORE_FAILED",
                message: restored?.message || null,
              };
            }
          }
          timing.forkMilliseconds += now() - forkStartedAt;
          if (!composition?.inputPort || !composition?.inspect || !composition?.lifecycle) {
            return { failed: true, code: "COUNTERFACTUAL_FORK_INVALID" };
          }
          const inspection = composition.inspect();
          const candidates = inspection.phase === "awaiting_input" && inspection.session?.decision
            ? inspection.session.decision.choices
            : composition.inputPort.enumerateActions({ actorId: action.actorId });
          const current = candidates.find((candidate) => candidate.actionId === action.actionId);
          if (!current) return { failed: true, code: "COUNTERFACTUAL_ACTION_STALE" };
          const executionStartedAt = now();
          const result = current.phase === "conditional"
            ? composition.inputPort.submitDecision({
              decisionId: inspection.session.decision.decisionId,
              decisionVersion: inspection.session.decision.decisionVersion,
              choice: current,
            })
            : composition.inputPort.submitAction(current);
          timing.executionMilliseconds += now() - executionStartedAt;
          if (!result?.ok) {
            return {
              failed: true,
              code: result?.code || "COUNTERFACTUAL_EXECUTION_FAILED",
              message: result?.message || null,
            };
          }
          const nextChain = [...chain, current.actionId];
          const nextInspection = composition.inspect();
          const awaitingDecision = nextInspection.phase === "awaiting_input";
          const successors = awaitingDecision
            ? clone(nextInspection.session?.decision?.choices || [])
            : clone(composition.inputPort.enumerateActions({}));
          if (awaitingDecision && current.phase === "conditional" && chain.length === 0) {
            const projectionStartedAt = now();
            const leafObservation = composition.projection(viewer).state;
            timing.projectionMilliseconds += now() - projectionStartedAt;
            leaves.push({
              leafId: `leaf:${stableHash(nextChain)}`,
              status: "settled",
              actionChain: nextChain,
              observation: leafObservation,
              legalSuccessors: successors,
            });
            return { ok: true };
          }
          if (awaitingDecision && successors.length) {
            const childSaved = composition.lifecycle.save();
            if (!childSaved?.ok) return { failed: true, code: childSaved?.code || "COUNTERFACTUAL_BRANCH_SAVE_FAILED" };
            let unresolved = false;
            let code = null;
            for (const successor of [...successors].sort((left, right) => (
              String(left.actionId).localeCompare(String(right.actionId))
            ))) {
              const branch = explore(childSaved.envelope, successor, nextChain, depth + 1, leaves);
              unresolved = unresolved || Boolean(branch?.unresolved);
              code = code || branch?.code || null;
            }
            return { unresolved, code };
          }
          const projectionStartedAt = now();
          const leafObservation = composition.projection(viewer).state;
          timing.projectionMilliseconds += now() - projectionStartedAt;
          leaves.push({
            leafId: `leaf:${stableHash(nextChain)}`,
            status: ["completed", "idle"].includes(nextInspection.phase) ? "settled" : nextInspection.phase,
            actionChain: nextChain,
            observation: leafObservation,
            legalSuccessors: successors,
          });
          return { ok: true };
        } catch (error) {
          return {
            failed: true,
            code: error?.code || "COUNTERFACTUAL_EXECUTION_FAILED",
            message: error?.message || String(error),
          };
        } finally {
          try {
            if (!reusableFork) {
              const disposable = fork?.composition || fork;
              disposable?.dispose?.();
            }
          } catch (_error) {
            // Fork disposal must never affect the canonical composition.
          }
        }
      }

      const outcomes = legalActions.map((action) => {
        const leaves = [];
        const branch = explore(saved.envelope, action, [], 0, leaves);
        return {
          schemaVersion: "seti-action-outcome-v1",
          actionId: action.actionId,
          status: branch?.failed ? "failed" : branch?.unresolved ? "unresolved" : "settled",
          confidence: branch?.unresolved
            ? "low"
            : branch?.failed
              ? "none"
              : (evaluateOptions.confidence || "high"),
          code: branch?.code || null,
          message: branch?.message || null,
          rootObservation,
          leaves,
        };
      }).sort((left, right) => String(left.actionId).localeCompare(String(right.actionId)));
      try {
        (reusableFork?.composition || reusableFork)?.dispose?.();
      } finally {
        reusableFork = null;
      }
      const canonicalRestored = restore(saved.envelope, { silent: true });
      if (!canonicalRestored?.ok) {
        throw new Error(canonicalRestored?.message || "COUNTERFACTUAL_ROOT_RESTORE_FAILED");
      }
      const after = save();
      if (!after?.ok || stableSerialize(after.envelope) !== canonicalBefore) {
        throw new Error("COUNTERFACTUAL_ROOT_POLLUTED: canonical state/RNG/session/journal/history/replay 发生变化");
      }
      lastCounterfactualDiagnostics = deepFreeze({
        candidateCount: legalActions.length,
        forkMilliseconds: timing.forkMilliseconds,
        executionMilliseconds: timing.executionMilliseconds,
        projectionMilliseconds: timing.projectionMilliseconds,
        totalMilliseconds: timing.forkMilliseconds
          + timing.executionMilliseconds
          + timing.projectionMilliseconds,
      });
      return deepFreeze(outcomes);
    }

    const inputPort = Object.freeze({
      enumerateActions,
      submitAction,
      submitActionById,
      submitQuickAction,
      submitDecision,
      beginDrain,
      submitOwnerInput,
      advance,
      abort,
    });
    const lifecycle = Object.freeze({ newGame, save, validateRestore, restore });
    const counterfactualPort = Object.freeze({
      evaluate: evaluateCounterfactualOutcomes,
      getDiagnostics: () => clone(lastCounterfactualDiagnostics),
    });

    const stateSourcePort = !stateAdapter || typeof stateAdapter.createProjectionState === "function"
      ? Object.freeze({
        getSnapshot: () => store.getSnapshot(),
        read: readStateSource,
        project(projector, viewer = null) {
          if (typeof projector !== "function") throw new TypeError("Rule Composition state source projector 必须是函数");
          const envelope = readStateSource(viewer);
          return deepFreeze(clone(projector(envelope.state, clone(viewer), envelope)));
        },
        subscribe(listener) {
          if (typeof listener !== "function") throw new TypeError("Rule Composition state source subscriber 必须是函数");
          return store.subscribe(listener);
        },
      })
      : null;
    const readModelEntries = Object.entries(options.readModels || {});
    for (const [name, reader] of readModelEntries) {
      if (typeof reader !== "function") throw new TypeError(`Rule Composition read model ${name} 必须是函数`);
    }
    const readModelPort = readModelEntries.length
      ? Object.freeze({
        read(name) {
          const reader = options.readModels?.[name];
          if (typeof reader !== "function") throw new TypeError(`Rule Composition 未注册 read model: ${name}`);
          return deepFreeze(clone(reader(workingState, {
            phase: activeSession?.phase || "idle",
            stateVersion: store.getSnapshot().meta.stateVersion,
          })));
        },
      })
      : null;

    return Object.freeze({
      SAVE_SCHEMA_VERSION,
      inputPort,
      lifecycle,
      counterfactualPort,
      projection,
      inspect,
      ...(stateSourcePort ? { stateSourcePort } : {}),
      ...(readModelPort ? { readModelPort } : {}),
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

  return Object.freeze({ SAVE_SCHEMA_VERSION, createRuleComposition });
});
