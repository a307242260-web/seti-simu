(function (root, factory) {
  "use strict";

  let outcomeModel = root.SetiOutcomeModel;
  if (!outcomeModel && typeof require === "function") outcomeModel = require("./outcome-model");
  const api = factory(outcomeModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiExpectedScoreEvaluator = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (outcomeModel) {
  "use strict";

  const EVALUATION_MODEL = "strategic-goal-search-v1";
  const PARAMETER_VERSION = "seti-strategic-goal-search-v1";
  const OUTCOME_SCHEMA_VERSION = outcomeModel.OUTCOME_SCHEMA_VERSION;
  const SECONDARY_AGENT_ROLLOUT_VERSION = "secondary-agent-rollout-v1";
  const CONTROL_FAMILIES = Object.freeze(new Set(["end_turn", "pass"]));
  const UNEVALUATED_ROOT_FAMILIES = Object.freeze(new Set(["quick_trade"]));
  const DEFAULT_PARAMETERS = Object.freeze({
    parameterVersion: PARAMETER_VERSION,
    searchDepth: 15,
    techValuePerRemainingRound: 5,
  });
  const INCOME_UNIT_VALUES = Object.freeze({
    credits: 5,
    energy: 5,
    publicity: 2.5,
    availableData: 2.5,
    handSize: 2.5,
    additionalPublicScan: 2.5,
  });
  const ROLLOUT_FAMILY_PRIORITY = Object.freeze([
    "orbit", "land", "research_tech", "scan", "play_card", "place_data",
    "analyze", "launch", "industry", "runezu_face_symbol", "card_corner",
    "quick_trade", "pass", "move",
  ]);

  function deepFreeze(value) {
    if (value == null || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
  }

  function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function mergeParameters(input = {}) {
    return deepFreeze({
      parameterVersion: String(input.parameterVersion || PARAMETER_VERSION),
      searchDepth: Math.max(1, Math.round(finite(input.searchDepth) || DEFAULT_PARAMETERS.searchDepth)),
      techValuePerRemainingRound: Math.max(
        0,
        finite(input.techValuePerRemainingRound)
          || DEFAULT_PARAMETERS.techValuePerRemainingRound,
      ),
    });
  }

  function infrastructureOf(projection) {
    return {
      ownedTechIds: [...(projection.progress?.ownedTechIds || [])].sort(),
      income: { ...(projection.progress?.income || {}) },
      roundNumber: Math.max(1, finite(projection.progress?.roundNumber) || 1),
      finalRoundNumber: Math.max(1, finite(projection.progress?.finalRoundNumber) || 4),
    };
  }

  function evaluateState(observation, seatId) {
    if (observation?.schemaVersion !== outcomeModel.OBSERVATION_SCHEMA_VERSION
      || observation?.viewer?.seatId !== seatId
      || observation?.outcomeProjection?.schemaVersion !== outcomeModel.PROJECTION_SCHEMA_VERSION) {
      throw new TypeError("Value 只接受同 viewer 的标准 Decision observation/outcome projection");
    }
    const projection = observation.outcomeProjection;
    const terminal = projection.terminal;
    const realizedScore = terminal
      ? finite(projection.scoring.officialTerminalScore)
      : finite(projection.scoring.realizedScore);
    return deepFreeze({
      schemaVersion: outcomeModel.VALUE_SCHEMA_VERSION,
      evaluationModel: EVALUATION_MODEL,
      parameterVersion: PARAMETER_VERSION,
      terminal,
      realizedScore,
      total: realizedScore,
      infrastructure: infrastructureOf(projection),
      resourceFacts: {
        credits: finite(projection.assets.credits),
        energy: finite(projection.assets.energy),
        publicity: finite(projection.assets.publicity),
        availableData: finite(projection.assets.availableData),
        ordinaryCards: finite(projection.assets.ordinaryCards),
        alienCards: finite(projection.assets.alienCards),
      },
      fieldPaths: {
        realizedScore: terminal
          ? "outcomeProjection.scoring.officialTerminalScore"
          : "outcomeProjection.scoring.realizedScore",
        infrastructure: "outcomeProjection.progress.{ownedTechIds,income,roundNumber}",
        resources: outcomeModel.ASSET_PATHS,
      },
    });
  }

  function unavailable(outcome, code) {
    return deepFreeze({
      evaluationModel: EVALUATION_MODEL,
      score: null,
      selectable: false,
      priorityClass: -1,
      status: outcome?.status || "unresolved",
      confidence: outcome?.confidence || "none",
      reasonCodes: [code],
    });
  }

  function positiveDelta(after, before) {
    return Math.max(0, finite(after) - finite(before));
  }

  function infrastructureDeltaValue(rootValue, leafValue, parameters) {
    const rootInfrastructure = rootValue.infrastructure;
    const leafInfrastructure = leafValue.infrastructure;
    const remainingRounds = Math.max(
      0,
      leafInfrastructure.finalRoundNumber - leafInfrastructure.roundNumber,
    );
    const rootTech = new Set(rootInfrastructure.ownedTechIds);
    const gainedTechIds = leafInfrastructure.ownedTechIds
      .filter((tileId) => !rootTech.has(tileId));
    const techValue = gainedTechIds.length
      * (remainingRounds + 1)
      * parameters.techValuePerRemainingRound;
    const incomeDelta = Object.fromEntries(Object.keys(INCOME_UNIT_VALUES).map((key) => [
      key,
      positiveDelta(leafInfrastructure.income[key], rootInfrastructure.income[key]),
    ]));
    const incomePerWindowValue = Object.entries(INCOME_UNIT_VALUES)
      .reduce((total, [key, unitValue]) => total + incomeDelta[key] * unitValue, 0);
    const incomeValue = incomePerWindowValue * (remainingRounds + 1);
    return {
      total: techValue + incomeValue,
      remainingRounds,
      gainedTechIds,
      techValue,
      incomeDelta,
      incomeValue,
    };
  }

  function leafValue(rootValue, leafValueState, parameters) {
    const actualScoreDelta = leafValueState.realizedScore - rootValue.realizedScore;
    const infrastructure = infrastructureDeltaValue(rootValue, leafValueState, parameters);
    return {
      total: actualScoreDelta + infrastructure.total,
      actualScoreDelta,
      infrastructure,
    };
  }

  function evaluateSearchPriority(rootObservation, branchObservation, seatId, parametersInput = {}) {
    const parameters = mergeParameters(parametersInput);
    const rootValue = evaluateState(rootObservation, seatId);
    const branchValue = evaluateState(branchObservation, seatId);
    return leafValue(rootValue, branchValue, parameters).total;
  }

  function evaluateStrategicFactsPriority(rootFacts, branchFacts, parametersInput = {}) {
    if (!rootFacts || !branchFacts
      || rootFacts.viewerSeatId !== branchFacts.viewerSeatId) {
      throw new TypeError("Search priority 需要同 viewer 的战略事实");
    }
    const parameters = mergeParameters(parametersInput);
    const toValue = (facts) => ({
      realizedScore: finite(facts.realizedScore),
      infrastructure: {
        ownedTechIds: [...(facts.ownedTechIds || [])].sort(),
        income: { ...(facts.income || {}) },
        roundNumber: Math.max(1, finite(facts.roundNumber) || 1),
        finalRoundNumber: Math.max(1, finite(facts.finalRoundNumber) || 4),
      },
    });
    return leafValue(toValue(rootFacts), toValue(branchFacts), parameters).total;
  }

  function gapSize(requirement) {
    const gap = requirement?.gap || {};
    return finite(gap.credits) + finite(gap.energy);
  }

  function goalValue(requirement) {
    return finite(
      requirement?.targetBenefit?.grossEquivalentValue
      ?? requirement?.targetBenefit?.score,
    );
  }

  function isAffordable(requirement) {
    return finite(requirement?.gap?.credits) === 0
      && finite(requirement?.gap?.energy) === 0;
  }

  function compareGoals(left, right) {
    return Number(isAffordable(right)) - Number(isAffordable(left))
      || goalValue(right) - goalValue(left)
      || finite(right?.targetBenefit?.score) - finite(left?.targetBenefit?.score)
      || gapSize(left) - gapSize(right)
      || String(left?.requirementId || "").localeCompare(String(right?.requirementId || ""));
  }

  function bestGoal(requirements) {
    return [...(requirements?.candidates || [])]
      .filter((candidate) => finite(candidate?.targetBenefit?.score) > 0)
      .sort(compareGoals)[0] || null;
  }

  function evaluateSetupProbeGoals(observation, seatId) {
    evaluateState(observation, seatId);
    const requirements = observation.outcomeProjection.progress?.probeGoalRequirements;
    const goal = bestGoal(requirements);
    const gap = goal?.gap || {};
    return deepFreeze({
      evaluationModel: EVALUATION_MODEL,
      reachable: Boolean(goal),
      affordable: isAffordable(goal),
      targetBenefitScore: finite(goal?.targetBenefit?.score),
      targetValue: goalValue(goal),
      gap: {
        credits: finite(gap.credits),
        energy: finite(gap.energy),
        movementSteps: finite(gap.movementSteps),
      },
      targetId: goal?.targetId || null,
      fieldPaths: {
        requirements: "outcomeProjection.progress.probeGoalRequirements.candidates",
        targetBenefit: "outcomeProjection.progress.probeGoalRequirements.candidates[].targetBenefit.score",
        gap: "outcomeProjection.progress.probeGoalRequirements.candidates[].gap",
      },
    });
  }

  function compareSetupProbeGoals(left, right) {
    const leftGap = left?.gap || {};
    const rightGap = right?.gap || {};
    return Number(Boolean(right?.reachable)) - Number(Boolean(left?.reachable))
      || Number(Boolean(right?.affordable)) - Number(Boolean(left?.affordable))
      || finite(right?.targetValue) - finite(left?.targetValue)
      || finite(right?.targetBenefitScore) - finite(left?.targetBenefitScore)
      || gapSize({ gap: leftGap }) - gapSize({ gap: rightGap })
      || finite(leftGap.credits) - finite(rightGap.credits)
      || finite(leftGap.energy) - finite(rightGap.energy)
      || finite(leftGap.movementSteps) - finite(rightGap.movementSteps);
  }

  function evaluateOutcome(context, action, parametersInput = {}) {
    const parameters = mergeParameters(parametersInput);
    const outcome = (context?.actionOutcomes || []).find((candidate) => (
      candidate?.actionId === action?.actionId
    ));
    if (!outcome) return unavailable(null, "outcome-missing");
    if (outcome.schemaVersion !== OUTCOME_SCHEMA_VERSION || outcome.status !== "settled") {
      return unavailable(outcome, outcome.code || "outcome-unresolved");
    }
    const rootValue = outcome.rootObservation
      ? evaluateState(outcome.rootObservation, context.seatId)
      : null;
    if (!rootValue) return unavailable(outcome, "outcome-root-missing");
    const evaluatedLeaves = (outcome.leaves || [])
      .filter((leaf) => leaf?.status !== "failed" && leaf?.observation)
      .map((leaf) => {
        const leafStateValue = evaluateState(leaf.observation, context.seatId);
        return {
          leaf,
          leafStateValue,
          strategicValue: leafValue(rootValue, leafStateValue, parameters),
        };
      })
      .sort((left, right) => (
        right.strategicValue.total - left.strategicValue.total
        || right.strategicValue.actualScoreDelta - left.strategicValue.actualScoreDelta
        || String(left.leaf.leafId || "").localeCompare(String(right.leaf.leafId || ""))
      ));
    const best = evaluatedLeaves[0] || null;
    if (!best) return unavailable(outcome, "strategic-goal-leaf-missing");
    const control = CONTROL_FAMILIES.has(action?.family);
    const conditional = action?.phase === "conditional";
    const selectable = best.strategicValue.total > 0 || control || conditional;
    if (!selectable) return unavailable(outcome, "no-score-tech-or-income-gain");
    return deepFreeze({
      evaluationModel: EVALUATION_MODEL,
      score: best.strategicValue.total,
      value: best.strategicValue.total,
      selectable: true,
      priorityClass: conditional ? 3 : control ? 0 : 2,
      status: outcome.status,
      confidence: outcome.confidence || "high",
      rootValue,
      leafValue: best.leafStateValue,
      actualScoreDelta: best.strategicValue.actualScoreDelta,
      infrastructureValue: best.strategicValue.infrastructure.total,
      techValue: best.strategicValue.infrastructure.techValue,
      gainedTechIds: best.strategicValue.infrastructure.gainedTechIds,
      incomeValue: best.strategicValue.infrastructure.incomeValue,
      incomeDelta: best.strategicValue.infrastructure.incomeDelta,
      remainingRounds: best.strategicValue.infrastructure.remainingRounds,
      probeRouteSummary: best.leaf.observation.outcomeProjection.progress?.probeRoute?.candidate || null,
      selectedLeafId: best.leaf.leafId || null,
      actionChain: best.leaf.actionChain || [],
      reasonCodes: [
        best.strategicValue.actualScoreDelta > 0 ? "strategic-goal-score" : null,
        best.strategicValue.infrastructure.techValue > 0 ? "strategic-goal-tech" : null,
        best.strategicValue.infrastructure.incomeValue > 0 ? "strategic-goal-income" : null,
        conditional ? "required-standard-decision" : null,
        control ? "turn-control" : null,
      ].filter(Boolean),
    });
  }

  function requiresCounterfactualOutcome(action) {
    return !UNEVALUATED_ROOT_FAMILIES.has(action?.family);
  }

  function rawProbeRequirements(observation) {
    return observation?.probeRouteRequirements
      || observation?.outcomeProjection?.progress?.probeGoalRequirements
      || null;
  }

  function actionMatchesProbeStep(action, step) {
    if (!action || !step || action.family !== step.family) return false;
    if (step.family === "move") {
      return String(action.target?.rocketId) === String(step.rocketId)
        && finite(action.target?.deltaX) === finite(step.deltaX)
        && finite(action.target?.deltaY) === finite(step.deltaY);
    }
    if (["orbit", "land"].includes(step.family)) {
      return String(action.target?.rocketId) === String(step.rocketId)
        && String(action.target?.planetId) === String(step.planetId)
        && String(action.target?.type || "planet") === String(step.target?.type || "planet")
        && String(action.target?.satelliteId || "") === String(step.target?.satelliteId || "");
    }
    return true;
  }

  function bestProbePotential(requirements) {
    return [...(requirements?.candidates || [])]
      .filter((goal) => finite(goal?.targetBenefit?.score) > 0)
      .sort((left, right) => (
        finite(right.targetBenefit.score) - finite(left.targetBenefit.score)
        || gapSize(left) - gapSize(right)
        || finite(left?.required?.movementSteps) - finite(right?.required?.movementSteps)
        || String(left.requirementId).localeCompare(String(right.requirementId))
      ))[0] || null;
  }

  function evaluateSecondaryAgentSearchPriority(input = {}, parametersInput = {}) {
    const rootFacts = outcomeModel.createStrategicFacts(input.rootObservation, input.focalSeatId);
    const branchFacts = outcomeModel.createStrategicFacts(input.branchObservation, input.focalSeatId);
    const primaryValue = evaluateStrategicFactsPriority(rootFacts, branchFacts, parametersInput);
    const rootGoals = rawProbeRequirements(input.rootObservation)?.candidates || [];
    const branchGoal = bestProbePotential(rawProbeRequirements(input.branchObservation));
    const matchedRoot = rootGoals
      .filter((goal) => actionMatchesProbeStep(input.currentAction, goal.nextStep))
      .sort(compareGoals)[0] || null;
    const branchSameRoute = matchedRoot
      ? (rawProbeRequirements(input.branchObservation)?.candidates || []).find((goal) => (
        goal.requirementId === matchedRoot.requirementId
        || (matchedRoot.sourceId === "launch" && goal.targetId === matchedRoot.targetId)
      ))
      : null;
    const gapReduction = matchedRoot && branchSameRoute
      ? Math.max(0, gapSize(matchedRoot) - gapSize(branchSameRoute))
      : 0;
    return primaryValue * 1000
      + finite(matchedRoot?.targetBenefit?.score) * 100
      + gapReduction * 10
      + finite(branchGoal?.targetBenefit?.score)
      + Number(Boolean(branchGoal) && isAffordable(branchGoal)) * 2
      - finite(branchGoal?.required?.movementSteps) / 100;
  }

  function rankSecondaryAgentSuccessor(input = {}, parametersInput = {}) {
    const successor = input.successor;
    if (String(successor?.actorId || "") !== String(input.focalSeatId || "")) return 0;
    const rootFacts = outcomeModel.createStrategicFacts(input.rootObservation, input.focalSeatId);
    const branchFacts = outcomeModel.createStrategicFacts(input.branchObservation, input.focalSeatId);
    const primaryValue = evaluateStrategicFactsPriority(rootFacts, branchFacts, parametersInput);
    if (successor.family === "pass") return primaryValue > 0 ? 900 : -900;
    if (successor.family === "end_turn") return 100;
    const requirements = (rawProbeRequirements(input.branchObservation)?.candidates || [])
      .filter((goal) => !input.routeTargetId || goal.targetId === input.routeTargetId);
    const matched = requirements
      .filter((goal) => actionMatchesProbeStep(successor, goal.nextStep))
      .sort(compareGoals)[0] || null;
    if (matched) return 500 + finite(matched.targetBenefit?.score) * 10;
    const familyPriority = {
      orbit: 350,
      land: 350,
      research_tech: 250,
      scan: 220,
      play_card: 420,
      place_data: 180,
      analyze: 180,
      launch: 160,
      move: 140,
      industry: 120,
      runezu_face_symbol: 100,
      card_corner: 80,
      quick_trade: 60,
    };
    return familyPriority[successor.family] || 0;
  }

  function selectSecondaryAgentRouteTarget(input = {}) {
    const branchGoals = rawProbeRequirements(input.branchObservation)?.candidates || [];
    if (
      input.routeTargetId
      && branchGoals.some((goal) => goal.targetId === input.routeTargetId)
    ) {
      return input.routeTargetId;
    }
    if (
      String(input.currentAction?.actorId || "") !== String(input.focalSeatId || "")
      || !["launch", "move", "orbit", "land"].includes(input.currentAction?.family)
    ) {
      return null;
    }
    const matched = (rawProbeRequirements(input.rootObservation)?.candidates || [])
      .filter((goal) => actionMatchesProbeStep(input.currentAction, goal.nextStep))
      .sort(compareGoals)[0] || null;
    return matched?.targetId || null;
  }

  function selectSecondaryAgentSuccessors(input = {}) {
    const successors = [...(input.legalSuccessors || [])]
      .sort((left, right) => String(left.actionId).localeCompare(String(right.actionId)));
    if (!successors.length) return [];
    const focalSeatId = String(input.focalSeatId || "");
    const actorId = String(successors[0]?.actorId || "");
    if (actorId === focalSeatId) {
      const goals = (rawProbeRequirements(input.branchObservation)?.candidates || [])
        .filter((goal) => !input.routeTargetId || goal.targetId === input.routeTargetId);
      if (input.routeTargetId && goals.length) {
        const exact = successors.filter((action) => (
          goals.some((goal) => actionMatchesProbeStep(action, goal.nextStep))
        ));
        if (exact.length) return exact;
        const controls = successors.filter((action) => (
          ["end_turn", "pass"].includes(action.family)
        ));
        if (controls.length) return controls;
      }
      return successors.filter((action) => (
        !["launch", "move", "orbit", "land"].includes(action.family)
        || goals.some((goal) => actionMatchesProbeStep(action, goal.nextStep))
      ));
    }
    if (successors[0]?.phase === "conditional") return successors.slice(0, 1);
    const endTurn = successors.find((action) => action.family === "end_turn");
    if (endTurn) return [endTurn];
    if (Number(input.opponentProxyDepth || 0) >= 8) {
      const pass = successors.find((action) => action.family === "pass");
      if (pass) return [pass];
    }
    for (const family of ROLLOUT_FAMILY_PRIORITY) {
      const selected = successors.find((action) => action.family === family);
      if (selected) return [selected];
    }
    const error = new Error(`冻结 rollout 无法选择 opponent action: ${actorId || "<missing>"}`);
    error.code = "SECONDARY_AGENT_ROLLOUT_NO_ACTION";
    throw error;
  }

  return Object.freeze({
    EVALUATION_MODEL,
    PARAMETER_VERSION,
    OUTCOME_SCHEMA_VERSION,
    DEFAULT_PARAMETERS,
    INCOME_UNIT_VALUES,
    SECONDARY_AGENT_ROLLOUT_VERSION,
    mergeParameters,
    requiresCounterfactualOutcome,
    evaluateState,
    evaluateSetupProbeGoals,
    compareSetupProbeGoals,
    evaluateSearchPriority,
    evaluateStrategicFactsPriority,
    evaluateSecondaryAgentSearchPriority,
    rankSecondaryAgentSuccessor,
    selectSecondaryAgentRouteTarget,
    evaluateAction: evaluateOutcome,
    evaluateOutcome,
    selectSecondaryAgentSuccessors,
  });
});
