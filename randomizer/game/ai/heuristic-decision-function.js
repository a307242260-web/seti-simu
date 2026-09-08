(function (root, factory) {
  "use strict";

  let policyPort = root.SetiPolicyPort;
  let heuristicPolicy = root.SetiHeuristicPolicy;
  let expectedScoreEvaluator = root.SetiExpectedScoreEvaluator;
  let outcomeModel = root.SetiOutcomeModel;
  let planContinuation = root.SetiPlanContinuation;
  if ((!policyPort || !heuristicPolicy || !expectedScoreEvaluator || !outcomeModel || !planContinuation)
    && typeof require === "function") {
    policyPort = policyPort || require("./policy-port");
    heuristicPolicy = heuristicPolicy || require("./heuristic-policy");
    expectedScoreEvaluator = expectedScoreEvaluator || require("./expected-score-evaluator");
    outcomeModel = outcomeModel || require("./outcome-model");
    planContinuation = planContinuation || require("./plan-continuation");
  }
  const api = factory(policyPort, heuristicPolicy, expectedScoreEvaluator, outcomeModel, planContinuation);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof module === "undefined") root.SetiHeuristicDecisionFunction = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (
  policyPort,
  heuristicPolicy,
  expectedScoreEvaluator,
  outcomeModel,
  planContinuation,
) {
  "use strict";

/**
 * Heuristic 决策函数（AI 类型的一种）。
 *
 * 实现机器人玩家协调器（machine-player-coordinator.js）的决策函数接口：
 * `(ctx) => ({ actionId, plan? })`，其中 ctx = 协调器 readBoundary 的输出
 * （{ seatId, legalActions, observation, ... }，legalActions 为 composition
 * enumerateActions 的裸 descriptor，不做训练 schema 转换）。
 *
 * 内部：
 * - 反事实搜索：counterfactualPort.evaluate（control/strategic 两路径——control
 *   只做轻评估，其余动作统一走目标引导 + 需求引导的单一搜索，无 bounded 分桶）；
 * - 直调启发式 Policy（heuristic-policy.decide，不经过旧 Host/policyAdapter 壳）；
 * - 从所选 action 的 winning leaf 构建 plan（供协调器复用判断）。
 *
 * 失败即抛错：policy 选择非法 actionId、搜索失败一律 throw，不静默降级。
 */


function policyOutcomeActions(actions, policyObservation) {
  const candidates = (actions || []).filter((action) => (
    expectedScoreEvaluator.requiresRootCounterfactual(action, policyObservation)
  ));
  return expectedScoreEvaluator.selectSecondaryAgentRootActions({
    focalSeatId: candidates[0]?.actorId || null,
    rootObservation: policyObservation,
    legalActions: candidates,
    maxProxyDepth: 15,
  });
}

function initialSetupOutcomeActions(actions, observation) {
  const setup = observation?.publicState?.resident?.initialSetup;
  const offer = setup?.offer;
  if (!setup?.active || !offer) return actions || [];
  if (!offer.selectedIndustryId) {
    return (actions || []).filter((action) => (
      action.target?.kind === "select_initial_card"
      && action.target?.selectionKind === "industry"
    ));
  }
  const selectedInitialIds = new Set(offer.selectedInitialIds || []);
  if (selectedInitialIds.size < 2) {
    return (actions || []).filter((action) => (
      action.target?.kind === "select_initial_card"
      && action.target?.selectionKind === "initial"
      && !selectedInitialIds.has(action.target?.cardId)
    ));
  }
  return (actions || []).filter((action) => action.target?.kind === "confirm_initial_setup");
}

function completePolicyOutcomeSet(actions, evaluated, rootObservation) {
  const byId = new Map((evaluated || []).map((outcome) => [outcome.actionId, outcome]));
  return (actions || []).map((action) => {
    if (byId.has(action.actionId)) return byId.get(action.actionId);
    return {
      schemaVersion: outcomeModel.OUTCOME_SCHEMA_VERSION,
      actionId: action.actionId,
      status: "unresolved",
      confidence: "none",
      code: "STRATEGIC_GOAL_NOT_EVALUATED",
      searchCompleteness: { status: "not-evaluated", reasons: ["not-evaluated"] },
      rootObservation,
      leaves: [],
    };
  });
}

function isInitialSetupBoundary(legalActions) {
  return (legalActions || []).every((action) => (
    ["choose_card", "choose_payment"].includes(action.family)
    && ["start_initial_setup", "select_initial_card", "confirm_initial_setup", "discard-hand-cards"]
      .includes(action.target?.kind)
  ));
}

function policyOutcomeView(outcomes) {
  const eligible = new WeakMap();
  const observations = new Map();
  function canShare(value) {
    if (value === null || typeof value === "string" || typeof value === "boolean") return true;
    if (typeof value === "number") return Number.isFinite(value) && !Object.is(value, -0);
    if (typeof value !== "object") return false;
    if (eligible.has(value)) return eligible.get(value);
    // 递归中的对象不能作为已验证共享值；不符合条件时仍交原Policy校验，不吞错误。
    eligible.set(value, false);
    const array = Array.isArray(value);
    if (!Object.isFrozen(value)
      || Object.getPrototypeOf(value) !== (array ? Array.prototype : Object.prototype)
      || Object.getOwnPropertyDescriptor(Object.prototype, "toJSON")
      || (array && Object.getOwnPropertyDescriptor(Array.prototype, "toJSON"))) return false;
    const keys = Reflect.ownKeys(value);
    if (array && keys.length !== value.length + 1) return false;
    for (const key of keys) {
      if (array && key === "length") continue;
      if (typeof key !== "string" || key === "toJSON") return false;
      if (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length)) return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor.enumerable || !Object.hasOwn(descriptor, "value")
        || !canShare(descriptor.value)) return false;
    }
    eligible.set(value, true);
    return true;
  }
  return outcomes.map((outcome) => ({
    ...outcome,
    leaves: outcome.leaves.map(({ planSteps, ...leaf }) => {
      // 完整值包含席位/版本/路线摘要与已遮蔽内容；不合并叶、来源或计划证据。
      if (!canShare(leaf.observation)) return leaf;
      const key = JSON.stringify(leaf.observation);
      if (!observations.has(key)) observations.set(key, leaf.observation);
      return { ...leaf, observation: observations.get(key) };
    }),
  }));
}

