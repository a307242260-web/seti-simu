(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.SetiAppFinalScoreAiRuntime = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function createFinalScoreAiRuntime(context) {
    const {
      FINAL_ROUND_NUMBER,
      FINAL_SCORE_IDS,
      aiNumber,
      aiRaceModel,
      aiValuation,
      aliens,
      alienGameState,
      applyAiStrategyWeight,
      cardEffects,
      createActionContext,
      endGameScoring,
      finalScoring,
      finalScoringState,
      getAiMapDemand,
      getAiRemainingRoundWeight,
      getAiStrategyDemand,
      getCardTypeCode,
      getCurrentPlayer,
      getPlayerById,
      handleFinalScoreTileClick,
      isAiAutoBattlePlayer,
      playerState,
      recordAiAutoBattleLog,
      sumAiDemandMap,
      syncFinalScorePendingMarks,
      turnState,
    } = context;

  function getAiFinalScoreFormulaPotential(formulaId) {
    switch (formulaId) {
      case "a1":
        return 2.6;
      case "a2":
        return 3.2;
      case "b1":
        return 3.6;
      case "b2":
        return 4;
      case "c1":
        return 3.4;
      case "c2":
        return 3.8;
      case "d1":
        return 5.2;
      case "d2":
        return 5.5;
      default:
        return 2;
    }
  }

  function scoreAiFinalScoreFormulaDemand(formulaId, demand = {}) {
    let value = aiNumber(demand.final) * 0.12;
    if (formulaId === "a1" || formulaId === "a2") {
      value += getAiMapDemand(demand.resources, "credits") * 0.08;
      value += getAiMapDemand(demand.resources, "energy") * 0.08;
      value += getAiMapDemand(demand.resources, "handSize") * 0.06;
      return applyAiStrategyWeight(value, "engine", 0.35);
    }
    if (formulaId === "b1") {
      value += sumAiDemandMap(demand.traceTypes) * 0.14;
      value += getAiMapDemand(demand.actions, "scan") * 0.08;
      return applyAiStrategyWeight(value, "scan", 0.35);
    }
    if (formulaId === "b2") {
      value += getAiMapDemand(demand.actions, "orbit") * 0.16;
      value += getAiMapDemand(demand.actions, "land") * 0.16;
      value += getAiMapDemand(demand.actions, "scan") * 0.12;
      value += sumAiDemandMap(demand.scanColors) * 0.08;
      return applyAiStrategyWeight(value, "orbitLand", 0.45);
    }
    if (formulaId === "c1" || formulaId === "c2") {
      value += aiNumber(demand.task) * 0.22;
      value += getAiMapDemand(demand.actions, "playCard") * 0.12;
      value = applyAiStrategyWeight(value, "task", 0.5);
      return applyAiStrategyWeight(value, "playCard", 0.25);
    }
    if (formulaId === "d1" || formulaId === "d2") {
      value += sumAiDemandMap(demand.techTypes) * 0.18;
      value += getAiMapDemand(demand.actions, "researchTech") * 0.18;
      return applyAiStrategyWeight(value, "tech", 0.55);
    }
    return value;
  }

  function getAiFinalScoreCFormulaPipeline(formulaId, player, baseValue, demand = {}) {
    if (!player || (formulaId !== "c1" && formulaId !== "c2")) return null;
    const countOpenTasks = (card) => {
      const model = cardEffects?.getCardModel?.(card) || null;
      const completed = new Set(card?.cardEffectState?.completedTaskIds || []);
      return (model?.tasks || []).filter((task) => task?.id && !completed.has(task.id)).length;
    };
    const reservedCards = Array.isArray(player.reservedCards) ? player.reservedCards : [];
    const hand = Array.isArray(player.hand) ? player.hand : [];
    const reservedTaskCount = reservedCards.reduce((total, card) => total + countOpenTasks(card), 0);
    const handTaskCount = hand.reduce((total, card) => total + countOpenTasks(card), 0);
    const type3Reserved = endGameScoring?.countType3Cards
      ? Math.max(0, Math.round(aiNumber(endGameScoring.countType3Cards(player, getCardTypeCode))))
      : reservedCards.reduce((total, card) => total + (Math.round(aiNumber(getCardTypeCode(card))) === 3 ? 1 : 0), 0);
    const type3InHand = hand.reduce((total, card) => (
      total + (Math.round(aiNumber(getCardTypeCode(card))) === 3 ? 1 : 0)
    ), 0);
    const currentBase = Math.max(0, Math.round(aiNumber(baseValue)));
    const completedTaskCount = Math.max(0, aiNumber(player.completedTaskCount));
    const roundNumber = Math.max(1, Math.round(aiNumber(turnState.roundNumber) || 1));
    const taskDemand = aiNumber(demand.task) + getAiMapDemand(demand.actions, "playCard") * 0.8;
    const visibleTaskPipeline = reservedTaskCount + handTaskCount * 0.35;
    const visibleType3Pipeline = type3Reserved + type3InHand * 0.45;
    const cPipeline = formulaId === "c1"
      ? visibleTaskPipeline
      : visibleTaskPipeline + visibleType3Pipeline;
    const demandPipeline = Math.max(0, taskDemand) * (formulaId === "c1" ? 0.018 : 0.026);
    const pipelineScale = Math.min(1, Math.max(0, (cPipeline + demandPipeline) / (formulaId === "c1" ? 2.5 : 2)));
    const rawActionWindow = roundNumber >= FINAL_ROUND_NUMBER
      ? (formulaId === "c1" ? 0.35 : 0.85)
      : roundNumber === 3
        ? (formulaId === "c1" ? 0.75 : 1.45)
        : (formulaId === "c1" ? 1.15 : 2.1);
    const actionWindow = rawActionWindow * pipelineScale;
    const expectedNewTasks = Math.min(
      7,
      reservedTaskCount * (formulaId === "c1" ? 0.48 : 0.78)
        + handTaskCount * (formulaId === "c1" ? 0.18 : 0.34)
        + Math.max(0, taskDemand) * (formulaId === "c1" ? 0.018 : 0.034)
        + actionWindow,
    );
    const expectedNewType3 = formulaId === "c2"
      ? Math.min(
        4,
        type3InHand * (roundNumber >= FINAL_ROUND_NUMBER ? 0.42 : 0.68)
          + Math.max(0, taskDemand) * 0.012,
      )
      : 0;

    let projectedBase = currentBase;
    if (formulaId === "c1") {
      projectedBase = Math.max(
        currentBase,
        Math.floor(completedTaskCount + expectedNewTasks),
      );
    } else {
      projectedBase = Math.max(
        currentBase,
        Math.floor((
          completedTaskCount
          + type3Reserved
          + expectedNewTasks
          + expectedNewType3
        ) / 2),
      );
    }

    return {
      currentBase,
      completedTaskCount,
      reservedTaskCount,
      handTaskCount,
      type3Reserved,
      type3InHand,
      taskDemand,
      visibleTaskPipeline,
      visibleType3Pipeline,
      cPipeline,
      demandPipeline,
      pipelineScale,
      actionWindow,
      expectedNewTasks,
      expectedNewType3,
      projectedBase,
    };
  }

  function scoreAiFinalScoreFormulaGrowth(formulaId, player, slotIndex, baseValue, demand = {}) {
    if (!player || !endGameScoring?.getSlotMultiplier) return 0;
    if (!["c1", "c2", "d1", "d2"].includes(formulaId)) return 0;
    const slot = Math.max(1, Math.round(aiNumber(slotIndex) || 1));

    const remainingRounds = Math.max(1, aiNumber(getAiRemainingRoundWeight()));
    const roundNumber = Math.max(1, Math.round(aiNumber(turnState.roundNumber) || 1));
    const currentBase = Math.max(0, Math.round(aiNumber(baseValue)));

    if (formulaId === "c1" || formulaId === "c2") {
      const cPipelineState = getAiFinalScoreCFormulaPipeline(formulaId, player, baseValue, demand);
      if (!cPipelineState) return 0;
      const {
        currentBase: pipelineCurrentBase,
        pipelineScale,
        expectedNewTasks,
        expectedNewType3,
        projectedBase,
      } = cPipelineState;
      if (currentBase <= 0 && pipelineScale < 0.12) return 0;
      const baseGain = Math.max(0, projectedBase - pipelineCurrentBase);
      if (baseGain <= 0 && currentBase > 0) return 0;
      const multiplier = Math.max(0, aiNumber(endGameScoring.getSlotMultiplier(formulaId, slot)));
      const growthValue = baseGain * multiplier;
      const firstSlotPremium = slot === 1 && roundNumber <= 3
        ? Math.min(
          formulaId === "c1" ? 5 : 9,
          (formulaId === "c2" ? 3.6 : 1.8) + expectedNewTasks * (formulaId === "c1" ? 0.38 : 0.65) + expectedNewType3 * 0.5,
        )
        : slot === 2 && roundNumber <= 3
          ? Math.min(formulaId === "c1" ? 2 : 3.5, expectedNewTasks * 0.28 + expectedNewType3 * 0.25)
          : 0;
      const zeroBaseFloor = currentBase <= 0 && roundNumber <= 3
        ? Math.min(
          formulaId === "c1" ? 1.4 : 3.2,
          (expectedNewTasks * (formulaId === "c1" ? 0.22 : 0.38) + expectedNewType3 * 0.28) * pipelineScale,
        )
        : 0;
      return Math.min(24, growthValue * (formulaId === "c1" ? 0.48 : 0.68) + firstSlotPremium + zeroBaseFloor);
    }

    if (!endGameScoring?.countOwnedTech) return 0;
    if (slot >= 3) return 0;
    const techCounts = ["orange", "purple", "blue"].map((techType) => (
      Math.max(0, Math.round(aiNumber(endGameScoring.countOwnedTech(player, techType))))
    ));
    const totalTech = techCounts.reduce((total, count) => total + count, 0);
    const hasCheatLab = player?.industryCard?.id === "industry:作弊实验室"
      || player?.industryCard?.label === "作弊实验室";
    const publicity = Math.max(0, aiNumber(player.resources?.publicity));
    const techDemand = sumAiDemandMap(demand.techTypes) + getAiMapDemand(demand.actions, "researchTech");
    const resourceBoost = publicity >= (hasCheatLab ? 4 : 6) ? 0.65 : publicity >= 3 ? 0.35 : 0;
    const demandBoost = Math.min(1.4, Math.max(0, techDemand) * 0.045);
    const expectedNewTech = Math.min(
      5,
      Math.max(0, (remainingRounds - 0.35) * (hasCheatLab ? 1.25 : 0.85) + resourceBoost + demandBoost),
    );
    if (expectedNewTech <= 0) return 0;

    let projectedBase = currentBase;
    if (formulaId === "d2") {
      projectedBase = Math.floor((totalTech + expectedNewTech) / 2);
    } else {
      const projected = [...techCounts].sort((left, right) => left - right);
      let remainingTech = expectedNewTech;
      while (remainingTech >= 1) {
        projected[0] += 1;
        projected.sort((left, right) => left - right);
        remainingTech -= 1;
      }
      projectedBase = projected[0];
    }

    const baseGain = Math.max(0, projectedBase - currentBase);
    if (baseGain <= 0 && currentBase > 0) return 0;

    const multiplier = Math.max(0, aiNumber(endGameScoring.getSlotMultiplier(formulaId, slot)));
    const growthValue = baseGain * multiplier;
    const firstSlotPremium = slot === 1 && roundNumber <= 3
      ? Math.min(8, (formulaId === "d2" ? 3.2 : 2.4) + expectedNewTech * 0.7)
      : 0;
    const zeroBaseFloor = currentBase <= 0 && roundNumber <= 3
      ? Math.min(4.5, expectedNewTech * (formulaId === "d2" ? 0.9 : 0.65))
      : 0;
    return Math.min(22, growthValue * 0.74 + firstSlotPremium + zeroBaseFloor);
  }

  function scoreAiWeakCFinalFormulaPenalty(formulaId, player, slotIndex, thresholdValue, baseValue, growthPotentialScore, demand = {}) {
    if (formulaId !== "c1" && formulaId !== "c2") return 0;
    const roundNumber = Math.max(1, Math.round(aiNumber(turnState.roundNumber) || 1));
    const threshold = Math.max(0, aiNumber(thresholdValue));

    const cPipelineState = getAiFinalScoreCFormulaPipeline(formulaId, player, baseValue, demand);
    if (!cPipelineState) return 0;
    const slot = Math.max(1, Math.round(aiNumber(slotIndex) || 1));
    const currentBase = Math.max(0, cPipelineState.currentBase);
    const projectedBase = Math.max(currentBase, aiNumber(cPipelineState.projectedBase));
    const pipelineStrength = Math.max(0, cPipelineState.cPipeline + cPipelineState.demandPipeline);
    const earlySpeculativeWindow = threshold < 50 && roundNumber <= 2;
    if (earlySpeculativeWindow && currentBase > 0) return 0;
    const finalWindow = threshold >= 70 || roundNumber >= FINAL_ROUND_NUMBER;
    const lateWindowScale = finalWindow
      ? 1
      : threshold >= 50 || roundNumber >= 3
        ? 0.72
        : earlySpeculativeWindow
          ? (slot === 1 ? 0.55 : slot === 2 ? 0.32 : 0.22)
          : 0.38;
    if (lateWindowScale <= 0) return 0;

    const targetBase = earlySpeculativeWindow
      ? (formulaId === "c1"
        ? (slot === 1 ? 2.1 : slot === 2 ? 1.55 : 1.2)
        : (slot === 1 ? 1.65 : slot === 2 ? 1.25 : 1))
      : (formulaId === "c1"
        ? (slot === 1
          ? (finalWindow ? 4.5 : 4)
          : slot === 2
            ? (finalWindow ? 3.5 : 3)
            : (finalWindow ? 3 : 2.5))
        : (slot === 1
          ? (finalWindow ? 3.5 : 3)
          : slot === 2
            ? (finalWindow ? 3 : 2.5)
            : (finalWindow ? 2.4 : 2)));
    const realizedTarget = earlySpeculativeWindow
      ? (formulaId === "c1"
        ? (slot === 1 ? 0.9 : 0.7)
        : (slot === 1 ? 0.7 : 0.55))
      : (formulaId === "c1"
        ? (finalWindow ? 3 : 2.5)
        : (finalWindow ? 2.2 : 1.8));
    const shortfall = Math.max(0, targetBase - projectedBase);
    const realizedShortfall = Math.max(0, realizedTarget - currentBase);
    if (shortfall <= 0 && realizedShortfall <= 0) return 0;

    const weakPipelineLimit = earlySpeculativeWindow
      ? (formulaId === "c1" ? 0.9 : 0.75)
      : (formulaId === "c1"
        ? (finalWindow ? 1.8 : 1.35)
        : (finalWindow ? 1.45 : 1.1));
    let penalty = shortfall * (formulaId === "c1" ? 5.4 : 4.2) * lateWindowScale;
    penalty += realizedShortfall * (formulaId === "c1" ? 2.4 : 1.8) * lateWindowScale;

    if (pipelineStrength < weakPipelineLimit && currentBase < realizedTarget) {
      penalty += (formulaId === "c1" ? 5 : 3.5) * lateWindowScale;
    }
    if (finalWindow && currentBase <= (formulaId === "c1" ? 2 : 1) && projectedBase < targetBase) {
      penalty += (formulaId === "c1" ? 4 : 3) * lateWindowScale;
    }

    const growthValue = Math.max(0, aiNumber(growthPotentialScore));
    if (growthValue >= 6) penalty *= 0.48;
    else if (growthValue >= 4) penalty *= 0.65;
    else if (growthValue >= 2.5) penalty *= 0.82;

    if (slot >= 3) penalty *= 0.86;
    return Math.min(finalWindow ? 26 : 20, Math.max(0, penalty));
  }

  function getAiZeroBaseCFinalSpeculationScale(formulaId, player, slotIndex, thresholdValue, baseValue, demand = {}) {
    if (formulaId !== "c1" && formulaId !== "c2") return null;
    if (Math.max(0, aiNumber(baseValue)) > 0) return null;
    const cPipelineState = getAiFinalScoreCFormulaPipeline(formulaId, player, baseValue, demand);
    if (!cPipelineState) return null;

    const roundNumber = Math.max(1, Math.round(aiNumber(turnState.roundNumber) || 1));
    const threshold = Math.max(0, aiNumber(thresholdValue));
    const slot = Math.max(1, Math.round(aiNumber(slotIndex) || 1));
    const projectedBase = Math.max(0, aiNumber(cPipelineState.projectedBase));
    const cPipeline = Math.max(0, aiNumber(cPipelineState.cPipeline));
    const concretePipeline = Math.max(0,
      aiNumber(cPipelineState.completedTaskCount)
        + aiNumber(cPipelineState.reservedTaskCount)
        + aiNumber(cPipelineState.type3Reserved)
        + aiNumber(cPipelineState.handTaskCount) * 0.35
        + aiNumber(cPipelineState.type3InHand) * 0.3,
    );

    if (threshold <= 25 && roundNumber <= 2 && slot === 1) {
      const targetProjectedBase = formulaId === "c1" ? 2 : 2;
      if (projectedBase >= targetProjectedBase || concretePipeline >= targetProjectedBase + 0.35) return null;
      if (cPipeline >= (formulaId === "c1" ? 2 : 2.25)) return 0.34;
      if (cPipeline >= (formulaId === "c1" ? 1.25 : 1.35)) return 0.26;
      return 0.18;
    }

    if (threshold >= 50 || roundNumber >= 3) {
      if (projectedBase <= 0 && cPipeline < 1) return 0.08;
      if (projectedBase < (formulaId === "c1" ? 2 : 1) && cPipeline < 1.6) return 0.14;
    }

    return null;
  }

  function getAiB1FinalFormulaState(player) {
    const traceTypes = aliens?.TRACE_TYPES?.length ? aliens.TRACE_TYPES : ["yellow", "pink", "blue"];
    const counts = {};
    for (const traceType of traceTypes) {
      counts[traceType] = endGameScoring?.countTraceMarkers
        ? Math.max(0, Math.round(aiNumber(endGameScoring.countTraceMarkers(player, alienGameState, traceType))))
        : 0;
    }
    const values = traceTypes.map((traceType) => counts[traceType] || 0);
    const minTrace = values.length ? Math.min(...values) : 0;
    const totalTrace = values.reduce((total, count) => total + count, 0);
    const missingTypes = traceTypes.filter((traceType) => (counts[traceType] || 0) <= 0);
    return {
      counts,
      minTrace,
      totalTrace,
      missingTypes,
    };
  }

  function scoreAiB1FinalFormulaFeasibilityPenalty(
    formulaId,
    player,
    slotIndex,
    thresholdValue,
    baseValue,
    demand = {},
    b1State = null,
  ) {
    if (formulaId !== "b1" || !player) return 0;
    if (Math.max(0, aiNumber(baseValue)) > 0) return 0;

    const state = b1State || getAiB1FinalFormulaState(player);
    const missingTypes = state.missingTypes || [];
    if (!missingTypes.length) return 0;

    const threshold = Math.max(0, aiNumber(thresholdValue));
    const roundNumber = Math.max(1, Math.round(aiNumber(turnState.roundNumber) || 1));
    if (threshold < 50 && roundNumber <= 2) return 0;

    const slot = Math.max(1, Math.round(aiNumber(slotIndex) || 1));
    const totalTrace = Math.max(0, aiNumber(state.totalTrace));
    const allTraceDemand = sumAiDemandMap(demand.traceTypes);
    const missingTraceDemand = missingTypes.reduce((total, traceType) => (
      total + getAiMapDemand(demand.traceTypes, traceType)
    ), 0);
    const actionPipeline = getAiMapDemand(demand.actions, "analyze") * 0.45
      + getAiMapDemand(demand.actions, "land") * 0.32
      + getAiMapDemand(demand.actions, "scan") * 0.22
      + getAiMapDemand(demand.actions, "playCard") * 0.14;
    const tracePipeline = missingTraceDemand * 0.16 + allTraceDemand * 0.06 + actionPipeline;
    const lateScale = threshold >= 70 || roundNumber >= FINAL_ROUND_NUMBER
      ? 1.28
      : threshold >= 50 || roundNumber >= 3
        ? 1
        : 0.55;
    const slotScale = slot === 1 ? 1 : slot === 2 ? 0.82 : 0.62;
    let penalty = (
      5.8
      + missingTypes.length * 3
      + Math.max(0, 3 - totalTrace) * 0.85
    ) * lateScale * slotScale;

    if (threshold >= 70) penalty += 3 * lateScale;
    if (roundNumber >= FINAL_ROUND_NUMBER && missingTypes.length >= 2) penalty += 2.5 * lateScale;

    if (tracePipeline >= 5) penalty *= 0.58;
    else if (tracePipeline >= 3) penalty *= 0.74;
    else if (tracePipeline < 1.5) penalty += (1.5 - tracePipeline) * 1.4 * lateScale;

    return Math.round(Math.min(threshold >= 70 ? 26 : 18, Math.max(0, penalty)) * 100) / 100;
  }

  function getAiB2FinalFormulaState(player, context = {}) {
    if (!player || !endGameScoring) {
      return { orbitLandCount: 0, sectorWins: 0 };
    }
    return {
      orbitLandCount: endGameScoring.countOrbitOrLandMarkers
        ? Math.max(0, Math.round(aiNumber(endGameScoring.countOrbitOrLandMarkers(
          player,
          context.planetStatsState,
          context,
        ))))
        : 0,
      sectorWins: endGameScoring.countSectorWins
        ? Math.max(0, Math.round(aiNumber(endGameScoring.countSectorWins(
          player,
          context.nebulaDataState,
        ))))
        : 0,
    };
  }

  function scoreAiB2FinalFormulaFeasibilityPenalty(
    formulaId,
    player,
    slotIndex,
    thresholdValue,
    baseValue,
    demand = {},
    b2State = null,
  ) {
    if (formulaId !== "b2" || !player) return 0;
    if (Math.max(0, aiNumber(baseValue)) > 0) return 0;

    const state = b2State || getAiB2FinalFormulaState(player, createActionContext());
    const orbitLandCount = Math.max(0, aiNumber(state.orbitLandCount));
    const sectorWins = Math.max(0, aiNumber(state.sectorWins));
    const missingSectorSide = sectorWins <= 0;
    const missingOrbitLandSide = orbitLandCount <= 0;
    if (!missingSectorSide && !missingOrbitLandSide) return 0;

    const slot = Math.max(1, Math.round(aiNumber(slotIndex) || 1));
    const threshold = Math.max(0, aiNumber(thresholdValue));
    const roundNumber = Math.max(1, Math.round(aiNumber(turnState.roundNumber) || 1));
    const scanDemand = getAiMapDemand(demand.actions, "scan")
      + sumAiDemandMap(demand.scanColors) * 0.35
      + getAiMapDemand(demand.traceTypes, "pink") * 0.15
      + getAiMapDemand(demand.traceTypes, "blue") * 0.08;
    const routeDemand = getAiMapDemand(demand.actions, "orbit")
      + getAiMapDemand(demand.actions, "land")
      + getAiMapDemand(demand.actions, "move") * 0.35;
    const lateScale = threshold >= 70 || roundNumber >= FINAL_ROUND_NUMBER
      ? 1.35
      : threshold >= 50 || roundNumber >= 3
        ? 1.05
        : 0.82;
    const slotScale = slot === 1 ? 1 : slot === 2 ? 0.75 : 0.55;
    let penalty = 0;

    if (missingSectorSide) {
      const imbalance = Math.max(0, orbitLandCount - sectorWins);
      penalty += (7.5 + Math.min(6, imbalance * 1.35)) * lateScale * slotScale;
      if (scanDemand < 4) penalty += (4 - scanDemand) * 1.15 * lateScale;
      if (threshold <= 25 && roundNumber <= 2 && slot === 1 && routeDemand > scanDemand + 1) {
        penalty += 3.5;
      }
      if (threshold <= 25 && roundNumber <= 2 && scanDemand >= 7) {
        penalty *= 0.65;
      }
    }

    if (missingOrbitLandSide) {
      const movableRocketCount = typeof getMovableTokensForPlayer === "function"
        ? getMovableTokensForPlayer(player.id).length
        : 0;
      const routePipeline = routeDemand + movableRocketCount * 0.5;
      const imbalance = Math.max(0, sectorWins - orbitLandCount);
      penalty += (5.5 + Math.min(4, imbalance * 0.9)) * lateScale * slotScale;
      if (routePipeline < 3) penalty += (3 - routePipeline) * 0.9 * lateScale;
      if (threshold <= 25 && roundNumber <= 2 && routePipeline >= 6) {
        penalty *= 0.75;
      }
    }

    if (missingSectorSide && missingOrbitLandSide) penalty += 3 * lateScale;
    return Math.round(Math.min(threshold >= 50 ? 24 : 17, Math.max(0, penalty)) * 100) / 100;
  }

  function hasAiPlayerClaimedFinalThreshold(playerId, threshold) {
    if (!playerId) return false;
    return (finalScoring.listMarks?.(finalScoringState) || []).some((mark) => (
      mark?.playerId === playerId && Number(mark?.threshold) === Number(threshold)
    ));
  }

  const AI_B2_FINAL_TILE_RACE_SCORE_PER_ACTION = 8;
  const AI_B2_FINAL_TILE_RACE_OPPONENT_SCORE_WINDOW = 15;
  const AI_B2_FINAL_TILE_RACE_MAX_SCORE_ADJUSTMENT = 8;

  function scoreAiB2FinalTileRaceAdjustment(
    formulaId,
    slotIndex,
    opponentExpectedFirst,
    exclusiveValueAtRisk,
    weightedLegacyCompetitionScore,
    maxScoreAdjustment = 8,
  ) {
    const slot = Math.max(1, Math.round(Number(slotIndex) || 1));
    if (formulaId !== "b2" || slot >= 3 || !opponentExpectedFirst) return 0;
    const risk = Number(exclusiveValueAtRisk);
    const legacy = Number(weightedLegacyCompetitionScore);
    const cap = Math.max(0, Number(maxScoreAdjustment) || 0);
    const protectedValue = Math.min(cap, Number.isFinite(risk) ? Math.max(0, risk) : 0);
    return Math.min(
      cap,
      Math.max(0, protectedValue - (Number.isFinite(legacy) ? Math.max(0, legacy) : 0)),
    );
  }

  function getAiFinalTileRaceThresholds() {
    return Array.isArray(finalScoringState.thresholds) && finalScoringState.thresholds.length
      ? [...finalScoringState.thresholds]
      : [...(finalScoring.FINAL_SCORE_THRESHOLDS || [])];
  }

  function getAiFinalTileRaceTarget(player, options = {}) {
    if (!player) return null;
    const minimumThreshold = Math.max(0, aiNumber(options.minimumThreshold));
    const pending = (finalScoring.getPendingMarksForPlayer?.(finalScoringState, player.id) || [])
      .find((entry) => aiNumber(entry?.threshold) > minimumThreshold);
    if (pending) {
      return {
        threshold: aiNumber(pending.threshold),
        deficit: 0,
        pending: true,
      };
    }

    const score = Math.max(0, aiNumber(player.resources?.score));
    const threshold = getAiFinalTileRaceThresholds().find((entry) => (
      aiNumber(entry) > minimumThreshold
      && !hasAiPlayerClaimedFinalThreshold(player.id, entry)
    ));
    if (threshold == null) return null;
    return {
      threshold: aiNumber(threshold),
      deficit: Math.max(0, aiNumber(threshold) - score),
      pending: false,
    };
  }

  function estimateAiFinalTileRaceEta(target, orderAdjustment = 0) {
    if (!target) return Infinity;
    if (target.pending || aiNumber(target.deficit) <= 0) return 0;
    const actionCount = Math.max(
      1,
      Math.ceil(aiNumber(target.deficit) / AI_B2_FINAL_TILE_RACE_SCORE_PER_ACTION),
    );
    return Math.max(0, actionCount + aiNumber(orderAdjustment));
  }

  function getAiFinalTileRaceActionWindow(player) {
    if (!player?.id || !aiRaceModel?.buildActionWindowOrder) return [];
    const completedPlayerIds = [...(turnState.completedTurnPlayerIds || [])];
    if (!completedPlayerIds.some((playerId) => String(playerId) === String(player.id))) {
      completedPlayerIds.push(player.id);
    }
    return aiRaceModel.buildActionWindowOrder({
      ...turnState,
      completedTurnPlayerIds: completedPlayerIds,
    }, player.id);
  }

  function getAiB2FinalTileRaceBase(baseValue, b2State = null) {
    const currentBase = Math.max(0, aiNumber(baseValue));
    const orbitLandCount = Math.max(0, aiNumber(b2State?.orbitLandCount));
    const sectorWins = Math.max(0, aiNumber(b2State?.sectorWins));
    if (orbitLandCount === sectorWins) return Math.max(currentBase, orbitLandCount);
    const oneStepBase = orbitLandCount > sectorWins
      ? Math.min(orbitLandCount, sectorWins + 1)
      : Math.min(orbitLandCount + 1, sectorWins);
    return Math.max(currentBase, oneStepBase);
  }

  function buildAiB2FinalTileDeferRace(
    tileId,
    formulaId,
    slotIndex,
    player,
    pending,
    baseValue,
    b2State = null,
  ) {
    const currentSlot = Math.max(1, Math.round(aiNumber(slotIndex) || 1));
    if (
      formulaId !== "b2"
      || currentSlot >= 3
      || !player?.id
      || !pending
      || !aiRaceModel?.estimateRaceOutcome
      || !endGameScoring?.getSlotMultiplier
    ) return null;

    const currentMultiplier = Math.max(
      0,
      aiNumber(endGameScoring.getSlotMultiplier(formulaId, currentSlot)),
    );
    const fallbackMultiplier = Math.max(
      0,
      aiNumber(endGameScoring.getSlotMultiplier(formulaId, currentSlot + 1)),
    );
    const multiplierGap = Math.max(0, currentMultiplier - fallbackMultiplier);
    if (multiplierGap <= 0) return null;

    const actionWindowOpponentIds = getAiFinalTileRaceActionWindow(player);
    const actionWindowIndexById = new Map(actionWindowOpponentIds.map((playerId, index) => (
      [String(playerId), index]
    )));
    const actorTarget = getAiFinalTileRaceTarget(player, {
      minimumThreshold: aiNumber(pending.threshold),
    });
    const actorEta = estimateAiFinalTileRaceEta(actorTarget);
    const activeIds = Array.isArray(turnState.activePlayerIds) && turnState.activePlayerIds.length
      ? turnState.activePlayerIds
      : playerState.players.map((entry) => entry.id).filter(Boolean);
    const activeIdSet = new Set(activeIds.map((playerId) => String(playerId)));
    const passedIdSet = new Set((turnState.passedPlayerIds || []).map((playerId) => String(playerId)));
    const opponentEtas = [];

    for (const opponent of playerState.players || []) {
      if (!opponent?.id || String(opponent.id) === String(player.id)) continue;
      if (activeIdSet.size && !activeIdSet.has(String(opponent.id))) continue;
      if (passedIdSet.has(String(opponent.id))) continue;
      if (finalScoring.hasPlayerMarkedTile?.(finalScoringState, tileId, opponent.id)) continue;

      const target = getAiFinalTileRaceTarget(opponent);
      if (!target) continue;
      if (!target.pending && aiNumber(target.deficit) > AI_B2_FINAL_TILE_RACE_OPPONENT_SCORE_WINDOW) continue;
      const actionWindowIndex = actionWindowIndexById.get(String(opponent.id));
      const actsBeforeActorNext = actionWindowIndex != null;
      const orderAdjustment = target.pending ? 0 : (actsBeforeActorNext ? -0.25 : 0.25);
      opponentEtas.push({
        playerId: opponent.id,
        eta: estimateAiFinalTileRaceEta(target, orderAdjustment),
        threshold: target.threshold,
        scoreDeficit: target.deficit,
        pending: target.pending,
        actionWindowIndex: actsBeforeActorNext ? actionWindowIndex : null,
        actsBeforeActorNext,
      });
    }

    const raceBase = getAiB2FinalTileRaceBase(baseValue, b2State);
    const exclusiveValue = raceBase * currentMultiplier;
    const fallbackValue = raceBase * fallbackMultiplier;
    const outcome = aiRaceModel.estimateRaceOutcome({
      actorEta,
      opponentEtas,
      reusableValue: 0,
      exclusiveValue,
      fallbackValue,
    });
    const opponentExpectedFirst = Boolean(outcome?.contested && !outcome?.actorWins);
    const protectedValue = opponentExpectedFirst
      ? Math.min(
        AI_B2_FINAL_TILE_RACE_MAX_SCORE_ADJUSTMENT,
        Math.max(0, aiNumber(outcome?.exclusiveValueAtRisk)),
      )
      : 0;

    return {
      tileId,
      formulaId,
      slotIndex: currentSlot,
      etaBasis: `public-score-deficit-per-${AI_B2_FINAL_TILE_RACE_SCORE_PER_ACTION}-points`,
      opponentScoreWindow: AI_B2_FINAL_TILE_RACE_OPPONENT_SCORE_WINDOW,
      actionWindowOpponentIds,
      actorTarget,
      actorEta: Number.isFinite(actorEta) ? actorEta : null,
      actorUnreachable: !Number.isFinite(actorEta),
      opponentEtas,
      outcome: outcome?.outcome || null,
      fastestOpponentEta: Number.isFinite(outcome?.fastestOpponentEta)
        ? outcome.fastestOpponentEta
        : null,
      fastestOpponentIds: outcome?.fastestOpponentIds || [],
      currentMultiplier,
      fallbackMultiplier,
      multiplierGap,
      raceBase,
      reusableValue: 0,
      exclusiveValue,
      fallbackValue,
      raceAdjustedValue: aiNumber(outcome?.raceAdjustedValue),
      exclusiveValueAtRisk: Math.max(0, aiNumber(outcome?.exclusiveValueAtRisk)),
      opponentExpectedFirst,
      protectedValue,
      maxScoreAdjustment: AI_B2_FINAL_TILE_RACE_MAX_SCORE_ADJUSTMENT,
    };
  }

  function scoreAiFinalScoreTileCompetition(tileId, formulaId, slotIndex, player, context) {
    if (!tileId || !formulaId || !player || !endGameScoring?.getSlotMultiplier) return 0;
    const currentSlot = Math.max(1, Math.round(aiNumber(slotIndex) || 1));
    if (currentSlot >= 3) return 0;
    const currentMultiplier = Math.max(0, aiNumber(endGameScoring.getSlotMultiplier(formulaId, currentSlot)));
    const nextMultiplier = Math.max(0, aiNumber(endGameScoring.getSlotMultiplier(formulaId, currentSlot + 1)));
    const multiplierGap = Math.max(0, currentMultiplier - nextMultiplier);
    if (multiplierGap <= 0) return 0;

    const thresholds = Array.isArray(finalScoringState.thresholds) && finalScoringState.thresholds.length
      ? finalScoringState.thresholds
      : finalScoring.FINAL_SCORE_THRESHOLDS || [];
    let score = 0;
    const activeIds = Array.isArray(turnState.activePlayerIds) && turnState.activePlayerIds.length
      ? turnState.activePlayerIds
      : playerState.players.map((entry) => entry.id).filter(Boolean);

    for (const opponentId of activeIds) {
      if (!opponentId || opponentId === player.id) continue;
      const opponent = getPlayerById(opponentId);
      if (!opponent) continue;
      if (finalScoring.hasPlayerMarkedTile?.(finalScoringState, tileId, opponent.id)) continue;

      const opponentScore = Math.max(0, aiNumber(opponent.resources?.score));
      const nextThreshold = thresholds.find((threshold) => (
        opponentScore < aiNumber(threshold)
        && !hasAiPlayerClaimedFinalThreshold(opponent.id, threshold)
      )) || null;
      const pendingCount = finalScoring.getPendingMarksForPlayer?.(finalScoringState, opponent.id)?.length || 0;
      let readiness = pendingCount > 0 ? 1.15 : 0;
      if (nextThreshold != null) {
        const deficit = Math.max(0, aiNumber(nextThreshold) - opponentScore);
        if (deficit <= 0) readiness = Math.max(readiness, 1.15);
        else if (deficit <= 8) readiness = Math.max(readiness, 0.75);
        else if (deficit <= 15 && Math.max(1, Math.round(aiNumber(turnState.roundNumber) || 1)) >= 3) {
          readiness = Math.max(readiness, 0.4);
        }
      }
      if (readiness <= 0) continue;

      const opponentBase = Math.max(0, aiNumber(endGameScoring.getFormulaBaseValue(
        formulaId,
        opponent,
        context,
        { getCardTypeCode },
      )));
      const formulaPotential = getAiFinalScoreFormulaPotential(formulaId);
      const immediateSwing = opponentBase * multiplierGap;
      const slotUrgency = currentSlot === 1 ? 5 : 2.2;
      score += readiness * Math.min(
        18,
        slotUrgency + immediateSwing * 0.45 + formulaPotential * 0.75,
      );
    }

    return score;
  }

  function getAiFinalScoreTileCandidate(tileId, player = getCurrentPlayer()) {
    if (!tileId || !player || !finalScoring?.canMarkTile || !endGameScoring?.getFormulaId) {
      return null;
    }
    const pending = finalScoring.getNextPendingMarkForPlayer(finalScoringState, player.id);
    if (!pending) return null;

    const check = finalScoring.canMarkTile(finalScoringState, tileId, player);
    if (!check.ok) {
      return {
        tileId,
        available: false,
        reason: check.message || "不可标记",
      };
    }

    const variant = finalScoring.getTileVariant(finalScoringState, tileId);
    const formulaId = endGameScoring.getFormulaId(tileId, variant);
    const context = {
      ...createActionContext(),
      finalScoringState,
      cardEffects,
      getCardTypeCode,
    };
    const baseValue = Math.max(0, aiNumber(endGameScoring.getFormulaBaseValue(
      formulaId,
      player,
      context,
      { getCardTypeCode },
    )));
    const multiplier = Math.max(0, aiNumber(endGameScoring.getSlotMultiplier(formulaId, check.slotIndex)));
    const immediateScore = baseValue * multiplier;
    const demand = getAiStrategyDemand(player);
    const demandScore = scoreAiFinalScoreFormulaDemand(formulaId, demand);
    const b1FormulaState = formulaId === "b1" ? getAiB1FinalFormulaState(player) : null;
    const b2FormulaState = formulaId === "b2" ? getAiB2FinalFormulaState(player, context) : null;
    const cFormulaPipeline = (formulaId === "c1" || formulaId === "c2")
      ? getAiFinalScoreCFormulaPipeline(formulaId, player, baseValue, demand)
      : null;
    const thresholds = Array.isArray(finalScoringState.thresholds) && finalScoringState.thresholds.length
      ? finalScoringState.thresholds
      : finalScoring.FINAL_SCORE_THRESHOLDS || [];
    const lastThreshold = Math.max(...thresholds.map((threshold) => aiNumber(threshold)));
    const isLastThreshold = aiNumber(pending.threshold) >= lastThreshold;
    const roundNumber = aiNumber(turnState.roundNumber);
    const thresholdValue = aiNumber(pending.threshold);
    const isLateMarker = isLastThreshold || roundNumber >= 4;
    const speculationScale = isLateMarker ? 0.35 : 1;
    const rawCurrentBaseSpeculationScale = baseValue > 0
      ? 1
      : (isLateMarker || thresholdValue >= 50)
        ? 0.18
        : roundNumber >= 3
          ? 0.1
          : 0.45;
    const zeroBaseCSpeculationScale = getAiZeroBaseCFinalSpeculationScale(
      formulaId,
      player,
      check.slotIndex,
      thresholdValue,
      baseValue,
      demand,
    );
    const currentBaseSpeculationScale = zeroBaseCSpeculationScale == null
      ? rawCurrentBaseSpeculationScale
      : Math.min(rawCurrentBaseSpeculationScale, zeroBaseCSpeculationScale);
    const effectiveSpeculationScale = speculationScale * currentBaseSpeculationScale;
    const secondSlotSpeculationScale = baseValue > 0
      ? Math.max(0.5, effectiveSpeculationScale)
      : Math.max(0.25, effectiveSpeculationScale);
    const immediateScoreWeight = isLateMarker ? 2.25 : 1;
    const remainingRoundWeight = Math.min(1.6, 0.7 + getAiRemainingRoundWeight() * 0.15);
    const formulaPotentialScore = getAiFinalScoreFormulaPotential(formulaId) * remainingRoundWeight * effectiveSpeculationScale;
    const incomePotentialScore = 0;
    const growthSpeculationFloor = (
      (formulaId === "c1" || formulaId === "c2")
      && baseValue <= 0
    )
      ? Math.max(0.08, currentBaseSpeculationScale)
      : 0.45;
    const growthPotentialScore = scoreAiFinalScoreFormulaGrowth(
      formulaId,
      player,
      check.slotIndex,
      baseValue,
      demand,
    ) * Math.max(growthSpeculationFloor, effectiveSpeculationScale);
    const potentialScore = formulaPotentialScore + incomePotentialScore + growthPotentialScore;
    const firstSlotPriorityScore = Number(check.slotIndex) === 1
      ? 14 * effectiveSpeculationScale
      : Number(check.slotIndex) === 2
        ? 3 * secondSlotSpeculationScale
        : 0;
    const familyPriorityScore = tileId === "c" || tileId === "d" ? 3.5 * effectiveSpeculationScale : 0;
    const activeOpponentCount = (turnState.activePlayerIds || [])
      .filter((playerId) => playerId && playerId !== player.id)
      .length;
    const competitiveSlotSwingScore = Number(check.slotIndex) === 1
      ? (8 + activeOpponentCount * 2.5 + Math.min(8, potentialScore * 0.85 + immediateScore * 0.18)) * effectiveSpeculationScale
      : Number(check.slotIndex) === 2
        ? (2 + activeOpponentCount * 0.8 + Math.min(3.5, potentialScore * 0.35)) * secondSlotSpeculationScale
        : 0;
    const opponentCompetitionScore = scoreAiFinalScoreTileCompetition(
      tileId,
      formulaId,
      check.slotIndex,
      player,
      context,
    ) * Math.max(0.35, effectiveSpeculationScale);
    const finalTileRace = buildAiB2FinalTileDeferRace(
      tileId,
      formulaId,
      check.slotIndex,
      player,
      pending,
      baseValue,
      b2FormulaState,
    );
    const slotPriorityScore = firstSlotPriorityScore
      + familyPriorityScore
      + competitiveSlotSwingScore
      + Math.max(0, 3 - Number(check.slotIndex || 3)) * 1.15
      + multiplier * 0.18;
    const thresholdScore = Math.max(0, aiNumber(pending.threshold)) * 0.015;
    const rawZeroBaseLatePenalty = aiValuation?.estimateFinalTileZeroBasePenalty
      ? aiValuation.estimateFinalTileZeroBasePenalty({
        formulaId,
        baseValue,
        threshold: thresholdValue,
        roundNumber,
        finalRoundNumber: FINAL_ROUND_NUMBER,
        slotIndex: check.slotIndex,
      })
      : 0;
    const zeroBaseLatePenalty = (
      (formulaId === "c1" || formulaId === "c2")
      && growthPotentialScore > 0
    )
      ? rawZeroBaseLatePenalty * (formulaId === "c1" ? 0.72 : 0.45)
      : rawZeroBaseLatePenalty;
    const unsupportedCFormulaPenalty = (
      (formulaId === "c1" || formulaId === "c2")
      && baseValue <= 0
      && growthPotentialScore < 1
    )
      ? (isLateMarker ? 18 : thresholdValue >= 50 ? 14 : 8)
      : 0;
    const weakCFormulaPenalty = scoreAiWeakCFinalFormulaPenalty(
      formulaId,
      player,
      check.slotIndex,
      thresholdValue,
      baseValue,
      growthPotentialScore,
      demand,
    );
    const b1FeasibilityPenalty = scoreAiB1FinalFormulaFeasibilityPenalty(
      formulaId,
      player,
      check.slotIndex,
      thresholdValue,
      baseValue,
      demand,
      b1FormulaState,
    );
    const b2FeasibilityPenalty = scoreAiB2FinalFormulaFeasibilityPenalty(
      formulaId,
      player,
      check.slotIndex,
      thresholdValue,
      baseValue,
      demand,
      b2FormulaState,
    );
    const weightedScore = applyAiStrategyWeight(
      immediateScore * immediateScoreWeight
        + demandScore
        + potentialScore
        + slotPriorityScore
        + opponentCompetitionScore
        + thresholdScore
        - zeroBaseLatePenalty
        - unsupportedCFormulaPenalty
        - weakCFormulaPenalty
        - b1FeasibilityPenalty
        - b2FeasibilityPenalty,
      "final",
      0.85,
    );
    const weightedLegacyCompetitionScore = applyAiStrategyWeight(
      opponentCompetitionScore,
      "final",
      0.85,
    );
    const finalTileRaceScoreAdjustment = scoreAiB2FinalTileRaceAdjustment(
      formulaId,
      check.slotIndex,
      finalTileRace?.opponentExpectedFirst,
      finalTileRace?.exclusiveValueAtRisk,
      weightedLegacyCompetitionScore,
      AI_B2_FINAL_TILE_RACE_MAX_SCORE_ADJUSTMENT,
    );
    const score = weightedScore + finalTileRaceScoreAdjustment;

    return {
      tileId,
      variant,
      formulaId,
      available: true,
      slotIndex: check.slotIndex,
      threshold: pending.threshold,
      baseValue,
      multiplier,
      immediateScore: Math.round(immediateScore * 100) / 100,
      score: Math.round(score * 100) / 100,
      scoreBreakdown: {
        immediateScore: Math.round(immediateScore * 100) / 100,
        immediateScoreWeight: Math.round(immediateScoreWeight * 100) / 100,
        demandScore: Math.round(demandScore * 100) / 100,
        potentialScore: Math.round(potentialScore * 100) / 100,
        formulaPotentialScore: Math.round(formulaPotentialScore * 100) / 100,
        incomePotentialScore: Math.round(incomePotentialScore * 100) / 100,
        growthPotentialScore: Math.round(growthPotentialScore * 100) / 100,
        speculationScale: Math.round(speculationScale * 100) / 100,
        rawCurrentBaseSpeculationScale: Math.round(rawCurrentBaseSpeculationScale * 100) / 100,
        zeroBaseCSpeculationScale: zeroBaseCSpeculationScale == null
          ? null
          : Math.round(zeroBaseCSpeculationScale * 100) / 100,
        currentBaseSpeculationScale: Math.round(currentBaseSpeculationScale * 100) / 100,
        effectiveSpeculationScale: Math.round(effectiveSpeculationScale * 100) / 100,
        slotPriorityScore: Math.round(slotPriorityScore * 100) / 100,
        firstSlotPriorityScore: Math.round(firstSlotPriorityScore * 100) / 100,
        familyPriorityScore: Math.round(familyPriorityScore * 100) / 100,
        competitiveSlotSwingScore: Math.round(competitiveSlotSwingScore * 100) / 100,
        opponentCompetitionScore: Math.round(opponentCompetitionScore * 100) / 100,
        weightedLegacyCompetitionScore: Math.round(weightedLegacyCompetitionScore * 100) / 100,
        finalTileRaceScoreAdjustment: Math.round(finalTileRaceScoreAdjustment * 100) / 100,
        finalTileRace,
        thresholdScore: Math.round(thresholdScore * 100) / 100,
        rawZeroBaseLatePenalty: Math.round(rawZeroBaseLatePenalty * 100) / 100,
        zeroBaseLatePenalty: Math.round(zeroBaseLatePenalty * 100) / 100,
        unsupportedCFormulaPenalty: Math.round(unsupportedCFormulaPenalty * 100) / 100,
        weakCFormulaPenalty: Math.round(weakCFormulaPenalty * 100) / 100,
        b1FeasibilityPenalty: Math.round(b1FeasibilityPenalty * 100) / 100,
        b1TraceCounts: b1FormulaState ? b1FormulaState.counts : null,
        b1MissingTraceTypes: b1FormulaState ? b1FormulaState.missingTypes : [],
        b2FeasibilityPenalty: Math.round(b2FeasibilityPenalty * 100) / 100,
        b2OrbitLandCount: b2FormulaState ? b2FormulaState.orbitLandCount : 0,
        b2SectorWins: b2FormulaState ? b2FormulaState.sectorWins : 0,
        cFormulaPipeline,
      },
    };
  }

  function listAiFinalScoreTileCandidates(player = getCurrentPlayer()) {
    return FINAL_SCORE_IDS
      .map((tileId) => getAiFinalScoreTileCandidate(tileId, player))
      .filter(Boolean)
      .sort((left, right) => (
        aiNumber(right.score) - aiNumber(left.score)
        || aiNumber(right.immediateScore) - aiNumber(left.immediateScore)
        || String(left.tileId).localeCompare(String(right.tileId))
      ));
  }

  function runAiFinalScoreMarkDecision() {
    syncFinalScorePendingMarks();
    const currentPlayer = getCurrentPlayer();
    const pending = finalScoring.getNextPendingMarkForPlayer(finalScoringState, currentPlayer?.id);
    if (!pending) return null;
    if (!isAiAutoBattlePlayer(currentPlayer?.id)) {
      return {
        ok: false,
        blocked: true,
        message: `${currentPlayer?.colorLabel || "当前玩家"}需要人工选择终局计分板块`,
      };
    }

    const candidates = listAiFinalScoreTileCandidates(currentPlayer);
    const selected = candidates.find((candidate) => candidate.available);
    if (!selected) {
      return {
        ok: false,
        blocked: true,
        message: `${currentPlayer.colorLabel}AI 没有可标记的终局计分板块`,
      };
    }

    const result = handleFinalScoreTileClick(selected.tileId);
    recordAiAutoBattleLog("final-score-mark", `${currentPlayer.colorLabel}AI 标记终局板块 ${selected.tileId.toUpperCase()}`, {
      pending,
      selected,
      candidates,
      mark: result.mark || null,
    });
    return result;
  }
    return {
      getAiFinalScoreTileCandidate,
      listAiFinalScoreTileCandidates,
      runAiFinalScoreMarkDecision,
      scoreAiB2FinalTileRaceAdjustment,
    };
  }

  return {
    createFinalScoreAiRuntime,
  };
});
