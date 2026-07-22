(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAICardCandidates = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createCardCandidates(context = {}) {
    const {
      state,
      players,
      rocketActions,
      endGameScoring,
      abilities,
      actions,
      cards,
      cardEffects,
      tech,
      aomomo,
      fangzhou,
      banrenma,
      chong,
      amiba,
      runezu,
      ai,
      FINAL_ROUND_NUMBER,
      confirmCardCornerQuickAction,
      handleHandCardCornerQuickAction,
      sectorXHasAvailableScanTarget,
      AI_RESOURCE_VALUES,
      AI_FANGZHOU_CARD2_REWARD_EFFECT_TYPE,
      AI_HUANYU_SUPERDRIVE_INDUSTRY_LABEL,
      AI_HUANYU_SUPERDRIVE_INDUSTRY_ID,
    } = context;
    const aiNumber = (...args) => context.aiNumber(...args);
    const buildAiResearchTechCandidate = (...args) => context.buildAiResearchTechCandidate(...args);
    const canAiResolveCardLandEffect = (...args) => context.canAiResolveCardLandEffect(...args);
    const canAiUseCardCornerMoveThisTurn = (...args) => context.canAiUseCardCornerMoveThisTurn(...args);
    const canStartMainAction = (...args) => context.canStartMainAction(...args);
    const countAiFinalMarksForPlayer = (...args) => context.countAiFinalMarksForPlayer(...args);
    const countAiPlayerTech = (...args) => context.countAiPlayerTech(...args);
    const createActionContext = (...args) => context.createActionContext(...args);
    const getAiCardDisplayLabel = (...args) => context.getAiCardDisplayLabel(...args);
    const getAiHighScorePushProfile = (...args) => context.getAiHighScorePushProfile(...args);
    const getAiIndustryCard = (...args) => context.getAiIndustryCard(...args);
    const getAiMarkedFinalFormulaEntries = (...args) => context.getAiMarkedFinalFormulaEntries(...args);
    const getAiNextMissingFinalScoreThreshold = (...args) => context.getAiNextMissingFinalScoreThreshold(...args);
    const getAiPlanningFinalFormulaEntries = (...args) => context.getAiPlanningFinalFormulaEntries(...args);
    const getAiPlayCardFinalFormulaDeltas = (...args) => context.getAiPlayCardFinalFormulaDeltas(...args);
    const getAiReadyHandTaskCashout = (...args) => context.getAiReadyHandTaskCashout(...args);
    const getAiRewardDirectScore = (...args) => context.getAiRewardDirectScore(...args);
    const getAiRoundNumber = (...args) => context.getAiRoundNumber(...args);
    const getAiRunezuPrematureSymbolCardReason = (...args) => context.getAiRunezuPrematureSymbolCardReason(...args);
    const getAiTechCountForPlayer = (...args) => context.getAiTechCountForPlayer(...args);
    const getCardPlayCost = (...args) => context.getCardPlayCost(...args);
    const getCardPrice = (...args) => context.getCardPrice(...args);
    const getCardTypeCode = (...args) => context.getCardTypeCode(...args);
    const getCurrentPlayer = (...args) => context.getCurrentPlayer(...args);
    const getSectorXsMatchingCondition = (...args) => context.getSectorXsMatchingCondition(...args);
    const isAiChongTravelEffect = (...args) => context.isAiChongTravelEffect(...args);
    const listAiChongPickupTravelChoices = (...args) => context.listAiChongPickupTravelChoices(...args);
    const listAiEffectMoveCandidates = (...args) => context.listAiEffectMoveCandidates(...args);
    const listAiResearchTechCandidates = (...args) => context.listAiResearchTechCandidates(...args);
    const roundAiScore = (...args) => context.roundAiScore(...args);
    const scoreAiBanrenmaCardThresholdSetupValue = (...args) => context.scoreAiBanrenmaCardThresholdSetupValue(...args);
    const scoreAiC2Type3ProgressValue = (...args) => context.scoreAiC2Type3ProgressValue(...args);
    const scoreAiCFinalTaskProgressValue = (...args) => context.scoreAiCFinalTaskProgressValue(...args);
    const scoreAiCardCornerOpportunity = (...args) => context.scoreAiCardCornerOpportunity(...args);
    const scoreAiCardEndGameExpectedValue = (...args) => context.scoreAiCardEndGameExpectedValue(...args);
    const scoreAiCardStandardActionPremium = (...args) => context.scoreAiCardStandardActionPremium(...args);
    const scoreAiChongCardTaskChainValue = (...args) => context.scoreAiChongCardTaskChainValue(...args);
    const scoreAiEffectValue = (...args) => context.scoreAiEffectValue(...args);
    const scoreAiFinalRoundEndGameCardUrgency = (...args) => context.scoreAiFinalRoundEndGameCardUrgency(...args);
    const scoreAiFinalRoundPlayCardResourceDrainPenalty = (...args) => context.scoreAiFinalRoundPlayCardResourceDrainPenalty(...args);
    const scoreAiFinalSecondMarkNoDirectSetupPenalty = (...args) => context.scoreAiFinalSecondMarkNoDirectSetupPenalty(...args);
    const scoreAiFollowupMainActionAfterMove = (...args) => context.scoreAiFollowupMainActionAfterMove(...args);
    const scoreAiIncomeOpportunityValue = (...args) => context.scoreAiIncomeOpportunityValue(...args);
    const scoreAiLatePlayCardEnginePressure = (...args) => context.scoreAiLatePlayCardEnginePressure(...args);
    const scoreAiPlayCardConversionPressure = (...args) => context.scoreAiPlayCardConversionPressure(...args);
    const scoreAiPlayCardRoutePlan = (...args) => context.scoreAiPlayCardRoutePlan(...args);
    const scoreAiPlayCardValue = (...args) => context.scoreAiPlayCardValue(...args);
    const scoreAiReadyTaskTechReplacementValue = (...args) => context.scoreAiReadyTaskTechReplacementValue(...args);
    const scoreAiResourceBundle = (...args) => context.scoreAiResourceBundle(...args);
    const scoreAiStrategyPassiveCardPlayValue = (...args) => context.scoreAiStrategyPassiveCardPlayValue(...args);
    const scoreAiThresholdPressureForScoreGain = (...args) => context.scoreAiThresholdPressureForScoreGain(...args);
    const scoreAiUnplayedTaskCardPreserveValue = (...args) => context.scoreAiUnplayedTaskCardPreserveValue(...args);

    function getAiPlayEffectsForCard(card) {
      if (fangzhou?.isFangzhouCard2?.(card)) {
        return [{
          id: `fangzhou-card2-advanced-${card?.id || card?.cardId || "card"}`,
          type: AI_FANGZHOU_CARD2_REWARD_EFFECT_TYPE,
          label: "方舟高级奖励",
          icon: "fangzhou",
          options: { tier: "advanced" },
        }];
      }
      if (banrenma?.isBanrenmaCard?.(card)) return banrenma.buildImmediateEffects?.(card) || [];
      if (chong?.isChongCard?.(card)) return chong.buildImmediateEffects?.(card) || [];
      if (amiba?.isAmibaCard?.(card)) return amiba.buildImmediateEffects?.(card) || [];
      if (aomomo?.isAomomoCard?.(card)) return aomomo.buildImmediateEffects?.(card) || [];
      if (runezu?.isRunezuCard?.(card)) return runezu.buildImmediateEffects?.(card) || [];
      return cardEffects.buildPlayEffects?.(card) || [];
    }

    function isAiAlienMainPlayCard(card) {
      return Boolean(
        fangzhou?.isFangzhouCard2?.(card)
        || banrenma?.isBanrenmaCard?.(card)
        || chong?.isChongCard?.(card)
        || amiba?.isAmibaCard?.(card)
        || aomomo?.isAomomoCard?.(card)
        || runezu?.isRunezuCard?.(card),
      );
    }

    function doesAiCardReserveAfterPlay(card, typeCode, model) {
      if (banrenma?.isBanrenmaCard?.(card)) return true;
      if (chong?.isChongCard?.(card)) return true;
      return [1, 2, 3].includes(typeCode) || Boolean(model?.reserveAfterPlay);
    }

    function isAiSupportedHandPlayCard(card) {
      if (!card) return false;
      return true;
    }

    function listAiChongTravelChoicesForOptions(options) {
      return (options?.choices || []).filter(Boolean);
    }

    function requireWorkingRoot(workingRoot) {
      if (!workingRoot?.playerState || !workingRoot?.cardState || !workingRoot?.techGameState) {
        throw new TypeError("AI card candidate requires explicit workingRoot");
      }
      return workingRoot;
    }

    function getWorkingCurrentPlayer(workingRoot) {
      return players.getCurrentPlayer(requireWorkingRoot(workingRoot).playerState);
    }

    function getAiChongLandOptions(workingRoot, effect) {
      const baseOptions = abilities.planet?.getLandOptions?.(createActionContext(workingRoot), {
        skipCost: true,
        allowSatelliteWithoutTech: Boolean(effect?.options?.allowSatellite),
      });
      if (!baseOptions?.ok) return baseOptions || { ok: false, message: "当前不能登陆" };
      const choices = listAiChongTravelChoicesForOptions(baseOptions);
      return choices.length
        ? { ...baseOptions, choices }
        : { ok: false, message: "当前没有可登陆目标" };
    }

    function getAiChongOrbitOrLandOptions(workingRoot, effect) {
      const context = createActionContext(workingRoot);
      const choices = [];
      const orbitOptions = abilities.planet?.getOrbitOptions?.(context, { skipCost: true });
      if (orbitOptions?.ok) {
        choices.push(...listAiChongTravelChoicesForOptions(orbitOptions).map((choice) => ({
          ...choice,
          kind: "orbit",
        })));
      }
      const landOptions = abilities.planet?.getLandOptions?.(context, {
        skipCost: true,
        allowSatelliteWithoutTech: Boolean(effect?.options?.allowSatellite),
      });
      if (landOptions?.ok) {
        choices.push(...listAiChongTravelChoicesForOptions(landOptions).map((choice) => ({
          ...choice,
          kind: "land",
        })));
      }
      return choices.length
        ? { ok: true, choices }
        : { ok: false, message: "当前没有可环绕或登陆目标" };
    }

    function canAiResolveChongTravelEffect(workingRoot, effect, previousEffect) {
      if (!isAiChongTravelEffect(effect)) return { ok: true };
      if (
        previousEffect?.type === cardEffects.EFFECT_TYPES.CARD_MOVE
        || previousEffect?.type === cardEffects.EFFECT_TYPES.FREE_MOVE
      ) {
        return { ok: true };
      }
      const options = effect.type === chong?.EFFECT_TYPES?.CHONG_ORBIT_OR_LAND_FOR_PICKUP
        ? getAiChongOrbitOrLandOptions(workingRoot, effect)
        : getAiChongLandOptions(workingRoot, effect);
      if (!options?.ok) {
        return { ok: false, message: options?.message || "当前不能执行虫族取化石行动" };
      }
      return listAiChongPickupTravelChoices(options).length > 0
        ? { ok: true }
        : { ok: false, message: "当前没有可拾取化石的木星/土星登陆或环绕目标" };
    }

    function canAiResolvePlayCardEffects(workingRoot, playEffects = [], player = getWorkingCurrentPlayer(workingRoot)) {
      requireWorkingRoot(workingRoot);
      const context = createActionContext(workingRoot);
      const effectPlayer = player || getWorkingCurrentPlayer(workingRoot);
      const unsupportedTypes = new Set([
        "alien_trace",
        cardEffects.EFFECT_TYPES.REMOVE_PLANET_MARKER,
        cardEffects.EFFECT_TYPES.PICK_CARD_CORNER_REWARD,
        cardEffects.EFFECT_TYPES.CHOOSE_HAND_CORNER_REWARD,
        cardEffects.EFFECT_TYPES.DRAW_THEN_DISCARD_ACTION,
        cardEffects.EFFECT_TYPES.DISCARD_ANY_FOR_INCOME,
        cardEffects.EFFECT_TYPES.DISCARD_CARD_CORNER_REPEAT,
        cardEffects.EFFECT_TYPES.REMOVE_ORBIT_TO_PROBE,
        cardEffects.EFFECT_TYPES.RETURN_UNFINISHED_TASK_TO_HAND,
        cardEffects.EFFECT_TYPES.PROBE_SECTOR_SCAN,
        cardEffects.EFFECT_TYPES.PROBE_LOCATION_REWARD,
        cardEffects.EFFECT_TYPES.EARTH_SECTOR_CONTENT_MOVE,
      ]);
      for (let index = 0; index < playEffects.length; index += 1) {
        const effect = playEffects[index];
        const previousEffect = playEffects[index - 1] || null;
        const nextEffect = playEffects[index + 1] || null;
        if (effect?.type === AI_FANGZHOU_CARD2_REWARD_EFFECT_TYPE) continue;
        if (unsupportedTypes.has(effect?.type)) {
          return { ok: false, message: `AI 暂不支持打出效果 ${effect.type}` };
        }
        if (
          effect?.type === cardEffects.EFFECT_TYPES.PAY_CREDITS_FOR_REWARD
        ) {
          if (getAiRoundNumber() < FINAL_ROUND_NUMBER) {
            return { ok: false, message: `${effect.label || "支付信用奖励"}：保留到终局资源滚动` };
          }
          if (!players.canAfford(effectPlayer, { credits: 1 })) {
            return { ok: false, message: `${effect.label || "支付信用奖励"}：信用不足` };
          }
          if (Math.max(0, Math.round(aiNumber(effectPlayer?.resources?.energy))) > 1) {
            return { ok: false, message: `${effect.label || "支付信用奖励"}：仍保留能量优先兑现主引擎` };
          }
        }
        if (isAiChongTravelEffect(effect)) {
          const chongCheck = canAiResolveChongTravelEffect(workingRoot, effect, previousEffect);
          if (!chongCheck.ok) return chongCheck;
        }
        if (effect?.type === "launch" && !effect.options?.ignoreRocketLimit) {
          const rocketLimit = abilities.rocket.getRocketLimitForPlayer(effectPlayer, context);
          const activeRocketCount = rocketActions.getRocketsForPlayer(workingRoot.rocketState, effectPlayer.id).length;
          if (activeRocketCount >= rocketLimit) {
            return { ok: false, message: `火箭数量已达上限（${activeRocketCount}/${rocketLimit}）` };
          }
        }
        if (effect?.type === cardEffects.EFFECT_TYPES.CARD_ORBIT) {
          const check = actions.canExecute("orbit", context);
          if (!check.ok) return { ok: false, message: check.message || "当前不能环绕" };
        }
        if (effect?.type === cardEffects.EFFECT_TYPES.CARD_LAND) {
          const options = canAiResolveCardLandEffect(effect, effectPlayer);
          if (!options.ok) return options;
        }
        if (effect?.type === cardEffects.EFFECT_TYPES.DISCARD_PUBLIC_CORNER_REWARDS) {
          const count = Math.max(1, Math.round(aiNumber(effect.options?.count || 1)));
          const filledPublicCount = (workingRoot.cardState.publicCards || []).filter(Boolean).length;
          if (filledPublicCount < count) {
            return {
              ok: false,
              message: `${effect.label || "弃公共牌并结算左上角"}：公共牌不足 ${count} 张`,
            };
          }
        }
        if (
          effect?.type === aomomo?.EFFECT_LAND_SCORE_IF_AOMOMO
          || effect?.type === "aomomo_land_only"
        ) {
          const options = abilities.planet.getLandOptions(context, {
            ...(effect.options || {}),
            skipCost: true,
            target: { type: "planet" },
          });
          if (!options.ok) return { ok: false, message: options.message || "当前不能执行奥陌陌登陆" };
        }
        if (effect?.type === amiba?.EFFECT_TYPES?.REMOVE_TRACE_FOR_REGION_REWARD) {
          const currentPlayer = getWorkingCurrentPlayer(workingRoot);
          const alienSlotId = workingRoot.alienGameState.amiba?.revealedSlotId;
          const options = amiba?.listPlayerTraceOptions?.(workingRoot.alienGameState, alienSlotId, currentPlayer) || [];
          if (!options.length) return { ok: false, message: "没有可移除的阿米巴痕迹" };
        }
        if (effect?.type === aomomo?.EFFECT_FOSSIL_FOR_MOVE_AND_LAND) {
          const currentPlayer = getWorkingCurrentPlayer(workingRoot);
          const fossilCost = Math.max(1, Math.round(aiNumber(effect.options?.cost) || 1));
          if (!players.canAfford(currentPlayer, { aomomoFossils: fossilCost })) continue;
          const moveCandidates = listAiEffectMoveCandidates(workingRoot, {
            id: "cardMove",
            player: effectPlayer,
            effect: {
              ...effect,
              type: cardEffects.EFFECT_TYPES.CARD_MOVE,
              options: { movementPoints: Math.max(1, Math.round(aiNumber(effect.options?.movement) || 2)) },
            },
            poolRemaining: Math.max(1, Math.round(aiNumber(effect.options?.movement) || 2)),
            nextEffect: { type: "aomomo_land_only", options: { skipCost: true, target: { type: "planet" } } },
          });
          if (!moveCandidates.length) return { ok: false, message: "当前不能执行奥陌陌移动登陆" };
        }
        if (
          effect?.type === "research_tech_select"
          || effect?.type === cardEffects.EFFECT_TYPES.RESEARCH_TECH
        ) {
          if (!listAiResearchTechCandidates(workingRoot, effect.options || null).length) {
            return { ok: false, message: `${effect.label || "科技"}：没有安全的可研究科技` };
          }
        }
        if (effect?.type === cardEffects.EFFECT_TYPES.CARD_MOVE) {
          const moveCandidates = listAiEffectMoveCandidates(workingRoot, {
            id: "cardMove",
            player: effectPlayer,
            effect,
            poolRemaining: effect?.options?.movementPoints ?? 1,
            nextEffect,
          });
          if (!moveCandidates.length) return { ok: false, message: "没有可移动的飞船" };
        }
        if (effect?.type === cardEffects.EFFECT_TYPES.CONDITIONAL_SECTOR_SCAN) {
          const sectorXs = getSectorXsMatchingCondition(effect.options?.condition)
            .filter(sectorXHasAvailableScanTarget);
          if (!sectorXs.length) return { ok: false, message: `${effect.label || "条件扇区扫描"}：没有符合条件的扇区` };
        }
      }
      return { ok: true };
    }

    function buildAiPlayCardCandidate(workingRoot, card, handIndex, currentPlayer = getWorkingCurrentPlayer(workingRoot)) {
      requireWorkingRoot(workingRoot);
      if (!isAiSupportedHandPlayCard(card)) return null;
      const cost = getCardPlayCost(card);
      if (!players.canAfford(currentPlayer, cost)) return null;
      const price = getCardPrice(card);
      const typeCode = getCardTypeCode(card);
      const model = cardEffects.getCardModel?.(card) || null;
      const playEffects = getAiPlayEffectsForCard(card);
      const effectCheck = canAiResolvePlayCardEffects(workingRoot, playEffects, currentPlayer);
      if (!effectCheck.ok) return null;
      if (getAiRunezuPrematureSymbolCardReason(card, playEffects, currentPlayer)) return null;
      const reservesAfterPlay = doesAiCardReserveAfterPlay(card, typeCode, model);
      const finalFormulaDeltas = getAiPlayCardFinalFormulaDeltas(card, {
        player: currentPlayer,
        model,
        typeCode,
        reservesAfterPlay,
      });
      const readyTaskCashout = getAiReadyHandTaskCashout(card, model, currentPlayer);
      const endGameExpectedScore = scoreAiCardEndGameExpectedValue(card, model, currentPlayer);
      const plan = scoreAiPlayCardRoutePlan(card, model, playEffects, currentPlayer);
      const directScoreGain = getAiRewardDirectScore(playEffects, currentPlayer, { immediate: true, workingRoot });
      const standardActionPremium = scoreAiCardStandardActionPremium(playEffects, currentPlayer);
      const readyTaskTechReplacementValue = scoreAiReadyTaskTechReplacementValue(
        workingRoot,
        playEffects,
        readyTaskCashout,
        currentPlayer,
      );
      const effectValue = playEffects.reduce((total, effect) => (
        total + scoreAiEffectValue(effect, { player: currentPlayer, immediate: true })
      ), 0);
      const strategyPassivePlayValue = scoreAiStrategyPassiveCardPlayValue(card, currentPlayer);
      const industryCard = getAiIndustryCard(currentPlayer);
      const isHuanyuLowTailWithoutTasks = Boolean(
        (industryCard?.id === AI_HUANYU_SUPERDRIVE_INDUSTRY_ID
          || industryCard?.label === AI_HUANYU_SUPERDRIVE_INDUSTRY_LABEL)
        && Math.max(0, Math.round(aiNumber(currentPlayer.completedTaskCount))) === 0
        && getAiHighScorePushProfile(currentPlayer).projectedScore < 150
      );
      const finalUnreadyTaskSetupSuppressed = Boolean(
        isHuanyuLowTailWithoutTasks
        && getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && countAiFinalMarksForPlayer(currentPlayer) >= 3
        && !getAiNextMissingFinalScoreThreshold(currentPlayer)
        && aiNumber(currentPlayer.resources?.score) >= 70
        && aiNumber(currentPlayer.resources?.score) < 155
        && model?.tasks?.length
        && readyTaskCashout.count <= 0
        && !model?.endGameScoring
        && typeCode !== 3
      );
      const cFinalTaskProgressValue = model?.tasks?.length && !finalUnreadyTaskSetupSuppressed
        ? scoreAiCFinalTaskProgressValue(currentPlayer, model.tasks.length)
        : 0;
      const lateCardEnginePressure = scoreAiLatePlayCardEnginePressure(card, {
        player: currentPlayer,
        model,
        playEffects,
        typeCode,
        endGameExpectedScore,
        plan,
        suppressTaskSetup: finalUnreadyTaskSetupSuppressed,
      });
      const playCardConversionPressure = scoreAiPlayCardConversionPressure(card, {
        player: currentPlayer,
        model,
        playEffects,
        typeCode,
        endGameExpectedScore,
        plan,
        standardActionPremium,
        lateCardEnginePressure,
        cFinalTaskProgressValue,
        suppressTaskSetup: finalUnreadyTaskSetupSuppressed,
      });
      const routePlanCashout = Boolean(
        plan?.movePreview?.followupLanding?.directScoreGain > 0
        || plan?.postLaunchMovePlan?.followupDirectScore > 0
        || plan?.actionId === "land"
        || plan?.actionId === "orbit"
      );
      const finalSecondMarkNoDirectSetupPenalty = scoreAiFinalSecondMarkNoDirectSetupPenalty(currentPlayer, {
        actionId: "playCard",
        directScoreGain,
        setupScore: Math.max(0, aiNumber(plan?.score), standardActionPremium),
        consumesHand: true,
        cost,
        noCashoutRoute: !routePlanCashout,
        playCardConversionPressure,
      });
      const finalRoundResourceDrainPenalty = scoreAiFinalRoundPlayCardResourceDrainPenalty(card, {
        player: currentPlayer,
        model,
        cost,
        directScoreGain,
        routePlanCashout,
      });
      const c2Type3ProgressValue = typeCode === 3 ? scoreAiC2Type3ProgressValue(currentPlayer) : 0;
      const chongTaskChainValue = scoreAiChongCardTaskChainValue(card, currentPlayer);
      const banrenmaThresholdSetupValue = scoreAiBanrenmaCardThresholdSetupValue(card, currentPlayer);
      const score = scoreAiPlayCardValue(workingRoot, card, {
        player: currentPlayer,
        model,
        playEffects,
        cost,
        price,
        typeCode,
        reservesAfterPlay,
        endGameExpectedScore,
        plan,
        directScoreGain,
        playCardConversionPressure,
        finalSecondMarkNoDirectSetupPenalty,
        finalRoundResourceDrainPenalty,
        chongTaskChainValue,
        banrenmaThresholdSetupValue,
        effectValue,
        standardActionPremium,
        strategyPassivePlayValue,
        cFinalTaskProgressValue,
      });
      const hasPersistentModeledValue = Boolean(
        (reservesAfterPlay && (
          model?.tasks?.length
          || model?.triggers?.length
          || model?.endGameScoring
          || model?.pluto
          || typeCode === 3
        ))
        || isAiAlienMainPlayCard(card)
      );
      const concretePlayValue = Math.max(
        0,
        effectValue,
        directScoreGain,
        standardActionPremium,
        readyTaskCashout.value,
        readyTaskTechReplacementValue,
        chongTaskChainValue,
        banrenmaThresholdSetupValue,
        strategyPassivePlayValue,
        endGameExpectedScore,
        c2Type3ProgressValue,
        cFinalTaskProgressValue,
        aiNumber(plan?.score),
      );
      if (!hasPersistentModeledValue && concretePlayValue <= 0) return null;
      const finalNoThresholdDeadPlay = getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && countAiFinalMarksForPlayer(currentPlayer) >= 3
        && !getAiNextMissingFinalScoreThreshold(currentPlayer)
        && score < 0
        && directScoreGain <= 0
        && Math.max(0, scoreAiFinalFormulaDeltaValue(finalFormulaDeltas, currentPlayer, {
          includePotential: true,
          potentialScale: 0.45,
        })) <= 0
        && c2Type3ProgressValue <= 0
        && cFinalTaskProgressValue <= 0
        && chongTaskChainValue <= 0
        && banrenmaThresholdSetupValue <= 0
        && endGameExpectedScore <= 0
        && playCardConversionPressure <= 0
        && standardActionPremium <= 0
        && Math.max(0, aiNumber(plan?.score)) <= 0;
      if (finalNoThresholdDeadPlay) return null;
      return {
        id: "playCard",
        kind: "main",
        available: true,
        handIndex,
        cardId: card.cardId || card.id || null,
        cardInstanceId: card.id || null,
        cardLabel: getAiCardDisplayLabel({ card, cardId: card.cardId || card.id || null }, currentPlayer),
        alienCard: isAiAlienMainPlayCard(card),
        price,
        cost,
        typeCode,
        reservesAfterPlay,
        effectTypes: playEffects.map((effect) => effect?.type || null).filter(Boolean),
        plan: plan?.score > 0 ? plan : null,
        finalFormulaDeltas,
        directScoreGain,
        score,
        valueBreakdown: {
          costValue: scoreAiResourceBundle(cost),
          cornerOpportunity: scoreAiCardCornerOpportunity(card),
          directScoreGain,
          effectValue,
          strategyPassivePlayValue,
          c2Type3ProgressValue,
          cFinalTaskProgressValue,
          finalUnreadyTaskSetupSuppressed,
          readyTaskCashoutValue: readyTaskCashout.value,
          readyTaskCashoutDirectScore: readyTaskCashout.directScore,
          readyTaskCashoutCount: readyTaskCashout.count,
          readyTaskTechReplacementValue,
          chongTaskChainValue,
          banrenmaThresholdSetupValue,
          playCardConversionPressure,
          lateCardEnginePressure,
          endGameExpectedScore,
          finalRoundEndGameCardUrgency: scoreAiFinalRoundEndGameCardUrgency(
            typeCode,
            model,
            currentPlayer,
            endGameExpectedScore,
            c2Type3ProgressValue,
          ),
          planScore: plan?.score || 0,
          standardActionPremium,
          finalSecondMarkNoDirectSetupPenalty,
          finalRoundResourceDrainPenalty,
        },
      };
    }

    function listAiPlayCardCandidates(workingRoot, currentPlayer = getWorkingCurrentPlayer(workingRoot)) {
      requireWorkingRoot(workingRoot);
      return (currentPlayer?.hand || [])
        .map((card, handIndex) => buildAiPlayCardCandidate(workingRoot, card, handIndex, currentPlayer))
        .filter(Boolean);
    }

    function getAiDiscardedCardOpportunityCost(card, playCandidate = null) {
      const baseValue = ai?.valuation?.getCardValue
        ? ai.valuation.getCardValue(card, { defaultCardValue: 3, alienCardValue: 5.5 })
        : 3;
      const playValue = Math.max(0, aiNumber(playCandidate?.score)) * 0.35;
      return Math.max(baseValue, playValue);
    }

    function scoreAiD2ResearchTechPreserveValue(card, playCandidate = null, player = getCurrentPlayer()) {
      if (!card || !player) return 0;
      if (!getAiMarkedFinalFormulaEntries(player).some((entry) => entry.formulaId === "d2")) return 0;
      const effectTypes = playCandidate?.effectTypes || getAiPlayEffectsForCard(card).map((effect) => effect?.type || null);
      const grantsTech = effectTypes.includes(cardEffects.EFFECT_TYPES.RESEARCH_TECH)
        || effectTypes.includes("research_tech_select")
        || effectTypes.includes("card_research_tech");
      if (!grantsTech) return 0;
      const techCount = getAiTechCountForPlayer(player);
      const d2Entries = getAiMarkedFinalFormulaEntries(player)
        .filter((entry) => entry.formulaId === "d2");
      const d2Marginal = d2Entries.reduce((total, entry) => {
        const multiplier = Math.max(1, aiNumber(entry.multiplier));
        const beforeBase = Math.floor(Math.max(0, techCount) / 2);
        const afterBase = Math.floor((Math.max(0, techCount) + 1) / 2);
        return total + Math.max(0, afterBase - beforeBase) * multiplier;
      }, 0);
      return d2Marginal > 0 ? d2Marginal * 0.85 : 2.5;
    }

    function getAiCardCornerRewardValue(workingRoot, card, player = players.getCurrentPlayer(workingRoot.playerState)) {
      const resourceReward = cards.getDiscardActionRewardForCard(card);
      const moveReward = cards.getDiscardActionMoveRewardForCard?.(card);
      let value = 0;
      if (resourceReward) {
        value += scoreAiResourceBundle(resourceReward.gain || {});
        value += Math.max(0, Math.round(aiNumber(resourceReward.dataCount))) * AI_RESOURCE_VALUES.availableData;
      }
      if (moveReward) {
        value += scoreAiResourceBundle(moveReward.gain || {});
        const moveCandidates = listAiEffectMoveCandidates(workingRoot, {
          id: "cardCornerMovePreview",
          free: true,
          player,
          poolRemaining: moveReward.movementPoints || 1,
        }).sort((left, right) => Number(right.score || 0) - Number(left.score || 0));
        const bestMove = moveCandidates[0] || null;
        if (!bestMove) return { value: -Infinity, resourceReward, moveReward, bestMove: null };
        const bestMoveScore = aiNumber(bestMove.score);
        if (bestMoveScore < 0) return { value: -Infinity, resourceReward, moveReward, bestMove };
        value += Math.max(0, Math.round(aiNumber(moveReward.movementPoints || 1))) * AI_RESOURCE_VALUES.movement;
        value += bestMoveScore * 0.45;
        return { value, resourceReward, moveReward, bestMove };
      }
      const incomeGain = cards.getIncomeGainForCard?.(card);
      if (incomeGain) value -= Math.max(0, scoreAiIncomeOpportunityValue(player, incomeGain)) * 0.2;
      return { value, resourceReward, moveReward, bestMove: null };
    }

    function scoreAiFinalFormulaDeltaValue(deltas = {}, player = getCurrentPlayer(), options = {}) {
      if (!deltas || !player) return 0;
      const formulaIds = Object.keys(deltas).filter((formulaId) => aiNumber(deltas[formulaId]) !== 0);
      const entries = options.includePotential
        ? getAiPlanningFinalFormulaEntries(player, formulaIds)
        : getAiMarkedFinalFormulaEntries(player)
          .filter((entry) => !formulaIds.length || formulaIds.includes(entry.formulaId));
      const potentialScale = Math.max(0, aiNumber(options.potentialScale ?? 0.55));
      return entries.reduce((total, entry) => {
        const delta = aiNumber(deltas[entry.formulaId]);
        if (!delta) return total;
        const entryScale = entry.potential ? potentialScale : 1;
        return total + delta * Math.max(1, aiNumber(entry.multiplier)) * entryScale;
      }, 0);
    }

    function getAiCardCornerResourceGain(reward = {}) {
      const resourceReward = reward.resourceReward || null;
      const gain = { ...(resourceReward?.gain || {}) };
      const dataCount = Math.max(0, Math.round(aiNumber(resourceReward?.dataCount)));
      if (dataCount > 0) gain.availableData = aiNumber(gain.availableData) + dataCount;
      return gain;
    }

    function scoreAiCardCornerFollowupMainUnlock(workingRoot, reward, player = getWorkingCurrentPlayer(workingRoot)) {
      if (!player || !canStartMainAction()) return null;
      const gain = getAiCardCornerResourceGain(reward);
      const publicityGain = Math.max(0, aiNumber(gain.publicity));
      if (publicityGain <= 0) return null;
      const researchCost = tech.resolver?.getResearchPublicityCost?.(player)
        ?? tech.RESEARCH_PUBLICITY_COST
        ?? 6;
      const currentPublicity = Math.max(0, aiNumber(player.resources?.publicity));
      const publicityLimit = players.RESOURCE_LIMITS?.publicity ?? 10;
      const projectedPublicity = Math.min(publicityLimit, currentPublicity + publicityGain);
      if (currentPublicity >= researchCost || projectedPublicity < researchCost) return null;
      const round = getAiRoundNumber();
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      const markedTechFinalEntries = getAiMarkedFinalFormulaEntries(player)
        .filter((entry) => entry.formulaId === "d1" || entry.formulaId === "d2");
      if (round < FINAL_ROUND_NUMBER && (!markedTechFinalEntries.length || currentScore < 50)) return null;
      if (round >= FINAL_ROUND_NUMBER && currentScore < 70 && !markedTechFinalEntries.length) return null;
      createActionContext(workingRoot).ensurePlayerTechState?.(player);
      if (!player.techState) return null;
      const takeableTech = tech.listTakeableTiles(workingRoot.techGameState.board, player.techState)
        .map((tileId) => buildAiResearchTechCandidate(workingRoot, tileId))
        .filter((candidate) => candidate.available !== false);
      const bestTechCandidate = takeableTech
        .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null;
      if (!bestTechCandidate) return null;
      const techScore = Math.max(0, aiNumber(bestTechCandidate.score));
      const finalDeltaValue = Math.max(0, scoreAiFinalFormulaDeltaValue(bestTechCandidate.finalFormulaDeltas, player));
      const followupScore = techScore * 0.32 + finalDeltaValue * 0.8;
      if (followupScore <= 0) return null;
      return {
        actionId: "researchTech",
        label: "角标补宣传后研究科技",
        score: followupScore,
        unlockedBy: { publicity: publicityGain },
        researchCost,
        selectedTech: {
          tileId: bestTechCandidate.tileId,
          techType: bestTechCandidate.techType,
          bonusId: bestTechCandidate.bonusId,
          score: roundAiScore(bestTechCandidate.score),
          finalFormulaDeltas: bestTechCandidate.finalFormulaDeltas || {},
          finalDeltaValue: roundAiScore(finalDeltaValue),
        },
      };
    }

    function getAiNextTurnMoveFollowupScale() {
      return getAiRoundNumber() <= 2 ? 0.24 : 0.16;
    }

    function scoreAiCardCornerMoveFollowupMainAction(coordinate, player = getCurrentPlayer()) {
      if (!coordinate) return null;
      const immediate = Boolean(canStartMainAction() && !state.pendingActionExecuted);
      const followup = scoreAiFollowupMainActionAfterMove(coordinate, player, {
        ignoreMainActionUsed: !immediate,
      });
      const rawScore = Math.max(0, aiNumber(followup?.score));
      if (rawScore <= 0) return followup;
      const scoreScale = immediate ? 1 : getAiNextTurnMoveFollowupScale();
      return {
        ...followup,
        timing: immediate ? "immediate" : "next_turn",
        rawScore: roundAiScore(rawScore),
        scoreScale,
        score: roundAiScore(rawScore * scoreScale),
      };
    }

    function scoreAiCardCornerStagedTechSetup(reward, player = getCurrentPlayer()) {
      if (!player || !canStartMainAction()) return 0;
      const gain = getAiCardCornerResourceGain(reward);
      const publicityGain = Math.max(0, aiNumber(gain.publicity));
      if (publicityGain <= 0) return 0;

      const researchCost = tech.resolver?.getResearchPublicityCost?.(player)
        ?? tech.RESEARCH_PUBLICITY_COST
        ?? 6;
      const currentPublicity = Math.max(0, aiNumber(player.resources?.publicity));
      const publicityLimit = players.RESOURCE_LIMITS?.publicity ?? 10;
      const projectedPublicity = Math.min(publicityLimit, currentPublicity + publicityGain);
      if (currentPublicity >= researchCost || projectedPublicity >= researchCost) return 0;

      const shortfallAfter = Math.max(0, researchCost - projectedPublicity);
      if (shortfallAfter > 2) return 0;

      const round = getAiRoundNumber();
      if (round < 2) return 0;
      const markedTechFinalEntries = getAiMarkedFinalFormulaEntries(player)
        .filter((entry) => entry.formulaId === "d1" || entry.formulaId === "d2");
      const techCount = countAiPlayerTech(player);
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      const lowTechTarget = round >= FINAL_ROUND_NUMBER ? 10 : 8;
      if (!markedTechFinalEntries.length && !(round >= 3 && techCount < 7 && currentScore < 130)) return 0;
      if (techCount >= lowTechTarget && currentScore >= 150) return 0;

      const bestMultiplier = markedTechFinalEntries.reduce((best, entry) => (
        Math.max(best, aiNumber(entry.multiplier))
      ), 0);
      const urgency = round >= FINAL_ROUND_NUMBER ? 1 : 0.68;
      const lowTechPressure = Math.max(0, lowTechTarget - techCount) * (round >= FINAL_ROUND_NUMBER ? 0.9 : 0.55);
      const scorePressure = Math.max(0, (round >= FINAL_ROUND_NUMBER ? 165 : 105) - currentScore) * 0.025;
      const shortfallScale = shortfallAfter <= 1 ? 1 : 0.62;
      return roundAiScore(Math.min(
        10,
        (3.2 + lowTechPressure + bestMultiplier * 0.22 + scorePressure) * urgency * shortfallScale,
      ));
    }

    function buildAiCardCornerQuickCandidate(workingRoot, card, handIndex, currentPlayer, options = {}) {
      if (!card) return null;
      const moveReward = cards.getDiscardActionMoveRewardForCard?.(card);
      if (moveReward && !canAiUseCardCornerMoveThisTurn(workingRoot, currentPlayer?.id)) return null;
      const reward = getAiCardCornerRewardValue(workingRoot, card, currentPlayer);
      if (!reward.resourceReward && !reward.moveReward) return null;
      if (!Number.isFinite(Number(reward.value))) return null;
      const directScoreGain = Math.max(
        0,
        aiNumber(reward.resourceReward?.gain?.score),
        aiNumber(reward.moveReward?.gain?.score),
      );
      const playCandidate = options.playCandidateByIndex?.get(handIndex) || null;
      const handSize = Math.max(0, (currentPlayer?.hand || []).length);
      const unplayableCount = Math.max(0, aiNumber(options.unplayableCount));
      const model = cardEffects.getCardModel?.(card) || null;
      const typeCode = getCardTypeCode(card);
      let handPressure = Math.max(0, handSize - 5) * 1.45 + Math.max(0, unplayableCount - 5) * 1.8;
      if (model?.tasks?.length || model?.endGameScoring || typeCode === 3) handPressure *= 0.45;
      else if (playCandidate) handPressure *= 0.75;
      const discardCost = getAiDiscardedCardOpportunityCost(card, playCandidate);
      const preservePenalty = scoreAiD2ResearchTechPreserveValue(card, playCandidate, currentPlayer);
      const playablePenalty = playCandidate ? Math.min(4, Math.max(0, playCandidate.score) * 0.18) : 0;
      const c2Type3ProgressValue = typeCode === 3 ? scoreAiC2Type3ProgressValue(currentPlayer) : 0;
      const cFinalTaskProgressValue = model?.tasks?.length
        ? scoreAiCFinalTaskProgressValue(currentPlayer, model.tasks.length)
        : 0;
      const endGameExpectedScore = playCandidate?.valueBreakdown?.endGameExpectedScore
        ?? scoreAiCardEndGameExpectedValue(card, model, currentPlayer);
      const alienCard = isAiAlienMainPlayCard(card);
      const moveFollowupMainAction = reward.bestMove?.to
        ? scoreAiCardCornerMoveFollowupMainAction(reward.bestMove.to, currentPlayer)
        : null;
      const moveFollowupScore = Math.max(0, aiNumber(moveFollowupMainAction?.score));
      const moveFollowupRawScore = Math.max(0, aiNumber(
        moveFollowupMainAction?.rawScore ?? moveFollowupMainAction?.score,
      ));
      const moveFollowupScoreScale = Math.max(0, aiNumber(moveFollowupMainAction?.scoreScale ?? 1));
      const moveFollowupDirectScore = Math.max(
        0,
        aiNumber(moveFollowupMainAction?.directScoreGain),
        aiNumber(reward.bestMove?.valueBreakdown?.landingDirectScoreGain),
      );
      const moveHasCashout = !reward.moveReward || moveFollowupScore > 0 || moveFollowupDirectScore > 0;
      const taskPreserveCashoutMultiplier = reward.moveReward && moveHasCashout
        ? moveFollowupDirectScore > 0 ? 0.25 : 0.45
        : 1;
      const finalCardPreservePenalty = (
        getAiRoundNumber() >= 3
        && (typeCode === 3 || model?.endGameScoring)
      )
        ? Math.min(
          14,
          2
            + Math.max(0, aiNumber(c2Type3ProgressValue)) * 0.55
            + Math.max(0, aiNumber(endGameExpectedScore)) * 0.45
            + Math.max(0, aiNumber(playCandidate?.score)) * 0.12,
        )
        : 0;
      const taskCardPreservePenalty = model?.tasks?.length
        ? Math.max(
          scoreAiUnplayedTaskCardPreserveValue(card, model, playCandidate, currentPlayer)
            * taskPreserveCashoutMultiplier,
          getAiRoundNumber() >= 2
            ? Math.min(
              14,
              3
                + Math.max(0, aiNumber(cFinalTaskProgressValue)) * 0.75
                + Math.max(0, aiNumber(playCandidate?.score)) * 0.12,
            )
            : 0,
        )
        : 0;
      const alienCardPreservePenalty = alienCard && getAiRoundNumber() >= 2
        ? Math.min(12, 4 + Math.max(0, aiNumber(playCandidate?.score)) * 0.18)
        : 0;
      const valuableDiscardedCard = Boolean(model?.tasks?.length || typeCode === 3 || model?.endGameScoring || alienCard);
      const noCashoutMovePenalty = reward.moveReward && !moveHasCashout
        ? Math.min(
          22,
          (getAiRoundNumber() >= 3 ? 8 : 5)
            + (valuableDiscardedCard ? (getAiRoundNumber() >= 2 ? 10 : 5) : 0)
            + Math.max(0, aiNumber(discardCost) - 3) * 0.45,
        )
        : 0;
      const lowValueBias = Math.max(0, 4.5 - discardCost) * 0.65;
      const scorePaceBonus = directScoreGain > 0
        ? scoreAiThresholdPressureForScoreGain(directScoreGain, currentPlayer) * 0.8
        : 0;
      const followupMainAction = scoreAiCardCornerFollowupMainUnlock(workingRoot, reward, currentPlayer);
      const followupMainActionScore = Math.max(0, aiNumber(followupMainAction?.score));
      const stagedTechSetupScore = followupMainActionScore > 0
        ? 0
        : scoreAiCardCornerStagedTechSetup(reward, currentPlayer);
      const finalSecondMarkNoDirectSetupPenalty = scoreAiFinalSecondMarkNoDirectSetupPenalty(currentPlayer, {
        actionId: "cardCorner",
        directScoreGain,
        followupDirectScore: followupMainAction?.directScoreGain,
        setupScore: reward.value + followupMainActionScore + stagedTechSetupScore,
        consumesHand: true,
        consumesLastHand: handSize <= 1,
        noCashoutRoute: followupMainActionScore <= 0 && stagedTechSetupScore <= 0,
      });
      const score = reward.value
        - discardCost
        - preservePenalty
        - playablePenalty
        - finalCardPreservePenalty
        - taskCardPreservePenalty
        - alienCardPreservePenalty
        - noCashoutMovePenalty
        - finalSecondMarkNoDirectSetupPenalty
        + handPressure
        + lowValueBias
        + scorePaceBonus
        + followupMainActionScore
        + stagedTechSetupScore;
      if (
        getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && getAiNextMissingFinalScoreThreshold(currentPlayer)
        && directScoreGain <= 0
        && followupMainActionScore <= 0
        && stagedTechSetupScore <= 0
        && score < 2.5
      ) {
        return null;
      }
      if (handPressure <= 0 && score < 2.5) return null;
      if (reward.moveReward && !moveHasCashout && valuableDiscardedCard && score < 8) return null;
      return {
        id: "cardCorner",
        kind: "quick",
        available: true,
        handIndex,
        cardId: card.cardId || card.id || null,
        cardInstanceId: card.id || null,
        cardLabel: getAiCardDisplayLabel({ card, cardId: card.cardId || card.id || null }, currentPlayer),
        actionKind: reward.moveReward ? "move" : "resource",
        reward: reward.resourceReward || null,
        moveReward: reward.moveReward || null,
        followupMainAction,
        moveFollowupMainAction,
        directScoreGain,
        gain: reward.value + scorePaceBonus + followupMainActionScore + stagedTechSetupScore,
        cost: discardCost
          + preservePenalty
          + playablePenalty
          + finalCardPreservePenalty
          + taskCardPreservePenalty
          + alienCardPreservePenalty
          + noCashoutMovePenalty
          + finalSecondMarkNoDirectSetupPenalty,
        score,
        finalFormulaDeltas: {
          a1: reward.resourceReward || reward.moveReward ? 0.25 : 0,
          a2: reward.resourceReward || reward.moveReward ? 0.25 : 0,
        },
        valueBreakdown: {
          rewardValue: reward.value,
          discardCost,
          preservePenalty,
          playablePenalty,
          finalCardPreservePenalty,
          taskCardPreservePenalty,
          alienCardPreservePenalty,
          noCashoutMovePenalty,
          moveFollowupScore,
          moveFollowupRawScore,
          moveFollowupScoreScale,
          moveFollowupTiming: moveFollowupMainAction?.timing || null,
          moveFollowupDirectScore,
          moveHasCashout,
          handPressure,
          lowValueBias,
          scorePaceBonus,
          followupMainActionScore,
          stagedTechSetupScore,
          finalSecondMarkNoDirectSetupPenalty,
        },
      };
    }

    function listAiCardCornerQuickCandidates(workingRoot, currentPlayer = players.getCurrentPlayer(workingRoot.playerState), playCardCandidates = null) {
      if (!currentPlayer || !handleHandCardCornerQuickAction || !confirmCardCornerQuickAction) return [];
      const hand = currentPlayer.hand || [];
      const playableCards = playCardCandidates || listAiPlayCardCandidates(workingRoot, currentPlayer);
      const playCandidateByIndex = new Map(playableCards.map((candidate) => [candidate.handIndex, candidate]));
      const unplayableCount = hand.reduce((count, _card, index) => (
        count + (playCandidateByIndex.has(index) ? 0 : 1)
      ), 0);
      return hand
        .map((card, handIndex) => buildAiCardCornerQuickCandidate(workingRoot, card, handIndex, currentPlayer, {
          playCandidateByIndex,
          unplayableCount,
        }))
        .filter(Boolean)
        .sort((left, right) => Number(right.score || 0) - Number(left.score || 0));
    }
    return Object.freeze({
      getAiPlayEffectsForCard,
      isAiAlienMainPlayCard,
      doesAiCardReserveAfterPlay,
      isAiSupportedHandPlayCard,
      listAiChongTravelChoicesForOptions,
      getAiChongLandOptions,
      getAiChongOrbitOrLandOptions,
      canAiResolveChongTravelEffect,
      canAiResolvePlayCardEffects,
      buildAiPlayCardCandidate,
      listAiPlayCardCandidates,
      getAiDiscardedCardOpportunityCost,
      scoreAiD2ResearchTechPreserveValue,
      getAiCardCornerRewardValue,
      scoreAiFinalFormulaDeltaValue,
      getAiCardCornerResourceGain,
      scoreAiCardCornerFollowupMainUnlock,
      getAiNextTurnMoveFollowupScale,
      scoreAiCardCornerMoveFollowupMainAction,
      scoreAiCardCornerStagedTechSetup,
      buildAiCardCornerQuickCandidate,
      listAiCardCornerQuickCandidates,
    });
  }

  return Object.freeze({ createCardCandidates });
});