function createHeuristicDecisionFunction(options = {}) {
  const composition = options.composition;
  if (!composition?.counterfactualPort?.evaluate) {
    throw new TypeError("Heuristic 决策函数需要 composition.counterfactualPort.evaluate");
  }
  const defaultPolicy = options.policy || heuristicPolicy.createHeuristicPolicy({
    difficulty: options.difficulty,
    evaluationParameters: options.evaluationParameters,
  });
  const config = options.config || {};

  // 反事实搜索（唯一实现：counterfactualPort.evaluate；legalActions 为
  // raw descriptor，evaluate 端按 actionId 对齐当前合法集）。估值入口统一走
  // 本决策函数——simulation-env 旧 evaluateActionOutcomes 已删除，不存在第二套
  // 搜索参数（旧默认非 secondary-agent 分支会与真实决策估值不一致）。
  function evaluateActions(actions, evaluateOptions, searches) {
    const seatId = actions[0]?.actorId || null;
    let rootStrategicFacts = null;
    const outcomes = composition.counterfactualPort.evaluate(actions, {
      viewer: { playerId: seatId, role: "player" },
      maxDepth: evaluateOptions.maxDepth || 15,
      maxLeaves: evaluateOptions.maxLeaves || 8,
      maxNodes: evaluateOptions.maxNodes || 128,
      ...(evaluateOptions.maxExecutionNodes
        ? { maxExecutionNodes: evaluateOptions.maxExecutionNodes }
        : {}),
      maxFrontierNodes: 256,
      maxMilliseconds: 30000,
      stopAtPassDecisionBoundary: evaluateOptions.stopAtPassDecisionBoundary === true,
      maxFrontierPerRoot: evaluateOptions.maxFrontierPerRoot
        || (evaluateOptions.secondaryAgentSearch ? 1 : 8),
      traceGoalClusters: evaluateOptions.traceGoalClusters === true,
      allowUntargetedRootActions: true,
      capturePlanStep: evaluateOptions.secondaryAgentSearch
        ? planContinuation.capturePlanStep : null,
      secondaryAgentSearch: evaluateOptions.secondaryAgentSearch ? {
        focalSeatId: seatId,
        maxProxyDepth: evaluateOptions.maxProxyDepth || 15,
        rolloutVersion: expectedScoreEvaluator.SECONDARY_AGENT_ROLLOUT_VERSION,
        selectRootTargets: expectedScoreEvaluator.enumerateSecondaryAgentRootTargets,
        selectSuccessors: expectedScoreEvaluator.selectSecondaryAgentSuccessors,
        selectRouteTarget: expectedScoreEvaluator.selectSecondaryAgentRouteTarget,
        completesRouteTarget: expectedScoreEvaluator.completesSecondaryAgentRouteTarget,
        advanceRoutePlan: expectedScoreEvaluator.advanceSecondaryAgentRoutePlan,
      } : null,
      getBranchPriority({
        rootObservation,
        branchObservation,
        currentAction,
        routeTargetIds,
        routePlanIds,
        executionEvents,
      }) {
        if (evaluateOptions.secondaryAgentSearch) {
          return expectedScoreEvaluator.evaluateSecondaryAgentSearchPriority({
            rootObservation,
            branchObservation,
            focalSeatId: seatId,
            currentAction,
            routeTargetIds,
            routePlanIds,
            executionEvents,
          });
        }
        rootStrategicFacts = rootStrategicFacts
          || outcomeModel.createStrategicFacts(rootObservation, seatId);
        return expectedScoreEvaluator.evaluateStrategicFactsPriority(
          rootStrategicFacts,
          outcomeModel.createStrategicFacts(branchObservation, seatId),
        );
      },
      confidence: "low",
    });
    const diagnostics = composition.counterfactualPort.getDiagnostics?.();
    const fields = ["executedNodeCount", "maxExecutionNodes", "executionLimitReached", "beamPrunedOriginCount",
      "successfulInputSubmissionCount", "attemptedNodeCountByFamily", "failedNodeCountByFamily",
      "failedNodeCountByCode", "executedNodeCountByFamily", "executedNodeCountByDecisionKind",
      "executedNodeCountByActionSummary", "executedOriginCountByTarget",
      "executedOriginCountByTargetAndDecisionKind", "frontierOriginCountByFamily", "totalMilliseconds"];
    searches.push({ kind: evaluateOptions.secondaryAgentSearch ? "strategic" : "control",
      diagnostics: diagnostics ? structuredClone(Object.fromEntries(fields.map(key => [key, diagnostics[key]]))) : null });
    return outcomes;
  }

  function run(boundary) {
    const searches = [];
    const { seatId, observation } = boundary;
    const legalActions = composition.counterfactualPort.selectCardRevealChoices(boundary.legalActions);
    const initialSetupBoundary = isInitialSetupBoundary(legalActions);
    const outcomeOptions = {
      seatId,
      stateVersion: legalActions[0].stateVersion,
      decisionVersion: legalActions[0].decisionVersion,
    };
    const evaluatedActions = initialSetupBoundary
      ? initialSetupOutcomeActions(legalActions, observation)
      : policyOutcomeActions(legalActions, observation);
    const controlActions = initialSetupBoundary
      ? []
      : legalActions.filter((action) => !expectedScoreEvaluator.requiresCounterfactualOutcome(action));
    const controlOutcomes = controlActions.length
      ? evaluateActions(controlActions, {
        maxDepth: 1,
        maxLeaves: 1,
        maxNodes: controlActions.length,
        secondaryAgentSearch: false,
        stopAtPassDecisionBoundary: true,
      }, searches)
      : [];
    // 初始选择不跑反事实（审查清理项 1，2026-08-21 实证为**行为变化**而非行为不变）：
    // setup 反事实的 settled 叶经 hasEvaluatedSelection 信号被消费，且其 winning leaf
    // 会产生延续计划，计划驱动到主行动阶段（v2 白色 R1 被计划驱动选 place_data）。
    // 删除后初始选择由 heuristic-policy 硬编码/手工打分决定、无延续计划 → 主行动
    // 阶段自由决策（白色 R1 改选 launch 探测链）。全盘 A/B：均分 64.5→72.5（449 步，
    // 用户裁定接受为增强）。动作标 unresolved 由 completePolicyOutcomeSet 补齐。
    const strategicOutcomes = !initialSetupBoundary && evaluatedActions.length
      ? evaluateActions(evaluatedActions, {
        maxDepth: 15,
        maxLeaves: 8,
        maxNodes: 128,
        maxExecutionNodes: 4096,
        secondaryAgentSearch: true,
        traceGoalClusters: config.traceCounterfactualGoalClusters,
        maxProxyDepth: 15,
      }, searches)
      : [];
    const evaluatedOutcomes = outcomeModel.projectOutcomeObservations(
      [...strategicOutcomes, ...controlOutcomes],
      outcomeOptions,
    );
    const actionOutcomes = completePolicyOutcomeSet(
      legalActions,
      evaluatedOutcomes,
      evaluatedOutcomes[0]?.rootObservation || observation,
    );

    // 直调启发式 Policy（无旧 Host/policyAdapter 壳）。
    const context = policyPort.createDecisionContext({
      requestId: `heuristic-decision:${seatId}:${legalActions[0].stateVersion}:${legalActions[0].decisionVersion}`,
      seatId,
      stateVersion: legalActions[0].stateVersion,
      decisionVersion: legalActions[0].decisionVersion,
      observation,
      legalActions,
      // planSteps只供下方计划提取消费，不在Policy边界重复复制；原始证据完整保留。
      actionOutcomes: policyOutcomeView(actionOutcomes),
      deterministicContext: {
        heuristicDecisionFunctionSchemaVersion: "seti-heuristic-decision-function-v1",
      },
    });
    const policyDecision = defaultPolicy.decide(context);
    const actionId = policyDecision.actionId;
    const action = legalActions.find((candidate) => candidate.actionId === actionId);
    if (!action) {
      throw new Error(`HEURISTIC_DECISION_ILLEGAL: policy 选择非法 actionId ${actionId}`);
    }
    const snapshot = planContinuation.extractPlanSnapshot({
      seatId,
      chosenAction: action,
      legalActions,
      actionOutcomes,
      rootObservation: observation,
    }, { light: true });
    const plan = planContinuation.buildPlanFromSnapshot(snapshot);
    return {
      actionId,
      plan,
      decision: policyDecision,
      actionOutcomes,
      searches,
    };
  }

  return Object.freeze({
    run,
    getProvenance: defaultPolicy.getProvenance,
  });
}

  return Object.freeze({
    createHeuristicDecisionFunction,
    isInitialSetupBoundary,
  });
});
