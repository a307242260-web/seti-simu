(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAIAlienChoiceValue = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createAlienChoiceValue(context = {}) {
    const {
      players,
      planetRewards,
      cards,
      cardEffects,
      tech,
      aliens,
      jiuzhe,
      banrenma,
      chong,
      amiba,
      runezu,
      ai,
      nebulaDataState,
      alienGameState,
      finalScoringState,
      playerState,
      planetStatsState,
      FINAL_ROUND_NUMBER,
      getCardTypeCode,
    } = context;
    const aiNumber = (...args) => context.aiNumber(...args);
    const canAiAnalyzeData = (...args) => context.canAiAnalyzeData(...args);
    const cloneAiValue = (...args) => context.cloneAiValue(...args);
    const computePlayerFinalScoreBreakdown = (...args) => context.computePlayerFinalScoreBreakdown(...args);
    const createActionContext = (...args) => context.createActionContext(...args);
    const createAiPlayerAfterQuickTrade = (...args) => context.createAiPlayerAfterQuickTrade(...args);
    const getAiAlienCardExpectedValue = (...args) => context.getAiAlienCardExpectedValue(...args);
    const getAiAlienPendingPlayer = (...args) => context.getAiAlienPendingPlayer(...args);
    const getAiPlayEffectsForCard = (...args) => context.getAiPlayEffectsForCard(...args);
    const getAiRoundNumber = (...args) => context.getAiRoundNumber(...args);
    const getCurrentPlayer = (...args) => context.getCurrentPlayer(...args);
    const roundAiScore = (...args) => context.roundAiScore(...args);
    const scoreAiAlienRewardBundle = (...args) => context.scoreAiAlienRewardBundle(...args);
    const scoreAiAmibaRegionRewardValue = (...args) => context.scoreAiAmibaRegionRewardValue(...args);
    const scoreAiAmibaSymbolEntryValue = (...args) => context.scoreAiAmibaSymbolEntryValue(...args);
    const scoreAiAnalyzeAction = (...args) => context.scoreAiAnalyzeAction(...args);
    const scoreAiBanrenmaTraceEffectValue = (...args) => context.scoreAiBanrenmaTraceEffectValue(...args);
    const scoreAiChongPanelUnlockValue = (...args) => context.scoreAiChongPanelUnlockValue(...args);
    const scoreAiCountedResourceGain = (...args) => context.scoreAiCountedResourceGain(...args);
    const scoreAiPublicPickCard = (...args) => context.scoreAiPublicPickCard(...args);
    const scoreAiPublicityResearchTechSetupValue = (...args) => context.scoreAiPublicityResearchTechSetupValue(...args);
    const scoreAiReadyBanrenmaCardOpportunity = (...args) => context.scoreAiReadyBanrenmaCardOpportunity(...args);
    const scoreAiResourceBundle = (...args) => context.scoreAiResourceBundle(...args);
    const scoreAiRunezuFaceSymbolPlacementChoice = (...args) => context.scoreAiRunezuFaceSymbolPlacementChoice(...args);
    const scoreAiRunezuSymbolRewardValue = (...args) => context.scoreAiRunezuSymbolRewardValue(...args);
    const summarizeAiTradeDiscardPlan = (...args) => context.summarizeAiTradeDiscardPlan(...args);
    const withAiDeferredCardResearchPreview = (...args) => context.withAiDeferredCardResearchPreview(...args);

    function getAiJiuzheCardDefinition(choice) {
      if (!/^\d+$/.test(String(choice ?? ""))) return null;
      const index = Math.round(aiNumber(choice));
      if (!Number.isInteger(index)) return null;
      return jiuzhe?.CARD_BY_INDEX?.[index] || null;
    }

    function getAiJiuzheScoringContext(player) {
      return {
        ...(createActionContext?.() || {}),
        currentPlayer: player,
        players: playerState.players,
        playerState,
        finalScoringState,
        nebulaDataState,
        alienGameState,
        planetStatsState,
        cardEffects,
        getCardTypeCode,
      };
    }

    function getAiOtherJiuzheThreats(player) {
      if (!jiuzhe?.getThreat || !player) return [];
      return (playerState.players || []).reduce((threats, candidate) => {
        if (!candidate || candidate === player || candidate.id === player.id || candidate.color === player.color) {
          return threats;
        }
        threats.push(Math.max(0, aiNumber(jiuzhe.getThreat(alienGameState, candidate))));
        return threats;
      }, []);
    }

    function getAiJiuzheThreatValuationContext(player) {
      if (!player || !jiuzhe?.getThreat) return null;
      const breakdown = computePlayerFinalScoreBreakdown?.(player) || {};
      return {
        currentThreat: Math.max(0, aiNumber(jiuzhe.getThreat(alienGameState, player))),
        otherThreats: getAiOtherJiuzheThreats(player),
        currentPrePenaltyScore: Math.max(
          aiNumber(breakdown.prePenaltyTotalScore),
          aiNumber(breakdown.totalScore),
          aiNumber(player?.resources?.score),
        ),
      };
    }

    function getAiFinalAnalyzeDirectScoreProtection(discardPlan = null, analyzeScore = 0, options = {}) {
      const minimumScore = Math.max(0, aiNumber(options.minimumScore ?? 8));
      const clearAdvantage = Math.max(0, aiNumber(options.clearAdvantage ?? 4));
      const protectedCard = Boolean(discardPlan?.ok)
        ? (discardPlan.selectedCards || [])
          .filter((card) => (
            card?.playScore !== null
            && card?.playScore !== undefined
            && Math.max(0, aiNumber(card?.directScoreGain)) >= minimumScore
          ))
          .sort((left, right) => (
            Math.max(aiNumber(right?.playScore), aiNumber(right?.directScoreGain))
              - Math.max(aiNumber(left?.playScore), aiNumber(left?.directScoreGain))
          ))[0] || null
        : null;
      const protectedPlayScore = protectedCard
        ? Math.max(0, aiNumber(protectedCard.playScore), aiNumber(protectedCard.directScoreGain))
        : 0;
      const normalizedAnalyzeScore = Math.max(0, aiNumber(analyzeScore));
      const clearlyBetter = Boolean(protectedCard)
        && normalizedAnalyzeScore >= protectedPlayScore + clearAdvantage;
      const saferEnergyTradeAvailable = options.saferEnergyTradeAvailable === true;
      return {
        spendsPlayableDirectScoreCard: Boolean(protectedCard),
        shouldProtect: Boolean(protectedCard) && (saferEnergyTradeAvailable || !clearlyBetter),
        clearlyBetter,
        saferEnergyTradeAvailable,
        minimumScore,
        clearAdvantage,
        analyzeScore: roundAiScore(normalizedAnalyzeScore),
        protectedPlayScore: roundAiScore(protectedPlayScore),
        protectedCard,
      };
    }

    function evaluateAiCardsForEnergyAnalyzeProtection(player, trade, preserveHandIndex = null, options = {}) {
      const discardPlan = summarizeAiTradeDiscardPlan(player, trade, preserveHandIndex, {
        includeExecutionPlan: true,
        tradeId: trade?.id || "cards-for-energy",
      });
      const simulatedPlayer = discardPlan.ok ? createAiPlayerAfterQuickTrade(player, trade) : null;
      const analyzeScore = simulatedPlayer && canAiAnalyzeData(simulatedPlayer).ok
        ? Math.max(0, aiNumber(scoreAiAnalyzeAction(simulatedPlayer)))
        : 0;
      return {
        discardPlan,
        simulatedPlayer,
        analyzeScore,
        protection: getAiFinalAnalyzeDirectScoreProtection(discardPlan, analyzeScore, options),
      };
    }

    function estimateAiJiuzheCardCompletionFactor(definition, player, context, options = {}) {
      if (!definition?.condition || !player) return 0;
      const progress = options.progress
        || jiuzhe?.getCardConditionProgress?.(definition, player, context)
        || null;
      if (progress?.met || (!progress && jiuzhe?.isCardConditionMet?.(definition, player, context))) return 1;
      const target = Math.max(1, aiNumber(progress?.target ?? definition.condition.count));
      const current = progress?.current;
      const round = getAiRoundNumber();
      if (!Number.isFinite(Number(current))) {
        return round >= FINAL_ROUND_NUMBER ? 0.02 : round >= 3 ? 0.09 : round === 2 ? 0.22 : 0.32;
      }
      const missing = Math.max(1, Math.ceil(target - Math.max(0, aiNumber(current))));
      const table = round >= FINAL_ROUND_NUMBER
        ? [0, 0.22, 0.06, 0.02, 0.01]
        : round >= 3
          ? [0, 0.5, 0.22, 0.09, 0.04]
          : round === 2
            ? [0, 0.68, 0.42, 0.22, 0.12]
            : [0, 0.78, 0.52, 0.32, 0.18];
      let factor = table[Math.min(4, missing)];
      if (options.paid) {
        factor *= round >= FINAL_ROUND_NUMBER ? 0.25 : round >= 3 ? 0.45 : round === 2 ? 0.7 : 0.85;
      }
      return Math.max(0.01, Math.min(1, factor));
    }

    function estimateAiJiuzheThreatPenalty(player, addedThreat, scoreGain = 0) {
      if (!ai?.valuation?.estimateJiuzheThreatPenaltyMarginal) return 0;
      return ai.valuation.estimateJiuzheThreatPenaltyMarginal({
        ...getAiJiuzheThreatValuationContext(player),
        addedThreat,
        scoreGain,
      });
    }

    function scoreAiJiuzheCardOption(option, player, flow) {
      if (!option || option.disabled) return -Infinity;
      if (option.choice === "skip") return 0;
      if (option.choice === "cancel") return -100;
      const definition = getAiJiuzheCardDefinition(option.choice);
      if (!definition) return option.score;
      const context = getAiJiuzheScoringContext(player);
      const conditionProgress = jiuzhe?.getCardConditionProgress?.(definition, player, context) || null;
      const achievedNow = conditionProgress
        ? Boolean(conditionProgress.met)
        : Boolean(jiuzhe?.isCardConditionMet?.(definition, player, context));
      const paymentOpportunityCost = scoreAiResourceBundle(flow?.pending?.cost || {});
      const completionFactor = estimateAiJiuzheCardCompletionFactor(definition, player, context, {
        paid: paymentOpportunityCost > 0,
        progress: conditionProgress,
      });
      const expectedScore = Math.max(0, aiNumber(definition.score)) * completionFactor;
      const threat = Math.max(0, Math.round(aiNumber(definition.threat)));
      const threatPenalty = estimateAiJiuzheThreatPenalty(
        player,
        threat,
        achievedNow ? Math.max(0, aiNumber(definition.score)) : 0,
      );
      const acquisitionValue = paymentOpportunityCost > 0 ? 0 : 5;
      return acquisitionValue + expectedScore * 2.2 - threatPenalty - paymentOpportunityCost;
    }

    function enrichAiJiuzheCardOptions(options, flow) {
      if (flow.type !== "jiuzhe-card" || flow.pending?.reason === "view") return options;
      const player = getAiAlienPendingPlayer(flow.pending);
      return options.map((option) => ({
        ...option,
        score: scoreAiJiuzheCardOption(option, player, flow),
      }));
    }

    function scoreAiChongFossilUseOption(option, player) {
      if (option.choice === "cancel") return -100;
      const reward = chong?.getFossilReward?.(option.choice);
      if (!reward) return option.score ?? 0;
      return scoreAiAlienRewardBundle(reward, player)
        + scoreAiChongPanelUnlockValue(player) * 0.35;
    }

    function getAiEffectiveBanrenmaRewardGain(gain = {}, player = getCurrentPlayer()) {
      if (!player) return {};
      return Object.entries(gain || {}).reduce((result, [resource, rawCount]) => {
        const count = Math.max(0, aiNumber(rawCount));
        const limit = Number(players?.RESOURCE_LIMITS?.[resource]);
        result[resource] = Number.isFinite(limit)
          ? Math.min(count, Math.max(0, limit - aiNumber(player.resources?.[resource])))
          : count;
        return result;
      }, {});
    }

    function scoreAiBanrenmaDisplayedCardGainValue(player, effectiveGain = {}) {
      const rawDisplayedCardIndex = alienGameState?.banrenma?.displayedCardIndex;
      if (
        !player
        || rawDisplayedCardIndex == null
        || rawDisplayedCardIndex === ""
        || !banrenma?.createAlienCard
      ) {
        return getAiAlienCardExpectedValue(player);
      }
      const displayedCardIndex = Number(rawDisplayedCardIndex);
      if (!Number.isInteger(displayedCardIndex)) return getAiAlienCardExpectedValue(player);
      const displayedCard = banrenma.createAlienCard(displayedCardIndex, 0);
      if (!displayedCard) return getAiAlienCardExpectedValue(player);
      const simulatedPlayer = cloneAiValue(player);
      simulatedPlayer.resources = { ...(simulatedPlayer.resources || {}) };
      for (const [resource, count] of Object.entries(effectiveGain || {})) {
        simulatedPlayer.resources[resource] = aiNumber(simulatedPlayer.resources[resource]) + aiNumber(count);
      }
      simulatedPlayer.hand = [...(simulatedPlayer.hand || []), displayedCard];
      simulatedPlayer.resources.handSize = simulatedPlayer.hand.length;
      const displayedCardValue = withAiDeferredCardResearchPreview(() => (
        Math.max(0, scoreAiPublicPickCard(displayedCard, simulatedPlayer, "banrenma-card"))
      ));
      const deferredPublicityGain = getAiPlayEffectsForCard(displayedCard)
        .reduce((total, effect) => {
          const type = effect?.type;
          if (type !== planetRewards.EFFECT_TYPES?.GAIN_RESOURCES && type !== "gain_resources") return total;
          return total + Math.max(0, aiNumber(effect?.options?.gain?.publicity));
        }, 0);
      const researchCost = tech.resolver?.getResearchPublicityCost?.(simulatedPlayer)
        ?? tech.RESEARCH_PUBLICITY_COST
        ?? 6;
      const publicityBeforeCard = Math.max(0, aiNumber(simulatedPlayer.resources?.publicity));
      const cardIsResearchBridge = deferredPublicityGain > 0
        && publicityBeforeCard < researchCost
        && publicityBeforeCard + deferredPublicityGain >= researchCost;
      const deferredResearchTempoCost = cardIsResearchBridge
        ? scoreAiPublicityResearchTechSetupValue(
          { publicity: deferredPublicityGain },
          simulatedPlayer,
          { previewTakeableTechSupply: true },
        )
        : 0;
      return Math.max(0, displayedCardValue - deferredResearchTempoCost);
    }

    function scoreAiBanrenmaBonusUseOption(option, player) {
      if (!option || option.disabled || option.choice === "cancel") return -Infinity;
      const position = Number(option.choice);
      const reward = banrenma?.getBonusReward?.(position);
      if (!reward) return -Infinity;
      if (reward.alienTrace) {
        return scoreAiBanrenmaTraceEffectValue({
          type: "alien_trace",
          options: { allowedTraceTypes: aliens?.TRACE_TYPES || [] },
        }, player);
      }

      const effectiveGain = getAiEffectiveBanrenmaRewardGain(reward.gain || {}, player);
      const directScore = Math.max(0, aiNumber(effectiveGain.score));
      const nonScoreGain = { ...effectiveGain, score: 0 };
      let value = scoreAiCountedResourceGain(nonScoreGain, player) + directScore;
      if (reward.pickAlienCard) {
        value += scoreAiBanrenmaDisplayedCardGainValue(player, effectiveGain);
      }

      return roundAiScore(value);
    }

    function scoreAiBanrenmaConditionUseOption(option, flow, player) {
      if (!option || option.disabled || option.choice === "cancel") return -Infinity;
      const card = (player?.reservedCards || []).find((item) => item?.id === option.choice);
      return scoreAiReadyBanrenmaCardOpportunity(card, player, flow.pending?.markId || null);
    }

    function scoreAiAmibaSymbolUseOption(option, player) {
      if (option.choice === "cancel") return -100;
      const entry = amiba?.getSymbolEntry?.(alienGameState, option.choice);
      return scoreAiAmibaSymbolEntryValue(entry, player);
    }

    function scoreAiAmibaTraceRemovalUseOption(option, flow, player) {
      if (option.choice === "cancel") return -100;
      const [traceType, positionText] = String(option.choice || "").split(":");
      const position = Number(positionText);
      const match = (amiba?.listPlayerTraceOptions?.(alienGameState, flow.pending?.alienSlotId, player) || [])
        .find((item) => item.traceType === traceType && Number(item.position) === position);
      if (!match) return -Infinity;
      const traceLoss = position >= 3 ? 2 : 1;
      return scoreAiAmibaRegionRewardValue(match.region, player) - traceLoss;
    }

    function scoreAiRunezuFaceSymbolUseOption(option, flow, player) {
      if (option.choice === "cancel") return -100;
      return scoreAiRunezuFaceSymbolPlacementChoice(flow.pending?.position, option.choice, player);
    }

    function scoreAiRunezuSymbolBranchUseOption(option, flow, player) {
      if (option.choice === "cancel") return -100;
      const branch = (flow.pending?.branches || [])[Number(option.choice)];
      if (!branch) return -Infinity;
      return (branch.symbolIds || []).reduce((total, symbolId) => (
        total + scoreAiRunezuSymbolRewardValue(symbolId, player)
      ), 0);
    }

    function enrichAiAlienUseOptions(options, flow) {
      let enriched = enrichAiJiuzheCardOptions(options, flow);
      if (!["banrenma-bonus", "banrenma-condition", "chong-fossil", "amiba-symbol", "amiba-trace-removal", "runezu-face-symbol", "runezu-symbol-branch"].includes(flow.type)) {
        return enriched;
      }
      const player = getAiAlienPendingPlayer(flow.pending);
      const initiallyAvailableBanrenmaBonusOptions = flow.type === "banrenma-bonus"
        ? enriched.filter((option) => !option.disabled)
        : [];
      const scored = enriched.map((option) => {
        let score = option.score;
        if (flow.type === "banrenma-bonus") score = scoreAiBanrenmaBonusUseOption(option, player);
        if (flow.type === "banrenma-condition") score = scoreAiBanrenmaConditionUseOption(option, flow, player);
        if (flow.type === "chong-fossil") score = scoreAiChongFossilUseOption(option, player);
        if (flow.type === "amiba-symbol") score = scoreAiAmibaSymbolUseOption(option, player);
        if (flow.type === "amiba-trace-removal") score = scoreAiAmibaTraceRemovalUseOption(option, flow, player);
        if (flow.type === "runezu-face-symbol") score = scoreAiRunezuFaceSymbolUseOption(option, flow, player);
        if (flow.type === "runezu-symbol-branch") score = scoreAiRunezuSymbolBranchUseOption(option, flow, player);
        const requiresExecutableBanrenmaReward = flow.type === "banrenma-bonus" || flow.type === "banrenma-condition";
        return {
          ...option,
          score,
          disabled: Boolean(option.disabled || (requiresExecutableBanrenmaReward && !Number.isFinite(Number(score)))),
        };
      });
      if (
        flow.type === "banrenma-bonus"
        && !scored.some((option) => !option.disabled)
        && initiallyAvailableBanrenmaBonusOptions.length === 1
      ) {
        const fallbackChoice = initiallyAvailableBanrenmaBonusOptions[0].choice;
        const fallbackReward = banrenma?.getBonusReward?.(Number(fallbackChoice));
        if (fallbackReward?.alienTrace) {
          return scored.map((option) => (
            option.choice === fallbackChoice
              ? { ...option, disabled: false, score: 0, rewardFallsThroughWithoutTarget: true }
              : option
          ));
        }
      }
      return scored;
    }
    return Object.freeze({
      getAiJiuzheCardDefinition,
      getAiJiuzheScoringContext,
      getAiOtherJiuzheThreats,
      getAiJiuzheThreatValuationContext,
      getAiFinalAnalyzeDirectScoreProtection,
      evaluateAiCardsForEnergyAnalyzeProtection,
      estimateAiJiuzheCardCompletionFactor,
      estimateAiJiuzheThreatPenalty,
      scoreAiJiuzheCardOption,
      enrichAiJiuzheCardOptions,
      scoreAiChongFossilUseOption,
      getAiEffectiveBanrenmaRewardGain,
      scoreAiBanrenmaDisplayedCardGainValue,
      scoreAiBanrenmaBonusUseOption,
      scoreAiBanrenmaConditionUseOption,
      scoreAiAmibaSymbolUseOption,
      scoreAiAmibaTraceRemovalUseOption,
      scoreAiRunezuFaceSymbolUseOption,
      scoreAiRunezuSymbolBranchUseOption,
      enrichAiAlienUseOptions,
    });
  }

  return Object.freeze({ createAlienChoiceValue });
});
