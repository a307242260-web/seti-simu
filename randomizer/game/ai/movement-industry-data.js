(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAIMovementIndustryData = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createMovementIndustryData(context = {}) {
    const {
      state,
      solar,
      players,
      rocketActions,
      industry,
      actions,
      scanEffects,
      cards,
      tech,
      data,
      turnState,
      rocketState,
      cardState,
      FINAL_ROUND_NUMBER,
      handleCompanyActionMarkerClick,
      AI_MOVE_DIRECTIONS,
      AI_RESOURCE_VALUES,
      AI_DIFFICULTY_WEAK_START,
      AI_DEEPSPACE_SWAP_MIN_SCORE,
      aiAutoBattleState,
    } = context;
    const aiNumber = (...args) => context.aiNumber(...args);
    const applyAiStrategyWeight = (...args) => context.applyAiStrategyWeight(...args);
    const buildAiChongTransportMoveCandidate = (...args) => context.buildAiChongTransportMoveCandidate(...args);
    const buildAiPlayCardCandidate = (...args) => context.buildAiPlayCardCandidate(...args);
    const canAiMoveThisTurn = (...args) => context.canAiMoveThisTurn(...args);
    const canPayForMove = (...args) => context.canPayForMove(...args);
    const canStartMainAction = (...args) => context.canStartMainAction(...args);
    const countAiFinalMarksForPlayer = (...args) => context.countAiFinalMarksForPlayer(...args);
    const createActionContext = (...args) => context.createActionContext(...args);
    const createAiPlayerAfterResourceGain = (...args) => context.createAiPlayerAfterResourceGain(...args);
    const estimateAiMovePayment = (...args) => context.estimateAiMovePayment(...args);
    const formatRocketLabel = (...args) => context.formatRocketLabel(...args);
    const getAiAnalyzeEnergyCost = (...args) => context.getAiAnalyzeEnergyCost(...args);
    const getAiBestDeepspaceSwap = (...args) => context.getAiBestDeepspaceSwap(...args);
    const getAiBestRevealedAlienTraceDirectScore = (...args) => context.getAiBestRevealedAlienTraceDirectScore(...args);
    const getAiDataPlacementBonuses = (...args) => context.getAiDataPlacementBonuses(...args);
    const getAiDataPlacementDirectScoreGain = (...args) => context.getAiDataPlacementDirectScoreGain(...args);
    const getAiFinalInsufficientCashoutRouteAdjustment = (...args) => context.getAiFinalInsufficientCashoutRouteAdjustment(...args);
    const getAiHighScorePushProfile = (...args) => context.getAiHighScorePushProfile(...args);
    const getAiMapDemand = (...args) => context.getAiMapDemand(...args);
    const getAiNextMissingFinalScoreThreshold = (...args) => context.getAiNextMissingFinalScoreThreshold(...args);
    const getAiNextTurnMoveFollowupScale = (...args) => context.getAiNextTurnMoveFollowupScale(...args);
    const getAiProjectedFinalScore = (...args) => context.getAiProjectedFinalScore(...args);
    const getAiRoundNumber = (...args) => context.getAiRoundNumber(...args);
    const getAiStrategyDemand = (...args) => context.getAiStrategyDemand(...args);
    const getAiUrgentUncashableRouteScoreCap = (...args) => context.getAiUrgentUncashableRouteScoreCap(...args);
    const getCurrentPlayer = (...args) => context.getCurrentPlayer(...args);
    const getMovableTokensForPlayer = (...args) => context.getMovableTokensForPlayer(...args);
    const getRequiredMovePointsForUi = (...args) => context.getRequiredMovePointsForUi(...args);
    const isAiAsteroidCoordinate = (...args) => context.isAiAsteroidCoordinate(...args);
    const isAiChongFossilToken = (...args) => context.isAiChongFossilToken(...args);
    const listAiBorrowTechCandidates = (...args) => context.listAiBorrowTechCandidates(...args);
    const listAiEffectMoveCandidates = (...args) => context.listAiEffectMoveCandidates(...args);
    const listAiPlayCardCandidates = (...args) => context.listAiPlayCardCandidates(...args);
    const normalizeAiDifficulty = (...args) => context.normalizeAiDifficulty(...args);
    const of = (...args) => context.of(...args);
    const roundAiScore = (...args) => context.roundAiScore(...args);
    const scoreAiCardCornerOpportunity = (...args) => context.scoreAiCardCornerOpportunity(...args);
    const scoreAiDataEngineProgressValue = (...args) => context.scoreAiDataEngineProgressValue(...args);
    const scoreAiDataPlacementBonusValue = (...args) => context.scoreAiDataPlacementBonusValue(...args);
    const scoreAiEarlyMoveBlocksLandingTracePenalty = (...args) => context.scoreAiEarlyMoveBlocksLandingTracePenalty(...args);
    const scoreAiEarlyOrbitOnlyTraceDelayPenalty = (...args) => context.scoreAiEarlyOrbitOnlyTraceDelayPenalty(...args);
    const scoreAiFinalFormulaDeltaValue = (...args) => context.scoreAiFinalFormulaDeltaValue(...args);
    const scoreAiFinalSecondMarkNoDirectSetupPenalty = (...args) => context.scoreAiFinalSecondMarkNoDirectSetupPenalty(...args);
    const scoreAiFinalThresholdIncomePlacementPenalty = (...args) => context.scoreAiFinalThresholdIncomePlacementPenalty(...args);
    const scoreAiFinalUncashableMoveEnergyPenalty = (...args) => context.scoreAiFinalUncashableMoveEnergyPenalty(...args);
    const scoreAiFollowupMainActionAfterMove = (...args) => context.scoreAiFollowupMainActionAfterMove(...args);
    const scoreAiHighScorePushValue = (...args) => context.scoreAiHighScorePushValue(...args);
    const scoreAiLateIncomePlacementDiscardPenalty = (...args) => context.scoreAiLateIncomePlacementDiscardPenalty(...args);
    const scoreAiMoveArrivalRewardValue = (...args) => context.scoreAiMoveArrivalRewardValue(...args);
    const scoreAiMoveTowardTargets = (...args) => context.scoreAiMoveTowardTargets(...args);
    const scoreAiMovementPathPenalty = (...args) => context.scoreAiMovementPathPenalty(...args);
    const scoreAiNearestActionablePlanetTimingPenalty = (...args) => context.scoreAiNearestActionablePlanetTimingPenalty(...args);
    const scoreAiPublicPickCard = (...args) => context.scoreAiPublicPickCard(...args);
    const scoreAiResourceBundle = (...args) => context.scoreAiResourceBundle(...args);
    const scoreAiStrategyPassiveSlotChoice = (...args) => context.scoreAiStrategyPassiveSlotChoice(...args);
    const shouldAiPreserveEnergyForRouteCashout = (...args) => context.shouldAiPreserveEnergyForRouteCashout(...args);
    const summarizeAiPublicPickCandidate = (...args) => context.summarizeAiPublicPickCandidate(...args);

    function buildAiMoveCandidate(workingRoot, rocket, direction, index = 0) {
      if (!workingRoot || typeof workingRoot !== "object") throw new TypeError("AI movement candidates require an explicit workingRoot");
      const { playerState, rocketState } = workingRoot;
      const currentPlayer = players.getCurrentPlayer(playerState);
      const moveCheck = rocketActions.canMoveRocket(
        rocketState,
        rocket.id,
        direction.deltaX,
        direction.deltaY,
      );
      if (!moveCheck.ok) return null;

      const requiredMovePoints = getRequiredMovePointsForUi(
        workingRoot,
        currentPlayer,
        rocket.id,
        direction.deltaX,
        direction.deltaY,
      );
      const payCheck = canPayForMove(currentPlayer, requiredMovePoints);
      if (!payCheck.ok) return null;

      const from = rocketActions.getRocketSectorCoordinate(rocket);
      const to = from
        ? {
          x: solar.mod8(from.x + direction.deltaX),
          y: Math.min(
            rocketActions.SECTOR_RING_MAX,
            Math.max(rocketActions.SECTOR_RING_MIN, from.y + direction.deltaY),
          ),
        }
        : null;
      if (isAiChongFossilToken(rocket)) {
        const movePayment = estimateAiMovePayment(currentPlayer, requiredMovePoints);
        return buildAiChongTransportMoveCandidate({
          id: "move",
          kind: "quick",
          rocket,
          direction,
          index,
          player: currentPlayer,
          from,
          to,
          requiredMovePoints,
          paymentCost: movePayment.cost,
        });
      }
      const routeScore = scoreAiMoveTowardTargets(from, to, currentPlayer, { rocket });
      const preserveEnergyForRouteCashout = shouldAiPreserveEnergyForRouteCashout(currentPlayer, to, {
        routeTarget: routeScore.target,
        requiredMovePoints,
      });
      const movePayment = estimateAiMovePayment(currentPlayer, requiredMovePoints, {
        preserveEnergy: preserveEnergyForRouteCashout,
      });
      const playerAfterMovePayment = currentPlayer
        ? {
          ...currentPlayer,
          resources: {
            ...(currentPlayer.resources || {}),
            energy: movePayment.remainingEnergy,
          },
        }
        : currentPlayer;
      const immediateFollowupMainAction = scoreAiFollowupMainActionAfterMove(to, playerAfterMovePayment);
      const deferredFollowupMainAction = immediateFollowupMainAction.score > 0
        ? immediateFollowupMainAction
        : scoreAiFollowupMainActionAfterMove(to, playerAfterMovePayment, { ignoreMainActionUsed: true });
      const followupMainAction = immediateFollowupMainAction.score > 0
        ? { ...immediateFollowupMainAction, timing: "immediate" }
        : deferredFollowupMainAction.score > 0
          ? { ...deferredFollowupMainAction, timing: "next_turn" }
          : immediateFollowupMainAction;
      const arrivedAtPlanetTarget = routeScore.target?.kind === "planet"
        && Math.max(0, Math.round(aiNumber(routeScore.target?.newDistance))) === 0;
      const canCashOutRoute = Math.max(0, aiNumber(followupMainAction.score)) > 0;
      let routeScoreForGain = !arrivedAtPlanetTarget
        ? aiNumber(routeScore.score)
        : canCashOutRoute
          ? aiNumber(routeScore.score) * (followupMainAction.timing === "next_turn" ? 0.32 : 0.38)
          : Math.min(aiNumber(routeScore.score), getAiRoundNumber() <= 2 ? 14 : 10);
      if (!arrivedAtPlanetTarget && routeScoreForGain > 0) {
        routeScoreForGain *= getAiRoundNumber() <= 2 ? 0.82 : getAiRoundNumber() === 3 ? 0.58 : 0.46;
      }
      const routeScoreCap = getAiUrgentUncashableRouteScoreCap(routeScore.target, canCashOutRoute, currentPlayer);
      if (routeScoreCap != null) routeScoreForGain = Math.min(routeScoreForGain, routeScoreCap);
      const insufficientCashoutAdjustment = getAiFinalInsufficientCashoutRouteAdjustment(
        routeScore.target,
        followupMainAction,
        currentPlayer,
      );
      if (insufficientCashoutAdjustment) {
        routeScoreForGain = Math.min(routeScoreForGain, insufficientCashoutAdjustment.routeScoreCap);
      }
      const followupScoreScale = insufficientCashoutAdjustment?.followupScoreScale ?? 1;
      const nextTurnFollowupScale = getAiNextTurnMoveFollowupScale();
      const followupGain = (
        followupMainAction.timing === "next_turn"
          ? Math.max(0, aiNumber(followupMainAction.score)) * nextTurnFollowupScale
          : Math.max(0, aiNumber(followupMainAction.score))
      ) * followupScoreScale;
      const baseFinalUncashableMovePenalty = scoreAiFinalUncashableMoveEnergyPenalty({
        player: currentPlayer,
        routeTarget: routeScore.target,
        followupScore: followupMainAction.score,
        energySpent: movePayment.energySpent,
        energyAfterMovePayment: movePayment.remainingEnergy,
      });
      const currentScore = Math.max(0, aiNumber(currentPlayer?.resources?.score));
      const followupDirectScore = Math.max(0, aiNumber(followupMainAction?.directScoreGain));
      const finalLowScoreDirectLandProgressMove = (
        getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && currentScore < 38
        && followupDirectScore >= 7
        && String(followupMainAction?.actionId || "") === "land"
        && String(followupMainAction?.timing || "") === "immediate"
      );
      const finalSecondMarkUncashableMovePenalty = (
        getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && currentScore < 50
        && countAiFinalMarksForPlayer(currentPlayer) <= 1
        && getAiNextMissingFinalScoreThreshold(currentPlayer) === 50
        && currentScore + followupDirectScore < 50
        && !finalLowScoreDirectLandProgressMove
      )
        ? Math.min(
          18,
          (currentScore >= 45 ? 11 : 8)
            + Math.max(0, 50 - currentScore) * 0.25
            + Math.max(0, routeScoreForGain) * 0.15,
        )
        : 0;
      const scanCostForMoveGuard = scanEffects.getStandardScanCost(currentPlayer) || {};
      const finalMoveBlocksCurrentScanPenalty = (
        getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && Math.max(0, aiNumber(followupMainAction.score)) <= 0
        && currentScore >= 58
        && currentScore < 70
        && Math.max(0, aiNumber(movePayment.energySpent)) > 0
        && Math.max(0, aiNumber(currentPlayer?.resources?.credits)) >= Math.max(0, aiNumber(scanCostForMoveGuard.credits))
        && Math.max(0, aiNumber(currentPlayer?.resources?.energy)) >= Math.max(0, aiNumber(scanCostForMoveGuard.energy))
        && Math.max(0, aiNumber(movePayment.remainingEnergy)) < Math.max(0, aiNumber(scanCostForMoveGuard.energy))
      )
        ? 58
        : 0;
      const finalUncashableMovePenalty = baseFinalUncashableMovePenalty
        + finalMoveBlocksCurrentScanPenalty
        + finalSecondMarkUncashableMovePenalty;
      const highScoreMovePushValue = Math.max(0, aiNumber(followupMainAction.score)) > 0
        ? scoreAiHighScorePushValue(currentPlayer, "move", {
          followupCashout: followupMainAction.timing === "immediate",
        })
        : 0;
      const movementGain = applyAiStrategyWeight(applyAiStrategyWeight(routeScoreForGain, "route", 0.7), "move", 0.8)
        + applyAiStrategyWeight(followupGain, "orbitLand", 0.5)
        + highScoreMovePushValue
        + scoreAiMoveArrivalRewardValue(to, currentPlayer, {
          free: movePayment.energySpent <= 0 && movePayment.cardSpent <= 0,
        })
        + direction.score * 0.08;
      const paymentCost = movePayment.cost;
      const nearestActionablePlanetPenalty = scoreAiNearestActionablePlanetTimingPenalty({
        player: currentPlayer,
        from,
        to,
        direction,
        routeScore,
        followupScore: followupMainAction.score,
        energySpent: movePayment.energySpent,
        energyAfterMovePayment: movePayment.remainingEnergy,
      });
      const pathPenalty = scoreAiMovementPathPenalty({
        player: currentPlayer,
        from,
        to,
        direction,
        requiredMovePoints,
        routeScore,
        followupScore: followupMainAction.score,
        energySpent: movePayment.energySpent,
        energyAfterMovePayment: movePayment.remainingEnergy,
        nearestActionablePlanetPenalty,
      });
      const earlyLandingTraceBlockedPenalty = scoreAiEarlyMoveBlocksLandingTracePenalty({
        player: currentPlayer,
        to,
        routeScore,
        routeTarget: routeScore.target,
        followupMainAction,
        energySpent: movePayment.energySpent,
        energyAfterMovePayment: movePayment.remainingEnergy,
      });
      const earlyOrbitOnlyTraceDelayPenalty = scoreAiEarlyOrbitOnlyTraceDelayPenalty({
        player: currentPlayer,
        to,
        routeScore,
        routeTarget: routeScore.target,
        followupMainAction,
      });
      const movementCost = paymentCost
        + pathPenalty
        + finalUncashableMovePenalty
        + earlyLandingTraceBlockedPenalty
        + earlyOrbitOnlyTraceDelayPenalty;
      const moveScore = movementGain - movementCost - index * 0.1;
      const paidMoveResourceSpent = Math.max(0, aiNumber(movePayment.energySpent))
        + Math.max(0, aiNumber(movePayment.cardSpent));
      const paidNoCashoutMove = Math.max(0, aiNumber(followupMainAction.score)) <= 0
        && paidMoveResourceSpent > 0
        && moveScore < 0
        && !arrivedAtPlanetTarget;
      if (paidNoCashoutMove) return null;
      if (finalUncashableMovePenalty > 0 && moveScore < 0) return null;
      if (earlyLandingTraceBlockedPenalty > 0 && moveScore < 4) return null;
      if (earlyOrbitOnlyTraceDelayPenalty > 0 && moveScore < 8) return null;
      return {
        id: "move",
        kind: "quick",
        available: true,
        rocketId: rocket.id,
        rocketLabel: formatRocketLabel(rocket),
        direction: direction.id,
        directionLabel: direction.label,
        deltaX: direction.deltaX,
        deltaY: direction.deltaY,
        from,
        to,
        requiredMovePoints,
        routeTarget: routeScore.target,
        routeScore: routeScore.score,
        followupMainAction,
        gain: movementGain,
        cost: movementCost + index * 0.1,
        score: moveScore,
        valueBreakdown: {
          movementGain,
          paymentCost,
          pathPenalty,
          nearestActionablePlanetPenalty,
          movementCost,
          routeScore: routeScore.score,
          routeScoreForGain,
          highScoreMovePushValue,
          routeScoreCap,
          insufficientCashoutAdjustment,
          followupScore: followupMainAction.score,
          followupScoreScale,
          followupTiming: followupMainAction.timing || null,
          requiredMovePoints,
          moveEnergySpent: movePayment.energySpent,
          moveCardSpent: movePayment.cardSpent,
          energyAfterMovePayment: movePayment.remainingEnergy,
          preserveEnergyForRouteCashout,
          finalUncashableMovePenalty,
          baseFinalUncashableMovePenalty,
          finalMoveBlocksCurrentScanPenalty,
          finalSecondMarkUncashableMovePenalty,
          finalLowScoreDirectLandProgressMove,
          earlyLandingTraceBlockedPenalty,
          earlyOrbitOnlyTraceDelayPenalty,
        },
      };
    }

    function listAiMoveCandidates(workingRoot) {
      if (!workingRoot || typeof workingRoot !== "object") throw new TypeError("AI movement candidates require an explicit workingRoot");
      const currentPlayer = players.getCurrentPlayer(workingRoot.playerState);
      if (!currentPlayer || !canAiMoveThisTurn(workingRoot, currentPlayer.id)) return [];
      const movableTokens = rocketActions.getMovableTokensForPlayer
        ? rocketActions.getMovableTokensForPlayer(workingRoot.rocketState, currentPlayer.id)
        : rocketActions.getRocketsForPlayer(workingRoot.rocketState, currentPlayer.id);
      return movableTokens
        .flatMap((rocket, index) => AI_MOVE_DIRECTIONS
          .map((direction) => buildAiMoveCandidate(workingRoot, rocket, direction, index))
          .filter(Boolean));
    }

    function getAiIndustryCard(player = getCurrentPlayer()) {
      return player?.initialSelection?.industry || null;
    }

    function getAiIndustryPublicPickProfile(workingRoot, player, pendingType = null) {
      const ranked = (workingRoot.cardState.publicCards || [])
        .map((card, slotIndex) => ({
          card,
          slotIndex,
          score: scoreAiPublicPickCard(card, player, pendingType, workingRoot),
        }))
        .filter((entry) => entry.card && Number.isFinite(Number(entry.score)))
        .sort((left, right) => Number(right.score || 0) - Number(left.score || 0) || left.slotIndex - right.slotIndex);
      const best = ranked[0] || null;
      return {
        pendingType,
        bestScore: best ? aiNumber(best.score) : -Infinity,
        bestCard: best ? summarizeAiPublicPickCandidate(best, player) : null,
        topCards: ranked.slice(0, 3).map((entry) => summarizeAiPublicPickCandidate(entry, player)).filter(Boolean),
      };
    }

    function scoreAiIndustryPublicPick(workingRoot, player, pendingType = null) {
      return getAiIndustryPublicPickProfile(workingRoot, player, pendingType).bestScore;
    }

    function summarizeAiStrategyPassiveSlots(workingRoot, player = players.getCurrentPlayer(workingRoot.playerState)) {
      if (!player || !industry?.playerHasStrategyPassive?.(player)) return null;
      const slotIds = industry.STRATEGY_PASSIVE_SLOT_IDS || ["yellow", "red", "blue"];
      const slots = slotIds.map((slotId) => {
        const occupied = Boolean(player.industryStrategyPassiveSlots?.[slotId]);
        return {
          slotId,
          occupied,
          rewardLabel: industry?.getStrategySlotRewardLabel?.(slotId) || "",
          rewardValue: roundAiScore(scoreAiStrategyPassiveSlotChoice(workingRoot, slotId, player)),
        };
      });
      return {
        occupiedSlotIds: slots.filter((slot) => slot.occupied).map((slot) => slot.slotId),
        emptySlotIds: slots.filter((slot) => !slot.occupied).map((slot) => slot.slotId),
        occupiedCount: slots.filter((slot) => slot.occupied).length,
        emptyCount: slots.filter((slot) => !slot.occupied).length,
        roundStartClearsSlots: Boolean(industry?.hasGrandStrategyRoundStart?.(player)),
        slots,
      };
    }

    function scoreAiEarlyEmptyStrategyPickPenalty(
      player = getCurrentPlayer(),
      publicPickProfile = null,
      strategyPassiveSlots = null,
    ) {
      if (player?.aiDifficulty !== AI_DIFFICULTY_WEAK_START) return 0;
      if (getAiRoundNumber() > 2) return 0;
      if (!strategyPassiveSlots || strategyPassiveSlots.occupiedCount > 0) return 0;
      const bestCard = publicPickProfile?.bestCard || null;
      if (!bestCard) return 0;
      const signals = bestCard.valueSignals || {};
      const playScore = aiNumber(bestCard.playScore);
      const directScoreGain = Math.max(0, aiNumber(bestCard.directScoreGain));
      const standardActionPremium = Math.max(0, aiNumber(signals.standardActionPremium));
      const conversionPressure = Math.max(0, aiNumber(signals.playCardConversionPressure));
      const taskProgress = Math.max(0, aiNumber(signals.cFinalTaskProgressValue));
      const type3Progress = Math.max(0, aiNumber(signals.c2Type3ProgressValue));
      const planScore = Math.max(0, aiNumber(signals.planScore));
      const endGameExpectedScore = Math.max(0, aiNumber(signals.endGameExpectedScore));
      const hasConcretePublicCard = Boolean(
        directScoreGain > 0
        || playScore >= 12
        || conversionPressure >= 8
        || (standardActionPremium >= 5 && playScore >= 6)
        || taskProgress >= 1
        || type3Progress >= 1.5
        || planScore >= 4
        || endGameExpectedScore >= 4
      );
      return hasConcretePublicCard ? 0 : 16;
    }

    function listAiCardCornerMoveCandidatesForReward(workingRoot, moveReward, options = {}) {
      if (!moveReward) return [];
      const movementPoints = Math.max(1, Math.round(aiNumber(moveReward.movementPoints || 1)));
      return listAiEffectMoveCandidates(workingRoot, {
        id: options.id || "industryCornerMove",
        free: true,
        poolRemaining: movementPoints,
      })
        .sort((left, right) => Number(right.score || 0) - Number(left.score || 0));
    }

    function scoreAiIndustryCornerReward(card, reward = null, options = {}) {
      const resolvedReward = reward || industry?.getCornerReward?.(cards, card) || null;
      if (!resolvedReward) return options.allowMissing ? 0 : -Infinity;
      if (resolvedReward.kind === "resource") {
        const dataValue = Math.max(0, Math.round(aiNumber(resolvedReward.dataCount))) * AI_RESOURCE_VALUES.availableData;
        return scoreAiResourceBundle(resolvedReward.gain || {}) + dataValue;
      }
      if (resolvedReward.kind === "move") {
        const candidates = listAiCardCornerMoveCandidatesForReward(options.workingRoot, resolvedReward, {
          id: options.moveId || "industryCornerMove",
        });
        if (!candidates.length) return -Infinity;
        const bestMoveScore = aiNumber(candidates[0]?.score);
        if (bestMoveScore < 0) return -Infinity;
        return scoreAiResourceBundle(resolvedReward.gain || {})
          + Math.max(0.5, aiNumber(resolvedReward.movementPoints || 1) * 0.85)
          + bestMoveScore * 0.75;
      }
      return -Infinity;
    }

    function scoreAiIndustryStratusCorners(workingRoot, player = players.getCurrentPlayer(workingRoot.playerState)) {
      let total = 0;
      let rewardCount = 0;
      for (const card of (workingRoot.cardState.publicCards || []).slice(0, 3)) {
        if (!card) continue;
        const reward = industry?.getCornerReward?.(cards, card);
        const rewardValue = scoreAiIndustryCornerReward(card, reward, {
          workingRoot,
          allowMissing: true,
          moveId: "industryStratusMove",
        });
        if (!Number.isFinite(Number(rewardValue))) return -Infinity;
        if (reward) rewardCount += 1;
        total += Math.max(0, rewardValue);
      }
      return rewardCount > 0 && total > 0 ? total : -Infinity;
    }

    function scoreAiIndustryTuringBorrow(workingRoot, player = players.getCurrentPlayer(workingRoot.playerState)) {
      if (!player || state.pendingActionExecuted || !canStartMainAction()) return -Infinity;
      const best = listAiBorrowTechCandidates(workingRoot, player)[0] || null;
      const bestScore = Math.max(0, aiNumber(best?.score));
      return bestScore >= 5 ? bestScore : -Infinity;
    }

    function listAiIndustryHuanyuMoveCandidates(workingRoot) {
      return listAiEffectMoveCandidates(workingRoot, {
        id: "industryMove",
        free: true,
        poolRemaining: 1,
        industryHuanyuMove: true,
      })
        .filter((candidate) => !(state.industryFreeMoveState?.movedRocketIds || []).includes(candidate.rocketId));
    }

    function scoreAiIndustryHuanyuMoves(workingRoot) {
      const candidates = listAiIndustryHuanyuMoveCandidates(workingRoot)
        .sort((left, right) => Number(right.score || 0) - Number(left.score || 0));
      const positiveCandidates = candidates.filter((candidate) => aiNumber(candidate.score) > 0);
      if (!positiveCandidates.length) return -Infinity;
      const firstMove = positiveCandidates[0] || null;
      const secondMove = firstMove
        ? positiveCandidates.find((candidate) => String(candidate.rocketId) !== String(firstMove.rocketId)) || null
        : null;
      const plannedMoves = [firstMove, secondMove].filter(Boolean);
      const ownsOrange2 = players.playerOwnsTech(players.getCurrentPlayer(workingRoot.playerState), "orange2", createActionContext(workingRoot));
      const asteroidStops = plannedMoves.filter((candidate) => (
        candidate
        && isAiAsteroidCoordinate(candidate.to)
        && Math.max(0, aiNumber(candidate.valueBreakdown?.landingDirectScoreGain)) <= 0
      )).length;
      const asteroidStrandingPenalty = ownsOrange2
        ? 0
        : asteroidStops >= 2 ? 24 : asteroidStops === 1 ? 8 : 0;
      return 3
        + Math.max(0, Number(firstMove?.score || 0))
        + Math.max(0, Number(secondMove?.score || 0)) * 0.45
        - asteroidStrandingPenalty;
    }

    function scoreAiIndustrySentinelArm(player = getCurrentPlayer()) {
      if (!player || state.pendingActionExecuted || !canStartMainAction()) return -Infinity;
      const bestCard = listAiPlayCardCandidates(player)
        .reduce((best, candidate) => Math.max(best, scoreAiCardCornerOpportunity(candidate.card)), 0);
      return bestCard > 0 ? 4 + bestCard * 0.65 : -Infinity;
    }

    function scoreAiIndustryDeepspaceSwap(player = getCurrentPlayer()) {
      const bestSwap = getAiBestDeepspaceSwap(player);
      if (!bestSwap || bestSwap.score <= AI_DEEPSPACE_SWAP_MIN_SCORE) return -Infinity;
      return 2 + bestSwap.score;
    }

    function buildAiIndustryCandidate(workingRoot, player = players.getCurrentPlayer(workingRoot.playerState)) {
      const industryCard = getAiIndustryCard(player);
      if (!industry || !industryCard || !handleCompanyActionMarkerClick) return null;
      const layout = industry.getIndustryActionMarkerLayout?.(industryCard);
      const check = industry.canMarkIndustryAction?.(player, workingRoot.turnState.roundNumber, {
        turnNumber: workingRoot.turnState.turnNumber,
        hasMarker: Boolean(layout),
        industryCard,
      });
      if (!check?.ok) return null;
      const definition = industry.getIndustryDefinition?.(industryCard);
      const abilityId = definition?.activeAbilityId || null;
      let publicPickProfile = null;
      let strategyPassiveSlots = null;
      let score = -Infinity;
      if (abilityId === "stratus_public_corners") {
        score = 4 + scoreAiIndustryStratusCorners(workingRoot, player) * 0.85;
      } else if (abilityId === "turing_borrow_tech") {
        score = scoreAiIndustryTuringBorrow(workingRoot, player);
      } else if (abilityId === "sentinel_arm_play_corner") {
        score = scoreAiIndustrySentinelArm(player);
      } else if (abilityId === "huanyu_free_moves") {
        score = scoreAiIndustryHuanyuMoves(workingRoot);
      } else if (abilityId === "mission_publicity_pick_income") {
        publicPickProfile = getAiIndustryPublicPickProfile(workingRoot, player, "industry_mission_pick");
        score = players.canAfford(player, { publicity: industry.PUBLICITY_PICK_COST || 2 })
          ? publicPickProfile.bestScore - 3
          : -Infinity;
      } else if (abilityId === "fenwick_publicity_pick_corner") {
        publicPickProfile = getAiIndustryPublicPickProfile(workingRoot, player, "industry_fenwick_pick");
        score = players.canAfford(player, { publicity: industry.FENWICK_PUBLICITY_PICK_COST || 1 })
          ? publicPickProfile.bestScore - 3
          : -Infinity;
      } else if (abilityId === "deepspace_swap_cards") {
        score = scoreAiIndustryDeepspaceSwap(player);
      } else if (abilityId === "strategy_pick_card") {
        publicPickProfile = getAiIndustryPublicPickProfile(workingRoot, player, "industry_strategy_pick");
        strategyPassiveSlots = summarizeAiStrategyPassiveSlots(workingRoot, player);
        score = publicPickProfile.bestScore;
      }
      const earlyEmptyStrategyPickPenalty = abilityId === "strategy_pick_card"
        ? scoreAiEarlyEmptyStrategyPickPenalty(player, publicPickProfile, strategyPassiveSlots)
        : 0;
      score -= earlyEmptyStrategyPickPenalty;
      const finalSecondMarkNoDirectSetupPenalty = scoreAiFinalSecondMarkNoDirectSetupPenalty(player, {
        actionId: "industry",
        directScoreGain: 0,
        setupScore: Math.max(0, aiNumber(score)),
        consumesHand: abilityId === "deepspace_swap_cards",
        consumesLastHand: abilityId === "deepspace_swap_cards"
          && Math.max(0, aiNumber(player.resources?.handSize ?? (player.hand || []).length)) <= 1,
        noCashoutRoute: true,
      });
      score -= finalSecondMarkNoDirectSetupPenalty;
      if (!Number.isFinite(Number(score)) || score <= 0) return null;
      return {
        id: "industry",
        kind: "quick",
        available: true,
        industryCard,
        abilityId,
        companyLabel: definition?.label || industryCard.label || "公司牌",
        score,
        gain: Math.max(0, score),
        cost: 0,
        valueBreakdown: {
          abilityId,
          companyLabel: definition?.label || industryCard.label || "公司牌",
          finalSecondMarkNoDirectSetupPenalty,
          earlyEmptyStrategyPickPenalty,
          industryPublicPick: publicPickProfile ? {
            pendingType: publicPickProfile.pendingType,
            bestScore: roundAiScore(publicPickProfile.bestScore),
            bestCard: publicPickProfile.bestCard,
            topCards: publicPickProfile.topCards,
          } : null,
          strategyPassiveSlots,
        },
      };
    }

    function scoreAiSecondMarkAnalyzeReloadDataValue(player = getCurrentPlayer(), placementSlot = 0) {
      if (!player || getAiRoundNumber() < FINAL_ROUND_NUMBER) return 0;
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      if (currentScore < 45 || currentScore >= 50 || countAiFinalMarksForPlayer(player) !== 1) return 0;
      if (aiNumber(player.resources?.energy) < getAiAnalyzeEnergyCost(player)) return 0;
      const requiredSlot = data.ANALYZE_REQUIRED_COMPUTER_SLOT || 6;
      const placedCount = Math.max(0, (data.listComputerPlacedTokens?.(player) || []).length);
      const availableData = Math.max(0, Math.round(aiNumber(player.resources?.availableData)));
      if (placedCount >= requiredSlot || placedCount + availableData < requiredSlot) return 0;
      const bestBlueTraceScore = getAiBestRevealedAlienTraceDirectScore(player, "blue");
      if (currentScore + bestBlueTraceScore < 50) return 0;
      const slot = Math.max(1, Math.round(aiNumber(placementSlot)));
      const remainingPlacements = Math.max(1, requiredSlot - placedCount);
      return Math.min(24, 13 + Math.max(0, 7 - remainingPlacements) * 1.2 + Math.min(4, slot * 0.25));
    }

    function getAiFinalHighScoreDataCreditPreserveProfile(choice, player = getCurrentPlayer()) {
      if (
        !player
        || normalizeAiDifficulty(player?.aiDifficulty || aiAutoBattleState.aiDifficulty) !== AI_DIFFICULTY_WEAK_START
        || getAiRoundNumber() < FINAL_ROUND_NUMBER
        || !state.pendingActionExecuted
        || choice?.target !== data.PLACEMENT_KIND_BLUE_BONUS
        || (turnState.passedPlayerIds || []).includes(player.id)
      ) {
        return null;
      }
      const creditGain = getAiDataPlacementBonuses(choice, player)
        .reduce((total, bonus) => total + Math.max(0, aiNumber(bonus?.credits)), 0);
      if (creditGain <= 0) return null;
      const resources = player.resources || {};
      const currentCredits = Math.max(0, aiNumber(resources.credits));
      if (currentCredits > 0) return null;
      const hand = player.hand || [];
      const handSize = Math.max(hand.length, Math.round(aiNumber(resources.handSize)));
      if (handSize < 2) return null;
      const highScoreProfile = getAiHighScorePushProfile(player);
      const projectedScore = Math.max(0, aiNumber(highScoreProfile.projectedScore || getAiProjectedFinalScore(player)));
      if (
        !highScoreProfile.active
        || projectedScore < 260
        || projectedScore > 310
        || countAiFinalMarksForPlayer(player) < 3
        || getAiNextMissingFinalScoreThreshold(player)
      ) {
        return null;
      }
      const currentPlayable = listAiPlayCardCandidates(player);
      const currentPlayableByIndex = new Map((currentPlayable || []).map((candidate) => [candidate.handIndex, candidate]));
      const currentBestScore = (currentPlayable || []).reduce((best, candidate) => (
        Math.max(best, aiNumber(candidate?.score))
      ), 0);
      const simulatedPlayer = createAiPlayerAfterResourceGain(player, { credits: creditGain });
      if (!simulatedPlayer) return null;
      const postGainCandidates = hand
        .map((card, handIndex) => buildAiPlayCardCandidate(card, handIndex, simulatedPlayer))
        .filter(Boolean)
        .map((candidate) => {
          const finalDeltaValue = Math.max(
            0,
            scoreAiFinalFormulaDeltaValue(candidate.finalFormulaDeltas || {}, player, {
              includePotential: true,
              potentialScale: 0.45,
            }),
          );
          const breakdown = candidate.valueBreakdown || {};
          const directScoreGain = Math.max(0, aiNumber(candidate.directScoreGain));
          const c2Type3ProgressValue = Math.max(0, aiNumber(breakdown.c2Type3ProgressValue));
          const cFinalTaskProgressValue = Math.max(0, aiNumber(breakdown.cFinalTaskProgressValue));
          const endGameExpectedScore = Math.max(0, aiNumber(breakdown.endGameExpectedScore));
          const playCardConversionPressure = Math.max(0, aiNumber(breakdown.playCardConversionPressure));
          const concreteValue = directScoreGain
            + finalDeltaValue
            + c2Type3ProgressValue
            + cFinalTaskProgressValue
            + endGameExpectedScore
            + playCardConversionPressure * 0.45;
          const continuationValue = aiNumber(candidate.score)
            + directScoreGain * 0.8
            + finalDeltaValue * 0.65
            + c2Type3ProgressValue * 0.35
            + cFinalTaskProgressValue * 0.35
            + endGameExpectedScore * 0.25;
          return {
            ...candidate,
            concreteValue,
            continuationValue,
            finalDeltaValue,
          };
        })
        .sort((left, right) => aiNumber(right.continuationValue) - aiNumber(left.continuationValue));
      const bestPlay = postGainCandidates[0] || null;
      if (!bestPlay) return null;
      const currentSameCardScore = aiNumber(currentPlayableByIndex.get(bestPlay.handIndex)?.score);
      const newlyUnlocked = !currentPlayableByIndex.has(bestPlay.handIndex)
        || aiNumber(bestPlay.score) > currentSameCardScore + 1;
      if (!newlyUnlocked || aiNumber(bestPlay.score) < 8 || aiNumber(bestPlay.concreteValue) <= 0) return null;
      const scoreTo300 = Math.max(0, 300 - projectedScore);
      const preservedHandValue = Math.min(6, Math.max(0, handSize - 1) * 1.7);
      const value = Math.min(
        10.5,
        3.2
          + Math.max(0, aiNumber(bestPlay.continuationValue) - currentBestScore) * 0.14
          + Math.max(0, aiNumber(bestPlay.concreteValue)) * 0.16
          + preservedHandValue
          + (scoreTo300 <= 12 ? 1.4 : 0),
      );
      return {
        value: roundAiScore(value),
        projectedScore: roundAiScore(projectedScore),
        scoreTo300: roundAiScore(scoreTo300),
        currentBestPlayScore: roundAiScore(currentBestScore),
        bestPlayCard: {
          handIndex: bestPlay.handIndex,
          cardId: bestPlay.cardId || null,
          cardLabel: bestPlay.cardLabel || null,
          score: roundAiScore(bestPlay.score),
          continuationValue: roundAiScore(bestPlay.continuationValue),
          concreteValue: roundAiScore(bestPlay.concreteValue),
          finalDeltaValue: roundAiScore(bestPlay.finalDeltaValue),
          directScoreGain: roundAiScore(bestPlay.directScoreGain),
        },
        preservedHandValue: roundAiScore(preservedHandValue),
      };
    }

    function scoreAiFinalHighScoreDataCreditPreserveValue(choice, player = getCurrentPlayer()) {
      return Math.max(0, aiNumber(getAiFinalHighScoreDataCreditPreserveProfile(choice, player)?.value));
    }

    function scoreAiDataPlacementChoice(choice, player = getCurrentPlayer()) {
      if (!choice) return -Infinity;
      const target = choice.target || null;
      const placementSlot = Math.max(0, Math.round(aiNumber(choice.placementSlot)));
      if (target === data.PLACEMENT_KIND_COMPUTER) {
        const analyzeReadyBonus = placementSlot >= (data.ANALYZE_REQUIRED_COMPUTER_SLOT || 6) ? 9 : 0;
        const bonusValue = scoreAiDataPlacementBonusValue(choice, player);
        const engineProgressValue = scoreAiDataEngineProgressValue(placementSlot, player);
        const secondMarkAnalyzeReloadValue = scoreAiSecondMarkAnalyzeReloadDataValue(player, placementSlot);
        const finalIncomeRiskPenalty = scoreAiFinalThresholdIncomePlacementPenalty(choice, player);
        const lateIncomeDiscardPenalty = scoreAiLateIncomePlacementDiscardPenalty(choice, player);
        return applyAiStrategyWeight(
          7
            + placementSlot * 0.8
            + bonusValue * 0.85
            + engineProgressValue
            + analyzeReadyBonus
            + secondMarkAnalyzeReloadValue
            + getAiMapDemand(getAiStrategyDemand(player).actions, "analyze") * 0.08,
          "task",
          0.35,
        ) - finalIncomeRiskPenalty - lateIncomeDiscardPenalty;
      }
      if (target === data.PLACEMENT_KIND_BLUE_BONUS) {
        const bonusValue = scoreAiDataPlacementBonusValue(choice, player);
        const finalHighScoreCreditPreserveValue = scoreAiFinalHighScoreDataCreditPreserveValue(choice, player);
        return applyAiStrategyWeight(
          5 + Math.max(0, aiNumber(choice.blueSlot)) * 0.05 + bonusValue * 0.8,
          "tech",
          0.25,
        ) + finalHighScoreCreditPreserveValue;
      }
      return 0;
    }

    function listAiDataPlacementCandidates(player = getCurrentPlayer()) {
      const check = data.canPlaceAnyData?.(player);
      if (!check?.ok) return [];
      return (check.choices || data.listPlaceDataChoices?.(player) || [])
        .map((choice, index) => {
          const creditPreserveProfile = getAiFinalHighScoreDataCreditPreserveProfile(choice, player);
          return {
            id: "placeData",
            kind: "quick",
            available: true,
            target: choice.target || null,
            blueSlot: choice.blueSlot ?? null,
            placementSlot: choice.placementSlot ?? null,
            label: choice.label || null,
            description: choice.description || null,
            directScoreGain: getAiDataPlacementDirectScoreGain(choice, player),
            score: scoreAiDataPlacementChoice(choice, player) - index * 0.05,
            valueBreakdown: creditPreserveProfile ? {
              finalHighScoreDataCreditPreserve: creditPreserveProfile,
            } : null,
          };
        })
        .filter((candidate) => Number.isFinite(Number(candidate.score)));
    }

    function chooseAiDataPlacementOptionFromButtons(buttons = [], player = getCurrentPlayer()) {
      return [...(buttons || [])]
        .map((button, index) => {
          const target = button.dataset.placeTarget || null;
          const blueSlot = button.dataset.blueSlot != null ? Number(button.dataset.blueSlot) : null;
          const placementSlotMatch = String(button.textContent || "").match(/放置位\s*(\d+)/);
          const choice = {
            target,
            blueSlot,
            placementSlot: placementSlotMatch ? Number(placementSlotMatch[1]) : null,
          };
          return {
            button,
            index,
            target,
            blueSlot,
            placementSlot: choice.placementSlot,
            label: button.textContent || "",
            disabled: Boolean(button.disabled),
            score: button.disabled ? -Infinity : scoreAiDataPlacementChoice(choice, player) - index * 0.05,
          };
        })
        .filter((entry) => Number.isFinite(entry.score))
        .sort((left, right) => right.score - left.score || left.index - right.index)[0] || null;
    }
    return Object.freeze({
      buildAiMoveCandidate,
      listAiMoveCandidates,
      getAiIndustryCard,
      getAiIndustryPublicPickProfile,
      scoreAiIndustryPublicPick,
      summarizeAiStrategyPassiveSlots,
      scoreAiEarlyEmptyStrategyPickPenalty,
      listAiCardCornerMoveCandidatesForReward,
      scoreAiIndustryCornerReward,
      scoreAiIndustryStratusCorners,
      scoreAiIndustryTuringBorrow,
      listAiIndustryHuanyuMoveCandidates,
      scoreAiIndustryHuanyuMoves,
      scoreAiIndustrySentinelArm,
      scoreAiIndustryDeepspaceSwap,
      buildAiIndustryCandidate,
      scoreAiSecondMarkAnalyzeReloadDataValue,
      getAiFinalHighScoreDataCreditPreserveProfile,
      scoreAiFinalHighScoreDataCreditPreserveValue,
      scoreAiDataPlacementChoice,
      listAiDataPlacementCandidates,
      chooseAiDataPlacementOptionFromButtons,
    });
  }

  return Object.freeze({ createMovementIndustryData });
});
