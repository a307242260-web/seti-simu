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

  function stableHashSerialized(input) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function stableHash(value) {
    return stableHashSerialized(stableSerialize(value));
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
    const storeOptions = Object.freeze({ invariantValidators: [...(options.invariantValidators || [])] });
    let store = stateStoreApi.createStateStore(
      clone(createInitialState(clone(options.initialOptions || {}))),
      storeOptions,
    );
    let runtime = null;
    let activeSession = null;
    let activeFamily = null;
    let lastActionResult = null;
    let transactionWorkingState = null;
    const listeners = new Set();
    let unsubscribeStore = null;
    let effectDomainByFamily = new Map();
    let drainEffectGroupFactory = null;
    let lastCounterfactualDiagnostics = null;

    function actionContext(state) {
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

    function executeRegisteredAction(
      state,
      action,
      executionContext = null,
      compositionWorkingContext = null,
    ) {
      if (typeof actionRegistry.execute !== "function") {
        return fail("RULE_COMPOSITION_ACTION_EXECUTOR_MISSING", "Standard Action registry 缺少 execute()");
      }
      const nextState = compositionWorkingContext?.state
        || compositionWorkingContext
        || clone(state);
      const baseContext = compositionWorkingContext || actionContext(nextState);
      const workingContext = executionContext
        ? { ...baseContext, ...clone(executionContext), state: nextState }
        : baseContext;
      const result = runWithWorkingStateContext(
        workingContext,
        () => actionRegistry.execute(workingContext, clone(action)),
      );
      if (!result || result.ok !== true) {
        return result?.ok === false
          ? result
          : fail("RULE_COMPOSITION_ACTION_EXECUTION_FAILED", "Standard Action execute() 未返回成功结果");
      }
      lastActionResult = clone(result);
      return { ...clone(result), nextState };
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
        publish({ source: "committed", event });
      });
    }

    function createRuntime() {
      const next = effectRuntimeApi.createRuntime({
        stateStore: store,
        validateState: (state) => store.validate(state),
        projectState: (state, viewer, inspection) => (
          options.projectState(
            clone(state),
            clone(viewer),
            clone(inspection),
            { stateVersion: state?.meta?.stateVersion ?? store.getSnapshot().meta.stateVersion },
          )
        ),
      });
      const contextualizeExecutor = (executor) => {
        const wrap = (operation) => (state, ...args) => {
          const workingContext = actionContext(state);
          const result = runWithWorkingStateContext(
            workingContext,
            () => operation(state, ...args, workingContext),
          );
          if (result?.ok === true && result.nextState?.meta && state?.meta) {
            result.nextState.meta = clone(state.meta);
          }
          if (typeof options.transformEffectResult !== "function"
            || result?.ok !== true
            || !result.nextState) return result;
          const transformedContext = actionContext(result.nextState);
          const transformed = runWithWorkingStateContext(
            transformedContext,
            () => options.transformEffectResult(
              transformedContext,
              result,
              args[0] || null,
            ),
          );
          if (transformed !== result && transformed?.ok === true) {
            return {
              ...transformed,
              nextState: clone(transformed.nextState || result.nextState),
            };
          }
          return transformed;
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
          commitWorkingState(state, _context = {}) {
            return clone(state);
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
        clone(state),
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
      const committed = store.getSnapshot();
      const projectedState = activeSession
        ? runtime.observe(activeSession, clone(viewer))?.state
        : committed;
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
        return deepFreeze(clone(dispatched));
      }
      activeSession = dispatched.session;
      activeFamily = action.family;
      publish({ source: "session", event: { type: "opened", family: activeFamily } });
      const result = advanceSession(dispatched, submitOptions.autoDrain !== false);
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
      const resolved = runtime.resolveDecision(activeSession, clone(submission));
      return advanceSession(resolved, submitOptions.autoDrain !== false);
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

    function undo(submission = {}) {
      if (!activeSession) return fail("RULE_COMPOSITION_SESSION_REQUIRED", "当前没有可撤销的规则 Session");
      if (submission.sessionId !== activeSession.sessionId
        || Number(submission.revision) !== Number(activeSession.revision)) {
        return fail("RULE_COMPOSITION_UNDO_STALE", "撤销输入的 Session identity 已失效", {
          expectedSessionId: activeSession.sessionId,
          expectedRevision: activeSession.revision,
        });
      }
      return advanceSession(runtime.undoLastEffect(activeSession), false);
    }

    function save(saveOptions = {}) {
      let serialized;
      if (saveOptions.trustedFork === true && options.allowTrustedForkLifecycle === true) {
        serialized = store.serializeForkSnapshot();
      } else {
        const saveState = store.getSnapshot();
        const validation = store.validate(saveState);
        if (!validation.ok) return deepFreeze(clone(validation));
        serialized = store.serialize(saveState);
      }
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
        restoredSession = runtime.restoreCheckpoint(envelope.session);
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
        if (options.allowTrustedForkLifecycle !== true) {
          return fail(
            "RULE_COMPOSITION_TRUSTED_FORK_FORBIDDEN",
            "trusted fork restore 只允许隔离的 counterfactual composition",
          );
        }
        try {
          const state = restoreOptions.trustedState || JSON.parse(envelope.committedState);
          const restoredSession = envelope.session == null
            ? null
            : runtime.restoreCheckpoint(envelope.session);
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
          ? store.restoreForkSnapshot(validated.state, { trustedFrozen: true })
          : store.restore(validated.state, { source: "composition-in-memory-fork" });
        if (!restoredStore?.ok) return deepFreeze(clone(restoredStore));
        activeSession = null;
        activeFamily = null;
        lastActionResult = null;
      } else {
        installStore(validated.state);
      }
      if (validated.session) {
        activeSession = validated.session;
        activeFamily = activeSession.journal?.actions?.[0]?.action?.family || null;
      }
      if (restoreOptions.silent !== true) {
        publish({ source: "lifecycle", event: { type: "restored" } });
      }
      return restoreOptions.skipProjection === true
        ? deepFreeze({ ok: true })
        : deepFreeze({ ok: true, projection: projection() });
    }

    function newGame(initialOptions = {}) {
      let initialState;
      try {
        initialState = createInitialState(clone(initialOptions));
      }
      catch (error) { return fail("RULE_COMPOSITION_NEW_GAME_FAILED", error?.message || "新局状态创建失败"); }
      const previousVersion = store.getSnapshot().meta.stateVersion;
      if (initialState?.meta) initialState.meta.stateVersion = previousVersion + 1;
      try { installStore(initialState); }
      catch (error) { return fail("RULE_COMPOSITION_NEW_GAME_INVALID", error?.message || "新局状态无效"); }
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
      const canonicalEnvelopeHash = stableHashSerialized(canonicalBefore);
      const maxDepth = Math.max(1, Number(evaluateOptions.maxDepth) || 4);
      const maxLeaves = Math.max(1, Number(evaluateOptions.maxLeaves) || 12);
      const maxNodes = Math.max(legalActions.length, Number(evaluateOptions.maxNodes) || 128);
      const maxFrontierPerRoot = Math.max(
        1,
        Number(evaluateOptions.maxFrontierPerRoot) || 8,
      );
      const secondaryAgentSearch = evaluateOptions.secondaryAgentSearch || null;
      const focalSeatId = secondaryAgentSearch?.focalSeatId == null
        ? null
        : String(secondaryAgentSearch.focalSeatId);
      const maxProxyDepth = Math.max(
        1,
        Number(secondaryAgentSearch?.maxProxyDepth) || 15,
      );
      if (secondaryAgentSearch && (
        !focalSeatId
        || typeof secondaryAgentSearch.selectSuccessors !== "function"
      )) {
        throw new TypeError(
          "secondaryAgentSearch 需要 focalSeatId 和版本化 selectSuccessors",
        );
      }
      const timing = {
        forkMilliseconds: 0,
        executionMilliseconds: 0,
        projectionMilliseconds: 0,
        identityMilliseconds: 0,
        checkpointMilliseconds: 0,
        frontierMilliseconds: 0,
      };
      const now = () => (
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now()
      );
      const evaluationStartedAt = now();
      let reusableFork = null;
      const parsedStateByBytes = new Map();
      const stateHashByBytes = new Map();
      const envelopeHashByObject = new WeakMap();
      function getTrustedState(envelope) {
        const bytes = envelope.committedState;
        if (!parsedStateByBytes.has(bytes)) {
          parsedStateByBytes.set(bytes, deepFreeze(JSON.parse(bytes)));
        }
        return parsedStateByBytes.get(bytes);
      }
      function envelopeHash(envelope) {
        if (!envelopeHashByObject.has(envelope)) {
          const bytes = envelope.committedState;
          if (!stateHashByBytes.has(bytes)) {
            stateHashByBytes.set(bytes, stableHashSerialized(bytes));
          }
          envelopeHashByObject.set(envelope, stableHash({
            schemaVersion: "seti-counterfactual-envelope-key-v2",
            committedStateHash: stateHashByBytes.get(bytes),
            sessionHash: stableHash(envelope.session),
          }));
        }
        return envelopeHashByObject.get(envelope);
      }
      function branchKey(envelope, actionId) {
        return stableHash({
          schemaVersion: "seti-counterfactual-branch-key-v2",
          canonicalEnvelopeHash,
          envelopeHash: envelopeHash(envelope),
          actionId,
        });
      }
      if (options.reuseCounterfactualFork === true) {
        const forkStartedAt = now();
        reusableFork = options.createCounterfactualFork(saved.envelope, {
          branchKey: stableHash({
            schemaVersion: "seti-counterfactual-branch-key-v2",
            canonicalEnvelopeHash,
            pool: true,
          }),
        });
        timing.forkMilliseconds += now() - forkStartedAt;
      }

      const outcomeStateByActionId = new Map(legalActions.map((action) => [action.actionId, {
        action,
        leaves: [],
        frontierLeaves: [],
        failures: [],
        pruned: false,
      }]));
      const processedNodeKeys = new Set();
      let executedNodeCount = 0;
      let transpositionHitCount = 0;
      let prunedNodeCount = 0;
      let beamPrunedOriginCount = 0;
      let maxFrontierSize = legalActions.length;
      let maxRetainedFrontierSize = legalActions.length;

      function originKey(origin) {
        return origin.rootAction.actionId;
      }

      function nodeKey(envelope, action, depth, origins = []) {
        const routeOrigin = origins[0] || {};
        return [
          envelopeHash(envelope),
          action.actionId,
          Math.max(0, maxDepth - depth),
          secondaryAgentSearch ? focalSeatId : "",
          secondaryAgentSearch ? routeOrigin.proxyDepth || 0 : "",
          secondaryAgentSearch ? routeOrigin.opponentProxyDepth || 0 : "",
          secondaryAgentSearch ? Number(Boolean(routeOrigin.focalPassStarted)) : "",
          secondaryAgentSearch ? routeOrigin.routeTargetId || "" : "",
        ].join(":");
      }

      function mergeNode(frontierByKey, node) {
        const key = nodeKey(node.envelope, node.action, node.depth, node.origins);
        const existing = frontierByKey.get(key);
        if (!existing) {
          frontierByKey.set(key, { ...node, key });
          return;
        }
        transpositionHitCount += 1;
        existing.priority = Math.max(existing.priority, node.priority);
        const origins = new Map(existing.origins.map((origin) => [originKey(origin), origin]));
        for (const origin of node.origins) {
          const keyForOrigin = originKey(origin);
          const current = origins.get(keyForOrigin);
          if (!current
            || stableSerialize(origin.chain) < stableSerialize(current.chain)) {
            origins.set(keyForOrigin, origin);
          }
        }
        existing.origins = [...origins.values()];
      }

      function markPruned(origins) {
        prunedNodeCount += 1;
        for (const origin of origins) {
          const state = outcomeStateByActionId.get(origin.rootAction.actionId);
          if (state) state.pruned = true;
        }
      }

      function markFailure(origins, failure) {
        for (const origin of origins) {
          const state = outcomeStateByActionId.get(origin.rootAction.actionId);
          if (state) state.failures.push(failure);
        }
      }

      function compareNodes(left, right) {
        return Number(right.priority || 0) - Number(left.priority || 0)
          || String(left.action.actionId).localeCompare(String(right.action.actionId))
          || String(left.key || "").localeCompare(String(right.key || ""));
      }

      function retainRootFairBeam(nodes) {
        const ordered = [...nodes].sort(compareNodes);
        if (secondaryAgentSearch) {
          const bestByRoot = new Map();
          for (const node of ordered) {
            for (const origin of node.origins) {
              const rootId = origin.rootAction.actionId;
              if (!bestByRoot.has(rootId)) bestByRoot.set(rootId, node);
            }
          }
          const retained = [...new Set(bestByRoot.values())]
            .sort(compareNodes)
            .slice(0, 2);
          const retainedKeys = new Set(retained.map((node) => node.key));
          for (const node of ordered) {
            if (retainedKeys.has(node.key)) continue;
            beamPrunedOriginCount += node.origins.length;
            markPruned(node.origins);
          }
          return retained;
        }
        const retainedKeysByRoot = new Map();
        for (const action of legalActions) {
          const rootActionId = action.actionId;
          const retainedKeys = ordered
            .filter((node) => node.origins.some((origin) => (
              origin.rootAction.actionId === rootActionId
            )))
            .slice(0, maxFrontierPerRoot)
            .map((node) => node.key);
          retainedKeysByRoot.set(rootActionId, new Set(retainedKeys));
        }
        return ordered.flatMap((node) => {
          const retainedOrigins = [];
          const prunedOrigins = [];
          for (const origin of node.origins) {
            const retainedKeys = retainedKeysByRoot.get(origin.rootAction.actionId);
            (retainedKeys?.has(node.key) ? retainedOrigins : prunedOrigins).push(origin);
          }
          if (prunedOrigins.length) {
            beamPrunedOriginCount += prunedOrigins.length;
            markPruned(prunedOrigins);
          }
          return retainedOrigins.length ? [{ ...node, origins: retainedOrigins }] : [];
        });
      }

      function addLeaf(origin, leafObservation, successors, nextInspection, nextCheckpoints) {
        const state = outcomeStateByActionId.get(origin.rootAction.actionId);
        if (!state || state.leaves.length >= maxLeaves) {
          if (state) state.pruned = true;
          return;
        }
        state.leaves.push({
          leafId: `leaf:${stableHash(origin.chain)}`,
          status: ["completed", "idle"].includes(nextInspection.phase)
            ? "settled"
            : nextInspection.phase,
          actionChain: secondaryAgentSearch ? origin.chain : clone(origin.chain),
          observation: secondaryAgentSearch ? leafObservation : clone(leafObservation),
          legalSuccessors: secondaryAgentSearch ? successors : clone(successors),
          routeCheckpoints: secondaryAgentSearch ? [] : clone(nextCheckpoints),
          ...(secondaryAgentSearch ? {
            secondaryAgentDepth: origin.proxyDepth || 0,
            terminalReason: origin.terminalReason || null,
          } : {}),
        });
      }

      function addFrontierLeaf(origin, leafObservation, successors, nextInspection, nextCheckpoints) {
        const state = outcomeStateByActionId.get(origin.rootAction.actionId);
        if (!state) return;
        const leaf = {
          leafId: `frontier:${stableHash(origin.chain)}`,
          status: "search_frontier",
          actionChain: origin.chain,
          observation: leafObservation,
          legalSuccessors: successors,
          routeCheckpoints: [],
          secondaryAgentDepth: origin.proxyDepth || 0,
          terminalReason: "search-frontier",
        };
        const byId = new Map(state.frontierLeaves.map((candidate) => [
          candidate.leafId,
          candidate,
        ]));
        byId.set(leaf.leafId, leaf);
        state.frontierLeaves = [...byId.values()]
          .sort((left, right) => String(left.leafId).localeCompare(String(right.leafId)))
          .slice(-maxLeaves);
      }

      function executeNode(node) {
        let fork;
        try {
          const identityStartedAt = now();
          const branchIdentity = branchKey(node.envelope, node.action.actionId);
          timing.identityMilliseconds += now() - identityStartedAt;
          const forkStartedAt = now();
          fork = reusableFork || options.createCounterfactualFork(node.envelope, {
            branchKey: branchIdentity,
          });
          const composition = fork?.composition || fork;
          if (reusableFork) {
            reusableFork.resetBranch?.(branchIdentity);
            const restored = composition.lifecycle.restore(node.envelope, {
              silent: true,
              inPlace: true,
              trustedFork: true,
              trustedState: getTrustedState(node.envelope),
              skipProjection: true,
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
            : composition.inputPort.enumerateActions({ actorId: node.action.actorId });
          const current = candidates.find((candidate) => candidate.actionId === node.action.actionId);
          if (!current) return { failed: true, code: "COUNTERFACTUAL_ACTION_STALE" };
          const executionStartedAt = now();
          const result = current.phase === "conditional"
            ? composition.inputPort.submitDecision({
              decisionId: inspection.session.decision.decisionId,
              decisionVersion: inspection.session.decision.decisionVersion,
              ownerId: inspection.session.decision.ownerId,
              choice: current,
            })
            : composition.inputPort.submitAction(current);
          timing.executionMilliseconds += now() - executionStartedAt;
          if (!result?.ok) {
            const failure = result?.failure || result?.session?.failure || null;
            return {
              failed: true,
              code: result?.code || failure?.code || "COUNTERFACTUAL_EXECUTION_FAILED",
              message: result?.message || failure?.message || null,
            };
          }
          const nextInspection = composition.inspect();
          const awaitingDecision = nextInspection.phase === "awaiting_input";
          let successors = awaitingDecision
            ? clone(nextInspection.session?.decision?.choices || [])
            : clone(composition.inputPort.enumerateActions({}));
          const projectionStartedAt = now();
          const leafObservation = composition.projection(viewer).state;
          timing.projectionMilliseconds += now() - projectionStartedAt;
          let branchPriority = 0;
          if (typeof evaluateOptions.getBranchPriority === "function") {
            try {
              const measured = Number(evaluateOptions.getBranchPriority({
                rootObservation,
                branchObservation: leafObservation,
                viewer,
                currentAction: clone(current),
              }));
              branchPriority = Number.isFinite(measured) ? measured : 0;
            } catch (_error) {
              branchPriority = 0;
            }
          }
          const checkpointStartedAt = now();
          const childSaved = successors.length
            ? composition.lifecycle.save({ trustedFork: true })
            : null;
          timing.checkpointMilliseconds += now() - checkpointStartedAt;
          if (childSaved && !childSaved.ok) {
            return { failed: true, code: childSaved.code || "COUNTERFACTUAL_BRANCH_SAVE_FAILED" };
          }
          return {
            ok: true,
            current,
            nextInspection,
            awaitingDecision,
            successors,
            leafObservation,
            branchPriority,
            childEnvelope: childSaved?.envelope || null,
          };
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

      let frontier = legalActions.map((action) => ({
        envelope: saved.envelope,
        action,
        depth: 0,
        priority: 0,
        origins: [{
          rootAction: action,
          chain: [],
          checkpoints: [],
          lastProbeAction: null,
          proxyDepth: 0,
          opponentProxyDepth: 0,
          focalPassStarted: false,
          terminalReason: null,
          routeTargetId: null,
        }],
      }));
      while (frontier.length && executedNodeCount < maxNodes) {
        const sorted = [...frontier].sort(compareNodes);
        const selected = sorted;
        const nextFrontierByKey = new Map();
        for (const node of selected) {
          const saturatedOrigins = node.origins.filter((origin) => {
            const state = outcomeStateByActionId.get(origin.rootAction.actionId);
            return state && state.leaves.length >= maxLeaves;
          });
          if (saturatedOrigins.length) markPruned(saturatedOrigins);
          node.origins = node.origins.filter((origin) => !saturatedOrigins.includes(origin));
          if (!node.origins.length) continue;
          if (executedNodeCount >= maxNodes) {
            markPruned(node.origins);
            continue;
          }
          const key = node.key || nodeKey(node.envelope, node.action, node.depth, node.origins);
          if (processedNodeKeys.has(key)) {
            transpositionHitCount += 1;
            continue;
          }
          processedNodeKeys.add(key);
          executedNodeCount += 1;
          const execution = executeNode(node);
          if (execution.failed) {
            markFailure(node.origins, execution);
            continue;
          }
          const current = execution.current;
          const currentIsFocal = secondaryAgentSearch
            && String(current.actorId) === focalSeatId;
          const currentIsProxy = secondaryAgentSearch
            && current.phase !== "conditional"
            && !["end_turn", "pass"].includes(current.family);
          const nextProbeAction = ["launch", "move", "orbit", "land"].includes(current.family)
            ? clone(current)
            : null;
          for (const origin of node.origins) {
            const nextChain = [...origin.chain, current.actionId];
            const originNextProbeAction = nextProbeAction || origin.lastProbeAction;
            let routeTargetId = origin.routeTargetId || null;
            if (
              secondaryAgentSearch
              && typeof secondaryAgentSearch.selectRouteTarget === "function"
            ) {
              try {
                routeTargetId = secondaryAgentSearch.selectRouteTarget({
                  focalSeatId,
                  currentAction: current,
                  rootObservation,
                  branchObservation: execution.leafObservation,
                  routeTargetId,
                }) || null;
              } catch (_error) {
                routeTargetId = origin.routeTargetId || null;
              }
            }
            const nextProxyDepth = origin.proxyDepth + (
              currentIsFocal && currentIsProxy ? 1 : 0
            );
            const focalPassStarted = origin.focalPassStarted
              || (currentIsFocal && current.family === "pass");
            if (
              !secondaryAgentSearch
              && execution.awaitingDecision
              && current.phase === "conditional"
              && origin.chain.length === 0
            ) {
              addLeaf(
                {
                  ...origin,
                  chain: nextChain,
                  proxyDepth: nextProxyDepth,
                  focalPassStarted,
                  routeTargetId,
                },
                execution.leafObservation,
                execution.successors,
                execution.nextInspection,
                origin.checkpoints,
              );
              continue;
            }
            if (execution.awaitingDecision && execution.successors.length) {
              if (node.depth >= maxDepth) {
                markPruned([origin]);
                continue;
              }
              let conditionalSuccessors = execution.successors;
              if (
                secondaryAgentSearch
                && String(conditionalSuccessors[0]?.actorId || "") !== focalSeatId
              ) {
                try {
                  conditionalSuccessors = secondaryAgentSearch.selectSuccessors({
                    focalSeatId,
                    currentAction: current,
                    branchObservation: execution.leafObservation,
                    legalSuccessors: execution.successors,
                    focalProxyDepth: nextProxyDepth,
                    opponentProxyDepth: origin.opponentProxyDepth,
                    actionChain: nextChain,
                    rolloutVersion: secondaryAgentSearch.rolloutVersion || null,
                    routeTargetId,
                  }) || [];
                } catch (error) {
                  markFailure([origin], {
                    code: error?.code || "COUNTERFACTUAL_ROUTE_SELECTOR_FAILED",
                    message: error?.message || String(error),
                  });
                  continue;
                }
                const legalById = new Map(execution.successors.map((successor) => [
                  successor.actionId,
                  successor,
                ]));
                conditionalSuccessors = conditionalSuccessors
                  .map((successor) => legalById.get(successor?.actionId))
                  .filter(Boolean);
                if (!conditionalSuccessors.length) {
                  markFailure([origin], {
                    code: "COUNTERFACTUAL_ROUTE_SELECTOR_EMPTY",
                    message: "secondaryAgentSearch 未选择合法 conditional 后继",
                  });
                  continue;
                }
              }
              for (const successor of conditionalSuccessors) {
                mergeNode(nextFrontierByKey, {
                  envelope: execution.childEnvelope,
                  action: successor,
                  depth: node.depth + 1,
                  priority: execution.branchPriority,
                  origins: [{
                    ...origin,
                    chain: nextChain,
                    lastProbeAction: originNextProbeAction,
                    proxyDepth: nextProxyDepth,
                    focalPassStarted,
                    routeTargetId,
                  }],
                });
              }
              continue;
            }
            const nextCheckpoints = secondaryAgentSearch ? [] : [...origin.checkpoints, {
              actionId: originNextProbeAction?.actionId || current.actionId,
              family: originNextProbeAction?.family || current.family,
              target: clone(originNextProbeAction?.target || current.target || {}),
              summary: originNextProbeAction?.summary || current.summary || null,
              actionChain: nextChain,
              observation: execution.leafObservation,
            }];
            if (secondaryAgentSearch) {
              if (focalPassStarted) {
                addLeaf(
                  {
                    ...origin,
                    chain: nextChain,
                    proxyDepth: nextProxyDepth,
                    focalPassStarted,
                    terminalReason: "focal-pass",
                  },
                  execution.leafObservation,
                  execution.successors,
                  execution.nextInspection,
                  nextCheckpoints,
                );
                continue;
              }
              if (nextProxyDepth >= maxProxyDepth) {
                addLeaf(
                  {
                    ...origin,
                    chain: nextChain,
                    proxyDepth: nextProxyDepth,
                    terminalReason: "secondary-agent-depth",
                  },
                  execution.leafObservation,
                  execution.successors,
                  execution.nextInspection,
                  nextCheckpoints,
                );
                continue;
              }
              if (execution.successors.length && execution.childEnvelope) {
                let selectedSuccessors = [];
                try {
                  selectedSuccessors = secondaryAgentSearch.selectSuccessors({
                    focalSeatId,
                    currentAction: current,
                    branchObservation: execution.leafObservation,
                    legalSuccessors: execution.successors,
                    focalProxyDepth: nextProxyDepth,
                    opponentProxyDepth: currentIsFocal || current.family === "end_turn"
                      ? 0
                      : origin.opponentProxyDepth + (currentIsProxy ? 1 : 0),
                    actionChain: nextChain,
                    rolloutVersion: secondaryAgentSearch.rolloutVersion || null,
                    routeTargetId,
                  }) || [];
                } catch (error) {
                  markFailure([origin], {
                    code: error?.code || "COUNTERFACTUAL_ROUTE_SELECTOR_FAILED",
                    message: error?.message || String(error),
                  });
                  continue;
                }
                const legalById = new Map(execution.successors.map((successor) => [
                  successor.actionId,
                  successor,
                ]));
                selectedSuccessors = selectedSuccessors
                  .map((successor) => legalById.get(successor?.actionId))
                  .filter(Boolean);
                if (!selectedSuccessors.length) {
                  markFailure([origin], {
                    code: "COUNTERFACTUAL_ROUTE_SELECTOR_EMPTY",
                    message: "secondaryAgentSearch 未选择合法后继",
                  });
                  continue;
                }
                if (selectedSuccessors.some((successor) => (
                  String(successor.actorId) === focalSeatId
                ))) {
                  addFrontierLeaf(
                    {
                      ...origin,
                      chain: nextChain,
                      proxyDepth: nextProxyDepth,
                      routeTargetId,
                    },
                    execution.leafObservation,
                    execution.successors,
                    execution.nextInspection,
                    nextCheckpoints,
                  );
                }
                const nextActorIsFocal = selectedSuccessors.some((successor) => (
                  String(successor.actorId) === focalSeatId
                ));
                for (const successor of selectedSuccessors) {
                  let successorPriority = execution.branchPriority;
                  if (typeof secondaryAgentSearch.rankSuccessor === "function") {
                    try {
                      const ranked = Number(secondaryAgentSearch.rankSuccessor({
                        focalSeatId,
                        currentAction: current,
                        successor,
                        rootObservation,
                        branchObservation: execution.leafObservation,
                        focalProxyDepth: nextProxyDepth,
                        routeTargetId,
                        actionChain: nextChain,
                      }));
                      if (Number.isFinite(ranked)) successorPriority += ranked;
                    } catch (_error) {
                      // Successor ranking is an approximation; execution validity remains authoritative.
                    }
                  }
                  mergeNode(nextFrontierByKey, {
                    envelope: execution.childEnvelope,
                    action: successor,
                    depth: 0,
                    priority: successorPriority,
                    origins: [{
                      ...origin,
                      chain: nextChain,
                      checkpoints: nextCheckpoints,
                      lastProbeAction: originNextProbeAction,
                      proxyDepth: nextProxyDepth,
                      opponentProxyDepth: nextActorIsFocal
                        ? 0
                        : (
                          currentIsFocal || current.family === "end_turn"
                            ? 0
                            : origin.opponentProxyDepth + (currentIsProxy ? 1 : 0)
                        ),
                      focalPassStarted,
                      routeTargetId,
                    }],
                  });
                }
                continue;
              }
            }
            addLeaf(
              { ...origin, chain: nextChain, proxyDepth: nextProxyDepth, focalPassStarted },
              execution.leafObservation,
              execution.successors,
              execution.nextInspection,
              nextCheckpoints,
            );
          }
        }
        const frontierStartedAt = now();
        const nextFrontier = [...nextFrontierByKey.values()];
        maxFrontierSize = Math.max(maxFrontierSize, nextFrontier.length);
        frontier = retainRootFairBeam(nextFrontier);
        maxRetainedFrontierSize = Math.max(maxRetainedFrontierSize, frontier.length);
        timing.frontierMilliseconds += now() - frontierStartedAt;
      }
      for (const node of frontier) markPruned(node.origins);

      const outcomes = [...outcomeStateByActionId.values()].map((state) => {
        const failure = state.failures[0] || null;
        const allLeaves = [...state.leaves, ...state.frontierLeaves];
        const hasLeaves = allLeaves.length > 0;
        const status = hasLeaves
          ? "settled"
          : failure && !state.pruned
            ? "failed"
            : "unresolved";
        return {
          schemaVersion: "seti-action-outcome-v1",
          actionId: state.action.actionId,
          status,
          confidence: status === "failed"
            ? "none"
            : state.pruned || state.failures.length
              ? "low"
              : (evaluateOptions.confidence || "high"),
          code: state.pruned
            ? "COUNTERFACTUAL_SEARCH_PRUNED"
            : failure?.code || null,
          message: failure?.message || null,
          reasonCodes: [
            state.pruned ? "counterfactual-search-pruned" : null,
            state.failures.length ? "counterfactual-branch-failed" : null,
          ].filter(Boolean),
          rootObservation,
          leaves: allLeaves.sort((left, right) => (
            String(left.leafId).localeCompare(String(right.leafId))
          )),
        };
      }).sort((left, right) => String(left.actionId).localeCompare(String(right.actionId)));
      try {
        (reusableFork?.composition || reusableFork)?.dispose?.();
      } finally {
        reusableFork = null;
      }
      const after = save();
      if (!after?.ok || stableSerialize(after.envelope) !== canonicalBefore) {
        throw new Error("COUNTERFACTUAL_ROOT_POLLUTED: canonical state/RNG/session/journal/history/replay 发生变化");
      }
      const measuredMilliseconds = now() - evaluationStartedAt;
      const accountedMilliseconds = timing.forkMilliseconds
        + timing.executionMilliseconds
        + timing.projectionMilliseconds
        + timing.identityMilliseconds
        + timing.checkpointMilliseconds
        + timing.frontierMilliseconds;
      lastCounterfactualDiagnostics = deepFreeze({
        candidateCount: legalActions.length,
        executedNodeCount,
        maxNodes,
        maxDepth,
        maxProxyDepth: secondaryAgentSearch ? maxProxyDepth : null,
        secondaryAgentSearch: Boolean(secondaryAgentSearch),
        rolloutVersion: secondaryAgentSearch?.rolloutVersion || null,
        maxFrontierPerRoot,
        maxFrontierSize,
        maxRetainedFrontierSize,
        transpositionHitCount,
        prunedNodeCount,
        beamPrunedOriginCount,
        forkMilliseconds: timing.forkMilliseconds,
        executionMilliseconds: timing.executionMilliseconds,
        projectionMilliseconds: timing.projectionMilliseconds,
        identityMilliseconds: timing.identityMilliseconds,
        checkpointMilliseconds: timing.checkpointMilliseconds,
        frontierMilliseconds: timing.frontierMilliseconds,
        orchestrationMilliseconds: Math.max(0, measuredMilliseconds - accountedMilliseconds),
        totalMilliseconds: measuredMilliseconds,
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
      undo,
      advance,
      abort,
    });
    const lifecycle = Object.freeze({ newGame, save, validateRestore, restore });
    const counterfactualPort = Object.freeze({
      evaluate: evaluateCounterfactualOutcomes,
      getDiagnostics: () => clone(lastCounterfactualDiagnostics),
    });

    const stateSourcePort = Object.freeze({
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
      });
    const readModelEntries = Object.entries(options.readModels || {});
    for (const [name, reader] of readModelEntries) {
      if (typeof reader !== "function") throw new TypeError(`Rule Composition read model ${name} 必须是函数`);
    }
    const readModelPort = readModelEntries.length
      ? Object.freeze({
        read(name) {
          const reader = options.readModels?.[name];
          if (typeof reader !== "function") throw new TypeError(`Rule Composition 未注册 read model: ${name}`);
          const state = activeSession ? activeSession.workingState : store.getSnapshot();
          return deepFreeze(clone(reader(state, {
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
      stateSourcePort,
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
