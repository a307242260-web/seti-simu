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

  const BROWSER_STATIC_DEPENDENCY_KEYS = Object.freeze([
    "abilities", "aliens", "historyCommands", "industry", "planetRewards",
  ]);

  function createBrowserTurnEndStaticContext(dependencies = {}) {
    const missing = BROWSER_STATIC_DEPENDENCY_KEYS.filter(
      (key) => !Object.prototype.hasOwnProperty.call(dependencies, key) || dependencies[key] == null,
    );
    if (missing.length) throw new Error(`Browser Turn End 静态模块缺少依赖：${missing.join(", ")}`);
    return Object.freeze(Object.fromEntries(
      BROWSER_STATIC_DEPENDENCY_KEYS.map((key) => [key, dependencies[key]]),
    ));
  }

  function createBrowserTurnEndFlow(options = {}) {
    const {
      staticContext,
      actionBriefingRuntime,
      actionLogRuntime,
      actionSessionRuntime,
      alienRuntime,
      alienUiRuntime,
      cardRuntime,
      cardSelectionState,
      cardTriggerRuntime,
      effectFlowRuntime,
      finalUiRuntime,
      handFlowRuntime,
      incomeRuntime,
      pendingSubFlowRuntime,
      playerEffectOwnerRuntime,
      playerLookupRuntime,
      renderRuntime,
      turnHostRuntime,
      turnReadoutRuntime,
      getAlienSpeciesRuntime,
      getDebugRuntime,
      hostPort = {},
    } = options;
    const requiredOwners = {
      actionBriefingRuntime, actionLogRuntime, actionSessionRuntime, alienRuntime,
      alienUiRuntime, cardRuntime, cardSelectionState,
      cardTriggerRuntime, effectFlowRuntime, finalUiRuntime, handFlowRuntime,
      incomeRuntime, pendingSubFlowRuntime, playerEffectOwnerRuntime,
      playerLookupRuntime, renderRuntime, turnHostRuntime, turnReadoutRuntime,
    };
    const missingOwners = Object.entries(requiredOwners)
      .filter(([, owner]) => !owner || typeof owner !== "object")
      .map(([label]) => label);
    if (missingOwners.length) {
      throw new TypeError(`Browser Turn End bootstrap 缺少 owner：${missingOwners.join(", ")}`);
    }
    const missingOwnerGetters = Object.entries({
      alienSpeciesRuntime: getAlienSpeciesRuntime,
      debugRuntime: getDebugRuntime,
    }).filter(([, getter]) => typeof getter !== "function").map(([label]) => label);
    if (missingOwnerGetters.length) {
      throw new TypeError(`Browser Turn End bootstrap 缺少 owner getter：${missingOwnerGetters.join(", ")}`);
    }
    const lazy = (label, getter, method) => (...args) => {
      const fn = getter()?.[method];
      if (typeof fn !== "function") {
        throw new Error(`Browser Turn End owner ${label} 缺少方法：${method}`);
      }
      return fn(...args);
    };
    const alienSpecies = (method) => lazy("alienSpeciesRuntime", getAlienSpeciesRuntime, method);
    const debug = (method) => lazy("debugRuntime", getDebugRuntime, method);

    return createTurnEndFlow({
      ...staticContext,
      HISTORY_SOURCE_MAIN: hostPort.HISTORY_SOURCE_MAIN,
      HISTORY_SOURCE_QUICK: hostPort.HISTORY_SOURCE_QUICK,
      PASS_HAND_LIMIT: hostPort.PASS_HAND_LIMIT,
      PASS_RESERVE_ROUNDS: hostPort.PASS_RESERVE_ROUNDS,
      actionHistory: hostPort.actionHistory,
      quickActionHistory: hostPort.quickActionHistory,
      els: hostPort.els,
      uiRuntimeState: hostPort.uiRuntimeState,
      deferPendingDecision: hostPort.deferPendingDecision,
      readPendingDecision: hostPort.readPendingDecision,
      activateNextActionEffect: effectFlowRuntime.activateNextActionEffect,
      advanceTurnAfterPlayerAction: turnHostRuntime.advanceTurnAfterPlayerAction,
      appendActionLogStep: actionLogRuntime.appendActionLogStep,
      applyIncomeResourcesForPlayer: incomeRuntime.applyIncomeResourcesForPlayer,
      applyIndustryRoundStartBonuses: incomeRuntime.applyIndustryRoundStartBonuses,
      assignEffectFlowOwner: playerEffectOwnerRuntime.assignEffectFlowOwner,
      beginDiscardSelection: handFlowRuntime.beginDiscardSelection,
      beginEffectHistoryStep: effectFlowRuntime.beginEffectHistoryStep,
      canStartMainAction: actionSessionRuntime.canStartMainAction,
      clearActionEffectFlow: hostPort.clearActionEffectFlow,
      clearActionPending: actionSessionRuntime.clearActionPending,
      clearHistoryStepOrderForSource: effectFlowRuntime.clearHistoryStepOrderForSource,
      commitActionLogDraft: actionLogRuntime.commitActionLogDraft,
      completeCurrentActionEffect: effectFlowRuntime.completeCurrentActionEffect,
      completePendingActionStep: effectFlowRuntime.completePendingActionStep,
      createActionLogImpactSnapshot: actionLogRuntime.createActionLogImpactSnapshot,
      endEffectHistoryStep: effectFlowRuntime.endEffectHistoryStep,
      getCurrentPlayer: playerLookupRuntime.getCurrentPlayer,
      getDisplayedTurnNumber: turnHostRuntime.getDisplayedTurnNumber,
      getMainActionStartBlockReason: actionSessionRuntime.getMainActionStartBlockReason,
      hasActiveCardTriggerResolution: cardTriggerRuntime.hasActiveCardTriggerResolution,
      hasActivePendingSubFlow: pendingSubFlowRuntime.hasActivePendingSubFlow,
      getPendingBanrenmaCardGain: alienSpecies("getPendingBanrenmaCardGain"),
      getPendingJiuzheCardPlay: alienSpecies("getPendingJiuzheCardPlay"),
      getPendingBanrenmaOpportunity: alienSpecies("getPendingBanrenmaOpportunity"),
      isActionEffectFlowActive: hostPort.isActionEffectFlowActive,
      isCardSelectionActive: cardSelectionState.isCardSelectionActive,
      readCardSelectionDecision: cardRuntime.readCardSelectionDecision,
      openCardSelectionDecision: cardRuntime.openCardSelectionDecision,
      isFinalRound: turnReadoutRuntime.isFinalRound,
      isWeakStartAiDifficulty: turnReadoutRuntime.isWeakStartAiDifficulty,
      maybeAutoOpenFinalResultDialog: finalUiRuntime.maybeAutoOpenFinalResultDialog,
      maybeOpenActionBriefingForCompletedCycle: actionBriefingRuntime.maybeOpenActionBriefingForCompletedCycle,
      maybeOpenQueuedBanrenmaOpportunity: alienSpecies("maybeOpenQueuedBanrenmaOpportunity"),
      maybeOpenQueuedJiuzheOpportunity: alienSpecies("maybeOpenQueuedJiuzheOpportunity"),
      maybeStartFundamentalismRoundStartIncomeFlow: incomeRuntime.maybeStartFundamentalismRoundStartIncomeFlow,
      recordHistoryCommand: effectFlowRuntime.recordHistoryCommand,
      refreshLatestActionLogRecoverySnapshot: hostPort.refreshLatestActionLogRecoverySnapshot,
      renderAlienPanels: alienSpecies("renderAlienPanels"),
      renderDebugPlayerSwitch: debug("renderDebugPlayerSwitch"),
      renderInitialSelectionArea: renderRuntime.renderInitialSelectionArea,
      renderPlayerStats: renderRuntime.renderPlayerStats,
      renderPublicCards: renderRuntime.renderPublicCards,
      renderReservedCards: renderRuntime.renderReservedCards,
      renderRockets: renderRuntime.renderRockets,
      renderRoundStatus: turnReadoutRuntime.renderRoundStatus,
      renderStateReadout: renderRuntime.renderStateReadout,
      renderTechBoard: hostPort.renderTechBoard,
      rotateSolarOrbit: hostPort.rotateSolarOrbit,
      scheduleAiAutoStepIfNeeded: hostPort.scheduleAiAutoStepIfNeeded,
      selectDefaultRocketForCurrentPlayer: debug("selectDefaultRocketForCurrentPlayer"),
      settleCardTasksAfterEffect: cardTriggerRuntime.settleCardTasksAfterEffect,
      settleTurnEndAlienRevealEntries: alienRuntime.settleTurnEndAlienRevealEntries,
      startActionLogDraft: actionLogRuntime.startActionLogDraft,
      updateActionButtons: hostPort.updateActionButtons,
      updatePublicCardControls: cardRuntime.updatePublicCardControls,
    });
  }

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
      canStartMainAction,
      clearActionEffectFlow,
      clearActionPending,
      clearHistoryStepOrderForSource,
      commitActionLogDraft,
      completeCurrentActionEffect,
      completePendingActionStep,
      createActionLogImpactSnapshot,
      deferPendingDecision,
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
      planetRewards,
      quickActionHistory,
      readPendingDecision,
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

  function getTurnEndRevealDecision(workingRoot) {
    requireWorkingRoot(workingRoot);
    return readPendingDecision?.("turn_end_reveal") || null;
  }

  function deferTurnEndRevealDecision(workingRoot, decision) {
    requireWorkingRoot(workingRoot);
    if (decision == null) return null;
    const normalized = {
      endingPlayerId: decision.endingPlayerId || decision.endingPlayer?.id || null,
      playerId: decision.endingPlayerId || decision.endingPlayer?.id || null,
      didPass: Boolean(decision.didPass),
      turnEndReveal: structuredClone(decision.turnEndReveal || null),
    };
    deferPendingDecision(workingRoot, "turn_end_reveal", normalized);
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

    const cardSelectionPending = context.readCardSelectionDecision?.();
    const anomalyPickOpen = isCardSelectionActive()
      && cardSelectionPending?.type === "yichangdian_anomaly_pick";
    if (anomalyPickOpen) {
      context.openCardSelectionDecision(workingRoot, {
        ...cardSelectionPending,
        fromEffectFlow: true,
        effectResult: {
          ok: result.ok,
          undoable: true,
          message: result.message,
          payload: result.payload || null,
          events: result.events || [],
        },
      });
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

  function revealReadyAliensAtTurnEnd(workingRoot, triggerPlayer) {
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
      || readPendingDecision?.("alien_trace")
      || uiRuntimeState.alienTracePickerState
      || isActionEffectFlowActive(workingRoot)
      || hasActivePendingSubFlow(workingRoot)
    );
  }

  function deferTurnEndAfterRevealDecision(workingRoot, decision) {
    deferTurnEndRevealDecision(workingRoot, decision);
    workingRoot.rocketState.statusNote = decision?.turnEndReveal?.message || "请先完成外星人揭示流程";
    updateActionButtons();
    renderStateReadout();
    return { ok: true, pending: true, message: workingRoot.rocketState.statusNote };
  }

  function maybeResumeTurnEndAfterReveal(workingRoot) {
    requireWorkingRoot(workingRoot);
    const decision = getTurnEndRevealDecision(workingRoot);
    if (!decision || hasTurnEndRevealBlockingSubFlow(workingRoot)) return null;
    return finishCurrentTurnAfterAlienReveal(workingRoot, decision);
  }

  function maybeContinuePendingTurnEndRevealFlow(workingRoot) {
    requireWorkingRoot(workingRoot);
    if (!getTurnEndRevealDecision(workingRoot)) return null;
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
    if (turnEndReveal?.count && !getTurnEndRevealDecision(workingRoot)) {
      return deferTurnEndAfterRevealDecision(workingRoot, {
        endingPlayerId,
        didPass,
        turnEndReveal,
      });
    }
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
    const turnEndReveal = revealReadyAliensAtTurnEnd(workingRoot, endingPlayer);
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
      finishCurrentTurnAfterAlienReveal,
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
    BROWSER_STATIC_DEPENDENCY_KEYS,
    createBrowserTurnEndFlow,
    createBrowserTurnEndStaticContext,
    createTurnEndFlow,
    createTurnEndPort,
  };
});
