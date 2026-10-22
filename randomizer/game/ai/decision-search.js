(function (root, factory) {
  "use strict";
  const api = factory(typeof module === "object" && module.exports ? require("./state-value") : root.SetiStateValue);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SetiDecisionSearch = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (stateValue) {
  "use strict";

  const VERSION = "seti-complete-decision-search-v5";
  const BOUNDARIES = new Set(["terminal", "other-owner", "information-barrier"]);
  // 这是单决策诊断额度，不是允许截断的棋力配置；超限绝不返回可提交动作。
  const DEFAULT_BUDGET = Object.freeze({ transitions: 128, nodes: 129, frontier: 128, milliseconds: 1000 });

  function searchDecision({ port, root, evaluate, budget = {}, continuation = null,
    modelKey = null, resourceDominance = false, cardTradePruning = false, postMainPruning = false,
    now = () => performance.now() } = {}) {
    if (typeof port?.expand !== "function" || typeof port?.identity !== "function"
      || typeof evaluate !== "function" || !root) throw new TypeError("SEARCH_INPUT_INVALID");
    const limits = { ...DEFAULT_BUDGET, ...budget };
    for (const [key, value] of Object.entries(limits)) {
      if (!Object.hasOwn(DEFAULT_BUDGET, key) || !Number.isSafeInteger(value) || value < 1) {
        throw new TypeError(`SEARCH_BUDGET_INVALID: ${key}`);
      }
    }
    const startedAt = now();
    if (resourceDominance && (!stateValue?.isMoneyMonotoneEvaluator?.(evaluate)
      || evaluate.seatId !== root.legalActions?.[0]?.actorId
      || typeof port.postMainResourceOrder !== "function")) throw new TypeError("SEARCH_RESOURCE_PROOF_MODEL_INVALID");
    if (cardTradePruning && (!stateValue?.isStateValueEvaluator?.(evaluate)
      || evaluate.seatId !== root.legalActions?.[0]?.actorId
      || typeof port.cardTradeBound !== "function")) throw new TypeError("SEARCH_CARD_BOUND_MODEL_INVALID");
    if (postMainPruning && (!stateValue?.isDefaultStateValueEvaluator?.(evaluate)
      || evaluate.seatId !== root.legalActions?.[0]?.actorId
      || typeof port.postMainPlanSpec !== "function")) throw new TypeError("SEARCH_POST_MAIN_MODEL_INVALID");
    if (modelKey != null && (typeof modelKey !== "string" || !modelKey)) throw new TypeError("SEARCH_MODEL_KEY_INVALID");
    const reused = continuation && modelKey && port.reuseSelection?.(root, continuation, modelKey);
    if (reused?.hit && now() - startedAt < limits.milliseconds) return {
      schemaVersion: VERSION, complete: true, actionId: reused.actionId, value: reused.value,
      selectionPlan: { selectedIds: reused.selectedIds, cardIds: reused.cardIds, proof: reused.proof, complete: true },
      selectionContinuation: continuation,
      reusedCoverage: { evidenceId: reused.evidenceId, exitCount: reused.exitCount, proof: reused.proof },
      stopReason: null, scope: "own-visible-decision-window-to-owner-information-or-terminal-boundary",
      roots: reused.roots, lines: [], unresolved: [],
      diagnostics: { transitions: 0, nodes: 1, equivalents: 0, selectionMacros: 0, peakFrontier: 0,
        dominancePrunes: 0, resourceDominance: resourceDominance ? "disabled-for-selection-certificate" : "off",
        cardTradePrunes: 0, cardTradePruning: cardTradePruning ? "disabled-for-selection-certificate" : "off",
        postMainProofNodes: 0, postMainExcludedActions: 0, postMainPruning: postMainPruning ? "enabled" : "off",
        continuation: "hit", milliseconds: now() - startedAt, limits },
    };
    const nodes = [];
    const known = new Map();
    const queue = [];
    const resourceGroups = new Map();
    const useResourceDominance = resourceDominance && !port.selectionSpec?.(root);
    const useCardTradePruning = cardTradePruning && !port.selectionSpec?.(root);
    let cursor = 0;
    let transitions = 0;
    let equivalents = 0;
    let selectionMacros = 0;
    let peakFrontier = 0;
    let pendingFrontier = 0;
    let dominancePrunes = 0;
    let cardTradePrunes = 0;
    let postMainProofNodes = 0, postMainExcludedActions = 0;
    let incumbent = null;
    let stopReason = null;
    function dominates(upper, lower) {
      return upper.credits >= lower.credits && upper.energy >= lower.energy
        && (upper.credits > lower.credits || upper.energy > lower.energy);
    }
    function prune(index, dominator) {
      const entry = nodes[index];
      if (entry.prunedBy) return;
      const upper = nodes[dominator].resources;
      entry.prunedBy = { node: dominator, proof: entry.resources.proof,
        gap: Object.fromEntries(["credits", "energy"]
          .map(key => [key, upper[key] - entry.resources[key]])) };
      dominancePrunes += 1;
      if (entry.queued) { entry.queued = false; pendingFrontier -= 1; }
    }
    function add(node) {
      const identity = port.identity(node);
      if (known.has(identity)) return { index: known.get(identity), equivalent: true };
      const index = nodes.length;
      known.set(identity, index);
      const boundary = BOUNDARIES.has(node.status);
      if (!boundary && !node.legalActions?.length) throw new Error("SEARCH_EMPTY_NONTERMINAL");
      const value = boundary ? evaluate(node.observation) : null;
      if (boundary && !Number.isFinite(value)) throw new Error("SEARCH_VALUE_INVALID");
      if (boundary && (!incumbent || value > incumbent.value)) incumbent = { node: index, value };
      const selection = boundary ? null : port.selectionSpec?.(node) || null;
      let postMainPlan = !boundary && !selection && postMainPruning && node.status === "stable"
        ? port.postMainPlanSpec(node) : null;
      if (postMainPlan) {
        const kept = new Set(postMainPlan.retainedActionIds), removed = new Set(postMainPlan.excludedActionIds);
        if (!kept.size || !removed.size || kept.size !== postMainPlan.retainedActionIds.length
          || removed.size !== postMainPlan.excludedActionIds.length || kept.size + removed.size !== node.legalActions.length
          || node.legalActions.some(action => kept.has(action.actionId) === removed.has(action.actionId))
          || !Number.isSafeInteger(postMainPlan.maximumValueIncrease * 2) || postMainPlan.maximumValueIncrease < 0) {
          throw new TypeError("SEARCH_POST_MAIN_PROOF_INVALID");
        }
        const observation = node.observation;
        const player = observation.publicState.players.find(player => player.playerId === evaluate.seatId);
        const currentValue = evaluate(observation);
        // 所有贡献为非负整数/半整数；保留足够的精确加法空间，不以容差证明平分。
        if (!Number.isSafeInteger(player.finalScore) || player.finalScore < player.score
          || !Number.isSafeInteger(currentValue * 2) || currentValue < 0
          || currentValue * 2 + postMainPlan.maximumValueIncrease * 2 >= Number.MAX_SAFE_INTEGER / 2) postMainPlan = null;
        else { postMainProofNodes += 1; postMainExcludedActions += removed.size; }
      }
      const retainedActions = postMainPlan ? node.legalActions.filter(action => postMainPlan.retainedActionIds.includes(action.actionId))
        : node.legalActions;
      const alternatives = selection ? port.selectionPlans(node)
        : retainedActions.map(action => ({ firstActionId: action.actionId, submissions: 1 }));
      const alternativeCount = selection ? Array.from({ length: selection.requiredCount }, (_, i) =>
        (selection.cardIds.length - i) / (selection.unordered ? i + 1 : 1))
        .reduce((count, n) => count * n, 1) : retainedActions.length;
      const resources = !boundary && !selection && useResourceDominance
        ? port.postMainResourceOrder(node) || port.openingResourceOrder?.(node) || null : null;
      nodes.push({ node, edges: [], selection, alternatives, alternativeCount, resources, postMainPlan,
        expanded: boundary, value, distance: boundary ? 0 : Infinity, best: null });
      if (resources) {
        const peers = (resourceGroups.get(resources.group) || []).filter(i => !nodes[i].prunedBy);
        const upper = peers.find(i => dominates(nodes[i].resources, resources));
        if (upper != null) prune(index, upper);
        else {
          for (const lower of peers) if (lower !== 0 && !nodes[lower].expanded
            && dominates(resources, nodes[lower].resources)) prune(lower, index);
          resourceGroups.set(resources.group, [...peers, index]);
        }
      }
      if (!boundary && !nodes[index].prunedBy) {
        queue.push(index); nodes[index].queued = true; pendingFrontier += 1;
      }
      peakFrontier = Math.max(peakFrontier, pendingFrontier);
      return { index, equivalent: false };
    }
    add(root);
    outer: while (cursor < queue.length) {
      const entry = nodes[queue[cursor]];
      if (entry.prunedBy) { cursor += 1; continue; }
      if (useCardTradePruning && incumbent && entry.node.status === "decision") {
        if (now() - startedAt >= limits.milliseconds) { stopReason = "watchdog"; break; }
        const bound = port.cardTradeBound(entry.node);
        const upperBound = bound
          ? stateValue.evaluateHandCountDelta(evaluate, entry.node.observation, bound.handDelta) : null;
        if (now() - startedAt >= limits.milliseconds) { stopReason = "watchdog"; break; }
        if (bound && incumbent.value > upperBound) {
          entry.prunedByBound = { ...incumbent, upperBound, proof: bound.proof, modelKey: evaluate.modelKey };
          cardTradePrunes += 1;
          if (entry.queued) { entry.queued = false; pendingFrontier -= 1; }
          cursor += 1;
          continue;
        }
      }
      for (const alternative of entry.alternatives) {
        if (entry.prunedBy) break;
        if (transitions + alternative.submissions > limits.transitions) stopReason = "transition-budget";
        else if (nodes.length >= limits.nodes) stopReason = "node-budget";
        else if (pendingFrontier > limits.frontier) stopReason = "frontier-budget";
        else if (now() - startedAt >= limits.milliseconds) stopReason = "watchdog";
        if (stopReason) break outer;
        const macro = entry.selection ? port.expandSelection(entry.node, alternative.selectedIds) : null;
        const child = macro ? macro.node : port.expand(entry.node, alternative.firstActionId);
        if (macro && macro.submissions !== alternative.submissions) throw new Error("SEARCH_MACRO_COST_MISMATCH");
        transitions += alternative.submissions;
        if (macro) selectionMacros += 1;
        const added = add(child);
        if (added.equivalent) equivalents += 1;
        entry.edges.push({ actionId: alternative.firstActionId, target: added.index,
          equivalent: added.equivalent, cost: alternative.submissions,
          ...(macro ? { selectedIds: alternative.selectedIds, proof: alternative.proof,
            steps: macro.actions.map(action => action.actionId) } : {}) });
        if (now() - startedAt >= limits.milliseconds) {
          stopReason = "watchdog";
          break outer;
        }
      }
      entry.expanded = !entry.prunedBy;
      if (entry.queued) { entry.queued = false; pendingFrontier -= 1; }
      cursor += 1;
    }

    // 在完整有向图上从叶逆向传播；保留回边，不能把 DFS 栈上的节点误判成无解。
    // 分数相同优先最短路径，避免选中零收益循环。启发式分数不参与任何剪枝。
    if (!stopReason) {
      const parents = nodes.map(() => []);
      nodes.forEach((entry, index) => entry.edges.forEach(edge => parents[edge.target].push({ index, edge })));
      const covered = nodes.flatMap((entry, index) => entry.prunedBy || entry.prunedByBound ? [index] : []);
      for (const index of covered) nodes[index].covered = true;
      for (let head = 0; head < covered.length; head += 1) {
        for (const { index } of parents[covered[head]]) if (!nodes[index].covered) {
          nodes[index].covered = true;
          covered.push(index);
        }
      }
      const changed = nodes.flatMap((entry, index) => entry.value == null ? [] : [index]);
      for (let head = 0; head < changed.length; head += 1) {
        const target = nodes[changed[head]];
        for (const { index, edge } of parents[changed[head]]) {
          const parent = nodes[index];
          const distance = target.distance + edge.cost;
          if (parent.value == null || target.value > parent.value
            || (target.value === parent.value && (distance < parent.distance
              || (distance === parent.distance && edge.actionId < parent.best?.actionId)))) {
            parent.value = target.value;
            parent.distance = distance;
            parent.best = edge;
            changed.push(index);
          }
        }
      }
    }
    if (!stopReason && now() - startedAt >= limits.milliseconds) stopReason = "watchdog";
    const unresolved = nodes.flatMap((entry, index) => entry.expanded || entry.prunedBy || entry.prunedByBound ? [] : [{
      node: index, actionIds: (entry.selection ? entry.node.legalActions
        : entry.alternatives.slice(entry.edges.length).map(alternative => ({ actionId: alternative.firstActionId })))
        .map(action => action.actionId),
      ...(entry.selection ? { selectionPlansRemaining: entry.alternativeCount - entry.edges.length,
        selection: entry.selection } : {}),
    }]);
    const complete = !stopReason;
    function retainedWitness(index) {
      if (!complete) return null;
      const start = dominancePrunes || cardTradePrunes ? 0 : index;
      let current = start;
      for (let depth = 0; depth <= nodes.length; depth += 1) {
        const entry = nodes[current];
        if (BOUNDARIES.has(entry.node.status)) return { node: current, value: entry.value,
          distance: nodes[start].distance, scope: start === index ? "local" : "global" };
        const edge = entry.best;
        if (!edge || !(nodes[edge.target].distance < entry.distance)) break;
        current = edge.target;
      }
      throw new Error("SEARCH_POST_MAIN_WITNESS_MISSING");
    }
    const lines = nodes.map((entry, index) => ({
      node: index, status: entry.node.status, boundary: entry.node.boundary || null,
      expanded: entry.expanded, edges: entry.edges,
      distance: Number.isFinite(entry.distance) ? entry.distance : null,
      value: entry.value, completion: entry.prunedBy || entry.prunedByBound ? "proof-pruned"
        : entry.value == null ? (stopReason ? "pending" : entry.covered ? "covered-by-global-pruning" : "unreachable") : "reachable",
      ...(entry.prunedBy ? { prunedBy: entry.prunedBy } : {}),
      ...(entry.prunedByBound ? { prunedByBound: entry.prunedByBound } : {}),
      ...(entry.postMainPlan ? { postMainPlan: entry.postMainPlan,
        excludedActions: entry.postMainPlan.excludedActionIds.map(actionId => ({ actionId,
          proof: entry.postMainPlan.proof, retainedActionIds: entry.postMainPlan.retainedActionIds,
          witness: retainedWitness(index), completion: complete ? "covered-by-retained-search" : "pending-retained-search",
          modelKey: evaluate.modelKey })) } : {}),
      ...(entry.selection ? { selection: entry.selection, orderedExitCount: entry.alternativeCount } : {}),
    }));
    const roots = root.legalActions.map(action => {
      const excluded = lines[0].excludedActions?.find(exclusion => exclusion.actionId === action.actionId);
      if (excluded) return { actionId: action.actionId, target: null, value: null,
        completion: complete ? "proof-pruned" : "pending-retained-search", valueType: "not-executed", prunedByPlan: excluded };
      const selection = nodes[0].selection;
      // 纯点击的强连通部分可到达同一完整出口集；confirm 直接离开，只对应当前选择。
      const edge = selection && action.target?.confirm ? nodes[0].edges.find(edge =>
        JSON.stringify(edge.selectedIds) === JSON.stringify(selection.selectedIds))
        : nodes[0].edges.find(edge => edge.actionId === action.actionId);
      if (selection && !action.target?.confirm) return {
        actionId: action.actionId, target: null, value: nodes[0].value,
        completion: stopReason ? "pending" : nodes[0].value == null ? "unreachable" : "complete",
        proof: selection.proof, equivalentExitSet: true,
      };
      return {
        actionId: action.actionId, target: edge?.target ?? null,
        value: edge ? nodes[edge.target].value : null,
        completion: stopReason || !edge ? "pending" : cardTradePrunes ? "covered-by-global-pruning"
          : dominancePrunes ? "covered-by-global-dominance"
          : nodes[edge.target].value == null ? "unreachable" : "complete",
        ...(dominancePrunes || cardTradePrunes ? { valueType: "attained-lower-bound" } : {}),
      };
    });
    const evidence = complete && nodes[0].selection ? nodes[0].edges.map(edge => ({
      selectedIds: edge.selectedIds, value: nodes[edge.target].value,
      distance: nodes[edge.target].value == null ? null : nodes[edge.target].distance,
    })) : null;
    let accepted = complete && now() - startedAt < limits.milliseconds;
    let certificate = accepted && evidence && modelKey && nodes[0].best
      ? port.rememberSelection?.(root, evidence, modelKey) || null : null;
    const elapsed = now() - startedAt;
    accepted = accepted && elapsed < limits.milliseconds;
    if (!accepted) certificate = null;
    return {
      schemaVersion: VERSION, complete: accepted,
      actionId: accepted ? nodes[0].best?.actionId || null : null,
      selectionPlan: accepted && nodes[0].best?.selectedIds ? {
        selectedIds: nodes[0].best.selectedIds, cardIds: nodes[0].selection.cardIds,
        proof: nodes[0].selection.proof, complete: true,
      } : null,
      selectionContinuation: certificate,
      value: accepted ? nodes[0].value : null,
      stopReason: stopReason || (!accepted ? "watchdog" : nodes[0].value == null ? "no-reachable-boundary" : null),
      scope: "own-visible-decision-window-to-owner-information-or-terminal-boundary",
      roots, lines, unresolved,
      diagnostics: { transitions, nodes: nodes.length, equivalents, selectionMacros, peakFrontier,
        dominancePrunes, resourceDominance: useResourceDominance ? "enabled"
          : resourceDominance ? "disabled-for-selection-certificate" : "off",
        cardTradePrunes, cardTradePruning: useCardTradePruning ? "enabled"
          : cardTradePruning ? "disabled-for-selection-certificate" : "off",
        postMainProofNodes, postMainExcludedActions, postMainPruning: postMainPruning ? "enabled" : "off",
        ...(useResourceDominance || useCardTradePruning || postMainPruning ? { resourceModelKey: evaluate.modelKey } : {}),
        continuation: reused ? (reused.hit ? "validation-watchdog" : reused.reason) : "not-requested",
        milliseconds: elapsed, limits },
    };
  }

  return Object.freeze({ VERSION, DEFAULT_BUDGET, searchDecision });
});
