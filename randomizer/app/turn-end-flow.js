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
      aliens,
      appendActionLogStep,
      applyIncomeResourcesForPlayer,
      applyIndustryRoundStartBonuses,
      assignEffectFlowOwner,
      beginDiscardSelection,
      beginEffectHistoryStep,
      buildAlienRevealNoticeEntry,
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
      getPendingBanrenmaCardGain,
      getPendingJiuzheCardPlay,
      getPendingBanrenmaOpportunity,
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
      planetRewards,
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
      rotateSolarOrbit,
      scheduleAiAutoStepIfNeeded,
      selectDefaultRocketForCurrentPlayer,
      settleCardTasksAfterEffect,
      settleTurnEndAlienRevealEntries,
      startActionLogDraft,
      uiRuntimeState,
      updateActionButtons,
      updatePublicCardControls
    } = context;
    const getActionEffectFlow = (workingRoot) => requireWorkingRoot(workingRoot).match?.actionEffectFlow || null;

    const TURN_END_REVEAL_CONTINUATION_FIELD = "turnEndRevealContinuation";

  function requireWorkingRoot(workingRoot) {
    if (!workingRoot || typeof workingRoot !== "object") {
      throw new TypeError("turn-end operation requires an explicit workingRoot");
    }
  }

  function setActionEffectFlow(workingRoot, flow) {
    requireWorkingRoot(workingRoot);
    if (!workingRoot.match || typeof workingRoot.match !== "object") workingRoot.match = {};
    if (flow == null) {
      delete workingRoot.match.actionEffectFlow;
      return null;
    }
    workingRoot.match.actionEffectFlow = flow;
    return flow;
  }

  function getTurnEndRevealContinuation(workingRoot) {
    requireWorkingRoot(workingRoot);
    return workingRoot.match?.[TURN_END_REVEAL_CONTINUATION_FIELD] || null;
  }

  function setTurnEndRevealContinuation(workingRoot, continuation) {
    requireWorkingRoot(workingRoot);
    if (!workingRoot.match || typeof workingRoot.match !== "object") workingRoot.match = {};
    if (continuation == null) {
      delete workingRoot.match[TURN_END_REVEAL_CONTINUATION_FIELD];
      return null;
    }
    const normalized = {
      endingPlayerId: continuation.endingPlayerId || continuation.endingPlayer?.id || null,
      didPass: Boolean(continuation.didPass),
      turnEndReveal: structuredClone(continuation.turnEndReveal || null),
    };
    workingRoot.match[TURN_END_REVEAL_CONTINUATION_FIELD] = normalized;
    return normalized;
  }

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

  function buildPassEffectQueue(workingRoot, player) {
    const actionTurnState = workingRoot.turnState;
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

    if (isFinalRound(actionTurnState)) return effects;

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

    if ((actionTurnState.passedPlayerIds || []).length === 0) {
      effects.push(createRequiredPassEffect({
        id: "pass-first-rotate",
        type: "pass_first_rotate",
        icon: "rotate",
        label: "首位 PASS：太阳系旋转",
      }));
    }

    if (PASS_RESERVE_ROUNDS.includes(actionTurnState.roundNumber)) {
      effects.push(createRequiredPassEffect({
        id: "pass-reserve-pick",
        type: "pass_reserve_pick",
        icon: "pick_card",
        label: "PASS 预留精选",
        options: { roundNumber: actionTurnState.roundNumber },
      }));
    }

    return effects;
  }

  function beginPassActionSession(workingRoot, currentPlayer) {
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
    completePendingActionStep(workingRoot);
    actionHistory.markActionComplete?.({ passPlayerId: currentPlayer.id });
  }

  function settlePassEventAfterEffects(workingRoot, player) {
    const actionTurnState = workingRoot.turnState;
    if (isFinalRound(actionTurnState)) {
      return {
        ok: true,
        skipped: true,
        message: "最终轮 PASS 不触发额外效果",
      };
    }

    return settleCardTasksAfterEffect(workingRoot, {
      events: [createPassEvent(player)],
      render: false,
    });
  }

  function executePassHandLimitEffect(workingRoot, effect) {
    requireWorkingRoot(workingRoot);
    const { cardState, rocketState } = workingRoot;
    const currentPlayer = (workingRoot.playerState.players || [])
      .find((player) => player.id === workingRoot.playerState.currentPlayerId);
    const discardCount = Math.max(0, (currentPlayer?.hand?.length || 0) - PASS_HAND_LIMIT);
    if (discardCount <= 0) {
      effect.result = {
        ok: true,
        undoable: true,
        message: `PASS 手牌上限：已不超过 ${PASS_HAND_LIMIT} 张`,
      };
      rocketState.statusNote = effect.result.message;
      completeCurrentActionEffect(workingRoot);
      renderStateReadout();
      return effect.result;
    }

    const result = beginDiscardSelection(workingRoot, discardCount, {
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

  function executePassFirstRotateEffect(workingRoot, effect) {
    requireWorkingRoot(workingRoot);
    const { alienGameState, cardState, playerState, rocketState, solarState } = workingRoot;
    const beforeSolarState = structuredClone(solarState);
    const beforeRocketState = structuredClone(rocketState);
    const beforePlayerState = structuredClone(playerState);
    const beforeAlienState = structuredClone(alienGameState);
    const beforeCardState = structuredClone(cardState);

    beginEffectHistoryStep(workingRoot, effect.label);
    const result = rotateSolarOrbit(workingRoot, 1);
    recordHistoryCommand(workingRoot, historyCommands.createRestoreObjectCommand(
      solarState,
      beforeSolarState,
      "恢复 PASS 旋转前太阳系状态",
    ));
    recordHistoryCommand(workingRoot, historyCommands.createRestoreObjectCommand(
      rocketState,
      beforeRocketState,
      "恢复 PASS 旋转前火箭状态",
    ));
    recordHistoryCommand(workingRoot, historyCommands.createRestoreObjectCommand(
      playerState,
      beforePlayerState,
      "恢复 PASS 旋转前玩家状态",
    ));
    recordHistoryCommand(workingRoot, historyCommands.createRestoreObjectCommand(
      alienGameState,
      beforeAlienState,
      "恢复 PASS 旋转前外星人状态",
    ));
    recordHistoryCommand(workingRoot, historyCommands.createRestoreObjectCommand(
      cardState,
      beforeCardState,
      "恢复 PASS 旋转前牌区",
    ));

    const cardSelectionPending = workingRoot.match?.cardSelectionContinuation;
    const anomalyPickOpen = isCardSelectionActive()
      && cardSelectionPending?.type === "yichangdian_anomaly_pick";
    if (anomalyPickOpen) {
      cardSelectionPending.fromEffectFlow = true;
      cardSelectionPending.effectResult = {
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
    completeCurrentActionEffect(workingRoot);
    renderStateReadout();
    return result;
  }

  function passForCurrentPlayer(workingRoot, execution = {}) {
    requireWorkingRoot(workingRoot);
    const actionPlayerState = workingRoot.playerState;
    const actionTurnState = workingRoot.turnState;
    const actionRocketState = workingRoot.rocketState;
    if (!execution.standardAction && !canStartMainAction()) {
      actionRocketState.statusNote = getMainActionStartBlockReason() || "本回合已经开始或完成主要行动";
      renderStateReadout();
      return { ok: false, message: actionRocketState.statusNote };
    }

    const currentPlayer = (actionPlayerState.players || [])
      .find((player) => player.id === (execution.standardAction?.actorId || actionPlayerState.currentPlayerId));
    if (!currentPlayer) {
      return { ok: false, message: "没有当前玩家" };
    }

    beginPassActionSession(workingRoot, currentPlayer);
    const passEffects = buildPassEffectQueue(workingRoot, currentPlayer);
    if (passEffects.length) {
      const flow = setActionEffectFlow(workingRoot, abilities.chain.startAbilityChain(
        "pass",
        "PASS",
        passEffects,
      ));
      flow.actionType = "pass";
      flow.playerId = currentPlayer.id;
      assignEffectFlowOwner(flow, flow.playerId);
      flow.passEvent = createPassEvent(currentPlayer);
      flow.historySource = HISTORY_SOURCE_MAIN;
      flow.consumesMainAction = true;
      els.appWrap?.classList.toggle("action-effect-flow-active", true);
      actionRocketState.statusNote = "PASS：请依次点击必做效果";
      activateNextActionEffect(workingRoot);
      return { ok: true, message: actionRocketState.statusNote, effects: structuredClone(passEffects) };
    }

    const passSettlement = settlePassEventAfterEffects(workingRoot, currentPlayer);
    if (hasActiveCardTriggerResolution(workingRoot) || isActionEffectFlowActive(workingRoot)) {
      updateActionButtons();
      renderStateReadout();
      return { ok: true, message: passSettlement?.type1Result?.message || actionRocketState.statusNote };
    }

    actionRocketState.statusNote = `${currentPlayer.colorLabel}玩家选择 PASS，请点击回合结束确认`;
    updateActionButtons();
    renderStateReadout();
    return { ok: true, message: actionRocketState.statusNote, events: [createPassEvent(currentPlayer)] };
  }

  function applyPassTurnEndIncome(workingRoot, player) {
    const actionTurnState = workingRoot.turnState;
    if (!player || isFinalRound(actionTurnState)) return null;

    const result = applyIncomeResourcesForPlayer(player, { label: "PASS 收入" });
    appendActionLogStep(HISTORY_SOURCE_MAIN, "PASS 收入", result.message, {
      player,
      undoable: false,
      irreversibleReason: "回合结束确认后结算",
    });
    return result;
  }

  function listReadyAlienRevealSlotIds(workingRoot) {
    const actionAlienGameState = workingRoot.alienGameState;
    return (aliens.ALIEN_SLOT_IDS || [])
      .filter((alienSlotId) => {
        const slot = aliens.getAlienSlot(actionAlienGameState, alienSlotId);
        return aliens.isAlienReadyToReveal?.(slot);
      });
  }

  function revealReadyAliensAtTurnEnd(workingRoot, triggerPlayer, options = {}) {
    const actionAlienGameState = workingRoot.alienGameState;
    const revealEntries = listReadyAlienRevealSlotIds(workingRoot)
      .map((alienSlotId) => ({
        alienSlotId,
        revealResult: aliens.revealRandomAlien(actionAlienGameState, alienSlotId),
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
      message: workingRoot.rocketState.statusNote,
    };
  }

  function hasTurnEndRevealBlockingSubFlow(workingRoot) {
    return Boolean(
      uiRuntimeState.alienRevealConfirmation
      || getPendingJiuzheCardPlay()
      || getPendingBanrenmaOpportunity()
      || getPendingBanrenmaCardGain()
      || workingRoot.match?.alienTraceContinuation
      || uiRuntimeState.alienTracePickerState
      || isActionEffectFlowActive(workingRoot)
      || hasActivePendingSubFlow(workingRoot)
    );
  }

  function queueTurnEndAfterRevealContinuation(workingRoot, continuation) {
    setTurnEndRevealContinuation(workingRoot, continuation);
    workingRoot.rocketState.statusNote = continuation?.turnEndReveal?.message || "请先完成外星人揭示流程";
    updateActionButtons();
    renderStateReadout();
    return { ok: true, pending: true, message: workingRoot.rocketState.statusNote };
  }

  function maybeResumeTurnEndAfterReveal(workingRoot) {
    requireWorkingRoot(workingRoot);
    const continuation = getTurnEndRevealContinuation(workingRoot);
    if (!continuation || hasTurnEndRevealBlockingSubFlow(workingRoot)) return null;
    return finishCurrentTurnAfterAlienReveal(workingRoot, continuation);
  }

  function maybeContinuePendingTurnEndRevealFlow(workingRoot) {
    requireWorkingRoot(workingRoot);
    if (!getTurnEndRevealContinuation(workingRoot)) return null;
    return maybeContinueAlienRevealQueuedOpportunities(workingRoot);
  }

  function maybeContinueAlienRevealQueuedOpportunities(workingRoot) {
    requireWorkingRoot(workingRoot);
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
    return maybeResumeTurnEndAfterReveal(workingRoot);
  }

  function finishCurrentTurnAfterAlienReveal(workingRoot, {
    endingPlayer,
    endingPlayerId,
    didPass,
    turnEndReveal,
  }) {
    const actionTurnState = workingRoot.turnState;
    const actionPlayerState = workingRoot.playerState;
    const actionRocketState = workingRoot.rocketState;
    const resolvedEndingPlayer = endingPlayer || (actionPlayerState.players || [])
      .find((player) => player.id === endingPlayerId) || null;
    if (turnEndReveal?.count && hasTurnEndRevealBlockingSubFlow(workingRoot)) {
      return queueTurnEndAfterRevealContinuation(workingRoot, {
        endingPlayerId,
        didPass,
        turnEndReveal,
      });
    }
    setTurnEndRevealContinuation(workingRoot, null);
    const passIncomeResult = didPass ? applyPassTurnEndIncome(workingRoot, resolvedEndingPlayer) : null;
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
    clearActionEffectFlow(workingRoot);
    clearActionPending();
    const advanceResult = advanceTurnAfterPlayerAction(endingPlayerId, { passed: didPass, workingRoot });
    const roundStartResult = advanceResult.roundAdvanced
      ? applyIndustryRoundStartBonuses(actionTurnState.roundNumber, { appendLog: true })
      : null;
    const nextPlayer = (actionPlayerState.players || [])
      .find((player) => player.id === actionPlayerState.currentPlayerId);
    selectDefaultRocketForCurrentPlayer();
    renderDebugPlayerSwitch();
    renderRoundStatus();
    const displayedTurnNumber = getDisplayedTurnNumber(actionTurnState.turnNumber);
    const turnAdvanceMessage = advanceResult.gameEnded
      ? `第 ${actionTurnState.roundNumber} 轮所有玩家已 PASS，游戏结束，进行终局计分${advanceResult.finalScoreLines?.length ? `：${advanceResult.finalScoreLines.join("；")}` : ""}`
      : advanceResult.roundAdvanced
      ? `所有玩家已 PASS，进入第 ${actionTurnState.roundNumber} 轮第 ${displayedTurnNumber} 回合，当前玩家：${nextPlayer?.colorLabel || ""}玩家`
      : advanceResult.turnAdvanced
        ? `进入第 ${actionTurnState.roundNumber} 轮第 ${displayedTurnNumber} 回合，当前玩家：${nextPlayer?.colorLabel || ""}玩家`
        : `回合已结束，当前玩家：${nextPlayer?.colorLabel || ""}玩家`;
    actionRocketState.statusNote = [
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
      maybeStartFundamentalismRoundStartIncomeFlow(nextPlayer, actionTurnState.roundNumber);
      maybeOpenActionBriefingForCompletedCycle(advanceResult);
    }
    refreshLatestActionLogRecoverySnapshot("回合结束后状态");
    if (advanceResult.gameEnded) {
      maybeAutoOpenFinalResultDialog();
    }
    return { ok: true, progressed: true, advanceResult, message: actionRocketState.statusNote };
  }

  function endCurrentTurn(workingRoot, execution = {}) {
    requireWorkingRoot(workingRoot);
    const actionPlayerState = workingRoot.playerState;
    const actionTurnState = workingRoot.turnState;
    if (!actionHistory.isActionComplete?.()
      || isActionEffectFlowActive(workingRoot)
      || hasActivePendingSubFlow(workingRoot)) {
      return { ok: false, message: "主行动未完成或仍有待决选择" };
    }
    const endingPlayer = (actionPlayerState.players || [])
      .find((player) => player.id === (execution.standardAction?.actorId || actionPlayerState.currentPlayerId));
    const endingPlayerId = endingPlayer?.id || null;
    const didPass = actionHistory.getSessionInfo?.()?.passPlayerId === endingPlayerId;

    if (industry?.expireStrategyPlayInteractionOnTurnEnd?.(endingPlayer, actionTurnState.roundNumber)?.cleared) {
      renderInitialSelectionArea();
    }
    industry?.clearTuringBorrowedTech?.(endingPlayer);
    industry?.clearSentinelPlayCornerState?.(endingPlayer);

    endEffectHistoryStep(workingRoot);
    const turnEndContext = { endingPlayer, endingPlayerId, didPass };
    const turnEndReveal = revealReadyAliensAtTurnEnd(workingRoot, endingPlayer, {
      confirmBeforeSideEffects: true,
    });
    return finishCurrentTurnAfterAlienReveal(workingRoot, {
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

  function createTurnEndPort(context = {}) {
    const commandMethods = [
      "executePassFirstRotateEffect", "executePassHandLimitEffect", "maybeResumeTurnEndAfterReveal",
      "maybeContinuePendingTurnEndRevealFlow", "maybeContinueAlienRevealQueuedOpportunities",
    ];
    const port = {
      createPassEvent: (...args) => context.getRuntime()?.createPassEvent(...args),
      passForCurrentPlayer(execution = {}) {
        return execution.workingRoot
          ? context.getRuntime()?.passForCurrentPlayer(execution.workingRoot, execution)
          : context.dispatchCommand("passForCurrentPlayer", [execution]);
      },
      endCurrentTurn(execution = {}) {
        return execution.workingRoot
          ? context.getRuntime()?.endCurrentTurn(execution.workingRoot, execution)
          : context.dispatchCommand("endCurrentTurn", [execution]);
      },
    };
    for (const name of commandMethods) {
      port[name] = (...args) => context.dispatchCommand(name, args);
    }
    return Object.freeze(port);
  }

  return {
    createTurnEndFlow,
    createTurnEndPort,
  };
});
