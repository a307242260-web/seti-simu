(function (root, factory) {
  "use strict";

  let outcomeModel = root.SetiOutcomeModel;
  let quickTrades = root.SetiQuickTrades;
  let cardEffects = root.SetiCardEffects;
  if (typeof require === "function") {
    outcomeModel = outcomeModel || require("./outcome-model");
    quickTrades = quickTrades || require("../actions/quick-trades");
    cardEffects = cardEffects || require("../cards/effects");
  }
  const api = factory(outcomeModel, quickTrades, cardEffects);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiExpectedScoreEvaluator = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (
  outcomeModel,
  quickTrades,
  cardEffects,
) {
  "use strict";

  const EVALUATION_MODEL = "strategic-goal-search-v2";
  const PARAMETER_VERSION = "seti-strategic-goal-search-v2";
  const OUTCOME_SCHEMA_VERSION = outcomeModel.OUTCOME_SCHEMA_VERSION;
  const SECONDARY_AGENT_ROLLOUT_VERSION = "secondary-agent-rollout-v8";
  const DATA_ANALYZE_ROUTE_TARGET = "data:analyze";
  const CONTROL_FAMILIES = Object.freeze(new Set(["end_turn", "pass"]));
  const UNEVALUATED_ROOT_FAMILIES = Object.freeze(new Set(["end_turn", "pass"]));
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
    const preparesSectorGoal = resourceGapAfterTrade(
      observation,
      rawSectorWinRequirements(observation)?.standardScanCost || {},
      action,
      seatId,
    )?.reduction > 0;
    const preparesIncomeGoal = (rawIncomeGainRequirements(observation)?.plans || [])
      .some((plan) => resourceGapAfterTrade(
        observation,
        plan.nextCost || {},
        action,
        seatId,
      )?.reduction > 0);
    return preparesAnalyze
      || preparesProbeGoal
      || preparesDataGoal
      || preparesSectorGoal
      || preparesIncomeGoal;
  }

  function countsSecondaryAgentGoal() {
    return false;
  }

  function completesSecondaryAgentRouteTarget(input = {}) {
    const action = input.action;
    const targetId = String(input.targetId || "");
    if (!action || !targetId) return false;
    if (targetId === DATA_ANALYZE_ROUTE_TARGET) return action.family === "analyze";
    if (targetId === `decision:${action.actionId}`) return true;
    if (targetId.startsWith("card:resolve:")) {
      const instanceId = targetId.slice("card:resolve:".length);
      return !(input.branchObservation?.selfState?.hand || []).some((card) => (
        String(card?.id) === instanceId
      ));
    }
    if (targetId.startsWith("tech:gain:")) {
      const tileId = targetId.slice("tech:gain:".length);
      const ownedTechIds = input.branchObservation?.outcomeProjection?.progress?.ownedTechIds
        || outcomeModel.createStrategicFacts(
          input.branchObservation,
          input.focalSeatId,
        ).ownedTechIds
        || [];
      return ownedTechIds.includes(tileId);
    }
    if (targetId.startsWith("sector:win:")) {
      const [, , sectorId, settlementNumber] = targetId.split(":");
      return (rawSectorWinRequirements(input.branchObservation)?.wins || []).some((win) => (
        String(win?.sectorId) === sectorId
        && finite(win?.settlementNumber) === finite(settlementNumber)
      ));
    }
    if (targetId.startsWith("income:gain:")) {
      const baseline = targetId.slice("income:gain:".length)
        .split(",")
        .map(finite);
      const income = input.branchObservation?.outcomeProjection?.progress?.income
        || outcomeModel.createStrategicFacts(
          input.branchObservation,
          input.focalSeatId,
        ).income
        || {};
      return [
        "credits",
        "energy",
        "publicity",
        "availableData",
        "handSize",
        "additionalPublicScan",
      ].some((key, index) => finite(income[key]) > finite(baseline[index]));
    }
    const [family, planetId, targetType = "planet", satelliteId = ""] = targetId.split(":");
    if (!["orbit", "land"].includes(family) || action.family !== family) return false;
    return String(action.target?.planetId || "") === planetId
      && String(action.target?.type || "planet") === targetType
      && String(action.target?.satelliteId || "") === satelliteId;
  }

  function secondaryAgentCompletionFacts(observation, seatId) {
    const facts = outcomeModel.createStrategicFacts(observation, seatId);
    return {
      schemaVersion: "seti-secondary-agent-completion-facts-v1",
      score: finite(facts.realizedScore) + finite(facts.securedEndGameBonus),
      resources: {
        credits: finite(facts.resourceFacts?.credits),
        energy: finite(facts.resourceFacts?.energy),
        publicity: finite(facts.resourceFacts?.publicity),
        availableData: finite(facts.resourceFacts?.availableData),
        additionalPublicScan: finite(facts.resourceFacts?.additionalPublicScan),
        ordinaryCards: finite(facts.resourceFacts?.ordinaryCards),
        alienCards: finite(facts.resourceFacts?.alienCards),
      },
      income: {
        credits: finite(facts.income?.credits),
        energy: finite(facts.income?.energy),
        publicity: finite(facts.income?.publicity),
        availableData: finite(facts.income?.availableData),
        handSize: finite(facts.income?.handSize),
        additionalPublicScan: finite(facts.income?.additionalPublicScan),
      },
      ownedTechIds: [...new Set(facts.ownedTechIds || [])].map(String).sort(),
    };
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

  function rawSectorWinRequirements(observation) {
    return observation?.sectorWinRequirements
      || observation?.outcomeProjection?.progress?.sectorWinRequirements
      || null;
  }

  function rawIncomeGainRequirements(observation) {
    return observation?.incomeGainRequirements
      || observation?.outcomeProjection?.progress?.incomeGainRequirements
      || null;
  }

  function rawTechGainRequirements(observation) {
    return observation?.techGainRequirements
      || observation?.outcomeProjection?.progress?.techGainRequirements
      || null;
  }

  function publicPlayerOf(observation, seatId) {
    const players = observation?.publicState?.players;
    if (Array.isArray(players)) {
      return players.find((player) => (
        String(player?.id ?? player?.playerId) === String(seatId)
      )) || null;
    }
    return players?.[seatId] || Object.values(players || {}).find((player) => (
      String(player?.id ?? player?.playerId) === String(seatId)
    )) || null;
  }

  function selectDataPlacementChoice(observation, successors, seatId) {
    const dataChoices = successors.filter((action) => (
      String(action.target?.choiceId || "").startsWith("data:")
    ));
    if (!dataChoices.length) return [];
    const computer = dataChoices.find((action) => action.target?.target === "computer");
    const requirements = rawDataAnalyzeRequirements(observation);
    const gap = requirements?.nextGap || {};
    const player = publicPlayerOf(observation, seatId);
    const blueSlots = player?.techState?.blueBoardSlots || {};
    const directBonuses = {
      blue1: { resource: "credits", amount: 1 },
      blue2: { resource: "energy", amount: 1 },
    };
    const usefulBlueChoices = dataChoices
      .filter((action) => action.target?.target === "blueBonus")
      .map((action) => {
        const blueSlot = Number(action.target?.blueSlot);
        const tileId = Object.keys(blueSlots).find((candidate) => (
          Number(blueSlots[candidate]) === blueSlot
        ));
        const bonus = directBonuses[tileId] || null;
        return {
          action,
          reduction: bonus
            ? Math.min(finite(gap[bonus.resource]), bonus.amount)
            : 0,
        };
      })
      .filter((candidate) => candidate.reduction > 0)
      .sort((left, right) => (
        right.reduction - left.reduction
        || String(left.action.actionId).localeCompare(String(right.action.actionId))
      ));
    return usefulBlueChoices.length
      ? [usefulBlueChoices[0].action]
      : (computer ? [computer] : []);
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

  function movementPointsFromCardAction(observation, action) {
    if (action?.family !== "play_card") return 0;
    const instanceId = action.target?.cardInstanceId;
    const card = (observation?.selfState?.hand || []).find((candidate) => (
      String(candidate?.id) === String(instanceId)
    ));
    if (!card || typeof cardEffects?.buildPlayEffects !== "function") return 0;
    return cardEffects.buildPlayEffects(card).reduce((total, effect) => (
      [cardEffects.EFFECT_TYPES.CARD_MOVE, cardEffects.EFFECT_TYPES.FREE_MOVE]
        .includes(effect?.type)
        ? total + Math.max(1, finite(effect?.options?.movementPoints) || 1)
        : total
    ), 0);
  }

  function selectProbeMovementCards(observation, goal, actions) {
    if (goal?.nextStep?.family !== "move") return [];
    return actions
      .filter((action) => movementPointsFromCardAction(observation, action) > 0)
      .sort((left, right) => (
        finite(left.payload?.cost?.credits) - finite(right.payload?.cost?.credits)
        || String(left.actionId).localeCompare(String(right.actionId))
      ));
  }

  function resourceFactsOf(observation, seatId) {
    if (observation?.outcomeProjection?.assets) return observation.outcomeProjection.assets;
    return outcomeModel.createStrategicFacts(observation, seatId).resourceFacts || {};
  }

  function resourceGapAfterTrade(observation, required, action, seatId) {
    if (action?.family !== "quick_trade") return null;
    const cost = action.payload?.cost;
    const gain = action.payload?.gain;
    if (!cost || !gain) return null;
    const assets = resourceFactsOf(observation, seatId);
    let before = 0;
    let after = 0;
    for (const resource of ["credits", "energy"]) {
      before += Math.max(0, finite(required?.[resource]) - finite(assets[resource]));
      const availableAfterTrade = finite(assets[resource])
        - finite(cost[resource])
        + finite(gain[resource]);
      after += Math.max(0, finite(required?.[resource]) - availableAfterTrade);
    }
    return { before, after, reduction: Math.max(0, before - after) };
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
      reduction: Math.max(
        0,
        before.credits + before.energy - after.credits - after.energy,
      ),
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
    function add(targetId, planId, actions, resultTargetIds = [targetId]) {
      const compatibleActionIds = [...new Set(actions
        .map((action) => action?.actionId)
        .filter((actionId) => legalIds.has(actionId)))]
        .sort();
      if (!compatibleActionIds.length) return;
      const key = String(planId);
      const existing = targets.get(key) || {
        targetId,
        planId,
        resultTargetIds: [],
        compatibleActionIds: [],
      };
      if (existing.targetId !== targetId) {
        throw new TypeError(`次级目标计划 ${planId} 绑定了多个完成目标`);
      }
      targets.set(key, {
        ...existing,
        resultTargetIds: [...new Set([
          ...existing.resultTargetIds,
          ...resultTargetIds.filter(Boolean),
        ])].sort(),
        compatibleActionIds: [...new Set([
          ...existing.compatibleActionIds,
          ...compatibleActionIds,
        ])].sort(),
      });
    }

    const probeGoals = (rawProbeRequirements(input.rootObservation)?.candidates || [])
      .filter((goal) => probeGoalResourceReachable(
        input.rootObservation,
        goal,
        input.focalSeatId,
      ));
    function probePlanActions(goal) {
      const exact = legalActions.filter((action) => (
        actionMatchesProbeStep(action, goal.nextStep)
      ));
      const movementCards = selectProbeMovementCards(
        input.rootObservation,
        goal,
        legalActions,
      );
      const resourcePreparation = exact.length
        ? []
        : selectMinimumCostResourcePreparation(
          input.rootObservation,
          goal.required || {},
          legalActions,
          input.focalSeatId,
        );
      return [...exact.slice(0, 1), ...movementCards, ...resourcePreparation];
    }
    for (const goal of probeGoals) {
      add(
        goal.targetId,
        `probe:${goal.requirementId || goal.targetId}`,
        probePlanActions(goal),
      );
    }

    const dataRequirements = rawDataAnalyzeRequirements(input.rootObservation);
    if (dataRequirements) {
      const requiredAction = legalActions.find((action) => (
        action.family === dataRequirements.nextStep
      ));
      add(
        DATA_ANALYZE_ROUTE_TARGET,
        DATA_ANALYZE_ROUTE_TARGET,
        requiredAction
          ? [requiredAction]
          : selectDataResourcePreparation(
            input.rootObservation,
            legalActions,
            input.focalSeatId,
          ),
      );
    }

    const sectorRequirements = rawSectorWinRequirements(input.rootObservation);
    if (sectorRequirements) {
      const candidatesById = new Map((sectorRequirements.candidates || []).map((candidate) => [
        candidate.sectorId,
        candidate,
      ]));
      for (const source of sectorRequirements.accessSources || []) {
        const accessible = (source.sectorIds || [])
          .map((sectorId) => candidatesById.get(sectorId))
          .filter(Boolean)
          .sort((left, right) => (
            left.minimumOwnMarks - right.minimumOwnMarks
            || left.openSlotCount - right.openSlotCount
            || left.sectorId.localeCompare(right.sectorId)
          ));
        const candidate = accessible[0];
        if (!candidate) continue;
        if (source.family === "scan") {
          const scan = legalActions.find((action) => action.family === "scan");
          const preparation = scan
            ? [scan]
            : selectMinimumCostResourcePreparation(
              input.rootObservation,
              sectorRequirements.standardScanCost || {},
              legalActions,
              input.focalSeatId,
            );
          add(
            candidate.targetId,
            `sector:${source.sourceId}:${candidate.sectorId}`,
            preparation,
          );
        } else if (source.family === "play_card") {
          add(
            candidate.targetId,
            `sector:${source.sourceId}:${candidate.sectorId}`,
            legalActions.filter((action) => (
              action.family === "play_card"
              && String(action.target?.cardInstanceId) === String(source.cardInstanceId)
            )),
          );
        }
      }
    }

    const incomeRequirements = rawIncomeGainRequirements(input.rootObservation);
    if (incomeRequirements) {
      for (const plan of incomeRequirements.plans || []) {
        if (plan.kind === "probe") {
          const probe = probeGoals.find((goal) => (
            goal.requirementId === plan.probeRequirementId
          ));
          if (probe) {
            add(
              probe.targetId,
              plan.planId,
              probePlanActions(probe),
              [probe.targetId, incomeRequirements.targetId],
            );
          }
          continue;
        }
        if (plan.kind === "card") {
          const targetId = `card:resolve:${plan.cardInstanceId}`;
          add(
            targetId,
            plan.planId,
            legalActions.filter((action) => (
              action.family === "play_card"
              && String(action.target?.cardInstanceId) === String(plan.cardInstanceId)
            )),
            [targetId, incomeRequirements.targetId],
          );
          continue;
        }
        let actions = [];
        if (plan.kind === "data") {
          const direct = legalActions.find((action) => (
            action.family === plan.nextStep?.family
          ));
          actions = direct
            ? [direct]
            : selectMinimumCostResourcePreparation(
              input.rootObservation,
              plan.nextCost || {},
              legalActions,
              input.focalSeatId,
            );
        } else if (plan.kind === "industry") {
          actions = legalActions.filter((action) => (
            action.family === "industry"
            && String(action.target?.abilityId || action.payload?.abilityId || "")
              === String(plan.abilityId)
          ));
        }
        add(incomeRequirements.targetId, plan.planId, actions);
      }
    }

    const researchAction = legalActions.find((action) => action.family === "research_tech");
    if (researchAction) {
      for (const plan of rawTechGainRequirements(input.rootObservation)?.plans || []) {
        add(plan.targetId, plan.planId, [researchAction]);
      }
    }

    for (const action of legalActions) {
      if (action.phase === "conditional") {
        add(`decision:${action.actionId}`, `decision:${action.actionId}`, [action]);
        continue;
      }
      if (action.family === "play_card") {
        const instanceId = String(action.target?.cardInstanceId || "");
        if (instanceId) add(
          `card:resolve:${instanceId}`,
          `card:${instanceId}`,
          [action],
        );
      }
    }
    return [...targets.values()]
      .sort((left, right) => (
        left.targetId.localeCompare(right.targetId)
        || left.planId.localeCompare(right.planId)
      ));
  }

  function selectSecondaryAgentRootActions(input = {}) {
    const legalActions = input.legalActions || [];
    const compatibleActionIds = new Set(enumerateSecondaryAgentRootTargets({
      focalSeatId: input.focalSeatId,
      rootObservation: input.rootObservation,
      legalActions,
      maxProxyDepth: input.maxProxyDepth,
    }).flatMap((target) => target.compatibleActionIds));
    return legalActions.filter((action) => compatibleActionIds.has(action.actionId));
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
    const routeTargetIds = [...new Set((input.routeTargetIds || []).filter(Boolean))];
    const completedBoundTarget = routeTargetIds.some((targetId) => (
      completesSecondaryAgentRouteTarget({
        action: input.currentAction,
        targetId,
        focalSeatId: input.focalSeatId,
        rootObservation: input.rootObservation,
        branchObservation: input.branchObservation,
      })
    ));
    const rootDataRequirements = rawDataAnalyzeRequirements(input.rootObservation);
    const branchDataRequirements = rawDataAnalyzeRequirements(input.branchObservation);
    const dataRouteProgress = routeTargetIds.includes(DATA_ANALYZE_ROUTE_TARGET)
      ? Math.max(
        0,
        finite(rootDataRequirements?.remainingPlacements)
          - finite(branchDataRequirements?.remainingPlacements),
      )
      : 0;
    const branchGoalsByTarget = new Map(
      (rawProbeRequirements(input.branchObservation)?.candidates || [])
        .map((goal) => [goal.targetId, goal]),
    );
    const rootGoalsByTarget = new Map(
      (rawProbeRequirements(input.rootObservation)?.candidates || [])
        .map((goal) => [goal.targetId, goal]),
    );
    const boundProbeProgress = routeTargetIds.reduce((best, targetId) => {
      const rootGoal = rootGoalsByTarget.get(targetId);
      const branchGoal = branchGoalsByTarget.get(targetId);
      if (!rootGoal || !branchGoal) return best;
      const rootRemaining = gapSize(rootGoal) + finite(rootGoal.required?.movementSteps);
      const branchRemaining = gapSize(branchGoal) + finite(branchGoal.required?.movementSteps);
      return Math.max(best, rootRemaining - branchRemaining);
    }, 0);
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
        Number(completedBoundTarget),
        dataRouteProgress + boundProbeProgress,
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
    ) {
      return null;
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
    const bindRoute = (
      actions,
      routeTargetId,
      routePlanId,
      routeResultTargetIds = input.routeResultTargetIds,
    ) => actions.map((action) => ({
      ...action,
      routeTargetId: routeTargetId || null,
      routePlanId: routePlanId || null,
      routeResultTargetIds: [...(routeResultTargetIds || (
        routeTargetId ? [routeTargetId] : []
      ))],
    }));
    const focalSeatId = String(input.focalSeatId || "");
    const actorId = String(successors[0]?.actorId || "");
    const targetUsesFungibleResources = input.routeTargetId === DATA_ANALYZE_ROUTE_TARGET
      || String(input.routeTargetId || "").startsWith("sector:win:")
      || String(input.routePlanId || "").startsWith("probe:")
      || input.routePlanId === "income:data:computer-slot-4";
    const continueBoundTargetNextTurn = (routePlanId = input.routePlanId) => {
      const endTurn = successors.find((action) => action.family === "end_turn");
      return bindRoute(
        endTurn ? [endTurn] : [],
        input.routeTargetId,
        routePlanId,
      );
    };
    if (actorId === focalSeatId) {
      const terminalHandIdentityChoices = !input.routeTargetId
        && successors[0]?.phase === "conditional"
        && successors.every((action) => (
          action.family === "choose_card"
          && ["pass-reserve-card", "pass-hand-limit"].includes(action.target?.kind)
        ));
      if (terminalHandIdentityChoices) {
        return bindRoute(successors.slice(0, 1), null, null, [])
          .map((action) => ({
            ...action,
            targetEquivalentChoiceCount: successors.length - 1,
          }));
      }
      if (!input.routeTargetId) {
        const targetCatalog = enumerateSecondaryAgentRootTargets({
          focalSeatId,
          rootObservation: input.branchObservation,
          legalActions: successors,
          maxProxyDepth: input.maxProxyDepth,
        });
        const legalById = new Map(successors.map((action) => [action.actionId, action]));
        function targetResourceLowerBound(target) {
          const probe = (rawProbeRequirements(input.branchObservation)?.candidates || [])
            .find((goal) => (
              target.targetId === goal.targetId
              && (
                target.planId === `probe:${goal.requirementId || goal.targetId}`
                || target.planId.startsWith("probe:")
              )
            ));
          if (probe) {
            return [
              finite(probe.gap?.credits) + finite(probe.gap?.energy),
              finite(probe.gap?.credits),
              finite(probe.gap?.energy),
              finite(probe.gap?.movementSteps),
              target.planId,
            ];
          }
          if (target.targetId === DATA_ANALYZE_ROUTE_TARGET) {
            const requirements = rawDataAnalyzeRequirements(input.branchObservation);
            return [
              finite(requirements?.nextGap?.credits)
                + finite(requirements?.nextGap?.energy)
                + finite(requirements?.remainingPlacements),
              finite(requirements?.nextGap?.credits),
              finite(requirements?.nextGap?.energy),
              finite(requirements?.remainingPlacements),
              target.planId,
            ];
          }
          if (String(target.targetId).startsWith("sector:win:")) {
            const sectorId = target.targetId.split(":")[2];
            const requirements = rawSectorWinRequirements(input.branchObservation);
            const candidate = (requirements?.candidates || []).find((entry) => (
              String(entry.sectorId) === sectorId
            ));
            const marks = finite(candidate?.minimumOwnMarks);
            const cost = requirements?.standardScanCost || {};
            return [
              marks * (finite(cost.credits) + finite(cost.energy)),
              marks * finite(cost.credits),
              marks * finite(cost.energy),
              marks,
              target.planId,
            ];
          }
          const actionCosts = target.compatibleActionIds
            .map((actionId) => legalById.get(actionId)?.payload?.cost || {})
            .map((cost) => ({
              total: finite(cost.credits)
                + finite(cost.energy)
                + finite(cost.publicity)
                + finite(cost.handSize),
              credits: finite(cost.credits),
              energy: finite(cost.energy),
              handSize: finite(cost.handSize),
            }))
            .sort((left, right) => (
              left.total - right.total
              || left.credits - right.credits
              || left.energy - right.energy
              || left.handSize - right.handSize
            ));
          const best = actionCosts[0] || {};
          return [
            finite(best.total),
            finite(best.credits),
            finite(best.energy),
            finite(best.handSize),
            target.planId,
          ];
        }
        const scheduledCatalog = input.focalProxyDepth > 0 && targetCatalog.length
          ? [[...targetCatalog].sort((left, right) => {
            const leftKey = targetResourceLowerBound(left);
            const rightKey = targetResourceLowerBound(right);
            for (let index = 0; index < leftKey.length; index += 1) {
              if (leftKey[index] !== rightKey[index]) {
                return typeof leftKey[index] === "number"
                  ? leftKey[index] - rightKey[index]
                  : String(leftKey[index]).localeCompare(String(rightKey[index]));
              }
            }
            return 0;
          })[0]]
          : targetCatalog;
        const targeted = scheduledCatalog.flatMap((target) => (
          target.compatibleActionIds.map((actionId) => ({
            ...legalById.get(actionId),
            routeTargetId: target.targetId,
            routePlanId: target.planId,
            routeResultTargetIds: target.resultTargetIds,
          }))
        ));
        const targetSchedulerPrunedCount = targetCatalog.length - scheduledCatalog.length;
        if (targeted.length && targetSchedulerPrunedCount > 0) {
          targeted[0] = {
            ...targeted[0],
            targetSchedulerPrunedCount,
          };
        }
        const controls = successors
          .filter((action) => CONTROL_FAMILIES.has(action.family))
          .map((action) => ({
            ...action,
            routeTargetId: null,
            routePlanId: null,
            routeResultTargetIds: [],
          }));
        return [...targeted, ...controls];
      }
      if (successors[0]?.phase === "conditional") {
        const fungiblePaymentChoices = targetUsesFungibleResources
          && successors.every((action) => (
            action.family === "choose_payment"
            && action.target?.kind === "discard-hand-cards"
          ));
        if (fungiblePaymentChoices) {
          return bindRoute(
            successors.slice(0, 1),
            input.routeTargetId,
            input.routePlanId,
          ).map((action) => ({
            ...action,
            targetEquivalentChoiceCount: successors.length - 1,
          }));
        }
        const fungibleTradeCardChoices = targetUsesFungibleResources
          && successors.every((action) => (
            action.family === "choose_card"
            && action.target?.kind === "trade-card-selection"
          ));
        if (fungibleTradeCardChoices) {
          return bindRoute(
            successors.slice(0, 1),
            input.routeTargetId,
            input.routePlanId,
          ).map((action) => ({
            ...action,
            targetEquivalentChoiceCount: successors.length - 1,
          }));
        }
        const movePaymentChoices = targetUsesFungibleResources
          && successors.every((action) => (
            action.family === "choose_payment"
            && action.target?.kind === "move-payment"
          ));
        if (movePaymentChoices) {
          const representatives = new Map();
          for (const action of successors) {
            const key = [
              finite(action.payload?.energyCost),
              (action.target?.cardIds || []).length,
            ].join(":");
            if (!representatives.has(key)) representatives.set(key, action);
          }
          const selected = [...representatives.values()];
          return bindRoute(selected, input.routeTargetId, input.routePlanId)
            .map((action, index) => ({
              ...action,
              ...(index === 0 && selected.length < successors.length
                ? { targetEquivalentChoiceCount: successors.length - selected.length }
                : {}),
            }));
        }
        if (String(input.routeTargetId || "").startsWith("tech:gain:")) {
          const plan = (rawTechGainRequirements(input.branchObservation)?.plans || [])
            .find((candidate) => candidate.planId === input.routePlanId);
          if (plan) {
            const techChoices = successors.filter((action) => (
              String(action.target?.tileId || "") === String(plan.tileId)
              && (
                plan.blueSlot == null
                || finite(action.target?.blueSlot) === finite(plan.blueSlot)
              )
            ));
            if (techChoices.length) {
              return bindRoute(techChoices, input.routeTargetId, input.routePlanId);
            }
          }
        }
        const nebulaChoices = successors.filter((action) => action.target?.nebulaId);
        if (nebulaChoices.length) {
          const boundSectorId = String(input.routeTargetId || "").startsWith("sector:win:")
            ? input.routeTargetId.split(":")[2]
            : null;
          const candidateBySector = new Map(
            (rawSectorWinRequirements(input.branchObservation)?.candidates || [])
              .map((candidate) => [candidate.sectorId, candidate]),
          );
          const selectedSectorId = boundSectorId || [...new Set(
            nebulaChoices.map((action) => String(action.target.nebulaId)),
          )].sort((left, right) => {
            const leftCandidate = candidateBySector.get(left);
            const rightCandidate = candidateBySector.get(right);
            if (!leftCandidate && !rightCandidate) return left.localeCompare(right);
            if (!leftCandidate) return 1;
            if (!rightCandidate) return -1;
            return finite(leftCandidate.minimumOwnMarks) - finite(rightCandidate.minimumOwnMarks)
              || finite(leftCandidate.openSlotCount) - finite(rightCandidate.openSlotCount)
              || left.localeCompare(right);
          })[0];
          const selected = nebulaChoices.filter((action) => (
            String(action.target.nebulaId) === selectedSectorId
          ));
          if (selected.length) {
            return bindRoute(
              targetUsesFungibleResources ? selected.slice(0, 1) : selected,
              input.routeTargetId,
              input.routePlanId,
            ).map((action) => ({
              ...action,
              ...(targetUsesFungibleResources && selected.length > 1
                ? { targetEquivalentChoiceCount: selected.length - 1 }
                : {}),
            }));
          }
        }
        if (String(input.routeTargetId || "").startsWith("sector:win:")) {
          const sectorId = input.routeTargetId.split(":")[2];
          const sectorChoices = successors.filter((action) => (
            String(action.target?.nebulaId || "") === sectorId
          ));
          if (sectorChoices.length) {
            return bindRoute(sectorChoices, input.routeTargetId, input.routePlanId);
          }
        }
        if (
          String(input.routeTargetId || "").startsWith("income:gain:")
          && input.routePlanId === "income:data:computer-slot-4"
        ) {
          const computer = successors.filter((action) => (
            action.target?.target === "computer"
          ));
          if (computer.length) {
            return bindRoute(computer, input.routeTargetId, input.routePlanId);
          }
        }
        if (input.routeTargetId === DATA_ANALYZE_ROUTE_TARGET) {
          const dataPlacementChoices = selectDataPlacementChoice(
            input.branchObservation,
            successors,
            input.focalSeatId,
          );
          if (dataPlacementChoices.length) {
            return bindRoute(dataPlacementChoices, input.routeTargetId, input.routePlanId);
          }
        }
        const probeGoal = (rawProbeRequirements(input.branchObservation)?.candidates || [])
          .find((goal) => (
            goal.targetId === input.routeTargetId
          ));
        if (probeGoal?.nextStep?.family === "move") {
          const movementChoices = successors.filter((action) => (
            String(action.target?.rocketId || "") === String(probeGoal.nextStep.rocketId || "")
            && finite(action.target?.deltaX) === finite(probeGoal.nextStep.deltaX)
            && finite(action.target?.deltaY) === finite(probeGoal.nextStep.deltaY)
          ));
          if (movementChoices.length) {
            return bindRoute(
              movementChoices,
              input.routeTargetId,
              `probe:${probeGoal.requirementId || probeGoal.targetId}`,
            );
          }
        }
        return bindRoute(successors, input.routeTargetId, input.routePlanId);
      }
      if (String(input.routeTargetId || "").startsWith("sector:win:")) {
        if (!String(input.routePlanId || "").startsWith("sector:standard-scan:")) return [];
        const requirements = rawSectorWinRequirements(input.branchObservation);
        const scan = successors.find((action) => action.family === "scan");
        if (scan) return bindRoute([scan], input.routeTargetId, input.routePlanId);
        const preparation = selectMinimumCostResourcePreparation(
          input.branchObservation,
          requirements?.standardScanCost || {},
          successors,
          input.focalSeatId,
        );
        if (preparation.length) {
          return bindRoute(preparation, input.routeTargetId, input.routePlanId);
        }
        const assets = resourceFactsOf(input.branchObservation, input.focalSeatId);
        const scanCost = requirements?.standardScanCost || {};
        return finite(assets.credits) >= finite(scanCost.credits)
          && finite(assets.energy) >= finite(scanCost.energy)
          ? continueBoundTargetNextTurn()
          : [];
      }
      if (String(input.routeTargetId || "").startsWith("income:gain:")) {
        const requirements = rawIncomeGainRequirements(input.branchObservation);
        const plan = (requirements?.plans || []).find((candidate) => (
          candidate.planId === input.routePlanId
        ));
        if (!plan) return [];
        if (plan.kind === "card") {
          const play = successors.find((action) => (
            action.family === "play_card"
            && String(action.target?.cardInstanceId) === String(plan.cardInstanceId)
          ));
          return bindRoute(play ? [play] : [], input.routeTargetId, input.routePlanId);
        }
        if (plan.kind === "industry") {
          const industry = successors.find((action) => (
            action.family === "industry"
            && String(action.target?.abilityId || action.payload?.abilityId || "")
              === String(plan.abilityId)
          ));
          return bindRoute(industry ? [industry] : [], input.routeTargetId, input.routePlanId);
        }
        if (plan.kind === "data") {
          const direct = successors.find((action) => action.family === plan.nextStep?.family);
          if (direct) return bindRoute([direct], input.routeTargetId, input.routePlanId);
          const preparation = selectMinimumCostResourcePreparation(
            input.branchObservation,
            plan.nextCost || {},
            successors,
            input.focalSeatId,
          );
          if (preparation.length) {
            return bindRoute(preparation, input.routeTargetId, input.routePlanId);
          }
          const assets = resourceFactsOf(input.branchObservation, input.focalSeatId);
          return finite(assets.credits) >= finite(plan.nextCost?.credits)
            && finite(assets.energy) >= finite(plan.nextCost?.energy)
            ? continueBoundTargetNextTurn()
            : [];
        }
        if (plan.kind === "probe") {
          const goal = (rawProbeRequirements(input.branchObservation)?.candidates || [])
            .find((candidate) => candidate.requirementId === plan.probeRequirementId);
          if (!goal) return [];
          const exact = successors.filter((action) => actionMatchesProbeStep(action, goal.nextStep));
          const movementCards = selectProbeMovementCards(
            input.branchObservation,
            goal,
            successors,
          );
          if (exact.length || movementCards.length) {
            return bindRoute(
              [...exact, ...movementCards],
              input.routeTargetId,
              input.routePlanId,
            );
          }
          const preparation = selectMinimumCostResourcePreparation(
            input.branchObservation,
            goal.required || {},
            successors,
            input.focalSeatId,
          );
          return bindRoute(preparation, input.routeTargetId, input.routePlanId);
        }
        return [];
      }
      if (input.routeTargetId === DATA_ANALYZE_ROUTE_TARGET) {
        const requirements = rawDataAnalyzeRequirements(input.branchObservation);
        const requiredAction = requirements
          ? successors.find((action) => action.family === requirements.nextStep)
          : null;
        if (requiredAction) {
          return bindRoute([requiredAction], input.routeTargetId, input.routePlanId);
        }
        const preparation = requirements
          ? selectDataResourcePreparation(
            input.branchObservation,
            successors,
            input.focalSeatId,
          )
          : [];
        if (preparation.length) {
          return bindRoute(preparation, input.routeTargetId, input.routePlanId);
        }
        if (
          requirements
          && ["analyze", "place_data", "scan"].includes(requirements.nextStep)
        ) {
          const assets = resourceFactsOf(input.branchObservation, input.focalSeatId);
          const cost = requirements.nextCost || {};
          if (
            finite(assets.credits) >= finite(cost.credits)
            && finite(assets.energy) >= finite(cost.energy)
          ) return continueBoundTargetNextTurn();
        }
        if (!requirements) {
          const analyze = successors.find((action) => action.family === "analyze");
          if (analyze) return bindRoute([analyze], input.routeTargetId, input.routePlanId);
          const placeData = successors.find((action) => action.family === "place_data");
          if (placeData) {
            return bindRoute([placeData], input.routeTargetId, input.routePlanId);
          }
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
          ) return bindRoute([energyTrade], input.routeTargetId, input.routePlanId);
        }
        return [];
      }
      const goals = (rawProbeRequirements(input.branchObservation)?.candidates || [])
        .filter((goal) => !input.routeTargetId || (
          goal.targetId === input.routeTargetId
        ));
      if (input.routeTargetId && goals.length) {
        const exact = successors.filter((action) => (
          goals.some((goal) => actionMatchesProbeStep(action, goal.nextStep))
        ));
        const movementCards = goals.flatMap((goal) => selectProbeMovementCards(
          input.branchObservation,
          goal,
          successors,
        )).filter((action, index, actions) => (
          actions.findIndex((candidate) => candidate.actionId === action.actionId) === index
        ));
        if (exact.length || movementCards.length) {
          const nextPlanId = `probe:${goals[0].requirementId || goals[0].targetId}`;
          return bindRoute(
            [...exact, ...movementCards],
            input.routeTargetId,
            nextPlanId,
          );
        }
        const preparation = selectProbeResourcePreparation(
          input.branchObservation,
          goals,
          successors,
          input.focalSeatId,
        );
        if (preparation.length) {
          return bindRoute(
            preparation,
            input.routeTargetId,
            `probe:${goals[0].requirementId || goals[0].targetId}`,
          );
        }
        if (goals.some((goal) => (
          ["launch", "orbit", "land"].includes(goal.nextStep?.family)
          && probeGoalResourceReachable(
            input.branchObservation,
            goal,
            input.focalSeatId,
          )
        ))) {
          return continueBoundTargetNextTurn(
            `probe:${goals[0].requirementId || goals[0].targetId}`,
          );
        }
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
    completesSecondaryAgentRouteTarget,
    secondaryAgentCompletionFacts,
    evaluateState,
    evaluateSetupProbeGoals,
    compareSetupProbeGoals,
    evaluateSearchPriority,
    evaluateStrategicFactsPriority,
    evaluateStrategicFactsBreakdown,
    evaluateSecondaryAgentSearchPriority,
    enumerateSecondaryAgentRootTargets,
    selectSecondaryAgentRootActions,
    selectSecondaryAgentRouteTarget,
    evaluateAction: evaluateOutcome,
    evaluateOutcome,
    selectSecondaryAgentSuccessors,
  });
});
