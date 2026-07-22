(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAIRoutePlanet = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createRoutePlanet(context = {}) {
    const {
      state,
      solar,
      players,
      rocketActions,
      planetStats,
      planetRewards,
      finalScoring,
      endGameScoring,
      abilities,
      actions,
      scanEffects,
      quickTrades,
      cards,
      cardEffects,
      tech,
      aliens,
      aomomo,
      chong,
      aiRaceModel,
      ai,
      solarState,
      nebulaDataState,
      alienGameState,
      finalScoringState,
      playerState,
      turnState,
      rocketState,
      planetStatsState,
      techGameState,
      DEFAULT_ACTIVE_PLAYER_COUNT,
      FINAL_ROUND_NUMBER,
      AI_MOVE_DIRECTIONS,
      AI_TRACE_TYPES,
      AI_PLANET_OPTIMAL_MOVE_RANGES,
    } = context;
    const addLocationTargets = (...args) => context.addLocationTargets(...args);
    const aiMarkerBelongsToPlayer = (...args) => context.aiMarkerBelongsToPlayer(...args);
    const aiNumber = (...args) => context.aiNumber(...args);
    const canAiResolveAlienTraceEffect = (...args) => context.canAiResolveAlienTraceEffect(...args);
    const canAiResolvePlayCardEffects = (...args) => context.canAiResolvePlayCardEffects(...args);
    const canPayForMove = (...args) => context.canPayForMove(...args);
    const canStartMainAction = (...args) => context.canStartMainAction(...args);
    const countAiFinalMarksForPlayer = (...args) => context.countAiFinalMarksForPlayer(...args);
    const countAiTraceMarkersForPlayer = (...args) => context.countAiTraceMarkersForPlayer(...args);
    const createActionContext = (...args) => context.createActionContext(...args);
    const getAiCardDisplayLabel = (...args) => context.getAiCardDisplayLabel(...args);
    const getAiChongTransportDeliveryRouteTarget = (...args) => context.getAiChongTransportDeliveryRouteTarget(...args);
    const getAiConditionRewardMultiplier = (...args) => context.getAiConditionRewardMultiplier(...args);
    const getAiIndustryCard = (...args) => context.getAiIndustryCard(...args);
    const getAiLiveScorePaceDeficit = (...args) => context.getAiLiveScorePaceDeficit(...args);
    const getAiMapDemand = (...args) => context.getAiMapDemand(...args);
    const getAiNextMissingFinalScoreThreshold = (...args) => context.getAiNextMissingFinalScoreThreshold(...args);
    const getAiPendingLocationTaskRouteCashout = (...args) => context.getAiPendingLocationTaskRouteCashout(...args);
    const getAiPendingNearCompletePlanetTaskRouteCashout = (...args) => context.getAiPendingNearCompletePlanetTaskRouteCashout(...args);
    const getAiPendingPlanetTaskRouteCashout = (...args) => context.getAiPendingPlanetTaskRouteCashout(...args);
    const getAiPlanetCoordinateById = (...args) => context.getAiPlanetCoordinateById(...args);
    const getAiPlayEffectsForCard = (...args) => context.getAiPlayEffectsForCard(...args);
    const getAiPlayerCompanyBaseIncome = (...args) => context.getAiPlayerCompanyBaseIncome(...args);
    const getAiResearchTechDirectScoreGain = (...args) => context.getAiResearchTechDirectScoreGain(...args);
    const getAiResourceValuesForRound = (...args) => context.getAiResourceValuesForRound(...args);
    const getAiRoundNumber = (...args) => context.getAiRoundNumber(...args);
    const getAiRunezuPrematureSymbolCardReason = (...args) => context.getAiRunezuPrematureSymbolCardReason(...args);
    const getAiStrategyDemand = (...args) => context.getAiStrategyDemand(...args);
    const getAiStrategyWeight = (...args) => context.getAiStrategyWeight(...args);
    const getCardPlayCost = (...args) => context.getCardPlayCost(...args);
    const getCurrentActionEffect = (...args) => context.getCurrentActionEffect(...args);
    const getCurrentPlayer = (...args) => context.getCurrentPlayer(...args);
    const getEarthSectorCoordinate = (...args) => context.getEarthSectorCoordinate(...args);
    const getMovableTokensForPlayer = (...args) => context.getMovableTokensForPlayer(...args);
    const getSectorContentForMove = (...args) => context.getSectorContentForMove(...args);
    const hasAiFeasibleRevealedAlienTraceTarget = (...args) => context.hasAiFeasibleRevealedAlienTraceTarget(...args);
    const isAiHiddenFirstTraceColorLost = (...args) => context.isAiHiddenFirstTraceColorLost(...args);
    const isAiIncomeRewardEffect = (...args) => context.isAiIncomeRewardEffect(...args);
    const isAiIndustryHuanyuMoveContext = (...args) => context.isAiIndustryHuanyuMoveContext(...args);
    const isAiResearchTechEffectType = (...args) => context.isAiResearchTechEffectType(...args);
    const isAiSupportedHandPlayCard = (...args) => context.isAiSupportedHandPlayCard(...args);
    const isAsteroidContent = (...args) => context.isAsteroidContent(...args);
    const listAiResearchTechCandidates = (...args) => context.listAiResearchTechCandidates(...args);
    const resourceAmount = (...args) => context.resourceAmount(...args);
    const roundAiScore = (...args) => context.roundAiScore(...args);
    const scoreAiChongPickupRouteValue = (...args) => context.scoreAiChongPickupRouteValue(...args);
    const scoreAiChongTravelChoiceBonus = (...args) => context.scoreAiChongTravelChoiceBonus(...args);
    const scoreAiChongTravelEffectPlanetValue = (...args) => context.scoreAiChongTravelEffectPlanetValue(...args);
    const scoreAiEffectValue = (...args) => context.scoreAiEffectValue(...args);
    const scoreAiIncomeRewardOpportunityValue = (...args) => context.scoreAiIncomeRewardOpportunityValue(...args);
    const scoreAiNoDirectScorePacePenalty = (...args) => context.scoreAiNoDirectScorePacePenalty(...args);
    const scoreAiPaceValueForDirectScore = (...args) => context.scoreAiPaceValueForDirectScore(...args);
    const scoreAiPlayCardRoutePlan = (...args) => context.scoreAiPlayCardRoutePlan(...args);
    const scoreAiResourceBundle = (...args) => context.scoreAiResourceBundle(...args);
    const scoreAiResourceReservePenaltyForCost = (...args) => context.scoreAiResourceReservePenaltyForCost(...args);
    const scoreAiRunezuSourceSymbolValue = (...args) => context.scoreAiRunezuSourceSymbolValue(...args);
    const scoreAiSecondFinalMarkNudgeValue = (...args) => context.scoreAiSecondFinalMarkNudgeValue(...args);
    const scoreAiThirdFinalMarkCashoutValue = (...args) => context.scoreAiThirdFinalMarkCashoutValue(...args);

    function getAiCircularDistanceX(leftX, rightX) {
      const delta = Math.abs(solar.mod8(leftX) - solar.mod8(rightX));
      return Math.min(delta, 8 - delta);
    }

    function getAiSectorDistance(left, right) {
      if (!left || !right) return 99;
      return getAiCircularDistanceX(left.x, right.x) + Math.abs(aiNumber(left.y) - aiNumber(right.y));
    }

    function getAiPlanetOptimalMoveRange(planetId) {
      const range = AI_PLANET_OPTIMAL_MOVE_RANGES[planetId];
      if (!range) return null;
      return {
        min: Math.max(0, Math.round(aiNumber(range[0]))),
        max: Math.max(0, Math.round(aiNumber(range[1]))),
      };
    }

    function scoreAiPlanetMoveDistanceFit(planetId, distance) {
      const range = getAiPlanetOptimalMoveRange(planetId);
      if (!range) return 0;
      const steps = Math.max(0, Math.round(aiNumber(distance)));
      if (steps === 0) return 0;
      if (steps >= range.min && steps <= range.max) return getAiRoundNumber() <= 2 ? 3.5 : 2;
      if (steps < range.min) return 1;
      return -Math.max(0, steps - range.max) * (getAiRoundNumber() <= 2 ? 3.5 : 2.4);
    }

    function getAiCoordinateDistanceFromEarth(coordinate) {
      if (!coordinate) return null;
      const earth = getEarthSectorCoordinate();
      const dx = getAiCircularDistanceX(coordinate.x, earth.x);
      return dx + Math.abs(Number(coordinate.y) - Number(earth.y));
    }

    function isAiCoordinateAdjacentToEarth(coordinate) {
      if (!coordinate) return false;
      const earth = getEarthSectorCoordinate();
      const dx = getAiCircularDistanceX(coordinate.x, earth.x);
      return (Number(coordinate.y) === Number(earth.y) && dx === 1)
        || (Number(coordinate.x) === Number(earth.x) && Number(coordinate.y) === Number(earth.y) + 1);
    }

    function getAiAdjacentEarthCoordinates() {
      const earth = getEarthSectorCoordinate();
      return [
        { x: solar.mod8(earth.x - 1), y: earth.y, label: "地球左邻" },
        { x: solar.mod8(earth.x + 1), y: earth.y, label: "地球右邻" },
        { x: earth.x, y: earth.y + 1, label: "地球外侧邻位" },
      ].filter((coordinate) => (
        coordinate.y >= rocketActions.SECTOR_RING_MIN
        && coordinate.y <= rocketActions.SECTOR_RING_MAX
      ));
    }

    function sumAiDemandMap(map = {}) {
      return Object.values(map || {}).reduce((total, value) => total + Math.max(0, aiNumber(value)), 0);
    }

    function getAiTotalRouteDemand(demand = {}) {
      return sumAiDemandMap(demand.planetIds)
        + sumAiDemandMap(demand.locationTypes)
        + Math.max(0, aiNumber(demand.distanceFromEarth?.weight));
    }

    function canAiPlanetAcceptOrbit(planetId) {
      if (planetId === "earth") return false;
      if (planetId === aomomo?.PLANET_ID) return Boolean(aomomo?.canAddOrbitMarker?.(alienGameState));
      return planetStats.canAddOrbitMarker(planetStatsState, planetId);
    }

    function canAiPlanetAcceptLanding(planetId, player = getCurrentPlayer()) {
      if (planetId === "earth") return false;
      if (planetId === aomomo?.PLANET_ID) return Boolean(aomomo?.canAddLandingMarker?.(alienGameState));
      if (planetStats.canAddLandingMarker(planetStatsState, planetId)) return true;
      return players.playerOwnsTech(player, "orange4", createActionContext())
        && planetStats.getAvailableSatellitesForLanding(planetStatsState, planetId).length > 0;
    }

    function scoreAiRewardEffects(effects = [], player = getCurrentPlayer()) {
      const usedIncomeCardIndexes = new Set();
      return (effects || []).reduce((total, effect) => {
        if (isAiIncomeRewardEffect(effect)) {
          return total + scoreAiIncomeRewardOpportunityValue(
            player,
            effect?.options || {},
            usedIncomeCardIndexes,
          );
        }
        return total + aiNumber(scoreAiEffectValue(effect, { player }));
      }, 0);
    }

    function scoreAiOrbitRewardValue(planetId, player = getCurrentPlayer()) {
      if (!planetId) return 0;
      const sequence = Math.max(1, planetStats.getPlanetOrbitCount(planetStatsState, planetId) + 1);
      return scoreAiRewardEffects(planetRewards.buildOrbitRewardEffects?.(planetId, sequence) || [], player)
        + scoreAiRunezuSourceSymbolValue("planet", planetId, player);
    }

    function getAiLandRewardEffectsForTarget(planetId, target = { type: "planet" }) {
      if (!planetId || !target) return [];
      if (target.type === "satellite") {
        return planetRewards.buildSatelliteLandRewardEffects?.(target.satelliteId) || [];
      }
      if (planetId === "pluto") {
        return [
          { type: "gain_resources", options: { gain: { score: 11 } } },
          { type: "gain_data", options: { count: 4 } },
          { type: "alien_trace", options: { traceType: "yellow" } },
        ];
      }
      const sequence = Math.max(1, planetStats.getPlanetLandingCount(planetStatsState, planetId) + 1);
      return planetRewards.buildPlanetLandRewardEffects?.(planetId, sequence) || [];
    }

    function getAiCardLandChoicePlanetId(choice, fallbackPlanetId = null) {
      return choice?.planetId
        || choice?.planet?.planetId
        || choice?.target?.planetId
        || fallbackPlanetId
        || null;
    }

    function getAiCardLandChoiceRewardEffects(effect, choice, fallbackPlanetId = null) {
      const planetId = getAiCardLandChoicePlanetId(choice, fallbackPlanetId);
      if (!planetId) return [];
      const target = choice?.target || { type: "planet" };
      const rewardEffects = effect?.options?.grantRewards === false
        ? []
        : [...getAiLandRewardEffectsForTarget(planetId, target)];
      const afterLandRewards = (effect?.options?.afterLandRewards || [])
        .filter((reward) => {
          const planetIds = reward.planetIds || [];
          const planetMatch = !planetIds.length || planetIds.includes(planetId);
          const satelliteMatch = reward.includeSatellites && target.type === "satellite";
          return planetMatch || satelliteMatch;
        })
        .map((reward) => reward.effect)
        .filter(Boolean);
      return [...rewardEffects, ...afterLandRewards];
    }

    function isAiAlienTraceRewardEffect(effect) {
      return effect?.type === planetRewards.EFFECT_TYPES?.ALIEN_TRACE || effect?.type === "alien_trace";
    }

    function canAiResolveCardLandChoice(effect, choice, fallbackPlanetId = null, player = getCurrentPlayer()) {
      const rewardEffects = getAiCardLandChoiceRewardEffects(effect, choice, fallbackPlanetId);
      return !(rewardEffects || []).some((rewardEffect) => !canAiResolveAlienTraceEffect(rewardEffect, player));
    }

    function canAiResolveCardLandEffect(effect, player = getCurrentPlayer()) {
      const options = abilities.planet.getLandOptions(createActionContext(), effect?.options || {});
      if (!options.ok) return { ok: false, message: options.message || "当前不能登陆" };
      const choices = options.choices || [];
      if (!choices.length) return { ok: false, message: "当前没有可选登陆目标" };
      const fallbackPlanetId = options.planet?.planetId || null;
      if (!choices.some((choice) => canAiResolveCardLandChoice(effect, choice, fallbackPlanetId, player))) {
        return { ok: false, message: "登陆奖励没有安全的外星人痕迹目标" };
      }
      return { ok: true };
    }

    function scoreAiLandRewardValueForTarget(planetId, target = { type: "planet" }, player = getCurrentPlayer()) {
      const effects = getAiLandRewardEffectsForTarget(planetId, target);
      return (Array.isArray(effects) ? scoreAiRewardEffects(effects, player) : 0)
        + scoreAiRunezuSourceSymbolValue("planet", planetId, player);
    }

    function scoreAiLandResolvedRewardValueForTarget(planetId, target = { type: "planet" }, player = getCurrentPlayer()) {
      const effects = getAiLandRewardEffectsForTarget(planetId, target);
      const sourceSymbolValue = scoreAiRunezuSourceSymbolValue("planet", planetId, player);
      if (!Array.isArray(effects)) return sourceSymbolValue;
      return scoreAiRewardEffects(
        effects.filter((effect) => !isAiAlienTraceRewardEffect(effect) || canAiResolveAlienTraceEffect(effect, player)),
        player,
      ) + sourceSymbolValue;
    }

    function getAiRewardTraceTypes(effects = []) {
      const types = new Set();
      for (const effect of effects || []) {
        const type = effect?.type;
        if (type !== planetRewards.EFFECT_TYPES?.ALIEN_TRACE && type !== "alien_trace") continue;
        const options = effect.options || {};
        if (Array.isArray(options.traceTypes)) {
          for (const traceType of options.traceTypes) {
            if (traceType) types.add(String(traceType));
          }
        }
        if (options.traceType) types.add(String(options.traceType));
      }
      return [...types];
    }

    function scoreAiDeferredAlienTraceRewardPenalty(effects = [], player = getCurrentPlayer()) {
      if (!player) return 0;
      let penalty = 0;
      for (const effect of effects || []) {
        if (!isAiAlienTraceRewardEffect(effect) || canAiResolveAlienTraceEffect(effect, player)) continue;
        const traceTypes = getAiRewardTraceTypes([effect]);
        const hasLostFirstTraceColor = traceTypes.some((traceType) => isAiHiddenFirstTraceColorLost(traceType, player));
        const hasRevealedTarget = traceTypes.some((traceType) => (
          Object.entries(alienGameState?.aliens || {}).some(([alienSlotId, slot]) => (
            slot?.revealed
            && slot?.alienId
            && hasAiFeasibleRevealedAlienTraceTarget(Number(alienSlotId), [traceType], player)
          ))
        ));
        penalty += hasLostFirstTraceColor ? 10 : 6;
        if (!hasRevealedTarget) penalty += 3;
      }
      return penalty;
    }

    function getAiFirstTraceCompetition(player = getCurrentPlayer()) {
      const firstTrace = AI_TRACE_TYPES.reduce((result, traceType) => {
        result[traceType] = { open: 0, own: 0, takenByOthers: 0, revealed: 0 };
        return result;
      }, {});
      for (const slot of Object.values(alienGameState?.aliens || {})) {
        if (!slot) continue;
        for (const traceType of AI_TRACE_TYPES) {
          const entry = firstTrace[traceType];
          if (slot.revealed) {
            entry.revealed += 1;
            continue;
          }
          const traceSlot = slot.traces?.[traceType];
          if (!traceSlot?.firstPlaced) {
            entry.open += 1;
          } else if (aiMarkerBelongsToPlayer(traceSlot, player)) {
            entry.own += 1;
          } else {
            entry.takenByOthers += 1;
          }
        }
      }
      return firstTrace;
    }

    function getAiPrecedingOpponentIds(player = getCurrentPlayer()) {
      const activeIds = Array.isArray(turnState.activePlayerIds) && turnState.activePlayerIds.length
        ? turnState.activePlayerIds
        : (playerState.players || []).map((entry) => entry.id).filter(Boolean);
      const index = activeIds.findIndex((playerId) => String(playerId) === String(player?.id));
      if (index >= 0) return activeIds.slice(0, index).filter((playerId) => String(playerId) !== String(player?.id));
      return activeIds.filter((playerId) => String(playerId) !== String(player?.id));
    }

    function getAiPostActionWindowOpponentIds(player = getCurrentPlayer()) {
      const raceModel = aiRaceModel || ai?.raceModel;
      if (!player?.id || !raceModel?.buildActionWindowOrder) return [];
      const completedPlayerIds = [...(turnState.completedTurnPlayerIds || [])];
      if (!completedPlayerIds.some((playerId) => String(playerId) === String(player.id))) {
        completedPlayerIds.push(player.id);
      }
      return raceModel.buildActionWindowOrder({
        ...turnState,
        completedTurnPlayerIds: completedPlayerIds,
      }, player.id);
    }

    function estimateAiSatelliteClaimEta(distance, options = {}) {
      const normalizedDistance = Math.max(0, Math.round(aiNumber(distance)));
      if (options.immediate === true && normalizedDistance <= 0) return 0;
      return Math.max(1, normalizedDistance)
        + Math.max(0, Math.round(aiNumber(options.techSetupActions)))
        + Math.max(0, Math.round(aiNumber(options.resourceSetupActions)));
    }

    function getAiImmediateEnergyTradeCapacity(player) {
      if (!player || !quickTrades?.getTradeAction) return 0;
      const resources = player.resources || {};
      const resourceAmount = (key) => {
        if (key === "handSize") {
          return Math.max(0, Math.round(aiNumber(resources.handSize ?? (player.hand || []).length)));
        }
        return Math.max(0, aiNumber(resources[key]));
      };
      return ["cards-for-energy", "credits-for-energy"].reduce((total, tradeId) => {
        const trade = quickTrades.getTradeAction(tradeId);
        const energyGain = Math.max(0, aiNumber(trade?.gain?.energy));
        const costs = Object.entries(trade?.cost || {})
          .filter(([, amount]) => aiNumber(amount) > 0);
        if (!trade || energyGain <= 0 || !costs.length || !players.canAfford(player, trade.cost)) {
          return total;
        }
        const repetitions = costs.reduce((limit, [key, amount]) => Math.min(
          limit,
          Math.floor(resourceAmount(key) / Math.max(1, aiNumber(amount))),
        ), Infinity);
        if (!Number.isFinite(repetitions) || repetitions <= 0) return total;
        return total + repetitions * energyGain;
      }, 0);
    }

    function buildAiSatelliteRaceDiagnostics(player, ownDistance, options = {}, opponentEtas = []) {
      const raceModel = aiRaceModel || ai?.raceModel;
      const actionWindowOpponentIds = getAiPostActionWindowOpponentIds(player);
      const actorEta = estimateAiSatelliteClaimEta(ownDistance, {
        immediate: options.immediate === true,
      });
      const eligibleOpponentEtas = (opponentEtas || [])
        .filter((entry) => entry?.actsBeforeActorNext !== false)
        .map((entry) => ({ ...entry }));
      const outcome = raceModel?.estimateRaceOutcome?.({
        actorEta,
        opponentEtas: eligibleOpponentEtas,
        reusableValue: 0,
        exclusiveValue: 1,
        fallbackValue: 0,
      }) || null;
      return {
        actionWindowOpponentIds,
        actorEta,
        opponentEtas: (opponentEtas || []).map((entry) => ({ ...entry })),
        estimatedRaceOutcome: outcome?.outcome || null,
        estimatedFastestOpponentEta: Number.isFinite(outcome?.fastestOpponentEta)
          ? outcome.fastestOpponentEta
          : null,
        etaBasis: "public-action-windows-with-final-move-and-land",
      };
    }

    function getAiApproxLandEnergyCostForPlayer(player, planetId) {
      if (!planetId) return abilities.planet?.BASE_LAND_ENERGY_COST || 3;
      const hasOrbit = planetId === aomomo?.PLANET_ID
        ? aiNumber(aomomo?.countOrbitMarkers?.(alienGameState)) > 0
        : planetStats.getPlanetOrbitCount(planetStatsState, planetId) > 0;
      const orbitDiscount = hasOrbit ? 1 : 0;
      const techDiscount = players.playerOwnsTech(player, "orange3", createActionContext())
        ? (abilities.planet?.ORANGE3_LAND_DISCOUNT || 1)
        : 0;
      return Math.max(0, (abilities.planet?.BASE_LAND_ENERGY_COST || 3) - orbitDiscount - techDiscount);
    }

    function canAiPlayerLandForTraceNow(player, planet, traceType) {
      if (!player || !planet?.planetId || planet.planetId === "earth") return false;
      const energyCost = getAiApproxLandEnergyCostForPlayer(player, planet.planetId);
      if (!players.canAfford(player, energyCost > 0 ? { energy: energyCost } : {})) return false;
      const planetTarget = { type: "planet" };
      if (
        planetStats.canAddLandingMarker(planetStatsState, planet.planetId)
        && getAiRewardTraceTypes(getAiLandRewardEffectsForTarget(planet.planetId, planetTarget)).includes(traceType)
      ) {
        return true;
      }
      if (!players.playerOwnsTech(player, "orange4", createActionContext())) return false;
      return (planetStats.getAvailableSatellitesForLanding?.(planetStatsState, planet.planetId) || [])
        .some((satellite) => getAiRewardTraceTypes(getAiLandRewardEffectsForTarget(planet.planetId, {
          type: "satellite",
          satelliteId: satellite.satelliteId,
        })).includes(traceType));
    }

    function canAiOpponentLandForTraceNow(opponent, traceType) {
      if (!opponent) return false;
      return getMovableTokensForPlayer(opponent.id).some((rocket) => {
        const coordinate = rocketActions.getRocketSectorCoordinate(rocket);
        const planet = getAiPlanetAtCoordinate(coordinate);
        return canAiPlayerLandForTraceNow(opponent, planet, traceType);
      });
    }

    function getAiTraceCompetitionState(player = getCurrentPlayer()) {
      const firstTrace = getAiFirstTraceCompetition(player);
      const yellowLandingPressure = getAiPrecedingOpponentIds(player).reduce((total, playerId) => {
        const opponent = (playerState.players || []).find((entry) => String(entry.id) === String(playerId));
        return total + (canAiOpponentLandForTraceNow(opponent, "yellow") ? 1 : 0);
      }, 0);
      return { firstTrace, yellowLandingPressure };
    }

    function scoreAiHighCostPointConversionPenalty(player = getCurrentPlayer(), options = {}) {
      if (!player || !ai?.valuation?.estimateHighCostPointConversionPenalty) return 0;
      return ai.valuation.estimateHighCostPointConversionPenalty({
        ...options,
        player,
        currentResources: player.resources || {},
        currentScore: player.resources?.score,
        finalMarkCount: countAiFinalMarksForPlayer(player),
        roundNumber: getAiRoundNumber(),
        finalRoundNumber: FINAL_ROUND_NUMBER,
        threshold: getAiNextMissingFinalScoreThreshold(player),
        resourceValues: getAiResourceValuesForRound(),
      });
    }

    function isAiOuterHighScoreSatelliteTarget(planetId, target = {}) {
      return target?.type === "satellite" && (planetId === "uranus" || planetId === "neptune");
    }

    function scoreAiOuterSatelliteCashoutPremium(planetId, target = {}, player = getCurrentPlayer(), options = {}) {
      if (!isAiOuterHighScoreSatelliteTarget(planetId, target) || !player) return 0;
      const directScore = Math.max(0, aiNumber(options.directScore));
      if (directScore < 20) return 0;
      const round = getAiRoundNumber();
      if (round <= 2) return 0;

      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      const threshold = getAiNextMissingFinalScoreThreshold(player);
      const crossesThreshold = Boolean(threshold && currentScore < threshold && currentScore + directScore >= threshold);
      const finalMarks = countAiFinalMarksForPlayer(player);
      const energyShortfall = Math.max(0, Math.round(aiNumber(options.energyShortfall)));
      const routeDistance = options.routeDistance == null
        ? null
        : Math.max(0, Math.round(aiNumber(options.routeDistance)));
      const isCloseRoute = routeDistance == null || routeDistance <= 3;

      if (round === 3) {
        if (!crossesThreshold && energyShortfall > 0 && !isCloseRoute) return 0;
        let premium = 2.2 + Math.max(0, directScore - 18) * 0.34;
        if (crossesThreshold) premium += 5.5;
        if (energyShortfall <= 0) premium += 2.2;
        if (routeDistance != null && routeDistance <= 3) premium += Math.max(0, 3.5 - routeDistance);
        return roundAiScore(Math.min(13, Math.max(0, premium)));
      }

      let premium = 8.5
        + Math.max(0, directScore - 20) * 0.62
        + Math.min(6, getAiLiveScorePaceDeficit(player) * 0.1);
      if (crossesThreshold) premium += 5.5;
      if (finalMarks < 3) premium += 2.5;
      if (energyShortfall <= 0) premium += 2.5;
      else premium -= Math.min(5.5, energyShortfall * 1.8);
      if (routeDistance != null) {
        if (routeDistance <= 3) {
          premium += Math.max(0, 6.25 - routeDistance * 1.35);
          if (directScore >= 25) premium += 1.75;
          if (energyShortfall === 1) premium += 4.5;
          else if (energyShortfall === 2) premium += 2.5;
        }
        else premium -= Math.min(5, (routeDistance - 3) * 1.15);
      }
      if (options.immediate === true) premium += 2;
      return roundAiScore(Math.min(28, Math.max(0, premium)));
    }

    function scoreAiOuterSatelliteRouteApproachPremium(planetId, satelliteOpportunity, player = getCurrentPlayer(), options = {}) {
      if (!satelliteOpportunity || !player) return 0;
      const target = { type: "satellite", satelliteId: satelliteOpportunity.satelliteId };
      if (!isAiOuterHighScoreSatelliteTarget(planetId, target)) return 0;
      const directScore = Math.max(0, aiNumber(satelliteOpportunity.directScore));
      if (directScore < 20) return 0;
      const round = getAiRoundNumber();
      if (round < 3) return 0;
      const newDistance = Math.max(0, Math.round(aiNumber(options.newDistance)));
      if (newDistance <= 0 || newDistance > 3) return 0;
      const oldDistance = options.oldDistance == null
        ? newDistance + 1
        : Math.max(0, Math.round(aiNumber(options.oldDistance)));
      if (oldDistance <= newDistance) return 0;
      const energyShortfall = Math.max(0, Math.round(aiNumber(satelliteOpportunity.energyShortfall)));
      if (round === 3 && energyShortfall > 1) return 0;

      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      const threshold = getAiNextMissingFinalScoreThreshold(player);
      const crossesThreshold = Boolean(threshold && currentScore < threshold && currentScore + directScore >= threshold);
      const distanceGain = Math.max(0, oldDistance - newDistance);
      const finalRound = round >= FINAL_ROUND_NUMBER;
      let premium = finalRound ? 4.8 : 1.6;
      premium += Math.max(0, 4 - newDistance) * (finalRound ? 2.25 : 1.05);
      premium += Math.min(3, distanceGain) * (finalRound ? 1.15 : 0.55);
      premium += Math.max(0, directScore - 20) * (finalRound ? 0.3 : 0.14);
      if (crossesThreshold) premium += finalRound ? 4.5 : 2.5;
      if (countAiFinalMarksForPlayer(player) < 3) premium += finalRound ? 2.2 : 1.1;
      if (energyShortfall <= 0) premium += finalRound ? 2.2 : 1;
      else premium += Math.max(0, 3 - energyShortfall) * (finalRound ? 0.9 : 0.35);
      return roundAiScore(Math.min(finalRound ? 18 : 8, Math.max(0, premium)));
    }

    function canAiOpponentContestSatelliteNow(opponent, planetId) {
      if (!opponent || !planetId || !players.playerOwnsTech(opponent, "orange4", createActionContext())) return false;
      if (!(planetStats.getAvailableSatellitesForLanding?.(planetStatsState, planetId) || []).length) return false;
      const energyCost = getAiApproxLandEnergyCostForPlayer(opponent, planetId);
      if (!players.canAfford(opponent, energyCost > 0 ? { energy: energyCost } : {})) return false;
      return getMovableTokensForPlayer(opponent.id).some((rocket) => {
        const coordinate = rocketActions.getRocketSectorCoordinate(rocket);
        return getAiPlanetAtCoordinate(coordinate)?.planetId === planetId;
      });
    }

    function getAiResearchTechPublicityCostForPlayer(player) {
      return Math.max(
        0,
        aiNumber(
          tech?.resolver?.getResearchPublicityCost?.(player)
            ?? tech?.RESEARCH_PUBLICITY_COST
            ?? 6,
        ),
      );
    }

    function getAiTechTileRemaining(tileId) {
      const stack = tech.getStack?.(techGameState.board, tileId) || null;
      const remaining = Number(stack?.remaining);
      return Number.isFinite(remaining) ? remaining : null;
    }

    function getAiProspectiveOrange4ContestAccess(opponent, options = {}) {
      if (!opponent) return null;
      if (players.playerOwnsTech(opponent, "orange4", createActionContext())) {
        return { ownsOrange4: true, canResearchOrange4: false, publicityShortfall: 0, pressureScale: 1 };
      }
      if (options.includeProspectiveOrange4 !== true) return null;
      if (options.afterCurrentOrange4Take === true) {
        const remaining = getAiTechTileRemaining("orange4");
        if (remaining != null && remaining <= 1) return null;
      }
      createActionContext().ensurePlayerTechState?.(opponent);
      const check = tech?.resolver?.canTakeTile?.(
        techGameState.board,
        opponent.techState,
        "orange4",
        { techTypes: ["orange"] },
      ) || { ok: false };
      if (!check.ok) return null;

      const researchCost = getAiResearchTechPublicityCostForPlayer(opponent);
      const currentPublicity = Math.max(0, aiNumber(opponent.resources?.publicity));
      const nextPublicity = currentPublicity + Math.max(0, aiNumber(opponent.income?.publicity));
      const publicityShortfall = Math.max(0, researchCost - nextPublicity);
      if (publicityShortfall > 2) return null;

      const pressureScale = publicityShortfall <= 0
        ? 0.62
        : publicityShortfall === 1
          ? 0.48
          : 0.34;
      return {
        ownsOrange4: false,
        canResearchOrange4: true,
        publicityShortfall,
        pressureScale,
      };
    }

    function getAiOuterSatelliteContestPressure(planetId, player = getCurrentPlayer()) {
      if (!planetId || !player) return 0;
      return getAiPrecedingOpponentIds(player).reduce((total, playerId) => {
        const opponent = (playerState.players || []).find((entry) => String(entry.id) === String(playerId));
        return total + (canAiOpponentContestSatelliteNow(opponent, planetId) ? 1 : 0);
      }, 0);
    }

    function getAiNearestRocketDistanceToPlanet(player, planetId) {
      if (!player || !planetId) return 99;
      const coordinate = getAiPlanetCoordinateById(planetId);
      if (!coordinate) return 99;
      return getMovableTokensForPlayer(player.id)
        .reduce((best, rocket) => {
          const rocketCoordinate = rocketActions.getRocketSectorCoordinate(rocket);
          if (!rocketCoordinate) return best;
          return Math.min(best, getAiSectorDistance(rocketCoordinate, coordinate));
        }, 99);
    }

    function getAiSatelliteLandingRaceState(planetId, target = {}, player = getCurrentPlayer(), options = {}) {
      if (!planetId || !player || target?.type !== "satellite") {
        return {
          pressure: 0,
          ownDistance: 99,
          closestOpponentDistance: 99,
          fasterOpponentCount: 0,
          prospectiveOrange4Count: 0,
          prospectiveOrange4Pressure: 0,
          ...buildAiSatelliteRaceDiagnostics(player, 99, options),
        };
      }
      const availableSatellites = planetStats.getAvailableSatellitesForLanding?.(planetStatsState, planetId) || [];
      if (!availableSatellites.length) {
        return {
          pressure: 0,
          ownDistance: 99,
          closestOpponentDistance: 99,
          fasterOpponentCount: 0,
          prospectiveOrange4Count: 0,
          prospectiveOrange4Pressure: 0,
          ...buildAiSatelliteRaceDiagnostics(player, 99, options),
        };
      }
      if (target.satelliteId && !availableSatellites.some((satellite) => satellite.satelliteId === target.satelliteId)) {
        return {
          pressure: 0,
          ownDistance: 99,
          closestOpponentDistance: 99,
          fasterOpponentCount: 0,
          prospectiveOrange4Count: 0,
          prospectiveOrange4Pressure: 0,
          ...buildAiSatelliteRaceDiagnostics(player, 99, options),
        };
      }

      const ownDistance = options.routeDistance == null
        ? getAiNearestRocketDistanceToPlanet(player, planetId)
        : Math.max(0, Math.round(aiNumber(options.routeDistance)));
      if (ownDistance <= 0 && options.immediate === true) {
        return {
          pressure: 0,
          ownDistance,
          closestOpponentDistance: 99,
          fasterOpponentCount: 0,
          prospectiveOrange4Count: 0,
          prospectiveOrange4Pressure: 0,
          ...buildAiSatelliteRaceDiagnostics(player, ownDistance, options),
        };
      }

      const activeIds = Array.isArray(turnState.activePlayerIds) && turnState.activePlayerIds.length
        ? turnState.activePlayerIds
        : (playerState.players || []).map((entry) => entry.id).filter(Boolean);
      const activeIdSet = new Set(activeIds.map((playerId) => String(playerId)));
      const precedingIds = new Set(getAiPrecedingOpponentIds(player).map((playerId) => String(playerId)));
      let pressure = 0;
      let closestOpponentDistance = 99;
      let fasterOpponentCount = 0;
      let prospectiveOrange4Count = 0;
      let prospectiveOrange4Pressure = 0;
      const actionWindowOpponentIds = getAiPostActionWindowOpponentIds(player);
      const opponentEtas = [];

      for (const opponent of playerState.players || []) {
        if (!opponent || String(opponent.id) === String(player.id)) continue;
        if (activeIdSet.size && !activeIdSet.has(String(opponent.id))) continue;
        const orange4Access = getAiProspectiveOrange4ContestAccess(opponent, options);
        if (!orange4Access) continue;

        const opponentDistance = getAiNearestRocketDistanceToPlanet(opponent, planetId);
        if (opponentDistance >= 99) continue;
        closestOpponentDistance = Math.min(closestOpponentDistance, opponentDistance);

        const opponentEnergyCost = getAiApproxLandEnergyCostForPlayer(opponent, planetId);
        const opponentEnergyNow = Math.max(0, aiNumber(opponent.resources?.energy));
        const energyShortfall = Math.max(0, opponentEnergyCost - opponentEnergyNow);
        const immediateEnergyTradeCapacity = getAiImmediateEnergyTradeCapacity(opponent);
        const immediateEnergyTradeGain = Math.min(energyShortfall, immediateEnergyTradeCapacity);
        const nextIncomeEnergy = Math.max(0, aiNumber(opponent.income?.energy));
        const futureEnergyShortfall = Math.max(
          0,
          opponentEnergyCost - opponentEnergyNow - immediateEnergyTradeGain - nextIncomeEnergy,
        );
        if (futureEnergyShortfall > 2) continue;

        const isPreceding = precedingIds.has(String(opponent.id));
        const actionWindowIndex = actionWindowOpponentIds
          .findIndex((playerId) => String(playerId) === String(opponent.id));
        const resourceSetupActions = energyShortfall;
        const requiresAdditionalPreparation = energyShortfall > immediateEnergyTradeGain;
        const requiresFutureIncome = requiresAdditionalPreparation && nextIncomeEnergy > 0;
        opponentEtas.push({
          playerId: opponent.id,
          eta: estimateAiSatelliteClaimEta(opponentDistance, {
            techSetupActions: orange4Access.canResearchOrange4 ? 1 : 0,
            resourceSetupActions,
          }),
          distance: opponentDistance,
          actionWindowIndex: actionWindowIndex >= 0 ? actionWindowIndex : null,
          actsBeforeActorNext: actionWindowIndex >= 0,
          ownsOrange4: orange4Access.ownsOrange4,
          prospectiveOrange4: orange4Access.canResearchOrange4,
          publicityShortfall: orange4Access.publicityShortfall,
          landingEnergyShortfall: energyShortfall,
          immediateEnergyTradeGain: roundAiScore(immediateEnergyTradeGain),
          futureEnergyShortfall: roundAiScore(futureEnergyShortfall),
          resourceSetupActions,
          requiresAdditionalPreparation,
          requiresFutureIncome,
        });
        const canLandNow = opponentDistance <= 0
          && players.canAfford(opponent, opponentEnergyCost > 0 ? { energy: opponentEnergyCost } : {});
        let entryPressure = 0;
        if (canLandNow) {
          entryPressure = isPreceding ? 1.55 : 1.05;
        } else if (opponentDistance < ownDistance) {
          fasterOpponentCount += 1;
          entryPressure = (isPreceding ? 1.1 : 0.78)
            + Math.min(0.55, Math.max(0, ownDistance - opponentDistance) * 0.14);
        } else if (opponentDistance === ownDistance && isPreceding) {
          entryPressure = 0.72;
        } else if (ownDistance >= 3 && opponentDistance <= ownDistance + 1 && isPreceding) {
          entryPressure = 0.34;
        }

        if (entryPressure <= 0) continue;
        if (energyShortfall > 0) entryPressure *= Math.max(0.42, 1 - energyShortfall * 0.24);
        if (orange4Access.canResearchOrange4) {
          entryPressure *= orange4Access.pressureScale;
          prospectiveOrange4Count += 1;
          prospectiveOrange4Pressure += entryPressure;
        }
        pressure += entryPressure;
      }

      return {
        pressure: roundAiScore(pressure),
        ownDistance,
        closestOpponentDistance,
        fasterOpponentCount,
        prospectiveOrange4Count,
        prospectiveOrange4Pressure: roundAiScore(prospectiveOrange4Pressure),
        ...buildAiSatelliteRaceDiagnostics(player, ownDistance, options, opponentEtas),
      };
    }

    function scoreAiSatelliteLandingRaceWastePenalty(planetId, target = {}, player = getCurrentPlayer(), options = {}) {
      if (target?.type !== "satellite" || options.immediate === true) return 0;
      const race = options.raceState || getAiSatelliteLandingRaceState(planetId, target, player, options);
      if (race.pressure <= 0) return 0;
      const round = getAiRoundNumber();
      const directScore = Math.max(0, aiNumber(options.directScore));
      const routeDistance = Math.max(0, Math.round(aiNumber(race.ownDistance)));
      const prospectiveOnly = aiNumber(race.prospectiveOrange4Pressure) > 0
        && aiNumber(race.prospectiveOrange4Pressure) >= aiNumber(race.pressure) - 0.001;
      let penalty = race.pressure * (
        prospectiveOnly
          ? (round <= 2 ? 2.25 : round === 3 ? 1.75 : 0.95)
          : (round <= 2 ? 4.2 : round === 3 ? 3.3 : 1.8)
      );
      if (directScore >= 20) {
        penalty += race.pressure * (
          prospectiveOnly
            ? (round <= 3 ? 0.9 : 0.45)
            : (round <= 3 ? 2.4 : 1.2)
        );
      }
      if (routeDistance >= 3) {
        penalty += Math.min(4.5, (routeDistance - 2) * 1.15) * (prospectiveOnly ? 0.35 : 1);
      }
      return roundAiScore(Math.min(18, Math.max(0, penalty)));
    }

    function getAiBestPlayableLaunchCardRoute(player = getCurrentPlayer()) {
      if (!player || !Array.isArray(player.hand) || !player.hand.length) return null;
      const isCurrentPlayer = String(player.id || "") === String(getCurrentPlayer()?.id || "");
      let best = null;
      for (let handIndex = 0; handIndex < player.hand.length; handIndex += 1) {
        const card = player.hand[handIndex];
        if (!isAiSupportedHandPlayCard(card)) continue;
        const cost = getCardPlayCost(card) || {};
        if (!players.canAfford(player, cost)) continue;
        const playEffects = getAiPlayEffectsForCard(card);
        if (!(playEffects || []).some((effect) => effect?.type === "launch")) continue;
        if ((playEffects || []).some((effect) => isAiResearchTechEffectType(effect?.type))) continue;
        if (getAiRunezuPrematureSymbolCardReason(card, playEffects, player)) continue;
        if (isCurrentPlayer) {
          const effectCheck = canAiResolvePlayCardEffects(playEffects, player);
          if (!effectCheck.ok) continue;
        }
        const model = cardEffects.getCardModel?.(card) || null;
        const plan = scoreAiPlayCardRoutePlan(card, model, playEffects, player);
        if (plan?.actionId !== "launch") continue;
        const planScore = Math.max(0, aiNumber(plan.score));
        if (planScore < 3.5) continue;
        const postLaunchMovePlan = plan.postLaunchMovePlan || null;
        const entry = {
          handIndex,
          cardId: card.cardId || card.id || null,
          cardLabel: getAiCardDisplayLabel({ card, cardId: card.cardId || card.id || null }, player),
          planScore,
          postLaunchMoveScore: Math.max(0, aiNumber(plan.postLaunchMoveScore)),
          routeTarget: postLaunchMovePlan?.routeTarget || null,
          to: postLaunchMovePlan?.to || null,
        };
        if (!best || entry.planScore > best.planScore) best = entry;
      }
      return best;
    }

    function getAiOrange4LaunchRouteRaceRelief(rawRacePenalty, launchRoute, planetId) {
      const penalty = Math.max(0, aiNumber(rawRacePenalty));
      if (penalty <= 0 || !launchRoute?.to || !planetId) {
        return { relief: 0, estimatedRouteDistance: 99 };
      }
      const coordinate = getAiPlanetCoordinateById(planetId);
      if (!coordinate) return { relief: 0, estimatedRouteDistance: 99 };
      const launchDistance = getAiSectorDistance(launchRoute.to, coordinate);
      if (!Number.isFinite(Number(launchDistance)) || launchDistance >= 99) {
        return { relief: 0, estimatedRouteDistance: 99 };
      }

      const estimatedRouteDistance = Math.max(0, Math.round(aiNumber(launchDistance))) + 1;
      if (estimatedRouteDistance <= 3) {
        return { relief: 0, estimatedRouteDistance };
      }
      if (estimatedRouteDistance > 6) {
        return { relief: 0, estimatedRouteDistance };
      }
      const routeScale = estimatedRouteDistance <= 5 ? 0.68 : 0.52;
      const roundScale = getAiRoundNumber() <= 2 ? 1 : getAiRoundNumber() === 3 ? 0.85 : 0.65;
      const planScale = Math.min(1, Math.max(0.55, aiNumber(launchRoute.planScore) / 5.2));
      const relief = Math.min(8.2, penalty * routeScale * roundScale * planScale);
      return {
        relief: roundAiScore(Math.max(0, relief)),
        estimatedRouteDistance,
      };
    }

    function scoreAiOuterSatelliteContestRiskPenalty(planetId, target = {}, player = getCurrentPlayer(), options = {}) {
      if (!isAiOuterHighScoreSatelliteTarget(planetId, target)) return 0;
      if (options.immediate === true) return 0;
      const pressure = getAiOuterSatelliteContestPressure(planetId, player);
      const racePenalty = scoreAiSatelliteLandingRaceWastePenalty(planetId, target, player, options);
      if (pressure <= 0 && racePenalty <= 0) return 0;
      const directScore = Math.max(0, aiNumber(options.directScore));
      const round = getAiRoundNumber();
      const base = round <= 2 ? 11 : round === 3 ? 7 : 3.5;
      return Math.min(24, pressure * base + (directScore >= 20 && pressure > 0 ? 4 : 0) + racePenalty);
    }

    function getAiYellowTraceLandCompetitionPenalty(planetId, target = { type: "planet" }, player = getCurrentPlayer()) {
      const traceTypes = getAiRewardTraceTypes(getAiLandRewardEffectsForTarget(planetId, target));
      if (!traceTypes.includes("yellow")) return 0;
      const competition = getAiTraceCompetitionState(player);
      const yellow = competition.firstTrace?.yellow || {};
      if (aiNumber(yellow.revealed) > 0) return 0;
      const open = aiNumber(yellow.open);
      const landingPressure = aiNumber(competition.yellowLandingPressure);
      let penalty = 0;
      if (open <= 0) penalty += 7;
      else if (landingPressure > 0 && open <= landingPressure) penalty += 5 + landingPressure * 2;
      else penalty += landingPressure * 1.5;

      const currentScore = Math.max(0, aiNumber(player?.resources?.score));
      if (getAiRoundNumber() >= 3 && currentScore < 50 && countAiFinalMarksForPlayer(player) < 2) {
        const directScore = getAiLandDirectScoreGainForTarget(planetId, target, player);
        const secondMarkDeficitAfterLand = Math.max(0, 50 - currentScore - directScore);
        if (secondMarkDeficitAfterLand > 0) {
          penalty += Math.min(12, 4 + secondMarkDeficitAfterLand * 0.18);
        }
      }
      return penalty;
    }

    function getAiEffectDirectScore(effect, player = getCurrentPlayer(), options = {}) {
      if (!effect) return 0;
      const type = effect.type;
      const effectOptions = effect.options || {};
      if (type === planetRewards.EFFECT_TYPES?.GAIN_RESOURCES || type === "gain_resources") {
        return Math.max(0, aiNumber(effectOptions.gain?.score));
      }
      if (type === cardEffects.EFFECT_TYPES.COUNT_HAND_INCOME_RESOURCE) {
        if ((effectOptions.resource || "energy") !== "score") return 0;
        const incomeCode = Number(effectOptions.incomeCode);
        const per = Math.max(0, aiNumber(effectOptions.per || 1));
        const count = (player?.hand || [])
          .filter((card) => Number(cards.getIncomeCodeForCard(card)) === incomeCode)
          .length;
        return Math.max(0, Math.round(count * per));
      }
      if (type === cardEffects.EFFECT_TYPES.COUNT_CURRENT_INCOME_RESOURCE) {
        if ((effectOptions.resource || "score") !== "score") return 0;
        const incomeKey = effectOptions.incomeKey || "credits";
        const per = Math.max(0, aiNumber(effectOptions.per || 1));
        const currentIncomeCount = Math.max(0, Math.round(aiNumber(player?.income?.[incomeKey])));
        const companyBaseIncome = getAiPlayerCompanyBaseIncome(player);
        const baseIncomeCount = Math.max(0, Math.round(aiNumber(companyBaseIncome?.[incomeKey])));
        return Math.max(0, Math.round(Math.max(0, currentIncomeCount - baseIncomeCount) * per));
      }
      if (type === cardEffects.EFFECT_TYPES.CONDITIONAL_REWARD) {
        return (effectOptions.rewards || [])
          .reduce((total, reward) => total + getAiEffectDirectScore(reward, player, options), 0)
          * 0.8
          * getAiConditionRewardMultiplier(effectOptions.condition, player, {
            immediate: options.immediate === true,
          }).multiplier;
      }
      if (type === cardEffects.EFFECT_TYPES.CARD_ORBIT) {
        const check = actions.canExecute("orbit", createActionContext());
        return check.ok ? getAiOrbitDirectScoreGain(check.planet?.planetId, player) : 0;
      }
      if (type === cardEffects.EFFECT_TYPES.CARD_LAND || type === "aomomo_land_only") {
        const check = actions.canExecute("land", createActionContext());
        return check.ok ? getAiBestLandDirectScoreGain(check.planet?.planetId, check.choices || [], player) : 0;
      }
      if (type === "research_tech_select" || type === cardEffects.EFFECT_TYPES.RESEARCH_TECH) {
        return getAiResearchTechEffectDirectScore(effect, player, options.workingRoot);
      }
      return 0;
    }

    function getAiRewardDirectScore(effects = [], player = getCurrentPlayer(), options = {}) {
      return (effects || []).reduce((total, effect) => (
        total + getAiEffectDirectScore(effect, player, options)
      ), 0);
    }

    function getAiResearchTechEffectDirectScore(effect, player = getCurrentPlayer(), workingRoot = null) {
      const options = effect?.options || {};
      if (!workingRoot) throw new TypeError("AI tech reward valuation requires explicit workingRoot");
      const candidates = listAiResearchTechCandidates(workingRoot, options);
      if (!candidates.length) return 0;
      return candidates.reduce((best, candidate) => (
        Math.max(best, getAiResearchTechDirectScoreGain(candidate, options, player))
      ), 0);
    }

    function getAiOrbitDirectScoreGain(planetId, player = getCurrentPlayer()) {
      if (!planetId) return 0;
      const sequence = Math.max(1, planetStats.getPlanetOrbitCount(planetStatsState, planetId) + 1);
      return getAiRewardDirectScore(planetRewards.buildOrbitRewardEffects?.(planetId, sequence) || [], player);
    }

    function getAiLandDirectScoreGainForTarget(planetId, target = { type: "planet" }, player = getCurrentPlayer()) {
      if (!planetId || !target) return 0;
      if (target.type === "satellite") {
        return getAiRewardDirectScore(
          planetRewards.buildSatelliteLandRewardEffects?.(target.satelliteId) || [],
          player,
        );
      }
      if (planetId === "pluto") return 11;
      const sequence = Math.max(1, planetStats.getPlanetLandingCount(planetStatsState, planetId) + 1);
      return getAiRewardDirectScore(planetRewards.buildPlanetLandRewardEffects?.(planetId, sequence) || [], player);
    }

    function getAiBestLandDirectScoreGain(planetId, choices = [], player = getCurrentPlayer()) {
      const selected = chooseAiLandChoice(choices || [], player)?.choice || null;
      if (selected) return getAiLandDirectScoreGainForTarget(planetId, selected.target, player);
      return (choices || []).reduce((best, choice) => Math.max(
        best,
        getAiLandDirectScoreGainForTarget(planetId, choice.target, player),
      ), getAiLandDirectScoreGainForTarget(planetId, { type: "planet" }, player));
    }

    function getAiBestSatelliteLandingOpportunity(planetId, player = getCurrentPlayer(), options = {}) {
      if (!planetId || !player) return null;
      const context = createActionContext();
      const canUseSatellites = Boolean(options.assumeOrange4)
        || players.playerOwnsTech(player, "orange4", context);
      if (!canUseSatellites) return null;
      const energyCost = abilities.planet.getLandEnergyCost(context, planetId);
      const availableEnergy = Math.max(0, Math.round(aiNumber(player?.resources?.energy)));
      const energyShortfall = Math.max(0, energyCost - availableEnergy);
      return (planetStats.getAvailableSatellitesForLanding?.(planetStatsState, planetId) || [])
        .map((satellite) => {
          const effects = planetRewards.buildSatelliteLandRewardEffects?.(satellite.satelliteId) || [];
          const rewardValue = scoreAiRewardEffects(effects, player);
          const directScore = getAiRewardDirectScore(effects, player);
          const target = { type: "satellite", satelliteId: satellite.satelliteId };
          const highScorePremium = Math.max(0, directScore - 12) * 0.45;
          const pacePremium = Math.min(6, getAiLiveScorePaceDeficit(player) * (getAiRoundNumber() >= 3 ? 0.13 : 0.05));
          const affordability = energyShortfall <= 0 ? 4 : -Math.min(8, energyShortfall * 2.4);
          const pointConversionPenalty = scoreAiHighCostPointConversionPenalty(player, {
            actionId: "satelliteLand",
            planetId,
            target,
            directScore,
            energyCost,
            highScoreTarget: directScore >= 20,
          });
          const raceWastePenalty = scoreAiSatelliteLandingRaceWastePenalty(planetId, target, player, {
            directScore,
            energyCost,
            energyShortfall,
            immediate: options.immediate === true,
            routeDistance: options.routeDistance,
          });
          const contestRiskPenalty = Math.max(raceWastePenalty, scoreAiOuterSatelliteContestRiskPenalty(planetId, target, player, {
            directScore,
            immediate: options.immediate === true,
            routeDistance: options.routeDistance,
          }));
          const cashoutPremium = scoreAiOuterSatelliteCashoutPremium(planetId, target, player, {
            directScore,
            energyCost,
            energyShortfall,
            immediate: options.immediate === true,
            routeDistance: options.routeDistance,
          });
          return {
            planetId,
            satelliteId: satellite.satelliteId,
            satelliteName: satellite.satelliteName,
            rewardValue,
            directScore,
            energyCost,
            energyShortfall,
            pointConversionPenalty,
            contestRiskPenalty,
            raceWastePenalty,
            cashoutPremium,
            score: rewardValue * 0.55
              + directScore * 0.22
              + highScorePremium
              + pacePremium
              + affordability
              + cashoutPremium
              - pointConversionPenalty
              - contestRiskPenalty,
          };
        })
        .filter((entry) => Number.isFinite(Number(entry.score)) && entry.rewardValue > 0)
        .sort((left, right) => right.score - left.score || right.directScore - left.directScore)[0] || null;
    }

    function buildAiLandChoicesForPlanet(planet, player = getCurrentPlayer()) {
      if (!planet || !player) return [];
      const planetId = planet.planetId;
      const energyCost = abilities.planet.getLandEnergyCost(createActionContext(), planetId);
      const choices = [];
      if (planetStats.canAddLandingMarker(planetStatsState, planetId)) {
        choices.push({
          target: { type: "planet" },
          planetId,
          planet,
          energyCost,
          label: `登陆${planet.name || planetId}`,
        });
      }
      if (players.playerOwnsTech(player, "orange4", createActionContext())) {
        for (const satellite of planetStats.getAvailableSatellitesForLanding?.(planetStatsState, planetId) || []) {
          choices.push({
            target: { type: "satellite", satelliteId: satellite.satelliteId },
            planetId,
            planet,
            energyCost,
            label: `登陆${satellite.satelliteName || satellite.satelliteId}`,
          });
        }
      }
      return choices.filter((choice) => players.canAfford(player, { energy: choice.energyCost }));
    }

    function scoreAiBestSatelliteLandRewardValue(planetId, player = getCurrentPlayer()) {
      if (!planetId || !players.playerOwnsTech(player, "orange4", createActionContext())) return 0;
      return (planetStats.getAvailableSatellitesForLanding?.(planetStatsState, planetId) || [])
        .reduce((best, satellite) => Math.max(
          best,
          scoreAiLandRewardValueForTarget(planetId, {
            type: "satellite",
            satelliteId: satellite.satelliteId,
          }, player),
        ), 0);
    }

    function scoreAiBestLandRewardValueForPlanet(planetId, player = getCurrentPlayer()) {
      const planetRewardValue = scoreAiLandRewardValueForTarget(planetId, { type: "planet" }, player);
      const satelliteOpportunity = getAiBestSatelliteLandingOpportunity(planetId, player);
      const satelliteRewardValue = satelliteOpportunity && aiNumber(satelliteOpportunity.score) > 0
        ? Math.max(
          0,
          aiNumber(satelliteOpportunity.rewardValue)
            - aiNumber(satelliteOpportunity.pointConversionPenalty) * 0.9
            - aiNumber(satelliteOpportunity.contestRiskPenalty) * 1.15,
        )
        : 0;
      return Math.max(
        planetRewardValue,
        satelliteRewardValue,
      );
    }

    function getAiReservedEndGameRules(player = getCurrentPlayer()) {
      return (player?.reservedCards || [])
        .map((card) => cardEffects.getCardModel?.(card)?.endGameScoring || null)
        .filter(Boolean);
    }

    function countAiMainLandingMarkersOnPlanet(player, planetId) {
      const record = planetStatsState?.planets?.[planetId];
      if (!record || !player) return 0;
      return (record.landingMarkers || [])
        .filter((marker) => aiMarkerBelongsToPlayer(marker, player))
        .length;
    }

    function scoreAiFinalTileOrbitLandMarginal(player = getCurrentPlayer()) {
      if (!player || !endGameScoring?.countOrbitOrLandMarkers || !endGameScoring?.countSectorWins) return 0;
      let value = 0;
      finalScoring.ensureFinalScoringState(finalScoringState);
      const currentOrbitLand = endGameScoring.countOrbitOrLandMarkers(player, planetStatsState, createActionContext());
      const sectorWins = endGameScoring.countSectorWins(player, nebulaDataState);
      if (currentOrbitLand >= sectorWins) return 0;
      for (const tile of Object.values(finalScoringState.tiles || {})) {
        const mark = (tile.marks || []).find((entry) => entry.playerId === player.id);
        if (!mark) continue;
        const variant = finalScoring.getTileVariant(finalScoringState, tile.id);
        const formulaId = endGameScoring.getFormulaId(tile.id, variant);
        if (formulaId !== "b2") continue;
        value += endGameScoring.getSlotMultiplier(formulaId, mark.slotIndex) * 0.75;
      }
      return value;
    }

    function scoreAiPlanetMarkerEndGameValue(planetId, player = getCurrentPlayer(), options = {}) {
      if (!planetId || !player) return 0;
      const markerKind = options.markerKind || "orbitOrLand";
      const target = options.target || null;
      let value = scoreAiFinalTileOrbitLandMarginal(player);
      for (const rule of getAiReservedEndGameRules(player)) {
        const scorePer = Math.max(0, aiNumber(rule.scorePer));
        if (!scorePer) continue;
        if (rule.kind === "planetOrbitOrLand" && rule.planetId === planetId) {
          value += scorePer;
        } else if (rule.kind === "allOrbitOrLand") {
          value += scorePer;
        } else if (
          rule.kind === "planetLandingPairs"
          && markerKind === "land"
          && target?.type !== "satellite"
        ) {
          const required = Math.max(1, Math.round(aiNumber(rule.count || 2)));
          const currentLandings = countAiMainLandingMarkersOnPlanet(player, planetId);
          if (currentLandings === required - 1) value += scorePer;
          else if (currentLandings < required - 1) value += scorePer * 0.35;
        }
      }
      return value;
    }

    function scoreAiOrbitChoice(choice, player = getCurrentPlayer(), options = {}) {
      if (!choice) return -Infinity;
      const planetId = choice.planet?.planetId || choice.target?.planetId || null;
      if (!planetId) return -Infinity;
      const demand = getAiStrategyDemand(player);
      const rewardValue = scoreAiOrbitRewardValue(planetId, player);
      const directScoreGain = getAiOrbitDirectScoreGain(planetId, player);
      const taskRouteCashout = getAiPendingPlanetTaskRouteCashout(planetId, player);
      const chongEffect = options.chongEffect || state.pendingLandTargetAction?.effect || getCurrentActionEffect?.() || null;
      const chongBonus = scoreAiChongTravelChoiceBonus(chongEffect, choice, player);
      return 9
        + rewardValue * 0.72
        + directScoreGain * 0.42
        + scoreAiPaceValueForDirectScore(directScoreGain, player, { baseWeight: 0.3, pressureWeight: 0.14 })
        + Math.min(24, aiNumber(taskRouteCashout.value)) * 0.95 * getAiStrategyWeight("task")
        + scoreAiPlanetMarkerEndGameValue(planetId, player, { markerKind: "orbit" }) * getAiStrategyWeight("final")
        + getAiMapDemand(demand.planetIds, planetId) * 0.65 * getAiStrategyWeight("route")
        + getAiMapDemand(demand.actions, "orbit") * 0.26 * getAiStrategyWeight("orbitLand")
        + chongBonus
        - (isAiChongTravelEffect(chongEffect) ? 0 : scoreAiResourceBundle(abilities.planet.DEFAULT_ORBIT_COST) * 0.25);
    }

    function scoreAiLandChoice(choice, player = getCurrentPlayer(), options = {}) {
      if (!choice) return -Infinity;
      if (choice.kind === "orbit") return scoreAiOrbitChoice(choice, player, options);
      const planetId = choice.planet?.planetId || choice.target?.planetId || null;
      const rewardEffects = getAiLandRewardEffectsForTarget(planetId, choice.target);
      const rewardValue = aiNumber(scoreAiLandResolvedRewardValueForTarget(planetId, choice.target, player));
      const energyCost = Math.max(0, aiNumber(choice.energyCost ?? choice.cost?.energy));
      const demand = getAiStrategyDemand(player);
      const planetDemand = getAiMapDemand(demand.planetIds, planetId);
      const taskRouteCashout = getAiPendingPlanetTaskRouteCashout(planetId, player);
      const satelliteBonus = choice.target?.type === "satellite" ? 2 : 0;
      const yellowTracePenalty = getAiYellowTraceLandCompetitionPenalty(planetId, choice.target, player);
      const deferredTracePenalty = scoreAiDeferredAlienTraceRewardPenalty(rewardEffects, player);
      const reservePenalty = scoreAiResourceReservePenaltyForCost(player, { energy: energyCost }, { actionId: "land" });
      const directScoreGain = getAiLandDirectScoreGainForTarget(planetId, choice.target, player);
      const pointConversionPenalty = scoreAiHighCostPointConversionPenalty(player, {
        actionId: "land",
        planetId,
        target: choice.target,
        directScore: directScoreGain,
        energyCost,
        highScoreTarget: choice.target?.type === "satellite" && directScoreGain >= 20,
      });
      const contestRiskPenalty = scoreAiOuterSatelliteContestRiskPenalty(planetId, choice.target, player, {
        directScore: directScoreGain,
        immediate: true,
      });
      const outerSatelliteCashoutPremium = scoreAiOuterSatelliteCashoutPremium(planetId, choice.target, player, {
        directScore: directScoreGain,
        energyCost,
        energyShortfall: 0,
        immediate: true,
        routeDistance: 0,
      });
      const markerValue = aiNumber(scoreAiPlanetMarkerEndGameValue(planetId, player, {
          markerKind: choice.target?.type === "satellite" ? "satellite" : "land",
          target: choice.target,
        }));
      const chongEffect = options.chongEffect || state.pendingLandTargetAction?.effect || getCurrentActionEffect?.() || null;
      const chongBonus = scoreAiChongTravelChoiceBonus(chongEffect, choice, player);
      return rewardValue
        + markerValue * getAiStrategyWeight("final")
        + Math.min(24, aiNumber(taskRouteCashout.value)) * getAiStrategyWeight("task")
        + planetDemand * 0.7 * getAiStrategyWeight("route")
        + getAiMapDemand(demand.actions, "land") * 0.26 * getAiStrategyWeight("orbitLand")
        + satelliteBonus
        + outerSatelliteCashoutPremium
        + chongBonus
        - energyCost * getAiResourceValuesForRound(player).energy * 0.3
        - yellowTracePenalty
        - deferredTracePenalty
        - reservePenalty
        - pointConversionPenalty
        - contestRiskPenalty;
    }

    function chooseAiLandChoice(choices = [], player = getCurrentPlayer()) {
      return (choices || [])
        .map((choice, index) => ({
          choice,
          index,
          score: scoreAiLandChoice(choice, player),
        }))
        .filter((entry) => Number.isFinite(Number(entry.score)))
        .sort((left, right) => right.score - left.score || left.index - right.index)[0] || null;
    }

    function scoreAiPlanetTarget(planet, player = getCurrentPlayer()) {
      if (!planet || planet.planetId === "earth") return 0;
      const context = createActionContext();
      const demand = getAiStrategyDemand(player);
      const planetDemand = getAiMapDemand(demand.planetIds, planet.planetId);
      const taskRouteCashout = getAiPendingPlanetTaskRouteCashout(planet.planetId, player);
      const chongPickupRouteValue = scoreAiChongPickupRouteValue(planet.planetId, player);
      const round = getAiRoundNumber();
      const resources = player?.resources || {};
      let bestRouteDirectScore = 0;
      let bestCashoutDirectScore = 0;
      let value = 0;
      if (canAiPlanetAcceptOrbit(planet.planetId)) {
        const orbitRewardValue = scoreAiOrbitRewardValue(planet.planetId, player);
        const orbitDirectScore = getAiOrbitDirectScoreGain(planet.planetId, player);
        const orbitSequence = Math.max(1, planetStats.getPlanetOrbitCount(planetStatsState, planet.planetId) + 1);
        const canAffordOrbit = players.canAfford(player, abilities.planet.DEFAULT_ORBIT_COST);
        bestRouteDirectScore = Math.max(bestRouteDirectScore, orbitDirectScore);
        if (canAffordOrbit) bestCashoutDirectScore = Math.max(bestCashoutDirectScore, orbitDirectScore);
        value += 9;
        value += orbitRewardValue * (round <= 2 ? 0.5 : 0.28);
        if (orbitSequence === 1) value += round <= 2 ? 7 : 2.5;
        if (canAffordOrbit) value += 3;
        value -= scoreAiResourceReservePenaltyForCost(player, abilities.planet.DEFAULT_ORBIT_COST, { actionId: "orbit" }) * 0.35;
      }
      if (canAiPlanetAcceptLanding(planet.planetId, player)) {
        const landEnergyCost = abilities.planet.getLandEnergyCost(context, planet.planetId);
        const landRewardValue = scoreAiBestLandRewardValueForPlanet(planet.planetId, player);
        const planetLandDirectScore = getAiLandDirectScoreGainForTarget(planet.planetId, { type: "planet" }, player);
        const satelliteOpportunity = getAiBestSatelliteLandingOpportunity(planet.planetId, player);
        const satelliteDirectScore = satelliteOpportunity && aiNumber(satelliteOpportunity.score) > 0
          ? aiNumber(satelliteOpportunity.directScore)
          : 0;
        const bestLandDirectScore = Math.max(planetLandDirectScore, satelliteDirectScore);
        const satelliteTarget = satelliteOpportunity
          ? { type: "satellite", satelliteId: satelliteOpportunity.satelliteId }
          : null;
        const outerSatelliteCashoutPremium = satelliteTarget
          ? scoreAiOuterSatelliteCashoutPremium(planet.planetId, satelliteTarget, player, {
            directScore: satelliteDirectScore,
            energyCost: satelliteOpportunity.energyCost,
            energyShortfall: satelliteOpportunity.energyShortfall,
          })
          : 0;
        const satelliteRoutePenalty = aiNumber(satelliteOpportunity?.pointConversionPenalty) * 0.45
          + aiNumber(satelliteOpportunity?.contestRiskPenalty) * 0.9
          - outerSatelliteCashoutPremium * (round >= FINAL_ROUND_NUMBER ? 0.35 : 0.18);
        const canAffordLand = players.canAfford(player, landEnergyCost > 0 ? { energy: landEnergyCost } : {});
        const energyShortfall = Math.max(0, landEnergyCost - Math.max(0, aiNumber(resources.energy)));
        const landDirectAffordability = canAffordLand ? 1 : Math.max(0.12, 0.55 - energyShortfall * 0.16);
        bestRouteDirectScore = Math.max(bestRouteDirectScore, bestLandDirectScore * landDirectAffordability);
        if (canAffordLand) bestCashoutDirectScore = Math.max(bestCashoutDirectScore, bestLandDirectScore);
        value += 11 - Math.min(4, landEnergyCost);
        value += landRewardValue * (round <= 2 ? 0.52 : 0.42);
        value += outerSatelliteCashoutPremium * (round >= FINAL_ROUND_NUMBER ? 0.65 : 0.38);
        if (canAffordLand) value += 3;
        else value -= Math.min(6, energyShortfall * (round >= 3 ? 2 : 1.4));
        value -= satelliteRoutePenalty;
        value -= getAiYellowTraceLandCompetitionPenalty(planet.planetId, { type: "planet" }, player) * 0.6;
        value -= scoreAiResourceReservePenaltyForCost(player, { energy: landEnergyCost }, { actionId: "land" }) * 0.35;
      }
      if (taskRouteCashout.count > 0) {
        const taskValue = Math.min(24, aiNumber(taskRouteCashout.value));
        value += taskValue * (round <= 2 ? 0.92 : round === 3 ? 1 : 0.74) * getAiStrategyWeight("task");
        bestRouteDirectScore = Math.max(bestRouteDirectScore, aiNumber(taskRouteCashout.directScore));
        bestCashoutDirectScore = Math.max(bestCashoutDirectScore, aiNumber(taskRouteCashout.directScore));
      }
      if (chongPickupRouteValue > 0) {
        value += chongPickupRouteValue
          * (round <= 2 ? 0.95 : round === 3 ? 0.82 : 0.56)
          * getAiStrategyWeight("task");
      }
      const paceDirectScore = bestCashoutDirectScore || bestRouteDirectScore;
      if (paceDirectScore > 0) {
        value += scoreAiPaceValueForDirectScore(paceDirectScore, player, {
          baseWeight: round >= 3 ? 0.58 : round === 2 ? 0.36 : 0.18,
          pressureWeight: round >= 3 ? 0.24 : 0.13,
        });
        value += scoreAiThirdFinalMarkCashoutValue(paceDirectScore, player, {
          weight: 0.65,
        });
        value += scoreAiSecondFinalMarkNudgeValue(paceDirectScore, player, {
          weight: 0.4,
        });
      }
      const noDirectPenalty = scoreAiNoDirectScorePacePenalty(player, {
        cap: round >= 3 ? 12 : 7,
      });
      if (noDirectPenalty > 0) {
        const directCoverage = Math.min(1, paceDirectScore / 4);
        value -= noDirectPenalty * (1 - directCoverage);
      }
      if (planet.planetId === "jupiter" || planet.planetId === "mars") value += 1.5;
      if (planet.planetId === "venus" || planet.planetId === "mercury") value += 1;
      value += scoreAiPlanetMarkerEndGameValue(planet.planetId, player, { markerKind: "orbitOrLand" })
        * 0.9
        * getAiStrategyWeight("final");
      value += planetDemand * 1.1 * getAiStrategyWeight("route");
      value += Math.min(6, (
        getAiMapDemand(demand.actions, "orbit")
        + getAiMapDemand(demand.actions, "land")
      ) * 0.1 * getAiStrategyWeight("orbitLand"));
      const earthDistance = getAiCoordinateDistanceFromEarth(planet);
      if (earthDistance != null) {
        value += scoreAiPlanetMoveDistanceFit(planet.planetId, earthDistance) * 0.6;
      }
      return value;
    }

    function getAiPlanetAtCoordinate(coordinate) {
      if (!coordinate) return null;
      const x = solar.mod8(coordinate.x);
      const y = aiNumber(coordinate.y);
      return solar.createSolarSnapshot(solarState).planetLocations
        .find((planet) => planet.x === x && planet.y === y && planet.planetId !== "earth") || null;
    }

    function isAiAsteroidCoordinate(coordinate) {
      return Boolean(coordinate && isAsteroidContent(getSectorContentForMove(coordinate)));
    }

    function scoreAiMoveArrivalRewardValue(coordinate, player = getCurrentPlayer(), options = {}) {
      if (!coordinate || !player) return 0;
      const content = getSectorContentForMove(coordinate);
      if (!content) return 0;
      let publicityGain = 0;
      if (content.kind === solar.layout.CONTENT_KIND.PLANET && content.planetId !== "earth") {
        publicityGain = 1;
      } else if (content.kind === solar.layout.CONTENT_KIND.COMET) {
        publicityGain = 1;
      } else if (
        content.kind === solar.layout.CONTENT_KIND.ASTEROID
        && players.playerOwnsTech(player, "orange2", createActionContext())
      ) {
        publicityGain = 1;
      }
      if (publicityGain <= 0) return 0;
      const round = getAiRoundNumber();
      const baseScale = round <= 2 ? 0.62 : round === 3 ? 0.5 : 0.42;
      const freeScale = options.free ? 1 : 0.78;
      const asteroidOrange2Bonus = content.kind === solar.layout.CONTENT_KIND.ASTEROID ? 0.85 : 0;
      const resourceValue = scoreAiResourceBundle({ publicity: publicityGain }) * baseScale * freeScale;
      const currentPublicity = Math.max(0, aiNumber(player.resources?.publicity));
      const publicityLimit = players.RESOURCE_LIMITS?.publicity ?? 10;
      const projectedPublicity = Math.min(publicityLimit, currentPublicity + publicityGain);
      const selectionBridge = currentPublicity < 3 && projectedPublicity >= 3
        ? (round <= 2 ? 0.85 : round === 3 ? 1.15 : 1.45)
        : 0;
      return roundAiScore(Math.max(0, resourceValue + selectionBridge * freeScale + asteroidOrange2Bonus));
    }

    function getAiThreeRotationDistanceSwingForPlanet(planetId) {
      if (planetId === "uranus" || planetId === "neptune") return 3;
      if (planetId === "jupiter" || planetId === "saturn") return 2;
      if (planetId === "mars" || planetId === "mercury" || planetId === "venus") return 1;
      return 0;
    }

    function getAiNearestActionablePlanetRoute(coordinate, player = getCurrentPlayer()) {
      if (!coordinate || !player) return null;
      return solar.createSolarSnapshot(solarState).planetLocations
        .filter((planet) => (
          planet?.planetId
          && planet.planetId !== "earth"
          && (canAiPlanetAcceptOrbit(planet.planetId) || canAiPlanetAcceptLanding(planet.planetId, player))
        ))
        .map((planet) => ({
          planetId: planet.planetId,
          planetName: planet.name || planet.planetId,
          distance: getAiSectorDistance(coordinate, planet),
          optimalRange: getAiPlanetOptimalMoveRange(planet.planetId),
        }))
        .filter((entry) => Number.isFinite(Number(entry.distance)))
        .sort((left, right) => left.distance - right.distance)[0] || null;
    }

    function getAiActionablePlanetDistanceWindow(coordinate, player = getCurrentPlayer()) {
      const nearestPlanet = getAiNearestActionablePlanetRoute(coordinate, player);
      const range = nearestPlanet?.optimalRange || null;
      if (!nearestPlanet || !range) {
        return {
          nearestPlanet,
          distance: 99,
          range,
          excess: 0,
          swing: 0,
          waitableExcess: 0,
        };
      }
      const distance = Math.max(0, Math.round(aiNumber(nearestPlanet.distance)));
      const excess = Math.max(0, distance - range.max);
      const swing = getAiThreeRotationDistanceSwingForPlanet(nearestPlanet.planetId);
      return {
        nearestPlanet,
        distance,
        range,
        excess,
        swing,
        waitableExcess: Math.min(excess, Math.max(0, swing)),
      };
    }

    function scoreAiNearestActionablePlanetTimingPenalty(options = {}) {
      const player = options.player || getCurrentPlayer();
      if (!player || !options.to) return 0;
      if (Math.max(0, aiNumber(options.followupScore)) > 0) return 0;
      const toWindow = getAiActionablePlanetDistanceWindow(options.to, player);
      if (!toWindow.nearestPlanet || !toWindow.range || toWindow.excess <= 0) return 0;
      const fromWindow = getAiActionablePlanetDistanceWindow(options.from, player);
      const sameNearestPlanet = fromWindow.nearestPlanet?.planetId === toWindow.nearestPlanet?.planetId;
      const distanceImprovement = sameNearestPlanet
        ? Math.max(0, aiNumber(fromWindow.distance) - aiNumber(toWindow.distance))
        : 0;
      const excessImprovement = sameNearestPlanet
        ? Math.max(0, aiNumber(fromWindow.excess) - aiNumber(toWindow.excess))
        : 0;
      const round = getAiRoundNumber();
      const waitableWeight = round <= 2 ? 2.55 : round === 3 ? 2.05 : 1.45;
      const hardExcessWeight = round <= 2 ? 1.15 : 0.85;
      let penalty = toWindow.waitableExcess * waitableWeight
        + Math.max(0, toWindow.excess - toWindow.swing) * hardExcessWeight;
      if (distanceImprovement <= 0) {
        penalty += 2 + Math.min(6, toWindow.excess * 1.2);
      } else if (excessImprovement > 0) {
        penalty *= 0.48;
      } else {
        penalty *= 0.72;
      }
      if (toWindow.distance >= 4 && distanceImprovement <= 1) {
        penalty += Math.min(6, 1.5 + (toWindow.distance - 3) * 1.15);
      }
      if (isAiIndustryHuanyuMoveContext(options) && toWindow.excess > 0 && distanceImprovement <= 0) {
        penalty += Math.min(7, 2.5 + toWindow.excess * 1.4);
      }
      if (isAiAsteroidCoordinate(options.to) && !players.playerOwnsTech(player, "orange2", createActionContext())) {
        penalty *= 1.25;
      }
      return roundAiScore(Math.min(24, Math.max(0, penalty)));
    }

    function countAiPlayerRocketsOnAsteroids(player = getCurrentPlayer()) {
      if (!player) return 0;
      return (rocketActions.getRocketsForPlayer?.(rocketState, player.id) || [])
        .reduce((total, rocket) => {
          const coordinate = rocketActions.getRocketSectorCoordinate(rocket);
          return total + (isAiAsteroidCoordinate(coordinate) ? 1 : 0);
        }, 0);
    }

    function scoreAiOrange2MobilityNeed(player = getCurrentPlayer()) {
      if (!player || players.playerOwnsTech(player, "orange2", createActionContext())) return 0;
      const demand = getAiStrategyDemand(player);
      const playerRockets = rocketActions.getRocketsForPlayer?.(rocketState, player.id) || [];
      const activeRocketCount = playerRockets.length;
      const asteroidRocketCount = countAiPlayerRocketsOnAsteroids(player);
      const asteroidDemand = getAiMapDemand(demand.locationTypes, "asteroid")
        + getAiMapDemand(demand.locationTypes, "earthAdjacentAsteroid");
      const farPlanetWindowPressure = playerRockets.reduce((total, rocket) => {
        const coordinate = rocketActions.getRocketSectorCoordinate(rocket);
        const window = getAiActionablePlanetDistanceWindow(coordinate, player);
        if (!window.nearestPlanet || window.excess <= 0) return total;
        return total + Math.min(4, window.excess * 0.8 + window.waitableExcess * 0.45);
      }, 0);
      if (activeRocketCount <= 0 && asteroidDemand <= 0) return 0;
      const industryLabel = String(getAiIndustryCard(player)?.label || "");
      const huanyuMovePressure = industryLabel.includes("寰宇超动力")
        ? 5.5
        : industryLabel.includes("寰宇")
          ? 3.5
          : 0;
      return Math.min(
        28,
        asteroidRocketCount * 8.6
          + Math.max(0, activeRocketCount - 1) * 3.25
          + asteroidDemand * 1.25
          + farPlanetWindowPressure
          + huanyuMovePressure,
      );
    }

    function scoreAiHuanyuOrange2FutureMoveValue(candidate, player = getCurrentPlayer()) {
      if (candidate?.tileId !== "orange2" || !player) return 0;
      const industryLabel = String(getAiIndustryCard(player)?.label || "");
      if (!industryLabel.includes("寰宇")) return 0;
      const round = getAiRoundNumber();
      if (round <= 1 || round > FINAL_ROUND_NUMBER) return 0;
      const activeRocketCount = (rocketActions.getRocketsForPlayer?.(rocketState, player.id) || []).length;
      if (activeRocketCount <= 0 || scoreAiOrange2MobilityNeed(player) <= 0) return 0;

      // 每轮两个寰宇节点都只有 1 移动力；橙2会把离开小行星的门槛从 2 降为 1，
      // 同时让进入小行星获得宣传。按尚未结算的节点计未来解锁，不影响已验证的首轮开局科技。
      const currentRoundMoves = player.industryRoundMarkRound === round ? 0 : 2;
      const futureRoundMoves = Math.max(0, FINAL_ROUND_NUMBER - round) * 2;
      const remainingFreeMoves = currentRoundMoves + futureRoundMoves;
      return roundAiScore(Math.min(5.2, remainingFreeMoves * 1.3));
    }

    function isAiLandingEffect(effect) {
      if (!effect?.type) return false;
      return effect.type === cardEffects.EFFECT_TYPES.CARD_LAND
        || effect?.type === "aomomo_land_only"
        || isAiChongTravelEffect(effect);
    }

    function isAiChongPickupPlanetId(planetId) {
      return planetId === "jupiter" || planetId === "saturn";
    }

    function isAiChongTravelEffect(effect) {
      return Boolean(
        chong
        && (
          effect?.type === chong.EFFECT_TYPES?.CHONG_LAND_FOR_PICKUP
          || effect?.type === chong.EFFECT_TYPES?.CHONG_ORBIT_OR_LAND_FOR_PICKUP
        ),
      );
    }

    function getAiNextActionEffect(offset = 1) {
      if (!state.pendingActionEffectFlow) return null;
      const currentIndex = Math.max(0, Math.round(aiNumber(state.pendingActionEffectFlow.currentIndex)));
      return state.pendingActionEffectFlow.effects?.[currentIndex + offset] || null;
    }

    function getAiLandEffectCost(effect, planetId) {
      const options = effect?.options || {};
      if (isAiChongTravelEffect(effect)) return {};
      if (options.skipCost) return {};
      if (options.cost && typeof options.cost === "object" && !Array.isArray(options.cost)) {
        return { ...options.cost };
      }
      return { energy: abilities.planet.getLandEnergyCost(createActionContext(), planetId) };
    }

    function scoreAiLandingAfterMove(coordinate, effect, player = getCurrentPlayer()) {
      if (!isAiLandingEffect(effect)) return { ok: true, score: 0, planet: null };
      const planet = getAiPlanetAtCoordinate(coordinate);
      if (!planet) return { ok: false, score: -Infinity, planet: null };
      if (planet.planetId === aomomo?.PLANET_ID && effect?.type !== "aomomo_land_only") {
        return { ok: false, score: -Infinity, planet };
      }
      if (!canAiPlanetAcceptLanding(planet.planetId, player)) {
        return { ok: false, score: -Infinity, planet };
      }
      const cost = getAiLandEffectCost(effect, planet.planetId);
      if (!players.canAfford(player, cost)) {
        return { ok: false, score: -Infinity, planet };
      }
      const choices = buildAiLandChoicesForPlanet(planet, player);
      const directScoreGain = getAiBestLandDirectScoreGain(planet.planetId, choices, player);
      return {
        ok: true,
        planet,
        directScoreGain,
        score: 14
          + scoreAiPlanetTarget(planet, player)
          + scoreAiChongTravelEffectPlanetValue(effect, planet.planetId, player)
          - scoreAiResourceBundle(cost) * 0.25,
      };
    }

    function getAiDisplayedTurnNumber(rawTurnNumber = turnState.turnNumber) {
      const activePlayerCount = Math.max(
        1,
        (turnState.activePlayerIds || []).length
          || Math.round(Number(turnState.activePlayerCount) || 0)
          || DEFAULT_ACTIVE_PLAYER_COUNT,
      );
      const raw = Math.max(1, Math.round(Number(rawTurnNumber) || 1));
      return Math.floor((raw - 1) / activePlayerCount) + 1;
    }

    function getAiRequiredMovePointsFromCoordinate(player, coordinate, options = {}) {
      if (!coordinate) return 1;
      const fromContent = getSectorContentForMove(coordinate);
      if (!options.ignoreAsteroidRestriction
        && isAsteroidContent(fromContent)
        && !players.playerOwnsTech(player, "orange2", turnState)) {
        return 2;
      }
      return 1;
    }

    function canAiContinueCardMoveAfterStep(rocket, coordinate, remainingMovePoints, effect, player = getCurrentPlayer()) {
      const remaining = Math.max(0, Math.round(aiNumber(remainingMovePoints)));
      if (!rocket || !coordinate || remaining <= 0) return true;

      const simulatedRocketState = structuredClone(rocketState);
      const simulatedRocket = simulatedRocketState.rockets.find((item) => item.id === rocket.id);
      if (!simulatedRocket) return false;
      const sectorX = solar.mod8(coordinate.x);
      const sectorY = Math.min(
        rocketActions.SECTOR_RING_MAX,
        Math.max(rocketActions.SECTOR_RING_MIN, coordinate.y),
      );
      const slotIndex = rocketActions.findAvailableSlotIndex(
        simulatedRocketState,
        sectorX,
        sectorY,
        simulatedRocket.id,
      );
      if (slotIndex == null) return false;
      rocketActions.assignRocketToSlot(simulatedRocket, sectorX, sectorY, slotIndex);

      return AI_MOVE_DIRECTIONS.some((direction) => {
        const moveCheck = rocketActions.canMoveRocket(
          simulatedRocketState,
          simulatedRocket.id,
          direction.deltaX,
          direction.deltaY,
        );
        if (!moveCheck.ok) return false;
        const requiredMovePoints = getAiRequiredMovePointsFromCoordinate(
          player,
          { x: sectorX, y: sectorY },
          effect?.options || {},
        );
        const paymentRequired = Math.max(0, requiredMovePoints - Math.min(remaining, requiredMovePoints));
        return paymentRequired <= 0 || canPayForMove(player, paymentRequired).ok;
      });
    }

    function getAiRouteTargets(player = getCurrentPlayer(), options = {}) {
      const demand = getAiStrategyDemand(player);
      const routeWeight = getAiStrategyWeight("route");
      const targets = solar.createSolarSnapshot(solarState).planetLocations
        .filter((planet) => planet.planetId !== "earth")
        .map((planet) => {
          const satelliteOpportunity = getAiBestSatelliteLandingOpportunity(planet.planetId, player);
          const taskRouteCashout = getAiPendingPlanetTaskRouteCashout(planet.planetId, player);
          const nearCompleteTaskRouteCashout = getAiPendingNearCompletePlanetTaskRouteCashout(planet.planetId, player);
          return {
            id: planet.planetId,
            label: planet.name || planet.planetId,
            kind: "planet",
            coordinate: { x: planet.x, y: planet.y },
            value: scoreAiPlanetTarget(planet, player),
            satelliteOpportunity,
            taskRouteCashout: taskRouteCashout.count > 0 ? taskRouteCashout : null,
            nearCompleteTaskRouteCashout: nearCompleteTaskRouteCashout.count > 0 ? nearCompleteTaskRouteCashout : null,
          };
        })
        .filter((target) => target.value > 0);
      const chongTransportTarget = getAiChongTransportDeliveryRouteTarget(options.rocket, player);
      if (chongTransportTarget?.value > 0) targets.push(chongTransportTarget);
      const groups = solar.collectVisibleCoordinateGroups(solarState);
      const addLocationTargets = (coordinates, locationType, baseValue) => {
        const locationDemand = getAiMapDemand(demand.locationTypes, locationType);
        const taskRouteCashout = getAiPendingLocationTaskRouteCashout(locationType, player);
        if (locationDemand <= 0 && taskRouteCashout.value <= 0) return;
        for (const coordinate of coordinates || []) {
          targets.push({
            id: `${locationType}:${coordinate.x}:${coordinate.y}`,
            label: coordinate.label || coordinate.kindLabel || locationType,
            kind: "probe-location",
            locationType,
            coordinate: { x: coordinate.x, y: coordinate.y },
            value: baseValue
              + locationDemand * 1.15 * routeWeight
              + Math.min(22, aiNumber(taskRouteCashout.value)) * 0.9 * getAiStrategyWeight("task"),
            taskRouteCashout: taskRouteCashout.count > 0 ? taskRouteCashout : null,
          });
        }
      };
      const asteroids = groups.asteroids || [];
      const comets = groups.comets || [];
      addLocationTargets(asteroids, "asteroid", 6);
      addLocationTargets(comets, "comet", 6.5);
      addLocationTargets(getAiAdjacentEarthCoordinates(), "earthAdjacent", 5);
      addLocationTargets(
        asteroids.filter((coordinate) => isAiCoordinateAdjacentToEarth(coordinate)),
        "earthAdjacentAsteroid",
        8,
      );

      const distanceDemand = demand.distanceFromEarth || {};
      const distanceWeight = Math.max(0, aiNumber(distanceDemand.weight));
      const minDistance = Math.max(0, Math.round(aiNumber(distanceDemand.minDistance)));
      if (distanceWeight > 0 && minDistance > 0) {
        for (const coordinate of solar.collectVisibleCoordinateReport(solarState)) {
          const distance = getAiCoordinateDistanceFromEarth(coordinate);
          if (distance == null || distance < minDistance) continue;
          targets.push({
            id: `earth-distance:${coordinate.x}:${coordinate.y}`,
            label: coordinate.label || `距地球 ${distance}`,
            kind: "probe-distance",
            minDistance,
            distanceFromEarth: distance,
            coordinate: { x: coordinate.x, y: coordinate.y },
            value: 4 + Math.min(6, distance * 0.75) + distanceWeight * 1.1 * routeWeight,
          });
        }
      }
      return targets.filter((target) => target.value > 0);
    }

    function scoreAiMoveTowardTargets(from, to, player = getCurrentPlayer(), options = {}) {
      const targets = getAiRouteTargets(player, options);
      if (!from || !to || !targets.length) return { score: 0, target: null };
      const mainActionAlreadyUsed = options.mainActionAlreadyUsed ?? Boolean(state.pendingActionExecuted);
      const round = getAiRoundNumber();
      const urgentCatchup = round === 3 && getAiLiveScorePaceDeficit(player) > 35;
      const indirectTargetMultiplier = round <= 2 ? 0.55 : round === 3 ? 0.38 : 0.28;
      const fromPlanet = getAiPlanetAtCoordinate(from);
      const fromSatelliteOpportunity = fromPlanet
        ? getAiBestSatelliteLandingOpportunity(fromPlanet.planetId, player)
        : null;
      let best = { score: -Infinity, target: null };
      for (const target of targets) {
        const oldDistance = getAiSectorDistance(from, target.coordinate);
        const newDistance = getAiSectorDistance(to, target.coordinate);
        let rotationStagingValue = 0;
        let score = (oldDistance - newDistance) * 4;
        if (newDistance === 0) score += target.value;
        else score += target.value / (newDistance + 1) * indirectTargetMultiplier;
        if (target.kind === "planet") {
          score += scoreAiPlanetMoveDistanceFit(target.id, newDistance);
          const range = getAiPlanetOptimalMoveRange(target.id);
          if (range && oldDistance <= range.max && newDistance > range.max) {
            score -= (newDistance - range.max) * (getAiRoundNumber() <= 2 ? 4 : 2.5);
          }
          if (urgentCatchup && newDistance > 1) {
            score -= Math.min(14, (newDistance - 1) * 7);
            if ((target.id === "uranus" || target.id === "neptune") && oldDistance > 1) score -= 5;
          }
          if (target.satelliteOpportunity && newDistance <= 3) {
            const satelliteTarget = {
              type: "satellite",
              satelliteId: target.satelliteOpportunity.satelliteId,
            };
            const satelliteCashoutPremium = scoreAiOuterSatelliteCashoutPremium(target.id, satelliteTarget, player, {
              directScore: target.satelliteOpportunity.directScore,
              energyCost: target.satelliteOpportunity.energyCost,
              energyShortfall: target.satelliteOpportunity.energyShortfall,
              routeDistance: newDistance,
              immediate: newDistance === 0,
            });
            const satelliteRacePenalty = scoreAiSatelliteLandingRaceWastePenalty(target.id, satelliteTarget, player, {
              directScore: target.satelliteOpportunity.directScore,
              energyCost: target.satelliteOpportunity.energyCost,
              energyShortfall: target.satelliteOpportunity.energyShortfall,
              routeDistance: newDistance,
              immediate: newDistance === 0 && !mainActionAlreadyUsed,
            });
            const distanceScale = newDistance === 0 ? 0.75 : newDistance === 1 ? 0.62 : 0.42;
            score += satelliteCashoutPremium * distanceScale;
            score += scoreAiOuterSatelliteRouteApproachPremium(target.id, target.satelliteOpportunity, player, {
              oldDistance,
              newDistance,
            });
            if (satelliteRacePenalty > 0) {
              const racePenaltyScale = newDistance === 0 ? 0.75 : newDistance === 1 ? 0.65 : 0.45;
              score -= satelliteRacePenalty * racePenaltyScale;
            }
          }
          rotationStagingValue = scoreAiRotationStagingValue({
            ...target,
            oldDistance,
            newDistance,
          }, player, { from, to });
          if (rotationStagingValue > 0) score += rotationStagingValue;
        }
        if (oldDistance === 0 && newDistance > 0) score -= target.value;
        if (
          fromSatelliteOpportunity
          && fromSatelliteOpportunity.directScore >= 13
          && fromPlanet?.planetId
          && target.id !== fromPlanet.planetId
          && getAiSectorDistance(to, { x: from.x, y: from.y }) > 0
        ) {
          score -= Math.min(18, Math.max(0, fromSatelliteOpportunity.score) * 0.5);
        }
        if (mainActionAlreadyUsed) score *= round >= 3 ? 0.42 : 0.52;
        if (score > best.score) best = { score, target: { ...target, oldDistance, newDistance, rotationStagingValue } };
      }
      if (!Number.isFinite(best.score)) return { score: 0, target: null };
      return best;
    }

    function getAiUrgentUncashableRouteScoreCap(routeTarget, canCashOutRoute, player = getCurrentPlayer()) {
      const urgentScorePaceDeficit = getAiRoundNumber() >= 3
        ? getAiLiveScorePaceDeficit(player)
        : 0;
      if (
        urgentScorePaceDeficit <= 30
        || routeTarget?.kind !== "planet"
        || canCashOutRoute
      ) {
        return null;
      }
      const routeTargetDistance = Math.max(0, Math.round(aiNumber(routeTarget?.newDistance)));
      if (routeTargetDistance > 1) return null;
      return routeTargetDistance === 0 ? 7 : 5;
    }

    function getAiFinalInsufficientCashoutRouteAdjustment(routeTarget, followupMainAction, player = getCurrentPlayer()) {
      if (!player || getAiRoundNumber() < FINAL_ROUND_NUMBER) return null;
      const followupActionId = String(followupMainAction?.actionId || "");
      const hasPlanetCashout = routeTarget?.kind === "planet"
        || ((followupActionId === "orbit" || followupActionId === "land") && followupMainAction?.planetId);
      if (!hasPlanetCashout) return null;
      const directScore = Math.max(0, aiNumber(followupMainAction?.directScoreGain));
      if (directScore <= 0) return null;
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      const threshold = currentScore < 25 ? 25 : currentScore < 50 ? 50 : currentScore < 70 ? 70 : null;
      if (!threshold || threshold > 50) return null;
      if (currentScore + directScore >= threshold) return null;
      const distance = Math.max(1, threshold - currentScore);
      const coverage = Math.min(1, directScore / distance);
      return {
        routeScoreCap: Math.max(5, 8 + coverage * 4),
        followupScoreScale: Math.max(0.38, 0.45 + coverage * 0.25),
      };
    }

    function scoreAiFinalUncashableMoveEnergyPenalty(options = {}) {
      const player = options.player || getCurrentPlayer();
      if (!player || getAiRoundNumber() < FINAL_ROUND_NUMBER) return 0;
      const followupScore = Math.max(0, aiNumber(options.followupScore));
      if (followupScore > 0) return 0;
      const energySpent = Math.max(0, Math.round(aiNumber(options.energySpent)));
      const energyAfterMovePayment = Math.max(0, Math.round(aiNumber(options.energyAfterMovePayment)));
      if (energySpent <= 0) return 0;

      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      const nextThreshold = getAiNextMissingFinalScoreThreshold(player);
      if (!nextThreshold || currentScore >= nextThreshold || nextThreshold > 70) return 0;
      const distance = Math.max(1, nextThreshold - currentScore);
      if (nextThreshold === 70 && distance > 18) return 0;

      const resources = player.resources || {};
      const routeTarget = options.routeTarget || null;
      const routeDistance = Math.max(0, Math.round(aiNumber(routeTarget?.newDistance)));
      const routeCanStillCashOut = routeTarget?.kind === "planet" && routeDistance <= 0;
      const mainActionOpen = canStartMainAction();
      const handSize = Math.max(0, aiNumber(resources.handSize));
      const credits = Math.max(0, aiNumber(resources.credits));
      const publicity = Math.max(0, aiNumber(resources.publicity));
      const canSearchCardNow = mainActionOpen && handSize <= 1 && (credits >= 2 || publicity >= 3);
      if (energyAfterMovePayment > 0) return 0;
      const thresholdBase = nextThreshold === 50 ? 10 : nextThreshold === 70 ? 8 : 5;
      let penalty = thresholdBase
        + Math.max(0, 8 - distance) * (nextThreshold === 50 ? 1.2 : 0.65)
        + (mainActionOpen ? 4 : 0)
        + ((canSearchCardNow || handSize <= 1) ? 3 : 0)
        + (routeCanStillCashOut ? 0 : 2);
      return roundAiScore(Math.min(nextThreshold === 50 ? 22 : 18, penalty));
    }

    function scoreAiFinalMoveBlocksScanCashoutPenalty(options = {}) {
      const player = options.player || getCurrentPlayer();
      if (!player || getAiRoundNumber() < FINAL_ROUND_NUMBER || !canStartMainAction()) return 0;
      const followupScore = Math.max(0, aiNumber(options.followupScore));
      if (followupScore > 0) return 0;
      if (getAiNextMissingFinalScoreThreshold(player) !== 70) return 0;

      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      if (currentScore < 58 || currentScore >= 70) return 0;

      const scanCheck = actions.canExecute("scan", createActionContext());
      if (!scanCheck.ok) return 0;

      const energySpent = Math.max(0, Math.round(aiNumber(options.energySpent)));
      if (energySpent <= 0) return 0;

      const scanCost = scanEffects.getStandardScanCost(player) || {};
      const scanEnergyCost = Math.max(0, Math.round(aiNumber(scanCost.energy)));
      const energyAfterMovePayment = Math.max(0, Math.round(aiNumber(options.energyAfterMovePayment)));
      if (scanEnergyCost <= 0 || energyAfterMovePayment >= scanEnergyCost) return 0;

      const deficit = Math.max(1, 70 - currentScore);
      return roundAiScore(Math.min(
        58,
        45
          + Math.max(0, 8 - deficit) * 1.6
          + Math.max(0, scanEnergyCost - energyAfterMovePayment) * 8,
      ));
    }

    function scoreAiEarlyMoveBlocksLandingTracePenalty(options = {}) {
      const player = options.player || getCurrentPlayer();
      if (!player) return 0;
      const round = getAiRoundNumber();
      const traceCount = countAiTraceMarkersForPlayer(player);
      if (round > 3 && traceCount > 0) return 0;

      const energySpent = Math.max(0, Math.round(aiNumber(options.energySpent)));
      if (energySpent <= 0) return 0;

      const routeTarget = options.routeTarget || options.routeScore?.target || null;
      const routeArrivedAtPlanet = routeTarget?.kind === "planet"
        && Math.max(0, Math.round(aiNumber(routeTarget?.newDistance))) === 0;
      const planet = options.planet || getAiPlanetAtCoordinate(options.to);
      const planetId = planet?.planetId || (routeArrivedAtPlanet ? routeTarget?.id : null);
      if (!planetId || planetId === "earth") return 0;

      const followupActionId = String(options.followupMainAction?.actionId || "");
      if (followupActionId === "land") return 0;
      if (!canAiPlanetAcceptLanding(planetId, player)) return 0;

      const landCost = Math.max(0, Math.round(aiNumber(
        abilities.planet.getLandEnergyCost(createActionContext(), planetId),
      )));
      if (landCost <= 0) return 0;

      const currentEnergy = Math.max(0, Math.round(aiNumber(player.resources?.energy)));
      const energyAfterMovePayment = Math.max(0, Math.round(aiNumber(options.energyAfterMovePayment)));
      if (currentEnergy < landCost || energyAfterMovePayment >= landCost) return 0;

      const landEffects = getAiLandRewardEffectsForTarget(planetId, { type: "planet" });
      const hasAlienTraceReward = (landEffects || []).some((effect) => isAiAlienTraceRewardEffect(effect));
      const rewardValue = Math.max(0, aiNumber(scoreAiBestLandRewardValueForPlanet(planetId, player)));
      const directScore = Math.max(0, aiNumber(getAiLandDirectScoreGainForTarget(
        planetId,
        { type: "planet" },
        player,
      )));
      if (round > 2 && traceCount > 0 && !hasAlienTraceReward && rewardValue < 18 && directScore < 8) return 0;

      const energyShortfall = Math.max(1, landCost - energyAfterMovePayment);
      let penalty = (round <= 1 ? 8 : round === 2 ? 6 : 3)
        + (traceCount <= 0 ? 9 : traceCount <= 2 ? 4 : 0)
        + (hasAlienTraceReward ? (traceCount <= 0 ? 5 : 3) : 0)
        + Math.min(8, rewardValue * 0.18)
        + Math.min(5, directScore * 0.28)
        + energyShortfall * 4;
      if (followupActionId === "orbit") penalty += 4;
      else if (!followupActionId) penalty += 3;
      if (round >= 3 && traceCount > 2) penalty *= 0.55;
      return roundAiScore(Math.min(34, Math.max(0, penalty)));
    }

    function scoreAiEarlyOrbitOnlyTraceDelayPenalty(options = {}) {
      const player = options.player || getCurrentPlayer();
      if (!player || getAiRoundNumber() > 2 || countAiTraceMarkersForPlayer(player) > 0) return 0;
      const followupMainAction = options.followupMainAction || {};
      if (String(followupMainAction.actionId || "") !== "orbit") return 0;

      const routeTarget = options.routeTarget || options.routeScore?.target || null;
      const routeArrivedAtPlanet = routeTarget?.kind === "planet"
        && Math.max(0, Math.round(aiNumber(routeTarget?.newDistance))) === 0;
      const planet = options.planet || getAiPlanetAtCoordinate(options.to);
      const planetId = planet?.planetId || (routeArrivedAtPlanet ? routeTarget?.id : null);
      if (!planetId || planetId === "earth") return 0;

      const followupScore = Math.max(0, aiNumber(followupMainAction.score));
      const routeScore = Math.max(0, aiNumber(options.routeScore?.score ?? options.routeScore));
      const directScore = Math.max(0, aiNumber(followupMainAction.directScoreGain));
      const landEffects = getAiLandRewardEffectsForTarget(planetId, { type: "planet" });
      const traceDelayWeight = (landEffects || []).some((effect) => isAiAlienTraceRewardEffect(effect)) ? 1 : 0.65;
      const penalty = 58
        + Math.min(32, followupScore * 0.45)
        + Math.min(8, routeScore * 0.1)
        - Math.min(8, directScore * 0.35);
      return roundAiScore(Math.min(96, Math.max(0, penalty * traceDelayWeight)));
    }

    function scoreAiMovementPathPenalty(options = {}) {
      const requiredMovePoints = Math.max(0, Math.round(aiNumber(options.requiredMovePoints ?? options.terrainRequired ?? 1)));
      const routeTarget = options.routeScore?.target || null;
      const followupScore = Math.max(0, aiNumber(options.followupScore));
      const direction = options.direction || {};
      const energySpent = Math.max(0, Math.round(aiNumber(options.energySpent)));
      const energyAfterMovePayment = Math.max(0, Math.round(aiNumber(options.energyAfterMovePayment)));
      let penalty = 0;
      penalty += scoreAiFinalMoveBlocksScanCashoutPenalty({
        player: options.player,
        followupScore: options.followupScore,
        energySpent,
        energyAfterMovePayment,
      });

      if (requiredMovePoints > 1) {
        penalty += (requiredMovePoints - 1) * (getAiRoundNumber() <= 2 ? 1.25 : 0.75);
      }

      penalty += scoreAiRotationTimingMovePenalty({
        ...options,
        routeTarget,
        followupScore,
      });
      penalty += options.nearestActionablePlanetPenalty ?? scoreAiNearestActionablePlanetTimingPenalty({
        ...options,
        routeTarget,
        followupScore,
      });
      penalty += scoreAiAsteroidTrapMovePenalty({
        ...options,
        routeTarget,
        followupScore,
        requiredMovePoints,
      });

      if (!routeTarget && followupScore <= 0) {
        penalty += getAiRoundNumber() >= 3 ? 6 : 3;
      }

      if (energySpent > 0 && followupScore <= 0) {
        if (energyAfterMovePayment <= 0) {
          penalty += getAiRoundNumber() <= 3 ? 15 : 7;
        }
        else if (getAiRoundNumber() <= 2) penalty += Math.min(4, energySpent * 1.5);
      }

      if (routeTarget) {
        const oldDistance = aiNumber(routeTarget.oldDistance);
        const newDistance = aiNumber(routeTarget.newDistance);
        if (newDistance > oldDistance) {
          penalty += (newDistance - oldDistance) * (getAiRoundNumber() <= 2 ? 4 : 3);
          penalty += Math.min(5, aiNumber(routeTarget.value) * 0.2);
        }
        if (newDistance >= 5 && followupScore <= 0) {
          penalty += Math.min(5, (newDistance - 4) * 0.9);
        }
        if (getAiRoundNumber() >= 3 && followupScore <= 0 && newDistance > 0) {
          penalty += Math.min(7, 2 + newDistance * 0.8);
          if (newDistance >= oldDistance) penalty += 3;
        }
      }

      const movesTowardTarget = routeTarget && aiNumber(routeTarget.newDistance) < aiNumber(routeTarget.oldDistance);
      if (direction.deltaY < 0 && !movesTowardTarget && followupScore <= 0) {
        penalty += getAiRoundNumber() <= 2 ? 2.5 : 1.5;
      }

      return Math.max(0, penalty);
    }

    function scoreAiRotationTimingMovePenalty(options = {}) {
      const player = options.player || getCurrentPlayer();
      const routeTarget = options.routeTarget || null;
      if (!player || routeTarget?.kind !== "planet") return 0;
      if (Math.max(0, aiNumber(options.followupScore)) > 0) return 0;
      const range = getAiPlanetOptimalMoveRange(routeTarget.id);
      if (!range) return 0;
      const newDistance = Math.max(0, Math.round(aiNumber(routeTarget.newDistance)));
      const oldDistance = Math.max(0, Math.round(aiNumber(routeTarget.oldDistance)));
      const excess = Math.max(0, newDistance - range.max);
      if (excess <= 0) return 0;
      const swing = getAiThreeRotationDistanceSwingForPlanet(routeTarget.id);
      if (swing <= 0) return 0;
      const waitableExcess = Math.min(excess, swing);
      const round = getAiRoundNumber();
      let penalty = waitableExcess * (round <= 2 ? 2.3 : round === 3 ? 1.8 : 1.25)
        + Math.max(0, excess - swing) * 0.9;
      if (newDistance >= oldDistance) penalty += 2;
      if (isAiAsteroidCoordinate(options.to) && !players.playerOwnsTech(player, "orange2", createActionContext())) {
        penalty *= 1.35;
      }
      return roundAiScore(Math.min(16, Math.max(0, penalty)));
    }

    function scoreAiRotationStagingValue(routeTarget, player = getCurrentPlayer(), options = {}) {
      if (!player || routeTarget?.kind !== "planet") return 0;
      const range = getAiPlanetOptimalMoveRange(routeTarget.id);
      if (!range) return 0;
      const oldDistance = Math.max(0, Math.round(aiNumber(routeTarget.oldDistance)));
      const newDistance = Math.max(0, Math.round(aiNumber(routeTarget.newDistance)));
      if (newDistance <= range.max || newDistance >= oldDistance) return 0;

      const excess = Math.max(0, newDistance - range.max);
      const swing = getAiThreeRotationDistanceSwingForPlanet(routeTarget.id);
      if (excess <= 0 || swing <= 0 || excess > swing) return 0;
      if (isAiAsteroidCoordinate(options.to) && !players.playerOwnsTech(player, "orange2", createActionContext())) {
        return 0;
      }

      const round = getAiRoundNumber();
      const rotationFit = Math.max(0, swing - excess + 1);
      const routeValue = Math.max(0, aiNumber(routeTarget.value));
      const satellitePressure = routeTarget.satelliteOpportunity && round >= 3
        ? Math.min(2.4, scoreAiOuterSatelliteCashoutPremium(routeTarget.id, {
          type: "satellite",
          satelliteId: routeTarget.satelliteOpportunity.satelliteId,
        }, player, {
          directScore: routeTarget.satelliteOpportunity.directScore,
          energyCost: routeTarget.satelliteOpportunity.energyCost,
          energyShortfall: routeTarget.satelliteOpportunity.energyShortfall,
          routeDistance: newDistance,
        }) * 0.12)
        : 0;
      return roundAiScore(Math.min(
        5.5,
        (round <= 2 ? 1.2 : round === 3 ? 0.95 : 0.65) * rotationFit
          + Math.min(1.8, routeValue * 0.04)
          + satellitePressure,
      ));
    }

    function scoreAiAsteroidTrapMovePenalty(options = {}) {
      const player = options.player || getCurrentPlayer();
      const routeTarget = options.routeTarget || options.routeScore?.target || null;
      const routeIsAsteroidTarget = routeTarget?.kind === "probe-location"
        && (routeTarget.locationType === "asteroid" || routeTarget.locationType === "earthAdjacentAsteroid");
      const toMatchesAsteroidRouteTarget = routeIsAsteroidTarget
        && Number(routeTarget.coordinate?.x) === Number(options.to?.x)
        && Number(routeTarget.coordinate?.y) === Number(options.to?.y);
      const toIsAsteroidStop = isAiAsteroidCoordinate(options.to) || toMatchesAsteroidRouteTarget;
      if (!player || !toIsAsteroidStop) return 0;
      const ownsOrange2 = players.playerOwnsTech(player, "orange2", createActionContext());
      const fromAsteroid = isAiAsteroidCoordinate(options.from);
      const currentAsteroidCount = countAiPlayerRocketsOnAsteroids(player);
      const asteroidCountAfter = Math.max(0, currentAsteroidCount + (fromAsteroid ? 0 : 1));
      const nearestPlanet = getAiNearestActionablePlanetRoute(options.to, player);
      const range = nearestPlanet?.optimalRange || null;
      const nearestDistance = Math.max(0, Math.round(aiNumber(nearestPlanet?.distance)));
      const distanceExcess = range
        ? Math.max(0, nearestDistance - range.max)
        : 0;
      const followupScore = Math.max(0, aiNumber(options.followupScore));
      const canContinueSameMove = Math.max(0, Math.round(aiNumber(options.remainingPoolAfterStep))) > 0
        && !isAiIndustryHuanyuMoveContext(options);
      const routeCanCashOut = followupScore > 0 || (routeTarget?.kind === "planet" && Math.max(0, aiNumber(routeTarget.newDistance)) <= 0);
      const swing = nearestPlanet?.planetId ? getAiThreeRotationDistanceSwingForPlanet(nearestPlanet.planetId) : 0;
      const waitableExcess = Math.min(distanceExcess, swing);
      const round = getAiRoundNumber();
      if (ownsOrange2) return 0;
      let penalty = 3.5 + Math.max(0, asteroidCountAfter - 1) * 5;
      if (followupScore <= 0) penalty += 4 + distanceExcess * 1.6;
      if (asteroidCountAfter >= 2) penalty += 5;
      if (asteroidCountAfter >= 2 && !routeCanCashOut) {
        penalty += round <= 2 ? 7 : round === 3 ? 9 : 11;
      }
      if (Math.max(0, Math.round(aiNumber(options.requiredMovePoints))) <= 1) penalty += 1.5;
      if (routeIsAsteroidTarget && !routeCanCashOut) {
        penalty += round <= 2 ? 7 : round === 3 ? 9 : 10;
        if (!canContinueSameMove) penalty += 5;
      }
      if (distanceExcess > 0 && !routeCanCashOut) {
        penalty += Math.min(12, 3 + distanceExcess * 2.8 + waitableExcess * 1.6);
      }
      if (isAiIndustryHuanyuMoveContext(options) && !routeCanCashOut) {
        penalty += asteroidCountAfter >= 2 ? 22 : 8;
        if (distanceExcess > 0) penalty += Math.min(10, distanceExcess * 3 + waitableExcess * 1.5);
      }
      if (nearestDistance >= 4 && !routeCanCashOut) {
        penalty += Math.min(8, nearestDistance * 1.2);
      }
      return roundAiScore(Math.min(58, Math.max(0, penalty)));
    }
    return Object.freeze({
      getAiCircularDistanceX,
      getAiSectorDistance,
      getAiPlanetOptimalMoveRange,
      scoreAiPlanetMoveDistanceFit,
      getAiCoordinateDistanceFromEarth,
      isAiCoordinateAdjacentToEarth,
      getAiAdjacentEarthCoordinates,
      sumAiDemandMap,
      getAiTotalRouteDemand,
      canAiPlanetAcceptOrbit,
      canAiPlanetAcceptLanding,
      scoreAiRewardEffects,
      scoreAiOrbitRewardValue,
      getAiLandRewardEffectsForTarget,
      getAiCardLandChoicePlanetId,
      getAiCardLandChoiceRewardEffects,
      isAiAlienTraceRewardEffect,
      canAiResolveCardLandChoice,
      canAiResolveCardLandEffect,
      scoreAiLandRewardValueForTarget,
      scoreAiLandResolvedRewardValueForTarget,
      getAiRewardTraceTypes,
      scoreAiDeferredAlienTraceRewardPenalty,
      getAiFirstTraceCompetition,
      getAiPrecedingOpponentIds,
      getAiPostActionWindowOpponentIds,
      estimateAiSatelliteClaimEta,
      getAiImmediateEnergyTradeCapacity,
      buildAiSatelliteRaceDiagnostics,
      getAiApproxLandEnergyCostForPlayer,
      canAiPlayerLandForTraceNow,
      canAiOpponentLandForTraceNow,
      getAiTraceCompetitionState,
      scoreAiHighCostPointConversionPenalty,
      isAiOuterHighScoreSatelliteTarget,
      scoreAiOuterSatelliteCashoutPremium,
      scoreAiOuterSatelliteRouteApproachPremium,
      canAiOpponentContestSatelliteNow,
      getAiResearchTechPublicityCostForPlayer,
      getAiTechTileRemaining,
      getAiProspectiveOrange4ContestAccess,
      getAiOuterSatelliteContestPressure,
      getAiNearestRocketDistanceToPlanet,
      getAiSatelliteLandingRaceState,
      scoreAiSatelliteLandingRaceWastePenalty,
      getAiBestPlayableLaunchCardRoute,
      getAiOrange4LaunchRouteRaceRelief,
      scoreAiOuterSatelliteContestRiskPenalty,
      getAiYellowTraceLandCompetitionPenalty,
      getAiEffectDirectScore,
      getAiRewardDirectScore,
      getAiResearchTechEffectDirectScore,
      getAiOrbitDirectScoreGain,
      getAiLandDirectScoreGainForTarget,
      getAiBestLandDirectScoreGain,
      getAiBestSatelliteLandingOpportunity,
      buildAiLandChoicesForPlanet,
      scoreAiBestSatelliteLandRewardValue,
      scoreAiBestLandRewardValueForPlanet,
      getAiReservedEndGameRules,
      countAiMainLandingMarkersOnPlanet,
      scoreAiFinalTileOrbitLandMarginal,
      scoreAiPlanetMarkerEndGameValue,
      scoreAiOrbitChoice,
      scoreAiLandChoice,
      chooseAiLandChoice,
      scoreAiPlanetTarget,
      getAiPlanetAtCoordinate,
      isAiAsteroidCoordinate,
      scoreAiMoveArrivalRewardValue,
      getAiThreeRotationDistanceSwingForPlanet,
      getAiNearestActionablePlanetRoute,
      getAiActionablePlanetDistanceWindow,
      scoreAiNearestActionablePlanetTimingPenalty,
      countAiPlayerRocketsOnAsteroids,
      scoreAiOrange2MobilityNeed,
      scoreAiHuanyuOrange2FutureMoveValue,
      isAiLandingEffect,
      isAiChongPickupPlanetId,
      isAiChongTravelEffect,
      getAiNextActionEffect,
      getAiLandEffectCost,
      scoreAiLandingAfterMove,
      getAiDisplayedTurnNumber,
      getAiRequiredMovePointsFromCoordinate,
      canAiContinueCardMoveAfterStep,
      getAiRouteTargets,
      scoreAiMoveTowardTargets,
      getAiUrgentUncashableRouteScoreCap,
      getAiFinalInsufficientCashoutRouteAdjustment,
      scoreAiFinalUncashableMoveEnergyPenalty,
      scoreAiFinalMoveBlocksScanCashoutPenalty,
      scoreAiEarlyMoveBlocksLandingTracePenalty,
      scoreAiEarlyOrbitOnlyTraceDelayPenalty,
      scoreAiMovementPathPenalty,
      scoreAiRotationTimingMovePenalty,
      scoreAiRotationStagingValue,
      scoreAiAsteroidTrapMovePenalty,
    });
  }

  return Object.freeze({ createRoutePlanet });
});
