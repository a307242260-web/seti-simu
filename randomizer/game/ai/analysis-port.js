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

  function createAnalysisPort({ composition, seatId, maxCacheEntries = 256 } = {}) {
    if (!composition?.counterfactualPort?.createFork || !composition?.counterfactualPort?.prepareRoot
      || typeof seatId !== "string" || !seatId) throw new TypeError("ANALYSIS_PORT_INVALID");
    if (!Number.isSafeInteger(maxCacheEntries) || maxCacheEntries < 0) throw new TypeError("ANALYSIS_CACHE_LIMIT_INVALID");
    const viewer = Object.freeze({ playerId: seatId, role: "player" });
    let nodes = new WeakMap();
    let fork = null;
    let rootObservation = null;
    let publicSeed = null;
    let nodeCount = 0;
    let submissionCount = 0;
    let cacheHits = 0;
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

    function createNode(envelope, observation, actions, status, path = [], boundary = null) {
      const node = freeze({
        observation: structuredClone(observation),
        legalActions: structuredClone(actions), status, boundary,
      });
      nodes.set(node, { envelope, path });
      nodeCount += 1;
      return node;
    }

    function openRoot() {
      if (fork) throw new Error("ANALYSIS_ROOT_ALREADY_OPEN");
      nodeCount = 0;
      submissionCount = 0;
      cacheHits = 0;
      for (const key of Object.keys(milliseconds)) milliseconds[key] = 0;
      rootObservation = project(composition);
      const actions = legalActions(composition);
      if (!actions.length || actions.some(action => action.actorId !== seatId)) {
        throw new Error("ANALYSIS_ROOT_OWNER_MISMATCH");
      }
      // 公共事实确定假设世界；隐藏权威快照只留在本闭包。
      publicSeed = JSON.stringify(rootObservation);
      const rootEnvelope = composition.counterfactualPort.prepareRoot(snapshot(composition), { publicSeed });
      fork = composition.counterfactualPort.createFork(rootEnvelope, { branchKey: publicSeed });
      return createNode(rootEnvelope, rootObservation, actions, "decision");
    }

    function expand(node, actionId) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      if (["information-barrier", "other-owner", "terminal"].includes(node.status)) {
        throw new Error(`ANALYSIS_BOUNDARY_CLOSED: ${node.status}`);
      }
      const requested = node.legalActions.find(action => action.actionId === actionId);
      if (!requested || requested.actorId !== seatId) throw new Error("ANALYSIS_ACTION_NOT_LEGAL");
      const path = [...stored.path, actionId];
      // 路径与完整快照同时匹配才可复用，不能按观察摘要合并不同规则状态。
      const key = JSON.stringify([stored.envelope, path]);
      if (cache.has(key)) {
        cacheHits += 1;
        return cache.get(key);
      }
      const comp = fork.composition || fork;
      const restoreAt = now();
      fork.resetBranch?.(JSON.stringify([publicSeed, path]));
      const restored = comp.lifecycle.restore(stored.envelope, {
        silent: true, inPlace: true, trustedFork: true, skipProjection: true,
      });
      milliseconds.restore += now() - restoreAt;
      if (!restored.ok) throw new Error(`ANALYSIS_RESTORE_FAILED: ${restored.code || restored.message}`);
      const before = comp.inspect();
      const current = legalActions(comp, before).find(action => action.actionId === actionId);
      if (!current) throw new Error("ANALYSIS_ACTION_STALE");
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
      const inspection = comp.inspect();
      const barrier = result.irreversibleBarrier || inspection.session?.irreversibleBarrier;
      const newBarrier = ruleComposition.isHiddenInformationBarrier(barrier)
        && JSON.stringify(barrier) !== JSON.stringify(before.session?.irreversibleBarrier);
      const observationAt = now();
      const observation = project(comp);
      const visibleObservation = newBarrier
        ? ruleComposition.sanitizeHiddenInformationObservation(rootObservation, observation, barrier)
        : observation;
      milliseconds.observation += now() - observationAt;
      const actions = newBarrier ? [] : legalActions(comp, inspection);
      if (!newBarrier && !actions.length && observation.terminal !== true) {
        throw new Error("ANALYSIS_EMPTY_NONTERMINAL");
      }
      const status = newBarrier ? "information-barrier"
        : actions.some(action => action.actorId !== seatId) ? "other-owner"
          : !actions.length ? "terminal"
            : inspection.phase === "awaiting_input" ? "decision" : "stable";
      const child = createNode(snapshot(comp), visibleObservation,
        ["other-owner", "terminal"].includes(status) ? [] : actions, status, path,
        newBarrier ? barrier.code : null);
      if (maxCacheEntries) {
        if (cache.size >= maxCacheEntries) cache.delete(cache.keys().next().value);
        cache.set(key, child);
      }
      return child;
    }

    function close() {
      (fork?.composition || fork)?.dispose?.();
      fork = null;
      nodes = new WeakMap();
      cache.clear();
      rootObservation = null;
      publicSeed = null;
    }

    function getDiagnostics() {
      return freeze({ nodeCount, submissionCount, cacheHits, cacheEntries: cache.size,
        maxCacheEntries, milliseconds: { ...milliseconds } });
    }

    return Object.freeze({ openRoot, expand, close, getDiagnostics });
  }

  return Object.freeze({ createAnalysisPort });
});
