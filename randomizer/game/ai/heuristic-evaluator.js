(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiHeuristicEvaluator = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function finiteScore(value) {
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  }

  function evaluateAction(_context, action) {
    const score = finiteScore(action?.outcome?.score);
    return Object.freeze({
      evaluationModel: "counterfactual-leaf-value-v1",
      score,
      status: score == null ? "unresolved" : "settled",
    });
  }

  function selectLegalAction(context, options = {}) {
    const evaluate = options.evaluateAction || evaluateAction;
    const available = (context?.legalActions || [])
      .filter((action) => (options.isFeasible?.(context, action) ?? true))
      .map((action) => {
        const evaluation = evaluate(context, action) || {};
        return {
          action,
          score: finiteScore(evaluation.score),
          status: evaluation.status || null,
          selectable: evaluation.selectable === true,
          priorityClass: Number(evaluation.priorityClass) || 0,
        };
      });
    if (!available.length) return null;
    const pool = available.filter((entry) => (
      entry.selectable && entry.status === "settled" && entry.score != null
    ));
    if (!pool.length) return null;
    return pool.sort((left, right) => (
      right.priorityClass - left.priorityClass
      || (right.score ?? 0) - (left.score ?? 0)
      || String(left.action.actionId).localeCompare(String(right.action.actionId))
    ))[0]?.action || null;
  }

  return Object.freeze({ evaluateAction, selectLegalAction });
});
