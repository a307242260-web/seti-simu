(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof module === "undefined") root.SetiHeuristicEvaluator = api;})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function finiteScore(value) {
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  }

  // 注意：本模块不提供"默认 evaluateAction"——旧的默认实现读 action.outcome.score
  // （outcome 不在 action 上，恒 null → 全部 unresolved 静默退化），属误导死代码已删。
  // 调用方必须显式传入 evaluateAction（heuristic-policy 传 expectedScoreEvaluator.
  // evaluateAction）；缺失即抛错，不允许静默全 unresolved（错误必须暴露）。
  function selectLegalAction(context, options = {}) {
    const evaluate = options.evaluateAction;
    if (typeof evaluate !== "function") {
      throw new TypeError("selectLegalAction 需要 evaluateAction（不允许静默 unresolved 默认）");
    }
    const available = (context?.legalActions || [])
      .filter((action) => (options.isFeasible?.(context, action) ?? true))
      .map((action) => {
        const evaluation = evaluate(context, action) || {};
        return {
          action,
          score: finiteScore(evaluation.score),
          sortKey: Array.isArray(evaluation.sortKey)
            ? evaluation.sortKey.map((value) => finiteScore(value) ?? 0)
            : [finiteScore(evaluation.score) ?? 0],
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
    const compareSortKey = (left, right) => {
      const length = Math.max(left.length, right.length);
      for (let index = 0; index < length; index += 1) {
        const delta = (right[index] ?? 0) - (left[index] ?? 0);
        if (delta) return delta;
      }
      return 0;
    };
    return pool.sort((left, right) => (
      compareSortKey(left.sortKey, right.sortKey)
      || right.priorityClass - left.priorityClass
      || String(left.action.actionId).localeCompare(String(right.action.actionId))
    ))[0]?.action || null;
  }

  return Object.freeze({ selectLegalAction });
});
