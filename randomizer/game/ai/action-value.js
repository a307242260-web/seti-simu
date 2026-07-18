(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAIActionValue = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createActionValue(context = {}) {
    const {
      state,
      solar,
      players,
      rocketActions,
      planetRewards,
      endGameScoring,
      industry,
      actions,
      cards,
      initialCards,
      cardEffects,
      tech,
      data,
      aliens,
      aomomo,
      jiuzhe,
      yichangdian,
      banrenma,
      chong,
      amiba,
      runezu,
      ai,
      alienGameState,
      rocketState,
      planetStatsState,
      FINAL_ROUND_NUMBER,
      AI_RESOURCE_VALUES,
      AI_TRACE_TYPES,
      AI_FANGZHOU_CARD2_REWARD_EFFECT_TYPE,
      AI_STYLE_IDS,
      AI_DIFFICULTY_WEAK_START,
      aiAutoBattleState,
    } = context;
    const addAiAllTraceDemand = (...args) => context.addAiAllTraceDemand(...args);
    const aiMarkerBelongsToPlayer = (...args) => context.aiMarkerBelongsToPlayer(...args);
    const aiNumber = (...args) => context.aiNumber(...args);
    const chooseAiLandChoice = (...args) => context.chooseAiLandChoice(...args);
    const countAiFinalMarksForPlayer = (...args) => context.countAiFinalMarksForPlayer(...args);
    const countAiHandEngineCards = (...args) => context.countAiHandEngineCards(...args);
    const countAiHandTaskCards = (...args) => context.countAiHandTaskCards(...args);
    const countAiPlayerTech = (...args) => context.countAiPlayerTech(...args);
    const countAiYichangdianAnomalySignals = (...args) => context.countAiYichangdianAnomalySignals(...args);
    const createActionContext = (...args) => context.createActionContext(...args);
    const getAiActiveOpponentCount = (...args) => context.getAiActiveOpponentCount(...args);
    const getAiAnalyzeEnergyCost = (...args) => context.getAiAnalyzeEnergyCost(...args);
    const getAiAomomoFossilUnitValue = (...args) => context.getAiAomomoFossilUnitValue(...args);
    const getAiAvailableDataRoom = (...args) => context.getAiAvailableDataRoom(...args);
    const getAiB2SectorBottleneck = (...args) => context.getAiB2SectorBottleneck(...args);
    const getAiBestRevealedAlienTraceDirectScore = (...args) => context.getAiBestRevealedAlienTraceDirectScore(...args);
    const getAiIncomeFinalFormulaEntries = (...args) => context.getAiIncomeFinalFormulaEntries(...args);
    const getAiJiuzheThreatValuationContext = (...args) => context.getAiJiuzheThreatValuationContext(...args);
    const getAiLandDirectScoreGainForTarget = (...args) => context.getAiLandDirectScoreGainForTarget(...args);
    const getAiLiveScorePaceDeficit = (...args) => context.getAiLiveScorePaceDeficit(...args);
    const getAiMapDemand = (...args) => context.getAiMapDemand(...args);
    const getAiMarkedFinalFormulaEntries = (...args) => context.getAiMarkedFinalFormulaEntries(...args);
    const getAiNextMissingFinalScoreThreshold = (...args) => context.getAiNextMissingFinalScoreThreshold(...args);
    const getAiOrbitDirectScoreGain = (...args) => context.getAiOrbitDirectScoreGain(...args);
    const getAiPlanningFinalFormulaEntries = (...args) => context.getAiPlanningFinalFormulaEntries(...args);
    const getAiRemainingRoundWeight = (...args) => context.getAiRemainingRoundWeight(...args);
    const getAiResourceValuesForRound = (...args) => context.getAiResourceValuesForRound(...args);
    const getAiRoundNumber = (...args) => context.getAiRoundNumber(...args);
    const getAiStrategyDemand = (...args) => context.getAiStrategyDemand(...args);
    const getCurrentPlayer = (...args) => context.getCurrentPlayer(...args);
    const getEarthSectorCoordinate = (...args) => context.getEarthSectorCoordinate(...args);
    const getMovableTokensForPlayer = (...args) => context.getMovableTokensForPlayer(...args);
    const getPublicScanChoicesForCard = (...args) => context.getPublicScanChoicesForCard(...args);
    const getSectorXsMatchingCondition = (...args) => context.getSectorXsMatchingCondition(...args);
    const isAiCardScanEffectType = (...args) => context.isAiCardScanEffectType(...args);
    const listAiUncompletedCardTasksForPlayer = (...args) => context.listAiUncompletedCardTasksForPlayer(...args);
    const missingMultiplier = (...args) => context.missingMultiplier(...args);
    const normalizeAiDifficulty = (...args) => context.normalizeAiDifficulty(...args);
    const roundAiScore = (...args) => context.roundAiScore(...args);
    const scoreAiAmibaSingleSymbolChoiceValue = (...args) => context.scoreAiAmibaSingleSymbolChoiceValue(...args);
    const scoreAiAmibaTraceRemovalValue = (...args) => context.scoreAiAmibaTraceRemovalValue(...args);
    const scoreAiAomomoFossilPlanBonus = (...args) => context.scoreAiAomomoFossilPlanBonus(...args);
    const scoreAiAomomoFossilSpendPlanPenalty = (...args) => context.scoreAiAomomoFossilSpendPlanPenalty(...args);
    const scoreAiAverageChongFossilRewardValue = (...args) => context.scoreAiAverageChongFossilRewardValue(...args);
    const scoreAiBanrenmaEnergyIncomeValue = (...args) => context.scoreAiBanrenmaEnergyIncomeValue(...args);
    const scoreAiBestChongFossilRewardValue = (...args) => context.scoreAiBestChongFossilRewardValue(...args);
    const scoreAiChongTravelEffectImmediateValue = (...args) => context.scoreAiChongTravelEffectImmediateValue(...args);
    const scoreAiFangzhouCard2AdvancedRewardValue = (...args) => context.scoreAiFangzhouCard2AdvancedRewardValue(...args);
    const scoreAiIncomeDiscardFinalFormulaFit = (...args) => context.scoreAiIncomeDiscardFinalFormulaFit(...args);
    const scoreAiIncomeDiscardRouteEnergyFit = (...args) => context.scoreAiIncomeDiscardRouteEnergyFit(...args);
    const scoreAiIncomePlacementRewardValue = (...args) => context.scoreAiIncomePlacementRewardValue(...args);
    const scoreAiLandRewardValueForTarget = (...args) => context.scoreAiLandRewardValueForTarget(...args);
    const scoreAiLateMissingFinalMarkNoDirectPenalty = (...args) => context.scoreAiLateMissingFinalMarkNoDirectPenalty(...args);
    const scoreAiMidgameResourceContinuationValue = (...args) => context.scoreAiMidgameResourceContinuationValue(...args);
    const scoreAiOrbitRewardValue = (...args) => context.scoreAiOrbitRewardValue(...args);
    const scoreAiPaceValueForDirectScore = (...args) => context.scoreAiPaceValueForDirectScore(...args);
    const scoreAiPayCreditReward = (...args) => context.scoreAiPayCreditReward(...args);
    const scoreAiPublicityResearchTechSetupValue = (...args) => context.scoreAiPublicityResearchTechSetupValue(...args);
    const scoreAiResourceBundle = (...args) => context.scoreAiResourceBundle(...args);
    const scoreAiRunezuSymbolBranchValue = (...args) => context.scoreAiRunezuSymbolBranchValue(...args);
    const scoreAiRunezuSymbolRewardValue = (...args) => context.scoreAiRunezuSymbolRewardValue(...args);
    const scoreAiThresholdPressureForScoreGain = (...args) => context.scoreAiThresholdPressureForScoreGain(...args);
    const scoreAiYichangdianNextAnomalyRewardValue = (...args) => context.scoreAiYichangdianNextAnomalyRewardValue(...args);
    const scoreAiYichangdianNextAnomalyScanValue = (...args) => context.scoreAiYichangdianNextAnomalyScanValue(...args);
    const sumAiDemandMap = (...args) => context.sumAiDemandMap(...args);

    function getAiActionGraphBaseNet(candidate = {}) {
      const breakdown = candidate.breakdown || {};
      const explicitScore = Number.isFinite(Number(breakdown.existingScore))
        ? aiNumber(breakdown.existingScore)
        : null;
      if (explicitScore != null) return explicitScore;
      return aiNumber(candidate.gain ?? breakdown.gain) - aiNumber(candidate.cost ?? breakdown.cost);
    }

    function getAiBestNestedCandidateScore(rawCandidate = {}) {
      const nested = rawCandidate.id === "playCard"
        ? rawCandidate.playableCards
        : rawCandidate.id === "researchTech"
          ? rawCandidate.takeable
          : null;
      if (!Array.isArray(nested) || !nested.length) return null;
      return nested.reduce((best, candidate) => (
        Math.max(best, aiNumber(candidate?.score))
      ), -Infinity);
    }

    function countAiStandardScansThisRound(player = getCurrentPlayer()) {
      if (!player) return 0;
      const round = getAiRoundNumber();
      return (aiAutoBattleState.logs || []).filter((entry) => (
        entry?.type === "turn-action"
        && entry.roundNumber === round
        && entry.playerId === player.id
        && entry.details?.action?.id === "scan"
      )).length;
    }

    function getAiFinalRoundProgressPenaltyScale(actionId, rawCandidate = {}, graphCandidate = {}, player = getCurrentPlayer()) {
      const round = getAiRoundNumber();
      if (!player || round < FINAL_ROUND_NUMBER) return 1;
      const nextThreshold = getAiNextMissingFinalScoreThreshold(player);
      if (!nextThreshold) return 1;

      const currentScore = Math.max(0, aiNumber(player?.resources?.score));
      if (currentScore >= nextThreshold) return 1;
      const directScoreGain = Math.max(0, aiNumber(rawCandidate.directScoreGain));
      const followupDirectScore = Math.max(0, aiNumber(rawCandidate.followupMainAction?.directScoreGain));
      if (currentScore + directScoreGain + followupDirectScore >= nextThreshold) return 0;

      const nestedBestScore = getAiBestNestedCandidateScore(rawCandidate);
      const baseNet = getAiActionGraphBaseNet(graphCandidate);
      const usefulSetupScore = Math.max(0, aiNumber(nestedBestScore ?? baseNet));
      if (["scan", "playCard", "researchTech", "analyze", "placeData"].includes(actionId)) {
        const baseScale = actionId === "scan"
          ? 0.35
          : actionId === "playCard"
            ? 0.38
            : actionId === "researchTech"
              ? 0.45
              : 0.42;
        return usefulSetupScore > 0 ? baseScale : Math.min(0.7, baseScale + 0.18);
      }
      if (actionId === "quickTrade" && /恢复|分析|移动|能量|信用/.test(String(rawCandidate.reason || ""))) {
        return 0.55;
      }
      if (actionId === "cardCorner") return usefulSetupScore > 0 ? 0.58 : 0.8;
      if (actionId === "move") {
        const followupActionId = String(rawCandidate.followupMainAction?.actionId || "");
        const followupTiming = String(rawCandidate.followupMainAction?.timing || "");
        if (
          currentScore < 38
          && followupDirectScore >= 7
          && followupActionId === "land"
          && followupTiming === "immediate"
        ) {
          return 0.18;
        }
        return followupDirectScore > 0 ? 0.45 : 1;
      }
      return 1;
    }

    function getAiPlayerStyle(player = getCurrentPlayer()) {
      const style = String(player?.aiStyle || "");
      return AI_STYLE_IDS.includes(style) ? style : "balanced";
    }

    function getAiCandidateStyleActionId(rawCandidate = {}) {
      const actionId = String(rawCandidate.id || "");
      const planAction = String(rawCandidate.plan?.actionId || rawCandidate.followupMainAction?.actionId || "");
      if (actionId === "move" && planAction) return planAction;
      if (actionId === "cardCorner" && planAction) return planAction;
      if (actionId === "industry" && rawCandidate.abilityId === "stratus_public_corners") return "cardCorner";
      if (actionId === "industry" && rawCandidate.abilityId === "huanyu_free_moves") return "move";
      return actionId;
    }

    function getAiOpeningStyleMultiplier(rawCandidate = {}, player = getCurrentPlayer()) {
      const style = getAiPlayerStyle(player);
      const actionId = getAiCandidateStyleActionId(rawCandidate);
      const effectTypes = rawCandidate.effectTypes || [];
      const hasScanEffect = effectTypes.some((type) => isAiCardScanEffectType(type));
      const hasTaskPlan = rawCandidate.plan?.actionId === "task" || rawCandidate.plan?.type === "card-synergy";
      const tables = {
        scanner: {
          scan: 1.16,
          analyze: 1.12,
          placeData: 1.08,
          playCard: hasScanEffect ? 1.1 : 0.98,
          researchTech: 0.98,
          land: 0.96,
          orbit: 0.96,
        },
        route: {
          launch: 1.14,
          move: 1.1,
          land: 1.15,
          orbit: 1.13,
          playCard: rawCandidate.plan?.actionId === "launch" || rawCandidate.plan?.actionId === "land" ? 1.08 : 0.98,
          scan: 0.96,
        },
        task: {
          playCard: 1.16,
          cardCorner: 1.08,
          quickTrade: String(rawCandidate.tradeId || "").includes("card") ? 1.08 : 1,
          researchTech: 1.03,
          scan: hasScanEffect ? 1.04 : 0.98,
        },
        tech: {
          researchTech: 1.16,
          playCard: hasTaskPlan ? 1.04 : 1,
          scan: 0.98,
          analyze: 1.03,
          quickTrade: 1.04,
        },
        balanced: {
          playCard: 1.04,
          researchTech: 1.04,
          analyze: 1.03,
          land: 1.02,
          orbit: 1.02,
        },
      };
      return tables[style]?.[actionId] ?? 1;
    }

    function getAiFinalFormulaStyleMultiplier(rawCandidate = {}, markedFinalFormulas = []) {
      if (!Array.isArray(markedFinalFormulas) || !markedFinalFormulas.length) return 1;
      const actionId = getAiCandidateStyleActionId(rawCandidate);
      const formulas = new Set(markedFinalFormulas.map((entry) => String(entry?.formulaId || "")));
      let multiplier = 1;
      if ((formulas.has("c1") || formulas.has("c2")) && ["playCard", "cardCorner", "quickTrade"].includes(actionId)) {
        multiplier += actionId === "playCard" ? 0.12 : 0.05;
      }
      if ((formulas.has("d1") || formulas.has("d2")) && actionId === "researchTech") {
        multiplier += 0.12;
      }
      if (formulas.has("b2") && ["land", "orbit", "scan", "move"].includes(actionId)) {
        const b2Bottleneck = getAiB2SectorBottleneck(getCurrentPlayer(), { requireMarked: true });
        if (b2Bottleneck.active) {
          multiplier += actionId === "scan" ? 0.22 : actionId === "move" ? 0.04 : 0.06;
        } else {
          multiplier += actionId === "scan" ? 0.08 : 0.1;
        }
      }
      if (formulas.has("b1") && ["land", "scan", "analyze"].includes(actionId)) {
        multiplier += 0.07;
      }
      if ((formulas.has("a1") || formulas.has("a2")) && ["playCard", "quickTrade", "pass"].includes(actionId)) {
        multiplier += actionId === "pass" ? 0.04 : 0.06;
      }
      return multiplier;
    }

    function getAiCandidateDirectScoreForFinalMark(rawCandidate = {}) {
      return Math.max(
        0,
        aiNumber(rawCandidate.directScoreGain),
        aiNumber(rawCandidate.followupMainAction?.directScoreGain),
        aiNumber(rawCandidate.valueBreakdown?.directScoreGain),
        aiNumber(rawCandidate.valueBreakdown?.landingDirectScoreGain),
      );
    }

    function getAiMissingFinalMarkUrgencyMultiplier(rawCandidate = {}, player = getCurrentPlayer()) {
      if (!player || getAiRoundNumber() < 3) return 1;
      const threshold = getAiNextMissingFinalScoreThreshold(player);
      if (!threshold) return 1;
      const actionId = getAiCandidateStyleActionId(rawCandidate);
      if (!["scan", "analyze", "playCard", "researchTech", "land", "orbit", "move"].includes(actionId)) return 1;
      const directScoreGain = getAiCandidateDirectScoreForFinalMark(rawCandidate);
      if (directScoreGain <= 0) return 1;
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      const finalMarks = countAiFinalMarksForPlayer(player);
      let multiplier = 1;
      if (currentScore < threshold && currentScore + directScoreGain >= threshold) {
        multiplier += threshold >= 70 ? 0.22 : 0.17;
      } else if (getAiRoundNumber() >= FINAL_ROUND_NUMBER && currentScore < threshold) {
        multiplier += Math.min(0.1, directScoreGain * 0.018);
      }
      if (threshold >= 70 && finalMarks === 2 && ["land", "orbit", "move"].includes(actionId)) {
        multiplier += 0.06;
      }
      if (threshold <= 50 && finalMarks <= 1 && ["scan", "analyze", "playCard"].includes(actionId)) {
        multiplier += 0.06;
      }
      return multiplier;
    }

    function adjustAiActionGraphCandidateForStyle(rawCandidate = {}, graphCandidate = {}, player = getCurrentPlayer(), markedFinalFormulas = []) {
      if (!graphCandidate || rawCandidate.available === false) return graphCandidate;
      const styleMultiplier = getAiOpeningStyleMultiplier(rawCandidate, player);
      const finalFormulaMultiplier = getAiFinalFormulaStyleMultiplier(rawCandidate, markedFinalFormulas);
      const missingFinalMarkMultiplier = getAiMissingFinalMarkUrgencyMultiplier(rawCandidate, player);
      const multiplier = Math.max(0.86, Math.min(1.36, styleMultiplier * finalFormulaMultiplier * missingFinalMarkMultiplier));
      if (Math.abs(multiplier - 1) < 0.001) return graphCandidate;
      const currentNet = aiNumber(graphCandidate.net ?? graphCandidate.breakdown?.net);
      const adjustedNet = currentNet >= 0
        ? currentNet * multiplier
        : currentNet + Math.max(-2, Math.min(2, (multiplier - 1) * 6));
      return {
        ...graphCandidate,
        net: roundAiScore(adjustedNet),
        breakdown: {
          ...(graphCandidate.breakdown || {}),
          aiStyle: getAiPlayerStyle(player),
          aiStyleMultiplier: roundAiScore(styleMultiplier),
          finalFormulaStyleMultiplier: roundAiScore(finalFormulaMultiplier),
          missingFinalMarkMultiplier: roundAiScore(missingFinalMarkMultiplier),
          netBeforeStyle: roundAiScore(currentNet),
          net: roundAiScore(adjustedNet),
        },
      };
    }

    function getAiTerminalResearchGoalBonusScale(options = {}) {
      if (options.actionId !== "researchTech") return 1;
      if (Math.max(1, Math.round(aiNumber(options.roundNumber) || 1)) < FINAL_ROUND_NUMBER) return 1;
      if (Math.max(0, Math.round(aiNumber(options.finalMarkCount))) < 3) return 1;
      if (options.nextThreshold) return 1;
      if (Math.max(0, aiNumber(options.directScoreGain)) > 0) return 1;
      return 0.35;
    }

    function adjustAiActionGraphCandidate(rawCandidate = {}, graphCandidate = {}, player = getCurrentPlayer()) {
      const actionId = String(rawCandidate.id || graphCandidate.id || "");
      const round = getAiRoundNumber();
      const deficit = getAiLiveScorePaceDeficit(player);
      const currentScore = Math.max(0, aiNumber(player?.resources?.score));
      const finalMarks = countAiFinalMarksForPlayer(player);
      const nextThreshold = getAiNextMissingFinalScoreThreshold(player);
      const directScoreGain = Math.max(0, aiNumber(rawCandidate.directScoreGain));
      const terminalResearchGoalBonusScale = getAiTerminalResearchGoalBonusScale({
        actionId,
        roundNumber: round,
        finalMarkCount: finalMarks,
        nextThreshold,
        directScoreGain,
      });
      const hasWeakFinalAnalyzeEnergyCap = actionId === "scan"
        && rawCandidate.valueBreakdown?.weakFinalAnalyzeEnergyCap !== null
        && rawCandidate.valueBreakdown?.weakFinalAnalyzeEnergyCap !== undefined;
      if (
        round > FINAL_ROUND_NUMBER
        || (deficit <= 0 && !hasWeakFinalAnalyzeEnergyCap && terminalResearchGoalBonusScale >= 1)
      ) return graphCandidate;
      const broadGoalActions = new Set(["playCard", "researchTech", "scan"]);
      const rawMissingFinalMarkPenalty = aiNumber(
        graphCandidate.missingFinalMarkPenalty ?? graphCandidate.breakdown?.missingFinalMarkPenalty,
      );
      const missingPenaltyScale = getAiFinalRoundProgressPenaltyScale(actionId, rawCandidate, graphCandidate, player);
      const graphMissingFinalMarkPenalty = rawMissingFinalMarkPenalty * missingPenaltyScale;
      const hasMissingPenaltyAdjustment = rawMissingFinalMarkPenalty > 0
        && Math.abs(missingPenaltyScale - 1) > 0.001;
      const lateNoDirectPenalty = graphMissingFinalMarkPenalty > 0
        ? 0
        : scoreAiLateMissingFinalMarkNoDirectPenalty(rawCandidate, player);
      if (!broadGoalActions.has(actionId) && lateNoDirectPenalty <= 0 && !hasMissingPenaltyAdjustment) return graphCandidate;

      const baseNet = getAiActionGraphBaseNet(graphCandidate);
      const goalBonus = aiNumber(graphCandidate.goalBonus ?? graphCandidate.breakdown?.goalBonus);
      if (!goalBonus && lateNoDirectPenalty <= 0 && !hasMissingPenaltyAdjustment) return graphCandidate;

      const nestedBestScore = getAiBestNestedCandidateScore(rawCandidate);
      const effectiveBase = nestedBestScore == null
        ? baseNet
        : Math.min(baseNet, nestedBestScore);
      let goalBonusScale = 1;
      let urgencyPenalty = 0;

      goalBonusScale = Math.min(goalBonusScale, terminalResearchGoalBonusScale);

      if (actionId === "scan" && rawCandidate.scoreCapReason) {
        goalBonusScale = Math.min(goalBonusScale, 0.2);
        urgencyPenalty += Math.min(5, goalBonus * 0.2);
      }
      if (actionId === "scan") {
        const directScoreGain = Math.max(0, aiNumber(rawCandidate.directScoreGain));
        const placedCount = Math.max(0, (data.listComputerPlacedTokens?.(player) || []).length);
        const scanCountThisRound = countAiStandardScansThisRound(player);
        const canOpenAnalyze = placedCount >= (data.ANALYZE_REQUIRED_COMPUTER_SLOT || 6) - 1;
        if (directScoreGain <= 0 && !canOpenAnalyze) {
          goalBonusScale = Math.min(goalBonusScale, round <= 2 ? 0.38 : 0.22);
          urgencyPenalty += Math.min(16, goalBonus * (round <= 2 ? 0.34 : 0.52) + scanCountThisRound * 3.5);
        } else if (scanCountThisRound >= 1 && directScoreGain < 3) {
          goalBonusScale = Math.min(goalBonusScale, 0.5);
          urgencyPenalty += Math.min(10, goalBonus * 0.25 + scanCountThisRound * 2.5);
        }
      }

      if (effectiveBase < 0) {
        goalBonusScale = Math.min(goalBonusScale, actionId === "scan" ? 0.35 : 0.15);
        urgencyPenalty += Math.min(10, Math.abs(effectiveBase) * 0.75 + deficit * 0.08);
      } else if (effectiveBase < 4 && deficit > 20) {
        goalBonusScale = Math.min(goalBonusScale, actionId === "scan" ? 0.65 : 0.35);
        urgencyPenalty += Math.min(6, (4 - effectiveBase) * 0.8 + deficit * 0.04);
      } else if (effectiveBase < 8 && deficit > 35) {
        goalBonusScale = Math.min(goalBonusScale, actionId === "scan" ? 0.85 : 0.65);
        urgencyPenalty += Math.min(4, (8 - effectiveBase) * 0.35);
      }

      if (
        round >= FINAL_ROUND_NUMBER
        && nextThreshold
        && currentScore < nextThreshold
        && ["scan", "playCard", "researchTech"].includes(actionId)
      ) {
        goalBonusScale = Math.max(goalBonusScale, actionId === "scan" ? 0.35 : 0.32);
      }
      if (
        actionId === "researchTech"
        && round >= FINAL_ROUND_NUMBER
        && nextThreshold === 50
        && finalMarks <= 1
        && currentScore + directScoreGain < nextThreshold
      ) {
        goalBonusScale = Math.min(goalBonusScale, 0.45);
        urgencyPenalty += Math.min(8, Math.max(0, nextThreshold - currentScore) * 0.35 + goalBonus * 0.18);
      }
      if (
        actionId === "scan"
        && round >= FINAL_ROUND_NUMBER
        && nextThreshold === 50
        && finalMarks <= 1
        && currentScore < 45
        && currentScore + directScoreGain < nextThreshold
      ) {
        goalBonusScale = Math.min(goalBonusScale, 0.42);
        urgencyPenalty += Math.min(12, Math.max(0, nextThreshold - currentScore) * 0.22 + goalBonus * 0.22);
      }
      if (
        round >= FINAL_ROUND_NUMBER
        && nextThreshold
        && currentScore < nextThreshold
        && ["scan", "playCard", "researchTech"].includes(actionId)
      ) {
        urgencyPenalty = Math.min(urgencyPenalty, actionId === "scan" ? 7 : 8);
      }

      if (goalBonusScale >= 1 && urgencyPenalty <= 0 && lateNoDirectPenalty <= 0) return graphCandidate;

      const finalMarginal = aiNumber(graphCandidate.finalMarginal ?? graphCandidate.breakdown?.finalMarginal);
      const finalMarkCashout = aiNumber(graphCandidate.finalMarkCashout ?? graphCandidate.breakdown?.finalMarkCashout);
      const feasibility = Math.min(1, Math.max(0, aiNumber(graphCandidate.feasibility ?? graphCandidate.breakdown?.feasibility ?? 1)));
      const adjustedGoalBonus = goalBonus * goalBonusScale;
      const adjustedNet = (
        baseNet
        + finalMarginal
        + finalMarkCashout
        + adjustedGoalBonus
        - graphMissingFinalMarkPenalty
        - urgencyPenalty
        - lateNoDirectPenalty
      ) * feasibility;
      return {
        ...graphCandidate,
        goalBonus: roundAiScore(adjustedGoalBonus),
        net: roundAiScore(adjustedNet),
        breakdown: {
          ...(graphCandidate.breakdown || {}),
          goalBonusUnadjusted: roundAiScore(goalBonus),
          goalBonusScale: roundAiScore(goalBonusScale),
          finalMarkCashout: roundAiScore(finalMarkCashout),
          missingFinalMarkPenalty: roundAiScore(graphMissingFinalMarkPenalty),
          missingFinalMarkPenaltyUnadjusted: roundAiScore(rawMissingFinalMarkPenalty),
          missingFinalMarkPenaltyScale: roundAiScore(missingPenaltyScale),
          urgencyPenalty: roundAiScore(urgencyPenalty),
          lateNoDirectPenalty: roundAiScore(lateNoDirectPenalty),
          net: roundAiScore(adjustedNet),
        },
      };
    }

    function getAiEarlyEnginePressure(player = getCurrentPlayer()) {
      const round = getAiRoundNumber();
      let pressure = round <= 1 ? 1.45 : round === 2 ? 1.2 : round === 3 ? 0.75 : 0.25;
      const resources = player?.resources || {};
      if (aiNumber(resources.credits) <= 1) pressure += 0.18;
      if (aiNumber(resources.energy) <= 1) pressure += 0.18;
      if (Math.max(0, Math.round(aiNumber(resources.score))) < 25) pressure += 0.12;
      return Math.max(0, pressure);
    }

    function addAiIncomeGain(income = {}, gain = {}) {
      return {
        ...income,
        credits: aiNumber(income.credits) + aiNumber(gain.credits),
        energy: aiNumber(income.energy) + aiNumber(gain.energy),
        handSize: aiNumber(income.handSize) + aiNumber(gain.handSize),
      };
    }

    function getAiIncomeIncreaseSnapshot(player = getCurrentPlayer(), incomeOverride = null) {
      const income = incomeOverride || player?.income || {};
      const baseIncome = getAiPlayerCompanyBaseIncome(player);
      return {
        credits: Math.max(0, aiNumber(income.credits) - Math.min(aiNumber(income.credits), aiNumber(baseIncome.credits))),
        energy: Math.max(0, aiNumber(income.energy) - Math.min(aiNumber(income.energy), aiNumber(baseIncome.energy))),
        handSize: Math.max(0, aiNumber(income.handSize) - Math.min(aiNumber(income.handSize), aiNumber(baseIncome.handSize))),
      };
    }

    function getAiIncomeFormulaBase(formulaId, income = {}, player = null) {
      const formulaIncome = player ? getAiIncomeIncreaseSnapshot(player, income) : income;
      if (formulaId === "a1") {
        return Math.max(aiNumber(formulaIncome.credits), aiNumber(formulaIncome.energy));
      }
      if (formulaId === "a2") {
        return Math.min(
          aiNumber(formulaIncome.credits),
          aiNumber(formulaIncome.energy),
          aiNumber(formulaIncome.handSize),
        );
      }
      return 0;
    }

    function scoreAiMarkedIncomeFinalValue(player = getCurrentPlayer(), incomeGain = {}) {
      if (!player || !incomeGain || typeof incomeGain !== "object") return 0;
      const incomeFormulas = getAiIncomeFinalFormulaEntries(player);
      if (!incomeFormulas.length) return 0;

      const beforeIncome = player.income || {};
      const afterIncome = addAiIncomeGain(beforeIncome, incomeGain);
      return incomeFormulas.reduce((total, entry) => {
        const multiplier = Math.max(1, aiNumber(entry.multiplier));
        const beforeBase = getAiIncomeFormulaBase(entry.formulaId, beforeIncome, player);
        const afterBase = getAiIncomeFormulaBase(entry.formulaId, afterIncome, player);
        const immediateValue = Math.max(0, afterBase - beforeBase) * multiplier;
        const immediateWeight = entry.potential ? 0.55 : 0.95;
        if (entry.formulaId === "a1") return total + immediateValue * (entry.potential ? 0.45 : 0.85);
        if (immediateValue > 0) return total + immediateValue * immediateWeight;

        const incomeKeys = ["credits", "energy", "handSize"];
        const formulaIncome = getAiIncomeIncreaseSnapshot(player, beforeIncome);
        const bottleneckKeys = incomeKeys.filter((key) => aiNumber(formulaIncome[key]) <= beforeBase);
        const liftedBottlenecks = bottleneckKeys.filter((key) => aiNumber(incomeGain[key]) > 0);
        if (!liftedBottlenecks.length) return total;
        const setupWeight = entry.potential
          ? (getAiRoundNumber() >= 3 ? 0.72 : 0.36)
          : (getAiRoundNumber() >= 3 ? 0.34 : 0.22);
        return total + multiplier * setupWeight * Math.min(1, liftedBottlenecks.length / Math.max(1, bottleneckKeys.length));
      }, 0);
    }

    function scoreAiHandIncomeEngineBacklogValue(player = getCurrentPlayer(), incomeGain = {}) {
      if (!player || aiNumber(incomeGain?.handSize) <= 0) return 0;
      const round = getAiRoundNumber();
      const income = player.income || {};
      const resources = player.resources || {};
      const currentHandIncome = Math.max(0, aiNumber(income.handSize));
      if (currentHandIncome >= 4) return 0;

      const handCount = Math.max(0, (player.hand || []).length);
      const handEngineCards = countAiHandEngineCards(player);
      const handTaskCards = countAiHandTaskCards(player);
      const uncompletedTaskCount = listAiUncompletedCardTasksForPlayer(player).length;
      const completedTasks = Math.max(0, Math.round(aiNumber(player.completedTaskCount)));
      const cEntries = getAiPlanningFinalFormulaEntries(player, ["c1", "c2"]);
      const dEntries = getAiPlanningFinalFormulaEntries(player, ["d1", "d2"]);
      const techCount = countAiPlayerTech(player);
      const hasEngineBacklog = handEngineCards >= 2
        || handTaskCards > 0
        || uncompletedTaskCount > 0
        || (cEntries.length > 0 && completedTasks <= 2)
        || (dEntries.length > 0 && techCount < 9);
      if (!hasEngineBacklog) return 0;

      let value = 0;
      value += Math.max(0, 3 - currentHandIncome) * (round <= 2 ? 1.7 : round === 3 ? 1.15 : 0.55);
      value += Math.max(0, 3 - handCount) * (round <= 2 ? 0.95 : 0.6);
      value += Math.min(4.5, handEngineCards * 0.72 + handTaskCards * 1.05 + uncompletedTaskCount * 0.8);
      if (cEntries.length && completedTasks <= 1) value += round >= 3 ? 1.8 : 1.2;
      if (dEntries.length && techCount < 8) value += Math.min(2.5, Math.max(0, 8 - techCount) * 0.45);
      if (round <= 2 && Math.max(0, aiNumber(resources.score)) < 25) value += 0.9;
      if (currentHandIncome >= 3) value *= 0.45;
      if (round >= FINAL_ROUND_NUMBER) value *= 0.55;
      return roundAiScore(Math.min(7.5, Math.max(0, value)));
    }

    function scoreAiIncomeOpportunityValue(player = getCurrentPlayer(), incomeGain = { credits: 1 }) {
      const gain = incomeGain && typeof incomeGain === "object" ? incomeGain : { credits: 1 };
      const netValue = ai?.valuation?.getIncomeNetValue
        ? ai.valuation.getIncomeNetValue(gain, {
          roundNumber: getAiRoundNumber(),
          finalRoundNumber: FINAL_ROUND_NUMBER,
          hand: player?.hand || [],
          resourceValues: getAiResourceValuesForRound(),
        })
        : scoreAiResourceBundle(gain) * getAiRemainingRoundWeight();
      const remainingIncomeUses = ai?.valuation?.getRemainingIncomeMultiplier
        ? ai.valuation.getRemainingIncomeMultiplier(getAiRoundNumber(), { finalRoundNumber: FINAL_ROUND_NUMBER })
        : getAiRemainingRoundWeight();
      const incomeUseScale = remainingIncomeUses > 0 ? 1 : 0;
      const earlyPressure = getAiEarlyEnginePressure(player);
      const resources = player?.resources || {};
      const income = player?.income || {};
      const incomeFormulaEntries = getAiIncomeFinalFormulaEntries(player);
      const strategicIncomeFit = ai?.valuation?.estimateIncomeStrategicAdjustment
        ? ai.valuation.estimateIncomeStrategicAdjustment(gain, {
          roundNumber: getAiRoundNumber(),
          finalRoundNumber: FINAL_ROUND_NUMBER,
          currentIncome: income,
          currentResources: resources,
          player,
          hasIncomeFinalFormula: incomeFormulaEntries.length > 0,
          hasA2FinalFormula: incomeFormulaEntries.some((entry) => entry.formulaId === "a2"),
          resourceValues: getAiResourceValuesForRound(),
        }) * incomeUseScale
        : 0;
      const creditNeed = aiNumber(gain.credits) > 0
        ? (
          Math.max(0, 5 - aiNumber(resources.credits)) * (getAiRoundNumber() <= 2 ? 1.25 : 0.42)
          + Math.max(0, 4 - aiNumber(income.credits)) * (getAiRoundNumber() <= 2 ? 1.15 : 0.35)
        ) * incomeUseScale
        : 0;
      const energyNeed = aiNumber(gain.energy) > 0
        ? Math.max(0, 3 - aiNumber(resources.energy)) * (getAiRoundNumber() <= 2 ? 0.95 : 0.7) * incomeUseScale
        : 0;
      const handNeed = aiNumber(gain.handSize) > 0
        ? (
          Math.max(0, 4 - aiNumber(resources.handSize)) * (getAiRoundNumber() <= 2 ? 0.75 : 0.55)
          + Math.max(0, 2 - aiNumber(income.handSize)) * (getAiRoundNumber() <= 2 ? 1.7 : 0.9)
          + Math.max(0, 2 - (player?.hand || []).length) * 0.9
        ) * incomeUseScale
        : 0;
      const energyIncomeBalance = aiNumber(gain.energy) > 0
        ? Math.max(0, Math.max(aiNumber(income.credits), aiNumber(income.handSize)) - aiNumber(income.energy))
          * (getAiRoundNumber() <= 2 ? 0.7 : 0.35) * incomeUseScale
        : 0;
      const handIncomeBalance = aiNumber(gain.handSize) > 0
        ? Math.max(0, Math.min(2, Math.max(aiNumber(income.credits), aiNumber(income.energy))) - aiNumber(income.handSize))
          * (getAiRoundNumber() <= 2 ? 0.75 : 0.45) * incomeUseScale
        : 0;
      const handIncomeEngineBacklogValue = scoreAiHandIncomeEngineBacklogValue(player, gain) * incomeUseScale;
      const rawHandIncomeOversupplyPenalty = aiNumber(gain.handSize) > 0
        ? Math.max(0, aiNumber(income.handSize) - 1)
          * (getAiRoundNumber() <= 2 ? 5.5 : getAiRoundNumber() === 3 ? 2.4 : 0.8)
          * incomeUseScale
        : 0;
      const handIncomeOversupplyPenalty = Math.max(
        0,
        rawHandIncomeOversupplyPenalty - handIncomeEngineBacklogValue * 0.72,
      );
      const creditSurplusPenalty = aiNumber(gain.credits) > 0
        ? Math.max(
          Math.max(0, aiNumber(resources.credits) - Math.max(aiNumber(resources.energy), aiNumber(resources.handSize)) - 3)
            * (getAiRoundNumber() <= 2 ? 0.8 : 0.35),
          Math.max(0, aiNumber(income.credits) - Math.max(aiNumber(income.energy), aiNumber(income.handSize)) - 1)
            * (getAiRoundNumber() <= 2 ? 1.05 : 0.45),
        )
        : 0;
      const earlyIncomeTargetBonus = getAiRoundNumber() <= 1
        ? Math.min(4, scoreAiResourceBundle(gain) * 0.45 + earlyPressure * 1.2) * incomeUseScale
        : getAiRoundNumber() === 2
          ? Math.min(2.5, scoreAiResourceBundle(gain) * 0.28 + earlyPressure * 0.6) * incomeUseScale
          : 0;
      const banrenmaEnergyPlanValue = scoreAiBanrenmaEnergyIncomeValue(player, gain) * incomeUseScale;
      const markedFinalValue = scoreAiMarkedIncomeFinalValue(player, gain);
      return Math.max(
        0,
        netValue
          + creditNeed
          + energyNeed
          + handNeed
          + energyIncomeBalance
          + handIncomeBalance
          + handIncomeEngineBacklogValue
          + earlyIncomeTargetBonus
          + banrenmaEnergyPlanValue
          + markedFinalValue
          + strategicIncomeFit
          - creditSurplusPenalty
          - handIncomeOversupplyPenalty,
      );
    }

    function scoreAiPlacementBonusValue(bonus, player = getCurrentPlayer()) {
      if (!bonus) return 0;
      switch (bonus.type) {
        case "income":
          return scoreAiIncomeOpportunityValue(player, bonus.gain || bonus.income || { credits: 1 });
        case "publicity":
          return scoreAiResourceBundle({ publicity: bonus.publicity || 1 })
            + scoreAiMidgameResourceContinuationValue({ publicity: bonus.publicity || 1 }, player, { scale: 0.55 })
            + scoreAiPublicityResearchTechSetupValue({ publicity: bonus.publicity || 1 }, player, { scale: 0.7 });
        case "score":
          return scoreAiResourceBundle({ score: bonus.score || 1 })
            + scoreAiThresholdPressureForScoreGain(bonus.score || 1, player);
        case "credits":
          return scoreAiResourceBundle({ credits: bonus.credits || 1 })
            + scoreAiMidgameResourceContinuationValue({ credits: bonus.credits || 1 }, player, { scale: 0.75 });
        case "energy":
          return scoreAiResourceBundle({ energy: bonus.energy || 1 })
            + scoreAiMidgameResourceContinuationValue({ energy: bonus.energy || 1 }, player, { scale: 0.85 });
        case "choose_card":
          return getAiResourceValuesForRound().handSize + 1.4
            + Math.max(0, 3 - (player?.hand || []).length) * 0.45
            + scoreAiMidgameResourceContinuationValue({ handSize: 1, cardSelection: 1 }, player, { scale: 0.45 });
        default:
          return 0;
      }
    }

    function getAiDataPlacementBonuses(choice, player = getCurrentPlayer()) {
      if (!choice) return [];
      const target = choice.target || null;
      if (target === data.PLACEMENT_KIND_COMPUTER) {
        const placementSlot = Math.max(0, Math.round(aiNumber(choice.placementSlot)));
        return [
          data.getComputerSlotBonus?.(placementSlot),
          data.getComputerSlotBlueColumnBonus?.(player, placementSlot),
        ].filter(Boolean);
      }
      if (target === data.PLACEMENT_KIND_BLUE_BONUS) {
        return [data.getBlueBonusPlacementReward?.(player, choice.blueSlot)].filter(Boolean);
      }
      return [];
    }

    function scoreAiDataPlacementBonusValue(choice, player = getCurrentPlayer()) {
      return getAiDataPlacementBonuses(choice, player)
        .reduce((total, bonus) => total + scoreAiPlacementBonusValue(bonus, player), 0);
    }

    function scoreAiFinalThresholdIncomePlacementPenalty(choice, player = getCurrentPlayer()) {
      if (!player) return 0;
      const bonuses = getAiDataPlacementBonuses(choice, player);
      if (!bonuses.some((bonus) => bonus?.type === "income")) return 0;
      const resources = player.resources || {};
      const handSize = Math.max(0, Math.round(aiNumber(resources.handSize)));
      if (handSize <= 0) return 8;
      if (getAiRoundNumber() < FINAL_ROUND_NUMBER || handSize > 1) return 0;
      const currentScore = Math.max(0, aiNumber(resources.score));
      const nextThreshold = getAiNextMissingFinalScoreThreshold(player);
      if (!nextThreshold || currentScore >= nextThreshold || nextThreshold > 70) return 0;
      const scoreToThreshold = Math.max(1, nextThreshold - currentScore);
      if (scoreToThreshold > 3) return 0;
      const credits = Math.max(0, aiNumber(resources.credits));
      const creditToPlayRemainingHand = credits >= 1 ? 4 : 0;
      return Math.min(
        36,
        (nextThreshold <= 50 ? 22 : 17)
          + Math.max(0, 4 - scoreToThreshold) * (nextThreshold <= 50 ? 2.8 : 1.8)
          + creditToPlayRemainingHand,
      );
    }

    function scoreAiLateIncomePlacementDiscardPenalty(choice, player = getCurrentPlayer()) {
      if (!player || getAiRoundNumber() < FINAL_ROUND_NUMBER || !state.pendingActionExecuted) return 0;
      if (normalizeAiDifficulty(player?.aiDifficulty || aiAutoBattleState.aiDifficulty) !== AI_DIFFICULTY_WEAK_START) return 0;
      const bonuses = getAiDataPlacementBonuses(choice, player);
      if (!bonuses.some((bonus) => bonus?.type === "income")) return 0;
      const resources = player.resources || {};
      const handSize = Math.max(0, Math.round(aiNumber(resources.handSize ?? player.hand?.length)));
      if (handSize > 1) return 0;
      const incomeNet = scoreAiIncomePlacementRewardValue(player);
      if (incomeNet >= 0) return 0;
      const credits = Math.max(0, aiNumber(resources.credits));
      const energy = Math.max(0, aiNumber(resources.energy));
      const resourceLockPenalty = credits <= 0 && energy <= 0 ? 3 : 0;
      return roundAiScore(Math.min(22, Math.abs(incomeNet) * 0.55 + 4 + resourceLockPenalty));
    }

    function getAiDataPlacementDirectScoreGainFromBonus(bonus) {
      if (!bonus || bonus.type !== "score") return 0;
      return Math.max(0, aiNumber(bonus.score || 1));
    }

    function getAiDataPlacementDirectScoreGain(choice, player = getCurrentPlayer()) {
      if (!choice) return 0;
      return getAiDataPlacementBonuses(choice, player)
        .reduce((total, bonus) => total + getAiDataPlacementDirectScoreGainFromBonus(bonus), 0);
    }

    function scoreAiDataEngineProgressValue(placementSlot, player = getCurrentPlayer()) {
      const slot = Math.max(0, Math.round(aiNumber(placementSlot)));
      if (!slot) return 0;
      const pressure = getAiEarlyEnginePressure(player);
      const round = getAiRoundNumber();
      const requiredSlot = data.ANALYZE_REQUIRED_COMPUTER_SLOT || 6;
      const currentScore = Math.max(0, aiNumber(player?.resources?.score));
      const catchupEngine = currentScore < 50
        || countAiFinalMarksForPlayer(player) < 2
        || getAiLiveScorePaceDeficit(player) > 18;
      if (slot < 4) {
        return pressure * Math.max(0.4, 1.25 - slot * 0.2);
      }
      if (slot === 4) {
        return pressure * 0.75;
      }
      if (slot <= requiredSlot) {
        const resources = player?.resources || {};
        const demand = getAiStrategyDemand(player);
        const canPayAnalyze = aiNumber(resources.energy) >= getAiAnalyzeEnergyCost(player);
        const rawCloseAnalyzeBonus = Math.min(
          5.5,
          (slot === requiredSlot ? 2.8 : 1.4)
            + (round <= 3 ? 1.1 : 0.35)
            + (canPayAnalyze ? 1.1 : 0)
            + getAiMapDemand(demand.actions, "analyze") * 0.045
            + getAiMapDemand(demand.traceTypes, "blue") * 0.04,
        );
        const closeAnalyzeBonus = catchupEngine ? rawCloseAnalyzeBonus : 0;
        return pressure * 0.8 + closeAnalyzeBonus;
      }
      return 0;
    }

    function scoreAiEarlyScanEngineValue(player = getCurrentPlayer()) {
      const round = getAiRoundNumber();
      const pressure = getAiEarlyEnginePressure(player);
      if (round > 3 && pressure < 0.5) return 0;
      const placedComputerCount = Math.max(0, (data.listComputerPlacedTokens?.(player) || []).length);
      const dataRoom = getAiAvailableDataRoom(player);
      let value = pressure * 2.8;
      if (placedComputerCount < 4) value += Math.max(0, 4 - placedComputerCount) * 0.45 * pressure;
      if (dataRoom > 0) value += Math.min(1.4, dataRoom * 0.24) * Math.max(0.6, pressure);
      if (countAiFinalMarksForPlayer(player) === 0) value += pressure * 0.65;
      if (placedComputerCount >= 4) value *= round <= 2 ? 0.4 : 0.24;
      return value;
    }

    function countAiTraceMarkersForPlayer(player = getCurrentPlayer()) {
      if (!endGameScoring?.countTraceMarkers || !player) return 0;
      return AI_TRACE_TYPES.reduce((total, traceType) => (
        total + Math.max(0, Math.round(aiNumber(endGameScoring.countTraceMarkers(player, alienGameState, traceType))))
      ), 0);
    }

    function getAiB1TraceCounts(player = getCurrentPlayer()) {
      const counts = {};
      for (const traceType of AI_TRACE_TYPES) {
        counts[traceType] = endGameScoring?.countTraceMarkers && player
          ? Math.max(0, Math.round(aiNumber(endGameScoring.countTraceMarkers(player, alienGameState, traceType))))
          : 0;
      }
      return counts;
    }

    function addAiB1TraceDemand(demand, amount, player = getCurrentPlayer()) {
      if (!demand || !demand.traceTypes) return;
      void player;
      addAiAllTraceDemand(demand, amount);
    }

    function scoreAiB1TraceMarginalValue(player, traceType) {
      const entries = getAiMarkedFinalFormulaEntries(player)
        .filter((entry) => entry.formulaId === "b1");
      const finalTraceFocus = getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && countAiFinalMarksForPlayer(player) >= 3;
      if (!player || !traceType || !entries.length || !AI_TRACE_TYPES.includes(traceType) || !finalTraceFocus) {
        return {
          score: 0,
          counts: null,
          currentBase: 0,
          nextBase: 0,
          multiplier: 0,
          directMarginal: 0,
          potentialValue: 0,
          surplusPenalty: 0,
        };
      }
      const counts = getAiB1TraceCounts(player);
      const currentBase = Math.min(...AI_TRACE_TYPES.map((type) => counts[type]));
      const afterCounts = { ...counts, [traceType]: counts[traceType] + 1 };
      const nextBase = Math.min(...AI_TRACE_TYPES.map((type) => afterCounts[type]));
      const multiplier = entries.reduce((total, entry) => total + Math.max(0, aiNumber(entry.multiplier)), 0);
      const directMarginal = Math.max(0, nextBase - currentBase) * multiplier;
      const traceCount = counts[traceType];
      const isBottleneck = traceCount <= currentBase;
      const round = getAiRoundNumber();
      const potentialValue = directMarginal > 0
        ? 0
        : isBottleneck
          ? Math.min(2.4, multiplier * 0.28)
          : traceCount === currentBase + 1
            ? Math.min(1.4, multiplier * 0.1)
            : 0;
      const surplus = Math.max(0, traceCount - currentBase);
      const surplusPenalty = directMarginal > 0
        ? 0
        : Math.min(2, Math.max(0, surplus - 1) * multiplier * 0.06);
      return {
        score: roundAiScore(directMarginal * 0.72 + potentialValue - surplusPenalty),
        counts,
        currentBase,
        nextBase,
        multiplier: roundAiScore(multiplier),
        directMarginal: roundAiScore(directMarginal),
        potentialValue: roundAiScore(potentialValue),
        surplusPenalty: roundAiScore(surplusPenalty),
      };
    }

    function isAiFirstTraceTakenByOpponent(alienSlotId, traceType, player = getCurrentPlayer()) {
      if (!traceType || alienSlotId == null) return false;
      const slot = aliens?.getAlienSlot?.(alienGameState, alienSlotId);
      const traceSlot = slot?.traces?.[traceType];
      return Boolean(
        slot
        && traceSlot?.firstPlaced
        && !aiMarkerBelongsToPlayer(traceSlot, player)
      );
    }

    function isAiHiddenFirstTraceTakenByOpponent(alienSlotId, traceType, player = getCurrentPlayer()) {
      const slot = aliens?.getAlienSlot?.(alienGameState, alienSlotId);
      return Boolean(slot && !slot.revealed && isAiFirstTraceTakenByOpponent(alienSlotId, traceType, player));
    }

    function isAiOpenHiddenFirstTraceTarget(alienSlotId, traceType) {
      if (!traceType || alienSlotId == null) return false;
      const slot = aliens?.getAlienSlot?.(alienGameState, alienSlotId);
      const traceSlot = slot?.traces?.[traceType];
      return Boolean(slot && !slot.revealed && traceSlot && !traceSlot.firstPlaced);
    }

    function getAiHiddenFirstTraceColorStatus(traceType, player = getCurrentPlayer()) {
      const status = { open: 0, own: 0, opponent: 0 };
      if (!traceType) return status;
      for (const slot of Object.values(alienGameState?.aliens || {})) {
        const traceSlot = slot?.traces?.[traceType];
        if (!slot || slot.revealed || !traceSlot) continue;
        if (!traceSlot.firstPlaced) {
          status.open += 1;
        } else if (aiMarkerBelongsToPlayer(traceSlot, player)) {
          status.own += 1;
        } else {
          status.opponent += 1;
        }
      }
      return status;
    }

    function isAiHiddenFirstTraceColorLost(traceType, player = getCurrentPlayer()) {
      const status = getAiHiddenFirstTraceColorStatus(traceType, player);
      return status.opponent > 0 && status.own <= 0;
    }

    function getAiAlienSlot(alienSlotId) {
      if (alienSlotId == null) return null;
      return aliens?.getAlienSlot?.(alienGameState, alienSlotId)
        || alienGameState?.aliens?.[String(alienSlotId)]
        || alienGameState?.aliens?.[Number(alienSlotId)]
        || null;
    }

    function getAiAlienCardConversionMultiplier(player = getCurrentPlayer()) {
      const round = getAiRoundNumber();
      const handCount = Math.max(
        0,
        aiNumber(player?.hand?.length ?? player?.resources?.handSize),
      );
      let multiplier = round <= 2 ? 1.18 : round === 3 ? 0.82 : 0.36;
      if (round >= FINAL_ROUND_NUMBER && handCount > 4) {
        multiplier -= Math.min(0.1, (handCount - 4) * 0.025);
      }
      return Math.max(0.26, Math.min(1.25, multiplier));
    }

    function getAiAlienCardExpectedValue(player = getCurrentPlayer(), options = {}) {
      const baseValue = 5.5 * getAiAlienCardConversionMultiplier(player);
      if (options.hiddenFirstTrace && getAiRoundNumber() <= 2) return baseValue + 1.2;
      if (options.hiddenFirstTrace && getAiRoundNumber() === 3) return baseValue + 0.4;
      return baseValue;
    }

    function scoreAiLateAlienCardConversionPenalty(player = getCurrentPlayer()) {
      const multiplier = getAiAlienCardConversionMultiplier(player);
      return Math.max(0, (1 - multiplier) * 12);
    }

    function scoreAiHiddenAlienRevealTimingPremium(alienSlotId, placedCount, player = getCurrentPlayer()) {
      const slot = getAiAlienSlot(alienSlotId);
      if (!slot || slot.revealed) return 0;
      const round = getAiRoundNumber();
      const placed = Math.max(0, Math.min(3, Math.round(aiNumber(placedCount))));
      let value = 0;

      // 两个隐藏槽位的揭示进度价值相同；槽位差异只来自 state 图真实即时奖励。
      // 0 进度不再给 2 号槽历史加速，因而由 1 号的 5 分对 2 号的 3 分打破平局。
      // 已投入 1/2 枚首痕迹后，保留旧模型经实战形成的揭示链量级，但改成槽位无关。
      if (round <= 2) {
        if (placed >= 2) value += 12.5;
        else if (placed === 1) value += 5.2;
      } else if (round === 3) {
        if (placed >= 2) value += 10.8;
        else if (placed === 1) value += 3.1;
      } else if (placed >= 2) {
        value += 2;
      }
      if (round >= FINAL_ROUND_NUMBER && placed <= 1) value -= 2;
      return roundAiScore(value);
    }

    function scoreAiAlienTraceValue(options = {}) {
      const picker = state.alienTracePickerState || {};
      const traceType = options.traceType || picker.selectedTraceType || picker.allowedTraceTypes?.[0];
      const alienSlotId = options.alienSlotId ?? picker.selectedAlienSlotId;
      const player = options.player || getCurrentPlayer();
      const mode = String(options.mode || picker.mode || "");
      const value = ai?.valuation?.estimateAlienTraceValue
        ? ai.valuation.estimateAlienTraceValue({
          alienGameState,
          player,
          traceType,
          alienSlotId,
          mode,
          position: options.position,
          label: options.label,
          reward: options.reward,
          jiuzheThreatContext: mode.includes("jiuzhe")
            ? getAiJiuzheThreatValuationContext(player)
            : null,
          alienCardExpectedValue: getAiAlienCardExpectedValue(player, {
            hiddenFirstTrace: true,
            alienSlotId,
          }),
          activeOpponentCount: getAiActiveOpponentCount(player),
          competition: true,
        })
        : 5;
      const slot = getAiAlienSlot(alienSlotId);
      const traceSlot = traceType && slot?.traces ? slot.traces[traceType] : null;
      if (slot && !slot.revealed && traceType && !traceSlot?.firstPlaced) {
        if (isAiHiddenFirstTraceColorLost(traceType, player)) {
          return value;
        }
        const placedCount = AI_TRACE_TYPES.reduce((total, type) => (
          total + (slot.traces?.[type]?.firstPlaced ? 1 : 0)
        ), 0);
        const round = getAiRoundNumber();
        let earlyTracePremium = round <= 2 ? 6 : round === 3 ? 3 : 0;
        if (placedCount >= 2) earlyTracePremium += 5;
        else if (placedCount === 1) earlyTracePremium += 2.5;
        earlyTracePremium += scoreAiHiddenAlienRevealTimingPremium(alienSlotId, placedCount, player);
        return value + earlyTracePremium;
      }
      if (isAiHiddenFirstTraceTakenByOpponent(alienSlotId, traceType, player)) {
        return -4;
      }
      return value;
    }

    function scoreAiScanPriorityFloor(player = getCurrentPlayer()) {
      const round = getAiRoundNumber();
      if (round > 3) return 0;
      const demand = getAiStrategyDemand(player);
      const placedComputerCount = Math.max(0, (data.listComputerPlacedTokens?.(player) || []).length);
      const dataRoom = getAiAvailableDataRoom(player);
      const traceCount = countAiTraceMarkersForPlayer(player);
      const scanDemand = getAiMapDemand(demand.actions, "scan")
        + sumAiDemandMap(demand.scanColors) * 0.35
        + sumAiDemandMap(demand.traceTypes) * 0.22;
      let floor = round === 1 ? 5.5 : round === 2 ? 4 : 2.5;
      if (placedComputerCount < 4) floor += Math.max(0, 4 - placedComputerCount) * 0.55;
      if (dataRoom > 0) floor += Math.min(1.6, dataRoom * 0.25);
      if (traceCount === 0) floor += 1.5;
      else if (traceCount < 2) floor += 0.7;
      floor += Math.min(2.5, scanDemand * 0.05);
      return Math.max(0, floor);
    }

    function getAiTechCountForPlayer(player = getCurrentPlayer()) {
      return countAiPlayerTech(player);
    }

    function scoreAiCardCornerOpportunity(card) {
      let value = 0;
      const runezuRevealed = runezu?.isRunezuRevealedSlot
        && (aliens?.ALIEN_SLOT_IDS || []).some((alienSlotId) => (
          runezu.isRunezuRevealedSlot(alienGameState, alienSlotId)
        ));
      const resourceReward = runezuRevealed ? null : cards.getDiscardActionRewardForCard?.(card);
      if (resourceReward) {
        const gain = { ...(resourceReward.gain || {}) };
        const dataCount = Math.max(0, Math.round(aiNumber(resourceReward.dataCount)));
        value += scoreAiResourceBundle(gain);
        value += dataCount * AI_RESOURCE_VALUES.availableData;
        value += scoreAiThresholdPressureForScoreGain(gain.score, getCurrentPlayer()) * 0.35;
        value += scoreAiPublicityResearchTechSetupValue(gain, getCurrentPlayer(), { scale: 0.55 });
      }
      const moveReward = cards.getDiscardActionMoveRewardForCard?.(card);
      if (moveReward) {
        value += aiNumber(moveReward.movementPoints || 1) * AI_RESOURCE_VALUES.additionalPublicScan;
        value += scoreAiResourceBundle(moveReward.gain || {});
        value += scoreAiPublicityResearchTechSetupValue(moveReward.gain || {}, getCurrentPlayer(), { scale: 0.45 });
      }
      if (getPublicScanChoicesForCard(card).ok) value += 3;
      const incomeGain = cards.getIncomeGainForCard?.(card);
      if (incomeGain) value += scoreAiIncomeOpportunityValue(getCurrentPlayer(), incomeGain);
      return value;
    }

    function getAiScanEffectCount(effect) {
      const options = effect?.options || {};
      if (options.allMatching && options.condition) {
        return Math.max(1, getSectorXsMatchingCondition(options.condition).length);
      }
      return Math.max(1, Math.round(aiNumber(options.count || options.repeat || options.cornerRepeat || 1)));
    }

    function getAiPlayerCompanyBaseIncome(player = getCurrentPlayer()) {
      const explicitBaseIncome = player?.companyBaseIncome
        || player?.baseIncome
        || player?.industryBaseIncome
        || player?.industryEffect?.baseIncome
        || player?.initialSelection?.industryBaseIncome
        || player?.initialSelection?.industryEffect?.baseIncome
        || player?.initialSelection?.industry?.baseIncome
        || null;
      if (explicitBaseIncome && typeof explicitBaseIncome === "object") {
        return players.normalizeIncome(explicitBaseIncome);
      }
      const industryEffect = initialCards?.getIndustryEffect?.(player?.initialSelection?.industry);
      return players.normalizeIncome(industryEffect?.baseIncome || null);
    }

    function scoreAiCountedResourceGain(gain = {}, player = getCurrentPlayer()) {
      const fossilGain = Math.max(0, Math.round(aiNumber(gain?.aomomoFossils)));
      return scoreAiResourceBundle(gain)
        + scoreAiMidgameResourceContinuationValue(gain, player)
        + scoreAiPublicityResearchTechSetupValue(gain, player)
        + scoreAiThresholdPressureForScoreGain(gain.score, player)
        + scoreAiAomomoFossilPlanBonus(fossilGain, player);
    }

    function getAiConditionalProgress(current, target) {
      const required = Math.max(1, aiNumber(target));
      const value = Math.max(0, aiNumber(current));
      if (value >= required) return { met: true, multiplier: 1 };
      const missing = required - value;
      const closeBonus = missing <= 1 ? 0.28 : missing <= 2 ? 0.14 : 0;
      return {
        met: false,
        multiplier: Math.max(0.04, Math.min(0.45, (value / required) * 0.22 + closeBonus)),
      };
    }

    function getAiConditionRewardMultiplier(condition, player = getCurrentPlayer(), options = {}) {
      if (!condition) return { met: true, multiplier: 1 };
      const type = condition.type;
      const missingMultiplier = (value) => (options.immediate ? 0 : value);
      if (type === "resourceThreshold") {
        const progress = getAiConditionalProgress(player?.resources?.[condition.resource], condition.count || 1);
        return progress.met ? progress : { ...progress, multiplier: missingMultiplier(progress.multiplier) };
      }
      if (type === "resourceEquals") {
        const current = Math.max(0, aiNumber(player?.resources?.[condition.resource]));
        const target = Math.max(0, aiNumber(condition.count));
        if (current === target) return { met: true, multiplier: 1 };
        return { met: false, multiplier: missingMultiplier(target === 0 && current <= 1 ? 0.25 : 0.06) };
      }
      if (type === "techCount") {
        const progress = getAiConditionalProgress(endGameScoring.countOwnedTech(player, condition.techType), condition.count || 1);
        return progress.met ? progress : { ...progress, multiplier: missingMultiplier(progress.multiplier) };
      }
      if (type === "traceCount") {
        const progress = getAiConditionalProgress(countAiTraceMarkersForPlayer(player), condition.count || 1);
        return progress.met ? progress : { ...progress, multiplier: missingMultiplier(progress.multiplier) };
      }
      if (type === "dataTotal") {
        const progress = getAiConditionalProgress(player?.resources?.availableData, condition.count || 1);
        return progress.met ? progress : { ...progress, multiplier: missingMultiplier(progress.multiplier) };
      }
      if (type === "planetOrbitOrLand") {
        const hasMarker = endGameScoring.countPlanetOrbitOrLand?.(player, planetStatsState, condition.planetId) > 0;
        return hasMarker ? { met: true, multiplier: 1 } : { met: false, multiplier: missingMultiplier(0.18) };
      }
      return { met: false, multiplier: missingMultiplier(0.18) };
    }

    function isAiIncomeRewardEffect(effect) {
      return effect?.type === planetRewards.EFFECT_TYPES?.INCOME || effect?.type === "income";
    }

    function scoreAiIncomeRewardOpportunityValue(player = getCurrentPlayer(), effectOptions = {}, usedCardIndexes = null) {
      if (!player) return 0;
      const fixedGain = effectOptions?.gain || effectOptions?.income || null;
      if (fixedGain && typeof fixedGain === "object") {
        return scoreAiIncomeOpportunityValue(player, fixedGain);
      }

      const candidates = (player.hand || [])
        .map((card, index) => {
          if (usedCardIndexes?.has(index)) return null;
          const gain = cards.getIncomeGainForCard?.(card) || null;
          if (!gain) return null;
          const incomeScore = scoreAiIncomeOpportunityValue(player, gain);
          const finalFormulaFit = scoreAiIncomeDiscardFinalFormulaFit(player, gain);
          const routeEnergyFit = scoreAiIncomeDiscardRouteEnergyFit(player, gain);
          const playValue = ai?.valuation?.getCardValue
            ? Math.max(0, aiNumber(ai.valuation.getCardValue(card)))
            : AI_RESOURCE_VALUES.handSize;
          return {
            index,
            gain,
            score: incomeScore + finalFormulaFit + routeEnergyFit - Math.min(8, playValue * 0.12),
          };
        })
        .filter(Boolean)
        .sort((left, right) => aiNumber(right.score) - aiNumber(left.score));
      const selected = candidates[0] || null;
      if (!selected) return 0;
      if (usedCardIndexes) usedCardIndexes.add(selected.index);
      return Math.max(0, aiNumber(selected.score));
    }

    function aiRocketMatchesCountRewardOwner(rocket, player, options = {}) {
      if (options.owner === "any") return true;
      if (!rocket || !player) return false;
      const ids = new Set([player.id, player.playerId].filter(Boolean).map(String));
      const colors = new Set([player.color, player.playerColor].filter(Boolean).map(String));
      return [rocket.playerId, rocket.ownerPlayerId, rocket.id].filter(Boolean)
        .some((value) => ids.has(String(value)))
        || [rocket.color, rocket.playerColor, rocket.ownerPlayerColor].filter(Boolean)
          .some((value) => colors.has(String(value)));
    }

    function aiRocketMatchesCountRewardLocation(rocket, options = {}) {
      if (!rocket) return false;
      if ((options.location || "solar") === "solar") {
        if ((rocket.surface || "solar") !== "solar") return false;
        if (rocket.referencePlacement?.isPlanetMarker) return false;
      }
      const kind = rocket.kind || "standard";
      const isTransportedChongFossil = options.includeTransportedChongFossils === true
        && kind === "chong-fossil"
        && rocket.movementLocked !== true;
      if (options.includeNonStandard !== true && kind !== "standard" && !isTransportedChongFossil) return false;
      return true;
    }

    function countAiRocketsForReward(player = getCurrentPlayer(), rewardOptions = {}) {
      if (!player) return 0;
      if (Array.isArray(rocketState.rockets) && typeof cardEffects.countRocketsForReward === "function") {
        return cardEffects.countRocketsForReward(rocketState.rockets, player, rewardOptions);
      }
      const actionRockets = typeof rocketActions.getRocketsForPlayer === "function"
        ? rocketActions.getRocketsForPlayer(rocketState, player.id) || []
        : [];
      const fallbackRockets = actionRockets.length ? actionRockets : (getMovableTokensForPlayer(player.id) || []);
      return fallbackRockets.filter((rocket) => (
        aiRocketMatchesCountRewardLocation(rocket, rewardOptions)
        && aiRocketMatchesCountRewardOwner(rocket, player, rewardOptions)
      )).length;
    }

    function scoreAiEffectValue(effect, options = {}) {
      if (!effect) return 0;
      const type = effect.type;
      const effectOptions = effect.options || {};
      const player = options.player || getCurrentPlayer();
      switch (type) {
        case planetRewards.EFFECT_TYPES?.GAIN_RESOURCES:
        case "gain_resources": {
          const gain = effectOptions.gain || {};
          return scoreAiCountedResourceGain(gain, player);
        }
        case cardEffects.EFFECT_TYPES.PAY_CREDITS_FOR_REWARD: {
          const fallbackCardEffectValue = 2;
          if (getAiRoundNumber() < FINAL_ROUND_NUMBER) return fallbackCardEffectValue;
          const credits = Math.max(0, Math.round(aiNumber(player?.resources?.credits)));
          const energy = Math.max(0, Math.round(aiNumber(player?.resources?.energy)));
          if (credits <= 0) return fallbackCardEffectValue;
          if (energy > 1) return fallbackCardEffectValue;
          const rewardValue = scoreAiPayCreditReward(effect, player);
          const creditCost = scoreAiResourceBundle({ credits: 1 });
          const netPerPayment = Math.max(0, rewardValue - creditCost);
          return Math.max(fallbackCardEffectValue, Math.min(credits, 3) * netPerPayment);
        }
        case planetRewards.EFFECT_TYPES?.GAIN_DATA:
        case "gain_data": {
          const count = Math.max(0, Math.round(aiNumber(effectOptions.count || 1)));
          return count * AI_RESOURCE_VALUES.availableData
            + scoreAiMidgameResourceContinuationValue({ availableData: count }, player, { scale: 0.75 });
        }
        case planetRewards.EFFECT_TYPES?.INCOME:
        case "income":
          return scoreAiIncomeRewardOpportunityValue(player, effectOptions);
        case banrenma?.EFFECT_GAIN_INCOME:
          return scoreAiIncomeRewardOpportunityValue(player, effectOptions);
        case planetRewards.EFFECT_TYPES?.ALIEN_TRACE:
        case "alien_trace":
          return scoreAiAlienTraceValue({
            player,
            traceType: effectOptions.traceType || effectOptions.traceTypes?.[0],
            alienSlotId: effectOptions.alienSlotId,
          });
        case "draw_cards":
          return Math.max(0, Math.round(aiNumber(effectOptions.count || 1))) * AI_RESOURCE_VALUES.handSize;
        case "pick_card":
          return 3;
        case "launch":
          return 6;
        case "research_tech_select":
        case cardEffects.EFFECT_TYPES.RESEARCH_TECH:
          return 10;
        case "research_tech_bonus":
          return 3;
        case cardEffects.EFFECT_TYPES.CARD_MOVE:
        case cardEffects.EFFECT_TYPES.FREE_MOVE:
          return 2 + Math.max(1, Math.round(aiNumber(effectOptions.movementPoints || 1))) * 1.5;
        case cardEffects.EFFECT_TYPES.CARD_ORBIT: {
          const check = actions.canExecute("orbit", createActionContext());
          if (!check.ok) return 9;
          const directScore = getAiOrbitDirectScoreGain(check.planet?.planetId, player);
          const rewardValue = scoreAiOrbitRewardValue(check.planet?.planetId, player);
          return Math.max(9, rewardValue * 0.65 + directScore * 0.4 + scoreAiPaceValueForDirectScore(directScore, player));
        }
        case cardEffects.EFFECT_TYPES.CARD_LAND:
        case "aomomo_land_only": {
          const check = actions.canExecute("land", createActionContext());
          if (!check.ok) return 11;
          const selected = chooseAiLandChoice(check.choices || [], player)?.choice || null;
          const target = selected?.target || { type: "planet" };
          const directScore = getAiLandDirectScoreGainForTarget(check.planet?.planetId, target, player);
          const rewardValue = scoreAiLandRewardValueForTarget(check.planet?.planetId, target, player);
          return Math.max(11, rewardValue * 0.7 + directScore * 0.45 + scoreAiPaceValueForDirectScore(directScore, player));
        }
        case cardEffects.EFFECT_TYPES.PUBLIC_SCAN:
          return 4.5;
        case cardEffects.EFFECT_TYPES.HAND_SCAN:
          return effectOptions.optional ? 2 : 3;
        case cardEffects.EFFECT_TYPES.COUNT_HAND_INCOME_RESOURCE: {
          const incomeCode = Number(effectOptions.incomeCode);
          const resource = effectOptions.resource || "energy";
          const per = Math.max(0, aiNumber(effectOptions.per || 1));
          const count = (player?.hand || [])
            .filter((card) => Number(cards.getIncomeCodeForCard(card)) === incomeCode)
            .length;
          return scoreAiCountedResourceGain({ [resource]: Math.round(count * per) }, player);
        }
        case cardEffects.EFFECT_TYPES.COUNT_CURRENT_INCOME_RESOURCE: {
          const incomeKey = effectOptions.incomeKey || "credits";
          const resource = effectOptions.resource || "score";
          const per = Math.max(0, aiNumber(effectOptions.per || 1));
          const currentIncomeCount = Math.max(0, Math.round(aiNumber(player?.income?.[incomeKey])));
          const companyBaseIncome = getAiPlayerCompanyBaseIncome(player);
          const baseIncomeCount = Math.max(0, Math.round(aiNumber(companyBaseIncome?.[incomeKey])));
          const count = Math.max(0, currentIncomeCount - baseIncomeCount);
          return scoreAiCountedResourceGain({ [resource]: Math.round(count * per) }, player);
        }
        case cardEffects.EFFECT_TYPES.OPTIONAL_DISCARD_SCAN: {
          const handScans = Math.min(
            Math.max(1, Math.round(aiNumber(effectOptions.count || 1))),
            (getCurrentPlayer()?.hand || []).filter((card) => getPublicScanChoicesForCard(card).ok).length,
          );
          return handScans * 2.5;
        }
        case cardEffects.EFFECT_TYPES.SECTOR_X_SCAN:
        case cardEffects.EFFECT_TYPES.PLANET_SECTOR_SCAN:
        case cardEffects.EFFECT_TYPES.SCAN_COLOR_CHOICE:
        case "card_color_scan":
        case cardEffects.EFFECT_TYPES.CONDITIONAL_SECTOR_SCAN:
        case cardEffects.EFFECT_TYPES.CHOOSE_NEBULA_SCAN:
        case cardEffects.EFFECT_TYPES.SCAN_ACTION:
          return getAiScanEffectCount(effect) * (effectOptions.gainData === false ? 3 : 4.5)
            + getAiTechCountForPlayer() * 0.75;
        case cardEffects.EFFECT_TYPES.CONDITIONAL_REWARD:
          return (effectOptions.rewards || [])
            .reduce((total, reward) => total + scoreAiEffectValue(reward, options), 0)
            * 0.8
            * getAiConditionRewardMultiplier(effectOptions.condition, player, {
              immediate: options.immediate === true,
            }).multiplier;
        case cardEffects.EFFECT_TYPES.COUNT_ROCKETS_REWARD: {
          const count = countAiRocketsForReward(player, effectOptions);
          const total = Math.max(0, Math.round(count * aiNumber(effectOptions.per || 1)));
          if (total <= 0) return 0;
          const resource = effectOptions.resource === "data" ? "availableData" : (effectOptions.resource || "energy");
          return scoreAiCountedResourceGain({ [resource]: total }, player);
        }
        case "yichangdian_next_anomaly_reward":
          return scoreAiYichangdianNextAnomalyRewardValue(player);
        case "yichangdian_next_anomaly_scan":
          return scoreAiYichangdianNextAnomalyScanValue(player);
        case "yichangdian_anomaly_signal_score": {
          const signalScore = countAiYichangdianAnomalySignals();
          return signalScore
            + scoreAiPaceValueForDirectScore(signalScore, player, { baseWeight: 0.4, pressureWeight: 0.18 });
        }
        case "yichangdian_alien_trace": {
          const bestTraceScore = Math.max(...AI_TRACE_TYPES.map((item) => getAiBestRevealedAlienTraceDirectScore(player, item)));
          return Math.max(8, bestTraceScore * 0.45 + sumAiDemandMap(getAiStrategyDemand(player).traceTypes) * 0.05);
        }
        case "yichangdian_public_all":
          return Math.max(8, (cards.PUBLIC_CARD_COUNT || 3) * AI_RESOURCE_VALUES.handSize * 0.95);
        case "yichangdian_draw_then_two_corners":
          return 3 * AI_RESOURCE_VALUES.handSize + Math.max(4, scoreAiCardCornerOpportunity((player?.hand || [])[0]) * 0.4);
        case "yichangdian_launch_anomaly_move": {
          const earth = getEarthSectorCoordinate?.();
          const currentAnomaly = earth ? yichangdian?.getAnomalyBySectorX?.(alienGameState, earth.x) : null;
          return currentAnomaly ? 2.6 : 0.6;
        }
        case cardEffects.EFFECT_TYPES.REGISTER_EVENT_BONUS:
          return 2.5;
        case cardEffects.EFFECT_TYPES.PLUTO_RESERVE:
          return 8;
        case cardEffects.EFFECT_TYPES.RETURN_PLAYED_CARD_TO_HAND_IF:
          return 1.5;
        case amiba?.EFFECT_TYPES?.CHOOSE_SYMBOL_REWARD:
          return scoreAiAmibaSingleSymbolChoiceValue(effectOptions.region, player);
        case amiba?.EFFECT_TYPES?.REMOVE_TRACE_FOR_REGION_REWARD:
          return scoreAiAmibaTraceRemovalValue(player);
        case runezu?.EFFECT_TYPES?.SYMBOL_REWARD:
          return scoreAiRunezuSymbolRewardValue(effectOptions.symbolId, player);
        case runezu?.EFFECT_TYPES?.SYMBOL_BRANCH:
          return scoreAiRunezuSymbolBranchValue(effectOptions.branches || [], player);
        case chong?.EFFECT_TYPES?.CHONG_LAND_FOR_PICKUP:
        case chong?.EFFECT_TYPES?.CHONG_ORBIT_OR_LAND_FOR_PICKUP: {
          const pickupValue = scoreAiChongTravelEffectImmediateValue(effect, player);
          return pickupValue > 0
            ? Math.max(5, pickupValue, 6 + scoreAiAverageChongFossilRewardValue(player) * 0.25)
            : 0;
        }
        case chong?.EFFECT_TYPES?.CHONG_PICKUP_FOSSIL:
        case chong?.EFFECT_TYPES?.CHONG_PROBE_PLANET_FOSSIL_REWARD:
        case chong?.EFFECT_TYPES?.CHONG_CHOOSE_PLANET_FOSSIL_REWARD:
          return 5.5 + scoreAiBestChongFossilRewardValue(player) * 0.45;
        case chong?.EFFECT_TYPES?.CHONG_TASK_CLEANUP:
          return 1.5;
        case AI_FANGZHOU_CARD2_REWARD_EFFECT_TYPE:
          return scoreAiFangzhouCard2AdvancedRewardValue(player);
        case aomomo?.EFFECT_GAIN_FOSSILS:
          return scoreAiCountedResourceGain({
            aomomoFossils: Math.max(1, Math.round(aiNumber(effectOptions.count || 1))),
          }, player);
        case aomomo?.EFFECT_SCAN_AOMOMO_X:
        case aomomo?.EFFECT_SCAN_AOMOMO_X_GAIN_FOSSIL:
        case aomomo?.EFFECT_SCAN_AOMOMO_X_SCORE:
          return 5
            + Math.max(0, aiNumber(effectOptions.score || 0))
            + (type === aomomo?.EFFECT_SCAN_AOMOMO_X_GAIN_FOSSIL ? scoreAiCountedResourceGain({ aomomoFossils: 1 }, player) * 0.45 : 0);
        case aomomo?.EFFECT_LAND_SCORE_IF_AOMOMO:
        case "aomomo_land_only":
          return 8 + Math.max(0, aiNumber(effectOptions.score || 0));
        case aomomo?.EFFECT_FOSSIL_FOR_DATA: {
          const fossilCost = Math.max(1, Math.round(aiNumber(effectOptions.cost) || 1));
          const dataCount = Math.max(1, Math.round(aiNumber(effectOptions.dataCount) || 1));
          return dataCount * AI_RESOURCE_VALUES.availableData
            + scoreAiMidgameResourceContinuationValue({ availableData: dataCount }, player, { scale: 0.45 })
            - fossilCost * getAiAomomoFossilUnitValue(player)
            - scoreAiAomomoFossilSpendPlanPenalty(fossilCost, player);
        }
        case aomomo?.EFFECT_FOSSIL_FOR_MOVE_AND_LAND:
          return 7
            - getAiAomomoFossilUnitValue(player) * 0.65
            - scoreAiAomomoFossilSpendPlanPenalty(effectOptions.cost || 1, player) * 0.55;
        case aomomo?.EFFECT_FOSSIL_FOR_ANY_SCAN:
          return 4.5
            + scoreAiScanPriorityFloor(player) * 0.28
            - getAiAomomoFossilUnitValue(player) * 0.6
            - scoreAiAomomoFossilSpendPlanPenalty(effectOptions.cost || 1, player) * 0.45;
        case aomomo?.EFFECT_SPEND_FOSSILS_GAIN_SCORE: {
          const directScore = Math.max(0, aiNumber(effectOptions.score || 0));
          const fossilCost = Math.max(1, Math.round(aiNumber(effectOptions.cost) || 1));
          const threshold = getAiNextMissingFinalScoreThreshold(player);
          const currentScore = Math.max(0, aiNumber(player?.resources?.score));
          const crossesThreshold = Boolean(threshold && currentScore < threshold && currentScore + directScore >= threshold);
          return directScore
            + scoreAiPaceValueForDirectScore(directScore, player)
            - fossilCost * getAiAomomoFossilUnitValue(player)
            - scoreAiAomomoFossilSpendPlanPenalty(fossilCost, player, { directScore, crossesThreshold });
        }
        default:
          return String(type || "").startsWith("card_") ? 2 : 0;
      }
    }
    return Object.freeze({
      getAiActionGraphBaseNet,
      getAiBestNestedCandidateScore,
      countAiStandardScansThisRound,
      getAiFinalRoundProgressPenaltyScale,
      getAiPlayerStyle,
      getAiCandidateStyleActionId,
      getAiOpeningStyleMultiplier,
      getAiFinalFormulaStyleMultiplier,
      getAiCandidateDirectScoreForFinalMark,
      getAiMissingFinalMarkUrgencyMultiplier,
      adjustAiActionGraphCandidateForStyle,
      getAiTerminalResearchGoalBonusScale,
      adjustAiActionGraphCandidate,
      getAiEarlyEnginePressure,
      addAiIncomeGain,
      getAiIncomeIncreaseSnapshot,
      getAiIncomeFormulaBase,
      scoreAiMarkedIncomeFinalValue,
      scoreAiHandIncomeEngineBacklogValue,
      scoreAiIncomeOpportunityValue,
      scoreAiPlacementBonusValue,
      getAiDataPlacementBonuses,
      scoreAiDataPlacementBonusValue,
      scoreAiFinalThresholdIncomePlacementPenalty,
      scoreAiLateIncomePlacementDiscardPenalty,
      getAiDataPlacementDirectScoreGainFromBonus,
      getAiDataPlacementDirectScoreGain,
      scoreAiDataEngineProgressValue,
      scoreAiEarlyScanEngineValue,
      countAiTraceMarkersForPlayer,
      getAiB1TraceCounts,
      addAiB1TraceDemand,
      scoreAiB1TraceMarginalValue,
      isAiFirstTraceTakenByOpponent,
      isAiHiddenFirstTraceTakenByOpponent,
      isAiOpenHiddenFirstTraceTarget,
      getAiHiddenFirstTraceColorStatus,
      isAiHiddenFirstTraceColorLost,
      getAiAlienSlot,
      getAiAlienCardConversionMultiplier,
      getAiAlienCardExpectedValue,
      scoreAiLateAlienCardConversionPenalty,
      scoreAiHiddenAlienRevealTimingPremium,
      scoreAiAlienTraceValue,
      scoreAiScanPriorityFloor,
      getAiTechCountForPlayer,
      scoreAiCardCornerOpportunity,
      getAiScanEffectCount,
      getAiPlayerCompanyBaseIncome,
      scoreAiCountedResourceGain,
      getAiConditionalProgress,
      getAiConditionRewardMultiplier,
      isAiIncomeRewardEffect,
      scoreAiIncomeRewardOpportunityValue,
      aiRocketMatchesCountRewardOwner,
      aiRocketMatchesCountRewardLocation,
      countAiRocketsForReward,
      scoreAiEffectValue,
    });
  }

  return Object.freeze({ createActionValue });
});
