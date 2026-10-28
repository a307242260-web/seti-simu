(function (root, factory) {
  "use strict";
  const api = factory(typeof module === "object" && module.exports ? require("./state-value") : root.SetiStateValue);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SetiDecisionSearch = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (stateValue) {
  "use strict";

  const VERSION = "seti-complete-decision-search-v36";
  const BOUNDARIES = new Set(["terminal", "other-owner", "information-barrier"]);
  // 这是单决策诊断额度，不是允许截断的棋力配置；超限绝不返回可提交动作。
  const DEFAULT_BUDGET = Object.freeze({ transitions: 128, nodes: 129, frontier: 128, milliseconds: 1000 });

  function searchDecision({ port, root, evaluate, budget = {}, continuation = null, planContinuation = null, planReuse = false,
    modelKey = null, movementPlanning = false, cardPickPlanning = false, resourcePlanning = false, finalMarkPlanning = false, scanPlanning = false, resourceDominance = false, moneyCapacityDominance = false, cardTradePruning = false, postMainPruning = false, openingPruning = false, cardChoiceEquivalence = false,
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
    const scope=(movementPlanning?"own-visible-window-with-goal-directed-movement-policy":"own-visible-decision-window-to-owner-information-or-terminal-boundary")+(cardPickPlanning?"+fixed-card-pick-policy":"")+(resourcePlanning?"+goal-bound-greedy-resource-policy":"")+(finalMarkPlanning?"+local-final-mark-policy":"")+(scanPlanning?"+scan-purpose-policy":"");
    if (movementPlanning && typeof port.goalMovementSpec !== "function") throw new TypeError("SEARCH_MOVEMENT_PORT_REQUIRED");
    port.setMovementPlanning?.(movementPlanning);
    if(cardPickPlanning&&typeof port.expandWithCardPick!=="function")throw new TypeError("SEARCH_CARD_PICK_PORT_REQUIRED");
    port.setCardPickPlanning?.(cardPickPlanning);
    if(resourcePlanning&&typeof port.expandResourcePlan!=="function")throw new TypeError("SEARCH_RESOURCE_PORT_REQUIRED");
    port.setResourcePlanning?.(resourcePlanning);
    if(scanPlanning&&!resourcePlanning)throw new TypeError("SEARCH_SCAN_RESOURCE_PLANNING_REQUIRED");
    if((finalMarkPlanning||scanPlanning)&&typeof port.setDecisionPlanning!=="function")throw new TypeError("SEARCH_LOCAL_PLANNING_PORT_REQUIRED");
    port.setDecisionPlanning?.({finalMarkPlanning,scanPlanning});
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
      cardTradePruning, postMainPruning, openingPruning, cardChoiceEquivalence, movementPlanning, cardPickPlanning, resourcePlanning, finalMarkPlanning, scanPlanning]);
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
      stopReason: null, scope,
      roots: hit.roots, lines: [], unresolved: [],
      diagnostics: { finalMarkPlanning:finalMarkPlanning,scanPlanning:scanPlanning, resourcePlanning:resourcePlanning?"goal-bound-greedy-preparation":"off", cardPickPlanning:cardPickPlanning?"purpose-bound-fixed-plan":"off", movementPlanning: movementPlanning ? "goal-directed-policy" : "off", movementPolicyNodes: 0, movementDirectionsExcluded: 0, routeGeometryNodes: 0,
        nativeExecutions:0,logicalResourceInputs:0,sharedResourceInputHits:0,sharedResourceInternalStates:0,
        fixedDataChoiceStates:0,fixedDataChoicesExcluded:0,branchingStates:0,singleAlternativeStates:0,disabledBorrowStarts:0,
        transitions: 0, nodes: 1, equivalents: 0, selectionMacros: 0, peakFrontier: 0, graphNodes: 1, certificateNodes: 0,
        postMainOptimalPlans: 0, postMainOptimalPlanSteps: 0,
        dominancePrunes: 0, resourceDominance: resourceDominance
          ? reused?.hit ? "disabled-for-selection-certificate" : "reused-complete-window" : "off",
        moneyCapacityPrunes: 0, moneyCapacityDominance: moneyCapacityDominance
          ? reused?.hit ? "disabled-for-selection-certificate" : "reused-complete-window" : "off",
        postMainValuePrunes: 0, scanValuePrunes: 0, scanActionPrunes: 0,
        cardTradePrunes: 0, cardTradePruning: cardTradePruning
          ? reused?.hit ? "disabled-for-selection-certificate" : "reused-complete-window" : "off",
        postMainProofNodes: 0, postMainExcludedActions: 0, postMainPruning: postMainPruning ? "enabled" : "off",
        openingProofNodes: 0, openingExcludedActions: 0, openingPruning: openingPruning ? "enabled" : "off",
        openingPassMacros: 0, postMainBorrowProofNodes: 0, postMainBorrowExcludedChoices: 0, postMainBorrowMacros: 0,
        cardChoiceProofNodes: 0, cardChoiceExcludedActions: 0, cardCornerProofNodes: 0, cardCornerExcludedActions: 0,
        preMainDataProofNodes: 0, preMainDataExcludedActions: 0,
        cardChoiceEquivalence: cardChoiceEquivalence ? "enabled" : "off",
        continuation: reused?.hit ? "hit" : reused ? reused.reason : "not-requested",
        planContinuation: reusedPlan?.hit ? "hit" : planReuse ? "not-requested" : "off",
        milliseconds: now() - startedAt, limits },
    };
    const nodes = [];
    const known = new Map();
    const queue = [];
    const resourceGroups = new Map();
    const useResourceDominance = !resourcePlanning && !movementPlanning && !cardPickPlanning && resourceDominance && !port.selectionSpec?.(root);
    const useMoneyCapacity = !resourcePlanning && !movementPlanning && !cardPickPlanning && moneyCapacityDominance && !port.selectionSpec?.(root);
    const useCardTradePruning = !resourcePlanning && cardTradePruning && !port.selectionSpec?.(root);
    const useScanBound = cardChoiceEquivalence && stateValue?.isDefaultStateValueEvaluator?.(evaluate) && !port.selectionSpec?.(root);
    const usePostMainValueBound = postMainPruning && !port.selectionSpec?.(root);
    let movementPolicyNodes = 0, movementDirectionsExcluded = 0, routeGeometryNodes = 0;
    let transitions = 0, logicalResourceInputs = 0, sharedResourceInputHits = 0;
    const sharedInternalStates=new Set();
    function resourceStateAdditions(states){
      const fresh=new Set();for(const node of states){const id=port.identity(node);if(!known.has(id)&&!sharedInternalStates.has(id))fresh.add(id);}return fresh;
    }
    let equivalents = 0;
    let selectionMacros = 0;
    let peakFrontier = 0;
    let pendingFrontier = 0;
    let dominancePrunes = 0;
    let moneyCapacityPrunes = 0;
    let cardTradePrunes = 0;
    let postMainValuePrunes = 0;
    let scanValuePrunes = 0, scanActionPrunes = 0;
    let certificateNodes = 0, postMainOptimalPlans = 0, postMainOptimalPlanSteps = 0;
    let postMainProofNodes = 0, postMainExcludedActions = 0;
    let openingProofNodes = 0, openingExcludedActions = 0;
    let openingPassMacros = 0;
    let postMainBorrowProofNodes = 0, postMainBorrowExcludedChoices = 0, postMainBorrowMacros = 0;
    let cardChoiceProofNodes = 0, cardChoiceExcludedActions = 0;
    let cardCornerProofNodes = 0, cardCornerExcludedActions = 0;
    let preMainDataProofNodes = 0, preMainDataExcludedActions = 0;
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
      if(sharedInternalStates.delete(identity))certificateNodes--;
      known.set(identity, index);
      const boundary = BOUNDARIES.has(node.status) || node.status === "plan-infeasible";
      if (!boundary && !node.legalActions?.length) throw new Error("SEARCH_EMPTY_NONTERMINAL");
      const value = BOUNDARIES.has(node.status) ? evaluate(node.observation) : null;
      if (BOUNDARIES.has(node.status) && !Number.isFinite(value)) throw new Error("SEARCH_VALUE_INVALID");
      if (BOUNDARIES.has(node.status) && (!incumbent || value > incumbent.value)) incumbent = { node: index, value };
      const pickPolicy = !boundary && cardPickPlanning ? port.cardPickSpec(node) : null;
      const decisionPolicy=!boundary&&(finalMarkPlanning||resourcePlanning)?port.localDecisionSpec?.(node):null;
      const resourcePolicy=!boundary&&resourcePlanning?port.resourceSpec(node):null;
      const selection = boundary || decisionPolicy || pickPolicy?.fixed || resourcePolicy?.bound || resourcePolicy?.plans.length ? null : port.selectionSpec?.(node) || null;
      const postMainPlan = !boundary && !selection && !resourcePlanning && postMainPruning && node.status === "stable"
        ? port.postMainPlanSpec(node) : null;
      let localPlan = postMainPlan ? { ...postMainPlan, kind: "post-main" } : null;
      if (!boundary && !selection && !localPlan && !resourcePlanning && openingPruning && node.status === "stable") {
        const opening = port.openingPlanSpec(node);
        if (opening) localPlan = { ...opening, kind: "opening" };
      }
      if (!boundary && !selection && !resourcePlanning && openingPruning && node.status === "stable") {
        const data = port.preMainDataPlanSpec?.(node);
        const fresh = data?.excludedActionIds.filter(id => !localPlan?.excludedActionIds.includes(id));
        if (fresh?.length) {
          const previous = localPlan;
          localPlan = previous ? { ...previous, proof: "seti-composed-before-main-strict-plans-v1",
            componentPlans: [previous, { ...data, kind: "pre-main-data" }],
            retainedActionIds: previous.retainedActionIds.filter(id => !fresh.includes(id)),
            excludedActionIds: [...previous.excludedActionIds, ...fresh] }
            : { ...data, kind: "pre-main-data" };
          localPlan.preMainDataExcludedActions = fresh.length;
        }
      }
      if (!boundary && !selection && !localPlan && !resourcePlanning && cardChoiceEquivalence && node.status === "stable") {
        const corners = port.postMainCornerChoiceSpec?.(node);
        if (corners) localPlan = { ...corners, kind: "card-corner-choice" };
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
      if (["opening", "pre-main-data"].includes(localPlan?.kind)) {
        const preparations = localPlan.passPreparationActionIds || [];
        if (!Array.isArray(preparations) || new Set(preparations).size !== preparations.length
          || preparations.some(id => !localPlan.retainedActionIds.includes(id))) throw new TypeError("SEARCH_LOCAL_PLAN_INVALID");
        const observation = node.observation, currentValue = evaluate(observation);
        const player = observation.publicState.players.find(player => player.playerId === evaluate.seatId);
        if (!Number.isSafeInteger(player.finalScore) || player.finalScore < player.score
          || !Number.isSafeInteger(currentValue * 2) || currentValue < 0 || currentValue > Number.MAX_SAFE_INTEGER / 64) localPlan = null;
        else {
          if (localPlan.kind === "opening") { openingProofNodes += 1; openingExcludedActions += localPlan.excludedActionIds.length; }
          if (localPlan.preMainDataExcludedActions) {
            preMainDataProofNodes += 1; preMainDataExcludedActions += localPlan.preMainDataExcludedActions;
          }
        }
      }
      if (localPlan?.kind === "card-corner-choice") {
        cardCornerProofNodes += 1; cardCornerExcludedActions += localPlan.excludedActionIds.length;
      }
      let borrowPlan = !resourcePlanning && !boundary && !selection && !resourcePolicy?.bound && postMainPruning && limits.transitions <= 4096
        ? port.postMainBorrowSpec?.(node) : null;
      if (borrowPlan) {
        const value = evaluate(node.observation);
        if (!Number.isSafeInteger(value * 2) || value < 0 || value > Number.MAX_SAFE_INTEGER / 64) borrowPlan = null;
        else if (!borrowPlan.retainedTileIds.length && localPlan) borrowPlan = null;
      }
      if (borrowPlan) {
        postMainBorrowProofNodes += 1; postMainBorrowExcludedChoices += borrowPlan.excludedTileIds.length;
        if (!borrowPlan.retainedTileIds.length) localPlan = { kind: "post-main-borrow-skip", proof: borrowPlan.proof,
          retainedActionIds: node.legalActions.filter(action => action.actionId !== borrowPlan.industryActionId).map(action => action.actionId),
          excludedActionIds: [borrowPlan.industryActionId] };
      }
      const needsMovementPlan = !resourcePolicy?.bound && node.legalActions.some(action => (!localPlan || localPlan.retainedActionIds.includes(action.actionId))
        && (Number.isInteger(action.target?.deltaX) || action.target?.kind === "move-payment"
          || action.target?.tradeId === "energy-for-move" || action.family === "card_corner" && action.payload?.kind === "move"));
      const movementPolicy = movementPlanning && !boundary && needsMovementPlan ? port.goalMovementSpec(node) : null;
      if (movementPolicy) {
        movementPolicyNodes += 1; movementDirectionsExcluded += movementPolicy.excludedDirectionCount;
        routeGeometryNodes += movementPolicy.routingNodes;
      }
      const retainedActions = node.legalActions.filter(action => (!localPlan || localPlan.retainedActionIds.includes(action.actionId))
        && (!movementPolicy || movementPolicy.retainedActionIds.includes(action.actionId))
        && (!pickPolicy || pickPolicy.retainedActionIds.includes(action.actionId))
        && (!resourcePolicy || resourcePolicy.retainedActionIds.includes(action.actionId))
        && (!decisionPolicy||decisionPolicy.retainedActionIds.includes(action.actionId)));
      if (!boundary && !retainedActions.length && !resourcePolicy?.plans.length && !resourcePolicy?.bound) throw new Error("SEARCH_MOVEMENT_POLICY_CONFLICT");
      const alternatives = selection ? port.selectionPlans(node)
        : retainedActions.flatMap(action => {
          if (movementPolicy?.plan && movementPolicy.selectedActionId === action.actionId
            && movementPolicy.intent.path.length && Number.isInteger(action.target?.deltaX)) return {
            firstActionId: action.actionId, submissions: movementPolicy.intent.path.length*2+3,
            goalPlan: movementPolicy.plan };
          if (borrowPlan?.industryActionId === action.actionId) return borrowPlan.retainedTileIds.map(tileId => ({
            firstActionId: action.actionId, submissions: 2, borrowTileId: tileId }));
          const pickPlan=pickPolicy?.selectedActionId===action.actionId?pickPolicy:null;
          const openingPass = localPlan?.kind === "opening" && localPlan.passPreparationActionIds?.includes(action.actionId);
          if (openingPass && typeof port.expandOpeningPass !== "function") throw new TypeError("SEARCH_OPENING_PASS_PORT_INVALID");
          return { firstActionId: action.actionId, submissions: openingPass ? 2 : 1, ...(pickPlan?{cardPickPlan:pickPlan}:{}), ...(openingPass ? { openingPass: true } : {}) };
        });
      if(resourcePolicy?.plans.length)alternatives.push(...resourcePolicy.plans.map(plan=>({firstActionId:plan.firstActionId,submissions:1,resourcePlan:plan})));
      const alternativeCount = selection ? Array.from({ length: selection.requiredCount }, (_, i) =>
        (selection.cardIds.length - i) / (selection.unordered ? i + 1 : 1))
        .reduce((count, n) => count * n, 1) : alternatives.length;
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
      nodes.push({ node, edges: [], selection, alternatives, alternativeCount, resources, localPlan, borrowPlan,
        movementPolicy, pickPolicy, resourcePolicy, decisionPolicy, expanded: boundary || resourcePolicy?.step?.kind==="infeasible", value, distance: boundary ? 0 : Infinity, best: null });
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
      if (!nodes[index].expanded && !nodes[index].prunedBy) {
        queue.push(index); nodes[index].queued = true; pendingFrontier += 1;
      }
      peakFrontier = Math.max(peakFrontier, pendingFrontier);
      return { index, equivalent: false };
    }
    add(root);
    outer: while (queue.length) {
      const entry = nodes[queue.pop()];
      if (entry.prunedBy) {  continue; }
      if (usePostMainValueBound && incumbent && entry.node.status === "stable") {
        if (now() - startedAt >= limits.milliseconds) { stopReason = "watchdog"; break; }
        const bound = port.postMainValueBound?.(entry.node);
        if (bound) {
          const currentValue = evaluate(entry.node.observation);
          const player = entry.node.observation.publicState.players.find(player => player.playerId === evaluate.seatId);
          const increase = bound.maximumValueIncrease;
          if (!Number.isSafeInteger(increase*2) || increase < 0) throw new TypeError("SEARCH_POST_MAIN_BOUND_INVALID");
          const safe = [currentValue,increase].every(value => Number.isSafeInteger(value*2) && value >= 0
            && value < Number.MAX_SAFE_INTEGER/64) && player.finalScore === player.score;
          const upperBound = safe ? currentValue+increase : null;
          if (now() - startedAt >= limits.milliseconds) { stopReason = "watchdog"; break; }
          if (upperBound != null && incumbent.value > upperBound) {
            entry.prunedByBound = { ...incumbent, upperBound, proof: bound.proof, modelKey: evaluate.modelKey,
              boundKind: "post-main-continuation", currentValue, bound };
            postMainValuePrunes += 1;
            if (entry.queued) { entry.queued = false; pendingFrontier -= 1; }
             continue;
          }
        }
      }
      if (useScanBound && incumbent && entry.node.status === "decision") {
        if(now()-startedAt>=limits.milliseconds){stopReason="watchdog";break;}
        const bound=port.standardScanValueBound?.(entry.node);
        if(bound){const currentValue=evaluate(entry.node.observation),player=entry.node.observation.publicState.players.find(p=>p.playerId===evaluate.seatId);
          const upperBound=currentValue+bound.valueDelta;
          if(!Number.isSafeInteger(bound.valueDelta*2))throw new TypeError("SEARCH_SCAN_BOUND_INVALID");
          if(now()-startedAt>=limits.milliseconds){stopReason="watchdog";break;}
          if(player.finalScore===player.score && [currentValue,upperBound].every(v=>Number.isSafeInteger(v*2)&&v>=0&&v<Number.MAX_SAFE_INTEGER/64) && incumbent.value>upperBound){
            entry.prunedByBound={...incumbent,upperBound,proof:bound.proof,modelKey:evaluate.modelKey,boundKind:"standard-scan-refill",currentValue,bound};scanValuePrunes+=1;
            if(entry.queued){entry.queued=false;pendingFrontier-=1;}continue;
          }
        }
      }
      const optimal = usePostMainValueBound && !entry.resourcePolicy?.bound && entry.node.status === "stable" ? port.postMainOptimalPlanSpec?.(entry.node) : null;
      if (optimal && transitions+optimal.submissions <= limits.transitions
        && nodes.length+certificateNodes+optimal.submissions <= limits.nodes
        && pendingFrontier+optimal.submissions-1 <= limits.frontier) {
        const currentValue = evaluate(entry.node.observation), increase = optimal.bound.maximumValueIncrease;
        const safe = [currentValue,increase].every(value => Number.isSafeInteger(value*2) && value >= 0 && value < Number.MAX_SAFE_INTEGER/64);
        if (safe) {
          const macro = port.expandPostMainOptimalPlan(entry.node, () => now()-startedAt < limits.milliseconds);
          transitions += macro.submissions; certificateNodes += macro.submissions;
          postMainOptimalPlanSteps += macro.submissions;
          peakFrontier = Math.max(peakFrontier,pendingFrontier+macro.submissions-(macro.complete?1:0));
          if (!macro.complete) {
            entry.attainmentAttempt = { proof: optimal.proof, submissions: macro.submissions,
              steps: macro.prefixes.map(prefix => prefix.action.actionId), pendingCertificateStates: macro.submissions };
            stopReason = "watchdog"; break;
          }
          if (macro.submissions !== optimal.submissions || !BOUNDARIES.has(macro.node.status)
            || evaluate(macro.node.observation) !== currentValue+increase) throw new Error("SEARCH_ATTAINED_BOUND_WITNESS_MISMATCH");
          certificateNodes -= 1;
          const added = add(macro.node), first = macro.prefixes[0].action.actionId;
          if (nodes[added.index].value !== currentValue+increase) throw new Error("SEARCH_ATTAINED_BOUND_IDENTITY_MISMATCH");
          if (added.equivalent) equivalents += 1;
          entry.optimalAttainment = macro;
          entry.attainedPlan = { ...optimal, ...(resourcePlanning?{resourceGoal:optimal.income?"data:income:4":"end-turn"}:{}), expectedValue: currentValue+increase, actualBoundary: added.index,
            certificatePrefixes: macro.prefixes.length, minimumInputs: optimal.submissions };
          const excluded = entry.node.legalActions.filter(action => action.actionId !== first).map(action => action.actionId);
          entry.localPlan = excluded.length ? { kind: "post-main-attained-bound", proof: optimal.proof,
            retainedActionIds: [first], excludedActionIds: excluded } : null;
          entry.edges = [{ actionId: first, target: added.index, cost: macro.submissions, equivalent: added.equivalent,
            optimalPlan: true, proof: optimal.proof, steps: macro.prefixes.map(prefix => prefix.action.actionId) }];
          entry.alternatives = [{ firstActionId: first, submissions: macro.submissions }]; entry.alternativeCount = 1;
          entry.expanded = true; postMainOptimalPlans += 1;
          if (entry.queued) { entry.queued = false; pendingFrontier -= 1; }
           continue;
        }
      }
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
          
          continue;
        }
      }
      if (cardChoiceEquivalence && !entry.resourcePolicy && !entry.selection && !entry.pickPolicy?.fixed && entry.node.status === "decision" && entry.node.legalActions.length > 1
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
        if(useScanBound && incumbent && entry.node.status==="stable" && entry.node.legalActions.some(action=>action.actionId===alternative.firstActionId && action.family==="scan" && action.target?.kind==="standard-scan")){
          if(now()-startedAt>=limits.milliseconds){stopReason="watchdog";break outer;}
          const bound=port.standardScanValueBound?.(entry.node);
          if(bound){const currentValue=evaluate(entry.node.observation),player=entry.node.observation.publicState.players.find(p=>p.playerId===evaluate.seatId),upperBound=currentValue+bound.valueDelta;
            if(!Number.isSafeInteger(bound.valueDelta*2))throw new TypeError("SEARCH_SCAN_BOUND_INVALID");
            if(now()-startedAt>=limits.milliseconds){stopReason="watchdog";break outer;}
            if(player.finalScore===player.score && [currentValue,upperBound].every(v=>Number.isSafeInteger(v*2)&&v>=0&&v<Number.MAX_SAFE_INTEGER/64) && incumbent.value>upperBound){
              (entry.actionBounds ||= []).push({actionId:alternative.firstActionId,...incumbent,upperBound,proof:bound.proof,modelKey:evaluate.modelKey,boundKind:"standard-scan-refill",currentValue,bound});scanActionPrunes+=1;continue;
            }
          }
        }
        if (!alternative.resourcePlan && transitions + alternative.submissions > limits.transitions) stopReason = "transition-budget";
        else if (!alternative.resourcePlan && nodes.length+certificateNodes+(alternative.goalPlan ? alternative.submissions-1 : 0) >= limits.nodes) stopReason = "node-budget";
        else if (!alternative.resourcePlan && pendingFrontier+(alternative.goalPlan ? alternative.submissions-1 : 0) > limits.frontier) stopReason = "frontier-budget";
        else if (now() - startedAt >= limits.milliseconds) stopReason = "watchdog";
        if (stopReason) break outer;
        if(alternative.resourcePlan){
          const fixed=port.expandResourcePlan(entry.node,alternative.resourcePlan,(count,contexts,input,work)=>{
            if(now()-startedAt>=limits.milliseconds)return "watchdog";
            const inputs=work?work.newSubmissions+(input?work.nextNewInput:0):count+(input?1:0);
            const fresh=work?resourceStateAdditions([...work.sharedStates,...(work.nextNode?[work.nextNode]:[])]).size+(work.additionalStates||0):count+contexts+(input?1:0);
            if(transitions+inputs>limits.transitions)return "transition-budget";
            if(nodes.length+certificateNodes+fresh>limits.nodes)return "node-budget";
            if(pendingFrontier+Math.max(0,fresh-1)>limits.frontier)return "frontier-budget";
            return null;
          });
          const newInputs=fixed.newSubmissions??fixed.submissions;
          transitions+=newInputs;logicalResourceInputs+=fixed.submissions;sharedResourceInputHits+=fixed.submissions-newInputs;
          const fresh=fixed.sharedStates?resourceStateAdditions(fixed.sharedStates):null;
          if(fresh){for(const id of fresh)sharedInternalStates.add(id);certificateNodes+=fresh.size;}
          else certificateNodes+=fixed.submissions+fixed.contexts;
          peakFrontier=Math.max(peakFrontier,pendingFrontier+(fresh?Math.max(0,fresh.size-1):fixed.submissions+fixed.contexts-(fixed.complete?1:0)));
          if(!fixed.complete){entry.resourceAttempt={goal:fixed.goal,submissions:fixed.submissions,preparations:fixed.preparations};stopReason=fixed.stopReason;break outer;}
          if(!fixed.submissions)throw new Error("SEARCH_RESOURCE_PLAN_EMPTY");
          if(!fresh)certificateNodes-=1;const added=add(fixed.node);if(added.equivalent)equivalents+=1;
          entry.edges.push({actionId:alternative.firstActionId,target:added.index,cost:fixed.submissions,equivalent:added.equivalent,
            newInputs,sharedPath:fixed.sharedPath||[],resourcePlan:alternative.resourcePlan,goalStatus:fixed.goalStatus,fallbackReason:fixed.fallbackReason||null,
            preparations:fixed.preparations,steps:fixed.prefixes.map(p=>p.action.actionId)});
          continue;
        }
        const goalExecution = alternative.goalPlan ? port.expandGoalMovementPlan(entry.node, () => now()-startedAt < limits.milliseconds) : null;
        if (goalExecution) {
          if (goalExecution.complete && goalExecution.submissions < 1 || goalExecution.submissions > alternative.submissions
            || goalExecution.prefixes.length !== goalExecution.submissions
            || goalExecution.prefixes.length && goalExecution.prefixes[0].action.actionId !== alternative.firstActionId) throw new Error("SEARCH_GOAL_PLAN_COST_INVALID");
          transitions += goalExecution.submissions;
          certificateNodes += goalExecution.submissions;
          peakFrontier = Math.max(peakFrontier,pendingFrontier+goalExecution.submissions-1);
          if (!goalExecution.complete) {
            entry.goalAttempt = { goal: goalExecution.goal, submissions: goalExecution.submissions };
            stopReason = "watchdog"; break outer;
          }
          certificateNodes -= 1;
          const added = add(goalExecution.node);
          if (added.equivalent) equivalents += 1;
          entry.goalExecutions ||= new Map(); entry.goalExecutions.set(alternative.firstActionId,goalExecution);
          entry.edges.push({ actionId: alternative.firstActionId, target: added.index, cost: goalExecution.submissions,
            equivalent: added.equivalent, goalPlan: alternative.goalPlan, goalStatus: goalExecution.goalStatus,
            steps: goalExecution.prefixes.map(p => p.action.actionId) });
          continue;
        }
        if(cardPickPlanning&&!entry.selection&&!alternative.openingPass&&!alternative.borrowTileId){
          const fixed=port.expandWithCardPick(entry.node,alternative.firstActionId,count=>{
            if(now()-startedAt>=limits.milliseconds)return "watchdog";
            if(transitions+count+1>limits.transitions)return "transition-budget";
            if(nodes.length+certificateNodes+count+1>limits.nodes)return "node-budget";
            if(pendingFrontier+count>limits.frontier)return "frontier-budget";
            return null;
          });
          transitions+=fixed.submissions;certificateNodes+=fixed.submissions;
          peakFrontier=Math.max(peakFrontier,pendingFrontier+Math.max(0,fixed.submissions-1));
          if(!fixed.complete){entry.fixedCardAttempt={submissions:fixed.submissions,fixedChoices:fixed.fixedChoices};stopReason=fixed.stopReason;break outer;}
          if(!fixed.submissions)throw new Error("SEARCH_FIXED_CARD_PLAN_EMPTY");
          certificateNodes-=1;const added=add(fixed.node);if(added.equivalent)equivalents+=1;
          entry.fixedCardExecutions ||= new Map();entry.fixedCardExecutions.set(alternative.firstActionId,fixed);
          entry.edges.push({actionId:alternative.firstActionId,target:added.index,cost:fixed.submissions,equivalent:added.equivalent,
            fixedCardPlan:alternative.cardPickPlan||null,fixedChoices:fixed.fixedChoices,steps:fixed.prefixes.map(p=>p.action.actionId)});
          continue;
        }
        const macro = entry.selection ? port.expandSelection(entry.node, alternative.selectedIds)
          : alternative.openingPass ? port.expandOpeningPass(entry.node, alternative.firstActionId)
            : alternative.borrowTileId ? port.expandPostMainBorrow(entry.node, alternative.borrowTileId) : null;
        const child = macro ? macro.node : port.expand(entry.node, alternative.firstActionId);
        if (macro && macro.submissions !== alternative.submissions) throw new Error("SEARCH_MACRO_COST_MISMATCH");
        transitions += alternative.submissions;
        if (macro) { if (alternative.openingPass) openingPassMacros += 1;
          else if (alternative.borrowTileId) postMainBorrowMacros += 1; else selectionMacros += 1; }
        const added = add(child);
        if (entry.localPlan?.kind === "card-choice" && (child.status !== entry.localPlan.expectedStatus
          || nodes[added.index].value !== entry.localPlan.expectedValue)) throw new Error("SEARCH_CARD_CHOICE_WITNESS_MISMATCH");
        if (added.equivalent) equivalents += 1;
        entry.edges.push({ actionId: alternative.firstActionId, target: added.index,
          equivalent: added.equivalent, cost: alternative.submissions,
          ...(macro ? { ...(alternative.openingPass ? { openingPass: true } : alternative.borrowTileId ? { borrowTileId: alternative.borrowTileId } : { selectedIds: alternative.selectedIds }),
            proof: alternative.openingPass || alternative.borrowTileId ? macro.proof : alternative.proof,
            steps: macro.actions.map(action => action.actionId) } : {}) });
        if (now() - startedAt >= limits.milliseconds) {
          stopReason = "watchdog";
          break outer;
        }
      }
      entry.expanded = !entry.prunedBy;
      if (entry.queued) { entry.queued = false; pendingFrontier -= 1; }
      
    }

    // 在完整有向图上从叶逆向传播；保留回边，不能把 DFS 栈上的节点误判成无解。
    // 分数相同优先最短路径，避免选中零收益循环。启发式分数不参与任何剪枝。
    if (!stopReason) {
      const parents = nodes.map(() => []);
      nodes.forEach((entry, index) => entry.edges.forEach(edge => parents[edge.target].push({ index, edge })));
      const covered = nodes.flatMap((entry, index) => entry.prunedBy || entry.prunedByBound || entry.actionBounds?.length ? [index] : []);
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
      node: index, ...(entry.resourcePolicy?{resourceGoals:entry.alternatives.slice(entry.edges.length+(entry.actionBounds?.length||0)).filter(a=>a.resourcePlan).map(a=>({goalId:a.resourcePlan.goal.id,mode:a.resourcePlan.mode,firstActionId:a.firstActionId,fallbackReason:a.resourcePlan.fallbackReason||null}))}:{}), actionIds: (entry.selection ? entry.node.legalActions
        : entry.alternatives.slice(entry.edges.length+(entry.actionBounds?.length||0)).map(alternative => ({ actionId: alternative.firstActionId })))
        .map(action => action.actionId),
      ...(entry.attainmentAttempt ? { attainmentAttempt: entry.attainmentAttempt } : {}),
      ...(entry.goalAttempt ? { goalAttempt: entry.goalAttempt } : {}),
      ...(entry.fixedCardAttempt ? { fixedCardAttempt: entry.fixedCardAttempt } : {}),
      ...(entry.resourceAttempt?{resourceAttempt:entry.resourceAttempt}:{}),
      ...(entry.selection ? { selectionPlansRemaining: entry.alternativeCount - entry.edges.length,
        selection: entry.selection } : {}),
    }]);
    const complete = !stopReason;
    function retainedWitness(index) {
      if (!complete) return null;
      const start = nodes[index].localPlan?.kind !== "card-choice" && (dominancePrunes || cardTradePrunes || postMainBorrowProofNodes || postMainValuePrunes || scanValuePrunes || scanActionPrunes) ? 0 : index;
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
      expanded: entry.expanded, alternatives:entry.alternativeCount, edges: entry.edges,
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
      ...(entry.borrowPlan ? { borrowPlan: { ...entry.borrowPlan, witness: retainedWitness(index),
        completion: complete ? "covered-by-origin-search" : "pending-origin-search", modelKey: evaluate.modelKey } } : {}),
      ...(entry.movementPolicy ? { movementPolicy: entry.movementPolicy } : {}),
      ...(entry.pickPolicy ? { cardPickPolicy: entry.pickPolicy } : {}),
      ...(entry.resourcePolicy?{resourcePolicy:entry.resourcePolicy}:{}),
      ...(entry.decisionPolicy?{decisionPolicy:entry.decisionPolicy}:{}),
      ...(entry.actionBounds ? { actionBounds: entry.actionBounds } : {}),
      ...(entry.attainedPlan ? { attainedPlan: entry.attainedPlan } : {}),
      ...(entry.attainmentAttempt ? { attainmentAttempt: entry.attainmentAttempt } : {}),
      ...(entry.goalAttempt ? { goalAttempt: entry.goalAttempt } : {}),
      ...(entry.fixedCardAttempt ? { fixedCardAttempt: entry.fixedCardAttempt } : {}),
      ...(entry.resourceAttempt?{resourceAttempt:entry.resourceAttempt}:{}),
      ...(entry.selection ? { selection: entry.selection, orderedExitCount: entry.alternativeCount } : {}),
    }));
    const roots = root.legalActions.map(action => {
      const excluded = lines[0].excludedActions?.find(exclusion => exclusion.actionId === action.actionId);
      if (excluded) return { actionId: action.actionId, target: null, value: null,
        completion: complete ? "proof-pruned" : "pending-retained-search", valueType: "not-executed", prunedByPlan: excluded };
      const actionBound=nodes[0].actionBounds?.find(bound=>bound.actionId===action.actionId);
      if(actionBound)return {actionId:action.actionId,target:null,value:null,valueType:"not-executed",completion:"proof-pruned",prunedByActionBound:actionBound};
      if(nodes[0].pickPolicy?.excludedActionIds.includes(action.actionId))return{actionId:action.actionId,target:null,value:null,valueType:"not-executed",
        completion:"excluded-by-card-pick-policy",policy:nodes[0].pickPolicy.policy,goal:nodes[0].pickPolicy.goal,isEquivalence:false};
      if (nodes[0].movementPolicy?.excludedActionIds.includes(action.actionId)) return {
        actionId: action.actionId, target: null, value: null, valueType: "not-executed",
        completion: "excluded-by-movement-policy", policy: nodes[0].movementPolicy.policy,
        chosenGoal: nodes[0].movementPolicy.chosenGoal, isEquivalence: false };
      if(nodes[0].resourcePolicy?.excludedActionIds.includes(action.actionId)&&!nodes[0].edges.some(e=>e.actionId===action.actionId))return{actionId:action.actionId,target:null,value:null,valueType:"not-executed",completion:"excluded-by-resource-policy",policy:nodes[0].resourcePolicy.policy,isEquivalence:false};
      if(nodes[0].decisionPolicy?.excludedActionIds.includes(action.actionId))return{actionId:action.actionId,target:null,value:null,valueType:"not-executed",completion:"excluded-by-local-decision-policy",policy:nodes[0].decisionPolicy.policy,isEquivalence:false};
      const selection = nodes[0].selection;
      // 纯点击的强连通部分可到达同一完整出口集；confirm 直接离开，只对应当前选择。
      const edge = selection && action.target?.confirm ? nodes[0].edges.find(edge =>
        JSON.stringify(edge.selectedIds) === JSON.stringify(selection.selectedIds))
        : nodes[0].edges.filter(edge => edge.actionId === action.actionId).sort((a,b)=>(nodes[b.target].value??-Infinity)-(nodes[a.target].value??-Infinity)||nodes[a.target].distance+a.cost-nodes[b.target].distance-b.cost)[0];
      if (selection && !action.target?.confirm) return {
        actionId: action.actionId, target: null, value: nodes[0].value,
        completion: stopReason ? "pending" : nodes[0].value == null ? "unreachable" : "complete",
        proof: selection.proof, equivalentExitSet: true,
      };
      return {
        actionId: action.actionId, target: edge?.target ?? null,
        value: edge ? nodes[edge.target].value : null,
        ...(edge?.resourcePlan?{kind:"resource-goal-plan",goal:edge.resourcePlan.goal,resourceGoalCount:nodes[0].edges.filter(e=>e.actionId===action.actionId&&e.resourcePlan).length}:{}),
        ...(edge?.goalPlan ? {kind:"goal-plan",plan:edge.goalPlan} : {}),
        completion: stopReason || !edge ? "pending" : edge.openingPass ? "covered-by-opening-normal-form" : cardTradePrunes ? "covered-by-global-pruning"
          : scanValuePrunes || scanActionPrunes ? "covered-by-global-scan-bound" : postMainValuePrunes ? "covered-by-global-value-bound" : postMainBorrowProofNodes ? "covered-by-global-borrow-simulation" : dominancePrunes ? "covered-by-global-dominance"
          : nodes[edge.target].value == null ? "unreachable" : "complete",
        ...(dominancePrunes || cardTradePrunes || postMainBorrowProofNodes || postMainValuePrunes || scanValuePrunes || scanActionPrunes || edge?.openingPass ? { valueType: "attained-lower-bound" } : {}),
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
          const policyExclusion = entry.decisionPolicy?.excludedActionIds.includes(action.actionId)?entry.decisionPolicy.policy:entry.pickPolicy?.excludedActionIds.includes(action.actionId)?entry.pickPolicy.policy
            :entry.movementPolicy?.excludedActionIds.includes(action.actionId) ? entry.movementPolicy.policy : null;
          const exclusion = policyExclusion || (entry.localPlan?.excludedActionIds.includes(action.actionId) ? entry.localPlan.proof : entry.actionBounds?.find(bound=>bound.actionId===action.actionId)?.proof || null);
          return { actionId: action.actionId, value: exclusion ? null : edge ? nodes[edge.target].value : null,
            valueType: exclusion ? "not-executed" : "attained-lower-bound", completion: "covered-by-prior-complete-window",
            sourceNode: current, ...(exclusion ? policyExclusion ? { policy: exclusion, isEquivalence: false } : { proof: exclusion } : {}),
            ...(entry.selection ? { proof: entry.selection.proof, equivalentExitSet: !action.target?.confirm } : {}) };
        });
        entries.push({ node: entry.node, actionId: best.actionId, value: entry.value, distance: entry.distance, sourceNode: current, roots });
        // Resource preparation is replanned from physical state after every actual atomic action.
        // Do not certify interior prefixes using a goal that is not persisted in the native save.
        if(best.resourcePlan)break;
        if(entry.fixedCardExecutions?.has(best.actionId)){
          const fixed=entry.fixedCardExecutions.get(best.actionId);
          for(let i=1;i<fixed.prefixes.length&&entries.length<32;i++){
            const prefix=fixed.prefixes[i],policy=fixed.fixedChoices.find(choice=>choice.prefix===i)?.policy||"seti-purpose-card-pick-policy-v1";entries.push({node:prefix.node,actionId:prefix.action.actionId,value:entry.value,distance:entry.distance-i,
              sourceNode:`fixed-card:${current}:${i}`,roots:prefix.node.legalActions.map(action=>({actionId:action.actionId,
                value:action.actionId===prefix.action.actionId?entry.value:null,valueType:action.actionId===prefix.action.actionId?"attained-lower-bound":"not-executed",
                completion:"fixed-plan-execution",policy,isEquivalence:false}))});
          }
          current=best.target;continue;
        }
        if (best.goalPlan) {
          const macro = entry.goalExecutions.get(best.actionId);
          for (let i=1;i<macro.prefixes.length && entries.length<32;i+=1) {
            const prefix=macro.prefixes[i];
            entries.push({node:prefix.node,actionId:prefix.action.actionId,value:entry.value,distance:entry.distance-i,
              sourceNode:`goal:${current}:${i}`,roots:prefix.node.legalActions.map(action=>({actionId:action.actionId,
                value:action.actionId===prefix.action.actionId?entry.value:null,valueType:action.actionId===prefix.action.actionId?"attained-lower-bound":"not-executed",
                completion:"committed-goal-plan-execution",policy:"seti-goal-movement-policy-v1",isEquivalence:false}))});
          }
          current=best.target; continue;
        }
        if (best.optimalPlan) {
          if(resourcePlanning)break;
          const macro = entry.optimalAttainment;
          for (let i=1; i<macro.prefixes.length && entries.length<32; i+=1) {
            const prefix = macro.prefixes[i];
            entries.push({ node: prefix.node, actionId: prefix.action.actionId, value: entry.value, distance: prefix.distance,
              sourceNode: `attainment:${current}:${i}`, roots: prefix.node.legalActions.map(action => ({
                actionId: action.actionId, value: action.actionId === prefix.action.actionId ? entry.value : null,
                valueType: action.actionId === prefix.action.actionId ? "attained-lower-bound" : "not-executed",
                completion: "covered-by-attained-value-shortest-plan", proof: macro.proof, sourceNode: current, sourcePrefix: i })) });
          }
          break;
        }
        if (best.cost !== 1) break;
        current = best.target;
      }
      planCertificate = port.rememberPlan(entries, planKey, { searchVersion: VERSION, rootNode: 0,
        nodeCount: nodes.length+certificateNodes, graphNodeCount: nodes.length, certificateNodeCount: certificateNodes, boundaryWitness: retainedWitness(0), rootValue: nodes[0].value });
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
        proof: "seti-complete-window-best-prefix-reuse-v1", nodeCount: nodes.length+certificateNodes } : null,
      value: accepted ? nodes[0].value : null,
      stopReason: stopReason || (!accepted ? "watchdog" : nodes[0].value == null ? "no-reachable-boundary" : null),
      scope,
      roots, lines, unresolved,
      ...(resourcePlanning?{sharedPrefixGraph:port.getResourcePrefixGraph?.()||null}:{}),
      candidates: Array.from(nodes[0].alternatives, a => a.resourcePlan?{kind:"resource-goal-plan",plan:a.resourcePlan,firstActionId:a.firstActionId}:a.goalPlan ? {kind:"goal-plan",plan:a.goalPlan,firstActionId:a.firstActionId}
        : a.cardPickPlan?{kind:a.cardPickPlan.kind,plan:a.cardPickPlan,firstActionId:a.firstActionId}:{kind:"action",actionId:a.firstActionId}),
      diagnostics: { finalMarkPlanning:finalMarkPlanning,scanPlanning:scanPlanning, resourcePlanning:resourcePlanning?"goal-bound-greedy-preparation":"off", cardPickPlanning:cardPickPlanning?"purpose-bound-fixed-plan":"off", movementPlanning: movementPlanning ? "goal-directed-policy" : "off", movementPolicyNodes, movementDirectionsExcluded, routeGeometryNodes,
        nativeExecutions:port.getDiagnostics?.().submissionCount??null,logicalResourceInputs,sharedResourceInputHits,sharedResourceInternalStates:sharedInternalStates.size,
        localFinalMarkStates:nodes.filter(e=>e.decisionPolicy?.kind==="fixed-final-mark").length,
        localFinalMarkExcluded:nodes.reduce((n,e)=>n+(e.decisionPolicy?.kind==="fixed-final-mark"?e.decisionPolicy.excludedActionIds.length:0),0),
        fixedDataChoiceStates:nodes.filter(e=>e.decisionPolicy?.kind==="fixed-data-choice").length,
        fixedDataChoicesExcluded:nodes.reduce((n,e)=>n+(e.decisionPolicy?.kind==="fixed-data-choice"?e.decisionPolicy.excludedActionIds.length:0),0),
        branchingStates:nodes.filter(e=>!BOUNDARIES.has(e.node.status)&&e.alternativeCount>1).length,
        singleAlternativeStates:nodes.filter(e=>!BOUNDARIES.has(e.node.status)&&e.alternativeCount===1).length,
        disabledBorrowStarts:nodes.reduce((n,e)=>n+e.node.legalActions.filter(a=>resourcePlanning&&a.family==="industry"&&a.target?.abilityId==="turing_borrow_tech").length,0),
        scanPurposePlans:nodes.reduce((n,e)=>n+e.edges.filter(x=>x.resourcePlan?.goal.kind==="scan-flow").length,0),
        resourceGoalPlans:nodes.reduce((n,e)=>n+e.edges.filter(x=>x.resourcePlan).length,0),
        resourcePreparationInputs:nodes.reduce((n,e)=>n+e.edges.filter(x=>x.resourcePlan).reduce((v,x)=>v+x.cost,0),0),
        resourceFallbacks:nodes.reduce((n,e)=>n+e.edges.filter(x=>x.fallbackReason).length,0),
        resourceExcludedActions:nodes.reduce((n,e)=>n+(e.resourcePolicy?.excludedActionIds.length||0),0),
        transitions, nodes: nodes.length+certificateNodes, graphNodes: nodes.length, certificateNodes,
        postMainOptimalPlans, postMainOptimalPlanSteps, equivalents, selectionMacros, peakFrontier,
        dominancePrunes, resourceDominance: useResourceDominance ? "enabled"
          : resourceDominance ? movementPlanning ? "disabled-for-movement-policy" : "disabled-for-selection-certificate" : "off",
        moneyCapacityPrunes, moneyCapacityDominance: useMoneyCapacity ? "enabled"
          : moneyCapacityDominance ? movementPlanning ? "disabled-for-movement-policy" : "disabled-for-selection-certificate" : "off",
        postMainValuePrunes, scanValuePrunes, scanActionPrunes,
        cardTradePrunes, cardTradePruning: useCardTradePruning ? "enabled"
          : cardTradePruning ? "disabled-for-selection-certificate" : "off",
        postMainProofNodes, postMainExcludedActions, postMainPruning: postMainPruning ? "enabled" : "off",
        openingProofNodes, openingExcludedActions, openingPruning: openingPruning ? "enabled" : "off",
        openingPassMacros, postMainBorrowProofNodes, postMainBorrowExcludedChoices, postMainBorrowMacros,
        cardChoiceProofNodes, cardChoiceExcludedActions, cardCornerProofNodes, cardCornerExcludedActions,
        preMainDataProofNodes, preMainDataExcludedActions,
        cardChoiceEquivalence: cardChoiceEquivalence ? "enabled" : "off",
        ...(useResourceDominance || useMoneyCapacity || useCardTradePruning || postMainPruning || openingPruning || cardChoiceEquivalence
          ? { resourceModelKey: evaluate.modelKey } : {}),
        continuation: reused ? (reused.hit ? "validation-watchdog" : reused.reason) : "not-requested",
        planContinuation: reusedPlan ? (reusedPlan.hit ? "validation-watchdog" : reusedPlan.reason) : planReuse ? "not-requested" : "off",
        milliseconds: elapsed, limits },
    };
  }

  return Object.freeze({ VERSION, DEFAULT_BUDGET, searchDecision });
});
