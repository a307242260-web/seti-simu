(function (root, factory) {
  "use strict";
  const api = factory(typeof module === "object" && module.exports ? require("./state-value") : root.SetiStateValue);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SetiDecisionSearch = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (stateValue) {
  "use strict";

  const VERSION = "seti-complete-decision-search-v22";
  const BOUNDARIES = new Set(["terminal", "other-owner", "information-barrier"]);
  // 这是单决策诊断额度，不是允许截断的棋力配置；超限绝不返回可提交动作。
  const DEFAULT_BUDGET = Object.freeze({ transitions: 128, nodes: 129, frontier: 128, milliseconds: 1000 });

  function searchDecision({ port, root, evaluate, budget = {}, continuation = null, planContinuation = null, planReuse = false,
    modelKey = null, resourceDominance = false, moneyCapacityDominance = false, cardTradePruning = false, postMainPruning = false, openingPruning = false, cardChoiceEquivalence = false,
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
    if (openingPruning && (!stateValue?.isDefaultStateValueEvaluator?.(evaluate)
      || evaluate.seatId !== root.legalActions?.[0]?.actorId
      || typeof port.openingPlanSpec !== "function")) throw new TypeError("SEARCH_OPENING_MODEL_INVALID");
    if (moneyCapacityDominance && (!stateValue?.isDefaultStateValueEvaluator?.(evaluate)
      || evaluate.seatId !== root.legalActions?.[0]?.actorId
      || typeof port.openingMoneyCapacity !== "function")) throw new TypeError("SEARCH_MONEY_CAPACITY_MODEL_INVALID");
    if (resourceDominance && (!stateValue?.isMoneyMonotoneEvaluator?.(evaluate)
      || evaluate.seatId !== root.legalActions?.[0]?.actorId
      || typeof port.postMainResourceOrder !== "function")) throw new TypeError("SEARCH_RESOURCE_PROOF_MODEL_INVALID");
    if (cardTradePruning && (!stateValue?.isStateValueEvaluator?.(evaluate)
      || evaluate.seatId !== root.legalActions?.[0]?.actorId
      || typeof port.cardTradeBound !== "function")) throw new TypeError("SEARCH_CARD_BOUND_MODEL_INVALID");
    if (postMainPruning && (!stateValue?.isDefaultStateValueEvaluator?.(evaluate)
      || evaluate.seatId !== root.legalActions?.[0]?.actorId
      || typeof port.postMainPlanSpec !== "function")) throw new TypeError("SEARCH_POST_MAIN_MODEL_INVALID");
    if (cardChoiceEquivalence && (!stateValue?.isStateValueEvaluator?.(evaluate)
      || evaluate.seatId !== root.legalActions?.[0]?.actorId
      || typeof port.cardTradeBound !== "function")) throw new TypeError("SEARCH_CARD_CHOICE_MODEL_INVALID");
    if (modelKey != null && (typeof modelKey !== "string" || !modelKey)) throw new TypeError("SEARCH_MODEL_KEY_INVALID");
    if (planReuse && (!stateValue?.isStateValueEvaluator?.(evaluate) || evaluate.seatId !== root.legalActions?.[0]?.actorId
      || typeof port.rememberPlan !== "function" || typeof port.reusePlan !== "function")) throw new TypeError("SEARCH_PLAN_MODEL_INVALID");
    const planKey = JSON.stringify([VERSION, modelKey, evaluate.modelKey, resourceDominance, moneyCapacityDominance,
      cardTradePruning, postMainPruning, openingPruning, cardChoiceEquivalence]);
    const reused = continuation && modelKey && port.reuseSelection?.(root, continuation, modelKey);
    const reusedPlan = !reused?.hit && planReuse && planContinuation && port.reusePlan(root, planContinuation, planKey);
    const hit = reused?.hit ? reused : reusedPlan?.hit ? reusedPlan : null;
    if (hit && now() - startedAt < limits.milliseconds) return {
      schemaVersion: VERSION, complete: true, actionId: hit.actionId, value: hit.value,
      selectionPlan: reused?.hit ? { selectedIds: reused.selectedIds, cardIds: reused.cardIds, proof: reused.proof, complete: true } : null,
      selectionContinuation: reused?.hit ? continuation : null,
      planContinuation: reusedPlan?.hit ? planContinuation : null,
      reusedCoverage: reused?.hit ? { evidenceId: reused.evidenceId, exitCount: reused.exitCount, proof: reused.proof }
        : { evidenceId: hit.evidenceId, proof: hit.proof, sourceNode: hit.sourceNode, source: hit.source, distance: hit.distance },
      stopReason: null, scope: "own-visible-decision-window-to-owner-information-or-terminal-boundary",
      roots: hit.roots, lines: [], unresolved: [],
      diagnostics: { transitions: 0, nodes: 1, equivalents: 0, selectionMacros: 0, peakFrontier: 0,
        dominancePrunes: 0, resourceDominance: resourceDominance
          ? reused?.hit ? "disabled-for-selection-certificate" : "reused-complete-window" : "off",
        moneyCapacityPrunes: 0, moneyCapacityDominance: moneyCapacityDominance
          ? reused?.hit ? "disabled-for-selection-certificate" : "reused-complete-window" : "off",
        cardTradePrunes: 0, cardTradePruning: cardTradePruning
          ? reused?.hit ? "disabled-for-selection-certificate" : "reused-complete-window" : "off",
        postMainProofNodes: 0, postMainExcludedActions: 0, postMainPruning: postMainPruning ? "enabled" : "off",
        openingProofNodes: 0, openingExcludedActions: 0, openingPruning: openingPruning ? "enabled" : "off",
        openingPassMacros: 0,
        cardChoiceProofNodes: 0, cardChoiceExcludedActions: 0, cardChoiceEquivalence: cardChoiceEquivalence ? "enabled" : "off",
        continuation: reused?.hit ? "hit" : reused ? reused.reason : "not-requested",
        planContinuation: reusedPlan?.hit ? "hit" : planReuse ? "not-requested" : "off",
        milliseconds: now() - startedAt, limits },
    };
    const nodes = [];
    const known = new Map();
    const queue = [];
    const resourceGroups = new Map();
    const useResourceDominance = resourceDominance && !port.selectionSpec?.(root);
    const useMoneyCapacity = moneyCapacityDominance && !port.selectionSpec?.(root);
    const useCardTradePruning = cardTradePruning && !port.selectionSpec?.(root);
    let cursor = 0;
    let transitions = 0;
    let equivalents = 0;
    let selectionMacros = 0;
    let peakFrontier = 0;
    let pendingFrontier = 0;
    let dominancePrunes = 0;
    let moneyCapacityPrunes = 0;
    let cardTradePrunes = 0;
    let postMainProofNodes = 0, postMainExcludedActions = 0;
    let openingProofNodes = 0, openingExcludedActions = 0;
    let openingPassMacros = 0;
    let cardChoiceProofNodes = 0, cardChoiceExcludedActions = 0;
    let incumbent = null;
    let stopReason = null;
    function dominates(upper, lower) {
      if (upper.credits >= lower.credits && upper.energy >= lower.energy && lower.moneyValue) {
        const a = upper.moneyValue(), b = lower.moneyValue();
        if (![a, b].every(value => Number.isSafeInteger(value * 2) && value >= 0 && value <= Number.MAX_SAFE_INTEGER / 64)
          || a - b !== upper.credits - lower.credits + upper.energy - lower.energy) return null;
      }
      if (upper.credits >= lower.credits && upper.energy >= lower.energy
        && (upper.credits > lower.credits || upper.energy > lower.energy)) return lower.proof;
      if (upper.moneyCapacity && lower.moneyCapacity
        && upper.capacityProof === lower.capacityProof
        && upper.credits >= upper.moneyCapacity.credits && upper.energy >= upper.moneyCapacity.energy
        && upper.credits + upper.energy > lower.credits + lower.energy) return lower.capacityProof;
      return null;
    }
    function prune(index, dominator) {
      const entry = nodes[index];
      if (entry.prunedBy) return;
      const upper = nodes[dominator].resources;
      const proof = dominates(upper, entry.resources);
      entry.prunedBy = { node: dominator, proof,
        gap: Object.fromEntries(["credits", "energy"]
          .map(key => [key, upper[key] - entry.resources[key]])) };
      dominancePrunes += 1;
      if (proof === entry.resources.capacityProof) moneyCapacityPrunes += 1;
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
      const postMainPlan = !boundary && !selection && postMainPruning && node.status === "stable"
        ? port.postMainPlanSpec(node) : null;
      let localPlan = postMainPlan ? { ...postMainPlan, kind: "post-main" } : null;
      if (!boundary && !selection && !localPlan && openingPruning && node.status === "stable") {
        const opening = port.openingPlanSpec(node);
        if (opening) localPlan = { ...opening, kind: "opening" };
      }
      if (localPlan) {
        const kept = new Set(localPlan.retainedActionIds), removed = new Set(localPlan.excludedActionIds);
        if (!kept.size || !removed.size || kept.size !== localPlan.retainedActionIds.length
          || removed.size !== localPlan.excludedActionIds.length || kept.size + removed.size !== node.legalActions.length
          || node.legalActions.some(action => kept.has(action.actionId) === removed.has(action.actionId))) {
          throw new TypeError("SEARCH_LOCAL_PLAN_INVALID");
        }
      }
      if (localPlan?.kind === "post-main") {
        if (!Number.isSafeInteger(localPlan.maximumValueIncrease * 2) || localPlan.maximumValueIncrease < 0) {
          throw new TypeError("SEARCH_POST_MAIN_PROOF_INVALID");
        }
        const observation = node.observation;
        const player = observation.publicState.players.find(player => player.playerId === evaluate.seatId);
        const currentValue = evaluate(observation);
        // 所有贡献为非负整数/半整数；保留足够的精确加法空间，不以容差证明平分。
        if (!Number.isSafeInteger(player.finalScore) || player.finalScore < player.score
          || !Number.isSafeInteger(currentValue * 2) || currentValue < 0
          || currentValue * 2 + localPlan.maximumValueIncrease * 2 >= Number.MAX_SAFE_INTEGER / 2) localPlan = null;
        else { postMainProofNodes += 1; postMainExcludedActions += localPlan.excludedActionIds.length; }
      }
      if (localPlan?.kind === "opening") {
        const preparations = localPlan.passPreparationActionIds || [];
        if (!Array.isArray(preparations) || new Set(preparations).size !== preparations.length
          || preparations.some(id => !localPlan.retainedActionIds.includes(id))) throw new TypeError("SEARCH_LOCAL_PLAN_INVALID");
        const observation = node.observation, currentValue = evaluate(observation);
        const player = observation.publicState.players.find(player => player.playerId === evaluate.seatId);
        if (!Number.isSafeInteger(player.finalScore) || player.finalScore < player.score
          || !Number.isSafeInteger(currentValue * 2) || currentValue < 0 || currentValue > Number.MAX_SAFE_INTEGER / 64) localPlan = null;
        else { openingProofNodes += 1; openingExcludedActions += localPlan.excludedActionIds.length; }
      }
      const retainedActions = localPlan ? node.legalActions.filter(action => localPlan.retainedActionIds.includes(action.actionId))
        : node.legalActions;
      const alternatives = selection ? port.selectionPlans(node)
        : retainedActions.map(action => {
          const openingPass = localPlan?.kind === "opening" && localPlan.passPreparationActionIds?.includes(action.actionId);
          if (openingPass && typeof port.expandOpeningPass !== "function") throw new TypeError("SEARCH_OPENING_PASS_PORT_INVALID");
          return { firstActionId: action.actionId, submissions: openingPass ? 2 : 1, ...(openingPass ? { openingPass: true } : {}) };
        });
      const alternativeCount = selection ? Array.from({ length: selection.requiredCount }, (_, i) =>
        (selection.cardIds.length - i) / (selection.unordered ? i + 1 : 1))
        .reduce((count, n) => count * n, 1) : retainedActions.length;
      let resources = !boundary && !selection && useMoneyCapacity ? port.openingMoneyCapacity(node) : null;
      if (resources?.moneyCapacity) {
        const currentValue = evaluate(node.observation);
        if (!Number.isSafeInteger(currentValue * 2) || currentValue < 0 || currentValue > Number.MAX_SAFE_INTEGER / 64) resources = null;
      }
      if (!resources && !boundary && !selection && useResourceDominance) {
        resources = port.postMainResourceOrder(node) || port.openingResourceOrder?.(node) || null;
        if (!resources && limits.transitions <= 4096 && stateValue?.isDefaultStateValueEvaluator?.(evaluate)) {
          resources = port.knownCardMoneyOrder?.(node) || null;
          if (resources) {
            let value;
            resources = { ...resources, moneyValue: () => value ??= evaluate(node.observation) };
          }
        }
      }
      nodes.push({ node, edges: [], selection, alternatives, alternativeCount, resources, localPlan,
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
      let bound = null, upperBound = null, boundChecked = false;
      if (useCardTradePruning && incumbent && entry.node.status === "decision") {
        if (now() - startedAt >= limits.milliseconds) { stopReason = "watchdog"; break; }
        bound = port.cardTradeBound(entry.node); boundChecked = true;
        upperBound = bound
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
      if (cardChoiceEquivalence && !entry.selection && entry.node.status === "decision" && entry.node.legalActions.length > 1
        && entry.node.legalActions.every(action => action.family === "choose_card")) {
        if (now() - startedAt >= limits.milliseconds) { stopReason = "watchdog"; break; }
        const tradeChoice = entry.node.legalActions.every(action => action.target?.kind === "trade-card-selection");
        if (!boundChecked && tradeChoice) bound = port.cardTradeBound(entry.node);
        const passChoice = !tradeChoice && port.passReserveChoiceSpec?.(entry.node);
        if (passChoice) bound = passChoice;
        if ((tradeChoice || passChoice) && bound?.handDelta === 1) {
          const expectedValue = upperBound ?? stateValue.evaluateHandCountDelta(evaluate, entry.node.observation, 1);
          if (now() - startedAt >= limits.milliseconds) { stopReason = "watchdog"; break; }
          const actionIds = entry.node.legalActions.map(action => action.actionId).sort();
          if (new Set(actionIds).size !== actionIds.length) throw new TypeError("SEARCH_LOCAL_PLAN_INVALID");
          entry.localPlan = { kind: "card-choice", proof: passChoice ? passChoice.proof : "seti-card-trade-information-choice-value-equivalence-v1",
            boundProof: bound.proof, retainedActionIds: actionIds.slice(0, 1), excludedActionIds: actionIds.slice(1), expectedValue,
            expectedStatus: passChoice ? passChoice.expectedStatus : "information-barrier" };
          entry.alternatives = [{ firstActionId: actionIds[0], submissions: 1 }];
          entry.alternativeCount = 1;
          cardChoiceProofNodes += 1; cardChoiceExcludedActions += actionIds.length - 1;
        }
      }
      for (const alternative of entry.alternatives) {
        if (entry.prunedBy) break;
        if (transitions + alternative.submissions > limits.transitions) stopReason = "transition-budget";
        else if (nodes.length >= limits.nodes) stopReason = "node-budget";
        else if (pendingFrontier > limits.frontier) stopReason = "frontier-budget";
        else if (now() - startedAt >= limits.milliseconds) stopReason = "watchdog";
        if (stopReason) break outer;
        const macro = entry.selection ? port.expandSelection(entry.node, alternative.selectedIds)
          : alternative.openingPass ? port.expandOpeningPass(entry.node, alternative.firstActionId) : null;
        const child = macro ? macro.node : port.expand(entry.node, alternative.firstActionId);
        if (macro && macro.submissions !== alternative.submissions) throw new Error("SEARCH_MACRO_COST_MISMATCH");
        transitions += alternative.submissions;
        if (macro) { if (alternative.openingPass) openingPassMacros += 1; else selectionMacros += 1; }
        const added = add(child);
        if (entry.localPlan?.kind === "card-choice" && (child.status !== entry.localPlan.expectedStatus
          || nodes[added.index].value !== entry.localPlan.expectedValue)) throw new Error("SEARCH_CARD_CHOICE_WITNESS_MISMATCH");
        if (added.equivalent) equivalents += 1;
        entry.edges.push({ actionId: alternative.firstActionId, target: added.index,
          equivalent: added.equivalent, cost: alternative.submissions,
          ...(macro ? { ...(alternative.openingPass ? { openingPass: true } : { selectedIds: alternative.selectedIds }),
            proof: alternative.openingPass ? macro.proof : alternative.proof,
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
      const start = nodes[index].localPlan?.kind !== "card-choice" && (dominancePrunes || cardTradePrunes) ? 0 : index;
      let current = start;
      for (let depth = 0; depth <= nodes.length; depth += 1) {
        const entry = nodes[current];
        if (BOUNDARIES.has(entry.node.status)) return { node: current, value: entry.value,
          distance: nodes[start].distance, scope: start === index ? "local" : "global" };
        const edge = entry.best;
        if (!edge || !(nodes[edge.target].distance < entry.distance)) break;
        current = edge.target;
      }
      throw new Error("SEARCH_LOCAL_PLAN_WITNESS_MISSING");
    }
    const lines = nodes.map((entry, index) => ({
      node: index, status: entry.node.status, boundary: entry.node.boundary || null,
      expanded: entry.expanded, edges: entry.edges,
      distance: Number.isFinite(entry.distance) ? entry.distance : null,
      value: entry.value, completion: entry.prunedBy || entry.prunedByBound ? "proof-pruned"
        : entry.value == null ? (stopReason ? "pending" : entry.covered ? "covered-by-global-pruning" : "unreachable") : "reachable",
      ...(entry.prunedBy ? { prunedBy: entry.prunedBy } : {}),
      ...(entry.prunedByBound ? { prunedByBound: entry.prunedByBound } : {}),
      ...(entry.localPlan ? { localPlan: entry.localPlan,
        excludedActions: entry.localPlan.excludedActionIds.map(actionId => ({ actionId,
          proof: entry.localPlan.proof, retainedActionIds: entry.localPlan.retainedActionIds,
          witness: retainedWitness(index), completion: complete ? "covered-by-retained-search" : "pending-retained-search",
          modelKey: evaluate.modelKey })) } : {}),
      ...(entry.edges.some(edge => edge.openingPass) ? { normalizedPreparations: entry.edges.filter(edge => edge.openingPass)
        .map(edge => ({ actionId: edge.actionId, proof: edge.proof, steps: edge.steps,
          omittedContinuationFamilies: "all-except-pass", witness: retainedWitness(index), modelKey: evaluate.modelKey })) } : {}),
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
        completion: stopReason || !edge ? "pending" : edge.openingPass ? "covered-by-opening-normal-form" : cardTradePrunes ? "covered-by-global-pruning"
          : dominancePrunes ? "covered-by-global-dominance"
          : nodes[edge.target].value == null ? "unreachable" : "complete",
        ...(dominancePrunes || cardTradePrunes || edge?.openingPass ? { valueType: "attained-lower-bound" } : {}),
        ...(edge?.openingPass ? { normalForm: edge.proof } : {}),
      };
    });
    const evidence = complete && nodes[0].selection ? nodes[0].edges.map(edge => ({
      selectedIds: edge.selectedIds, value: nodes[edge.target].value,
      distance: nodes[edge.target].value == null ? null : nodes[edge.target].distance,
    })) : null;
    let accepted = complete && now() - startedAt < limits.milliseconds;
    let certificate = accepted && evidence && modelKey && nodes[0].best
      ? port.rememberSelection?.(root, evidence, modelKey) || null : null;
    let planCertificate = null;
    if (accepted && planReuse && nodes[0].best) {
      const entries = [];
      let current = 0;
      while (entries.length < 32 && !BOUNDARIES.has(nodes[current].node.status)) {
        const entry = nodes[current], best = entry.best;
        if (!best) throw new Error("SEARCH_PLAN_WITNESS_MISSING");
        const roots = entry.node.legalActions.map(action => {
          const edge = entry.edges.find(edge => edge.actionId === action.actionId);
          const exclusion = entry.localPlan?.excludedActionIds.includes(action.actionId) ? entry.localPlan.proof : null;
          return { actionId: action.actionId, value: exclusion ? null : edge ? nodes[edge.target].value : null,
            valueType: exclusion ? "not-executed" : "attained-lower-bound", completion: "covered-by-prior-complete-window",
            sourceNode: current, ...(exclusion ? { proof: exclusion } : {}),
            ...(entry.selection ? { proof: entry.selection.proof, equivalentExitSet: !action.target?.confirm } : {}) };
        });
        entries.push({ node: entry.node, actionId: best.actionId, value: entry.value, distance: entry.distance, sourceNode: current, roots });
        if (best.cost !== 1) break;
        current = best.target;
      }
      planCertificate = port.rememberPlan(entries, planKey, { searchVersion: VERSION, rootNode: 0,
        nodeCount: nodes.length, boundaryWitness: retainedWitness(0), rootValue: nodes[0].value });
    }
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
      planContinuation: accepted ? planCertificate?.token || null : null,
      planEvidence: accepted && planCertificate ? { evidenceId: planCertificate.evidenceId,
        proof: "seti-complete-window-best-prefix-reuse-v1", nodeCount: nodes.length } : null,
      value: accepted ? nodes[0].value : null,
      stopReason: stopReason || (!accepted ? "watchdog" : nodes[0].value == null ? "no-reachable-boundary" : null),
      scope: "own-visible-decision-window-to-owner-information-or-terminal-boundary",
      roots, lines, unresolved,
      diagnostics: { transitions, nodes: nodes.length, equivalents, selectionMacros, peakFrontier,
        dominancePrunes, resourceDominance: useResourceDominance ? "enabled"
          : resourceDominance ? "disabled-for-selection-certificate" : "off",
        moneyCapacityPrunes, moneyCapacityDominance: useMoneyCapacity ? "enabled"
          : moneyCapacityDominance ? "disabled-for-selection-certificate" : "off",
        cardTradePrunes, cardTradePruning: useCardTradePruning ? "enabled"
          : cardTradePruning ? "disabled-for-selection-certificate" : "off",
        postMainProofNodes, postMainExcludedActions, postMainPruning: postMainPruning ? "enabled" : "off",
        openingProofNodes, openingExcludedActions, openingPruning: openingPruning ? "enabled" : "off",
        openingPassMacros,
        cardChoiceProofNodes, cardChoiceExcludedActions, cardChoiceEquivalence: cardChoiceEquivalence ? "enabled" : "off",
        ...(useResourceDominance || useMoneyCapacity || useCardTradePruning || postMainPruning || openingPruning || cardChoiceEquivalence
          ? { resourceModelKey: evaluate.modelKey } : {}),
        continuation: reused ? (reused.hit ? "validation-watchdog" : reused.reason) : "not-requested",
        planContinuation: reusedPlan ? (reusedPlan.hit ? "validation-watchdog" : reusedPlan.reason) : planReuse ? "not-requested" : "off",
        milliseconds: elapsed, limits },
    };
  }

  return Object.freeze({ VERSION, DEFAULT_BUDGET, searchDecision });
});
