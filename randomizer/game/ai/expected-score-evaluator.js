(function (root, factory) {
  "use strict";

  let outcomeModel = root.SetiOutcomeModel;
  if (!outcomeModel && typeof require === "function") outcomeModel = require("./outcome-model");
  const api = factory(outcomeModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiExpectedScoreEvaluator = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (outcomeModel) {
  "use strict";

  const EVALUATION_MODEL = "strategic-goal-search-v2";
  const PARAMETER_VERSION = "seti-strategic-goal-search-v2";
  const OUTCOME_SCHEMA_VERSION = outcomeModel.OUTCOME_SCHEMA_VERSION;
  const SECONDARY_AGENT_ROLLOUT_VERSION = "secondary-agent-rollout-v3";
  const DATA_ANALYZE_ROUTE_TARGET = "data:analyze";
  const CONTROL_FAMILIES = Object.freeze(new Set(["end_turn", "pass"]));
  const UNEVALUATED_ROOT_FAMILIES = Object.freeze(new Set(["end_turn"]));
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
  const ASSET_OPPORTUNITY_VALUES = Object.freeze({
    credits: 1,
    energy: 1,
    publicity: 1,
    availableData: 1,
    ordinaryCards: 1,
    alienCards: 1,
  });

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
      securedEndGameBonus: terminal ? 0 : finite(projection.scoring.securedEndGameBonus),
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
        securedEndGameBonus: "outcomeProjection.scoring.securedEndGameBonus",
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

  function stableSerialize(value) {
    if (value == null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
    return `{${Object.keys(value).sort().map(
      (key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`,
    ).join(",")}}`;
  }

  function actionSemanticKey(action) {
    return stableSerialize({
      family: action?.family || null,
      target: action?.target || {},
      payload: action?.payload || {},
    });
  }

  function quickTradePurpose(context, action, leaf) {
    if (action?.family !== "quick_trade") return { required: false, supported: true };
    const nextAgent = (leaf?.secondaryAgentTrace || [])
      .find((candidate) => candidate?.family !== "quick_trade");
    if (!nextAgent) {
      return { required: true, supported: false, reason: "quick-trade-no-followup-agent" };
    }
    const nextKey = actionSemanticKey(nextAgent);
    const alreadyLegal = (context?.legalActions || [])
      .filter((candidate) => !["quick_trade", "pass", "end_turn"].includes(candidate?.family))
      .some((candidate) => actionSemanticKey(candidate) === nextKey);
    const directlyLegal = (leaf?.rootActionSettledLegalSuccessors || [])
      .some((candidate) => actionSemanticKey(candidate) === nextKey);
    const projection = context?.observation?.outcomeProjection;
    const preparesReadyAnalyze = Boolean(
      projection?.progress?.dataProgress?.analyzeReady
      && finite(projection?.assets?.energy) === 0
      && ["credits-for-energy", "cards-for-energy"].includes(action.target?.tradeId),
    );
    return {
      required: true,
      supported: preparesReadyAnalyze || (directlyLegal && !alreadyLegal),
      reason: preparesReadyAnalyze
        ? "quick-trade-prepared-ready-analyze"
        : directlyLegal && !alreadyLegal
          ? "quick-trade-directly-unlocked-agent"
          : "quick-trade-did-not-directly-unlock-agent",
      nextAgent,
    };
  }

  function cardCornerPurpose(context, action, leaf, rootValue, parameters) {
    if (action?.family !== "card_corner") return { required: false, supported: true };
    const immediateObservation = leaf?.rootActionObservation;
    if (!immediateObservation) {
      return { required: true, supported: false, reason: "card-corner-immediate-outcome-missing" };
    }
    const immediateStateValue = valueFromStrategicFacts(
      outcomeModel.createStrategicFacts(immediateObservation, context.seatId),
    );
    const immediateValue = leafValue(
      rootValue,
      immediateStateValue,
      parameters,
    );
    if (immediateValue.primaryValue > 0) {
      return { required: true, supported: true, reason: "card-corner-immediate-primary" };
    }
    if (action.payload?.kind === "move") {
      return { required: true, supported: true, reason: "card-corner-probe-progress" };
    }
    if (
      finite(immediateStateValue.resourceFacts?.availableData)
      > finite(rootValue.resourceFacts?.availableData)
    ) {
      return { required: true, supported: true, reason: "card-corner-data-progress" };
    }
    const nextAgent = (leaf?.secondaryAgentTrace || []).find((candidate) => (
      !["card_corner", "end_turn", "pass"].includes(candidate?.family)
    ));
    if (!nextAgent) {
      return { required: true, supported: false, reason: "card-corner-no-followup-agent" };
    }
    const nextKey = actionSemanticKey(nextAgent);
    const rootLegal = (context?.legalActions || [])
      .some((candidate) => actionSemanticKey(candidate) === nextKey);
    const immediatelyLegal = (leaf?.rootActionLegalSuccessors || [])
      .some((candidate) => actionSemanticKey(candidate) === nextKey);
    return {
      required: true,
      supported: immediatelyLegal && !rootLegal,
      reason: immediatelyLegal && !rootLegal
        ? "card-corner-directly-unlocked-agent"
        : "card-corner-did-not-directly-unlock-agent",
      nextAgent,
    };
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
    const incomeValue = incomePerWindowValue * remainingRounds;
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
    const actualScoreDelta = (
      leafValueState.realizedScore + finite(leafValueState.securedEndGameBonus)
    ) - (
      rootValue.realizedScore + finite(rootValue.securedEndGameBonus)
    );
    const infrastructure = infrastructureDeltaValue(rootValue, leafValueState, parameters);
    const netAssetSpend = Object.entries(ASSET_OPPORTUNITY_VALUES)
      .reduce((total, [key, unitValue]) => (
        total + (finite(rootValue.resourceFacts?.[key]) - finite(leafValueState.resourceFacts?.[key]))
          * unitValue
      ), 0);
    const opportunityCost = Math.max(0, netAssetSpend);
    return {
      total: actualScoreDelta + infrastructure.total - opportunityCost,
      primaryValue: actualScoreDelta + infrastructure.total,
      actualScoreDelta,
      infrastructure,
      opportunityCost,
    };
  }

  function evaluateSearchPriority(rootObservation, branchObservation, seatId, parametersInput = {}) {
    const parameters = mergeParameters(parametersInput);
    const rootValue = evaluateState(rootObservation, seatId);
    const branchValue = evaluateState(branchObservation, seatId);
    return leafValue(rootValue, branchValue, parameters).total;
  }

  function valueFromStrategicFacts(facts) {
    return {
      realizedScore: finite(facts.realizedScore),
      securedEndGameBonus: finite(facts.securedEndGameBonus),
      resourceFacts: { ...(facts.resourceFacts || {}) },
      infrastructure: {
        ownedTechIds: [...(facts.ownedTechIds || [])].sort(),
        income: { ...(facts.income || {}) },
        roundNumber: Math.max(1, finite(facts.roundNumber) || 1),
        finalRoundNumber: Math.max(1, finite(facts.finalRoundNumber) || 4),
      },
    };
  }

  function evaluateStrategicFactsBreakdown(rootFacts, branchFacts, parametersInput = {}) {
    if (!rootFacts || !branchFacts
      || rootFacts.viewerSeatId !== branchFacts.viewerSeatId) {
      throw new TypeError("Search priority 需要同 viewer 的战略事实");
    }
    const parameters = mergeParameters(parametersInput);
    return leafValue(
      valueFromStrategicFacts(rootFacts),
      valueFromStrategicFacts(branchFacts),
      parameters,
    );
  }

  function evaluateStrategicFactsPriority(rootFacts, branchFacts, parametersInput = {}) {
    return evaluateStrategicFactsBreakdown(
      rootFacts,
      branchFacts,
      parametersInput,
    ).total;
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
        || Number(left.leaf.quickTradeCount || 0) - Number(right.leaf.quickTradeCount || 0)
        || Number(left.leaf.secondaryAgentDepth || 0) - Number(right.leaf.secondaryAgentDepth || 0)
        || String(left.leaf.leafId || "").localeCompare(String(right.leaf.leafId || ""))
      ));
    const best = evaluatedLeaves[0] || null;
    if (!best) return unavailable(outcome, "strategic-goal-leaf-missing");
    const tradePurpose = quickTradePurpose(context, action, best.leaf);
    if (!tradePurpose.supported) return unavailable(outcome, tradePurpose.reason);
    const cornerPurpose = cardCornerPurpose(
      context,
      action,
      best.leaf,
      rootValue,
      parameters,
    );
    if (!cornerPurpose.supported) return unavailable(outcome, cornerPurpose.reason);
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
      primaryValue: best.strategicValue.primaryValue,
      opportunityCost: best.strategicValue.opportunityCost,
      quickTradeCount: Number(best.leaf.quickTradeCount || 0),
      secondaryAgentDepth: Number(best.leaf.secondaryAgentDepth || 0),
      quickTradePurpose: tradePurpose.required ? tradePurpose : null,
      cardCornerPurpose: cornerPurpose.required ? cornerPurpose : null,
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
        tradePurpose.required ? tradePurpose.reason : null,
        cornerPurpose.required ? cornerPurpose.reason : null,
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
    const strategicValue = evaluateStrategicFactsBreakdown(
      rootFacts,
      branchFacts,
      parametersInput,
    );
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
    const rootPlaced = finite(rootFacts.dataProgress?.computerPlacedCount);
    const branchPlaced = finite(branchFacts.dataProgress?.computerPlacedCount);
    const rootDataGap = Math.max(
      0,
      6 - rootPlaced - finite(rootFacts.resourceFacts?.availableData),
    );
    const branchDataGap = Math.max(
      0,
      6 - branchPlaced - finite(branchFacts.resourceFacts?.availableData),
    );
    return {
      schemaVersion: "seti-secondary-search-priority-v1",
      sortKey: [
        strategicValue.primaryValue,
        finite(matchedRoot?.targetBenefit?.score),
        gapReduction,
        Math.max(0, finite(branchFacts.traceCount) - finite(rootFacts.traceCount)),
        Math.max(0, rootDataGap - branchDataGap),
        Math.max(0, branchPlaced - rootPlaced),
        Number(Boolean(branchFacts.dataProgress?.analyzeReady)
          && finite(branchFacts.resourceFacts?.energy) > 0),
        -strategicValue.opportunityCost,
        finite(branchGoal?.targetBenefit?.score),
        -finite(branchGoal?.required?.movementSteps),
      ],
    };
  }

  function selectSecondaryAgentRouteTarget(input = {}) {
    if (input.routeTargetId === DATA_ANALYZE_ROUTE_TARGET) {
      return input.currentAction?.family === "analyze"
        ? null
        : DATA_ANALYZE_ROUTE_TARGET;
    }
    const branchFacts = outcomeModel.createStrategicFacts(
      input.branchObservation,
      input.focalSeatId,
    );
    const rootFacts = outcomeModel.createStrategicFacts(
      input.rootObservation,
      input.focalSeatId,
    );
    if (
      String(input.currentAction?.actorId || "") === String(input.focalSeatId || "")
      && (
        input.currentAction?.family === "place_data"
        || branchFacts.dataProgress?.analyzeReady
        || finite(branchFacts.resourceFacts?.availableData)
          > finite(rootFacts.resourceFacts?.availableData)
      )
      && (
        finite(branchFacts.resourceFacts?.availableData) > 0
        || finite(branchFacts.dataProgress?.computerPlacedCount) > 0
      )
    ) {
      return DATA_ANALYZE_ROUTE_TARGET;
    }
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
      if (input.routeTargetId === DATA_ANALYZE_ROUTE_TARGET) {
        const analyze = successors.find((action) => action.family === "analyze");
        if (analyze) return [analyze];
        const placeData = successors.find((action) => action.family === "place_data");
        if (placeData) return [placeData];
        const energyTrade = successors.find((action) => (
          action.family === "quick_trade"
          && action.target?.tradeId === "credits-for-energy"
        ));
        const branchFacts = outcomeModel.createStrategicFacts(
          input.branchObservation,
          input.focalSeatId,
        );
        if (
          energyTrade
          && branchFacts.dataProgress?.analyzeReady
          && finite(branchFacts.resourceFacts?.energy) === 0
        ) return [energyTrade];
        const endTurn = successors.find((action) => action.family === "end_turn");
        if (endTurn) return [endTurn];
        const pass = successors.find((action) => action.family === "pass");
        if (pass) return [pass];
        return successors.filter((action) => !["quick_trade", "pass"].includes(action.family));
      }
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
    const pass = successors.find((action) => action.family === "pass");
    if (pass) return [pass];
    const endTurn = successors.find((action) => action.family === "end_turn");
    if (endTurn) return [endTurn];
    const error = new Error(`零规划 rollout 无法推进 opponent: ${actorId || "<missing>"}`);
    error.code = "SECONDARY_AGENT_ROLLOUT_NO_ACTION";
    throw error;
  }

  return Object.freeze({
    EVALUATION_MODEL,
    PARAMETER_VERSION,
    OUTCOME_SCHEMA_VERSION,
    DEFAULT_PARAMETERS,
    INCOME_UNIT_VALUES,
    ASSET_OPPORTUNITY_VALUES,
    SECONDARY_AGENT_ROLLOUT_VERSION,
    mergeParameters,
    requiresCounterfactualOutcome,
    evaluateState,
    evaluateSetupProbeGoals,
    compareSetupProbeGoals,
    evaluateSearchPriority,
    evaluateStrategicFactsPriority,
    evaluateStrategicFactsBreakdown,
    evaluateSecondaryAgentSearchPriority,
    selectSecondaryAgentRouteTarget,
    evaluateAction: evaluateOutcome,
    evaluateOutcome,
    selectSecondaryAgentSuccessors,
  });
});
