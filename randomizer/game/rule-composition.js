(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiRuleComposition = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SAVE_SCHEMA_VERSION = "seti-rule-composition-save-v1";
  const TERMINAL_PHASES = new Set(["completed", "aborted", "irreversible_locked"]);
  const HIDDEN_INFORMATION_BARRIER_CODES = new Set([
    "alien_revealed",
    "hidden_alien_card",
    "hidden_alien_card_reveal",
    "hidden_card_draw",
    "hidden_card_reveal",
    "tech_bonus_reveal",
  ]);

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

  function isHiddenInformationBarrier(barrier) {
    const code = String(barrier?.code || "");
    return HIDDEN_INFORMATION_BARRIER_CODES.has(code)
      || code.startsWith("hidden_");
  }

  function maskUnknownCards(cards, knownIds) {
    return (cards || []).map((card) => {
      if (!card) return card;
      return card.id != null && knownIds.has(String(card.id))
        ? clone(card)
        : { hidden: true, faceUp: false };
    });
  }

  function collectKnownCardIds(observation) {
    const ids = new Set();
    const lists = [
      observation?.publicState?.board?.publicCards,
      observation?.selfState?.hand,
      observation?.selfState?.reservedCards,
      observation?.selfState?.privateAlienCards,
    ];
    for (const cards of lists) {
      for (const card of cards || []) {
        if (card?.id != null) ids.add(String(card.id));
      }
    }
    return ids;
  }

  function containsUnknownCardReference(value, knownCardIds) {
    if (!value || typeof value !== "object") return false;
    if (
      value.cardInstanceId != null
      && !knownCardIds.has(String(value.cardInstanceId))
    ) return true;
    if (
      Array.isArray(value.cardInstanceIds)
      && value.cardInstanceIds.some((id) => !knownCardIds.has(String(id)))
    ) return true;
    if (
      Array.isArray(value.cardIds)
      && value.cardIds.some((id) => id != null && !knownCardIds.has(String(id)))
    ) return true;
    return Object.values(value).some((child) => (
      child && typeof child === "object"
      && containsUnknownCardReference(child, knownCardIds)
    ));
  }

  function sanitizeRequirementPlans(requirements, knownCardIds, listKey) {
    // 调用方 sanitizeHiddenInformationObservation 已 clone 整棵 observation，
    // 此处直接原地过滤，不再二次克隆。
    if (!requirements || !Array.isArray(requirements[listKey])) return requirements;
    const filtered = requirements[listKey].filter((entry) => (
      !containsUnknownCardReference(entry, knownCardIds)
    ));
    if (filtered.length !== requirements[listKey].length) {
      requirements[listKey] = filtered;
    }
    return requirements;
  }

  function sanitizeHiddenInformationObservation(rootObservation, leafObservation, barrier) {
    const sanitized = clone(leafObservation);
    if (!sanitized || typeof sanitized !== "object") return sanitized;
    const rootBoard = rootObservation?.publicState?.board || {};
    const knownCardIds = collectKnownCardIds(rootObservation);
    const board = sanitized.publicState?.board || null;
    if (board) {
      board.publicCards = maskUnknownCards(board.publicCards, knownCardIds);
      const rootTechStacks = rootBoard.techSupply?.stacks || {};
      for (const [tileId, stack] of Object.entries(board.techSupply?.stacks || {})) {
        if (stack?.bonusId === rootTechStacks[tileId]?.bonusId) continue;
        stack.bonusId = null;
        stack.bonusHidden = true;
      }
      const rootAlienSlots = rootBoard.aliens?.slots || [];
      for (const [index, slot] of (board.aliens?.slots || []).entries()) {
        if (rootAlienSlots[index]?.revealed || !slot?.revealed) continue;
        slot.revealed = false;
        slot.alienId = null;
      }
    }
    const self = sanitized.selfState || null;
    if (self) {
      for (const key of ["hand", "reservedCards", "privateAlienCards"]) {
        self[key] = maskUnknownCards(self[key], knownCardIds);
      }
    }
    if (sanitized.publicState) sanitized.publicState.pending = null;
    sanitized.decision = null;
    sanitized.probeRouteRequirements = sanitizeRequirementPlans(
      sanitized.probeRouteRequirements,
      knownCardIds,
      "candidates",
    );
    sanitized.dataAnalyzeRequirements = sanitizeRequirementPlans(
      sanitized.dataAnalyzeRequirements,
      knownCardIds,
      "acquisitionPlans",
    );
    sanitized.incomeGainRequirements = sanitizeRequirementPlans(
      sanitized.incomeGainRequirements,
      knownCardIds,
      "plans",
    );
    sanitized.techGainRequirements = sanitizeRequirementPlans(
      sanitized.techGainRequirements,
      knownCardIds,
      "plans",
    );
    sanitized.sectorWinRequirements = sanitizeRequirementPlans(
      sanitized.sectorWinRequirements,
      knownCardIds,
      "accessSources",
    );
    const rootStandardScan = (rootObservation?.sectorWinRequirements?.accessSources || [])
      .find((source) => source?.sourceId === "standard-scan");
    const leafStandardScan = (sanitized.sectorWinRequirements?.accessSources || [])
      .find((source) => source?.sourceId === "standard-scan");
    if (rootStandardScan && leafStandardScan) {
      leafStandardScan.sectorIds = clone(rootStandardScan.sectorIds || []);
    }
    sanitized.informationBoundary = { code: barrier?.code || "hidden_information" };
    return sanitized;
  }

  function sanitizeHiddenInformationActions(rootObservation, actions) {
    const knownCardIds = collectKnownCardIds(rootObservation);
    const knownAlienIds = new Set((rootObservation?.publicState?.board?.aliens?.slots || [])
      .filter((slot) => slot?.revealed && slot?.alienId)
      .map((slot) => String(slot.alienId)));
    let filteredCount = 0;
    const sanitized = [];
    for (const action of actions || []) {
      const target = action?.target || {};
      const unknownCard = containsUnknownCardReference(target, knownCardIds);
      const unknownAlien = target.alienId != null
        && !knownAlienIds.has(String(target.alienId));
      const identityIndependentCardUse = action?.family === "choose_payment"
        || target.kind === "trade-card-selection"
        || target.kind === "discard-hand-cards";
      if (
        (unknownCard && !identityIndependentCardUse)
        || unknownAlien
      ) {
        filteredCount += 1;
        continue;
      }
      const descriptor = unknownCard && identityIndependentCardUse
        ? clone(action)
        : action;
      if (unknownCard && identityIndependentCardUse) {
        if (descriptor.target) {
          if (descriptor.target.cardInstanceId != null) {
            descriptor.target.cardInstanceId = null;
          }
          if (Array.isArray(descriptor.target.cardInstanceIds)) {
            descriptor.target.cardInstanceIds = descriptor.target.cardInstanceIds
              .map(() => null);
          }
          if (Array.isArray(descriptor.target.cardIds)) {
            descriptor.target.cardIds = descriptor.target.cardIds.map(() => null);
          }
        }
        descriptor.summary = "未知牌（仅按数量使用）";
      }
      sanitized.push(descriptor);
    }
    return { actions: sanitized, filteredCount };
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
    const storeOptions = Object.freeze({
      invariantValidators: [...(options.invariantValidators || [])],
      trustedIsolatedOwnership: options.allowTrustedForkLifecycle === true,
    });
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

    function readStoreSnapshot() {
      return options.allowTrustedForkLifecycle === true
        ? store.getForkSnapshot()
        : store.getSnapshot();
    }

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
      if (options.allowTrustedForkLifecycle === true) {
        unsubscribeStore = null;
        return;
      }
      unsubscribeStore = store.subscribe((event) => {
        publish({ source: "committed", event });
      });
    }

    function createRuntime() {
      const next = effectRuntimeApi.createRuntime({
        stateStore: store,
        trustedIsolatedOwnership: options.allowTrustedForkLifecycle === true,
        validateState: options.allowTrustedForkLifecycle === true
          ? () => ({ ok: true })
          : (state) => store.validate(state),
        projectState: (state, viewer, inspection) => (
          options.projectState(
            options.allowTrustedForkLifecycle === true ? state : clone(state),
            clone(viewer),
            clone(inspection),
            { stateVersion: state?.meta?.stateVersion ?? readStoreSnapshot().meta.stateVersion },
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
          if (
            result?.ok === true
            && result.nextState?.meta
            && state?.meta
            && !(
              options.allowTrustedForkLifecycle === true
              && result.nextState === state
            )
          ) {
            result.nextState.meta = clone(state.meta);
          }
          if (typeof options.transformEffectResult !== "function"
            || result?.ok !== true
            || !result.nextState) return result;
          const transformedContext = actionContext(result.nextState);
          const transformed = runWithWorkingStateContext(
            transformedContext,
            () => options.transformEffectResult(
              result.nextState,
              result,
              args[0] || null,
              transformedContext,
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
            return options.allowTrustedForkLifecycle === true ? state : clone(state);
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
      if (domain) return domain.createEffectGroup(
        options.allowTrustedForkLifecycle === true ? workingState : clone(workingState),
        clone(action),
      );
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
      const state = readStoreSnapshot();
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
        stateVersion: readStoreSnapshot().meta.stateVersion,
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
      const committed = readStoreSnapshot();
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
        stateVersion: readStoreSnapshot().meta.stateVersion,
        failure: clone(activeSession.failure),
        journal: clone(activeSession.journal),
        irreversibleBarrier: clone(activeSession.irreversibleBarrier),
      });
      activeSession = null;
      activeFamily = null;
      lastActionResult = null;
      publish({ source: "session", event: terminal });
      return terminal;
    }

    function advanceSession(result, autoDrain = true, responseOptions = {}) {
      if (!result?.ok) return finishIfTerminal() || deepFreeze(clone(result));
      if (activeSession && autoDrain && !TERMINAL_PHASES.has(activeSession.phase)) {
        const drained = runtime.drain(activeSession);
        if (!drained?.ok) return finishIfTerminal() || deepFreeze(clone(drained));
      }
      return finishIfTerminal() || deepFreeze({
        ok: true,
        ...(responseOptions.skipProjection === true ? {} : { projection: projection() }),
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
            const workingContext = actionContext(
              options.allowTrustedForkLifecycle === true ? state : clone(state),
            );
            return runWithWorkingStateContext(
              workingContext,
              () => actionRegistry.enumerate(workingContext, request),
            );
          },
          validate: (state, candidate) => {
            const workingContext = actionContext(
              options.allowTrustedForkLifecycle === true ? state : clone(state),
            );
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
      const result = advanceSession(dispatched, submitOptions.autoDrain !== false, {
        skipProjection: submitOptions.skipProjection === true,
      });
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
        readStoreSnapshot(),
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
      const committed = readStoreSnapshot();
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
      return advanceSession(result, submitOptions.autoDrain !== false, {
        skipProjection: submitOptions.skipProjection === true,
      });
    }

    function submitDecision(submission, submitOptions = {}) {
      if (!activeSession) return fail("RULE_COMPOSITION_SESSION_REQUIRED", "当前没有等待输入的规则 Session");
      const resolved = runtime.resolveDecision(activeSession, clone(submission));
      return advanceSession(resolved, submitOptions.autoDrain !== false, {
        skipProjection: submitOptions.skipProjection === true,
      });
    }

    function enumerateActions(request = {}) {
      const state = activeSession ? activeSession.workingState : readStoreSnapshot();
      const workingContext = actionContext(
        options.allowTrustedForkLifecycle === true && activeSession
          ? state
          : clone(state),
      );
      const actions = runWithWorkingStateContext(
        workingContext,
        () => actionRegistry.enumerate(workingContext, clone(request)),
      ) || [];
      return options.allowTrustedForkLifecycle === true
        ? deepFreeze(actions)
        : deepFreeze(clone(actions));
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
        const saveState = readStoreSnapshot();
        const validation = store.validate(saveState);
        if (!validation.ok) return deepFreeze(clone(validation));
        serialized = store.serialize(saveState);
      }
      if (!serialized.ok) return deepFreeze(clone(serialized));
      const trustedCheckpoint = saveOptions.trustedFork === true
        && options.allowTrustedForkLifecycle === true;
      const session = activeSession
        ? runtime.createCheckpoint(activeSession, { trustedReference: trustedCheckpoint })
        : null;
      if (session?.ok === false) return deepFreeze(clone(session));
      return deepFreeze({
        ok: true,
        envelope: {
          schemaVersion: SAVE_SCHEMA_VERSION,
          committedState: serialized.serialized,
          session: trustedCheckpoint
            ? (session?.checkpoint || null)
            : clone(session?.checkpoint || null),
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
      const previousVersion = readStoreSnapshot().meta.stateVersion;
      if (initialState?.meta) initialState.meta.stateVersion = previousVersion + 1;
      try { installStore(initialState); }
      catch (error) { return fail("RULE_COMPOSITION_NEW_GAME_INVALID", error?.message || "新局状态无效"); }
      publish({ source: "lifecycle", event: { type: "new_game" } });
      return deepFreeze({ ok: true, projection: committedProjection() });
    }

    function advanceFocalPlanningTurn(focalSeatId) {
      if (options.allowTrustedForkLifecycle !== true) {
        return fail(
          "COUNTERFACTUAL_FOCAL_TURN_FORBIDDEN",
          "单席位规划推进只允许隔离的 counterfactual fork",
        );
      }
      if (!focalSeatId) {
        return fail("COUNTERFACTUAL_FOCAL_TURN_OWNER_MISSING", "单席位规划缺少 focalSeatId");
      }
      if (activeSession && !TERMINAL_PHASES.has(activeSession.phase)) {
        return fail(
          "COUNTERFACTUAL_FOCAL_TURN_SESSION_PENDING",
          "Effect Session 未结束时不得跳过其他席位",
        );
      }
      const snapshot = readStoreSnapshot();
      const turn = snapshot.turn || {};
      if (!(turn.activePlayerIds || []).includes(focalSeatId)) {
        return fail(
          "COUNTERFACTUAL_FOCAL_TURN_OWNER_INACTIVE",
          "单席位规划 focal 不在 active seats",
        );
      }
      if ((turn.passedPlayerIds || []).includes(focalSeatId)) {
        return deepFreeze({ ok: true, advanced: false, reason: "focal-passed" });
      }
      if (String(turn.currentPlayerId || "") === String(focalSeatId)) {
        return deepFreeze({ ok: true, advanced: false, reason: "already-focal" });
      }
      const working = store.beginWorkingCopy(snapshot.meta.stateVersion);
      if (!working.ok) return deepFreeze(clone(working));
      const activePlayerCount = Math.max(
        1,
        Number(working.state.turn.activePlayerCount)
          || working.state.turn.activePlayerIds?.length
          || 1,
      );
      working.state.turn.currentPlayerId = focalSeatId;
      working.state.turn.completedTurnPlayerIds = [];
      working.state.turn.actionCycleNumber = Math.max(
        1,
        Number(working.state.turn.actionCycleNumber) || 1,
      ) + 1;
      working.state.turn.turnNumber = Math.max(
        1,
        Number(working.state.turn.turnNumber) || 1,
      ) + Math.max(0, activePlayerCount - 1);
      const committed = store.compareAndCommit(
        working.baseVersion,
        working.state,
        { source: "counterfactual-focal-planning-turn" },
      );
      return committed.ok
        ? deepFreeze({
          ok: true,
          advanced: true,
          stateVersion: committed.stateVersion,
          currentPlayerId: focalSeatId,
        })
        : deepFreeze(clone(committed));
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
      const stopAtPassDecisionBoundary = evaluateOptions.stopAtPassDecisionBoundary === true;
      const secondaryAgentSearch = evaluateOptions.secondaryAgentSearch || null;
      const traceGoalClusters = Boolean(
        secondaryAgentSearch && evaluateOptions.traceGoalClusters === true,
      );
      const maxExecutionNodes = secondaryAgentSearch
        ? Math.max(maxNodes, Number(evaluateOptions.maxExecutionNodes) || maxNodes * 32)
        : maxNodes;
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
      const settledSemanticStateHashByBytes = new Map();
      const dominanceStateByBytes = new Map();
      const semanticActionHashByObject = new WeakMap();
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
      function semanticActionHash(action) {
        if (!semanticActionHashByObject.has(action)) {
          semanticActionHashByObject.set(action, stableHash({
            actorId: action?.actorId || null,
            family: action?.family || null,
            phase: action?.phase || null,
            target: action?.target || null,
            payload: action?.payload || null,
          }));
        }
        return semanticActionHashByObject.get(action);
      }
      function normalizedStateForSearch(state, maskFocalResources = false) {
        const players = state.players?.players || [];
        return {
          ...state,
          meta: {
            ...state.meta,
            stateVersion: 0,
          },
          match: {
            ...state.match,
            decisionVersion: 0,
          },
          ...(maskFocalResources ? {
            players: {
              ...state.players,
              players: players.map((player) => (
                String(player?.id || "") === focalSeatId
                  ? {
                    ...player,
                    resources: {
                      ...player.resources,
                      credits: 0,
                      energy: 0,
                      publicity: 0,
                    },
                  }
                  : player
              )),
            },
          } : {}),
        };
      }
      function replaceSerializedValue(bytes, currentValue, nextValue) {
        const current = stableSerialize(currentValue);
        const index = bytes.indexOf(current);
        if (index < 0) return null;
        return `${bytes.slice(0, index)}${stableSerialize(nextValue)}${
          bytes.slice(index + current.length)
        }`;
      }
      function normalizedStateBytesForSearch(envelope, maskFocalResources = false) {
        const bytes = envelope.committedState;
        const state = getTrustedState(envelope);
        const normalizedMeta = { ...state.meta, stateVersion: 0 };
        const normalizedMatch = { ...state.match, decisionVersion: 0 };
        let normalized = replaceSerializedValue(bytes, state.meta, normalizedMeta);
        normalized = normalized == null
          ? null
          : replaceSerializedValue(normalized, state.match, normalizedMatch);
        if (normalized != null && maskFocalResources) {
          const player = (state.players?.players || []).find((candidate) => (
            String(candidate?.id || "") === focalSeatId
          ));
          if (!player) return null;
          normalized = replaceSerializedValue(normalized, player, {
            ...player,
            resources: {
              ...player.resources,
              credits: 0,
              energy: 0,
              publicity: 0,
            },
          });
        }
        return normalized;
      }
      function settledSemanticStateHash(envelope) {
        if (envelope?.session != null) return null;
        const bytes = envelope.committedState;
        if (!settledSemanticStateHashByBytes.has(bytes)) {
          const normalizedBytes = normalizedStateBytesForSearch(envelope);
          settledSemanticStateHashByBytes.set(
            bytes,
            normalizedBytes == null
              ? stableHash(normalizedStateForSearch(getTrustedState(envelope)))
              : stableHashSerialized(normalizedBytes),
          );
        }
        return settledSemanticStateHashByBytes.get(bytes);
      }
      function dominanceState(envelope) {
        if (envelope?.session != null) return null;
        const bytes = envelope.committedState;
        if (!dominanceStateByBytes.has(bytes)) {
          const state = getTrustedState(envelope);
          const player = (state.players?.players || []).find((candidate) => (
            String(candidate?.id || "") === focalSeatId
          ));
          const normalizedBytes = normalizedStateBytesForSearch(envelope, true);
          dominanceStateByBytes.set(bytes, player ? {
            contextHash: normalizedBytes == null
              ? stableHash(normalizedStateForSearch(state, true))
              : stableHashSerialized(normalizedBytes),
            resources: {
              credits: Number(player.resources?.credits) || 0,
              energy: Number(player.resources?.energy) || 0,
              publicity: Number(player.resources?.publicity) || 0,
            },
          } : null);
        }
        return dominanceStateByBytes.get(bytes);
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
      const rootTargetsByActionId = new Map();
      if (
        secondaryAgentSearch
        && typeof secondaryAgentSearch.selectRootTargets === "function"
      ) {
        const legalById = new Map(legalActions.map((action) => [action.actionId, action]));
        const catalog = secondaryAgentSearch.selectRootTargets({
          focalSeatId,
          rootObservation,
          legalActions: clone(legalActions),
          maxProxyDepth,
        });
        if (!Array.isArray(catalog)) {
          throw new TypeError("secondaryAgentSearch 根目标目录必须是数组");
        }
        for (const target of catalog) {
          const targetId = String(target?.targetId || "");
          const planId = String(target?.planId || targetId);
          const resultTargetIds = [...new Set(
            (target?.resultTargetIds || [targetId]).map(String).filter(Boolean),
          )].sort();
          if (!targetId || !Array.isArray(target?.compatibleActionIds)) {
            throw new TypeError("secondaryAgentSearch 根目标缺少 targetId/compatibleActionIds");
          }
          if (!resultTargetIds.includes(targetId)) {
            throw new TypeError("secondaryAgentSearch 根目标未包含在 resultTargetIds");
          }
          for (const actionId of target.compatibleActionIds) {
            if (!legalById.has(actionId)) {
              throw new TypeError(`secondaryAgentSearch 根目标引用非法 actionId: ${actionId}`);
            }
            const current = rootTargetsByActionId.get(actionId) || [];
            if (!current.some((entry) => (
              entry.targetId === targetId && entry.planId === planId
            ))) current.push({ targetId, planId, resultTargetIds });
            rootTargetsByActionId.set(actionId, current);
          }
        }
      }
      const processedNodeKeys = new Set();
      let executedNodeCount = 0;
      let expandedSearchNodeCount = 0;
      let transpositionHitCount = 0;
      let prunedNodeCount = 0;
      let beamPrunedOriginCount = 0;
      let sharedPhysicalExecutionOriginCount = 0;
      let conditionalEquivalentMergeCount = 0;
      let resourceDominatedOriginCount = 0;
      let completionDominatedOriginCount = 0;
      let targetEquivalentChoicePrunedCount = 0;
      let targetSchedulerPrunedCount = 0;
      let unreachableRouteOriginCount = 0;
      let completedGoalTransitionCount = 0;
      let maxCompletedGoalDepth = 0;
      let opponentExecutedNodeCount = 0;
      let focalPlanningTurnAdvanceCount = 0;
      let focalPassBoundaryLeafCount = 0;
      let hiddenInformationFilteredActionCount = 0;
      const hiddenInformationBarrierCountByCode = new Map();
      let maxFrontierSize = legalActions.length;
      let maxRetainedFrontierSize = legalActions.length;
      let maxFrontierOriginCount = legalActions.length;
      const executedNodeCountByFamily = new Map();
      const executedNodeCountByDecisionKind = new Map();
      const executedNodeCountByActionSummary = new Map();
      const executedNodeCountByActor = new Map();
      const executedOriginCountByTarget = new Map();
      const executedOriginCountByTargetAndDecisionKind = new Map();
      const routeEntryStatsByTarget = new Map();
      const completedTransitionCountByTarget = new Map();
      const retainedCompletedTransitionCountByTarget = new Map();
      const completedRouteGroupsByTarget = new Map();
      const leafCountByVirtualRoot = new Map();
      const saturatedOriginCountByVirtualRoot = new Map();
      const saturatedRouteGroupsByVirtualRoot = new Map();
      const virtualRootDescriptionByKey = new Map();
      const chainKeyByOrigin = new WeakMap();
      const dominanceCheckedOrigins = new WeakSet();
      const resourceDominatedOrigins = new WeakSet();
      const retainedDominanceEntriesByGroup = new Map();
      const retainedCompletionEntriesByGroup = new Map();
      const dominatedCompletionKeys = new Set();
      const completionDominatedOriginCountByTarget = new Map();
      const goalClusterTraceByPath = new Map();
      const goalCompletionTraceRefsByKey = new Map();
      let goalClusterTraceExecutionOrdinal = 0;

      function traceAction(action) {
        return {
          family: action?.family || null,
          summary: action?.summary || action?.family || null,
          target: clone(action?.target || {}),
        };
      }

      function tracePathKey(path) {
        return stableSerialize(path || []);
      }

      function ensureGoalCluster(parentPath, targetId) {
        if (!traceGoalClusters || !targetId) return null;
        const path = [...(parentPath || []), targetId];
        const key = tracePathKey(path);
        if (!goalClusterTraceByPath.has(key)) {
          goalClusterTraceByPath.set(key, {
            key,
            depth: path.length,
            path,
            parentPath: [...(parentPath || [])],
            targetId,
            entryCount: 0,
            firstExecutionOrder: null,
            executedOriginCount: 0,
            completedTransitionCount: 0,
            survivingCompletionCount: 0,
            routeVariants: new Map(),
            childTargets: new Map(),
          });
        }
        return goalClusterTraceByPath.get(key);
      }

      function mergeGoalTracePaths(left, right) {
        if (!traceGoalClusters) return left || right || [];
        const paths = new Map();
        for (const path of [...(left || []), ...(right || [])]) {
          paths.set(tracePathKey(path), [...path]);
        }
        return [...paths.values()];
      }

      function recordGoalClusterEntry(parentPaths, targetId) {
        if (!traceGoalClusters || !targetId) return;
        for (const parentPath of parentPaths || []) {
          const cluster = ensureGoalCluster(parentPath, targetId);
          cluster.entryCount += 1;
        }
      }

      function recordGoalClusterExecution(parentPaths, targetId) {
        if (!traceGoalClusters || !targetId) return;
        for (const parentPath of parentPaths || []) {
          const cluster = ensureGoalCluster(parentPath, targetId);
          goalClusterTraceExecutionOrdinal += 1;
          if (cluster.firstExecutionOrder == null) {
            cluster.firstExecutionOrder = goalClusterTraceExecutionOrdinal;
          }
          cluster.executedOriginCount += 1;
        }
      }

      function goalRouteVariantKey(actions, quickTradeCount) {
        return stableSerialize({
          actions: (actions || []).map((action) => ({
            family: action.family,
            summary: action.summary,
            target: action.target,
          })),
          quickTradeCount,
        });
      }

      function recordGoalClusterCompletion(
        parentPaths,
        targetId,
        actions,
        quickTradeCount,
        completion,
      ) {
        if (!traceGoalClusters || !targetId) return;
        const refs = [];
        for (const parentPath of parentPaths || []) {
          const cluster = ensureGoalCluster(parentPath, targetId);
          const variantKey = goalRouteVariantKey(actions, quickTradeCount);
          const variant = cluster.routeVariants.get(variantKey) || {
            key: variantKey,
            actions: (actions || []).map(traceAction),
            quickTradeCount,
            completedTransitionCount: 0,
            survivingCompletionCount: 0,
          };
          cluster.completedTransitionCount += 1;
          variant.completedTransitionCount += 1;
          if (completion.retained) {
            cluster.survivingCompletionCount += 1;
            variant.survivingCompletionCount += 1;
          }
          cluster.routeVariants.set(variantKey, variant);
          refs.push({ clusterKey: cluster.key, variantKey });
        }
        if (completion.key) goalCompletionTraceRefsByKey.set(completion.key, refs);
      }

      function markGoalCompletionDominated(completionKey) {
        if (!traceGoalClusters || !completionKey) return;
        for (const ref of goalCompletionTraceRefsByKey.get(completionKey) || []) {
          const cluster = goalClusterTraceByPath.get(ref.clusterKey);
          const variant = cluster?.routeVariants.get(ref.variantKey);
          if (!cluster || !variant) continue;
          cluster.survivingCompletionCount = Math.max(
            0,
            cluster.survivingCompletionCount - 1,
          );
          variant.survivingCompletionCount = Math.max(
            0,
            variant.survivingCompletionCount - 1,
          );
        }
      }

      function recordGoalClusterChildren(completedPaths, selectedRoutes) {
        if (!traceGoalClusters) return;
        for (const completedPath of completedPaths || []) {
          const parentCluster = goalClusterTraceByPath.get(tracePathKey(completedPath));
          for (const route of selectedRoutes || []) {
            if (!route.routeTargetId) continue;
            if (parentCluster) {
              parentCluster.childTargets.set(
                route.routeTargetId,
                (parentCluster.childTargets.get(route.routeTargetId) || 0) + 1,
              );
            }
            recordGoalClusterEntry([completedPath], route.routeTargetId);
          }
        }
      }

      function recordRouteEntry(targetId, planId, envelope) {
        if (!targetId || !envelope) return;
        const stats = routeEntryStatsByTarget.get(targetId) || {
          bindingOriginCount: 0,
          entries: new Map(),
        };
        const entryKey = `${planId || ""}:${envelopeHash(envelope)}`;
        const bindingCount = (stats.entries.get(entryKey) || 0) + 1;
        stats.bindingOriginCount += 1;
        stats.entries.set(entryKey, bindingCount);
        routeEntryStatsByTarget.set(targetId, stats);
      }

      function recordCompletedRoute(targetId, routeActions, quickTradeCount, retained) {
        if (!targetId) return;
        const groups = completedRouteGroupsByTarget.get(targetId) || new Map();
        const routeFamilies = (routeActions || []).map((action) => action.family);
        const key = stableSerialize({ routeFamilies, quickTradeCount });
        const group = groups.get(key) || {
          routeFamilies,
          quickTradeCount,
          completedTransitionCount: 0,
          retainedCompletedTransitionCount: 0,
        };
        if (retained == null) group.completedTransitionCount += 1;
        else if (retained) group.retainedCompletedTransitionCount += 1;
        groups.set(key, group);
        completedRouteGroupsByTarget.set(targetId, groups);
      }

      function chainKey(origin) {
        if (!chainKeyByOrigin.has(origin)) {
          chainKeyByOrigin.set(origin, stableSerialize(origin.chain || []));
        }
        return chainKeyByOrigin.get(origin);
      }

      function originKey(origin) {
        return [
          origin.rootAction.actionId,
          origin.rootRouteTargetId || "",
          origin.rootRoutePlanId || "",
          origin.routeTargetId || "",
          origin.routePlanId || "",
          origin.proxyDepth || 0,
          origin.opponentProxyDepth || 0,
          Number(Boolean(origin.focalPassStarted)),
          Number(Boolean(origin.goalCompletionPending)),
          Number(Boolean(origin.informationMasked)),
        ].join(":");
      }

      function virtualRootKey(origin) {
        return [
          origin.rootAction.actionId,
          origin.rootRouteTargetId || "",
          origin.rootRoutePlanId || "",
        ].join(":");
      }

      function rememberVirtualRoot(origin) {
        const key = virtualRootKey(origin);
        if (!virtualRootDescriptionByKey.has(key)) {
          virtualRootDescriptionByKey.set(key, {
            rootActionId: origin.rootAction.actionId,
            rootActionFamily: origin.rootAction.family,
            rootActionSummary: origin.rootAction.summary || null,
            rootRouteTargetId: origin.rootRouteTargetId || null,
            rootRoutePlanId: origin.rootRoutePlanId || null,
          });
        }
        return key;
      }

      function exactNodeKey(envelope, action, depth) {
        return [
          envelopeHash(envelope),
          action.actionId,
          Math.max(0, maxDepth - depth),
          secondaryAgentSearch ? focalSeatId : "",
        ].join(":");
      }

      function nodeKey(node) {
        const semanticStateHash = node.semanticMergeEligible
          ? settledSemanticStateHash(node.envelope)
          : null;
        if (!semanticStateHash) {
          return exactNodeKey(node.envelope, node.action, node.depth);
        }
        return [
          "conditional-equivalent",
          semanticStateHash,
          semanticActionHash(node.action),
          Math.max(0, maxDepth - node.depth),
          focalSeatId,
        ].join(":");
      }

      function mergeNode(frontierByKey, node) {
        const key = nodeKey(node);
        const existing = frontierByKey.get(key);
        if (!existing) {
          frontierByKey.set(key, { ...node, key });
          return;
        }
        transpositionHitCount += 1;
        if (
          node.semanticMergeEligible
          && exactNodeKey(node.envelope, node.action, node.depth)
            !== exactNodeKey(existing.envelope, existing.action, existing.depth)
        ) {
          conditionalEquivalentMergeCount += 1;
        }
        if (compareSearchPriorities(node.priority, existing.priority) < 0) {
          existing.priority = node.priority;
        }
        const origins = new Map(existing.origins.map((origin) => [originKey(origin), origin]));
        for (const origin of node.origins) {
          const keyForOrigin = originKey(origin);
          const current = origins.get(keyForOrigin);
          const mergedTracePaths = mergeGoalTracePaths(
            current?.goalTracePaths,
            origin.goalTracePaths,
          );
          if (!current
            || Number(origin.quickTradeCount || 0) < Number(current.quickTradeCount || 0)
            || (
              Number(origin.quickTradeCount || 0) === Number(current.quickTradeCount || 0)
              && (
                Number(origin.proxyDepth || 0) < Number(current.proxyDepth || 0)
                || (
                  Number(origin.proxyDepth || 0) === Number(current.proxyDepth || 0)
                  && chainKey(origin) < chainKey(current)
                )
              )
            )) {
            if (traceGoalClusters) origin.goalTracePaths = mergedTracePaths;
            origins.set(keyForOrigin, origin);
          } else if (traceGoalClusters) {
            current.goalTracePaths = mergedTracePaths;
          }
        }
        existing.origins = [...origins.values()];
      }

      function dominatesResources(left, right) {
        const leftResources = left.state.resources;
        const rightResources = right.state.resources;
        const resourceKeys = ["credits", "energy", "publicity"];
        const noLess = resourceKeys.every((key) => (
          leftResources[key] >= rightResources[key]
        ));
        const noMoreTrades = Number(left.origin.quickTradeCount || 0)
          <= Number(right.origin.quickTradeCount || 0);
        const strictlyBetter = resourceKeys.some((key) => (
          leftResources[key] > rightResources[key]
        )) || Number(left.origin.quickTradeCount || 0)
          < Number(right.origin.quickTradeCount || 0);
        return noLess && noMoreTrades && strictlyBetter;
      }

      function dominanceGroupKey(node, origin) {
        return [
          virtualRootKey(origin),
          origin.routeTargetId || "",
          origin.routePlanId || "",
          origin.proxyDepth || 0,
          origin.opponentProxyDepth || 0,
          Number(Boolean(origin.focalPassStarted)),
          Number(Boolean(origin.goalCompletionPending)),
          Number(Boolean(origin.rootWasConditional)),
          Number(Boolean(origin.informationMasked)),
          semanticActionHash(node.action),
          Math.max(0, maxDepth - node.depth),
        ].join(":");
      }

      function pruneResourceDominatedOrigins(nodes) {
        if (!secondaryAgentSearch) return nodes;
        for (const node of nodes) {
          if (node.envelope?.session != null) continue;
          for (const origin of node.origins) {
            if (dominanceCheckedOrigins.has(origin)) continue;
            dominanceCheckedOrigins.add(origin);
            const state = dominanceState(node.envelope);
            if (!state) continue;
            const key = `${dominanceGroupKey(node, origin)}:${state.contextHash}`;
            const retained = retainedDominanceEntriesByGroup.get(key) || [];
            const candidate = { node, origin, state };
            if (retained.some((entry) => dominatesResources(entry, candidate))) {
              resourceDominatedOrigins.add(origin);
              resourceDominatedOriginCount += 1;
              continue;
            }
            const survivors = [];
            for (const entry of retained) {
              if (dominatesResources(candidate, entry)) {
                resourceDominatedOrigins.add(entry.origin);
                resourceDominatedOriginCount += 1;
              } else {
                survivors.push(entry);
              }
            }
            survivors.push(candidate);
            retainedDominanceEntriesByGroup.set(key, survivors);
          }
        }
        return nodes.flatMap((node) => {
          const origins = node.origins.filter((origin) => (
            !resourceDominatedOrigins.has(origin)
          ));
          return origins.length ? [{ ...node, origins }] : [];
        });
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

      function prioritySortKey(priority) {
        if (Array.isArray(priority?.sortKey)) return priority.sortKey.map(Number);
        const numeric = Number(priority);
        return [Number.isFinite(numeric) ? numeric : 0];
      }

      function compareSearchPriorities(left, right) {
        const leftKey = prioritySortKey(left);
        const rightKey = prioritySortKey(right);
        const length = Math.max(leftKey.length, rightKey.length);
        for (let index = 0; index < length; index += 1) {
          const leftValue = Number.isFinite(leftKey[index]) ? leftKey[index] : 0;
          const rightValue = Number.isFinite(rightKey[index]) ? rightKey[index] : 0;
          if (leftValue !== rightValue) return rightValue - leftValue;
        }
        return 0;
      }

      function compareNodes(left, right) {
        return (
          secondaryAgentSearch
            ? Math.min(...left.origins.map((origin) => origin.proxyDepth || 0))
              - Math.min(...right.origins.map((origin) => origin.proxyDepth || 0))
            : 0
        )
          || compareSearchPriorities(left.priority, right.priority)
          || (
            secondaryAgentSearch
              ? Math.max(...right.origins.map((origin) => origin.chain?.length || 0))
                - Math.max(...left.origins.map((origin) => origin.chain?.length || 0))
              : 0
          )
          || String(left.action.actionId).localeCompare(String(right.action.actionId))
          || String(left.key || "").localeCompare(String(right.key || ""));
      }

      function completionFactsDominate(left, right) {
        const scalarPaths = [
          ["score"],
          ...[
            "credits",
            "energy",
            "publicity",
            "availableData",
            "additionalPublicScan",
            "ordinaryCards",
            "alienCards",
          ]
            .map((key) => ["resources", key]),
          ...[
            "credits",
            "energy",
            "publicity",
            "availableData",
            "handSize",
            "additionalPublicScan",
          ].map((key) => ["income", key]),
          ["dataProgress", "computerPlacedCount"],
          ["dataProgress", "analyzeReady"],
        ];
        const valueAt = (source, path) => (
          path.reduce((value, key) => value?.[key], source)
        );
        const noLess = scalarPaths.every((path) => (
          Number(valueAt(left.facts, path) || 0) >= Number(valueAt(right.facts, path) || 0)
        ));
        const leftTech = new Set(left.facts.ownedTechIds || []);
        const rightTech = new Set(right.facts.ownedTechIds || []);
        const techSuperset = [...rightTech].every((techId) => leftTech.has(techId));
        if (!noLess || !techSuperset) return false;
        const strictlyBetter = scalarPaths.some((path) => (
          Number(valueAt(left.facts, path) || 0) > Number(valueAt(right.facts, path) || 0)
        )) || leftTech.size > rightTech.size;
        if (strictlyBetter) return true;
        const leftTrades = Number(left.quickTradeCount || 0);
        const rightTrades = Number(right.quickTradeCount || 0);
        if (leftTrades !== rightTrades) return leftTrades < rightTrades;
        if (left.chainLength !== right.chainLength) return left.chainLength < right.chainLength;
        return left.key < right.key;
      }

      function retainCompletedEndpoint(origin, observation, nextProxyDepth, nextChain, quickTrades) {
        if (typeof secondaryAgentSearch?.getCompletionFacts !== "function") {
          return { retained: true, key: null };
        }
        const facts = secondaryAgentSearch.getCompletionFacts(observation, focalSeatId);
        if (!facts || typeof facts !== "object") {
          throw new TypeError("secondaryAgentSearch 完成态缺少正式终点评估事实");
        }
        const key = stableHash([
          origin.rootAction.actionId,
          origin.routeTargetId || "",
          nextProxyDepth,
          nextChain,
        ]);
        const targetId = origin.routeTargetId || "<unbound>";
        const groupKey = `${origin.rootAction.actionId}:${nextProxyDepth}:${targetId}`;
        const candidate = {
          key,
          facts,
          quickTradeCount: quickTrades,
          chainLength: nextChain.length,
        };
        const retained = retainedCompletionEntriesByGroup.get(groupKey) || [];
        if (retained.some((entry) => completionFactsDominate(entry, candidate))) {
          dominatedCompletionKeys.add(key);
          completionDominatedOriginCount += 1;
          completionDominatedOriginCountByTarget.set(
            targetId,
            (completionDominatedOriginCountByTarget.get(targetId) || 0) + 1,
          );
          return { retained: false, key };
        }
        const survivors = [];
        for (const entry of retained) {
          if (completionFactsDominate(candidate, entry)) {
            dominatedCompletionKeys.add(entry.key);
            markGoalCompletionDominated(entry.key);
            completionDominatedOriginCount += 1;
            completionDominatedOriginCountByTarget.set(
              targetId,
              (completionDominatedOriginCountByTarget.get(targetId) || 0) + 1,
            );
          } else {
            survivors.push(entry);
          }
        }
        survivors.push(candidate);
        retainedCompletionEntriesByGroup.set(groupKey, survivors);
        return { retained: true, key };
      }

      function retainRootFairBeam(nodes) {
        const ordered = [...nodes].sort(compareNodes);
        if (secondaryAgentSearch) {
          return ordered;
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
        const rootKey = virtualRootKey(origin);
        const leafCount = leafCountByVirtualRoot.get(rootKey) || 0;
        if (!state || (!secondaryAgentSearch && leafCount >= maxLeaves)) {
          if (state) state.pruned = true;
          return;
        }
        leafCountByVirtualRoot.set(rootKey, leafCount + 1);
        state.leaves.push({
          leafId: `leaf:${stableHash([
            origin.rootRouteTargetId || null,
            origin.rootRoutePlanId || null,
            origin.chain,
          ])}`,
          status: ["completed", "idle"].includes(nextInspection.phase)
            ? "settled"
            : nextInspection.phase,
          actionChain: secondaryAgentSearch ? origin.chain : clone(origin.chain),
          observation: secondaryAgentSearch ? leafObservation : clone(leafObservation),
          legalSuccessors: secondaryAgentSearch ? successors : clone(successors),
          routeCheckpoints: secondaryAgentSearch ? [] : clone(nextCheckpoints),
          ...(secondaryAgentSearch ? {
            secondaryAgentDepth: origin.proxyDepth || 0,
            quickTradeCount: origin.quickTradeCount || 0,
            secondaryAgentTrace: clone(origin.routeActions || []),
            secondaryAgentGoalPaths: clone(origin.goalTracePaths || []),
            secondaryAgentGoalSelections: clone(origin.goalTraceSelections || []),
            rootActionObservation: origin.rootActionObservation || null,
            rootActionLegalSuccessors: clone(origin.rootActionLegalSuccessors || []),
            rootActionSettledObservation: origin.rootActionSettledObservation || null,
            rootActionSettledLegalSuccessors: clone(origin.rootActionSettledLegalSuccessors || []),
            terminalReason: origin.terminalReason || null,
            rootRouteTargetId: origin.rootRouteTargetId || null,
            rootRoutePlanId: origin.rootRoutePlanId || null,
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
          quickTradeCount: origin.quickTradeCount || 0,
          secondaryAgentTrace: clone(origin.routeActions || []),
          rootActionObservation: origin.rootActionObservation || null,
          rootActionLegalSuccessors: clone(origin.rootActionLegalSuccessors || []),
          rootActionSettledObservation: origin.rootActionSettledObservation || null,
          rootActionSettledLegalSuccessors: clone(origin.rootActionSettledLegalSuccessors || []),
          terminalReason: "search-frontier",
          rootRouteTargetId: origin.rootRouteTargetId || null,
          rootRoutePlanId: origin.rootRoutePlanId || null,
        };
        const rootTargetId = origin.rootRouteTargetId || null;
        const rootPlanId = origin.rootRoutePlanId || null;
        const otherTargets = state.frontierLeaves.filter((candidate) => (
          candidate.rootRouteTargetId !== rootTargetId
          || candidate.rootRoutePlanId !== rootPlanId
        ));
        const byId = new Map(state.frontierLeaves
          .filter((candidate) => (
            candidate.rootRouteTargetId === rootTargetId
            && candidate.rootRoutePlanId === rootPlanId
          ))
          .map((candidate) => [
          candidate.leafId,
          candidate,
          ]));
        byId.set(leaf.leafId, leaf);
        const sameTargetLeaves = [...byId.values()]
          .sort((left, right) => String(left.leafId).localeCompare(String(right.leafId)));
        state.frontierLeaves = [
          ...otherTargets,
          ...(secondaryAgentSearch ? sameTargetLeaves : sameTargetLeaves.slice(-maxLeaves)),
        ];
      }

      function executeNode(node) {
        let fork;
        try {
          if (
            secondaryAgentSearch
            && String(node.action?.actorId || "") !== focalSeatId
          ) {
            return {
              failed: true,
              code: "COUNTERFACTUAL_OPPONENT_ACTION_FORBIDDEN",
              message: "单席位规划不得执行其他席位行动",
            };
          }
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
            }, { skipProjection: true })
            : composition.inputPort.submitAction(current, { skipProjection: true });
          timing.executionMilliseconds += now() - executionStartedAt;
          if (!result?.ok) {
            const failure = result?.failure || result?.session?.failure || null;
            return {
              failed: true,
              code: result?.code || failure?.code || "COUNTERFACTUAL_EXECUTION_FAILED",
              message: result?.message || failure?.message || null,
            };
          }
          if (
            secondaryAgentSearch
            && current.family === "end_turn"
            && String(current.actorId || "") === focalSeatId
          ) {
            const advanced = composition.counterfactualPort
              ?.advanceFocalPlanningTurn?.(focalSeatId);
            if (!advanced?.ok) {
              return {
                failed: true,
                code: advanced?.code || "COUNTERFACTUAL_FOCAL_TURN_ADVANCE_FAILED",
                message: advanced?.message || "单席位规划无法进入下一行动",
              };
            }
            if (advanced.advanced) focalPlanningTurnAdvanceCount += 1;
          }
          const nextInspection = composition.inspect();
          const awaitingDecision = nextInspection.phase === "awaiting_input";
          // 信任 enumerateActions 已返回 fresh deepFreeze 结果，不再二次 clone
          // （trusted fork 路径 enumerateActions 内部不做 state clone，返回即冻结；
          //   sanitizeHiddenInformationActions 需要变更时会自行 clone）。
          let successors = awaitingDecision
            ? clone(nextInspection.session?.decision?.choices || [])
            : composition.inputPort.enumerateActions({});
          const hiddenBarrier = isHiddenInformationBarrier(result.irreversibleBarrier)
            ? result.irreversibleBarrier
            : isHiddenInformationBarrier(nextInspection.session?.irreversibleBarrier)
              ? nextInspection.session.irreversibleBarrier
              : null;
          const wasInformationMasked = node.origins.some((origin) => (
            origin.informationMasked
          ));
          const informationMasked = wasInformationMasked || Boolean(hiddenBarrier);
          if (!wasInformationMasked && hiddenBarrier) {
            const code = String(hiddenBarrier.code || "hidden_information");
            hiddenInformationBarrierCountByCode.set(
              code,
              (hiddenInformationBarrierCountByCode.get(code) || 0) + 1,
            );
          }
          if (informationMasked) {
            const filtered = sanitizeHiddenInformationActions(rootObservation, successors);
            successors = filtered.actions;
            hiddenInformationFilteredActionCount += filtered.filteredCount;
          }
          const projectionStartedAt = now();
          const projectedObservation = composition.projection(viewer).state;
          const leafObservation = informationMasked
            ? sanitizeHiddenInformationObservation(
              rootObservation,
              projectedObservation,
              hiddenBarrier,
            )
            : projectedObservation;
          timing.projectionMilliseconds += now() - projectionStartedAt;
          let branchPriority = 0;
          if (typeof evaluateOptions.getBranchPriority === "function") {
            try {
              const measured = evaluateOptions.getBranchPriority({
                rootObservation,
                branchObservation: leafObservation,
                viewer,
                currentAction: clone(current),
                routeTargetIds: [...new Set(node.origins.map((origin) => (
                  origin.routeTargetId || null
                )))],
                routePlanIds: [...new Set(node.origins.map((origin) => (
                  origin.routePlanId || null
                )))],
              });
              branchPriority = Array.isArray(measured?.sortKey)
                ? clone(measured)
                : (Number.isFinite(Number(measured)) ? Number(measured) : 0);
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
            informationMasked,
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

      const usesRootTargetCatalog = secondaryAgentSearch
        && typeof secondaryAgentSearch.selectRootTargets === "function";
      const initialFrontierByKey = new Map();
      for (const action of legalActions) {
        const routeTargets = rootTargetsByActionId.get(action.actionId) || [];
        const selectedTargets = routeTargets.length
          ? routeTargets
          : !usesRootTargetCatalog || ["pass", "end_turn"].includes(action.family)
            ? [{ targetId: null, planId: null }]
            : [];
        for (const routeTarget of selectedTargets) {
          const routeTargetId = routeTarget?.targetId || null;
          const routePlanId = routeTarget?.planId || null;
          const routeResultTargetIds = clone(routeTarget?.resultTargetIds || (
            routeTargetId ? [routeTargetId] : []
          ));
          recordRouteEntry(routeTargetId, routePlanId, saved.envelope);
          recordGoalClusterEntry([[]], routeTargetId);
          mergeNode(initialFrontierByKey, {
            envelope: saved.envelope,
            action,
            depth: 0,
            priority: 0,
            origins: [{
              rootAction: action,
              chain: [],
              routeActions: [],
              targetRouteActions: [],
              checkpoints: [],
              lastProbeAction: null,
              proxyDepth: 0,
              quickTradeCount: 0,
              targetQuickTradeCount: 0,
              opponentProxyDepth: 0,
              focalPassStarted: false,
              goalCompletionPending: false,
              informationMasked: false,
              terminalReason: null,
              routeTargetId,
              routePlanId,
              routeResultTargetIds,
              goalTracePaths: traceGoalClusters ? [[]] : null,
              goalTraceActions: [],
              goalTraceSelections: [],
              rootRouteTargetId: routeTargetId,
              rootRoutePlanId: routePlanId,
              rootRouteResultTargetIds: routeResultTargetIds,
              rootWasConditional: action.phase === "conditional",
            }],
          });
        }
      }
      let frontier = [...initialFrontierByKey.values()];
      const secondaryFrontierByKey = new Map();
      const secondaryFrontierIndexByKey = new Map();
      function swapSecondaryFrontier(leftIndex, rightIndex) {
        const left = frontier[leftIndex];
        frontier[leftIndex] = frontier[rightIndex];
        frontier[rightIndex] = left;
        secondaryFrontierIndexByKey.set(frontier[leftIndex].key, leftIndex);
        secondaryFrontierIndexByKey.set(frontier[rightIndex].key, rightIndex);
      }
      function bubbleSecondaryFrontierUp(startIndex) {
        let index = startIndex;
        while (index > 0) {
          const parent = Math.floor((index - 1) / 2);
          if (compareNodes(frontier[parent], frontier[index]) <= 0) break;
          swapSecondaryFrontier(parent, index);
          index = parent;
        }
        return index;
      }
      function bubbleSecondaryFrontierDown(startIndex) {
        let index = startIndex;
        while (true) {
          const left = index * 2 + 1;
          const right = left + 1;
          let best = index;
          if (left < frontier.length && compareNodes(frontier[left], frontier[best]) < 0) {
            best = left;
          }
          if (right < frontier.length && compareNodes(frontier[right], frontier[best]) < 0) {
            best = right;
          }
          if (best === index) break;
          swapSecondaryFrontier(index, best);
          index = best;
        }
        return index;
      }
      function repairSecondaryFrontier(index) {
        bubbleSecondaryFrontierDown(bubbleSecondaryFrontierUp(index));
      }
      function pushSecondaryFrontier(node) {
        const key = node.key || nodeKey(node);
        const existing = secondaryFrontierByKey.get(key);
        if (existing) {
          mergeNode(secondaryFrontierByKey, node);
          repairSecondaryFrontier(secondaryFrontierIndexByKey.get(key));
          return;
        }
        const retained = { ...node, key };
        secondaryFrontierByKey.set(key, retained);
        frontier.push(retained);
        const index = frontier.length - 1;
        secondaryFrontierIndexByKey.set(key, index);
        bubbleSecondaryFrontierUp(index);
      }
      function popSecondaryFrontier() {
        if (!frontier.length) return null;
        const first = frontier[0];
        const last = frontier.pop();
        secondaryFrontierByKey.delete(first.key);
        secondaryFrontierIndexByKey.delete(first.key);
        if (frontier.length) {
          frontier[0] = last;
          secondaryFrontierIndexByKey.set(last.key, 0);
          bubbleSecondaryFrontierDown(0);
        }
        return first;
      }
      if (secondaryAgentSearch) {
        const initialNodes = frontier;
        frontier = [];
        for (const node of initialNodes) pushSecondaryFrontier(node);
      }
      maxFrontierSize = Math.max(maxFrontierSize, frontier.length);
      maxRetainedFrontierSize = Math.max(maxRetainedFrontierSize, frontier.length);
      maxFrontierOriginCount = Math.max(
        maxFrontierOriginCount,
        frontier.reduce((total, node) => total + node.origins.length, 0),
      );
      function consumesSearchBudget(node) {
        return !secondaryAgentSearch && Boolean(node?.action);
      }

      while (frontier.length && executedNodeCount < maxExecutionNodes) {
        const sorted = secondaryAgentSearch ? null : [...frontier].sort(compareNodes);
        const nextFrontierByKey = new Map();
        const selected = secondaryAgentSearch ? [popSecondaryFrontier()] : sorted;
        for (const node of selected) {
          node.origins = node.origins.filter((origin) => (
            !origin.completionFrontierKey
            || !dominatedCompletionKeys.has(origin.completionFrontierKey)
          ));
          if (!node.origins.length) continue;
          const saturatedOrigins = node.origins.filter((origin) => {
            return !secondaryAgentSearch
              && (leafCountByVirtualRoot.get(virtualRootKey(origin)) || 0) >= maxLeaves;
          });
          if (saturatedOrigins.length) {
            for (const origin of saturatedOrigins) {
              const rootKey = rememberVirtualRoot(origin);
              saturatedOriginCountByVirtualRoot.set(
                rootKey,
                (saturatedOriginCountByVirtualRoot.get(rootKey) || 0) + 1,
              );
              const groups = saturatedRouteGroupsByVirtualRoot.get(rootKey) || new Map();
              const routeFamilies = (origin.routeActions || []).map((action) => action.family);
              const groupKey = stableSerialize({
                routeFamilies,
                pendingActionFamily: node.action.family,
                proxyDepth: origin.proxyDepth || 0,
              });
              const existing = groups.get(groupKey);
              if (existing) {
                existing.originCount += 1;
              } else {
                groups.set(groupKey, {
                  routeFamilies,
                  pendingActionFamily: node.action.family,
                  proxyDepth: origin.proxyDepth || 0,
                  originCount: 1,
                });
              }
              saturatedRouteGroupsByVirtualRoot.set(rootKey, groups);
            }
            markPruned(saturatedOrigins);
          }
          node.origins = node.origins.filter((origin) => !saturatedOrigins.includes(origin));
          if (!node.origins.length) continue;
          if (executedNodeCount >= maxExecutionNodes) {
            markPruned(node.origins);
            continue;
          }
          const budgetedNode = consumesSearchBudget(node);
          if (budgetedNode && expandedSearchNodeCount >= maxNodes) {
            markPruned(node.origins);
            continue;
          }
          const key = node.key || nodeKey(node);
          if (processedNodeKeys.has(key)) {
            transpositionHitCount += 1;
            continue;
          }
          processedNodeKeys.add(key);
          executedNodeCount += 1;
          sharedPhysicalExecutionOriginCount += Math.max(0, node.origins.length - 1);
          if (budgetedNode) expandedSearchNodeCount += 1;
          const execution = executeNode(node);
          if (execution.failed) {
            markFailure(node.origins, execution);
            continue;
          }
          const current = execution.current;
          const currentActorId = String(current.actorId || "");
          executedNodeCountByActor.set(
            currentActorId,
            (executedNodeCountByActor.get(currentActorId) || 0) + 1,
          );
          if (secondaryAgentSearch && currentActorId !== focalSeatId) {
            opponentExecutedNodeCount += 1;
          }
          executedNodeCountByFamily.set(
            current.family,
            (executedNodeCountByFamily.get(current.family) || 0) + 1,
          );
          const decisionKind = `${current.family}:${current.target?.kind || "<none>"}`;
          executedNodeCountByDecisionKind.set(
            decisionKind,
            (executedNodeCountByDecisionKind.get(decisionKind) || 0) + 1,
          );
          const actionSummary = `${current.family}:${current.summary || current.actionId}`;
          executedNodeCountByActionSummary.set(
            actionSummary,
            (executedNodeCountByActionSummary.get(actionSummary) || 0) + 1,
          );
          for (const origin of node.origins) {
            const targetId = origin.routeTargetId || "<unbound>";
            recordGoalClusterExecution(origin.goalTracePaths || [], origin.routeTargetId);
            executedOriginCountByTarget.set(
              targetId,
              (executedOriginCountByTarget.get(targetId) || 0) + 1,
            );
            const targetDecisionKind = `${targetId} -> ${decisionKind}`;
            executedOriginCountByTargetAndDecisionKind.set(
              targetDecisionKind,
              (executedOriginCountByTargetAndDecisionKind.get(targetDecisionKind) || 0) + 1,
            );
          }
          const currentIsFocal = secondaryAgentSearch
            && String(current.actorId) === focalSeatId;
          const currentIsRouteAction = secondaryAgentSearch
            && current.phase !== "conditional"
            && !["end_turn", "pass"].includes(current.family);
          const currentIsGoalTraceAction = traceGoalClusters
            && currentIsFocal
            && !["end_turn", "pass"].includes(current.family);
          const currentCountsSecondaryGoal = currentIsRouteAction
            && (
              typeof secondaryAgentSearch.countsGoal !== "function"
              || secondaryAgentSearch.countsGoal(current)
            );
          const nextProbeAction = ["launch", "move", "orbit", "land"].includes(current.family)
            ? clone(current)
            : null;
          for (const origin of node.origins) {
            origin.informationMasked = Boolean(
              origin.informationMasked || execution.informationMasked,
            );
            if (!origin.rootActionObservation && origin.chain.length === 0) {
              origin.rootActionObservation = execution.leafObservation;
              origin.rootActionLegalSuccessors = execution.successors;
            }
            if (
              !origin.rootActionSettledObservation
              && !execution.awaitingDecision
              && (
                origin.chain.length === 0
                || (
                  origin.chain.length > 0
                  && current.phase === "conditional"
                )
              )
            ) {
              origin.rootActionSettledObservation = execution.leafObservation;
              origin.rootActionSettledLegalSuccessors = execution.successors;
            }
            const nextChain = [...origin.chain, current.actionId];
            const originNextProbeAction = nextProbeAction || origin.lastProbeAction;
            let routeTargetId = origin.routeTargetId || null;
            let routePlanId = origin.routePlanId || null;
            if (
              secondaryAgentSearch
              && !routeTargetId
              && !usesRootTargetCatalog
              && !origin.goalCompletionPending
              && typeof secondaryAgentSearch.selectRouteTarget === "function"
            ) {
              try {
                const selectedRoute = secondaryAgentSearch.selectRouteTarget({
                  focalSeatId,
                  currentAction: current,
                  rootObservation,
                  branchObservation: execution.leafObservation,
                  routeTargetId,
                  routePlanId,
                  focalProxyDepth: origin.proxyDepth,
                  maxProxyDepth,
                }) || null;
                routeTargetId = typeof selectedRoute === "string"
                  ? selectedRoute
                  : selectedRoute?.targetId || null;
                routePlanId = typeof selectedRoute === "string"
                  ? selectedRoute
                  : selectedRoute?.planId || routeTargetId;
              } catch (_error) {
                routeTargetId = origin.routeTargetId || null;
                routePlanId = origin.routePlanId || null;
              }
            }
            const nextQuickTradeCount = Number(origin.quickTradeCount || 0) + (
              currentIsFocal && current.family === "quick_trade" ? 1 : 0
            );
            const nextTargetQuickTradeCount = Number(origin.targetQuickTradeCount || 0) + (
              currentIsFocal && current.family === "quick_trade" ? 1 : 0
            );
            const nextRouteActions = [
              ...(origin.routeActions || []),
              ...(currentIsFocal && currentIsRouteAction ? [{
                actionId: current.actionId,
                family: current.family,
                target: clone(current.target || {}),
                payload: clone(current.payload || {}),
              }] : []),
            ];
            const nextTargetRouteActions = [
              ...(origin.targetRouteActions || []),
              ...(currentIsFocal && currentIsRouteAction ? [{
                actionId: current.actionId,
                family: current.family,
              }] : []),
            ];
            const nextGoalTraceActions = [
              ...(origin.goalTraceActions || []),
              ...(currentIsGoalTraceAction ? [traceAction(current)] : []),
            ];
            const focalPassStarted = origin.focalPassStarted
              || (currentIsFocal && current.family === "pass");
            const currentCompletesRouteTarget = currentIsFocal
              && (
                typeof secondaryAgentSearch.completesRouteTarget === "function"
                  ? secondaryAgentSearch.completesRouteTarget(
                    {
                      action: current,
                      targetId: routeTargetId,
                      planId: routePlanId,
                      focalSeatId,
                      rootObservation,
                      branchObservation: execution.leafObservation,
                    },
                  )
                  : currentCountsSecondaryGoal
              );
            const goalCompletionPending = Boolean(
              origin.goalCompletionPending
              || currentCompletesRouteTarget,
            );
            const completedGoal = Boolean(
              goalCompletionPending
              && !execution.awaitingDecision
            );
            const nextProxyDepth = origin.rootWasConditional
              ? 0
              : origin.proxyDepth + Number(completedGoal);
            let completionFrontierKey = origin.completionFrontierKey || null;
            let nextGoalTraceSelections = origin.goalTraceSelections || [];
            if (completedGoal) {
              completedGoalTransitionCount += 1;
              recordCompletedRoute(
                routeTargetId,
                nextTargetRouteActions,
                nextTargetQuickTradeCount,
                null,
              );
              completedTransitionCountByTarget.set(
                routeTargetId,
                (completedTransitionCountByTarget.get(routeTargetId) || 0) + 1,
              );
              maxCompletedGoalDepth = Math.max(maxCompletedGoalDepth, nextProxyDepth);
              const retained = retainCompletedEndpoint(
                origin,
                execution.leafObservation,
                nextProxyDepth,
                nextChain,
                nextQuickTradeCount,
              );
              recordGoalClusterCompletion(
                origin.goalTracePaths || [],
                routeTargetId,
                nextGoalTraceActions,
                nextTargetQuickTradeCount,
                retained,
              );
              completionFrontierKey = retained.key;
              if (!retained.retained) {
                continue;
              }
              if (traceGoalClusters) {
                nextGoalTraceSelections = [
                  ...nextGoalTraceSelections,
                  {
                    targetId: routeTargetId,
                    actions: nextGoalTraceActions.map(traceAction),
                    quickTradeCount: nextTargetQuickTradeCount,
                  },
                ];
              }
              recordCompletedRoute(
                routeTargetId,
                nextTargetRouteActions,
                nextTargetQuickTradeCount,
                true,
              );
              retainedCompletedTransitionCountByTarget.set(
                routeTargetId,
                (retainedCompletedTransitionCountByTarget.get(routeTargetId) || 0) + 1,
              );
            }
            const nextGoalTracePaths = completedGoal && routeTargetId
              ? (origin.goalTracePaths || []).map((path) => [...path, routeTargetId])
              : (origin.goalTracePaths || []);
            if (
              secondaryAgentSearch
              && origin.rootWasConditional
              && execution.awaitingDecision
            ) {
              addLeaf(
                {
                  ...origin,
                  chain: nextChain,
                  proxyDepth: 0,
                  quickTradeCount: nextQuickTradeCount,
                  routeActions: nextRouteActions,
                  terminalReason: "root-decision-next-boundary",
                },
                execution.leafObservation,
                execution.successors,
                execution.nextInspection,
                origin.checkpoints,
              );
              continue;
            }
            if (
              (
                (secondaryAgentSearch && focalPassStarted)
                || (stopAtPassDecisionBoundary && current.family === "pass")
              )
              && execution.awaitingDecision
            ) {
              if (secondaryAgentSearch) focalPassBoundaryLeafCount += 1;
              addLeaf(
                {
                  ...origin,
                  chain: nextChain,
                  proxyDepth: nextProxyDepth,
                  quickTradeCount: nextQuickTradeCount,
                  routeActions: nextRouteActions,
                  focalPassStarted,
                  terminalReason: "focal-pass-decision-boundary",
                },
                execution.leafObservation,
                [],
                execution.nextInspection,
                origin.checkpoints,
              );
              continue;
            }
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
                  quickTradeCount: nextQuickTradeCount,
                  routeActions: nextRouteActions,
                  focalPassStarted,
                  routeTargetId,
                  routePlanId,
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
              let routeTargetByActionId = new Map();
              let routePlanByActionId = new Map();
              let routeResultsByActionId = new Map();
              if (
                secondaryAgentSearch
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
                    routePlanId,
                    routeResultTargetIds: origin.routeResultTargetIds || [],
                    maxProxyDepth,
                    completeTargetCatalog:
                      secondaryAgentSearch.completeTargetCatalog === true,
                  }) || [];
                } catch (error) {
                  markFailure([origin], {
                    code: error?.code || "COUNTERFACTUAL_ROUTE_SELECTOR_FAILED",
                    message: error?.message || String(error),
                  });
                  continue;
                }
                targetEquivalentChoicePrunedCount += Math.max(
                  0,
                  ...conditionalSuccessors.map((successor) => (
                    Number(successor?.targetEquivalentChoiceCount) || 0
                  )),
                );
                targetSchedulerPrunedCount += Math.max(
                  0,
                  ...conditionalSuccessors.map((successor) => (
                    Number(successor?.targetSchedulerPrunedCount) || 0
                  )),
                );
                const legalById = new Map(execution.successors.map((successor) => [
                  successor.actionId,
                  successor,
                ]));
                routeTargetByActionId = new Map(conditionalSuccessors.map((successor) => [
                  successor?.actionId,
                  Object.hasOwn(successor || {}, "routeTargetId")
                    ? successor.routeTargetId
                    : routeTargetId,
                ]));
                routePlanByActionId = new Map(conditionalSuccessors.map((successor) => [
                  successor?.actionId,
                  Object.hasOwn(successor || {}, "routePlanId")
                    ? successor.routePlanId
                    : routePlanId,
                ]));
                routeResultsByActionId = new Map(conditionalSuccessors.map((successor) => [
                  successor?.actionId,
                  Object.hasOwn(successor || {}, "routeResultTargetIds")
                    ? clone(successor.routeResultTargetIds)
                    : clone(origin.routeResultTargetIds || []),
                ]));
                conditionalSuccessors = conditionalSuccessors
                  .map((successor) => legalById.get(successor?.actionId))
                  .filter(Boolean);
                if (!conditionalSuccessors.length) {
                  unreachableRouteOriginCount += 1;
                  continue;
                }
              }
              for (const successor of conditionalSuccessors) {
                mergeNode(nextFrontierByKey, {
                  envelope: execution.childEnvelope,
                  action: successor,
                  depth: node.depth + 1,
                  priority: execution.branchPriority,
                  semanticMergeEligible: true,
                  origins: [{
                    ...origin,
                    chain: nextChain,
                    lastProbeAction: originNextProbeAction,
                    proxyDepth: nextProxyDepth,
                    quickTradeCount: nextQuickTradeCount,
                    targetQuickTradeCount: nextTargetQuickTradeCount,
                    routeActions: nextRouteActions,
                    targetRouteActions: nextTargetRouteActions,
                    goalTracePaths: nextGoalTracePaths,
                    goalTraceActions: nextGoalTraceActions,
                    goalTraceSelections: nextGoalTraceSelections,
                    focalPassStarted,
                    goalCompletionPending,
                    routeTargetId: secondaryAgentSearch
                      ? routeTargetByActionId.get(successor.actionId)
                      : routeTargetId,
                    routePlanId: secondaryAgentSearch
                      ? routePlanByActionId.get(successor.actionId)
                      : routePlanId,
                    routeResultTargetIds: secondaryAgentSearch
                      ? routeResultsByActionId.get(successor.actionId)
                      : clone(origin.routeResultTargetIds || []),
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
              if (
                origin.rootWasConditional
                && !execution.awaitingDecision
                && ["completed", "idle"].includes(execution.nextInspection.phase)
              ) {
                addLeaf(
                  {
                    ...origin,
                    chain: nextChain,
                    proxyDepth: 0,
                    quickTradeCount: nextQuickTradeCount,
                    routeActions: nextRouteActions,
                    terminalReason: "root-decision-settled",
                  },
                  execution.leafObservation,
                  execution.successors,
                  execution.nextInspection,
                  nextCheckpoints,
                );
                continue;
              }
              if (focalPassStarted) {
                addLeaf(
                  {
                    ...origin,
                    chain: nextChain,
                    proxyDepth: nextProxyDepth,
                    quickTradeCount: nextQuickTradeCount,
                    routeActions: nextRouteActions,
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
                    quickTradeCount: nextQuickTradeCount,
                    routeActions: nextRouteActions,
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
                      : origin.opponentProxyDepth + (currentCountsSecondaryGoal ? 1 : 0),
                    actionChain: nextChain,
                    rolloutVersion: secondaryAgentSearch.rolloutVersion || null,
                    routeTargetId: completedGoal ? null : routeTargetId,
                    routePlanId: completedGoal ? null : routePlanId,
                    routeResultTargetIds: completedGoal
                      ? []
                      : clone(origin.routeResultTargetIds || []),
                    maxProxyDepth,
                    completeTargetCatalog:
                      secondaryAgentSearch.completeTargetCatalog === true,
                  }) || [];
                } catch (error) {
                  markFailure([origin], {
                    code: error?.code || "COUNTERFACTUAL_ROUTE_SELECTOR_FAILED",
                    message: error?.message || String(error),
                  });
                  continue;
                }
                targetSchedulerPrunedCount += Math.max(
                  0,
                  ...selectedSuccessors.map((successor) => (
                    Number(successor?.targetSchedulerPrunedCount) || 0
                  )),
                );
                const legalById = new Map(execution.successors.map((successor) => [
                  successor.actionId,
                  successor,
                ]));
                const selectedRoutes = selectedSuccessors
                  .map((selected) => ({
                    action: legalById.get(selected?.actionId),
                    routeTargetId: Object.hasOwn(selected || {}, "routeTargetId")
                      ? selected.routeTargetId
                      : (completedGoal ? null : routeTargetId),
                    routePlanId: Object.hasOwn(selected || {}, "routePlanId")
                      ? selected.routePlanId
                      : (completedGoal ? null : routePlanId),
                    routeResultTargetIds: Object.hasOwn(selected || {}, "routeResultTargetIds")
                      ? clone(selected.routeResultTargetIds)
                      : (
                        completedGoal
                          ? []
                          : clone(origin.routeResultTargetIds || [])
                      ),
                  }))
                  .filter((route) => Boolean(route.action));
                if (!selectedRoutes.length) {
                  unreachableRouteOriginCount += 1;
                  continue;
                }
                if (selectedRoutes.some((route) => (
                  String(route.action.actorId) === focalSeatId
                ))) {
                  addFrontierLeaf(
                    {
                      ...origin,
                      chain: nextChain,
                      proxyDepth: nextProxyDepth,
                      quickTradeCount: nextQuickTradeCount,
                      targetQuickTradeCount: completedGoal
                        ? 0
                        : nextTargetQuickTradeCount,
                      routeActions: nextRouteActions,
                      targetRouteActions: completedGoal
                        ? []
                        : nextTargetRouteActions,
                      routeTargetId: completedGoal ? null : routeTargetId,
                      routePlanId: completedGoal ? null : routePlanId,
                      routeResultTargetIds: completedGoal
                        ? []
                        : clone(origin.routeResultTargetIds || []),
                    },
                    execution.leafObservation,
                    execution.successors,
                    execution.nextInspection,
                    nextCheckpoints,
                  );
                }
                const nextActorIsFocal = selectedRoutes.some((route) => (
                  String(route.action.actorId) === focalSeatId
                ));
                if (completedGoal && nextActorIsFocal) {
                  recordGoalClusterChildren(nextGoalTracePaths, selectedRoutes);
                }
                for (const selectedRoute of selectedRoutes) {
                  const successor = selectedRoute.action;
                  if (completedGoal && nextActorIsFocal) {
                    recordRouteEntry(
                      selectedRoute.routeTargetId,
                      selectedRoute.routePlanId,
                      execution.childEnvelope,
                    );
                  }
                  mergeNode(nextFrontierByKey, {
                    envelope: execution.childEnvelope,
                    action: successor,
                    depth: 0,
                    priority: execution.branchPriority,
                    semanticMergeEligible: current.phase === "conditional",
                    origins: [{
                      ...origin,
                      chain: nextChain,
                      checkpoints: nextCheckpoints,
                      lastProbeAction: originNextProbeAction,
                      proxyDepth: nextProxyDepth,
                      quickTradeCount: nextQuickTradeCount,
                      targetQuickTradeCount: completedGoal && nextActorIsFocal
                        ? 0
                        : nextTargetQuickTradeCount,
                      routeActions: nextRouteActions,
                      targetRouteActions: completedGoal && nextActorIsFocal
                        ? []
                        : nextTargetRouteActions,
                      goalTracePaths: nextGoalTracePaths,
                      goalTraceActions: completedGoal && nextActorIsFocal
                        ? []
                        : nextGoalTraceActions,
                      goalTraceSelections: nextGoalTraceSelections,
                      opponentProxyDepth: nextActorIsFocal
                        ? 0
                        : (
                          currentIsFocal || current.family === "end_turn"
                            ? 0
                            : origin.opponentProxyDepth + (currentCountsSecondaryGoal ? 1 : 0)
                      ),
                      focalPassStarted,
                      goalCompletionPending: nextActorIsFocal
                        ? false
                        : (completedGoal ? false : goalCompletionPending),
                      routeTargetId: nextActorIsFocal
                        ? selectedRoute.routeTargetId
                        : routeTargetId,
                      routePlanId: nextActorIsFocal
                        ? selectedRoute.routePlanId
                        : routePlanId,
                      routeResultTargetIds: nextActorIsFocal
                        ? selectedRoute.routeResultTargetIds
                        : clone(origin.routeResultTargetIds || []),
                      completionFrontierKey,
                    }],
                  });
                }
                continue;
              }
            }
            addLeaf(
              {
                ...origin,
                chain: nextChain,
                proxyDepth: nextProxyDepth,
                quickTradeCount: nextQuickTradeCount,
                routeActions: nextRouteActions,
                focalPassStarted,
              },
              execution.leafObservation,
              execution.successors,
              execution.nextInspection,
              nextCheckpoints,
            );
          }
        }
        const frontierStartedAt = now();
        const nextFrontier = pruneResourceDominatedOrigins(
          [...nextFrontierByKey.values()],
        );
        if (secondaryAgentSearch) {
          for (const nextNode of nextFrontier) pushSecondaryFrontier(nextNode);
        } else {
          frontier = retainRootFairBeam(nextFrontier);
        }
        maxFrontierSize = Math.max(maxFrontierSize, frontier.length);
        maxFrontierOriginCount = Math.max(
          maxFrontierOriginCount,
          frontier.reduce((total, node) => total + node.origins.length, 0),
        );
        maxRetainedFrontierSize = Math.max(maxRetainedFrontierSize, frontier.length);
        timing.frontierMilliseconds += now() - frontierStartedAt;
      }
      const remainingFrontierNodeCount = frontier.length;
      const remainingFrontierOriginCountByGoalDepth = {};
      for (const node of frontier) {
        for (const origin of node.origins) {
          const depth = String(Number(origin.proxyDepth) || 0);
          remainingFrontierOriginCountByGoalDepth[depth] = (
            remainingFrontierOriginCountByGoalDepth[depth] || 0
          ) + 1;
        }
      }
      const executionLimitReached = (
        executedNodeCount >= maxExecutionNodes
        && remainingFrontierNodeCount > 0
      );
      for (const node of frontier) markPruned(node.origins);

      const outcomes = [...outcomeStateByActionId.values()].map((state) => {
        const failure = state.failures[0] || null;
        const allLeaves = secondaryAgentSearch
          ? [...state.leaves]
          : [...state.leaves, ...state.frontierLeaves];
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
        expandedSearchNodeCount,
        maxNodes,
        maxExecutionNodes,
        executionLimitReached,
        remainingFrontierNodeCount,
        remainingFrontierOriginCountByGoalDepth,
        maxDepth,
        maxProxyDepth: secondaryAgentSearch ? maxProxyDepth : null,
        secondaryAgentSearch: Boolean(secondaryAgentSearch),
        rootTargetCount: [...rootTargetsByActionId.values()]
          .reduce((total, targetIds) => total + targetIds.length, 0),
        rolloutVersion: secondaryAgentSearch?.rolloutVersion || null,
        maxFrontierPerRoot,
        maxFrontierSize,
        maxRetainedFrontierSize,
        maxFrontierOriginCount,
        transpositionHitCount,
        sharedPhysicalExecutionOriginCount,
        conditionalEquivalentMergeCount,
        resourceDominatedOriginCount,
        completionDominatedOriginCount,
        completionDominatedOriginCountByTarget: Object.fromEntries(
          [...completionDominatedOriginCountByTarget.entries()].sort((left, right) => (
            right[1] - left[1] || String(left[0]).localeCompare(String(right[0]))
          )),
        ),
        targetEquivalentChoicePrunedCount,
        targetSchedulerPrunedCount,
        unreachableRouteOriginCount,
        completedGoalTransitionCount,
        maxCompletedGoalDepth,
        opponentExecutedNodeCount,
        focalPlanningTurnAdvanceCount,
        focalPassBoundaryLeafCount,
        hiddenInformationFilteredActionCount,
        hiddenInformationBarrierCountByCode: Object.fromEntries(
          [...hiddenInformationBarrierCountByCode.entries()].sort(([left], [right]) => (
            String(left).localeCompare(String(right))
          )),
        ),
        executedNodeCountByFamily: Object.fromEntries(
          [...executedNodeCountByFamily.entries()].sort(([left], [right]) => (
            String(left).localeCompare(String(right))
          )),
        ),
        executedNodeCountByDecisionKind: Object.fromEntries(
          [...executedNodeCountByDecisionKind.entries()].sort(([left], [right]) => (
            String(left).localeCompare(String(right))
          )),
        ),
        executedNodeCountByActionSummary: Object.fromEntries(
          [...executedNodeCountByActionSummary.entries()].sort((left, right) => (
            right[1] - left[1] || String(left[0]).localeCompare(String(right[0]))
          )),
        ),
        executedNodeCountByActor: Object.fromEntries(
          [...executedNodeCountByActor.entries()].sort(([left], [right]) => (
            String(left).localeCompare(String(right))
          )),
        ),
        executedOriginCountByTarget: Object.fromEntries(
          [...executedOriginCountByTarget.entries()].sort((left, right) => (
            right[1] - left[1] || String(left[0]).localeCompare(String(right[0]))
          )),
        ),
        executedOriginCountByTargetAndDecisionKind: Object.fromEntries(
          [...executedOriginCountByTargetAndDecisionKind.entries()].sort((left, right) => (
            right[1] - left[1] || String(left[0]).localeCompare(String(right[0]))
          )),
        ),
        routeEntryStatsByTarget: Object.fromEntries(
          [...routeEntryStatsByTarget.entries()]
            .map(([targetId, stats]) => [targetId, {
              bindingOriginCount: stats.bindingOriginCount,
              distinctEntryStateCount: stats.entries.size,
              maxBindingsPerEntryState: Math.max(0, ...stats.entries.values()),
              completedTransitionCount: completedTransitionCountByTarget.get(targetId) || 0,
              retainedCompletedTransitionCount:
                retainedCompletedTransitionCountByTarget.get(targetId) || 0,
            }])
            .sort((left, right) => (
              right[1].bindingOriginCount - left[1].bindingOriginCount
              || String(left[0]).localeCompare(String(right[0]))
            )),
        ),
        completedRouteGroupsByTarget: Object.fromEntries(
          [...completedRouteGroupsByTarget.entries()]
            .map(([targetId, groups]) => [targetId, [...groups.values()]
              .sort((left, right) => (
                right.completedTransitionCount - left.completedTransitionCount
                || left.quickTradeCount - right.quickTradeCount
                || String(left.routeFamilies.join(":"))
                  .localeCompare(String(right.routeFamilies.join(":")))
              ))])
            .sort((left, right) => (
              right[1].reduce((total, group) => (
                total + group.completedTransitionCount
              ), 0)
              - left[1].reduce((total, group) => (
                total + group.completedTransitionCount
              ), 0)
              || String(left[0]).localeCompare(String(right[0]))
            )),
        ),
        goalClusters: traceGoalClusters
          ? [...goalClusterTraceByPath.values()]
            .map((cluster) => ({
              depth: cluster.depth,
              path: clone(cluster.path),
              parentPath: clone(cluster.parentPath),
              targetId: cluster.targetId,
              entryCount: cluster.entryCount,
              firstExecutionOrder: cluster.firstExecutionOrder,
              executedOriginCount: cluster.executedOriginCount,
              completedTransitionCount: cluster.completedTransitionCount,
              survivingCompletionCount: cluster.survivingCompletionCount,
              routeVariants: [...cluster.routeVariants.values()]
                .map((variant) => ({
                  actions: clone(variant.actions),
                  quickTradeCount: variant.quickTradeCount,
                  completedTransitionCount: variant.completedTransitionCount,
                  survivingCompletionCount: variant.survivingCompletionCount,
                }))
                .sort((left, right) => (
                  right.survivingCompletionCount - left.survivingCompletionCount
                  || right.completedTransitionCount - left.completedTransitionCount
                  || left.quickTradeCount - right.quickTradeCount
                  || stableSerialize(left.actions).localeCompare(stableSerialize(right.actions))
                )),
              childTargets: [...cluster.childTargets.entries()]
                .map(([targetId, entryCount]) => ({ targetId, entryCount }))
                .sort((left, right) => (
                  right.entryCount - left.entryCount
                  || left.targetId.localeCompare(right.targetId)
                )),
            }))
            .sort((left, right) => (
              (left.firstExecutionOrder ?? Number.MAX_SAFE_INTEGER)
                - (right.firstExecutionOrder ?? Number.MAX_SAFE_INTEGER)
              || left.depth - right.depth
              || stableSerialize(left.path).localeCompare(stableSerialize(right.path))
            ))
          : [],
        saturatedVirtualRoots: [...saturatedOriginCountByVirtualRoot.entries()]
          .map(([key, saturatedOriginCount]) => ({
            ...virtualRootDescriptionByKey.get(key),
            retainedLeafCount: leafCountByVirtualRoot.get(key) || 0,
            saturatedOriginCount,
            saturatedRouteGroups: [
              ...(saturatedRouteGroupsByVirtualRoot.get(key)?.values() || []),
            ]
              .sort((left, right) => (
                right.originCount - left.originCount
                || left.proxyDepth - right.proxyDepth
                || String(left.routeFamilies.join(":")).localeCompare(
                  String(right.routeFamilies.join(":")),
                )
                || String(left.pendingActionFamily).localeCompare(right.pendingActionFamily)
              )),
          }))
          .sort((left, right) => (
            right.saturatedOriginCount - left.saturatedOriginCount
            || String(left.rootActionId).localeCompare(String(right.rootActionId))
            || String(left.rootRouteTargetId || "").localeCompare(
              String(right.rootRouteTargetId || ""),
            )
            || String(left.rootRoutePlanId || "").localeCompare(
              String(right.rootRoutePlanId || ""),
            )
          )),
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
      ...(options.allowTrustedForkLifecycle === true
        ? { advanceFocalPlanningTurn }
        : {}),
    });

    const stateSourcePort = Object.freeze({
        getSnapshot: () => clone(readStoreSnapshot()),
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
          const state = activeSession ? activeSession.workingState : readStoreSnapshot();
          return deepFreeze(clone(reader(state, {
            phase: activeSession?.phase || "idle",
            stateVersion: readStoreSnapshot().meta.stateVersion,
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
