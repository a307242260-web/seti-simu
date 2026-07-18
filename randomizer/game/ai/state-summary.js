(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAIStateSummary = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createStateSummary(context = {}) {
    const {
      rocketActions,
      endGameScoring,
      cardEffects,
      aomomo,
      nebulaDataState,
      alienGameState,
      rocketState,
      planetStatsState,
      AI_TECH_TYPES,
      AI_INCOME_DISCARD_TYPES,
    } = context;
    const aiNumber = (...args) => context.aiNumber(...args);
    const countAiLandingMarkers = (...args) => context.countAiLandingMarkers(...args);
    const countAiTraceMarkersForPlayer = (...args) => context.countAiTraceMarkersForPlayer(...args);
    const createActionContext = (...args) => context.createActionContext(...args);
    const getAiCardDisplayLabel = (...args) => context.getAiCardDisplayLabel(...args);
    const getAiNebulaSignalCounts = (...args) => context.getAiNebulaSignalCounts(...args);
    const getAiPlanetAtCoordinate = (...args) => context.getAiPlanetAtCoordinate(...args);
    const getAiPlayEffectsForCard = (...args) => context.getAiPlayEffectsForCard(...args);
    const getAiRewardDirectScore = (...args) => context.getAiRewardDirectScore(...args);
    const getCardTypeCode = (...args) => context.getCardTypeCode(...args);
    const getCurrentPlayer = (...args) => context.getCurrentPlayer(...args);
    const isAiAutoBattlePlayer = (...args) => context.isAiAutoBattlePlayer(...args);
    const roundAiScore = (...args) => context.roundAiScore(...args);
    const scoreAiEffectValue = (...args) => context.scoreAiEffectValue(...args);

    function countAiPlayerTech(player) {
      const ownedTiles = player?.techState?.ownedTiles || {};
      return Object.values(ownedTiles).reduce((total, value) => {
        if (Array.isArray(value)) return total + value.length;
        return total + (value ? 1 : 0);
      }, 0);
    }

    function getAiPlayerTechTypeCounts(player) {
      return AI_TECH_TYPES.reduce((counts, techType) => {
        counts[techType] = Math.max(0, aiNumber(endGameScoring?.countOwnedTech?.(player, techType)));
        return counts;
      }, {});
    }

    function getAiProbePlanetIds(player = getCurrentPlayer(), excludePlanetIds = []) {
      if (!player) return [];
      const excluded = new Set((excludePlanetIds || []).map(String));
      const planetIds = new Set();
      for (const rocket of rocketActions.getRocketsForPlayer?.(rocketState, player.id) || []) {
        const coordinate = rocketActions.getRocketSectorCoordinate?.(rocket) || null;
        const planetId = getAiPlanetAtCoordinate(coordinate)?.planetId || null;
        if (!planetId || excluded.has(String(planetId))) continue;
        planetIds.add(String(planetId));
      }
      return Array.from(planetIds);
    }

    function getAiTaskConditionCurrentCount(condition = {}, player = null) {
      if (!condition || !player) return null;
      const type = condition.type || null;
      const nebulaIdsByColor = cardEffects?.NEBULA_IDS_BY_COLOR || endGameScoring?.NEBULA_IDS_BY_COLOR || {};
      if (type === "resourceThreshold" || type === "resourceEquals") {
        return aiNumber(player.resources?.[condition.resource]);
      }
      if (type === "techCount") return aiNumber(endGameScoring?.countOwnedTech?.(player, condition.techType));
      if (type === "traceCount") {
        return condition.traceType
          ? aiNumber(endGameScoring?.countTraceMarkers?.(player, alienGameState, condition.traceType))
          : countAiTraceMarkersForPlayer(player);
      }
      if (type === "dataTotal") return aiNumber(player.resources?.availableData);
      if (type === "planetOrbitOrLand") {
        return aiNumber(endGameScoring?.countPlanetOrbitOrLand?.(player, planetStatsState, condition.planetId));
      }
      if (type === "planetOrbitOrLandAll") {
        return (condition.planetIds || []).reduce((total, planetId) => (
          total + (endGameScoring?.countPlanetOrbitOrLand?.(player, planetStatsState, planetId) > 0 ? 1 : 0)
        ), 0);
      }
      if (type === "orbitCount" || type === "orbitOrLandCount") {
        return aiNumber(endGameScoring?.countOrbitOrLandMarkers?.(player, planetStatsState, createActionContext()));
      }
      if (type === "landingCount") return countAiLandingMarkers(player);
      if (type === "probesOnDifferentPlanets") {
        return getAiProbePlanetIds(player, condition.excludePlanetIds || []).length;
      }
      if (type === "completedSectorsByColor") {
        return aiNumber(endGameScoring?.countSectorWinsByColor?.(player, nebulaDataState, condition.color));
      }
      if (type === "completedSectors") {
        return aiNumber(endGameScoring?.countSectorWins?.(player, nebulaDataState));
      }
      if (type === "completedSameSectorColor") {
        return Math.max(
          0,
          ...["yellow", "red", "blue", "black"].map((color) => (
            aiNumber(endGameScoring?.countSectorWinsByColor?.(player, nebulaDataState, color))
          )),
        );
      }
      if (type === "distinctSignalSectors") {
        return aiNumber(endGameScoring?.countDistinctSignalSectors?.(player, nebulaDataState));
      }
      if (type === "signalsInAllColors") {
        return Object.entries(nebulaIdsByColor).filter(([, nebulaIds]) => (
          (nebulaIds || []).some((nebulaId) => getAiNebulaSignalCounts(nebulaId, player).ownCount > 0)
        )).length;
      }
      if (type === "signalsOrWinsInAllSectors") {
        const playerKeys = new Set([player.id, player.playerId, player.color, player.playerColor].filter(Boolean));
        const wins = nebulaDataState?.sectorSettlements?.winsByPlayerId || {};
        const wonSectors = new Set();
        for (const key of playerKeys) {
          for (const win of wins[key] || []) {
            if (win?.sectorId) wonSectors.add(win.sectorId);
          }
        }
        return Object.values(nebulaIdsByColor).flat().filter((nebulaId) => (
          wonSectors.has(nebulaId) || getAiNebulaSignalCounts(nebulaId, player).ownCount > 0
        )).length;
      }
      if (type === "aomomoSignalCount") {
        return getAiNebulaSignalCounts(aomomo?.NEBULA_ID || "aomomo", player).ownCount;
      }
      if (type === "aomomoFossils") return aiNumber(player.resources?.aomomoFossils);
      return null;
    }

    function summarizeAiTaskCondition(condition = {}, player = null) {
      if (!condition || typeof condition !== "object") return null;
      const nebulaIdsByColor = cardEffects?.NEBULA_IDS_BY_COLOR || endGameScoring?.NEBULA_IDS_BY_COLOR || {};
      const targetCount = Math.max(
        1,
        Math.round(aiNumber(
          condition.count
          ?? (condition.type === "signalsInAllColors" ? Object.keys(nebulaIdsByColor).length : null)
          ?? (condition.type === "signalsOrWinsInAllSectors" ? Object.values(nebulaIdsByColor).flat().length : null)
          ?? (condition.type === "planetOrbitOrLandAll" ? (condition.planetIds || []).length : 1),
        ) || 1),
      );
      const currentCount = getAiTaskConditionCurrentCount(condition, player);
      const met = currentCount == null
        ? false
        : (condition.type === "resourceEquals"
          ? aiNumber(currentCount) === aiNumber(condition.count)
          : aiNumber(currentCount) >= targetCount);
      return {
        type: condition.type || null,
        targetCount,
        currentCount: currentCount == null ? null : roundAiScore(currentCount),
        missingCount: currentCount == null ? null : (met ? 0 : roundAiScore(Math.max(0, targetCount - aiNumber(currentCount)))),
        met,
        resource: condition.resource || null,
        planetId: condition.planetId || null,
        planetIds: Array.isArray(condition.planetIds) ? condition.planetIds.slice() : undefined,
        color: condition.color || null,
        traceType: condition.traceType || null,
        locationType: condition.locationType || null,
      };
    }

    function summarizeAiResultCardTask(task = {}, card = null, player = null) {
      if (!task?.id) return null;
      const completedTaskIds = new Set(card?.cardEffectState?.completedTaskIds || []);
      const rewards = Array.isArray(task.rewards) ? task.rewards : [];
      return {
        id: task.id,
        completed: completedTaskIds.has(task.id),
        condition: summarizeAiTaskCondition(task.condition || {}, player),
        rewardDirectScore: roundAiScore(getAiRewardDirectScore(rewards, player)),
        rewardValue: roundAiScore(rewards.reduce((total, reward) => total + scoreAiEffectValue(reward, { player }), 0)),
      };
    }

    function summarizeAiResultCard(card, player = null) {
      if (!card) return null;
      const cardId = card.cardId || card.id || null;
      const model = cardEffects?.getCardModel?.(card) || null;
      const playEffects = getAiPlayEffectsForCard(card);
      const tasks = Array.isArray(model?.tasks)
        ? model.tasks.map((task) => summarizeAiResultCardTask(task, card, player)).filter(Boolean)
        : [];
      return {
        id: card.id || null,
        cardId,
        label: getAiCardDisplayLabel({ card, cardId }, player),
        price: Math.max(0, aiNumber(card.price)),
        typeCode: getCardTypeCode(card),
        discardActionCode: card.discardActionCode ?? null,
        scanActionCode: card.scanActionCode ?? null,
        incomeCode: card.incomeCode ?? null,
        taskCount: tasks.length,
        remainingTaskCount: tasks.filter((task) => !task.completed).length,
        tasks,
        endGameScoring: Boolean(model?.endGameScoring),
        effectTypes: playEffects.map((effect) => effect?.type || null).filter(Boolean),
      };
    }

    function summarizeAiResultCards(cardList = [], player = null) {
      return Array.isArray(cardList)
        ? cardList.map((card) => summarizeAiResultCard(card, player)).filter(Boolean)
        : [];
    }


    function isAiIncomeDiscardType(type) {
      return AI_INCOME_DISCARD_TYPES.has(String(type || ""));
    }

    function getPlayerAgentLabel(playerId) {
      return isAiAutoBattlePlayer(playerId) ? "电脑" : "人类";
    }
    return Object.freeze({
      countAiPlayerTech,
      getAiPlayerTechTypeCounts,
      getAiProbePlanetIds,
      getAiTaskConditionCurrentCount,
      summarizeAiTaskCondition,
      summarizeAiResultCardTask,
      summarizeAiResultCard,
      summarizeAiResultCards,
      isAiIncomeDiscardType,
      getPlayerAgentLabel,
    });
  }

  return Object.freeze({ createStateSummary });
});
