(function (root, factory) {
  "use strict";

  let heuristicEvaluator = root.SetiHeuristicEvaluator;
  if (!heuristicEvaluator && typeof require === "function") {
    heuristicEvaluator = require("../../game/ai/heuristic-evaluator");
  }
  const api = factory(heuristicEvaluator);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppAiInitialCardPending = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (heuristicEvaluator) {
  "use strict";

  function createInitialCardPendingRuntime(context) {
    if (!context || typeof context !== "object") {
      throw new Error("createInitialCardPendingRuntime requires explicit app context");
    }
    const {
      AI_DEEPSPACE_SWAP_MIN_SCORE, AI_STYLE_SEAT_ORDER, INITIAL_SELECTION_REQUIRED, abilities, ai, aiAutoBattleState, aiNumber,
      aliens, allowsBlindDrawInSelection, amiba, applyAiDifficultyToPlayer, banrenma, canAiResolveAlienTraceEffect, canAiResolvePlayCardEffects,
      canBlindDraw, cancelCardTriggerChoice, cardEffects, cards, chooseAiIncomeDiscardIndexes, chooseAiTradeDiscardIndexes, confirmCardCornerQuickAction,
      confirmCardTaskCompletion, confirmInitialSelectionForCurrentPlayer, confirmPassReserveSelection, confirmPublicCornerDiscardSelection, confirmPublicScanSelection, createActionContext, drawCardForCurrentPlayer, executeFreeMoveForCardTrigger,
      finalizePendingDiscardSelection, getActivePlayers, getAiAutoBattlePendingState, getAiAutoBattlePlayerIds, getAiBestDeepspaceSwap, getAiBestHandScanIndex, getAiBestPublicScanSlots, getAiCardDisplayLabel,
      getAiDifficultyLabel, getAiIncomeDiscardPreview, getAiIncomeFinalFormulaEntries, getAiLaunchPaymentCost, getAiLiveScorePaceDeficit, getAiLowEngineCatchupProfile, getAiMarkedFinalFormulaEntries, getAiPassReserveResourcePressure,
      getAiRoundNumber, getCardTypeCode, getInitialSelectionOffer, getPassReserveSelectionCards,
      getPlayerLabelById, getReadyCardTasks, handleCardTriggerChoice, handleHandCardCornerQuickAction, handleHandScanCardClick, handleIndustryDeepspaceHandClick, handlePublicCardClick,
      handlePublicCornerDiscardCardClick, handlePublicScanCardClick, hasActivePendingSubFlow, hasAiRunezuPassReservePressure, isActionEffectFlowActive, isAiAutoBattlePlayer, isAiIncomeDiscardType, isAiPassReservePreviewIncomeCandidate,
      isCardSelectionActive, isDiscardSelectionActive, isHandScanSelectionActive, isIndustryHandSelectionActive, isInitialSelectionActive, isPublicScanMultiSelectActive, listAiEffectMoveCandidates,
      listAiPlayCardCandidates, openBanrenmaReadyOpportunityForPlayer, openCardTaskCompletionPicker, openRunezuFaceSymbolPlacement, pickPublicCardForCurrentPlayer, players, recordAiAutoBattleLog,
      rocketActions, roundAiScore, runezu, scoreAiAlienTraceValue, scoreAiB1TraceMarginalValue, scoreAiChongTraceTaskProgressValue, scoreAiChongTransportCompletionValue,
      scoreAiEffectValue, scoreAiPassReserveCard, scoreAiPublicPickCard, scoreAiRunezuFaceDependencyUnlockValue, scoreAiRunezuFaceRewardValue, scoreAiRunezuFaceSymbolPlacementChoice, scoreAiRunezuSpendSymbolFinalPenalty, selectPassReserveCard,
      skipCurrentActionEffect, state, summarizeAiPublicPickCandidate,
    } = context;

    function requireWorkingRoot(workingRoot) {
      if (!workingRoot || typeof workingRoot !== "object") throw new TypeError("AI initial/card pending requires an explicit workingRoot");
      return workingRoot;
    }

    function getWorkingCurrentPlayer(workingRoot) {
      return players.getCurrentPlayer(requireWorkingRoot(workingRoot).playerState);
    }

    function resolveWorkingPlayerById(workingRoot, playerId) {
      return (requireWorkingRoot(workingRoot).playerState.players || []).find((player) => player.id === playerId) || null;
    }
    const selectScoredItem = ai?.heuristicEvaluator?.selectScoredItem || heuristicEvaluator.selectScoredItem;

    function decidePolicyChoice(workingRoot, family, player, decisionId, choices) {
      const { turnState } = requireWorkingRoot(workingRoot);
      return ai?.heuristicPolicy?.decideChoice?.({
        seatId: player?.id,
        family,
        stateVersion: Math.max(0, Number(turnState.roundNumber) || 0),
        decisionVersion: Math.max(0, Number(turnState.turnNumber) || 0),
        decisionId,
        requestId: `browser:${player?.id}:${decisionId}:${turnState.roundNumber || 0}:${turnState.turnNumber || 0}`,
        observation: {
          publicState: { roundNumber: turnState.roundNumber || 0 },
          selfState: { playerId: player?.id || null },
        },
        choices,
      }) || { ok: false, code: "HEURISTIC_POLICY_NOT_CONFIGURED", message: "公共 Heuristic Policy 未装配" };
    }

    function getOrderedAiAutoBattlePlayerIds(workingRoot) {
      const { turnState } = requireWorkingRoot(workingRoot);
      const aiIds = new Set(getAiAutoBattlePlayerIds());
      const ordered = (turnState.activePlayerIds || []).filter((playerId) => aiIds.has(playerId));
      for (const playerId of aiIds) {
        if (!ordered.includes(playerId)) ordered.push(playerId);
      }
      return ordered;
    }

    function getAiStyleFallbackIndex(workingRoot, playerId) {
      const orderedAiIds = getOrderedAiAutoBattlePlayerIds(workingRoot);
      const index = orderedAiIds.indexOf(playerId);
      return index >= 0 ? index : 0;
    }

    function getAiSeatStyle(workingRoot, playerId) {
      const index = getAiStyleFallbackIndex(workingRoot, playerId);
      return AI_STYLE_SEAT_ORDER[index % AI_STYLE_SEAT_ORDER.length] || "balanced";
    }

    function inferAiStyleFromOpening(workingRoot, openingPlan = null, industryCard = null, player = null) {
      const summary = openingPlan?.summary || {};
      const goals = openingPlan?.goals || {};
      const scanScore = aiNumber(summary.scan) * 1.2 + aiNumber(summary.data) * 0.5 + aiNumber(goals.GRAB_TRACE_PINK);
      const routeScore = aiNumber(summary.orbits) * 1.5 + aiNumber(summary.traces) + aiNumber(goals.GRAB_TRACE_YELLOW);
      const taskScore = aiNumber(summary.hand) * 0.45 + aiNumber(summary.incomeIncreases) * 0.35 + aiNumber(goals.OPENING_INCOME) * 0.35;
      const techScore = aiNumber(summary.credits) * 0.22 + aiNumber(summary.energy) * 0.18;
      if (
        aiNumber(summary.scan) >= 2
        && aiNumber(summary.orbits) >= 1
        && aiNumber(summary.credits) <= 4
        && scanScore >= routeScore + 2
        && taskScore > scanScore
      ) {
        return "scanner";
      }
      const scoredStyles = [
        { id: "scanner", score: scanScore },
        { id: "route", score: routeScore },
        { id: "task", score: taskScore },
        { id: "tech", score: techScore },
      ].sort((left, right) => right.score - left.score);
      if (scoredStyles[0]?.score >= 2.2 && scoredStyles[0].score >= scoredStyles[1]?.score + 0.45) {
        return scoredStyles[0].id;
      }
      const fallback = getAiSeatStyle(workingRoot, player?.id);
      return fallback || "balanced";
    }

    function chooseInitialSelectionForAiPlayer(workingRoot) {
      const { playerState, turnState } = requireWorkingRoot(workingRoot);
      if (!isInitialSelectionActive()) return null;
      const playerId = playerState.currentPlayerId;
      if (!isAiAutoBattlePlayer(playerId)) {
        return { ok: false, blocked: true, message: `${getPlayerLabelById(playerId)}不是电脑玩家，等待人类初始选择` };
      }
      const offer = getInitialSelectionOffer(playerId);
      if (!offer || offer.confirmed) return { ok: false, message: "没有可用初始选择" };
      const player = resolveWorkingPlayerById(workingRoot, playerId);
      if (player) applyAiDifficultyToPlayer(player);
      const selectionOptions = {
        roundNumber: turnState.roundNumber,
        player,
        aiDifficulty: player?.aiDifficulty,
      };
      const initialPairs = ai.selectionEvaluator.getInitialPairs(
        offer.initialOptions || [],
        INITIAL_SELECTION_REQUIRED.initial,
      );
      const openingPlans = (offer.industryOptions || []).flatMap((industry) => initialPairs.map((initialCards) => (
        ai.selectionEvaluator.scoreOpeningCombination(industry, initialCards, selectionOptions)
      ))).sort((left, right) => (
        Number(right.score || 0) - Number(left.score || 0)
        || String(left.industry?.id || "").localeCompare(String(right.industry?.id || ""))
      ));
      const policyResult = decidePolicyChoice(workingRoot, "choose_branch", player, "initial-selection", openingPlans.map((plan, index) => ({
        choiceId: `${plan.industry?.id || index}:${plan.initialCards.map((card) => card.id).join("+")}`,
        value: Number(plan.score || 0),
        target: {
          industryId: plan.industry?.id || null,
          initialIds: plan.initialCards.map((card) => card.id),
        },
        summary: `${plan.industry?.label || plan.industry?.id || "公司"} + 初始牌`,
        plan,
      })));
      if (!policyResult.ok) {
        return { ok: false, blocked: true, code: policyResult.code, message: policyResult.message };
      }
      const selectedPlan = policyResult.choice.plan;
      const industryCard = selectedPlan.industry;
      const initialSelection = selectedPlan.initialCards;
      if (!industryCard || initialSelection.length < INITIAL_SELECTION_REQUIRED.initial) {
        return { ok: false, message: "AI 初始选择候选不足" };
      }
      const evaluatedOpening = ai.selectionEvaluator.evaluateInitialSelection(offer, selectionOptions);
      const openingPlan = evaluatedOpening.industry?.id === industryCard.id
        ? evaluatedOpening.openingPlan
        : {
          score: Math.round(selectedPlan.score * 100) / 100,
          goals: selectedPlan.goals,
          summary: selectedPlan.summary,
          topPlans: evaluatedOpening.openingPlan?.topPlans || [],
        };
      const aiStyle = inferAiStyleFromOpening(workingRoot, openingPlan, industryCard, player);
      if (player) {
        player.aiStyle = aiStyle;
      }
      if (player && openingPlan) {
        player.openingPlan = {
          ...structuredClone(openingPlan),
          industryLabel: industryCard.label || industryCard.id || null,
          aiStyle,
          aiDifficulty: player.aiDifficulty,
          aiDifficultyLabel: player.aiDifficultyLabel,
        };
      }
      offer.selectedIndustryId = industryCard.id;
      offer.selectedInitialIds = initialSelection
        .slice(0, INITIAL_SELECTION_REQUIRED.initial)
        .map((card) => card.id);
      recordAiAutoBattleLog(
        "initial-selection",
        `${getPlayerLabelById(playerId)}选择 ${industryCard.label || industryCard.id}`,
        {
          industryCard,
          initialCards: initialSelection,
          openingPlan,
          aiStyle,
          aiDifficulty: player?.aiDifficulty || aiAutoBattleState.aiDifficulty,
          aiDifficultyLabel: player?.aiDifficultyLabel || getAiDifficultyLabel(),
        },
      );
      confirmInitialSelectionForCurrentPlayer();
      return { ok: true, progressed: true, message: "AI 初始选择完成" };
    }

    function runAiDiscardDecision(workingRoot) {
      const { cardState, playerState } = requireWorkingRoot(workingRoot);
      if (!isDiscardSelectionActive() || !state.pendingDiscardAction) return null;
      const pendingDiscard = state.pendingDiscardAction;
      const player = resolveWorkingPlayerById(workingRoot, pendingDiscard.playerId) || getWorkingCurrentPlayer(workingRoot);
      if (!isAiAutoBattlePlayer(player?.id)) {
        return { ok: false, blocked: true, message: `${player?.colorLabel || "当前玩家"}需要人工弃牌` };
      }
      const count = Math.max(0, Math.round(Number(pendingDiscard.count) || 0));
      const pendingType = pendingDiscard.type || null;
      const incomeGainByIndex = isAiIncomeDiscardType(pendingType)
        ? (player.hand || []).map((card) => cards.getIncomeGainForCard?.(card) || null)
        : null;
      const incomePlanningEntries = incomeGainByIndex ? getAiIncomeFinalFormulaEntries(player) : [];
      const useHeadlessRuleKernel = globalThis.SetiHeadlessRuntimeConfig?.ruleKernel === true;
      const dynamicIncomeIndexes = incomeGainByIndex && !useHeadlessRuleKernel
        ? chooseAiIncomeDiscardIndexes(workingRoot, player, count, incomeGainByIndex, incomePlanningEntries)
        : null;
      const tradeDiscardIndexes = !dynamicIncomeIndexes && pendingType === "trade"
        ? chooseAiTradeDiscardIndexes(workingRoot, player, count, pendingDiscard)
        : null;
      const preferredIndexes = dynamicIncomeIndexes || tradeDiscardIndexes || ai?.selectionEvaluator?.evaluateDiscardIndexes?.(player.hand || [], count, {
        pendingType,
        incomeGainByIndex,
      })
        || [];
      const discardChoices = [[...preferredIndexes].sort((left, right) => left - right), ...(player.hand || []).map((_card, startIndex) => {
        const indexes = Array.from({ length: count }, (_item, offset) => (startIndex + offset) % player.hand.length)
          .sort((left, right) => left - right);
        return indexes;
      })].filter((indexes, index, all) => (
        all.findIndex((other) => other.join(",") === indexes.join(",")) === index
      ));
      const discardPolicy = decidePolicyChoice(workingRoot, "choose_card", player, `discard:${pendingType || "generic"}`, discardChoices.map((indexes) => ({
        choiceId: indexes.join("+") || "none",
        value: indexes.join(",") === [...preferredIndexes].sort((left, right) => left - right).join(",") ? 1 : 0,
        target: { handIndexes: indexes },
        summary: `弃牌 ${indexes.join(",")}`,
        indexes,
      })));
      if (!discardPolicy.ok) return { ok: false, blocked: true, code: discardPolicy.code, message: discardPolicy.message };
      const selectedIndexes = discardPolicy.choice.indexes;
      const submittedIndexes = selectedIndexes.slice(0, count).sort((left, right) => left - right);
      const incomeDiscardPreview = incomeGainByIndex
        ? getAiIncomeDiscardPreview(player, count, pendingType, incomeGainByIndex, incomePlanningEntries, selectedIndexes)
        : null;
      recordAiAutoBattleLog("discard", `${player.colorLabel}AI 弃牌 ${submittedIndexes.length} 张`, {
        logPlayerId: player.id || null,
        logPlayerColor: player.color || null,
        selectedIndexes: submittedIndexes,
        selectedCards: submittedIndexes
          .map((handIndex) => {
            const card = player.hand?.[handIndex] || null;
            if (!card) return null;
            return {
              handIndex,
              cardId: card.cardId || card.id || null,
              cardInstanceId: card.id || null,
              cardLabel: cards.getCardLabel?.(card) || card.cardName || card.label || null,
            };
          })
          .filter(Boolean),
        pendingType,
        incomeGainByIndex,
        incomeDiscardPreview,
        tradeId: pendingDiscard.tradeId || null,
      });
      return finalizePendingDiscardSelection(submittedIndexes);
    }


    function runAiCardSelectionDecision(workingRoot) {
      const { cardState, playerState } = requireWorkingRoot(workingRoot);
      if (!isCardSelectionActive() && !isIndustryHandSelectionActive()) return null;
      const pending = state.pendingCardSelectionContinuation || {};
      const player = resolveWorkingPlayerById(workingRoot, pending.playerId)
        || getWorkingCurrentPlayer(workingRoot);
      if (!isAiAutoBattlePlayer(player?.id)) {
        return { ok: false, blocked: true, message: `${player?.colorLabel || "当前玩家"}需要人工精选` };
      }

      if (pending.type === "public_scan") {
        const rankedSlots = getAiBestPublicScanSlots(player, {
          maxSelectable: pending.maxSelectable ?? 1,
          workingRoot,
        });
        const selectedSlots = rankedSlots.length
          ? rankedSlots
          : (cardState.publicCards || [])
            .map((card, slotIndex) => card ? { card, slotIndex, score: null } : null)
            .filter(Boolean)
            .slice(0, Math.max(1, pending.maxSelectable ?? 1));
        if (!selectedSlots.length) return { ok: false, blocked: true, message: "AI 没有可扫描的公共牌" };
        recordAiAutoBattleLog("public-scan-card", `${player.colorLabel}AI 选择公共牌扫描`, {
          pendingType: pending.type,
          selectedSlots: selectedSlots.map((entry) => ({
            slotIndex: entry.slotIndex,
            score: entry.score,
            card: entry.card,
          })),
          maxSelectable: pending.maxSelectable ?? 1,
        });
        let selectResult = null;
        for (const entry of selectedSlots) {
          selectResult = handlePublicScanCardClick(entry.slotIndex);
          if (!selectResult?.ok) return selectResult;
          if (!isPublicScanMultiSelectActive()) break;
        }
        if (isPublicScanMultiSelectActive()) {
          return confirmPublicScanSelection();
        }
        return selectResult;
      }

      if (pending.type === "industry_deepspace_hand") {
        const selected = getAiBestDeepspaceSwap(workingRoot, player);
        if (!selected || selected.score <= AI_DEEPSPACE_SWAP_MIN_SCORE) {
          return { ok: false, blocked: true, message: "AI 没有正收益的深空探测换牌目标" };
        }
        recordAiAutoBattleLog("industry", `${player.colorLabel}AI 选择深空探测换出手牌`, {
          pendingType: pending.type,
          handIndex: selected.handIndex,
          score: selected.score,
          handCost: selected.handCost,
          publicValue: selected.publicValue,
          handCard: selected.handCard,
          publicSlotIndex: selected.slotIndex,
          publicCard: selected.publicCard,
        });
        return handleIndustryDeepspaceHandClick(selected.handIndex);
      }

      if (pending.type === "industry_deepspace_public") {
        const selected = getAiBestDeepspaceSwap(workingRoot, player, pending.handIndex);
        if (!selected || selected.score <= AI_DEEPSPACE_SWAP_MIN_SCORE) {
          return { ok: false, blocked: true, message: "AI 没有正收益的深空探测公共牌目标" };
        }
        recordAiAutoBattleLog("industry", `${player.colorLabel}AI 选择深空探测换入公共牌`, {
          pendingType: pending.type,
          handIndex: selected.handIndex,
          slotIndex: selected.slotIndex,
          score: selected.score,
          handCost: selected.handCost,
          publicValue: selected.publicValue,
          handCard: selected.handCard,
          publicCard: selected.publicCard,
        });
        return handlePublicCardClick(workingRoot, selected.slotIndex);
      }

      if (pending.type === "card_public_corner_discard") {
        const maxSelectable = Math.max(1, Math.round(aiNumber(pending.maxSelectable ?? pending.count ?? 1)));
        const minSelectable = Math.max(1, Math.round(aiNumber(pending.minSelectable ?? maxSelectable)));
        const selectedSlots = new Set(state.publicCardSelectedSlots || []);
        const rankedPublic = (cardState.publicCards || [])
          .map((card, slotIndex) => ({
            card,
            slotIndex,
            score: scoreAiPublicPickCard(card, player, pending.type, workingRoot),
          }))
          .filter((entry) => entry.card && Number.isFinite(Number(entry.score)))
          .sort((left, right) => Number(right.score || 0) - Number(left.score || 0) || left.slotIndex - right.slotIndex)
          .slice(0, maxSelectable);
        if (rankedPublic.length < minSelectable) {
          return { ok: false, blocked: true, message: `AI 没有足够的公共牌弃除目标（需要 ${minSelectable} 张）` };
        }
        recordAiAutoBattleLog("pick-card", `${player.colorLabel}AI 选择公共牌角标弃除`, {
          pendingType: pending.type,
          selectedSlots: rankedPublic.map((entry) => ({
            slotIndex: entry.slotIndex,
            score: entry.score,
            card: entry.card,
          })),
          maxSelectable,
          minSelectable,
        });
        for (const entry of rankedPublic) {
          if (selectedSlots.has(entry.slotIndex)) continue;
          const selectResult = handlePublicCornerDiscardCardClick(entry.slotIndex);
          if (!selectResult?.ok) return selectResult;
          selectedSlots.add(entry.slotIndex);
        }
        if (selectedSlots.size < minSelectable) {
          return { ok: false, blocked: true, message: `AI 公共牌角标弃除选择不足（需要 ${minSelectable} 张）` };
        }
        return confirmPublicCornerDiscardSelection();
      }

      const rankedPublic = (cardState.publicCards || [])
        .map((card, slotIndex) => ({
          card,
          slotIndex,
          score: scoreAiPublicPickCard(card, player, pending.type || null, workingRoot),
        }))
        .filter((entry) => entry.card && Number.isFinite(Number(entry.score)))
        .sort((left, right) => Number(right.score || 0) - Number(left.score || 0) || left.slotIndex - right.slotIndex);
      const selectedPublic = rankedPublic[0] || null;
      if (pending.aiPreferBlindDraw && allowsBlindDrawInSelection() && canBlindDraw(workingRoot)) {
        recordAiAutoBattleLog("pick-card", `${player.colorLabel}AI 盲抽 1 张牌`, {
          pendingType: pending.type || null,
          tradeId: pending.tradeId || null,
          aiPreferBlindDraw: true,
          aiReason: pending.aiReason || null,
          skippedPublicCard: selectedPublic
            ? summarizeAiPublicPickCandidate(workingRoot, selectedPublic, player)
            : null,
          topPublicCandidates: rankedPublic
            .slice(0, 5)
            .map((entry) => summarizeAiPublicPickCandidate(workingRoot, entry, player))
            .filter(Boolean),
        });
        return drawCardForCurrentPlayer(workingRoot, { fromSelection: true });
      }
      if (selectedPublic) {
        recordAiAutoBattleLog("pick-card", `${player.colorLabel}AI 精选公共牌 ${selectedPublic.slotIndex + 1}`, {
          pendingType: pending.type || null,
          slotIndex: selectedPublic.slotIndex,
          score: selectedPublic.score,
          card: selectedPublic.card,
          topPublicCandidates: rankedPublic
            .slice(0, 5)
            .map((entry) => summarizeAiPublicPickCandidate(workingRoot, entry, player))
            .filter(Boolean),
        });
        return pickPublicCardForCurrentPlayer(workingRoot, selectedPublic.slotIndex);
      }
      if (allowsBlindDrawInSelection() && canBlindDraw(workingRoot)) {
        recordAiAutoBattleLog("pick-card", `${player.colorLabel}AI 盲抽 1 张牌`, {
          pendingType: pending.type || null,
        });
        return drawCardForCurrentPlayer(workingRoot, { fromSelection: true });
      }
      return { ok: false, blocked: true, message: "AI 没有可精选的公共牌" };
    }

    function cardTriggerNeedsFreeMove(match) {
      return match?.effect?.type === cardEffects.EFFECT_TYPES.FREE_MOVE
        || (
          match?.effect?.type === cardEffects.EFFECT_TYPES.CARD_CORNER_EVENT_REWARD
          && Boolean(match.event?.moveReward)
        );
    }

    function getCardTriggerFreeMoveEffect(match) {
      if (!match) return null;
      if (match.effect?.type === cardEffects.EFFECT_TYPES.CARD_CORNER_EVENT_REWARD
        && match.event?.moveReward) {
        return {
          ...match.effect,
          type: cardEffects.EFFECT_TYPES.FREE_MOVE,
          options: {
            ...(match.effect.options || {}),
            movementPoints: match.event.moveReward.movementPoints || 1,
          },
        };
      }
      return match.effect || null;
    }

    function listCardTriggerFreeMoveCandidates(workingRoot, match) {
      return listAiEffectMoveCandidates(workingRoot, {
        id: "cardTriggerMove",
        free: true,
        effect: getCardTriggerFreeMoveEffect(match),
      });
    }

    function getAiLaunchTriggerResolution(workingRoot, effect, player = getWorkingCurrentPlayer(workingRoot)) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      if (effect?.options?.ignoreRocketLimit !== true) {
        const context = createActionContext(workingRoot);
        const rocketLimit = abilities.rocket.getRocketLimitForPlayer(player, context);
        const activeRocketCount = rocketActions.getRocketsForPlayer(rocketState, player?.id).length;
        if (activeRocketCount >= rocketLimit) {
          return {
            ok: false,
            message: `火箭数量已达上限（${activeRocketCount}/${rocketLimit}）`,
          };
        }
      }
      const cost = getAiLaunchPaymentCost(effect?.options || {});
      if (!players.canAfford(player, cost)) {
        return {
          ok: false,
          message: `发射资源不足，需要 ${players.formatResourceCost(cost)}`,
        };
      }
      return { ok: true };
    }

    function scoreAiReadyCardTask(workingRoot, ready, player = getWorkingCurrentPlayer(workingRoot)) {
      if (!ready) return -Infinity;
      if ((ready.effects || []).some((effect) => !canAiResolveAlienTraceEffect(workingRoot, effect, player))) return -Infinity;
      const effectValue = (ready.effects || [])
        .reduce((total, effect) => total + scoreAiEffectValue(effect, { player }), 0);
      const directScore = (ready.effects || [])
        .reduce((total, effect) => total + Math.max(0, aiNumber(effect?.options?.gain?.score)), 0);
      const paceBonus = directScore > 0
        ? Math.min(10, getAiLiveScorePaceDeficit(player) * (getAiRoundNumber() >= 3 ? 0.12 : 0.06))
        : 0;
      if (ready.chongTask) {
        const task = ready.task || ready.card?.chongTask || null;
        const fossilId = ready.deliveredTransport?.fossil?.fossilId
          || ready.deliveredTransport?.task?.fossilId
          || null;
        const chongValue = task?.kind === "transport"
          ? scoreAiChongTransportCompletionValue(task, player, { fossilId })
          : scoreAiChongTraceTaskProgressValue(task, player);
        return 8 + Math.max(effectValue + directScore * 0.35 + paceBonus, chongValue);
      }
      return effectValue + directScore * 0.35 + paceBonus;
    }

    function runAiReadyCardTaskOpenDecision(workingRoot) {
      const { playerState } = requireWorkingRoot(workingRoot);
      if (isActionEffectFlowActive() || hasActivePendingSubFlow()) return null;
      if (typeof getReadyCardTasks !== "function" || typeof openCardTaskCompletionPicker !== "function") return null;
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      if (!isAiAutoBattlePlayer(currentPlayer?.id)) return null;
      const selected = (getReadyCardTasks(workingRoot) || [])
        .map((ready, index) => ({
          ready,
          index,
          score: scoreAiReadyCardTask(workingRoot, ready, currentPlayer),
        }))
        .filter((entry) => entry.ready?.card && Number.isFinite(Number(entry.score)))
        .sort((left, right) => right.score - left.score || left.index - right.index)[0] || null;
      if (!selected) return null;
      recordAiAutoBattleLog("card-task-ready", `${currentPlayer.colorLabel}AI 打开已满足任务 ${cards.getCardLabel(selected.ready.card)}`, {
        cardLabel: cards.getCardLabel(selected.ready.card),
        taskId: selected.ready.task?.id || null,
        score: selected.score,
        effectTypes: (selected.ready.effects || []).map((effect) => effect?.type || null).filter(Boolean),
      });
      return openCardTaskCompletionPicker(workingRoot, selected.ready.card, { player: currentPlayer });
    }

    function getAiBanrenmaOpportunityPlayers(workingRoot) {
      const { playerState } = requireWorkingRoot(workingRoot);
      if (typeof openBanrenmaReadyOpportunityForPlayer !== "function") return [];
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      const currentPlayerId = currentPlayer?.id || null;
      const activeAiPlayers = (getActivePlayers?.() || [])
        .filter((player) => player?.id && isAiAutoBattlePlayer(player.id));
      return [
        ...(currentPlayerId && isAiAutoBattlePlayer(currentPlayerId) ? [currentPlayer] : []),
        ...activeAiPlayers.filter((player) => player?.id !== currentPlayerId),
      ].filter(Boolean);
    }

    function scoreAiBanrenmaTraceEffectValue(workingRoot, effect, player = getWorkingCurrentPlayer(workingRoot)) {
      if (!effect || !player || !canAiResolveAlienTraceEffect(workingRoot, effect, player)) return -Infinity;
      const fixedTraceType = effect.options?.traceType || null;
      const traceTypes = fixedTraceType
        ? [fixedTraceType]
        : (effect.options?.allowedTraceTypes?.length
          ? effect.options.allowedTraceTypes
          : aliens?.TRACE_TYPES || []);
      return traceTypes.reduce((best, traceType) => Math.max(
        best,
        aiNumber(scoreAiAlienTraceValue({ player, traceType }))
          + aiNumber(scoreAiB1TraceMarginalValue(player, traceType)),
      ), -Infinity);
    }

    function scoreAiExecutableBanrenmaEffects(workingRoot, effects = [], player = getWorkingCurrentPlayer(workingRoot)) {
      if (!player || !Array.isArray(effects) || !effects.length) return -Infinity;
      let value = 0;
      for (const effect of effects) {
        const effectValue = effect?.type === "alien_trace"
          ? scoreAiBanrenmaTraceEffectValue(workingRoot, effect, player)
          : scoreAiEffectValue(effect, { player });
        if (!Number.isFinite(Number(effectValue))) return -Infinity;
        value += aiNumber(effectValue);
      }
      return roundAiScore(value);
    }

    function scoreAiReadyBanrenmaCardOpportunity(workingRoot, card, player = getWorkingCurrentPlayer(workingRoot), markId = null) {
      const { alienGameState } = requireWorkingRoot(workingRoot);
      if (!player || !banrenma?.isBanrenmaCard?.(card)) return -Infinity;
      const mark = banrenma.getReadyScoreMarkForCard?.(alienGameState, player, card, markId);
      if (!mark) return -Infinity;
      return scoreAiExecutableBanrenmaEffects(workingRoot, banrenma.buildConditionEffects?.(card) || [], player);
    }

    function listAiReadyBanrenmaCardOpportunities(workingRoot, player = getWorkingCurrentPlayer(workingRoot)) {
      const { alienGameState } = requireWorkingRoot(workingRoot);
      return (player?.reservedCards || [])
        .map((card, index) => {
          if (!banrenma?.isBanrenmaCard?.(card)) return null;
          const mark = banrenma.getReadyScoreMarkForCard?.(alienGameState, player, card);
          if (!mark) return null;
          return {
            card,
            cardId: card.id || null,
            markId: mark.id || null,
            index,
            score: scoreAiReadyBanrenmaCardOpportunity(workingRoot, card, player, mark.id),
          };
        })
        .filter(Boolean)
        .sort((left, right) => {
          const leftScore = Number.isFinite(Number(left.score)) ? Number(left.score) : -Infinity;
          const rightScore = Number.isFinite(Number(right.score)) ? Number(right.score) : -Infinity;
          return rightScore - leftScore || left.index - right.index;
        });
    }

    function openAiPreferredBanrenmaCardOpportunity(workingRoot, player, includeCards, preferred = null) {
      const reservedCards = player?.reservedCards;
      const preferredCardId = includeCards && preferred?.cardId ? preferred.cardId : null;
      const preferredIndex = preferredCardId && Array.isArray(reservedCards)
        ? reservedCards.findIndex((card) => card?.id === preferredCardId)
        : -1;
      if (preferredIndex <= 0) {
        return openBanrenmaReadyOpportunityForPlayer(workingRoot, player, {
          includeCards,
          playerId: player?.id || null,
          playerColor: player?.color || null,
          ...(preferredCardId ? { preferredCardId } : {}),
        });
      }

      const originalOrder = reservedCards.slice();
      const [preferredCard] = reservedCards.splice(preferredIndex, 1);
      reservedCards.unshift(preferredCard);
      try {
        return openBanrenmaReadyOpportunityForPlayer(workingRoot, player, {
          includeCards,
          playerId: player?.id || null,
          playerColor: player?.color || null,
          preferredCardId,
        });
      } finally {
        reservedCards.splice(0, reservedCards.length, ...originalOrder);
      }
    }

    function runAiReadyBanrenmaOpportunityOpenDecision(workingRoot) {
      const { alienGameState, playerState } = requireWorkingRoot(workingRoot);
      if (state.pendingBanrenmaOpportunity || state.pendingBanrenmaCardGain) return null;
      if (isActionEffectFlowActive() || hasActivePendingSubFlow()) return null;
      const currentPlayerId = getWorkingCurrentPlayer(workingRoot)?.id || null;
      for (const player of getAiBanrenmaOpportunityPlayers(workingRoot)) {
        const includeCards = player.id === currentPlayerId;
        const hasPanelOpportunity = Boolean(
          banrenma?.getPendingPanelMark?.(alienGameState, player)
          && (banrenma?.getAvailableBonusPositions?.(alienGameState) || []).length,
        );
        const readyCardOpportunities = includeCards && !hasPanelOpportunity
          ? listAiReadyBanrenmaCardOpportunities(workingRoot, player)
          : [];
        const preferredCardOpportunity = readyCardOpportunities
          .find((entry) => Number.isFinite(Number(entry.score))) || null;
        if (readyCardOpportunities.length && !preferredCardOpportunity) continue;
        const result = openAiPreferredBanrenmaCardOpportunity(workingRoot,
          player,
          includeCards,
          preferredCardOpportunity,
        );
        if (!result) continue;
        if (result.ok === false) return result;
        recordAiAutoBattleLog("alien-use", `${player.colorLabel}AI 打开半人马达标机会`, {
          logPlayerId: player.id || null,
          logPlayerColor: player.color || null,
          includeCards,
          preferredCardId: preferredCardOpportunity?.cardId || null,
          preferredCardScore: preferredCardOpportunity?.score ?? null,
          readyCardScores: readyCardOpportunities.map((entry) => ({
            cardId: entry.cardId,
            markId: entry.markId,
            score: Number.isFinite(Number(entry.score)) ? entry.score : null,
          })),
          result,
        });
        return {
          ok: true,
          progressed: true,
          opened: true,
          result,
          message: result.message || "AI 已打开半人马达标机会",
        };
      }
      return null;
    }

    function listAiRunezuFaceSymbolQuickCandidates(workingRoot, player = getWorkingCurrentPlayer(workingRoot)) {
      const { alienGameState } = requireWorkingRoot(workingRoot);
      if (
        !player
        || typeof openRunezuFaceSymbolPlacement !== "function"
        || !runezu?.isRunezuRevealedSlot
        || state.pendingRunezuFaceSymbolPlacement
        || isActionEffectFlowActive()
        || hasActivePendingSubFlow()
        || isCardSelectionActive()
        || isDiscardSelectionActive()
      ) {
        return [];
      }
      const candidates = [];
      for (const alienSlotId of aliens?.ALIEN_SLOT_IDS || []) {
        if (!runezu.isRunezuRevealedSlot(alienGameState, alienSlotId)) continue;
        for (const position of runezu.FACE_SYMBOL_POSITIONS || []) {
          const check = runezu.canPlaceFaceSymbol?.(alienGameState, position, player);
          if (!check?.ok) continue;
          const bestChoice = (check.choices || [])
            .map((choice) => ({
              symbolId: choice.symbolId,
              score: scoreAiRunezuFaceSymbolPlacementChoice(check.position, choice.symbolId, player),
            }))
            .filter((choice) => Number.isFinite(Number(choice.score)))
            .sort((left, right) => right.score - left.score)[0] || null;
          if (!bestChoice || bestChoice.score <= 0) continue;
          candidates.push({
            id: "runezuFaceSymbol",
            kind: "quick",
            available: true,
            alienSlotId: Number(alienSlotId),
            position: Number(check.position),
            symbolId: bestChoice.symbolId,
            score: bestChoice.score,
            gain: bestChoice.score,
            cost: 0,
            reason: null,
            valueBreakdown: {
              symbolId: bestChoice.symbolId,
              rewardValue: scoreAiRunezuFaceRewardValue(check.position, player),
              finalPenalty: scoreAiRunezuSpendSymbolFinalPenalty(bestChoice.symbolId, player),
              dependencyUnlockValue: scoreAiRunezuFaceDependencyUnlockValue(check.position, bestChoice.symbolId, player),
            },
          });
        }
      }
      return candidates.sort((left, right) => right.score - left.score);
    }

    function runAiRunezuFaceSymbolQuickActionDecision(workingRoot, action) {
      const { playerState } = requireWorkingRoot(workingRoot);
      if (!action || typeof openRunezuFaceSymbolPlacement !== "function") {
        return { ok: false, message: "AI 缺少符文族黑圈快速行动入口" };
      }
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      recordAiAutoBattleLog("alien-use", `${currentPlayer.colorLabel}AI 打开符文族黑圈`, {
        logPlayerId: currentPlayer.id || null,
        logPlayerColor: currentPlayer.color || null,
        action,
      });
      return openRunezuFaceSymbolPlacement(workingRoot, action.alienSlotId, action.position);
    }











    function runAiCardCornerQuickActionDecision(workingRoot, action) {
      const { playerState } = requireWorkingRoot(workingRoot);
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      if (!isAiAutoBattlePlayer(currentPlayer?.id)) {
        return { ok: false, blocked: true, message: `${currentPlayer?.colorLabel || "当前玩家"}需要人工确认卡牌快速行动` };
      }
      if (!Number.isInteger(Number(action?.handIndex))) {
        return { ok: false, message: "AI 卡牌快速行动缺少手牌索引" };
      }
      recordAiAutoBattleLog("card-corner", `${currentPlayer.colorLabel}AI 使用手牌角标 ${action.cardLabel}`, {
        action,
      });
      const selectResult = handleHandCardCornerQuickAction(action.handIndex);
      if (!selectResult?.ok) return selectResult;
      const result = confirmCardCornerQuickAction();
      return result || { ok: true, progressed: true, action };
    }

    return {
      getOrderedAiAutoBattlePlayerIds,
      getAiStyleFallbackIndex,
      getAiSeatStyle,
      inferAiStyleFromOpening,
      chooseInitialSelectionForAiPlayer,
      runAiDiscardDecision,
      runAiCardSelectionDecision,
      cardTriggerNeedsFreeMove,
      getCardTriggerFreeMoveEffect,
      listCardTriggerFreeMoveCandidates,
      getAiLaunchTriggerResolution,
      scoreAiReadyCardTask,
      runAiReadyCardTaskOpenDecision,
      getAiBanrenmaOpportunityPlayers,
      scoreAiBanrenmaTraceEffectValue,
      scoreAiExecutableBanrenmaEffects,
      scoreAiReadyBanrenmaCardOpportunity,
      listAiReadyBanrenmaCardOpportunities,
      openAiPreferredBanrenmaCardOpportunity,
      runAiReadyBanrenmaOpportunityOpenDecision,
      listAiRunezuFaceSymbolQuickCandidates,
      runAiRunezuFaceSymbolQuickActionDecision,
      runAiCardCornerQuickActionDecision,
    };
  }

  const REQUIRED_CONTEXT_KEYS = Object.freeze([
    "AI_DEEPSPACE_SWAP_MIN_SCORE", "AI_STYLE_SEAT_ORDER", "INITIAL_SELECTION_REQUIRED", "abilities", "ai", "aiAutoBattleState", "aiNumber",
    "aliens", "allowsBlindDrawInSelection", "amiba", "applyAiDifficultyToPlayer", "banrenma", "canAiResolveAlienTraceEffect", "canAiResolvePlayCardEffects",
    "canBlindDraw", "cancelCardTriggerChoice", "cardEffects", "cards", "chooseAiIncomeDiscardIndexes", "chooseAiTradeDiscardIndexes", "confirmCardCornerQuickAction",
    "confirmCardTaskCompletion", "confirmInitialSelectionForCurrentPlayer", "confirmPassReserveSelection", "confirmPublicScanSelection", "createActionContext", "drawCardForCurrentPlayer", "executeFreeMoveForCardTrigger",
    "finalizePendingDiscardSelection", "getActivePlayers", "getAiAutoBattlePendingState", "getAiAutoBattlePlayerIds", "getAiBestDeepspaceSwap", "getAiBestHandScanIndex", "getAiBestPublicScanSlots", "getAiCardDisplayLabel",
    "getAiDifficultyLabel", "getAiIncomeDiscardPreview", "getAiIncomeFinalFormulaEntries", "getAiLaunchPaymentCost", "getAiLiveScorePaceDeficit", "getAiLowEngineCatchupProfile", "getAiMarkedFinalFormulaEntries", "getAiPassReserveResourcePressure",
    "getAiRoundNumber", "getCardTypeCode", "getInitialSelectionOffer", "getPassReserveSelectionCards",
    "getPlayerLabelById", "getReadyCardTasks", "handleCardTriggerChoice", "handleHandCardCornerQuickAction", "handleHandScanCardClick", "handleIndustryDeepspaceHandClick", "handlePublicCardClick",
    "handlePublicCornerDiscardCardClick", "handlePublicScanCardClick", "hasActivePendingSubFlow", "hasAiRunezuPassReservePressure", "isActionEffectFlowActive", "isAiAutoBattlePlayer", "isAiIncomeDiscardType", "isAiPassReservePreviewIncomeCandidate",
    "isCardSelectionActive", "isDiscardSelectionActive", "isHandScanSelectionActive", "isIndustryHandSelectionActive", "isInitialSelectionActive", "isPublicScanMultiSelectActive", "listAiEffectMoveCandidates",
    "listAiPlayCardCandidates", "openBanrenmaReadyOpportunityForPlayer", "openCardTaskCompletionPicker", "openRunezuFaceSymbolPlacement", "pickPublicCardForCurrentPlayer", "players", "recordAiAutoBattleLog",
    "rocketActions", "roundAiScore", "runezu", "scoreAiAlienTraceValue", "scoreAiB1TraceMarginalValue", "scoreAiChongTraceTaskProgressValue", "scoreAiChongTransportCompletionValue",
    "scoreAiEffectValue", "scoreAiPassReserveCard", "scoreAiPublicPickCard", "scoreAiRunezuFaceDependencyUnlockValue", "scoreAiRunezuFaceRewardValue", "scoreAiRunezuFaceSymbolPlacementChoice", "scoreAiRunezuSpendSymbolFinalPenalty", "selectPassReserveCard",
    "skipCurrentActionEffect", "state", "summarizeAiPublicPickCandidate",
  ]);

  return { createInitialCardPendingRuntime, REQUIRED_CONTEXT_KEYS };
});
