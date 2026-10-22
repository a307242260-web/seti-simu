(function (root, factory) {
  "use strict";
  const common = typeof module === "object" && module.exports;
  const api = factory(common ? require("./decision-search") : root.SetiDecisionSearch,
    common ? require("./state-value") : root.SetiStateValue);
  if (common) module.exports = api;
  else root.SetiSearchAgent = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (search, stateValue) {
  "use strict";
  const VERSION = `seti-search-agent-v1/${search.VERSION}/${stateValue.MODEL_VERSION}`;
  const BUDGET = Object.freeze({ transitions: 256, nodes: 257, frontier: 256, milliseconds: 600 });
  const OPTIONS = Object.freeze({ resourceDominance: true, moneyCapacityDominance: true,
    cardTradePruning: true, postMainPruning: true, openingPruning: true, cardChoiceEquivalence: true });
  const MODEL_CHECKSUM = JSON.stringify({ searchVersion: search.VERSION, valueVersion: stateValue.MODEL_VERSION,
    weights: stateValue.DEFAULT_WEIGHTS, budget: BUDGET, options: OPTIONS });

  function actionKey(action) {
    function ordered(value) {
      if (!value || typeof value !== "object") return value;
      if (Array.isArray(value)) return value.map(ordered);
      return Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])]));
    }
    return JSON.stringify(ordered({ actionId: action.actionId, actorId: action.actorId,
      stateVersion: action.stateVersion, decisionVersion: action.decisionVersion, decisionId: action.decisionId || null,
      family: action.family, phase: action.phase, target: action.target || {}, payload: action.payload || {} }));
  }

  function createSearchAgent({ seatId, analysisPort } = {}) {
    if (typeof seatId !== "string" || !seatId || typeof analysisPort?.openRoot !== "function"
      || typeof analysisPort?.close !== "function") throw new TypeError("SEARCH_AGENT_PORT_REQUIRED");
    const evaluate = stateValue.createStateValueEvaluator(seatId);
    let continuation = null;
    function decide(context) {
      const startedAt = performance.now();
      try {
        if (context?.seatId !== seatId) throw new Error("SEARCH_AGENT_SEAT_MISMATCH");
        const root = analysisPort.openRoot();
        const expected = new Set(context.legalActions.map(actionKey));
        if (expected.size !== context.legalActions.length || root.legalActions.length !== expected.size
          || root.legalActions.some(action => !expected.has(actionKey(action)))) throw new Error("SEARCH_AGENT_BOUNDARY_MISMATCH");
        const result = search.searchDecision({ port: analysisPort, root, evaluate, budget: BUDGET,
          ...OPTIONS, continuation, modelKey: evaluate.modelKey });
        const { selectionContinuation, ...publicResult } = result;
        const evidence = { ...publicResult, rootAndSearchMilliseconds: performance.now() - startedAt,
          analysis: analysisPort.getDiagnostics?.() || null };
        if (!result.complete || !result.actionId) {
          const error = new Error(`SEARCH_INCOMPLETE: ${result.stopReason || "no-action"}`);
          error.code = "SEARCH_INCOMPLETE";
          error.search = evidence;
          throw error;
        }
        continuation = selectionContinuation;
        return { actionId: result.actionId, reasonCode: "search:complete-visible-window", search: evidence };
      } catch (error) {
        continuation = null;
        throw error;
      } finally { analysisPort.close(); }
    }
    return Object.freeze({ decide,
      getProvenance: () => Object.freeze({ type: "search", version: VERSION, modelChecksum: MODEL_CHECKSUM }) });
  }
  return Object.freeze({ VERSION, BUDGET, OPTIONS, MODEL_CHECKSUM, createSearchAgent });
});
