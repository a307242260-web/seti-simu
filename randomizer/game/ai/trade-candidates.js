(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAITradeCandidates = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createTradeCandidates(context = {}) {
    const {
      state,
      players,
      rocketActions,
      abilities,
      scanEffects,
      quickTrades,
      cards,
      cardEffects,
      data,
      ai,
      FINAL_ROUND_NUMBER,
      runQuickTrade,
      AI_HUANYU_SUPERDRIVE_INDUSTRY_LABEL,
      AI_HUANYU_SUPERDRIVE_INDUSTRY_ID,
      AI_DIFFICULTY_WEAK_START,
      aiAutoBattleState,
    } = context;
    const readRuleRoot = () => {
      const workingRoot = context.getRuleReadout?.();
      if (!workingRoot) throw new TypeError("AI trade candidates require a StateSource rule readout");
      return workingRoot;
    };
    const requireWorkingRoot = (workingRoot) => {
      if (!workingRoot) throw new TypeError("AI trade candidates require explicit workingRoot");
      return workingRoot;
    };
    const adjustAiActionGraphCandidate = (...args) => context.adjustAiActionGraphCandidate(...args);
    const adjustAiActionGraphCandidateForStyle = (...args) => context.adjustAiActionGraphCandidateForStyle(...args);
    const aiNumber = (...args) => context.aiNumber(...args);
    const buildAiPlayCardCandidate = (...args) => context.buildAiPlayCardCandidate(...args);
    const canAiAnalyzeData = (...args) => context.canAiAnalyzeData(...args);
    const canAiFangzhouTracePlacementScoreAtLeast = (...args) => context.canAiFangzhouTracePlacementScoreAtLeast(...args);
    const canAiMoveThisTurn = (...args) => context.canAiMoveThisTurn(...args);
    const canAiReachAnalyzeReadyWithDataPool = (...args) => context.canAiReachAnalyzeReadyWithDataPool(...args);
    const canStartMainAction = (...args) => context.canStartMainAction(...args);
    const chooseAiTradeDiscardIndexes = (...args) => context.chooseAiTradeDiscardIndexes(...args);
    const countAiFinalMarksForPlayer = (...args) => context.countAiFinalMarksForPlayer(...args);
    const createActionContext = (...args) => context.createActionContext(...args);
    const createAiPlayerAfterQuickTrade = (...args) => context.createAiPlayerAfterQuickTrade(...args);
    const evaluateAiCardsForEnergyAnalyzeProtection = (...args) => context.evaluateAiCardsForEnergyAnalyzeProtection(...args);
    const getAiAnalyzeEnergyCost = (...args) => context.getAiAnalyzeEnergyCost(...args);
    const getAiB2SectorBottleneck = (...args) => context.getAiB2SectorBottleneck(...args);
    const getAiBestRevealedAlienTraceDirectScore = (...args) => context.getAiBestRevealedAlienTraceDirectScore(...args);
    const getAiCardDisplayLabel = (...args) => context.getAiCardDisplayLabel(...args);
    const getAiDiscardedCardOpportunityCost = (...args) => context.getAiDiscardedCardOpportunityCost(...args);
    const getAiHighScorePushProfile = (...args) => context.getAiHighScorePushProfile(...args);
    const getAiIncomeFinalFormulaEntries = (...args) => context.getAiIncomeFinalFormulaEntries(...args);
    const getAiIndustryCard = (...args) => context.getAiIndustryCard(...args);
    const getAiLaunchPaymentCost = (...args) => context.getAiLaunchPaymentCost(...args);
    const getAiLiveScorePaceDeficit = (...args) => context.getAiLiveScorePaceDeficit(...args);
    const getAiMarkedFinalFormulaEntries = (...args) => context.getAiMarkedFinalFormulaEntries(...args);
    const getAiNextMissingFinalScoreThreshold = (...args) => context.getAiNextMissingFinalScoreThreshold(...args);
    const getAiPublicPickConcreteProfile = (...args) => context.getAiPublicPickConcreteProfile(...args);
    const getAiReadyHandTaskCashout = (...args) => context.getAiReadyHandTaskCashout(...args);
    const getAiReservedPlanetCashoutEnergy = (...args) => context.getAiReservedPlanetCashoutEnergy(...args);
    const getAiRoundNumber = (...args) => context.getAiRoundNumber(...args);
    const getAiScanDirectScoreGain = (...args) => context.getAiScanDirectScoreGain(...args);
    const getAiTraceCompetitionState = (...args) => context.getAiTraceCompetitionState(...args);
    const getCardPlayCost = (...args) => context.getCardPlayCost(...args);
    const getCardPrice = (...args) => context.getCardPrice(...args);
    const getCardTypeCode = (...args) => context.getCardTypeCode(...args);
    const getCurrentPlayer = (...args) => context.getCurrentPlayer(...args);
    const hasAiAnalyzeReadyDataSlot = (...args) => context.hasAiAnalyzeReadyDataSlot(...args);
    const isPublicRefillStillPositiveAfterQuickTrade = (...args) => context.isPublicRefillStillPositiveAfterQuickTrade(...args);
    const listAiPlayCardCandidates = (...args) => context.listAiPlayCardCandidates(...args);
    const normalizeAiDifficulty = (...args) => context.normalizeAiDifficulty(...args);
    const roundAiScore = (...args) => context.roundAiScore(...args);
    const scoreAiAnalyzeAction = (...args) => context.scoreAiAnalyzeAction(...args);
    const scoreAiB2SectorScanRecoveryValue = (...args) => context.scoreAiB2SectorScanRecoveryValue(...args);
    const scoreAiEnergyTradeLaunchMoveRecovery = (...args) => context.scoreAiEnergyTradeLaunchMoveRecovery(...args);
    const scoreAiEnergyTradePlanetCashoutRecovery = (...args) => context.scoreAiEnergyTradePlanetCashoutRecovery(...args);
    const scoreAiFinalFormulaDeltaValue = (...args) => context.scoreAiFinalFormulaDeltaValue(...args);
    const scoreAiLaunchTurnCandidateValue = (...args) => context.scoreAiLaunchTurnCandidateValue(...args);
    const scoreAiPostLaunchMovePlan = (...args) => context.scoreAiPostLaunchMovePlan(...args);
    const scoreAiPublicPickCard = (...args) => context.scoreAiPublicPickCard(...args);
    const scoreAiResourceBundle = (...args) => context.scoreAiResourceBundle(...args);
    const scoreAiScanAction = (...args) => context.scoreAiScanAction(...args);
    const scoreAiScanPriorityFloor = (...args) => context.scoreAiScanPriorityFloor(...args);
    const scoreB2SectorScanUnlockTrade = (...args) => context.scoreB2SectorScanUnlockTrade(...args);
    const scoreFinalLowScoreScanUnlockTrade = (...args) => context.scoreFinalLowScoreScanUnlockTrade(...args);
    const scoreMidgameAnalyzeUnlockTrade = (...args) => context.scoreMidgameAnalyzeUnlockTrade(...args);
    const shouldPreserveReadyScanOverRefill = (...args) => context.shouldPreserveReadyScanOverRefill(...args);
    const summarizeAiPublicPickCandidate = (...args) => context.summarizeAiPublicPickCandidate(...args);

    function listAiEmergencyAnalyzeEnergyTradeCandidates(workingRoot, player = getCurrentPlayer()) {
      const { turnState } = requireWorkingRoot(workingRoot);
      if (
        !player
        || !quickTrades?.getTradeAction
        || typeof runQuickTrade !== "function"
        || getAiRoundNumber() !== FINAL_ROUND_NUMBER
        || Math.max(1, Math.round(aiNumber(turnState.turnNumber) || 1)) < 5
        || state.pendingActionExecuted
      ) {
        return [];
      }
      const resources = player.resources || {};
      if (getAiAnalyzeEnergyCost(player) <= 0) return [];
      const currentScore = Math.max(0, aiNumber(resources.score));
      const credits = aiNumber(resources.credits);
      const scoreToSecondMark = Math.max(1, 50 - currentScore);
      const canReachAnalyze = canAiReachAnalyzeReadyWithDataPool(player);
      const hasIncomeFormula = getAiIncomeFinalFormulaEntries(player).length > 0;
      const bestRevealedBlueTraceScore = getAiBestRevealedAlienTraceDirectScore(player, "blue");
      const closeFangzhouBlueSecondMark = currentScore >= 47
        && currentScore < 50
        && credits <= 3
        && hasAiAnalyzeReadyDataSlot(player)
        && canAiFangzhouTracePlacementScoreAtLeast(player, "blue", scoreToSecondMark);
      const closeRevealedBlueSecondMark = currentScore >= 43
        && currentScore < 50
        && credits <= 3
        && hasAiAnalyzeReadyDataSlot(player)
        && currentScore + bestRevealedBlueTraceScore >= 50;
      const placedCount = Math.max(0, (data.listComputerPlacedTokens?.(player) || []).length);
      const tradeValue = ai?.valuation?.estimateSecondMarkAnalyzeEnergyTradeValue
        ? ai.valuation.estimateSecondMarkAnalyzeEnergyTradeValue({
          currentScore,
          finalMarkCount: countAiFinalMarksForPlayer(player),
          energy: aiNumber(resources.energy),
          credits,
          handSize: aiNumber(resources.handSize),
          analyzeEnergyCost: getAiAnalyzeEnergyCost(player),
          roundNumber: getAiRoundNumber(),
          finalRoundNumber: FINAL_ROUND_NUMBER,
          turnNumber: turnState.turnNumber,
          canReachAnalyze,
          hasAnalyzeReadyDataSlot: hasAiAnalyzeReadyDataSlot(player),
          hasIncomeFormula,
          fangzhouBlueScoreCashout: closeFangzhouBlueSecondMark,
          bestRevealedBlueTraceScore,
          placedComputerData: placedCount,
        })
        : 0;
      if (tradeValue <= 0) return [];
      const saferEnergyTrade = quickTrades.getTradeAction("credits-for-energy");
      const saferEnergyTradeAvailable = Boolean(
        saferEnergyTrade
        && aiNumber(saferEnergyTrade.gain?.energy) > 0
        && quickTrades.canExecuteTrade?.("credits-for-energy", createActionContext())?.ok,
      );
      return ["credits-for-energy", "cards-for-energy"]
        .map((tradeId) => {
          const trade = quickTrades.getTradeAction(tradeId);
          const check = quickTrades.canExecuteTrade?.(tradeId, createActionContext()) || { ok: false };
          if (!trade || !check.ok) return null;
          const analyzeTrade = tradeId === "cards-for-energy"
            ? evaluateAiCardsForEnergyAnalyzeProtection(workingRoot, player, trade, null, {
              saferEnergyTradeAvailable,
            })
            : null;
          if (analyzeTrade && (!analyzeTrade.discardPlan.ok || analyzeTrade.protection.shouldProtect)) {
            return null;
          }
          const handTradePenalty = tradeId === "cards-for-energy" ? 2.5 : 0;
          return {
            id: "quickTrade",
            kind: "quick",
            available: true,
            tradeId: trade.id,
            label: trade.label || trade.id,
            score: roundAiScore(tradeValue - handTradePenalty),
            valueBreakdown: {
              emergencyAnalyzeEnergyTrade: true,
              hasIncomeFinalFormula: hasIncomeFormula,
              incomeFormulaSecondMarkFallback: hasIncomeFormula && canReachAnalyze && currentScore >= 49,
              fangzhouBlueScoreCashout: closeFangzhouBlueSecondMark,
              revealedBlueScoreCashout: closeRevealedBlueSecondMark,
              bestRevealedBlueTraceScore,
              placedComputerData: placedCount,
              scoreToSecondFinalMark: scoreToSecondMark,
              handTradePenalty,
              ...(analyzeTrade ? {
                analyzeScore: roundAiScore(analyzeTrade.analyzeScore),
                directScoreProtection: analyzeTrade.protection,
                discardPlan: analyzeTrade.discardPlan,
              } : {}),
            },
          };
        })
        .filter(Boolean)
        .sort((left, right) => aiNumber(right.score) - aiNumber(left.score));
    }

    function listAiFinalAnalyzeEnergyTradeCandidates(workingRoot, player = getCurrentPlayer()) {
      if (
        !player
        || !quickTrades?.getTradeAction
        || typeof runQuickTrade !== "function"
        || getAiRoundNumber() !== FINAL_ROUND_NUMBER
        || state.pendingActionExecuted
        || !canStartMainAction()
      ) {
        return [];
      }

      const resources = player.resources || {};
      const analyzeEnergyCost = getAiAnalyzeEnergyCost(player);
      if (analyzeEnergyCost <= 0) return [];
      if (aiNumber(resources.energy) >= analyzeEnergyCost) return [];
      if (!hasAiAnalyzeReadyDataSlot(player)) return [];
      const saferEnergyTrade = quickTrades.getTradeAction("credits-for-energy");
      const saferEnergyTradeAvailable = Boolean(
        saferEnergyTrade
        && aiNumber(saferEnergyTrade.gain?.energy) > 0
        && quickTrades.canExecuteTrade?.("credits-for-energy", createActionContext())?.ok,
      );

      return ["credits-for-energy", "cards-for-energy"]
        .map((tradeId) => {
          const trade = quickTrades.getTradeAction(tradeId);
          const check = quickTrades.canExecuteTrade?.(tradeId, createActionContext()) || { ok: false };
          if (!trade || !check.ok || aiNumber(trade.gain?.energy) <= 0) return null;
          const competingCreditUnlock = tradeId === "cards-for-energy"
            ? buildAiMainUnlockTradeCandidate(workingRoot, player, "cards-for-credit")
            : null;
          const preserveHandIndex = Number.isInteger(Number(competingCreditUnlock?.valueBreakdown?.bestPlayCard?.handIndex))
            ? Number(competingCreditUnlock.valueBreakdown.bestPlayCard.handIndex)
            : null;
          const analyzeTrade = evaluateAiCardsForEnergyAnalyzeProtection(workingRoot, player, trade, preserveHandIndex, {
            saferEnergyTradeAvailable: tradeId === "cards-for-energy" && saferEnergyTradeAvailable,
          });
          const { discardPlan, simulatedPlayer, analyzeScore, protection: directScoreProtection } = analyzeTrade;
          if (!discardPlan.ok) return null;
          if (!simulatedPlayer || !canAiAnalyzeData(simulatedPlayer).ok) return null;
          if (tradeId === "cards-for-energy" && directScoreProtection.shouldProtect) return null;
          if (analyzeScore < 10) return null;
          const bestBlueTraceScore = getAiBestRevealedAlienTraceDirectScore(player, "blue");
          const genericTradeCost = scoreAiResourceBundle(trade.cost || {});
          const handCost = Math.max(0, Math.round(aiNumber(trade.cost?.handSize)));
          const actualDiscardCost = aiNumber(discardPlan.totalCost);
          const tradeCost = handCost > 0
            ? actualDiscardCost
            : Math.max(genericTradeCost, actualDiscardCost);
          const handOpportunityCost = Math.max(0, actualDiscardCost - genericTradeCost);
          const handTradePenalty = tradeId === "cards-for-energy"
            ? Math.max(2.5, handOpportunityCost * 0.18)
            : 0;
          const highScoreContinuationBonus = aiNumber(resources.score) >= 70 ? 4 : 0;
          const score = analyzeScore * 0.92
            + Math.max(0, bestBlueTraceScore) * 0.75
            + highScoreContinuationBonus
            - tradeCost * 0.28
            - handTradePenalty;
          if (score < 10) return null;
          return {
            id: "quickTrade",
            kind: "quick",
            available: true,
            tradeId: trade.id,
            ...(preserveHandIndex !== null ? { preserveHandIndex } : {}),
            label: trade.label || trade.id,
            reason: "终局交易补能量分析",
            score: roundAiScore(Math.min(48, score)),
            valueBreakdown: {
              finalAnalyzeEnergyTrade: true,
              analyzeScore: roundAiScore(analyzeScore),
              bestBlueTraceScore: roundAiScore(bestBlueTraceScore),
              highScoreContinuationBonus,
              genericTradeCost: roundAiScore(genericTradeCost),
              tradeCost: roundAiScore(tradeCost),
              handOpportunityCost: roundAiScore(handOpportunityCost),
              handTradePenalty,
              preserveHandIndex,
              directScoreProtection,
              competingCreditUnlock: competingCreditUnlock
                ? {
                  tradeId: competingCreditUnlock.tradeId || null,
                  score: roundAiScore(competingCreditUnlock.score),
                  bestPlayCard: competingCreditUnlock.valueBreakdown?.bestPlayCard || null,
                }
                : null,
              discardPlan,
            },
          };
        })
        .filter(Boolean)
        .sort((left, right) => aiNumber(right.score) - aiNumber(left.score));
    }

    function listAiThirdFinalMarkResourceTradeCandidates(workingRoot, player = getCurrentPlayer()) {
      const { cardState } = requireWorkingRoot(workingRoot);
      if (
        !player
        || !quickTrades?.getTradeAction
        || typeof runQuickTrade !== "function"
        || getAiRoundNumber() !== FINAL_ROUND_NUMBER
        || state.pendingActionExecuted
      ) {
        return [];
      }
      const resources = player.resources || {};
      const currentScore = Math.max(0, aiNumber(resources.score));
      const finalMarks = countAiFinalMarksForPlayer(player);
      if (
        finalMarks !== 2
        || currentScore < 50
        || currentScore >= 70
        || getAiNextMissingFinalScoreThreshold(player) !== 70
      ) {
        return [];
      }

      const credits = Math.max(0, aiNumber(resources.credits));
      const energy = Math.max(0, aiNumber(resources.energy));
      const handSize = Math.max(0, aiNumber(resources.handSize));
      const publicity = Math.max(0, aiNumber(resources.publicity));
      const distance = Math.max(1, 70 - currentScore);
      const mainActionOpen = canStartMainAction();
      const canReachAnalyze = canAiReachAnalyzeReadyWithDataPool(player) || hasAiAnalyzeReadyDataSlot(player);
      const scanCost = scanEffects?.getStandardScanCost?.(player) || scanEffects?.SCAN_COST || { credits: 1, energy: 2 };
      const scanCreditShortfall = Math.max(0, Math.max(0, aiNumber(scanCost.credits)) - credits);
      const scanEnergyCost = Math.max(0, aiNumber(scanCost.energy));
      const canScanNowForThirdMark = mainActionOpen
        && currentScore >= 67
        && distance <= 3
        && scanCreditShortfall <= 0
        && energy >= scanEnergyCost
        && Boolean(scanEffects?.canExecuteScan?.(player, { standardAction: true })?.ok);
      const scanDirectScoreGain = canScanNowForThirdMark
        ? Math.max(0, aiNumber(getAiScanDirectScoreGain(workingRoot, player)))
        : 0;
      const canScanCashOutThirdMarkNow = canScanNowForThirdMark
        && currentScore + scanDirectScoreGain >= 70;
      const canPreserveCardsForCloseScan = mainActionOpen
        && currentScore >= 68
        && distance <= 2
        && publicity >= 3
        && handSize >= 2
        && scanCreditShortfall === 1
        && energy >= Math.max(0, aiNumber(scanCost.energy));
      const bestPublicTradeCardScore = mainActionOpen
        ? (cardState.publicCards || []).reduce((best, card) => (
          Math.max(best, scoreAiPublicPickCard(card, player, "trade"))
        ), 0)
        : 0;
      const hasUsefulPublicTradeCard = bestPublicTradeCardScore >= 4;
      const canSearchPublicCardForThirdMark = mainActionOpen
        && currentScore >= 50
        && distance > 8
        && publicity >= 6
        && handSize >= 2
        && handSize <= 4
        && bestPublicTradeCardScore >= 12;
      const launchMoveRecoveryByTrade = {
        "credits-for-energy": scoreAiEnergyTradeLaunchMoveRecovery(workingRoot, player, "credits-for-energy"),
        "cards-for-energy": scoreAiEnergyTradeLaunchMoveRecovery(workingRoot, player, "cards-for-energy"),
      };
      const planetCashoutRecoveryByTrade = {
        "credits-for-energy": scoreAiEnergyTradePlanetCashoutRecovery(player, "credits-for-energy"),
        "cards-for-energy": scoreAiEnergyTradePlanetCashoutRecovery(player, "cards-for-energy"),
      };
      const bestLaunchMoveRecoveryScore = Math.max(
        0,
        aiNumber(launchMoveRecoveryByTrade["credits-for-energy"]?.score),
        aiNumber(launchMoveRecoveryByTrade["cards-for-energy"]?.score),
      );
      const bestPlanetCashoutRecoveryScore = Math.max(
        0,
        aiNumber(planetCashoutRecoveryByTrade["credits-for-energy"]?.score),
        aiNumber(planetCashoutRecoveryByTrade["cards-for-energy"]?.score),
      );
      const cardSearchFallback = mainActionOpen
        && handSize <= 1
        && (credits >= 2 || publicity >= 3);
      const canEnergyCardSearchForThirdMark = mainActionOpen
        && distance > 8
        && energy >= 6
        && handSize <= 4
        && (credits <= 0 || handSize <= 3)
        && bestPublicTradeCardScore >= 8;
      const canEnergyCreditScanForThirdMark = mainActionOpen
        && scanCreditShortfall === 1
        && credits <= 0
        && energy >= Math.max(4, Math.max(0, aiNumber(scanCost.energy)) + 2)
        && distance <= 12;
      const energyCreditTrade = quickTrades.getTradeAction("energy-for-credit");
      const playerAfterEnergyCredit = energyCreditTrade
        ? createAiPlayerAfterQuickTrade(player, energyCreditTrade)
        : null;
      const bestHandPlayScoreAfterEnergyCredit = playerAfterEnergyCredit
        ? (player.hand || []).reduce((best, card, handIndex) => (
          Math.max(best, aiNumber(buildAiPlayCardCandidate(workingRoot, card, handIndex, playerAfterEnergyCredit)?.score))
        ), 0)
        : 0;
      const canEnergyCreditRecoveryForThirdMark = mainActionOpen
        && credits <= 0
        && energy >= Math.max(4, Math.max(0, aiNumber(scanCost.energy)) + 2)
        && handSize >= 1
        && bestHandPlayScoreAfterEnergyCredit >= 8
        && distance <= 22;
      if (
        distance > 8
        && !canReachAnalyze
        && bestLaunchMoveRecoveryScore <= 0
        && !cardSearchFallback
        && !canSearchPublicCardForThirdMark
        && !canEnergyCardSearchForThirdMark
        && !canEnergyCreditScanForThirdMark
        && !canEnergyCreditRecoveryForThirdMark
      ) return [];
      const needsAnalyzeEnergy = canReachAnalyze && energy < getAiAnalyzeEnergyCost(player);
      const needsLaunchMoveEnergy = energy <= 1 && bestLaunchMoveRecoveryScore > 0;
      const needsPlanetCashoutEnergy = energy <= 1 && bestPlanetCashoutRecoveryScore > 0;
      const scanEnergyShortfall = Math.max(0, scanEnergyCost - energy);
      const canScanAfterOneEnergyTradeForThirdMark = mainActionOpen
        && distance <= 4
        && scanCreditShortfall <= 0
        && scanEnergyShortfall === 1
        && currentScore + Math.max(0, aiNumber(getAiScanDirectScoreGain(workingRoot, player))) >= 70;
      const canUseExtraEnergy = needsAnalyzeEnergy
        || needsLaunchMoveEnergy
        || needsPlanetCashoutEnergy
        || canScanAfterOneEnergyTradeForThirdMark;
      const launchMoveRecoveryValue = bestLaunchMoveRecoveryScore > 0
        ? Math.min(18, 8 + bestLaunchMoveRecoveryScore * 0.8)
        : 0;
      const planetCashoutRecoveryValue = bestPlanetCashoutRecoveryScore > 0
        ? Math.min(18, 8 + bestPlanetCashoutRecoveryScore * 0.75)
        : 0;
      const baseValue = 20
        + Math.max(0, 16 - distance) * 0.45
        + (canReachAnalyze ? 4 : 0)
        + launchMoveRecoveryValue
        + planetCashoutRecoveryValue
        + (canScanAfterOneEnergyTradeForThirdMark ? 5 : 0);
      const tradeSpecs = [
        {
          tradeId: "credits-for-energy",
          enabled: canUseExtraEnergy && credits >= 2,
          value: baseValue + 5 + Math.min(14, aiNumber(launchMoveRecoveryByTrade["credits-for-energy"]?.score) * 0.7),
          reason: "终局第3标记：信用点换能量续行动",
        },
        {
          tradeId: "cards-for-energy",
          enabled: canUseExtraEnergy && handSize >= 2,
          value: baseValue + (credits <= 0 ? 4 : 1.5)
            + Math.min(14, aiNumber(launchMoveRecoveryByTrade["cards-for-energy"]?.score) * 0.7),
          reason: "终局第3标记：弃牌换能量续行动",
        },
        {
          tradeId: "credits-for-card",
          enabled: mainActionOpen && !canScanCashOutThirdMarkNow && handSize <= 1 && credits >= 2,
          value: baseValue - 1,
          reason: "终局第3标记：补手牌寻找得分",
        },
        {
          tradeId: "publicity-for-card",
          enabled: mainActionOpen && publicity >= 3 && (
            (handSize <= 1 && hasUsefulPublicTradeCard)
            || canPreserveCardsForCloseScan
            || canSearchPublicCardForThirdMark
          ) && !canScanCashOutThirdMarkNow,
          value: baseValue
            + (canPreserveCardsForCloseScan ? 4 : canSearchPublicCardForThirdMark ? 4 : -1)
            + (!canPreserveCardsForCloseScan && !canSearchPublicCardForThirdMark ? Math.min(6, bestPublicTradeCardScore * 0.22) : 0)
            + (canSearchPublicCardForThirdMark ? Math.min(12, bestPublicTradeCardScore * 0.35) : 0),
          reason: canPreserveCardsForCloseScan
            ? "终局第3标记：宣传补牌保留扫描后手牌"
            : canSearchPublicCardForThirdMark
              ? "终局第3标记：宣传精选寻找得分牌"
              : "终局第3标记：宣传换牌寻找得分",
        },
        {
          tradeId: "energy-for-card",
          enabled: canEnergyCardSearchForThirdMark && !canScanCashOutThirdMarkNow,
          value: baseValue
            + 1.5
            + (credits <= 0 ? 2.5 : 0)
            + (handSize <= 2 ? 1.5 : 0)
            + Math.min(8, bestPublicTradeCardScore * 0.28),
          reason: "终局第3标记：富余能量精选寻找得分牌",
        },
        {
          tradeId: "energy-for-credit",
          enabled: canEnergyCreditScanForThirdMark || canEnergyCreditRecoveryForThirdMark,
          value: baseValue
            + 4
            + Math.max(0, 12 - distance) * 0.55
            + (canEnergyCreditRecoveryForThirdMark ? Math.min(8, bestHandPlayScoreAfterEnergyCredit * 0.25) : 0),
          reason: canEnergyCreditScanForThirdMark
            ? "终局第3标记：能量换信用点准备扫描"
            : "终局第3标记：能量换信用点恢复打牌/扫描",
        },
      ];

      return tradeSpecs
        .filter((spec) => spec.enabled)
        .map((spec) => {
          const trade = quickTrades.getTradeAction(spec.tradeId);
          const check = quickTrades.canExecuteTrade?.(spec.tradeId, createActionContext()) || { ok: false };
          if (!trade || !check.ok) return null;
          return {
            id: "quickTrade",
            kind: "quick",
            available: true,
            tradeId: trade.id,
            label: trade.label || trade.id,
            score: roundAiScore(spec.value),
            reason: spec.reason,
            valueBreakdown: {
              thirdFinalMarkResourceTrade: true,
              currentScore,
              scoreToThirdFinalMark: distance,
              finalMarkCount: finalMarks,
              canReachAnalyze,
              launchMoveRecoveryScore: aiNumber(launchMoveRecoveryByTrade[spec.tradeId]?.score),
              cardSearchFallback,
              canPreserveCardsForCloseScan,
              canSearchPublicCardForThirdMark,
              canEnergyCardSearchForThirdMark,
              canEnergyCreditScanForThirdMark,
              canEnergyCreditRecoveryForThirdMark,
              needsAnalyzeEnergy,
              needsLaunchMoveEnergy,
              needsPlanetCashoutEnergy,
              canScanAfterOneEnergyTradeForThirdMark,
              bestHandPlayScoreAfterEnergyCredit: roundAiScore(bestHandPlayScoreAfterEnergyCredit),
              canScanNowForThirdMark,
              canScanCashOutThirdMarkNow,
              scanDirectScoreGain,
              bestPublicTradeCardScore: roundAiScore(bestPublicTradeCardScore),
              scanCost,
            },
          };
        })
        .filter(Boolean)
        .sort((left, right) => aiNumber(right.score) - aiNumber(left.score));
    }

    function summarizeAiTradeDiscardCardEntry(entry = {}) {
      const card = entry.card || null;
      const playCandidate = entry.playCandidate || null;
      return {
        handIndex: Number.isInteger(Number(entry.handIndex)) ? Number(entry.handIndex) : null,
        cardId: card?.cardId || card?.id || null,
        cardInstanceId: card?.id || null,
        cardLabel: getAiCardDisplayLabel({ card, handIndex: entry.handIndex }, getCurrentPlayer())
          || card?.cardName
          || card?.label
          || null,
        price: getCardPrice(card),
        typeCode: getCardTypeCode(card),
        opportunityCost: roundAiScore(entry.opportunityCost),
        playScore: playCandidate ? roundAiScore(playCandidate.score) : null,
        directScoreGain: playCandidate ? roundAiScore(playCandidate.directScoreGain) : 0,
        effectTypes: Array.isArray(playCandidate?.effectTypes)
          ? playCandidate.effectTypes.slice(0, 6)
          : [],
        valueSignals: playCandidate?.valueBreakdown ? {
          planScore: roundAiScore(playCandidate.valueBreakdown.planScore),
          endGameExpectedScore: roundAiScore(playCandidate.valueBreakdown.endGameExpectedScore),
          c2Type3ProgressValue: roundAiScore(playCandidate.valueBreakdown.c2Type3ProgressValue),
          cFinalTaskProgressValue: roundAiScore(playCandidate.valueBreakdown.cFinalTaskProgressValue),
          readyTaskCashoutDirectScore: roundAiScore(playCandidate.valueBreakdown.readyTaskCashoutDirectScore),
          readyTaskCashoutCount: roundAiScore(playCandidate.valueBreakdown.readyTaskCashoutCount),
        } : null,
      };
    }

    function buildAiTradeDiscardCostEntries(workingRoot, player = getCurrentPlayer(), preserveHandIndex = null) {
      const explicitPreserveHandIndex = preserveHandIndex === null || preserveHandIndex === undefined || preserveHandIndex === ""
        ? null
        : Number(preserveHandIndex);
      const preservedIndex = Number.isInteger(explicitPreserveHandIndex) ? explicitPreserveHandIndex : null;
      return (player?.hand || [])
        .map((card, handIndex) => {
          if (preservedIndex !== null && Number(handIndex) === preservedIndex) return null;
          const playCandidate = buildAiPlayCardCandidate(workingRoot, card, handIndex, player);
          const opportunityCost = getAiDiscardedCardOpportunityCost(card, playCandidate);
          if (!Number.isFinite(Number(opportunityCost))) return null;
          return {
            card,
            handIndex,
            playCandidate,
            opportunityCost: aiNumber(opportunityCost),
          };
        })
        .filter(Boolean)
        .sort((left, right) => (
          aiNumber(left.opportunityCost) - aiNumber(right.opportunityCost)
          || String(getAiCardDisplayLabel({ card: left.card, handIndex: left.handIndex }, player) || "").localeCompare(
            String(getAiCardDisplayLabel({ card: right.card, handIndex: right.handIndex }, player) || ""),
            "zh-Hans-CN",
          )
          || aiNumber(left.handIndex) - aiNumber(right.handIndex)
        ));
    }

    function summarizeAiTradeDiscardPlan(workingRoot, player = getCurrentPlayer(), trade = null, preserveHandIndex = null, options = {}) {
      if (!player || !trade) {
        return {
          ok: false,
          reason: "missing-player-or-trade",
          handCost: 0,
          resourceCostValue: null,
          totalCost: null,
          selectedCards: [],
          candidateCards: [],
        };
      }
      const handCost = Math.max(0, Math.round(aiNumber(trade.cost?.handSize)));
      const resourceCost = { ...(trade.cost || {}) };
      delete resourceCost.handSize;
      const resourceCostValue = scoreAiResourceBundle(resourceCost);
      const explicitPreserveHandIndex = preserveHandIndex === null || preserveHandIndex === undefined || preserveHandIndex === ""
        ? null
        : Number(preserveHandIndex);
      const preservedIndex = Number.isInteger(explicitPreserveHandIndex) ? explicitPreserveHandIndex : null;
      const tradeId = options.tradeId || trade.id || null;
      const costEntries = buildAiTradeDiscardCostEntries(workingRoot, player, null);
      const costEntryByIndex = new Map(costEntries.map((entry) => [Number(entry.handIndex), entry]));
      const executionIndexes = tradeId && handCost > 0
        ? chooseAiTradeDiscardIndexes(workingRoot, player, handCost, { tradeId, preserveHandIndex: preservedIndex }) || []
        : [];
      const selectedEntries = tradeId
        ? executionIndexes
          .slice(0, handCost)
          .map((index) => costEntryByIndex.get(Number(index)))
          .filter(Boolean)
        : buildAiTradeDiscardCostEntries(workingRoot, player, preservedIndex).slice(0, handCost);
      const hasEnoughCards = selectedEntries.length >= handCost;
      const totalCost = hasEnoughCards
        ? resourceCostValue + selectedEntries.reduce((total, entry) => total + Math.max(0, aiNumber(entry.opportunityCost)), 0)
        : Infinity;
      const plan = {
        ok: hasEnoughCards,
        reason: hasEnoughCards ? null : "insufficient-discard-cards",
        handCost,
        preservedHandIndex: preservedIndex,
        resourceCostValue: roundAiScore(resourceCostValue),
        totalCost: Number.isFinite(totalCost) ? roundAiScore(totalCost) : null,
        selectedCards: selectedEntries.map(summarizeAiTradeDiscardCardEntry),
        candidateCards: costEntries
          .slice(0, Math.max(4, handCost + 2))
          .map(summarizeAiTradeDiscardCardEntry),
        candidateCount: costEntries.length,
      };

      if (options.includeExecutionPlan && handCost > 0) {
        const selectedIndexSet = new Set(selectedEntries.map((entry) => Number(entry.handIndex)));
        plan.executionSelectedIndexes = executionIndexes.slice(0, handCost).map((index) => Number(index));
        plan.executionSelectedCards = plan.executionSelectedIndexes
          .map((handIndex) => {
            const entry = costEntryByIndex.get(Number(handIndex));
            if (entry) return summarizeAiTradeDiscardCardEntry(entry);
            const card = player.hand?.[handIndex] || null;
            if (!card) return null;
            const playCandidate = buildAiPlayCardCandidate(workingRoot, card, handIndex, player);
            return summarizeAiTradeDiscardCardEntry({
              card,
              handIndex,
              playCandidate,
              opportunityCost: getAiDiscardedCardOpportunityCost(card, playCandidate),
            });
          })
          .filter(Boolean);
        plan.executionMatchesCostPlan = (
          plan.executionSelectedIndexes.length === selectedIndexSet.size
          && plan.executionSelectedIndexes.every((index) => selectedIndexSet.has(Number(index)))
        );
      }
      return plan;
    }

    function estimateAiTradeDiscardOpportunityCost(workingRoot, player = getCurrentPlayer(), trade = null, preserveHandIndex = null) {
      const plan = summarizeAiTradeDiscardPlan(workingRoot, player, trade, preserveHandIndex);
      return plan.ok && Number.isFinite(Number(plan.totalCost)) ? Number(plan.totalCost) : Infinity;
    }

    function summarizeAiRepeatedCardsForCreditDiscardPlan(workingRoot, player = getCurrentPlayer(), preserveHandIndex = null, tradeCount = 1) {
      const count = Math.max(0, Math.round(aiNumber(tradeCount)));
      const trade = quickTrades?.getTradeAction?.("cards-for-credit") || null;
      if (!player || !trade || count <= 0) {
        return {
          ok: false,
          reason: "missing-player-or-trade",
          tradeCount: count,
          handCost: 0,
          totalHandCost: 0,
          totalCost: null,
          selectedCards: [],
          candidateCards: [],
          candidateCount: 0,
        };
      }

      const handCost = Math.max(0, Math.round(aiNumber(trade.cost?.handSize)));
      const totalHandCost = handCost * count;
      const costEntries = buildAiTradeDiscardCostEntries(workingRoot, player, preserveHandIndex);
      const selectedEntries = costEntries.slice(0, totalHandCost);
      const hasEnoughCards = totalHandCost > 0 && selectedEntries.length >= totalHandCost;
      const totalCost = hasEnoughCards
        ? selectedEntries.reduce((total, entry) => total + Math.max(0, aiNumber(entry.opportunityCost)), 0)
        : Infinity;
      return {
        ok: hasEnoughCards,
        reason: hasEnoughCards ? null : "insufficient-discard-cards",
        tradeCount: count,
        handCost,
        totalHandCost,
        totalCost: Number.isFinite(totalCost) ? roundAiScore(totalCost) : null,
        selectedCards: selectedEntries.map(summarizeAiTradeDiscardCardEntry),
        candidateCards: costEntries
          .slice(0, Math.max(4, totalHandCost + 2))
          .map(summarizeAiTradeDiscardCardEntry),
        candidateCount: costEntries.length,
      };
    }

    function createAiPlayerAfterRepeatedQuickTrade(player = getCurrentPlayer(), trade = null, tradeCount = 1) {
      let simulatedPlayer = player;
      const count = Math.max(0, Math.round(aiNumber(tradeCount)));
      for (let index = 0; index < count; index += 1) {
        simulatedPlayer = createAiPlayerAfterQuickTrade(simulatedPlayer, trade);
        if (!simulatedPlayer) return null;
      }
      return simulatedPlayer;
    }

    function getAiFinalReadyTaskCreditChainProfile(workingRoot, player = getCurrentPlayer(), options = {}) {
      const { turnState } = requireWorkingRoot(workingRoot);
      if (
        !player
        || !quickTrades?.getTradeAction
        || getAiRoundNumber() < FINAL_ROUND_NUMBER
        || state.pendingActionExecuted
        || countAiFinalMarksForPlayer(player) < 3
        || getAiNextMissingFinalScoreThreshold(player)
        || (turnState.passedPlayerIds || []).includes(player.id)
      ) {
        return null;
      }
      if (options.requireMainActionOpen !== false && !canStartMainAction()) return null;

      const resources = player.resources || {};
      const currentScore = Math.max(0, aiNumber(resources.score));
      if (currentScore < 100 || currentScore >= 170) return null;

      const hand = player.hand || [];
      const actualHandSize = hand.length;
      const hasResourceHandSize = Number.isFinite(Number(resources.handSize));
      const resourceHandSize = hasResourceHandSize
        ? Math.max(0, Math.round(aiNumber(resources.handSize)))
        : actualHandSize;
      const handSize = hasResourceHandSize
        ? Math.min(actualHandSize, resourceHandSize)
        : actualHandSize;
      const credits = Math.max(0, aiNumber(resources.credits));
      if (credits < 1 || handSize < 3) return null;

      const trade = quickTrades.getTradeAction("cards-for-credit");
      const handCost = Math.max(0, Math.round(aiNumber(trade?.cost?.handSize)));
      const creditGain = Math.max(0, aiNumber(trade?.gain?.credits));
      if (!trade || handCost < 2 || creditGain <= 0) return null;

      const currentBestPlayScore = hand.reduce((best, card, handIndex) => {
        const candidate = buildAiPlayCardCandidate(workingRoot, card, handIndex, player);
        return Math.max(best, aiNumber(candidate?.score));
      }, 0);

      const targets = hand
        .map((card, handIndex) => {
          const model = cardEffects.getCardModel?.(card) || null;
          const readyTaskCashout = getAiReadyHandTaskCashout(card, model, player);
          const price = getCardPrice(card);
          const creditsMissing = Math.max(0, aiNumber(price) - credits);
          const tradesNeeded = Math.ceil(creditsMissing / creditGain);
          const totalHandCost = tradesNeeded * handCost;
          if (
            aiNumber(price) < 3
            || aiNumber(readyTaskCashout.directScore) <= 0
            || creditsMissing <= 0
            || tradesNeeded < 1
            || tradesNeeded > 2
            || handSize - 1 < totalHandCost
          ) {
            return null;
          }

          const discardPlan = summarizeAiRepeatedCardsForCreditDiscardPlan(workingRoot, player, handIndex, tradesNeeded);
          if (!discardPlan.ok) return null;
          const simulatedPlayer = createAiPlayerAfterRepeatedQuickTrade(player, trade, tradesNeeded);
          if (!simulatedPlayer || !players.canAfford(simulatedPlayer, getCardPlayCost(card))) return null;
          const playCandidate = buildAiPlayCardCandidate(workingRoot, card, handIndex, simulatedPlayer);
          if (!playCandidate) return null;
          const breakdown = playCandidate.valueBreakdown || {};
          const finalDeltaValue = Math.max(
            0,
            scoreAiFinalFormulaDeltaValue(playCandidate.finalFormulaDeltas || {}, player, {
              includePotential: true,
              potentialScale: 0.45,
            }),
          );
          const concreteFinalValue = Math.max(0, aiNumber(playCandidate.directScoreGain))
            + Math.max(0, aiNumber(breakdown.readyTaskCashoutValue))
            + Math.max(0, aiNumber(breakdown.cFinalTaskProgressValue))
            + Math.max(0, aiNumber(breakdown.c2Type3ProgressValue))
            + Math.max(0, aiNumber(breakdown.endGameExpectedScore))
            + finalDeltaValue;
          if (concreteFinalValue < 7) return null;
          if (currentBestPlayScore >= Math.max(18, aiNumber(playCandidate.score) - 1)) return null;

          const discardCost = Math.max(0, aiNumber(discardPlan.totalCost));
          const lowTailPressure = Math.max(0, 170 - currentScore) * 0.08;
          const repeatedTradePenalty = Math.max(0, tradesNeeded - 1) * 1.5;
          const score = 17
            + Math.max(0, aiNumber(breakdown.readyTaskCashoutValue))
            + Math.max(0, aiNumber(playCandidate.directScoreGain)) * 1.35
            + Math.max(0, aiNumber(breakdown.cFinalTaskProgressValue)) * 0.65
            + Math.max(0, finalDeltaValue) * 0.45
            + lowTailPressure
            - discardCost * 0.18
            - repeatedTradePenalty;

          return {
            handIndex,
            cardId: playCandidate.cardId || card?.cardId || card?.id || null,
            cardInstanceId: playCandidate.cardInstanceId || card?.id || null,
            cardLabel: playCandidate.cardLabel || getAiCardDisplayLabel({ card, handIndex }, player),
            price,
            creditsMissing: roundAiScore(creditsMissing),
            tradesNeeded,
            playCandidate,
            readyTaskCashout,
            concreteFinalValue: roundAiScore(concreteFinalValue),
            finalDeltaValue: roundAiScore(finalDeltaValue),
            discardCost: roundAiScore(discardCost),
            discardPlan,
            score: roundAiScore(Math.min(38, Math.max(0, score))),
          };
        })
        .filter(Boolean)
        .sort((left, right) => (
          aiNumber(right.score) - aiNumber(left.score)
          || aiNumber(right.concreteFinalValue) - aiNumber(left.concreteFinalValue)
          || aiNumber(left.tradesNeeded) - aiNumber(right.tradesNeeded)
        ));

      const target = targets[0] || null;
      if (!target || aiNumber(target.score) < 14) return null;
      return {
        tradeId: "cards-for-credit",
        target,
        currentScore,
        credits,
        handSize,
        currentBestPlayScore: roundAiScore(currentBestPlayScore),
      };
    }

    function listAiFinalReadyTaskCreditChainTradeCandidates(workingRoot, player = getCurrentPlayer()) {
      if (
        !player
        || !quickTrades?.getTradeAction
        || state.pendingActionExecuted
        || !canStartMainAction()
      ) {
        return [];
      }
      const profile = getAiFinalReadyTaskCreditChainProfile(workingRoot, player);
      if (!profile) return [];
      const trade = quickTrades.getTradeAction(profile.tradeId);
      const check = quickTrades.canExecuteTrade?.(profile.tradeId, createActionContext(workingRoot)) || { ok: false };
      if (!trade || !check.ok) return [];
      const target = profile.target || {};
      const tradeUnlockEligible = (
        aiNumber(profile.currentScore) >= 135
        && aiNumber(profile.currentScore) < 170
        && aiNumber(target.tradesNeeded) === 1
        && aiNumber(target.creditsMissing) <= 1
        && aiNumber(target.readyTaskCashout?.directScore) >= 9
        && aiNumber(target.concreteFinalValue) >= 9
        && aiNumber(target.discardCost) <= 6
        && aiNumber(target.playCandidate?.score) >= 18
      );
      return [{
        id: "quickTrade",
        kind: "quick",
        available: false,
        tradeId: trade.id,
        preserveHandIndex: target.handIndex,
        label: trade.label || trade.id,
        reason: target.tradesNeeded > 1
          ? "终局已完成任务：连续弃牌补信用点"
          : "终局已完成任务：弃牌补信用点",
        unavailableReason: "诊断-only：需证明替代链优于当前主行动后再放行",
        score: target.score,
        valueBreakdown: {
          finalReadyTaskCreditChainTrade: true,
          diagnosticOnly: true,
          finalReadyTaskTradeUnlockEligible: tradeUnlockEligible,
          currentScore: profile.currentScore,
          credits: profile.credits,
          handSize: profile.handSize,
          currentBestPlayScore: profile.currentBestPlayScore,
          targetCard: {
            handIndex: target.handIndex,
            cardId: target.cardId || null,
            cardLabel: target.cardLabel || null,
            price: target.price,
            creditsMissing: target.creditsMissing,
            tradesNeeded: target.tradesNeeded,
            playScore: roundAiScore(target.playCandidate?.score),
            directScoreGain: roundAiScore(target.playCandidate?.directScoreGain),
            readyTaskCashoutValue: roundAiScore(target.readyTaskCashout?.value),
            readyTaskCashoutDirectScore: roundAiScore(target.readyTaskCashout?.directScore),
            readyTaskCashoutCount: roundAiScore(target.readyTaskCashout?.count),
            concreteFinalValue: target.concreteFinalValue,
            finalDeltaValue: target.finalDeltaValue,
          },
          discardCost: target.discardCost,
          discardPlan: target.discardPlan,
        },
      }];
    }

    function countAiQuickTradesThisTurn(playerId = getCurrentPlayer()?.id) {
      if (!playerId) return 0;
      const { turnState } = readRuleRoot();
      return (aiAutoBattleState.logs || []).filter((entry) => (
        entry?.type === "turn-action"
        && entry.roundNumber === turnState.roundNumber
        && entry.rawTurnNumber === turnState.turnNumber
        && entry.playerId === playerId
        && entry.details?.action?.id === "quickTrade"
      )).length;
    }

    function getAiBestOpenedMainActionScore(candidates = []) {
      return (candidates || [])
        .filter((candidate) => (
          candidate?.kind === "main"
          && candidate.available !== false
          && candidate.id !== "launch"
          && candidate.id !== "playCard"
        ))
        .reduce((best, candidate) => Math.max(best, aiNumber(candidate.score)), 0);
    }

    function buildAiMainUnlockTradeCandidate(workingRoot, player = getCurrentPlayer(), tradeId = null, playCardCandidates = null, candidates = []) {
      if (!player || !tradeId || !quickTrades?.getTradeAction) return null;
      const trade = quickTrades.getTradeAction(tradeId);
      const check = quickTrades.canExecuteTrade?.(tradeId, createActionContext(workingRoot)) || { ok: false };
      if (!trade || !check.ok || aiNumber(trade.gain?.credits) <= 0) return null;
      const hand = player.hand || [];
      const handCost = Math.max(0, Math.round(aiNumber(trade.cost?.handSize)));
      const cardsRemaining = hand.length - handCost + Math.max(0, Math.round(aiNumber(trade.gain?.handSize)));
      if (cardsRemaining <= 0) return null;
      const currentCredits = Math.max(0, aiNumber(player.resources?.credits));
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      const currentPlayable = playCardCandidates || listAiPlayCardCandidates(workingRoot, player);
      const currentPlayableByIndex = new Map((currentPlayable || []).map((candidate) => [candidate.handIndex, candidate]));
      const currentBestScore = (currentPlayable || []).reduce((best, candidate) => (
        Math.max(best, aiNumber(candidate?.score))
      ), 0);
      const currentFinalMarks = countAiFinalMarksForPlayer(player);
      const highScorePushProfile = getAiHighScorePushProfile(player);
      const industryCard = getAiIndustryCard(player);
      const huanyuWithoutCompletedTasks = Boolean(
        (industryCard?.id === AI_HUANYU_SUPERDRIVE_INDUSTRY_ID
          || industryCard?.label === AI_HUANYU_SUPERDRIVE_INDUSTRY_LABEL)
        && Math.max(0, Math.round(aiNumber(player.completedTaskCount))) === 0
        && highScorePushProfile.projectedScore < 150
      );
      const finalLowTailOneCreditUnlock = (
        tradeId === "cards-for-credit"
        && currentCredits === 1
        && getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && currentFinalMarks >= 3
        && !getAiNextMissingFinalScoreThreshold(player)
        && currentScore >= 70
        && currentScore < 155
        && hand.length >= 3
        && currentBestScore < 8
      );
      const finalHighScoreOneCreditUnlock = (
        tradeId === "cards-for-credit"
        && currentCredits === 1
        && getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && currentFinalMarks >= 3
        && !getAiNextMissingFinalScoreThreshold(player)
        && highScorePushProfile.active
        && highScorePushProfile.projectedScore >= 290
        && highScorePushProfile.projectedScore < 305
        && hand.length >= 3
        && currentBestScore < 8
      );
      if (currentCredits > 0 && !(finalLowTailOneCreditUnlock || finalHighScoreOneCreditUnlock)) return null;
      const simulatedPlayer = createAiPlayerAfterQuickTrade(player, trade);
      if (!simulatedPlayer) return null;
      const postTradeCandidates = hand
        .map((card, handIndex) => buildAiPlayCardCandidate(workingRoot, card, handIndex, simulatedPlayer))
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
          const continuationValue = aiNumber(candidate.score)
            + Math.max(0, aiNumber(candidate.directScoreGain)) * 0.8
            + finalDeltaValue * 0.65
            + Math.max(0, aiNumber(breakdown.c2Type3ProgressValue)) * 0.35
            + Math.max(0, aiNumber(breakdown.cFinalTaskProgressValue)) * 0.35
            + Math.max(0, aiNumber(breakdown.endGameExpectedScore)) * 0.25;
          return {
            ...candidate,
            finalDeltaValue,
            continuationValue,
          };
        })
        .sort((left, right) => aiNumber(right.continuationValue) - aiNumber(left.continuationValue));
      const bestPlay = postTradeCandidates[0] || null;
      if (!bestPlay) return null;
      const currentSameCardScore = aiNumber(currentPlayableByIndex.get(bestPlay.handIndex)?.score);
      const newlyUnlocked = !currentPlayableByIndex.has(bestPlay.handIndex)
        || aiNumber(bestPlay.score) > currentSameCardScore + 1;
      if (!newlyUnlocked && currentBestScore >= aiNumber(bestPlay.score) - 0.5) return null;
      const breakdown = bestPlay.valueBreakdown || {};
      const directScoreGain = Math.max(0, aiNumber(bestPlay.directScoreGain));
      const c2Type3ProgressValue = Math.max(0, aiNumber(breakdown.c2Type3ProgressValue));
      const cFinalTaskProgressValue = Math.max(0, aiNumber(breakdown.cFinalTaskProgressValue));
      const endGameExpectedScore = Math.max(0, aiNumber(breakdown.endGameExpectedScore));
      const measurableFinalValue = directScoreGain
        + Math.max(0, aiNumber(bestPlay.finalDeltaValue))
        + c2Type3ProgressValue
        + cFinalTaskProgressValue
        + endGameExpectedScore;
      const concretePlanScore = bestPlay.plan?.actionId === "task" && cFinalTaskProgressValue <= 0
        ? 0
        : Math.max(0, aiNumber(breakdown.planScore));
      const concreteFinalValue = directScoreGain
        + Math.max(0, aiNumber(bestPlay.finalDeltaValue))
        + c2Type3ProgressValue
        + cFinalTaskProgressValue
        + endGameExpectedScore
        + Math.max(0, aiNumber(breakdown.playCardConversionPressure))
        + concretePlanScore;
      const finalMarks = currentFinalMarks;
      if (aiNumber(bestPlay.score) < 8) return null;
      if (finalMarks >= 3 && concreteFinalValue <= 0) return null;
      if (finalLowTailOneCreditUnlock && huanyuWithoutCompletedTasks && measurableFinalValue < 4) return null;
      const weakRepeatedTradeOverOpenedMain = (
        tradeId === "cards-for-credit"
        && normalizeAiDifficulty(player.aiDifficulty || aiAutoBattleState.aiDifficulty) === AI_DIFFICULTY_WEAK_START
        && finalLowTailOneCreditUnlock
        && countAiQuickTradesThisTurn(player.id) > 0
        && handCost >= 2
        && directScoreGain <= 0
        && concreteFinalValue < 34
        && getAiBestOpenedMainActionScore(candidates) >= 12
      );
      if (weakRepeatedTradeOverOpenedMain) return null;
      const discardCost = estimateAiTradeDiscardOpportunityCost(workingRoot, player, trade, bestPlay.handIndex);
      if (!Number.isFinite(discardCost)) return null;
      const nextThreshold = getAiNextMissingFinalScoreThreshold(player);
      const thresholdBonus = nextThreshold && currentScore < nextThreshold && currentScore + directScoreGain >= nextThreshold
        ? (nextThreshold >= 70 ? 9 : 7)
        : 0;
      const score = bestPlay.continuationValue * 0.66
        + thresholdBonus
        + (finalMarks >= 3 ? Math.min(4, concreteFinalValue * 0.15) : 0)
        - discardCost * 0.35;
      if (score < 6.5) return null;
      return {
        id: "quickTrade",
        kind: "quick",
        available: true,
        tradeId: trade.id,
        label: trade.label || trade.id,
        reason: "主行动前：交易信用点解锁高价值打牌",
        score: roundAiScore(Math.min(42, score)),
        valueBreakdown: {
          mainUnlockTrade: true,
          bestPlayCard: {
            handIndex: bestPlay.handIndex,
            cardId: bestPlay.cardId || null,
            cardLabel: bestPlay.cardLabel || null,
            score: roundAiScore(bestPlay.score),
            continuationValue: roundAiScore(bestPlay.continuationValue),
            directScoreGain,
            finalDeltaValue: roundAiScore(bestPlay.finalDeltaValue),
            c2Type3ProgressValue,
            cFinalTaskProgressValue,
            endGameExpectedScore,
          },
          currentBestPlayScore: roundAiScore(currentBestScore),
          newlyUnlocked,
          discardCost: roundAiScore(discardCost),
          finalMarkCount: finalMarks,
          nextFinalMarkThreshold: nextThreshold || null,
          thresholdBonus,
          concreteFinalValue: roundAiScore(concreteFinalValue),
          measurableFinalValue: roundAiScore(measurableFinalValue),
          finalLowTailOneCreditUnlock,
          huanyuWithoutCompletedTasks,
          finalHighScoreOneCreditUnlock,
          highScoreProjectedScore: roundAiScore(highScorePushProfile.projectedScore),
        },
      };
    }

    function listAiMainUnlockTradeCandidates(workingRoot, player = getCurrentPlayer(), playCardCandidates = null, candidates = []) {
      const { turnState } = requireWorkingRoot(workingRoot);
      if (
        !player
        || !quickTrades?.getTradeAction
        || typeof runQuickTrade !== "function"
        || getAiRoundNumber() < 2
        || state.pendingActionExecuted
        || !canStartMainAction()
        || (turnState.passedPlayerIds || []).includes(player.id)
      ) {
        return [];
      }
      return ["cards-for-credit", "energy-for-credit"]
        .map((tradeId) => buildAiMainUnlockTradeCandidate(workingRoot, player, tradeId, playCardCandidates, candidates))
        .filter(Boolean)
        .sort((left, right) => aiNumber(right.score) - aiNumber(left.score));
    }

    function buildAiResourceLockMainUnlockTradeCandidate(workingRoot, player = getCurrentPlayer(), tradeId = null, candidates = []) {
      const { rocketState, turnState } = requireWorkingRoot(workingRoot);
      if (
        !player
        || !tradeId
        || !quickTrades?.getTradeAction
        || typeof runQuickTrade !== "function"
        || getAiRoundNumber() < 2
        || state.pendingActionExecuted
        || !canStartMainAction()
        || (turnState.passedPlayerIds || []).includes(player.id)
      ) {
        return null;
      }
      const resources = player.resources || {};
      const currentScore = Math.max(0, aiNumber(resources.score));
      if (currentScore < 35) return null;
      const handSize = Math.max(0, Math.round(aiNumber(resources.handSize ?? (player.hand || []).length)));
      const allowExtendedResourceLock = player.aiDifficulty !== AI_DIFFICULTY_WEAK_START;
      const playCardCandidate = (candidates || []).find((candidate) => candidate?.id === "playCard");
      if (!playCardCandidate || playCardCandidate.available !== false) return null;
      if (!String(playCardCandidate.reason || "").includes("没有资源可支付")) return null;

      const bestExistingScore = (candidates || [])
        .filter((candidate) => (
          candidate?.available !== false
          && candidate.id !== "pass"
          && candidate.id !== "end-turn"
          && candidate.id !== "quickTrade"
        ))
        .reduce((best, candidate) => Math.max(best, aiNumber(candidate.score)), -Infinity);
      if (bestExistingScore >= 12) return null;

      const trade = quickTrades.getTradeAction(tradeId);
      const check = trade ? (quickTrades.canExecuteTrade?.(tradeId, createActionContext()) || { ok: false }) : { ok: false };
      if (!trade || !check.ok) return null;
      const handCost = Math.max(0, Math.round(aiNumber(trade.cost?.handSize)));
      const handGain = Math.max(0, Math.round(aiNumber(trade.gain?.handSize)));
      const handAfterTrade = handSize - handCost + handGain;
      if (handAfterTrade < 0) return null;
      if (handCost > 0 && handCost < 2) return null;
      if (handCost > 0 && handSize <= 0) return null;
      if (handCost <= 0 && aiNumber(trade.gain?.energy) <= 0 && aiNumber(trade.gain?.credits) <= 0) return null;
      const simulatedPlayer = createAiPlayerAfterQuickTrade(player, trade);
      if (!simulatedPlayer) return null;

      const currentAnalyzeCheck = canAiAnalyzeData(player);
      const analyzeCheck = canAiAnalyzeData(simulatedPlayer);
      const currentAnalyzeScore = currentAnalyzeCheck?.ok ? scoreAiAnalyzeAction(player) : 0;
      const analyzeScore = analyzeCheck?.ok ? scoreAiAnalyzeAction(simulatedPlayer) : 0;
      const activeRocketCount = rocketActions.getRocketsForPlayer
        ? rocketActions.getRocketsForPlayer(rocketState, player.id).length
        : 0;
      const rocketLimit = abilities.rocket?.getRocketLimitForPlayer
        ? abilities.rocket.getRocketLimitForPlayer(player, createActionContext())
        : activeRocketCount;
      const canLaunchAfterTrade = activeRocketCount < rocketLimit
        && players.canAfford(simulatedPlayer, getAiLaunchPaymentCost());
      const postTradeLaunchPlan = canLaunchAfterTrade ? scoreAiPostLaunchMovePlan(simulatedPlayer) : null;
      const launchValue = canLaunchAfterTrade
        ? scoreAiLaunchTurnCandidateValue(simulatedPlayer, postTradeLaunchPlan)
        : null;
      const launchScore = aiNumber(launchValue?.score);
      const currentScanCheck = scanEffects?.canExecuteScan?.(player, { standardAction: true }) || { ok: false };
      const scanCheck = scanEffects?.canExecuteScan?.(simulatedPlayer, { standardAction: true }) || { ok: false };
      const currentScanScore = currentScanCheck.ok ? scoreAiScanAction(workingRoot, player) : 0;
      const scanScore = scanCheck.ok ? scoreAiScanAction(workingRoot, simulatedPlayer) : 0;
      const scanDirectScoreGain = scanCheck.ok ? Math.max(0, aiNumber(getAiScanDirectScoreGain(workingRoot, simulatedPlayer))) : 0;
      const weakNoDiscardDirectScanUnlock = !allowExtendedResourceLock
        && handCost <= 0
        && scanDirectScoreGain > 0
        && scanScore >= (getAiRoundNumber() >= FINAL_ROUND_NUMBER ? 20 : 22);
      const earlyLowScoreScanUnlock = allowExtendedResourceLock
        && getAiRoundNumber() <= 2
        && currentScore < 70
        && handAfterTrade >= 2
        && scanScore >= 15;
      const directScoreScanUnlock = (allowExtendedResourceLock || weakNoDiscardDirectScanUnlock)
        && scanDirectScoreGain > 0
        && scanScore >= (getAiRoundNumber() >= FINAL_ROUND_NUMBER ? 20 : 22);
      const currentPlayScore = aiNumber(playCardCandidate.score);
      const postTradePlayCandidates = handAfterTrade > 0
        ? (player.hand || [])
          .map((card, handIndex) => buildAiPlayCardCandidate(workingRoot, card, handIndex, simulatedPlayer))
          .filter(Boolean)
          .map((candidate) => {
            const breakdown = candidate.valueBreakdown || {};
            const finalDeltaValue = Math.max(
              0,
              scoreAiFinalFormulaDeltaValue(candidate.finalFormulaDeltas || {}, player, {
                includePotential: true,
                potentialScale: 0.35,
              }),
            );
            const concreteValue = Math.max(
              0,
              aiNumber(candidate.directScoreGain),
              finalDeltaValue,
              aiNumber(breakdown.c2Type3ProgressValue),
              aiNumber(breakdown.cFinalTaskProgressValue),
              aiNumber(breakdown.endGameExpectedScore),
              aiNumber(breakdown.playCardConversionPressure),
              aiNumber(breakdown.planScore),
            );
            return {
              ...candidate,
              finalDeltaValue,
              concreteValue,
            };
          })
          .sort((left, right) => (
            aiNumber(right.score) - aiNumber(left.score)
            || aiNumber(right.concreteValue) - aiNumber(left.concreteValue)
          ))
        : [];
      const bestPlay = postTradePlayCandidates[0] || null;
      const bestPlayDiscardCost = bestPlay
        ? estimateAiTradeDiscardOpportunityCost(workingRoot, player, trade, bestPlay.handIndex)
        : Infinity;
      const weakStartAlienPlayConcreteValue = bestPlay
        ? Math.max(
          0,
          aiNumber(bestPlay.concreteValue),
          aiNumber(bestPlay.valueBreakdown?.banrenmaThresholdSetupValue),
          aiNumber(bestPlay.valueBreakdown?.chongTaskChainValue),
          aiNumber(bestPlay.valueBreakdown?.effectValue),
          aiNumber(bestPlay.valueBreakdown?.strategyPassivePlayValue),
          aiNumber(bestPlay.valueBreakdown?.playCardConversionPressure),
        )
        : 0;
      const weakStartNoDiscardAlienPlayUnlock = !allowExtendedResourceLock
        && tradeId === "credits-for-energy"
        && handCost <= 0
        && aiNumber(trade.gain?.energy) > 0
        && getAiRoundNumber() === 3
        && countAiFinalMarksForPlayer(player) >= 3
        && currentScore >= 90
        && currentScore <= 125
        && handAfterTrade >= 2
        && Boolean(bestPlay)
        && bestPlay.alienCard
        && aiNumber(bestPlay.score) >= 32
        && weakStartAlienPlayConcreteValue >= 10;
      const playUnlockSafe = allowExtendedResourceLock
        && Boolean(bestPlay)
        && Number.isFinite(bestPlayDiscardCost)
        && aiNumber(bestPlay.score) > Math.max(16, currentPlayScore + 2)
        && aiNumber(bestPlay.concreteValue) >= 8
        && (
          (handAfterTrade >= 2 && aiNumber(bestPlay.score) >= 24)
          || aiNumber(bestPlay.directScoreGain) >= 6
          || aiNumber(bestPlay.concreteValue) >= 12
        );
      const weakStartAlienPlayUnlockSafe = weakStartNoDiscardAlienPlayUnlock
        && Number.isFinite(bestPlayDiscardCost)
        && aiNumber(bestPlay.score) > Math.max(24, currentPlayScore + 8);
      const bestPlayConcreteValue = weakStartAlienPlayUnlockSafe
        ? Math.max(aiNumber(bestPlay.concreteValue), weakStartAlienPlayConcreteValue)
        : aiNumber(bestPlay?.concreteValue);
      const postTradeMainActions = [
        analyzeCheck?.ok && analyzeScore > currentAnalyzeScore + 1
          ? {
            actionId: "analyze",
            score: analyzeScore,
            currentScore: currentAnalyzeScore,
            directScoreGain: 0,
            concreteValue: Math.max(0, aiNumber(analyzeScore)),
          }
          : null,
        scanCheck.ok
          && scanScore > currentScanScore + 1
          && (earlyLowScoreScanUnlock || directScoreScanUnlock)
          ? {
            actionId: "scan",
            score: scanScore,
            currentScore: currentScanScore,
            directScoreGain: scanDirectScoreGain,
            concreteValue: scanDirectScoreGain + Math.max(0, scoreAiScanPriorityFloor(player)) * 0.35,
          }
          : null,
        (playUnlockSafe || weakStartAlienPlayUnlockSafe)
          ? {
            actionId: "playCard",
            score: aiNumber(bestPlay.score),
            currentScore: currentPlayScore,
            directScoreGain: Math.max(0, aiNumber(bestPlay.directScoreGain)),
            concreteValue: bestPlayConcreteValue,
            handIndex: bestPlay.handIndex,
            cardId: bestPlay.cardId || null,
            cardLabel: bestPlay.cardLabel || null,
            discardCost: bestPlayDiscardCost,
          }
          : null,
      ].filter(Boolean).sort((left, right) => aiNumber(right.score) - aiNumber(left.score));
      if (
        tradeId === "cards-for-credit"
        && canLaunchAfterTrade
        && getAiRoundNumber() <= 2
        && currentScore >= 45
        && currentScore < 70
        && handAfterTrade <= 0
        && launchScore >= 18
      ) {
        postTradeMainActions.push({
          actionId: "launch",
          score: launchScore,
          currentScore: 0,
          directScoreGain: 0,
          concreteValue: Math.max(0, aiNumber(postTradeLaunchPlan?.score), launchScore * 0.35),
          planScore: Math.max(0, aiNumber(postTradeLaunchPlan?.score)),
        });
        postTradeMainActions.sort((left, right) => aiNumber(right.score) - aiNumber(left.score));
      }
      const bestAction = postTradeMainActions[0] || null;
      if (!bestAction) return null;
      const weakStartFinalDeadHandAnalyzeUnlock = !allowExtendedResourceLock
        && tradeId === "cards-for-energy"
        && bestAction.actionId === "analyze"
        && getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && countAiFinalMarksForPlayer(player) >= 3
        && currentScore >= 110
        && currentScore <= 170
        && handCost >= 2
        && handAfterTrade <= 0
        && aiNumber(bestAction.score) >= 8;
      const weakStartFinalStrandedAnalyzeUnlock = !allowExtendedResourceLock
        && tradeId === "cards-for-energy"
        && bestAction.actionId === "analyze"
        && getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && countAiFinalMarksForPlayer(player) >= 3
        && !getAiNextMissingFinalScoreThreshold(player)
        && currentScore >= 95
        && currentScore < 110
        && aiNumber(resources.credits) <= 1
        && aiNumber(resources.publicity) <= 2
        && handCost >= 2
        && handSize === handCost + 1
        && handAfterTrade === 1
        && aiNumber(bestAction.score) >= 7;
      const weakStartFinalAnalyzeRecoveryUnlock = weakStartFinalDeadHandAnalyzeUnlock
        || weakStartFinalStrandedAnalyzeUnlock;
      const minPostTradeScore = bestAction.actionId === "scan"
        ? (
          getAiRoundNumber() <= 2 && currentScore < 70 && handAfterTrade >= 2
            ? 15
            : getAiRoundNumber() >= FINAL_ROUND_NUMBER
              ? 20
              : 22
        )
        : bestAction.actionId === "playCard"
          ? 17
          : bestAction.actionId === "launch"
            ? 18
            : weakStartFinalAnalyzeRecoveryUnlock
              ? (weakStartFinalStrandedAnalyzeUnlock ? 7 : 8)
              : getAiRoundNumber() >= FINAL_ROUND_NUMBER ? 16 : 18;
      if (aiNumber(bestAction.score) < minPostTradeScore) return null;
      const launchUnlockSafe = bestAction.actionId === "launch"
        && tradeId === "cards-for-credit"
        && getAiRoundNumber() <= 2
        && currentScore >= 45
        && currentScore < 70
        && handCost >= 2
        && aiNumber(bestAction.score) >= 18;
      if (
        handAfterTrade <= 0
        && aiNumber(bestAction.score) < 35
        && !launchUnlockSafe
        && !weakStartFinalAnalyzeRecoveryUnlock
      ) return null;

      const discardCost = bestAction.actionId === "playCard" && Number.isFinite(bestAction.discardCost)
        ? bestAction.discardCost
        : estimateAiTradeDiscardOpportunityCost(workingRoot, player, trade);
      if (!Number.isFinite(discardCost)) return null;
      if (weakStartFinalAnalyzeRecoveryUnlock && discardCost > 6.5) return null;
      const nextThreshold = getAiNextMissingFinalScoreThreshold(player);
      if (
        handCost <= 0
        && !weakNoDiscardDirectScanUnlock
        && !weakStartAlienPlayUnlockSafe
        && (
          getAiRoundNumber() !== 2
          || nextThreshold
          || currentScore < 70
          || handAfterTrade < 2
          || aiNumber(bestAction.score) < 28
        )
      ) {
        return null;
      }
      const thresholdBonus = nextThreshold
        && currentScore < nextThreshold
        && currentScore + bestAction.directScoreGain >= nextThreshold
          ? (nextThreshold >= 70 ? 7 : 5)
          : 0;
      const analyzeBonus = bestAction.actionId === "analyze" ? 2.5 : 0;
      const scanBonus = bestAction.actionId === "scan"
        ? Math.min(5.5, 1.4 + Math.max(0, bestAction.score - minPostTradeScore) * 0.15 + bestAction.directScoreGain * 0.45)
        : 0;
      const playBonus = bestAction.actionId === "playCard"
        ? Math.min(5, 1.2 + Math.max(0, bestAction.concreteValue) * 0.18)
        : 0;
      const launchBonus = bestAction.actionId === "launch"
        ? Math.min(4, 1.1 + Math.max(0, bestAction.planScore) * 0.16)
        : 0;
      const handBufferBonus = handAfterTrade >= 1 ? 1.5 : 0;
      const score = bestAction.score * (weakStartFinalAnalyzeRecoveryUnlock ? 0.74 : 0.52)
        + bestAction.directScoreGain * 0.7
        + thresholdBonus
        + analyzeBonus
        + scanBonus
        + playBonus
        + launchBonus
        + handBufferBonus
        - discardCost * 0.34;
      if (score < (weakStartFinalAnalyzeRecoveryUnlock ? 6 : 7)) return null;
      const reason = bestAction.actionId === "analyze"
        ? (handCost > 0 ? "资源锁：弃牌换能量解锁分析" : "资源锁：信用点换能量解锁分析")
        : `资源锁：交易解锁${bestAction.actionId === "scan" ? "扫描" : bestAction.actionId === "launch" ? "发射" : "打牌"}`;
      return {
        id: "quickTrade",
        kind: "quick",
        available: true,
        tradeId: trade.id,
        label: trade.label || trade.id,
        preserveHandIndex: bestAction.actionId === "playCard" ? bestAction.handIndex : null,
        reason,
        score: roundAiScore(Math.min(42, score)),
        valueBreakdown: {
          resourceLockMainUnlockTrade: true,
          unlockedMainAction: {
            actionId: bestAction.actionId,
            score: roundAiScore(bestAction.score),
            currentScore: roundAiScore(bestAction.currentScore),
            directScoreGain: bestAction.directScoreGain,
            concreteValue: roundAiScore(bestAction.concreteValue),
            cardId: bestAction.cardId || null,
            cardLabel: bestAction.cardLabel || null,
            handIndex: Number.isInteger(Number(bestAction.handIndex)) ? Number(bestAction.handIndex) : null,
          },
          currentScore,
          handSize,
          handAfterTrade,
          discardCost: roundAiScore(discardCost),
          nextFinalMarkThreshold: nextThreshold || null,
          thresholdBonus,
          analyzeBonus,
          scanBonus: roundAiScore(scanBonus),
          playBonus: roundAiScore(playBonus),
          launchBonus: roundAiScore(launchBonus),
          earlyLowScoreScanUnlock,
          directScoreScanUnlock,
          weakStartFinalDeadHandAnalyzeUnlock,
          weakStartFinalStrandedAnalyzeUnlock,
          weakStartAlienPlayUnlock: weakStartAlienPlayUnlockSafe,
          weakStartAlienPlayConcreteValue: roundAiScore(weakStartAlienPlayConcreteValue),
          bestExistingScore: Number.isFinite(bestExistingScore) ? roundAiScore(bestExistingScore) : null,
        },
      };
    }

    function listAiResourceLockMainUnlockTradeCandidates(workingRoot, player = getCurrentPlayer(), candidates = []) {
      return ["credits-for-energy", "cards-for-energy", "cards-for-credit", "energy-for-credit"]
        .map((tradeId) => buildAiResourceLockMainUnlockTradeCandidate(workingRoot, player, tradeId, candidates))
        .filter(Boolean)
        .sort((left, right) => aiNumber(right.score) - aiNumber(left.score));
    }

    function listAiLateResourceRecoveryTradeCandidates(workingRoot, player = getCurrentPlayer(), candidates = []) {
      if (!workingRoot?.playerState || !workingRoot?.turnState || !workingRoot?.cardState) {
        throw new TypeError("AI late resource recovery requires explicit workingRoot");
      }
      const {
        alienGameState: activeAlienGameState,
        cardState: activeCardState,
        finalScoringState: activeFinalScoringState,
        playerState: activePlayerState,
        turnState: activeTurnState,
      } = workingRoot;
      if (
        !player
        || !quickTrades?.getTradeAction
        || typeof runQuickTrade !== "function"
        || getAiRoundNumber() < 3
      ) {
        return [];
      }
      const resources = player.resources || {};
      const currentScore = Math.max(0, aiNumber(resources.score));
      const finalMarks = countAiFinalMarksForPlayer(player);
      const paceDeficit = getAiLiveScorePaceDeficit(player);
      const nextThreshold = getAiNextMissingFinalScoreThreshold(player);
      const recoveryThreshold = nextThreshold || 0;
      const canReachAnalyze = canAiReachAnalyzeReadyWithDataPool(player) || hasAiAnalyzeReadyDataSlot(player);
      const credits = Math.max(0, aiNumber(resources.credits));
      const energy = Math.max(0, aiNumber(resources.energy));
      const handSize = Math.max(0, aiNumber(resources.handSize));
      const publicity = Math.max(0, aiNumber(resources.publicity));
      const reservedPlanetCashoutEnergy = state.pendingActionExecuted
        ? getAiReservedPlanetCashoutEnergy(player)
        : null;
      const shouldReservePlanetCashoutEnergy = Boolean(reservedPlanetCashoutEnergy);
      const mainActionOpen = canStartMainAction();
      const moveActionOpen = canAiMoveThisTurn(workingRoot, player.id);
      const canSpendEnergyThisTurn = mainActionOpen || moveActionOpen;
      const finalMarkTargetCount = recoveryThreshold >= 70 ? 3 : 2;
      const canPrepareFinalThresholdAction = getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && Boolean(recoveryThreshold)
        && finalMarks < finalMarkTargetCount
        && !(activeTurnState.passedPlayerIds || []).includes(player.id);
      const canSpendEnergyForRecovery = canSpendEnergyThisTurn || canPrepareFinalThresholdAction;
      const launchMoveRecoveryByTrade = {
        "credits-for-energy": scoreAiEnergyTradeLaunchMoveRecovery(workingRoot, player, "credits-for-energy"),
        "cards-for-energy": scoreAiEnergyTradeLaunchMoveRecovery(workingRoot, player, "cards-for-energy"),
      };
      const bestLaunchMoveRecoveryScore = Math.max(
        0,
        aiNumber(launchMoveRecoveryByTrade["credits-for-energy"]?.score),
        aiNumber(launchMoveRecoveryByTrade["cards-for-energy"]?.score),
      );
      const planetCashoutRecoveryByTrade = {
        "credits-for-energy": scoreAiEnergyTradePlanetCashoutRecovery(player, "credits-for-energy"),
        "cards-for-energy": scoreAiEnergyTradePlanetCashoutRecovery(player, "cards-for-energy"),
      };
      const bestPlanetCashoutRecoveryScore = Math.max(
        0,
        aiNumber(planetCashoutRecoveryByTrade["credits-for-energy"]?.score),
        aiNumber(planetCashoutRecoveryByTrade["cards-for-energy"]?.score),
      );
      const scanCost = scanEffects?.getStandardScanCost?.(player) || scanEffects?.SCAN_COST || { credits: 1, energy: 2 };
      const scanCreditCost = Math.max(0, aiNumber(scanCost.credits));
      const scanEnergyCost = Math.max(0, aiNumber(scanCost.energy));
      const analyzeEnergyCost = getAiAnalyzeEnergyCost(player);
      const b2SectorBottleneck = getAiB2SectorBottleneck(player, { requireMarked: true });
      const b2SectorScanRecoveryValue = scoreAiB2SectorScanRecoveryValue(player, {
        requireMarked: true,
        trade: true,
      });
      const highScorePushProfile = getAiHighScorePushProfile(player);
      const bestImmediateMainCashout = (candidates || [])
        .filter((candidate) => (
          candidate?.kind === "main"
          && candidate.available !== false
          && candidate.id !== "launch"
          && candidate.id !== "playCard"
        ))
        .sort((left, right) => (
          Math.max(0, aiNumber(right.directScoreGain)) - Math.max(0, aiNumber(left.directScoreGain))
          || aiNumber(right.score) - aiNumber(left.score)
        ))[0] || null;
      const bestImmediateMainCashoutDirectScore = Math.max(0, aiNumber(bestImmediateMainCashout?.directScoreGain));
      const bestImmediateMainCashoutScore = Math.max(0, aiNumber(bestImmediateMainCashout?.score));
      const highScoreProjectedAfterImmediateMain = highScorePushProfile.projectedScore
        + bestImmediateMainCashoutDirectScore;
      const hasImmediateRouteRecovery = bestLaunchMoveRecoveryScore > 0 || bestPlanetCashoutRecoveryScore > 0;
      const finalLowHandScoreCeiling = 165;
      const finalLowScoreScanUnlockCeiling = 150;
      const finalLowHandPressure = Math.max(0, finalLowHandScoreCeiling - currentScore);
      const finalLowHandRefillWindow = getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && mainActionOpen
        && currentScore < finalLowHandScoreCeiling
        && handSize <= 1
        && (credits >= 2 || energy >= 2 || publicity >= 3);
      const finalLowStaleHandRefillBaseWindow = getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && mainActionOpen
        && finalMarks >= 3
        && !recoveryThreshold
        && currentScore >= 120
        && currentScore < 170
        && handSize >= 2
        && handSize <= 4
        && publicity >= 3
        && credits <= 1
        && energy <= 1
        && !(activeTurnState.passedPlayerIds || []).includes(player.id);
      const finalLowStaleHandPlayableScore = finalLowStaleHandRefillBaseWindow
        ? (player.hand || []).reduce((best, card, handIndex) => {
          const candidate = buildAiPlayCardCandidate(workingRoot, card, handIndex, player);
          return Math.max(best, aiNumber(candidate?.score));
        }, 0)
        : 0;
      const finalHighScoreRefillBaseWindow = getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && mainActionOpen
        && finalMarks >= 3
        && !recoveryThreshold
        && highScorePushProfile.active
        && highScorePushProfile.projectedScore >= 260
        && highScorePushProfile.projectedScore < 340
        && (credits >= 2 || energy >= 2 || publicity >= 3 || handSize >= 2)
        && !(activeTurnState.passedPlayerIds || []).includes(player.id);
      const highScorePlayableHandScore = finalHighScoreRefillBaseWindow && handSize <= 4
        ? (player.hand || []).reduce((best, card, handIndex) => {
          const candidate = buildAiPlayCardCandidate(workingRoot, card, handIndex, player);
          return Math.max(best, aiNumber(candidate?.score));
        }, 0)
        : 0;
      const finalHighScoreNeedsCardRefill = finalHighScoreRefillBaseWindow && (
        handSize <= 1
        || (handSize <= 2 && highScorePlayableHandScore < 8)
      );
      const finalHighScoreHandRefillWindow = finalHighScoreNeedsCardRefill;
      const finalHighScoreDeadHandRefillBaseWindow = finalHighScoreRefillBaseWindow
        && handSize >= 3
        && handSize <= 4
        && highScorePlayableHandScore < 8;
      const finalPreMainCashoutHandRefillWindow = getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && mainActionOpen
        && !state.pendingActionExecuted
        && finalMarks >= 3
        && !recoveryThreshold
        && handSize <= 0
        && publicity >= 3
        && highScorePushProfile.projectedScore >= 230
        && highScoreProjectedAfterImmediateMain >= 260
        && highScoreProjectedAfterImmediateMain < 330
        && bestImmediateMainCashoutDirectScore >= 8
        && bestImmediateMainCashoutScore >= 35
        && !(activeTurnState.passedPlayerIds || []).includes(player.id);
      const finalLowScoreMainUnlockWindow = getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && mainActionOpen
        && (!recoveryThreshold || finalMarks >= 3)
        && currentScore >= 70
        && currentScore < finalLowScoreScanUnlockCeiling
        && credits < scanCreditCost
        && !(activeTurnState.passedPlayerIds || []).includes(player.id);
      const scoreFinalLowScoreScanUnlockTrade = (tradeId) => {
        if (!finalLowScoreMainUnlockWindow) return 0;
        const trade = quickTrades.getTradeAction(tradeId);
        if (!trade) return 0;
        const simulatedPlayer = createAiPlayerAfterQuickTrade(player, trade);
        if (!simulatedPlayer) return 0;
        const simulatedCredits = Math.max(0, aiNumber(simulatedPlayer.resources?.credits));
        const simulatedEnergy = Math.max(0, aiNumber(simulatedPlayer.resources?.energy));
        if (simulatedCredits < scanCreditCost || simulatedEnergy < scanEnergyCost) return 0;
        const canScanAfterTrade = scanEffects?.canExecuteScan?.(simulatedPlayer, { standardAction: true })?.ok;
        const tradeCost = estimateAiTradeDiscardOpportunityCost(workingRoot, player, trade);
        if (!Number.isFinite(tradeCost)) return 0;
        const effectiveTradeCost = finalLowScoreMainUnlockWindow && handSize >= 5
          ? Math.min(tradeCost, 18)
          : tradeCost;
        const scanScore = canScanAfterTrade ? Math.max(0, aiNumber(scoreAiScanAction(workingRoot, simulatedPlayer))) : 0;
        const directScoreGain = canScanAfterTrade ? Math.max(0, aiNumber(getAiScanDirectScoreGain(workingRoot, simulatedPlayer))) : 0;
        const lowScorePressure = Math.max(0, finalLowScoreScanUnlockCeiling - currentScore) * 0.045;
        const handBuffer = Math.max(0, handSize - Math.max(0, aiNumber(trade.cost?.handSize))) >= 3 ? 1.5 : 0;
        const scanUnlockBaseValue = canScanAfterTrade
          ? 7
          : state.pendingActionExecuted
            ? 8.5
            : 0;
        const preparedScanValue = scanUnlockBaseValue > 0
          ? scanUnlockBaseValue + lowScorePressure + handBuffer
          : 0;
        return Math.max(
          0,
          scanScore * 0.68
            + directScoreGain * 0.8
            + lowScorePressure
            + handBuffer
            + preparedScanValue
            - effectiveTradeCost * 0.18,
        );
      };
      const finalLowScoreScanUnlockByTrade = {
        "cards-for-credit": scoreFinalLowScoreScanUnlockTrade("cards-for-credit"),
        "energy-for-credit": scoreFinalLowScoreScanUnlockTrade("energy-for-credit"),
      };
      const finalLowScoreCardsForCreditScanPrepare = finalLowScoreMainUnlockWindow
        && handSize >= 4
        && scanCreditCost > 0
        && scanCreditCost - credits === 1
        && energy >= scanEnergyCost;
      const finalLowScoreCardsForCreditScanUnlock = finalLowScoreScanUnlockByTrade["cards-for-credit"] >= 3.5
        || finalLowScoreCardsForCreditScanPrepare;
      const finalLowScoreEnergyForCreditScanUnlock = finalLowScoreScanUnlockByTrade["energy-for-credit"] >= 3.5;
      const finalLowScoreScanUnlock = finalLowScoreCardsForCreditScanUnlock || finalLowScoreEnergyForCreditScanUnlock;
      const b2SectorScanUnlockWindow = getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && mainActionOpen
        && b2SectorBottleneck.active
        && b2SectorScanRecoveryValue > 0
        && !(activeTurnState.passedPlayerIds || []).includes(player.id);
      const scoreB2SectorScanUnlockTrade = (tradeId) => {
        if (!b2SectorScanUnlockWindow) return 0;
        const trade = quickTrades.getTradeAction(tradeId);
        if (!trade) return 0;
        const simulatedPlayer = createAiPlayerAfterQuickTrade(player, trade);
        if (!simulatedPlayer) return 0;
        const simulatedCredits = Math.max(0, aiNumber(simulatedPlayer.resources?.credits));
        const simulatedEnergy = Math.max(0, aiNumber(simulatedPlayer.resources?.energy));
        if (simulatedCredits < scanCreditCost || simulatedEnergy < scanEnergyCost) return 0;
        if (!scanEffects?.canExecuteScan?.(simulatedPlayer, { standardAction: true })?.ok) return 0;
        const tradeCost = estimateAiTradeDiscardOpportunityCost(workingRoot, player, trade);
        if (!Number.isFinite(tradeCost)) return 0;
        const scanScore = Math.max(0, aiNumber(scoreAiScanAction(workingRoot, simulatedPlayer)));
        const sectorDeficit = Math.max(1, aiNumber(b2SectorBottleneck.deficit));
        return Math.max(
          0,
          b2SectorScanRecoveryValue
            + Math.min(16, scanScore * 0.48)
            + Math.min(7, sectorDeficit * 1.8)
            - tradeCost * 0.2,
        );
      };
      const b2SectorScanUnlockByTrade = {
        "credits-for-energy": scoreB2SectorScanUnlockTrade("credits-for-energy"),
        "cards-for-energy": scoreB2SectorScanUnlockTrade("cards-for-energy"),
        "cards-for-credit": scoreB2SectorScanUnlockTrade("cards-for-credit"),
        "energy-for-credit": scoreB2SectorScanUnlockTrade("energy-for-credit"),
      };
      const b2SectorScanUnlock = Object.values(b2SectorScanUnlockByTrade)
        .some((score) => aiNumber(score) >= 5);
      const availableDataForAnalyzeUnlock = Math.max(0, Math.round(aiNumber(resources.availableData)));
      const hasMarkedD1Final = getAiMarkedFinalFormulaEntries(player)
        .some((entry) => entry.formulaId === "d1");
      const midgameAnalyzeUnlockWindow = getAiRoundNumber() === 3
        && mainActionOpen
        && !state.pendingActionExecuted
        && !recoveryThreshold
        && finalMarks >= 3
        && hasMarkedD1Final
        && currentScore >= 80
        && availableDataForAnalyzeUnlock >= (data.ANALYZE_REQUIRED_COMPUTER_SLOT || 6)
        && analyzeEnergyCost > 0
        && energy < analyzeEnergyCost
        && hasAiAnalyzeReadyDataSlot(player)
        && !(activeTurnState.passedPlayerIds || []).includes(player.id);
      const scoreMidgameAnalyzeUnlockTrade = (tradeId) => {
        if (!midgameAnalyzeUnlockWindow) return 0;
        const trade = quickTrades.getTradeAction(tradeId);
        if (!trade || aiNumber(trade.gain?.energy) <= 0) return 0;
        const simulatedPlayer = createAiPlayerAfterQuickTrade(player, trade);
        if (!simulatedPlayer || !canAiAnalyzeData(simulatedPlayer).ok) return 0;
        const tradeCost = estimateAiTradeDiscardOpportunityCost(workingRoot, player, trade);
        if (!Number.isFinite(tradeCost)) return 0;
        const analyzeScore = Math.max(0, aiNumber(scoreAiAnalyzeAction(simulatedPlayer)));
        if (analyzeScore < 14) return 0;
        const handAfterTrade = Math.max(0, handSize - Math.max(0, aiNumber(trade.cost?.handSize)));
        const handBuffer = handAfterTrade >= 2 ? 1.5 : handAfterTrade >= 1 ? 0.5 : -2.5;
        return Math.max(
          0,
          analyzeScore * 0.82
            + Math.min(5, getAiLiveScorePaceDeficit(player) * 0.07)
            + handBuffer
            - tradeCost * 0.24,
        );
      };
      const midgameAnalyzeUnlockByTrade = {
        "credits-for-energy": scoreMidgameAnalyzeUnlockTrade("credits-for-energy"),
        "cards-for-energy": scoreMidgameAnalyzeUnlockTrade("cards-for-energy"),
      };
      const midgameAnalyzeUnlock = Object.values(midgameAnalyzeUnlockByTrade)
        .some((score) => aiNumber(score) >= 7.5);
      const weakStartPostMainPublicRefillBaseWindow = normalizeAiDifficulty(
        player?.aiDifficulty || aiAutoBattleState.aiDifficulty,
      ) === AI_DIFFICULTY_WEAK_START
        && getAiRoundNumber() >= 3
        && state.pendingActionExecuted
        && !mainActionOpen
        && finalMarks >= 3
        && !recoveryThreshold
        && currentScore >= 65
        && currentScore < 130
        && handSize <= 0
        && (credits >= 6 || publicity >= 6)
        && !(activeTurnState.passedPlayerIds || []).includes(player.id);
      if (
        !recoveryThreshold
        && !hasImmediateRouteRecovery
        && !finalLowHandRefillWindow
        && !finalLowStaleHandRefillBaseWindow
        && !finalHighScoreHandRefillWindow
        && !finalHighScoreDeadHandRefillBaseWindow
        && !finalPreMainCashoutHandRefillWindow
        && !finalLowScoreScanUnlock
        && !b2SectorScanUnlock
        && !midgameAnalyzeUnlock
        && !weakStartPostMainPublicRefillBaseWindow
      ) return [];
      const scoreToNextThreshold = recoveryThreshold ? Math.max(1, recoveryThreshold - currentScore) : 0;
      const closeThirdMarkScanSetup = getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && nextThreshold === 70
        && finalMarks === 2
        && currentScore >= 64;
      if (
        paceDeficit <= 8
        && finalMarks >= 2
        && !closeThirdMarkScanSetup
        && !hasImmediateRouteRecovery
        && !finalLowHandRefillWindow
        && !finalLowStaleHandRefillBaseWindow
        && !finalHighScoreHandRefillWindow
        && !finalHighScoreDeadHandRefillBaseWindow
        && !finalPreMainCashoutHandRefillWindow
        && !finalLowScoreScanUnlock
        && !midgameAnalyzeUnlock
        && !weakStartPostMainPublicRefillBaseWindow
      ) return [];
      const closeScanCashoutWindow = recoveryThreshold <= 50 ? 10 : 8;
      const closeScanDirectScoreGain = getAiRoundNumber() >= FINAL_ROUND_NUMBER
        ? Math.max(0, aiNumber(getAiScanDirectScoreGain(workingRoot, player)))
        : 0;
      const closeScanCashout = Boolean(recoveryThreshold)
        && getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && mainActionOpen
        && scoreToNextThreshold <= closeScanCashoutWindow
        && finalMarks < (recoveryThreshold >= 70 ? 3 : 2)
        && scanEnergyCost > 0
        && scanCreditCost > 0
        && closeScanDirectScoreGain >= scoreToNextThreshold;
      const scanEnergyShortfall = Math.max(0, scanEnergyCost - energy);
      const scanCreditShortfall = Math.max(0, scanCreditCost - credits);
      const canScanAfterCardsForEnergy = closeScanCashout
        && scanEnergyShortfall === 1
        && scanCreditShortfall <= 0
        && handSize >= 2;
      const canScanAfterCreditsForEnergy = closeScanCashout
        && scanEnergyShortfall === 1
        && credits >= scanCreditCost + 2;
      const canScanAfterCardsForCredit = closeScanCashout
        && scanCreditShortfall === 1
        && energy >= scanEnergyCost
        && handSize >= 2;
      const canScanAfterEnergyForCredit = closeScanCashout
        && scanCreditShortfall === 1
        && energy >= scanEnergyCost + 2;
      const scanCashoutTradeValue = (
        canScanAfterCardsForEnergy
        || canScanAfterCreditsForEnergy
        || canScanAfterCardsForCredit
        || canScanAfterEnergyForCredit
      )
        ? Math.min(
          recoveryThreshold <= 50 ? 18 : 16,
          9
            + Math.max(0, closeScanCashoutWindow - scoreToNextThreshold) * (recoveryThreshold <= 50 ? 0.8 : 0.55)
            + Math.max(0, 3 - finalMarks) * 2,
        )
        : 0;
      const closeThirdMarkScanProgress = closeThirdMarkScanSetup
        && mainActionOpen
        && scoreToNextThreshold <= 6
        && closeScanDirectScoreGain > 0
        && scanCreditShortfall <= 0
        && scanEnergyCost > 0;
      const canScanProgressAfterCardsForEnergy = closeThirdMarkScanProgress
        && scanEnergyShortfall === 1
        && handSize >= 2;
      const canScanProgressAfterCreditsForEnergy = closeThirdMarkScanProgress
        && scanEnergyShortfall === 1
        && credits >= scanCreditCost + 2;
      const scanProgressTradeValue = (
        canScanProgressAfterCardsForEnergy
        || canScanProgressAfterCreditsForEnergy
      )
        ? Math.min(
          11,
          5
            + closeScanDirectScoreGain * 1.1
            + Math.max(0, 6 - scoreToNextThreshold) * 0.7
            + Math.max(0, 3 - finalMarks) * 1.5,
        )
        : 0;
      const finalHighScoreAvoidCreditEnergyTrap = finalHighScoreHandRefillWindow
        && credits <= 2
        && publicity >= 3
        && energy <= 0
        && !canReachAnalyze
        && bestLaunchMoveRecoveryScore <= 0
        && bestPlanetCashoutRecoveryScore <= 0
        && !canScanAfterCreditsForEnergy
        && !canScanProgressAfterCreditsForEnergy
        && aiNumber(b2SectorScanUnlockByTrade["credits-for-energy"]) <= 0;
      if (
        nextThreshold === 70
        && currentScore < 64
        && !canReachAnalyze
        && bestLaunchMoveRecoveryScore <= 0
        && bestPlanetCashoutRecoveryScore <= 0
        && scanCashoutTradeValue <= 0
      ) return [];
      const urgency = getAiRoundNumber() >= FINAL_ROUND_NUMBER ? 1 : 0.55;
      const lowEngine = Math.max(0, 2 - energy) * 2.2 + Math.max(0, 2 - handSize) * 2.5;
      const thresholdPressure = recoveryThreshold
        ? Math.min(10, scoreToNextThreshold * (recoveryThreshold <= 50 ? 0.22 : 0.14))
        : 0;
      const launchMoveRecoveryValue = Math.min(8, bestLaunchMoveRecoveryScore * 0.35);
      const planetCashoutRecoveryValue = Math.min(12, bestPlanetCashoutRecoveryScore * 0.32);
      const baseValue = (8 + lowEngine + thresholdPressure + Math.max(0, 2 - finalMarks) * 2.5 + launchMoveRecoveryValue + planetCashoutRecoveryValue) * urgency;
      const rankedPublicTradeCards = (mainActionOpen || canPrepareFinalThresholdAction || weakStartPostMainPublicRefillBaseWindow)
        ? (activeCardState.publicCards || [])
          .map((card, slotIndex) => ({
            card,
            slotIndex,
            score: scoreAiPublicPickCard(card, player, "trade"),
          }))
          .filter((entry) => entry.card && Number.isFinite(Number(entry.score)))
          .sort((left, right) => Number(right.score || 0) - Number(left.score || 0) || left.slotIndex - right.slotIndex)
        : [];
      const bestPublicTradeCard = rankedPublicTradeCards[0] || null;
      const bestPublicTradeCardScore = bestPublicTradeCard ? aiNumber(bestPublicTradeCard.score) : 0;
      const bestPublicTradeCardProfile = getAiPublicPickConcreteProfile(workingRoot, bestPublicTradeCard?.card, player);
      const bestPublicTradeCardDirectScore = Math.max(0, aiNumber(bestPublicTradeCardProfile.directScoreGain));
      const usefulPublicTradeThreshold = recoveryThreshold && recoveryThreshold <= 50 && scoreToNextThreshold <= 3 ? 8 : 4;
      const hasUsefulPublicTradeCard = bestPublicTradeCardScore >= usefulPublicTradeThreshold;
      const finalLowHandPublicRefill = finalLowHandRefillWindow && (
        currentScore < 150
          ? bestPublicTradeCardScore >= 4
          : bestPublicTradeCardScore >= 10
      );
      const finalLowStaleHandPublicRefill = finalLowStaleHandRefillBaseWindow
        && finalLowStaleHandPlayableScore < 7
        && bestPublicTradeCardScore >= 8;
      const isPublicRefillStillPositiveAfterQuickTrade = (tradeId) => {
        const trade = quickTrades.getTradeAction(tradeId);
        if (!trade) return false;
        const simulatedPlayer = createAiPlayerAfterQuickTrade(player, trade);
        if (!simulatedPlayer) return false;
        const afterTradeBestPublicScore = (activeCardState.publicCards || []).reduce((best, card) => {
          if (!card) return best;
          const score = scoreAiPublicPickCard(card, simulatedPlayer, "trade");
          return Number.isFinite(Number(score)) ? Math.max(best, aiNumber(score)) : best;
        }, -Infinity);
        return Number.isFinite(afterTradeBestPublicScore) && afterTradeBestPublicScore >= 0;
      };
      const highScoreGapTo300 = Math.max(0, 300 - highScorePushProfile.projectedScore);
      const finalHighScorePublicRefillBase = finalHighScoreHandRefillWindow
        && bestPublicTradeCardScore >= (highScorePushProfile.projectedScore >= 305
          ? 8
          : highScoreGapTo300 <= 10 ? 0 : 5);
      const finalHighScoreTerminalNoSignalPublicRefill = finalHighScorePublicRefillBase
        && handSize <= 0
        && publicity >= 3
        && publicity < 6
        && !bestPublicTradeCardProfile.hasConcreteSignal;
      const finalHighScorePublicRefill = finalHighScorePublicRefillBase
        && !finalHighScoreTerminalNoSignalPublicRefill;
      const finalHighScoreBlindRefillPublicityThreshold = normalizeAiDifficulty(
        player?.aiDifficulty || aiAutoBattleState.aiDifficulty,
      ) === AI_DIFFICULTY_WEAK_START ? 3 : 6;
      const finalHighScoreBlindRefill = finalHighScoreHandRefillWindow
        && highScorePushProfile.projectedScore < 300
        && highScoreGapTo300 <= 32
        && publicity >= finalHighScoreBlindRefillPublicityThreshold
        && handSize <= 1
        && bestPublicTradeCardScore < (highScoreGapTo300 <= 10 ? 0 : 5)
        && !bestPublicTradeCardProfile.hasConcreteSignal;
      const weakStartPostMainPublicRefill = weakStartPostMainPublicRefillBaseWindow
        && bestPublicTradeCardScore >= 24
        && aiNumber(bestPublicTradeCardProfile.playScore) >= 18
        && bestPublicTradeCardProfile.hasConcreteSignal;
      const weakStartPostMainCreditRefill = weakStartPostMainPublicRefill
        && credits >= 6
        && isPublicRefillStillPositiveAfterQuickTrade("credits-for-card");
      const weakStartPostMainPublicityRefill = weakStartPostMainPublicRefill
        && !weakStartPostMainCreditRefill
        && publicity >= 6
        && isPublicRefillStillPositiveAfterQuickTrade("publicity-for-card");
      const weakStartPostMainPublicRefillValue = weakStartPostMainPublicRefill
        ? 6
          + Math.min(10, bestPublicTradeCardScore * 0.28)
          + Math.min(6, aiNumber(bestPublicTradeCardProfile.playScore) * 0.14)
          + Math.max(0, 130 - currentScore) * 0.035
        : 0;
      const cardsForPickCardTrade = quickTrades.getTradeAction("cards-for-pick-card");
      const cardsForPickCardCheck = cardsForPickCardTrade
        ? (quickTrades.canExecuteTrade?.("cards-for-pick-card", createActionContext(workingRoot)) || { ok: false })
        : { ok: false };
      const cardsForPickCardDiscardPlan = finalHighScoreDeadHandRefillBaseWindow
        && cardsForPickCardTrade
        && cardsForPickCardCheck.ok
        ? summarizeAiTradeDiscardPlan(workingRoot, player, cardsForPickCardTrade, null, {
          includeExecutionPlan: true,
          tradeId: "cards-for-pick-card",
        })
        : null;
      const cardsForPickCardDiscardCost = cardsForPickCardDiscardPlan?.ok
        ? aiNumber(cardsForPickCardDiscardPlan.totalCost)
        : Infinity;
      const cardsForPickCardHandAfterTrade = cardsForPickCardTrade
        ? Math.max(
          0,
          handSize
            - Math.max(0, Math.round(aiNumber(cardsForPickCardTrade.cost?.handSize)))
            + Math.max(0, Math.round(aiNumber(cardsForPickCardTrade.gain?.handSize))),
        )
        : 0;
      const finalHighScoreDeadHandPickRefill = finalHighScoreDeadHandRefillBaseWindow
        && Boolean(cardsForPickCardCheck.ok)
        && cardsForPickCardHandAfterTrade >= 2
        && Number.isFinite(cardsForPickCardDiscardCost)
        && cardsForPickCardDiscardCost <= 8
        && bestPublicTradeCardScore >= 24
        && aiNumber(bestPublicTradeCardProfile.playScore) >= 18
        && bestPublicTradeCardProfile.hasConcreteSignal;
      const finalPreMainCashoutPublicRefill = finalPreMainCashoutHandRefillWindow
        && bestPublicTradeCardScore >= 12
        && bestPublicTradeCardProfile.hasConcreteSignal;
      const finalPreMainSecondCashoutPublicRefill = !finalPreMainCashoutPublicRefill
        && getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && mainActionOpen
        && !state.pendingActionExecuted
        && finalMarks >= 3
        && !recoveryThreshold
        && handSize === 1
        && publicity >= 6
        && highScorePushProfile.projectedScore >= 230
        && highScoreProjectedAfterImmediateMain >= 260
        && highScoreProjectedAfterImmediateMain < 330
        && bestImmediateMainCashoutDirectScore >= 20
        && bestImmediateMainCashoutScore >= 35
        && bestPublicTradeCardScore >= 45
        && bestPublicTradeCardDirectScore >= Math.max(20, bestImmediateMainCashoutDirectScore - 2)
        && bestPublicTradeCardProfile.hasConcreteSignal;
      const finalHighScoreRefillValue = finalHighScorePublicRefill
        ? 8
          + Math.max(0, 18 - highScoreGapTo300) * 0.45
          + Math.min(9, bestPublicTradeCardScore * 0.32)
          + Math.min(4, highScorePushProfile.strength * 2)
        : 0;
      const finalHighScoreBlindRefillValue = finalHighScoreBlindRefill
        ? 6.5
          + (handSize <= 0 ? 2.5 : 1)
          + Math.max(0, 32 - highScoreGapTo300) * 0.16
          + Math.min(4, highScorePushProfile.strength * 1.4)
        : 0;
      const finalHighScoreDeadHandPickRefillValue = finalHighScoreDeadHandPickRefill
        ? 7.5
          + Math.min(10, bestPublicTradeCardScore * 0.32)
          + Math.min(6, aiNumber(bestPublicTradeCardProfile.playScore) * 0.16)
          + Math.min(4, highScorePushProfile.strength * 1.8)
          - Math.min(5, cardsForPickCardDiscardCost * 0.45)
        : 0;
      const preMainCashoutRefillValue = (finalPreMainCashoutPublicRefill || finalPreMainSecondCashoutPublicRefill)
        ? 10
          + Math.min(8, bestPublicTradeCardScore * 0.28)
          + Math.min(12, bestImmediateMainCashoutScore * 0.18)
          + Math.min(6, bestImmediateMainCashoutDirectScore * 0.16)
        : 0;
      const readyScanCheck = mainActionOpen
        ? scanEffects?.canExecuteScan?.(player, { standardAction: true })
        : null;
      const rawReadyScanCandidate = readyScanCheck?.ok
        ? candidates.find((candidate) => candidate?.id === "scan" && candidate.available !== false) || null
        : null;
      const readyScanScore = (() => {
        if (!rawReadyScanCandidate) return 0;
        const fallbackScore = Math.max(0, aiNumber(rawReadyScanCandidate.score));
        if (!ai?.actionGraph?.buildActionGraph) return fallbackScore;
        const markedFinalFormulas = getAiMarkedFinalFormulaEntries(player);
        const traceCompetition = getAiTraceCompetitionState(player);
        const graphCandidates = ai.actionGraph.buildActionGraph(
          [rawReadyScanCandidate],
          {
            playerState: activePlayerState,
            turnState: activeTurnState,
            alienGameState: activeAlienGameState,
            finalScoringState: activeFinalScoringState,
            currentPlayer: player,
            aiMarkedFinalFormulas: markedFinalFormulas,
            aiTraceCompetition: traceCompetition,
          },
          player.id,
          {
            markedFormulas: markedFinalFormulas,
            hasMarkedFinalTile: markedFinalFormulas.length > 0,
            traceCompetition,
          },
        );
        const graphCandidate = Array.isArray(graphCandidates) ? graphCandidates[0] : null;
        if (!graphCandidate) return fallbackScore;
        const adjusted = adjustAiActionGraphCandidateForStyle(
          rawReadyScanCandidate,
          adjustAiActionGraphCandidate(rawReadyScanCandidate, graphCandidate, player),
          player,
          markedFinalFormulas,
        );
        return Math.max(0, aiNumber(adjusted?.net ?? adjusted?.breakdown?.net ?? fallbackScore));
      })();
      const shouldPreserveReadyScanOverRefill = (tradeId) => {
        if (readyScanScore < 27 || bestPublicTradeCardScore >= readyScanScore - 6) return false;
        const trade = quickTrades.getTradeAction(tradeId);
        const simulatedPlayer = trade ? createAiPlayerAfterQuickTrade(player, trade) : null;
        if (!simulatedPlayer) return false;
        const simulatedCredits = Math.max(0, aiNumber(simulatedPlayer.resources?.credits));
        const simulatedEnergy = Math.max(0, aiNumber(simulatedPlayer.resources?.energy));
        return simulatedCredits < scanCreditCost
          || simulatedEnergy < scanEnergyCost
          || !scanEffects?.canExecuteScan?.(simulatedPlayer, { standardAction: true })?.ok;
      };
      const finalLowHandCreditRefillBlocksReadyScan = shouldPreserveReadyScanOverRefill("credits-for-card");
      const finalLowHandEnergyRefillBlocksReadyScan = shouldPreserveReadyScanOverRefill("energy-for-card");
      const finalLowHandCreditRefill = finalLowHandPublicRefill
        && credits >= 2
        && !finalLowHandCreditRefillBlocksReadyScan
        && isPublicRefillStillPositiveAfterQuickTrade("credits-for-card");
      const finalLowHandEnergyRefill = finalLowHandPublicRefill
        && energy >= 2
        && !finalLowHandEnergyRefillBlocksReadyScan
        && isPublicRefillStillPositiveAfterQuickTrade("energy-for-card");
      const finalHighScorePreserveLastCredits = finalHighScorePublicRefill
        && publicity >= 3
        && credits <= 2;
      const finalHighScoreCreditRefill = finalHighScorePublicRefill
        && credits >= 2
        && !finalHighScorePreserveLastCredits;
      const finalHighScoreEnergyRefill = finalHighScorePublicRefill && energy >= 2;
      const secondMarkCreditRecovery = recoveryThreshold <= 50
        && finalMarks <= 1
        && credits <= 0
        && energy >= 2
        && (handSize >= 2 || scanEnergyCost <= Math.max(0, energy - 2));
      const secondMarkAnalyzeEnergyRecovery = recoveryThreshold <= 50
        && finalMarks <= 1
        && currentScore >= 45
        && canReachAnalyze
        && energy < analyzeEnergyCost
        && handSize >= 2;
      const desperateSecondMarkCardSearch = recoveryThreshold <= 50
        && finalMarks <= 1
        && getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && currentScore <= 42
        && scoreToNextThreshold >= 8
        && publicity >= 3
        && handSize <= 4
        && credits <= 1
        && energy <= 1
        && bestPublicTradeCardScore >= 4;
      const secondMarkCardSearch = recoveryThreshold <= 50
        && finalMarks <= 1
        && (mainActionOpen || canPrepareFinalThresholdAction)
        && publicity >= 3
        && handSize <= 4
        && (bestPublicTradeCardScore >= 9 || desperateSecondMarkCardSearch);
      const closeSecondMarkCardSearch = recoveryThreshold <= 50
        && finalMarks <= 1
        && getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && currentScore >= 43
        && currentScore < 50
        && (mainActionOpen || canPrepareFinalThresholdAction)
        && publicity >= 3
        && handSize <= 2;
      const secondMarkEnergyCardSearch = recoveryThreshold <= 50
        && finalMarks <= 1
        && getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && currentScore >= 43
        && currentScore < 50
        && (mainActionOpen || canPrepareFinalThresholdAction)
        && energy >= 2
        && handSize <= 1;
      const creditsAfterCardTrade = Math.max(0, credits - 2);
      const creditCardTradeCanPayFollowup = creditsAfterCardTrade >= 1 || publicity >= 3;
      const avoidCloseSecondMarkCreditCardTrap = getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && (
          (Boolean(recoveryThreshold) && recoveryThreshold <= 50 && scoreToNextThreshold <= 3)
          || (!recoveryThreshold && finalHighScoreCreditRefill)
        )
        && !creditCardTradeCanPayFollowup;
      const thresholdCreditRecovery = canPrepareFinalThresholdAction
        && credits <= 0
        && handSize >= 3
        && (
          (recoveryThreshold <= 50 && (
            energy >= scanEnergyCost
            || canReachAnalyze
            || bestPublicTradeCardScore >= 9
            || currentScore >= 48
          ))
          || currentScore >= 64
          || scoreToNextThreshold <= 8
        );
      const thirdMarkCreditRecovery = canPrepareFinalThresholdAction
        && recoveryThreshold >= 70
        && finalMarks >= 2
        && credits <= 0
        && energy >= 2
        && (
          handSize >= 1
          || energy >= scanEnergyCost + 2
          || currentScore >= 60
        );
      const cardsForEnergyTrade = quickTrades.getTradeAction("cards-for-energy");
      const cardsForEnergyHandDrainPenalty = (() => {
        if (!cardsForEnergyTrade) return 0;
        const highScoreProfile = getAiHighScorePushProfile(player);
        if (highScoreProfile.active && highScoreProfile.projectedScore >= 260) return 0;
        const handCost = Math.max(0, Math.round(aiNumber(cardsForEnergyTrade.cost?.handSize)));
        if (handCost <= 0 || handSize < handCost) return 0;
        const handAfterTrade = Math.max(0, handSize - handCost);
        const discardCost = estimateAiTradeDiscardOpportunityCost(workingRoot, player, cardsForEnergyTrade);
        const genericCost = scoreAiResourceBundle(cardsForEnergyTrade.cost || {});
        let penalty = Number.isFinite(discardCost)
          ? Math.max(0, discardCost - genericCost) * 0.18
          : 0;
        const planetPlan = planetCashoutRecoveryByTrade["cards-for-energy"]?.plan || null;
        const directCashout = Math.max(0, aiNumber(planetPlan?.directScore));
        const rewardCashout = Math.max(0, aiNumber(planetPlan?.rewardValue));
        const reachesThreshold = Boolean(planetPlan?.reachesNextThreshold)
          || (
            recoveryThreshold
            && currentScore < recoveryThreshold
            && currentScore + directCashout >= recoveryThreshold
          );
        const lowScoreHandDrain = getAiRoundNumber() >= 3
          && !reachesThreshold
          && finalMarks >= 3
          && !recoveryThreshold
          && currentScore < 165
          && handAfterTrade <= 1
          && directCashout < 12
          && rewardCashout < 36;
        if (lowScoreHandDrain) {
          penalty += 5.5
            + Math.max(0, 165 - currentScore) * 0.045
            + (handAfterTrade <= 0 ? 3 : 1.5);
        }
        const midgameHandDrain = getAiRoundNumber() === 3
          && !recoveryThreshold
          && currentScore < 120
          && handAfterTrade <= 1
          && directCashout < 10;
        if (midgameHandDrain) {
          penalty += 2.5 + Math.max(0, 120 - currentScore) * 0.035;
        }
        return roundAiScore(Math.min(22, Math.max(0, penalty)));
      })();
      const tradeSpecs = [
        {
          tradeId: "credits-for-card",
          enabled: ((mainActionOpen || canPrepareFinalThresholdAction)
            && credits >= 2
            && (handSize <= 1 || finalHighScoreCreditRefill)
            && !avoidCloseSecondMarkCreditCardTrap
            && (recoveryThreshold || finalLowHandCreditRefill || finalHighScoreCreditRefill))
            || weakStartPostMainCreditRefill,
          value: baseValue
            + (handSize <= 0 ? 6 : 3)
            + (credits >= 6 ? 2 : 0)
            + (finalHighScoreCreditRefill ? finalHighScoreRefillValue : 0)
            + (weakStartPostMainCreditRefill ? weakStartPostMainPublicRefillValue : 0),
          reason: finalLowHandCreditRefill
            ? "终局低手牌：信用点精选恢复打牌"
            : finalHighScoreCreditRefill
              ? "高分冲刺：信用点精选找最后得分牌"
            : weakStartPostMainCreditRefill
              ? "弱起步保牌：主行动后信用点精选下轮得分牌"
            : "后期落后：信用点换牌恢复行动",
        },
        {
          tradeId: "credits-for-energy",
          enabled: canSpendEnergyForRecovery && credits >= 2 && !finalHighScoreAvoidCreditEnergyTrap && (
            energy <= 0
            || canScanAfterCreditsForEnergy
            || canScanProgressAfterCreditsForEnergy
            || aiNumber(planetCashoutRecoveryByTrade["credits-for-energy"]?.score) > 0
            || aiNumber(b2SectorScanUnlockByTrade["credits-for-energy"]) > 0
            || aiNumber(midgameAnalyzeUnlockByTrade["credits-for-energy"]) > 0
          ),
          value: baseValue + 3 + (handSize > 0 ? 1.5 : 0)
            + Math.min(7, aiNumber(launchMoveRecoveryByTrade["credits-for-energy"]?.score) * 0.4)
            + Math.min(18, aiNumber(planetCashoutRecoveryByTrade["credits-for-energy"]?.score) * 0.55)
            + (canScanAfterCreditsForEnergy ? scanCashoutTradeValue : 0)
            + (canScanProgressAfterCreditsForEnergy ? scanProgressTradeValue : 0)
            + Math.min(28, aiNumber(b2SectorScanUnlockByTrade["credits-for-energy"]))
            + Math.min(18, aiNumber(midgameAnalyzeUnlockByTrade["credits-for-energy"])),
          reason: aiNumber(planetCashoutRecoveryByTrade["credits-for-energy"]?.score) > 0
            ? "路线兑现：信用点换能量准备环绕/登陆"
            : aiNumber(b2SectorScanUnlockByTrade["credits-for-energy"]) > 0
              ? "B2兑现：信用点换能量准备完成扇区"
              : aiNumber(midgameAnalyzeUnlockByTrade["credits-for-energy"]) > 0
                ? "中期引擎：信用点换能量解锁分析"
              : canScanAfterCreditsForEnergy
              ? "终局临门：信用点换能量准备扫描"
              : canScanProgressAfterCreditsForEnergy
                ? "终局第3标记：信用点换能量推进扫描找分"
              : "后期落后：信用点换能量恢复移动/分析",
        },
        {
          tradeId: "cards-for-energy",
          enabled: canSpendEnergyForRecovery && (
            (handSize >= 4 && energy <= 0)
            || secondMarkAnalyzeEnergyRecovery
            || canScanAfterCardsForEnergy
            || canScanProgressAfterCardsForEnergy
            || aiNumber(planetCashoutRecoveryByTrade["cards-for-energy"]?.score) > 0
            || aiNumber(b2SectorScanUnlockByTrade["cards-for-energy"]) > 0
            || aiNumber(midgameAnalyzeUnlockByTrade["cards-for-energy"]) > 0
          ),
          value: baseValue + 1.5 + (credits <= 0 ? 1 : 0)
            + Math.min(7, aiNumber(launchMoveRecoveryByTrade["cards-for-energy"]?.score) * 0.4)
            + Math.min(15, aiNumber(planetCashoutRecoveryByTrade["cards-for-energy"]?.score) * 0.45)
            + (secondMarkAnalyzeEnergyRecovery ? Math.min(18, 12 + Math.max(0, 8 - scoreToNextThreshold) * 0.75) : 0)
            + (canScanAfterCardsForEnergy ? scanCashoutTradeValue : 0)
            + (canScanProgressAfterCardsForEnergy ? scanProgressTradeValue : 0)
            + Math.min(24, aiNumber(b2SectorScanUnlockByTrade["cards-for-energy"]))
            + Math.min(16, aiNumber(midgameAnalyzeUnlockByTrade["cards-for-energy"]))
            - cardsForEnergyHandDrainPenalty,
          reason: aiNumber(planetCashoutRecoveryByTrade["cards-for-energy"]?.score) > 0
            ? "路线兑现：弃牌换能量准备环绕/登陆"
            : aiNumber(b2SectorScanUnlockByTrade["cards-for-energy"]) > 0
              ? "B2兑现：弃牌换能量准备完成扇区"
              : aiNumber(midgameAnalyzeUnlockByTrade["cards-for-energy"]) > 0
                ? "中期引擎：弃牌换能量解锁分析"
              : canScanAfterCardsForEnergy
              ? "终局临门：弃牌换能量准备扫描"
              : canScanProgressAfterCardsForEnergy
                ? "终局第3标记：弃牌换能量推进扫描找分"
              : secondMarkAnalyzeEnergyRecovery
                ? "终局第2标记：弃牌换能量准备分析"
                : "后期落后：弃牌换能量恢复移动/分析",
        },
        {
          tradeId: "cards-for-credit",
          enabled: canScanAfterCardsForCredit
            || thresholdCreditRecovery
            || finalLowScoreCardsForCreditScanUnlock
            || aiNumber(b2SectorScanUnlockByTrade["cards-for-credit"]) > 0,
          value: baseValue
            + (canScanAfterCardsForCredit ? scanCashoutTradeValue : 0)
            + (thresholdCreditRecovery ? Math.min(10, 5 + Math.max(0, 8 - scoreToNextThreshold) * 0.55) : 0)
            + (finalLowScoreCardsForCreditScanUnlock
              ? Math.max(
                finalLowScoreScanUnlockByTrade["cards-for-credit"],
                8 + Math.max(0, 150 - currentScore) * 0.05,
              )
              : 0)
            + Math.min(24, aiNumber(b2SectorScanUnlockByTrade["cards-for-credit"]))
            + (energy >= scanEnergyCost + 1 ? 1 : 0),
          reason: canScanAfterCardsForCredit
            ? "终局临门：弃牌换信用点准备扫描"
            : aiNumber(b2SectorScanUnlockByTrade["cards-for-credit"]) > 0
              ? "B2兑现：弃牌换信用点准备完成扇区"
              : finalLowScoreCardsForCreditScanUnlock
              ? "终局低分：弃牌换信用点解锁扫描"
              : "终局缺标记：弃牌换信用点准备下一轮兑现",
        },
        {
          tradeId: "energy-for-card",
          enabled: secondMarkEnergyCardSearch || finalLowHandEnergyRefill || finalHighScoreEnergyRefill,
          value: baseValue
            + 5
            + Math.min(8, bestPublicTradeCardScore * 0.28)
            + Math.max(0, 7 - scoreToNextThreshold) * 0.5
            + (finalLowHandEnergyRefill ? 3 + (handSize <= 0 ? 2 : 0) : 0)
            + (finalHighScoreEnergyRefill ? finalHighScoreRefillValue : 0),
          reason: finalLowHandEnergyRefill
            ? "终局低手牌：能量精选恢复打牌"
            : finalHighScoreEnergyRefill
              ? "高分冲刺：能量精选找最后得分牌"
            : "终局第2标记：能量精选寻找得分牌",
        },
        {
          tradeId: "energy-for-credit",
          enabled: canScanAfterEnergyForCredit
            || (secondMarkCreditRecovery && !shouldReservePlanetCashoutEnergy)
            || thirdMarkCreditRecovery
            || finalLowScoreEnergyForCreditScanUnlock
            || aiNumber(b2SectorScanUnlockByTrade["energy-for-credit"]) > 0,
          value: baseValue
            + (recoveryThreshold <= 50 ? 8 : 4)
            + (canScanAfterEnergyForCredit ? scanCashoutTradeValue : 0)
            + (secondMarkCreditRecovery ? Math.min(8, scoreToNextThreshold * 0.28) : 0)
            + (thirdMarkCreditRecovery ? Math.min(10, 4 + Math.max(0, 22 - scoreToNextThreshold) * 0.25 + (handSize > 0 ? 2 : 0)) : 0)
            + (finalLowScoreEnergyForCreditScanUnlock ? finalLowScoreScanUnlockByTrade["energy-for-credit"] : 0)
            + Math.min(24, aiNumber(b2SectorScanUnlockByTrade["energy-for-credit"])),
          reason: canScanAfterEnergyForCredit
            ? "终局临门：能量换信用点准备扫描"
            : aiNumber(b2SectorScanUnlockByTrade["energy-for-credit"]) > 0
              ? "B2兑现：能量换信用点准备完成扇区"
              : finalLowScoreEnergyForCreditScanUnlock
              ? "终局低分：能量换信用点解锁扫描"
              : thirdMarkCreditRecovery
                ? "终局第3标记：能量换信用点恢复打牌/扫描"
                : "后期落后：能量换信用点恢复打牌/扫描",
        },
        {
          tradeId: "cards-for-pick-card",
          enabled: finalHighScoreDeadHandPickRefill,
          value: baseValue
            + finalHighScoreDeadHandPickRefillValue
            + Math.min(5, Math.max(0, 305 - highScorePushProfile.projectedScore) * 0.06),
          reason: "高分冲刺：弃死手牌精选可打牌",
        },
        {
          tradeId: "publicity-for-card",
          enabled: ((mainActionOpen || canPrepareFinalThresholdAction) && publicity >= 3 && (
              (handSize <= 1 && hasUsefulPublicTradeCard)
              || finalLowHandPublicRefill
              || finalLowStaleHandPublicRefill
              || finalHighScorePublicRefill
              || finalHighScoreBlindRefill
              || finalPreMainCashoutPublicRefill
              || finalPreMainSecondCashoutPublicRefill
              || secondMarkCardSearch
              || closeSecondMarkCardSearch
            ))
            || weakStartPostMainPublicityRefill,
          value: baseValue
            + (handSize <= 0 ? 4 : 2)
            + (!(secondMarkCardSearch || closeSecondMarkCardSearch) ? Math.min(6, bestPublicTradeCardScore * 0.22) : 0)
            + (finalLowHandPublicRefill
              ? 4 + Math.min(8, bestPublicTradeCardScore * 0.35) + finalLowHandPressure * 0.035
              : 0)
            + (finalLowStaleHandPublicRefill
              ? 3 + Math.min(7, bestPublicTradeCardScore * 0.28) + Math.max(0, 170 - currentScore) * 0.02
              : 0)
            + (finalHighScorePublicRefill ? finalHighScoreRefillValue : 0)
            + (finalHighScoreBlindRefill ? finalHighScoreBlindRefillValue : 0)
            + preMainCashoutRefillValue
            + (weakStartPostMainPublicityRefill ? weakStartPostMainPublicRefillValue : 0)
            + ((secondMarkCardSearch || closeSecondMarkCardSearch)
              ? 5 + Math.min(9, bestPublicTradeCardScore * 0.3)
              : 0),
          preferBlindDraw: finalHighScoreBlindRefill,
          reason: secondMarkCardSearch || closeSecondMarkCardSearch
            ? "终局第2标记：宣传精选寻找得分牌"
            : finalLowHandPublicRefill
              ? "终局低手牌：宣传精选恢复打牌"
              : finalLowStaleHandPublicRefill
                ? "终局资源断档：宣传精选找可打牌"
                : finalHighScorePublicRefill
                  ? "高分冲刺：宣传精选找最后得分牌"
                  : finalHighScoreBlindRefill
                    ? "高分冲刺：公共牌无收益时盲抽找最后得分牌"
                  : (finalPreMainCashoutPublicRefill || finalPreMainSecondCashoutPublicRefill)
                    ? "高分冲刺：主行动前精选找后续得分牌"
                    : weakStartPostMainPublicityRefill
                      ? "弱起步保牌：主行动后宣传精选下轮得分牌"
                    : "后期落后：宣传换牌恢复行动",
        },
      ];

      return tradeSpecs
        .filter((spec) => spec.enabled)
        .map((spec) => {
          const concreteRecoverySignal = (() => {
            if (spec.tradeId === "credits-for-energy") {
              return canScanAfterCreditsForEnergy
                || canScanProgressAfterCreditsForEnergy
                || aiNumber(launchMoveRecoveryByTrade[spec.tradeId]?.score) > 0
                || aiNumber(planetCashoutRecoveryByTrade[spec.tradeId]?.score) > 0
                || aiNumber(b2SectorScanUnlockByTrade[spec.tradeId]) > 0
                || aiNumber(midgameAnalyzeUnlockByTrade[spec.tradeId]) > 0;
            }
            if (spec.tradeId === "cards-for-energy") {
              return secondMarkAnalyzeEnergyRecovery
                || canScanAfterCardsForEnergy
                || canScanProgressAfterCardsForEnergy
                || aiNumber(launchMoveRecoveryByTrade[spec.tradeId]?.score) > 0
                || aiNumber(planetCashoutRecoveryByTrade[spec.tradeId]?.score) > 0
                || aiNumber(b2SectorScanUnlockByTrade[spec.tradeId]) > 0
                || aiNumber(midgameAnalyzeUnlockByTrade[spec.tradeId]) > 0;
            }
            if (spec.tradeId === "energy-for-credit") {
              return canScanAfterEnergyForCredit
                || secondMarkCreditRecovery
                || thirdMarkCreditRecovery
                || finalLowScoreEnergyForCreditScanUnlock
                || aiNumber(b2SectorScanUnlockByTrade[spec.tradeId]) > 0;
            }
            return true;
          })();
          const genericFinalResourceRecovery = getAiRoundNumber() >= FINAL_ROUND_NUMBER
            && canPrepareFinalThresholdAction
            && ["credits-for-energy", "cards-for-energy", "energy-for-credit"].includes(spec.tradeId)
            && String(spec.reason || "").startsWith("后期落后：");
          if (genericFinalResourceRecovery && !concreteRecoverySignal) return null;
          const trade = quickTrades.getTradeAction(spec.tradeId);
          const check = quickTrades.canExecuteTrade?.(spec.tradeId, createActionContext(workingRoot)) || { ok: false };
          if (!trade || !check.ok) return null;
          const analyzeTrade = spec.tradeId === "cards-for-energy" && String(spec.reason || "").includes("分析")
            ? evaluateAiCardsForEnergyAnalyzeProtection(workingRoot, player, trade, null, {
              saferEnergyTradeAvailable: Boolean(
                !finalHighScoreAvoidCreditEnergyTrap
                && quickTrades.getTradeAction("credits-for-energy")
                && quickTrades.canExecuteTrade?.("credits-for-energy", createActionContext(workingRoot))?.ok,
              ),
            })
            : null;
          if (analyzeTrade && (!analyzeTrade.discardPlan.ok || analyzeTrade.protection.shouldProtect)) {
            return null;
          }
          return {
            id: "quickTrade",
            kind: "quick",
            available: true,
            tradeId: trade.id,
            label: trade.label || trade.id,
            score: roundAiScore(spec.value),
            reason: spec.reason,
            preferBlindDraw: Boolean(spec.preferBlindDraw),
            valueBreakdown: {
              lateResourceRecoveryTrade: true,
              concreteRecoverySignal,
              currentScore,
              finalMarkCount: finalMarks,
              nextFinalMarkThreshold: recoveryThreshold || null,
              paceDeficit,
              canReachAnalyze,
              scanCashoutTrade: spec.reason.startsWith("终局临门"),
              scanCost,
              closeScanDirectScoreGain,
              scoreToNextThreshold,
              credits,
              energy,
              handSize,
              bestPublicTradeCardScore: roundAiScore(bestPublicTradeCardScore),
              bestPublicTradeCard: bestPublicTradeCard ? summarizeAiPublicPickCandidate(workingRoot, bestPublicTradeCard, player) : null,
              bestPublicTradeCardHasConcreteSignal: Boolean(bestPublicTradeCardProfile.hasConcreteSignal),
              finalHighScoreTerminalNoSignalPublicRefill,
              usefulPublicTradeThreshold,
              creditCardTradeCanPayFollowup,
              avoidCloseSecondMarkCreditCardTrap,
              canPrepareFinalThresholdAction,
              secondMarkCreditRecovery,
              secondMarkCardSearch,
              closeSecondMarkCardSearch,
              finalLowHandPublicRefill,
              finalLowStaleHandRefillBaseWindow,
              finalLowStaleHandPublicRefill,
              finalLowStaleHandPlayableScore: roundAiScore(finalLowStaleHandPlayableScore),
              finalHighScoreNeedsCardRefill,
              finalHighScoreDeadHandRefillBaseWindow,
              finalHighScoreDeadHandPickRefill,
              finalHighScoreDeadHandPickRefillValue: roundAiScore(finalHighScoreDeadHandPickRefillValue),
              cardsForPickCardHandAfterTrade,
              cardsForPickCardDiscardCost: Number.isFinite(cardsForPickCardDiscardCost)
                ? roundAiScore(cardsForPickCardDiscardCost)
                : null,
              finalHighScorePublicRefill,
              finalHighScoreRefillValue: roundAiScore(finalHighScoreRefillValue),
              finalHighScoreBlindRefill,
              finalHighScoreBlindRefillValue: roundAiScore(finalHighScoreBlindRefillValue),
              finalHighScoreBlindRefillPublicityThreshold,
              preferBlindDraw: Boolean(spec.preferBlindDraw),
              finalPreMainCashoutHandRefillWindow,
              finalPreMainCashoutPublicRefill,
              finalPreMainSecondCashoutPublicRefill,
              preMainCashoutRefillValue: roundAiScore(preMainCashoutRefillValue),
              weakStartPostMainPublicRefillBaseWindow,
              weakStartPostMainPublicRefill,
              weakStartPostMainCreditRefill,
              weakStartPostMainPublicityRefill,
              weakStartPostMainPublicRefillValue: roundAiScore(weakStartPostMainPublicRefillValue),
              bestImmediateMainCashout: bestImmediateMainCashout ? {
                id: bestImmediateMainCashout.id || null,
                score: roundAiScore(bestImmediateMainCashoutScore),
                directScoreGain: roundAiScore(bestImmediateMainCashoutDirectScore),
                label: bestImmediateMainCashout.label || bestImmediateMainCashout.planetName || null,
              } : null,
              highScoreProjectedAfterImmediateMain: roundAiScore(highScoreProjectedAfterImmediateMain),
              highScoreProjectedScore: roundAiScore(highScorePushProfile.projectedScore),
              highScoreGapTo300: roundAiScore(highScoreGapTo300),
              highScorePlayableHandScore: roundAiScore(highScorePlayableHandScore),
              finalHighScoreAvoidCreditEnergyTrap,
              finalLowHandCreditRefill,
              finalLowHandEnergyRefill,
              readyScanScore: roundAiScore(readyScanScore),
              finalLowHandCreditRefillBlocksReadyScan,
              finalLowHandEnergyRefillBlocksReadyScan,
              finalHighScorePreserveLastCredits,
              finalHighScoreCreditRefill,
              finalHighScoreEnergyRefill,
              secondMarkEnergyCardSearch,
              desperateSecondMarkCardSearch,
              thresholdCreditRecovery,
              finalLowScoreScanUnlock,
              finalLowScoreCardsForCreditScanPrepare,
              finalLowScoreScanUnlockByTrade: {
                "cards-for-credit": roundAiScore(finalLowScoreScanUnlockByTrade["cards-for-credit"]),
                "energy-for-credit": roundAiScore(finalLowScoreScanUnlockByTrade["energy-for-credit"]),
              },
              midgameAnalyzeUnlockByTrade: {
                "credits-for-energy": roundAiScore(midgameAnalyzeUnlockByTrade["credits-for-energy"]),
                "cards-for-energy": roundAiScore(midgameAnalyzeUnlockByTrade["cards-for-energy"]),
              },
              secondMarkAnalyzeEnergyRecovery,
              thirdMarkCreditRecovery,
              closeThirdMarkScanSetup,
              closeThirdMarkScanProgress,
              scanProgressTradeValue,
              cardsForEnergyHandDrainPenalty: spec.tradeId === "cards-for-energy"
                ? cardsForEnergyHandDrainPenalty
                : 0,
              launchMoveRecoveryScore: aiNumber(launchMoveRecoveryByTrade[spec.tradeId]?.score),
              planetCashoutRecoveryScore: aiNumber(planetCashoutRecoveryByTrade[spec.tradeId]?.score),
              planetCashoutRecoveryPlan: planetCashoutRecoveryByTrade[spec.tradeId]?.plan || null,
              reservedPlanetCashoutEnergy,
              ...(analyzeTrade ? {
                analyzeScore: roundAiScore(analyzeTrade.analyzeScore),
                directScoreProtection: analyzeTrade.protection,
                discardPlan: analyzeTrade.discardPlan,
              } : {}),
            },
          };
        })
        .filter(Boolean)
        .sort((left, right) => aiNumber(right.score) - aiNumber(left.score));
    }
    return Object.freeze({
      listAiEmergencyAnalyzeEnergyTradeCandidates,
      listAiFinalAnalyzeEnergyTradeCandidates,
      listAiThirdFinalMarkResourceTradeCandidates,
      summarizeAiTradeDiscardCardEntry,
      buildAiTradeDiscardCostEntries,
      summarizeAiTradeDiscardPlan,
      estimateAiTradeDiscardOpportunityCost,
      summarizeAiRepeatedCardsForCreditDiscardPlan,
      createAiPlayerAfterRepeatedQuickTrade,
      getAiFinalReadyTaskCreditChainProfile,
      listAiFinalReadyTaskCreditChainTradeCandidates,
      countAiQuickTradesThisTurn,
      getAiBestOpenedMainActionScore,
      buildAiMainUnlockTradeCandidate,
      listAiMainUnlockTradeCandidates,
      buildAiResourceLockMainUnlockTradeCandidate,
      listAiResourceLockMainUnlockTradeCandidates,
      listAiLateResourceRecoveryTradeCandidates,
    });
  }

  return Object.freeze({ createTradeCandidates });
});
