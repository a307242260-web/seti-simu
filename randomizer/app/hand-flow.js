(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppHandFlow = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createHandFlow(context = {}) {
    const {
      decisionSessions,
      cardState,
      rocketState,
      alienGameState,
      turnState,
      solarState,
      els,
      players,
      cards,
      quickTrades,
      data,
      industry,
      cardEffects,
      abilities,
      historyCommands,
      quickActionHistory,
      scanEffects,
      fangzhou,
      banrenma,
      chong,
      amiba,
      aomomo,
      runezu,
      solar,
      rocketActions,
      MOVE_ENERGY_COST,
      HISTORY_SOURCE_QUICK,
      SCORE_SOURCE_KEYS,
      getCurrentPlayer,
      getPlayerById,
      getPlayerByColor,
      getGameplayLockReason,
      isTechTilePickingActive,
      isCardSelectionActive,
      isDiscardSelectionActive,
      isPlayCardSelectionActive,
      isIndustryHandSelectionActive,
      hasActivePendingSubFlow,
      getHandCardPlayActionForCard,
      getCardCornerQuickActionForCard,
      canUseCardCornerQuickAction,
      shouldQueueCardCornerMoveQuickAction,
      canPayForMove,
      getRequiredMovePointsForUi,
      isMovePaymentCard,
      playerHasMovePaymentCard,
      hasPlayableFutureSpanCard,
      getStandardPlayCardActionBlockReason,
      getCardPlayCost,
      formatCardPlayCost,
      restoreObjectSnapshot,
      releaseFutureSpanAfterPlayWithHistory,
      markActionPending,
      renderPlayerHand,
      renderPlayerStats,
      renderReservedCardsFromTaskState,
      renderPublicCards,
      renderInitialSelectionArea,
      renderAlienPanels,
      renderStateReadout,
      updatePublicCardControls,
      updatePlayerHandPanelTitle,
      updateActionButtons,
      setQuickPanelOpen,
      syncInteractionFocusChrome,
      openScanTargetPicker,
      getPublicScanChoicesForCard,
      executeFreeMoveForScanAction4,
      executeFreeMoveForCardCorner,
      executeFreeMoveForCardTrigger,
      executeIndustryFreeMove,
      executeCardEffectMove,
      createActionContext,
      recordMoveActionHistory,
      executePrimaryBoardAction,
      renderRocketElement,
      clearMoveRocketHighlight,
      beginQuickActionStep,
      completeQuickActionStep,
      clearHistoryStepOrderForSource,
      addScoreSourceFromGain,
      isAlienFamilyCard,
      applyFangzhouCard1Rewards,
      applyRunezuSymbolReward,
      settleCardTasksAfterEffect,
      formatCardCornerRewardMessage,
      createCardCornerTriggerEventFields,
      canStartCardCornerFreeMove,
      beginCardCornerFreeMove,
      startCardCornerMoveEffectFlow,
      rollbackPendingIndustryQuickAction,
      continuePendingDataPlacementAfterBonus,
      applyIndustryPlayCardPassives,
      buildPlayCardEffectFlowQueue,
      createImmediatePlayCardEvent,
      createPlayCardEvent,
      recordPlayCardStart,
      startPlayCardEffectFlow,
      appendIndustryPlayPassiveStatus,
      recordMainActionIrreversibleBarrier,
      renderFangzhouCardDisplays,
      getFangzhouCard1RewardTargetOptions,
      getTargetPlayerOptions,
      buildFangzhouCard1EffectQueue,
      applyIncomeFromCard,
      beginEffectHistoryStep,
      recordHistoryCommand,
      getCurrentActionEffect,
      completeCurrentActionEffect,
      isIncomeDiscardActionType,
      scrollToPlayerCommandPanel,
      getCardTypeCode,
    } = context;
    const decisionState = context.decisionSessions?.createFacade?.({
      discardAction: "discard_action",
      cardSelectionAction: "card_selection_action",
      scanTargetAction: "scan_target_action",
      handScanAction: "hand_scan_action",
      alienTraceAction: "alien_trace_action",
      alienTracePickerState: "alien_trace_picker_state",
      alienRevealConfirmation: "alien_reveal_confirmation",
      actionEffectFlow: "action_effect_flow",
    }) || {};
    const HAND_CARD_PLAY_SESSION = "hand_card_play_action";
    const CARD_CORNER_QUICK_SESSION = "card_corner_quick_action";
    const PLAY_CARD_SELECTION_SESSION = "play_card_selection";
    const MOVE_PAYMENT_SESSION = "move_payment";
    const getMovePayment = () => decisionSessions.peek(MOVE_PAYMENT_SESSION);
    function setMovePayment(session) {
      if (!session) return decisionSessions.clear(MOVE_PAYMENT_SESSION);
      return decisionSessions.open(MOVE_PAYMENT_SESSION, session);
    }
    const peekPlayCardSelection = () => decisionSessions.peek(PLAY_CARD_SELECTION_SESSION);
    function setPlayCardSelection(session) {
      if (!session) return decisionSessions.clear(PLAY_CARD_SELECTION_SESSION);
      return decisionSessions.open(PLAY_CARD_SELECTION_SESSION, session);
    }
    const peekHandCardPlayAction = () => decisionSessions.peek(HAND_CARD_PLAY_SESSION);
    const peekCardCornerQuickAction = () => decisionSessions.peek(CARD_CORNER_QUICK_SESSION);
    function setHandCardPlayAction(action) {
      if (!action) return decisionSessions.clear(HAND_CARD_PLAY_SESSION);
      const pending = peekHandCardPlayAction();
      if (pending) return Object.assign(pending, action);
      return decisionSessions.open(HAND_CARD_PLAY_SESSION, action);
    }
    function setCardCornerQuickAction(action) {
      if (!action) return decisionSessions.clear(CARD_CORNER_QUICK_SESSION);
      const pending = peekCardCornerQuickAction();
      if (pending) return Object.assign(pending, action);
      return decisionSessions.open(CARD_CORNER_QUICK_SESSION, action);
    }
    let futureSpanPlayBeforePlayer = null;

    function getPlayCardBeforePlayerSnapshot(currentPlayer) {
      return futureSpanPlayBeforePlayer
        ? structuredClone(futureSpanPlayBeforePlayer)
        : structuredClone(currentPlayer);
    }

    function syncDiscardSelectionChrome() {
      const active = isDiscardSelectionActive();
      if (active) cancelHandCardContextActions({ silent: true });
      els.appWrap?.classList.toggle("discard-selection-active", active);
      els.playerHandPanel?.classList.toggle("discard-selection-active", active);
      els.playerHandPanel?.classList.toggle("player-hand-panel-focused", active);
      if (els.discardSelectionBackdrop) {
        els.discardSelectionBackdrop.hidden = !active;
        els.discardSelectionBackdrop.setAttribute("aria-hidden", String(!active));
      }
      if (els.discardSelectionCancel) {
        els.discardSelectionCancel.hidden = !active || Boolean(decisionState.discardAction?.required);
      }
      updatePlayerHandPanelTitle();
      if (active) setQuickPanelOpen(false);
      renderPlayerHand();
      renderInitialSelectionArea();
      syncInteractionFocusChrome();
    }

    function isHandScanSelectionActive() {
      return decisionState.handScanAction != null;
    }

    function syncHandScanSelectionChrome() {
      const active = isHandScanSelectionActive();
      if (active) cancelHandCardContextActions({ silent: true });
      els.appWrap?.classList.toggle("hand-scan-selection-active", active);
      els.playerHandPanel?.classList.toggle("hand-scan-selection-active", active);
      els.playerHandPanel?.classList.toggle("player-hand-panel-focused", active);
      if (els.handScanCancel) {
        els.handScanCancel.hidden = !active;
      }
      updatePlayerHandPanelTitle();
      if (active) setQuickPanelOpen(false);
      renderPlayerHand();
      renderInitialSelectionArea();
      syncInteractionFocusChrome();
    }

    function cancelHandScanSelection() {
      if (!isHandScanSelectionActive()) return;
      decisionState.handScanAction = null;
      rocketState.statusNote = "已取消手牌扫描";
      syncHandScanSelectionChrome();
      updateActionButtons();
      renderStateReadout();
    }

    function isMovePaymentSelectionActive() {
      return getMovePayment() != null;
    }

    function getMovePaymentPlayer() {
      const pending = getMovePayment();
      if (!pending) return null;
      const playerId = pending.player?.id || pending.playerId || null;
      if (playerId) return getPlayerById(playerId) || pending.player || null;
      const playerColor = pending.player?.color || pending.playerColor || null;
      if (playerColor) return getPlayerByColor(playerColor) || pending.player || null;
      return pending.player || getCurrentPlayer();
    }

    function isMovePaymentLockedForAiAutomation() {
      return Boolean(context.isMovePaymentLockedForAiAutomation?.());
    }

    function syncMovePaymentChrome() {
      const active = isMovePaymentSelectionActive();
      const lockedForAi = isMovePaymentLockedForAiAutomation();
      const manualActive = active && !lockedForAi;
      const preservesCardCornerMove = getMovePayment()?.supplementalMoveContext?.type === "card_corner_free_move";
      if (active && !preservesCardCornerMove) cancelHandCardContextActions({ silent: true });
      els.appWrap?.classList.toggle("move-payment-selection-active", manualActive);
      els.playerHandPanel?.classList.toggle("move-payment-selection-active", manualActive);
      els.playerHandPanel?.classList.toggle("player-hand-panel-focused", manualActive);
      if (els.movePaymentConfirm) {
        els.movePaymentConfirm.hidden = !manualActive;
        els.movePaymentConfirm.disabled = !manualActive;
      }
      if (els.movePaymentCancel) {
        els.movePaymentCancel.hidden = !manualActive;
      }
      updatePlayerHandPanelTitle();
      if (active) setQuickPanelOpen(false);
      renderPlayerHand();
      syncInteractionFocusChrome();
    }

    function scrollToPlayerHandPanel() {
      const panel = els.playerHandPanel;
      if (!panel) return;
      context.requestAnimationFrame?.(() => {
        panel.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
      });
    }

    function beginSupplementalMovePayment(options = {}) {
      const currentPlayer = getCurrentPlayer();
      const deltaX = Number(options.deltaX || 0);
      const deltaY = Number(options.deltaY || 0);
      const rocketId = Number(options.rocketId);
      const terrainRequired = Number.isFinite(Number(options.terrainRequired))
        ? Math.max(1, Math.round(Number(options.terrainRequired)))
        : getRequiredMovePointsForUi(currentPlayer, rocketId, deltaX, deltaY, options.moveOptions || {});
      const providedMovePoints = Math.max(0, Math.round(Number(options.providedMovePoints) || 0));
      const paymentRequired = Math.max(0, terrainRequired - providedMovePoints);

      if (paymentRequired <= 0) {
        return {
          ok: true,
          needsPayment: false,
          terrainRequired,
          providedMovePoints,
        };
      }

      const payCheck = canPayForMove(currentPlayer, paymentRequired);
      if (!payCheck.ok) {
        rocketState.statusNote = payCheck.message;
        renderStateReadout();
        return payCheck;
      }

      setMovePayment({
        player: currentPlayer,
        deltaX,
        deltaY,
        rocketId,
        requiredMovePoints: paymentRequired,
        totalRequiredMovePoints: terrainRequired,
        providedMovePoints,
        selectedHandIndices: [],
        supplementalMoveContext: options.context || null,
      });
      rocketState.statusNote = options.message
        || `移动：已有 ${providedMovePoints} 点移动力，还需 ${paymentRequired} 点（可弃移动牌或用能量）`;
      syncMovePaymentChrome();
      if (!isMovePaymentLockedForAiAutomation()) scrollToPlayerHandPanel();
      updateActionButtons();
      renderStateReadout();
      return {
        ok: true,
        needsPayment: true,
        terrainRequired,
        providedMovePoints,
        paymentRequired,
        message: rocketState.statusNote,
      };
    }

    function cancelMovePaymentSelection() {
      if (!isMovePaymentSelectionActive()) return;
      if (context.blockManualAiMovePayment && isMovePaymentLockedForAiAutomation()) {
        return context.blockManualAiMovePayment();
      }

      setMovePayment(null);
      rocketState.statusNote = "已取消移动";
      syncMovePaymentChrome();
      updateActionButtons();
      renderStateReadout();
    }

    function beginMovePaymentSelection(deltaX, deltaY, rocketId, options = {}) {
      const blocked = context.blockIncompatiblePendingQuickAction?.("move");
      if (blocked) return blocked;

      const gameplayLockReason = getGameplayLockReason();
      if (gameplayLockReason) {
        return { ok: false, message: gameplayLockReason };
      }

      if (isTechTilePickingActive()) return { ok: false, message: "请先完成科技选择" };
      if (isCardSelectionActive()) return { ok: false, message: "请先完成精选" };
      if (isDiscardSelectionActive()) return { ok: false, message: "请先完成弃牌" };
      if (isPlayCardSelectionActive()) return { ok: false, message: "请先完成打牌" };

      const currentPlayer = getCurrentPlayer();
      const requiredMovePoints = getRequiredMovePointsForUi(currentPlayer, rocketId, deltaX, deltaY);
      const payCheck = canPayForMove(currentPlayer, requiredMovePoints);
      if (!payCheck.ok) {
        rocketState.statusNote = payCheck.message;
        renderStateReadout();
        return payCheck;
      }

      const moveCheck = rocketActions.canMoveRocket(rocketState, rocketId, deltaX, deltaY);
      if (!moveCheck.ok) {
        rocketState.statusNote = moveCheck.message;
        renderStateReadout();
        return moveCheck;
      }

      setMovePayment({
        player: currentPlayer,
        deltaX,
        deltaY,
        rocketId,
        requiredMovePoints,
        selectedHandIndices: [],
        standardAction: options.standardAction || null,
      });
      rocketState.statusNote = requiredMovePoints > 1
        ? `移动：需要 ${requiredMovePoints} 点移动力，可选择移动牌，剩余用能量补齐`
        : "移动：选择移动牌弃置，或直接确认消耗 1 能量";
      syncMovePaymentChrome();
      if (!isMovePaymentLockedForAiAutomation()) scrollToPlayerHandPanel();
      updateActionButtons();
      renderStateReadout();
      return { ok: true, message: rocketState.statusNote };
    }

    function handleHandCardMovePayment(handIndex) {
      if (!isMovePaymentSelectionActive()) return;
      if (context.blockManualAiMovePayment && isMovePaymentLockedForAiAutomation()) {
        return context.blockManualAiMovePayment();
      }

      const currentPlayer = getMovePaymentPlayer();
      const index = Math.round(handIndex);
      const card = currentPlayer?.hand?.[index];
      if (!isMovePaymentCard(card)) return;

      const pending = getMovePayment();
      const selected = pending.selectedHandIndices || [];
      if (selected.includes(index)) {
        pending.selectedHandIndices = selected.filter((item) => item !== index);
      } else if (selected.length < (pending.requiredMovePoints || MOVE_ENERGY_COST)) {
        pending.selectedHandIndices = [...selected, index];
      }
      renderPlayerHand();
    }

    function confirmMovePayment(options = {}) {
      if (!isMovePaymentSelectionActive()) return;
      if (isMovePaymentLockedForAiAutomation() && options.automated !== true) {
        return context.blockManualAiMovePayment?.();
      }

      const currentPlayer = getMovePaymentPlayer();
      if (!currentPlayer) {
        rocketState.statusNote = "没有可支付移动消耗的玩家";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      const activePayment = getMovePayment();
      const { requiredMovePoints = MOVE_ENERGY_COST } = activePayment;
      const selectedHandIndices = [...(activePayment.selectedHandIndices || [])].sort((left, right) => left - right);
      let paymentNote = "";
      let handSnapshot = null;
      let discardPileSnapshot = null;
      let discardCommand = null;
      const selectedMoveCards = selectedHandIndices
        .map((index) => currentPlayer?.hand?.[index])
        .filter(Boolean);

      if (selectedMoveCards.length !== selectedHandIndices.length
        || selectedMoveCards.some((card) => !isMovePaymentCard(card))) {
        rocketState.statusNote = "请选择可弃置的移动牌";
        renderStateReadout();
        return;
      }

      const energyCost = Math.max(0, requiredMovePoints - selectedMoveCards.length);
      if (!players.canAfford(currentPlayer, { energy: energyCost })) {
        rocketState.statusNote = selectedMoveCards.length
          ? `能量不足，仍需 ${energyCost} 能量补齐移动力`
          : playerHasMovePaymentCard(currentPlayer)
            ? "能量不足，请选择移动牌弃置"
            : "能量不足，无法移动";
        renderStateReadout();
        return;
      }

      if (selectedHandIndices.length) {
        handSnapshot = currentPlayer.hand.slice();
        discardPileSnapshot = (cardState.discardPile || []).slice();
        const discardedCards = [];
        for (const index of [...selectedHandIndices].sort((left, right) => right - left)) {
          const discardResult = cards.discardFromHandAtIndex(currentPlayer, index);
          if (!discardResult.ok) {
            currentPlayer.hand = handSnapshot.slice();
            currentPlayer.resources.handSize = currentPlayer.hand.length;
            cardState.discardPile = discardPileSnapshot.slice();
            rocketState.statusNote = discardResult.message;
            renderStateReadout();
            return;
          }
          cards.addToDiscardPile(cardState, discardResult.card);
          discardedCards.push(discardResult.card);
        }
        discardCommand = historyCommands.createDiscardHandCardCommand(
          cardState,
          currentPlayer,
          handSnapshot,
          discardPileSnapshot,
        );
        paymentNote = `弃掉 ${discardedCards.reverse().map((card) => cards.getCardLabel(card)).join("、")}`;
      }
      if (energyCost > 0) {
        paymentNote = paymentNote
          ? `${paymentNote}，消耗 ${energyCost} 能量`
          : `消耗 ${energyCost} 能量`;
      }
      const providedMovePoints = Math.max(0, Math.round(Number(activePayment.providedMovePoints) || 0));
      const totalMovementPoints = providedMovePoints + selectedMoveCards.length + energyCost;
      const moveOptions = {
        cost: energyCost > 0 ? { energy: energyCost } : {},
        movementPoints: totalMovementPoints,
        historyLabel: `移动消耗 ${selectedMoveCards.length ? `${selectedMoveCards.length} 张移动牌` : ""}${selectedMoveCards.length && energyCost ? " + " : ""}${energyCost ? `${energyCost} 能量` : ""}`,
      };

      const pending = getMovePayment();
      const supplementalMoveContext = pending.supplementalMoveContext || null;
      const cardMoveEffectContext = pending.cardMoveEffectContext || null;
      setMovePayment(null);
      syncMovePaymentChrome();

      if (cardMoveEffectContext) {
        return executeCardEffectMove(pending.deltaX, pending.deltaY, pending.rocketId, {
          terrainRequired: cardMoveEffectContext.terrainRequired,
          poolUsed: cardMoveEffectContext.poolUsed,
          energyCost,
          discardCommand,
        });
      }

      if (supplementalMoveContext?.type === "scan_action_4") {
        return executeFreeMoveForScanAction4(pending.deltaX, pending.deltaY, pending.rocketId, {
          terrainRequired: supplementalMoveContext.terrainRequired,
          providedMovePoints,
          energyCost,
          discardCommand,
          fromMovePayment: true,
        });
      }
      if (supplementalMoveContext?.type === "card_corner_free_move") {
        return executeFreeMoveForCardCorner(pending.deltaX, pending.deltaY, pending.rocketId, {
          terrainRequired: supplementalMoveContext.terrainRequired,
          providedMovePoints,
          energyCost,
          discardCommand,
          fromMovePayment: true,
        });
      }
      if (supplementalMoveContext?.type === "card_trigger_free_move") {
        return executeFreeMoveForCardTrigger(pending.deltaX, pending.deltaY, pending.rocketId, {
          terrainRequired: supplementalMoveContext.terrainRequired,
          providedMovePoints,
          energyCost,
          discardCommand,
          fromMovePayment: true,
        });
      }
      if (supplementalMoveContext?.type === "industry_free_move") {
        return executeIndustryFreeMove(pending.deltaX, pending.deltaY, pending.rocketId, {
          terrainRequired: supplementalMoveContext.terrainRequired,
          providedMovePoints,
          energyCost,
          discardCommand,
          fromMovePayment: true,
        });
      }

      const moveCheck = rocketActions.canMoveRocket(rocketState, pending.rocketId, pending.deltaX, pending.deltaY);
      if (!moveCheck.ok) {
        rocketState.statusNote = moveCheck.message;
        renderPlayerStats();
        updateActionButtons();
        renderStateReadout();
        return moveCheck;
      }

      const moveResult = pending.standardAction && typeof executePrimaryBoardAction === "function"
        ? executePrimaryBoardAction(pending.standardAction, moveOptions, { skipValidation: true })
        : abilities.executeAbility("moveProbe", createActionContext(), {
          ...moveOptions,
          rocketId: pending.rocketId,
          deltaX: pending.deltaX,
          deltaY: pending.deltaY,
        });
      if (!moveResult.ok && discardCommand) {
        if (pending.standardAction) {
          const restoredPlayer = getCurrentPlayer();
          restoredPlayer.hand = handSnapshot.slice();
          restoredPlayer.resources.handSize = restoredPlayer.hand.length;
          cardState.discardPile = discardPileSnapshot.slice();
        } else {
          discardCommand.undo();
        }
      }
      if (moveResult.rocket) renderRocketElement(moveResult.rocket);
      if (moveResult.ok) {
        rocketState.activeRocketId = null;
        clearMoveRocketHighlight();
        rocketState.statusNote = `${paymentNote}，${moveResult.message}`;
        recordMoveActionHistory(moveResult, discardCommand);
        settleCardTasksAfterEffect({ events: moveResult.events, render: false });
      } else {
        rocketState.statusNote = moveResult.message;
      }

      renderPlayerStats();
      updateActionButtons();
      renderStateReadout();
      return moveResult;
    }

    function syncPlayCardSelectionChrome() {
      const active = isPlayCardSelectionActive();
      if (active) {
        setHandCardPlayAction(null);
        setCardCornerQuickAction(null);
        if (els.handCardPlayActionButton) {
          els.handCardPlayActionButton.hidden = true;
          els.handCardPlayActionButton.disabled = true;
          els.handCardPlayActionButton.title = "";
        }
        if (els.cardCornerActionButton) {
          els.cardCornerActionButton.hidden = true;
          els.cardCornerActionButton.disabled = true;
          els.cardCornerActionButton.title = "";
        }
      }
      const pending = active ? getPendingPlayCardSelection() : null;
      els.appWrap?.classList.toggle("play-card-selection-active", active);
      els.playerHandPanel?.classList.toggle("play-card-selection-active", active);
      els.playerHandPanel?.classList.toggle("player-hand-panel-focused", active);
      if (els.playCardActionButton) {
        els.playCardActionButton.hidden = !pending;
        els.playCardActionButton.disabled = !pending;
        els.playCardActionButton.title = pending
          ? `打出 ${cards.getCardLabel(pending.card)}`
          : "";
      }
      if (els.playCardSelectionCancel) {
        els.playCardSelectionCancel.hidden = !active;
      }
      updatePlayerHandPanelTitle();
      if (active) setQuickPanelOpen(false);
      renderPlayerHand();
      syncInteractionFocusChrome();
    }

    function getPendingPlayCardSelection() {
      const pending = peekPlayCardSelection();
      if (!pending || !isPlayCardSelectionActive()) return null;
      const currentPlayer = getCurrentPlayer();
      if (pending.source === "future_span") {
        const card = industry?.getFutureSpanCard?.(currentPlayer);
        if (!card || card.id !== pending.cardId || !hasPlayableFutureSpanCard(currentPlayer)) {
          setPlayCardSelection(null);
          return null;
        }
        return { source: "future_span", card };
      }
      const hand = Array.isArray(currentPlayer?.hand) ? currentPlayer.hand : [];
      let handIndex = Number(pending.handIndex);
      let card = Number.isInteger(handIndex) ? hand[handIndex] : null;
      if (!card || card.id !== pending.cardId) {
        handIndex = hand.findIndex((item) => item.id === pending.cardId);
        card = handIndex >= 0 ? hand[handIndex] : null;
      }
      if (!card) {
        setPlayCardSelection(null);
        return null;
      }
      setPlayCardSelection({ source: "hand", handIndex, cardId: card.id });
      return { source: "hand", handIndex, card };
    }

    function handlePlayCardSelect(handIndex) {
      if (!isPlayCardSelectionActive()) return;
      const currentPlayer = getCurrentPlayer();
      const index = Math.round(handIndex);
      const card = currentPlayer?.hand?.[index];
      if (!card) {
        rocketState.statusNote = "无效的手牌位置";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      const cost = getCardPlayCost(card);
      if (!players.canAfford(currentPlayer, cost)) {
        rocketState.statusNote = `资源不足：${cards.getCardLabel(card)} 需要 ${formatCardPlayCost(cost)}`;
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const current = getPendingPlayCardSelection();
      if (current?.handIndex === index) {
        setPlayCardSelection(null);
        rocketState.statusNote = "打牌：请选择一张手牌";
      } else {
        setPlayCardSelection({ source: "hand", handIndex: index, cardId: card.id });
        rocketState.statusNote = `打牌：已选择 ${cards.getCardLabel(card)}，点击「打出」确认`;
      }

      syncPlayCardSelectionChrome();
      updateActionButtons();
      renderStateReadout();
      return { ok: true, message: rocketState.statusNote };
    }

    function confirmPlayCardSelection() {
      const pending = getPendingPlayCardSelection();
      if (!pending) {
        rocketState.statusNote = "请先选择要打出的手牌";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      if (pending.source === "future_span") {
        return handleFutureSpanCardPlay();
      }
      return handleHandCardPlay(pending.handIndex);
    }

    function getPendingHandCardPlayAction() {
      const pending = peekHandCardPlayAction();
      if (!pending) return null;
      const currentPlayer = getCurrentPlayer();
      const hand = Array.isArray(currentPlayer?.hand) ? currentPlayer.hand : [];
      let handIndex = Number(pending.handIndex);
      let card = Number.isInteger(handIndex) ? hand[handIndex] : null;
      if (!card || card.id !== pending.cardId) {
        handIndex = hand.findIndex((item) => item.id === pending.cardId);
        card = handIndex >= 0 ? hand[handIndex] : null;
      }
      const action = getHandCardPlayActionForCard(card, currentPlayer);
      if (!card || !action) {
        setHandCardPlayAction(null);
        return null;
      }
      setHandCardPlayAction({ handIndex, cardId: card.id, ...action });
      return { ...peekHandCardPlayAction(), card };
    }

    function cancelHandCardPlayAction(options = {}) {
      if (!peekHandCardPlayAction()) return;
      setHandCardPlayAction(null);
      if (!options.silent) rocketState.statusNote = "已取消手牌打出";
      syncCardCornerQuickActionChrome();
      if (!options.silent) renderStateReadout();
    }

    function clearHandCardContextActions() {
      const hadAction = Boolean(peekHandCardPlayAction() || peekCardCornerQuickAction());
      setHandCardPlayAction(null);
      setCardCornerQuickAction(null);
      return hadAction;
    }

    function cancelHandCardContextActions(options = {}) {
      if (!clearHandCardContextActions()) return;
      if (!options.silent) rocketState.statusNote = "已取消手牌快捷操作";
      syncCardCornerQuickActionChrome();
      if (!options.silent) renderStateReadout();
    }

    function confirmHandCardPlayAction() {
      const action = getPendingHandCardPlayAction();
      if (!action) {
        rocketState.statusNote = "没有可打出的手牌";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      const cardId = action.card?.id || action.cardId;
      const startResult = beginPlayCardSelection();
      if (!startResult?.ok) return startResult;
      const currentPlayer = getCurrentPlayer();
      const handIndex = (currentPlayer?.hand || []).findIndex((card) => card.id === cardId);
      if (handIndex < 0) {
        cancelPlayCardSelection();
        rocketState.statusNote = "要打出的手牌已不存在";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      const selectResult = handlePlayCardSelect(handIndex);
      if (!selectResult?.ok) {
        cancelPlayCardSelection();
        return selectResult;
      }
      return confirmPlayCardSelection();
    }

    function getPendingCardCornerQuickAction() {
      const pending = peekCardCornerQuickAction();
      if (!pending) return null;
      const currentPlayer = getCurrentPlayer();
      const hand = Array.isArray(currentPlayer?.hand) ? currentPlayer.hand : [];
      let handIndex = Number(pending.handIndex);
      let card = Number.isInteger(handIndex) ? hand[handIndex] : null;
      if (!card || card.id !== pending.cardId) {
        handIndex = hand.findIndex((item) => item.id === pending.cardId);
        card = handIndex >= 0 ? hand[handIndex] : null;
      }
      const action = getCardCornerQuickActionForCard(card);
      if (!card || !action) {
        setCardCornerQuickAction(null);
        return null;
      }
      setCardCornerQuickAction({ handIndex, cardId: card.id, ...action });
      return { ...peekCardCornerQuickAction(), card };
    }

    function syncCardCornerQuickActionChrome() {
      const action = canUseCardCornerQuickAction() ? getPendingCardCornerQuickAction() : null;
      const handPlayAction = getPendingHandCardPlayAction();
      const active = Boolean(action || handPlayAction);
      els.appWrap?.classList.toggle("card-corner-action-active", active);
      els.playerHandPanel?.classList.toggle("card-corner-action-active", active);
      els.playerHandPanel?.classList.toggle("player-hand-panel-focused", active);
      if (els.handCardPlayActionButton) {
        els.handCardPlayActionButton.hidden = !handPlayAction;
        els.handCardPlayActionButton.disabled = !handPlayAction;
        els.handCardPlayActionButton.title = handPlayAction
          ? `打出 ${cards.getCardLabel(handPlayAction.card)}，费用 ${formatCardPlayCost(handPlayAction.cost)}`
          : "";
      }
      if (els.cardCornerActionButton) {
        els.cardCornerActionButton.hidden = !action;
        els.cardCornerActionButton.disabled = !action;
        els.cardCornerActionButton.textContent = action?.label || "弃牌快速行动";
        els.cardCornerActionButton.title = action
          ? `${action.label}：弃除 ${cards.getCardLabel(action.card)}`
          : "";
      }
      updatePlayerHandPanelTitle();
      renderPlayerHand();
      syncInteractionFocusChrome();
    }

    function cancelCardCornerQuickAction(options = {}) {
      if (!peekCardCornerQuickAction()) return;
      setCardCornerQuickAction(null);
      if (!options.silent) rocketState.statusNote = "已取消卡牌快速行动";
      syncCardCornerQuickActionChrome();
      if (!options.silent) renderStateReadout();
    }

    function handleHandCardCornerQuickAction(handIndex) {
      if (!canUseCardCornerQuickAction()) return { ok: false, message: "当前无法使用手牌快捷操作" };
      const currentPlayer = getCurrentPlayer();
      const index = Math.round(handIndex);
      const card = currentPlayer?.hand?.[index];
      const cornerAction = getCardCornerQuickActionForCard(card);
      const playAction = getHandCardPlayActionForCard(card, currentPlayer);
      if (!card || (!cornerAction && !playAction)) {
        rocketState.statusNote = "这张牌没有可用的手牌快捷操作";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const current = getPendingCardCornerQuickAction();
      const currentPlay = getPendingHandCardPlayAction();
      if (current?.card?.id === card.id || currentPlay?.card?.id === card.id) {
        cancelHandCardContextActions();
        return { ok: true, cancelled: true, message: rocketState.statusNote };
      }

      setCardCornerQuickAction(cornerAction ? { handIndex: index, cardId: card.id, ...cornerAction } : null);
      setHandCardPlayAction(playAction ? { handIndex: index, cardId: card.id, ...playAction } : null);
      setQuickPanelOpen(false);
      const availableActions = [
        playAction ? `打出（${formatCardPlayCost(playAction.cost)}）` : null,
        cornerAction ? cornerAction.label : null,
      ].filter(Boolean).join(" / ");
      rocketState.statusNote = `${cards.getCardLabel(card)}：可执行 ${availableActions}`;
      syncCardCornerQuickActionChrome();
      updateActionButtons();
      renderStateReadout();
      return { ok: true, message: rocketState.statusNote };
    }

    function confirmCardCornerQuickAction() {
      if (!canUseCardCornerQuickAction()) {
        return { ok: false, message: "当前无法使用卡牌快速行动" };
      }

      const action = getPendingCardCornerQuickAction();
      const currentPlayer = getCurrentPlayer();
      if (!action || !currentPlayer) {
        rocketState.statusNote = "没有待确认的卡牌快速行动";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const queueMoveEffect = shouldQueueCardCornerMoveQuickAction(action, currentPlayer);
      if (action.actionKind === "move" && !queueMoveEffect) {
        const moveCheck = canStartCardCornerFreeMove();
        if (!moveCheck.ok) {
          rocketState.statusNote = moveCheck.message;
          renderStateReadout();
          return moveCheck;
        }
      }

      if (action.actionKind === "fangzhou_basic") {
        const beforePlayer = structuredClone(currentPlayer);
        const beforeAlienState = structuredClone(alienGameState);
        beginQuickActionStep("card-corner", `卡牌快速行动：${action.label}`);
        const discardResult = cards.discardFromHandAtIndex(currentPlayer, action.handIndex);
        if (!discardResult.ok) {
          quickActionHistory.undoLastStep();
          if (!quickActionHistory.hasUndoableStep()) {
            quickActionHistory.commitSession();
            clearHistoryStepOrderForSource(HISTORY_SOURCE_QUICK);
          }
          rocketState.statusNote = discardResult.message;
          syncCardCornerQuickActionChrome();
          renderStateReadout();
          return discardResult;
        }
        cards.addToDiscardPile(cardState, discardResult.card);
        context.recordQuickHistoryCommand?.(historyCommands.createRestorePlayerCommand(
          currentPlayer,
          beforePlayer,
          "恢复方舟弃牌快速行动前玩家状态",
        ));
        context.recordQuickHistoryCommand?.(historyCommands.createRestoreObjectCommand(
          alienGameState,
          beforeAlienState,
          "恢复方舟弃牌快速行动前外星人状态",
        ));
        completeQuickActionStep();
        setCardCornerQuickAction(null);
        syncCardCornerQuickActionChrome();
        const rewardResult = applyFangzhouCard1Rewards(currentPlayer, context.getDiscardCornerRewardMultiplier?.(currentPlayer) || 1, "basic", "方舟弃牌基础奖励", {
          historySource: HISTORY_SOURCE_QUICK,
          consumesMainAction: false,
          scoreSourceKey: SCORE_SOURCE_KEYS.ALIEN_CARD_QUICK,
        });
        rocketState.statusNote = `卡牌快速行动：弃除 ${cards.getCardLabel(discardResult.card)}，${rewardResult.message}`;
        renderPlayerStats();
        renderPlayerHand();
        renderAlienPanels();
        renderPublicCards();
        updatePublicCardControls();
        updateActionButtons();
        renderStateReadout();
        return rewardResult;
      }

      const beforePlayer = structuredClone(currentPlayer);
      const beforeCardState = {
        publicCards: cardState.publicCards.slice(),
        discardPile: (cardState.discardPile || []).slice(),
      };

      beginQuickActionStep("card-corner", `卡牌快速行动：${action.label}`);
      const discardResult = cards.discardFromHandAtIndex(currentPlayer, action.handIndex);
      if (!discardResult.ok) {
        quickActionHistory.undoLastStep();
        if (!quickActionHistory.hasUndoableStep()) {
          quickActionHistory.commitSession();
          clearHistoryStepOrderForSource(HISTORY_SOURCE_QUICK);
        }
        rocketState.statusNote = discardResult.message;
        syncCardCornerQuickActionChrome();
        renderStateReadout();
        return discardResult;
      }

      cards.addToDiscardPile(cardState, discardResult.card);
      if (Object.keys(action.reward?.gain || {}).length) {
        players.gainResources(currentPlayer, action.reward.gain);
        addScoreSourceFromGain(
          currentPlayer,
          isAlienFamilyCard(discardResult.card) ? SCORE_SOURCE_KEYS.ALIEN_CARD_QUICK : SCORE_SOURCE_KEYS.CARD_QUICK,
          action.reward.gain,
        );
      }
      if (Object.keys(action.moveReward?.gain || {}).length) {
        players.gainResources(currentPlayer, action.moveReward.gain);
        addScoreSourceFromGain(
          currentPlayer,
          isAlienFamilyCard(discardResult.card) ? SCORE_SOURCE_KEYS.ALIEN_CARD_QUICK : SCORE_SOURCE_KEYS.CARD_QUICK,
          action.moveReward.gain,
        );
      }
      const dataResults = [];
      const dataCount = Math.max(0, Math.round(action.reward?.dataCount || 0));
      for (let index = 0; index < dataCount; index += 1) {
        dataResults.push(data.gainData(currentPlayer, { source: "card_corner" }));
      }

      context.recordQuickHistoryCommand?.(historyCommands.createRestorePlayerCommand(
        currentPlayer,
        beforePlayer,
        "恢复卡牌快速行动前玩家状态",
      ));
      context.recordQuickHistoryCommand?.(historyCommands.createRestorePublicCardsCommand(
        cardState,
        beforeCardState.publicCards,
        beforeCardState.discardPile,
      ));
      completeQuickActionStep();

      setCardCornerQuickAction(null);
      syncCardCornerQuickActionChrome();
      const rewardText = action.actionKind === "move"
        ? [context.formatPlanetRewardGain?.(action.moveReward?.gain || {}), `${action.moveReward?.movementPoints || 1}移动`]
          .filter(Boolean)
          .join("、")
        : formatCardCornerRewardMessage(action.reward, dataResults);
      const cornerEvent = {
        type: "cardCorner",
        ...createCardCornerTriggerEventFields(action.reward, action.moveReward, {
          cornerCode: action.reward?.code ?? action.moveReward?.code ?? null,
          rewardMultiplier: action.rewardMultiplier,
        }),
        playerId: currentPlayer.id || null,
        playerColor: currentPlayer.color || null,
        source: "card_corner",
      };
      rocketState.statusNote = `卡牌快速行动：弃除 ${cards.getCardLabel(discardResult.card)}，${rewardText}`;
      renderPlayerStats();
      renderPlayerHand();
      renderPublicCards();
      updatePublicCardControls();
      updateActionButtons();
      renderStateReadout();
      if (action.actionKind === "move") {
        if (queueMoveEffect) {
          startCardCornerMoveEffectFlow(action, discardResult.card, cornerEvent);
        } else {
          beginCardCornerFreeMove(action, discardResult.card, [cornerEvent]);
        }
      } else {
        settleCardTasksAfterEffect({ events: [cornerEvent], render: false });
      }
      return {
        ok: true,
        card: discardResult.card,
        reward: action.reward,
        moveReward: action.moveReward,
        dataResults,
        message: rocketState.statusNote,
      };
    }

    function beginDiscardSelection(count, pendingAction = null) {
      if (isTechTilePickingActive()) return { ok: false, message: "请先完成科技选择" };
      if (isCardSelectionActive()) return { ok: false, message: "请先完成精选" };
      if (isPlayCardSelectionActive()) return { ok: false, message: "请先完成打牌" };
      if (isHandScanSelectionActive()) return { ok: false, message: "请先完成手牌扫描" };
      if (isMovePaymentSelectionActive()) return { ok: false, message: "请先完成移动" };

      const discardCount = Math.max(0, Math.round(count));
      if (discardCount <= 0) {
        completeDiscardSelection([]);
        return { ok: true, message: null };
      }

      const discardPlayer = pendingAction?.player || getCurrentPlayer();
      if (!discardPlayer?.hand?.length || discardPlayer.hand.length < discardCount) {
        return { ok: false, message: `手牌不足，需要弃置 ${discardCount} 张牌` };
      }

      decisionState.discardAction = { ...(pendingAction || {}), discarded: [], selectedIndexes: [] };
      cards.setDiscardSelectionActive(cardState, true, discardCount);
      rocketState.statusNote = pendingAction?.type === "pass_hand_limit"
        ? `PASS：请选择 ${discardCount} 张手牌弃掉，保留 4 张`
        : isIncomeDiscardActionType(pendingAction?.type)
          ? `收入：请选择 ${discardCount} 张手牌弃掉`
          : `弃牌：请选择 ${discardCount} 张手牌`;
      syncDiscardSelectionChrome();
      updateActionButtons();
      renderStateReadout();
      return { ok: true, message: rocketState.statusNote };
    }

    function cancelDiscardSelection() {
      if (!isDiscardSelectionActive()) return;
      const pending = decisionState.discardAction;
      if (pending?.required) {
        rocketState.statusNote = pending.type === "pass_hand_limit"
          ? "PASS 手牌上限弃牌必须完成"
          : "当前弃牌效果必须完成";
        renderStateReadout();
        return;
      }
      decisionState.discardAction = null;
      cards.setDiscardSelectionActive(cardState, false, 0);
      if (pending?.type === "industry_helios_income") {
        return rollbackPendingIndustryQuickAction("已取消公司 1x 行动");
      }
      if (pending?.type === "place_data_income") {
        if (pending.fromEffectFlow && pending.autoDataPlacement) {
          rocketState.statusNote = "已取消放置数据收入奖励";
          const continued = continuePendingDataPlacementAfterBonus(rocketState.statusNote);
          syncDiscardSelectionChrome();
          updateActionButtons();
          renderStateReadout();
          return continued;
        }
        completeQuickActionStep();
      }
      if (pending?.type === "card_income" && pending.fromEffectFlow && getCurrentActionEffect()) {
        getCurrentActionEffect().result = { ok: true, undoable: true, message: "已取消收入" };
        completeCurrentActionEffect("skipped");
      }
      rocketState.statusNote = isIncomeDiscardActionType(pending?.type) ? "已取消收入" : "已取消弃牌";
      syncDiscardSelectionChrome();
      updateActionButtons();
      renderStateReadout();
    }

    function completeDiscardSelection(discardedCards) {
      const pending = decisionState.discardAction;
      decisionState.discardAction = null;
      cards.setDiscardSelectionActive(cardState, false, 0);
      syncDiscardSelectionChrome();

      if (pending?.type === "trade") {
        const tradePlayer = pending.player || getCurrentPlayer();
        const beforeState = pending.beforeTradeState;
        const tradeResult = quickTrades.finalizeTradeAfterDiscard(
          pending.tradeId,
          createActionContext(),
          tradePlayer,
        );
        rocketState.statusNote = tradeResult.ok ? tradeResult.message : (tradeResult.message || "交易失败");
        if (tradeResult.ok && tradeResult.awaitingCardSelection && beforeState && decisionState.cardSelectionAction) {
          decisionState.cardSelectionAction.beforeTradeState = beforeState;
        }
        if (tradeResult.ok && !tradeResult.awaitingCardSelection && beforeState) {
          context.recordQuickTradeCompletion?.(pending.tradeId, tradePlayer, beforeState);
        }
        renderPlayerStats();
        renderPublicCards();
        updatePublicCardControls();
        updateActionButtons();
        renderStateReadout();
        return tradeResult;
      }

      if (isIncomeDiscardActionType(pending?.type)) {
        const incomeResult = applyIncomeFromCard(pending.player || getCurrentPlayer(), discardedCards[0]);
        if (pending.type === "initial_income" && incomeResult.ok && pending.fromEffectFlow) {
          const effect = getCurrentActionEffect();
          if (effect) {
            effect.result = {
              ok: true,
              undoable: false,
              irreversible: incomeResult.irreversible || null,
              message: incomeResult.message,
              payload: { gain: incomeResult.gain, card: discardedCards[0] },
            };
            completeCurrentActionEffect();
          }
        }
        rocketState.statusNote = incomeResult.ok ? incomeResult.message : (incomeResult.message || "收入失败");
        renderPlayerStats();
        renderPublicCards();
        renderPlayerHand();
        updatePublicCardControls();
        updateActionButtons();
        renderStateReadout();
        return incomeResult;
      }

      if (pending?.type === "pass_hand_limit") {
        const player = pending.player || getCurrentPlayer();
        const message = discardedCards.length
          ? `PASS 手牌上限：弃掉 ${discardedCards.map((card) => cards.getCardLabel(card)).join("、")}`
          : "PASS 手牌上限：无需弃牌";
        beginEffectHistoryStep(pending.effectLabel || "PASS 手牌上限弃牌");
        recordHistoryCommand(historyCommands.createRestorePlayerCommand(
          player,
          pending.beforePlayerState,
          "恢复 PASS 弃牌前玩家状态",
        ));
        recordHistoryCommand(historyCommands.createRestoreObjectCommand(
          cardState,
          pending.beforeCardState,
          "恢复 PASS 弃牌前牌区",
        ));
        if (getCurrentActionEffect()) {
          getCurrentActionEffect().result = {
            ok: true,
            undoable: true,
            message,
            payload: { discarded: discardedCards },
          };
        }
        rocketState.statusNote = message;
        renderPlayerHand();
        renderPlayerStats();
        renderPublicCards();
        completeCurrentActionEffect();
        updatePublicCardControls();
        updateActionButtons();
        renderStateReadout();
        return { ok: true, cards: discardedCards, message };
      }

      rocketState.statusNote = discardedCards.length
        ? `弃牌：${discardedCards.map((card) => cards.getCardLabel(card)).join("、")}`
        : "";
      renderPlayerStats();
      renderPublicCards();
      updatePublicCardControls();
      updateActionButtons();
      renderStateReadout();
      return { ok: true, cards: discardedCards, message: rocketState.statusNote };
    }

    function finalizePendingDiscardSelection() {
      const pending = decisionState.discardAction;
      const discardPlayer = pending?.player || getCurrentPlayer();
      const selected = [...(pending?.selectedIndexes || [])].sort((a, b) => b - a);
      const discarded = [...(pending?.discarded || [])];

      for (const index of selected) {
        const discardResult = cards.discardFromHandAtIndex(discardPlayer, index);
        if (!discardResult.ok) {
          rocketState.statusNote = discardResult.message;
          renderPlayerHand();
          renderStateReadout();
          return discardResult;
        }
        cards.addToDiscardPile(cardState, discardResult.card);
        discarded.push(discardResult.card);
      }

      if (pending) pending.selectedIndexes = [];
      cards.setDiscardSelectionActive(cardState, false, 0);
      return completeDiscardSelection(discarded);
    }

    function handleHandCardDiscard(handIndex) {
      if (!isDiscardSelectionActive()) return;
      const index = Math.round(handIndex);
      const needed = cards.getDiscardRemaining(cardState);
      if (!decisionState.discardAction) return;
      if (!Array.isArray(decisionState.discardAction.selectedIndexes)) {
        decisionState.discardAction.selectedIndexes = [];
      }
      const selected = decisionState.discardAction.selectedIndexes;
      const existingIndex = selected.indexOf(index);
      if (existingIndex >= 0) {
        selected.splice(existingIndex, 1);
        renderPlayerHand();
        rocketState.statusNote = selected.length > 0
          ? `弃牌：已选 ${selected.length}/${needed} 张`
          : (isIncomeDiscardActionType(decisionState.discardAction.type)
            ? "收入：请选择手牌弃掉"
            : `弃牌：请选择 ${needed} 张手牌`);
        renderStateReadout();
        return { ok: true };
      }
      if (selected.length >= needed) {
        rocketState.statusNote = `最多选择 ${needed} 张手牌`;
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      selected.push(index);
      renderPlayerHand();
      if (selected.length < needed) {
        rocketState.statusNote = `弃牌：已选 ${selected.length}/${needed} 张`;
        renderStateReadout();
        return { ok: true };
      }
      return finalizePendingDiscardSelection();
    }

    function beginPlayCardSelection() {
      const currentPlayer = getCurrentPlayer();
      const blockReason = context.getPlayCardSelectionBlockReason?.(currentPlayer) || getStandardPlayCardActionBlockReason(currentPlayer);
      if (blockReason) {
        rocketState.statusNote = blockReason;
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      if (!currentPlayer?.hand?.length && !hasPlayableFutureSpanCard(currentPlayer)) {
        rocketState.statusNote = "没有手牌可打出";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      cards.setPlayCardSelectionActive(cardState, true);
      setPlayCardSelection(null);
      rocketState.statusNote = hasPlayableFutureSpanCard(currentPlayer)
        ? "打牌：请选择一张手牌或未来跨度目标牌"
        : "打牌：请选择一张手牌";
      syncPlayCardSelectionChrome();
      updateActionButtons();
      renderStateReadout();
      return { ok: true, message: rocketState.statusNote };
    }

    function cancelPlayCardSelection() {
      if (!isPlayCardSelectionActive()) return;
      setPlayCardSelection(null);
      cards.setPlayCardSelectionActive(cardState, false);
      rocketState.statusNote = "已取消打牌";
      syncPlayCardSelectionChrome();
      updateActionButtons();
      renderStateReadout();
    }

    function handleFutureSpanCardPlay() {
      if (!isPlayCardSelectionActive()) return;
      const currentPlayer = getCurrentPlayer();
      const card = industry?.getFutureSpanCard?.(currentPlayer);
      if (!card || !hasPlayableFutureSpanCard(currentPlayer)) {
        rocketState.statusNote = "未来跨度目标牌尚未达成";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      const beforePlayer = structuredClone(currentPlayer);
      const playStart = industry.markFutureSpanPlaying?.(currentPlayer);
      if (!playStart?.ok) {
        rocketState.statusNote = playStart?.message || "未来跨度目标牌无法打出";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const playedCard = industry.getFutureSpanCard(currentPlayer);
      playedCard.futureSpanFreePlay = true;
      if (!Array.isArray(currentPlayer.hand)) currentPlayer.hand = [];
      currentPlayer.hand.push(playedCard);
      currentPlayer.resources.handSize = currentPlayer.hand.length;
      const handIndex = currentPlayer.hand.length - 1;
      futureSpanPlayBeforePlayer = beforePlayer;

      let result = null;
      try {
        result = handleHandCardPlay(handIndex);
      } finally {
        futureSpanPlayBeforePlayer = null;
        delete playedCard.futureSpanFreePlay;
      }

      if (!result?.ok) {
        restoreObjectSnapshot(currentPlayer, beforePlayer);
        renderPlayerHand();
        renderInitialSelectionArea();
        return result;
      }

      if (!decisionState.actionEffectFlow?.futureSpanPlayedCard) {
        releaseFutureSpanAfterPlayWithHistory();
        markActionPending();
        updateActionButtons();
        renderStateReadout();
      }
      return result;
    }

    function handleHandCardPlay(handIndex) {
      if (!isPlayCardSelectionActive()) return;

      const currentPlayer = getCurrentPlayer();
      const removeIndex = Math.round(handIndex);
      const card = currentPlayer?.hand?.[removeIndex];
      if (!card) {
        rocketState.statusNote = "无效的手牌位置";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      if (fangzhou?.isFangzhouCard2?.(card)) {
        return handleFangzhouCard2Play(removeIndex);
      }
      if (banrenma?.isBanrenmaCard?.(card)) {
        return handleBanrenmaCardPlay(removeIndex);
      }
      if (chong?.isChongCard?.(card)) {
        return handleChongCardPlay(removeIndex);
      }
      if (amiba?.isAmibaCard?.(card)) {
        return handleAmibaCardPlay(removeIndex);
      }
      if (aomomo?.isAomomoCard?.(card)) {
        return handleAomomoCardPlay(removeIndex);
      }
      if (runezu?.isRunezuCard?.(card)) {
        return handleRunezuCardPlay(removeIndex);
      }

      const cost = getCardPlayCost(card);
      if (!players.canAfford(currentPlayer, cost)) {
        rocketState.statusNote = `资源不足：${cards.getCardLabel(card)} 需要 ${formatCardPlayCost(cost)}`;
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const beforePlayer = getPlayCardBeforePlayerSnapshot(currentPlayer);
      const beforeCardState = {
        publicCards: cardState.publicCards.slice(),
        discardPile: (cardState.discardPile || []).slice(),
      };
      const spendResult = players.spendResources(currentPlayer, cost);
      if (!spendResult.ok) {
        rocketState.statusNote = spendResult.message;
        renderStateReadout();
        return spendResult;
      }

      const removeResult = cards.discardFromHandAtIndex(currentPlayer, removeIndex);
      if (!removeResult.ok) {
        players.gainResources(currentPlayer, cost);
        rocketState.statusNote = removeResult.message;
        renderStateReadout();
        return removeResult;
      }

      const playedCard = removeResult.card;
      const typeCode = getCardTypeCode(playedCard);
      const model = cardEffects.getCardModel?.(playedCard);
      const shouldReserve = [1, 2, 3].includes(typeCode) || Boolean(model?.reserveAfterPlay);
      const playEffects = cardEffects.buildPlayEffects(playedCard);
      const temporaryTasks = cardEffects.getTemporaryTasks(playedCard);
      if (shouldReserve) {
        if (!Array.isArray(currentPlayer.reservedCards)) currentPlayer.reservedCards = [];
        cardEffects.ensureCardEffectState(playedCard);
        currentPlayer.reservedCards.push(playedCard);
      } else {
        cards.addToDiscardPile(cardState, playedCard);
      }

      cards.setPlayCardSelectionActive(cardState, false);
      setPlayCardSelection(null);
      rocketState.statusNote = shouldReserve
        ? `打出：${cards.getCardLabel(playedCard)}，支付 ${formatCardPlayCost(cost)}，进入保留牌区`
        : `打出：${cards.getCardLabel(playedCard)}，支付 ${formatCardPlayCost(cost)}，已弃掉`;
      const industryPassiveResult = applyIndustryPlayCardPassives(playedCard, typeCode);
      const playFlowQueue = buildPlayCardEffectFlowQueue(currentPlayer, playedCard, playEffects);
      const immediatePlayCardEvent = createImmediatePlayCardEvent(playedCard, currentPlayer, cost);
      const playCardEvent = createPlayCardEvent(playedCard, currentPlayer, cost);
      syncPlayCardSelectionChrome();
      renderPlayerStats();
      recordPlayCardStart(currentPlayer, playedCard, beforePlayer, beforeCardState);
      if (playFlowQueue.effects.length) {
        startPlayCardEffectFlow("play-card-effects", `打出 ${cards.getCardLabel(playedCard)}`, playFlowQueue.effects, {
          actionType: "playCard",
          card: playedCard,
          temporaryTasks,
          industryPlayedCard: playedCard,
          deferredEndEffects: playFlowQueue.deferredEndEffects,
          immediatePlayCardEvent,
          playCardEvent,
          futureSpanPlayedCard: Boolean(playedCard.futureSpanFreePlay),
        });
      } else {
        settleCardTasksAfterEffect({ events: [immediatePlayCardEvent], render: false });
        settleCardTasksAfterEffect({
          events: [playCardEvent],
          render: false,
        });
        markActionPending();
        updateActionButtons();
        renderStateReadout();
      }
      appendIndustryPlayPassiveStatus(industryPassiveResult);
      return {
        ok: true,
        card: playedCard,
        reserved: shouldReserve,
        message: rocketState.statusNote,
      };
    }

    function handleAlienHandCardPlay(handIndex, config = {}) {
      const {
        shouldReserve = () => true,
        decorateCard,
        buildImmediateEffects,
        getBeforeAlienState = () => structuredClone(alienGameState),
        flowId = "alien-play-card-effects",
      } = config;
      const currentPlayer = getCurrentPlayer();
      const removeIndex = Math.round(handIndex);
      const card = currentPlayer?.hand?.[removeIndex];
      if (!card) {
        rocketState.statusNote = "无效的手牌位置";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const cost = getCardPlayCost(card);
      if (!players.canAfford(currentPlayer, cost)) {
        rocketState.statusNote = `资源不足：${cards.getCardLabel(card)} 需要 ${formatCardPlayCost(cost)}`;
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const beforePlayer = getPlayCardBeforePlayerSnapshot(currentPlayer);
      const beforeAlienState = getBeforeAlienState();
      const beforeCardState = {
        publicCards: cardState.publicCards.slice(),
        discardPile: (cardState.discardPile || []).slice(),
      };
      const spendResult = players.spendResources(currentPlayer, cost);
      if (!spendResult.ok) {
        rocketState.statusNote = spendResult.message;
        renderStateReadout();
        return spendResult;
      }

      const removeResult = cards.discardFromHandAtIndex(currentPlayer, removeIndex);
      if (!removeResult.ok) {
        players.gainResources(currentPlayer, cost);
        rocketState.statusNote = removeResult.message;
        renderStateReadout();
        return removeResult;
      }

      const playedCard = removeResult.card;
      const typeCode = getCardTypeCode(playedCard);
      if (decorateCard) decorateCard(playedCard, currentPlayer);
      const reserved = Boolean(shouldReserve(playedCard, typeCode, currentPlayer));
      if (reserved) {
        if (!Array.isArray(currentPlayer.reservedCards)) currentPlayer.reservedCards = [];
        cardEffects.ensureCardEffectState(playedCard);
        currentPlayer.reservedCards.push(playedCard);
      } else {
        cards.addToDiscardPile(cardState, playedCard);
      }

      const playEffects = buildImmediateEffects?.(playedCard) || [];

      cards.setPlayCardSelectionActive(cardState, false);
      setPlayCardSelection(null);
      rocketState.statusNote = reserved
        ? `打出：${cards.getCardLabel(playedCard)}，支付 ${formatCardPlayCost(cost)}，进入保留牌区`
        : `打出：${cards.getCardLabel(playedCard)}，支付 ${formatCardPlayCost(cost)}，已弃掉`;
      const industryPassiveResult = applyIndustryPlayCardPassives(playedCard, typeCode);
      const playFlowQueue = buildPlayCardEffectFlowQueue(currentPlayer, playedCard, playEffects);
      const immediatePlayCardEvent = createImmediatePlayCardEvent(playedCard, currentPlayer, cost);
      const playCardEvent = createPlayCardEvent(playedCard, currentPlayer, cost);
      syncPlayCardSelectionChrome();
      renderPlayerStats();
      renderReservedCardsFromTaskState?.();
      recordPlayCardStart(currentPlayer, playedCard, beforePlayer, beforeCardState, beforeAlienState);
      if (playFlowQueue.effects.length) {
        startPlayCardEffectFlow(flowId, `打出 ${cards.getCardLabel(playedCard)}`, playFlowQueue.effects, {
          actionType: "playCard",
          card: playedCard,
          temporaryTasks: [],
          industryPlayedCard: playedCard,
          deferredEndEffects: playFlowQueue.deferredEndEffects,
          immediatePlayCardEvent,
          playCardEvent,
          futureSpanPlayedCard: Boolean(playedCard.futureSpanFreePlay),
        });
      } else {
        settleCardTasksAfterEffect({ events: [immediatePlayCardEvent], render: false });
        settleCardTasksAfterEffect({ events: [playCardEvent], render: false });
        markActionPending();
        updateActionButtons();
        renderStateReadout();
      }
      appendIndustryPlayPassiveStatus(industryPassiveResult);
      return {
        ok: true,
        card: playedCard,
        reserved,
        message: rocketState.statusNote,
      };
    }

    function handleChongCardPlay(handIndex) {
      if (!chong) return { ok: false, message: "虫族模块未加载" };
      return handleAlienHandCardPlay(handIndex, {
        flowId: "chong-play-card-effects",
        decorateCard(playedCard) {
          playedCard.chongCard = true;
          playedCard.chongTask = playedCard.chongTask || chong.getCardTask(playedCard);
        },
        buildImmediateEffects: chong.buildImmediateEffects,
      });
    }

    function handleAmibaCardPlay(handIndex) {
      if (!amiba) return { ok: false, message: "阿米巴模块未加载" };
      return handleAlienHandCardPlay(handIndex, {
        flowId: "amiba-play-card-effects",
        shouldReserve(_playedCard, typeCode) {
          return [1, 2, 3].includes(typeCode);
        },
        decorateCard(playedCard) {
          playedCard.amibaCard = true;
          playedCard.amibaTask = playedCard.amibaTask || amiba.getCardTask(playedCard);
        },
        buildImmediateEffects: amiba.buildImmediateEffects,
      });
    }

    function handleAomomoCardPlay(handIndex) {
      if (!aomomo) return { ok: false, message: "奥陌陌模块未加载" };
      return handleAlienHandCardPlay(handIndex, {
        flowId: "aomomo-play-card-effects",
        shouldReserve(_playedCard, typeCode) {
          return [1, 2, 3].includes(typeCode);
        },
        decorateCard(playedCard) {
          playedCard.aomomoCard = true;
        },
        buildImmediateEffects: aomomo.buildImmediateEffects,
      });
    }

    function handleRunezuCardPlay(handIndex) {
      if (!runezu) return { ok: false, message: "符文族模块未加载" };
      return handleAlienHandCardPlay(handIndex, {
        flowId: "runezu-play-card-effects",
        shouldReserve(_playedCard, typeCode) {
          return [1, 2, 3].includes(typeCode);
        },
        decorateCard(playedCard) {
          playedCard.runezuCard = true;
          playedCard.runezuTask = playedCard.runezuTask || runezu.getCardTask(playedCard);
        },
        buildImmediateEffects: runezu.buildImmediateEffects,
      });
    }

    function handleBanrenmaCardPlay(handIndex) {
      if (!banrenma) return { ok: false, message: "半人马模块未加载" };
      return handleAlienHandCardPlay(handIndex, {
        flowId: "banrenma-play-card-effects",
        decorateCard(playedCard, currentPlayer) {
          const threshold = (Number(currentPlayer.resources?.score) || 0) + banrenma.SCORE_MARK_DELTA;
          const scoreMark = banrenma.addScoreMark(alienGameState, currentPlayer, threshold, "card", {
            cardInstanceId: playedCard.id,
            cardIndex: playedCard.alienCardId ?? banrenma.getCardDefinition(playedCard)?.index ?? null,
          });
          playedCard.banrenmaCard = true;
          playedCard.banrenmaThreshold = threshold;
          playedCard.banrenmaScoreMarkId = scoreMark?.id || null;
        },
        buildImmediateEffects: banrenma.buildImmediateEffects,
      });
    }

    function handleFangzhouCard2Play(handIndex) {
      const currentPlayer = getCurrentPlayer();
      const removeIndex = Math.round(handIndex);
      const card = currentPlayer?.hand?.[removeIndex];
      if (!card) {
        rocketState.statusNote = "无效的手牌位置";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const futureSpanFreePlay = Boolean(card.futureSpanFreePlay);
      const cost = futureSpanFreePlay ? {} : fangzhou.CARD2_PLAY_COST;
      if (Object.keys(cost).length && !players.canAfford(currentPlayer, cost)) {
        rocketState.statusNote = `信用点不足：方舟牌需要 ${cost.credits} 信用点`;
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const beforePlayer = getPlayCardBeforePlayerSnapshot(currentPlayer);
      const beforeAlienState = structuredClone(alienGameState);
      const beforeCardState = {
        publicCards: cardState.publicCards.slice(),
        discardPile: (cardState.discardPile || []).slice(),
      };
      const spendResult = Object.keys(cost).length ? players.spendResources(currentPlayer, cost) : { ok: true };
      if (!spendResult.ok) return spendResult;

      const removeResult = cards.discardFromHandAtIndex(currentPlayer, removeIndex);
      if (!removeResult.ok) {
        if (Object.keys(cost).length) players.gainResources(currentPlayer, cost);
        return removeResult;
      }
      const playedCard = removeResult.card;
      cards.addToDiscardPile(cardState, playedCard);

      cards.setPlayCardSelectionActive(cardState, false);
      setPlayCardSelection(null);

      const flipResult = fangzhou.flipCard1Reward(alienGameState, "advanced");
      if (!flipResult.ok) {
        restoreObjectSnapshot(currentPlayer, beforePlayer);
        restoreObjectSnapshot(alienGameState, beforeAlienState);
        cardState.publicCards = beforeCardState.publicCards.slice();
        cardState.discardPile = beforeCardState.discardPile.slice();
        cards.setPlayCardSelectionActive(cardState, true);
        setPlayCardSelection({ source: "hand", handIndex: removeIndex, cardId: card.id });
        rocketState.statusNote = flipResult.message || "方舟高级奖励无法结算";
        syncPlayCardSelectionChrome();
        renderPlayerStats();
        renderPlayerHand();
        renderAlienPanels();
        renderPublicCards();
        updatePublicCardControls();
        updateActionButtons();
        renderStateReadout();
        return flipResult;
      }

      renderFangzhouCardDisplays();
      const targetOptions = getFangzhouCard1RewardTargetOptions(flipResult, getTargetPlayerOptions(currentPlayer));
      const fangzhouEffects = buildFangzhouCard1EffectQueue(
        flipResult.effect,
        flipResult.label || `打出 ${cards.getCardLabel(playedCard)}`,
      ).map((effect) => ({
        ...effect,
        options: {
          ...(effect.options || {}),
          ...targetOptions,
        },
      }));
      const typeCode = getCardTypeCode(playedCard);
      rocketState.statusNote = `打出：${cards.getCardLabel(playedCard)}，支付 ${formatCardPlayCost(cost)}，已弃掉`;
      const industryPassiveResult = applyIndustryPlayCardPassives(playedCard, typeCode);
      const playFlowQueue = buildPlayCardEffectFlowQueue(currentPlayer, playedCard, fangzhouEffects);
      const immediatePlayCardEvent = createImmediatePlayCardEvent(playedCard, currentPlayer, cost);
      const playCardEvent = createPlayCardEvent(playedCard, currentPlayer, cost);

      syncPlayCardSelectionChrome();
      renderAlienPanels();
      renderPlayerStats();
      renderPlayerHand();
      renderPublicCards();
      updatePublicCardControls();
      recordPlayCardStart(currentPlayer, playedCard, beforePlayer, beforeCardState, beforeAlienState);
      recordMainActionIrreversibleBarrier(
        "方舟奖励牌",
        "方舟奖励牌翻开新牌",
        "fangzhou_card1_flip",
      );
      if (playFlowQueue.effects.length) {
        startPlayCardEffectFlow("fangzhou-card2-play-effects", `打出 ${cards.getCardLabel(playedCard)}`, playFlowQueue.effects, {
          actionType: "playCard",
          card: playedCard,
          temporaryTasks: [],
          industryPlayedCard: playedCard,
          deferredEndEffects: playFlowQueue.deferredEndEffects,
          immediatePlayCardEvent,
          playCardEvent,
          futureSpanPlayedCard: Boolean(playedCard.futureSpanFreePlay),
        });
      } else {
        settleCardTasksAfterEffect({ events: [immediatePlayCardEvent], render: false });
        settleCardTasksAfterEffect({ events: [playCardEvent], render: false });
        markActionPending();
        updateActionButtons();
        renderStateReadout();
      }
      appendIndustryPlayPassiveStatus(industryPassiveResult);
      return {
        ok: true,
        card: playedCard,
        reserved: false,
        flipResult,
        followUps: fangzhouEffects,
        message: rocketState.statusNote,
      };
    }

    function handleFutureSpanPlayCardSelect() {
      const currentPlayer = getCurrentPlayer();
      const card = industry?.getFutureSpanCard?.(currentPlayer);
      if (!card || !hasPlayableFutureSpanCard(currentPlayer)) {
        rocketState.statusNote = "未来跨度目标牌尚未达成";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      if (!isPlayCardSelectionActive()) {
        const startResult = beginPlayCardSelection();
        if (!startResult?.ok) return startResult;
      }

      const current = getPendingPlayCardSelection();
      if (current?.source === "future_span") {
        setPlayCardSelection(null);
        rocketState.statusNote = "打牌：请选择一张手牌或未来跨度目标牌";
      } else {
        setPlayCardSelection({ source: "future_span", cardId: card.id });
        rocketState.statusNote = `打牌：已选择未来跨度目标牌 ${cards.getCardLabel(card)}，点击「打出」确认`;
      }

      syncPlayCardSelectionChrome();
      updateActionButtons();
      renderStateReadout();
      return { ok: true, message: rocketState.statusNote };
    }

    function handleHandScanCardClick(handIndex) {
      if (!isHandScanSelectionActive()) return;

      const fromEffectFlow = Boolean(decisionState.handScanAction?.fromEffectFlow || decisionState.actionEffectFlow);
      const currentPlayer = getCurrentPlayer();
      const index = Math.round(handIndex);
      const card = currentPlayer?.hand?.[index];
      if (!card) {
        rocketState.statusNote = "无效的手牌位置";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const scanChoices = getPublicScanChoicesForCard(card);
      if (!scanChoices.ok) {
        rocketState.statusNote = scanChoices.message;
        renderStateReadout();
        return scanChoices;
      }

      decisionState.handScanAction = null;
      syncHandScanSelectionChrome();
      rocketState.statusNote = `手牌扫描：${cards.getCardLabel(card)}，请选择${scanChoices.scanLabel}目标`;
      renderStateReadout();
      return openScanTargetPicker({
        type: "hand_scan",
        card,
        handIndex: index,
        player: currentPlayer,
        scanCode: scanChoices.scanCode,
        fromEffectFlow,
        title: "手牌扫描",
        subtitle: `${cards.getCardLabel(card)}：${scanChoices.scanLabel}，请选择 2 选 1 星云。确认后弃除这张手牌。`,
        choices: scanChoices.choices,
      });
    }

    return {
      syncDiscardSelectionChrome,
      isHandScanSelectionActive,
      syncHandScanSelectionChrome,
      cancelHandScanSelection,
      isMovePaymentSelectionActive,
      getMovePaymentPlayer,
      isMovePaymentLockedForAiAutomation,
      beginSupplementalMovePayment,
      syncMovePaymentChrome,
      scrollToPlayerHandPanel,
      cancelMovePaymentSelection,
      beginMovePaymentSelection,
      handleHandCardMovePayment,
      confirmMovePayment,
      syncPlayCardSelectionChrome,
      getPendingPlayCardSelection,
      handlePlayCardSelect,
      confirmPlayCardSelection,
      getPendingHandCardPlayAction,
      cancelHandCardPlayAction,
      clearHandCardContextActions,
      cancelHandCardContextActions,
      confirmHandCardPlayAction,
      getPendingCardCornerQuickAction,
      syncCardCornerQuickActionChrome,
      cancelCardCornerQuickAction,
      handleHandCardCornerQuickAction,
      confirmCardCornerQuickAction,
      beginDiscardSelection,
      cancelDiscardSelection,
      completeDiscardSelection,
      finalizePendingDiscardSelection,
      handleHandCardDiscard,
      beginPlayCardSelection,
      cancelPlayCardSelection,
      handleFutureSpanCardPlay,
      handleFutureSpanPlayCardSelect,
      handleHandScanCardClick,
    };
  }

  return {
    createHandFlow,
  };
});
