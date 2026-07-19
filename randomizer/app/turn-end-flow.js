(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.SetiAppTurnEndFlow = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function createTurnEndFlow(context) {
    const {
      HISTORY_SOURCE_MAIN,
      HISTORY_SOURCE_QUICK,
      PASS_HAND_LIMIT,
      PASS_RESERVE_ROUNDS,
      abilities,
      actionHistory,
      activateNextActionEffect,
      advanceTurnAfterPlayerAction,
      alienGameState,
      aliens,
      appendActionLogStep,
      applyIncomeResourcesForPlayer,
      applyIndustryRoundStartBonuses,
      assignEffectFlowOwner,
      beginDiscardSelection,
      beginEffectHistoryStep,
      buildAlienRevealNoticeEntry,
      cardState,
      canStartMainAction,
      clearActionEffectFlow,
      clearActionPending,
      clearHistoryStepOrderForSource,
      commitActionLogDraft,
      completeCurrentActionEffect,
      completePendingActionStep,
      createActionLogImpactSnapshot,
      els,
      endEffectHistoryStep,
      getCurrentPlayer,
      getDisplayedTurnNumber,
      getMainActionStartBlockReason,
      hasActiveCardTriggerResolution,
      hasActivePendingSubFlow,
      historyCommands,
      industry,
      isActionEffectFlowActive,
      isCardSelectionActive,
      isFinalRound,
      isWeakStartAiDifficulty,
      maybeAutoOpenFinalResultDialog,
      maybeOpenActionBriefingForCompletedCycle,
      maybeOpenQueuedBanrenmaOpportunity,
      maybeOpenQueuedJiuzheOpportunity,
      maybeStartFundamentalismRoundStartIncomeFlow,
      openAlienRevealConfirmation,
      pendingState,
      planetRewards,
      playerState,
      quickActionHistory,
      recordHistoryCommand,
      refreshLatestActionLogRecoverySnapshot,
      renderAlienPanels,
      renderDebugPlayerSwitch,
      renderInitialSelectionArea,
      renderPlayerStats,
      renderPublicCards,
      renderReservedCards,
      renderRockets,
      renderRoundStatus,
      renderStateReadout,
      renderTechBoard,
      rocketState,
      rotateSolarOrbit,
      scheduleAiAutoStepIfNeeded,
      selectDefaultRocketForCurrentPlayer,
      settleCardTasksAfterEffect,
      settleTurnEndAlienRevealEntries,
      solarState,
      startActionLogDraft,
      turnState,
      uiRuntimeState,
      updateActionButtons,
      updatePublicCardControls
    } = context;

  function createPassEvent(player) {
    return {
      type: "pass",
      playerId: player?.id || null,
      playerColor: player?.color || null,
      source: "pass",
    };
  }

  function createRequiredPassEffect(node) {
    return {
      ...node,
      undoable: node.undoable ?? true,
      options: {
        ...(node.options || {}),
        required: true,
        skippable: false,
      },
    };
  }

  function buildPassEffectQueue(player) {
    const effects = [];
    if (industry?.shouldLaunchAfterPassWithHuanyuSuperdrive?.(player)) {
      if (isWeakStartAiDifficulty(player)) {
        effects.push(createRequiredPassEffect({
          id: "pass-huanyu-superdrive-credit",
          type: planetRewards.EFFECT_TYPES.GAIN_RESOURCES,
          icon: "credits",
          label: "寰宇超动力：PASS 后获得 1 信用点",
          options: {
            gain: { credits: 1 },
            targetPlayerId: player?.id || null,
            targetPlayerColor: player?.color || null,
          },
        }));
      } else {
        effects.push(createRequiredPassEffect({
          id: "pass-huanyu-superdrive-launch",
          type: "industry_huanyu_superdrive_launch",
          icon: "launch",
          label: "寰宇超动力：PASS 后额外发射",
          options: {
            skipCost: true,
            ignoreRocketLimit: true,
          },
        }));
      }
    }

    if (isFinalRound()) return effects;

    const handCount = Array.isArray(player?.hand) ? player.hand.length : 0;
    const discardCount = Math.max(0, handCount - PASS_HAND_LIMIT);

    if (discardCount > 0) {
      effects.push(createRequiredPassEffect({
        id: "pass-hand-limit",
        type: "pass_hand_limit",
        icon: "discard",
        label: `PASS：弃至 ${PASS_HAND_LIMIT} 张手牌`,
        options: { discardCount },
      }));
    }

    if ((turnState.passedPlayerIds || []).length === 0) {
      effects.push(createRequiredPassEffect({
        id: "pass-first-rotate",
        type: "pass_first_rotate",
        icon: "rotate",
        label: "首位 PASS：太阳系旋转",
      }));
    }

    if (PASS_RESERVE_ROUNDS.includes(turnState.roundNumber)) {
      effects.push(createRequiredPassEffect({
        id: "pass-reserve-pick",
        type: "pass_reserve_pick",
        icon: "pick_card",
        label: "PASS 预留精选",
        options: { roundNumber: turnState.roundNumber },
      }));
    }

    return effects;
  }

  function beginPassActionSession(currentPlayer) {
    startActionLogDraft("pass", "PASS", { source: HISTORY_SOURCE_MAIN, player: currentPlayer });
    actionHistory.beginSession("pass", "PASS");
    actionHistory.beginStep({
      source: HISTORY_SOURCE_MAIN,
      type: "action_start",
      label: `${currentPlayer.colorLabel}玩家 PASS`,
      effectIndex: -1,
      logBefore: createActionLogImpactSnapshot(currentPlayer),
    });
    uiRuntimeState.effectStepActive = true;
    completePendingActionStep();
    actionHistory.markActionComplete?.({ passPlayerId: currentPlayer.id });
  }

  function settlePassEventAfterEffects(player) {
    if (isFinalRound()) {
      return {
        ok: true,
        skipped: true,
        message: "最终轮 PASS 不触发额外效果",
      };
    }

    return settleCardTasksAfterEffect({
      events: [createPassEvent(player)],
      render: false,
    });
  }

  function executePassHandLimitEffect(effect) {
    const currentPlayer = getCurrentPlayer();
    const discardCount = Math.max(0, (currentPlayer?.hand?.length || 0) - PASS_HAND_LIMIT);
    if (discardCount <= 0) {
      effect.result = {
        ok: true,
        undoable: true,
        message: `PASS 手牌上限：已不超过 ${PASS_HAND_LIMIT} 张`,
      };
      rocketState.statusNote = effect.result.message;
      completeCurrentActionEffect();
      renderStateReadout();
      return effect.result;
    }

    const result = beginDiscardSelection(discardCount, {
      type: "pass_hand_limit",
      player: currentPlayer,
      required: true,
      fromEffectFlow: true,
      effectLabel: effect.label,
      beforePlayerState: structuredClone(currentPlayer),
      beforeCardState: structuredClone(cardState),
    });
    if (!result.ok) {
      rocketState.statusNote = result.message;
      renderStateReadout();
    }
    return result;
  }

  function executePassFirstRotateEffect(effect) {
    const beforeSolarState = structuredClone(solarState);
    const beforeRocketState = structuredClone(rocketState);
    const beforePlayerState = structuredClone(playerState);
    const beforeAlienState = structuredClone(alienGameState);
    const beforeCardState = structuredClone(cardState);

    beginEffectHistoryStep(effect.label);
    const result = rotateSolarOrbit(1);
    recordHistoryCommand(historyCommands.createRestoreObjectCommand(
      solarState,
      beforeSolarState,
      "恢复 PASS 旋转前太阳系状态",
    ));
    recordHistoryCommand(historyCommands.createRestoreObjectCommand(
      rocketState,
      beforeRocketState,
      "恢复 PASS 旋转前火箭状态",
    ));
    recordHistoryCommand(historyCommands.createRestoreObjectCommand(
      playerState,
      beforePlayerState,
      "恢复 PASS 旋转前玩家状态",
    ));
    recordHistoryCommand(historyCommands.createRestoreObjectCommand(
      alienGameState,
      beforeAlienState,
      "恢复 PASS 旋转前外星人状态",
    ));
    recordHistoryCommand(historyCommands.createRestoreObjectCommand(
      cardState,
      beforeCardState,
      "恢复 PASS 旋转前牌区",
    ));

    const anomalyPickOpen = isCardSelectionActive()
      && pendingState.cardSelectionAction?.type === "yichangdian_anomaly_pick";
    if (anomalyPickOpen) {
      pendingState.cardSelectionAction.fromEffectFlow = true;
      pendingState.cardSelectionAction.effectResult = {
        ok: result.ok,
        undoable: true,
        message: result.message,
        payload: result.payload || null,
        events: result.events || [],
      };
      rocketState.statusNote = result.message;
      updateActionButtons();
      renderStateReadout();
      return result;
    }

    effect.result = {
      ok: result.ok,
      undoable: true,
      message: result.message,
      payload: result.payload || null,
      events: result.events || [],
    };
    rocketState.statusNote = result.message;
    completeCurrentActionEffect();
    renderStateReadout();
    return result;
  }

  function passForCurrentPlayer() {
    if (!canStartMainAction()) {
      rocketState.statusNote = getMainActionStartBlockReason() || "本回合已经开始或完成主要行动";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }

    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer) {
      return { ok: false, message: "没有当前玩家" };
    }

    beginPassActionSession(currentPlayer);
    const passEffects = buildPassEffectQueue(currentPlayer);
    if (passEffects.length) {
      pendingState.actionEffectFlow = abilities.chain.startAbilityChain(
        "pass",
        "PASS",
        passEffects,
      );
      pendingState.actionEffectFlow.actionType = "pass";
      pendingState.actionEffectFlow.playerId = currentPlayer.id;
      assignEffectFlowOwner(pendingState.actionEffectFlow, pendingState.actionEffectFlow.playerId);
      pendingState.actionEffectFlow.passEvent = createPassEvent(currentPlayer);
      pendingState.actionEffectFlow.historySource = HISTORY_SOURCE_MAIN;
      pendingState.actionEffectFlow.consumesMainAction = true;
      els.appWrap?.classList.toggle("action-effect-flow-active", true);
      rocketState.statusNote = "PASS：请依次点击必做效果";
      activateNextActionEffect();
      return { ok: true, message: rocketState.statusNote };
    }

    const passSettlement = settlePassEventAfterEffects(currentPlayer);
    if (hasActiveCardTriggerResolution() || isActionEffectFlowActive()) {
      updateActionButtons();
      renderStateReadout();
      return { ok: true, message: passSettlement?.type1Result?.message || rocketState.statusNote };
    }

    rocketState.statusNote = `${currentPlayer.colorLabel}玩家选择 PASS，请点击回合结束确认`;
    updateActionButtons();
    renderStateReadout();
    return { ok: true, message: rocketState.statusNote };
  }

  function applyPassTurnEndIncome(player) {
    if (!player || isFinalRound()) return null;

    const result = applyIncomeResourcesForPlayer(player, { label: "PASS 收入" });
    appendActionLogStep(HISTORY_SOURCE_MAIN, "PASS 收入", result.message, {
      player,
      undoable: false,
      irreversibleReason: "回合结束确认后结算",
    });
    return result;
  }

  function listReadyAlienRevealSlotIds() {
    return (aliens.ALIEN_SLOT_IDS || [])
      .filter((alienSlotId) => {
        const slot = aliens.getAlienSlot(alienGameState, alienSlotId);
        return aliens.isAlienReadyToReveal?.(slot);
      });
  }

  function revealReadyAliensAtTurnEnd(triggerPlayer, options = {}) {
    const revealEntries = listReadyAlienRevealSlotIds()
      .map((alienSlotId) => ({
        alienSlotId,
        revealResult: aliens.revealRandomAlien(alienGameState, alienSlotId),
      }))
      .filter((entry) => entry.revealResult?.ok);
    if (!revealEntries.length) {
      return { ok: true, count: 0, entries: [], message: null };
    }

    const settledEntries = settleTurnEndAlienRevealEntries(triggerPlayer, revealEntries);
    if (options.confirmBeforeSideEffects) {
      openAlienRevealConfirmation(
        settledEntries.map((entry) => buildAlienRevealNoticeEntry(entry.alienSlotId, entry.revealResult)),
      );
    }
    return {
      ok: true,
      count: settledEntries.length,
      entries: settledEntries,
      message: rocketState.statusNote,
    };
  }

  function hasTurnEndRevealBlockingSubFlow() {
    return Boolean(
      pendingState.alienRevealConfirmation
      || pendingState.jiuzheCardPlay
      || pendingState.banrenmaOpportunity
      || pendingState.banrenmaCardGain
      || pendingState.alienTraceAction
      || pendingState.alienTracePickerState
      || isActionEffectFlowActive()
      || hasActivePendingSubFlow()
    );
  }

  function queueTurnEndAfterRevealContinuation(continuation) {
    pendingState.turnEndAfterRevealContinuation = continuation;
    rocketState.statusNote = continuation?.turnEndReveal?.message || "请先完成外星人揭示流程";
    updateActionButtons();
    renderStateReadout();
    return { ok: true, pending: true, message: rocketState.statusNote };
  }

  function maybeResumeTurnEndAfterReveal() {
    const continuation = pendingState.turnEndAfterRevealContinuation;
    if (!continuation || hasTurnEndRevealBlockingSubFlow()) return null;
    return finishCurrentTurnAfterAlienReveal(continuation);
  }

  function maybeContinuePendingTurnEndRevealFlow() {
    if (!pendingState.turnEndAfterRevealContinuation) return null;
    return maybeContinueAlienRevealQueuedOpportunities();
  }

  function maybeContinueAlienRevealQueuedOpportunities() {
    const jiuzheOpenResult = maybeOpenQueuedJiuzheOpportunity();
    if (jiuzheOpenResult?.ok) {
      scheduleAiAutoStepIfNeeded();
      return { ok: true, opened: true, result: jiuzheOpenResult };
    }
    const banrenmaOpenResult = maybeOpenQueuedBanrenmaOpportunity();
    if (banrenmaOpenResult?.ok) {
      scheduleAiAutoStepIfNeeded();
      return { ok: true, opened: true, result: banrenmaOpenResult };
    }
    return maybeResumeTurnEndAfterReveal();
  }

  function finishCurrentTurnAfterAlienReveal({
    endingPlayer,
    endingPlayerId,
    didPass,
    turnEndReveal,
  }) {
    if (turnEndReveal?.count && hasTurnEndRevealBlockingSubFlow()) {
      return queueTurnEndAfterRevealContinuation({
        endingPlayer,
        endingPlayerId,
        didPass,
        turnEndReveal,
      });
    }
    pendingState.turnEndAfterRevealContinuation = null;
    const passIncomeResult = didPass ? applyPassTurnEndIncome(endingPlayer) : null;
    commitActionLogDraft({
      passed: didPass,
      actionType: didPass ? "pass" : actionHistory.getSessionInfo()?.actionType,
      actionLabel: didPass ? "PASS" : actionHistory.getSessionInfo()?.label,
    });
    actionHistory.commitSession();
    clearHistoryStepOrderForSource(HISTORY_SOURCE_MAIN);
    if (quickActionHistory.hasSession()) {
      quickActionHistory.commitSession();
      clearHistoryStepOrderForSource(HISTORY_SOURCE_QUICK);
    }
    clearActionEffectFlow();
    clearActionPending();
    const advanceResult = advanceTurnAfterPlayerAction(endingPlayerId, { passed: didPass });
    const roundStartResult = advanceResult.roundAdvanced
      ? applyIndustryRoundStartBonuses(turnState.roundNumber, { appendLog: true })
      : null;
    const nextPlayer = getCurrentPlayer();
    selectDefaultRocketForCurrentPlayer();
    renderDebugPlayerSwitch();
    renderRoundStatus();
    const displayedTurnNumber = getDisplayedTurnNumber();
    const turnAdvanceMessage = advanceResult.gameEnded
      ? `第 ${turnState.roundNumber} 轮所有玩家已 PASS，游戏结束，进行终局计分${advanceResult.finalScoreLines?.length ? `：${advanceResult.finalScoreLines.join("；")}` : ""}`
      : advanceResult.roundAdvanced
      ? `所有玩家已 PASS，进入第 ${turnState.roundNumber} 轮第 ${displayedTurnNumber} 回合，当前玩家：${nextPlayer?.colorLabel || ""}玩家`
      : advanceResult.turnAdvanced
        ? `进入第 ${turnState.roundNumber} 轮第 ${displayedTurnNumber} 回合，当前玩家：${nextPlayer?.colorLabel || ""}玩家`
        : `回合已结束，当前玩家：${nextPlayer?.colorLabel || ""}玩家`;
    rocketState.statusNote = [
      turnAdvanceMessage,
      passIncomeResult?.message || null,
      roundStartResult?.message || null,
      turnEndReveal?.message || null,
    ].filter(Boolean).join("；");
    renderPlayerStats();
    renderAlienPanels();
    renderTechBoard();
    renderRockets();
    renderPublicCards();
    renderReservedCards();
    renderInitialSelectionArea();
    updatePublicCardControls();
    updateActionButtons();
    renderStateReadout();
    if (!advanceResult.gameEnded) {
      maybeStartFundamentalismRoundStartIncomeFlow(nextPlayer, turnState.roundNumber);
      maybeOpenActionBriefingForCompletedCycle(advanceResult);
    }
    refreshLatestActionLogRecoverySnapshot("回合结束后状态");
    if (advanceResult.gameEnded) {
      maybeAutoOpenFinalResultDialog();
    }
  }

  function endCurrentTurn() {
    if (!actionHistory.isActionComplete?.() || isActionEffectFlowActive() || hasActivePendingSubFlow()) return;
    const endingPlayer = getCurrentPlayer();
    const endingPlayerId = endingPlayer?.id || null;
    const didPass = actionHistory.getSessionInfo?.()?.passPlayerId === endingPlayerId;

    if (industry?.expireStrategyPlayInteractionOnTurnEnd?.(endingPlayer, turnState.roundNumber)?.cleared) {
      renderInitialSelectionArea();
    }
    industry?.clearTuringBorrowedTech?.(endingPlayer);
    industry?.clearSentinelPlayCornerState?.(endingPlayer);

    endEffectHistoryStep();
    const turnEndContext = { endingPlayer, endingPlayerId, didPass };
    const turnEndReveal = revealReadyAliensAtTurnEnd(endingPlayer, {
      confirmBeforeSideEffects: true,
    });
    finishCurrentTurnAfterAlienReveal({
      ...turnEndContext,
      turnEndReveal,
    });
  }

    return {
      createPassEvent,
      endCurrentTurn,
      executePassFirstRotateEffect,
      executePassHandLimitEffect,
      maybeContinueAlienRevealQueuedOpportunities,
      maybeContinuePendingTurnEndRevealFlow,
      maybeResumeTurnEndAfterReveal,
      passForCurrentPlayer,
    };
  }

  return {
    createTurnEndFlow,
  };
});
