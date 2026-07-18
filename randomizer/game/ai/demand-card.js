(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAIDemandCard = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createDemandCard(context = {}) {
    const {
      planetRewards,
      finalScoring,
      endGameScoring,
      industry,
      abilities,
      actions,
      cardEffects,
      tech,
      data,
      aliens,
      aomomo,
      chong,
      amiba,
      nebulaDataState,
      alienGameState,
      finalScoringState,
      turnState,
      planetStatsState,
      FINAL_ROUND_NUMBER,
      createActionContext,
      AI_SCAN_COLORS,
      AI_TECH_TYPES,
      AI_TRACE_TYPES,
      AI_DIFFICULTY_WEAK_START,
      aiAutoBattleState,
    } = context;
    const addAiB1TraceDemand = (...args) => context.addAiB1TraceDemand(...args);
    const addPlan = (...args) => context.addPlan(...args);
    const aiNumber = (...args) => context.aiNumber(...args);
    const applyAiStrategyWeight = (...args) => context.applyAiStrategyWeight(...args);
    const countAiFinalMarksForPlayer = (...args) => context.countAiFinalMarksForPlayer(...args);
    const countAiPlayerTech = (...args) => context.countAiPlayerTech(...args);
    const getAiAvailableDataRoom = (...args) => context.getAiAvailableDataRoom(...args);
    const getAiNextMissingFinalScoreThreshold = (...args) => context.getAiNextMissingFinalScoreThreshold(...args);
    const getAiPlanningFinalFormulaEntries = (...args) => context.getAiPlanningFinalFormulaEntries(...args);
    const getAiPlayEffectsForCard = (...args) => context.getAiPlayEffectsForCard(...args);
    const getAiRemainingRoundWeight = (...args) => context.getAiRemainingRoundWeight(...args);
    const getAiRewardDirectScore = (...args) => context.getAiRewardDirectScore(...args);
    const getAiRoundNumber = (...args) => context.getAiRoundNumber(...args);
    const getAiStrategyWeight = (...args) => context.getAiStrategyWeight(...args);
    const getAiTotalRouteDemand = (...args) => context.getAiTotalRouteDemand(...args);
    const getCardPlayCost = (...args) => context.getCardPlayCost(...args);
    const getCardPrice = (...args) => context.getCardPrice(...args);
    const getCardTypeCode = (...args) => context.getCardTypeCode(...args);
    const getCurrentPlayer = (...args) => context.getCurrentPlayer(...args);
    const getMovePreview = (...args) => context.getMovePreview(...args);
    const isAiAlienMainPlayCard = (...args) => context.isAiAlienMainPlayCard(...args);
    const isAiChongTravelEffect = (...args) => context.isAiChongTravelEffect(...args);
    const listAiEffectMoveCandidates = (...args) => context.listAiEffectMoveCandidates(...args);
    const listAiResearchTechCandidates = (...args) => context.listAiResearchTechCandidates(...args);
    const normalizeAiDifficulty = (...args) => context.normalizeAiDifficulty(...args);
    const predicate = (...args) => context.predicate(...args);
    const roundAiScore = (...args) => context.roundAiScore(...args);
    const scoreAiBanrenmaCardThresholdSetupValue = (...args) => context.scoreAiBanrenmaCardThresholdSetupValue(...args);
    const scoreAiC2Type3ProgressValue = (...args) => context.scoreAiC2Type3ProgressValue(...args);
    const scoreAiCFinalTaskProgressValue = (...args) => context.scoreAiCFinalTaskProgressValue(...args);
    const scoreAiCardCornerOpportunity = (...args) => context.scoreAiCardCornerOpportunity(...args);
    const scoreAiChongCardTaskChainValue = (...args) => context.scoreAiChongCardTaskChainValue(...args);
    const scoreAiChongPickupTaskValue = (...args) => context.scoreAiChongPickupTaskValue(...args);
    const scoreAiChongTravelEffectImmediateValue = (...args) => context.scoreAiChongTravelEffectImmediateValue(...args);
    const scoreAiEffectValue = (...args) => context.scoreAiEffectValue(...args);
    const scoreAiFinalRoundEndGameCardUrgency = (...args) => context.scoreAiFinalRoundEndGameCardUrgency(...args);
    const scoreAiFinalRoundPlayCardResourceDrainPenalty = (...args) => context.scoreAiFinalRoundPlayCardResourceDrainPenalty(...args);
    const scoreAiFinalSecondMarkNoDirectSetupPenalty = (...args) => context.scoreAiFinalSecondMarkNoDirectSetupPenalty(...args);
    const scoreAiHighScorePushValue = (...args) => context.scoreAiHighScorePushValue(...args);
    const scoreAiLandAction = (...args) => context.scoreAiLandAction(...args);
    const scoreAiLaunchAction = (...args) => context.scoreAiLaunchAction(...args);
    const scoreAiLaunchPaymentCost = (...args) => context.scoreAiLaunchPaymentCost(...args);
    const scoreAiLowEngineCatchupValue = (...args) => context.scoreAiLowEngineCatchupValue(...args);
    const scoreAiMovePaymentCost = (...args) => context.scoreAiMovePaymentCost(...args);
    const scoreAiOrbitAction = (...args) => context.scoreAiOrbitAction(...args);
    const scoreAiPaceValueForDirectScore = (...args) => context.scoreAiPaceValueForDirectScore(...args);
    const scoreAiPostLaunchMovePlan = (...args) => context.scoreAiPostLaunchMovePlan(...args);
    const scoreAiResourceBundle = (...args) => context.scoreAiResourceBundle(...args);
    const scoreAiScanPriorityFloor = (...args) => context.scoreAiScanPriorityFloor(...args);
    const scoreAiSecondFinalMarkNudgeValue = (...args) => context.scoreAiSecondFinalMarkNudgeValue(...args);
    const scoreAiStrategyPassiveSlotChoice = (...args) => context.scoreAiStrategyPassiveSlotChoice(...args);
    const scoreAiThirdFinalMarkCashoutValue = (...args) => context.scoreAiThirdFinalMarkCashoutValue(...args);
    const scoreAiThresholdPressureForScoreGain = (...args) => context.scoreAiThresholdPressureForScoreGain(...args);
    const sumAiDemandMap = (...args) => context.sumAiDemandMap(...args);
    const summarizeAiTaskCondition = (...args) => context.summarizeAiTaskCondition(...args);

    let aiStrategyDemandCache = null;

    function resetAiStrategyDemandCache() {
      aiStrategyDemandCache = null;
    }

    function createAiStrategyDemand() {
      return {
        actions: {},
        scanColors: {},
        techTypes: {},
        planetIds: {},
        locationTypes: {},
        distanceFromEarth: {
          minDistance: 0,
          weight: 0,
        },
        traceTypes: {},
        alienTraceTargets: {},
        resources: {},
        task: 0,
        final: 0,
      };
    }

    function addAiMapDemand(map, key, amount) {
      if (!key) return;
      const value = aiNumber(amount);
      if (!value) return;
      map[key] = (map[key] || 0) + value;
    }

    function getAiMapDemand(map, key) {
      return Math.max(0, aiNumber(map?.[key]));
    }

    function addAiAlienTraceTargetDemand(demand, alienId, traceType, amount) {
      if (!demand || !alienId) return;
      if (!demand.alienTraceTargets[alienId]) demand.alienTraceTargets[alienId] = {};
      addAiMapDemand(demand.alienTraceTargets[alienId], traceType || "*", amount);
    }

    function getAiAlienTraceTargetDemand(demand, alienId, traceType) {
      if (!alienId) return 0;
      const speciesDemand = demand?.alienTraceTargets?.[alienId];
      return getAiMapDemand(speciesDemand, traceType) + getAiMapDemand(speciesDemand, "*");
    }

    function getAiAlienTraceTargetDemandForSlot(demand, alienSlotId, traceType) {
      if (!Number.isFinite(Number(alienSlotId))) return 0;
      const slot = aliens.getAlienSlot?.(alienGameState, Number(alienSlotId));
      if (!slot?.revealed) return 0;
      return getAiAlienTraceTargetDemand(
        demand,
        slot.alienId || slot.assignedAlienId || null,
        traceType,
      );
    }

    function addAiActionDemand(demand, actionId, amount) {
      addAiMapDemand(demand.actions, actionId, amount);
    }

    function addAiAllScanColorDemand(demand, amount) {
      for (const color of AI_SCAN_COLORS) addAiMapDemand(demand.scanColors, color, amount);
    }

    function addAiAllTechDemand(demand, amount) {
      for (const techType of AI_TECH_TYPES) addAiMapDemand(demand.techTypes, techType, amount);
    }

    function addAiAllTraceDemand(demand, amount) {
      for (const traceType of AI_TRACE_TYPES) addAiMapDemand(demand.traceTypes, traceType, amount);
    }

    function getAiMissingCount(current, required = 1) {
      return Math.max(0, Math.round(aiNumber(required)) - Math.max(0, Math.round(aiNumber(current))));
    }

    function aiMarkerBelongsToPlayer(marker, player) {
      if (!marker || !player) return false;
      const ids = new Set([player.id, player.playerId].filter(Boolean).map(String));
      const colors = new Set([player.color, player.playerColor].filter(Boolean).map(String));
      return [marker.playerId, marker.ownerPlayerId, marker.id].filter(Boolean)
        .some((value) => ids.has(String(value)))
        || [marker.color, marker.playerColor, marker.ownerPlayerColor].filter(Boolean)
          .some((value) => colors.has(String(value)));
    }

    function countAiLandingMarkers(player) {
      if (!player) return 0;
      return Object.values(planetStatsState?.planets || {}).reduce((total, record) => (
        total
        + (record?.landingMarkers || []).filter((marker) => aiMarkerBelongsToPlayer(marker, player)).length
        + (record?.satelliteLandings || []).filter((marker) => aiMarkerBelongsToPlayer(marker, player)).length
      ), 0);
    }

    function getAiTaskRewardValue(task, player = getCurrentPlayer()) {
      return (task?.rewards || []).reduce((total, reward) => (
        total + scoreAiEffectValue(reward, { player })
      ), 0);
    }

    function getAiTaskDirectScoreReward(task, player = getCurrentPlayer()) {
      return getAiRewardDirectScore(task?.rewards || [], player);
    }

    function listAiUncompletedCardTasksForPlayer(player = getCurrentPlayer()) {
      if (!player) return [];
      const entries = [];
      for (const card of player.reservedCards || []) {
        const model = cardEffects.getCardModel?.(card) || null;
        if (!model?.tasks?.length) continue;
        const completedTaskIds = new Set(card?.cardEffectState?.completedTaskIds || []);
        for (const task of model.tasks || []) {
          if (!task?.id || completedTaskIds.has(task.id)) continue;
          entries.push({ card, task, model });
        }
      }
      return entries;
    }

    function scoreAiTaskRouteCompletionValue(task, player = getCurrentPlayer()) {
      if (!task || !player) return 0;
      const rewardValue = Math.max(0, getAiTaskRewardValue(task, player));
      const directScore = Math.max(0, getAiTaskDirectScoreReward(task, player));
      const cFinalProgress = Math.max(0, scoreAiCFinalTaskProgressValue(player, 1));
      const completedTaskCount = Math.max(0, Math.round(aiNumber(player.completedTaskCount)));
      const round = getAiRoundNumber();
      const lowTaskPressure = completedTaskCount <= 0
        ? round <= 2 ? 3.5 : round === 3 ? 5.5 : 4.5
        : completedTaskCount === 1
          ? 2
          : 0.75;
      return roundAiScore(Math.min(
        24,
        rewardValue * 1.05
          + directScore * 0.45
          + scoreAiThresholdPressureForScoreGain(directScore, player) * 0.45
          + cFinalProgress * 1.15
          + lowTaskPressure,
      ));
    }

    function getAiPendingTaskRouteCashout(player, predicate) {
      if (!player || typeof predicate !== "function") return { value: 0, directScore: 0, count: 0 };
      return listAiUncompletedCardTasksForPlayer(player)
        .filter(({ task }) => predicate(task?.condition || {}, task))
        .reduce((result, { task }) => {
          const value = scoreAiTaskRouteCompletionValue(task, player);
          if (value <= 0) return result;
          return {
            value: result.value + value,
            directScore: result.directScore + Math.max(0, getAiTaskDirectScoreReward(task, player)),
            count: result.count + 1,
          };
        }, { value: 0, directScore: 0, count: 0 });
    }

    function getAiPendingPlanetTaskRouteCashout(planetId, player = getCurrentPlayer()) {
      if (!planetId || planetId === "earth") return { value: 0, directScore: 0, count: 0 };
      return getAiPendingTaskRouteCashout(player, (condition) => {
        if (condition.type === "planetOrbitOrLand") return condition.planetId === planetId;
        if (condition.type === "planetOrbitOrLandAll") {
          return (condition.planetIds || []).includes(planetId)
            && endGameScoring.countPlanetOrbitOrLand(player, planetStatsState, planetId) <= 0;
        }
        return false;
      });
    }

    function getAiPendingNearCompletePlanetTaskRouteCashout(planetId, player = getCurrentPlayer()) {
      if (!planetId || planetId === "earth") return { value: 0, directScore: 0, count: 0 };
      return getAiPendingTaskRouteCashout(player, (condition) => {
        if (condition.type !== "planetOrbitOrLand" && condition.type !== "planetOrbitOrLandAll") return false;
        if (condition.type === "planetOrbitOrLand" && condition.planetId !== planetId) return false;
        if (
          condition.type === "planetOrbitOrLandAll"
          && (!(condition.planetIds || []).includes(planetId)
            || endGameScoring.countPlanetOrbitOrLand(player, planetStatsState, planetId) > 0)
        ) {
          return false;
        }
        const summary = summarizeAiTaskCondition(condition, player);
        return summary?.met === false && Math.max(0, aiNumber(summary.missingCount)) <= 1;
      });
    }

    function getAiPendingLocationTaskRouteCashout(locationType, player = getCurrentPlayer()) {
      if (!locationType) return { value: 0, directScore: 0, count: 0 };
      return getAiPendingTaskRouteCashout(player, (condition) => {
        if (condition.type === "probeLocation") return condition.locationType === locationType;
        if (condition.type === "probeAdjacentEarth") return locationType === "earthAdjacent";
        if (condition.type === "probeAdjacentEarthAsteroid") return locationType === "earthAdjacentAsteroid";
        return false;
      });
    }

    function addAiPlanetDemand(demand, planetId, amount) {
      if (!planetId || planetId === "earth") return;
      addAiMapDemand(demand.planetIds, planetId, amount);
      addAiActionDemand(demand, "move", amount * 0.25);
      addAiActionDemand(demand, "launch", amount * 0.12);
    }

    function addAiProbeLocationDemand(demand, locationType, amount) {
      if (!locationType) return;
      addAiMapDemand(demand.locationTypes, locationType, amount);
      addAiActionDemand(demand, "move", amount * 0.8);
      addAiActionDemand(demand, "launch", amount * 0.25);
    }

    function addAiProbeDistanceDemand(demand, minDistance, amount) {
      const distance = Math.max(1, Math.round(aiNumber(minDistance) || 1));
      demand.distanceFromEarth.minDistance = Math.max(
        aiNumber(demand.distanceFromEarth.minDistance),
        distance,
      );
      demand.distanceFromEarth.weight += Math.max(0, aiNumber(amount));
      addAiActionDemand(demand, "move", amount * 0.85);
      addAiActionDemand(demand, "launch", amount * 0.2);
    }

    function addAiTaskConditionDemand(demand, task, weight, player, context) {
      const condition = task?.condition;
      if (!condition) return;
      const committedTask = Math.max(0, aiNumber(weight)) >= 0.8;
      const rewardValue = getAiTaskRewardValue(task, player);
      const directScoreReward = committedTask ? getAiTaskDirectScoreReward(task, player) : 0;
      const directScorePressure = scoreAiThresholdPressureForScoreGain(directScoreReward, player);
      const rewardWeight = Math.max(
        1,
        rewardValue * 0.18
          + directScoreReward * 0.28
          + directScorePressure * 0.12,
      );
      const amount = Math.max(0.5, aiNumber(weight)) * rewardWeight;
      switch (condition.type) {
        case "completedSectorsByColor": {
          const missing = getAiMissingCount(
            endGameScoring.countSectorWinsByColor(player, nebulaDataState, condition.color),
            condition.count || 1,
          );
          addAiMapDemand(demand.scanColors, condition.color, amount * Math.max(1, missing));
          addAiActionDemand(demand, "scan", amount * 0.9);
          break;
        }
        case "completedSectors": {
          const missing = getAiMissingCount(endGameScoring.countSectorWins(player, nebulaDataState), condition.count || 1);
          addAiAllScanColorDemand(demand, amount * Math.max(1, missing) * 0.5);
          addAiActionDemand(demand, "scan", amount);
          break;
        }
        case "completedSameSectorColor":
          addAiAllScanColorDemand(demand, amount * 0.65);
          addAiActionDemand(demand, "scan", amount);
          break;
        case "distinctSignalSectors":
        case "signalsInAllColors":
        case "signalsOrWinsInAllSectors":
          addAiAllScanColorDemand(demand, amount * 0.7);
          addAiActionDemand(demand, "scan", amount * 1.1);
          break;
        case "techCount": {
          const missing = getAiMissingCount(
            endGameScoring.countOwnedTech(player, condition.techType),
            condition.count || 1,
          );
          addAiMapDemand(demand.techTypes, condition.techType, amount * Math.max(1, missing));
          addAiActionDemand(demand, "researchTech", amount * 0.8);
          break;
        }
        case "planetOrbitOrLand":
          addAiPlanetDemand(
            demand,
            condition.planetId,
            amount * (1.2 + Math.min(1.1, directScoreReward * 0.1)),
          );
          addAiActionDemand(demand, "orbit", amount * 0.45);
          addAiActionDemand(demand, "land", amount * 0.45);
          break;
        case "planetOrbitOrLandAll":
          for (const planetId of condition.planetIds || []) {
            if (endGameScoring.countPlanetOrbitOrLand(player, planetStatsState, planetId) <= 0) {
              addAiPlanetDemand(demand, planetId, amount);
            }
          }
          addAiActionDemand(demand, "orbit", amount * 0.35);
          addAiActionDemand(demand, "land", amount * 0.35);
          break;
        case "samePlanetOrbitAndLand":
          addAiActionDemand(demand, "orbit", amount * 1.6);
          addAiActionDemand(demand, "land", amount * 1.6);
          addAiActionDemand(demand, "move", amount * 0.75);
          break;
        case "orbitCount": {
          const missing = getAiMissingCount(
            endGameScoring.countOrbitOrLandMarkers(player, planetStatsState),
            condition.count || 1,
          );
          addAiActionDemand(demand, "orbit", amount * Math.max(1, missing));
          addAiActionDemand(demand, "move", amount * 0.3);
          break;
        }
        case "landingCount": {
          const missing = getAiMissingCount(countAiLandingMarkers(player), condition.count || 1);
          const pressure = Math.max(1, missing);
          addAiActionDemand(demand, "land", amount * 1.35 * pressure);
          addAiActionDemand(demand, "move", amount * 0.55 * pressure);
          break;
        }
        case "orbitOrLandCount": {
          const missing = getAiMissingCount(
            endGameScoring.countOrbitOrLandMarkers(player, planetStatsState),
            condition.count || 1,
          );
          const pressure = Math.max(1, missing);
          addAiActionDemand(demand, "orbit", amount * 0.85 * pressure);
          addAiActionDemand(demand, "land", amount * 0.85 * pressure);
          addAiActionDemand(demand, "move", amount * 0.45 * pressure);
          break;
        }
        case "probeLocation":
          addAiProbeLocationDemand(demand, condition.locationType, amount * 1.2);
          break;
        case "probeDistanceFromEarth":
          addAiProbeDistanceDemand(demand, condition.minDistance, amount);
          break;
        case "probeAdjacentEarth":
          addAiProbeLocationDemand(demand, "earthAdjacent", amount);
          break;
        case "probeAdjacentEarthAsteroid":
          addAiProbeLocationDemand(demand, "earthAdjacentAsteroid", amount * 1.2);
          break;
        case "probesOnDifferentPlanets":
        case "otherProbeAtPlanet":
          addAiActionDemand(demand, "move", amount);
          addAiActionDemand(demand, "launch", amount * 0.45);
          break;
        case "traceCount":
        case "allAliensHaveTrace":
        case "allAliensHavePlayerTrace":
          addAiMapDemand(demand.traceTypes, condition.traceType, amount);
          break;
        case "singleAlienTraceSet":
          for (const traceType of condition.traceTypes || []) addAiMapDemand(demand.traceTypes, traceType, amount * 0.6);
          break;
        case "yichangdianAllTraceTypes":
        case "aomomoAllTraceTypes":
        case "aomomoFossilSpendingTrace":
          addAiAllTraceDemand(demand, amount * 0.75);
          break;
        case "resourceThreshold":
          addAiMapDemand(demand.resources, condition.resource, amount * 0.5);
          if (condition.resource === "score") demand.task += amount * 0.4;
          break;
        case "dataTotal":
          addAiMapDemand(demand.resources, "availableData", amount);
          addAiActionDemand(demand, "scan", amount * 0.45);
          break;
        case "handEmpty":
        case "resourcesAndHandEmpty":
        case "resourceEquals":
          demand.task += amount * 0.35;
          break;
        case "aomomoLanding":
          addAiPlanetDemand(demand, aomomo?.PLANET_ID, amount);
          addAiActionDemand(demand, "land", amount * 0.7);
          break;
        case "aomomoFossils":
          addAiMapDemand(demand.resources, "aomomoFossils", amount);
          break;
        default:
          demand.task += amount * 0.2;
          break;
      }
      demand.task += amount * 0.25;
      void context;
    }

    function addAiEventDemand(demand, event, effect, weight) {
      if (!event) return;
      const amount = Math.max(0.5, aiNumber(weight));
      const eventTypes = event.types || (event.type ? [event.type] : []);
      for (const eventType of eventTypes) {
        if (eventType === "scanAction") {
          addAiActionDemand(demand, "scan", amount);
        } else if (eventType === "signalMarked") {
          addAiMapDemand(demand.scanColors, event.color, amount * 0.9);
          addAiActionDemand(demand, "scan", amount * 0.6);
        } else if (eventType === "researchTech") {
          if (event.techType) addAiMapDemand(demand.techTypes, event.techType, amount);
          for (const techType of event.techTypes || []) addAiMapDemand(demand.techTypes, techType, amount);
          if (!event.techType && !event.techTypes) addAiAllTechDemand(demand, amount * 0.35);
          addAiActionDemand(demand, "researchTech", amount * 0.5);
        } else if (eventType === "visitPlanet") {
          for (const planetId of event.planetIds || []) addAiPlanetDemand(demand, planetId, amount);
          if (!event.planetIds?.length) addAiActionDemand(demand, "move", amount);
        } else if (eventType === "orbit") {
          addAiActionDemand(demand, "orbit", amount);
          for (const planetId of event.planetIds || []) addAiPlanetDemand(demand, planetId, amount);
        } else if (eventType === "land") {
          addAiActionDemand(demand, "land", amount);
          for (const planetId of event.planetIds || []) addAiPlanetDemand(demand, planetId, amount);
        } else if (eventType === "launch") {
          addAiActionDemand(demand, "launch", amount);
        } else if (eventType === "playCard") {
          addAiActionDemand(demand, "playCard", amount);
        } else if (eventType === "visitAsteroid" || eventType === "visitComet") {
          addAiActionDemand(demand, "move", amount);
        }
      }
      if (effect) addAiEffectDemand(demand, effect, amount * 0.5);
    }

    function addAiEffectDemand(demand, effect, weight) {
      if (!effect) return;
      const type = effect.type;
      const options = effect.options || {};
      const amount = Math.max(0.5, aiNumber(weight));
      if (type === "launch") {
        addAiActionDemand(demand, "launch", amount);
      } else if (type === "research_tech_select" || type === cardEffects.EFFECT_TYPES.RESEARCH_TECH) {
        const techTypes = options.techTypes || options.allowedTechTypes || [];
        if (techTypes.length) {
          for (const techType of techTypes) addAiMapDemand(demand.techTypes, techType, amount);
        } else {
          addAiAllTechDemand(demand, amount * 0.35);
        }
        addAiActionDemand(demand, "researchTech", amount * 0.4);
      } else if (type === cardEffects.EFFECT_TYPES.CARD_MOVE || type === cardEffects.EFFECT_TYPES.FREE_MOVE) {
        addAiActionDemand(demand, "move", amount);
      } else if (type === cardEffects.EFFECT_TYPES.CARD_ORBIT) {
        addAiActionDemand(demand, "orbit", amount);
      } else if (type === cardEffects.EFFECT_TYPES.CARD_LAND) {
        addAiActionDemand(demand, "land", amount);
      } else if (
        type === cardEffects.EFFECT_TYPES.PUBLIC_SCAN
        || type === cardEffects.EFFECT_TYPES.HAND_SCAN
        || type === cardEffects.EFFECT_TYPES.SECTOR_X_SCAN
        || type === cardEffects.EFFECT_TYPES.PLANET_SECTOR_SCAN
        || type === cardEffects.EFFECT_TYPES.CONDITIONAL_SECTOR_SCAN
        || type === cardEffects.EFFECT_TYPES.CHOOSE_NEBULA_SCAN
        || type === cardEffects.EFFECT_TYPES.SCAN_ACTION
        || type === cardEffects.EFFECT_TYPES.SCAN_NEBULA
        || type === cardEffects.EFFECT_TYPES.ANY_SECTOR_SCAN
        || type === cardEffects.EFFECT_TYPES.SCAN_COLOR_CHOICE
        || type === "card_color_scan"
      ) {
        addAiActionDemand(demand, "scan", amount);
        if (options.color) addAiMapDemand(demand.scanColors, options.color, amount);
        if (options.nebulaId) addAiMapDemand(demand.scanColors, data.getNebulaColor?.(options.nebulaId), amount * 0.75);
      } else if (type === planetRewards.EFFECT_TYPES?.GAIN_DATA || type === "gain_data") {
        addAiMapDemand(demand.resources, "availableData", amount * Math.max(1, aiNumber(options.count || 1)));
      } else if (type === "draw_cards") {
        addAiMapDemand(demand.resources, "handSize", amount);
      } else if (type === "alien_trace") {
        for (const traceType of options.traceTypes || options.types || []) addAiMapDemand(demand.traceTypes, traceType, amount);
      }
    }

    function addAiEndGameRuleDemand(demand, rule, weight, options = {}) {
      if (!rule) return;
      const amount = Math.max(options.minimum ?? 0.5, aiNumber(weight));
      demand.final += amount * 0.4;
      switch (rule.kind) {
        case "sectorWinsByColor":
          addAiMapDemand(demand.scanColors, rule.color, amount * Math.max(1, aiNumber(rule.scorePer) * 0.4));
          addAiActionDemand(demand, "scan", amount * 0.7);
          break;
        case "distinctSignalSectors":
          addAiAllScanColorDemand(demand, amount * 0.45);
          addAiActionDemand(demand, "scan", amount * 0.8);
          break;
        case "techCount":
          addAiMapDemand(demand.techTypes, rule.techType, amount * Math.max(1, aiNumber(rule.scorePer) * 0.35));
          addAiActionDemand(demand, "researchTech", amount * 0.55);
          break;
        case "planetOrbitOrLand":
          addAiPlanetDemand(demand, rule.planetId, amount * Math.max(1, aiNumber(rule.scorePer) * 0.25));
          addAiActionDemand(demand, "orbit", amount * 0.35);
          addAiActionDemand(demand, "land", amount * 0.35);
          break;
        case "allOrbitOrLand":
        case "planetLandingPairs":
          addAiActionDemand(demand, "orbit", amount * 0.45);
          addAiActionDemand(demand, "land", amount * 0.65);
          addAiActionDemand(demand, "move", amount * 0.35);
          break;
        case "traceCount":
          addAiMapDemand(demand.traceTypes, rule.traceType, amount * Math.max(1, aiNumber(rule.scorePer) * 0.35));
          break;
        case "amibaTraceCount":
          addAiAlienTraceTargetDemand(
            demand,
            amiba?.ALIEN_ID || "阿米巴",
            rule.traceType,
            amount * Math.max(1, aiNumber(rule.scorePer) * 0.35),
          );
          break;
        case "aomomoTraceCount":
          addAiAlienTraceTargetDemand(demand, aomomo?.ALIEN_ID || "奥陌陌", "*", amount * 0.4);
          break;
        case "chongTraceCount":
          addAiAlienTraceTargetDemand(demand, chong?.ALIEN_ID || "虫", "*", amount * 0.4);
          break;
        case "remainingResource":
          addAiMapDemand(demand.resources, rule.resource, amount * Math.max(1, aiNumber(rule.scorePer) * 0.3));
          if (rule.resource === "availableData") addAiActionDemand(demand, "scan", amount * 0.35);
          break;
        case "probeLocation":
          addAiProbeLocationDemand(demand, rule.locationType, amount * Math.max(1, aiNumber(rule.score) * 0.25));
          break;
        case "unmarkedFinalRightmost":
          demand.final += amount;
          break;
        default:
          demand.final += amount * 0.2;
          break;
      }
    }

    function resolveAiCardEndGameRule(card) {
      if (!card || !endGameScoring?.resolveCardEndGameRule) return null;
      return endGameScoring.resolveCardEndGameRule(card, cardEffects) || null;
    }

    function addAiFinalTileDemand(demand, player, context) {
      finalScoring.ensureFinalScoringState(finalScoringState);
      for (const tile of Object.values(finalScoringState.tiles || {})) {
        const mark = (tile.marks || []).find((entry) => entry.playerId === player?.id);
        if (!mark) continue;
        const variant = finalScoring.getTileVariant(finalScoringState, tile.id);
        const formulaId = endGameScoring.getFormulaId(tile.id, variant);
        const multiplier = Math.max(1, aiNumber(endGameScoring.getSlotMultiplier(formulaId, mark.slotIndex)));
        const amount = multiplier * 0.65;
        demand.final += amount;
        if (formulaId === "a1" || formulaId === "a2") {
          addAiMapDemand(demand.resources, "credits", amount * 0.4);
          addAiMapDemand(demand.resources, "energy", amount * 0.4);
          addAiMapDemand(demand.resources, "handSize", amount * 0.35);
        } else if (formulaId === "b1") {
          addAiB1TraceDemand(demand, amount, player);
        } else if (formulaId === "b2") {
          addAiActionDemand(demand, "orbit", amount * 0.7);
          addAiActionDemand(demand, "land", amount * 0.7);
          addAiActionDemand(demand, "scan", amount * 0.7);
          addAiAllScanColorDemand(demand, amount * 0.35);
        } else if (formulaId === "c1" || formulaId === "c2") {
          demand.task += amount * 1.7;
          addAiActionDemand(demand, "playCard", amount * 0.65);
        } else if (formulaId === "d1" || formulaId === "d2") {
          addAiAllTechDemand(demand, amount);
          addAiActionDemand(demand, "researchTech", amount * 0.6);
        }
      }
      void context;
    }

    function addAiCardModelDemand(demand, card, model, weight, player, context) {
      const endGameRule = resolveAiCardEndGameRule(card);
      if (!model && !endGameRule) return;
      const completedTaskIds = new Set(card?.cardEffectState?.completedTaskIds || []);
      for (const task of model?.tasks || []) {
        if (completedTaskIds.has(task.id)) continue;
        addAiTaskConditionDemand(demand, task, weight, player, context);
      }
      for (const trigger of model?.triggers || []) {
        const consumed = new Set(card?.cardEffectState?.consumedTriggerIds || []);
        if (consumed.has(trigger.id)) continue;
        addAiEventDemand(demand, trigger.event, trigger.effect, weight * 0.8);
      }
      for (const effect of model?.playEffects || []) {
        addAiEffectDemand(demand, effect, weight * 0.35);
      }
      if (endGameRule) {
        const modelOwnsEndGameRule = Boolean(model?.endGameScoring);
        addAiEndGameRuleDemand(
          demand,
          endGameRule,
          weight * (modelOwnsEndGameRule ? 1.2 : 0.45),
          { minimum: modelOwnsEndGameRule ? 0.5 : 0.08 },
        );
      }
    }

    function getAiStrategyDemandCacheKey(player = getCurrentPlayer()) {
      if (!player) return "none";
      const resources = player.resources || {};
      const finalMarkCount = Object.values(finalScoringState?.tiles || {})
        .reduce((total, tile) => total + (tile?.marks?.length || 0), 0);
      return [
        player.id || player.color || "unknown",
        turnState.roundNumber,
        turnState.turnNumber,
        aiAutoBattleState.logs.length,
        aiAutoBattleState.bugs.length,
        Math.round(aiNumber(resources.score)),
        Math.round(aiNumber(resources.credits)),
        Math.round(aiNumber(resources.energy)),
        Math.round(aiNumber(resources.publicity)),
        Math.round(aiNumber(resources.availableData)),
        (player.hand || []).length,
        (player.reservedCards || []).length,
        Math.round(aiNumber(player.completedTaskCount)),
        countAiPlayerTech(player),
        finalMarkCount,
      ].join("|");
    }

    function getAiStrategyDemand(player = getCurrentPlayer()) {
      const cacheKey = getAiStrategyDemandCacheKey(player);
      if (aiStrategyDemandCache?.key === cacheKey) return aiStrategyDemandCache.value;
      const demand = createAiStrategyDemand();
      if (!player) {
        aiStrategyDemandCache = { key: cacheKey, value: demand };
        return demand;
      }
      const context = {
        ...createActionContext(),
        finalScoringState,
        alienGameState,
        nebulaDataState,
        planetStatsState,
        cardEffects,
        getCardTypeCode,
      };
      addAiFinalTileDemand(demand, player, context);
      for (const card of player.reservedCards || []) {
        addAiCardModelDemand(demand, card, cardEffects.getCardModel?.(card), 1, player, context);
      }
      for (const card of player.hand || []) {
        const typeCode = getCardTypeCode(card);
        const handWeight = typeCode === 2 || typeCode === 3 ? 0.35 : 0.18;
        addAiCardModelDemand(demand, card, cardEffects.getCardModel?.(card), handWeight, player, context);
      }
      aiStrategyDemandCache = { key: cacheKey, value: demand };
      return demand;
    }

    function scoreAiCardDemandFit(card, model, playEffects, player = getCurrentPlayer()) {
      if (!card || !model) return 0;
      const demand = getAiStrategyDemand(player);
      let value = 0;
      for (const effect of playEffects || []) {
        const type = effect?.type;
        const options = effect?.options || {};
        if (type === "launch") value += getAiMapDemand(demand.actions, "launch") * 0.12 * getAiStrategyWeight("route");
        if (type === cardEffects.EFFECT_TYPES.CARD_MOVE || type === cardEffects.EFFECT_TYPES.FREE_MOVE) {
          value += getAiMapDemand(demand.actions, "move") * 0.12 * getAiStrategyWeight("move");
        }
        if (type === cardEffects.EFFECT_TYPES.CARD_ORBIT) value += getAiMapDemand(demand.actions, "orbit") * 0.16 * getAiStrategyWeight("orbitLand");
        if (type === cardEffects.EFFECT_TYPES.CARD_LAND) value += getAiMapDemand(demand.actions, "land") * 0.16 * getAiStrategyWeight("orbitLand");
        if (type === "research_tech_select" || type === cardEffects.EFFECT_TYPES.RESEARCH_TECH) {
          const techTypes = options.techTypes || options.allowedTechTypes || AI_TECH_TYPES;
          const bestTechDemand = techTypes.length
            ? Math.max(...techTypes.map((techType) => getAiMapDemand(demand.techTypes, techType)))
            : 0;
          value += bestTechDemand * 0.18 * getAiStrategyWeight("tech");
        }
        if (isAiCardScanEffectType(type)) {
          const scanWeight = getAiStrategyWeight("scan");
          value += getAiMapDemand(demand.actions, "scan") * 0.1 * scanWeight;
          if (options.color) value += getAiMapDemand(demand.scanColors, options.color) * 0.18 * scanWeight;
          if (options.nebulaId) value += getAiMapDemand(demand.scanColors, data.getNebulaColor?.(options.nebulaId)) * 0.14 * scanWeight;
        }
      }
      if (model.tasks?.length) value += Math.min(7, demand.task * 0.12 * getAiStrategyWeight("task"));
      if (model.endGameScoring) value += Math.min(5, demand.final * 0.12 * getAiStrategyWeight("final"));
      return applyAiStrategyWeight(value, "playCard", 0.8);
    }

    function isAiCardScanEffectType(type) {
      return type === cardEffects.EFFECT_TYPES.PUBLIC_SCAN
        || type === cardEffects.EFFECT_TYPES.HAND_SCAN
        || type === cardEffects.EFFECT_TYPES.OPTIONAL_DISCARD_SCAN
        || type === cardEffects.EFFECT_TYPES.SECTOR_X_SCAN
        || type === cardEffects.EFFECT_TYPES.PLANET_SECTOR_SCAN
        || type === cardEffects.EFFECT_TYPES.CONDITIONAL_SECTOR_SCAN
        || type === cardEffects.EFFECT_TYPES.CHOOSE_NEBULA_SCAN
        || type === cardEffects.EFFECT_TYPES.LANDING_SECTOR_SCAN
        || type === cardEffects.EFFECT_TYPES.DRAW_THEN_SCAN
        || type === cardEffects.EFFECT_TYPES.SCAN_ACTION
        || type === cardEffects.EFFECT_TYPES.SCAN_NEBULA
        || type === cardEffects.EFFECT_TYPES.ANY_SECTOR_SCAN
        || type === cardEffects.EFFECT_TYPES.SCAN_COLOR_CHOICE
        || type === "card_color_scan";
    }

    function scoreAiCardEndGameExpectedValue(card, model, player = getCurrentPlayer()) {
      const rule = resolveAiCardEndGameRule(card);
      if (!card || !rule || !player || !endGameScoring?.scoreCardEndGameRule) return 0;
      const simulatedPlayer = {
        ...player,
        reservedCards: [
          ...(Array.isArray(player.reservedCards) ? player.reservedCards : []),
          card,
        ],
      };
      const context = {
        ...createActionContext(),
        finalScoringState,
        alienGameState,
        cardEffects,
        getCardTypeCode,
      };
      return Math.max(0, aiNumber(endGameScoring.scoreCardEndGameRule(
        rule,
        simulatedPlayer,
        context,
      )));
    }

    function isAiResearchTechEffectType(type) {
      return type === "research_tech_select" || type === cardEffects.EFFECT_TYPES.RESEARCH_TECH;
    }

    function countAiHandEngineCards(player = getCurrentPlayer()) {
      return (player?.hand || []).reduce((total, card) => {
        const model = cardEffects.getCardModel?.(card) || null;
        const typeCode = getCardTypeCode(card);
        const playEffects = getAiPlayEffectsForCard(card);
        const hasEngineEffect = (playEffects || []).some((effect) => (
          isAiResearchTechEffectType(effect?.type)
          || isAiCardScanEffectType(effect?.type)
          || effect?.type === "draw_cards"
        ));
        const isEngineCard = Boolean(
          model?.tasks?.length
          || model?.endGameScoring
          || typeCode === 3
          || hasEngineEffect,
        );
        return total + (isEngineCard ? 1 : 0);
      }, 0);
    }

    function countAiHandTaskCards(player = getCurrentPlayer()) {
      return (player?.hand || []).reduce((total, card) => {
        const model = cardEffects.getCardModel?.(card) || null;
        return total + (model?.tasks?.length ? 1 : 0);
      }, 0);
    }

    function scoreAiLateCardEnginePressure(player = getCurrentPlayer()) {
      if (!player || getAiRoundNumber() < 3) return 0;
      const round = getAiRoundNumber();
      const completedTasks = Math.max(0, Math.round(aiNumber(player.completedTaskCount)));
      const finalMarks = countAiFinalMarksForPlayer(player);
      const techCount = countAiPlayerTech(player);
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      const cEntries = getAiPlanningFinalFormulaEntries(player, ["c1", "c2"]);
      const dEntries = getAiPlanningFinalFormulaEntries(player, ["d1", "d2"]);
      const uncompletedTaskCount = listAiUncompletedCardTasksForPlayer(player).length;
      const handEngineCards = countAiHandEngineCards(player);
      const handTaskCards = countAiHandTaskCards(player);
      const hasTaskPipeline = cEntries.length > 0 || uncompletedTaskCount > 0 || handTaskCards > 0;
      let pressure = 0;

      if (hasTaskPipeline) {
        if (completedTasks <= 0) pressure += round === 3 ? 4.5 : 7;
        else if (completedTasks === 1) pressure += round === 3 ? 2.5 : 4.5;
        else pressure += 1;
      }

      if (cEntries.length && completedTasks <= 1) pressure += finalMarks >= 2 ? 3 : 1.8;
      if (dEntries.length && techCount < 8) {
        pressure += Math.min(5.5, Math.max(0, 8 - techCount) * 1.05 + (round >= FINAL_ROUND_NUMBER ? 1.2 : 0));
      }
      if (finalMarks >= 3 && ((hasTaskPipeline && completedTasks <= 1) || techCount < 8)) pressure += 2.2;
      else if (finalMarks >= 2 && hasTaskPipeline && completedTasks <= 1) pressure += 1.2;
      if (round >= FINAL_ROUND_NUMBER && currentScore < 120 && hasTaskPipeline && completedTasks <= 1) pressure += 2.2;

      if (handEngineCards <= 0 && uncompletedTaskCount <= 0 && (!dEntries.length || techCount >= 8)) {
        pressure *= 0.45;
      }
      return roundAiScore(Math.min(18, Math.max(0, pressure)));
    }

    function scoreAiLatePlayCardEnginePressure(card, details = {}) {
      const player = details.player || getCurrentPlayer();
      if (!card || !player) return 0;
      const basePressure = scoreAiLateCardEnginePressure(player);
      if (basePressure <= 0) return 0;
      const model = details.model || cardEffects.getCardModel?.(card) || null;
      const playEffects = details.playEffects || getAiPlayEffectsForCard(card);
      const typeCode = details.typeCode ?? getCardTypeCode(card);
      const endGameExpectedScore = details.endGameExpectedScore
        ?? scoreAiCardEndGameExpectedValue(card, model, player);
      const c2Type3ProgressValue = typeCode === 3 ? scoreAiC2Type3ProgressValue(player) : 0;
      const completedTasks = Math.max(0, Math.round(aiNumber(player.completedTaskCount)));
      const hasC2 = getAiPlanningFinalFormulaEntries(player, ["c2"]).length > 0;
      const weakLowYieldFinalCard = Boolean(
        typeCode === 3
        && model?.endGameScoring
        && !hasC2
        && endGameExpectedScore < 3,
      );
      const hasResearchEffect = (playEffects || []).some((effect) => isAiResearchTechEffectType(effect?.type));
      const hasScanEffect = (playEffects || []).some((effect) => isAiCardScanEffectType(effect?.type));
      const hasDrawEffect = (playEffects || []).some((effect) => effect?.type === "draw_cards");
      const suppressTaskSetup = Boolean(details.suppressTaskSetup);
      let fit = 0;

      if (model?.tasks?.length && !suppressTaskSetup) {
        fit += 0.62 + model.tasks.length * 0.18 + (completedTasks <= 0 ? 0.18 : 0);
      }
      if (typeCode === 3 && (hasC2 || model?.endGameScoring || endGameExpectedScore > 0)) {
        fit += weakLowYieldFinalCard
          ? 0.08 + Math.min(0.08, endGameExpectedScore * 0.03)
          : 0.42 + Math.min(0.28, c2Type3ProgressValue * 0.08);
      }
      if (model?.endGameScoring) {
        fit += weakLowYieldFinalCard
          ? Math.min(0.12, endGameExpectedScore * 0.04)
          : 0.42 + Math.min(0.3, endGameExpectedScore * 0.035);
      }
      if (hasResearchEffect) {
        fit += getAiPlanningFinalFormulaEntries(player, ["d1", "d2"]).length ? 0.34 : 0.16;
      }
      if (hasScanEffect) fit += getAiPlanningFinalFormulaEntries(player, ["b2"]).length ? 0.26 : 0.14;
      if (hasDrawEffect) fit += 0.12;
      if ((!suppressTaskSetup && details.plan?.actionId === "task") || details.plan?.actionId === "final") fit += 0.12;
      if (fit <= 0) return 0;
      return roundAiScore(Math.min(22, basePressure * fit));
    }

    function scoreAiPlayCardConversionPressure(card, details = {}) {
      const player = details.player || getCurrentPlayer();
      if (!card || !player || getAiRoundNumber() < 3) return 0;
      const model = details.model || cardEffects.getCardModel?.(card) || null;
      const playEffects = details.playEffects || getAiPlayEffectsForCard(card);
      const typeCode = details.typeCode ?? getCardTypeCode(card);
      const handSize = Math.max(0, (player.hand || []).length);
      const finalMarks = countAiFinalMarksForPlayer(player);
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      const nextThreshold = getAiNextMissingFinalScoreThreshold(player);
      const endGameExpectedScore = details.endGameExpectedScore
        ?? scoreAiCardEndGameExpectedValue(card, model, player);
      const c2Type3ProgressValue = typeCode === 3 ? scoreAiC2Type3ProgressValue(player) : 0;
      const cFinalTaskProgressValue = details.cFinalTaskProgressValue ?? (
        model?.tasks?.length ? scoreAiCFinalTaskProgressValue(player, model.tasks.length) : 0
      );
      const standardActionPremium = details.standardActionPremium
        ?? scoreAiCardStandardActionPremium(playEffects, player);
      const hasC2Plan = getAiPlanningFinalFormulaEntries(player, ["c2"]).length > 0;
      const weakLowYieldFinalCard = Boolean(
        typeCode === 3
        && model?.endGameScoring
        && !hasC2Plan
        && endGameExpectedScore < 3,
      );
      const routePlanScore = Math.max(0, aiNumber(details.plan?.score));
      const concreteRoutePlanScore = details.plan?.actionId === "task" ? 0 : routePlanScore;
      const handPressure = Math.max(0, handSize - 3) * (getAiRoundNumber() >= FINAL_ROUND_NUMBER ? 2.8 : 1.4);
      const lateCardEnginePressure = details.lateCardEnginePressure
        ?? scoreAiLatePlayCardEnginePressure(card, {
          player,
          model,
          playEffects,
          typeCode,
          endGameExpectedScore,
          plan: details.plan,
          suppressTaskSetup: details.suppressTaskSetup,
        });

      let value = handPressure;
      const looseFinalTaskOnly = getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && finalMarks >= 3
        && !nextThreshold
        && model?.tasks?.length
        && cFinalTaskProgressValue <= 0
        && concreteRoutePlanScore <= 0
        && !model?.endGameScoring
        && typeCode !== 3;
      if (model?.tasks?.length && !looseFinalTaskOnly && !details.suppressTaskSetup) {
        value += 5 + Math.min(10, cFinalTaskProgressValue * 0.8);
      }
      if (typeCode === 3) {
        value += weakLowYieldFinalCard
          ? Math.min(2, endGameExpectedScore * 0.25 + c2Type3ProgressValue * 0.2)
          : 4 + Math.min(10, c2Type3ProgressValue * 0.65);
      }
      if (model?.endGameScoring) {
        value += weakLowYieldFinalCard
          ? Math.min(2.5, endGameExpectedScore * 0.5)
          : 4 + Math.min(12, endGameExpectedScore * 0.75);
      }
      if (standardActionPremium > 0) value += Math.min(10, standardActionPremium * 0.55);
      if (concreteRoutePlanScore > 0) value += Math.min(8, concreteRoutePlanScore * 0.35);
      if (isAiAlienMainPlayCard(card)) value += 5;
      if (getAiRoundNumber() >= FINAL_ROUND_NUMBER && nextThreshold && currentScore < nextThreshold) {
        value += Math.max(0, 3 - finalMarks) * 3.2
          + Math.min(9, Math.max(0, nextThreshold - currentScore) * 0.18);
      }
      if (!looseFinalTaskOnly) {
        value += weakLowYieldFinalCard
          ? Math.min(3, lateCardEnginePressure)
          : lateCardEnginePressure;
      }
      if (
        weakLowYieldFinalCard
        && getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && finalMarks >= 3
        && !nextThreshold
      ) {
        value = Math.min(value, 6);
      }
      return roundAiScore(Math.min(getAiRoundNumber() >= FINAL_ROUND_NUMBER ? 38 : 24, Math.max(0, value)));
    }

    function scoreAiCardLaunchRouteValue(effect, player = getCurrentPlayer()) {
      if (!effect || effect.type !== "launch" || !player) {
        return {
          savedCost: 0,
          postLaunchMoveScore: 0,
          postLaunchMovePlan: null,
        };
      }
      const standardCost = scoreAiLaunchPaymentCost();
      const actualCost = scoreAiLaunchPaymentCost(effect.options || {});
      const savedCost = Math.max(0, standardCost - actualCost);
      const postLaunchMovePlan = scoreAiPostLaunchMovePlan(player);
      return {
        savedCost,
        postLaunchMoveScore: Math.max(0, aiNumber(postLaunchMovePlan?.score)),
        postLaunchMovePlan,
      };
    }

    function scoreAiPlayCardRoutePlan(card, model, playEffects, player = getCurrentPlayer()) {
      if (!card || !model || !player) return null;
      const demand = getAiStrategyDemand(player);
      const plans = [];
      const cardId = card.cardId || card.id || null;
      const addPlan = (actionId, label, score, details = {}) => {
        const value = aiNumber(score);
        if (value <= 0) return;
        plans.push({
          type: "card-synergy",
          mainActionId: "playCard",
          actionId,
          label,
          score: value,
          cardId,
          ...details,
        });
      };
      const getMovePreview = (effect, effectIndex) => {
        if (!effect) return null;
        const candidates = listAiEffectMoveCandidates({
          id: "playCardMovePreview",
          free: effect.type === cardEffects.EFFECT_TYPES.FREE_MOVE,
          player,
          effect,
          poolRemaining: effect?.options?.movementPoints ?? 1,
          nextEffect: playEffects[effectIndex + 1] || null,
        });
        return candidates
          .filter((candidate) => Number.isFinite(Number(candidate?.score)))
          .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null;
      };

      const routeDemand = getAiTotalRouteDemand(demand);
      const planetDemand = sumAiDemandMap(demand.planetIds);
      const moveDemand = getAiMapDemand(demand.actions, "move");
      const scanDemand = getAiMapDemand(demand.actions, "scan") + sumAiDemandMap(demand.scanColors) * 0.35;
      const engineDemand = getAiMapDemand(demand.actions, "playCard") + demand.task * 0.08 + demand.final * 0.08;
      const endGameExpectedScore = scoreAiCardEndGameExpectedValue(card, model, player);

      for (let effectIndex = 0; effectIndex < (playEffects || []).length; effectIndex += 1) {
        const effect = playEffects[effectIndex];
        const type = effect?.type;
        const options = effect?.options || {};
        if (type === "launch") {
          const launchRoute = scoreAiCardLaunchRouteValue(effect, player);
          const postLaunchMoveScore = Math.max(0, aiNumber(launchRoute.postLaunchMoveScore));
          addPlan(
            "launch",
            "打牌触发发射路线",
            getAiMapDemand(demand.actions, "launch") * 0.18
              + routeDemand * 0.08
              + Math.max(0, scoreAiLaunchAction(player)) * 0.12
              + postLaunchMoveScore * (getAiRoundNumber() >= 3 ? 0.42 : 0.28)
              + Math.max(0, aiNumber(launchRoute.savedCost)) * 0.12,
            {
              effectType: type,
              postLaunchMoveScore,
              postLaunchMovePlan: launchRoute.postLaunchMovePlan || null,
            },
          );
        } else if (type === cardEffects.EFFECT_TYPES.CARD_MOVE || type === cardEffects.EFFECT_TYPES.FREE_MOVE) {
          const movePreview = getMovePreview(effect, effectIndex);
          const previewScore = Math.max(0, aiNumber(movePreview?.score));
          const arrivesAtPlanet = movePreview?.routeTarget?.kind === "planet"
            && Math.max(0, Math.round(aiNumber(movePreview.routeTarget.newDistance))) === 0;
          addPlan(
            "move",
            "打牌获得移动并靠近路线目标",
            moveDemand * 0.2
              + routeDemand * 0.08
              + Math.max(0, aiNumber(options.movementPoints || 1)) * 0.45
              + previewScore * (arrivesAtPlanet ? 0.45 : 0.28),
            {
              effectType: type,
              movementPoints: options.movementPoints ?? null,
              movePreview: movePreview
                ? {
                  score: movePreview.score,
                  routeTarget: movePreview.routeTarget || null,
                  from: movePreview.from || null,
                  to: movePreview.to || null,
                  direction: movePreview.direction || null,
                  followupLanding: movePreview.followupLanding || null,
                }
                : null,
            },
          );
        } else if (type === cardEffects.EFFECT_TYPES.CARD_ORBIT) {
          addPlan(
            "orbit",
            "打牌衔接环绕目标",
            getAiMapDemand(demand.actions, "orbit") * 0.24
              + planetDemand * 0.08
              + routeDemand * 0.04,
            { effectType: type },
          );
        } else if (type === cardEffects.EFFECT_TYPES.CARD_LAND) {
          addPlan(
            "land",
            "打牌衔接登陆目标",
            getAiMapDemand(demand.actions, "land") * 0.26
              + planetDemand * 0.09
              + routeDemand * 0.05,
            { effectType: type },
          );
        } else if (isAiChongTravelEffect(effect)) {
          const chongTravelValue = scoreAiChongTravelEffectImmediateValue(effect, player);
          const task = chong.getCardTask?.(card);
          const routeValue = task?.kind === "transport"
            ? scoreAiChongPickupTaskValue(task, player, null, {
              card,
              includePlayCost: false,
            })
            : 0;
          addPlan(
            "land",
            "打牌执行虫族化石路线",
            Math.max(chongTravelValue, routeValue * 0.72)
              + getAiMapDemand(demand.actions, "land") * 0.18
              + routeDemand * 0.05,
            { effectType: type, chongTask: Boolean(task) },
          );
        } else if (type === "research_tech_select" || type === cardEffects.EFFECT_TYPES.RESEARCH_TECH) {
          const techTypes = options.techTypes || options.allowedTechTypes || AI_TECH_TYPES;
          const bestTechDemand = techTypes.length
            ? Math.max(...techTypes.map((techType) => getAiMapDemand(demand.techTypes, techType)))
            : 0;
          addPlan(
            "researchTech",
            "打牌获得科技并补强引擎",
            getAiMapDemand(demand.actions, "researchTech") * 0.2
              + bestTechDemand * 0.24
              + engineDemand * 0.08,
            { effectType: type, techTypes },
          );
        } else if (isAiCardScanEffectType(type)) {
          const colorDemand = options.color
            ? getAiMapDemand(demand.scanColors, options.color)
            : 0;
          const nebulaDemand = options.nebulaId
            ? getAiMapDemand(demand.scanColors, data.getNebulaColor?.(options.nebulaId))
            : 0;
          addPlan(
            "scan",
            "打牌触发扫描路线",
            scanDemand * 0.16
              + colorDemand * 0.22
              + nebulaDemand * 0.18
              + getAiAvailableDataRoom(player) * 0.12,
            { effectType: type, color: options.color || null, nebulaId: options.nebulaId || null },
          );
        }
      }

      if (model.tasks?.length) {
        addPlan(
          "task",
          "打牌推进任务牌",
          demand.task * 0.25
            + engineDemand * 0.06
            + model.tasks.length * 0.6,
          { taskCount: model.tasks.length },
        );
      }
      if (model.endGameScoring) {
        addPlan(
          "final",
          "打牌建立终局得分路线",
          demand.final * 0.2
            + Math.max(0, getAiRemainingRoundWeight() - 1) * 0.35
            + endGameExpectedScore * 0.18,
          { endGameScoring: true, endGameExpectedScore },
        );
      }

      return plans
        .filter((plan) => Number.isFinite(Number(plan.score)))
        .sort((left, right) => right.score - left.score)[0] || null;
    }

    function scoreAiCardStandardActionPremium(playEffects = [], player = getCurrentPlayer()) {
      return (playEffects || []).reduce((total, effect) => {
        const type = effect?.type;
        if (type === "launch") {
          const standardCost = scoreAiLaunchPaymentCost();
          const actualCost = scoreAiLaunchPaymentCost(effect?.options || {});
          const savedCost = Math.max(0, standardCost - actualCost);
          const launchRoute = scoreAiCardLaunchRouteValue(effect, player);
          const postLaunchMoveScore = Math.max(0, aiNumber(launchRoute.postLaunchMoveScore));
          return total + Math.max(
            2,
            savedCost
              + Math.max(0, scoreAiLaunchAction(player)) * 0.2
              + postLaunchMoveScore * (getAiRoundNumber() >= 3 ? 0.22 : 0.14),
          );
        }
        if (type === cardEffects.EFFECT_TYPES.CARD_MOVE || type === cardEffects.EFFECT_TYPES.FREE_MOVE) {
          const movementPoints = Math.max(1, Math.round(aiNumber(effect.options?.movementPoints || 1)));
          const savedCost = scoreAiMovePaymentCost(player, movementPoints);
          return total + Math.max(1.5, savedCost + movementPoints * 0.35);
        }
        if (type === cardEffects.EFFECT_TYPES.CARD_ORBIT) {
          const standardCost = scoreAiResourceBundle(abilities.planet?.DEFAULT_ORBIT_COST || { credits: 1, energy: 1 });
          const actualCost = effect?.options?.cost ? scoreAiResourceBundle(effect.options.cost) : 0;
          return total + Math.max(3, Math.max(0, standardCost - actualCost) + scoreAiOrbitAction({ available: true }) * 0.18);
        }
        if (type === cardEffects.EFFECT_TYPES.CARD_LAND || type === "aomomo_land_only") {
          const standardCost = scoreAiResourceBundle({ energy: abilities.planet?.BASE_LAND_ENERGY_COST || 3 });
          const actualCost = effect?.options?.cost ? scoreAiResourceBundle(effect.options.cost) : 0;
          return total + Math.max(4, Math.max(0, standardCost - actualCost) + scoreAiLandAction({ available: true }) * 0.18);
        }
        if (isAiChongTravelEffect(effect)) {
          return total + Math.max(3.5, scoreAiChongTravelEffectImmediateValue(effect, player) * 0.28);
        }
        if (type === cardEffects.EFFECT_TYPES.SCAN_ACTION && effect?.options?.skipCost === true) {
          return total + Math.max(
            2.5,
            scoreAiScanPriorityFloor(player) * 0.3,
          );
        }
        if (
          type === cardEffects.EFFECT_TYPES.PUBLIC_SCAN
          || type === cardEffects.EFFECT_TYPES.HAND_SCAN
          || type === cardEffects.EFFECT_TYPES.SECTOR_X_SCAN
          || type === cardEffects.EFFECT_TYPES.PLANET_SECTOR_SCAN
          || type === cardEffects.EFFECT_TYPES.SCAN_COLOR_CHOICE
          || type === cardEffects.EFFECT_TYPES.CONDITIONAL_SECTOR_SCAN
          || type === cardEffects.EFFECT_TYPES.CHOOSE_NEBULA_SCAN
          || type === cardEffects.EFFECT_TYPES.SCAN_ACTION
          || type === "card_color_scan"
        ) {
          return total + Math.max(2.5, scoreAiScanPriorityFloor(player) * 0.3);
        }
        if (type === "research_tech_select" || type === cardEffects.EFFECT_TYPES.RESEARCH_TECH) return total + 3;
        return total;
      }, 0);
    }

    function scoreAiUnplayedTaskCardPreserveValue(card, model = null, playCandidate = null, player = getCurrentPlayer()) {
      const cardModel = model || cardEffects.getCardModel?.(card) || null;
      const tasks = cardModel?.tasks || [];
      if (!card || !player || !tasks.length) return 0;
      const round = getAiRoundNumber();
      const completedTaskCount = Math.max(0, Math.round(aiNumber(player.completedTaskCount)));
      const handSize = Math.max(0, (player.hand || []).length);
      const routeValue = tasks.reduce((total, task) => (
        total + Math.max(0, scoreAiTaskRouteCompletionValue(task, player))
      ), 0);
      const directScore = tasks.reduce((total, task) => (
        total + Math.max(0, getAiTaskDirectScoreReward(task, player))
      ), 0);
      const cFinalProgress = Math.max(0, scoreAiCFinalTaskProgressValue(player, tasks.length));
      const playableScore = Math.max(0, aiNumber(playCandidate?.score));
      const lowTaskPressure = completedTaskCount <= 0
        ? round <= 2 ? 7.5 : round === 3 ? 8.5 : 6
        : completedTaskCount === 1
          ? round <= 3 ? 5 : 3.5
          : 1.5;
      let value = 2.5
        + Math.min(16, routeValue * 0.72)
        + Math.min(7, cFinalProgress * 1.25)
        + Math.min(5, directScore * 0.28)
        + Math.min(5, playableScore * 0.2)
        + lowTaskPressure;
      if (round >= FINAL_ROUND_NUMBER && directScore <= 0 && cFinalProgress <= 0) value *= 0.7;
      if (handSize >= 8) value *= 0.6;
      else if (handSize >= 7) value *= 0.75;
      else if (handSize >= 6) value *= 0.88;
      return roundAiScore(Math.min(28, Math.max(0, value)));
    }

    function getAiReadyHandTaskCashout(card, model = null, player = getCurrentPlayer()) {
      const cardModel = model || cardEffects.getCardModel?.(card) || null;
      const tasks = cardModel?.tasks || [];
      if (!card || !player || !tasks.length) return { count: 0, directScore: 0, rewardValue: 0, value: 0, taskIds: [] };
      const completedTaskIds = new Set(card?.cardEffectState?.completedTaskIds || []);
      const readyTasks = tasks.filter((task) => {
        if (!task?.id || completedTaskIds.has(task.id)) return false;
        return summarizeAiTaskCondition(task.condition || {}, player)?.met === true;
      });
      if (!readyTasks.length) return { count: 0, directScore: 0, rewardValue: 0, value: 0, taskIds: [] };
      const directScore = readyTasks.reduce((total, task) => total + Math.max(0, getAiTaskDirectScoreReward(task, player)), 0);
      const rewardValue = readyTasks.reduce((total, task) => total + Math.max(0, getAiTaskRewardValue(task, player)), 0);
      if (directScore <= 0) {
        return { count: readyTasks.length, directScore: 0, rewardValue: roundAiScore(rewardValue), value: 0, taskIds: readyTasks.map((task) => task.id) };
      }
      const value = Math.min(
        32,
        rewardValue * 1.05
          + directScore * (getAiRoundNumber() >= FINAL_ROUND_NUMBER ? 1 : 0.65)
          + scoreAiThresholdPressureForScoreGain(directScore, player) * 0.45,
      );
      return {
        count: readyTasks.length,
        directScore: roundAiScore(directScore),
        rewardValue: roundAiScore(rewardValue),
        value: roundAiScore(value),
        taskIds: readyTasks.map((task) => task.id),
      };
    }

    function scoreAiReadyTaskTechReplacementValue(playEffects = [], readyTaskCashout = null, player = getCurrentPlayer()) {
      if (!player || !readyTaskCashout || aiNumber(readyTaskCashout.directScore) < 9) return 0;
      if (getAiRoundNumber() < 3) return 0;
      const techEffects = (playEffects || []).filter((effect) => (
        effect?.type === "research_tech_select"
        || effect?.type === cardEffects.EFFECT_TYPES.RESEARCH_TECH
      ));
      if (!techEffects.length) return 0;
      const bestTechScore = techEffects.reduce((best, effect) => {
        const candidates = listAiResearchTechCandidates(effect.options || null);
        return Math.max(best, ...candidates.map((candidate) => Math.max(0, aiNumber(candidate.score))));
      }, 0);
      if (bestTechScore <= 0) return 0;
      const scale = getAiRoundNumber() >= FINAL_ROUND_NUMBER ? 0.46 : 0.36;
      return roundAiScore(Math.min(46, bestTechScore * scale));
    }

    function listAiStrategyPassiveSlotsForCard(card, player = getCurrentPlayer()) {
      if (!card || !player || !industry?.playerHasStrategyPassive?.(player)) return [];
      if (card.scanActionCode == null || card.scanActionCode === "") return [];
      const code = Math.round(aiNumber(card.scanActionCode));
      if (!Number.isFinite(code) || code < 0 || code > 3) return [];
      const slotIds = code === 3
        ? (industry.STRATEGY_PASSIVE_SLOT_IDS || ["yellow", "red", "blue"])
        : [{ 0: "yellow", 1: "red", 2: "blue" }[code]].filter(Boolean);
      return slotIds.filter((slotId) => !player.industryStrategyPassiveSlots?.[slotId]);
    }

    function scoreAiStrategyPassiveCardPlayValue(card, player = getCurrentPlayer()) {
      const slots = listAiStrategyPassiveSlotsForCard(card, player);
      if (!slots.length) return 0;
      return slots.reduce((best, slotId) => (
        Math.max(best, scoreAiStrategyPassiveSlotChoice(slotId, player))
      ), 0);
    }

    function scoreAiPlayCardValue(card, details = {}) {
      const player = details.player || getCurrentPlayer();
      const model = details.model || cardEffects.getCardModel?.(card) || null;
      const playEffects = details.playEffects || cardEffects.buildPlayEffects?.(card) || [];
      const cost = details.cost || getCardPlayCost(card);
      const price = details.price ?? getCardPrice(card);
      const typeCode = details.typeCode ?? getCardTypeCode(card);
      const reservesAfterPlay = details.reservesAfterPlay ?? (
        [1, 2, 3].includes(typeCode) || Boolean(model?.reserveAfterPlay)
      );
      const effectValue = details.effectValue ?? playEffects.reduce((total, effect) => (
        total + scoreAiEffectValue(effect, { player, immediate: true })
      ), 0);
      const hasPersistentModeledValue = Boolean(
        model?.tasks?.length
        || model?.triggers?.length
        || model?.endGameScoring
        || model?.pluto
      );
      const reserveValue = reservesAfterPlay && hasPersistentModeledValue
        ? 4 + (model?.tasks?.length || 0) * 3.6 + (model?.triggers?.length || 0) * 2
        : 0;
      const endGameValue = model?.endGameScoring ? 5 + getAiRemainingRoundWeight() * 0.5 : 0;
      const plutoValue = model?.pluto ? 8 : 0;
      const costValue = scoreAiResourceBundle(cost);
      const cornerOpportunity = scoreAiCardCornerOpportunity(card);
      const demandFit = scoreAiCardDemandFit(card, model, playEffects, player);
      const endGameExpectedScore = details.endGameExpectedScore ?? scoreAiCardEndGameExpectedValue(card, model, player);
      const routePlan = details.plan || scoreAiPlayCardRoutePlan(card, model, playEffects, player);
      const standardActionPremium = details.standardActionPremium
        ?? scoreAiCardStandardActionPremium(playEffects, player);
      const c2Type3ProgressValue = typeCode === 3 ? scoreAiC2Type3ProgressValue(player) : 0;
      const cFinalTaskProgressValue = details.cFinalTaskProgressValue ?? (
        model?.tasks?.length ? scoreAiCFinalTaskProgressValue(player, model.tasks.length) : 0
      );
      const chongTaskChainValue = details.chongTaskChainValue ?? scoreAiChongCardTaskChainValue(card, player);
      const banrenmaThresholdSetupValue = details.banrenmaThresholdSetupValue
        ?? scoreAiBanrenmaCardThresholdSetupValue(card, player);
      const playCardConversionPressure = details.playCardConversionPressure
        ?? scoreAiPlayCardConversionPressure(card, {
          player,
          model,
          playEffects,
          typeCode,
          endGameExpectedScore,
          plan: routePlan,
          standardActionPremium,
        });
      const finalRoundEndGameCardUrgency = scoreAiFinalRoundEndGameCardUrgency(
        typeCode,
        model,
        player,
        endGameExpectedScore,
        c2Type3ProgressValue,
      );
      const directScoreGain = details.directScoreGain ?? getAiRewardDirectScore(playEffects, player, { immediate: true });
      const highScoreConcretePlayValue = Math.max(
        0,
        directScoreGain,
        effectValue,
        standardActionPremium,
        c2Type3ProgressValue,
        cFinalTaskProgressValue,
        chongTaskChainValue,
        banrenmaThresholdSetupValue,
        endGameExpectedScore,
        aiNumber(routePlan?.score),
      );
      const requireConcreteHighScorePlay = normalizeAiDifficulty(player?.aiDifficulty || aiAutoBattleState.aiDifficulty)
        === AI_DIFFICULTY_WEAK_START;
      const highScorePushValue = details.highScorePushValue ?? (
        (!requireConcreteHighScorePlay || highScoreConcretePlayValue > 0)
          ? scoreAiHighScorePushValue(player, "playCard", { endGameExpectedScore, directScoreGain })
          : 0
      );
      const strategyPassivePlayValue = details.strategyPassivePlayValue
        ?? scoreAiStrategyPassiveCardPlayValue(card, player);
      const firstRound25Pressure = getAiRoundNumber() <= 1
        && Math.max(0, aiNumber(player?.resources?.score)) < 25;
      const directScorePaceValue = scoreAiPaceValueForDirectScore(directScoreGain, player, {
        baseWeight: getAiRoundNumber() >= 3
          ? 0.45
          : getAiRoundNumber() === 2
            ? 0.28
            : firstRound25Pressure
              ? 0.32
              : 0.12,
        pressureWeight: getAiRoundNumber() >= 3
          ? 0.2
          : firstRound25Pressure
            ? 0.18
            : 0.1,
      });
      const thirdFinalMarkCashoutValue = scoreAiThirdFinalMarkCashoutValue(directScoreGain, player, {
        weight: 0.75,
      });
      const secondFinalMarkNudgeValue = scoreAiSecondFinalMarkNudgeValue(directScoreGain, player, {
        weight: 0.45,
      });
      const routePlanCashout = Boolean(
        routePlan?.movePreview?.followupLanding?.directScoreGain > 0
        || routePlan?.postLaunchMovePlan?.followupDirectScore > 0
        || routePlan?.actionId === "land"
        || routePlan?.actionId === "orbit"
      );
      const finalSecondMarkNoDirectSetupPenalty = details.finalSecondMarkNoDirectSetupPenalty
        ?? scoreAiFinalSecondMarkNoDirectSetupPenalty(player, {
          actionId: "playCard",
          directScoreGain,
          setupScore: Math.max(0, aiNumber(routePlan?.score), standardActionPremium),
          consumesHand: true,
          cost,
          noCashoutRoute: !routePlanCashout,
          playCardConversionPressure,
        });
      const finalRoundResourceDrainPenalty = details.finalRoundResourceDrainPenalty
        ?? scoreAiFinalRoundPlayCardResourceDrainPenalty(card, {
          player,
          model,
          cost,
          directScoreGain,
          routePlanCashout,
        });
      return effectValue
        + reserveValue
        + endGameValue
        + plutoValue
        + demandFit
        + standardActionPremium
        + directScorePaceValue
        + thirdFinalMarkCashoutValue
        + secondFinalMarkNudgeValue
        + applyAiStrategyWeight(c2Type3ProgressValue, "final", 0.85)
        + applyAiStrategyWeight(Math.min(12, cFinalTaskProgressValue), "task", 0.75)
        + applyAiStrategyWeight(chongTaskChainValue, "task", 0.7)
        + applyAiStrategyWeight(banrenmaThresholdSetupValue, "playCard", 0.65)
        + applyAiStrategyWeight(finalRoundEndGameCardUrgency, "final", 0.75)
        + applyAiStrategyWeight(Math.min(10, endGameExpectedScore * 0.55), "final", 0.6)
        + applyAiStrategyWeight(Math.max(0, aiNumber(routePlan?.score)), "playCard", 0.35)
        + applyAiStrategyWeight(playCardConversionPressure, "playCard", 0.65)
        + applyAiStrategyWeight(Math.min(8, Math.max(0, strategyPassivePlayValue)), "playCard", 0.65)
        + highScorePushValue
        + scoreAiLowEngineCatchupValue(player, "playCard")
        + Math.max(0, 4 - aiNumber(price)) * 0.5
        - costValue
        - cornerOpportunity * 0.45
        - finalSecondMarkNoDirectSetupPenalty
        - finalRoundResourceDrainPenalty;
    }
    return Object.freeze({
      resetAiStrategyDemandCache,
      createAiStrategyDemand,
      addAiMapDemand,
      getAiMapDemand,
      addAiAlienTraceTargetDemand,
      getAiAlienTraceTargetDemand,
      getAiAlienTraceTargetDemandForSlot,
      addAiActionDemand,
      addAiAllScanColorDemand,
      addAiAllTechDemand,
      addAiAllTraceDemand,
      getAiMissingCount,
      aiMarkerBelongsToPlayer,
      countAiLandingMarkers,
      getAiTaskRewardValue,
      getAiTaskDirectScoreReward,
      listAiUncompletedCardTasksForPlayer,
      scoreAiTaskRouteCompletionValue,
      getAiPendingTaskRouteCashout,
      getAiPendingPlanetTaskRouteCashout,
      getAiPendingNearCompletePlanetTaskRouteCashout,
      getAiPendingLocationTaskRouteCashout,
      addAiPlanetDemand,
      addAiProbeLocationDemand,
      addAiProbeDistanceDemand,
      addAiTaskConditionDemand,
      addAiEventDemand,
      addAiEffectDemand,
      addAiEndGameRuleDemand,
      resolveAiCardEndGameRule,
      addAiFinalTileDemand,
      addAiCardModelDemand,
      getAiStrategyDemandCacheKey,
      getAiStrategyDemand,
      scoreAiCardDemandFit,
      isAiCardScanEffectType,
      scoreAiCardEndGameExpectedValue,
      isAiResearchTechEffectType,
      countAiHandEngineCards,
      countAiHandTaskCards,
      scoreAiLateCardEnginePressure,
      scoreAiLatePlayCardEnginePressure,
      scoreAiPlayCardConversionPressure,
      scoreAiCardLaunchRouteValue,
      scoreAiPlayCardRoutePlan,
      scoreAiCardStandardActionPremium,
      scoreAiUnplayedTaskCardPreserveValue,
      getAiReadyHandTaskCashout,
      scoreAiReadyTaskTechReplacementValue,
      listAiStrategyPassiveSlotsForCard,
      scoreAiStrategyPassiveCardPlayValue,
      scoreAiPlayCardValue,
    });
  }

  return Object.freeze({ createDemandCard });
});
