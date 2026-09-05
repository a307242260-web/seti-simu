(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof module === "undefined") root.SetiRuleComposition = api;})(typeof globalThis !== "undefined" ? globalThis : window, function () {
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
    // 性能：与递归 map/join 版输出逐字节相同（键排序语义不变），但避免每层
    // 临时数组分配，实测快 ~20%；序列化输出是 envelope/hash 的字节输入，
    // 格式不得变更（canonicalEnvelopeHash 耦合 fork RNG 种子）。
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) {
      let out = "[";
      for (let index = 0; index < value.length; index += 1) {
        if (index) out += ",";
        out += stableSerialize(value[index]);
      }
      return out + "]";
    }
    const keys = Object.keys(value).sort();
    let out = "{";
    for (let index = 0; index < keys.length; index += 1) {
      if (index) out += ",";
      out += JSON.stringify(keys[index]) + ":" + stableSerialize(value[keys[index]]);
    }
    return out + "}";
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
    // 输入可能来自 deepFrozen 观测（sanitize 浅重建路径共享），不可原地修改：
    // 只在真正过滤掉条目时浅重建对象。
    if (!requirements || !Array.isArray(requirements[listKey])) return requirements;
    const filtered = requirements[listKey].filter((entry) => (
      !containsUnknownCardReference(entry, knownCardIds)
    ));
    if (filtered.length === requirements[listKey].length) return requirements;
    return { ...requirements, [listKey]: filtered };
  }

  function maskTechSupplyStacks(techSupply, rootStacks) {
    if (!techSupply || typeof techSupply !== "object") return techSupply;
    const stacks = techSupply.stacks || {};
    let changed = false;
    const masked = {};
    for (const [tileId, stack] of Object.entries(stacks)) {
      if (stack?.bonusId === rootStacks[tileId]?.bonusId) {
        masked[tileId] = stack;
        continue;
      }
      masked[tileId] = { ...stack, bonusId: null, bonusHidden: true };
      changed = true;
    }
    return changed ? { ...techSupply, stacks: masked } : techSupply;
  }

  function maskAlienSlots(aliens, rootSlots) {
    if (!aliens || typeof aliens !== "object") return aliens;
    const slots = aliens.slots || [];
    let changed = false;
    const masked = slots.map((slot, index) => {
      if (rootSlots[index]?.revealed || !slot?.revealed) return slot;
      changed = true;
      return { ...slot, revealed: false, alienId: null };
    });
    return changed ? { ...aliens, slots: masked } : aliens;
  }

  function sanitizeHiddenInformationObservation(rootObservation, leafObservation, barrier) {
    // 只浅重建被遮蔽的部分（publicCards/techSupply/aliens/selfState 手牌/requirements），
    // 其余字段与 deepFrozen 的 leafObservation 共享（只读安全），不再整棵深克隆。
    if (!leafObservation || typeof leafObservation !== "object") return leafObservation;
    const rootBoard = rootObservation?.publicState?.board || {};
    const knownCardIds = collectKnownCardIds(rootObservation);
    const board = leafObservation.publicState?.board || null;
    const sanitized = {
      ...leafObservation,
      publicState: leafObservation.publicState ? {
        ...leafObservation.publicState,
        pending: null,
        ...(board ? {
          board: {
            ...board,
            publicCards: maskUnknownCards(board.publicCards, knownCardIds),
            techSupply: maskTechSupplyStacks(
              board.techSupply,
              rootBoard.techSupply?.stacks || {},
            ),
            aliens: maskAlienSlots(board.aliens, rootBoard.aliens?.slots || []),
          },
        } : {}),
      } : null,
      decision: null,
      informationBoundary: { code: barrier?.code || "hidden_information" },
    };
    const self = leafObservation.selfState || null;
    if (self) {
      sanitized.selfState = {
        ...self,
        hand: maskUnknownCards(self.hand, knownCardIds),
        reservedCards: maskUnknownCards(self.reservedCards, knownCardIds),
        privateAlienCards: maskUnknownCards(self.privateAlienCards, knownCardIds),
      };
    }
    sanitized.probeRouteRequirements = sanitizeRequirementPlans(
      leafObservation.probeRouteRequirements,
      knownCardIds,
      "candidates",
    );
    sanitized.dataAnalyzeRequirements = sanitizeRequirementPlans(
      leafObservation.dataAnalyzeRequirements,
      knownCardIds,
      "acquisitionPlans",
    );
    sanitized.incomeGainRequirements = sanitizeRequirementPlans(
      leafObservation.incomeGainRequirements,
      knownCardIds,
      "plans",
    );
    sanitized.techGainRequirements = sanitizeRequirementPlans(
      leafObservation.techGainRequirements,
      knownCardIds,
      "plans",
    );
    sanitized.sectorWinRequirements = sanitizeRequirementPlans(
      leafObservation.sectorWinRequirements,
      knownCardIds,
      "accessSources",
    );
    const rootStandardScan = (rootObservation?.sectorWinRequirements?.accessSources || [])
      .find((source) => source?.sourceId === "standard-scan");
    const leafStandardScan = (sanitized.sectorWinRequirements?.accessSources || [])
      .find((source) => source?.sourceId === "standard-scan");
    if (rootStandardScan && leafStandardScan) {
      // 共享冻结观测时 entry 不可原地改 sectorIds，浅重建该 entry
      const sectorIds = clone(rootStandardScan.sectorIds || []);
      sanitized.sectorWinRequirements = {
        ...(sanitized.sectorWinRequirements || {}),
        accessSources: (sanitized.sectorWinRequirements?.accessSources || [])
          .map((source) => (source === leafStandardScan
            ? { ...source, sectorIds }
            : source)),
      };
    }
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
      const clonedResult = clone(result);
      lastActionResult = clonedResult;
      return { ...clonedResult, nextState };
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
            // 性能：transformEffectResult（production 唯一实现 augmentEffectResult）只
            // 原地增补 result 并返回新外壳对象，nextState 恒为同一引用——此前每 effect
            // 执行都整状态 structuredClone（单决策 ~3552 次，实测 ~600ms/11% + GC 压力）。
            // nextState 同引用时直接复用：applyResult 在 trusted fork 下本就直接采用
            // result.nextState（非 trusted 也会再 cloneState），语义不变；仅当 transform
            // 真的产出新状态对象时才防御性克隆。
            const nextState = transformed.nextState || result.nextState;
            return {
              ...transformed,
              nextState: nextState === result.nextState ? nextState : clone(nextState),
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
        // trusted fork 的 readStoreSnapshot 已返回冻结 committed state，直接引用即可
        // （projectState 的 spread 新建对象，嵌套引用为冻结只读）；非 trusted 保留克隆隔离。
        options.allowTrustedForkLifecycle === true ? state : clone(state),
        clone(viewer),
        null,
        { stateVersion: state.meta.stateVersion },
      );
      // 搜索中间观测（cheap）只读且不跨节点持有：跳过 deepFreeze 整树遍历，
      // 完整冻结观测只在叶/根/宿主路径构建。
      if (viewer?.cheap === true) {
        return { phase: "idle", stateVersion: state.meta.stateVersion, state: projected };
      }
      return deepFreeze({ phase: "idle", stateVersion: state.meta.stateVersion, state: projected });
    }

    function projection(viewer = null) {
      return projectionInner(viewer);
    }

    function projectionInner(viewer = null) {
      if (!activeSession) return committedProjection(viewer);
      const observed = {
        ...runtime.observe(activeSession, clone(viewer), {
          // 搜索中间观测不消费 decision 字段（选择枚举见后提交 inspect），跳过重复枚举。
          skipDecisionChoices: viewer?.cheap === true,
        }),
        stateVersion: readStoreSnapshot().meta.stateVersion,
      };
      // 同上：cheap 中间观测跳过 deepFreeze，叶/根/宿主仍走冻结完整观测。
      return viewer?.cheap === true ? observed : deepFreeze(observed);
    }

    function inspect(skipChoices = false) {
      return deepFreeze({
        phase: activeSession?.phase || "idle",
        family: activeFamily,
        session: activeSession
          ? runtime.inspect(activeSession, { skipChoices: skipChoices === true })
          : null,
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
        options.allowTrustedForkLifecycle === true ? state : clone(state),
      );
      const actions = runWithWorkingStateContext(
        workingContext,
        () => actionRegistry.enumerate(workingContext, clone(request)),
      ) || [];
      // trusted fork 搜索路径：描述符由 enumerate 每次新建、搜索只读（spread/过滤均新建，
      // sanitize 需要变更时自行克隆），跳过 deepFreeze 省每节点整组冻结开销；
      // 非 trusted（Browser/宿主）路径保持 deepFreeze(clone(...)) 的安全隔离。
      return options.allowTrustedForkLifecycle === true
        ? actions
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
      // 当前 fork 的 composition（搜索循环每次 fork 更新时同步维护）：fullLeafObservation
      // 需要从 fork 当前（分支）状态重建完整叶观测——闭包层的 projection(viewer) 投影的
      // 是 root 状态，不是分支状态。
      let activeForkComposition = null;
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
            sessionHash: sessionKeyHash(envelope.session),
          }));
        }
        return envelopeHashByObject.get(envelope);
      }
      // session 键哈希：排除 baseState/committedState/commitResult（trusted fork 下与
      // envelope 的 committedState 同一对象，其哈希已由 committedStateHash 覆盖；
      // awaiting session 的 committedState/commitResult 恒为 null）。排除后哈希保持
      // 注入性：同 committedStateHash 且同剩余 session 内容 ⇔ 同完整 session，转置合并
      // 关系不变，只是省去每节点对全量状态的二次序列化（决策 232 实测 ~1400ms → ~700ms）。
      function sessionKeyHash(checkpoint) {
        if (checkpoint == null) return stableHash(null);
        const session = checkpoint.session || null;
        return stableHash({
          schemaVersion: checkpoint.schemaVersion,
          replayCursor: checkpoint.replayCursor,
          session: session == null ? null : {
            ...session,
            baseState: null,
            committedState: null,
            commitResult: null,
          },
        });
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
            rngState: null,
            sequences: null,
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
        const normalizedMeta = {
          ...state.meta,
          rngState: null,
          sequences: null,
          stateVersion: 0,
        };
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
      const processedOriginKeys = new Set();
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
        // settled（无 session）节点用语义键：mask meta 的 rngState/sequences/stateVersion
        // 与 match.decisionVersion 后，合并"先发射再扫描 vs 先扫描再发射"这类置换等价
        // 状态（cap frontier 36% 是 meta-only 雷同）。session 节点（awaiting）保持精确键
        // （pending 决策不同不可合并）。
        if (secondaryAgentSearch && node.envelope?.session == null) {
          const semanticStateHash = settledSemanticStateHash(node.envelope);
          if (semanticStateHash) {
            return [
              "semantic",
              semanticStateHash,
              semanticActionHash(node.action),
              Math.max(0, maxDepth - node.depth),
              focalSeatId,
            ].join(":");
          }
        }
        return exactNodeKey(node.envelope, node.action, node.depth);
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
        // 新估值依赖来源、槽位及研究机会；不同上下文不能用总资源替代。
        if (stableSerialize(left.facts.valuationContext)
          !== stableSerialize(right.facts.valuationContext)) return false;
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

      function fullLeafObservation(origin, fallback) {
        // 叶观测必须完整（评估器读 aliens/rockets、报告 winning state 读完整 board）；
        // 中间观测是 cheap，这里从 fork 当前（分支）状态重建完整观测并按需遮蔽。
        // 错误必须暴露（AGENTS.md 硬规矩）：重建失败若静默回退到 cheap/缺字段观测，
        // 评估器会拿坏输入算分导致 AI 失真长期潜伏——此处显式抛错并带出 origin 上下文。
        // 修复：旧代码误写 composition.projection(viewer)（本闭包层 composition 未定义，
        // 每次抛 ReferenceError 被旧 catch 静默吞掉 → 叶观测恒为中间观测 fallback）；
        // 当前 fork 的 composition 由搜索循环维护为 activeForkComposition（闭包层的
        // projection(viewer) 投影的是 root 状态，不是分支状态，不可用于叶重建）。
        if (!activeForkComposition?.projection) {
          throw new Error(
            `COUNTERFACTUAL_LEAF_OBSERVATION_FAILED: 无可用 fork composition（root=${origin.rootAction?.actionId || ""} chain=${(origin.chain || []).join("→")}）`,
          );
        }
        const fullProjection = activeForkComposition.projection(viewer).state;
        return origin.informationMasked
          ? sanitizeHiddenInformationObservation(
            rootObservation,
            fullProjection,
            origin.informationBarrier || null,
          )
          : fullProjection;
      }

      function addLeaf(origin, leafObservation, successors, nextInspection, nextCheckpoints) {
        const state = outcomeStateByActionId.get(origin.rootAction.actionId);
        const rootKey = virtualRootKey(origin);
        const leafCount = leafCountByVirtualRoot.get(rootKey) || 0;
        if (!state || (!secondaryAgentSearch && leafCount >= maxLeaves)) {
          if (state) state.pruned = true;
          return;
        }
        // 继续搜索中的完成目标结果不是停止路线叶；保留它不能提前触发既有饱和裁剪。
        if (!(secondaryAgentSearch && origin.terminalReason === "goal-completed")) {
          leafCountByVirtualRoot.set(rootKey, leafCount + 1);
        }
        const fullObservation = fullLeafObservation(origin, leafObservation);
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
          executionStepCount: origin.executionStepCount || 0,
          observation: secondaryAgentSearch
            ? fullObservation
            : clone(fullObservation),
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
        const fullObservation = fullLeafObservation(origin, leafObservation);
        const leaf = {
          leafId: `frontier:${stableHash(origin.chain)}`,
          status: "search_frontier",
          actionChain: origin.chain,
          executionStepCount: origin.executionStepCount || 0,
          observation: fullObservation,
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
          activeForkComposition = composition;
          if (reusableFork) {
            // 分支 RNG 必须始终重置到本 (envelope,action) 的种子（链上的精选/补牌消耗随机）。
            reusableFork.resetBranch?.(branchIdentity);
            // 宏步优化：若 fork 已精确处于 node.envelope 对应的状态（同引用，来自上一步
            // childEnvelope）且上一步未等待输入（确定性链继续），跳过 restore/deserialize；
            // 状态与 session 完全一致时恢复是无操作，省去每步全量反序列化。
            const forkAlreadyAtState = (
              node.envelope === lastForkEnvelope
              && lastExecutionAwaitingDecision === false
            );
            if (!forkAlreadyAtState) {
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
          }
          timing.forkMilliseconds += now() - forkStartedAt;
          if (!composition?.inputPort || !composition?.inspect || !composition?.lifecycle) {
            return { failed: true, code: "COUNTERFACTUAL_FORK_INVALID" };
          }
          // 前提交枚举不可跳过：submitDecision 用 stableSerialize(choice) 全等比对
          // session 的 raw choice，而 node.action 是 normalizeDescriptor 标准描述符
          // （含 schemaVersion/stateVersion 等额外字段），必须从当前 session 的
          // decision.choices 里取回 raw choice 才能提交（root conditional 尤其如此）。
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
              // 回合末结算链（final_scoring:milestone → FINAL_MARK 等）尚未排空时
              // 立即推进必然失败。这不是分支失败：真实游戏会先解析完终局标记等
              // 决策再进入下一回合。这里标记延迟推进，待会话排空后再推进（见下方
              // pendingFocalAdvance 处理），避免「刚跨过里程碑的回合」被误杀。
              if (advanced?.code === "COUNTERFACTUAL_FOCAL_TURN_SESSION_PENDING") {
                for (const origin of node.origins) origin.pendingFocalAdvance = true;
              } else {
                return {
                  failed: true,
                  code: advanced?.code || "COUNTERFACTUAL_FOCAL_TURN_ADVANCE_FAILED",
                  message: advanced?.message || "单席位规划无法进入下一行动",
                };
              }
            } else if (advanced.advanced) {
              focalPlanningTurnAdvanceCount += 1;
            }
          }
          // 2026-08-18（用户指导"一个行动包括所有的 target 选择完毕算一个节点"）：
          // 结算链排空——主行动（launch/play_card/scan 等）提交后可能进入一串
          // **纯结算决策**（弃牌/支付/交易选牌等，任意选择等价或由规则强制），
          // 此前每个都展开成独立节点（choose_payment 占单决策节点大头），节点
          // 爆炸 → 暴力搜索搜不完 → 僵局。这里在**同一节点内**连续执行纯结算
          // 决策到"下一个主行动决策"或"策略级选择"边界，整链只算 1 个节点。
          // 策略级决策（探测目标/科技/外星痕迹位置等价值相关 choose_target /
          // choose_card）**不折叠**（折叠会断链——协调器路径 rootObservation 缺
          // requirements 无法选最优），保持展开让价值进入搜索。
          let drainGuard = 0;
          let executionStepCount = 1; // 当前节点已成功提交的根动作/决策。
          // 折叠结算链中产生的隐藏信息 barrier（公共牌翻出等）——折叠提交也必须
          // 建立 mask，不能因节点折叠泄漏新翻出的牌身份。
          let drainHiddenBarrier = null;
          while (drainGuard < 32) {
            const drainInspection = composition.inspect();
            if (drainInspection.phase !== "awaiting_input" || !drainInspection.session?.decision) break;
            const drainChoices = drainInspection.session.decision.choices || [];
            if (!drainChoices.length) break;
            // 可排空 = 正式弃牌代表路线、唯一支付/交易选牌项与计算机唯一选位。
            // 多个不同费用或牌身份的选择必须回到selector，不能在此固定取首项。
            // + **放置数据选位**（choose_target:computer"第一排放置位"= 规则强制的
            // 从左到右下一空位，唯一合法选项——2026-08-21 用户裁定：place_data 是
            // 快速行动，从 0 填到收入直接连续填 4 个数据，不需要占据 4 个节点，
            // 选位折叠进 place_data 节点）。
            // 策略级选择（探测目标/科技/外星痕迹位置等多选一 choose_target/
            // choose_card）**不折叠**——折叠会断链（协调器路径 rootObservation 缺
            // requirements，selectSuccessors 无法选最优 → 效果结算无叶 → unresolved）。
            const drainable = drainChoices.length > 0 && drainChoices.every((choice) => (
              (choice.family === "choose_payment" && (
                drainChoices.length === 1
                || ["discard-hand-card", "confirm"].includes(choice.target?.kind)
              ))
              || (
                choice.family === "choose_card"
                && choice.target?.kind === "trade-card-selection"
                && drainChoices.length === 1
              )
              || (
                // 放置数据第一排放置位：唯一合法选项（规则强制），折叠。
                choice.family === "choose_target"
                && choice.target?.target === "computer"
                && choice.target?.choiceId === "data:computer"
              )
            ));
            if (!drainable) break;
            const discardCards = drainChoices.filter((choice) => (
              choice.family === "choose_payment" && choice.target?.kind === "discard-hand-card"
            ));
            const confirm = drainChoices.find((choice) => (
              choice.family === "choose_payment" && choice.target?.kind === "confirm"
            ));
            let settleChoice = null;
            if (discardCards.length && confirm) {
              // 正式选择状态由当前Effect持有；每次点选会生成新的DecisionEffect，
              // 不能按decisionId另存已选集合，也不能硬编码弃牌数量。
              const pending = drainInspection.session.currentEffect?.payload?.decisionContext;
              if (pending?.kind !== "discard" || !Array.isArray(pending.selected)
                || !Number.isInteger(pending.count) || pending.count < 1) {
                return { failed: true, code: "COUNTERFACTUAL_DISCARD_CONTEXT_INVALID",
                  message: "弃牌结算缺少正式数量或已选牌状态" };
              }
              const selected = new Set(pending.selected.map(String));
              if (selected.size === pending.count) {
                settleChoice = confirm;
              } else {
                settleChoice = discardCards.find((c) => (
                  !selected.has(String(c.target?.cardInstanceId || ""))
                ));
                if (!settleChoice || selected.size > pending.count) {
                  return { failed: true, code: "COUNTERFACTUAL_DISCARD_SELECTION_INVALID",
                    message: "正式弃牌状态与可选手牌不一致" };
                }
              }
            } else {
              settleChoice = drainChoices[0];
            }
            const settleResult = composition.inputPort.submitDecision({
              decisionId: drainInspection.session.decision.decisionId,
              decisionVersion: drainInspection.session.decision.decisionVersion,
              ownerId: drainInspection.session.decision.ownerId,
              choice: settleChoice,
            }, { skipProjection: true });
            if (!settleResult?.ok) {
              // 结算失败 = 规则异常，显式暴露（不静默）
              return {
                failed: true,
                code: settleResult?.code || "COUNTERFACTUAL_SETTLEMENT_FAILED",
                message: settleResult?.message || `结算决策失败: ${settleChoice?.family}`,
              };
            }
            // 折叠提交后的 hidden barrier（公共牌翻出等）必须捕获——折叠不泄漏信息。
            executionStepCount += 1;
            if (!drainHiddenBarrier) {
              const drainAfter = composition.inspect();
              const barrier = settleResult?.irreversibleBarrier
                || drainAfter?.session?.irreversibleBarrier
                || null;
              if (isHiddenInformationBarrier(barrier)) {
                drainHiddenBarrier = barrier;
              }
            }
            // 连续填数据（2026-08-21 用户裁定：place_data 是快速行动，从 0 填到
            // 收入直接连续填 4 个数据，不需要占据 4 个节点）：**仅当本节点是
            // place_data**（或刚折叠了它的选位）时，选位折叠提交后若仍可继续填
            // （数据池有数据 + 计算机第一排有剩余槽位，且本回合未 PASS），提交
            // 下一个 place_data 快速行动，下一轮循环处理其选位——整条"填数据→
            // 选位→填数据→选位"链在同一节点内连续执行，只算 1 个节点。
            if (node.action?.family === "place_data") {
              const afterInspection = composition.inspect();
              if (afterInspection.phase !== "awaiting_input") {
                const afterActions = composition.inputPort.enumerateActions({
                  actorId: focalSeatId || node.action.actorId,
                });
                const nextPlaceData = (afterActions || []).find((action) => (
                  action.family === "place_data" && action.phase !== "conditional"
                ));
                if (nextPlaceData) {
                  const placeResult = composition.inputPort.submitAction(nextPlaceData, {
                    skipProjection: true,
                  });
                  if (!placeResult?.ok) {
                    return {
                      failed: true,
                      code: placeResult?.code || "COUNTERFACTUAL_PLACE_DATA_CHAIN_FAILED",
                      message: placeResult?.message || "连续填数据失败",
                    };
                  }
                  executionStepCount += 1;
                  continue;
                }
              }
            }
            drainGuard += 1;
          }
          let nextInspection = composition.inspect();
          let awaitingDecision = nextInspection.phase === "awaiting_input";
          // 信任 enumerateActions / getDecisionSnapshot 已返回 fresh 结果，不再二次 clone：
          // - 非 awaiting 路径 enumerateActions 每次新建描述符（trusted 不做 state clone）；
          // - awaiting 路径 session.decision.choices 由 getDecisionSnapshot 每次枚举并克隆
          //   （session-runtime getDecisionSnapshot 内部 choices: clone(...)），本层 inspect
          //   的 deepFreeze 后直接共享该私有数组即可；
          // - sanitizeHiddenInformationActions 需要变更时会自行 clone，其余消费方只读或 spread。
          let successors = awaitingDecision
            ? (nextInspection.session?.decision?.choices || [])
            : composition.inputPort.enumerateActions({});
          const hiddenBarrier = isHiddenInformationBarrier(result.irreversibleBarrier)
            ? result.irreversibleBarrier
            : isHiddenInformationBarrier(nextInspection.session?.irreversibleBarrier)
              ? nextInspection.session.irreversibleBarrier
              : drainHiddenBarrier;
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
          // 延迟推进：end_turn 立即推进因回合末会话未排空（如 FINAL_MARK 决策待解析）
          // 而标记 pendingFocalAdvance 时，在会话排空（无活动 session）后把 focal 拉回
          // 当前行动位，并重新 inspect/枚举后继——否则后继会落在「下一位玩家」的
          // 行动上，单席位规划无法执行而被误杀。
          if (
            secondaryAgentSearch
            && node.origins.some((origin) => origin.pendingFocalAdvance === true)
            && !nextInspection.session
          ) {
            const advanced = composition.counterfactualPort
              ?.advanceFocalPlanningTurn?.(focalSeatId);
            if (advanced?.ok) {
              for (const origin of node.origins) origin.pendingFocalAdvance = false;
              if (advanced.advanced) focalPlanningTurnAdvanceCount += 1;
              nextInspection = composition.inspect();
              awaitingDecision = nextInspection.phase === "awaiting_input";
              successors = awaitingDecision
                ? (nextInspection.session?.decision?.choices || [])
                : composition.inputPort.enumerateActions({});
              if (informationMasked) {
                const filtered = sanitizeHiddenInformationActions(rootObservation, successors);
                successors = filtered.actions;
                hiddenInformationFilteredActionCount += filtered.filteredCount;
              }
            }
          }
          const projectionStartedAt = now();
          // 中间节点观测用 cheap 模式（跳过 planets/data/solarSystem/finalScoring 克隆，
          // 只含 requirements/资源/rockets/aliens/公共牌/科技）；完整观测在叶形成时重建。
          const projectedObservation = composition.projection(
            { ...(viewer || {}), cheap: true },
          ).state;
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
          // 宏步：记录 fork 现处 envelope 与是否等待输入，供下个节点跳过冗余 restore。
          lastForkEnvelope = childSaved?.envelope || null;
          lastExecutionAwaitingDecision = awaitingDecision;
          return {
            ok: true,
            current,
            executionStepCount,
            nextInspection,
            awaitingDecision,
            successors,
            leafObservation,
            branchPriority,
            childEnvelope: childSaved?.envelope || null,
            informationMasked,
            hiddenBarrier,
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
      // 统一搜索（唯一机制）：未绑定任何目标的动作也以 targetId=null 进入初始
      // frontier，让"预算内全动作尝试"取代"只搜命中预设目标的动作"的目标门控；
      // 低价值分支由 branchPriority 排序在节点耗尽时 pruned（被尝试过，而非根本
      // 不在搜索里）。未绑定动作的评估范围由决策层 selectSecondaryAgentRootActions
      // 的目标引导 + 需求引导把关（quick_trade/card_corner/industry 凭需求放行）。
      const allowUntargetedRootActions = true;
      // 未绑定分支浅尝深度：未绑定 origin 不完成目标（proxyDepth 恒 0），普通后继
      // 又无深度检查，若每层都返回全部后继会无限深挖到 maxExecutionNodes 耗尽
      // （实测 4096 撞顶、单决策 8s）。展开 MAX_UNTARGETED_DEPTH 层即收束为
      // pruned（被尝试过），深挖预算留给绑定目标分支；有目标机会时 selectRouteTarget
      // 会把 origin 重新绑定到目标路线（见下），不受此限制。
      const MAX_UNTARGETED_DEPTH = 3;
      const initialFrontierByKey = new Map();
      for (const action of legalActions) {
        const routeTargets = rootTargetsByActionId.get(action.actionId) || [];
        const selectedTargets = routeTargets.length
          ? routeTargets
          : !usesRootTargetCatalog || ["pass", "end_turn"].includes(action.family)
            ? [{ targetId: null, planId: null }]
            : allowUntargetedRootActions
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

      // 宏步：跟踪最后一次执行后 fork 所处 envelope 与是否等待输入，用于跳过冗余 restore。
      let lastForkEnvelope = null;
      let lastExecutionAwaitingDecision = null;

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
            // 次级代理搜索同样受 maxLeaves 饱和限制：此前 secondary 不饱和 → scan 等
            // 分支宽的根无限展开直到 maxExecutionNodes 耗尽仍无叶（unresolved）→ AI
            // 评估 scan 返回 unavailable → 从不扫描（用户 405 档 scan 13 次 vs AI 2 次）。
            // 让 secondary 也按 maxLeaves 收束出叶（settled），保留预算内剪枝语义。
            return (leafCountByVirtualRoot.get(virtualRootKey(origin)) || 0) >= maxLeaves;
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
            // 物理状态共享不等于收益归属共享。与frontier合并使用同一完整来源键，
            // 保留后到的不同根、根路线、目标深度和信息上下文的后继义务。
            const freshOrigins = node.origins.filter((o) => !processedOriginKeys.has(`${key}|${originKey(o)}`));
            if (!freshOrigins.length) {
              transpositionHitCount += 1;
              continue;
            }
            node.origins = freshOrigins;
            for (const o of freshOrigins) processedOriginKeys.add(`${key}|${originKey(o)}`);
            transpositionHitCount += 1;
          } else {
            processedNodeKeys.add(key);
            for (const o of node.origins) processedOriginKeys.add(`${key}|${originKey(o)}`);
          }
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
          const nextProbeAction = ["launch", "move", "orbit", "land"].includes(current.family)
            ? clone(current)
            : null;
          for (const origin of node.origins) {
            origin.informationMasked = Boolean(
              origin.informationMasked || execution.informationMasked,
            );
            origin.executionStepCount = (origin.executionStepCount || 0) + execution.executionStepCount;
            if (execution.informationMasked && !origin.informationBarrier) {
              origin.informationBarrier = execution.hiddenBarrier || null;
            }
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
              && (!usesRootTargetCatalog || allowUntargetedRootActions)
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
                // 描述符 target/payload 已冻结或本节点私有，叶物化（secondaryAgentTrace
                // clone）时才会复制，这里不再重复克隆。
                target: current.target || {},
                payload: current.payload || {},
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
                  // completesRouteTarget 缺失时按"不完成目标"处理
                  // （原 countsGoal 恒 false 的等价语义，见 2026-08-21 清理）。
                  : false
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
            // 独立条件决策根只负责本次选择；主行动根则走通用后继链，不能在扫描
            // 附带的选牌等条件决策尚未结算时提前成叶。隐藏信息仍由executeNode遮蔽。
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
                    ? successor.routeResultTargetIds
                    : (origin.routeResultTargetIds || []),
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
              // 未绑定分支浅尝：未绑定 origin（无 routeTargetId）展开到
              // MAX_UNTARGETED_DEPTH 层即收束为 pruned——未绑定分支 proxyDepth 恒 0、
              // 普通后继无深度检查，不限制会无限深挖吃光预算；"试过即可"，深挖预算
              // 留给绑定目标分支。已重新绑定目标（selectRouteTarget 更新了
              // routeTargetId）或已完成目标挂起的 origin 不受此限制。
              if (
                allowUntargetedRootActions
                && !routeTargetId
                && !origin.goalCompletionPending
                && node.depth >= MAX_UNTARGETED_DEPTH
              ) {
                markPruned([origin]);
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
                    actionChain: nextChain,
                    rolloutVersion: secondaryAgentSearch.rolloutVersion || null,
                    routeTargetId: completedGoal ? null : routeTargetId,
                    routePlanId: completedGoal ? null : routePlanId,
                    routeResultTargetIds: completedGoal
                      ? []
                      : (origin.routeResultTargetIds || []),
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
                      ? selected.routeResultTargetIds
                      : (
                        completedGoal
                          ? []
                          : (origin.routeResultTargetIds || [])
                      ),
                  }))
                  .filter((route) => Boolean(route.action));
                if (!selectedRoutes.length) {
                  unreachableRouteOriginCount += 1;
                  // 当前动作已经完整结算；目标无法继续不应抹掉实际结果。
                  // 条件决策分支仍不走此路径，未支付/未选完的状态不能冒充已结算叶。
                  addLeaf(
                    {
                      ...origin,
                      chain: nextChain,
                      proxyDepth: nextProxyDepth,
                      quickTradeCount: nextQuickTradeCount,
                      routeActions: nextRouteActions,
                      terminalReason: "route-unreachable",
                    },
                    execution.leafObservation,
                    execution.successors,
                    execution.nextInspection,
                    nextCheckpoints,
                  );
                  continue;
                }
                const completedEndpoint = completedGoal
                  && ["completed", "idle"].includes(execution.nextInspection.phase);
                if (completedEndpoint || selectedRoutes.some((route) => (
                  String(route.action.actorId) === focalSeatId
                ))) {
                  // 已完成目标的实际收益独立于后续搜索；未完成路线仍仅作frontier诊断。
                  const recordEndpoint = completedEndpoint ? addLeaf : addFrontierLeaf;
                  recordEndpoint(
                    {
                      ...origin,
                      chain: nextChain,
                      proxyDepth: nextProxyDepth,
                      goalTracePaths: nextGoalTracePaths,
                      goalTraceSelections: nextGoalTraceSelections,
                      terminalReason: completedEndpoint ? "goal-completed" : origin.terminalReason,
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
                        : (origin.routeResultTargetIds || []),
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
                        : (origin.routeResultTargetIds || []),
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
      // 待执行动作 family 分布（2026-08-21 调研诊断）：frontier 节点按
      // node.action.family 聚合的 origin 数——回答"这些节点都是啥"（选目标/
      // 结算/扫描/放数据……各自占多少），定位搜索分叉热点。
      const frontierOriginCountByFamily = {};
      // 节点级明细（2026-08-21 调研诊断）：每个 frontier 节点 = 一个待执行决策点，
      // 记录其动作（family+摘要）、路径数（origins）、代表目标与深度——dump 一次
      // 即完整快照，后续分析不重放。
      const frontierNodeBreakdown = [];
      for (const node of frontier) {
        const origin = node.origins[0] || null;
        frontierNodeBreakdown.push({
          action: `${node.action?.family || "?"}:${String(node.action?.summary || "").slice(0, 40)}`,
          originCount: node.origins.length,
          routeTargetId: origin?.routeTargetId || null,
          routePlanId: origin?.routePlanId || null,
          proxyDepth: Number(origin?.proxyDepth) || 0,
          chainDepth: (origin?.chain || []).length,
          isConditional: node.action?.phase === "conditional",
        });
        for (const o of node.origins) {
          const depth = String(Number(o.proxyDepth) || 0);
          remainingFrontierOriginCountByGoalDepth[depth] = (
            remainingFrontierOriginCountByGoalDepth[depth] || 0
          ) + 1;
          const fam = node.action?.family || "?";
          frontierOriginCountByFamily[fam] = (frontierOriginCountByFamily[fam] || 0) + 1;
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
        frontierOriginCountByFamily: Object.fromEntries(
          Object.entries(frontierOriginCountByFamily).sort((left, right) => (
            right[1] - left[1] || String(left[0]).localeCompare(String(right[0]))
          )),
        ),
        frontierNodeBreakdown,
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
      // 暴露 fork 原语（可回退执行）：从任意 envelope 创建独立 composition 分支，
      // 在分支上执行动作不影响 root——"可回退执行"基础组件，供外部自定义搜索
      // （如 V 引导浅搜索）复用，不依赖 evaluate 内置的目标/预算体系。
      createFork: typeof options.createCounterfactualFork === "function"
        ? (envelope, forkOptions = {}) => (
          options.createCounterfactualFork(envelope, forkOptions)
        )
        : null,
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
