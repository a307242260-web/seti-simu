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
 * - 反事实搜索：counterfactualPort.evaluate（control/bounded/strategic 分桶，
 *   从原 simulation-env 迁移）；
 * - 直调启发式 Policy（heuristic-policy.decide，不经过旧 Host/policyAdapter 壳）；
 * - 从所选 action 的 winning leaf 构建 plan（供协调器复用判断）。
 *
 * 失败即抛错：policy 选择非法 actionId、搜索失败一律 throw，不静默降级。
 */

const policyPort = require("./policy-port");
const heuristicPolicy = require("./heuristic-policy");
const expectedScoreEvaluator = require("./expected-score-evaluator");
const outcomeModel = require("./outcome-model");
const planContinuation = require("./plan-continuation");

function policyOutcomeActions(actions, policyObservation, unifiedSearch = false) {
  const candidates = (actions || []).filter((action) => (
    expectedScoreEvaluator.requiresRootCounterfactual(action, policyObservation, unifiedSearch)
  ));
  return expectedScoreEvaluator.selectSecondaryAgentRootActions({
    focalSeatId: candidates[0]?.actorId || null,
    rootObservation: policyObservation,
    legalActions: candidates,
    maxProxyDepth: 15,
    unifiedSearch,
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

function createHeuristicDecisionFunction(options = {}) {
  const composition = options.composition;
  if (!composition?.counterfactualPort?.evaluate) {
    throw new TypeError("Heuristic 决策函数需要 composition.counterfactualPort.evaluate");
  }
  const policy = options.policy || heuristicPolicy.createHeuristicPolicy({
    difficulty: options.difficulty,
    strategyWeights: options.strategyWeights,
    evaluationParameters: options.evaluationParameters,
    seed: options.seed,
  });
  const config = options.config || {};

  // 反事实搜索（从原 simulation-env evaluateActionOutcomes 迁移；legalActions 为
  // raw descriptor，evaluate 端按 actionId 对齐当前合法集）。
  function evaluateActions(actions, evaluateOptions = {}) {
    const seatId = actions[0]?.actorId || null;
    let rootStrategicFacts = null;
    return composition.counterfactualPort.evaluate(actions, {
      viewer: { playerId: seatId, role: "player" },
      maxDepth: evaluateOptions.maxDepth || 15,
      maxLeaves: evaluateOptions.maxLeaves || 8,
      maxNodes: evaluateOptions.maxNodes || 128,
      ...(evaluateOptions.maxExecutionNodes
        ? { maxExecutionNodes: evaluateOptions.maxExecutionNodes }
        : {}),
      stopAtPassDecisionBoundary: evaluateOptions.stopAtPassDecisionBoundary === true,
      maxFrontierPerRoot: evaluateOptions.maxFrontierPerRoot
        || (evaluateOptions.secondaryAgentSearch ? 1 : 8),
      traceGoalClusters: evaluateOptions.traceGoalClusters === true,
      allowUntargetedRootActions: evaluateOptions.unifiedSearch === true,
      secondaryAgentSearch: evaluateOptions.secondaryAgentSearch ? {
        focalSeatId: seatId,
        maxProxyDepth: evaluateOptions.maxProxyDepth || 15,
        rolloutVersion: expectedScoreEvaluator.SECONDARY_AGENT_ROLLOUT_VERSION,
        completeTargetCatalog: evaluateOptions.completeTargetCatalog === true,
        unifiedSearch: evaluateOptions.unifiedSearch === true,
        selectRootTargets: expectedScoreEvaluator.enumerateSecondaryAgentRootTargets,
        selectSuccessors: expectedScoreEvaluator.selectSecondaryAgentSuccessors,
        selectRouteTarget: expectedScoreEvaluator.selectSecondaryAgentRouteTarget,
        countsGoal: expectedScoreEvaluator.countsSecondaryAgentGoal,
        completesRouteTarget: expectedScoreEvaluator.completesSecondaryAgentRouteTarget,
        getCompletionFacts: expectedScoreEvaluator.secondaryAgentCompletionFacts,
      } : null,
      getBranchPriority({
        rootObservation,
        branchObservation,
        currentAction,
        routeTargetIds,
        routePlanIds,
      }) {
        if (evaluateOptions.secondaryAgentSearch) {
          return expectedScoreEvaluator.evaluateSecondaryAgentSearchPriority({
            rootObservation,
            branchObservation,
            focalSeatId: seatId,
            currentAction,
            routeTargetIds,
            routePlanIds,
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
  }

  function run(boundary) {
    const { seatId, legalActions, observation } = boundary;
    const initialSetupBoundary = isInitialSetupBoundary(legalActions);
    const outcomeOptions = {
      seatId,
      stateVersion: legalActions[0].stateVersion,
      decisionVersion: legalActions[0].decisionVersion,
    };
    const evaluatedActions = initialSetupBoundary
      ? initialSetupOutcomeActions(legalActions, observation)
      : policyOutcomeActions(legalActions, observation, config.unifiedSearch === true);
    const controlActions = initialSetupBoundary
      ? []
      : legalActions.filter((action) => !expectedScoreEvaluator.requiresCounterfactualOutcome(action));
    const evaluatedIds = new Set(evaluatedActions.map((action) => action.actionId));
    const boundedActions = initialSetupBoundary
      ? []
      : legalActions.filter((action) => (
        !evaluatedIds.has(action.actionId)
        && expectedScoreEvaluator.requiresCounterfactualOutcome(action)
        && action.family === "play_card"
      ));
    const controlOutcomes = controlActions.length
      ? evaluateActions(controlActions, {
        maxDepth: 1,
        maxLeaves: 1,
        maxNodes: controlActions.length,
        secondaryAgentSearch: false,
        stopAtPassDecisionBoundary: true,
      })
      : [];
    const boundedOutcomes = boundedActions.length
      ? evaluateActions(boundedActions, {
        maxDepth: 6,
        maxLeaves: 3,
        maxNodes: Math.max(boundedActions.length, boundedActions.length * 16),
        secondaryAgentSearch: false,
      })
      : [];
    const strategicOutcomes = evaluatedActions.length
      ? evaluateActions(evaluatedActions, {
        maxDepth: initialSetupBoundary ? 6 : 15,
        maxLeaves: initialSetupBoundary ? 1 : 8,
        maxNodes: initialSetupBoundary ? 12 : 128,
        secondaryAgentSearch: !initialSetupBoundary,
        completeTargetCatalog: !initialSetupBoundary && config.completeTargetCatalog === true,
        unifiedSearch: config.unifiedSearch === true,
        traceGoalClusters: !initialSetupBoundary && config.traceCounterfactualGoalClusters,
        maxProxyDepth: 15,
      })
      : [];
    const evaluatedOutcomes = outcomeModel.projectOutcomeObservations(
      [...strategicOutcomes, ...boundedOutcomes, ...controlOutcomes],
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
      actionOutcomes,
      deterministicContext: {
        heuristicDecisionFunctionSchemaVersion: "seti-heuristic-decision-function-v1",
      },
    });
    const policyDecision = policy.decide(context);
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
    };
  }

  return Object.freeze({
    run,
    getProvenance: policy.getProvenance,
  });
}

module.exports = Object.freeze({
  createHeuristicDecisionFunction,
  isInitialSetupBoundary,
});
