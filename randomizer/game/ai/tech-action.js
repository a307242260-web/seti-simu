(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAITechAction = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createTechAction(context = {}) {
    const {
      state,
      solar,
      players,
      rocketActions,
      planetStats,
      planetRewards,
      abilities,
      actions,
      quickTrades,
      cardEffects,
      tech,
      data,
      solarState,
      turnState,
      rocketState,
      planetStatsState,
      FINAL_ROUND_NUMBER,
      AI_MOVE_DIRECTIONS,
      AI_TECH_TYPES,
      AI_DIFFICULTY_WEAK_START,
    } = context;
    const addPlan = (...args) => context.addPlan(...args);
    const aiNumber = (...args) => context.aiNumber(...args);
    const applyAiStrategyWeight = (...args) => context.applyAiStrategyWeight(...args);
    const buildAiLandChoicesForPlanet = (...args) => context.buildAiLandChoicesForPlanet(...args);
    const canAiAnalyzeData = (...args) => context.canAiAnalyzeData(...args);
    const canAiMoveThisTurn = (...args) => context.canAiMoveThisTurn(...args);
    const canAiPlanetAcceptLanding = (...args) => context.canAiPlanetAcceptLanding(...args);
    const canAiPlanetAcceptOrbit = (...args) => context.canAiPlanetAcceptOrbit(...args);
    const canPayForMove = (...args) => context.canPayForMove(...args);
    const canStartMainAction = (...args) => context.canStartMainAction(...args);
    const chooseAiLandChoice = (...args) => context.chooseAiLandChoice(...args);
    const countAiFinalMarksForPlayer = (...args) => context.countAiFinalMarksForPlayer(...args);
    const countAiPlayerTech = (...args) => context.countAiPlayerTech(...args);
    const createActionContext = (...args) => context.createActionContext(...args);
    const estimateAiMovePayment = (...args) => context.estimateAiMovePayment(...args);
    const getAiAnalyzeEnergyCost = (...args) => context.getAiAnalyzeEnergyCost(...args);
    const getAiApproxLandEnergyCostForPlayer = (...args) => context.getAiApproxLandEnergyCostForPlayer(...args);
    const getAiAvailableDataRoom = (...args) => context.getAiAvailableDataRoom(...args);
    const getAiBestLandDirectScoreGain = (...args) => context.getAiBestLandDirectScoreGain(...args);
    const getAiBestPlayableLaunchCardRoute = (...args) => context.getAiBestPlayableLaunchCardRoute(...args);
    const getAiBestRevealedAlienTraceDirectScore = (...args) => context.getAiBestRevealedAlienTraceDirectScore(...args);
    const getAiEarlyEnginePressure = (...args) => context.getAiEarlyEnginePressure(...args);
    const getAiLaunchPaymentCost = (...args) => context.getAiLaunchPaymentCost(...args);
    const getAiLiveScorePaceDeficit = (...args) => context.getAiLiveScorePaceDeficit(...args);
    const getAiMapDemand = (...args) => context.getAiMapDemand(...args);
    const getAiMarkedFinalFormulaEntries = (...args) => context.getAiMarkedFinalFormulaEntries(...args);
    const getAiNearestRocketDistanceToPlanet = (...args) => context.getAiNearestRocketDistanceToPlanet(...args);
    const getAiNextMissingFinalScoreThreshold = (...args) => context.getAiNextMissingFinalScoreThreshold(...args);
    const getAiOrange4LaunchRouteRaceRelief = (...args) => context.getAiOrange4LaunchRouteRaceRelief(...args);
    const getAiOrbitDirectScoreGain = (...args) => context.getAiOrbitDirectScoreGain(...args);
    const getAiPlanetAtCoordinate = (...args) => context.getAiPlanetAtCoordinate(...args);
    const getAiPlanningFinalFormulaEntries = (...args) => context.getAiPlanningFinalFormulaEntries(...args);
    const getAiPlayerTechTypeCounts = (...args) => context.getAiPlayerTechTypeCounts(...args);
    const getAiRemainingRoundWeight = (...args) => context.getAiRemainingRoundWeight(...args);
    const getAiRequiredMovePointsFromCoordinate = (...args) => context.getAiRequiredMovePointsFromCoordinate(...args);
    const getAiResourceValuesForRound = (...args) => context.getAiResourceValuesForRound(...args);
    const getAiRewardDirectScore = (...args) => context.getAiRewardDirectScore(...args);
    const getAiRoundNumber = (...args) => context.getAiRoundNumber(...args);
    const getAiSatelliteLandingRaceState = (...args) => context.getAiSatelliteLandingRaceState(...args);
    const getAiStrategyDemand = (...args) => context.getAiStrategyDemand(...args);
    const getAiStrategyWeight = (...args) => context.getAiStrategyWeight(...args);
    const getAiTotalRouteDemand = (...args) => context.getAiTotalRouteDemand(...args);
    const getAiYellowTraceLandCompetitionPenalty = (...args) => context.getAiYellowTraceLandCompetitionPenalty(...args);
    const getCurrentPlayer = (...args) => context.getCurrentPlayer(...args);
    const getEarthSectorCoordinate = (...args) => context.getEarthSectorCoordinate(...args);
    const getMovableTokensForPlayer = (...args) => context.getMovableTokensForPlayer(...args);
    const getResearchTechSelectionOptions = (...args) => context.getResearchTechSelectionOptions(...args);
    const hasAiAnalyzeReadyDataSlot = (...args) => context.hasAiAnalyzeReadyDataSlot(...args);
    const roundAiScore = (...args) => context.roundAiScore(...args);
    const scoreAiBestLandRewardValueForPlanet = (...args) => context.scoreAiBestLandRewardValueForPlanet(...args);
    const scoreAiChongPickupRouteValue = (...args) => context.scoreAiChongPickupRouteValue(...args);
    const scoreAiFinalFormulaDeltaValue = (...args) => context.scoreAiFinalFormulaDeltaValue(...args);
    const scoreAiFinalSecondMarkNoDirectSetupPenalty = (...args) => context.scoreAiFinalSecondMarkNoDirectSetupPenalty(...args);
    const scoreAiHighCostPointConversionPenalty = (...args) => context.scoreAiHighCostPointConversionPenalty(...args);
    const scoreAiHighScorePushValue = (...args) => context.scoreAiHighScorePushValue(...args);
    const scoreAiHuanyuOrange2FutureMoveValue = (...args) => context.scoreAiHuanyuOrange2FutureMoveValue(...args);
    const scoreAiLandResolvedRewardValueForTarget = (...args) => context.scoreAiLandResolvedRewardValueForTarget(...args);
    const scoreAiLaunchPaymentCost = (...args) => context.scoreAiLaunchPaymentCost(...args);
    const scoreAiLowEngineCatchupValue = (...args) => context.scoreAiLowEngineCatchupValue(...args);
    const scoreAiMidgameResourceContinuationValue = (...args) => context.scoreAiMidgameResourceContinuationValue(...args);
    const scoreAiMoveTowardTargets = (...args) => context.scoreAiMoveTowardTargets(...args);
    const scoreAiMovementPathPenalty = (...args) => context.scoreAiMovementPathPenalty(...args);
    const scoreAiNearestActionablePlanetTimingPenalty = (...args) => context.scoreAiNearestActionablePlanetTimingPenalty(...args);
    const scoreAiNoDirectScorePacePenalty = (...args) => context.scoreAiNoDirectScorePacePenalty(...args);
    const scoreAiOrange2MobilityNeed = (...args) => context.scoreAiOrange2MobilityNeed(...args);
    const scoreAiOrbitRewardValue = (...args) => context.scoreAiOrbitRewardValue(...args);
    const scoreAiOuterSatelliteCashoutPremium = (...args) => context.scoreAiOuterSatelliteCashoutPremium(...args);
    const scoreAiPaceValueForDirectScore = (...args) => context.scoreAiPaceValueForDirectScore(...args);
    const scoreAiPlanetMarkerEndGameValue = (...args) => context.scoreAiPlanetMarkerEndGameValue(...args);
    const scoreAiResourceBundle = (...args) => context.scoreAiResourceBundle(...args);
    const scoreAiResourceReservePenaltyForCost = (...args) => context.scoreAiResourceReservePenaltyForCost(...args);
    const scoreAiRewardEffects = (...args) => context.scoreAiRewardEffects(...args);
    const scoreAiRunezuSourceSymbolValue = (...args) => context.scoreAiRunezuSourceSymbolValue(...args);
    const scoreAiSatelliteLandingRaceWastePenalty = (...args) => context.scoreAiSatelliteLandingRaceWastePenalty(...args);
    const scoreAiSecondFinalMarkNudgeValue = (...args) => context.scoreAiSecondFinalMarkNudgeValue(...args);
    const scoreAiThirdFinalMarkCashoutValue = (...args) => context.scoreAiThirdFinalMarkCashoutValue(...args);
    const scoreAiThresholdPressureForScoreGain = (...args) => context.scoreAiThresholdPressureForScoreGain(...args);
    const shouldAiPreserveEnergyForRouteCashout = (...args) => context.shouldAiPreserveEnergyForRouteCashout(...args);
    const sumAiDemandMap = (...args) => context.sumAiDemandMap(...args);

    function scoreAiBlueTechDataEngineValue(player = getCurrentPlayer()) {
      if (!player) return 0;
      const round = getAiRoundNumber();
      if (round >= FINAL_ROUND_NUMBER) return 0;
      const demand = getAiStrategyDemand(player);
      const resources = player.resources || {};
      const requiredSlot = data.ANALYZE_REQUIRED_COMPUTER_SLOT || 6;
      const placedCount = Math.max(0, (data.listComputerPlacedTokens?.(player) || []).length);
      const availableData = Math.max(0, aiNumber(resources.availableData));
      const dataRoom = getAiAvailableDataRoom(player);
      const missingForAnalyze = Math.max(0, requiredSlot - placedCount);
      const canReachAnalyze = placedCount + availableData >= requiredSlot;
      const readyAnalyze = hasAiAnalyzeReadyDataSlot(player);
      const currentScore = Math.max(0, aiNumber(resources.score));
      const catchupEngine = currentScore < 55
        || countAiFinalMarksForPlayer(player) < 2
        || getAiLiveScorePaceDeficit(player) > 18;
      const nearAnalyzeEngine = catchupEngine
        && round <= 3
        && placedCount + availableData >= Math.max(4, requiredSlot - 2);
      const blueTraceDemand = getAiMapDemand(demand.traceTypes, "blue");
      const analyzeDemand = getAiMapDemand(demand.actions, "analyze");
      const scanDemand = getAiMapDemand(demand.actions, "scan");
      let value = 0;
      value += Math.min(4.5, availableData * 0.55);
      value += Math.min(3, placedCount * 0.28);
      value += Math.min(2.5, dataRoom * 0.18);
      value += Math.min(4, (blueTraceDemand * 0.07) + (analyzeDemand * 0.08) + (scanDemand * 0.03));
      if (canReachAnalyze) value += readyAnalyze ? 4.2 : 2.5;
      else if (missingForAnalyze <= 2 && dataRoom > 0) value += 1.4 + (2 - missingForAnalyze) * 0.45;
      if (nearAnalyzeEngine) {
        value += Math.min(
          4.2,
          1.6
            + Math.max(0, 3 - missingForAnalyze) * 0.65
            + Math.min(1.4, analyzeDemand * 0.035 + blueTraceDemand * 0.03),
        );
      }
      if (round <= 2 && countAiFinalMarksForPlayer(player) <= 0) value += getAiEarlyEnginePressure(player) * 0.85;
      return roundAiScore(Math.min(15, Math.max(0, value)));
    }

    function scoreAiTechBonus(bonusId, player = getCurrentPlayer()) {
      const resources = player?.resources || {};
      if (bonusId === "bonus_3f") return getAiRoundNumber() <= 2 ? 2.2 : 3;
      if (bonusId === "bonus_1c") return (getAiRoundNumber() <= 2 ? 5.6 : 4.2)
        + Math.max(0, 3 - (player?.hand || []).length) * 0.4
        + scoreAiMidgameResourceContinuationValue({ handSize: 1, cardSelection: 1 }, player, { scale: 0.38 });
      if (bonusId === "bonus_1p") {
        const catchupEnergy = Math.max(0, aiNumber(resources.score)) < 70
          || countAiFinalMarksForPlayer(player) < 3
          || getAiLiveScorePaceDeficit(player) > 15;
        const continuation = scoreAiMidgameResourceContinuationValue(
          { energy: 1 },
          player,
          { scale: catchupEnergy ? 0.72 : 0.58 },
        );
        if (getAiRoundNumber() <= 2) return (resources.energy <= 2 ? 6.1 : 5) + continuation;
        if (catchupEnergy) return (resources.energy <= 2 ? 5.8 : 3.8) + continuation;
        return (resources.energy <= 2 ? 5.4 : 3.6) + continuation;
      }
      if (bonusId === "bonus_1m") return (getAiRoundNumber() <= 2 ? 1.8 : 2.4)
        + scoreAiMidgameResourceContinuationValue({ publicity: 1 }, player, { scale: 0.35 });
      return 1;
    }

    function getAiResearchTechAfterRewardDirectScore(candidate = {}, options = {}, player = getCurrentPlayer()) {
      const reward = options?.afterResearchReward || null;
      if (!reward || !candidate || !player) return 0;
      if (reward.kind === "techTypeCountScore") {
        const techType = candidate.techType || tech.getTechType?.(candidate.tileId) || "";
        if (!techType) return 0;
        const scorePer = Math.max(0, Math.round(aiNumber(reward.scorePer) || 1));
        const ownedTiles = player.techState?.ownedTiles || {};
        const disabledTiles = player.techState?.disabledTiles || {};
        const currentCount = Object.keys(ownedTiles)
          .filter((tileId) => ownedTiles[tileId] && !disabledTiles[tileId] && String(tileId).startsWith(techType))
          .length;
        const gainsNewTile = ownedTiles[candidate.tileId] ? 0 : 1;
        return Math.max(0, (currentCount + gainsNewTile) * scorePer);
      }
      if (reward.kind === "resourceValueScore") {
        const resource = reward.resource || "publicity";
        return Math.max(0, Math.round(aiNumber(player.resources?.[resource])));
      }
      if (reward.kind === "repeatBonus" && !options.skipBonus && candidate.bonusId === "bonus_3f") {
        return 3;
      }
      return 0;
    }

    function getAiResearchTechDirectScoreGain(candidate = {}, options = {}, player = getCurrentPlayer()) {
      let scoreGain = 0;
      if (candidate?.firstTake) scoreGain += 2;
      if (!options?.skipBonus && candidate?.bonusId === "bonus_3f") scoreGain += 3;
      scoreGain += getAiResearchTechAfterRewardDirectScore(candidate, options, player);
      return scoreGain;
    }

    function scoreAiResearchTechRoutePlan(candidate, player = getCurrentPlayer()) {
      if (!candidate || !player) return null;
      const demand = getAiStrategyDemand(player);
      const plans = [];
      const addPlan = (actionId, label, score, details = {}) => {
        const value = aiNumber(score);
        if (value <= 0) return;
        plans.push({
          type: "tech-synergy",
          mainActionId: "researchTech",
          actionId,
          label,
          score: value,
          ...details,
        });
      };
      const tileId = candidate.tileId || "";
      const techType = candidate.techType || "";
      const routeDemand = getAiTotalRouteDemand(demand);
      const planetDemand = sumAiDemandMap(demand.planetIds);
      const asteroidDemand = getAiMapDemand(demand.locationTypes, "asteroid")
        + getAiMapDemand(demand.locationTypes, "earthAdjacentAsteroid");
      const orange2MobilityNeed = scoreAiOrange2MobilityNeed(player);
      const moveDemand = getAiMapDemand(demand.actions, "move");
      const landDemand = getAiMapDemand(demand.actions, "land");
      const scanDemand = getAiMapDemand(demand.actions, "scan") + sumAiDemandMap(demand.scanColors) * 0.35;
      const engineDemand = getAiMapDemand(demand.actions, "researchTech") + demand.task * 0.08 + demand.final * 0.08;
      const blueDataEngineValue = techType === "blue" ? scoreAiBlueTechDataEngineValue(player) : 0;

      if (tileId === "orange1") {
        addPlan(
          "launch",
          "橙1扩充火箭上限并衔接发射路线",
          Math.max(0, scoreAiLaunchAction(player) * 0.25 + routeDemand * 0.1),
          { tileId, techType },
        );
      }
      if (tileId === "orange2" || techType === "orange") {
        addPlan(
          "move",
          tileId === "orange2" ? "橙2降低小行星移动阻力" : "橙科支持移动/登陆路线",
          moveDemand * 0.18
            + asteroidDemand * 0.45
            + routeDemand * 0.05
            + (tileId === "orange2" ? orange2MobilityNeed * 0.55 : orange2MobilityNeed * 0.16),
          { tileId, techType },
        );
      }
      if (tileId === "orange3" || tileId === "orange4" || techType === "orange") {
        addPlan(
          "land",
          tileId === "orange3"
            ? "橙3降低登陆能量成本"
            : tileId === "orange4"
              ? "橙4打开卫星登陆路线"
              : "橙科支持登陆路线",
          landDemand * 0.22 + planetDemand * 0.08 + routeDemand * 0.04,
          { tileId, techType },
        );
      }
      if (techType === "purple") {
        addPlan(
          "scan",
          tileId === "purple1" ? "紫1提升扫描公共牌能力" : "紫科支持扫描路线",
          scanDemand * 0.16 + getAiAvailableDataRoom(player) * 0.15,
          { tileId, techType },
        );
      }
      if (techType === "blue") {
        addPlan(
          "engine",
          "蓝科补强数据/分析引擎",
          engineDemand * 0.12
            + blueDataEngineValue * 0.55
            + Math.max(0, getAiRemainingRoundWeight() - 1) * 0.3,
          { tileId, techType },
        );
      }

      return plans
        .filter((plan) => Number.isFinite(Number(plan.score)))
        .sort((left, right) => right.score - left.score)[0] || null;
    }

    function scoreAiResearchTechFinalPlanningValue(candidate, player = getCurrentPlayer()) {
      const techType = candidate?.techType || "";
      if (!candidate || !player || !techType) return 0;
      const deltas = getAiResearchTechFinalFormulaDeltas(candidate, player);
      let value = scoreAiFinalFormulaDeltaValue(deltas, player, {
        includePotential: true,
        potentialScale: getAiRoundNumber() >= 3 ? 0.72 : 0.55,
      });

      const d1Entries = getAiPlanningFinalFormulaEntries(player, ["d1"]);
      if (d1Entries.length) {
        const techCounts = getAiPlayerTechTypeCounts(player);
        const counts = AI_TECH_TYPES.map((type) => aiNumber(techCounts[type]));
        const minCount = Math.min(...counts);
        const maxCount = Math.max(...counts);
        const currentTypeCount = aiNumber(techCounts[techType]);
        const bestD1Multiplier = d1Entries.reduce((best, entry) => (
          Math.max(best, aiNumber(entry.multiplier))
        ), 0);
        if (currentTypeCount === minCount) {
          value += Math.min(
            8,
            2.2
              + Math.max(0, 2 - minCount) * 1.15
              + Math.max(0, maxCount - minCount) * 0.55
              + bestD1Multiplier * 0.18,
          );
        } else if (currentTypeCount >= minCount + 2) {
          value -= Math.min(4, 1.2 + (currentTypeCount - minCount - 1) * 0.7);
        }
      }

      return roundAiScore(value);
    }

    function scoreAiLateTechEngineCatchupValue(candidate, player = getCurrentPlayer()) {
      const techType = candidate?.techType || "";
      if (!candidate || !player || !techType || getAiRoundNumber() < 3) return 0;
      const dEntries = getAiPlanningFinalFormulaEntries(player, ["d1", "d2"]);
      if (!dEntries.length) return 0;
      const round = getAiRoundNumber();
      const techCount = countAiPlayerTech(player);
      const finalMarks = countAiFinalMarksForPlayer(player);
      if (techCount >= (round >= FINAL_ROUND_NUMBER ? 11 : 9)) return 0;
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      const markedDEntries = getAiMarkedFinalFormulaEntries(player)
        .filter((entry) => entry.formulaId === "d1" || entry.formulaId === "d2");
      const hasMarkedD2 = markedDEntries.some((entry) => entry.formulaId === "d2");

      let value = finalMarks >= 3 ? 2.4 : finalMarks >= 2 ? 1.4 : 0.6;
      value += Math.max(0, 8 - techCount) * (round >= FINAL_ROUND_NUMBER ? 1.25 : 0.9);

      if (dEntries.some((entry) => entry.formulaId === "d2")) {
        const bestD2Multiplier = dEntries.reduce((best, entry) => (
          entry.formulaId === "d2" ? Math.max(best, aiNumber(entry.multiplier)) : best
        ), 0);
        const beforeBase = Math.floor(techCount / 2);
        const afterBase = Math.floor((techCount + 1) / 2);
        if (afterBase > beforeBase) value += Math.min(5, bestD2Multiplier * 0.85);
        else value += Math.min(2.5, bestD2Multiplier * 0.28);
        if ((hasMarkedD2 || finalMarks >= 2) && techCount <= (round >= FINAL_ROUND_NUMBER ? 7 : 6)) {
          value += Math.min(
            round >= FINAL_ROUND_NUMBER ? 4.5 : 3,
            1.2
              + Math.max(0, 8 - techCount) * 0.55
              + Math.max(0, (round >= FINAL_ROUND_NUMBER ? 170 : 120) - currentScore) * 0.025,
          );
        }
      }

      if (dEntries.some((entry) => entry.formulaId === "d1")) {
        const counts = getAiPlayerTechTypeCounts(player);
        const minCount = Math.min(...AI_TECH_TYPES.map((type) => aiNumber(counts[type])));
        const currentTypeCount = aiNumber(counts[techType]);
        if (currentTypeCount <= minCount) value += 3.2;
        else if (currentTypeCount === minCount + 1) value += 1.2;
        else value -= Math.min(2, currentTypeCount - minCount - 1);
      }

      if (candidate?.bonusId === "bonus_3f") value += 1.2;
      const cap = round >= FINAL_ROUND_NUMBER && techCount <= 7 ? 17 : 13;
      return roundAiScore(Math.min(cap, Math.max(0, value)));
    }

    function scoreAiLowTechBoardCatchupValue(candidate, player = getCurrentPlayer()) {
      const techType = candidate?.techType || "";
      if (!candidate || !player || !techType) return 0;
      const round = getAiRoundNumber();
      if (round < 3) return 0;

      const techCount = countAiPlayerTech(player);
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      const finalMarks = countAiFinalMarksForPlayer(player);
      const dEntries = getAiPlanningFinalFormulaEntries(player, ["d1", "d2"]);
      const markedDEntries = getAiMarkedFinalFormulaEntries(player)
        .filter((entry) => entry.formulaId === "d1" || entry.formulaId === "d2");
      const hasTechFinalPlan = dEntries.length > 0;
      const hasMarkedTechFinal = markedDEntries.length > 0;
      const hasMarkedD2 = markedDEntries.some((entry) => entry.formulaId === "d2");
      const targetTechCount = hasMarkedTechFinal
        ? (round >= FINAL_ROUND_NUMBER ? (hasMarkedD2 ? 10 : 9) : 8)
        : (round >= FINAL_ROUND_NUMBER ? 9 : 7);
      if (techCount >= targetTechCount) return 0;

      const severeLowTech = techCount <= (round >= FINAL_ROUND_NUMBER ? 6 : 4);
      const lowScoreTarget = hasMarkedTechFinal
        ? (round >= FINAL_ROUND_NUMBER ? 165 : 95)
        : (round >= FINAL_ROUND_NUMBER ? 135 : 78);
      const lowScorePressure = currentScore < lowScoreTarget;
      const lowMarkPressure = finalMarks < (round >= FINAL_ROUND_NUMBER ? 3 : 2);

      if (!severeLowTech && !hasTechFinalPlan && !lowScorePressure && !lowMarkPressure) return 0;

      let value = Math.max(0, targetTechCount - techCount) * (round >= FINAL_ROUND_NUMBER ? 0.95 : 0.62);
      if (severeLowTech) value += round >= FINAL_ROUND_NUMBER ? 3 : 2;
      if (lowScorePressure) {
        value += Math.min(
          round >= FINAL_ROUND_NUMBER ? 4.5 : 3,
          1 + Math.max(0, lowScoreTarget - currentScore) * (round >= FINAL_ROUND_NUMBER ? 0.05 : 0.035),
        );
      }
      if (lowMarkPressure) value += round >= FINAL_ROUND_NUMBER ? 1.8 : 1.4;
      if (hasTechFinalPlan) {
        value += hasMarkedTechFinal
          ? (round >= FINAL_ROUND_NUMBER ? 2 : 1.2)
          : (round >= FINAL_ROUND_NUMBER ? 0.9 : 0.45);
      }

      if (dEntries.some((entry) => entry.formulaId === "d1")) {
        const counts = getAiPlayerTechTypeCounts(player);
        const minCount = Math.min(...AI_TECH_TYPES.map((type) => aiNumber(counts[type])));
        const currentTypeCount = aiNumber(counts[techType]);
        if (currentTypeCount <= minCount) value += 1.4;
        else if (currentTypeCount >= minCount + 2) value -= Math.min(1.5, currentTypeCount - minCount - 1);
      }
      if (dEntries.some((entry) => entry.formulaId === "d2")) {
        const beforeBase = Math.floor(techCount / 2);
        const afterBase = Math.floor((techCount + 1) / 2);
        value += afterBase > beforeBase
          ? (hasMarkedD2 ? 2.2 : 1.6)
          : (hasMarkedD2 ? 0.75 : 0.45);
      }

      if (candidate?.bonusId === "bonus_3f") value += 0.8;
      if (candidate?.firstTake) value += 0.45;
      return roundAiScore(Math.min(hasMarkedTechFinal ? 13 : 10, Math.max(0, value)));
    }

    function getAiOrange4SatellitePotentialProfile(player = getCurrentPlayer()) {
      if (!player) {
        return {
          potential: 0,
          rawPotential: 0,
          racePenalty: 0,
          rawRacePenalty: 0,
          launchRouteRelief: 0,
          launchRouteDistance: 99,
          launchRoutePlanScore: 0,
          routeDistance: 99,
          planetId: null,
          satelliteId: null,
        };
      }
      const playableLaunchRoute = getAiBestPlayableLaunchCardRoute(player);
      let best = {
        potential: 0,
        rawPotential: 0,
        racePenalty: 0,
        rawRacePenalty: 0,
        launchRouteRelief: 0,
        launchRouteDistance: 99,
        launchRoutePlanScore: 0,
        launchRouteCardId: null,
        routeDistance: 99,
        planetId: null,
        satelliteId: null,
        closestOpponentDistance: 99,
        fasterOpponentCount: 0,
        prospectiveOrange4Count: 0,
        prospectiveOrange4Pressure: 0,
        actorEta: null,
        opponentEtas: [],
        estimatedRaceOutcome: null,
        estimatedFastestOpponentEta: null,
      };
      for (const planet of solar.createSolarSnapshot(solarState).planetLocations || []) {
        if (!planet?.planetId || planet.planetId === "earth") continue;
        const routeDistance = getAiNearestRocketDistanceToPlanet(player, planet.planetId);
        for (const satellite of planetStats.getAvailableSatellitesForLanding?.(planetStatsState, planet.planetId) || []) {
          const effects = planetRewards.buildSatelliteLandRewardEffects?.(satellite.satelliteId) || [];
          const directScore = getAiRewardDirectScore(effects, player);
          const energyCost = getAiApproxLandEnergyCostForPlayer(player, planet.planetId);
          const energyShortfall = Math.max(0, energyCost - Math.max(0, aiNumber(player.resources?.energy)));
          const target = { type: "satellite", satelliteId: satellite.satelliteId };
          const cashoutPremium = scoreAiOuterSatelliteCashoutPremium(planet.planetId, target, player, {
            directScore,
            energyCost,
            energyShortfall,
            routeDistance,
          });
          const raceOptions = {
            directScore,
            energyCost,
            energyShortfall,
            routeDistance,
            includeProspectiveOrange4: true,
            afterCurrentOrange4Take: true,
          };
          const raceState = getAiSatelliteLandingRaceState(planet.planetId, target, player, raceOptions);
          const rawRacePenalty = scoreAiSatelliteLandingRaceWastePenalty(planet.planetId, target, player, {
            ...raceOptions,
            raceState,
          });
          const launchRouteRelief = routeDistance >= 99
            ? getAiOrange4LaunchRouteRaceRelief(rawRacePenalty, playableLaunchRoute, planet.planetId)
            : { relief: 0, estimatedRouteDistance: 99 };
          const racePenalty = Math.max(0, rawRacePenalty - Math.max(0, aiNumber(launchRouteRelief.relief)));
          const rawPotential = scoreAiRewardEffects(effects, player) + cashoutPremium;
          const potential = Math.max(0, rawPotential - racePenalty);
          if (
            potential > best.potential
            || (potential === best.potential && rawPotential > best.rawPotential)
          ) {
            best = {
              potential,
              rawPotential,
              racePenalty,
              rawRacePenalty,
              launchRouteRelief: launchRouteRelief.relief,
              launchRouteDistance: launchRouteRelief.estimatedRouteDistance,
              launchRoutePlanScore: playableLaunchRoute?.planScore || 0,
              launchRouteCardId: playableLaunchRoute?.cardId || null,
              routeDistance,
              planetId: planet.planetId,
              satelliteId: satellite.satelliteId,
              closestOpponentDistance: raceState.closestOpponentDistance,
              fasterOpponentCount: raceState.fasterOpponentCount,
              prospectiveOrange4Count: raceState.prospectiveOrange4Count,
              prospectiveOrange4Pressure: raceState.prospectiveOrange4Pressure,
              actorEta: raceState.actorEta,
              opponentEtas: raceState.opponentEtas,
              estimatedRaceOutcome: raceState.estimatedRaceOutcome,
              estimatedFastestOpponentEta: raceState.estimatedFastestOpponentEta,
            };
          }
        }
      }
      return {
        ...best,
        potential: roundAiScore(best.potential),
        rawPotential: roundAiScore(best.rawPotential),
        racePenalty: roundAiScore(best.racePenalty),
        rawRacePenalty: roundAiScore(best.rawRacePenalty),
        launchRouteRelief: roundAiScore(best.launchRouteRelief),
        launchRoutePlanScore: roundAiScore(best.launchRoutePlanScore),
        prospectiveOrange4Pressure: roundAiScore(best.prospectiveOrange4Pressure),
      };
    }

    function scoreAiResearchTechValue(candidate, player = getCurrentPlayer()) {
      const techType = candidate?.techType || "";
      const stackIndex = Math.max(1, Math.round(aiNumber(candidate?.stackIndex) || 1));
      const resources = player?.resources || {};
      const demand = getAiStrategyDemand(player);
      const liveScoreDeficit = getAiLiveScorePaceDeficit(player);
      let value = 6;
      if (techType === "orange") value += 2.5;
      if (techType === "purple") value += 2 + (resources.additionalPublicScan || 0) * 0.75;
      if (techType === "blue") value += 1.5 + scoreAiBlueTechDataEngineValue(player) * 0.5;
      if (candidate?.tileId === "orange1") value += (getMovableTokensForPlayer(player?.id).length ? 1 : 4);
      if (candidate?.tileId === "orange2") value += scoreAiOrange2MobilityNeed(player) * 0.75;
      value += scoreAiHuanyuOrange2FutureMoveValue(candidate, player);
      if (candidate?.tileId === "orange3") value += 4.8 + getAiMapDemand(demand.actions, "land") * 0.05;
      if (candidate?.tileId === "orange4") {
        const satelliteProfile = getAiOrange4SatellitePotentialProfile(player);
        const routeDistance = Math.max(0, Math.round(aiNumber(satelliteProfile.routeDistance)));
        const energyCapacity = Math.max(
          aiNumber(resources.energy),
          aiNumber(player?.income?.energy) + (players.playerOwnsTech(player, "orange3", createActionContext()) ? 1 : 0),
        );
        const satelliteAffordability = energyCapacity >= 3 ? 1 : energyCapacity >= 2 ? 0.65 : 0.35;
        value += 4.5 + Math.min(10, aiNumber(satelliteProfile.potential) * 0.22 * satelliteAffordability);
        value -= Math.min(6.5, aiNumber(satelliteProfile.racePenalty) * 0.55);
        const lowResourceMarsRaceWindow = aiNumber(resources.energy) <= 1 || aiNumber(resources.credits) <= 1;
        if (
          player?.aiDifficulty === AI_DIFFICULTY_WEAK_START
          && getAiRoundNumber() === 1
          && satelliteProfile.planetId === "mars"
          && satelliteProfile.satelliteId === "phobos-deimos"
          && routeDistance >= 3
          && lowResourceMarsRaceWindow
        ) {
          value -= routeDistance >= 99 ? 0.65 : 0.45;
        }
      }
      if (candidate?.tileId === "purple1") value += 1.5;
      value += scoreAiTechBonus(candidate?.bonusId, player);
      if (candidate?.firstTake) value += 2;
      if (candidate?.firstTake) {
        value += scoreAiRunezuSourceSymbolValue("tech", candidate.tileId, player);
      }
      value += Math.max(0, 5 - stackIndex) * 0.4;
      value += Math.max(0, getAiRemainingRoundWeight() - 1) * 0.4;
      value += getAiMapDemand(demand.techTypes, techType) * 0.85 * getAiStrategyWeight("tech");
      value += getAiMapDemand(demand.actions, "researchTech") * 0.18 * getAiStrategyWeight("tech");
      if (techType === "orange") {
        value += (
          getAiMapDemand(demand.actions, "launch")
          + getAiMapDemand(demand.actions, "move")
          + getAiMapDemand(demand.actions, "land")
        ) * 0.06 * getAiStrategyWeight("route");
      }
      if (techType === "purple") value += getAiMapDemand(demand.actions, "scan") * 0.08 * getAiStrategyWeight("scan");
      const routePlan = candidate?.plan || scoreAiResearchTechRoutePlan(candidate, player);
      if (routePlan?.score > 0) value += applyAiStrategyWeight(routePlan.score, "tech", 0.35);
      const lateTechCatchupValue = scoreAiLateTechEngineCatchupValue(candidate, player);
      if (lateTechCatchupValue) value += applyAiStrategyWeight(lateTechCatchupValue, "tech", 0.75);
      const lowTechCatchupValue = scoreAiLowTechBoardCatchupValue(candidate, player);
      if (lowTechCatchupValue) value += applyAiStrategyWeight(lowTechCatchupValue, "tech", 0.65);

      value += scoreAiHighScorePushValue(player, "researchTech", { techType });
      value += scoreAiLowEngineCatchupValue(player, "researchTech");
      const finalPlanningValue = scoreAiResearchTechFinalPlanningValue(candidate, player);
      if (finalPlanningValue) {
        value += applyAiStrategyWeight(
          finalPlanningValue,
          "final",
          getAiRoundNumber() >= FINAL_ROUND_NUMBER ? 1.05 : 0.82,
        );
      }
      const directScoreGain = getAiResearchTechDirectScoreGain(candidate, {}, player);
      value -= scoreAiFinalSecondMarkNoDirectSetupPenalty(player, {
        actionId: "researchTech",
        directScoreGain,
        setupScore: Math.max(0, aiNumber(routePlan?.score)),
        consumesHand: false,
        noCashoutRoute: true,
      });
      if (getAiRoundNumber() >= 2 && liveScoreDeficit > 20) {
        const directScoreBonus = candidate?.bonusId === "bonus_3f" ? 3 : 0;
        value -= Math.min(7, Math.max(0, liveScoreDeficit - directScoreBonus * 3) * 0.12);
      }
      return applyAiStrategyWeight(value, "engine", 0.35);
    }

    function aiResearchTechEventMatches(event, techType) {
      if (!event || event.type !== "researchTech") return false;
      if (event.techType && event.techType !== techType) return false;
      if (Array.isArray(event.techTypes) && !event.techTypes.includes(techType)) return false;
      return true;
    }

    function getAiResearchTechFinalFormulaDeltas(candidate, player = getCurrentPlayer()) {
      const techType = candidate?.techType || "";
      if (!techType || !AI_TECH_TYPES.includes(techType)) return {};
      const techCounts = getAiPlayerTechTypeCounts(player);
      const beforeD1 = Math.min(...AI_TECH_TYPES.map((type) => aiNumber(techCounts[type])));
      const afterCounts = {
        ...techCounts,
        [techType]: aiNumber(techCounts[techType]) + 1,
      };
      const afterD1 = Math.min(...AI_TECH_TYPES.map((type) => aiNumber(afterCounts[type])));
      const techCount = countAiPlayerTech(player);
      const beforeD2 = Math.floor(Math.max(0, techCount) / 2);
      const afterD2 = Math.floor((Math.max(0, techCount) + 1) / 2);
      const d1Immediate = Math.max(0, afterD1 - beforeD1);
      const d1Setup = d1Immediate > 0 || aiNumber(techCounts[techType]) !== beforeD1 ? 0 : 0.35;
      const d2Immediate = Math.max(0, afterD2 - beforeD2);
      return {
        d1: d1Immediate || d1Setup,
        d2: d2Immediate || 0.35,
      };
    }

    function getAiResearchTechTriggeredEffects(candidate, player = getCurrentPlayer()) {
      const techType = candidate?.techType || "";
      const reservedCards = Array.isArray(player?.reservedCards) ? player.reservedCards : [];
      return reservedCards.flatMap((card) => {
        const model = cardEffects.getCardModel?.(card);
        return (model?.triggers || [])
          .filter((trigger) => aiResearchTechEventMatches(trigger?.event, techType))
          .map((trigger) => trigger.effect)
          .filter(Boolean);
      });
    }

    function getAiLaunchEffectCost(effect) {
      return getAiLaunchPaymentCost(effect?.options || {});
    }

    function getAiRocketLimitAfterResearch(candidate, player = getCurrentPlayer()) {
      const context = createActionContext();
      const currentLimit = abilities.rocket.getRocketLimitForPlayer(player, context);
      const risks = getAiResearchTechLaunchRisks(candidate, player);
      if (risks.includesImmediateTechLaunch) return currentLimit;
      if (candidate?.tileId !== "orange1" || players.playerOwnsTech(player, "orange1", context)) {
        return currentLimit;
      }
      return Math.max(currentLimit, abilities.rocket.ORANGE1_ROCKET_LIMIT || currentLimit);
    }

    function getAiResearchTechLaunchRisks(candidate, player = getCurrentPlayer()) {
      const selectionOptions = getResearchTechSelectionOptions() || {};
      const effects = getAiResearchTechTriggeredEffects(candidate, player);
      if (!selectionOptions.skipBonus && candidate?.tileId === "orange1") {
        effects.push({ type: "launch", options: { skipCost: true } });
      }
      const launchEffects = effects.filter((effect) => (
        effect?.type === "launch"
        && !effect.options?.ignoreRocketLimit
      ));
      const launchCost = launchEffects.reduce((total, effect) => {
        const cost = getAiLaunchEffectCost(effect);
        for (const [key, value] of Object.entries(cost)) {
          total[key] = (total[key] || 0) + Math.max(0, Math.round(aiNumber(value)));
        }
        return total;
      }, {});
      return {
        launchCount: launchEffects.length,
        launchCost,
        includesImmediateTechLaunch: Boolean(!selectionOptions.skipBonus && candidate?.tileId === "orange1"),
      };
    }

    function getAiResearchTechSelectionOptionsForEffect(effect = null) {
      return {
        ...((effect && effect.options) || {}),
        ...(getResearchTechSelectionOptions?.() || {}),
      };
    }

    function getAiResearchTechCandidateSafety(candidate, player = getCurrentPlayer()) {
      const risks = getAiResearchTechLaunchRisks(candidate, player);
      if (!risks.launchCount) return { ok: true, message: null };
      const activeRocketCount = rocketActions.getRocketsForPlayer(rocketState, player?.id).length;
      const rocketLimit = getAiRocketLimitAfterResearch(candidate, player);
      if (activeRocketCount + risks.launchCount > rocketLimit) {
        return {
          ok: false,
          message: `研究 ${candidate.tileId} 会追加 ${risks.launchCount} 次发射，火箭上限不足（${activeRocketCount}/${rocketLimit}）`,
        };
      }
      if (!players.canAfford(player, risks.launchCost)) {
        return {
          ok: false,
          message: `研究 ${candidate.tileId} 后续发射资源不足，需要 ${players.formatResourceCost(risks.launchCost)}`,
        };
      }
      return { ok: true, message: null };
    }

    function scoreAiLaunchAction(player = getCurrentPlayer()) {
      const rocketCount = getMovableTokensForPlayer(player?.id).length;
      const rocketLimit = abilities.rocket.getRocketLimitForPlayer(player, createActionContext());
      const demand = getAiStrategyDemand(player);
      const routeDemand = getAiTotalRouteDemand(demand);
      const desiredRocketCount = Math.min(rocketLimit, getAiRoundNumber() <= 2 ? 2 : 3);
      const lowRocketBonus = Math.max(0, desiredRocketCount - rocketCount) * 4;
      const postSecondFinalMarkPenalty = countAiFinalMarksForPlayer(player) >= 2 && rocketCount >= 2 ? 5 : 0;
      return 8
        + (rocketCount === 0 ? 7 : 0)
        + lowRocketBonus
        + getAiMapDemand(demand.actions, "launch") * 0.28 * getAiStrategyWeight("route")
        + Math.min(3, routeDemand * 0.08 * getAiStrategyWeight("route"))
        - postSecondFinalMarkPenalty;
    }

    function scoreAiLaunchTurnCandidateValue(player = getCurrentPlayer(), postLaunchMovePlan = null) {
      const launchCost = scoreAiLaunchPaymentCost();
      const launchReservePenalty = scoreAiResourceReservePenaltyForCost(
        player,
        getAiLaunchPaymentCost(),
        { actionId: "launch" },
      );
      const lateLaunchPenalty = scoreAiLateLaunchDeadEndPenalty(player, postLaunchMovePlan);
      const extraLaunchPacePenalty = scoreAiExtraLaunchPacePenalty(player);
      const finalSecondMarkExtraLaunchPenalty = scoreAiFinalSecondMarkExtraLaunchPenalty(player, postLaunchMovePlan);
      const noRouteLaunchPenalty = scoreAiNoRouteLaunchPenalty(player, postLaunchMovePlan);
      const weakEarlyPostLaunchRoutePenalty = scoreAiWeakEarlyPostLaunchRoutePenalty(player, postLaunchMovePlan);
      const launchGain = scoreAiLaunchAction(player)
        + applyAiStrategyWeight(Math.max(0, aiNumber(postLaunchMovePlan?.score)), "move", 0.45)
        - lateLaunchPenalty
        - extraLaunchPacePenalty
        - finalSecondMarkExtraLaunchPenalty
        - noRouteLaunchPenalty
        - weakEarlyPostLaunchRoutePenalty;
      return {
        score: launchGain - launchCost - launchReservePenalty,
        launchGain,
        launchCost,
        launchReservePenalty,
        lateLaunchPenalty,
        extraLaunchPacePenalty,
        finalSecondMarkExtraLaunchPenalty,
        noRouteLaunchPenalty,
        weakEarlyPostLaunchRoutePenalty,
      };
    }

    function scoreAiLateLaunchDeadEndPenalty(player = getCurrentPlayer(), postLaunchMovePlan = null) {
      const round = getAiRoundNumber();
      if (round < 3) return 0;
      const planScore = Math.max(0, aiNumber(postLaunchMovePlan?.score));
      if (planScore >= 5) return 0;
      const rocketCount = getMovableTokensForPlayer(player?.id).length;
      if (rocketCount === 0) {
        let penalty = round >= FINAL_ROUND_NUMBER ? 4 : 2;
        if (round >= FINAL_ROUND_NUMBER) {
          const turnNumber = Math.max(1, Math.round(aiNumber(turnState.turnNumber) || 1));
          const finalMarks = countAiFinalMarksForPlayer(player);
          if (finalMarks >= 3) penalty += 16;
          else if (turnNumber >= 6) penalty += 12;
          else if (turnNumber >= 4) penalty += 7;
          if (getAiLiveScorePaceDeficit(player) <= 0) penalty += 3;
        }
        return penalty;
      }
      const demand = getAiStrategyDemand(player);
      const routeDemand = getAiTotalRouteDemand(demand);
      const planetDemand = sumAiDemandMap(demand.planetIds);
      const orbitLandDemand = getAiMapDemand(demand.actions, "orbit") + getAiMapDemand(demand.actions, "land");
      if (routeDemand + planetDemand + orbitLandDemand >= 30 && planScore > 0) {
        return 4;
      }
      const currentScore = Math.max(0, aiNumber(player?.resources?.score));
      const firstThresholdCatchup = round >= FINAL_ROUND_NUMBER && currentScore < 25;
      return round >= FINAL_ROUND_NUMBER
        ? (firstThresholdCatchup ? 18 : 14)
        : 8;
    }

    function scoreAiNoRouteLaunchPenalty(player = getCurrentPlayer(), postLaunchMovePlan = null) {
      const round = getAiRoundNumber();
      if (!player || round < 3) return 0;
      if (Math.max(0, aiNumber(postLaunchMovePlan?.score)) > 0) return 0;
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      const nextThreshold = getAiNextMissingFinalScoreThreshold(player);
      const finalMarks = countAiFinalMarksForPlayer(player);
      if (!nextThreshold || currentScore >= nextThreshold || finalMarks >= 3) return 0;

      const resources = player.resources || {};
      const launchCost = getAiLaunchPaymentCost();
      const creditCost = Math.max(0, aiNumber(launchCost.credits));
      const credits = Math.max(0, aiNumber(resources.credits));
      const energy = Math.max(0, aiNumber(resources.energy));
      const handSize = Math.max(0, aiNumber(resources.handSize ?? (player.hand || []).length));
      const isFinalRound = round >= FINAL_ROUND_NUMBER;
      if (
        !isFinalRound
        && (
          currentScore > 42
          || finalMarks > 1
          || creditCost <= 0
          || credits > creditCost
          || energy > 1
          || handSize > 3
        )
      ) {
        return 0;
      }
      let penalty = (isFinalRound ? 14 : 22)
        + Math.min(8, Math.max(0, nextThreshold - currentScore) * 0.16)
        + Math.max(0, 3 - finalMarks) * 2;
      if (creditCost > 0 && credits <= creditCost) penalty += isFinalRound ? 8 : 14;
      if (energy <= 1 && handSize <= 3) penalty += isFinalRound ? 4 : 6;
      return roundAiScore(Math.min(isFinalRound ? 34 : 44, penalty));
    }

    function scoreAiWeakEarlyPostLaunchRoutePenalty(player = getCurrentPlayer(), postLaunchMovePlan = null) {
      if (!player) return 0;
      const round = getAiRoundNumber();
      if (round > 2) return 0;
      const planScore = Math.max(0, aiNumber(postLaunchMovePlan?.score));
      if (planScore >= 1) return 0;
      const rocketCount = getMovableTokensForPlayer(player.id).length;
      const weakRouteGap = Math.max(0, 1 - planScore);
      const penalty = 14
        + weakRouteGap * 6
        + (rocketCount <= 0 ? 4 : 0)
        + (round === 1 ? 2 : 0);
      return roundAiScore(Math.min(26, penalty));
    }

    function scoreAiExtraLaunchPacePenalty(player = getCurrentPlayer()) {
      if (!player) return 0;
      const round = getAiRoundNumber();
      const resources = player.resources || {};
      if (round === 1) {
        const currentScore = Math.max(0, aiNumber(resources.score));
        const energy = aiNumber(resources.energy);
        const handSize = aiNumber(resources.handSize);
        if (currentScore < 25 && energy <= 0 && handSize <= 0) {
          return Math.min(8, 4.5 + Math.max(0, 25 - currentScore) * 0.12 + Math.max(0, 2 - energy) * 0.8);
        }
        return 0;
      }
      const rocketCount = (rocketActions.getRocketsForPlayer?.(rocketState, player.id) || [])
        .filter((rocket) => rocket?.playerId === player.id)
        .length;
      if (rocketCount <= 0) return 0;
      if (round > 3) return 0;
      const deficit = getAiLiveScorePaceDeficit(player);
      if (deficit <= 18) return 0;
      return Math.min(8, 2.5 + (deficit - 18) * (round === 3 ? 0.22 : 0.16));
    }

    function scoreAiFinalSecondMarkExtraLaunchPenalty(player = getCurrentPlayer(), postLaunchMovePlan = null) {
      if (!player || getAiRoundNumber() < FINAL_ROUND_NUMBER) return 0;
      if (Math.max(1, Math.round(aiNumber(turnState.turnNumber) || 1)) < 3) return 0;
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      if (
        currentScore >= 45
        || countAiFinalMarksForPlayer(player) > 1
        || getAiNextMissingFinalScoreThreshold(player) !== 50
      ) {
        return 0;
      }
      const rocketCount = (rocketActions.getRocketsForPlayer?.(rocketState, player.id) || [])
        .filter((rocket) => rocket?.playerId === player.id)
        .length;
      if (rocketCount <= 0) return 0;
      const planScore = Math.max(0, aiNumber(postLaunchMovePlan?.score));
      return Math.min(18, 8 + Math.max(0, 50 - currentScore) * 0.4 + Math.min(6, planScore * 0.12));
    }

    function scoreAiPostLaunchMovePlan(player = getCurrentPlayer()) {
      if (!player || state.pendingActionExecuted) return null;
      if (!players.canAfford(player, getAiLaunchPaymentCost())) return null;
      const from = getEarthSectorCoordinate();
      const candidates = AI_MOVE_DIRECTIONS
        .map((direction) => {
          const to = {
            x: solar.mod8(from.x + direction.deltaX),
            y: Math.min(
              rocketActions.SECTOR_RING_MAX,
              Math.max(rocketActions.SECTOR_RING_MIN, from.y + direction.deltaY),
            ),
          };
          if (to.x === from.x && to.y === from.y) return null;
          if (rocketActions.findAvailableSlotIndex(rocketState, to.x, to.y, null) == null) return null;
          const requiredMovePoints = getAiRequiredMovePointsFromCoordinate(player, from);
          if (!canPayForMove(player, requiredMovePoints).ok) return null;
          const routeScore = scoreAiMoveTowardTargets(from, to, player, { mainActionAlreadyUsed: true });
          const movementGain = applyAiStrategyWeight(applyAiStrategyWeight(routeScore.score, "route", 0.7), "move", 0.8)
            + direction.score * 0.08;
          const preserveEnergyForRouteCashout = shouldAiPreserveEnergyForRouteCashout(player, to, {
            routeTarget: routeScore.target,
            requiredMovePoints,
          });
          const movePayment = estimateAiMovePayment(player, requiredMovePoints, {
            preserveEnergy: preserveEnergyForRouteCashout,
          });
          const paymentCost = movePayment.cost;
          const nearestActionablePlanetPenalty = scoreAiNearestActionablePlanetTimingPenalty({
            player,
            from,
            to,
            direction,
            routeScore,
            followupScore: 0,
            energySpent: movePayment.energySpent,
            energyAfterMovePayment: movePayment.remainingEnergy,
          });
          const pathPenalty = scoreAiMovementPathPenalty({
            player,
            from,
            to,
            direction,
            requiredMovePoints,
            routeScore,
            followupScore: 0,
            energySpent: movePayment.energySpent,
            energyAfterMovePayment: movePayment.remainingEnergy,
            nearestActionablePlanetPenalty,
          });
          const movementCost = paymentCost + pathPenalty;
          const score = movementGain - movementCost;
          return {
            type: "main-then-quick",
            mainActionId: "launch",
            quickActionId: "move",
            direction: direction.id,
            directionLabel: direction.label,
            from,
            to,
            requiredMovePoints,
            routeTarget: routeScore.target,
            routeScore: routeScore.score,
            gain: movementGain,
            cost: movementCost,
            score,
            paymentCost,
            pathPenalty,
            nearestActionablePlanetPenalty,
            preserveEnergyForRouteCashout,
          };
        })
        .filter(Boolean)
        .sort((left, right) => right.score - left.score);
      return candidates[0] || null;
    }

    function createAiPlayerAfterQuickTrade(player = getCurrentPlayer(), trade = null) {
      if (!player || !trade) return null;
      const resources = { ...(player.resources || {}) };
      Object.entries(trade.cost || {}).forEach(([key, value]) => {
        resources[key] = aiNumber(resources[key]) - aiNumber(value);
      });
      Object.entries(trade.gain || {}).forEach(([key, value]) => {
        resources[key] = aiNumber(resources[key]) + aiNumber(value);
      });
      return {
        ...player,
        resources,
      };
    }

    function scoreAiEnergyTradeLaunchMoveRecovery(player = getCurrentPlayer(), tradeId = null) {
      if (
        !player
        || !tradeId
        || state.pendingActionExecuted
        || !canStartMainAction()
        || !canAiMoveThisTurn(player.id)
      ) {
        return null;
      }
      const trade = quickTrades?.getTradeAction?.(tradeId);
      if (!trade || aiNumber(trade.gain?.energy) <= 0) return null;
      const simulatedPlayer = createAiPlayerAfterQuickTrade(player, trade);
      if (!simulatedPlayer || !players.canAfford(simulatedPlayer, getAiLaunchPaymentCost())) return null;
      const plan = scoreAiPostLaunchMovePlan(simulatedPlayer);
      const score = Math.max(0, aiNumber(plan?.score));
      if (score < 5) return null;
      return {
        score,
        plan,
      };
    }

    function scoreAiEnergyTradePlanetCashoutRecovery(player = getCurrentPlayer(), tradeId = null) {
      if (
        !player
        || !tradeId
        || !quickTrades?.getTradeAction
        || state.pendingActionExecuted
        || !canStartMainAction()
      ) return null;
      const trade = quickTrades.getTradeAction(tradeId);
      if (!trade || aiNumber(trade.gain?.energy) <= 0) return null;
      const simulatedPlayer = createAiPlayerAfterQuickTrade(player, trade);
      if (!simulatedPlayer) return null;

      const resources = player.resources || {};
      const simulatedResources = simulatedPlayer.resources || {};
      const currentEnergy = Math.max(0, aiNumber(resources.energy));
      const energyAfterTrade = Math.max(0, aiNumber(simulatedResources.energy));
      if (energyAfterTrade <= currentEnergy) return null;

      const currentScore = Math.max(0, aiNumber(resources.score));
      const nextThreshold = getAiNextMissingFinalScoreThreshold(player);
      const finalMarks = countAiFinalMarksForPlayer(player);
      const round = getAiRoundNumber();
      const context = createActionContext();

      const scoreOpportunity = (opportunity) => {
        const targetEnergy = Math.max(0, aiNumber(opportunity.targetEnergy));
        const directScore = Math.max(0, aiNumber(opportunity.directScore));
        if (targetEnergy <= 0 || currentEnergy >= targetEnergy || directScore <= 0) return null;
        const afterTradeGap = Math.max(0, targetEnergy - energyAfterTrade);
        if (afterTradeGap > 1) return null;
        const reachesNextThreshold = Boolean(nextThreshold)
          && currentScore < nextThreshold
          && currentScore + directScore >= nextThreshold;
        const nearNextThreshold = Boolean(nextThreshold)
          && currentScore < nextThreshold
          && currentScore + directScore >= nextThreshold - 3;
        const finalRoundThresholdMiss = round >= FINAL_ROUND_NUMBER
          && Boolean(nextThreshold)
          && nextThreshold <= 50
          && currentScore < nextThreshold
          && !nearNextThreshold;
        if (finalRoundThresholdMiss) return null;
        if (round >= FINAL_ROUND_NUMBER && !reachesNextThreshold && afterTradeGap > 0) return null;
        const progress = Math.min(1, energyAfterTrade / Math.max(1, targetEnergy));
        const rewardValue = Math.max(0, aiNumber(opportunity.rewardValue));
        const paceDeficit = Math.max(0, getAiLiveScorePaceDeficit(player));
        const thresholdBonus = reachesNextThreshold
          ? (nextThreshold <= 50 ? 15 : 11)
          : nearNextThreshold
            ? 7
            : 0;
        const markBonus = Math.max(0, 3 - finalMarks) * (nextThreshold <= 50 ? 1.8 : 1.2);
        const routeScore = 13
          + progress * 7
          + directScore * (round >= 3 ? 0.9 : 0.55)
          + Math.min(8, rewardValue * 0.14)
          + Math.min(6, paceDeficit * (round >= 3 ? 0.08 : 0.04))
          + thresholdBonus
          + markBonus
          + (energyAfterTrade >= targetEnergy ? 6 : 0)
          - afterTradeGap * 2.5
          - scoreAiResourceBundle(trade.cost || {}) * 0.18;
        if (routeScore < 8) return null;
        return {
          ...opportunity,
          targetEnergy,
          directScore,
          energyAfterTrade,
          afterTradeGap,
          reachesNextThreshold,
          score: Math.min(46, routeScore),
        };
      };

      const best = getMovableTokensForPlayer(player.id)
        .reduce((bestOpportunity, rocket) => {
          const coordinate = rocketActions.getRocketSectorCoordinate(rocket);
          const planet = getAiPlanetAtCoordinate(coordinate);
          if (!planet?.planetId) return bestOpportunity;

          const opportunities = [];
          if (canAiPlanetAcceptLanding(planet.planetId, simulatedPlayer)) {
            const landCost = abilities.planet.getLandEnergyCost(context, planet.planetId);
            const landChoices = buildAiLandChoicesForPlanet(planet, simulatedPlayer);
            const landDirectScore = getAiBestLandDirectScoreGain(planet.planetId, landChoices, simulatedPlayer);
            opportunities.push({
              kind: "land",
              planetId: planet.planetId,
              planetName: planet.name || planet.planetId,
              targetEnergy: landCost,
              directScore: landDirectScore,
              rewardValue: scoreAiBestLandRewardValueForPlanet(planet.planetId, simulatedPlayer),
            });
          }

          if (canAiPlanetAcceptOrbit(planet.planetId)) {
            const orbitCost = abilities.planet.DEFAULT_ORBIT_COST || { credits: 1, energy: 1 };
            if (
              aiNumber(simulatedResources.credits) >= Math.max(0, aiNumber(orbitCost.credits))
              && energyAfterTrade >= Math.max(0, aiNumber(orbitCost.energy))
            ) {
              opportunities.push({
                kind: "orbit",
                planetId: planet.planetId,
                planetName: planet.name || planet.planetId,
                targetEnergy: Math.max(0, aiNumber(orbitCost.energy)),
                directScore: getAiOrbitDirectScoreGain(planet.planetId, simulatedPlayer),
                rewardValue: scoreAiOrbitRewardValue(planet.planetId, simulatedPlayer),
              });
            }
          }

          const localBest = opportunities
            .map(scoreOpportunity)
            .filter(Boolean)
            .sort((left, right) => aiNumber(right.score) - aiNumber(left.score))[0] || null;
          if (!localBest || aiNumber(localBest.score) <= aiNumber(bestOpportunity?.score)) {
            return bestOpportunity;
          }
          return localBest;
        }, null);

      if (!best) return null;
      const readyPlanetCashout = aiNumber(trade.cost?.credits) > 0
        ? getMovableTokensForPlayer(player.id)
          .map((rocket) => scoreAiFollowupMainActionAfterMove(
            rocketActions.getRocketSectorCoordinate(rocket),
            player,
          ))
          .filter((entry) => entry?.actionId && aiNumber(entry.score) > 0)
          .sort((left, right) => aiNumber(right.score) - aiNumber(left.score))[0] || null
        : null;
      const orbitCost = abilities.planet.DEFAULT_ORBIT_COST || { credits: 1, energy: 1 };
      const destroysReadyOrbitBeforeFullRecovery = readyPlanetCashout?.actionId === "orbit"
        && Math.max(0, aiNumber(best.afterTradeGap)) > 0
        && !players.canAfford(simulatedPlayer, orbitCost);
      if (destroysReadyOrbitBeforeFullRecovery) return null;
      return {
        score: roundAiScore(best.score),
        plan: best,
      };
    }

    function getAiReservedPlanetCashoutEnergy(player = getCurrentPlayer()) {
      if (!player) return null;
      const currentEnergy = Math.max(0, aiNumber(player.resources?.energy));
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      const nextThreshold = getAiNextMissingFinalScoreThreshold(player);
      const context = createActionContext();
      const opportunities = [];

      for (const rocket of getMovableTokensForPlayer(player.id)) {
        const coordinate = rocketActions.getRocketSectorCoordinate(rocket);
        const planet = getAiPlanetAtCoordinate(coordinate);
        if (!planet?.planetId) continue;

        if (canAiPlanetAcceptLanding(planet.planetId, player)) {
          const landCost = abilities.planet.getLandEnergyCost(context, planet.planetId);
          const landDirectScore = getAiBestLandDirectScoreGain(
            planet.planetId,
            buildAiLandChoicesForPlanet(planet, player),
            player,
          );
          if (currentEnergy >= landCost && landDirectScore > 0) {
            opportunities.push({
              kind: "land",
              planetId: planet.planetId,
              planetName: planet.name || planet.planetId,
              targetEnergy: landCost,
              directScore: landDirectScore,
            });
          }
        }

        if (canAiPlanetAcceptOrbit(planet.planetId)) {
          const orbitCost = abilities.planet.DEFAULT_ORBIT_COST || { credits: 1, energy: 1 };
          const targetEnergy = Math.max(0, aiNumber(orbitCost.energy));
          const directScore = getAiOrbitDirectScoreGain(planet.planetId, player);
          if (
            currentEnergy >= targetEnergy
            && aiNumber(player.resources?.credits) >= Math.max(0, aiNumber(orbitCost.credits))
            && directScore > 0
          ) {
            opportunities.push({
              kind: "orbit",
              planetId: planet.planetId,
              planetName: planet.name || planet.planetId,
              targetEnergy,
              directScore,
            });
          }
        }
      }

      return opportunities
        .map((opportunity) => {
          const reachesNextThreshold = Boolean(nextThreshold)
            && currentScore < nextThreshold
            && currentScore + Math.max(0, aiNumber(opportunity.directScore)) >= nextThreshold;
          return {
            ...opportunity,
            reachesNextThreshold,
            score: Math.max(0, aiNumber(opportunity.directScore))
              + (reachesNextThreshold ? 16 : 0)
              + Math.min(8, getAiLiveScorePaceDeficit(player) * 0.08),
          };
        })
        .filter((opportunity) => opportunity.score >= 8 || opportunity.reachesNextThreshold)
        .sort((left, right) => aiNumber(right.score) - aiNumber(left.score))[0] || null;
    }

    function scoreAiOrbitAction(candidate) {
      if (!candidate?.available) return 0;
      const demand = getAiStrategyDemand(getCurrentPlayer());
      const currentPlayer = getCurrentPlayer();
      const round = getAiRoundNumber();
      const rewardValue = scoreAiOrbitRewardValue(candidate.planetId, currentPlayer);
      const directScoreGain = getAiOrbitDirectScoreGain(candidate.planetId, currentPlayer);
      const currentScore = Math.max(0, aiNumber(currentPlayer?.resources?.score));
      const nextThreshold = getAiNextMissingFinalScoreThreshold(currentPlayer);
      const orbitSequence = Math.max(1, planetStats.getPlanetOrbitCount(planetStatsState, candidate.planetId) + 1);
      const earlyFirstOrbitBonus = orbitSequence === 1
        ? (round === 1 ? 13 : round === 2 ? 9 : round === 3 ? 3 : 0)
        : (round <= 2 ? 2 : 0);
      const rewardWeight = orbitSequence === 1
        ? (round <= 2 ? 1.15 : round === 3 ? 0.82 : 0.55)
        : (round <= 2 ? 0.72 : 0.45);
      const finalRoundLowScore = round >= FINAL_ROUND_NUMBER
        && Math.max(0, aiNumber(currentPlayer?.resources?.score)) < 25;
      const catchupRewardValue = finalRoundLowScore
        ? rewardValue * 0.6
        : 0;
      const directScorePaceValue = scoreAiPaceValueForDirectScore(directScoreGain, currentPlayer, {
        baseWeight: round >= 3 ? 0.55 : round === 2 ? 0.32 : 0.16,
        pressureWeight: round >= 3 ? 0.24 : 0.12,
      });
      const thirdFinalMarkCashoutValue = scoreAiThirdFinalMarkCashoutValue(directScoreGain, currentPlayer, {
        weight: 0.8,
      });
      const secondFinalMarkNudgeValue = scoreAiSecondFinalMarkNudgeValue(directScoreGain, currentPlayer, {
        weight: 0.45,
      });
      const noDirectPacePenalty = directScoreGain > 0
        ? 0
        : scoreAiNoDirectScorePacePenalty(currentPlayer, { cap: round >= 3 ? 10 : 6 });
      const reservePenalty = scoreAiResourceReservePenaltyForCost(
        currentPlayer,
        abilities.planet.DEFAULT_ORBIT_COST,
        { actionId: "orbit" },
      );
      const orbitThenLandThresholdValue = scoreAiOrbitThenLandThresholdComboValue(candidate.planetId, currentPlayer);
      const highScoreOrbitPushValue = scoreAiHighScorePushValue(currentPlayer, "orbit", { directScoreGain })
        * (directScoreGain > 0 ? 1 : 0.45);
      const finalNoDirectOrbitPenalty = round >= FINAL_ROUND_NUMBER
        && nextThreshold
        && nextThreshold <= 50
        && currentScore < nextThreshold
        && directScoreGain <= 0
        ? 18
        : 0;
      return 10
        + (candidate.planetId === "jupiter" ? 2 : 0)
        + rewardValue * rewardWeight
        + earlyFirstOrbitBonus
        + catchupRewardValue
        + directScorePaceValue
        + thirdFinalMarkCashoutValue
        + secondFinalMarkNudgeValue
        + orbitThenLandThresholdValue
        + highScoreOrbitPushValue
        + scoreAiPlanetMarkerEndGameValue(candidate.planetId, currentPlayer, { markerKind: "orbit" })
          * getAiStrategyWeight("final")
        + getAiMapDemand(demand.planetIds, candidate.planetId) * 0.8 * getAiStrategyWeight("route")
        + getAiMapDemand(demand.actions, "orbit") * 0.32 * getAiStrategyWeight("orbitLand")
        - scoreAiResourceBundle(abilities.planet.DEFAULT_ORBIT_COST) * 0.45
        - reservePenalty
        - finalNoDirectOrbitPenalty
        - noDirectPacePenalty;
    }

    function scoreAiOrbitThenLandThresholdComboValue(planetId, player = getCurrentPlayer()) {
      return 0;
    }

    function scoreAiLandBeforeOrbitOpportunityPenalty(planetId, landDirectScore, player = getCurrentPlayer()) {
      return 0;
    }

    function scoreAiLandAction(candidate) {
      if (!candidate?.available) return 0;
      const energyCost = Math.max(0, Math.round(aiNumber(candidate.energyCost)));
      const currentPlayer = getCurrentPlayer();
      const demand = getAiStrategyDemand(currentPlayer);
      const round = getAiRoundNumber();
      const currentScore = Math.max(0, aiNumber(currentPlayer?.resources?.score));
      const finalRoundLowScore = round >= FINAL_ROUND_NUMBER && currentScore < 25;
      const bestChoice = finalRoundLowScore ? chooseAiLandChoice(candidate.choices || [], currentPlayer) : null;
      const regularBestChoice = chooseAiLandChoice(candidate.choices || [], currentPlayer);
      if ((candidate.choices || []).length && !regularBestChoice) return -Infinity;
      const fallbackRewardValue = scoreAiLandResolvedRewardValueForTarget(
        candidate.planetId,
        { type: "planet" },
        currentPlayer,
      );
      const rewardValue = Number.isFinite(Number(regularBestChoice?.score))
        ? aiNumber(regularBestChoice.score)
        : aiNumber(fallbackRewardValue);
      const directScoreGain = Number.isFinite(Number(candidate.directScoreGain))
        ? aiNumber(candidate.directScoreGain)
        : getAiBestLandDirectScoreGain(candidate.planetId, candidate.choices || [], currentPlayer);
      const rewardWeight = round <= 2 ? 0.9 : round === 3 ? 0.78 : 0.65;
      const catchupRewardValue = finalRoundLowScore
        ? aiNumber(bestChoice?.score ?? scoreAiLandResolvedRewardValueForTarget(
          candidate.planetId,
          { type: "planet" },
          currentPlayer,
        )) * 0.65
        : 0;
      const fallbackReservePenalty = regularBestChoice
        ? 0
        : scoreAiResourceReservePenaltyForCost(currentPlayer, { energy: energyCost }, { actionId: "land" });
      const fallbackYellowTracePenalty = regularBestChoice
        ? 0
        : getAiYellowTraceLandCompetitionPenalty(candidate.planetId, { type: "planet" }, currentPlayer);
      const directScorePaceValue = aiNumber(scoreAiPaceValueForDirectScore(directScoreGain, currentPlayer, {
        baseWeight: round >= 3 ? 0.62 : round === 2 ? 0.38 : 0.18,
        pressureWeight: round >= 3 ? 0.26 : 0.13,
      }));
      const thirdFinalMarkCashoutValue = aiNumber(scoreAiThirdFinalMarkCashoutValue(directScoreGain, currentPlayer, {
        weight: 0.9,
      }));
      const secondFinalMarkNudgeValue = aiNumber(scoreAiSecondFinalMarkNudgeValue(directScoreGain, currentPlayer, {
        weight: 0.5,
      }));
      const orbitOpportunityPenalty = aiNumber(scoreAiLandBeforeOrbitOpportunityPenalty(
        candidate.planetId,
        directScoreGain,
        currentPlayer,
      ));
      const pointConversionPenalty = aiNumber(scoreAiHighCostPointConversionPenalty(currentPlayer, {
        actionId: "land",
        planetId: candidate.planetId,
        target: regularBestChoice?.choice?.target || { type: "planet" },
        directScore: directScoreGain,
        energyCost,
        highScoreTarget: regularBestChoice?.choice?.target?.type === "satellite" && directScoreGain >= 20,
      }));
      const highScoreLandPushValue = scoreAiHighScorePushValue(currentPlayer, "land", { directScoreGain })
        * (directScoreGain > 0 ? 1 : 0.55);
      const rawScore = 12
        + (candidate.planetId === "mars" || candidate.planetId === "venus" ? 1.5 : 0)
        + rewardValue * rewardWeight
        + catchupRewardValue
        + directScorePaceValue
        + thirdFinalMarkCashoutValue
        + secondFinalMarkNudgeValue
        + highScoreLandPushValue
        + aiNumber(scoreAiPlanetMarkerEndGameValue(candidate.planetId, currentPlayer, { markerKind: "land" }))
          * getAiStrategyWeight("final")
        + getAiMapDemand(demand.planetIds, candidate.planetId) * 0.85 * getAiStrategyWeight("route")
        + getAiMapDemand(demand.actions, "land") * 0.38 * getAiStrategyWeight("orbitLand")
        - energyCost * getAiResourceValuesForRound(currentPlayer).energy * 0.35
        - fallbackReservePenalty
        - fallbackYellowTracePenalty
        - orbitOpportunityPenalty
        - pointConversionPenalty;
      if (Number.isFinite(Number(rawScore))) return rawScore;
      return 12
        + Math.max(0, aiNumber(directScoreGain)) * (round >= 3 ? 1.1 : 0.8)
        + Math.max(0, rewardValue) * 0.35
        + aiNumber(scoreAiThresholdPressureForScoreGain(directScoreGain, currentPlayer)) * 0.35
        - energyCost * getAiResourceValuesForRound(currentPlayer).energy * 0.25;
    }

    function buildAiAnalyzeActionValueBreakdown(player = getCurrentPlayer()) {
      const check = canAiAnalyzeData(player);
      if (!check?.ok) {
        return {
          available: false,
          reason: check?.message || null,
          score: 0,
          energyCost: getAiAnalyzeEnergyCost(player),
        };
      }
      const placedCount = Math.max(0, (data.listComputerPlacedTokens?.(player) || []).length);
      const dataRoom = getAiAvailableDataRoom(player);
      const demand = getAiStrategyDemand(player);
      const blueTraceDemand = getAiMapDemand(demand.traceTypes, "blue");
      const round = getAiRoundNumber();
      const lateRoundPressure = Math.max(0, turnState.roundNumber - 1) * 1.5;
      const requiredSlot = data.ANALYZE_REQUIRED_COMPUTER_SLOT || 6;
      const fullComputerBonus = placedCount >= requiredSlot ? 8 : 0;
      const finalMarks = countAiFinalMarksForPlayer(player);
      const currentScore = Math.max(0, aiNumber(player?.resources?.score));
      const firstThresholdCatchupBonus = round >= FINAL_ROUND_NUMBER
        && currentScore < 25
        ? 8
        : 0;
      const nextThreshold = getAiNextMissingFinalScoreThreshold(player);
      const scoreToNextThreshold = nextThreshold ? Math.max(0, nextThreshold - currentScore) : 0;
      const bestBlueTraceScore = Math.max(0, aiNumber(getAiBestRevealedAlienTraceDirectScore(player, "blue")));
      const availableData = Math.max(0, aiNumber(player?.resources?.availableData));
      const energyCost = getAiAnalyzeEnergyCost(player);
      const thresholdCashoutPressure = nextThreshold && currentScore < nextThreshold
        ? Math.min(
          7,
          Math.max(0, 12 - scoreToNextThreshold) * 0.42
            + Math.min(4, bestBlueTraceScore * 0.5)
            + (currentScore + bestBlueTraceScore >= nextThreshold ? 3 : 0),
        )
        : 0;
      const readyAnalyzeWindowValue = placedCount >= requiredSlot
        ? Math.min(
          16,
          4.5
            + Math.min(4, availableData * 0.45)
            + Math.min(5, bestBlueTraceScore * 0.5)
            + thresholdCashoutPressure
            + Math.min(4, getAiLiveScorePaceDeficit(player) * 0.08)
            + (finalMarks < 3 ? 2.2 : 0),
        )
        : 0;
      const lateFullDataAnalyzeRecovery = round >= FINAL_ROUND_NUMBER
        && placedCount >= requiredSlot
        && availableData >= 4
        && currentScore < 170
        ? Math.min(
          12,
          4
            + Math.max(0, availableData - 3) * 1.2
            + Math.min(4, getAiLiveScorePaceDeficit(player) * 0.06)
            + (finalMarks >= 3 ? 1.5 : 0),
        )
        : 0;
      const postSecondFinalMarkPenalty = finalMarks >= 2 && dataRoom <= 1 && blueTraceDemand < 1
        ? 5
        : 0;
      const highScorePushValue = scoreAiHighScorePushValue(player, "analyze", {
        directScoreGain: bestBlueTraceScore,
      });
      const lowEngineCatchupValue = scoreAiLowEngineCatchupValue(player, "analyze");
      const lowResourceReadyAnalyzeCashout = player?.aiDifficulty === AI_DIFFICULTY_WEAK_START
        && round === 3
        && finalMarks >= 3
        && placedCount >= requiredSlot
        && currentScore >= 65
        && currentScore <= 95
        && aiNumber(player?.resources?.credits) <= 0
        && availableData >= 1
        && availableData <= 2
        && dataRoom >= 4
        && bestBlueTraceScore >= 6
        && lowEngineCatchupValue >= 5
        ? 1.4
        : 0;
      const rawScore = 7
        + placedCount * 1.15
        + fullComputerBonus * 0.8
        + Math.min(4, dataRoom * 0.55)
        + blueTraceDemand * 1.05 * getAiStrategyWeight("task")
        + getAiMapDemand(demand.actions, "analyze") * 0.2 * getAiStrategyWeight("engine")
        + lateRoundPressure
        + firstThresholdCatchupBonus
        + readyAnalyzeWindowValue
        + lateFullDataAnalyzeRecovery
        + highScorePushValue
        + lowEngineCatchupValue
        - energyCost * getAiResourceValuesForRound(player).energy * 0.35
        - postSecondFinalMarkPenalty;
      const weightedScore = applyAiStrategyWeight(
        rawScore,
        "task",
        0.5,
      );
      const hasBlueTraceFinalFormula = getAiMarkedFinalFormulaEntries(player)
        .some((entry) => entry.formulaId === "b1");
      let score = weightedScore;
      let scoreCapReason = null;
      if (
        round >= FINAL_ROUND_NUMBER
        && placedCount >= requiredSlot
        && finalMarks >= 3
        && !nextThreshold
        && currentScore < 150
        && bestBlueTraceScore <= 4
        && blueTraceDemand < 1
        && !hasBlueTraceFinalFormula
      ) {
        scoreCapReason = "终局分析蓝痕迹与阈值不足";
        score = Math.min(
          weightedScore,
          roundAiScore(
            7
              + bestBlueTraceScore * 2
              + Math.min(2.5, availableData * 0.45)
              + lateFullDataAnalyzeRecovery
              + (availableData >= 4 ? 4 : 0),
          ),
        );
      }
      return {
        available: true,
        reason: null,
        score,
        rawScore,
        weightedScore,
        scoreCapReason,
        placedCount,
        requiredSlot,
        dataRoom,
        availableData,
        energyCost,
        directScoreGain: bestBlueTraceScore,
        currentScore,
        finalMarkCount: finalMarks,
        nextFinalScoreThreshold: nextThreshold,
        scoreToNextThreshold,
        blueTraceDemand,
        analyzeBestBlueTraceScore: bestBlueTraceScore,
        thresholdCashoutPressure,
        readyAnalyzeWindowValue,
        lateFullDataAnalyzeRecovery,
        lowResourceReadyAnalyzeCashout,
        firstThresholdCatchupBonus,
        fullComputerBonus,
        lateRoundPressure,
        highScorePushValue,
        lowEngineCatchupValue,
        postSecondFinalMarkPenalty,
        hasBlueTraceFinalFormula,
      };
    }

    function scoreAiAnalyzeAction(player = getCurrentPlayer()) {
      return buildAiAnalyzeActionValueBreakdown(player).score;
    }

    function scoreAiFollowupMainActionAfterMove(coordinate, player = getCurrentPlayer(), options = {}) {
      if (!coordinate || (state.pendingActionExecuted && !options.ignoreMainActionUsed)) {
        return { score: 0, actionId: null, planetId: null, planetName: null };
      }
      const planet = getAiPlanetAtCoordinate(coordinate);
      if (!planet) return { score: 0, actionId: null, planetId: null, planetName: null };

      const actionOptions = [];
      if (
        canAiPlanetAcceptOrbit(planet.planetId)
        && players.canAfford(player, abilities.planet.DEFAULT_ORBIT_COST)
      ) {
        actionOptions.push({
          actionId: "orbit",
          planetId: planet.planetId,
          planetName: planet.name || planet.planetId,
          directScoreGain: getAiOrbitDirectScoreGain(planet.planetId, player),
          score: scoreAiOrbitAction({
            available: true,
            planetId: planet.planetId,
            planetName: planet.name || planet.planetId,
          }),
        });
      }

      if (canAiPlanetAcceptLanding(planet.planetId, player)) {
        const energyCost = abilities.planet.getLandEnergyCost(createActionContext(), planet.planetId);
        if (players.canAfford(player, energyCost > 0 ? { energy: energyCost } : {})) {
          const choices = buildAiLandChoicesForPlanet(planet, player);
          actionOptions.push({
            actionId: "land",
            planetId: planet.planetId,
            planetName: planet.name || planet.planetId,
            energyCost,
            choices,
            directScoreGain: getAiBestLandDirectScoreGain(planet.planetId, choices, player),
            score: scoreAiLandAction({
              available: true,
              planetId: planet.planetId,
              planetName: planet.name || planet.planetId,
              energyCost,
              choices,
            }),
          });
        }
      }

      const chongPickupPlayValue = scoreAiChongPickupRouteValue(planet.planetId, player, {
        immediate: true,
      });
      if (chongPickupPlayValue > 0) {
        actionOptions.push({
          actionId: "playCard",
          planetId: planet.planetId,
          planetName: planet.name || planet.planetId,
          directScoreGain: 0,
          score: chongPickupPlayValue + getAiMapDemand(getAiStrategyDemand(player).actions, "playCard") * 0.16,
        });
      }

      return actionOptions
        .filter((option) => Number.isFinite(Number(option.score)))
        .sort((left, right) => right.score - left.score)[0]
        || { score: 0, actionId: null, planetId: planet.planetId, planetName: planet.name || planet.planetId };
    }
    return Object.freeze({
      scoreAiBlueTechDataEngineValue,
      scoreAiTechBonus,
      getAiResearchTechAfterRewardDirectScore,
      getAiResearchTechDirectScoreGain,
      scoreAiResearchTechRoutePlan,
      scoreAiResearchTechFinalPlanningValue,
      scoreAiLateTechEngineCatchupValue,
      scoreAiLowTechBoardCatchupValue,
      getAiOrange4SatellitePotentialProfile,
      scoreAiResearchTechValue,
      aiResearchTechEventMatches,
      getAiResearchTechFinalFormulaDeltas,
      getAiResearchTechTriggeredEffects,
      getAiLaunchEffectCost,
      getAiRocketLimitAfterResearch,
      getAiResearchTechLaunchRisks,
      getAiResearchTechSelectionOptionsForEffect,
      getAiResearchTechCandidateSafety,
      scoreAiLaunchAction,
      scoreAiLaunchTurnCandidateValue,
      scoreAiLateLaunchDeadEndPenalty,
      scoreAiNoRouteLaunchPenalty,
      scoreAiWeakEarlyPostLaunchRoutePenalty,
      scoreAiExtraLaunchPacePenalty,
      scoreAiFinalSecondMarkExtraLaunchPenalty,
      scoreAiPostLaunchMovePlan,
      createAiPlayerAfterQuickTrade,
      scoreAiEnergyTradeLaunchMoveRecovery,
      scoreAiEnergyTradePlanetCashoutRecovery,
      getAiReservedPlanetCashoutEnergy,
      scoreAiOrbitAction,
      scoreAiOrbitThenLandThresholdComboValue,
      scoreAiLandBeforeOrbitOpportunityPenalty,
      scoreAiLandAction,
      buildAiAnalyzeActionValueBreakdown,
      scoreAiAnalyzeAction,
      scoreAiFollowupMainActionAfterMove,
    });
  }

  return Object.freeze({ createTechAction });
});
