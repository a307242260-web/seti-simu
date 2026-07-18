(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAIAlienValuation = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createAlienValuation(context = {}) {
    const {
      state,
      solar,
      players,
      rocketActions,
      actions,
      scanEffects,
      aliens,
      aomomo,
      yichangdian,
      fangzhou,
      banrenma,
      chong,
      amiba,
      runezu,
      solarState,
      nebulaDataState,
      alienGameState,
      FINAL_ROUND_NUMBER,
      AI_RESOURCE_VALUES,
      AI_TRACE_TYPES,
    } = context;
    const aiAlienTraceEntryBelongsToPlayer = (...args) => context.aiAlienTraceEntryBelongsToPlayer(...args);
    const aiNumber = (...args) => context.aiNumber(...args);
    const callback = (...args) => context.callback(...args);
    const formatRocketLabel = (...args) => context.formatRocketLabel(...args);
    const getAiAlienCardConversionMultiplier = (...args) => context.getAiAlienCardConversionMultiplier(...args);
    const getAiAvailableDataTokenCount = (...args) => context.getAiAvailableDataTokenCount(...args);
    const getAiCardLandChoicePlanetId = (...args) => context.getAiCardLandChoicePlanetId(...args);
    const getAiChongLandOptions = (...args) => context.getAiChongLandOptions(...args);
    const getAiChongOrbitOrLandOptions = (...args) => context.getAiChongOrbitOrLandOptions(...args);
    const getAiMapDemand = (...args) => context.getAiMapDemand(...args);
    const getAiNextMissingFinalScoreThreshold = (...args) => context.getAiNextMissingFinalScoreThreshold(...args);
    const getAiPlayerTechTypeCounts = (...args) => context.getAiPlayerTechTypeCounts(...args);
    const getAiRoundNumber = (...args) => context.getAiRoundNumber(...args);
    const getAiSectorDistance = (...args) => context.getAiSectorDistance(...args);
    const getAiStrategyDemand = (...args) => context.getAiStrategyDemand(...args);
    const getCardPlayCost = (...args) => context.getCardPlayCost(...args);
    const getCardPrice = (...args) => context.getCardPrice(...args);
    const getCurrentPlayer = (...args) => context.getCurrentPlayer(...args);
    const getEarthSectorCoordinate = (...args) => context.getEarthSectorCoordinate(...args);
    const getPlanetSectorCoordinate = (...args) => context.getPlanetSectorCoordinate(...args);
    const isAiChongPickupPlanetId = (...args) => context.isAiChongPickupPlanetId(...args);
    const isAiChongTravelEffect = (...args) => context.isAiChongTravelEffect(...args);
    const isAiLandingEffect = (...args) => context.isAiLandingEffect(...args);
    const isAiSupportedHandPlayCard = (...args) => context.isAiSupportedHandPlayCard(...args);
    const listAiMoveCandidates = (...args) => context.listAiMoveCandidates(...args);
    const listAiResearchTechCandidates = (...args) => context.listAiResearchTechCandidates(...args);
    const roundAiScore = (...args) => context.roundAiScore(...args);
    const scoreAiAlienGridPosition = (...args) => context.scoreAiAlienGridPosition(...args);
    const scoreAiAlienTraceValue = (...args) => context.scoreAiAlienTraceValue(...args);
    const scoreAiBlueTechDataEngineValue = (...args) => context.scoreAiBlueTechDataEngineValue(...args);
    const scoreAiCFinalTaskProgressValue = (...args) => context.scoreAiCFinalTaskProgressValue(...args);
    const scoreAiCountedResourceGain = (...args) => context.scoreAiCountedResourceGain(...args);
    const scoreAiEffectValue = (...args) => context.scoreAiEffectValue(...args);
    const scoreAiLandChoice = (...args) => context.scoreAiLandChoice(...args);
    const scoreAiLaunchAction = (...args) => context.scoreAiLaunchAction(...args);
    const scoreAiMidgameResourceContinuationValue = (...args) => context.scoreAiMidgameResourceContinuationValue(...args);
    const scoreAiNebulaScanChoice = (...args) => context.scoreAiNebulaScanChoice(...args);
    const scoreAiPaceValueForDirectScore = (...args) => context.scoreAiPaceValueForDirectScore(...args);
    const scoreAiPublicityResearchTechSetupValue = (...args) => context.scoreAiPublicityResearchTechSetupValue(...args);
    const scoreAiResourceBundle = (...args) => context.scoreAiResourceBundle(...args);
    const scoreAiScanAction = (...args) => context.scoreAiScanAction(...args);
    const scoreAiScanPriorityFloor = (...args) => context.scoreAiScanPriorityFloor(...args);
    const scoreAiThresholdPressureForScoreGain = (...args) => context.scoreAiThresholdPressureForScoreGain(...args);
    const sectorXHasAvailableScanTarget = (...args) => context.sectorXHasAvailableScanTarget(...args);

    function cloneAiValue(value) {
      if (typeof structuredClone === "function") return structuredClone(value);
      return value == null ? value : JSON.parse(JSON.stringify(value));
    }

    function getAiAomomoFossilCount(player = getCurrentPlayer()) {
      return Math.max(0, Math.round(aiNumber(player?.resources?.aomomoFossils)));
    }

    function getAiAomomoFossilUnitValue(player = getCurrentPlayer()) {
      const fossils = getAiAomomoFossilCount(player);
      const round = getAiRoundNumber();
      let value = aiNumber(AI_RESOURCE_VALUES.aomomoFossils || 4);
      if (round <= 3) {
        if (fossils >= 3) value += 1.05;
        else if (fossils === 2) value += 0.45;
        else value -= 0.35;
      }
      if (round >= FINAL_ROUND_NUMBER) {
        if (fossils <= 1) value -= 1.15;
        else if (fossils === 2) value -= 0.45;
      }
      return Math.max(2.5, Math.min(5.2, value));
    }

    function scoreAiAomomoFossilPlanBonus(gainCount = 0, player = getCurrentPlayer()) {
      const gain = Math.max(0, Math.round(aiNumber(gainCount)));
      if (!gain || !player) return 0;
      const current = getAiAomomoFossilCount(player);
      const after = current + gain;
      const round = getAiRoundNumber();
      let value = 0;
      if (current < 4) {
        value += Math.max(0, Math.min(4, after) - Math.min(4, current)) * (round <= 3 ? 1.15 : 0.45);
        if (after >= 4) value += round >= 3 ? 6.5 : 3.2;
        else if (after >= 3) value += round <= 3 ? 2.1 : 0.8;
        else if (after >= 2) value += round <= 2 ? 1.1 : 0.6;
      }
      if (round >= FINAL_ROUND_NUMBER && after < 4) value -= Math.min(1.5, gain * 0.7);
      return roundAiScore(Math.max(-2, Math.min(9, value)));
    }

    function scoreAiAomomoFossilSpendPlanPenalty(spendCount = 0, player = getCurrentPlayer(), options = {}) {
      const spend = Math.max(0, Math.round(aiNumber(spendCount)));
      if (!spend || !player) return 0;
      const current = getAiAomomoFossilCount(player);
      const after = Math.max(0, current - spend);
      const round = getAiRoundNumber();
      let penalty = 0;
      if (current < 4) {
        penalty += Math.min(6, spend * (round <= 3 ? 1.4 : 0.55));
      } else if (after < 4) {
        penalty += round <= 3 ? 5.5 : 3.5;
      }
      if (aiNumber(options.directScore) >= 20 && round >= 3) penalty *= 0.45;
      if (options.crossesThreshold) penalty *= 0.55;
      return roundAiScore(Math.max(0, Math.min(8, penalty)));
    }

    function scoreAiAlienRewardBundle(reward = {}, player = getCurrentPlayer()) {
      if (!reward || typeof reward !== "object") return 0;
      const gain = reward.gain || {};
      const directScore = Math.max(0, aiNumber(gain.score));
      let value = scoreAiResourceBundle(gain);
      const fossilGain = Math.max(0, Math.round(aiNumber(gain.aomomoFossils)));
      if (fossilGain > 0) value += scoreAiAomomoFossilPlanBonus(fossilGain, player);
      value += scoreAiMidgameResourceContinuationValue(gain, player, { scale: 0.8 });
      value += scoreAiPublicityResearchTechSetupValue(gain, player, { scale: 0.85 });
      if (directScore > 0) {
        value += scoreAiThresholdPressureForScoreGain(directScore, player) * 0.55;
      }
      value += Math.max(0, Math.round(aiNumber(reward.dataCount))) * AI_RESOURCE_VALUES.availableData;
      if (Math.max(0, Math.round(aiNumber(reward.dataCount))) > 0) {
        value += scoreAiMidgameResourceContinuationValue(
          { availableData: Math.max(0, Math.round(aiNumber(reward.dataCount))) },
          player,
          { scale: 0.65 },
        );
      }
      value += Math.max(0, Math.round(aiNumber(reward.drawCards || reward.blindDraw))) * AI_RESOURCE_VALUES.handSize;
      if (reward.pickCard) value += 3.5;
      if (reward.pickAlienCard) value += 5.5;
      if (Number.isFinite(Number(reward.regionValue))) value += aiNumber(reward.regionValue);
      if (Number.isFinite(Number(reward.panelSymbolValue))) value += aiNumber(reward.panelSymbolValue);
      if (Number.isFinite(Number(reward.symbolValue))) value += aiNumber(reward.symbolValue);
      value -= Math.max(0, aiNumber(reward.payData)) * AI_RESOURCE_VALUES.availableData;
      const fossilCost = Math.max(0, Math.round(aiNumber(reward.payFossils)));
      if (fossilCost > 0) {
        const threshold = getAiNextMissingFinalScoreThreshold(player);
        const currentScore = Math.max(0, aiNumber(player?.resources?.score));
        const crossesThreshold = Boolean(threshold && currentScore < threshold && currentScore + directScore >= threshold);
        value -= fossilCost * getAiAomomoFossilUnitValue(player);
        value -= scoreAiAomomoFossilSpendPlanPenalty(fossilCost, player, { directScore, crossesThreshold });
      }
      return value;
    }

    function scoreAiBestChongFossilRewardValue(player = getCurrentPlayer()) {
      if (!chong?.FOSSIL_IDS?.length || !chong?.getFossilReward) return 0;
      return chong.FOSSIL_IDS.reduce((best, fossilId) => (
        Math.max(best, scoreAiAlienRewardBundle(chong.getFossilReward(fossilId), player))
      ), 0);
    }

    function listAiChongFossilRewardValues(player = getCurrentPlayer()) {
      if (!chong?.FOSSIL_IDS?.length || !chong?.getFossilReward) return [];
      return chong.FOSSIL_IDS
        .map((fossilId) => scoreAiAlienRewardBundle(chong.getFossilReward(fossilId), player))
        .filter((value) => Number.isFinite(Number(value)) && value > 0);
    }

    function scoreAiAverageChongFossilRewardValue(player = getCurrentPlayer()) {
      const values = listAiChongFossilRewardValues(player);
      if (!values.length) return 0;
      return values.reduce((total, value) => total + value, 0) / values.length;
    }

    function hasAiPlayerSeenChongFossil(fossil, player = getCurrentPlayer()) {
      if (!fossil || !player) return false;
      const visible = fossil.visibleToPlayerIds || [];
      return visible.includes(player.id)
        || visible.includes(player.color)
        || fossil.carriedByPlayerId === player.id
        || fossil.carriedByPlayerColor === player.color;
    }

    function scoreAiExpectedChongPlanetFossilRewardValue(planetId, player = getCurrentPlayer()) {
      if (!chong?.getAvailablePlanetFossils) return 0;
      const available = planetId
        ? chong.getAvailablePlanetFossils(alienGameState, planetId)
        : [];
      if (planetId && !available.length) return 0;
      const visibleValues = available
        .filter((fossil) => hasAiPlayerSeenChongFossil(fossil, player))
        .map((fossil) => scoreAiAlienRewardBundle(chong.getFossilReward?.(fossil.fossilId), player))
        .filter((value) => Number.isFinite(Number(value)) && value > 0);
      if (available.length > 0 && visibleValues.length === available.length) {
        return Math.max(0, ...visibleValues);
      }
      const average = scoreAiAverageChongFossilRewardValue(player);
      const best = scoreAiBestChongFossilRewardValue(player);
      const choiceCount = Math.max(1, available.length || 2);
      const hiddenChoicePremium = Math.max(0, choiceCount - 1) * 1.15;
      return Math.max(
        visibleValues.length ? Math.max(...visibleValues) : 0,
        Math.min(best, average + hiddenChoicePremium),
      );
    }

    function scoreAiChongPanelUnlockValue(player = getCurrentPlayer()) {
      if (!player || !chong?.LOCKED_BLUE_POSITIONS?.length) return 0;
      const panelSlots = alienGameState?.chong?.panelFossilSlots || {};
      const remainingLockedBlue = chong.LOCKED_BLUE_POSITIONS.filter((position) => !panelSlots[position]).length;
      if (!remainingLockedBlue) return 0;
      const demand = getAiStrategyDemand(player);
      const blueDemand = getAiMapDemand(demand.traceTypes, "blue")
        + getAiMapDemand(demand.actions, "analyze") * 0.45
        + getAiMapDemand(demand.actions, "placeData") * 0.25;
      const engineValue = scoreAiBlueTechDataEngineValue(player);
      return roundAiScore(Math.min(
        6,
        1.8
          + Math.min(2.6, blueDemand * 0.08)
          + Math.min(2.2, engineValue * 0.18)
          + Math.min(1.2, remainingLockedBlue * 0.2),
      ));
    }

    function scoreAiChongTaskRewardValue(task = {}, player = getCurrentPlayer()) {
      if (!task || !player) return 0;
      let value = 0;
      if (task.gain) value += scoreAiCountedResourceGain(task.gain, player);
      const dataCount = Math.max(0, Math.round(aiNumber(task.dataCount)));
      if (dataCount > 0) {
        value += dataCount * AI_RESOURCE_VALUES.availableData;
        value += scoreAiMidgameResourceContinuationValue({ availableData: dataCount }, player, { scale: 0.78 });
      }
      if (task.pickCard) {
        value += AI_RESOURCE_VALUES.handSize * 0.9;
        value += scoreAiMidgameResourceContinuationValue(
          { handSize: 1, cardSelection: 1 },
          player,
          { scale: 0.42 },
        );
      }
      const fossilRewardRepeat = Math.max(0, Math.round(aiNumber(task.fossilRewardRepeat)));
      if (fossilRewardRepeat > 0) {
        value += fossilRewardRepeat * scoreAiBestChongFossilRewardValue(player) * 0.62;
        value += scoreAiChongPanelUnlockValue(player);
      }
      if (task.kind === "transport") {
        value += task.destinationPlanetId === "earth" ? 3.2 : 1.8;
      }
      return roundAiScore(Math.min(24, Math.max(0, value)));
    }

    function getAiPlanetCoordinateById(planetId) {
      if (!planetId) return null;
      const coordinate = getPlanetSectorCoordinate?.(planetId);
      if (coordinate) return { x: coordinate.x, y: coordinate.y };
      if (planetId === "earth") {
        const earth = getEarthSectorCoordinate?.();
        return earth ? { x: earth.x, y: earth.y } : null;
      }
      const planet = solar.createSolarSnapshot(solarState).planetLocations
        .find((item) => item.planetId === planetId);
      return planet ? { x: planet.x, y: planet.y } : null;
    }

    function scoreAiChongTransportDeliveryCost(fromPlanetId, task = {}, player = getCurrentPlayer()) {
      const destinationPlanetId = task?.destinationPlanetId || null;
      if (!fromPlanetId || !destinationPlanetId) return 3.5;
      const from = getAiPlanetCoordinateById(fromPlanetId);
      const destination = getAiPlanetCoordinateById(destinationPlanetId);
      if (!from || !destination) return 5;
      const distance = Math.max(0, getAiSectorDistance(from, destination));
      const round = getAiRoundNumber();
      const moveUnitCost = AI_RESOURCE_VALUES.movement * (round <= 2 ? 0.85 : round === 3 ? 1 : 1.15);
      const farOuterPenalty = (fromPlanetId === "saturn" || fromPlanetId === "jupiter")
        && destinationPlanetId === "earth"
        ? 1.5
        : 0;
      const destinationPremium = destinationPlanetId === "earth" ? 0.5 : 0;
      return roundAiScore(Math.min(20, distance * moveUnitCost + farOuterPenalty + destinationPremium));
    }

    function scoreAiChongTransportCompletionValue(task = {}, player = getCurrentPlayer(), options = {}) {
      if (!task || !player) return 0;
      const fossilRewardRepeat = Math.max(0, Math.round(aiNumber(task.fossilRewardRepeat)));
      const fossilRewardValue = options.fossilId
        ? scoreAiAlienRewardBundle(chong?.getFossilReward?.(options.fossilId), player)
        : options.planetId
          ? scoreAiExpectedChongPlanetFossilRewardValue(options.planetId, player)
          : scoreAiAverageChongFossilRewardValue(player);
      const dataCount = Math.max(0, Math.round(aiNumber(task.dataCount)));
      let value = 0;
      if (task.gain) value += scoreAiCountedResourceGain(task.gain, player);
      if (dataCount > 0) {
        value += dataCount * AI_RESOURCE_VALUES.availableData;
        value += scoreAiMidgameResourceContinuationValue({ availableData: dataCount }, player, { scale: 0.78 });
      }
      if (task.pickCard) {
        value += AI_RESOURCE_VALUES.handSize * 0.9;
        value += scoreAiMidgameResourceContinuationValue(
          { handSize: 1, cardSelection: 1 },
          player,
          { scale: 0.42 },
        );
      }
      if (fossilRewardRepeat > 0) {
        value += fossilRewardRepeat * fossilRewardValue * 0.92;
        value += scoreAiChongPanelUnlockValue(player) * 0.85;
      }
      value += Math.min(9, scoreAiCFinalTaskProgressValue(player, 1) * 0.95);
      if (task.destinationPlanetId === "earth") value += 2.2;
      else if (task.destinationPlanetId) value += 1.2;
      return roundAiScore(Math.min(34, Math.max(0, value)));
    }

    function scoreAiChongTransportMoveUrgency(task = {}, oldDistance = 0, newDistance = 0, deliveryValue = 0) {
      if (!task?.destinationPlanetId) return 0;
      const destinationEarth = task.destinationPlanetId === "earth";
      const round = getAiRoundNumber();
      const remainingDistance = Math.max(0, aiNumber(newDistance));
      const routeStartedBonus = destinationEarth ? 5.8 : 3.8;
      const roundPressure = round >= FINAL_ROUND_NUMBER
        ? 8.5
        : round >= 3
          ? 5
          : 2.4;
      const closeWindowPressure = Math.max(0, 4 - remainingDistance) * (destinationEarth ? 2.6 : 1.8);
      const deliveryPressure = Math.min(
        10,
        Math.max(0, aiNumber(deliveryValue)) * (remainingDistance <= 1 ? 0.34 : 0.2),
      );
      const arrivalPressure = remainingDistance === 0 ? 6 : 0;
      const progressPressure = Math.max(0, aiNumber(oldDistance) - aiNumber(newDistance)) * 1.4;
      return roundAiScore(
        routeStartedBonus
          + roundPressure
          + closeWindowPressure
          + deliveryPressure
          + arrivalPressure
          + progressPressure,
      );
    }

    function scoreAiChongCardPlayAffordability(card, player = getCurrentPlayer()) {
      if (!card || !player) return 1;
      const cost = getCardPlayCost(card) || {};
      if (!Object.keys(cost).length || players.canAfford(player, cost)) return 1;
      const resources = player.resources || {};
      const creditShortfall = Math.max(0, aiNumber(cost.credits) - aiNumber(resources.credits));
      const energyShortfall = Math.max(0, aiNumber(cost.energy) - aiNumber(resources.energy));
      const shortfallValue = creditShortfall * AI_RESOURCE_VALUES.credits
        + energyShortfall * AI_RESOURCE_VALUES.energy;
      return Math.max(0.18, 0.68 - shortfallValue * 0.055);
    }

    function scoreAiChongPickupTaskValue(task = {}, player = getCurrentPlayer(), planetId = null, options = {}) {
      if (!task || task.kind !== "transport" || !player) return 0;
      if (planetId && !isAiChongPickupPlanetId(planetId)) return 0;
      if (planetId && !(chong?.getAvailablePlanetFossils?.(alienGameState, planetId) || []).length) return 0;
      if (!planetId) {
        const availableAny = (chong?.getAvailablePlanetFossils?.(alienGameState, "jupiter") || []).length
          + (chong?.getAvailablePlanetFossils?.(alienGameState, "saturn") || []).length;
        if (availableAny <= 0) return 0;
      }
      const round = getAiRoundNumber();
      const completionValue = scoreAiChongTransportCompletionValue(task, player, {
        planetId,
        fossilId: options.fossilId || null,
      });
      const futureScale = options.immediate
        ? round <= 2 ? 0.92 : round === 3 ? 0.78 : 0.56
        : round <= 2 ? 0.7 : round === 3 ? 0.58 : 0.36;
      const deliveryCost = planetId
        ? scoreAiChongTransportDeliveryCost(planetId, task, player)
        : 4;
      const card = options.card || null;
      const includePlayCost = options.includePlayCost !== false && Boolean(card);
      const cardCost = includePlayCost ? scoreAiResourceBundle(getCardPlayCost(card) || {}) : 0;
      const affordability = includePlayCost ? scoreAiChongCardPlayAffordability(card, player) : 1;
      const immediateBonus = options.immediate ? 2.5 : 0;
      return roundAiScore(Math.min(
        36,
        Math.max(0, completionValue * futureScale * affordability + immediateBonus - deliveryCost - cardCost * 0.35),
      ));
    }

    function listAiPlayableChongTransportCards(player = getCurrentPlayer()) {
      if (!player || !chong?.isChongCard || !chong?.getCardTask) return [];
      return (player.hand || [])
        .filter((card) => chong.isChongCard(card))
        .map((card) => ({ card, task: chong.getCardTask(card) }))
        .filter((entry) => entry.task?.kind === "transport");
    }

    function scoreAiChongPickupRouteValue(planetId, player = getCurrentPlayer(), options = {}) {
      if (planetId && !isAiChongPickupPlanetId(planetId)) return 0;
      if (planetId && !(chong?.getAvailablePlanetFossils?.(alienGameState, planetId) || []).length) return 0;
      if (Object.prototype.hasOwnProperty.call(options, "task")) {
        if (!options.task) return 0;
        return scoreAiChongPickupTaskValue(options.task, player, planetId, options);
      }
      return listAiPlayableChongTransportCards(player)
        .reduce((best, entry) => Math.max(
          best,
          scoreAiChongPickupTaskValue(entry.task, player, planetId, {
            ...options,
            card: entry.card,
          }),
        ), 0);
    }

    function getAiChongTaskForEffect(effect) {
      if (!isAiChongTravelEffect(effect)) return null;
      const card = state.pendingActionEffectFlow?.card || null;
      return card?.chongTask || chong?.getCardTask?.(effect.options?.cardIndex) || null;
    }

    function isAiChongPickupTravelChoice(choice) {
      const planetId = getAiCardLandChoicePlanetId(choice);
      return isAiChongPickupPlanetId(planetId)
        && (chong?.getAvailablePlanetFossils?.(alienGameState, planetId) || []).length > 0;
    }

    function listAiChongPickupTravelChoices(options) {
      return (options?.choices || []).filter((choice) => isAiChongPickupTravelChoice(choice));
    }

    function scoreAiChongTravelChoiceBonus(effect, choice, player = getCurrentPlayer()) {
      if (!isAiChongTravelEffect(effect)) return 0;
      const planetId = getAiCardLandChoicePlanetId(choice);
      if (!isAiChongPickupTravelChoice(choice)) return 0;
      return scoreAiChongPickupRouteValue(planetId, player, {
        task: getAiChongTaskForEffect(effect),
        includePlayCost: false,
        immediate: true,
      });
    }

    function scoreAiChongTravelEffectPlanetValue(effect, planetId, player = getCurrentPlayer()) {
      if (!isAiChongTravelEffect(effect) || !isAiChongPickupPlanetId(planetId)) return 0;
      return scoreAiChongPickupRouteValue(planetId, player, {
        task: getAiChongTaskForEffect(effect),
        includePlayCost: false,
        immediate: true,
      });
    }

    function scoreAiChongTravelEffectImmediateValue(effect, player = getCurrentPlayer()) {
      if (!isAiChongTravelEffect(effect)) return 0;
      const options = effect.type === chong?.EFFECT_TYPES?.CHONG_ORBIT_OR_LAND_FOR_PICKUP
        ? getAiChongOrbitOrLandOptions(effect)
        : getAiChongLandOptions(effect);
      if (!options?.ok || !options.choices?.length) return 0;
      const pickupChoices = listAiChongPickupTravelChoices(options);
      if (!pickupChoices.length) return 0;
      return pickupChoices.reduce((best, choice) => {
        const score = scoreAiLandChoice(choice, player, { chongEffect: effect });
        return Math.max(best, Number.isFinite(Number(score)) ? score : 0);
      }, 0);
    }

    function isAiChongFossilToken(rocket) {
      return (rocket?.kind || rocketActions.ROCKET_KIND?.STANDARD) === rocketActions.ROCKET_KIND?.CHONG_FOSSIL;
    }

    function getAiChongTransportTaskForRocket(rocket) {
      if (!rocket || !chong?.getTransportTaskForRocket) return null;
      const rawTask = chong.getTransportTaskForRocket(alienGameState, rocket.id);
      if (!rawTask) return null;
      const fossil = alienGameState?.chong?.fossilsById?.[rawTask.fossilId] || null;
      return {
        destinationPlanetId: fossil?.destinationPlanetId || rawTask.destinationPlanetId || null,
        fossilRewardRepeat: Math.max(0, Math.round(aiNumber(fossil?.fossilRewardRepeat ?? rawTask.fossilRewardRepeat))),
        gain: { ...(fossil?.taskGain || rawTask.gain || {}) },
        dataCount: Math.max(0, Math.round(aiNumber(fossil?.taskDataCount ?? rawTask.dataCount))),
        pickCard: Boolean(fossil?.taskPickCard || rawTask.pickCard),
        fossilId: fossil?.fossilId || rawTask.fossilId || null,
      };
    }

    function getAiChongTransportDeliveryRouteTarget(rocket, player = getCurrentPlayer()) {
      if (!isAiChongFossilToken(rocket)) return null;
      const task = getAiChongTransportTaskForRocket(rocket);
      if (!task?.destinationPlanetId) return null;
      const coordinate = getAiPlanetCoordinateById(task.destinationPlanetId);
      if (!coordinate) return null;
      const value = scoreAiChongTransportCompletionValue(task, player, {
        fossilId: task.fossilId,
      });
      return {
        id: `chong-transport:${rocket.id}:${task.destinationPlanetId}`,
        label: `运送虫族化石到${task.destinationPlanetId}`,
        kind: "planet",
        chongTransport: true,
        coordinate,
        value: Math.min(38, 8 + value * 0.85),
      };
    }

    function buildAiChongTransportMoveCandidate(input = {}) {
      const rocket = input.rocket || null;
      if (!isAiChongFossilToken(rocket)) return null;
      const player = input.player || getCurrentPlayer();
      const direction = input.direction || null;
      const from = input.from || null;
      const to = input.to || null;
      if (!player || !direction || !from || !to) return null;
      if (input.nextEffect && isAiLandingEffect(input.nextEffect)) return null;

      const task = getAiChongTransportTaskForRocket(rocket);
      if (!task?.destinationPlanetId) return null;
      const destination = getAiPlanetCoordinateById(task.destinationPlanetId);
      if (!destination) return null;
      if (
        task.destinationPlanetId === "earth"
        && aiNumber(from.y) > aiNumber(destination.y)
        && aiNumber(to.y) >= aiNumber(from.y)
      ) {
        return null;
      }

      const oldDistance = getAiSectorDistance(from, destination);
      const newDistance = getAiSectorDistance(to, destination);
      if (!Number.isFinite(Number(oldDistance)) || !Number.isFinite(Number(newDistance))) return null;
      if (newDistance >= oldDistance) return null;

      const deliveryValue = scoreAiChongTransportCompletionValue(task, player, {
        fossilId: task.fossilId,
      });
      const distanceGain = oldDistance - newDistance;
      const routeGain = distanceGain * (task.destinationPlanetId === "earth" ? 13 : 10);
      const arrivalGain = newDistance === 0 ? deliveryValue : deliveryValue * 0.24 / (newDistance + 1);
      const urgencyGain = scoreAiChongTransportMoveUrgency(
        task,
        oldDistance,
        newDistance,
        deliveryValue,
      );
      const movementGain = routeGain + arrivalGain + urgencyGain + (newDistance === 0 ? 7 : 0);
      const paymentCost = Math.max(0, aiNumber(input.paymentCost));
      const indexPenalty = Math.max(0, aiNumber(input.index)) * 0.1;
      const movementCost = paymentCost + indexPenalty;
      const score = movementGain - movementCost;
      if (score < (input.free ? -0.5 : 1.5)) return null;

      return {
        id: input.id || "move",
        kind: input.kind || "quick",
        available: true,
        rocketId: rocket.id,
        rocketLabel: formatRocketLabel(rocket),
        direction: direction.id,
        directionLabel: direction.label,
        deltaX: direction.deltaX,
        deltaY: direction.deltaY,
        from,
        to,
        requiredMovePoints: input.requiredMovePoints,
        terrainRequired: input.terrainRequired,
        paymentRequired: input.paymentRequired,
        routeTarget: {
          id: `chong-transport:${rocket.id}:${task.destinationPlanetId}`,
          label: `运送虫族化石到${task.destinationPlanetId}`,
          kind: "planet",
          chongTransport: true,
          coordinate: destination,
          oldDistance,
          newDistance,
          value: deliveryValue,
        },
        routeScore: movementGain,
        gain: movementGain,
        cost: movementCost,
        score,
        valueBreakdown: {
          movementGain,
          paymentCost,
          movementCost,
          oldDistance,
          newDistance,
          distanceGain,
          deliveryValue,
          urgencyGain,
          chongTransportOnly: true,
        },
      };
    }

    function scoreAiChongTraceTaskProgressValue(task = {}, player = getCurrentPlayer()) {
      if (!task || !player || !task.traceType) return 0;
      const required = Math.max(1, Math.round(aiNumber(task.count || 1)));
      const current = Math.max(0, Math.round(aiNumber(
        chong?.countTraceMarkers?.(alienGameState, player, task.traceType),
      )));
      const missing = Math.max(0, required - current);
      const progressScale = missing <= 0 ? 1 : missing === 1 ? 0.52 : 0.18;
      const panelValue = missing <= 1 ? scoreAiChongPanelUnlockValue(player) * 0.4 : 0;
      return roundAiScore(scoreAiBestChongFossilRewardValue(player) * progressScale + panelValue);
    }

    function scoreAiChongCardTaskChainValue(card, player = getCurrentPlayer()) {
      if (!player || !chong?.isChongCard?.(card) || !chong?.getCardTask) return 0;
      const task = chong.getCardTask(card);
      if (!task) return 0;
      const round = getAiRoundNumber();
      const taskValue = task.kind === "trace"
        ? scoreAiChongTraceTaskProgressValue(task, player)
        : Math.max(
          scoreAiChongTaskRewardValue(task, player),
          scoreAiChongPickupTaskValue(task, player, null, {
            card,
            includePlayCost: false,
          }),
        );
      const scale = task.kind === "transport"
        ? round <= 2 ? 0.72 : round === 3 ? 0.64 : 0.46
        : round <= 2 ? 0.62 : round === 3 ? 0.78 : 0.9;
      return roundAiScore(Math.min(18, Math.max(0, taskValue * scale)));
    }

    function scoreAiAmibaSymbolRewardValue(symbolId, player = getCurrentPlayer()) {
      const reward = amiba?.getSymbolReward?.(symbolId);
      return scoreAiAlienRewardBundle(reward, player);
    }

    function scoreAiAmibaSymbolEntryValue(entry, player = getCurrentPlayer()) {
      if (!entry?.symbolId) return -Infinity;
      const slotId = String(entry.slotId || "");
      const slotTieBreaker = slotId.endsWith("_3") ? 0.25 : 0.1;
      return scoreAiAmibaSymbolRewardValue(entry.symbolId, player) + slotTieBreaker;
    }

    function scoreAiAmibaSingleSymbolChoiceValue(region, player = getCurrentPlayer()) {
      const symbols = amiba?.listSymbolsInRegion?.(alienGameState, region) || [];
      return symbols.reduce((best, entry) => (
        Math.max(best, scoreAiAmibaSymbolEntryValue(entry, player))
      ), 0);
    }

    function scoreAiAmibaRegionRewardValue(region, player = getCurrentPlayer()) {
      const symbols = amiba?.listSymbolsInRegion?.(alienGameState, region) || [];
      return symbols.reduce((total, entry) => (
        total + Math.max(0, scoreAiAmibaSymbolEntryValue(entry, player))
      ), 0);
    }

    function scoreAiAmibaTraceRemovalValue(player = getCurrentPlayer()) {
      if (!amiba?.listPlayerTraceOptions) return 0;
      const alienSlotId = alienGameState.amiba?.revealedSlotId;
      return (amiba.listPlayerTraceOptions(alienGameState, alienSlotId, player) || [])
        .reduce((best, option) => {
          const regionValue = scoreAiAmibaRegionRewardValue(option.region, player);
          const traceLoss = Number(option.position) >= 3 ? 2 : 1;
          return Math.max(best, regionValue - traceLoss);
        }, 0);
    }

    function scoreAiRunezuPlayerSymbolFinalScore(player = getCurrentPlayer()) {
      if (!runezu?.scorePlayerSymbols || !player) return 0;
      return Math.max(0, aiNumber(runezu.scorePlayerSymbols(player)));
    }

    function scoreAiRunezuSymbolFinalGain(symbolId, player = getCurrentPlayer()) {
      if (!runezu?.gainPlayerSymbol || !runezu?.SYMBOL_IDS?.includes(symbolId) || !player) return 0;
      const before = scoreAiRunezuPlayerSymbolFinalScore(player);
      const simulatedPlayer = cloneAiValue(player);
      runezu.gainPlayerSymbol(simulatedPlayer, symbolId);
      return Math.max(0, scoreAiRunezuPlayerSymbolFinalScore(simulatedPlayer) - before);
    }

    function scoreAiRunezuSpendSymbolFinalPenalty(symbolId, player = getCurrentPlayer()) {
      if (!runezu?.spendPlayerSymbol || !runezu?.SYMBOL_IDS?.includes(symbolId) || !player) return 0;
      const before = scoreAiRunezuPlayerSymbolFinalScore(player);
      const simulatedPlayer = cloneAiValue(player);
      if (!runezu.spendPlayerSymbol(simulatedPlayer, symbolId)) return 0;
      const loss = Math.max(0, before - scoreAiRunezuPlayerSymbolFinalScore(simulatedPlayer));
      const round = getAiRoundNumber();
      const weight = round >= FINAL_ROUND_NUMBER ? 0.8 : round >= 3 ? 0.55 : 0.35;
      return loss * weight;
    }

    function scoreAiRunezuFaceRewardValue(position, player = getCurrentPlayer()) {
      return scoreAiAlienRewardBundle(runezu?.getFaceReward?.(position), player);
    }

    function getAiRunezuFaceSymbolEntry(symbolId) {
      if (!symbolId || !runezu?.listFaceSymbolSlots) return null;
      return (runezu.listFaceSymbolSlots(alienGameState) || [])
        .find((entry) => entry?.symbolId === symbolId) || null;
    }

    function scoreAiRunezuSymbolRewardValue(symbolId, player = getCurrentPlayer()) {
      const entry = getAiRunezuFaceSymbolEntry(symbolId);
      if (!entry) return 0;
      return scoreAiRunezuFaceRewardValue(entry.position, player);
    }

    function scoreAiRunezuSymbolBranchValue(branches = [], player = getCurrentPlayer()) {
      return (branches || []).reduce((best, branch) => {
        const symbolIds = branch?.symbolIds || branch || [];
        const value = symbolIds.reduce((total, symbolId) => (
          total + scoreAiRunezuSymbolRewardValue(symbolId, player)
        ), 0);
        return Math.max(best, value);
      }, 0);
    }

    function getAiRunezuPrematureSymbolCardReason(card, playEffects = [], player = getCurrentPlayer()) {
      if (!runezu?.isRunezuCard?.(card)) return null;
      let hasSymbolEffect = false;
      let hasReadySymbolReward = false;
      for (const effect of playEffects || []) {
        if (effect?.type === runezu.EFFECT_TYPES?.SYMBOL_REWARD) {
          hasSymbolEffect = true;
          if (scoreAiRunezuSymbolRewardValue(effect.options?.symbolId, player) > 0) {
            hasReadySymbolReward = true;
          }
        }
        if (effect?.type === runezu.EFFECT_TYPES?.SYMBOL_BRANCH) {
          hasSymbolEffect = true;
          if (scoreAiRunezuSymbolBranchValue(effect.options?.branches || [], player) > 0) {
            hasReadySymbolReward = true;
          }
        }
      }
      const taskBlockedSymbolIds = getAiRunezuBlockedTaskSymbolIds(card, player);
      return (hasSymbolEffect && !hasReadySymbolReward) || taskBlockedSymbolIds.length
        ? "符文族卡牌等待对应 symbol 放入黑圈并具备奖励"
        : null;
    }

    function getAiRunezuTaskPendingSymbolIds(card, player = getCurrentPlayer()) {
      if (!runezu?.isRunezuCard?.(card)) return [];
      const task = card?.runezuTask || runezu?.getCardTask?.(card);
      if (!task || card?.runezuTaskCompleted) return [];
      if (task.kind === "sequential-events") {
        const progress = Array.isArray(card.runezuTaskProgress) ? card.runezuTaskProgress.length : 0;
        const step = (task.steps || [])[progress];
        return step?.symbolId ? [step.symbolId] : [];
      }
      if (task.kind === "three-trace-colors") {
        if (!runezu?.playerHasAllTraceColors?.(alienGameState, player)) return [];
        return (task.rewards || []).filter(Boolean);
      }
      return [];
    }

    function getAiRunezuBlockedTaskSymbolIds(card, player = getCurrentPlayer()) {
      return getAiRunezuTaskPendingSymbolIds(card, player)
        .filter((symbolId) => scoreAiRunezuSymbolRewardValue(symbolId, player) <= 0);
    }

    function scoreAiRunezuSymbolCardSynergy(symbolId, player = getCurrentPlayer(), mappedRewardValue = 0) {
      if (!symbolId || !player) return 0;
      const hand = Array.isArray(player.hand) ? player.hand : [];
      return hand.reduce((total, card) => {
        if (!runezu?.isRunezuCard?.(card)) return total;
        let value = 0;
        const effects = runezu.buildImmediateEffects?.(card) || [];
        for (const effect of effects) {
          if (effect?.type === runezu.EFFECT_TYPES?.SYMBOL_REWARD && effect.options?.symbolId === symbolId) {
            value += 1 + Math.max(0, mappedRewardValue) * 0.45;
          }
          if (effect?.type === runezu.EFFECT_TYPES?.SYMBOL_BRANCH) {
            const branches = effect.options?.branches || [];
            if (branches.some((branch) => (branch.symbolIds || []).includes(symbolId))) {
              value += 0.3 + Math.max(0, mappedRewardValue) * 0.18;
            }
          }
        }
        if (String(card.discardActionCode || "") === String(symbolId).replace("symbol_", "s_")) {
          value += 0.4 + Math.max(0, mappedRewardValue) * 0.22;
        }
        const taskSymbolIds = getAiRunezuTaskPendingSymbolIds(card, player);
        if (taskSymbolIds.includes(symbolId)) {
          value += 1.2 + Math.max(0, mappedRewardValue) * 0.38;
        }
        return total + value;
      }, 0);
    }

    function scoreAiRunezuFaceUnlockValue(position) {
      return ({
        1: 0.4,
        2: 0.4,
        3: 0.4,
        4: 0.9,
        5: 1.5,
        6: 1.5,
        7: 0.9,
      })[Number(position)] || 0;
    }

    function scoreAiRunezuFaceDependencyUnlockValue(position, symbolId, player = getCurrentPlayer()) {
      if (!runezu?.FACE_SYMBOL_POSITIONS || !runezu?.canPlaceFaceSymbol || !runezu?.placePlayerSymbolOnFace || !player) {
        return 0;
      }
      const normalizedPosition = Number(position);
      const beforeOpenPositions = new Set((runezu.FACE_SYMBOL_POSITIONS || [])
        .filter((targetPosition) => runezu.canPlaceFaceSymbol(alienGameState, targetPosition, player)?.ok)
        .map(Number));
      const simulatedAlienState = cloneAiValue(alienGameState);
      const simulatedPlayer = cloneAiValue(player);
      const placement = runezu.placePlayerSymbolOnFace(simulatedAlienState, normalizedPosition, simulatedPlayer, symbolId);
      if (!placement?.ok) return 0;

      const unlockedValue = (runezu.FACE_SYMBOL_POSITIONS || []).reduce((total, targetPosition) => {
        const target = Number(targetPosition);
        if (target === normalizedPosition || beforeOpenPositions.has(target)) return total;
        const check = runezu.canPlaceFaceSymbol(simulatedAlienState, target, simulatedPlayer);
        if (!check?.ok) return total;
        const rewardValue = scoreAiRunezuFaceRewardValue(target, simulatedPlayer);
        const bestFuturePlacement = (check.choices || []).reduce((best, choice) => {
          const futureScore = rewardValue
            + scoreAiRunezuSymbolCardSynergy(choice.symbolId, simulatedPlayer, rewardValue)
            + scoreAiRunezuFaceUnlockValue(target)
            - scoreAiRunezuSpendSymbolFinalPenalty(choice.symbolId, simulatedPlayer);
          return Math.max(best, futureScore);
        }, 0);
        return total + Math.max(0, Math.min(9, bestFuturePlacement)) * 0.62 + 0.9;
      }, 0);
      const round = getAiRoundNumber();
      const roundScale = round <= 2 ? 1 : round === 3 ? 0.9 : 0.62;
      return roundAiScore(Math.max(0, Math.min(11, unlockedValue * roundScale)));
    }

    function scoreAiRunezuFaceSymbolPlacementChoice(position, symbolId, player = getCurrentPlayer()) {
      if (!runezu?.canPlaceFaceSymbol || !runezu?.SYMBOL_IDS?.includes(symbolId) || !player) return -Infinity;
      const check = runezu.canPlaceFaceSymbol(alienGameState, position, player);
      if (!check?.ok || !(check.choices || []).some((choice) => choice.symbolId === symbolId)) return -Infinity;
      const rewardValue = scoreAiRunezuFaceRewardValue(position, player);
      const finalPenalty = scoreAiRunezuSpendSymbolFinalPenalty(symbolId, player);
      const synergy = scoreAiRunezuSymbolCardSynergy(symbolId, player, rewardValue);
      const dependencyUnlockValue = scoreAiRunezuFaceDependencyUnlockValue(position, symbolId, player);
      return roundAiScore(
        rewardValue
          + synergy
          + scoreAiRunezuFaceUnlockValue(position)
          + dependencyUnlockValue
          - finalPenalty,
      );
    }

    function listAiBanrenmaHandCards(player = getCurrentPlayer()) {
      return (player?.hand || []).filter((card) => banrenma?.isBanrenmaCard?.(card));
    }

    function countAiPlayableBanrenmaCards(player = getCurrentPlayer()) {
      if (!player || !players?.canAfford) return 0;
      return listAiBanrenmaHandCards(player)
        .filter((card) => isAiSupportedHandPlayCard(card) && players.canAfford(player, getCardPlayCost(card) || {}))
        .length;
    }

    function scoreAiBanrenmaEnergyIncomeValue(player = getCurrentPlayer(), incomeGain = {}) {
      if (!player || aiNumber(incomeGain?.energy) <= 0) return 0;
      const handCards = listAiBanrenmaHandCards(player)
        .filter((card) => isAiSupportedHandPlayCard(card));
      if (!handCards.length) return 0;
      const playableCards = handCards
        .filter((card) => players?.canAfford?.(player, getCardPlayCost(card) || {}))
        .length;
      const blockedCards = Math.max(0, handCards.length - playableCards);
      const totalEnergyCost = handCards.reduce((total, card) => (
        total + Math.max(0, aiNumber((getCardPlayCost(card) || {}).energy ?? getCardPrice(card)))
      ), 0);
      const resources = player.resources || {};
      const income = player.income || {};
      const round = getAiRoundNumber();
      const energy = Math.max(0, aiNumber(resources.energy));
      const energyIncome = Math.max(0, aiNumber(income.energy));
      const nearTermEnergyDeficit = Math.max(0, Math.min(5, totalEnergyCost) - energy);
      let value = Math.min(12, handCards.length * 2 + playableCards * 0.9 + blockedCards * 2.4);
      value += Math.min(6, nearTermEnergyDeficit * 1.5);
      if (energy <= 1) value += 3.6;
      else if (energy <= 2) value += 1.8;
      if (energyIncome <= 1) value += 4.2;
      else if (energyIncome <= 2) value += 2;
      if (blockedCards > 0 && round <= 3) value += Math.min(5, blockedCards * 1.7);
      if (round <= 2) value *= 1.18;
      if (round >= FINAL_ROUND_NUMBER) value *= 0.35;
      else if (round >= 3) value *= 0.82;
      return roundAiScore(Math.min(24, Math.max(0, value)));
    }

    function scoreAiBanrenmaCardThresholdSetupValue(card, player = getCurrentPlayer()) {
      if (!player || !banrenma?.isBanrenmaCard?.(card)) return 0;
      const conditionEffects = banrenma.buildConditionEffects?.(card) || [];
      if (!conditionEffects.length) return 0;
      const round = getAiRoundNumber();
      const conditionValue = conditionEffects.reduce(
        (total, effect) => total + Math.max(0, scoreAiEffectValue(effect, { player })),
        0,
      );
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      const nextThreshold = getAiNextMissingFinalScoreThreshold(player);
      const crossesNextThreshold = Boolean(
        nextThreshold
        && currentScore < nextThreshold
        && currentScore + (banrenma.SCORE_MARK_DELTA || 15) >= nextThreshold
      );
      const energyCost = Math.max(
        0,
        aiNumber((getCardPlayCost(card) || {}).energy ?? getCardPrice(card)),
      );
      const energyAfterPlay = Math.max(0, aiNumber(player.resources?.energy) - energyCost);
      let setupValue = round <= 2 ? 6.5 : round === 3 ? 4.2 : 1.6;
      let conditionMultiplier = round <= 2 ? 0.72 : round === 3 ? 0.58 : 0.28;

      if (crossesNextThreshold) {
        setupValue += nextThreshold <= 50 ? 4.5 : 3;
        conditionMultiplier += 0.16;
      }
      if (energyAfterPlay <= 0 && round <= 3) setupValue -= 2.2;
      if (round >= FINAL_ROUND_NUMBER) {
        setupValue -= 1.4;
        conditionMultiplier *= 0.55;
      }

      return roundAiScore(Math.max(0, Math.min(18, setupValue + conditionValue * conditionMultiplier)));
    }

    function scoreAiBestRunezuFacePlacementForSymbol(symbolId, player = getCurrentPlayer()) {
      return (runezu?.FACE_SYMBOL_POSITIONS || [])
        .reduce((best, position) => {
          const score = scoreAiRunezuFaceSymbolPlacementChoice(position, symbolId, player);
          return score > best.score ? { position: Number(position), score } : best;
        }, { position: null, score: -Infinity });
    }

    function scoreAiRunezuSymbolGainValue(symbolId, player = getCurrentPlayer()) {
      if (!runezu?.SYMBOL_IDS?.includes(symbolId) || !player) return 0;
      const simulatedPlayer = cloneAiValue(player);
      runezu?.gainPlayerSymbol?.(simulatedPlayer, symbolId);
      const bestPlacement = scoreAiBestRunezuFacePlacementForSymbol(symbolId, simulatedPlayer);
      const finalGain = scoreAiRunezuSymbolFinalGain(symbolId, player);
      const counts = runezu.getPlayerSymbolCounts?.(player) || {};
      const collectionValue = counts[symbolId] > 0 ? 0.35 : 1.15;
      const round = getAiRoundNumber();
      const finalWeight = round >= FINAL_ROUND_NUMBER ? 0.9 : round >= 3 ? 0.65 : 0.42;
      return roundAiScore(
        1
        + collectionValue
        + finalGain * finalWeight
        + Math.max(0, bestPlacement.score) * 0.72,
      );
    }

    function scoreAiRunezuPanelSymbolRewardValue(reward = {}, player = getCurrentPlayer()) {
      if (!reward?.panelSymbol) return 0;
      const slotId = reward.panelSymbolSlotId;
      const entry = slotId ? alienGameState.runezu?.panelSymbolSlots?.[slotId] : null;
      const symbolValue = entry?.symbolId ? scoreAiRunezuSymbolGainValue(entry.symbolId, player) : 2.5;
      return symbolValue + (reward.refillPanelSymbol ? 0.75 : 0);
    }

    function scoreAiRunezuRewardValue(reward = {}, player = getCurrentPlayer()) {
      if (!reward) return 0;
      return scoreAiAlienRewardBundle({
        ...reward,
        panelSymbolValue: scoreAiRunezuPanelSymbolRewardValue(reward, player),
        symbolValue: reward.symbolId ? scoreAiRunezuSymbolGainValue(reward.symbolId, player) : 0,
      }, player);
    }

    function getAiRunezuSourceSymbol(sourceType, sourceId) {
      if (!runezu?.listSourceSymbols || !alienGameState.runezu?.revealInitialized) return null;
      return (runezu.listSourceSymbols(alienGameState) || [])
        .find((entry) => (
          entry?.sourceType === sourceType
          && String(entry.sourceId) === String(sourceId)
          && !entry.claimedByPlayerId
          && !entry.claimedByPlayerColor
        )) || null;
    }

    function scoreAiRunezuSourceSymbolValue(sourceType, sourceId, player = getCurrentPlayer()) {
      const sourceSymbol = getAiRunezuSourceSymbol(sourceType, sourceId);
      return sourceSymbol?.symbolId
        ? scoreAiRunezuSymbolGainValue(sourceSymbol.symbolId, player)
        : 0;
    }

    function getAiAlienTraceRewardForValuation(mode, reward, player = getCurrentPlayer()) {
      if (!reward || typeof reward !== "object") return reward;
      if (mode === "amiba-grid" && reward.region) {
        return {
          ...reward,
          regionValue: scoreAiAmibaRegionRewardValue(reward.region, player),
        };
      }
      if (mode === "runezu-grid") {
        return {
          ...reward,
          panelSymbolValue: scoreAiRunezuPanelSymbolRewardValue(reward, player),
          symbolValue: reward.symbolId ? scoreAiRunezuSymbolGainValue(reward.symbolId, player) : 0,
        };
      }
      return reward;
    }

    function getAiFangzhouUnlockCount(player = getCurrentPlayer()) {
      if (!player || !fangzhou?.getUnlockCount) return 0;
      return Math.max(0, Math.round(aiNumber(fangzhou.getUnlockCount(alienGameState, player))));
    }

    function getAiFangzhouRequiredUnlockForPosition(position) {
      const pos = Math.max(0, Math.round(aiNumber(position)));
      if (pos <= 1) return 0;
      if (pos === 2) return 1;
      if (pos === 3) return 2;
      if (pos >= 4) return 3;
      return 0;
    }

    function countAiFangzhouCard2InHand(player = getCurrentPlayer()) {
      if (!player || !fangzhou?.isFangzhouCard2) return 0;
      return (player.hand || []).filter((card) => fangzhou.isFangzhouCard2(card)).length;
    }

    function scoreAiFangzhouCreditReadiness(player = getCurrentPlayer()) {
      if (!player) return 0;
      const cost = Math.max(1, aiNumber(fangzhou?.CARD2_PLAY_COST?.credits || 2));
      const credits = Math.max(0, aiNumber(player.resources?.credits));
      if (credits >= cost + 1) return 5.2;
      if (credits >= cost) return 4.2;
      const shortfall = cost - credits;
      const creditIncome = Math.max(0, aiNumber(player.income?.credits));
      if (shortfall <= 1) return 1.4 + Math.min(1.4, creditIncome * 0.35);
      return -Math.min(5, 1.8 + shortfall * 1.2);
    }

    function scoreAiFangzhouPlacementPotentialAtUnlockCount(player = getCurrentPlayer(), unlockCount = 0) {
      if (!player || !fangzhou?.isFangzhouRevealedSlot || !fangzhou?.getTraceGrid) return 0;
      const allowedUnlockCount = Math.max(0, Math.round(aiNumber(unlockCount)));
      const candidates = [];
      for (const alienSlotId of aliens.ALIEN_SLOT_IDS || []) {
        if (!fangzhou.isFangzhouRevealedSlot(alienGameState, alienSlotId)) continue;
        const grid = fangzhou.getTraceGrid(alienGameState, alienSlotId);
        for (const traceType of fangzhou.TRACE_TYPES || AI_TRACE_TYPES) {
          for (const rawPosition of fangzhou.TRACE_POSITIONS || []) {
            const position = Number(rawPosition);
            if (getAiFangzhouRequiredUnlockForPosition(position) > allowedUnlockCount) continue;
            if (grid?.[traceType]?.[position]) continue;
            const rawReward = fangzhou.getTraceReward?.(traceType, position);
            const reward = getAiAlienTraceRewardForValuation("fangzhou-grid", rawReward, player);
            const directScore = Math.max(0, aiNumber(reward?.gain?.score));
            const value = scoreAiAlienTraceValue({
              player,
              traceType,
              alienSlotId,
              mode: "fangzhou-grid",
              position,
              reward,
            })
              + scoreAiAlienGridPosition("fangzhou-grid", traceType, position, "")
              + scoreAiPaceValueForDirectScore(directScore, player, {
                baseWeight: getAiRoundNumber() >= 3 ? 0.55 : 0.28,
                pressureWeight: getAiRoundNumber() >= 3 ? 0.22 : 0.12,
              });
            candidates.push(value);
          }
        }
      }
      candidates.sort((left, right) => right - left);
      return roundAiScore(Math.max(0, aiNumber(candidates[0])) + Math.max(0, aiNumber(candidates[1])) * 0.35);
    }

    function scoreAiFangzhouUnlockChoiceValue(player = getCurrentPlayer(), traceType = null) {
      if (!player || !fangzhou?.canUnlockCard2ForTrace) return 0;
      if (traceType && !fangzhou.canUnlockCard2ForTrace(alienGameState, player, traceType)) return -Infinity;
      const unlockCount = getAiFangzhouUnlockCount(player);
      if (unlockCount >= 3) return 0;
      const nextUnlockCount = Math.min(3, unlockCount + 1);
      const currentPotential = scoreAiFangzhouPlacementPotentialAtUnlockCount(player, unlockCount);
      const nextPotential = scoreAiFangzhouPlacementPotentialAtUnlockCount(player, nextUnlockCount);
      const openedPlacementValue = Math.max(0, nextPotential - currentPotential);
      const creditReadiness = scoreAiFangzhouCreditReadiness(player);
      const cardBacklog = Math.max(0, countAiFangzhouCard2InHand(player) - 1);
      const round = getAiRoundNumber();
      let value = 0;
      if (unlockCount <= 0) value += 9.5;
      else if (unlockCount === 1) value += 7.2;
      else value += round <= 2 ? 3.4 : 4.8;
      value += openedPlacementValue * (unlockCount <= 1 ? 0.65 : 0.48);
      value += creditReadiness;
      value -= cardBacklog * (creditReadiness < 2 ? 2.2 : 0.8);
      if (round >= FINAL_ROUND_NUMBER && openedPlacementValue < 4) value -= 2;
      return roundAiScore(Math.max(-6, Math.min(24, value)));
    }

    function getAiFangzhouCard1RewardIndexes() {
      if (!fangzhou?.getCard1Effect) return [];
      const fallbackIndexes = [0, 1, 2, 3, 4, 5, 6, 7, 8];
      const state = alienGameState?.fangzhou || {};
      const revealedSinceShuffle = Math.max(0, Math.round(aiNumber(state.card1RevealedSinceShuffle)));
      const threshold = Math.max(1, Math.round(aiNumber(fangzhou.CARD1_RESHUFFLE_THRESHOLD || 5)));
      if (revealedSinceShuffle >= threshold) return fallbackIndexes;
      const deck = Array.isArray(state.card1Deck)
        ? state.card1Deck
          .map((index) => Math.round(Number(index)))
          .filter((index) => fangzhou.getCard1Effect(index, "advanced"))
        : [];
      return deck.length ? deck : fallbackIndexes;
    }

    function getAiSafePositiveScore(callback, fallback = 0) {
      if (typeof callback !== "function") return fallback;
      try {
        const value = callback();
        return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : fallback;
      } catch (_error) {
        return fallback;
      }
    }

    function scoreAiFangzhouCard1EffectValue(effect = {}, player = getCurrentPlayer(), options = {}) {
      if (!effect || typeof effect !== "object") return 0;
      let value = 0;
      const gain = effect.gain || {};
      if (gain && Object.keys(gain).length) {
        value += scoreAiResourceBundle(gain);
        value += scoreAiThresholdPressureForScoreGain(gain.score, player) * 0.7;
        value += scoreAiMidgameResourceContinuationValue(gain, player, { scale: 0.45 });
      }
      const dataCount = Math.max(0, Math.round(aiNumber(effect.dataCount)));
      if (dataCount > 0) {
        value += dataCount * AI_RESOURCE_VALUES.availableData;
        value += scoreAiMidgameResourceContinuationValue({ availableData: dataCount }, player, { scale: 0.55 });
      }
      value += Math.max(0, Math.round(aiNumber(effect.blindDraw))) * AI_RESOURCE_VALUES.handSize;
      if (effect.pickCard) value += 4.2;
      value += Math.max(0, Math.round(aiNumber(effect.additionalPublicScan))) * AI_RESOURCE_VALUES.additionalPublicScan * 2.2;
      if (effect.alienTrace) {
        value += Math.max(7.5, scoreAiFangzhouPlacementPotentialAtUnlockCount(player, getAiFangzhouUnlockCount(player)) * 0.42);
      }
      if (effect.scanAction) {
        const scanScore = getAiSafePositiveScore(() => (
          scanEffects?.buildScanEffectQueue ? scoreAiScanAction(player) : 0
        ));
        value += Math.max(8, scanScore * 0.5 + scoreAiScanPriorityFloor(player) * 0.6);
      }
      const sectorScanCount = Array.isArray(effect.sectorScans) ? effect.sectorScans.length : 0;
      if (sectorScanCount > 0) {
        value += sectorScanCount * 4.1 + scoreAiScanPriorityFloor(player) * 0.35;
      }
      if (effect.extraSectorScan) value += 3.8;
      if (effect.techAction) {
        const bestTechScore = getAiSafePositiveScore(() => (listAiResearchTechCandidates() || [])[0]?.score);
        value += Math.max(8.5, bestTechScore * 0.42);
      }
      if (effect.launchIgnoreLimit) {
        const launchScore = getAiSafePositiveScore(() => scoreAiLaunchAction(player));
        value += Math.max(5, launchScore * 0.45);
      }
      const freeMoves = Math.max(0, Math.round(aiNumber(effect.freeMoves)));
      if (freeMoves > 0) {
        const bestMoveScore = getAiSafePositiveScore(() => (listAiMoveCandidates() || [])[0]?.score);
        value += freeMoves * AI_RESOURCE_VALUES.movement + bestMoveScore * 0.22;
      }
      const cap = Math.max(8, aiNumber(options.cap || 32));
      return roundAiScore(Math.max(0, Math.min(cap, value)));
    }

    function scoreAiFangzhouCard2AdvancedRewardValue(player = getCurrentPlayer()) {
      const indexes = getAiFangzhouCard1RewardIndexes();
      if (!indexes.length) return 16;
      const values = indexes
        .map((index) => fangzhou?.getCard1Effect?.(index, "advanced"))
        .map((effect) => scoreAiFangzhouCard1EffectValue(effect, player, { cap: 34 }))
        .filter((value) => Number.isFinite(Number(value)));
      if (!values.length) return 16;
      const average = values.reduce((total, value) => total + value, 0) / values.length;
      const best = Math.max(...values);
      const creditReadiness = scoreAiFangzhouCreditReadiness(player) * 0.32;
      return roundAiScore(Math.min(34, average * 0.78 + best * 0.22 + creditReadiness));
    }

    function scoreAiBanrenmaTraceTimingValue(mode, reward, player = getCurrentPlayer(), position = null) {
      if (mode !== "banrenma-grid" || !reward || !player) return 0;
      const pos = Number(position);
      const directScore = Math.max(0, aiNumber(reward.gain?.score));
      const payData = Math.max(0, Math.round(aiNumber(reward.payData)));
      const round = getAiRoundNumber();
      let value = 0;

      if (reward.pickAlienCard) {
        value += round <= 2 ? 4 : round === 3 ? 2.5 : 1;
      }

      if (pos === 2 && payData >= 3 && directScore >= 15) {
        const techCounts = getAiPlayerTechTypeCounts(player);
        const blueTechCount = Math.max(0, aiNumber(techCounts.blue));
        const threshold = getAiNextMissingFinalScoreThreshold(player);
        const currentScore = Math.max(0, aiNumber(player.resources?.score));
        const crossesThreshold = Boolean(threshold && currentScore < threshold && currentScore + directScore >= threshold);
        const availableData = getAiAvailableDataTokenCount(player);
        const dataLeftAfterPayment = Math.max(0, availableData - payData);

        if (round <= 2 && !crossesThreshold) value -= 6;
        else if (round === 3 && blueTechCount >= 2 && !crossesThreshold) value -= 5.5;
        else if (round === 3 && blueTechCount <= 0 && !crossesThreshold) value += 3;
        if (blueTechCount >= 2 && !crossesThreshold) {
          value -= Math.min(16, 5 + (blueTechCount - 2) * 5);
        }
        if (round <= 3 && blueTechCount >= 3 && !crossesThreshold) value -= 18;
        if (dataLeftAfterPayment <= 1 && round <= 3 && !crossesThreshold) value -= 5.5;
        if (round >= FINAL_ROUND_NUMBER || crossesThreshold) value += crossesThreshold ? 9 : 4;
        if (round >= FINAL_ROUND_NUMBER && blueTechCount >= 3 && !crossesThreshold) value -= 1.5;
      }

      return value;
    }

    function scoreAiAomomoTraceTimingValue(mode, reward, player = getCurrentPlayer(), position = null) {
      if (mode !== "aomomo-grid" || !reward || !player) return 0;
      const pos = Number(position);
      const gain = reward.gain || {};
      const fossilGain = Math.max(0, Math.round(aiNumber(gain.aomomoFossils)));
      const fossilCost = Math.max(0, Math.round(aiNumber(reward.payFossils)));
      const directScore = Math.max(0, aiNumber(gain.score));
      const threshold = getAiNextMissingFinalScoreThreshold(player);
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      const crossesThreshold = Boolean(threshold && currentScore < threshold && currentScore + directScore >= threshold);
      const round = getAiRoundNumber();
      let value = 0;

      value += scoreAiAomomoFossilPlanBonus(fossilGain, player);
      value -= scoreAiAomomoFossilSpendPlanPenalty(fossilCost, player, { directScore, crossesThreshold });

      if ((pos === 2 || pos === 4) && fossilGain > 0) {
        value += pos === 4 ? 1.2 : 0.8;
      }

      if (pos === 5 && directScore >= 20) {
        value += round >= 3 ? 8 : 3.5;
        if (crossesThreshold) value += threshold <= 50 ? 8 : 6;
      }

      if (pos === 1 && fossilCost > 0 && directScore <= 6 && !crossesThreshold) {
        const fossils = getAiAomomoFossilCount(player);
        value -= fossils <= 4 && round <= 3 ? 3.5 : 1;
      }

      return roundAiScore(Math.max(-10, Math.min(18, value)));
    }

    function getAiYichangdianAnomalyForTraceType(traceType) {
      if (!traceType || !yichangdian?.getAnomalyReward) return null;
      return (alienGameState?.yichangdian?.anomalies || []).find((anomaly) => {
        if (anomaly?.traceType === traceType) return true;
        const reward = yichangdian.getAnomalyReward(anomaly?.markerId);
        return reward?.traceType === traceType;
      }) || null;
    }

    function getAiYichangdianAnomalyTriggerDistance(anomaly) {
      const earth = getEarthSectorCoordinate?.();
      if (!anomaly || !earth || typeof solar?.mod8 !== "function") return 4;
      return solar.mod8(aiNumber(earth.x) - aiNumber(anomaly.sectorX)) || 8;
    }

    function scoreAiYichangdianAnomalyRewardValue(anomaly, player = getCurrentPlayer()) {
      const reward = anomaly ? yichangdian?.getAnomalyReward?.(anomaly.markerId) : null;
      if (!reward) return 0;
      let value = scoreAiAlienRewardBundle(reward, player);
      if (reward.pickCard) value += scoreAiMidgameResourceContinuationValue({ handSize: 1 }, player, { scale: 0.35 });
      return roundAiScore(Math.max(0, Math.min(16, value)));
    }

    function scoreAiYichangdianNextAnomalyRewardValue(player = getCurrentPlayer()) {
      if (!yichangdian?.getNextAnomalySectorX || !yichangdian?.getAnomalyBySectorX) return 0;
      const earth = getEarthSectorCoordinate?.();
      if (!earth || !alienGameState?.yichangdian?.revealInitialized) return 0;
      const nextSectorX = yichangdian.getNextAnomalySectorX(alienGameState, earth.x);
      const anomaly = nextSectorX == null ? null : yichangdian.getAnomalyBySectorX(alienGameState, nextSectorX);
      return scoreAiYichangdianAnomalyRewardValue(anomaly, player);
    }

    function scoreAiYichangdianNextAnomalyScanValue(player = getCurrentPlayer()) {
      if (!yichangdian?.getNextAnomalySectorX) return 0;
      const earth = getEarthSectorCoordinate?.();
      if (!earth || !alienGameState?.yichangdian?.revealInitialized) return 0;
      const nextSectorX = yichangdian.getNextAnomalySectorX(alienGameState, earth.x);
      if (nextSectorX == null) return 0;
      const nebula = solar?.getNebulaAtCoordinate?.(nextSectorX, 5, solarState?.sectorBySlot);
      const nebulaId = nebula?.id || null;
      if (nebulaId && sectorXHasAvailableScanTarget?.(nextSectorX)) {
        const targetScore = scoreAiNebulaScanChoice({ nebulaId }, { player });
        return 4.5 + (Number.isFinite(Number(targetScore)) ? targetScore * 0.28 : 0);
      }
      return 3.2 + scoreAiScanPriorityFloor(player) * 0.25;
    }

    function countAiYichangdianAnomalySignals() {
      if (!yichangdian || !solar?.getNebulaAtCoordinate) return 0;
      return (alienGameState?.yichangdian?.anomalies || []).reduce((total, anomaly) => {
        const nebula = solar.getNebulaAtCoordinate(anomaly.sectorX, 5, solarState?.sectorBySlot);
        const tokens = nebulaDataState?.nebulae?.[nebula?.id]?.tokens || [];
        return total + tokens.filter((token) => token?.replacedByPlayerColor || token?.playerColor).length;
      }, 0);
    }

    function getAiYichangdianTopTraceEntry(alienSlotId, traceType) {
      if (!yichangdian?.getTopTraceEntry || alienSlotId == null || !traceType) return null;
      return yichangdian.getTopTraceEntry(alienGameState, alienSlotId, traceType);
    }

    function canAiYichangdianTraceBecomeTop(position, topEntry) {
      const pos = Math.max(0, Math.round(aiNumber(position)));
      if (pos === 1) return true;
      if (!topEntry) return true;
      return pos > 0 && pos < Math.max(1, Math.round(aiNumber(topEntry.position)));
    }

    function scoreAiYichangdianTraceTimingValue(mode, reward, player = getCurrentPlayer(), position = null, traceType = null, alienSlotId = null) {
      if (mode !== "yichangdian-grid" || !player || !traceType) return 0;
      const anomaly = getAiYichangdianAnomalyForTraceType(traceType);
      if (!anomaly) return 0;

      const rewardValue = scoreAiYichangdianAnomalyRewardValue(anomaly, player);
      if (rewardValue <= 0) return 0;

      const topEntry = getAiYichangdianTopTraceEntry(alienSlotId, traceType);
      const ownsTop = topEntry ? aiAlienTraceEntryBelongsToPlayer(topEntry, player) : false;
      const becomesTop = canAiYichangdianTraceBecomeTop(position, topEntry);
      const distance = getAiYichangdianAnomalyTriggerDistance(anomaly);
      const timingScale = distance <= 1 ? 1.35 : distance <= 3 ? 1 : distance <= 5 ? 0.68 : 0.45;
      const round = getAiRoundNumber();
      let value = 0;

      if (!topEntry) {
        value += rewardValue * timingScale * (round <= 3 ? 0.78 : 0.5);
      } else if (ownsTop) {
        value += rewardValue * timingScale * (Number(position) === 1 ? 0.22 : 0.12);
      } else if (becomesTop) {
        value += 2.2 + rewardValue * timingScale * (round <= 3 ? 0.92 : 0.62);
      } else {
        value -= Math.min(5, 1.4 + rewardValue * 0.32);
      }

      if (distance <= 1 && becomesTop && !ownsTop) value += 2.4;
      if (reward?.pickAlienCard && rewardValue < 5) value += 0.8;
      return roundAiScore(Math.max(-6, Math.min(18, value)));
    }

    function scoreAiYichangdianAlienCardTracePriorityValue(mode, reward, player = getCurrentPlayer(), position = null) {
      if (mode !== "yichangdian-grid" || !reward?.pickAlienCard || !player) return 0;
      const round = getAiRoundNumber();
      if (round >= FINAL_ROUND_NUMBER) return 0;
      const pos = Math.max(0, Math.round(aiNumber(position)));
      const base = round <= 2 ? 5.2 : round === 3 ? 4.2 : 1.5;
      const positionBonus = pos >= 5 ? 1.3 : pos >= 4 ? 0.8 : 0;
      const handCount = Math.max(0, aiNumber(player?.hand?.length ?? player?.resources?.handSize));
      const handPenalty = round >= 4 && handCount >= 6 ? Math.min(1.4, (handCount - 5) * 0.35) : 0;
      const multiplier = Math.max(0.55, getAiAlienCardConversionMultiplier(player));
      return roundAiScore(Math.max(0, Math.min(7, (base + positionBonus) * multiplier - handPenalty)));
    }
    return Object.freeze({
      cloneAiValue,
      getAiAomomoFossilCount,
      getAiAomomoFossilUnitValue,
      scoreAiAomomoFossilPlanBonus,
      scoreAiAomomoFossilSpendPlanPenalty,
      scoreAiAlienRewardBundle,
      scoreAiBestChongFossilRewardValue,
      listAiChongFossilRewardValues,
      scoreAiAverageChongFossilRewardValue,
      hasAiPlayerSeenChongFossil,
      scoreAiExpectedChongPlanetFossilRewardValue,
      scoreAiChongPanelUnlockValue,
      scoreAiChongTaskRewardValue,
      getAiPlanetCoordinateById,
      scoreAiChongTransportDeliveryCost,
      scoreAiChongTransportCompletionValue,
      scoreAiChongTransportMoveUrgency,
      scoreAiChongCardPlayAffordability,
      scoreAiChongPickupTaskValue,
      listAiPlayableChongTransportCards,
      scoreAiChongPickupRouteValue,
      getAiChongTaskForEffect,
      isAiChongPickupTravelChoice,
      listAiChongPickupTravelChoices,
      scoreAiChongTravelChoiceBonus,
      scoreAiChongTravelEffectPlanetValue,
      scoreAiChongTravelEffectImmediateValue,
      isAiChongFossilToken,
      getAiChongTransportTaskForRocket,
      getAiChongTransportDeliveryRouteTarget,
      buildAiChongTransportMoveCandidate,
      scoreAiChongTraceTaskProgressValue,
      scoreAiChongCardTaskChainValue,
      scoreAiAmibaSymbolRewardValue,
      scoreAiAmibaSymbolEntryValue,
      scoreAiAmibaSingleSymbolChoiceValue,
      scoreAiAmibaRegionRewardValue,
      scoreAiAmibaTraceRemovalValue,
      scoreAiRunezuPlayerSymbolFinalScore,
      scoreAiRunezuSymbolFinalGain,
      scoreAiRunezuSpendSymbolFinalPenalty,
      scoreAiRunezuFaceRewardValue,
      getAiRunezuFaceSymbolEntry,
      scoreAiRunezuSymbolRewardValue,
      scoreAiRunezuSymbolBranchValue,
      getAiRunezuPrematureSymbolCardReason,
      getAiRunezuTaskPendingSymbolIds,
      getAiRunezuBlockedTaskSymbolIds,
      scoreAiRunezuSymbolCardSynergy,
      scoreAiRunezuFaceUnlockValue,
      scoreAiRunezuFaceDependencyUnlockValue,
      scoreAiRunezuFaceSymbolPlacementChoice,
      listAiBanrenmaHandCards,
      countAiPlayableBanrenmaCards,
      scoreAiBanrenmaEnergyIncomeValue,
      scoreAiBanrenmaCardThresholdSetupValue,
      scoreAiBestRunezuFacePlacementForSymbol,
      scoreAiRunezuSymbolGainValue,
      scoreAiRunezuPanelSymbolRewardValue,
      scoreAiRunezuRewardValue,
      getAiRunezuSourceSymbol,
      scoreAiRunezuSourceSymbolValue,
      getAiAlienTraceRewardForValuation,
      getAiFangzhouUnlockCount,
      getAiFangzhouRequiredUnlockForPosition,
      countAiFangzhouCard2InHand,
      scoreAiFangzhouCreditReadiness,
      scoreAiFangzhouPlacementPotentialAtUnlockCount,
      scoreAiFangzhouUnlockChoiceValue,
      getAiFangzhouCard1RewardIndexes,
      getAiSafePositiveScore,
      scoreAiFangzhouCard1EffectValue,
      scoreAiFangzhouCard2AdvancedRewardValue,
      scoreAiBanrenmaTraceTimingValue,
      scoreAiAomomoTraceTimingValue,
      getAiYichangdianAnomalyForTraceType,
      getAiYichangdianAnomalyTriggerDistance,
      scoreAiYichangdianAnomalyRewardValue,
      scoreAiYichangdianNextAnomalyRewardValue,
      scoreAiYichangdianNextAnomalyScanValue,
      countAiYichangdianAnomalySignals,
      getAiYichangdianTopTraceEntry,
      canAiYichangdianTraceBecomeTop,
      scoreAiYichangdianTraceTimingValue,
      scoreAiYichangdianAlienCardTracePriorityValue,
    });
  }

  return Object.freeze({ createAlienValuation });
});
