(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAIFinalPace = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createFinalPace(context = {}) {
    const {
      players,
      finalScoring,
      endGameScoring,
      industry,
      scanEffects,
      cardEffects,
      data,
      aliens,
      fangzhou,
      ai,
      DEFAULT_ACTIVE_PLAYER_COUNT,
      FINAL_ROUND_NUMBER,
      MOVE_ENERGY_COST,
    } = context;
    const readRuleRoot = () => {
      const workingRoot = context.getRuleReadout?.();
      if (!workingRoot) throw new TypeError("AI final pace requires a StateSource rule readout");
      return workingRoot;
    };
    const aiNumber = (...args) => context.aiNumber(...args);
    const computePlayerFinalScoreBreakdown = (...args) => context.computePlayerFinalScoreBreakdown(...args);
    const countAiPlayerTech = (...args) => context.countAiPlayerTech(...args);
    const createActionContext = (...args) => context.createActionContext(...args);
    const getAiAvailableDataRoom = (...args) => context.getAiAvailableDataRoom(...args);
    const getAiB2SectorBottleneck = (...args) => context.getAiB2SectorBottleneck(...args);
    const getAiBestRevealedAlienTraceDirectScoreForSlot = (...args) => context.getAiBestRevealedAlienTraceDirectScoreForSlot(...args);
    const getAiBestSatelliteLandingOpportunity = (...args) => context.getAiBestSatelliteLandingOpportunity(...args);
    const getAiMapDemand = (...args) => context.getAiMapDemand(...args);
    const getAiPlanetAtCoordinate = (...args) => context.getAiPlanetAtCoordinate(...args);
    const getAiResourceValuesForRound = (...args) => context.getAiResourceValuesForRound(...args);
    const getAiStrategyDemand = (...args) => context.getAiStrategyDemand(...args);
    const getCardPlayCost = (...args) => context.getCardPlayCost(...args);
    const getCardTypeCode = (...args) => context.getCardTypeCode(...args);
    const getCurrentPlayer = (...args) => context.getCurrentPlayer(...args);
    const isAiAlienMainPlayCard = (...args) => context.isAiAlienMainPlayCard(...args);
    const isMovePaymentCard = (...args) => context.isMovePaymentCard(...args);
    const roundAiScore = (...args) => context.roundAiScore(...args);
    const scoreAiFollowupMainActionAfterMove = (...args) => context.scoreAiFollowupMainActionAfterMove(...args);
    const scoreAiResourceBundle = (...args) => context.scoreAiResourceBundle(...args);

    function getAiMovePaymentCards(player = getCurrentPlayer()) {
      return (player?.hand || []).filter((card) => isMovePaymentCard(card));
    }

    function getAiLaunchPaymentCost(options = {}) {
      return ai?.valuation?.getLaunchPaymentCost
        ? ai.valuation.getLaunchPaymentCost(options)
        : (options?.skipCost ? {} : (options?.cost || { credits: 2 }));
    }

    function scoreAiLaunchPaymentCost(options = {}) {
      return scoreAiResourceBundle(getAiLaunchPaymentCost(options));
    }

    function estimateAiMovePayment(player = getCurrentPlayer(), requiredMovePoints = MOVE_ENERGY_COST, options = {}) {
      const points = Math.max(0, Math.round(aiNumber(requiredMovePoints)));
      const values = getAiResourceValuesForRound();
      const energy = Math.max(0, Math.round(aiNumber(player?.resources?.energy)));
      const cardCount = getAiMovePaymentCards(player).length;
      const preserveEnergy = Boolean(options.preserveEnergy);
      let remainingEnergy = energy;
      let remainingCards = cardCount;
      let total = 0;
      let energySpent = 0;
      let cardSpent = 0;
      for (let point = 0; point < points; point += 1) {
        if (remainingCards > 0 && (preserveEnergy || remainingEnergy <= 0)) {
          total += values.handSize;
          remainingCards -= 1;
          cardSpent += 1;
        } else if (remainingEnergy > 0) {
          total += values.energy;
          remainingEnergy -= 1;
          energySpent += 1;
        } else {
          total += values.energy;
          energySpent += 1;
        }
      }
      return {
        cost: total,
        energySpent,
        cardSpent,
        remainingEnergy: Math.max(0, energy - energySpent),
      };
    }

    function shouldAiPreserveEnergyForSatelliteRoute(player, coordinate, options = {}) {
      if (!player || !coordinate || !players.playerOwnsTech(player, "orange4", createActionContext())) return false;
      const planet = options.planet || getAiPlanetAtCoordinate(coordinate);
      const routeTarget = options.routeTarget || null;
      const targetPlanetId = planet?.planetId || (routeTarget?.kind === "planet" ? routeTarget.id : null);
      if (!targetPlanetId) return false;
      const distance = planet
        ? 0
        : Math.max(0, Math.round(aiNumber(routeTarget?.newDistance)));
      if (distance > 1) return false;
      const opportunity = getAiBestSatelliteLandingOpportunity(targetPlanetId, player, { routeDistance: distance });
      if (!opportunity || opportunity.directScore < 10 || aiNumber(opportunity.score) <= 0) return false;
      const requiredMovePoints = Math.max(0, Math.round(aiNumber(options.requiredMovePoints ?? MOVE_ENERGY_COST)));
      const currentEnergy = Math.max(0, Math.round(aiNumber(player?.resources?.energy)));
      const energyAfterDefaultPayment = Math.max(0, currentEnergy - Math.min(currentEnergy, requiredMovePoints));
      return energyAfterDefaultPayment < opportunity.energyCost;
    }

    function shouldAiPreserveEnergyForPlanetCashout(player, coordinate, options = {}) {
      if (!player || !coordinate) return false;
      const requiredMovePoints = Math.max(0, Math.round(aiNumber(options.requiredMovePoints ?? MOVE_ENERGY_COST)));
      if (requiredMovePoints <= 0) return false;
      const currentEnergy = Math.max(0, Math.round(aiNumber(player?.resources?.energy)));
      if (currentEnergy <= 0 || getAiMovePaymentCards(player).length <= 0) return false;
      const routeTarget = options.routeTarget || null;
      const planet = options.planet || getAiPlanetAtCoordinate(coordinate);
      const arrivesAtPlanet = Boolean(planet)
        || (routeTarget?.kind === "planet" && Math.max(0, Math.round(aiNumber(routeTarget?.newDistance))) === 0);
      if (!arrivesAtPlanet) return false;
      const defaultPayment = estimateAiMovePayment(player, requiredMovePoints, { preserveEnergy: false });
      const preservedPayment = estimateAiMovePayment(player, requiredMovePoints, { preserveEnergy: true });
      if (preservedPayment.remainingEnergy <= defaultPayment.remainingEnergy) return false;
      const playerAfterPreservedMove = {
        ...player,
        resources: {
          ...(player.resources || {}),
          energy: preservedPayment.remainingEnergy,
        },
      };
      const followup = scoreAiFollowupMainActionAfterMove(coordinate, playerAfterPreservedMove, {
        ignoreMainActionUsed: true,
      });
      return Math.max(0, aiNumber(followup.score)) >= 8;
    }

    function shouldAiPreserveEnergyForRouteCashout(player, coordinate, options = {}) {
      return shouldAiPreserveEnergyForSatelliteRoute(player, coordinate, options)
        || shouldAiPreserveEnergyForPlanetCashout(player, coordinate, options);
    }

    function scoreAiMovePaymentCost(player = getCurrentPlayer(), requiredMovePoints = MOVE_ENERGY_COST) {
      if (ai?.valuation?.getMovePaymentCost) {
        return ai.valuation.getMovePaymentCost({
          player,
          hand: player?.hand || [],
          movePaymentCards: getAiMovePaymentCards(player),
          availableEnergy: player?.resources?.energy || 0,
          requiredMovePoints,
          resourceValues: getAiResourceValuesForRound(),
        });
      }
      return estimateAiMovePayment(player, requiredMovePoints).cost;
    }

    function countAiFinalMarksForPlayer(player = getCurrentPlayer()) {
      if (!player) return 0;
      const { finalScoringState } = readRuleRoot();
      finalScoring.ensureFinalScoringState(finalScoringState);
      return Object.values(finalScoringState.tiles || {})
        .reduce((total, tile) => (
          total + (tile?.marks || []).filter((mark) => (
            mark?.playerId === player.id || mark?.playerColor === player.color || mark?.color === player.color
          )).length
        ), 0);
    }

    function getAiActiveOpponentCount(player = getCurrentPlayer()) {
      if (!player) return 0;
      const { playerState, turnState } = readRuleRoot();
      const activeIds = Array.isArray(turnState.activePlayerIds) && turnState.activePlayerIds.length
        ? turnState.activePlayerIds
        : (playerState.players || []).slice(0, Math.max(1, Math.round(aiNumber(turnState.activePlayerCount) || DEFAULT_ACTIVE_PLAYER_COUNT))).map((item) => item.id);
      return activeIds
        .filter((playerId) => playerId && playerId !== player.id)
        .length;
    }

    function getAiMarkedFinalFormulaEntries(player = getCurrentPlayer()) {
      if (!player || !endGameScoring?.getFormulaId || !finalScoring?.getTileVariant) return [];
      const { finalScoringState } = readRuleRoot();
      finalScoring.ensureFinalScoringState(finalScoringState);
      return Object.values(finalScoringState.tiles || {}).flatMap((tile) => {
        const variant = finalScoring.getTileVariant(finalScoringState, tile.id);
        const formulaId = endGameScoring.getFormulaId(tile.id, variant);
        return (tile.marks || [])
          .filter((mark) => (
            mark?.playerId === player.id
            || mark?.playerColor === player.color
            || mark?.color === player.color
          ))
          .map((mark) => ({
            tileId: tile.id,
            variant,
            formulaId,
            slotIndex: mark.slotIndex,
            multiplier: endGameScoring.getSlotMultiplier(formulaId, mark.slotIndex),
            threshold: mark.threshold,
          }));
      });
    }

    function getAiFinalFormulaProgressForPlayer(player = getCurrentPlayer(), entries = null) {
      const markedEntries = Array.isArray(entries) ? entries : getAiMarkedFinalFormulaEntries(player);
      if (!player || !markedEntries.length || !endGameScoring?.getFormulaBaseValue) {
        return { entries: [], b2: null };
      }
      const context = createActionContext();
      const { nebulaDataState, planetStatsState } = readRuleRoot();
      const progressEntries = markedEntries.map((entry) => {
        const baseValue = Math.max(0, aiNumber(endGameScoring.getFormulaBaseValue(
          entry.formulaId,
          player,
          context,
          { getCardTypeCode },
        )));
        const multiplier = Math.max(0, aiNumber(entry.multiplier));
        return {
          tileId: entry.tileId,
          variant: entry.variant,
          formulaId: entry.formulaId,
          slotIndex: entry.slotIndex,
          multiplier,
          threshold: entry.threshold,
          baseValue: roundAiScore(baseValue),
          score: roundAiScore(baseValue * multiplier),
        };
      });
      let b2 = null;
      const b2Entries = progressEntries.filter((entry) => entry.formulaId === "b2");
      if (b2Entries.length && endGameScoring?.countSectorWins && endGameScoring?.countOrbitOrLandMarkers) {
        const sectorWins = Math.max(0, Math.round(aiNumber(endGameScoring.countSectorWins(player, nebulaDataState))));
        const orbitLandCount = Math.max(0, Math.round(aiNumber(
          endGameScoring.countOrbitOrLandMarkers(player, planetStatsState, context),
        )));
        const baseValue = Math.min(sectorWins, orbitLandCount);
        const multiplier = Math.min(10, b2Entries.reduce((total, entry) => total + Math.max(0, aiNumber(entry.multiplier)), 0));
        b2 = {
          sectorWins,
          orbitLandCount,
          baseValue,
          multiplier: roundAiScore(multiplier),
          score: roundAiScore(baseValue * multiplier),
          sectorWinDeficit: Math.max(0, orbitLandCount - sectorWins),
          orbitLandDeficit: Math.max(0, sectorWins - orbitLandCount),
          bottleneck: sectorWins < orbitLandCount
            ? "sectorWins"
            : orbitLandCount < sectorWins
              ? "orbitLand"
              : "balanced",
        };
      }
      return {
        entries: progressEntries,
        b2,
      };
    }

    function getAiNextFinalTileSlotIndex(tile) {
      const marks = tile?.marks || [];
      if (!marks.some((mark) => Number(mark.slotIndex) === 1)) return 1;
      if (!marks.some((mark) => Number(mark.slotIndex) === 2)) return 2;
      return 3;
    }

    function getAiPotentialFinalFormulaEntries(player = getCurrentPlayer(), formulaIds = []) {
      if (!player || !endGameScoring?.getFormulaId || !finalScoring?.getTileVariant) return [];
      if (countAiFinalMarksForPlayer(player) >= 3) return [];
      const wanted = new Set((formulaIds || []).filter(Boolean));
      const { finalScoringState } = readRuleRoot();
      finalScoring.ensureFinalScoringState(finalScoringState);
      const round = getAiRoundNumber();
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      const nextThreshold = getAiNextMissingFinalScoreThreshold(player);
      const thresholdDistance = nextThreshold == null ? 0 : Math.max(0, nextThreshold - currentScore);
      const roundScale = round >= FINAL_ROUND_NUMBER ? 0.72 : round >= 3 ? 0.6 : 0.44;
      const distanceScale = nextThreshold == null
        ? 0.35
        : thresholdDistance <= 0
          ? 1
          : thresholdDistance <= 10
            ? 0.9
            : thresholdDistance <= 25
              ? 0.65
              : 0.38;

      return Object.values(finalScoringState.tiles || {}).flatMap((tile) => {
        if (!tile || finalScoring.hasPlayerMarkedTile?.(finalScoringState, tile.id, player.id)) return [];
        const variant = finalScoring.getTileVariant(finalScoringState, tile.id);
        const formulaId = endGameScoring.getFormulaId(tile.id, variant);
        if (wanted.size && !wanted.has(formulaId)) return [];
        const slotIndex = getAiNextFinalTileSlotIndex(tile);
        const rawMultiplier = Math.max(0, aiNumber(endGameScoring.getSlotMultiplier(formulaId, slotIndex)));
        if (rawMultiplier <= 0) return [];
        const slotScale = slotIndex === 1 ? 1 : slotIndex === 2 ? 0.72 : 0.42;
        const formulaScale = formulaId === "c1" || formulaId === "c2" ? 0.82 : 1;
        const scale = Math.min(0.95, Math.max(0.12, roundScale * distanceScale * slotScale * formulaScale));
        return [{
          tileId: tile.id,
          variant,
          formulaId,
          slotIndex,
          rawMultiplier,
          multiplier: rawMultiplier * scale,
          threshold: nextThreshold,
          potential: true,
          potentialScale: scale,
        }];
      });
    }

    function getAiPlanningFinalFormulaEntries(player = getCurrentPlayer(), formulaIds = []) {
      const wanted = new Set((formulaIds || []).filter(Boolean));
      const marked = getAiMarkedFinalFormulaEntries(player)
        .filter((entry) => !wanted.size || wanted.has(entry.formulaId));
      return [
        ...marked,
        ...getAiPotentialFinalFormulaEntries(player, formulaIds),
      ];
    }

    function getAiIncomeFinalFormulaEntries(player = getCurrentPlayer()) {
      return getAiPlanningFinalFormulaEntries(player, ["a1", "a2"]);
    }

    function scoreAiThresholdPressureForScoreGain(scoreGain, player = getCurrentPlayer()) {
      const gain = Math.max(0, aiNumber(scoreGain));
      if (!gain || !player) return 0;
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      const roundPaceTarget = getAiLiveScorePaceTarget();
      const finalMarks = countAiFinalMarksForPlayer(player);
      const nextThreshold = currentScore < 25
        ? 25
        : currentScore < 50
          ? 50
          : currentScore < 70
            ? 70
            : null;
      if (!nextThreshold) return 0;
      const distance = nextThreshold - currentScore;
      const afterScore = currentScore + gain;
      const thresholdValue = nextThreshold === 50 ? 18 : nextThreshold === 70 ? 18 : 9;
      let value = 0;
      if (afterScore >= nextThreshold) {
        value += thresholdValue;
      } else if (distance <= 12) {
        value += Math.min(gain, distance) * (nextThreshold === 70 ? 0.9 : nextThreshold === 50 ? 0.85 : 0.55);
        value += Math.max(0, 12 - distance) * 0.35;
      }
      if (roundPaceTarget && currentScore < roundPaceTarget) {
        const paceDistance = roundPaceTarget - currentScore;
        const earlyPace = getAiRoundNumber() <= 2;
        value += Math.min(
          getAiRoundNumber() >= 3 ? 24 : getAiRoundNumber() === 2 ? 20 : 18,
          gain * (getAiRoundNumber() >= 3 ? 1.55 : getAiRoundNumber() === 2 ? 1.25 : 1.1)
            + paceDistance * (getAiRoundNumber() >= 3 ? 0.08 : earlyPace ? 0.075 : 0.06),
        );
        if (afterScore >= roundPaceTarget) value += roundPaceTarget >= 70 ? 14 : 8;
      }
      if (finalMarks > 0 && nextThreshold === 50) value += Math.min(5, gain * 0.45);
      return value;
    }

    function scoreAiPaceValueForDirectScore(scoreGain, player = getCurrentPlayer(), options = {}) {
      const gain = Math.max(0, aiNumber(scoreGain));
      if (!gain || !player) return 0;
      const round = getAiRoundNumber();
      const deficit = getAiLiveScorePaceDeficit(player);
      const baseWeight = options.baseWeight ?? (round >= 3 ? 0.5 : round === 2 ? 0.42 : 0.24);
      const deficitWeight = round >= 3 ? 0.012 : round === 2 ? 0.01 : 0.006;
      const pressureWeight = options.pressureWeight ?? (round >= 3 ? 0.22 : round === 2 ? 0.18 : 0.16);
      return gain * (baseWeight + Math.min(0.35, deficit * deficitWeight))
        + aiNumber(scoreAiThresholdPressureForScoreGain(gain, player)) * pressureWeight;
    }

    function scoreAiThirdFinalMarkCashoutValue(scoreGain, player = getCurrentPlayer(), options = {}) {
      const gain = Math.max(0, aiNumber(scoreGain));
      if (!gain || !player) return 0;
      const round = getAiRoundNumber();
      if (round < FINAL_ROUND_NUMBER - 1) return 0;
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      if (currentScore >= 70 || currentScore < 50) return 0;
      const finalMarks = countAiFinalMarksForPlayer(player);
      if (finalMarks >= 3 || finalMarks < 2) return 0;
      return ai?.valuation?.estimateFinalMarkCashoutValue
        ? ai.valuation.estimateFinalMarkCashoutValue(gain, {
          player,
          currentScore,
          finalMarkCount: finalMarks,
          roundNumber: round,
          finalRoundNumber: FINAL_ROUND_NUMBER,
          threshold: 70,
          weight: options.weight,
        })
        : 0;
    }

    function scoreAiSecondFinalMarkNudgeValue(scoreGain, player = getCurrentPlayer(), options = {}) {
      const gain = Math.max(0, aiNumber(scoreGain));
      if (!gain || !player) return 0;
      const round = getAiRoundNumber();
      if (round < FINAL_ROUND_NUMBER - 1) return 0;
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      if (currentScore < 45 || currentScore >= 50) return 0;
      const finalMarks = countAiFinalMarksForPlayer(player);
      if (finalMarks >= 2) return 0;
      return ai?.valuation?.estimateFinalMarkCashoutValue
        ? ai.valuation.estimateFinalMarkCashoutValue(gain, {
          player,
          currentScore,
          finalMarkCount: finalMarks,
          roundNumber: round,
          finalRoundNumber: FINAL_ROUND_NUMBER,
          threshold: 50,
          weight: options.weight,
        })
        : 0;
    }

    function scoreAiNoDirectScorePacePenalty(player = getCurrentPlayer(), options = {}) {
      if (!player) return 0;
      const round = getAiRoundNumber();
      if (round > FINAL_ROUND_NUMBER) return 0;
      const deficit = getAiLiveScorePaceDeficit(player);
      const grace = options.grace ?? (round <= 1 ? 20 : 12);
      if (deficit <= grace) return 0;
      const urgency = options.urgency ?? (round >= 3 ? 0.18 : round === 2 ? 0.1 : 0.04);
      const cap = options.cap ?? (round >= 3 ? 14 : 8);
      return Math.min(cap, (deficit - grace) * urgency);
    }

    function getAiNextMissingFinalScoreThreshold(player = getCurrentPlayer()) {
      if (!player) return null;
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      const finalMarks = countAiFinalMarksForPlayer(player);
      if (finalMarks >= 3) return null;
      if (currentScore < 25 && finalMarks < 1) return 25;
      if (currentScore < 50 && finalMarks < 2) return 50;
      if (currentScore < 70 && finalMarks < 3) return 70;
      return null;
    }

    function scoreAiLateMissingFinalMarkNoDirectPenalty(candidate = {}, player = getCurrentPlayer()) {
      const round = getAiRoundNumber();
      if (!player || round < FINAL_ROUND_NUMBER) return 0;
      const threshold = getAiNextMissingFinalScoreThreshold(player);
      if (!threshold) return 0;
      if (ai?.valuation?.estimateMissingFinalMarkPenalty) {
        return ai.valuation.estimateMissingFinalMarkPenalty(candidate, {
          player,
          currentScore: player.resources?.score,
          finalMarkCount: countAiFinalMarksForPlayer(player),
          roundNumber: round,
          finalRoundNumber: FINAL_ROUND_NUMBER,
          threshold,
        });
      }
      return 0;
    }

    function getAiFinalSecondMarkUrgency(player = getCurrentPlayer()) {
      if (!player || getAiRoundNumber() < FINAL_ROUND_NUMBER) return null;
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      if (currentScore >= 50 || currentScore < 35) return null;
      const finalMarks = countAiFinalMarksForPlayer(player);
      if (finalMarks > 1 || getAiNextMissingFinalScoreThreshold(player) !== 50) return null;
      return {
        currentScore,
        finalMarks,
        deficit: Math.max(1, 50 - currentScore),
      };
    }

    function scoreAiFinalSecondMarkNoDirectSetupPenalty(player = getCurrentPlayer(), options = {}) {
      const urgency = getAiFinalSecondMarkUrgency(player);
      if (!urgency) return 0;

      const directScoreGain = Math.max(0, aiNumber(options.directScoreGain));
      const followupDirectScore = Math.max(0, aiNumber(options.followupDirectScore));
      if (urgency.currentScore + directScoreGain >= 50) return 0;
      if (
        followupDirectScore > 0
        && urgency.currentScore + directScoreGain + followupDirectScore >= 50
      ) {
        return 0;
      }

      const resources = player.resources || {};
      const credits = Math.max(0, aiNumber(resources.credits));
      const energy = Math.max(0, aiNumber(resources.energy));
      const handSize = Math.max(0, aiNumber(resources.handSize ?? (player.hand || []).length));
      const cost = options.cost || {};
      const setupScore = Math.max(0, aiNumber(options.setupScore));
      const consumesHand = options.consumesHand !== false;
      const consumesLastHand = Boolean(options.consumesLastHand) || (consumesHand && handSize <= 1);
      const consumesLastCredit = Boolean(options.consumesLastCredit)
        || (aiNumber(cost.credits) > 0 && credits <= aiNumber(cost.credits));
      const noCashoutRoute = options.noCashoutRoute !== false;

      let penalty = 5
        + Math.max(0, 14 - urgency.deficit) * 0.7
        + Math.min(8, setupScore * 0.18);
      if (urgency.currentScore >= 45) penalty += 10;
      if (consumesLastHand) penalty += 12;
      else if (consumesHand && handSize <= 2) penalty += 5;
      if (consumesLastCredit) penalty += 4;
      if (credits <= 1 && energy <= 1 && handSize <= 2) penalty += 6;
      if (noCashoutRoute) penalty += 6;
      if (options.actionId === "playCard") {
        const conversionPressure = Math.max(0, aiNumber(options.playCardConversionPressure));
        if (conversionPressure > 0) {
          const hasConcreteScorePath = directScoreGain > 0 || followupDirectScore > 0 || !noCashoutRoute;
          const maxDiscountRatio = hasConcreteScorePath ? 0.72 : 0.28;
          const discountBase = hasConcreteScorePath
            ? 4 + conversionPressure * 0.62 + Math.max(0, handSize - 3) * 1.4
            : Math.min(4, 1.2 + conversionPressure * 0.18);
          penalty -= Math.min(
            penalty * maxDiscountRatio,
            discountBase,
          );
        }
      }
      return roundAiScore(Math.min(36, Math.max(0, penalty)));
    }

    function getAiRemainingRoundWeight() {
      const { turnState } = readRuleRoot();
      const round = Math.max(1, Math.round(aiNumber(turnState.roundNumber) || 1));
      return Math.max(1, FINAL_ROUND_NUMBER - round + 1);
    }

    function getAiRoundNumber() {
      const { turnState } = readRuleRoot();
      return Math.max(1, Math.round(aiNumber(turnState.roundNumber) || 1));
    }

    function getAiLiveScorePaceTarget() {
      const round = getAiRoundNumber();
      if (round <= 1) return 25;
      if (round === 2) return 50;
      if (round <= FINAL_ROUND_NUMBER) return 70;
      return 0;
    }

    function getAiLiveScorePaceDeficit(player = getCurrentPlayer()) {
      const target = getAiLiveScorePaceTarget();
      if (!target || !player) return 0;
      return Math.max(0, target - Math.max(0, aiNumber(player.resources?.score)));
    }

    function getAiProjectedFinalScore(player = getCurrentPlayer()) {
      if (!player) return 0;
      const breakdown = computePlayerFinalScoreBreakdown?.(player) || {};
      return Math.max(
        0,
        aiNumber(breakdown.totalScore),
        aiNumber(breakdown.finalScore),
        aiNumber(player.resources?.score),
      );
    }

    function getAiHighScorePushProfile(player = getCurrentPlayer()) {
      if (!player || getAiRoundNumber() < FINAL_ROUND_NUMBER) {
        return { active: false, strength: 0, projectedScore: 0, formulas: new Set() };
      }
      const finalMarks = countAiFinalMarksForPlayer(player);
      const markedEntries = getAiMarkedFinalFormulaEntries(player);
      const formulas = new Set(markedEntries.map((entry) => entry.formulaId));
      const hasB2 = formulas.has("b2");
      const hasD1 = formulas.has("d1");
      const hasD2 = formulas.has("d2");
      const hasTechFinal = hasD1 || hasD2;
      const techCount = countAiPlayerTech(player);
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      const projectedScore = getAiProjectedFinalScore(player);
      const highProjectedScore = projectedScore >= (hasD2 ? 248 : 270);
      const b2TechEngineReady = finalMarks >= 3
        && hasB2
        && hasTechFinal
        && techCount >= 10
        && currentScore >= (hasD2 ? 115 : 140)
        && projectedScore >= (hasD2 ? 235 : 250);
      if (!highProjectedScore && !b2TechEngineReady) {
        return { active: false, strength: 0, projectedScore, formulas };
      }
      let strength = 0.42;
      strength += Math.min(0.72, Math.max(0, projectedScore - 225) / 75);
      if (b2TechEngineReady) strength += 0.3;
      if (projectedScore >= 270) strength += 0.12;
      if (projectedScore >= 290) strength += 0.16;
      if (currentScore >= 155) strength += 0.1;
      return {
        active: true,
        strength: Math.min(1.45, strength),
        projectedScore,
        currentScore,
        finalMarks,
        formulas,
        hasB2,
        hasD1,
        hasD2,
        hasTechFinal,
        techCount,
      };
    }

    function scoreAiHighScorePushValue(player = getCurrentPlayer(), actionId = "", options = {}) {
      const profile = getAiHighScorePushProfile(player);
      if (!profile.active || !actionId) return 0;
      const gapTo300 = Math.max(0, 300 - profile.projectedScore);
      const closeness = Math.max(0, 1 - gapTo300 / 70);
      const actionBase = {
        scan: 8.6,
        analyze: 8.1,
        playCard: 7.4,
        researchTech: 6.7,
        land: 8.0,
        orbit: 6.5,
        move: 5.6,
        placeData: 5.5,
      }[actionId] || 0;
      if (!actionBase) return 0;
      let value = actionBase * profile.strength + closeness * 5;
      const b2Bottleneck = profile.hasB2
        ? getAiB2SectorBottleneck(player, { requireMarked: true })
        : null;
      if (actionId === "scan" && profile.hasB2) {
        value += 3.2 + Math.min(12, aiNumber(b2Bottleneck?.deficit) * 2.2);
      }
      if (actionId === "researchTech" && profile.hasTechFinal) {
        const nextTechCount = profile.techCount + 1;
        value += 3 + (profile.formulas.has("d2") && Math.floor(nextTechCount / 2) > Math.floor(profile.techCount / 2) ? 3.5 : 0);
      }
      if (actionId === "analyze") {
        value += Math.min(6, Math.max(0, aiNumber(player.resources?.availableData) - 2) * 1.3);
        if (hasAiAnalyzeReadyDataSlot(player)) value += 1.5;
      }
      if (actionId === "playCard") {
        value += Math.min(5, Math.max(0, aiNumber(player.resources?.handSize) - 1) * 0.9);
        if (options.endGameExpectedScore > 0 || options.directScoreGain > 0) value += 2.6;
      }
      if (["orbit", "land", "analyze"].includes(actionId)) {
        const directScoreGain = Math.max(0, aiNumber(options.directScoreGain));
        if (directScoreGain > 0) {
          value += Math.min(5.5, directScoreGain * (gapTo300 <= 12 ? 0.72 : 0.42));
          if (gapTo300 > 0 && directScoreGain >= Math.max(1, gapTo300 - 2)) value += 2.4;
        }
      }
      if (actionId === "move" && !options.followupCashout) value *= 0.55;
      return roundAiScore(Math.min(40, Math.max(0, value)));
    }

    function getAiLowEngineCatchupProfile(player = getCurrentPlayer()) {
      if (!player || getAiRoundNumber() < 3) {
        return { active: false, strength: 0, projectedScore: 0 };
      }
      const projectedScore = getAiProjectedFinalScore(player);
      if (projectedScore >= 230) return { active: false, strength: 0, projectedScore };
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      const techCount = countAiPlayerTech(player);
      const placedCount = Math.max(0, (data.listComputerPlacedTokens?.(player) || []).length);
      const taskCount = Math.max(0, Math.round(aiNumber(player.completedTaskCount)));
      const markedEntries = getAiMarkedFinalFormulaEntries(player);
      const formulas = new Set(markedEntries.map((entry) => entry.formulaId));
      const engineShortfall = Math.max(0, 10 - techCount)
        + Math.max(0, (data.ANALYZE_REQUIRED_COMPUTER_SLOT || 6) - placedCount) * 0.75
        + Math.max(0, 2 - taskCount) * 1.15;
      const scorePressure = Math.max(0, (getAiRoundNumber() >= FINAL_ROUND_NUMBER ? 180 : 115) - currentScore) / 40;
      if (engineShortfall <= 1.2 && scorePressure <= 0) return { active: false, strength: 0, projectedScore };
      return {
        active: true,
        strength: Math.min(1.25, 0.35 + engineShortfall * 0.08 + scorePressure * 0.18),
        projectedScore,
        currentScore,
        techCount,
        placedCount,
        taskCount,
        formulas,
        hasB2: formulas.has("b2"),
        hasTechFinal: formulas.has("d1") || formulas.has("d2"),
      };
    }

    function scoreAiLowEngineCatchupValue(player = getCurrentPlayer(), actionId = "") {
      const profile = getAiLowEngineCatchupProfile(player);
      if (!profile.active || !actionId) return 0;
      if (
        getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && profile.currentScore >= 100
        && !(
          profile.currentScore < 160
          && (
            (actionId === "researchTech" && profile.techCount < 10)
            || (actionId === "playCard" && profile.taskCount < 2)
          )
        )
      ) {
        return 0;
      }
      if (
        actionId === "scan"
        && getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && !profile.hasB2
        && profile.currentScore >= 110
      ) {
        return 0;
      }
      const dataRoom = getAiAvailableDataRoom(player);
      const actionBase = {
        researchTech: Math.max(0, 10 - profile.techCount) * 1.15 + 2.5,
        scan: Math.max(0, dataRoom) * 0.75 + Math.max(0, 6 - profile.placedCount) * 0.65 + 2.2,
        analyze: hasAiAnalyzeReadyDataSlot(player) ? 7.5 : 1.5,
        playCard: Math.max(0, 2 - profile.taskCount) * 1.6 + Math.max(0, aiNumber(player.resources?.handSize) - 2) * 0.45,
        placeData: Math.max(0, aiNumber(player.resources?.availableData)) * 0.65 + Math.max(0, 6 - profile.placedCount) * 0.7,
      }[actionId] || 0;
      if (!actionBase) return 0;
      return roundAiScore(Math.min(14, Math.max(0, actionBase * profile.strength)));
    }

    function scoreAiPassAction(player = getCurrentPlayer()) {
      const deficit = getAiLiveScorePaceDeficit(player);
      const round = getAiRoundNumber();
      const finalMarks = countAiFinalMarksForPlayer(player);
      const finalRoundPassPenalty = ai?.valuation?.estimateFinalRoundPassPenalty
        ? ai.valuation.estimateFinalRoundPassPenalty({
          player,
          currentScore: player?.resources?.score,
          finalMarkCount: finalMarks,
          roundNumber: round,
          finalRoundNumber: FINAL_ROUND_NUMBER,
          threshold: getAiNextMissingFinalScoreThreshold(player),
        })
        : 0;
      const missingThreshold = getAiNextMissingFinalScoreThreshold(player);
      if (finalRoundPassPenalty > 0) return -Math.max(finalRoundPassPenalty, finalMarks <= 1 ? 18 : 15);
      if (round >= FINAL_ROUND_NUMBER && finalMarks < 3 && (deficit > 0 || missingThreshold)) {
        return finalMarks <= 1 ? -18 : (deficit > 25 ? -16 : -12);
      }
      if (round >= 3 && finalMarks < 3 && (deficit > 0 || missingThreshold)) return deficit > 25 ? -10 : -7;
      if (round <= FINAL_ROUND_NUMBER && deficit > 25) return -4;
      if (round <= FINAL_ROUND_NUMBER && deficit > 10) return -2;
      return -0.5;
    }

    function scoreAiResourceReservePenaltyForCost(player = getCurrentPlayer(), cost = {}, options = {}) {
      if (!player) return 0;
      const round = getAiRoundNumber();
      if (round > 3) return 0;
      const resources = player.resources || {};
      const creditCost = Math.max(0, aiNumber(cost.credits));
      const energyCost = Math.max(0, aiNumber(cost.energy));
      if (creditCost <= 0 && energyCost <= 0) return 0;
      const weight = round <= 1 ? 1 : round === 2 ? 0.72 : 0.42;
      const creditsAfter = aiNumber(resources.credits) - creditCost;
      const energyAfter = aiNumber(resources.energy) - energyCost;
      let penalty = 0;
      if (creditCost > 0 && creditsAfter < 2) penalty += (2 - creditsAfter) * 2.1 * weight;
      if (energyCost > 0 && energyAfter < 2) penalty += (2 - energyAfter) * 2.5 * weight;
      if (
        creditCost + energyCost > 0
        && aiNumber(resources.credits) + aiNumber(resources.energy) - creditCost - energyCost <= 2
      ) {
        penalty += 2.5 * weight;
      }
      if (options.actionId === "scan" && getAiMapDemand(getAiStrategyDemand(player).traceTypes, "pink") > 0) {
        penalty *= 0.75;
      }
      return Math.max(0, penalty);
    }

    function scoreAiFinalRoundPlayCardResourceDrainPenalty(card, details = {}) {
      const player = details.player || getCurrentPlayer();
      if (!player || getAiRoundNumber() < FINAL_ROUND_NUMBER) return 0;

      const cost = details.cost || getCardPlayCost(card);
      const creditCost = Math.max(0, aiNumber(cost.credits));
      const energyCost = Math.max(0, aiNumber(cost.energy));
      if (creditCost <= 0 && energyCost <= 0) return 0;

      const directScoreGain = Math.max(0, aiNumber(details.directScoreGain));
      const routePlanCashout = Boolean(details.routePlanCashout);
      if (directScoreGain > 0 || routePlanCashout) return 0;

      const resources = player.resources || {};
      const credits = Math.max(0, aiNumber(resources.credits));
      const energy = Math.max(0, aiNumber(resources.energy));
      const creditsAfter = credits - creditCost;
      const energyAfter = energy - energyCost;
      const finalMarks = countAiFinalMarksForPlayer(player);
      const analyzeCost = getAiAnalyzeEnergyCost(player);
      const scanCost = scanEffects?.getStandardScanCost?.(player) || scanEffects?.SCAN_COST || { energy: 2 };
      const scanEnergyCost = Math.max(0, aiNumber(scanCost.energy));

      let penalty = 0;
      if (creditCost > 0 && creditsAfter <= 0) penalty += energy <= 0 ? 10 : 6;
      if (energyCost > 0 && energyAfter <= 0) penalty += credits <= 0 ? 10 : 7;
      if (creditsAfter + energyAfter <= 1) penalty += finalMarks >= 2 ? 5 : 3;
      if (hasAiAnalyzeReadyDataSlot(player) && energyAfter < analyzeCost) penalty += 7;
      else if (canAiReachAnalyzeReadyWithDataPool(player) && energyAfter < analyzeCost) penalty += 4;
      if (scanEnergyCost > 0 && energyAfter < scanEnergyCost && getAiAvailableDataRoom(player) >= 2) penalty += 3;

      const model = details.model || cardEffects.getCardModel?.(card) || null;
      const playEffects = details.playEffects || cardEffects.buildPlayEffects?.(card) || [];
      const typeCode = getCardTypeCode(card);
      const hasLateRouteSetupEffect = (playEffects || []).some((effect) => (
        effect?.type === "launch"
        || effect?.type === cardEffects.EFFECT_TYPES.CARD_MOVE
        || effect?.type === cardEffects.EFFECT_TYPES.FREE_MOVE
      ));
      if (model?.tasks?.length || model?.endGameScoring || typeCode === 3) penalty *= 0.45;
      if ((player.hand || []).length >= 4 && (model?.tasks?.length || model?.endGameScoring || typeCode === 3)) {
        penalty *= 0.72;
      }
      if (isAiAlienMainPlayCard(card)) penalty *= 0.45;
      if (
        hasLateRouteSetupEffect
        && !routePlanCashout
        && directScoreGain <= 0
        && !isAiAlienMainPlayCard(card)
      ) {
        penalty += model?.tasks?.length || model?.endGameScoring || typeCode === 3 ? 1.2 : 5.5;
      }
      return roundAiScore(Math.min(18, Math.max(0, penalty)));
    }

    function canAiReachAnalyzeReadyWithDataPool(player = getCurrentPlayer()) {
      const requiredSlot = data.ANALYZE_REQUIRED_COMPUTER_SLOT || 6;
      const placedCount = Math.max(0, (data.listComputerPlacedTokens?.(player) || []).length);
      const availableData = Math.max(0, Math.round(aiNumber(player?.resources?.availableData)));
      return placedCount + availableData >= requiredSlot;
    }

    function hasAiAnalyzeReadyDataSlot(player = getCurrentPlayer()) {
      const requiredSlot = data.ANALYZE_REQUIRED_COMPUTER_SLOT || 6;
      return (data.listComputerPlacedTokens?.(player) || [])
        .some((token) => Number(token?.placementSlot) === requiredSlot);
    }

    function getAiAnalyzeEnergyCost(player = getCurrentPlayer()) {
      if (industry?.canAnalyzeWithoutEnergy?.(player)) return 0;
      return Math.max(1, aiNumber(data.ANALYZE_ENERGY_COST || 1));
    }

    function canAiAnalyzeData(player = getCurrentPlayer()) {
      if (!data?.canAnalyzeData) return { ok: false, message: "数据模块不可用" };
      return data.canAnalyzeData(player, {
        skipEnergyCost: getAiAnalyzeEnergyCost(player) <= 0,
      });
    }

    function canAiFangzhouTracePlacementScoreAtLeast(player, traceType, minScore) {
      if (!player || !fangzhou?.isFangzhouRevealedSlot) return false;
      const { alienGameState } = readRuleRoot();
      const neededScore = Math.max(1, aiNumber(minScore));
      return (aliens.ALIEN_SLOT_IDS || []).some((alienSlotId) => {
        if (!fangzhou.isFangzhouRevealedSlot(alienGameState, alienSlotId)) return false;
        return (fangzhou.TRACE_POSITIONS || []).some((position) => {
          const canPlace = fangzhou.canPlaceFangzhouTrace?.(
            alienGameState,
            alienSlotId,
            traceType,
            Number(position),
            player,
          );
          if (!canPlace?.ok) return false;
          const reward = fangzhou.getTraceReward?.(traceType, Number(position));
          return aiNumber(reward?.gain?.score) >= neededScore;
        });
      });
    }

    function getAiBestRevealedAlienTraceDirectScore(player, traceType) {
      if (!player || !traceType) return 0;
      return (aliens.ALIEN_SLOT_IDS || []).reduce((best, alienSlotId) => (
        Math.max(best, getAiBestRevealedAlienTraceDirectScoreForSlot(player, alienSlotId, traceType))
      ), 0);
    }
    return Object.freeze({
      getAiMovePaymentCards,
      getAiLaunchPaymentCost,
      scoreAiLaunchPaymentCost,
      estimateAiMovePayment,
      shouldAiPreserveEnergyForSatelliteRoute,
      shouldAiPreserveEnergyForPlanetCashout,
      shouldAiPreserveEnergyForRouteCashout,
      scoreAiMovePaymentCost,
      countAiFinalMarksForPlayer,
      getAiActiveOpponentCount,
      getAiMarkedFinalFormulaEntries,
      getAiFinalFormulaProgressForPlayer,
      getAiNextFinalTileSlotIndex,
      getAiPotentialFinalFormulaEntries,
      getAiPlanningFinalFormulaEntries,
      getAiIncomeFinalFormulaEntries,
      scoreAiThresholdPressureForScoreGain,
      scoreAiPaceValueForDirectScore,
      scoreAiThirdFinalMarkCashoutValue,
      scoreAiSecondFinalMarkNudgeValue,
      scoreAiNoDirectScorePacePenalty,
      getAiNextMissingFinalScoreThreshold,
      scoreAiLateMissingFinalMarkNoDirectPenalty,
      getAiFinalSecondMarkUrgency,
      scoreAiFinalSecondMarkNoDirectSetupPenalty,
      getAiRemainingRoundWeight,
      getAiRoundNumber,
      getAiLiveScorePaceTarget,
      getAiLiveScorePaceDeficit,
      getAiProjectedFinalScore,
      getAiHighScorePushProfile,
      scoreAiHighScorePushValue,
      getAiLowEngineCatchupProfile,
      scoreAiLowEngineCatchupValue,
      scoreAiPassAction,
      scoreAiResourceReservePenaltyForCost,
      scoreAiFinalRoundPlayCardResourceDrainPenalty,
      canAiReachAnalyzeReadyWithDataPool,
      hasAiAnalyzeReadyDataSlot,
      getAiAnalyzeEnergyCost,
      canAiAnalyzeData,
      canAiFangzhouTracePlacementScoreAtLeast,
      getAiBestRevealedAlienTraceDirectScore,
    });
  }

  return Object.freeze({ createFinalPace });
});
