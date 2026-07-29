(function (root, factory) {
  "use strict";

  let outcomeModel = root.SetiOutcomeModel;
  let quickTrades = root.SetiQuickTrades;
  if (typeof require === "function") {
    outcomeModel = outcomeModel || require("./outcome-model");
    quickTrades = quickTrades || require("../actions/quick-trades");
  }
  const api = factory(outcomeModel, quickTrades);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiExpectedScoreEvaluator = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (outcomeModel, quickTrades) {
  "use strict";

  const EVALUATION_MODEL = "strategic-goal-search-v2";
  const PARAMETER_VERSION = "seti-strategic-goal-search-v2";
  const OUTCOME_SCHEMA_VERSION = outcomeModel.OUTCOME_SCHEMA_VERSION;
  const SECONDARY_AGENT_ROLLOUT_VERSION = "secondary-agent-rollout-v8";
  const DATA_ANALYZE_ROUTE_TARGET = "data:analyze";
  const CARD_PLAY_ROUTE_TARGET = "card:play";
  const CONTROL_FAMILIES = Object.freeze(new Set(["end_turn", "pass"]));
  const SECONDARY_GOAL_ROUTE_FAMILIES = Object.freeze(new Set([
    "launch",
    "move",
    "quick_trade",
    "place_data",
    "card_corner",
  ]));
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
    const preparesProbeGoal = (rawProbeRequirements(context?.observation)?.candidates || [])
      .some((goal) => {
        const projected = probeResourceGapAfterTrade(
          context.observation,
          goal,
          action,
          context.seatId,
        );
        return projected && projected.after < projected.before;
      });
    const preparesDataGoal = nextAgent?.family === rawDataAnalyzeRequirements(
      context?.observation,
    )?.nextStep && dataPaymentGapAfterTrade(
      context?.observation,
      action,
      context.seatId,
    )?.reduction > 0;
    return {
      required: true,
      supported: preparesReadyAnalyze
        || preparesProbeGoal
        || preparesDataGoal
        || (directlyLegal && !alreadyLegal),
      reason: preparesReadyAnalyze
        ? "quick-trade-prepared-ready-analyze"
        : preparesProbeGoal
          ? "quick-trade-reduced-probe-goal-gap"
          : preparesDataGoal
            ? "quick-trade-reduced-data-goal-gap"
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
    if (selectReducedProbeGoal(
      context?.observation,
      immediateObservation,
      context?.seatId,
    )) {
      return { required: true, supported: true, reason: "card-corner-reduced-probe-goal-gap" };
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
    if (leafValue.terminal) {
      return {
        total: 0,
        remainingRounds: 0,
        gainedTechIds: [],
        techValue: 0,
        incomeDelta: Object.fromEntries(Object.keys(INCOME_UNIT_VALUES).map((key) => [key, 0])),
        incomeValue: 0,
      };
    }
    const remainingRounds = Math.max(
      0,
      leafInfrastructure.finalRoundNumber - leafInfrastructure.roundNumber,
    );
    const rootTech = new Set(rootInfrastructure.ownedTechIds);
    const gainedTechIds = leafInfrastructure.ownedTechIds
      .filter((tileId) => !rootTech.has(tileId));
    const techValue = gainedTechIds.length
      * remainingRounds
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
    const opportunityCost = leafValueState.terminal ? 0 : Math.max(0, netAssetSpend);
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
      terminal: Boolean(facts.terminal),
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
        right.strategicValue.primaryValue - left.strategicValue.primaryValue
        || right.strategicValue.total - left.strategicValue.total
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
    const selectable = best.strategicValue.primaryValue > 0 || control || conditional;
    if (!selectable) return unavailable(outcome, "no-score-tech-or-income-gain");
    return deepFreeze({
      evaluationModel: EVALUATION_MODEL,
      score: best.strategicValue.primaryValue,
      value: best.strategicValue.total,
      sortKey: [
        best.strategicValue.primaryValue,
        -best.strategicValue.opportunityCost,
        -Number(best.leaf.quickTradeCount || 0),
        -Number(best.leaf.secondaryAgentDepth || 0),
      ],
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
      routeTargetId: best.leaf.rootRouteTargetId || null,
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

  function requiresRootCounterfactual(action, observation) {
    if (!requiresCounterfactualOutcome(action)) return false;
    if (action?.family !== "quick_trade") return true;
    const projection = observation?.outcomeProjection;
    const preparesAnalyze = Boolean(
      projection?.progress?.dataProgress?.analyzeReady
      && finite(projection?.assets?.energy) === 0
      && finite(action?.payload?.gain?.energy) > 0
    );
    const preparesCardGoal = finite(action?.payload?.gain?.handSize) > 0
      && finite(action?.payload?.cost?.handSize) === 0;
    const seatId = observation?.viewer?.seatId || observation?.outcomeProjection?.viewerSeatId;
    const preparesProbeGoal = (rawProbeRequirements(observation)?.candidates || [])
      .some((goal) => {
        const projected = probeResourceGapAfterTrade(observation, goal, action, seatId);
        return projected && projected.after < projected.before;
      });
    const preparesDataGoal = dataPaymentGapAfterTrade(
      observation,
      action,
      seatId,
    )?.reduction > 0;
    return preparesAnalyze || preparesCardGoal || preparesProbeGoal || preparesDataGoal;
  }

  function countsSecondaryAgentGoal(action) {
    return Boolean(
      action
      && action.phase !== "conditional"
      && !CONTROL_FAMILIES.has(action.family)
      && !SECONDARY_GOAL_ROUTE_FAMILIES.has(action.family)
    );
  }

  function rawProbeRequirements(observation) {
    return observation?.probeRouteRequirements
      || observation?.outcomeProjection?.progress?.probeGoalRequirements
      || null;
  }

  function rawDataAnalyzeRequirements(observation) {
    return observation?.dataAnalyzeRequirements
      || observation?.outcomeProjection?.progress?.dataAnalyzeRequirements
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

  function resourceFactsOf(observation, seatId) {
    if (observation?.outcomeProjection?.assets) return observation.outcomeProjection.assets;
    return outcomeModel.createStrategicFacts(observation, seatId).resourceFacts || {};
  }

  function probeResourceGapAfterTrade(observation, goal, action, seatId) {
    if (action?.family !== "quick_trade") return null;
    const cost = action.payload?.cost;
    const gain = action.payload?.gain;
    if (!cost || !gain) return null;
    const assets = resourceFactsOf(observation, seatId);
    const required = goal?.required || {};
    const before = {
      credits: Math.max(0, finite(goal?.gap?.credits)),
      energy: Math.max(0, finite(goal?.gap?.energy)),
    };
    const after = {};
    for (const resource of ["credits", "energy"]) {
      const availableAfterTrade = finite(assets[resource])
        - finite(cost[resource])
        + finite(gain[resource]);
      after[resource] = Math.max(0, finite(required[resource]) - availableAfterTrade);
    }
    return {
      before: before.credits + before.energy,
      after: after.credits + after.energy,
    };
  }

  const PLANNED_RESOURCE_KEYS = Object.freeze([
    "credits",
    "energy",
    "publicity",
    "handSize",
  ]);
  const resourceDistanceCache = new Map();
  const resourcePreparationCache = new Map();

  function selectMinimumCostResourcePreparation(
    observation,
    required,
    successors,
    seatId,
  ) {
    const legalByTradeId = new Map(successors
      .filter((action) => action.family === "quick_trade")
      .map((action) => [action.target?.tradeId, action]));
    if (!legalByTradeId.size || !Array.isArray(quickTrades?.TRADE_ACTIONS)) return [];
    const assets = resourceFactsOf(observation, seatId);
    const initial = {
      credits: Math.max(0, Math.floor(finite(assets.credits))),
      energy: Math.max(0, Math.floor(finite(assets.energy))),
      publicity: Math.max(0, Math.floor(finite(assets.publicity))),
      handSize: Math.max(0, Math.floor(finite(assets.ordinaryCards))),
    };
    const target = {
      credits: Math.max(0, Math.ceil(finite(required?.credits))),
      energy: Math.max(0, Math.ceil(finite(required?.energy))),
    };
    const satisfied = (state) => (
      state.credits >= target.credits
      && state.energy >= target.energy
    );
    if (satisfied(initial)) return [];
    const preparationKey = [
      target.credits,
      target.energy,
      ...PLANNED_RESOURCE_KEYS.map((key) => initial[key]),
      ...[...legalByTradeId.keys()].sort(),
    ].join(":");
    if (resourcePreparationCache.has(preparationKey)) {
      return resourcePreparationCache.get(preparationKey)
        .map((tradeId) => legalByTradeId.get(tradeId))
        .filter(Boolean);
    }
    const stateKey = (state) => [
      target.credits,
      target.energy,
      ...PLANNED_RESOURCE_KEYS.map((key) => state[key]),
    ].join(":");
    const available = (state, trade) => PLANNED_RESOURCE_KEYS.every((key) => (
      state[key] >= Math.max(0, finite(trade.cost?.[key]))
    ));
    const applyTrade = (state, trade) => Object.fromEntries(
      PLANNED_RESOURCE_KEYS.map((key) => [
        key,
        state[key]
          - Math.max(0, finite(trade.cost?.[key]))
          + Math.max(0, finite(trade.gain?.[key])),
      ]),
    );
    const edgeLoss = (trade) => PLANNED_RESOURCE_KEYS.reduce((total, key) => (
      total
      + Math.max(0, finite(trade.cost?.[key]))
      - Math.max(0, finite(trade.gain?.[key]))
    ), 0);
    function minimumPlans(state) {
      if (satisfied(state)) {
        return [{
          loss: 0,
          steps: 0,
          terminalKey: PLANNED_RESOURCE_KEYS.map((key) => state[key]).join(":"),
        }];
      }
      const key = stateKey(state);
      if (resourceDistanceCache.has(key)) return resourceDistanceCache.get(key);
      const candidates = [];
      for (const trade of quickTrades.TRADE_ACTIONS) {
        const loss = edgeLoss(trade);
        if (loss <= 0 || !available(state, trade)) continue;
        for (const remaining of minimumPlans(applyTrade(state, trade))) {
          candidates.push({
            loss: loss + remaining.loss,
            steps: 1 + remaining.steps,
            terminalKey: remaining.terminalKey,
          });
        }
      }
      candidates.sort((left, right) => (
        left.loss - right.loss
        || left.steps - right.steps
        || left.terminalKey.localeCompare(right.terminalKey)
      ));
      const best = candidates[0] || null;
      const plans = best
        ? [...new Map(candidates
          .filter((candidate) => (
            candidate.loss === best.loss
            && candidate.steps === best.steps
          ))
          .map((candidate) => [candidate.terminalKey, candidate])).values()]
        : [];
      if (resourceDistanceCache.size >= 100000) resourceDistanceCache.clear();
      resourceDistanceCache.set(key, plans);
      return plans;
    }
    const candidates = [];
    for (const [tradeId, action] of legalByTradeId) {
      const trade = quickTrades.TRADE_ACTIONS.find((candidate) => candidate.id === tradeId);
      if (!trade || !available(initial, trade)) continue;
      for (const remaining of minimumPlans(applyTrade(initial, trade))) {
        candidates.push({
          action,
          loss: edgeLoss(trade) + remaining.loss,
          steps: 1 + remaining.steps,
          terminalKey: remaining.terminalKey,
        });
      }
    }
    candidates.sort((left, right) => (
      left.loss - right.loss
      || left.steps - right.steps
      || left.terminalKey.localeCompare(right.terminalKey)
      || String(left.action.actionId).localeCompare(String(right.action.actionId))
    ));
    const best = candidates[0] || null;
    const plannedTradeIds = (best
      ? [...new Map(candidates
        .filter((candidate) => (
          candidate.loss === best.loss
          && candidate.steps === best.steps
        ))
        .map((candidate) => [candidate.terminalKey, candidate])).values()]
      : [])
      .map((candidate) => candidate.action.target?.tradeId)
      .filter(Boolean);
    if (resourcePreparationCache.size >= 10000) resourcePreparationCache.clear();
    resourcePreparationCache.set(preparationKey, plannedTradeIds);
    return plannedTradeIds
      .map((tradeId) => legalByTradeId.get(tradeId))
      .filter(Boolean);
  }

  function selectProbeResourcePreparation(observation, goals, successors, seatId) {
    return goals.flatMap((goal) => selectMinimumCostResourcePreparation(
      observation,
      goal.required || {},
      successors,
      seatId,
    )).filter((action, index, actions) => (
      actions.findIndex((candidate) => candidate.actionId === action.actionId) === index
    ));
  }

  function dataPaymentGapAfterTrade(observation, action, seatId) {
    if (action?.family !== "quick_trade") return null;
    const requirements = rawDataAnalyzeRequirements(observation);
    const cost = action.payload?.cost;
    const gain = action.payload?.gain;
    if (!requirements || !cost || !gain) return null;
    const assets = resourceFactsOf(observation, seatId);
    const beforeGap = requirements.nextGap || {};
    let after = 0;
    for (const resource of ["credits", "energy"]) {
      const availableAfterTrade = finite(assets[resource])
        - finite(cost[resource])
        + finite(gain[resource]);
      after += Math.max(
        0,
        finite(requirements.nextCost?.[resource]) - availableAfterTrade,
      );
    }
    const before = finite(beforeGap.credits) + finite(beforeGap.energy);
    return { before, after, reduction: before - after };
  }

  function selectDataResourcePreparation(observation, successors, seatId) {
    const requirements = rawDataAnalyzeRequirements(observation);
    return requirements
      ? selectMinimumCostResourcePreparation(
        observation,
        requirements.nextCost || {},
        successors,
        seatId,
      )
      : [];
  }

  function enumerateSecondaryAgentRootTargets(input = {}) {
    const legalActions = [...(input.legalActions || [])]
      .sort((left, right) => String(left.actionId).localeCompare(String(right.actionId)));
    const legalIds = new Set(legalActions.map((action) => action.actionId));
    const targets = new Map();
    function add(targetId, actions) {
      const compatibleActionIds = [...new Set(actions
        .map((action) => action?.actionId)
        .filter((actionId) => legalIds.has(actionId)))]
        .sort();
      if (!compatibleActionIds.length) return;
      const existing = targets.get(targetId) || [];
      targets.set(targetId, [...new Set([...existing, ...compatibleActionIds])].sort());
    }

    const probeGoals = (rawProbeRequirements(input.rootObservation)?.candidates || [])
      .filter((goal) => probeGoalResourceReachable(
        input.rootObservation,
        goal,
        input.focalSeatId,
      ));
    for (const action of legalActions) {
      const matchedGoals = probeGoals
        .filter((goal) => {
          if (actionMatchesProbeStep(action, goal.nextStep)) return true;
          const projected = probeResourceGapAfterTrade(
            input.rootObservation,
            goal,
            action,
            input.focalSeatId,
          );
          return projected && projected.after < projected.before;
        })
        .sort((left, right) => compareProbeRouteGoals(
          input.rootObservation,
          left,
          right,
          input.focalSeatId,
        ));
      for (const goal of matchedGoals) add(goal.targetId, [action]);
    }

    const dataRequirements = rawDataAnalyzeRequirements(input.rootObservation);
    if (dataRequirements) {
      add(DATA_ANALYZE_ROUTE_TARGET, legalActions.filter((action) => (
        action.family === dataRequirements.nextStep
        || dataPaymentGapAfterTrade(
          input.rootObservation,
          action,
          input.focalSeatId,
        )?.reduction > 0
      )));
    }

    add(CARD_PLAY_ROUTE_TARGET, legalActions.filter((action) => (
      action.family === "play_card"
      || (
        action.family === "quick_trade"
        && finite(action.payload?.gain?.handSize) > 0
        && finite(action.payload?.cost?.handSize) === 0
      )
    )));

    const formalRouteFamilies = new Set([
      ...SECONDARY_GOAL_ROUTE_FAMILIES,
      "orbit",
      "land",
      "analyze",
      "play_card",
      "pass",
      "end_turn",
    ]);
    for (const action of legalActions) {
      if (action.phase === "conditional") {
        add(`decision:${action.actionId}`, [action]);
        continue;
      }
      if (
        !formalRouteFamilies.has(action.family)
        && !(
          action.family === "scan"
          && targets.get(DATA_ANALYZE_ROUTE_TARGET)?.includes(action.actionId)
        )
      ) add(`action:${action.actionId}`, [action]);
    }
    return [...targets.entries()]
      .map(([targetId, compatibleActionIds]) => ({
        targetId,
        compatibleActionIds,
      }))
      .sort((left, right) => left.targetId.localeCompare(right.targetId));
  }

  function probeGoalResourceReachable(observation, goal, seatId) {
    const assets = resourceFactsOf(observation, seatId);
    const requiredCredits = Math.max(0, finite(goal?.required?.credits));
    const requiredEnergy = Math.max(0, finite(goal?.required?.energy));
    const optimisticFlexibleResources = Math.max(
      0,
      finite(assets.ordinaryCards) + finite(assets.availableData),
    );
    const credits = Math.max(
      0,
      finite(assets.credits) + optimisticFlexibleResources,
    );
    const energy = Math.max(
      0,
      finite(assets.energy) + optimisticFlexibleResources,
    );
    const optimisticCardsFromPublicity = Math.floor(
      (
        finite(assets.publicity)
        + Math.max(0, finite(goal?.publicityStops))
      ) / 3,
    );
    const cardPairs = Math.floor(
      (
        finite(assets.ordinaryCards)
        + finite(assets.alienCards)
        + optimisticCardsFromPublicity
      ) / 2,
    );
    for (let cardsForCredits = 0; cardsForCredits <= cardPairs; cardsForCredits += 1) {
      for (
        let cardsForEnergy = 0;
        cardsForEnergy <= cardPairs - cardsForCredits;
        cardsForEnergy += 1
      ) {
        const preparedCredits = credits + cardsForCredits;
        const preparedEnergy = energy + cardsForEnergy;
        for (
          let creditsForEnergy = 0;
          creditsForEnergy <= Math.floor(preparedCredits / 2);
          creditsForEnergy += 1
        ) {
          const afterCredits = preparedCredits - creditsForEnergy * 2;
          const afterEnergy = preparedEnergy + creditsForEnergy;
          if (afterCredits >= requiredCredits && afterEnergy >= requiredEnergy) return true;
        }
        for (
          let energyForCredits = 0;
          energyForCredits <= Math.floor(preparedEnergy / 2);
          energyForCredits += 1
        ) {
          const afterCredits = preparedCredits + energyForCredits;
          const afterEnergy = preparedEnergy - energyForCredits * 2;
          if (afterCredits >= requiredCredits && afterEnergy >= requiredEnergy) return true;
        }
      }
    }
    return false;
  }

  function compareProbeRouteGoals(observation, left, right, seatId) {
    const leftReachable = probeGoalResourceReachable(observation, left, seatId);
    const rightReachable = probeGoalResourceReachable(observation, right, seatId);
    const leftNet = goalValue(left) - gapSize(left);
    const rightNet = goalValue(right) - gapSize(right);
    return Number(rightReachable) - Number(leftReachable)
      || rightNet - leftNet
      || compareGoals(left, right);
  }

  function selectReducedProbeGoal(rootObservation, branchObservation, seatId) {
    const branchGoals = rawProbeRequirements(branchObservation)?.candidates || [];
    return (rawProbeRequirements(rootObservation)?.candidates || [])
      .map((rootGoal) => ({
        rootGoal,
        branchGoal: branchGoals.find((candidate) => candidate.targetId === rootGoal.targetId),
      }))
      .filter(({ rootGoal, branchGoal }) => (
        branchGoal && gapSize(branchGoal) < gapSize(rootGoal)
      ))
      .sort((left, right) => compareProbeRouteGoals(
        branchObservation,
        left.branchGoal,
        right.branchGoal,
        seatId,
      ))[0]?.branchGoal || null;
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
    if (input.routeTargetId === CARD_PLAY_ROUTE_TARGET) {
      return input.currentAction?.family === "play_card"
        ? null
        : CARD_PLAY_ROUTE_TARGET;
    }
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
    ) {
      return null;
    }
    if (
      input.currentAction?.family === "quick_trade"
      && finite(input.currentAction?.payload?.gain?.handSize) > 0
      && finite(input.currentAction?.payload?.cost?.handSize) === 0
    ) {
      return CARD_PLAY_ROUTE_TARGET;
    }
    if (input.currentAction?.family === "quick_trade") {
      const matchedTradeGoals = (rawProbeRequirements(input.rootObservation)?.candidates || [])
        .filter((goal) => {
          const projected = probeResourceGapAfterTrade(
            input.rootObservation,
            goal,
            input.currentAction,
            input.focalSeatId,
          );
          return projected && projected.after < projected.before
            && branchGoals.some((candidate) => candidate.targetId === goal.targetId);
        })
        .sort((left, right) => {
          const leftBranch = branchGoals.find((candidate) => candidate.targetId === left.targetId);
          const rightBranch = branchGoals.find((candidate) => candidate.targetId === right.targetId);
          return compareProbeRouteGoals(
            input.branchObservation,
            leftBranch,
            rightBranch,
            input.focalSeatId,
          );
        });
      if (matchedTradeGoals.length) return matchedTradeGoals[0].targetId;
    }
    if (input.currentAction?.family === "card_corner") {
      return selectReducedProbeGoal(
        input.rootObservation,
        input.branchObservation,
        input.focalSeatId,
      )?.targetId || null;
    }
    if (!["launch", "move", "orbit", "land"].includes(input.currentAction?.family)) return null;
    const matched = (rawProbeRequirements(input.rootObservation)?.candidates || [])
      .filter((goal) => actionMatchesProbeStep(input.currentAction, goal.nextStep))
      .filter((goal) => {
        const branchGoal = branchGoals.find((candidate) => (
          candidate.targetId === goal.targetId
        ));
        return Boolean(branchGoal);
      })
      .sort((left, right) => {
        const leftBranch = branchGoals.find((candidate) => candidate.targetId === left.targetId);
        const rightBranch = branchGoals.find((candidate) => candidate.targetId === right.targetId);
        return compareProbeRouteGoals(
          input.branchObservation,
          leftBranch,
          rightBranch,
          input.focalSeatId,
        );
      })[0] || null;
    return matched?.targetId || null;
  }

  function selectSecondaryAgentSuccessors(input = {}) {
    const successors = [...(input.legalSuccessors || [])]
      .sort((left, right) => String(left.actionId).localeCompare(String(right.actionId)));
    if (!successors.length) return [];
    const bindRoute = (actions, routeTargetId) => actions.map((action) => ({
      ...action,
      routeTargetId: routeTargetId || null,
    }));
    const focalSeatId = String(input.focalSeatId || "");
    const actorId = String(successors[0]?.actorId || "");
    if (actorId === focalSeatId) {
      if (!input.routeTargetId) {
        const targetCatalog = enumerateSecondaryAgentRootTargets({
          focalSeatId,
          rootObservation: input.branchObservation,
          legalActions: successors,
          maxProxyDepth: input.maxProxyDepth,
        });
        const legalById = new Map(successors.map((action) => [action.actionId, action]));
        const targeted = targetCatalog.flatMap((target) => (
          target.compatibleActionIds.map((actionId) => ({
            ...legalById.get(actionId),
            routeTargetId: target.targetId,
          }))
        ));
        const controls = successors
          .filter((action) => CONTROL_FAMILIES.has(action.family))
          .map((action) => ({ ...action, routeTargetId: null }));
        return [...targeted, ...controls];
      }
      if (successors[0]?.phase === "conditional") {
        if (input.routeTargetId === DATA_ANALYZE_ROUTE_TARGET) {
          const dataPlacementChoices = successors.filter((action) => (
            String(action.target?.choiceId || "").startsWith("data:")
          ));
          if (dataPlacementChoices.length) {
            return bindRoute(dataPlacementChoices.filter((action) => (
              action.target?.target === "computer"
            )), input.routeTargetId);
          }
        }
        return bindRoute(successors, input.routeTargetId);
      }
      if (input.routeTargetId === CARD_PLAY_ROUTE_TARGET) {
        const playCards = successors.filter((action) => action.family === "play_card");
        if (playCards.length) return bindRoute(playCards, input.routeTargetId);
        return [];
      }
      if (input.routeTargetId === DATA_ANALYZE_ROUTE_TARGET) {
        const requirements = rawDataAnalyzeRequirements(input.branchObservation);
        const requiredAction = requirements
          ? successors.find((action) => action.family === requirements.nextStep)
          : null;
        if (requiredAction) return bindRoute([requiredAction], input.routeTargetId);
        const preparation = requirements
          ? selectDataResourcePreparation(
            input.branchObservation,
            successors,
            input.focalSeatId,
          )
          : [];
        if (preparation.length) return bindRoute(preparation, input.routeTargetId);
        if (!requirements) {
          const analyze = successors.find((action) => action.family === "analyze");
          if (analyze) return bindRoute([analyze], input.routeTargetId);
          const placeData = successors.find((action) => action.family === "place_data");
          if (placeData) return bindRoute([placeData], input.routeTargetId);
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
          ) return bindRoute([energyTrade], input.routeTargetId);
        }
        return [];
      }
      const goals = (rawProbeRequirements(input.branchObservation)?.candidates || [])
        .filter((goal) => !input.routeTargetId || goal.targetId === input.routeTargetId)
        .filter((goal) => probeGoalResourceReachable(
          input.branchObservation,
          goal,
          input.focalSeatId,
        ));
      if (input.routeTargetId && goals.length) {
        const exact = successors.filter((action) => (
          goals.some((goal) => actionMatchesProbeStep(action, goal.nextStep))
        ));
        if (exact.length) return bindRoute(exact, input.routeTargetId);
        const preparation = selectProbeResourcePreparation(
          input.branchObservation,
          goals,
          successors,
          input.focalSeatId,
        );
        if (preparation.length) return bindRoute(preparation, input.routeTargetId);
        return [];
      }
      return [];
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
    requiresRootCounterfactual,
    countsSecondaryAgentGoal,
    evaluateState,
    evaluateSetupProbeGoals,
    compareSetupProbeGoals,
    evaluateSearchPriority,
    evaluateStrategicFactsPriority,
    evaluateStrategicFactsBreakdown,
    evaluateSecondaryAgentSearchPriority,
    enumerateSecondaryAgentRootTargets,
    selectSecondaryAgentRouteTarget,
    evaluateAction: evaluateOutcome,
    evaluateOutcome,
    selectSecondaryAgentSuccessors,
  });
});
