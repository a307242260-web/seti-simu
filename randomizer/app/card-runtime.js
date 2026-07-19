(function (root, factory) {
  "use strict";

  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiAppCardRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createCardRuntime(context = {}) {
    const {
      HISTORY_SOURCE_MAIN,
      HISTORY_SOURCE_QUICK,
      SCORE_SOURCE_KEYS,
      SCORE_SOURCE_KEY_SET,
      abilities,
      activateMoveMode,
      applyCardMoveAfterEventRewards,
      addScoreSourceFromGain,
      allowsBlindDrawInSelection,
      appendActionLogStep,
      attachCardHoverPreview,
      banrenma,
      beginDiscardSelection,
      beginEffectHistoryStep,
      beginQuickActionStep,
      canPayForMove,
      canStartMainAction,
      cardEffects,
      cardState,
      cards,
      clearMoveRocketHighlight,
      clearHistoryStepOrderForSource,
      commitIrreversibleIndustryQuickAction,
      completeCurrentActionEffect,
      completeQuickActionStep,
      continueAfterCardTriggerResolution,
      continuePendingDataPlacementAfterBonus,
      createActionContext,
      createCardTriggerProgressCommands,
      data,
      deactivateMoveMode,
      discardReservedCardIfFinished,
      document,
      els,
      fangzhou,
      finalizeIndustryDeepspaceSwap,
      finishIndustryAbilityFlow,
      formatPlanetRewardGain,
      endEffectHistoryStep,
      getCurrentPlayer,
      getCurrentActionEffect,
      getDelayedPublicRefillSlots,
      getGameplayLockReason,
      getMainActionStartBlockReason,
      getMovableTokensForPlayer,
      getRequiredMovePointsForUi,
      getPlayerById,
      getPublicScanSelectionInstruction,
      handlePublicCornerDiscardCardClick,
      handlePublicScanCardClick,
      hasActivePendingSubFlow,
      hideCardHoverPreview,
      historyCommands,
      industry,
      insertActionEffectsAfterCurrent,
      isCardSelectionActive,
      isDiscardSelectionActive,
      isHandScanSelectionActive,
      isIndustryHandSelectionActive,
      isMovePaymentLockedForAiAutomation,
      isMovePaymentSelectionActive,
      isPlayCardSelectionActive,
      isTechTilePickingActive,
      keepExistingMainActionPendingAfterChongTask,
      markCurrentActionIrreversible,
      maybeApplyCardMoveDistinctEventReward,
      maybeApplyCardMoveSameRingReward,
      maybeContinuePendingTurnEndRevealFlow,
      normalizeResourceCost,
      pendingState,
      playerState,
      players,
      quickActionHistory,
      quickTrades,
      recordAbilityCommands,
      recordHistoryCommand,
      recordQuickHistoryCommand,
      recordTechBonusScore,
      renderActionEffectBar,
      renderPlayerHand,
      renderPlayerStats,
      renderRocketElement,
      renderRuntime,
      renderStateReadout,
      rocketState,
      rocketActions,
      rollbackPendingIndustryQuickAction,
      runezu,
      selectDefaultRocketForCurrentPlayer,
      scrollToPlayerHandPanel,
      settleCardTasksAfterEffect,
      startCardEffectFlow,
      structuredClone,
      syncCardSelectionChrome,
      syncMovePaymentChrome,
      turnState,
      updateActionButtons,
    } = context;

    function getDiscardCornerRewardMultiplier(player = getCurrentPlayer()) {
      return industry?.shouldDoubleDiscardCornerRewards?.(player) ? 2 : 1;
    }

    function multiplyRewardGain(gain, multiplier) {
      const result = {};
      for (const [key, value] of Object.entries(gain || {})) {
        const amount = Number(value) || 0;
        if (amount) result[key] = amount * multiplier;
      }
      return result;
    }

    function multiplyDiscardActionReward(reward, multiplier) {
      if (!reward || multiplier <= 1) return reward;
      return {
        ...reward,
        gain: multiplyRewardGain(reward.gain, multiplier),
        dataCount: Math.max(0, Math.round(Number(reward.dataCount) || 0)) * multiplier,
        label: `${reward.label || "弃牌角标"} x${multiplier}`,
      };
    }

    function multiplyDiscardMoveReward(reward, multiplier) {
      if (!reward || multiplier <= 1) return reward;
      return {
        ...reward,
        gain: multiplyRewardGain(reward.gain, multiplier),
        movementPoints: Math.max(0, Math.round(Number(reward.movementPoints) || 1)) * multiplier,
        label: `${reward.label || "移动"} x${multiplier}`,
      };
    }

    function getCardCornerQuickActionForCard(card) {
      if (fangzhou?.isFangzhouCard2?.(card)) {
        return {
          actionKind: "fangzhou_basic",
          label: "方舟基础奖励",
        };
      }

      const runezuCornerMatch = String(card?.discardActionCode || "").match(/^s_([1-7])$/);
      if (runezu?.isRunezuCard?.(card) && runezuCornerMatch) {
        const symbolId = `symbol_${runezuCornerMatch[1]}`;
        return {
          actionKind: "runezu_symbol",
          label: `符文族${runezu.formatSymbolLabel(symbolId)}奖励`,
          symbolId,
        };
      }

      const resourceReward = cards.getDiscardActionRewardForCard(card);
      if (resourceReward) {
        const rewardMultiplier = getDiscardCornerRewardMultiplier();
        const reward = multiplyDiscardActionReward(resourceReward, rewardMultiplier);
        return {
          actionKind: "resource",
          label: reward.label,
          reward,
          rewardMultiplier,
        };
      }

      const moveReward = cards.getDiscardActionMoveRewardForCard?.(card);
      if (moveReward) {
        const rewardMultiplier = getDiscardCornerRewardMultiplier();
        const reward = multiplyDiscardMoveReward(moveReward, rewardMultiplier);
        return {
          actionKind: "move",
          label: reward.label,
          moveReward: reward,
          rewardMultiplier,
        };
      }

      return null;
    }

    function shouldQueueCardCornerMoveQuickAction(action, player = getCurrentPlayer()) {
      return action?.actionKind === "move"
        && Boolean(industry?.shouldDoubleDiscardCornerRewards?.(player));
    }

    function canUseCardCornerQuickAction() {
      return !getGameplayLockReason()
        && !isTechTilePickingActive()
        && !isCardSelectionActive()
        && !isDiscardSelectionActive()
        && !isPlayCardSelectionActive()
        && !isHandScanSelectionActive()
        && !isMovePaymentSelectionActive()
        && !pendingState.industryAbility
        && !isIndustryHandSelectionActive()
        && !pendingState.cardCornerFreeMove
        && !hasActivePendingSubFlow();
    }

    function formatCardCornerRewardMessage(reward, dataResults) {
      const parts = [];
      if (reward?.gain?.publicity) parts.push(`宣传+${reward.gain.publicity}`);
      if (reward?.gain?.score) parts.push(`分数+${reward.gain.score}`);
      const dataCount = Math.max(0, Math.round(reward?.dataCount || 0));
      if (dataCount) {
        const gained = dataResults.filter((item) => item.ok).length;
        const discarded = dataResults.filter((item) => item.discarded).length;
        parts.push(discarded ? `数据+${gained}/${dataCount}（弃置${discarded}）` : `数据+${gained}`);
      }
      return parts.join("、");
    }

    function getCardCornerEventKind(resourceReward, moveReward) {
      if (moveReward) return "move";
      if (Math.max(0, Math.round(resourceReward?.dataCount || 0)) > 0) return "data";
      if (resourceReward?.gain?.publicity) return "publicity";
      if (resourceReward?.gain?.score) return "score";
      return "unknown";
    }

    function normalizeCardCornerRewardMultiplier(multiplier) {
      const numeric = Number(multiplier);
      return Number.isFinite(numeric) ? Math.max(1, Math.round(numeric)) : 1;
    }

    function cardCornerCodesEqual(left, right) {
      if (left == null && right == null) return true;
      const leftNumber = Number(left);
      const rightNumber = Number(right);
      if (Number.isInteger(leftNumber) && Number.isInteger(rightNumber)) {
        return leftNumber === rightNumber;
      }
      return String(left) === String(right);
    }

    function normalizeCardCornerTriggerCode(cornerCode) {
      if (typeof cards.normalizeDiscardActionTriggerCode === "function") {
        return cards.normalizeDiscardActionTriggerCode(cornerCode);
      }
      if (cornerCode == null || cornerCode === "") return null;
      const numericCode = Number(cornerCode);
      if (!Number.isInteger(numericCode)) return cornerCode ?? null;
      if (numericCode >= 3 && numericCode <= 5) return numericCode - 3;
      return numericCode;
    }

    function getDiscardActionTriggerResourceRewardForCode(cornerCode) {
      if (typeof cards.getDiscardActionTriggerRewardForCode === "function") {
        return cards.getDiscardActionTriggerRewardForCode(cornerCode);
      }
      const triggerCode = normalizeCardCornerTriggerCode(cornerCode);
      return cards.getDiscardActionRewardForCard?.({ discardActionCode: triggerCode }) || null;
    }

    function getDiscardActionTriggerMoveRewardForCode(cornerCode) {
      if (typeof cards.getDiscardActionTriggerMoveRewardForCode === "function") {
        return cards.getDiscardActionTriggerMoveRewardForCode(cornerCode);
      }
      const triggerCode = normalizeCardCornerTriggerCode(cornerCode);
      return cards.getDiscardActionMoveRewardForCard?.({ discardActionCode: triggerCode }) || null;
    }

    function createCardCornerTriggerEventFields(resourceReward, moveReward, options = {}) {
      const actualCornerCode = options.cornerCode ?? resourceReward?.code ?? moveReward?.code ?? null;
      const triggerCornerCode = normalizeCardCornerTriggerCode(actualCornerCode);
      const useEquivalentReward = actualCornerCode != null && !cardCornerCodesEqual(triggerCornerCode, actualCornerCode);
      const rewardMultiplier = normalizeCardCornerRewardMultiplier(options.rewardMultiplier);

      let eventResourceReward = resourceReward || null;
      let eventMoveReward = moveReward || null;
      if (useEquivalentReward) {
        eventResourceReward = getDiscardActionTriggerResourceRewardForCode(actualCornerCode);
        eventMoveReward = getDiscardActionTriggerMoveRewardForCode(actualCornerCode);
        if (eventResourceReward) eventResourceReward = multiplyDiscardActionReward(eventResourceReward, rewardMultiplier);
        if (eventMoveReward) eventMoveReward = multiplyDiscardMoveReward(eventMoveReward, rewardMultiplier);
      }

      return {
        cornerKind: getCardCornerEventKind(eventResourceReward, eventMoveReward),
        cornerCode: triggerCornerCode,
        originalCornerCode: actualCornerCode,
        resourceReward: eventResourceReward,
        moveReward: eventMoveReward,
        actualResourceReward: resourceReward || null,
        actualMoveReward: moveReward || null,
        rewardMultiplier,
      };
    }

    function applyCardCornerRewardFromCard(player, card, options = {}) {
      if (!player || !card) return { ok: false, message: "没有可结算角标的卡牌" };
      const resourceReward = cards.getDiscardActionRewardForCard(card);
      const moveReward = cards.getDiscardActionMoveRewardForCard?.(card);
      const dataResults = [];
      const scoreSourceKey = SCORE_SOURCE_KEY_SET.has(options.scoreSourceKey)
        ? options.scoreSourceKey
        : SCORE_SOURCE_KEYS.CARD_EFFECT;

      if (resourceReward) {
        if (Object.keys(resourceReward.gain || {}).length) {
          players.gainResources(player, resourceReward.gain);
          addScoreSourceFromGain(player, scoreSourceKey, resourceReward.gain);
        }
        const dataCount = Math.max(0, Math.round(resourceReward.dataCount || 0));
        for (let index = 0; index < dataCount; index += 1) {
          dataResults.push(data.gainData(player, { source: options.source || "card_corner" }));
        }
      }

      if (moveReward?.gain && Object.keys(moveReward.gain).length) {
        players.gainResources(player, moveReward.gain);
        addScoreSourceFromGain(player, scoreSourceKey, moveReward.gain);
      }
      if (moveReward && options.insertMoveIntoCurrentFlow) {
        insertActionEffectsAfterCurrent([{
          id: `${options.effectId || "card-corner"}-move-${card.id}`,
          type: cardEffects.EFFECT_TYPES.CARD_MOVE,
          label: `${cards.getCardLabel(card)}：${moveReward.label}`,
          icon: "movement",
          options: {
            movementPoints: moveReward.movementPoints || 1,
            historyLabel: moveReward.label,
          },
        }]);
      }

      const rewardText = resourceReward
        ? formatCardCornerRewardMessage(resourceReward, dataResults)
        : moveReward
          ? [formatPlanetRewardGain(moveReward.gain || {}), `${moveReward.movementPoints || 1}移动`].filter(Boolean).join("、")
          : "无可结算角标";
      const eventFields = createCardCornerTriggerEventFields(resourceReward, moveReward, {
        cornerCode: cards.getDiscardActionCodeForCard?.(card),
      });
      return {
        ok: Boolean(resourceReward || moveReward),
        resourceReward,
        moveReward,
        dataResults,
        cornerKind: eventFields.cornerKind,
        cornerCode: eventFields.cornerCode,
        originalCornerCode: eventFields.originalCornerCode,
        eventResourceReward: eventFields.resourceReward,
        eventMoveReward: eventFields.moveReward,
        actualResourceReward: resourceReward,
        actualMoveReward: moveReward,
        message: rewardText,
      };
    }

    function canStartCardCornerFreeMove() {
      const currentPlayer = getCurrentPlayer();
      const rocketsForPlayer = getMovableTokensForPlayer(currentPlayer?.id);
      if (rocketsForPlayer.length > 0) return { ok: true, rocketsForPlayer };
      return { ok: false, rocketsForPlayer, message: "没有可移动的飞船" };
    }

    function beginCardCornerFreeMove(action, discardedCard, deferredEvents = []) {
      const check = canStartCardCornerFreeMove();
      if (!check.ok) {
        rocketState.statusNote = check.message;
        renderStateReadout();
        return check;
      }

      pendingState.cardCornerFreeMove = {
        action,
        discardedCardLabel: cards.getCardLabel(discardedCard),
        deferredEvents,
      };
      rocketState.statusNote = check.rocketsForPlayer.length > 1
        ? `${action.label}：请点击要免费移动的飞船`
        : `${action.label}：使用方向键免费移动飞船`;
      if (check.rocketsForPlayer.length === 1) {
        activateMoveMode(check.rocketsForPlayer[0].id);
      } else {
        selectDefaultRocketForCurrentPlayer();
      }
      updateActionButtons();
      renderStateReadout();
      return { ok: true, message: rocketState.statusNote };
    }

    function cloneEffectEvent(event) {
      return event && typeof event === "object" ? { ...event } : event;
    }

    function getAfterMoveEventsForEffect(effect) {
      return Array.isArray(effect?.options?.afterMoveEvents)
        ? effect.options.afterMoveEvents.filter(Boolean).map(cloneEffectEvent)
        : [];
    }

    function buildQueuedCardCornerMoveEffect(action, discardedCard, cornerEvent) {
      const movementPoints = Math.max(
        1,
        Math.round(Number(action?.moveReward?.movementPoints ?? action?.movementPoints ?? 1) || 1),
      );
      return {
        id: `card-corner-quick-move-${discardedCard?.id || "card"}`,
        type: cardEffects.EFFECT_TYPES.CARD_MOVE,
        label: `${cards.getCardLabel(discardedCard)}：${movementPoints}移动`,
        icon: "movement",
        options: {
          movementPoints,
          historyLabel: `卡牌快速行动：${action?.label || "弃牌换移动"}`,
          source: "card_corner",
          afterMoveEvents: cornerEvent ? [cornerEvent] : [],
        },
      };
    }

    function startCardCornerMoveEffectFlow(action, discardedCard, cornerEvent) {
      const moveEffect = buildQueuedCardCornerMoveEffect(action, discardedCard, cornerEvent);
      const started = startCardEffectFlow(
        "card-corner-quick-move",
        `卡牌快速行动：${action.label}`,
        [moveEffect],
        {
          actionType: "cardCornerMove",
          historySource: HISTORY_SOURCE_QUICK,
          consumesMainAction: false,
        },
      );
      if (started) {
        rocketState.statusNote = `卡牌快速行动：弃除 ${cards.getCardLabel(discardedCard)}，请按效果栏分配 ${moveEffect.options.movementPoints} 移动力`;
        renderActionEffectBar();
        updateActionButtons();
        renderStateReadout();
      }
      return started;
    }

    function getCardPrice(card) {
      const price = Number(card?.price);
      return Number.isFinite(price) ? Math.max(0, Math.round(price)) : 0;
    }

    function getCardPlayCost(card) {
      if (card?.futureSpanFreePlay) {
        return {};
      }
      const price = getCardPrice(card);
      if (banrenma?.isBanrenmaCard?.(card)) {
        return price > 0 ? { energy: price } : {};
      }
      return price > 0 ? { credits: price } : {};
    }

    function getCardPlayCreditCost(cost) {
      const credits = Number(cost?.credits);
      return Number.isFinite(credits) ? Math.max(0, Math.round(credits)) : 0;
    }

    function createPlayCardEvent(playedCard, player, cost, options = {}) {
      const event = {
        type: "playCard",
        price: getCardPlayCreditCost(cost),
        cardId: playedCard?.cardId || null,
        sourceCardInstanceId: playedCard?.id || null,
        playerId: player?.id || null,
      };
      if (options.timing) event.timing = options.timing;
      return event;
    }

    function createImmediatePlayCardEvent(playedCard, player, cost) {
      return createPlayCardEvent(playedCard, player, cost, { timing: "after_play_card" });
    }

    function restoreObjectSnapshot(target, snapshot) {
      if (!target || !snapshot) return;
      for (const key of Object.keys(target)) delete target[key];
      Object.assign(target, structuredClone(snapshot));
    }

    function getFutureSpanCreditPriceForCard(card) {
      if (!card) return 0;
      if (fangzhou?.isFangzhouCard2?.(card)) {
        const credits = Number(fangzhou.CARD2_PLAY_COST?.credits);
        return Number.isFinite(credits) ? Math.max(0, Math.round(credits)) : 0;
      }
      if (banrenma?.isBanrenmaCard?.(card)) return 0;
      return getCardPrice(card);
    }

    function getFutureSpanDeltaForCard(card) {
      const price = getFutureSpanCreditPriceForCard(card);
      const deltas = industry?.FUTURE_SPAN_DELTAS_BY_COST || {};
      if (Number.isFinite(Number(deltas[price]))) return Number(deltas[price]);
      const maxModeledCost = Math.max(
        0,
        ...Object.keys(deltas)
          .map((key) => Math.round(Number(key)))
          .filter((value) => Number.isFinite(value) && value > 0),
      );
      if (price > maxModeledCost && Number.isFinite(Number(deltas[maxModeledCost]))) {
        return Number(deltas[maxModeledCost]);
      }
      return null;
    }

    function isFutureSpanEligibleHandCard(card) {
      if (!card) return false;
      const price = getFutureSpanCreditPriceForCard(card);
      return price > 0
        && Number.isFinite(Number(getFutureSpanDeltaForCard(card)));
    }

    function hasFutureSpanEligibleHandCard(player = getCurrentPlayer()) {
      return (player?.hand || []).some(isFutureSpanEligibleHandCard);
    }

    function hasPlayableFutureSpanCard(player = getCurrentPlayer()) {
      return industry?.isFutureSpanCardReady?.(player) === true;
    }

    function getStandardPlayCardActionBlockReason(player = getCurrentPlayer()) {
      return industry?.blocksStandardPlayCardAction?.(player)
        ? "原教旨主义：不能使用打牌主要行动"
        : null;
    }

    function formatCardPlayCost(cost) {
      const text = players.formatResourceCost(cost);
      return text && text !== "无" ? text : "0";
    }

    function getCardTypeCode(card) {
      const typeCode = Number(card?.cardTypeCode);
      const fallbackTypeCode = Number.isFinite(typeCode) ? Math.round(typeCode) : 0;
      return cardEffects?.getRuntimeCardTypeCode
        ? cardEffects.getRuntimeCardTypeCode(card, fallbackTypeCode)
        : fallbackTypeCode;
    }

    function getPlayCardSelectionBlockReason(player = getCurrentPlayer()) {
      if (!canStartMainAction()) {
        return getMainActionStartBlockReason() || "本回合已经开始或完成主要行动";
      }
      if (isTechTilePickingActive()) return "请先完成科技选择";
      if (isCardSelectionActive()) return "请先完成精选";
      if (isDiscardSelectionActive()) return "请先完成弃牌";
      if (isHandScanSelectionActive()) return "请先完成手牌扫描";
      if (isMovePaymentSelectionActive()) return "请先完成移动";
      return getStandardPlayCardActionBlockReason(player);
    }

    function getHandCardPlayActionForCard(card, player = getCurrentPlayer()) {
      if (!card) return null;
      const blockReason = getPlayCardSelectionBlockReason(player);
      if (blockReason) return null;

      const cost = getCardPlayCost(card);
      if (!players.canAfford(player, cost)) return null;
      return {
        actionKind: "play",
        label: "打出",
        cost,
      };
    }

    function beginCardSelection(pendingAction = null) {
      if (isTechTilePickingActive()) {
        return { ok: false, message: "请先完成科技选择" };
      }
      if (isDiscardSelectionActive()) {
        return { ok: false, message: "请先完成弃牌" };
      }
      if (isPlayCardSelectionActive()) {
        return { ok: false, message: "请先完成打牌" };
      }
      if (isHandScanSelectionActive()) {
        return { ok: false, message: "请先完成手牌扫描" };
      }
      if (isMovePaymentSelectionActive()) {
        return { ok: false, message: "请先完成移动" };
      }

      pendingState.cardSelectionAction = pendingAction;
      cards.setSelectionActive(cardState, true);
      rocketState.statusNote = pendingAction?.type === "public_scan"
        ? (pendingAction.maxSelectable ?? 1) > 1
          ? `公共牌区扫描：${getPublicScanSelectionInstruction(pendingAction)}`
          : "公共牌区扫描：请选择一张亮明的公共牌（不能盲抽）"
        : pendingAction?.type === "place_data_choose_card"
          ? "放置数据：精选一张公共牌，或点击盲抽"
        : pendingAction?.type === "tech_bonus_pick_card"
          ? "科技奖励：精选一张公共牌，或点击盲抽"
        : pendingAction?.type === "jiuzhe_trace_pick"
          ? "九折痕迹：精选一张公共牌"
        : pendingAction?.type === "yichangdian_anomaly_pick"
          ? "异常奖励：精选一张公共牌，或点击盲抽"
        : pendingAction?.type === "card_trigger_pick"
          ? "卡牌触发：精选一张公共牌，或点击盲抽"
        : pendingAction?.type === "card_pick_corner_reward"
          ? "精选：选择一张公共牌，并获得其左上角奖励"
        : pendingAction?.type === "card_public_corner_discard"
          ? `公共牌角标：请选择 ${pendingAction.minSelectable || pendingAction.count || 3} 张公共牌弃除`
        : pendingAction?.type === "industry_mission_pick"
          ? "任务中继站：精选 1 张公共牌并获得收入角标奖励"
        : pendingAction?.type === "industry_fenwick_pick"
          ? "芬威克研究中心：精选 1 张公共牌并获得弃牌角标"
        : pendingAction?.type === "industry_strategy_pick"
          ? "宇宙战略集团：精选 1 张公共牌"
        : pendingAction?.type === "industry_future_pick"
          ? "未来跨度研究所：精选 1 张公共牌，并提高目标分"
        : pendingAction?.type === "industry_deepspace_public"
          ? "深空探测：请选择 1 张公共牌完成交换"
        : pendingAction?.type === "fundamentalism_exchange_pick"
          ? "原教旨主义：精选 1 张公共牌"
        : allowsBlindDrawInSelection()
        ? "精选：从公共牌区选一张牌，或点击盲抽"
        : "精选：从公共牌区选一张牌";
      syncCardSelectionChrome();
      updateActionButtons();
      renderStateReadout();
      return { ok: true, message: rocketState.statusNote };
    }

    function cancelCardSelection() {
      const pending = pendingState.cardSelectionAction;
      pendingState.cardSelectionAction = null;
      cards.setSelectionActive(cardState, false);
      if (pending?.type === "trade" && pending.player && pending.refundCost) {
        if (pending.beforeTradeState) {
          historyCommands.createRestoreTradeStateCommand(
            pending.player,
            cardState,
            pending.beforeTradeState,
          ).undo();
          rocketState.statusNote = "已取消精选，已恢复交易前状态";
          renderPlayerHand();
          renderPublicCards();
          updatePublicCardControls();
        } else {
          players.gainResources(pending.player, pending.refundCost);
          rocketState.statusNote = `已取消精选，已退回 ${players.formatResourceCost(pending.refundCost)}`;
        }
      } else if (pending?.type === "public_scan") {
        rocketState.statusNote = "已取消公共牌区扫描";
      } else if (pending?.type === "place_data_choose_card") {
        if (pending.fromEffectFlow && pending.autoDataPlacement) {
          rocketState.statusNote = "已取消放置数据精选";
          const continued = continuePendingDataPlacementAfterBonus(rocketState.statusNote);
          syncCardSelectionChrome();
          renderPlayerStats();
          updateActionButtons();
          renderStateReadout();
          return continued;
        }
        completeQuickActionStep();
        rocketState.statusNote = "已取消放置数据精选";
      } else if (pending?.type === "tech_bonus_pick_card") {
        rocketState.statusNote = "已取消科技奖励精选";
      } else if (pending?.type === "jiuzhe_trace_pick") {
        rocketState.statusNote = "已取消九折痕迹精选";
        if (pending.fromEffectFlow && getCurrentActionEffect()) {
          getCurrentActionEffect().result = {
            ok: true,
            undoable: true,
            message: rocketState.statusNote,
          };
          completeCurrentActionEffect();
        }
      } else if (pending?.type === "yichangdian_anomaly_pick") {
        rocketState.statusNote = "已取消异常奖励精选";
        if (pending.fromEffectFlow && getCurrentActionEffect()) {
          const baseResult = pending.effectResult || {};
          getCurrentActionEffect().result = {
            ok: baseResult.ok ?? true,
            undoable: baseResult.undoable ?? true,
            message: baseResult.message
              ? `${baseResult.message}；${rocketState.statusNote}`
              : rocketState.statusNote,
            events: baseResult.events || [],
            payload: baseResult.payload || null,
          };
          completeCurrentActionEffect();
        }
      } else if (pending?.type === "chong_pick_card") {
        rocketState.statusNote = "已取消虫族奖励精选";
        if (pending.fromEffectFlow && getCurrentActionEffect()) {
          getCurrentActionEffect().result = {
            ok: true,
            undoable: true,
            message: rocketState.statusNote,
          };
          completeCurrentActionEffect();
        }
      } else if (pending?.type === "amiba_pick_card") {
        rocketState.statusNote = "已取消阿米巴奖励精选";
        if (pending.fromEffectFlow && getCurrentActionEffect()) {
          getCurrentActionEffect().result = {
            ok: true,
            undoable: true,
            message: rocketState.statusNote,
          };
          completeCurrentActionEffect();
        }
      } else if (pending?.type === "card_trigger_pick") {
        rocketState.statusNote = "已取消卡牌触发精选";
      } else if (pending?.type === "card_pick_corner_reward") {
        rocketState.statusNote = "已取消卡牌角标精选";
        if (pending.fromEffectFlow && getCurrentActionEffect()) {
          getCurrentActionEffect().result = {
            ok: true,
            undoable: true,
            message: rocketState.statusNote,
          };
          completeCurrentActionEffect("skipped");
        }
      } else if (pending?.type === "card_public_corner_discard") {
        rocketState.statusNote = "已取消公共牌角标弃除";
        if (pending.fromEffectFlow && getCurrentActionEffect()) {
          getCurrentActionEffect().result = {
            ok: true,
            undoable: true,
            message: rocketState.statusNote,
          };
          completeCurrentActionEffect("skipped");
        }
      } else if (pending?.type === "fundamentalism_exchange_pick") {
        if (pending.player && pending.beforePlayerState) {
          restoreObjectSnapshot(pending.player, pending.beforePlayerState);
        }
        if (pending.beforeCardState) {
          restoreObjectSnapshot(cardState, pending.beforeCardState);
        }
        rocketState.statusNote = "已取消原教旨主义精选兑换";
      } else if (pending?.type?.startsWith?.("industry_")) {
        return rollbackPendingIndustryQuickAction("已取消公司 1x 行动");
      } else {
        rocketState.statusNote = "";
      }
      syncCardSelectionChrome();
      renderPlayerStats();
      if (pending?.type === "card_trigger_pick" && continueAfterCardTriggerResolution()) {
        return;
      }
      updateActionButtons();
      maybeContinuePendingTurnEndRevealFlow();
      renderStateReadout();
    }

    function finalizeCardSelectionResult(result) {
      if (!result?.ok) {
        rocketState.statusNote = result?.message || "精选失败";
        renderStateReadout();
        return result;
      }

      cards.setSelectionActive(cardState, false);
      const pending = pendingState.cardSelectionAction;
      pendingState.cardSelectionAction = null;
      rocketState.statusNote = pending?.type === "trade"
        ? `快速交易精选：${cards.getCardLabel(result.card)}`
        : `获得卡牌：${cards.getCardLabel(result.card)}`;
      if (result.replenished) {
        rocketState.statusNote += `，公共区已补牌：${cards.getCardLabel(result.replenished)}`;
      }
      if (pending?.type === "trade" && pending.beforeTradeState) {
        const trade = quickTrades.getTradeAction(pending.tradeId);
        appendActionLogStep(
          HISTORY_SOURCE_QUICK,
          trade ? `快速交易：${trade.label}` : "快速交易精选",
          rocketState.statusNote,
        );
        clearHistoryStepOrderForSource(HISTORY_SOURCE_QUICK);
        if (quickActionHistory.hasSession()) quickActionHistory.commitSession();
      }
      if (pending?.type === "planet_reward_pick_card") {
        markCurrentActionIrreversible("公共牌补牌翻出新牌", "hidden_card_reveal");
        if (getCurrentActionEffect()) {
          getCurrentActionEffect().result = {
            ok: true,
            undoable: false,
            irreversible: { code: "hidden_card_reveal", reason: "公共牌补牌翻出新牌" },
            message: rocketState.statusNote,
            payload: { card: result.card, replenished: result.replenished || null },
          };
        }
        completeCurrentActionEffect();
      }
      if (pending?.type === "tech_bonus_pick_card") {
        markCurrentActionIrreversible("公共牌补牌翻出新牌", "hidden_card_reveal");
        const bonusResult = abilities.executeAbility("researchTechBonus", createActionContext(), {
          bonusId: pending.bonusId,
          firstTake: Boolean(pending.firstTake),
          skipCardSelection: true,
        });
        recordTechBonusScore(pending.player || getCurrentPlayer(), bonusResult);
        if (getCurrentActionEffect()) {
          getCurrentActionEffect().result = {
            ok: true,
            undoable: false,
            irreversible: { code: "hidden_card_reveal", reason: "公共牌补牌翻出新牌" },
            message: `${rocketState.statusNote}${bonusResult?.message ? `；${bonusResult.message}` : ""}`,
            events: [{
              type: "researchTech",
              playerId: pending.player?.id || getCurrentPlayer()?.id || null,
              playerColor: pending.player?.color || getCurrentPlayer()?.color || null,
              techType: pending.selection?.techType || null,
              tileId: pending.selection?.tileId || null,
              source: pendingState.actionEffectFlow?.actionType || "tech",
            }],
            payload: {
              card: result.card,
              replenished: result.replenished || null,
              bonus: bonusResult?.payload || bonusResult || null,
            },
          };
        }
        if (bonusResult?.message) rocketState.statusNote += `；${bonusResult.message}`;
        completeCurrentActionEffect();
      }
      if (pending?.type === "place_data_choose_card") {
        if (pending.fromEffectFlow && pending.autoDataPlacement) {
          recordHistoryCommand(historyCommands.createRestoreObjectCommand(
            cardState,
            pending.beforeCardState,
            "恢复放置数据精选前牌区",
          ));
          continuePendingDataPlacementAfterBonus(rocketState.statusNote);
        } else {
          appendActionLogStep(HISTORY_SOURCE_QUICK, "放置数据", rocketState.statusNote);
          clearHistoryStepOrderForSource(HISTORY_SOURCE_QUICK);
          if (quickActionHistory.hasSession()) quickActionHistory.commitSession();
        }
      }
      if (pending?.type === "jiuzhe_trace_pick") {
        rocketState.statusNote = `九折痕迹精选：${cards.getCardLabel(result.card)}`;
        if (pending.fromEffectFlow) {
          markCurrentActionIrreversible("公共牌补牌翻出新牌", "hidden_card_reveal");
          if (getCurrentActionEffect()) {
            getCurrentActionEffect().result = {
              ok: true,
              undoable: false,
              irreversible: { code: "hidden_card_reveal", reason: "公共牌补牌翻出新牌" },
              message: rocketState.statusNote,
              payload: { card: result.card, replenished: result.replenished || null },
            };
          }
          completeCurrentActionEffect();
        }
      }
      if (pending?.type === "yichangdian_anomaly_pick") {
        rocketState.statusNote = `异常奖励精选：${cards.getCardLabel(result.card)}`;
        if (pending.fromEffectFlow) {
          const baseResult = pending.effectResult || {};
          markCurrentActionIrreversible("公共牌补牌翻出新牌", "hidden_card_reveal");
          if (getCurrentActionEffect()) {
            getCurrentActionEffect().result = {
              ok: true,
              undoable: false,
              irreversible: { code: "hidden_card_reveal", reason: "公共牌补牌翻出新牌" },
              message: baseResult.message
                ? `${baseResult.message}；${rocketState.statusNote}`
                : rocketState.statusNote,
              events: baseResult.events || [],
              payload: {
                ...(baseResult.payload ? { base: baseResult.payload } : {}),
                card: result.card,
                replenished: result.replenished || null,
              },
            };
          }
          completeCurrentActionEffect();
        }
      }
      if (pending?.type === "chong_pick_card") {
        rocketState.statusNote = `虫族奖励精选：${cards.getCardLabel(result.card)}`;
        if (pending.fromEffectFlow) {
          markCurrentActionIrreversible("公共牌补牌翻出新牌", "hidden_card_reveal");
          if (getCurrentActionEffect()) {
            getCurrentActionEffect().result = {
              ok: true,
              undoable: false,
              irreversible: { code: "hidden_card_reveal", reason: "公共牌补牌翻出新牌" },
              message: rocketState.statusNote,
              payload: { card: result.card, replenished: result.replenished || null },
            };
          }
          completeCurrentActionEffect();
        } else {
          beginQuickActionStep("chong-pick-card", pending.effectLabel || "虫族奖励精选", {
            logBefore: pending.logBefore,
          });
          if (pending.beforePlayerState) {
            recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
              playerState,
              pending.beforePlayerState,
              "恢复虫族精选前玩家状态",
            ));
          }
          if (pending.beforeCardState) {
            recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
              cardState,
              pending.beforeCardState,
              "恢复虫族精选前牌区状态",
            ));
          }
          completeQuickActionStep(rocketState.statusNote, {
            irreversibleCode: "hidden_card_reveal",
            irreversibleReason: "虫族奖励精选翻出新牌",
          });
          keepExistingMainActionPendingAfterChongTask();
        }
      }
      if (pending?.type === "amiba_pick_card") {
        rocketState.statusNote = `阿米巴奖励精选：${cards.getCardLabel(result.card)}`;
        if (pending.fromEffectFlow) {
          markCurrentActionIrreversible("公共牌补牌翻出新牌", "hidden_card_reveal");
          if (getCurrentActionEffect()) {
            getCurrentActionEffect().result = {
              ok: true,
              undoable: false,
              irreversible: { code: "hidden_card_reveal", reason: "公共牌补牌翻出新牌" },
              message: rocketState.statusNote,
              payload: { card: result.card, replenished: result.replenished || null },
            };
          }
          completeCurrentActionEffect();
        }
      }
      if (pending?.type === "card_trigger_pick") {
        const match = pending.triggerMatch;
        beginQuickActionStep("card-trigger-pick", `卡牌触发：${match?.effect?.label || "精选"}`);
        if (match?.card && match?.trigger) {
          cardEffects.consumeTrigger(match.card, match.trigger.id);
          discardReservedCardIfFinished(pending.player || getCurrentPlayer(), match.card);
        }
        rocketState.statusNote = `卡牌触发精选：${cards.getCardLabel(result.card)}`;
        for (const command of createCardTriggerProgressCommands(pending.triggerSnapshot, "卡牌触发精选")) {
          recordQuickHistoryCommand(command);
        }
        completeQuickActionStep(rocketState.statusNote, {
          undoable: false,
          irreversibleCode: "hidden_card_reveal",
          irreversibleReason: "卡牌触发精选翻出新牌",
        });
        continueAfterCardTriggerResolution();
      }
      if (pending?.type === "card_pick_corner_reward") {
        const player = pending.player || getCurrentPlayer();
        const beforePlayer = pending.beforePlayerState || structuredClone(player);
        const beforeCardState = pending.beforeCardState || {
          publicCards: cardState.publicCards.slice(),
          discardPile: (cardState.discardPile || []).slice(),
        };
        const rewardResult = applyCardCornerRewardFromCard(player, result.card, {
          source: "card_pick_corner",
          insertMoveIntoCurrentFlow: true,
        });
        markCurrentActionIrreversible("公共牌补牌翻出新牌", "hidden_card_reveal");
        recordHistoryCommand(historyCommands.createRestorePlayerCommand(
          player,
          beforePlayer,
          "恢复精选角标奖励前玩家状态",
        ));
        recordHistoryCommand(historyCommands.createRestorePublicCardsCommand(
          cardState,
          beforeCardState.publicCards,
          beforeCardState.discardPile,
        ));
        if (getCurrentActionEffect()) {
          getCurrentActionEffect().result = {
            ok: rewardResult.ok,
            undoable: false,
            irreversible: { code: "hidden_card_reveal", reason: "公共牌补牌翻出新牌" },
            message: `精选 ${cards.getCardLabel(result.card)}；${rewardResult.message}`,
            payload: { card: result.card, replenished: result.replenished || null, corner: rewardResult },
          };
        }
        rocketState.statusNote = getCurrentActionEffect()?.result?.message || rewardResult.message;
        completeCurrentActionEffect();
      }
      if (pending?.type === "industry_mission_pick") {
        const player = pending.player || getCurrentPlayer();
        const incomeResult = industry.applyIncomeResourcesFromCard(cards, players, data, player, result.card, {
          blindDraw: blindDrawCardForPlayer,
        });
        rocketState.statusNote = incomeResult.ok
          ? `任务中继站：精选 ${cards.getCardLabel(result.card)}，${incomeResult.message}`
          : incomeResult.message;
        finishIndustryAbilityFlow(rocketState.statusNote);
        commitIrreversibleIndustryQuickAction("任务中继站：精选", rocketState.statusNote);
      }
      if (pending?.type === "industry_fenwick_pick") {
        const player = pending.player || getCurrentPlayer();
        const reward = industry.getCornerReward(cards, result.card);
        const applied = reward
          ? industry.applyCornerReward(players, data, player, reward)
          : { ok: false, message: "该牌没有弃牌角标奖励" };
        if (applied.ok) addScoreSourceFromGain(player, SCORE_SOURCE_KEYS.INDUSTRY_EFFECT, reward?.gain);
        rocketState.statusNote = applied.ok
          ? `芬威克研究中心：精选 ${cards.getCardLabel(result.card)}，${applied.message}`
          : applied.message;
        if (applied.ok && applied.pendingFreeMove) {
          const moveCheck = canStartCardCornerFreeMove();
          if (moveCheck.ok) {
            pendingState.cardCornerFreeMove = {
              action: {
                label: "芬威克研究中心：免费移动",
                movementPoints: applied.pendingFreeMove.movementPoints || 1,
              },
              discardedCardLabel: cards.getCardLabel(result.card),
              finishIndustryFlowAfterMove: true,
              irreversibleIndustryFlow: true,
              industryLogLabel: "芬威克研究中心：精选",
              afterMoveStatus: rocketState.statusNote,
            };
            if (moveCheck.rocketsForPlayer.length === 1) {
              activateMoveMode(moveCheck.rocketsForPlayer[0].id);
            } else {
              selectDefaultRocketForCurrentPlayer();
            }
          } else {
            rocketState.statusNote = `${rocketState.statusNote}；${moveCheck.message}`;
            finishIndustryAbilityFlow(rocketState.statusNote);
            commitIrreversibleIndustryQuickAction("芬威克研究中心：精选", rocketState.statusNote);
          }
        } else {
          finishIndustryAbilityFlow(rocketState.statusNote);
          commitIrreversibleIndustryQuickAction("芬威克研究中心：精选", rocketState.statusNote);
        }
      }
      if (pending?.type === "industry_strategy_pick") {
        const player = pending.player || getCurrentPlayer();
        if (player) {
          const beforePlayer = structuredClone(player);
          industry?.clearStrategyPassiveSlots?.(player);
          recordQuickHistoryCommand(historyCommands.createRestorePlayerCommand(
            player,
            beforePlayer,
            "撤销宇宙战略集团：清理奖励槽",
          ));
        }
        rocketState.statusNote = `宇宙战略集团：精选 ${cards.getCardLabel(result.card)}`;
        finishIndustryAbilityFlow(rocketState.statusNote);
        commitIrreversibleIndustryQuickAction("宇宙战略集团：精选", rocketState.statusNote);
      }
      if (pending?.type === "industry_future_pick") {
        const player = pending.player || getCurrentPlayer();
        const advanceAmount = Math.round(Number(pending.advanceAmount ?? industry?.FUTURE_SPAN_PICK_ADVANCE_AMOUNT) || 2);
        const advanceResult = industry.advanceFutureSpanTarget?.(player, advanceAmount);
        rocketState.statusNote = advanceResult?.ok
          ? `未来跨度研究所：精选 ${cards.getCardLabel(result.card)}，目标提高到 ${advanceResult.targetScore} 分`
          : (advanceResult?.message || "未来跨度目标分更新失败");
        finishIndustryAbilityFlow(rocketState.statusNote);
        commitIrreversibleIndustryQuickAction("未来跨度研究所：精选", rocketState.statusNote);
      }
      if (pending?.type === "fundamentalism_exchange_pick") {
        const player = pending.player || getCurrentPlayer();
        beginEffectHistoryStep(pending.effectLabel || "原教旨主义：精选兑换");
        recordHistoryCommand(historyCommands.createRestorePlayerCommand(
          player,
          pending.beforePlayerState,
          "恢复原教旨主义精选兑换前玩家状态",
        ));
        recordHistoryCommand(historyCommands.createRestoreObjectCommand(
          cardState,
          pending.beforeCardState,
          "恢复原教旨主义精选兑换前牌区",
        ));
        rocketState.statusNote = `原教旨主义：3分换1精选，获得 ${cards.getCardLabel(result.card)}`;
        if (getCurrentActionEffect()) {
          getCurrentActionEffect().result = {
            ok: true,
            undoable: false,
            irreversible: { code: "hidden_card_reveal", reason: "公共牌补牌翻出新牌" },
            message: rocketState.statusNote,
            payload: { card: result.card, replenished: result.replenished || null, choiceId: pending.choiceId || null },
          };
        }
        completeCurrentActionEffect();
      }
      ensurePublicCardsFilledRespectingDelayedRefills();
      syncCardSelectionChrome();
      renderPublicCards();
      renderPlayerStats();
      if (pending?.type === "card_trigger_pick" && continueAfterCardTriggerResolution()) {
        return result;
      }
      updateActionButtons();
      maybeContinuePendingTurnEndRevealFlow();
      renderStateReadout();
      return result;
    }

    function drawBasicCardToPlayer(player) {
      const target = player || getCurrentPlayer();
      if (!target) {
        return { ok: false, message: "没有当前玩家", card: null };
      }

      if (!Array.isArray(target.hand)) {
        target.hand = [];
      }

      return cards.blindDraw(cardState, playerState, target);
    }

    function blindDrawCardForPlayer(player) {
      return drawBasicCardToPlayer(player);
    }

    function drawCardForCurrentPlayer(options = {}) {
      const currentPlayer = getCurrentPlayer();
      const fromSelection = Boolean(options.fromSelection);
      const drawResult = blindDrawCardForPlayer(currentPlayer);

      if (!drawResult.ok) {
        rocketState.statusNote = drawResult.message;
        renderStateReadout();
        return drawResult;
      }

      if (fromSelection) {
        return finalizeCardSelectionResult(drawResult);
      }

      rocketState.statusNote = `盲抽：${cards.getCardLabel(drawResult.card)}`;
      renderPlayerStats();
      renderPublicCards();
      updatePublicCardControls();
      renderStateReadout();
      return { ok: true, card: drawResult.card, message: rocketState.statusNote };
    }

    function pickPublicCardForCurrentPlayer(slotIndex) {
      const currentPlayer = getCurrentPlayer();
      const pickResult = cards.pickFromPublic(cardState, playerState, currentPlayer, slotIndex);
      return finalizeCardSelectionResult(pickResult);
    }

    function discardCardFromCurrentPlayer() {
      return beginDiscardSelection(1);
    }

    function canBlindDraw() {
      return cards.getAvailablePool(cardState, playerState).length > 0;
    }

    function updatePublicCardControls() {
      if (!els.publicBlindDrawButton) return;

      const selectionActive = isCardSelectionActive();
      const allowsBlindDraw = allowsBlindDrawInSelection();
      const canDraw = canBlindDraw();
      const enabled = selectionActive && allowsBlindDraw && canDraw;
      els.publicBlindDrawButton.disabled = !enabled;
      els.publicBlindDrawButton.classList.toggle("is-selectable", enabled);
      els.publicBlindDrawButton.title = !selectionActive
        ? "请先进入精选"
        : !allowsBlindDraw
          ? "本次精选不能盲抽"
          : canDraw
          ? "盲抽一张牌加入手牌"
          : "牌库已空";
    }

    function getDelayedPublicRefillSlotIndexes() {
      return getDelayedPublicRefillSlots(null)
        .map((item) => Number(item.slotIndex))
        .filter((slotIndex) => Number.isInteger(slotIndex));
    }

    function ensurePublicCardsFilledRespectingDelayedRefills() {
      return cards.ensurePublicCardsFilled(cardState, playerState, undefined, {
        skipSlotIndexes: getDelayedPublicRefillSlotIndexes(),
      });
    }

    function renderPublicCards() {
      return renderRuntime.renderPublicCards();
    }

    function handlePublicCardClick(slotIndex) {
      if (!isCardSelectionActive()) return;
      if (pendingState.cardSelectionAction?.type === "public_scan") {
        handlePublicScanCardClick(slotIndex);
        return;
      }
      if (pendingState.cardSelectionAction?.type === "card_public_corner_discard") {
        handlePublicCornerDiscardCardClick(slotIndex);
        return;
      }
      if (pendingState.cardSelectionAction?.type === "industry_deepspace_public") {
        finalizeIndustryDeepspaceSwap(slotIndex);
        return;
      }
      pickPublicCardForCurrentPlayer(slotIndex);
    }

    function handlePublicBlindDrawClick() {
      if (!isCardSelectionActive()) return;
      if (!allowsBlindDrawInSelection()) {
        rocketState.statusNote = "本次精选不能盲抽，请从公共牌区选择";
        renderStateReadout();
        return;
      }
      drawCardForCurrentPlayer({ fromSelection: true });
    }

    function isPassReserveSelectionActive() {
      return Boolean(pendingState.passReserveSelection);
    }

    function getPassReserveSelectionCards() {
      if (!pendingState.passReserveSelection) return [];
      return cards.getPassReservePile(cardState, pendingState.passReserveSelection.roundNumber);
    }

    function renderPassReserveSelection() {
      if (!els.passReserveSelectionGrid) return;

      const pending = pendingState.passReserveSelection;
      if (!pending) {
        els.passReserveSelectionGrid.replaceChildren();
        if (els.passReserveSelectionStatus) els.passReserveSelectionStatus.textContent = "";
        if (els.passReserveSelectionConfirm) els.passReserveSelectionConfirm.disabled = true;
        return;
      }

      const pile = getPassReserveSelectionCards();
      const selectedCardId = pending.selectedCardId || null;
      els.passReserveSelectionGrid.replaceChildren(...pile.map((card) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "pass-reserve-card-button";
        button.dataset.passReserveCardId = card.id;
        button.classList.toggle("is-selected", card.id === selectedCardId);
        button.setAttribute("aria-pressed", String(card.id === selectedCardId));
        button.setAttribute("aria-label", cards.getCardLabel(card));
        button.title = cards.getCardLabel(card);

        const image = document.createElement("img");
        image.src = card.src;
        image.alt = "";
        image.width = 747;
        image.height = 1040;
        image.decoding = "async";
        image.setAttribute("aria-hidden", "true");
        button.append(image);
        attachCardHoverPreview(button, card.src, cards.getCardLabel(card));
        return button;
      }));

      if (els.passReserveSelectionStatus) {
        els.passReserveSelectionStatus.textContent = selectedCardId
          ? `已选择 ${cards.getCardLabel(pile.find((card) => card.id === selectedCardId))}`
          : "请选择 1 张牌";
      }
      if (els.passReserveSelectionConfirm) {
        els.passReserveSelectionConfirm.disabled = !selectedCardId;
      }
    }

    function syncPassReserveSelectionChrome() {
      const active = isPassReserveSelectionActive();
      const visible = active && !pendingState.passReserveSelectionDismissed;
      els.appWrap?.classList.toggle("pass-reserve-selection-active", visible);
      if (!visible) hideCardHoverPreview();
      if (els.passReserveSelectionOverlay) {
        els.passReserveSelectionOverlay.hidden = !visible;
        els.passReserveSelectionOverlay.setAttribute("aria-hidden", String(!visible));
      }
      if (visible && els.passReserveSelectionTitle) {
        els.passReserveSelectionTitle.textContent = "PASS 预留精选";
      }
      if (visible && els.passReserveSelectionSubtitle) {
        const round = pendingState.passReserveSelection?.roundNumber || turnState.roundNumber;
        const count = getPassReserveSelectionCards().length;
        els.passReserveSelectionSubtitle.textContent = `第 ${round} 轮 PASS：从剩余 ${count} 张预留牌中选择 1 张。`;
      }
      renderPassReserveSelection();
    }

    function beginPassReserveSelection(effect) {
      const currentPlayer = getCurrentPlayer();
      const roundNumber = Math.round(Number(effect?.options?.roundNumber ?? turnState.roundNumber));
      const pile = cards.getPassReservePile(cardState, roundNumber);
      if (!pile.length) {
        rocketState.statusNote = "本轮没有可选 PASS 预留牌";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      if (
        pendingState.passReserveSelection
        && pendingState.passReserveSelection.effectId === (effect?.id || null)
        && pendingState.passReserveSelection.playerId === (currentPlayer?.id || null)
        && pendingState.passReserveSelection.roundNumber === roundNumber
      ) {
        pendingState.passReserveSelectionDismissed = false;
        const selected = pile.find((card) => card.id === pendingState.passReserveSelection.selectedCardId);
        rocketState.statusNote = selected
          ? `PASS 预留精选：已选择 ${cards.getCardLabel(selected)}`
          : `PASS 预留精选：请选择 1 张牌（剩余 ${pile.length} 张）`;
        syncPassReserveSelectionChrome();
        updateActionButtons();
        renderStateReadout();
        return { ok: true, awaitingChoice: true, message: rocketState.statusNote };
      }

      pendingState.passReserveSelection = {
        effectId: effect?.id || null,
        playerId: currentPlayer?.id || null,
        roundNumber,
        selectedCardId: null,
      };
      pendingState.passReserveSelectionDismissed = false;
      rocketState.statusNote = `PASS 预留精选：请选择 1 张牌（剩余 ${pile.length} 张）`;
      syncPassReserveSelectionChrome();
      updateActionButtons();
      renderStateReadout();
      return { ok: true, awaitingChoice: true, message: rocketState.statusNote };
    }

    function dismissPassReserveSelectionOverlay(options = {}) {
      if (!pendingState.passReserveSelection) return { ok: false, message: "当前没有 PASS 预留精选" };
      pendingState.passReserveSelectionDismissed = true;
      syncPassReserveSelectionChrome();
      rocketState.statusNote = "PASS 预留精选已临时关闭；再次点击效果栏的 PASS 预留精选可继续选择";
      if (!options.silent) renderStateReadout();
      return { ok: true, dismissed: true, message: rocketState.statusNote };
    }

    function selectPassReserveCard(cardId) {
      if (!pendingState.passReserveSelection) return;
      const pile = getPassReserveSelectionCards();
      const match = pile.find((card) => card.id === cardId);
      if (!match) return;
      pendingState.passReserveSelection.selectedCardId = match.id;
      renderPassReserveSelection();
      rocketState.statusNote = `PASS 预留精选：已选择 ${cards.getCardLabel(match)}`;
      renderStateReadout();
    }

    function confirmPassReserveSelection() {
      const pending = pendingState.passReserveSelection;
      if (!pending?.selectedCardId) return { ok: false, message: "请先选择 PASS 预留牌" };

      const currentEffect = getCurrentActionEffect();
      if (!currentEffect || currentEffect.id !== pending.effectId) {
        return { ok: false, message: "当前 PASS 精选效果已失效" };
      }

      const player = getPlayerById(pending.playerId) || getCurrentPlayer();
      const beforePlayer = structuredClone(player);
      const beforeCardState = structuredClone(cardState);
      const result = cards.pickPassReserveCard(
        cardState,
        player,
        pending.roundNumber,
        pending.selectedCardId,
      );
      if (!result.ok) {
        rocketState.statusNote = result.message;
        renderStateReadout();
        return result;
      }

      beginEffectHistoryStep(currentEffect.label);
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        player,
        beforePlayer,
        "恢复 PASS 精选前玩家状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        cardState,
        beforeCardState,
        "恢复 PASS 精选前牌区",
      ));
      currentEffect.result = {
        ok: true,
        undoable: true,
        message: result.message,
        payload: { card: result.card, roundNumber: pending.roundNumber },
      };
      pendingState.passReserveSelection = null;
      pendingState.passReserveSelectionDismissed = false;
      syncPassReserveSelectionChrome();
      rocketState.statusNote = result.message;
      renderPlayerHand();
      renderPlayerStats();
      completeCurrentActionEffect();
      updateActionButtons();
      renderStateReadout();
      return result;
    }


    function initCardMoveEffectState(effect) {
      const movementPoints = Math.max(1, Math.round(Number(effect.options?.movementPoints || 1)));
      pendingState.actionEffectFlow.cardMoveEffect = {
        effect,
        poolRemaining: movementPoints,
        deferredType1Events: [],
        moved: false,
      };
      effect.badge = String(movementPoints);
    }

    function isIndustryHuanyuMoveEffect(effect) {
      return Boolean(
        effect?.options?.industryHuanyuMoveGroupId
        && effect.options?.requireDifferentRocketInGroup,
      );
    }

    function getEffectResultRocketId(effect) {
      const rocketId = effect?.result?.payload?.rocketId
        ?? effect?.result?.rocket?.id
        ?? effect?.result?.rocketId;
      const normalized = Math.round(Number(rocketId));
      return Number.isInteger(normalized) ? normalized : null;
    }

    function getCompletedIndustryHuanyuMoveRocketIds(effect) {
      const groupId = effect?.options?.industryHuanyuMoveGroupId || null;
      if (!groupId || !pendingState.actionEffectFlow?.effects?.length) return new Set();
      const used = new Set();
      for (const candidate of pendingState.actionEffectFlow.effects) {
        if (!candidate || candidate === effect || candidate.id === effect.id) continue;
        if (candidate.options?.industryHuanyuMoveGroupId !== groupId) continue;
        if (candidate.status !== "completed" || candidate.result?.skipped) continue;
        const rocketId = getEffectResultRocketId(candidate);
        if (rocketId != null) used.add(rocketId);
      }
      return used;
    }

    function validateIndustryHuanyuMoveRocket(effect, rocketId) {
      if (!isIndustryHuanyuMoveEffect(effect)) return { ok: true };
      const normalizedRocketId = Math.round(Number(rocketId));
      if (!Number.isInteger(normalizedRocketId)) {
        return { ok: false, message: `${effect.label || "寰宇动力"}：请选择要移动的火箭` };
      }
      if (getCompletedIndustryHuanyuMoveRocketIds(effect).has(normalizedRocketId)) {
        return {
          ok: false,
          message: `${effect.label || "寰宇动力"}：该火箭已经结算过寰宇移动，请选择另一枚火箭或跳过本次移动`,
        };
      }
      return { ok: true };
    }

    function getMovableTokensForCardMoveEffect(effect, playerId) {
      const rocketsForPlayer = getMovableTokensForPlayer(playerId);
      if (!isIndustryHuanyuMoveEffect(effect)) return rocketsForPlayer;
      const usedRocketIds = getCompletedIndustryHuanyuMoveRocketIds(effect);
      return rocketsForPlayer.filter((rocket) => !usedRocketIds.has(Number(rocket.id)));
    }

    function getCardMoveEffectCost(effect) {
      return normalizeResourceCost(effect?.options?.cost) || {};
    }

    function addResourceCosts(...costs) {
      const total = {};
      for (const cost of costs) {
        for (const [key, value] of Object.entries(cost || {})) {
          const amount = Math.max(0, Math.round(Number(value) || 0));
          if (amount <= 0) continue;
          total[key] = (total[key] || 0) + amount;
        }
      }
      return total;
    }

    function selectDefaultRocketFromCandidates(rocketsForPlayer) {
      const currentRocket = rocketActions.getActiveRocket(rocketState);
      if (rocketsForPlayer.some((rocket) => rocket.id === currentRocket?.id)) {
        return currentRocket;
      }
      const fallbackRocket = rocketsForPlayer[rocketsForPlayer.length - 1] || null;
      rocketState.activeRocketId = fallbackRocket ? fallbackRocket.id : null;
      clearMoveRocketHighlight();
      return fallbackRocket;
    }

    function executeCardEffectMove(deltaX, deltaY, rocketId, payment = {}) {
      const ctx = pendingState.actionEffectFlow?.cardMoveEffect;
      const effect = ctx?.effect || getCurrentActionEffect();
      if (!effect) return { ok: false, message: "没有待结算的卡牌移动" };

      const huanyuRocketCheck = validateIndustryHuanyuMoveRocket(effect, rocketId);
      if (!huanyuRocketCheck.ok) {
        if (payment.discardCommand) payment.discardCommand.undo();
        rocketState.statusNote = huanyuRocketCheck.message;
        renderPlayerHand();
        renderStateReadout();
        return huanyuRocketCheck;
      }

      const currentPlayer = getCurrentPlayer();
      const effectCost = getCardMoveEffectCost(effect);
      if (Object.keys(effectCost).length && !players.canAfford(currentPlayer, effectCost)) {
        if (payment.discardCommand) payment.discardCommand.undo();
        rocketState.statusNote = `${effect.label}：需要 ${players.formatResourceCost(effectCost)}，可点击跳过`;
        renderPlayerHand();
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const terrainRequired = payment.terrainRequired
        || getRequiredMovePointsForUi(currentPlayer, rocketId, deltaX, deltaY, effect.options || {});
      const poolUsed = Number.isFinite(Number(payment.poolUsed))
        ? Math.max(0, Math.round(Number(payment.poolUsed)))
        : Math.min(ctx?.poolRemaining || 0, terrainRequired);
      const energyCost = Math.max(0, Math.round(Number(payment.energyCost) || 0));
      const moveCost = addResourceCosts(
        getCardMoveEffectCost(effect),
        energyCost > 0 ? { energy: energyCost } : {},
      );

      beginEffectHistoryStep(effect.options?.historyLabel || effect.label);

      const result = abilities.executeAbility("moveProbe", createActionContext(), {
        cost: moveCost,
        movementPoints: terrainRequired,
        rocketId,
        deltaX,
        deltaY,
        source: effect.options?.source || "card",
        historyLabel: effect.options?.historyLabel || effect.label,
        suppressArrivalRewards: Boolean(effect.options?.suppressArrivalRewards),
        ignoreAsteroidRestriction: Boolean(effect.options?.ignoreAsteroidRestriction),
      });
      if (result.rocket) renderRocketElement(result.rocket);
      if (!result.ok) {
        if (payment.discardCommand) payment.discardCommand.undo();
        endEffectHistoryStep();
        rocketState.statusNote = result.message;
        renderStateReadout();
        return result;
      }

      if (payment.discardCommand) recordHistoryCommand(payment.discardCommand);
      recordAbilityCommands(result);

      const moveEvents = Array.isArray(result.events) ? result.events.filter(Boolean) : [];
      if (ctx) {
        if (!Array.isArray(ctx.deferredType1Events)) ctx.deferredType1Events = [];
        ctx.deferredType1Events.push(...moveEvents);
        ctx.moved = true;
      }

      const messageParts = [];
      const appliedRewards = applyCardMoveAfterEventRewards(effect, result, messageParts);
      const sameRingReward = maybeApplyCardMoveSameRingReward(effect, result, messageParts);
      if (sameRingReward) appliedRewards.push(sameRingReward);
      const distinctEventReward = maybeApplyCardMoveDistinctEventReward(effect, result, messageParts);
      if (distinctEventReward) appliedRewards.push(distinctEventReward);
      const arrivalSettlement = settleCardTasksAfterEffect({ events: result.events, skipType1: true, render: false });
      const completedTransportForMovedToken = (arrivalSettlement?.chongCompletions || [])
        .some((item) => Number(item.event?.rocketId) === Number(rocketId));
      if (completedTransportForMovedToken) {
        const transportMessages = (arrivalSettlement.chongCompletions || [])
          .filter((item) => Number(item.event?.rocketId) === Number(rocketId))
          .map((item) => item.message)
          .filter(Boolean);
        if (transportMessages.length) messageParts.push(...transportMessages);
      }
      const rewardText = messageParts.length ? `；${messageParts.join("；")}` : "";

      if (ctx) {
        ctx.poolRemaining = completedTransportForMovedToken
          ? 0
          : Math.max(0, ctx.poolRemaining - poolUsed);
        effect.badge = String(ctx.poolRemaining);
      }

      rocketState.activeRocketId = null;
      clearMoveRocketHighlight();

      if (ctx && ctx.poolRemaining > 0) {
        pendingState.actionEffectFlow.cardMoveEffect = ctx;
        const currentPlayer = getCurrentPlayer();
        const rocketsForPlayer = getMovableTokensForPlayer(currentPlayer?.id);
        rocketState.statusNote = `${effect.label}：剩余 ${ctx.poolRemaining} 点移动力`;
        if (rocketsForPlayer.length === 1) {
          activateMoveMode(rocketsForPlayer[0].id);
        } else {
          deactivateMoveMode();
          rocketState.statusNote += "，请点击要移动的飞船";
        }
        effect.result = {
          ...result,
          events: [],
          deferredType1Events: [...(ctx.deferredType1Events || [])],
          message: `${result.message}${rewardText}`,
          payload: {
            ...(result.payload || {}),
            appliedRewards,
            poolRemaining: ctx.poolRemaining,
          },
        };
        renderActionEffectBar();
        renderPlayerStats();
        renderStateReadout();
        return effect.result;
      }

      pendingState.actionEffectFlow.cardMoveEffect = null;
      deactivateMoveMode();
      effect.result = {
        ...result,
        events: getAfterMoveEventsForEffect(effect),
        deferredType1Events: ctx ? [...(ctx.deferredType1Events || [])] : moveEvents,
        message: `${result.message}${rewardText}`,
        payload: {
          ...(result.payload || {}),
          appliedRewards,
        },
      };
      rocketState.statusNote = `${effect.label}：${effect.result.message}`;
      renderActionEffectBar();
      renderPlayerStats();
      completeCurrentActionEffect();
      renderStateReadout();
      return effect.result;
    }

    function finishCurrentCardMoveEffectEarly() {
      const ctx = pendingState.actionEffectFlow?.cardMoveEffect;
      const current = getCurrentActionEffect();
      if (!ctx || !current || current.status !== "active" || ctx.effect?.id !== current.id) return false;
      if (!ctx.moved && !current.result) return false;

      const poolRemaining = Math.max(0, Math.round(Number(ctx.poolRemaining) || 0));
      const deferredType1Events = Array.isArray(ctx.deferredType1Events)
        ? [...ctx.deferredType1Events]
        : [...(current.result?.deferredType1Events || [])];
      const previousMessage = current.result?.message || "";
      const endMessage = poolRemaining > 0
        ? `结束剩余 ${poolRemaining} 点移动力`
        : "移动已完成";

      pendingState.actionEffectFlow.cardMoveEffect = null;
      current.badge = "";
      current.result = {
        ...(current.result || {}),
        ok: true,
        undoable: current.result?.undoable !== false,
        events: getAfterMoveEventsForEffect(current),
        deferredType1Events,
        message: previousMessage ? `${previousMessage}；${endMessage}` : `${current.label}：${endMessage}`,
        payload: {
          ...(current.result?.payload || {}),
          poolRemaining: 0,
          endedEarly: poolRemaining > 0,
        },
      };

      deactivateMoveMode();
      rocketState.statusNote = current.result.message;
      renderActionEffectBar();
      renderPlayerStats();
      completeCurrentActionEffect();
      renderStateReadout();
      return true;
    }

    function requestCardEffectMove(deltaX, deltaY, rocketId) {
      const ctx = pendingState.actionEffectFlow?.cardMoveEffect;
      const effect = ctx?.effect || getCurrentActionEffect();
      if (!effect) return { ok: false, message: "没有待结算的卡牌移动" };

      const huanyuRocketCheck = validateIndustryHuanyuMoveRocket(effect, rocketId);
      if (!huanyuRocketCheck.ok) {
        rocketState.statusNote = huanyuRocketCheck.message;
        renderStateReadout();
        return huanyuRocketCheck;
      }

      const moveCheck = rocketActions.canMoveRocket(rocketState, rocketId, deltaX, deltaY);
      if (!moveCheck.ok) {
        rocketState.statusNote = moveCheck.message;
        renderStateReadout();
        return moveCheck;
      }

      const currentPlayer = getCurrentPlayer();
      const effectCost = getCardMoveEffectCost(effect);
      if (Object.keys(effectCost).length && !players.canAfford(currentPlayer, effectCost)) {
        rocketState.statusNote = `${effect.label}：需要 ${players.formatResourceCost(effectCost)}，可点击跳过`;
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      const terrainRequired = getRequiredMovePointsForUi(currentPlayer, rocketId, deltaX, deltaY, effect.options || {});
      const poolRemaining = ctx?.poolRemaining ?? Math.max(1, Math.round(Number(effect.options?.movementPoints || 1)));
      const poolUsed = Math.min(poolRemaining, terrainRequired);
      const paymentRequired = terrainRequired - poolUsed;

      if (paymentRequired > 0) {
        const payCheck = canPayForMove(currentPlayer, paymentRequired);
        if (!payCheck.ok) {
          rocketState.statusNote = payCheck.message;
          renderStateReadout();
          return payCheck;
        }

        pendingState.movePayment = {
          player: currentPlayer,
          deltaX,
          deltaY,
          rocketId,
          requiredMovePoints: paymentRequired,
          selectedHandIndices: [],
          cardMoveEffectContext: {
            terrainRequired,
            poolUsed,
          },
        };
        rocketState.statusNote = poolUsed > 0
          ? `${effect.label}：卡牌移动力 ${poolUsed} 点，还需 ${paymentRequired} 点（可弃移动牌或用能量）`
          : `${effect.label}：需要 ${paymentRequired} 点移动力（可弃移动牌或用能量）`;
        syncMovePaymentChrome();
        if (!isMovePaymentLockedForAiAutomation()) scrollToPlayerHandPanel();
        renderStateReadout();
        return { ok: true, message: rocketState.statusNote };
      }

      return executeCardEffectMove(deltaX, deltaY, rocketId, {
        terrainRequired,
        poolUsed,
        energyCost: 0,
      });
    }
    return {
      getDiscardCornerRewardMultiplier,
      multiplyRewardGain,
      multiplyDiscardActionReward,
      multiplyDiscardMoveReward,
      getCardCornerQuickActionForCard,
      shouldQueueCardCornerMoveQuickAction,
      canUseCardCornerQuickAction,
      formatCardCornerRewardMessage,
      getCardCornerEventKind,
      normalizeCardCornerRewardMultiplier,
      cardCornerCodesEqual,
      normalizeCardCornerTriggerCode,
      getDiscardActionTriggerResourceRewardForCode,
      getDiscardActionTriggerMoveRewardForCode,
      createCardCornerTriggerEventFields,
      applyCardCornerRewardFromCard,
      canStartCardCornerFreeMove,
      beginCardCornerFreeMove,
      cloneEffectEvent,
      getAfterMoveEventsForEffect,
      buildQueuedCardCornerMoveEffect,
      startCardCornerMoveEffectFlow,
      getCardPrice,
      getCardPlayCost,
      getCardPlayCreditCost,
      createPlayCardEvent,
      createImmediatePlayCardEvent,
      restoreObjectSnapshot,
      getFutureSpanCreditPriceForCard,
      getFutureSpanDeltaForCard,
      isFutureSpanEligibleHandCard,
      hasFutureSpanEligibleHandCard,
      hasPlayableFutureSpanCard,
      getStandardPlayCardActionBlockReason,
      formatCardPlayCost,
      getCardTypeCode,
      getPlayCardSelectionBlockReason,
      getHandCardPlayActionForCard,
      beginCardSelection,
      cancelCardSelection,
      finalizeCardSelectionResult,
      drawBasicCardToPlayer,
      blindDrawCardForPlayer,
      drawCardForCurrentPlayer,
      pickPublicCardForCurrentPlayer,
      discardCardFromCurrentPlayer,
      canBlindDraw,
      updatePublicCardControls,
      getDelayedPublicRefillSlotIndexes,
      ensurePublicCardsFilledRespectingDelayedRefills,
      renderPublicCards,
      handlePublicCardClick,
      handlePublicBlindDrawClick,
      isPassReserveSelectionActive,
      getPassReserveSelectionCards,
      renderPassReserveSelection,
      syncPassReserveSelectionChrome,
      beginPassReserveSelection,
      dismissPassReserveSelectionOverlay,
      selectPassReserveCard,
      confirmPassReserveSelection,
      initCardMoveEffectState,
      isIndustryHuanyuMoveEffect,
      getEffectResultRocketId,
      getCompletedIndustryHuanyuMoveRocketIds,
      validateIndustryHuanyuMoveRocket,
      getMovableTokensForCardMoveEffect,
      getCardMoveEffectCost,
      addResourceCosts,
      selectDefaultRocketFromCandidates,
      executeCardEffectMove,
      finishCurrentCardMoveEffectEarly,
      requestCardEffectMove,
    };
  }

  return { createCardRuntime };
});
