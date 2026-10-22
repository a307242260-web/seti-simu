(function (root, factory) {
  "use strict";
  const common = typeof module === "object" && module.exports;
  const api = factory(common ? require("../rule-composition") : root.SetiRuleComposition);
  if (common) module.exports = api;
  else root.SetiAnalysisPort = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (ruleComposition) {
  "use strict";

  function freeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const item of Object.values(value)) freeze(item);
    return Object.freeze(value);
  }

  function legalActions(composition, inspection = composition.inspect()) {
    return inspection.phase === "awaiting_input"
      ? inspection.session.decision.choices
      : composition.inputPort.enumerateActions({});
  }

  // 只比较向前正式输入的行为；不提供 undo/abort，因而历史日志和撤销帧不参与身份。
  // 实体编号、数组顺序、资源、规则 RNG 与完整剩余队列保留。会改变合法信封的
  // authority 版本单独由 expand 校验，不能作为循环状态的差异。
  function forwardIdentity(envelope, status, boundary) {
    const session = envelope.session?.session;
    const state = structuredClone(session?.workingState || JSON.parse(envelope.committedState));
    delete state.meta.stateVersion;
    if (state.match) delete state.match.decisionVersion;
    const references = new Map();
    const prefix = /^effect-session-[0-9]+$/.test(session?.sessionId) ? session.sessionId : null;
    const referenceKeys = new Set(["effectId", "parentEffectId", "groupId", "quickGroupId", "decisionId", "choiceId"]);
    function normalize(value, key = "") {
      if (typeof value === "string" && prefix && referenceKeys.has(key)) {
        // 引用按首次出现编号，保留相等关系；物理实体和普通文本绝不重命名。
        const parts = value.split(new RegExp(`(${prefix}:(?:effect|group):[0-9]+)`, "g"));
        if (parts.length > 1) return parts.map((part, index) => {
          if (index % 2 === 0) return part;
          if (!references.has(part)) references.set(part, references.size);
          return { reference: references.get(part) };
        });
      }
      if (!value || typeof value !== "object") return value;
      if (Array.isArray(value)) return value.map(item => normalize(item));
      const descriptor = value.schemaVersion === "seti-standard-action-v1";
      return Object.fromEntries(Object.keys(value).sort()
        .filter(name => !descriptor || !["actionId", "stateVersion", "decisionVersion"].includes(name))
        .map(name => [name, normalize(value[name], name)]));
    }
    const pending = session ? {
      phase: session.phase, queue: session.queue,
      interruptContext: session.interruptContext,
      irreversibleBarrier: session.irreversibleBarrier && {
        code: session.irreversibleBarrier.code, reason: session.irreversibleBarrier.reason,
      },
      failure: session.failure,
      family: session.journal.actions[0]?.action?.family || null,
    } : null;
    return JSON.stringify(normalize({ state, pending, status, boundary }));
  }

  function createAnalysisPort({ composition, seatId, maxCacheEntries = 256 } = {}) {
    if (!composition?.counterfactualPort?.createFork || !composition?.counterfactualPort?.prepareRoot
      || typeof seatId !== "string" || !seatId) throw new TypeError("ANALYSIS_PORT_INVALID");
    if (!Number.isSafeInteger(maxCacheEntries) || maxCacheEntries < 0) throw new TypeError("ANALYSIS_CACHE_LIMIT_INVALID");
    const viewer = Object.freeze({ playerId: seatId, role: "player" });
    let nodes = new WeakMap();
    const identities = new Map();
    let fork = null;
    let loadedEnvelope = null;
    let rootObservation = null;
    let publicSeed = null;
    let nodeCount = 0;
    let submissionCount = 0;
    let cacheHits = 0;
    let observationCount = 0;
    const cache = new Map();
    const now = () => typeof performance !== "undefined" ? performance.now() : Date.now();
    const milliseconds = { restore: 0, execute: 0, observation: 0, checkpoint: 0 };

    function project(comp) {
      const state = comp.projection(viewer).state;
      // Browser 的 resident UI 壳不属于分析输入；两种宿主只保留同源规则信息。
      const observation = {
        schemaVersion: "seti-analysis-observation-v1",
        publicState: state.publicState, selfState: state.selfState,
        terminal: state.terminal === true,
      };
      for (const key of ["probeRouteRequirements", "dataAnalyzeRequirements", "sectorWinRequirements",
        "incomeGainRequirements", "techGainRequirements"]) {
        observation[key] = state[key] || null;
      }
      return observation;
    }

    function snapshot(comp) {
      const startedAt = now();
      const saved = comp.lifecycle.save({ trustedFork: true });
      milliseconds.checkpoint += now() - startedAt;
      if (!saved.ok) throw new Error(`ANALYSIS_SAVE_FAILED: ${saved.code || saved.message}`);
      return saved.envelope;
    }

    function restoreEnvelope(envelope, forWrite = false) {
      // trusted save 会冻结当前 session。只读投影可直接复用，下一次提交必须恢复可写副本。
      if (!forWrite && loadedEnvelope === envelope) return;
      const restoreAt = now();
      const comp = fork.composition || fork;
      const restored = comp.lifecycle.restore(envelope, {
        silent: true, inPlace: true, trustedFork: true, skipProjection: true,
      });
      milliseconds.restore += now() - restoreAt;
      if (!restored.ok) throw new Error(`ANALYSIS_RESTORE_FAILED: ${restored.code || restored.message}`);
      loadedEnvelope = envelope;
    }

    function observeEnvelope(envelope, barrier) {
      if (!fork) throw new Error("ANALYSIS_NODE_INVALID");
      restoreEnvelope(envelope);
      const observationAt = now();
      const observation = project(fork.composition || fork);
      const visible = barrier
        ? ruleComposition.sanitizeHiddenInformationObservation(rootObservation, observation, barrier)
        : observation;
      observationCount += 1;
      const result = freeze(structuredClone(visible));
      milliseconds.observation += now() - observationAt;
      return result;
    }

    function createNode(envelope, observation, actions, status, barrier = null) {
      let visible = observation && freeze(structuredClone(observation));
      // 搜索内部节点只用合法集与身份；首次估值/记录时才投影。getter 不暴露快照。
      const node = Object.freeze({
        get observation() {
          if (!visible) visible = observeEnvelope(envelope, barrier);
          return visible;
        },
        legalActions: freeze(structuredClone(actions)), status, boundary: barrier?.code || null,
      });
      const boundary = barrier?.code || null;
      const key = forwardIdentity(envelope, status, boundary);
      if (!identities.has(key)) identities.set(key, Object.freeze({}));
      nodes.set(node, { envelope, serial: nodeCount, identity: identities.get(key) });
      nodeCount += 1;
      return node;
    }

    function openRoot() {
      if (fork) throw new Error("ANALYSIS_ROOT_ALREADY_OPEN");
      nodeCount = 0;
      submissionCount = 0;
      cacheHits = 0;
      observationCount = 0;
      for (const key of Object.keys(milliseconds)) milliseconds[key] = 0;
      rootObservation = project(composition);
      const actions = legalActions(composition);
      if (!actions.length || actions.some(action => action.actorId !== seatId)) {
        throw new Error("ANALYSIS_ROOT_OWNER_MISMATCH");
      }
      // 公共事实确定假设世界；隐藏权威快照只留在本闭包。
      publicSeed = JSON.stringify(rootObservation);
      const rootEnvelope = composition.counterfactualPort.prepareRoot(snapshot(composition), {
        publicSeed, restoreRandomState: true,
      });
      fork = composition.counterfactualPort.createFork(rootEnvelope, {
        branchKey: publicSeed, restoreRandomState: true,
      });
      loadedEnvelope = rootEnvelope;
      return createNode(rootEnvelope, rootObservation, actions,
        composition.inspect().phase === "awaiting_input" ? "decision" : "stable");
    }

    function expand(node, actionId) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      if (["information-barrier", "other-owner", "terminal"].includes(node.status)) {
        throw new Error(`ANALYSIS_BOUNDARY_CLOSED: ${node.status}`);
      }
      const requested = node.legalActions.find(action => action.actionId === actionId);
      if (!requested || requested.actorId !== seatId) throw new Error("ANALYSIS_ACTION_NOT_LEGAL");
      // serial 只在本端口生命周期内绑定这一不可变快照；不按观察摘要跨节点复用。
      const key = JSON.stringify([stored.serial, actionId]);
      if (cache.has(key)) {
        cacheHits += 1;
        return cache.get(key);
      }
      restoreEnvelope(stored.envelope, true);
      const { before, result } = executeCurrent(actionId);
      return remember(key, finishChild(before, result));
    }

    function executeCurrent(actionId) {
      const comp = fork.composition || fork;
      const before = comp.inspect();
      const current = legalActions(comp, before).find(action => action.actionId === actionId);
      if (!current || current.actorId !== seatId) throw new Error("ANALYSIS_ACTION_STALE");
      loadedEnvelope = null;
      const executeAt = now();
      const result = before.phase === "awaiting_input"
        ? comp.inputPort.submitDecision({
          decisionId: before.session.decision.decisionId,
          decisionVersion: before.session.decision.decisionVersion,
          ownerId: before.session.decision.ownerId, choice: current,
        })
        : current.phase === "quick" ? comp.inputPort.submitQuickAction(current)
          : comp.inputPort.submitAction(current);
      milliseconds.execute += now() - executeAt;
      if (!result?.ok) {
        const failure = result?.failure || result;
        throw new Error(`ANALYSIS_EXECUTION_FAILED: ${failure?.code || failure?.message || "unknown"}`);
      }
      submissionCount += 1;
      return { before, result };
    }

    function finishChild(before, result) {
      const comp = fork.composition || fork;
      const inspection = comp.inspect();
      const barrier = result.irreversibleBarrier || inspection.session?.irreversibleBarrier;
      const newBarrier = ruleComposition.isHiddenInformationBarrier(barrier)
        && JSON.stringify(barrier) !== JSON.stringify(before.session?.irreversibleBarrier);
      const actions = newBarrier ? [] : legalActions(comp, inspection);
      const envelope = snapshot(comp);
      loadedEnvelope = envelope;
      const observation = !newBarrier && !actions.length ? observeEnvelope(envelope) : null;
      if (observation && observation.terminal !== true) {
        throw new Error("ANALYSIS_EMPTY_NONTERMINAL");
      }
      const status = newBarrier ? "information-barrier"
        : actions.some(action => action.actorId !== seatId) ? "other-owner"
          : !actions.length ? "terminal"
            : inspection.phase === "awaiting_input" ? "decision" : "stable";
      const child = createNode(envelope, observation,
        ["other-owner", "terminal"].includes(status) ? [] : actions, status,
        newBarrier ? barrier : null);
      return child;
    }

    function remember(key, child) {
      if (maxCacheEntries) {
        if (cache.size >= maxCacheEntries) cache.delete(cache.keys().next().value);
        cache.set(key, child);
      }
      return child;
    }

    function selectionSpec(node) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      if (node.status !== "decision") return null;
      const session = stored.envelope.session?.session;
      const effect = session?.queue?.[0];
      const pending = effect?.payload?.decisionContext;
      if (effect?.type !== "standard_action_session_decision" || effect.allowQuickActions
        || effect.ownerId !== seatId || pending?.kind !== "discard" || pending.type !== "trade"
        || pending.required !== true || pending.count !== 2
        || !["cards-for-credit", "cards-for-energy", "cards-for-pick-card"].includes(pending.tradeId)) return null;
      const cards = node.legalActions.filter(action => action.target?.kind === "discard-hand-card");
      if (cards.some(action => action.family !== "choose_payment" || action.actorId !== seatId)
        || node.legalActions.some(action => action.target?.kind !== "discard-hand-card" && !action.target?.confirm)) return null;
      const cardIds = cards.map(action => action.target.cardInstanceId);
      const selectedIds = pending.selected;
      if (cardIds.some(id => typeof id !== "string" || !id)
        || !Array.isArray(selectedIds) || new Set(cardIds).size !== cardIds.length
        || new Set(selectedIds).size !== selectedIds.length || selectedIds.length > pending.count
        || selectedIds.some(id => !cardIds.includes(id)) || pending.count > cardIds.length) return null;
      return freeze({ proof: "seti-quick-trade-discard-component-v1", requiredCount: pending.count,
        cardIds, selectedIds: [...selectedIds] });
    }

    // 保留目标前缀中仍可按原顺序留下的最长子序列，删除其他项，再追加剩余目标。
    // 所有留下的项必须是目标前缀，故该路径的点击数最少；顺序仍有规则意义。
    function selectionEdits(selected, target) {
      let kept = 0;
      let cursor = 0;
      while (kept < target.length) {
        const next = selected.indexOf(target[kept], cursor);
        if (next < 0) break;
        cursor = next + 1;
        kept += 1;
      }
      const retained = new Set(target.slice(0, kept));
      return [...selected.filter(id => !retained.has(id)), ...target.slice(kept)];
    }

    function* selectionPlans(node) {
      const spec = selectionSpec(node);
      if (!spec) throw new Error("ANALYSIS_SELECTION_UNSUPPORTED");
      function* visit(target) {
        if (target.length === spec.requiredCount) {
          const edits = selectionEdits(spec.selectedIds, target);
          const first = edits.length
            ? node.legalActions.find(action => action.target?.cardInstanceId === edits[0])
            : node.legalActions.find(action => action.target?.confirm);
          if (!first) throw new Error("ANALYSIS_SELECTION_PATH_INVALID");
          yield freeze({ selectedIds: [...target], submissions: edits.length + 1,
            firstActionId: first.actionId, proof: spec.proof });
          return;
        }
        for (const id of spec.cardIds) if (!target.includes(id)) yield* visit([...target, id]);
      }
      yield* visit([]);
    }

    function expandSelection(node, selectedIds) {
      const spec = selectionSpec(node);
      if (!spec) throw new Error("ANALYSIS_SELECTION_UNSUPPORTED");
      if (!Array.isArray(selectedIds) || selectedIds.length !== spec.requiredCount
        || new Set(selectedIds).size !== selectedIds.length
        || selectedIds.some(id => !spec.cardIds.includes(id))) throw new Error("ANALYSIS_SELECTION_INVALID");
      const stored = nodes.get(node);
      const key = JSON.stringify([stored.serial, "selection", selectedIds]);
      if (cache.has(key)) {
        cacheHits += 1;
        return cache.get(key);
      }
      restoreEnvelope(stored.envelope, true);
      const comp = fork.composition || fork;
      const actions = [];
      let outcome;
      for (const id of [...selectionEdits(spec.selectedIds, selectedIds), null]) {
        const current = legalActions(comp).find(action => id == null
          ? action.target?.confirm : action.target?.cardInstanceId === id);
        if (!current) throw new Error("ANALYSIS_SELECTION_PATH_INVALID");
        actions.push(structuredClone(current));
        outcome = executeCurrent(current.actionId);
      }
      return remember(key, freeze({ node: finishChild(outcome.before, outcome.result), actions,
        proof: spec.proof, submissions: actions.length }));
    }

    function close() {
      (fork?.composition || fork)?.dispose?.();
      fork = null;
      loadedEnvelope = null;
      nodes = new WeakMap();
      identities.clear();
      cache.clear();
      rootObservation = null;
      publicSeed = null;
    }

    function getDiagnostics() {
      return freeze({ nodeCount, submissionCount, cacheHits, cacheEntries: cache.size,
        observationCount, identityCount: identities.size, maxCacheEntries, milliseconds: { ...milliseconds } });
    }

    function identity(node) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      return stored.identity;
    }

    return Object.freeze({ openRoot, expand, identity, selectionSpec, selectionPlans, expandSelection, close, getDiagnostics });
  }

  return Object.freeze({ createAnalysisPort });
});
