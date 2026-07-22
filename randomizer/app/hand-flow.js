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
      uiRuntimeState,
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
      renderReservedCards,
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
      submitDiscardDecision,
      scrollToPlayerCommandPanel,
      getCardTypeCode,
    } = context;
    const ruleCardState = (workingRoot) => workingRoot.cardState;
    const ruleRocketState = (workingRoot) => workingRoot.rocketState;
    const ruleAlienGameState = (workingRoot) => workingRoot.alienGameState;
    const decisionState = context.decisionSessions?.createFacade?.({
      actionEffectFlow: "action_effect_flow",
    }) || {};
    const getDiscardContinuation = (workingRoot) => workingRoot?.match?.discardContinuation || null;
    function setDiscardContinuation(workingRoot, continuation) {
      if (!workingRoot?.match) throw new TypeError("discard selection requires Composition workingRoot.match");
      uiRuntimeState.discardSelectedHandIndexes = [];
      if (!continuation) {
        delete workingRoot.match.discardContinuation;
        return null;
      }
      const player = continuation.player || null;
      const normalized = {
        ...structuredClone(continuation),
        playerId: continuation.playerId || player?.id || null,
        playerColor: continuation.playerColor || player?.color || null,
        count: Math.max(0, Math.round(Number(continuation.count) || 0)),
      };
      delete normalized.player;
      delete normalized.selectedIndexes;
      delete normalized.discarded;
      workingRoot.match.discardContinuation = normalized;
      return normalized;
    }
    function getDiscardPlayer(workingRoot, pending = getDiscardContinuation(workingRoot)) {
      return (workingRoot?.playerState?.players || []).find((player) => (
        player.id === pending?.playerId || player.color === pending?.playerColor
      )) || getCurrentPlayer(workingRoot);
    }
    const getHandScanContinuation = (workingRoot) => workingRoot?.match?.handScanContinuation || null;
    function setHandScanContinuation(workingRoot, continuation) {
      if (!workingRoot?.match) throw new TypeError("hand scan requires Composition workingRoot.match");
      if (!continuation) {
        delete workingRoot.match.handScanContinuation;
        return null;
      }
      workingRoot.match.handScanContinuation = structuredClone(continuation);
      return workingRoot.match.handScanContinuation;
    }
    const getMovePayment = (workingRoot) => workingRoot?.match?.movePaymentContinuation || null;
    function setMovePayment(workingRoot, session) {
      if (!workingRoot?.match) throw new TypeError("move payment requires Composition workingRoot.match");
      uiRuntimeState.movePaymentSelectedHandIndices = [];
      if (!session) {
        delete workingRoot.match.movePaymentContinuation;
        return null;
      }
      const playerId = session.playerId || session.player?.id || null;
      const playerColor = session.playerColor || session.player?.color || null;
      workingRoot.match.movePaymentContinuation = {
        ...structuredClone(session),
        playerId,
        playerColor,
        selectedHandIndices: undefined,
        player: undefined,
      };
      delete workingRoot.match.movePaymentContinuation.player;
      delete workingRoot.match.movePaymentContinuation.selectedHandIndices;
      return workingRoot.match.movePaymentContinuation;
    }
    const peekPlayCardSelection = () => uiRuntimeState.playCardSelection;
    function setPlayCardSelection(workingRoot, session) {
      uiRuntimeState.playCardSelection = session ? structuredClone(session) : null;
      return uiRuntimeState.playCardSelection;
    }
    const peekHandCardPlayAction = () => uiRuntimeState.handCardPlayAction;
    const peekCardCornerQuickAction = () => uiRuntimeState.cardCornerQuickAction;
    function setHandCardPlayAction(workingRoot, action) {
      if (!action) {
        uiRuntimeState.handCardPlayAction = null;
        return null;
      }
      const pending = peekHandCardPlayAction();
      if (pending) return Object.assign(pending, action);
      uiRuntimeState.handCardPlayAction = structuredClone(action);
      return uiRuntimeState.handCardPlayAction;
    }
    function setCardCornerQuickAction(workingRoot, action) {
      if (!action) {
        uiRuntimeState.cardCornerQuickAction = null;
        return null;
      }
      const pending = peekCardCornerQuickAction();
      if (pending) return Object.assign(pending, action);
      uiRuntimeState.cardCornerQuickAction = structuredClone(action);
      return uiRuntimeState.cardCornerQuickAction;
    }
    let futureSpanPlayBeforePlayer = null;

    function getPlayCardBeforePlayerSnapshot(workingRoot, currentPlayer) {
      return futureSpanPlayBeforePlayer
        ? structuredClone(futureSpanPlayBeforePlayer)
        : structuredClone(currentPlayer);
    }

    function syncDiscardSelectionChrome(workingRoot) {
      const active = isDiscardSelectionActive();
      if (active) cancelHandCardContextActions(workingRoot, { silent: true });
      els.appWrap?.classList.toggle("discard-selection-active", active);
      els.playerHandPanel?.classList.toggle("discard-selection-active", active);
      els.playerHandPanel?.classList.toggle("player-hand-panel-focused", active);
      if (els.discardSelectionBackdrop) {
        els.discardSelectionBackdrop.hidden = !active;
        els.discardSelectionBackdrop.setAttribute("aria-hidden", String(!active));
      }
      if (els.discardSelectionCancel) {
        els.discardSelectionCancel.hidden = !active || Boolean(getDiscardContinuation(workingRoot)?.required);
      }
      updatePlayerHandPanelTitle();
      if (active) setQuickPanelOpen(false);
      renderPlayerHand();
      renderInitialSelectionArea();
      syncInteractionFocusChrome();
    }

    function isHandScanSelectionActive(workingRoot) {
      return getHandScanContinuation(workingRoot) != null;
    }

    function syncHandScanSelectionChrome(workingRoot) {
      const active = isHandScanSelectionActive(workingRoot);
      if (active) cancelHandCardContextActions(workingRoot, { silent: true });
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

    function cancelHandScanSelection(workingRoot) {
      if (!isHandScanSelectionActive(workingRoot)) return;
      setHandScanContinuation(workingRoot, null);
      ruleRocketState(workingRoot).statusNote = "已取消手牌扫描";
      syncHandScanSelectionChrome(workingRoot);
      updateActionButtons();
      renderStateReadout();
    }

    function isMovePaymentSelectionActive(workingRoot) {
      return getMovePayment(workingRoot) != null;
    }

    function getMovePaymentPlayer(workingRoot) {
      const pending = getMovePayment(workingRoot);
      if (!pending) return null;
      const playerId = pending.player?.id || pending.playerId || null;
      if (playerId) return getPlayerById(workingRoot, playerId) || pending.player || null;
      const playerColor = pending.player?.color || pending.playerColor || null;
      if (playerColor) return getPlayerByColor(workingRoot, playerColor) || pending.player || null;
      return pending.player || getCurrentPlayer(workingRoot);
    }

    function isMovePaymentLockedForAiAutomation(workingRoot) {
      return Boolean(context.isMovePaymentLockedForAiAutomation?.());
    }

    function syncMovePaymentChrome(workingRoot) {
      const active = isMovePaymentSelectionActive(workingRoot);
      const lockedForAi = isMovePaymentLockedForAiAutomation(workingRoot);
      const manualActive = active && !lockedForAi;
      const preservesCardCornerMove = getMovePayment(workingRoot)?.supplementalMoveContext?.type === "cardCornerFreeMove";
      if (active && !preservesCardCornerMove) cancelHandCardContextActions(workingRoot, { silent: true });
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

    function scrollToPlayerHandPanel(workingRoot) {
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

    function beginSupplementalMovePayment(workingRoot, options = {}) {
      const currentPlayer = getCurrentPlayer(workingRoot);
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
        ruleRocketState(workingRoot).statusNote = payCheck.message;
        renderStateReadout();
        return payCheck;
      }

      setMovePayment(workingRoot, {
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
      ruleRocketState(workingRoot).statusNote = options.message
        || `移动：已有 ${providedMovePoints} 点移动力，还需 ${paymentRequired} 点（可弃移动牌或用能量）`;
      syncMovePaymentChrome(workingRoot);
      if (!isMovePaymentLockedForAiAutomation(workingRoot)) scrollToPlayerHandPanel(workingRoot);
      updateActionButtons();
      renderStateReadout();
      return {
        ok: true,
        needsPayment: true,
        terrainRequired,
        providedMovePoints,
        paymentRequired,
        message: ruleRocketState(workingRoot).statusNote,
      };
    }

    function cancelMovePaymentSelection(workingRoot) {
      if (!isMovePaymentSelectionActive(workingRoot)) return;
      if (context.blockManualAiMovePayment && isMovePaymentLockedForAiAutomation(workingRoot)) {
        return context.blockManualAiMovePayment();
      }

      setMovePayment(workingRoot, null);
      ruleRocketState(workingRoot).statusNote = "已取消移动";
      syncMovePaymentChrome(workingRoot);
      updateActionButtons();
      renderStateReadout();
    }

    function beginMovePaymentSelection(workingRoot, deltaX, deltaY, rocketId, options = {}) {
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

      const currentPlayer = getCurrentPlayer(workingRoot);
      const requiredMovePoints = getRequiredMovePointsForUi(currentPlayer, rocketId, deltaX, deltaY);
      const payCheck = canPayForMove(currentPlayer, requiredMovePoints);
      if (!payCheck.ok) {
        ruleRocketState(workingRoot).statusNote = payCheck.message;
        renderStateReadout();
        return payCheck;
      }

      const moveCheck = rocketActions.canMoveRocket(ruleRocketState(workingRoot), rocketId, deltaX, deltaY);
      if (!moveCheck.ok) {
        ruleRocketState(workingRoot).statusNote = moveCheck.message;
        renderStateReadout();
        return moveCheck;
      }

      setMovePayment(workingRoot, {
        player: currentPlayer,
        deltaX,
        deltaY,
        rocketId,
        requiredMovePoints,
        selectedHandIndices: [],
        standardAction: options.standardAction || null,
      });
      ruleRocketState(workingRoot).statusNote = requiredMovePoints > 1
        ? `移动：需要 ${requiredMovePoints} 点移动力，可选择移动牌，剩余用能量补齐`
        : "移动：选择移动牌弃置，或直接确认消耗 1 能量";
      syncMovePaymentChrome(workingRoot);
      if (!isMovePaymentLockedForAiAutomation(workingRoot)) scrollToPlayerHandPanel(workingRoot);
      updateActionButtons();
      renderStateReadout();
      return { ok: true, message: ruleRocketState(workingRoot).statusNote };
    }

    function handleHandCardMovePayment(workingRoot, handIndex) {
      if (!isMovePaymentSelectionActive(workingRoot)) return;
      if (context.blockManualAiMovePayment && isMovePaymentLockedForAiAutomation(workingRoot)) {
        return context.blockManualAiMovePayment();
      }

      const currentPlayer = getMovePaymentPlayer(workingRoot);
      const index = Math.round(handIndex);
      const card = currentPlayer?.hand?.[index];
      if (!isMovePaymentCard(card)) return;

      const pending = getMovePayment(workingRoot);
      const selected = uiRuntimeState.movePaymentSelectedHandIndices || [];
      if (selected.includes(index)) {
        uiRuntimeState.movePaymentSelectedHandIndices = selected.filter((item) => item !== index);
      } else if (selected.length < (pending.requiredMovePoints || MOVE_ENERGY_COST)) {
        uiRuntimeState.movePaymentSelectedHandIndices = [...selected, index];
      }
      renderPlayerHand();
    }

    function resolveMovePaymentDecision(workingRoot, options = {}) {
      if (!workingRoot?.playerState || !workingRoot?.rocketState) {
        throw new TypeError("resolveMovePaymentDecision 缺少 workingRoot");
      }
      if (!isMovePaymentSelectionActive(workingRoot)) return;
      if (isMovePaymentLockedForAiAutomation(workingRoot) && options.automated !== true) {
        return context.blockManualAiMovePayment?.();
      }

      const activePayment = getMovePayment(workingRoot);
      const paymentPlayerId = activePayment?.player?.id || activePayment?.playerId || null;
      const paymentPlayerColor = activePayment?.player?.color || activePayment?.playerColor || null;
      const currentPlayer = (workingRoot.playerState.players || []).find((player) => (
        (paymentPlayerId && player.id === paymentPlayerId)
        || (paymentPlayerColor && player.color === paymentPlayerColor)
      )) || activePayment?.player || players.getCurrentPlayer(workingRoot.playerState);
      if (!currentPlayer) {
        workingRoot.rocketState.statusNote = "没有可支付移动消耗的玩家";
        renderStateReadout();
        return { ok: false, message: workingRoot.rocketState.statusNote };
      }
      const { requiredMovePoints = MOVE_ENERGY_COST } = activePayment;
      const selectedHandIndices = [...(options.selectedHandIndices || [])].sort((left, right) => left - right);
      let paymentNote = "";
      let handSnapshot = null;
      let discardPileSnapshot = null;
      let discardCommand = null;
      const selectedMoveCards = selectedHandIndices
        .map((index) => currentPlayer?.hand?.[index])
        .filter(Boolean);

      if (selectedMoveCards.length !== selectedHandIndices.length
        || selectedMoveCards.some((card) => !isMovePaymentCard(card))) {
        workingRoot.rocketState.statusNote = "请选择可弃置的移动牌";
        renderStateReadout();
        return;
      }

      const energyCost = Math.max(0, requiredMovePoints - selectedMoveCards.length);
      if (!players.canAfford(currentPlayer, { energy: energyCost })) {
        workingRoot.rocketState.statusNote = selectedMoveCards.length
          ? `能量不足，仍需 ${energyCost} 能量补齐移动力`
          : playerHasMovePaymentCard(currentPlayer)
            ? "能量不足，请选择移动牌弃置"
            : "能量不足，无法移动";
        renderStateReadout();
        return;
      }

      if (selectedHandIndices.length) {
        handSnapshot = currentPlayer.hand.slice();
        discardPileSnapshot = (workingRoot.cardState.discardPile || []).slice();
        const discardedCards = [];
        for (const index of [...selectedHandIndices].sort((left, right) => right - left)) {
          const discardResult = cards.discardFromHandAtIndex(currentPlayer, index);
          if (!discardResult.ok) {
            currentPlayer.hand = handSnapshot.slice();
            currentPlayer.resources.handSize = currentPlayer.hand.length;
            workingRoot.cardState.discardPile = discardPileSnapshot.slice();
            workingRoot.rocketState.statusNote = discardResult.message;
            renderStateReadout();
            return;
          }
          cards.addToDiscardPile(workingRoot.cardState, discardResult.card);
          discardedCards.push(discardResult.card);
        }
        discardCommand = historyCommands.createDiscardHandCardCommand(
          workingRoot.cardState,
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

      const pending = getMovePayment(workingRoot);
      const supplementalMoveContext = pending.supplementalMoveContext || null;
      const cardMoveEffectContext = pending.cardMoveEffectContext || null;
      setMovePayment(workingRoot, null);
      syncMovePaymentChrome(workingRoot);

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
      if (supplementalMoveContext?.type === "cardCornerFreeMove") {
        return executeFreeMoveForCardCorner(workingRoot, pending.deltaX, pending.deltaY, pending.rocketId, {
          terrainRequired: supplementalMoveContext.terrainRequired,
          providedMovePoints,
          energyCost,
          discardCommand,
          fromMovePayment: true,
        });
      }
      if (supplementalMoveContext?.type === "cardTriggerFreeMove") {
        return executeFreeMoveForCardTrigger(workingRoot, pending.deltaX, pending.deltaY, pending.rocketId, {
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

      const moveCheck = rocketActions.canMoveRocket(workingRoot.rocketState, pending.rocketId, pending.deltaX, pending.deltaY);
      if (!moveCheck.ok) {
        workingRoot.rocketState.statusNote = moveCheck.message;
        renderPlayerStats();
        updateActionButtons();
        renderStateReadout();
        return moveCheck;
      }

      const moveResult = pending.standardAction && typeof executePrimaryBoardAction === "function"
        ? executePrimaryBoardAction(workingRoot, pending.standardAction, moveOptions, { skipValidation: true })
        : abilities.executeAbility("moveProbe", createActionContext(workingRoot), {
          ...moveOptions,
          rocketId: pending.rocketId,
          deltaX: pending.deltaX,
          deltaY: pending.deltaY,
        });
      if (!moveResult.ok && discardCommand) {
        if (pending.standardAction) {
          const restoredPlayer = players.getCurrentPlayer(workingRoot.playerState);
          restoredPlayer.hand = handSnapshot.slice();
          restoredPlayer.resources.handSize = restoredPlayer.hand.length;
          workingRoot.cardState.discardPile = discardPileSnapshot.slice();
        } else {
          discardCommand.undo();
        }
      }
      if (moveResult.rocket) renderRocketElement(moveResult.rocket);
      if (moveResult.ok) {
        workingRoot.rocketState.activeRocketId = null;
        clearMoveRocketHighlight();
        workingRoot.rocketState.statusNote = `${paymentNote}，${moveResult.message}`;
        recordMoveActionHistory(workingRoot, moveResult, discardCommand);
        settleCardTasksAfterEffect({ events: moveResult.events, render: false });
      } else {
        workingRoot.rocketState.statusNote = moveResult.message;
      }

      renderPlayerStats();
      updateActionButtons();
      renderStateReadout();
      return moveResult;
    }

    function syncPlayCardSelectionChrome(workingRoot) {
      const active = isPlayCardSelectionActive();
      if (active) {
        setHandCardPlayAction(workingRoot, null);
        setCardCornerQuickAction(workingRoot, null);
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
      const pending = active ? getPendingPlayCardSelection(workingRoot) : null;
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

    function getPendingPlayCardSelection(workingRoot) {
      const pending = peekPlayCardSelection();
      if (!pending || !isPlayCardSelectionActive()) return null;
      const currentPlayer = getCurrentPlayer(workingRoot);
      if (pending.source === "future_span") {
        const card = industry?.getFutureSpanCard?.(currentPlayer);
        if (!card || card.id !== pending.cardId || !hasPlayableFutureSpanCard(currentPlayer)) {
          setPlayCardSelection(workingRoot, null);
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
        setPlayCardSelection(workingRoot, null);
        return null;
      }
      setPlayCardSelection(workingRoot, { source: "hand", handIndex, cardId: card.id });
      return { source: "hand", handIndex, card };
    }

    function handlePlayCardSelect(workingRoot, handIndex) {
      if (!isPlayCardSelectionActive()) return;
      const currentPlayer = getCurrentPlayer(workingRoot);
      const index = Math.round(handIndex);
      const card = currentPlayer?.hand?.[index];
      if (!card) {
        ruleRocketState(workingRoot).statusNote = "无效的手牌位置";
        renderStateReadout();
        return { ok: false, message: ruleRocketState(workingRoot).statusNote };
      }
      const cost = getCardPlayCost(card);
      if (!players.canAfford(currentPlayer, cost)) {
        ruleRocketState(workingRoot).statusNote = `资源不足：${cards.getCardLabel(card)} 需要 ${formatCardPlayCost(cost)}`;
        renderStateReadout();
        return { ok: false, message: ruleRocketState(workingRoot).statusNote };
      }

      const current = getPendingPlayCardSelection(workingRoot);
      if (current?.handIndex === index) {
        setPlayCardSelection(workingRoot, null);
        ruleRocketState(workingRoot).statusNote = "打牌：请选择一张手牌";
      } else {
        setPlayCardSelection(workingRoot, { source: "hand", handIndex: index, cardId: card.id });
        ruleRocketState(workingRoot).statusNote = `打牌：已选择 ${cards.getCardLabel(card)}，点击「打出」确认`;
      }

      syncPlayCardSelectionChrome(workingRoot);
      updateActionButtons();
      renderStateReadout();
      return { ok: true, message: ruleRocketState(workingRoot).statusNote };
    }

    function confirmPlayCardSelection(workingRoot) {
      const pending = getPendingPlayCardSelection(workingRoot);
      if (!pending) {
        ruleRocketState(workingRoot).statusNote = "请先选择要打出的手牌";
        renderStateReadout();
        return { ok: false, message: ruleRocketState(workingRoot).statusNote };
      }
      if (pending.source === "future_span") {
        return handleFutureSpanCardPlay(workingRoot);
      }
      if (typeof context.dispatchStandardIntent === "function") {
        return context.dispatchStandardIntent(
          "play_card",
          { cardInstanceId: pending.card.id },
          { payload: { handIndex: pending.handIndex, cost: getCardPlayCost(pending.card) } },
        );
      }
      return handleHandCardPlay(workingRoot, pending.handIndex);
    }

    function getPendingHandCardPlayAction(workingRoot) {
      const pending = peekHandCardPlayAction();
      if (!pending) return null;
      const currentPlayer = getCurrentPlayer(workingRoot);
      const hand = Array.isArray(currentPlayer?.hand) ? currentPlayer.hand : [];
      let handIndex = Number(pending.handIndex);
      let card = Number.isInteger(handIndex) ? hand[handIndex] : null;
      if (!card || card.id !== pending.cardId) {
        handIndex = hand.findIndex((item) => item.id === pending.cardId);
        card = handIndex >= 0 ? hand[handIndex] : null;
      }
      const action = getHandCardPlayActionForCard(card, currentPlayer);
      if (!card || !action) {
        setHandCardPlayAction(workingRoot, null);
        return null;
      }
      setHandCardPlayAction(workingRoot, { handIndex, cardId: card.id, ...action });
      return { ...peekHandCardPlayAction(), card };
    }

    function cancelHandCardPlayAction(workingRoot, options = {}) {
      if (!peekHandCardPlayAction()) return;
      setHandCardPlayAction(workingRoot, null);
      if (!options.silent) ruleRocketState(workingRoot).statusNote = "已取消手牌打出";
      syncCardCornerQuickActionChrome(workingRoot);
      if (!options.silent) renderStateReadout();
    }

    function clearHandCardContextActions(workingRoot) {
      const hadAction = Boolean(peekHandCardPlayAction() || peekCardCornerQuickAction());
      setHandCardPlayAction(workingRoot, null);
      setCardCornerQuickAction(workingRoot, null);
      return hadAction;
    }

    function cancelHandCardContextActions(workingRoot, options = {}) {
      if (!clearHandCardContextActions(workingRoot)) return;
      if (!options.silent) ruleRocketState(workingRoot).statusNote = "已取消手牌快捷操作";
      syncCardCornerQuickActionChrome(workingRoot);
      if (!options.silent) renderStateReadout();
    }

    function confirmHandCardPlayAction(workingRoot) {
      const action = getPendingHandCardPlayAction(workingRoot);
      if (!action) {
        ruleRocketState(workingRoot).statusNote = "没有可打出的手牌";
        renderStateReadout();
        return { ok: false, message: ruleRocketState(workingRoot).statusNote };
      }
      const cardId = action.card?.id || action.cardId;
      const startResult = beginPlayCardSelection(workingRoot);
      if (!startResult?.ok) return startResult;
      const currentPlayer = getCurrentPlayer(workingRoot);
      const handIndex = (currentPlayer?.hand || []).findIndex((card) => card.id === cardId);
      if (handIndex < 0) {
        cancelPlayCardSelection(workingRoot);
        ruleRocketState(workingRoot).statusNote = "要打出的手牌已不存在";
        renderStateReadout();
        return { ok: false, message: ruleRocketState(workingRoot).statusNote };
      }
      const selectResult = handlePlayCardSelect(workingRoot, handIndex);
      if (!selectResult?.ok) {
        cancelPlayCardSelection(workingRoot);
        return selectResult;
      }
      return confirmPlayCardSelection(workingRoot);
    }

    function getPendingCardCornerQuickAction(workingRoot) {
      const pending = peekCardCornerQuickAction();
      if (!pending) return null;
      const currentPlayer = getCurrentPlayer(workingRoot);
      const hand = Array.isArray(currentPlayer?.hand) ? currentPlayer.hand : [];
      let handIndex = Number(pending.handIndex);
      let card = Number.isInteger(handIndex) ? hand[handIndex] : null;
      if (!card || card.id !== pending.cardId) {
        handIndex = hand.findIndex((item) => item.id === pending.cardId);
        card = handIndex >= 0 ? hand[handIndex] : null;
      }
      const action = getCardCornerQuickActionForCard(card);
      if (!card || !action) {
        setCardCornerQuickAction(workingRoot, null);
        return null;
      }
      setCardCornerQuickAction(workingRoot, { handIndex, cardId: card.id, ...action });
      return { ...peekCardCornerQuickAction(), card };
    }

    function syncCardCornerQuickActionChrome(workingRoot) {
      const action = canUseCardCornerQuickAction() ? getPendingCardCornerQuickAction(workingRoot) : null;
      const handPlayAction = getPendingHandCardPlayAction(workingRoot);
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

    function cancelCardCornerQuickAction(workingRoot, options = {}) {
      if (!peekCardCornerQuickAction()) return;
      setCardCornerQuickAction(workingRoot, null);
      if (!options.silent) ruleRocketState(workingRoot).statusNote = "已取消卡牌快速行动";
      syncCardCornerQuickActionChrome(workingRoot);
      if (!options.silent) renderStateReadout();
    }

    function handleHandCardCornerQuickAction(workingRoot, handIndex) {
      if (!canUseCardCornerQuickAction()) return { ok: false, message: "当前无法使用手牌快捷操作" };
      const currentPlayer = getCurrentPlayer(workingRoot);
      const index = Math.round(handIndex);
      const card = currentPlayer?.hand?.[index];
      const cornerAction = getCardCornerQuickActionForCard(card);
      const playAction = getHandCardPlayActionForCard(card, currentPlayer);
      if (!card || (!cornerAction && !playAction)) {
        ruleRocketState(workingRoot).statusNote = "这张牌没有可用的手牌快捷操作";
        renderStateReadout();
        return { ok: false, message: ruleRocketState(workingRoot).statusNote };
      }

      const current = getPendingCardCornerQuickAction(workingRoot);
      const currentPlay = getPendingHandCardPlayAction(workingRoot);
      if (current?.card?.id === card.id || currentPlay?.card?.id === card.id) {
        cancelHandCardContextActions(workingRoot);
        return { ok: true, cancelled: true, message: ruleRocketState(workingRoot).statusNote };
      }

      setCardCornerQuickAction(workingRoot, cornerAction ? { handIndex: index, cardId: card.id, ...cornerAction } : null);
      setHandCardPlayAction(workingRoot, playAction ? { handIndex: index, cardId: card.id, ...playAction } : null);
      setQuickPanelOpen(false);
      const availableActions = [
        playAction ? `打出（${formatCardPlayCost(playAction.cost)}）` : null,
        cornerAction ? cornerAction.label : null,
      ].filter(Boolean).join(" / ");
      ruleRocketState(workingRoot).statusNote = `${cards.getCardLabel(card)}：可执行 ${availableActions}`;
      syncCardCornerQuickActionChrome(workingRoot);
      updateActionButtons();
      renderStateReadout();
      return { ok: true, message: ruleRocketState(workingRoot).statusNote };
    }

    function executeStandardCardCornerAction(workingRoot, descriptor) {
      const currentPlayer = players.getCurrentPlayer(workingRoot?.playerState);
      const handIndex = (currentPlayer?.hand || [])
        .findIndex((card) => card.id === descriptor?.target?.cardInstanceId);
      const card = handIndex >= 0 ? currentPlayer.hand[handIndex] : null;
      const cornerAction = getCardCornerQuickActionForCard(card);
      if (!card || !cornerAction) {
        return { ok: false, code: "CARD_CORNER_TARGET_STALE", message: "卡牌或弃牌角标已失效" };
      }
      return confirmCardCornerQuickAction(workingRoot, {
        workingRoot,
        standardAction: descriptor,
        action: { handIndex, cardId: card.id, ...cornerAction, card },
      });
    }

    function confirmCardCornerQuickAction(workingRoot, execution = {}) {
      if (!execution.workingRoot && !canUseCardCornerQuickAction()) {
        return { ok: false, message: "当前无法使用卡牌快速行动" };
      }

      const actionPlayerState = workingRoot?.playerState || context.playerState;
      const actionCardState = workingRoot?.cardState || ruleCardState(workingRoot);
      const actionAlienGameState = workingRoot?.alienGameState || ruleAlienGameState(workingRoot);
      const actionRocketState = workingRoot?.rocketState || ruleRocketState(workingRoot);
      const action = execution.action || getPendingCardCornerQuickAction(workingRoot);
      const currentPlayer = workingRoot
        ? players.getCurrentPlayer(actionPlayerState)
        : getCurrentPlayer(workingRoot);
      if (!action || !currentPlayer) {
        actionRocketState.statusNote = "没有待确认的卡牌快速行动";
        renderStateReadout();
        return { ok: false, message: actionRocketState.statusNote };
      }

      const queueMoveEffect = shouldQueueCardCornerMoveQuickAction(action, currentPlayer);
      if (action.actionKind === "move" && !queueMoveEffect) {
        const moveCheck = canStartCardCornerFreeMove();
        if (!moveCheck.ok) {
          actionRocketState.statusNote = moveCheck.message;
          renderStateReadout();
          return moveCheck;
        }
      }

      if (action.actionKind === "fangzhou_basic") {
        const beforePlayer = structuredClone(currentPlayer);
        const beforeAlienState = structuredClone(actionAlienGameState);
        beginQuickActionStep("card-corner", `卡牌快速行动：${action.label}`);
        const discardResult = cards.discardFromHandAtIndex(currentPlayer, action.handIndex);
        if (!discardResult.ok) {
          quickActionHistory.undoLastStep();
          if (!quickActionHistory.hasUndoableStep()) {
            quickActionHistory.commitSession();
            clearHistoryStepOrderForSource(HISTORY_SOURCE_QUICK);
          }
          actionRocketState.statusNote = discardResult.message;
          syncCardCornerQuickActionChrome(workingRoot);
          renderStateReadout();
          return discardResult;
        }
        cards.addToDiscardPile(actionCardState, discardResult.card);
        context.recordQuickHistoryCommand?.(historyCommands.createRestorePlayerCommand(
          currentPlayer,
          beforePlayer,
          "恢复方舟弃牌快速行动前玩家状态",
        ));
        context.recordQuickHistoryCommand?.(historyCommands.createRestoreObjectCommand(
          actionAlienGameState,
          beforeAlienState,
          "恢复方舟弃牌快速行动前外星人状态",
        ));
        completeQuickActionStep();
        setCardCornerQuickAction(workingRoot, null);
        syncCardCornerQuickActionChrome(workingRoot);
        const rewardResult = applyFangzhouCard1Rewards(currentPlayer, context.getDiscardCornerRewardMultiplier?.(currentPlayer) || 1, "basic", "方舟弃牌基础奖励", {
          historySource: HISTORY_SOURCE_QUICK,
          consumesMainAction: false,
          scoreSourceKey: SCORE_SOURCE_KEYS.ALIEN_CARD_QUICK,
        });
        actionRocketState.statusNote = `卡牌快速行动：弃除 ${cards.getCardLabel(discardResult.card)}，${rewardResult.message}`;
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
        publicCards: actionCardState.publicCards.slice(),
        discardPile: (actionCardState.discardPile || []).slice(),
      };

      beginQuickActionStep("card-corner", `卡牌快速行动：${action.label}`);
      const discardResult = cards.discardFromHandAtIndex(currentPlayer, action.handIndex);
      if (!discardResult.ok) {
        quickActionHistory.undoLastStep();
        if (!quickActionHistory.hasUndoableStep()) {
          quickActionHistory.commitSession();
          clearHistoryStepOrderForSource(HISTORY_SOURCE_QUICK);
        }
        actionRocketState.statusNote = discardResult.message;
        syncCardCornerQuickActionChrome(workingRoot);
        renderStateReadout();
        return discardResult;
      }

      cards.addToDiscardPile(actionCardState, discardResult.card);
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
        actionCardState,
        beforeCardState.publicCards,
        beforeCardState.discardPile,
      ));
      completeQuickActionStep();

      setCardCornerQuickAction(workingRoot, null);
      syncCardCornerQuickActionChrome(workingRoot);
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
      actionRocketState.statusNote = `卡牌快速行动：弃除 ${cards.getCardLabel(discardResult.card)}，${rewardText}`;
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
        message: actionRocketState.statusNote,
      };
    }

    function beginDiscardSelection(workingRoot, count, pendingAction = null) {
      if (isTechTilePickingActive()) return { ok: false, message: "请先完成科技选择" };
      if (isCardSelectionActive()) return { ok: false, message: "请先完成精选" };
      if (isPlayCardSelectionActive()) return { ok: false, message: "请先完成打牌" };
      if (isHandScanSelectionActive(workingRoot)) return { ok: false, message: "请先完成手牌扫描" };
      if (isMovePaymentSelectionActive(workingRoot)) return { ok: false, message: "请先完成移动" };

      const discardCount = Math.max(0, Math.round(count));
      if (discardCount <= 0) {
        completeDiscardSelection(workingRoot, []);
        return { ok: true, message: null };
      }

      const discardPlayer = pendingAction?.player || getCurrentPlayer(workingRoot);
      if (!discardPlayer?.hand?.length || discardPlayer.hand.length < discardCount) {
        return { ok: false, message: `手牌不足，需要弃置 ${discardCount} 张牌` };
      }

      setDiscardContinuation(workingRoot, { ...(pendingAction || {}), count: discardCount });
      cards.setDiscardSelectionActive(ruleCardState(workingRoot), true, discardCount);
      ruleRocketState(workingRoot).statusNote = pendingAction?.type === "pass_hand_limit"
        ? `PASS：请选择 ${discardCount} 张手牌弃掉，保留 4 张`
        : isIncomeDiscardActionType(pendingAction?.type)
          ? `收入：请选择 ${discardCount} 张手牌弃掉`
          : `弃牌：请选择 ${discardCount} 张手牌`;
      syncDiscardSelectionChrome(workingRoot);
      updateActionButtons();
      renderStateReadout();
      return { ok: true, message: ruleRocketState(workingRoot).statusNote };
    }

    function cancelDiscardSelection(workingRoot) {
      if (!isDiscardSelectionActive()) return;
      const pending = getDiscardContinuation(workingRoot);
      if (pending?.required) {
        ruleRocketState(workingRoot).statusNote = pending.type === "pass_hand_limit"
          ? "PASS 手牌上限弃牌必须完成"
          : "当前弃牌效果必须完成";
        renderStateReadout();
        return;
      }
      setDiscardContinuation(workingRoot, null);
      cards.setDiscardSelectionActive(ruleCardState(workingRoot), false, 0);
      if (pending?.type === "industry_helios_income") {
        return rollbackPendingIndustryQuickAction("已取消公司 1x 行动");
      }
      if (pending?.type === "place_data_income") {
        if (pending.fromEffectFlow && pending.autoDataPlacement) {
          ruleRocketState(workingRoot).statusNote = "已取消放置数据收入奖励";
          const continued = continuePendingDataPlacementAfterBonus(workingRoot, ruleRocketState(workingRoot).statusNote);
          syncDiscardSelectionChrome(workingRoot);
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
      ruleRocketState(workingRoot).statusNote = isIncomeDiscardActionType(pending?.type) ? "已取消收入" : "已取消弃牌";
      syncDiscardSelectionChrome(workingRoot);
      updateActionButtons();
      renderStateReadout();
    }

    function completeDiscardSelection(workingRoot, discardedCards) {
      const pending = getDiscardContinuation(workingRoot);
      setDiscardContinuation(workingRoot, null);
      cards.setDiscardSelectionActive(ruleCardState(workingRoot), false, 0);
      syncDiscardSelectionChrome(workingRoot);

      if (pending?.type === "trade") {
        const tradePlayer = getDiscardPlayer(workingRoot, pending);
        const beforeState = pending.beforeTradeState;
        const tradeResult = quickTrades.finalizeTradeAfterDiscard(
          pending.tradeId,
          createActionContext(),
          tradePlayer,
        );
        ruleRocketState(workingRoot).statusNote = tradeResult.ok ? tradeResult.message : (tradeResult.message || "交易失败");
        if (tradeResult.ok && tradeResult.awaitingCardSelection && beforeState && workingRoot.match?.cardSelectionContinuation) {
          workingRoot.match.cardSelectionContinuation.beforeTradeState = beforeState;
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
        const incomeResult = applyIncomeFromCard(getDiscardPlayer(workingRoot, pending), discardedCards[0]);
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
        ruleRocketState(workingRoot).statusNote = incomeResult.ok ? incomeResult.message : (incomeResult.message || "收入失败");
        renderPlayerStats();
        renderPublicCards();
        renderPlayerHand();
        updatePublicCardControls();
        updateActionButtons();
        renderStateReadout();
        return incomeResult;
      }

      if (pending?.type === "pass_hand_limit") {
        const player = getDiscardPlayer(workingRoot, pending);
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
          ruleCardState(workingRoot),
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
        ruleRocketState(workingRoot).statusNote = message;
        renderPlayerHand();
        renderPlayerStats();
        renderPublicCards();
        completeCurrentActionEffect();
        updatePublicCardControls();
        updateActionButtons();
        renderStateReadout();
        return { ok: true, cards: discardedCards, message };
      }

      ruleRocketState(workingRoot).statusNote = discardedCards.length
        ? `弃牌：${discardedCards.map((card) => cards.getCardLabel(card)).join("、")}`
        : "";
      renderPlayerStats();
      renderPublicCards();
      updatePublicCardControls();
      updateActionButtons();
      renderStateReadout();
      return { ok: true, cards: discardedCards, message: ruleRocketState(workingRoot).statusNote };
    }

    function finalizePendingDiscardSelection(workingRoot, selectedHandIndexes = uiRuntimeState.discardSelectedHandIndexes) {
      const pending = getDiscardContinuation(workingRoot);
      if (!pending) return { ok: false, message: "当前没有待完成的弃牌" };
      const discardPlayer = getDiscardPlayer(workingRoot, pending);
      const selectedAscending = [...new Set((selectedHandIndexes || []).map((index) => Math.round(Number(index))))]
        .filter((index) => Number.isInteger(index) && index >= 0 && index < (discardPlayer?.hand?.length || 0))
        .sort((a, b) => a - b);
      if (selectedAscending.length !== pending.count) {
        return { ok: false, message: `弃牌选择数量不符，需要 ${pending.count} 张` };
      }
      const selected = [...selectedAscending].sort((a, b) => b - a);
      const discarded = [];

      for (const index of selected) {
        const discardResult = cards.discardFromHandAtIndex(discardPlayer, index);
        if (!discardResult.ok) {
          ruleRocketState(workingRoot).statusNote = discardResult.message;
          renderPlayerHand();
          renderStateReadout();
          return discardResult;
        }
        cards.addToDiscardPile(ruleCardState(workingRoot), discardResult.card);
        discarded.push(discardResult.card);
      }

      cards.setDiscardSelectionActive(ruleCardState(workingRoot), false, 0);
      return completeDiscardSelection(workingRoot, discarded);
    }

    function handleHandCardDiscard(workingRoot, handIndex) {
      if (!isDiscardSelectionActive()) return;
      const index = Math.round(handIndex);
      const pending = getDiscardContinuation(workingRoot);
      if (!pending) return;
      const needed = pending.count;
      if (!Array.isArray(uiRuntimeState.discardSelectedHandIndexes)) uiRuntimeState.discardSelectedHandIndexes = [];
      const selected = uiRuntimeState.discardSelectedHandIndexes;
      const existingIndex = selected.indexOf(index);
      if (existingIndex >= 0) {
        selected.splice(existingIndex, 1);
        renderPlayerHand();
        ruleRocketState(workingRoot).statusNote = selected.length > 0
          ? `弃牌：已选 ${selected.length}/${needed} 张`
          : (isIncomeDiscardActionType(pending.type)
            ? "收入：请选择手牌弃掉"
            : `弃牌：请选择 ${needed} 张手牌`);
        renderStateReadout();
        return { ok: true };
      }
      if (selected.length >= needed) {
        ruleRocketState(workingRoot).statusNote = `最多选择 ${needed} 张手牌`;
        renderStateReadout();
        return { ok: false, message: ruleRocketState(workingRoot).statusNote };
      }
      selected.push(index);
      renderPlayerHand();
      if (selected.length < needed) {
        ruleRocketState(workingRoot).statusNote = `弃牌：已选 ${selected.length}/${needed} 张`;
        renderStateReadout();
        return { ok: true };
      }
      return typeof submitDiscardDecision === "function"
        ? submitDiscardDecision([...selected])
        : finalizePendingDiscardSelection(workingRoot, selected);
    }

    function beginPlayCardSelection(workingRoot) {
      const currentPlayer = getCurrentPlayer(workingRoot);
      const blockReason = context.getPlayCardSelectionBlockReason?.(currentPlayer) || getStandardPlayCardActionBlockReason(currentPlayer);
      if (blockReason) {
        ruleRocketState(workingRoot).statusNote = blockReason;
        renderStateReadout();
        return { ok: false, message: ruleRocketState(workingRoot).statusNote };
      }
      if (!currentPlayer?.hand?.length && !hasPlayableFutureSpanCard(currentPlayer)) {
        ruleRocketState(workingRoot).statusNote = "没有手牌可打出";
        renderStateReadout();
        return { ok: false, message: ruleRocketState(workingRoot).statusNote };
      }
      cards.setPlayCardSelectionActive(ruleCardState(workingRoot), true);
      setPlayCardSelection(workingRoot, null);
      ruleRocketState(workingRoot).statusNote = hasPlayableFutureSpanCard(currentPlayer)
        ? "打牌：请选择一张手牌或未来跨度目标牌"
        : "打牌：请选择一张手牌";
      syncPlayCardSelectionChrome(workingRoot);
      updateActionButtons();
      renderStateReadout();
      return { ok: true, message: ruleRocketState(workingRoot).statusNote };
    }

    function executeStandardPlayCard(workingRoot, descriptor) {
      const currentPlayer = players.getCurrentPlayer(workingRoot?.playerState);
      const handIndex = (currentPlayer?.hand || [])
        .findIndex((card) => card.id === descriptor?.target?.cardInstanceId);
      return handleHandCardPlay(workingRoot, handIndex, {
        workingRoot,
        standardAction: descriptor,
        bypassSelection: true,
      });
    }

    function cancelPlayCardSelection(workingRoot) {
      if (!isPlayCardSelectionActive()) return;
      setPlayCardSelection(workingRoot, null);
      cards.setPlayCardSelectionActive(ruleCardState(workingRoot), false);
      ruleRocketState(workingRoot).statusNote = "已取消打牌";
      syncPlayCardSelectionChrome(workingRoot);
      updateActionButtons();
      renderStateReadout();
    }

    function handleFutureSpanCardPlay(workingRoot) {
      if (!isPlayCardSelectionActive()) return;
      const currentPlayer = getCurrentPlayer(workingRoot);
      const card = industry?.getFutureSpanCard?.(currentPlayer);
      if (!card || !hasPlayableFutureSpanCard(currentPlayer)) {
        ruleRocketState(workingRoot).statusNote = "未来跨度目标牌尚未达成";
        renderStateReadout();
        return { ok: false, message: ruleRocketState(workingRoot).statusNote };
      }
      const beforePlayer = structuredClone(currentPlayer);
      const playStart = industry.markFutureSpanPlaying?.(currentPlayer);
      if (!playStart?.ok) {
        ruleRocketState(workingRoot).statusNote = playStart?.message || "未来跨度目标牌无法打出";
        renderStateReadout();
        return { ok: false, message: ruleRocketState(workingRoot).statusNote };
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
        result = handleHandCardPlay(workingRoot, handIndex);
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

    function handleHandCardPlay(workingRoot, handIndex, execution = {}) {
      if (!execution.bypassSelection && !isPlayCardSelectionActive()) return;

      const actionCardState = workingRoot?.cardState || ruleCardState(workingRoot);
      const actionAlienGameState = workingRoot?.alienGameState || ruleAlienGameState(workingRoot);
      const actionRocketState = workingRoot?.rocketState || ruleRocketState(workingRoot);
      const currentPlayer = workingRoot
        ? players.getCurrentPlayer(workingRoot.playerState)
        : getCurrentPlayer(workingRoot);
      const removeIndex = Math.round(handIndex);
      const card = currentPlayer?.hand?.[removeIndex];
      if (!card) {
        actionRocketState.statusNote = "无效的手牌位置";
        renderStateReadout();
        return { ok: false, message: actionRocketState.statusNote };
      }

      if (fangzhou?.isFangzhouCard2?.(card)) {
        return handleFangzhouCard2Play(workingRoot, removeIndex, execution);
      }
      if (banrenma?.isBanrenmaCard?.(card)) {
        return handleBanrenmaCardPlay(workingRoot, removeIndex, execution);
      }
      if (chong?.isChongCard?.(card)) {
        return handleChongCardPlay(workingRoot, removeIndex, execution);
      }
      if (amiba?.isAmibaCard?.(card)) {
        return handleAmibaCardPlay(workingRoot, removeIndex, execution);
      }
      if (aomomo?.isAomomoCard?.(card)) {
        return handleAomomoCardPlay(workingRoot, removeIndex, execution);
      }
      if (runezu?.isRunezuCard?.(card)) {
        return handleRunezuCardPlay(workingRoot, removeIndex, execution);
      }

      const cost = getCardPlayCost(card);
      if (!players.canAfford(currentPlayer, cost)) {
        actionRocketState.statusNote = `资源不足：${cards.getCardLabel(card)} 需要 ${formatCardPlayCost(cost)}`;
        renderStateReadout();
        return { ok: false, message: actionRocketState.statusNote };
      }

      const beforePlayer = getPlayCardBeforePlayerSnapshot(workingRoot, currentPlayer);
      const beforeCardState = {
        publicCards: actionCardState.publicCards.slice(),
        discardPile: (actionCardState.discardPile || []).slice(),
      };
      const spendResult = players.spendResources(currentPlayer, cost);
      if (!spendResult.ok) {
        actionRocketState.statusNote = spendResult.message;
        renderStateReadout();
        return spendResult;
      }

      const removeResult = cards.discardFromHandAtIndex(currentPlayer, removeIndex);
      if (!removeResult.ok) {
        players.gainResources(currentPlayer, cost);
        actionRocketState.statusNote = removeResult.message;
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
        cards.addToDiscardPile(actionCardState, playedCard);
      }

      cards.setPlayCardSelectionActive(actionCardState, false);
      setPlayCardSelection(workingRoot, null);
      actionRocketState.statusNote = shouldReserve
        ? `打出：${cards.getCardLabel(playedCard)}，支付 ${formatCardPlayCost(cost)}，进入保留牌区`
        : `打出：${cards.getCardLabel(playedCard)}，支付 ${formatCardPlayCost(cost)}，已弃掉`;
      const industryPassiveResult = applyIndustryPlayCardPassives(workingRoot, playedCard, typeCode);
      const playFlowQueue = buildPlayCardEffectFlowQueue(workingRoot, currentPlayer, playedCard, playEffects);
      const immediatePlayCardEvent = createImmediatePlayCardEvent(playedCard, currentPlayer, cost);
      const playCardEvent = createPlayCardEvent(playedCard, currentPlayer, cost);
      syncPlayCardSelectionChrome(workingRoot);
      renderPlayerStats();
      recordPlayCardStart(currentPlayer, playedCard, beforePlayer, beforeCardState, null, { workingRoot });
      if (playFlowQueue.effects.length) {
        startPlayCardEffectFlow("play-card-effects", `打出 ${cards.getCardLabel(playedCard)}`, playFlowQueue.effects, {
          workingRoot,
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
      appendIndustryPlayPassiveStatus(workingRoot, industryPassiveResult);
      return {
        ok: true,
        card: playedCard,
        reserved: shouldReserve,
        message: actionRocketState.statusNote,
        effects: structuredClone(playFlowQueue.effects || []),
        events: [immediatePlayCardEvent, playCardEvent],
        history: [{
          type: "play_card",
          playerId: currentPlayer.id,
          beforePlayer,
          beforeCardState,
        }],
      };
    }

    function handleAlienHandCardPlay(workingRoot, handIndex, config = {}, execution = {}) {
      const actionCardState = workingRoot?.cardState || ruleCardState(workingRoot);
      const actionAlienGameState = workingRoot?.alienGameState || ruleAlienGameState(workingRoot);
      const actionRocketState = workingRoot?.rocketState || ruleRocketState(workingRoot);
      const {
        shouldReserve = () => true,
        decorateCard,
        buildImmediateEffects,
        getBeforeAlienState = () => structuredClone(actionAlienGameState),
        flowId = "alien-play-card-effects",
      } = config;
      const currentPlayer = workingRoot
        ? players.getCurrentPlayer(workingRoot.playerState)
        : getCurrentPlayer(workingRoot);
      const removeIndex = Math.round(handIndex);
      const card = currentPlayer?.hand?.[removeIndex];
      if (!card) {
        actionRocketState.statusNote = "无效的手牌位置";
        renderStateReadout();
        return { ok: false, message: actionRocketState.statusNote };
      }

      const cost = getCardPlayCost(card);
      if (!players.canAfford(currentPlayer, cost)) {
        actionRocketState.statusNote = `资源不足：${cards.getCardLabel(card)} 需要 ${formatCardPlayCost(cost)}`;
        renderStateReadout();
        return { ok: false, message: actionRocketState.statusNote };
      }

      const beforePlayer = getPlayCardBeforePlayerSnapshot(workingRoot, currentPlayer);
      const beforeAlienState = getBeforeAlienState();
      const beforeCardState = {
        publicCards: actionCardState.publicCards.slice(),
        discardPile: (actionCardState.discardPile || []).slice(),
      };
      const spendResult = players.spendResources(currentPlayer, cost);
      if (!spendResult.ok) {
        actionRocketState.statusNote = spendResult.message;
        renderStateReadout();
        return spendResult;
      }

      const removeResult = cards.discardFromHandAtIndex(currentPlayer, removeIndex);
      if (!removeResult.ok) {
        players.gainResources(currentPlayer, cost);
        actionRocketState.statusNote = removeResult.message;
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
        cards.addToDiscardPile(actionCardState, playedCard);
      }

      const playEffects = buildImmediateEffects?.(playedCard) || [];

      cards.setPlayCardSelectionActive(actionCardState, false);
      setPlayCardSelection(workingRoot, null);
      actionRocketState.statusNote = reserved
        ? `打出：${cards.getCardLabel(playedCard)}，支付 ${formatCardPlayCost(cost)}，进入保留牌区`
        : `打出：${cards.getCardLabel(playedCard)}，支付 ${formatCardPlayCost(cost)}，已弃掉`;
      const industryPassiveResult = applyIndustryPlayCardPassives(workingRoot, playedCard, typeCode);
      const playFlowQueue = buildPlayCardEffectFlowQueue(workingRoot, currentPlayer, playedCard, playEffects);
      const immediatePlayCardEvent = createImmediatePlayCardEvent(playedCard, currentPlayer, cost);
      const playCardEvent = createPlayCardEvent(playedCard, currentPlayer, cost);
      syncPlayCardSelectionChrome(workingRoot);
      renderPlayerStats();
      renderReservedCards?.();
      recordPlayCardStart(currentPlayer, playedCard, beforePlayer, beforeCardState, beforeAlienState, { workingRoot });
      if (playFlowQueue.effects.length) {
        startPlayCardEffectFlow(flowId, `打出 ${cards.getCardLabel(playedCard)}`, playFlowQueue.effects, {
          workingRoot,
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
      appendIndustryPlayPassiveStatus(workingRoot, industryPassiveResult);
      return {
        ok: true,
        card: playedCard,
        reserved,
        message: actionRocketState.statusNote,
        effects: structuredClone(playFlowQueue.effects || []),
        events: [immediatePlayCardEvent, playCardEvent],
        history: [{
          type: "play_card",
          playerId: currentPlayer.id,
          beforePlayer,
          beforeCardState,
          beforeAlienState,
        }],
      };
    }

    function handleChongCardPlay(workingRoot, handIndex, execution = {}) {
      if (!chong) return { ok: false, message: "虫族模块未加载" };
      return handleAlienHandCardPlay(workingRoot, handIndex, {
        flowId: "chong-play-card-effects",
        decorateCard(playedCard) {
          playedCard.chongCard = true;
          playedCard.chongTask = playedCard.chongTask || chong.getCardTask(playedCard);
        },
        buildImmediateEffects: chong.buildImmediateEffects,
      }, execution);
    }

    function handleAmibaCardPlay(workingRoot, handIndex, execution = {}) {
      if (!amiba) return { ok: false, message: "阿米巴模块未加载" };
      return handleAlienHandCardPlay(workingRoot, handIndex, {
        flowId: "amiba-play-card-effects",
        shouldReserve(_playedCard, typeCode) {
          return [1, 2, 3].includes(typeCode);
        },
        decorateCard(playedCard) {
          playedCard.amibaCard = true;
          playedCard.amibaTask = playedCard.amibaTask || amiba.getCardTask(playedCard);
        },
        buildImmediateEffects: amiba.buildImmediateEffects,
      }, execution);
    }

    function handleAomomoCardPlay(workingRoot, handIndex, execution = {}) {
      if (!aomomo) return { ok: false, message: "奥陌陌模块未加载" };
      return handleAlienHandCardPlay(workingRoot, handIndex, {
        flowId: "aomomo-play-card-effects",
        shouldReserve(_playedCard, typeCode) {
          return [1, 2, 3].includes(typeCode);
        },
        decorateCard(playedCard) {
          playedCard.aomomoCard = true;
        },
        buildImmediateEffects: aomomo.buildImmediateEffects,
      }, execution);
    }

    function handleRunezuCardPlay(workingRoot, handIndex, execution = {}) {
      if (!runezu) return { ok: false, message: "符文族模块未加载" };
      return handleAlienHandCardPlay(workingRoot, handIndex, {
        flowId: "runezu-play-card-effects",
        shouldReserve(_playedCard, typeCode) {
          return [1, 2, 3].includes(typeCode);
        },
        decorateCard(playedCard) {
          playedCard.runezuCard = true;
          playedCard.runezuTask = playedCard.runezuTask || runezu.getCardTask(playedCard);
        },
        buildImmediateEffects: runezu.buildImmediateEffects,
      }, execution);
    }

    function handleBanrenmaCardPlay(workingRoot, handIndex, execution = {}) {
      if (!banrenma) return { ok: false, message: "半人马模块未加载" };
      const actionAlienGameState = execution.workingRoot?.alienGameState || ruleAlienGameState(workingRoot);
      return handleAlienHandCardPlay(workingRoot, handIndex, {
        flowId: "banrenma-play-card-effects",
        decorateCard(playedCard, currentPlayer) {
          const threshold = (Number(currentPlayer.resources?.score) || 0) + banrenma.SCORE_MARK_DELTA;
          const scoreMark = banrenma.addScoreMark(actionAlienGameState, currentPlayer, threshold, "card", {
            cardInstanceId: playedCard.id,
            cardIndex: playedCard.alienCardId ?? banrenma.getCardDefinition(playedCard)?.index ?? null,
          });
          playedCard.banrenmaCard = true;
          playedCard.banrenmaThreshold = threshold;
          playedCard.banrenmaScoreMarkId = scoreMark?.id || null;
        },
        buildImmediateEffects: banrenma.buildImmediateEffects,
      }, execution);
    }

    function handleFangzhouCard2Play(workingRoot, handIndex, execution = {}) {
      const actionCardState = workingRoot?.cardState || ruleCardState(workingRoot);
      const actionAlienGameState = workingRoot?.alienGameState || ruleAlienGameState(workingRoot);
      const actionRocketState = workingRoot?.rocketState || ruleRocketState(workingRoot);
      const currentPlayer = workingRoot
        ? players.getCurrentPlayer(workingRoot.playerState)
        : getCurrentPlayer(workingRoot);
      const removeIndex = Math.round(handIndex);
      const card = currentPlayer?.hand?.[removeIndex];
      if (!card) {
        actionRocketState.statusNote = "无效的手牌位置";
        renderStateReadout();
        return { ok: false, message: actionRocketState.statusNote };
      }

      const futureSpanFreePlay = Boolean(card.futureSpanFreePlay);
      const cost = futureSpanFreePlay ? {} : fangzhou.CARD2_PLAY_COST;
      if (Object.keys(cost).length && !players.canAfford(currentPlayer, cost)) {
        actionRocketState.statusNote = `信用点不足：方舟牌需要 ${cost.credits} 信用点`;
        renderStateReadout();
        return { ok: false, message: actionRocketState.statusNote };
      }

      const beforePlayer = getPlayCardBeforePlayerSnapshot(workingRoot, currentPlayer);
      const beforeAlienState = structuredClone(actionAlienGameState);
      const beforeCardState = {
        publicCards: actionCardState.publicCards.slice(),
        discardPile: (actionCardState.discardPile || []).slice(),
      };
      const spendResult = Object.keys(cost).length ? players.spendResources(currentPlayer, cost) : { ok: true };
      if (!spendResult.ok) return spendResult;

      const removeResult = cards.discardFromHandAtIndex(currentPlayer, removeIndex);
      if (!removeResult.ok) {
        if (Object.keys(cost).length) players.gainResources(currentPlayer, cost);
        return removeResult;
      }
      const playedCard = removeResult.card;
      cards.addToDiscardPile(actionCardState, playedCard);

      cards.setPlayCardSelectionActive(actionCardState, false);
      setPlayCardSelection(workingRoot, null);

      const flipResult = fangzhou.flipCard1Reward(actionAlienGameState, "advanced");
      if (!flipResult.ok) {
        restoreObjectSnapshot(currentPlayer, beforePlayer);
        restoreObjectSnapshot(actionAlienGameState, beforeAlienState);
        actionCardState.publicCards = beforeCardState.publicCards.slice();
        actionCardState.discardPile = beforeCardState.discardPile.slice();
        cards.setPlayCardSelectionActive(actionCardState, true);
        setPlayCardSelection(workingRoot, { source: "hand", handIndex: removeIndex, cardId: card.id });
        actionRocketState.statusNote = flipResult.message || "方舟高级奖励无法结算";
        syncPlayCardSelectionChrome(workingRoot);
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
      actionRocketState.statusNote = `打出：${cards.getCardLabel(playedCard)}，支付 ${formatCardPlayCost(cost)}，已弃掉`;
      const industryPassiveResult = applyIndustryPlayCardPassives(workingRoot, playedCard, typeCode);
      const playFlowQueue = buildPlayCardEffectFlowQueue(workingRoot, currentPlayer, playedCard, fangzhouEffects);
      const immediatePlayCardEvent = createImmediatePlayCardEvent(playedCard, currentPlayer, cost);
      const playCardEvent = createPlayCardEvent(playedCard, currentPlayer, cost);

      syncPlayCardSelectionChrome(workingRoot);
      renderAlienPanels();
      renderPlayerStats();
      renderPlayerHand();
      renderPublicCards();
      updatePublicCardControls();
      recordPlayCardStart(currentPlayer, playedCard, beforePlayer, beforeCardState, beforeAlienState, { workingRoot });
      recordMainActionIrreversibleBarrier(
        "方舟奖励牌",
        "方舟奖励牌翻开新牌",
        "fangzhou_card1_flip",
      );
      if (playFlowQueue.effects.length) {
        startPlayCardEffectFlow("fangzhou-card2-play-effects", `打出 ${cards.getCardLabel(playedCard)}`, playFlowQueue.effects, {
          workingRoot,
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
      appendIndustryPlayPassiveStatus(workingRoot, industryPassiveResult);
      return {
        ok: true,
        card: playedCard,
        reserved: false,
        flipResult,
        followUps: fangzhouEffects,
        message: actionRocketState.statusNote,
        effects: structuredClone(playFlowQueue.effects || []),
        events: [immediatePlayCardEvent, playCardEvent],
        history: [{
          type: "play_card",
          playerId: currentPlayer.id,
          beforePlayer,
          beforeCardState,
          beforeAlienState,
        }],
      };
    }

    function handleFutureSpanPlayCardSelect(workingRoot) {
      const currentPlayer = getCurrentPlayer(workingRoot);
      const card = industry?.getFutureSpanCard?.(currentPlayer);
      if (!card || !hasPlayableFutureSpanCard(currentPlayer)) {
        ruleRocketState(workingRoot).statusNote = "未来跨度目标牌尚未达成";
        renderStateReadout();
        return { ok: false, message: ruleRocketState(workingRoot).statusNote };
      }
      if (!isPlayCardSelectionActive()) {
        const startResult = beginPlayCardSelection(workingRoot);
        if (!startResult?.ok) return startResult;
      }

      const current = getPendingPlayCardSelection(workingRoot);
      if (current?.source === "future_span") {
        setPlayCardSelection(workingRoot, null);
        ruleRocketState(workingRoot).statusNote = "打牌：请选择一张手牌或未来跨度目标牌";
      } else {
        setPlayCardSelection(workingRoot, { source: "future_span", cardId: card.id });
        ruleRocketState(workingRoot).statusNote = `打牌：已选择未来跨度目标牌 ${cards.getCardLabel(card)}，点击「打出」确认`;
      }

      syncPlayCardSelectionChrome(workingRoot);
      updateActionButtons();
      renderStateReadout();
      return { ok: true, message: ruleRocketState(workingRoot).statusNote };
    }

    function handleHandScanCardClick(workingRoot, handIndex) {
      if (!isHandScanSelectionActive(workingRoot)) return;

      const fromEffectFlow = Boolean(getHandScanContinuation(workingRoot)?.fromEffectFlow || decisionState.actionEffectFlow);
      const currentPlayer = getCurrentPlayer(workingRoot);
      const index = Math.round(handIndex);
      const card = currentPlayer?.hand?.[index];
      if (!card) {
        ruleRocketState(workingRoot).statusNote = "无效的手牌位置";
        renderStateReadout();
        return { ok: false, message: ruleRocketState(workingRoot).statusNote };
      }

      const scanChoices = getPublicScanChoicesForCard(card);
      if (!scanChoices.ok) {
        ruleRocketState(workingRoot).statusNote = scanChoices.message;
        renderStateReadout();
        return scanChoices;
      }

      setHandScanContinuation(workingRoot, null);
      syncHandScanSelectionChrome(workingRoot);
      ruleRocketState(workingRoot).statusNote = `手牌扫描：${cards.getCardLabel(card)}，请选择${scanChoices.scanLabel}目标`;
      renderStateReadout();
      return openScanTargetPicker(workingRoot, {
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
      resolveMovePaymentDecision,
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
      executeStandardCardCornerAction,
      handleHandCardCornerQuickAction,
      confirmCardCornerQuickAction,
      beginDiscardSelection,
      cancelDiscardSelection,
      completeDiscardSelection,
      finalizePendingDiscardSelection,
      handleHandCardDiscard,
      beginPlayCardSelection,
      cancelPlayCardSelection,
      executeStandardPlayCard,
      handleFutureSpanCardPlay,
      handleHandCardPlay,
      handleFutureSpanPlayCardSelect,
      handleHandScanCardClick,
    };
  }

  return {
    createHandFlow,
  };
});
