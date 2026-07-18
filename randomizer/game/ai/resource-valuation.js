(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAIResourceValuation = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createResourceValuation(context = {}) {
    const {
      state,
      players,
      rocketActions,
      abilities,
      actions,
      scanEffects,
      tech,
      data,
      ai,
      FINAL_ROUND_NUMBER,
      AI_RESOURCE_VALUES,
    } = context;
    const buildAiLandChoicesForPlanet = (...args) => context.buildAiLandChoicesForPlanet(...args);
    const canAiAnalyzeData = (...args) => context.canAiAnalyzeData(...args);
    const canAiPlanetAcceptLanding = (...args) => context.canAiPlanetAcceptLanding(...args);
    const canAiPlanetAcceptOrbit = (...args) => context.canAiPlanetAcceptOrbit(...args);
    const configureAiStrategyWeights = (...args) => context.configureAiStrategyWeights(...args);
    const countAiFinalMarksForPlayer = (...args) => context.countAiFinalMarksForPlayer(...args);
    const countAiPlayerTech = (...args) => context.countAiPlayerTech(...args);
    const createActionContext = (...args) => context.createActionContext(...args);
    const getAiAvailableDataRoom = (...args) => context.getAiAvailableDataRoom(...args);
    const getAiBestRevealedAlienTraceDirectScore = (...args) => context.getAiBestRevealedAlienTraceDirectScore(...args);
    const getAiEarlyEnginePressure = (...args) => context.getAiEarlyEnginePressure(...args);
    const getAiLandDirectScoreGainForTarget = (...args) => context.getAiLandDirectScoreGainForTarget(...args);
    const getAiLiveScorePaceDeficit = (...args) => context.getAiLiveScorePaceDeficit(...args);
    const getAiMapDemand = (...args) => context.getAiMapDemand(...args);
    const getAiMarkedFinalFormulaEntries = (...args) => context.getAiMarkedFinalFormulaEntries(...args);
    const getAiOrbitDirectScoreGain = (...args) => context.getAiOrbitDirectScoreGain(...args);
    const getAiPlanetAtCoordinate = (...args) => context.getAiPlanetAtCoordinate(...args);
    const getAiPlanningFinalFormulaEntries = (...args) => context.getAiPlanningFinalFormulaEntries(...args);
    const getAiRoundNumber = (...args) => context.getAiRoundNumber(...args);
    const getAiStrategyDemand = (...args) => context.getAiStrategyDemand(...args);
    const getAiStrategyWeight = (...args) => context.getAiStrategyWeight(...args);
    const getAiTotalRouteDemand = (...args) => context.getAiTotalRouteDemand(...args);
    const getCurrentPlayer = (...args) => context.getCurrentPlayer(...args);
    const getMovableTokensForPlayer = (...args) => context.getMovableTokensForPlayer(...args);
    const hasAiAnalyzeReadyDataSlot = (...args) => context.hasAiAnalyzeReadyDataSlot(...args);
    const isAiSupportedHandPlayCard = (...args) => context.isAiSupportedHandPlayCard(...args);
    const listAiResearchTechCandidates = (...args) => context.listAiResearchTechCandidates(...args);
    const scoreAiAnalyzeAction = (...args) => context.scoreAiAnalyzeAction(...args);
    const scoreAiScanPriorityFloor = (...args) => context.scoreAiScanPriorityFloor(...args);
    const scoreAiThresholdPressureForScoreGain = (...args) => context.scoreAiThresholdPressureForScoreGain(...args);
    const sumAiDemandMap = (...args) => context.sumAiDemandMap(...args);
    const valuation = (...args) => context.valuation(...args);

    function aiNumber(value) {
      const number = Number(value);
      return Number.isFinite(number) ? number : 0;
    }

    function roundAiScore(value) {
      return Math.round(aiNumber(value) * 1000) / 1000;
    }

    function applyAiStrategyTuning(tuning = {}) {
      const weights = tuning?.weights || tuning;
      return configureAiStrategyWeights(weights, { merge: true });
    }

    function applyAiStrategyWeight(value, key, strength = 1) {
      const amount = aiNumber(value);
      const weight = getAiStrategyWeight(key);
      return amount * (1 + (weight - 1) * Math.max(0, aiNumber(strength)));
    }

    function getAiResourceValuesForRound() {
      if (ai?.valuation?.getPhaseResourceValues) {
        return ai.valuation.getPhaseResourceValues(getAiRoundNumber(), {
          resourceValues: AI_RESOURCE_VALUES,
          earlyResourceValues: { credits: 6, energy: 6.2, handSize: 5.4 },
        });
      }
      return getAiRoundNumber() <= 2
        ? {
          ...AI_RESOURCE_VALUES,
          credits: Math.max(AI_RESOURCE_VALUES.credits, 6),
          energy: Math.max(AI_RESOURCE_VALUES.energy, 6.2),
          handSize: Math.max(AI_RESOURCE_VALUES.handSize, 5.4),
        }
        : AI_RESOURCE_VALUES;
    }

    function scoreAiResourceBundle(resources = {}, options = {}) {
      const values = options.resourceValues || getAiResourceValuesForRound();
      return Object.entries(resources || {}).reduce((total, [key, value]) => (
        total + aiNumber(value) * aiNumber(values[key])
      ), 0);
    }

    let aiResourceContinuationDepth = 0;

    function createAiPlayerAfterResourceGain(player = getCurrentPlayer(), gain = {}) {
      if (!player || !gain || typeof gain !== "object") return null;
      const resources = { ...(player.resources || {}) };
      Object.entries(gain).forEach(([key, value]) => {
        resources[key] = aiNumber(resources[key]) + aiNumber(value);
      });
      return {
        ...player,
        resources,
      };
    }

    let aiPublicityResearchPreviewDepth = 0;
    let aiDeferredCardResearchPreviewDepth = 0;

    function withAiDeferredCardResearchPreview(callback) {
      aiDeferredCardResearchPreviewDepth += 1;
      try {
        return callback();
      } finally {
        aiDeferredCardResearchPreviewDepth = Math.max(0, aiDeferredCardResearchPreviewDepth - 1);
      }
    }

    function scoreAiPublicityResearchTechSetupValue(gain = {}, player = getCurrentPlayer(), options = {}) {
      if (!player || !gain || typeof gain !== "object") return 0;
      const publicityGain = Math.max(0, aiNumber(gain.publicity));
      if (publicityGain <= 0) return 0;

      const researchCost = tech.resolver?.getResearchPublicityCost?.(player)
        ?? tech.RESEARCH_PUBLICITY_COST
        ?? 6;
      const currentPublicity = Math.max(0, aiNumber(player.resources?.publicity));
      const publicityLimit = players.RESOURCE_LIMITS?.publicity ?? 10;
      const projectedPublicity = Math.min(publicityLimit, currentPublicity + publicityGain);
      if (currentPublicity >= researchCost || projectedPublicity <= currentPublicity) return 0;

      const round = getAiRoundNumber();
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      const techCount = countAiPlayerTech(player);
      const finalMarks = countAiFinalMarksForPlayer(player);
      const markedTechFinalEntries = getAiMarkedFinalFormulaEntries(player)
        .filter((entry) => entry.formulaId === "d1" || entry.formulaId === "d2");
      const techFinalEntries = getAiPlanningFinalFormulaEntries(player, ["d1", "d2"]);
      const hasMarkedTechFinal = markedTechFinalEntries.length > 0;
      const hasTechFinalPlan = techFinalEntries.length > 0;
      const lowTechTarget = round >= FINAL_ROUND_NUMBER ? 10 : round >= 3 ? 8 : 6;
      const lowTechShortfall = Math.max(0, lowTechTarget - techCount);
      const earlyTechEngineWindow = round <= 2 && techCount < 5;
      const lowTailTechWindow = round >= 3
        && lowTechShortfall > 0
        && currentScore < (round >= FINAL_ROUND_NUMBER ? 170 : 125);
      if (!hasMarkedTechFinal && !earlyTechEngineWindow && !lowTailTechWindow) return 0;

      const beforeShortfall = Math.max(0, researchCost - currentPublicity);
      const afterShortfall = Math.max(0, researchCost - projectedPublicity);
      const crossesResearchCost = beforeShortfall > 0 && afterShortfall <= 0;
      const closeToResearchCost = afterShortfall > 0 && afterShortfall <= 2;
      if (!crossesResearchCost && !closeToResearchCost && !(earlyTechEngineWindow && afterShortfall <= 4)) return 0;

      const bestTechMultiplier = techFinalEntries.reduce((best, entry) => (
        Math.max(best, aiNumber(entry.multiplier))
      ), 0);
      let value = crossesResearchCost
        ? 5.4 + bestTechMultiplier * 0.32
        : afterShortfall <= 1
          ? 3.8 + bestTechMultiplier * 0.22
          : 2.4 + bestTechMultiplier * 0.14;

      value += lowTechShortfall * (round >= FINAL_ROUND_NUMBER ? 0.72 : 0.45);
      if (round >= 3 && finalMarks >= 2 && hasMarkedTechFinal) value += 1.4;
      if (round >= FINAL_ROUND_NUMBER && currentScore < 160) value += Math.min(2.2, (160 - currentScore) * 0.035);
      if (earlyTechEngineWindow && !hasTechFinalPlan) value *= 0.62;

      // A publicity reward that crosses the real research threshold can save an
      // entire setup action.  Price that tempo from the currently takeable tech
      // supply instead of relying only on a historical resource constant.  The
      // caller must opt into this real-supply preview: ordinary resource gains
      // already price the publicity setup through their existing scalar paths.
      // The guard keeps tech-bonus valuation (which can itself grant publicity)
      // from recursively previewing the same supply.
      if (
        crossesResearchCost
        && options.previewTakeableTechSupply === true
        && aiPublicityResearchPreviewDepth <= 0
        && aiDeferredCardResearchPreviewDepth <= 0
        && String(getCurrentPlayer()?.id || "") === String(player?.id || "")
      ) {
        aiPublicityResearchPreviewDepth += 1;
        try {
          const bestTakeableTechScore = listAiResearchTechCandidates({})
            .reduce((best, candidate) => Math.max(best, aiNumber(candidate?.score)), 0);
          value = Math.max(value, bestTakeableTechScore * 0.28);
        } finally {
          aiPublicityResearchPreviewDepth = Math.max(0, aiPublicityResearchPreviewDepth - 1);
        }
      }

      const scale = options.scale == null ? 1 : Math.max(0, aiNumber(options.scale));
      return roundAiScore(Math.min(12, Math.max(0, value)) * scale);
    }

    function getAiMidgameResourceContinuationWeight() {
      const round = getAiRoundNumber();
      if (round <= 1) return 0.55;
      if (round === 2) return 1;
      if (round === 3) return 0.82;
      return 0;
    }

    function scoreAiPlanetCashoutUnlockAfterResourceGain(player = getCurrentPlayer(), gain = {}) {
      const simulatedPlayer = createAiPlayerAfterResourceGain(player, gain);
      if (!player || !simulatedPlayer) return 0;
      const weight = getAiMidgameResourceContinuationWeight();
      if (weight <= 0) return 0;
      const resources = player.resources || {};
      const simulatedResources = simulatedPlayer.resources || {};
      const demand = getAiStrategyDemand(player);
      const planetDemand = sumAiDemandMap(demand.planetIds);
      const routeDemand = getAiTotalRouteDemand(demand);

      const best = getMovableTokensForPlayer(player.id).reduce((bestValue, rocket) => {
        const coordinate = rocketActions.getRocketSectorCoordinate(rocket);
        const planet = getAiPlanetAtCoordinate(coordinate);
        if (!planet?.planetId || planet.planetId === "earth") return bestValue;

        let value = 0;
        if (canAiPlanetAcceptOrbit(planet.planetId)) {
          const orbitCost = abilities.planet.DEFAULT_ORBIT_COST || { credits: 1, energy: 1 };
          const couldOrbitBefore = players.canAfford(player, orbitCost);
          const canOrbitAfter = players.canAfford(simulatedPlayer, orbitCost);
          if (!couldOrbitBefore && canOrbitAfter) {
            const directScore = getAiOrbitDirectScoreGain(planet.planetId, simulatedPlayer);
            value = Math.max(
              value,
              3.5
                + directScore * 0.55
                + scoreAiThresholdPressureForScoreGain(directScore, simulatedPlayer) * 0.24
                + getAiMapDemand(demand.actions, "orbit") * 0.06
                + planetDemand * 0.03,
            );
          }
        }

        if (canAiPlanetAcceptLanding(planet.planetId, simulatedPlayer)) {
          const landCost = abilities.planet.getLandEnergyCost(createActionContext(), planet.planetId);
          const couldLandBefore = aiNumber(resources.energy) >= landCost;
          const canLandAfter = aiNumber(simulatedResources.energy) >= landCost;
          if (!couldLandBefore && canLandAfter) {
            const choices = buildAiLandChoicesForPlanet(planet, simulatedPlayer);
            const directScore = (choices || []).reduce((best, choice) => Math.max(
              best,
              getAiLandDirectScoreGainForTarget(planet.planetId, choice.target, simulatedPlayer),
            ), getAiLandDirectScoreGainForTarget(planet.planetId, { type: "planet" }, simulatedPlayer));
            value = Math.max(
              value,
              4.5
                + directScore * 0.62
                + scoreAiThresholdPressureForScoreGain(directScore, simulatedPlayer) * 0.28
                + getAiMapDemand(demand.actions, "land") * 0.07
                + routeDemand * 0.025,
            );
          }
        }

        return Math.max(bestValue, value);
      }, 0);
      return roundAiScore(Math.min(12, Math.max(0, best)));
    }

    function scoreAiMidgameResourceContinuationValue(gain = {}, player = getCurrentPlayer(), options = {}) {
      if (!gain || typeof gain !== "object" || !player) return 0;
      const weight = getAiMidgameResourceContinuationWeight();
      if (weight <= 0) return 0;

      const simulatedPlayer = createAiPlayerAfterResourceGain(player, gain);
      if (!simulatedPlayer) return 0;
      if (aiResourceContinuationDepth > 0) return 0;
      aiResourceContinuationDepth += 1;
      try {

        const resources = player.resources || {};
        const afterResources = simulatedPlayer.resources || {};
        const round = getAiRoundNumber();
        const demand = getAiStrategyDemand(player);
        const mainActionScale = state.pendingActionExecuted ? 0.55 : 1;
        const currentScore = Math.max(0, aiNumber(resources.score));
        let value = 0;

        const creditGain = Math.max(0, aiNumber(gain.credits));
        const energyGain = Math.max(0, aiNumber(gain.energy));
        const handGain = Math.max(0, aiNumber(gain.handSize) + aiNumber(gain.drawCards) + aiNumber(gain.cardSelection));
        const publicityGain = Math.max(0, aiNumber(gain.publicity));
        const dataGain = Math.max(0, aiNumber(gain.availableData));

        if (creditGain > 0 && aiNumber(resources.credits) < 1 && aiNumber(afterResources.credits) >= 1) {
          const playableHand = (player.hand || []).filter(isAiSupportedHandPlayCard).length;
          const deficit = Math.max(0, getAiLiveScorePaceDeficit(player));
          value += Math.min(
            7,
            (2.4 + Math.min(4, playableHand * 0.75) + Math.min(2, deficit * 0.04)) * mainActionScale,
          );
        }

        if (handGain > 0 && (player.hand || []).length <= 2) {
          value += Math.min(5.5, 1.7 + Math.max(0, 3 - (player.hand || []).length) * 1.1) * mainActionScale;
        }

        if (publicityGain > 0 && aiNumber(resources.publicity) < 3 && aiNumber(afterResources.publicity) >= 3) {
          value += Math.min(4.5, 2.4 + Math.max(0, 2 - (player.hand || []).length) * 0.65) * mainActionScale;
        }
        if (publicityGain > 0) {
          value += scoreAiPublicityResearchTechSetupValue(gain, player, { scale: mainActionScale });
        }

        if (energyGain > 0 || creditGain > 0) {
          const scanCost = scanEffects?.getStandardScanCost?.(player) || scanEffects?.SCAN_COST || { credits: 1, energy: 2 };
          const couldScanBefore = scanEffects?.canExecuteScan?.(player, { standardAction: true })?.ok;
          const canScanAfter = scanEffects?.canExecuteScan?.(simulatedPlayer, { standardAction: true })?.ok;
          if (!couldScanBefore && canScanAfter) {
            const scanUnlockValue = 3
              + scoreAiScanPriorityFloor(player) * 0.55
              + Math.min(2.2, getAiAvailableDataRoom(player) * 0.26)
              + Math.min(2.5, sumAiDemandMap(demand.traceTypes) * 0.04);
            value += Math.min(
              9,
              (scanUnlockValue
                + getAiMapDemand(demand.actions, "scan") * 0.04
                - Math.max(0, aiNumber(scanCost.credits) - aiNumber(afterResources.credits)) * 1.2) * mainActionScale,
            );
          }
        }

        if (energyGain > 0) {
          const couldAnalyzeBefore = canAiAnalyzeData(player).ok;
          const canAnalyzeAfter = canAiAnalyzeData(simulatedPlayer).ok;
          if (!couldAnalyzeBefore && canAnalyzeAfter) {
            const analyzeScore = Math.max(0, aiNumber(scoreAiAnalyzeAction(simulatedPlayer)));
            const blueTraceScore = getAiBestRevealedAlienTraceDirectScore(player, "blue");
            value += Math.min(
              11,
              (3.6
                + analyzeScore * 0.34
                + Math.max(0, blueTraceScore) * 0.28
                + getAiMapDemand(demand.actions, "analyze") * 0.06) * mainActionScale,
            );
          }
          value += scoreAiPlanetCashoutUnlockAfterResourceGain(player, gain) * 0.85;
        }

        if (dataGain > 0) {
          const requiredSlot = data.ANALYZE_REQUIRED_COMPUTER_SLOT || 6;
          const placedCount = Math.max(0, (data.listComputerPlacedTokens?.(player) || []).length);
          const beforeCanReachAnalyze = placedCount + Math.max(0, aiNumber(resources.availableData)) >= requiredSlot;
          const afterCanReachAnalyze = placedCount + Math.max(0, aiNumber(afterResources.availableData)) >= requiredSlot;
          const dataRoom = getAiAvailableDataRoom(player);
          if (!beforeCanReachAnalyze && afterCanReachAnalyze) {
            value += 4.6 + getAiMapDemand(demand.traceTypes, "blue") * 0.08;
          } else if (afterCanReachAnalyze && hasAiAnalyzeReadyDataSlot(player)) {
            value += 2.2;
          } else if (round <= 3 && dataRoom > 0) {
            value += Math.min(3.2, 0.8 + dataRoom * 0.22 + getAiEarlyEnginePressure(player) * 0.65);
          }
        }

        if (currentScore < 25 && round <= 2) {
          const flexibleGain = creditGain + energyGain + handGain + publicityGain * 0.5 + dataGain * 0.35;
          value += Math.min(3.5, flexibleGain * 0.55 + getAiEarlyEnginePressure(player) * 0.5);
        }

        const scale = options.scale == null ? 1 : aiNumber(options.scale);
        return roundAiScore(Math.min(14, Math.max(0, value)) * weight * scale);
      } finally {
        aiResourceContinuationDepth = Math.max(0, aiResourceContinuationDepth - 1);
      }
    }
    return Object.freeze({
      withAiDeferredCardResearchPreview,
      aiNumber,
      roundAiScore,
      applyAiStrategyTuning,
      applyAiStrategyWeight,
      getAiResourceValuesForRound,
      scoreAiResourceBundle,
      createAiPlayerAfterResourceGain,
      scoreAiPublicityResearchTechSetupValue,
      getAiMidgameResourceContinuationWeight,
      scoreAiPlanetCashoutUnlockAfterResourceGain,
      scoreAiMidgameResourceContinuationValue,
    });
  }

  return Object.freeze({ createResourceValuation });
});
