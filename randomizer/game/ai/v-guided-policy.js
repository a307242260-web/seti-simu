(function (root, factory) {
  "use strict";

  let policyPort = root.SetiPolicyPort;
  let outcomeModel = root.SetiOutcomeModel;
  let expectedScoreEvaluator = root.SetiExpectedScoreEvaluator;
  let standardAction = root.SetiStandardAction;
  if (typeof require === "function") {
    policyPort = policyPort || require("./policy-port");
    outcomeModel = outcomeModel || require("./outcome-model");
    expectedScoreEvaluator = expectedScoreEvaluator || require("./expected-score-evaluator");
    standardAction = standardAction || require("../actions/standard-action");
  }
  const api = factory(policyPort, outcomeModel, expectedScoreEvaluator, standardAction);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof module === "undefined") root.SetiVGuidedPolicy = api;})(typeof globalThis !== "undefined" ? globalThis : window, function (
  policyPort,
  outcomeModel,
  expectedScoreEvaluator,
  standardAction,
) {
  "use strict";

  // V 引导策略（v-state-design-20260817.md）：与启发式策略完全解耦。
  // 消费 env 提供的全量浅搜索 actionOutcomes，对每个动作的每个叶：
  //   total = 实际分Δ(actualScoreDelta) + V(leaf) - V(root)
  // 选 total 最高的动作。V 编码长线价值（收入复利/科技效率/外星进度/手牌期望），
  // 让"打牌→科技/收入/登陆链"等长链收益在浅搜索里可见。
  const POLICY_TYPE = "v-guided";
  const POLICY_VERSION = "seti-v-guided-policy-v1";

  class VGuidedPolicyError extends Error {
    constructor(code, message, details = {}) {
      super(message);
      this.name = "VGuidedPolicyError";
      this.code = code;
      Object.assign(this, details);
    }
  }

  function stableHash(value) {
    const text = JSON.stringify(value);
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  // 标准 observation 转换（叶/根都需要 outcomeProjection 供 V 评估）
  function toStandardObservation(observation, seatId, authority) {
    return outcomeModel.createDecisionObservation(observation, {
      seatId,
      stateVersion: authority?.stateVersion ?? null,
      decisionVersion: authority?.decisionVersion ?? null,
    });
  }

  // 评估单个动作：返回最优叶的 { total, vDelta, actual, actionId }
  function evaluateActionOutcome(outcome, seatId, authority, params) {
    if (outcome?.status !== "settled" || !Array.isArray(outcome.leaves) || !outcome.leaves.length) {
      return null;
    }
    const rootStd = toStandardObservation(outcome.rootObservation, seatId, authority);
    let rootV = null;
    try { rootV = expectedScoreEvaluator.evaluateStateValue(rootStd, seatId, params).total; } catch (_e) { rootV = null; }
    let best = null;
    for (const leaf of outcome.leaves) {
      if (leaf?.status === "failed" || !leaf?.observation) continue;
      let leafStd = null;
      try {
        leafStd = toStandardObservation(leaf.observation, seatId, authority);
      } catch (_e) { continue; }
      let lv = null;
      let actual = 0;
      try {
        lv = expectedScoreEvaluator.evaluateStateValue(leafStd, seatId, params).total;
        const leafState = expectedScoreEvaluator.evaluateState(leafStd, seatId);
        const rootState = expectedScoreEvaluator.evaluateState(rootStd, seatId);
        actual = leafState.realizedScore - rootState.realizedScore;
      } catch (_e) { continue; }
      const vDelta = rootV == null ? 0 : lv - rootV;
      const total = actual + vDelta;
      if (!best || total > best.total) {
        best = { total, vDelta, actual, leafId: leaf.leafId || null };
      }
    }
    if (!best) return null;
    return { actionId: outcome.actionId, ...best };
  }

  function createVGuidedPolicy(options = {}) {
    const params = expectedScoreEvaluator.mergeParameters({
      ...(options.evaluationParameters || {}),
      vStateValueEnabled: true,
    });
    const provenance = Object.freeze({
      type: POLICY_TYPE,
      version: POLICY_VERSION,
      config: Object.freeze({
        difficulty: String(options.difficulty || "laughable"),
        evaluationParameters: params,
      }),
      configChecksum: stableHash({ difficulty: options.difficulty, params }),
    });

    function decide(context) {
      const seatId = context.seatId;
      const authority = {
        stateVersion: context.stateVersion,
        decisionVersion: context.decisionVersion,
      };
      const outcomes = context.actionOutcomes || [];
      // 初始选择/条件决策（choose_*）：不搜索，按序取第一个合法（初始选牌规则
      // 由 env 层预筛，这里只做最终确认选择）
      const candidates = outcomes
        .map((outcome) => evaluateActionOutcome(outcome, seatId, authority, params))
        .filter(Boolean)
        .sort((left, right) => (
          right.total - left.total
          || String(left.actionId).localeCompare(String(right.actionId))
        ));
      let selected = null;
      if (candidates.length) {
        selected = candidates[0];
      } else {
        // 搜索无 settled 结果：退回第一个非 end_turn/pass 的合法动作，再退 end_turn
        const fallback = context.legalActions.find((action) => (
          !["end_turn", "pass"].includes(action.family)
        )) || context.legalActions.find((action) => action.family === "end_turn")
          || context.legalActions[0];
        if (!fallback) {
          throw new VGuidedPolicyError("V_GUIDED_NO_LEGAL", "V 引导策略没有合法动作");
        }
        selected = { actionId: fallback.actionId, total: 0, vDelta: 0, actual: 0 };
      }
      return policyPort.createPolicyDecision(context, {
        actionId: selected.actionId,
        policyType: POLICY_TYPE,
        policyVersion: POLICY_VERSION,
        modelChecksum: null,
        diagnostics: {
          reasonCode: candidates.length ? "v-guided:max-total" : "v-guided:fallback",
          traceId: `${context.requestId}:${provenance.configChecksum}`,
        },
      });
    }

    return Object.freeze({ decide, getProvenance: () => provenance });
  }

  return Object.freeze({
    POLICY_TYPE,
    POLICY_VERSION,
    VGuidedPolicyError,
    createVGuidedPolicy,
  });
});
