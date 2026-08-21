(function (root, factory) {
  "use strict";

  let vGuidedPolicy = root.SetiVGuidedPolicy;
  let heuristicPolicy = root.SetiHeuristicPolicy;
  let heuristicDecisionFunction = root.SetiHeuristicDecisionFunction;
  if ((!vGuidedPolicy || !heuristicPolicy || !heuristicDecisionFunction) && typeof require === "function") {
    vGuidedPolicy = vGuidedPolicy || require("./v-guided-policy");
    heuristicPolicy = heuristicPolicy || require("./heuristic-policy");
    heuristicDecisionFunction = heuristicDecisionFunction || require("./heuristic-decision-function");
  }
  const api = factory(vGuidedPolicy, heuristicPolicy, heuristicDecisionFunction);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof module === "undefined") root.SetiVGuidedDecisionFunction = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (
  vGuidedPolicy,
  heuristicPolicy,
  heuristicDecisionFunction,
) {
  "use strict";

/**
 * V 引导决策函数（2026-08-18 用户裁决"先有倾向的确定搜索目标，去掉不执行的，
 * 不是先执行再失败"）。
 *
 * 架构：**不重造 fork 搜索**——复用启发式决策函数生成标准 actionOutcomes
 * （目标预筛 + 可行性 + 反事实搜索全部由启发式完成，即"先定倾向"），
 * 主行动叶排序改用 V 引导策略（v-guided-policy）：对每个叶 total = 实际分Δ +
 * V(leaf) - V(root)，V 编码长线价值（收入复利/科技效率/外星进度/手牌效果链），
 * 让"打牌→科技/收入/登陆链"等长链收益在浅搜索里可见（"再执行"）。
 *
 * 条件决策（choose_*：初始选牌/弃牌/结算步骤）**委托启发式策略**——V 只评估
 * 主行动（V 对结算步骤看不到价值，且条件决策由启发式路径处理成熟，含初始选牌
 * 流程/弃牌会话）。
 *
 * 与启发式决策函数同接口：`(ctx) => ({ actionId, plan? })`，可注册进
 * machine-player-coordinator 决策函数注册表（Browser/Simulation 共用）。
 *
 * 失败即抛错：policy 选择非法 actionId、搜索失败一律 throw，不静默降级。
 */
  const CONDITIONAL_FAMILIES = Object.freeze(new Set([
    "choose_card",
    "choose_target",
    "choose_payment",
    "choose_reward",
    "choose_branch",
    "choose_final_scoring",
    "accept_optional_effect",
  ]));

  function createVGuidedDecisionFunction(options = {}) {
    const vPolicy = options.vPolicy || vGuidedPolicy.createVGuidedPolicy({
      difficulty: options.difficulty,
      evaluationParameters: options.evaluationParameters,
    });
    const hPolicy = options.hPolicy || heuristicPolicy.createHeuristicPolicy({
      difficulty: options.difficulty,
      evaluationParameters: options.evaluationParameters,
    });
    // policyFor：条件决策（choose_*）→ 启发式；主行动 → V 引导。
    const policyFor = ({ boundary }) => {
      const legalActions = boundary?.legalActions || [];
      const isConditional = legalActions.length > 0 && legalActions.every((a) => (
        CONDITIONAL_FAMILIES.has(a.family)
      ));
      return isConditional ? hPolicy : vPolicy;
    };
    const inner = heuristicDecisionFunction.createHeuristicDecisionFunction({
      ...options,
      policy: hPolicy, // 默认启发式（条件决策路径）
      policyFor,
    });
    return Object.freeze({
      run: inner.run,
      getProvenance: () => vPolicy.getProvenance(),
    });
  }

  return Object.freeze({
    createVGuidedDecisionFunction,
    CONDITIONAL_FAMILIES,
  });
});
