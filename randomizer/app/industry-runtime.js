(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppIndustryRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  "use strict";

  const BROWSER_STATIC_DEPENDENCY_KEYS = Object.freeze([
    "abilities", "cardEffects", "cards", "data", "historyCommands", "industry",
    "players", "rocketActions", "tech",
  ]);

  function createBrowserIndustryStaticContext(dependencies = {}) {
    const missing = BROWSER_STATIC_DEPENDENCY_KEYS.filter(
      (key) => !Object.prototype.hasOwnProperty.call(dependencies, key) || dependencies[key] == null,
    );
    if (missing.length) throw new Error(`Browser Industry 静态模块缺少依赖：${missing.join(", ")}`);
    return Object.freeze(Object.fromEntries(
      BROWSER_STATIC_DEPENDENCY_KEYS.map((key) => [key, dependencies[key]]),
    ));
  }

  function createBrowserIndustryRuntime(options = {}) {
    const {
      staticContext,
      getActionInteractionRuntime,
      getIncomeRuntime,
      getTechRuntime,
      actionSessionRuntime,
      browserMatchRuntime,
      cardSelectionDecisionOwner,
      cardHoverPreviewRuntime,
      cardRuntime,
      cardSelectionState,
      effectExecutorPort,
      effectFlowRuntime,
      effectHistoryPort,
      handFlowRuntime,
      interactionChrome,
      playerEffectOwnerRuntime,
      renderRuntime,
      scanRuntime,
      scoreSourceRuntime,
      hostPort = {},
    } = options;
    const requireGetter = (name, getter) => {
      if (typeof getter !== "function") {
        throw new TypeError(`Browser Industry bootstrap 缺少 owner getter：${name}`);
      }
      return getter;
    };
    const lazy = (ownerName, getter, methodName) => {
      const getOwner = requireGetter(ownerName, getter);
      return (...args) => {
        const method = getOwner()?.[methodName];
        if (typeof method !== "function") {
          throw new Error(`Browser Industry owner ${ownerName} 缺少方法：${methodName}`);
        }
        return method(...args);
      };
    };
    const actionInteraction = (methodName) => (
      lazy("actionInteraction", getActionInteractionRuntime, methodName)
    );
    const income = (methodName) => lazy("income", getIncomeRuntime, methodName);
    const tech = (methodName) => lazy("tech", getTechRuntime, methodName);

    return createIndustryRuntime({
      ...staticContext,
      HISTORY_SOURCE_MAIN: hostPort.HISTORY_SOURCE_MAIN,
      HISTORY_SOURCE_QUICK: hostPort.HISTORY_SOURCE_QUICK,
      INDUSTRY_TURING_BORROW_TECH_TYPES: hostPort.INDUSTRY_TURING_BORROW_TECH_TYPES,
      SCORE_SOURCE_KEYS: hostPort.SCORE_SOURCE_KEYS,
      activateMoveMode: actionInteraction("activateMoveMode"),
      activateNextActionEffect: effectFlowRuntime?.activateNextActionEffect,
      addScoreSourceFromGain: scoreSourceRuntime?.addScoreSourceFromGain,
      appendActionLogStep: effectFlowRuntime?.appendActionLogStep,
      assignEffectFlowOwner: playerEffectOwnerRuntime?.assignEffectFlowOwner,
      attachCardHoverPreview: cardHoverPreviewRuntime?.attach,
      beginCardSelection: cardRuntime?.beginCardSelection,
      beginDiscardSelection: handFlowRuntime?.beginDiscardSelection,
      beginEffectHistoryStep: effectFlowRuntime?.beginEffectHistoryStep,
      beginQuickActionStep: effectFlowRuntime?.beginQuickActionStep,
      beginScanAction: hostPort.beginScanAction,
      beginSupplementalMovePayment: handFlowRuntime?.beginSupplementalMovePayment,
      buildReadySectorFinishEffects: scanRuntime?.buildReadySectorFinishEffects,
      canStartMainAction: actionSessionRuntime?.canStartMainAction,
      clearActionEffectFlow: effectFlowRuntime?.clearActionEffectFlow,
      clearHistoryStepOrderForSource: effectFlowRuntime?.clearHistoryStepOrderForSource,
      completeCurrentActionEffect: effectFlowRuntime?.completeCurrentActionEffect,
      completeQuickActionStep: effectFlowRuntime?.completeQuickActionStep,
      createActionContext: hostPort.createActionContext,
      dispatchStandardIntent: hostPort.dispatchStandardIntent,
      createCardCornerTriggerEventFields: cardRuntime?.createCardCornerTriggerEventFields,
      createInitialSelectionImage: hostPort.createInitialSelectionImage,
      deactivateMoveMode: actionInteraction("deactivateMoveMode"),
      document: hostPort.document,
      els: hostPort.els,
      endEffectHistoryStep: effectFlowRuntime?.endEffectHistoryStep,
      finishAutomaticRewardEffect: effectExecutorPort?.finishAutomaticRewardEffect,
      forgetLastHistoryStep: effectFlowRuntime?.forgetLastHistoryStep,
      formatCardCornerRewardMessage: cardRuntime?.formatCardCornerRewardMessage,
      formatPlanetRewardGain: effectExecutorPort?.formatPlanetRewardGain,
      getAutoDataPlacementCheck: actionInteraction("getAutoDataPlacementCheck"),
      getCurrentActionEffect: effectFlowRuntime?.getCurrentActionEffect,
      getEarthSectorCoordinate: hostPort.getEarthSectorCoordinate,
      getFutureSpanDeltaForCard: cardRuntime?.getFutureSpanDeltaForCard,
      getGameplayLockReason: hostPort.getGameplayLockReason,
      getMarkedNebulaIdsFromEvents: hostPort.getMarkedNebulaIdsFromEvents,
      getMovableTokensForPlayer: hostPort.getMovableTokensForPlayer,
      getNormalTokenAssetForPlayer: hostPort.getNormalTokenAssetForPlayer,
      getPendingPlayCardSelection: handFlowRuntime?.getPendingPlayCardSelection,
      readCardSelectionDecision: cardSelectionDecisionOwner?.read,
      openCardSelectionDecision: cardSelectionDecisionOwner?.open,
      getRequiredMovePointsForUi: hostPort.getRequiredMovePointsForUi,
      hasFutureSpanEligibleHandCard: cardRuntime?.hasFutureSpanEligibleHandCard,
      insertActionEffectsAfterCurrent: effectExecutorPort?.insertActionEffectsAfterCurrent,
      isActionEffectFlowActive: effectFlowRuntime?.isActionEffectFlowActive,
      isCardSelectionActive: cardSelectionState?.isCardSelectionActive,
      isDataPoolFull: actionInteraction("isDataPoolFull"),
      isDiscardSelectionActive: cardSelectionState?.isDiscardSelectionActive,
      isFutureSpanEligibleHandCard: cardRuntime?.isFutureSpanEligibleHandCard,
      isHandScanSelectionActive: handFlowRuntime?.isHandScanSelectionActive,
      isInitialIncomeFlowActive: income("isInitialIncomeFlowActive"),
      isActionPending: actionSessionRuntime?.isActionPending,
      isMovePaymentSelectionActive: handFlowRuntime?.isMovePaymentSelectionActive,
      isPlayCardSelectionActive: cardSelectionState?.isPlayCardSelectionActive,
      isTechTilePickingActive: tech("isTechTilePickingActive"),
      launchRocketForCurrentPlayer: hostPort.launchRocketForCurrentPlayer,
      openAutoDataPlacementPrompt: actionInteraction("openAutoDataPlacementPrompt"),
      openScanTargetPicker: scanRuntime?.openScanTargetPicker,
      quickActionHistory: hostPort.quickActionHistory,
      recordAbilityCommands: effectHistoryPort?.recordAbilityCommands,
      recordHistoryCommand: effectFlowRuntime?.recordHistoryCommand,
      recordQuickHistoryCommand: effectFlowRuntime?.recordQuickHistoryCommand,
      removeLastActionLogStep: effectFlowRuntime?.removeLastActionLogStep,
      renderActionEffectBar: hostPort.renderActionEffectBar,
      renderInitialSelectionArea: renderRuntime?.renderInitialSelectionArea,
      renderPlayerHand: renderRuntime?.renderPlayerHand,
      renderPlayerStats: renderRuntime?.renderPlayerStats,
      renderPublicCards: renderRuntime?.renderPublicCards,
      renderRocketElement: renderRuntime?.renderRocketElement,
      renderRockets: renderRuntime?.renderRockets,
      renderSectors: renderRuntime?.renderSectors,
      renderStateReadout: renderRuntime?.renderStateReadout,
      renderTechBoard: tech("renderTechBoard"),
      researchTechForCurrentPlayer: tech("researchTechForCurrentPlayer"),
      restoreObjectSnapshot: cardRuntime?.restoreObjectSnapshot,
      resultHasSignalMarkedEvent: hostPort.resultHasSignalMarkedEvent,
      selectDefaultRocketForCurrentPlayer: hostPort.selectDefaultRocketForCurrentPlayer,
      startCardEffectFlow: effectFlowRuntime?.startCardEffectFlow,
      startIndustryPiratesRaidLaunchFlow: tech("startIndustryPiratesRaidLaunchFlow"),
      startPendingActionSession: actionSessionRuntime?.startPendingActionSession,
      syncCardSelectionChrome: interactionChrome?.syncCardSelectionChrome,
      syncDiscardSelectionChrome: handFlowRuntime?.syncDiscardSelectionChrome,
      syncIndustryHandSelectionChrome: interactionChrome?.syncIndustryHandSelectionChrome,
      syncInteractionFocusChrome: interactionChrome?.syncInteractionFocusChrome,
      syncTechSelectionChrome: tech("syncTechSelectionChrome"),
      uiRuntimeState: hostPort.uiRuntimeState,
      updateActionButtons: hostPort.updateActionButtons,
    });
  }

  function createIndustryStartupRuntime(context = {}) {
    function apply(workingRoot) {
      if (!workingRoot?.playerState || !workingRoot?.finalScoringState) {
        throw new TypeError("applyIndustryStartupPassives 缺少 workingRoot");
      }
      for (const player of workingRoot.playerState.players) {
        if (context.industry?.shouldInitializeStrategyPassiveMarkers?.(player)) context.industry.initializeStrategyPassiveMarkers(player);
        if (context.industry?.shouldInitializeHeliosPassiveMarkers?.(player)) context.industry.initializeHeliosPassiveMarkers(player);
        if (context.industry?.shouldInitializeAlienLabPanels?.(player)) context.industry.initializeAlienLabPanels(player);
        if (context.industry?.shouldInitializeFutureSpan?.(player)) context.industry.initializeFutureSpanState(player);
        if (!context.industry?.shouldPlaceMissionStartupFinalMark?.(player)) continue;
        const markResult = context.finalScoring.placeDirectMarkAtSlot(workingRoot.finalScoringState, "c", player, 3, {
          tokenSrc: context.getNormalTokenAssetForPlayer(player),
          source: "mission_relay_startup",
        });
        if (!markResult.ok) workingRoot.rocketState.statusNote = markResult.message;
      }
      context.renderFinalScoreBoard();
    }
    return Object.freeze({ apply });
  }

  function createIndustryRuntime(context = {}) {
    const {
      HISTORY_SOURCE_MAIN,
      HISTORY_SOURCE_QUICK,
      INDUSTRY_TURING_BORROW_TECH_TYPES,
      SCORE_SOURCE_KEYS,
      abilities,
      activateMoveMode,
      activateNextActionEffect,
      addScoreSourceFromGain,
      appendActionLogStep,
      assignEffectFlowOwner,
      attachCardHoverPreview,
      beginCardSelection,
      beginDiscardSelection,
      beginEffectHistoryStep,
      beginQuickActionStep,
      beginScanAction,
      beginSupplementalMovePayment,
      buildReadySectorFinishEffects,
      cardEffects,
      cards,
      canStartMainAction,
      clearActionEffectFlow,
      clearHistoryStepOrderForSource,
      completeCurrentActionEffect,
      completeQuickActionStep,
      createActionContext,
      createCardCornerTriggerEventFields,
      createInitialSelectionImage,
      data,
      deactivateMoveMode,
      document,
      els,
      endEffectHistoryStep,
      finishAutomaticRewardEffect,
      forgetLastHistoryStep,
      formatCardCornerRewardMessage,
      formatPlanetRewardGain,
      getAutoDataPlacementCheck,
      getCurrentActionEffect,
      getEarthSectorCoordinate,
      getFutureSpanDeltaForCard,
      getGameplayLockReason,
      getMarkedNebulaIdsFromEvents,
      getMovableTokensForPlayer,
      getNormalTokenAssetForPlayer,
      getPendingPlayCardSelection,
      getRequiredMovePointsForUi,
      hasFutureSpanEligibleHandCard,
      historyCommands,
      industry,
      insertActionEffectsAfterCurrent,
      isActionEffectFlowActive,
      isCardSelectionActive,
      isDataPoolFull,
      isDiscardSelectionActive,
      isFutureSpanEligibleHandCard,
      isHandScanSelectionActive,
      isInitialIncomeFlowActive,
      isActionPending = () => false,
      isMovePaymentSelectionActive,
      isPlayCardSelectionActive,
      isTechTilePickingActive,
      launchRocketForCurrentPlayer,
      openAutoDataPlacementPrompt,
      openScanTargetPicker,
      players,
      quickActionHistory,
      recordAbilityCommands,
      recordHistoryCommand,
      recordQuickHistoryCommand,
      removeLastActionLogStep,
      renderActionEffectBar,
      renderInitialSelectionArea,
      renderPlayerHand,
      renderPlayerStats,
      renderPublicCards,
      renderRocketElement,
      renderRockets,
      renderSectors,
      renderStateReadout,
      renderTechBoard,
      researchTechForCurrentPlayer,
      restoreObjectSnapshot,
      resultHasSignalMarkedEvent,
      rocketActions,
      selectDefaultRocketForCurrentPlayer,
      startCardEffectFlow,
      startIndustryPiratesRaidLaunchFlow,
      startPendingActionSession,
      syncCardSelectionChrome,
      syncDiscardSelectionChrome,
      syncIndustryHandSelectionChrome,
      syncInteractionFocusChrome,
      syncTechSelectionChrome,
      tech,
      uiRuntimeState,
      updateActionButtons
    } = context;
    const getActionEffectFlow = (workingRoot) => requireWorkingRoot(workingRoot).match?.actionEffectFlow || null;
    const readCardSelectionDecision = () => context.readCardSelectionDecision?.() || null;
    function openCardSelectionDecision(workingRoot, pending) {
      requireWorkingRoot(workingRoot);
      uiRuntimeState.publicCardSelectedSlots = [];
      if (!pending) {
        uiRuntimeState.cardSelectionType = null;
        uiRuntimeState.industryHandSelectionType = null;
        return null;
      }
      const normalized = context.openCardSelectionDecision?.(workingRoot, pending);
      uiRuntimeState.industryHandSelectionType = normalized.type?.startsWith?.("industry_")
        ? normalized.type
        : null;
      return normalized;
    }
    const getCardSelectionPlayer = (workingRoot, pending) => (
      (workingRoot.playerState?.players || []).find((player) => (
        player.id === pending?.playerId || player.color === pending?.playerColor
      )) || getWorkingCurrentPlayer(workingRoot)
    );
    const getScanTargetContinuation = (workingRoot) => requireWorkingRoot(workingRoot).match?.scanTargetContinuation || null;
    const getStrategySlotDecision = (workingRoot) => requireWorkingRoot(workingRoot).match?.strategySlotContinuation || null;
    const getIndustryAbilityContinuation = (workingRoot) => requireWorkingRoot(workingRoot).match?.industryAbilityContinuation || null;
    const setIndustryAbilityContinuation = (workingRoot, value) => {
      requireWorkingRoot(workingRoot).match.industryAbilityContinuation = value == null ? null : value;
    };

    function requireWorkingRoot(workingRoot) {
      if (!workingRoot || typeof workingRoot !== "object") {
        throw new TypeError("industry-runtime operation requires an explicit workingRoot");
      }
      return workingRoot;
    }

    function getWorkingCurrentPlayer(workingRoot) {
      return players.getCurrentPlayer(requireWorkingRoot(workingRoot).playerState);
    }

    function resolveWorkingPlayerReference(workingRoot, reference = {}) {
      const { playerState } = requireWorkingRoot(workingRoot);
      const options = reference.options || {};
      const playerId = reference.playerId || options.playerId || options.targetPlayerId || null;
      if (playerId) {
        const player = (playerState.players || []).find((entry) => entry.id === playerId);
        if (player) return player;
      }
      const playerColor = reference.playerColor || options.playerColor || options.targetPlayerColor || null;
      return playerColor
        ? (playerState.players || []).find((entry) => entry.color === playerColor) || null
        : null;
    }

    function getWorkingEffectOwnerPlayer(workingRoot, effect = null) {
      return resolveWorkingPlayerReference(workingRoot, effect || {})
        || resolveWorkingPlayerReference(workingRoot, {
          playerId: getActionEffectFlow(workingRoot)?.defaultPlayerId || getActionEffectFlow(workingRoot)?.playerId,
        })
        || getWorkingCurrentPlayer(workingRoot);
    }

    function isIndustryHandSelectionActive() {
      return uiRuntimeState.industryHandSelectionType === "industry_deepspace_hand"
        || uiRuntimeState.industryHandSelectionType === "industry_future_hand";
    }

    function isIndustryFutureSpanHandSelectionActive() {
      return uiRuntimeState.industryHandSelectionType === "industry_future_hand";
    }

    function isIndustryFreeMoveActive(workingRoot) {
      requireWorkingRoot(workingRoot);
      return Boolean(workingRoot.match.industryFreeMoveContinuation);
    }

    function createIndustryActionRestoreCommand(workingRoot, player, beforePlayer, companyLabel, options = {}) {
      requireWorkingRoot(workingRoot);
      if (!player || !beforePlayer) return null;
      return {
        label: `撤销公司 1x：${companyLabel || "公司牌"}`,
        describe: `恢复${companyLabel || "公司牌"} 1x 行动前状态`,
        undo() {
          cancelIndustryAbilityFlow(workingRoot, { silent: true });
          if (options.clearEffectFlow) {
            clearActionEffectFlow(workingRoot);
          }
          restoreObjectSnapshot(player, beforePlayer);
          renderInitialSelectionArea();
        },
      };
    }

    function recordIndustryActionRestoreCommand(workingRoot, player, beforePlayer, companyLabel) {
      const command = createIndustryActionRestoreCommand(workingRoot, player, beforePlayer, companyLabel);
      if (command) recordQuickHistoryCommand(command);
    }

    function clearIndustryRollbackUi(workingRoot) {
      const { cardState, techGameState } = requireWorkingRoot(workingRoot);
      if (getScanTargetContinuation(workingRoot)?.type === "industry_remove_tech") {
        delete workingRoot.match.scanTargetContinuation;
        if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
        if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
      }
      if (readCardSelectionDecision()?.type?.startsWith?.("industry_")) {
        openCardSelectionDecision(workingRoot, null);
        cards.setSelectionActive(cardState, false);
        syncCardSelectionChrome();
      }
      if (techGameState?.ui?.industryBorrowMode) {
        techGameState.ui.industryBorrowMode = false;
        tech.setTechSelectionActive(techGameState, false);
        syncTechSelectionChrome(workingRoot);
      }
      if (uiRuntimeState.moveHighlightRocketId != null || workingRoot.match.industryFreeMoveContinuation) {
        deactivateMoveMode();
      }
      setIndustryAbilityContinuation(workingRoot, null);
      workingRoot.match.industryFreeMoveContinuation = null;
      syncIndustryHandSelectionChrome();
      syncInteractionFocusChrome();
    }

    function rollbackPendingIndustryQuickAction(workingRoot, message = "已取消公司 1x 行动") {
      const { rocketState } = requireWorkingRoot(workingRoot);
      const result = quickActionHistory.hasSession()
        ? quickActionHistory.undoLastStep()
        : { ok: false, message: "没有可撤销的公司 1x 行动" };
      if (result.ok) {
        uiRuntimeState.effectStepActive = false;
        forgetLastHistoryStep(HISTORY_SOURCE_QUICK, result.step?.id || null);
        removeLastActionLogStep(HISTORY_SOURCE_QUICK, result.step?.id || null);
      }
      clearIndustryRollbackUi(workingRoot);
      if (result.ok && !quickActionHistory.hasUndoableStep()) {
        quickActionHistory.commitSession();
        clearHistoryStepOrderForSource(HISTORY_SOURCE_QUICK);
      }
      rocketState.statusNote = result.ok ? message : (result.message || message);
      renderPlayerStats();
      renderPlayerHand();
      renderPublicCards();
      renderInitialSelectionArea();
      renderRockets();
      updateActionButtons();
      renderStateReadout();
      return result;
    }

    function cancelIndustryAbilityFlow(workingRoot, options = {}) {
      const { cardState, techGameState } = requireWorkingRoot(workingRoot);
      if (techGameState?.ui?.industryBorrowMode) {
        techGameState.ui.industryBorrowMode = false;
        tech.setTechSelectionActive(techGameState, false);
        syncTechSelectionChrome(workingRoot);
      }
      const cardSelectionPending = readCardSelectionDecision();
      if (cardSelectionPending?.type?.startsWith?.("industry_")) {
        if (cardSelectionPending.refundCost) {
          players.gainResources(getCardSelectionPlayer(workingRoot, cardSelectionPending), cardSelectionPending.refundCost);
        }
        openCardSelectionDecision(workingRoot, null);
        cards.setSelectionActive(cardState, false);
        syncCardSelectionChrome();
      }
      setIndustryAbilityContinuation(workingRoot, null);
      workingRoot.match.industryFreeMoveContinuation = null;
      if (uiRuntimeState.moveHighlightRocketId != null) {
        deactivateMoveMode();
      }
      if (!options.silent) {
        renderPlayerHand();
        renderPublicCards();
        renderInitialSelectionArea();
        updateActionButtons();
      }
      syncIndustryHandSelectionChrome();
      syncInteractionFocusChrome();
    }

    function finishIndustryAbilityFlow(workingRoot, message) {
      const { cardState, rocketState } = requireWorkingRoot(workingRoot);
      const flowType = getIndustryAbilityContinuation(workingRoot)?.flowType;
      setIndustryAbilityContinuation(workingRoot, null);
      workingRoot.match.industryFreeMoveContinuation = null;
      cards.setSelectionActive(cardState, false);
      openCardSelectionDecision(workingRoot, null);
      syncCardSelectionChrome();
      if (message) rocketState.statusNote = message;
      renderPlayerStats();
      renderPublicCards();
      renderPlayerHand();
      renderInitialSelectionArea();
      updateActionButtons();
      renderStateReadout();
      syncIndustryHandSelectionChrome();
      syncInteractionFocusChrome();
      if (flowType && !isIndustryIrreversibleFlow(flowType)) {
        completeIndustryAbilityQuickStep(workingRoot, message || rocketState.statusNote || null);
      }
    }

    function startIndustryAbilityFlow(workingRoot, flow, options = {}) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      if (!flow?.ok) {
        rocketState.statusNote = flow?.message || "公司 1x 行动无法启动";
        renderStateReadout();
        return false;
      }

      setIndustryAbilityContinuation(workingRoot, { ...flow });
      switch (flow.flowType) {
        case "stratus_public_corners":
          return startIndustryStratusEffectFlow(workingRoot, flow, options);
        case "turing_borrow_tech":
          return beginIndustryTuringBorrow(workingRoot, flow);
        case "sentinel_arm_play_corner": {
          const injected = tryInjectSentinelPlayCornerEffectAfterArm(workingRoot);
          finishIndustryAbilityFlow(workingRoot, injected
            ? `${flow.message}；已加入打牌效果队列`
            : flow.message);
          return true;
        }
        case "huanyu_free_moves":
          return startIndustryHuanyuMoveEffectFlow(workingRoot, flow, options);
        case "fundamentalism_score_exchange":
          return startIndustryFundamentalismExchangeFlow(workingRoot, flow, options);
        case "pirates_raid_launch":
          return startIndustryPiratesRaidLaunchFlow(workingRoot, flow, options);
        case "helios_remove_tech":
          return openIndustryHeliosTechPicker(workingRoot, flow);
        case "mission_publicity_pick":
          return startIndustryPublicityPick(workingRoot, flow, "industry_mission_pick");
        case "fenwick_publicity_pick":
          return startIndustryPublicityPick(workingRoot, flow, "industry_fenwick_pick");
        case "deepspace_swap":
          openCardSelectionDecision(workingRoot, {
            type: "industry_deepspace_hand",
            player: getWorkingCurrentPlayer(workingRoot),
            allowBlindDraw: false,
          });
          rocketState.statusNote = flow.message;
          syncIndustryHandSelectionChrome();
          renderStateReadout();
          return true;
        case "future_span_pick":
          beginCardSelection({
            type: "industry_future_pick",
            player: getWorkingCurrentPlayer(workingRoot),
            allowBlindDraw: false,
            advanceAmount: flow.advanceAmount,
          });
          rocketState.statusNote = flow.message;
          renderStateReadout();
          return true;
        case "strategy_pick":
          beginCardSelection({
            type: "industry_strategy_pick",
            player: getWorkingCurrentPlayer(workingRoot),
            allowBlindDraw: false,
          });
          rocketState.statusNote = flow.message;
          renderStateReadout();
          return true;
        default:
          cancelIndustryAbilityFlow(workingRoot, { silent: true });
          rocketState.statusNote = flow.message || "未实现的公司 1x 行动";
          renderStateReadout();
          return false;
      }
    }

    function startIndustryStratusEffectFlow(workingRoot, flow, options = {}) {
      const { cardState, rocketState } = requireWorkingRoot(workingRoot);
      const nodes = industry?.buildStratusPublicCornerEffectNodes?.(cards, cardState.publicCards) || [];
      setIndustryAbilityContinuation(workingRoot, null);
      openCardSelectionDecision(workingRoot, null);
      cards.setSelectionActive(cardState, false);
      syncCardSelectionChrome();

      if (!nodes.length) {
        rocketState.statusNote = "层云核心：公共牌区没有可结算的卡牌";
        renderStateReadout();
        return false;
      }

      const preHistoryCommands = [];
      if (options.markerRestoreCommand) preHistoryCommands.push(options.markerRestoreCommand);
      const started = startCardEffectFlow(
        "industry-stratus-public-corners",
        flow.label || "层云核心",
        nodes,
        {
          workingRoot,
          actionType: "industryStratus",
          historySource: HISTORY_SOURCE_QUICK,
          consumesMainAction: false,
          preHistoryCommands,
        },
      );
      if (started) {
        rocketState.statusNote = flow.message || "层云核心：请按效果栏依次结算公共牌区 3 张牌的弃牌角标";
        renderPublicCards();
        renderActionEffectBar();
        updateActionButtons();
        renderStateReadout();
      }
      return started;
    }

    function startIndustryFundamentalismExchangeFlow(workingRoot, flow, options = {}) {
      const { cardState, rocketState, turnState } = requireWorkingRoot(workingRoot);
      const groupId = `industry-fundamentalism-${turnState.roundNumber}-${turnState.turnNumber}`;
      const nodes = industry?.buildFundamentalismScoreExchangeEffectNodes?.({
        label: flow.label || "原教旨主义",
        count: flow.exchangeCount ?? industry?.FUNDAMENTALISM_EXCHANGE_COUNT ?? 3,
        groupId,
      }) || [];
      setIndustryAbilityContinuation(workingRoot, null);
      openCardSelectionDecision(workingRoot, null);
      cards.setSelectionActive(cardState, false);
      syncCardSelectionChrome();

      if (!nodes.length) {
        rocketState.statusNote = "原教旨主义：没有可结算的兑换效果";
        renderStateReadout();
        return false;
      }

      const preHistoryCommands = [];
      if (options.markerRestoreCommand) preHistoryCommands.push(options.markerRestoreCommand);
      const started = startCardEffectFlow(
        "industry-fundamentalism-score-exchange",
        flow.label || "原教旨主义",
        nodes,
        {
          workingRoot,
          actionType: "industryFundamentalism",
          historySource: HISTORY_SOURCE_QUICK,
          consumesMainAction: false,
          preHistoryCommands,
        },
      );
      if (started) {
        rocketState.statusNote = flow.message || "原教旨主义：请按效果栏结算 3 次分数/资源兑换";
        renderActionEffectBar();
        updateActionButtons();
        renderStateReadout();
      }
      return started;
    }

    function startIndustryPublicityPick(workingRoot, flow, pendingType) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      const player = getWorkingCurrentPlayer(workingRoot);
      const cost = flow.publicityCost ?? industry.PUBLICITY_PICK_COST;
      if (!players.canAfford(player, { publicity: cost })) {
        rocketState.statusNote = `宣传不足，需要 ${cost} 宣传`;
        renderStateReadout();
        return false;
      }
      players.spendResources(player, { publicity: cost });
      beginCardSelection({
        type: pendingType,
        player,
        allowBlindDraw: false,
        refundCost: { publicity: cost },
        flowLabel: flow.label,
      });
      rocketState.statusNote = flow.message;
      renderStateReadout();
      return true;
    }

    function beginIndustryTuringBorrow(workingRoot, flow) {
      const { rocketState, techGameState } = requireWorkingRoot(workingRoot);
      tech.setTechSelectionActive(techGameState, true);
      techGameState.ui.industryBorrowMode = true;
      techGameState.ui.selectedTileId = null;
      techGameState.ui.pendingTileId = null;
      techGameState.ui.allowedTechTypes = [...INDUSTRY_TURING_BORROW_TECH_TYPES];
      techGameState.ui.statusNote = flow.message;
      rocketState.statusNote = flow.message;
      syncTechSelectionChrome(workingRoot);
      renderTechBoard(workingRoot);
      renderStateReadout();
      return true;
    }

    function failIndustryTuringBorrow(workingRoot, message) {
      const { rocketState, techGameState } = requireWorkingRoot(workingRoot);
      techGameState.ui.statusNote = message;
      rocketState.statusNote = message;
      renderTechBoard(workingRoot);
      renderStateReadout();
      return { ok: false, message };
    }

    function checkIndustryTuringBorrowTile(workingRoot, tileId) {
      const { techGameState } = requireWorkingRoot(workingRoot);
      const techType = tech.getTechType?.(tileId) || null;
      if (!INDUSTRY_TURING_BORROW_TECH_TYPES.includes(techType)) {
        return { ok: false, message: "图灵系统只能借用橙色或紫色科技" };
      }

      const player = getWorkingCurrentPlayer(workingRoot);
      if (!player) return { ok: false, message: "没有当前玩家" };
      if (!player.techState) player.techState = players.normalizePlayerTechState(null);

      const check = tech.resolver.canTakeTile(
        techGameState.board,
        player.techState,
        tileId,
        { techTypes: INDUSTRY_TURING_BORROW_TECH_TYPES },
      );
      return check.ok ? { ok: true, techType } : check;
    }

    function confirmIndustryTuringBorrow(workingRoot, tileId) {
      const { techGameState, turnState } = requireWorkingRoot(workingRoot);
      const borrowCheck = checkIndustryTuringBorrowTile(workingRoot, tileId);
      if (!borrowCheck.ok) {
        return failIndustryTuringBorrow(workingRoot, borrowCheck.message || "无法借用该科技");
      }

      const player = getWorkingCurrentPlayer(workingRoot);
      const beforePlayer = structuredClone(player);
      player.industryBorrowedTechTileId = tileId;
      player.industryBorrowedTechRound = turnState.roundNumber;
      player.industryBorrowedTechTurn = turnState.turnNumber;
      tech.setTechSelectionActive(techGameState, false);
      techGameState.ui.industryBorrowMode = false;
      syncTechSelectionChrome(workingRoot);
      recordQuickHistoryCommand(historyCommands.createRestorePlayerCommand(
        player,
        beforePlayer,
        "恢复图灵借用前玩家状态",
      ));
      finishIndustryAbilityFlow(workingRoot, `图灵系统：当前回合借用 ${tileId} 效果`);
      return { ok: true, tileId };
    }

    function openIndustryHeliosTechPicker(workingRoot, flow) {
      requireWorkingRoot(workingRoot);
      const player = getWorkingCurrentPlayer(workingRoot);
      const removable = (tech.playerTech?.listActiveOwnedTileIds?.(player.techState) || [])
        .filter((tileId) => !String(tileId).startsWith("blue"));
      if (!removable.length) {
        finishIndustryAbilityFlow(workingRoot, "赫利昂联合体：没有可无效的非蓝色科技");
        return false;
      }
      return openScanTargetPicker(workingRoot, {
        type: "industry_remove_tech",
        title: flow.label || "赫利昂联合体",
        subtitle: "选择要无效的科技（不可选蓝色），随后增加 1 次收入",
        choices: removable.map((tileId) => ({
          nebulaId: tileId,
          label: tileId,
          description: "无效后不再具备效果，仍计入科技数量",
        })),
      });
    }

    function confirmIndustryHeliosRemoveTech(workingRoot, tileId) {
      const { cardState, rocketState } = requireWorkingRoot(workingRoot);
      const player = getWorkingCurrentPlayer(workingRoot);
      const beforePlayer = structuredClone(player);
      const beforeCardState = {
        publicCards: cardState.publicCards.slice(),
        discardPile: (cardState.discardPile || []).slice(),
      };
      const removeResult = tech.playerTech.removePlayerTile(player.techState, tileId);
      if (!removeResult.ok) {
        rocketState.statusNote = removeResult.message;
        renderStateReadout();
        return removeResult;
      }
      industry?.clearHeliosPassiveSlots?.(player);
      renderTechBoard(workingRoot);
      renderInitialSelectionArea();
      setIndustryAbilityContinuation(workingRoot, { flowType: "helios_remove_tech", removedTileId: tileId });
      recordQuickHistoryCommand(historyCommands.createRestorePlayerCommand(
        player,
        beforePlayer,
        "恢复赫利昂无效科技前玩家状态",
      ));
      const incomeStart = beginDiscardSelection(workingRoot, 1, {
        type: "industry_helios_income",
        player,
        beforePlayer,
        beforeCardState,
        removedTileId: tileId,
      });
      if (!incomeStart.ok) {
        restoreObjectSnapshot(player, beforePlayer);
        renderTechBoard(workingRoot);
        renderInitialSelectionArea();
        setIndustryAbilityContinuation(workingRoot, null);
        rollbackPendingIndustryQuickAction(workingRoot, incomeStart.message || "赫利昂联合体：收入无法结算，已撤回 1x 行动");
        return { ok: false, message: incomeStart.message || "赫利昂联合体：收入无法结算" };
      }
      rocketState.statusNote = incomeStart.ok
        ? `赫利昂联合体：已无效 ${tileId}，请选择 1 张手牌增加收入`
        : incomeStart.message;
      renderPlayerStats();
      renderStateReadout();
      return removeResult;
    }

    function startIndustryHuanyuMoveEffectFlow(workingRoot, flow, options = {}) {
      const { cardState, rocketState, turnState } = requireWorkingRoot(workingRoot);
      const groupId = `industry-huanyu-${turnState.roundNumber}-${turnState.turnNumber}`;
      const nodes = industry?.buildHuanyuFreeMoveEffectNodes?.({
        label: flow.label || "寰宇动力",
        count: flow.movesLeft ?? industry?.HUANYU_FREE_MOVE_COUNT ?? 2,
        groupId,
      }) || [];
      setIndustryAbilityContinuation(workingRoot, null);
      openCardSelectionDecision(workingRoot, null);
      workingRoot.match.industryFreeMoveContinuation = null;
      cards.setSelectionActive(cardState, false);
      syncCardSelectionChrome();

      if (!nodes.length) {
        rocketState.statusNote = "寰宇动力：没有可结算的移动效果";
        renderStateReadout();
        return false;
      }

      const preHistoryCommands = [];
      if (options.markerRestoreCommand) preHistoryCommands.push(options.markerRestoreCommand);
      const started = startCardEffectFlow(
        "industry-huanyu-free-moves",
        flow.label || "寰宇动力",
        nodes,
        {
          workingRoot,
          actionType: "industryHuanyu",
          historySource: HISTORY_SOURCE_QUICK,
          consumesMainAction: false,
          preHistoryCommands,
        },
      );
      if (started) {
        const movableCount = getMovableTokensForPlayer(getWorkingCurrentPlayer(workingRoot)?.id).length;
        rocketState.statusNote = movableCount
          ? (flow.message || "寰宇动力：请按效果栏依次结算 2 次移动")
          : "寰宇动力：当前没有可移动火箭，可跳过移动节点";
        renderRockets();
        renderActionEffectBar();
        updateActionButtons();
        renderStateReadout();
      }
      return started;
    }

    function beginIndustryHuanyuFreeMoves(workingRoot, flow) {
      const { rocketState, turnState } = requireWorkingRoot(workingRoot);
      const player = getWorkingCurrentPlayer(workingRoot);
      workingRoot.match.industryFreeMoveContinuation = {
        playerId: player.id,
        movesLeft: flow.movesLeft ?? 2,
        movedRocketIds: [],
        label: flow.label || "寰宇动力",
      };
      player.industryHuanyuFreeMovesLeft = workingRoot.match.industryFreeMoveContinuation.movesLeft;
      player.industryHuanyuFreeMoveTurn = turnState.turnNumber;
      const rocketsForPlayer = getMovableTokensForPlayer(player.id);
      rocketState.statusNote = rocketsForPlayer.length
        ? `${flow.message}（剩余 ${workingRoot.match.industryFreeMoveContinuation.movesLeft} 次）`
        : `${flow.message}：当前没有可移动火箭`;
      syncInteractionFocusChrome();
      renderRockets();
      if (rocketsForPlayer.length === 1) {
        activateMoveMode(rocketsForPlayer[0].id);
      } else if (rocketsForPlayer.length > 1) {
        selectDefaultRocketForCurrentPlayer();
      } else {
        finishIndustryAbilityFlow(workingRoot, rocketState.statusNote);
        return false;
      }
      renderStateReadout();
      return true;
    }

    function executeIndustryFreeMove(workingRoot, deltaX, deltaY, rocketId, payment = {}) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      const state = workingRoot.match.industryFreeMoveContinuation;
      if (!state) return { ok: false, message: "没有待结算的公司免费移动" };
      if (state.movedRocketIds.includes(rocketId)) {
        rocketState.statusNote = "该火箭本轮已免费移动过";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const moveCheck = rocketActions.canMoveRocket(rocketState, rocketId, deltaX, deltaY);
      if (!moveCheck.ok) {
        rocketState.statusNote = moveCheck.message;
        renderStateReadout();
        return moveCheck;
      }

      const currentPlayer = resolveWorkingPlayerReference(workingRoot, { playerId: state.playerId })
        || getWorkingCurrentPlayer(workingRoot);
      const providedMovePoints = Math.max(0, Math.round(Number(payment.providedMovePoints ?? 1) || 0));
      const terrainRequired = Number.isFinite(Number(payment.terrainRequired))
        ? Math.max(1, Math.round(Number(payment.terrainRequired)))
        : getRequiredMovePointsForUi(currentPlayer, rocketId, deltaX, deltaY);
      if (!payment.fromMovePayment && providedMovePoints < terrainRequired) {
        return beginSupplementalMovePayment({
          deltaX,
          deltaY,
          rocketId,
          terrainRequired,
          providedMovePoints,
          context: { type: "industry_free_move", terrainRequired },
          message: `${state.label}：已有 ${providedMovePoints} 点移动力，还需 ${terrainRequired - providedMovePoints} 点（可弃移动牌或用能量）`,
        });
      }

      const playerBeforeMove = structuredClone(getWorkingCurrentPlayer(workingRoot));
      const freeMoveStateBefore = {
        movesLeft: state.movesLeft,
        movedRocketIds: [...state.movedRocketIds],
        label: state.label,
      };
      const energyCost = Math.max(0, Math.round(Number(payment.energyCost) || 0));
      const result = abilities.executeAbility("moveProbe", createActionContext(workingRoot), {
        cost: energyCost > 0 ? { energy: energyCost } : {},
        movementPoints: Math.max(terrainRequired, providedMovePoints + energyCost),
        rocketId,
        deltaX,
        deltaY,
        historyLabel: `${state.label}：免费移动`,
        source: "industry",
      });
      if (result.rocket) renderRocketElement(result.rocket);
      if (!result.ok) {
        if (payment.discardCommand) payment.discardCommand.undo();
        rocketState.statusNote = result.message;
        renderStateReadout();
        return result;
      }

      state.movedRocketIds.push(rocketId);
      state.movesLeft -= 1;
      const player = getWorkingCurrentPlayer(workingRoot);
      player.industryHuanyuMovedRocketIds = [...state.movedRocketIds];
      player.industryHuanyuFreeMovesLeft = Math.max(0, state.movesLeft);
      recordQuickHistoryCommand({
        label: "恢复寰宇免费移动次数",
        undo() {
          if (!workingRoot.match.industryFreeMoveContinuation) {
            workingRoot.match.industryFreeMoveContinuation = {
              playerId: player.id,
              movesLeft: freeMoveStateBefore.movesLeft,
              movedRocketIds: [...freeMoveStateBefore.movedRocketIds],
              label: freeMoveStateBefore.label,
            };
            setIndustryAbilityContinuation(workingRoot, {
              flowType: "huanyu_free_moves",
              label: freeMoveStateBefore.label,
            });
          } else {
            workingRoot.match.industryFreeMoveContinuation.movesLeft = freeMoveStateBefore.movesLeft;
            workingRoot.match.industryFreeMoveContinuation.movedRocketIds = [...freeMoveStateBefore.movedRocketIds];
            workingRoot.match.industryFreeMoveContinuation.label = freeMoveStateBefore.label;
          }
        },
      });
      if (payment.discardCommand) recordQuickHistoryCommand(payment.discardCommand);
      recordQuickHistoryCommand(historyCommands.createRestorePlayerCommand(
        player,
        playerBeforeMove,
        "恢复公司免费移动前玩家状态",
      ));
      recordAbilityCommands(result, quickActionHistory, workingRoot);

      if (state.movesLeft <= 0) {
        finishIndustryAbilityFlow(workingRoot, `${state.label}：免费移动已完成`);
        return result;
      }

      rocketState.statusNote = `${state.label}：还可免费移动 ${state.movesLeft} 枚火箭`;
      deactivateMoveMode();
      renderRockets();
      renderStateReadout();
      return result;
    }

    function canBeginIndustryFutureSpanHandSelection(workingRoot, player = getWorkingCurrentPlayer(workingRoot)) {
      requireWorkingRoot(workingRoot);
      if (!industry?.shouldShowFutureSpanPanel?.(player)) {
        return { ok: false, message: "当前玩家没有未来跨度研究所" };
      }
      const parkCheck = industry.canParkFutureSpanCard?.(player);
      if (!parkCheck?.ok) return { ok: false, message: parkCheck?.message || "未来跨度专属标记不可用" };
      if (isActionEffectFlowActive()
        || isCardSelectionActive()
        || isDiscardSelectionActive()
        || isPlayCardSelectionActive()
        || isTechTilePickingActive(workingRoot)
        || isHandScanSelectionActive()
        || isMovePaymentSelectionActive()
        || getIndustryAbilityContinuation(workingRoot)
        || workingRoot.match.industryFreeMoveContinuation
        || isIndustryHandSelectionActive()) {
        return { ok: false, message: "请先完成或取消当前流程" };
      }
      if (!hasFutureSpanEligibleHandCard(player)) {
        return { ok: false, message: "没有可用的信用点费用手牌" };
      }
      return { ok: true, message: "可以放置未来跨度专属标记" };
    }

    function beginIndustryFutureSpanHandSelection(workingRoot) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      const player = getWorkingCurrentPlayer(workingRoot);
      const check = canBeginIndustryFutureSpanHandSelection(workingRoot, player);
      if (!check.ok) {
        rocketState.statusNote = check.message;
        renderStateReadout();
        return check;
      }
      openCardSelectionDecision(workingRoot, {
        type: "industry_future_hand",
        player,
        allowBlindDraw: false,
      });
      rocketState.statusNote = "未来跨度研究所：选择一张费用为信用点的手牌，扣下并设置目标分";
      syncIndustryHandSelectionChrome();
      renderInitialSelectionArea();
      renderStateReadout();
      return { ok: true, message: rocketState.statusNote };
    }

    function handleIndustryFutureSpanHandClick(workingRoot, handIndex) {
      const { cardState, rocketState } = requireWorkingRoot(workingRoot);
      if (!isIndustryFutureSpanHandSelectionActive()) return;
      const player = getWorkingCurrentPlayer(workingRoot);
      const index = Math.round(handIndex);
      const card = player?.hand?.[index];
      if (!card || !isFutureSpanEligibleHandCard(card)) {
        rocketState.statusNote = "未来跨度只能选择费用为信用点的手牌";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const targetDelta = getFutureSpanDeltaForCard(card);
      const targetScore = Number(player.resources?.score || 0) + targetDelta;
      const beforePlayer = structuredClone(player);
      const removeResult = cards.discardFromHandAtIndex(player, index);
      if (!removeResult.ok) {
        rocketState.statusNote = removeResult.message;
        renderStateReadout();
        return removeResult;
      }
      const parkResult = industry.parkFutureSpanCard?.(player, removeResult.card, targetScore);
      if (!parkResult?.ok) {
        restoreObjectSnapshot(player, beforePlayer);
        rocketState.statusNote = parkResult?.message || "未来跨度专属标记放置失败";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      beginQuickActionStep("industry-future-span-token", "未来跨度研究所：放置专属标记");
      recordQuickHistoryCommand(historyCommands.createRestorePlayerCommand(
        player,
        beforePlayer,
        "恢复未来跨度专属标记前玩家状态",
      ));
      completeQuickActionStep();

      openCardSelectionDecision(workingRoot, null);
      cards.setSelectionActive(cardState, false);
      rocketState.statusNote = `未来跨度研究所：扣下 ${cards.getCardLabel(removeResult.card)}，目标 ${targetScore} 分`;
      syncIndustryHandSelectionChrome();
      renderPlayerStats();
      renderInitialSelectionArea();
      updateActionButtons();
      renderStateReadout();
      return {
        ok: true,
        card: removeResult.card,
        targetScore,
        message: rocketState.statusNote,
      };
    }

    function handleIndustryDeepspaceHandClick(workingRoot, handIndex) {
      const { cardState, rocketState } = requireWorkingRoot(workingRoot);
      if (!isIndustryHandSelectionActive()) return;
      const player = getWorkingCurrentPlayer(workingRoot);
      const index = Math.round(handIndex);
      const card = player?.hand?.[index];
      if (!card) {
        rocketState.statusNote = "无效的手牌位置";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      openCardSelectionDecision(workingRoot, {
        type: "industry_deepspace_public",
        player,
        handIndex: index,
        handCard: card,
        allowBlindDraw: false,
      });
      cards.setSelectionActive(cardState, true);
      rocketState.statusNote = `深空探测：已选手牌 ${cards.getCardLabel(card)}，请选择 1 张公共牌交换`;
      syncCardSelectionChrome();
      renderPlayerHand();
      renderPublicCards();
      renderStateReadout();
      return { ok: true, message: rocketState.statusNote };
    }

    function finalizeIndustryDeepspaceSwap(workingRoot, publicSlotIndex) {
      const { cardState, rocketState } = requireWorkingRoot(workingRoot);
      const pending = readCardSelectionDecision();
      const player = getCardSelectionPlayer(workingRoot, pending);
      const handIndex = Number(pending?.handIndex);
      const slotIndex = Math.round(Number(publicSlotIndex));
      const publicCard = cardState.publicCards?.[slotIndex];
      const handCard = Number.isInteger(handIndex) ? player?.hand?.[handIndex] : pending?.handCard;
      if (!handCard || !publicCard) {
        rocketState.statusNote = "交换失败：卡牌无效";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const beforePlayer = structuredClone(player);
      const beforePublicCards = cardState.publicCards.slice();
      const beforeDiscard = (cardState.discardPile || []).slice();

      player.hand[handIndex] = publicCard;
      player.resources.handSize = player.hand.length;
      cardState.publicCards[slotIndex] = handCard;

      recordQuickHistoryCommand(historyCommands.createRestorePlayerCommand(
        player,
        beforePlayer,
        "恢复深空探测交换前玩家状态",
      ));
      recordQuickHistoryCommand(historyCommands.createRestorePublicCardsCommand(
        cardState,
        beforePublicCards,
        beforeDiscard,
      ));

      openCardSelectionDecision(workingRoot, null);
      cards.setSelectionActive(cardState, false);
      syncCardSelectionChrome();
      finishIndustryAbilityFlow(workingRoot, `深空探测：${cards.getCardLabel(handCard)} 与 ${cards.getCardLabel(publicCard)} 已交换`);
      renderPlayerHand();
      renderPublicCards();
      return { ok: true, message: rocketState.statusNote };
    }

    const ALIEN_LAB_MAIN_ACTION_PANEL = Object.freeze({
      launch: "blue",
      scan: "yellow",
      researchTech: "pink",
    });
    const ALIEN_LAB_PANEL_MAIN_ACTION = Object.freeze({
      blue: "launch",
      yellow: "scan",
      pink: "researchTech",
    });

    function handleAlienLabPanelClick(workingRoot, panelId) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      const player = getWorkingCurrentPlayer(workingRoot);
      if (!player || !industry?.shouldShowAlienLabPanels?.(player)) {
        rocketState.statusNote = "当前玩家没有异星实验室";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      if (
        industry?.hasPermanentAlienLabPanels?.(player) !== true
        && industry?.isAlienLabPanelFaceUp?.(player, panelId) !== true
      ) {
        rocketState.statusNote = "异星实验室板块已翻面，无法触发";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      switch (ALIEN_LAB_PANEL_MAIN_ACTION[panelId]) {
        case "launch":
          return launchRocketForCurrentPlayer();
        case "scan":
          return beginScanAction();
        case "researchTech":
          return researchTechForCurrentPlayer();
        default:
          rocketState.statusNote = `未知异星实验室板块：${panelId || "无"}`;
          renderStateReadout();
          return { ok: false, message: rocketState.statusNote };
      }
    }

    function createAlienLabRestoreCommand(player, snapshot, label) {
      return {
        label: label || "恢复异星实验室板块",
        undo() {
          industry?.restoreAlienLabPanelSnapshot?.(player, snapshot);
        },
      };
    }

    function maybeConsumeAlienLabPanelForMainAction(workingRoot, actionId, result, player = getWorkingCurrentPlayer(workingRoot)) {
      requireWorkingRoot(workingRoot);
      const panelId = ALIEN_LAB_MAIN_ACTION_PANEL[actionId];
      if (!result?.ok || !player || !panelId) return result;
      if (!industry?.shouldShowAlienLabPanels?.(player)) return result;
      if (industry?.hasPermanentAlienLabPanels?.(player)) return result;
      if (industry?.isAlienLabPanelFaceUp?.(player, panelId) !== true) return result;

      const beforePanels = industry.createAlienLabPanelSnapshot?.(player);
      const consumeResult = industry.consumeAlienLabPanel?.(player, panelId);
      if (!consumeResult?.changed) return result;

      result.commands = [
        createAlienLabRestoreCommand(player, beforePanels, "恢复异星实验室板块状态"),
        ...(result.commands || []),
      ];
      result.message = `${result.message}；${consumeResult.message}`;
      result.payload = {
        ...(result.payload || {}),
        alienLabPanel: panelId,
      };
      renderInitialSelectionArea();
      return result;
    }

    function maybeRestoreAlienLabPanelForTrace(player, traceType) {
      if (!player || !industry?.shouldShowAlienLabPanels?.(player)) return null;
      const restoreResult = industry.restoreAlienLabPanelForTrace?.(player, traceType);
      if (restoreResult?.changed) {
        renderInitialSelectionArea();
      }
      return restoreResult;
    }

    function maybeApplyIndustryLaunchScan(workingRoot, result) {
      requireWorkingRoot(workingRoot);
      const player = getWorkingCurrentPlayer(workingRoot);
      if (!result?.ok || !industry?.shouldScanEarthOnLaunch?.(player)) return result;
      const earth = getEarthSectorCoordinate();
      const scanResult = abilities.executeAbility("scanSector", createActionContext(workingRoot), {
        sectorX: earth.x,
        skipCost: true,
        source: "industry",
        historyLabel: "哨兵探测网络：发射扫描地球扇区",
      });
      if (scanResult.ok) {
        result.commands = [...(result.commands || []), ...(scanResult.commands || [])];
        result.events = [...(result.events || []), ...(scanResult.events || [])];
        result.payload = {
          ...(result.payload || {}),
          industryLaunchScan: scanResult.payload || null,
        };
        result.message = `${result.message}；${scanResult.message}`;
        renderSectors();
      }
      return result;
    }

    function startLaunchSectorFinishEffectFlow(workingRoot, result) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      if (!result?.ok || !resultHasSignalMarkedEvent(result)) return false;

      const followups = buildReadySectorFinishEffects({
        nebulaIds: getMarkedNebulaIdsFromEvents(result.events),
      });
      if (!followups.length) return false;

      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      startPendingActionSession("launch", "发射行动");
      recordAbilityCommands(result, undefined, workingRoot);
      endEffectHistoryStep(workingRoot, {
        result: {
          ok: true,
          undoable: result.undoable,
          irreversible: result.irreversible || null,
          message: result.message || "发射行动",
        },
      });

      workingRoot.match.actionEffectFlow = abilities.chain.startAbilityChain(
        "launch-sector-finish",
        "发射后扇区结算",
        followups,
      );
      getActionEffectFlow(workingRoot).actionType = "launch";
      getActionEffectFlow(workingRoot).playerId = currentPlayer?.id || null;
      assignEffectFlowOwner(getActionEffectFlow(workingRoot), getActionEffectFlow(workingRoot).playerId);
      getActionEffectFlow(workingRoot).historySource = HISTORY_SOURCE_MAIN;
      getActionEffectFlow(workingRoot).consumesMainAction = true;

      els.appWrap?.classList.toggle("action-effect-flow-active", true);
      rocketState.statusNote = "发射完成：请处理哨兵扫描触发的扇区结算";
      activateNextActionEffect(workingRoot);
      return true;
    }

    function appendIndustryPlayPassiveStatus(workingRoot, result) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      const messages = (result?.messages || []).filter(Boolean);
      if (!messages.length) return;
      rocketState.statusNote = [rocketState.statusNote, ...messages].filter(Boolean).join("；");
      renderStateReadout();
    }

    function getStrategyPassiveRewardIcon(slotId) {
      const reward = industry?.getStrategySlotReward?.(slotId);
      if (reward?.data) return "data";
      if (reward?.publicity) return "publicity";
      if (reward?.credits) return "credits";
      return "pick_card";
    }

    function snapshotStrategyPlayedCard(card) {
      if (!card) return null;
      return {
        id: card.id,
        src: card.src,
        cardName: card.cardName,
        label: card.label,
        cardId: card.cardId,
        scanActionCode: card.scanActionCode,
      };
    }

    function buildStrategyPlayPassiveEffectNodes(player, playedCard, actionTurnState) {
      if (!industry?.isStrategyPlayInteractionActive?.(player, actionTurnState.roundNumber)) return [];
      const eligibleSlotIds = industry.getStrategyPlayEligibleSlotIds?.(player, actionTurnState.roundNumber) || [];
      if (!eligibleSlotIds.length) return [];
      const scanCode = industry.getStrategyPlayScanCode?.(player);
      const needsSlotChoice = Number(scanCode) === 3 && eligibleSlotIds.length > 1;
      const slotId = needsSlotChoice
        ? null
        : (industry.getAutomaticStrategyPlaySlotId?.(player, actionTurnState.roundNumber) || eligibleSlotIds[0]);
      const slotLabel = slotId
        ? (industry.getStrategyPassiveSlotLabel?.(slotId) || slotId)
        : "选择";
      const rewardLabel = slotId ? (industry.getStrategySlotRewardLabel?.(slotId) || "") : "";
      return [{
        id: `industry-strategy-passive-${playedCard?.id || playedCard?.cardId || "choice"}-${slotId || "choice"}`,
        type: "industry_strategy_passive_reward",
        label: `宇宙战略集团：${slotLabel}奖励槽`,
        icon: slotId ? getStrategyPassiveRewardIcon(slotId) : "black_scan",
        status: "pending",
        undoable: true,
        options: {
          slotId,
          eligibleSlotIds,
          needsSlotChoice,
          rewardLabel,
          playedCard: snapshotStrategyPlayedCard(playedCard),
        },
      }];
    }

    function buildIndustryPlayCardAppendEffects(workingRoot, player, playedCard) {
      const { turnState: actionTurnState } = requireWorkingRoot(workingRoot);
      const sentinelEffects = industry?.buildSentinelPlayCornerEffectNodes?.(
        cards,
        player,
        actionTurnState.roundNumber,
        actionTurnState.turnNumber,
        playedCard,
      ) || [];
      const strategyEffects = buildStrategyPlayPassiveEffectNodes(player, playedCard, actionTurnState);
      return {
        immediateEffects: sentinelEffects,
        deferredEndEffects: strategyEffects,
      };
    }

    function buildPlayCardEffectFlowQueue(workingRoot, player, playedCard, playEffects) {
      const industryAppendEffects = buildIndustryPlayCardAppendEffects(workingRoot, player, playedCard);
      const immediateEffects = [
        ...(playEffects || []),
        ...(industryAppendEffects.immediateEffects || []),
      ];
      const deferredEndEffects = industryAppendEffects.deferredEndEffects || [];
      return {
        effects: immediateEffects.length ? immediateEffects : deferredEndEffects,
        deferredEndEffects: immediateEffects.length ? deferredEndEffects : [],
      };
    }

    function applyIndustryPlayCardPassives(workingRoot, playedCard, typeCode) {
      const { turnState: actionTurnState } = requireWorkingRoot(workingRoot);
      const player = getWorkingCurrentPlayer(workingRoot);
      const result = { publicityGained: 0, messages: [] };
      if (!player || !playedCard) return result;
      player.industryPlayedCardThisRound = true;
      player.industryLastPlayedCardThisRound = {
        id: playedCard.id,
        src: playedCard.src,
        cardId: playedCard.cardId,
        discardActionCode: playedCard.discardActionCode ?? null,
        incomeActionCode: playedCard.incomeActionCode ?? null,
        scanActionCode: playedCard.scanActionCode ?? null,
      };
      player.industryPlayedCardRound = actionTurnState.roundNumber;
      player.industryPlayedCardTurn = actionTurnState.turnNumber;
      if (industry?.shouldGainPublicityOnType12Play?.(player) && [1, 2].includes(typeCode)) {
        const beforePublicity = Number(player.resources?.publicity) || 0;
        const publicityGain = industry.getMissionPlayPublicityGain();
        players.gainResources(player, { publicity: publicityGain });
        result.publicityGained = Math.max(0, (Number(player.resources?.publicity) || 0) - beforePublicity);
        result.messages.push(
          result.publicityGained > 0
            ? `任务中继站：打出${typeCode}型任务牌，宣传+${result.publicityGained}`
            : `任务中继站：打出${typeCode}型任务牌，宣传已达上限`,
        );
      }
      const strategyActivation = industry?.activateStrategyPlayInteraction?.(
        player,
        playedCard,
        actionTurnState.roundNumber,
      );
      if (strategyActivation?.ok) {
        if (strategyActivation.eligibleSlotIds?.length) {
          result.messages.push("宇宙战略集团：被动奖励已加入效果队列");
        } else if (strategyActivation.message) {
          result.messages.push(strategyActivation.message);
        }
      }
      return result;
    }

    function isIndustryIrreversibleFlow(flowType) {
      return flowType === "mission_publicity_pick"
        || flowType === "fenwick_publicity_pick"
        || flowType === "future_span_pick"
        || flowType === "strategy_pick";
    }

    function completeIndustryAbilityQuickStep(workingRoot, detail = null) {
      requireWorkingRoot(workingRoot);
      if (quickActionHistory.hasUndoableStep()) {
        completeQuickActionStep(detail);
      }
    }

    function commitIrreversibleIndustryQuickAction(workingRoot, label, message, options = {}) {
      requireWorkingRoot(workingRoot);
      const completeOptions = {
        undoable: false,
        irreversibleCode: options.irreversibleCode || "hidden_card_reveal",
        irreversibleReason: options.irreversibleReason || "公共牌补牌翻出新牌",
      };
      const step = quickActionHistory.hasSession()
        ? completeQuickActionStep(message || null, completeOptions)
        : null;
      if (!step) {
        appendActionLogStep(HISTORY_SOURCE_QUICK, label || "公司 1x 行动", message || null, completeOptions);
      }
      clearHistoryStepOrderForSource(HISTORY_SOURCE_QUICK);
      if (quickActionHistory.hasSession()) {
        quickActionHistory.commitSession();
      }
    }

    function appendSentinelPlayCornerEffectsToFlow(workingRoot, nodes) {
      if (!getActionEffectFlow(workingRoot) || !nodes?.length) return false;
      if (getActionEffectFlow(workingRoot).effects.some((effect) => effect.type === "industry_sentinel_corner")) {
        return false;
      }
      getActionEffectFlow(workingRoot).effects.push(...nodes.map((node) => ({
        ...node,
        status: "pending",
      })));
      getActionEffectFlow(workingRoot).completed = false;
      const hasActiveEffect = getActionEffectFlow(workingRoot).effects.some((effect) => effect.status === "active");
      if (!hasActiveEffect) {
        els.appWrap?.classList.toggle("action-effect-flow-active", true);
        activateNextActionEffect(workingRoot);
      }
      return true;
    }

    function tryInjectSentinelPlayCornerEffectAfterArm(workingRoot) {
      const { turnState } = requireWorkingRoot(workingRoot);
      const player = getWorkingCurrentPlayer(workingRoot);
      const playedCardInCurrentTurn = player?.industryPlayedCardThisRound
        && player?.industryPlayedCardRound === turnState.roundNumber
        && player?.industryPlayedCardTurn === turnState.turnNumber;
      if (!playedCardInCurrentTurn) return false;
      const playedCard = player?.industryLastPlayedCardThisRound;
      if (!playedCard) return false;

      const nodes = industry?.buildSentinelPlayCornerEffectNodes?.(
        cards,
        player,
        turnState.roundNumber,
        turnState.turnNumber,
        playedCard,
      ) || [];
      if (!nodes.length) return false;

      if (isActionEffectFlowActive() && getActionEffectFlow(workingRoot).actionType === "playCard") {
        return appendSentinelPlayCornerEffectsToFlow(workingRoot, nodes);
      }

      if (!isActionPending()) return false;

      return startCardEffectFlow(
        "industry-sentinel-corner",
        "哨兵探测网络",
        nodes,
        { workingRoot, actionType: "playCard", industryPlayedCard: playedCard },
      );
    }

    function createIndustryCardCornerEvent(player, reward, source) {
      return {
        type: "cardCorner",
        ...createCardCornerTriggerEventFields(
          reward?.kind === "resource" ? reward : null,
          reward?.kind === "move" ? reward : null,
          { cornerCode: reward?.code ?? null },
        ),
        playerId: player?.id || null,
        playerColor: player?.color || null,
        source,
      };
    }

    function executeIndustryStratusCornerEffect(workingRoot, effect) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      const card = effect.options?.card;
      const effectCards = Array.isArray(effect.options?.cards) && effect.options.cards.length
        ? effect.options.cards
        : (card ? [card] : []);
      const rewardSnapshot = effect.options?.reward || null;
      if (!currentPlayer || (!card && !rewardSnapshot)) {
        rocketState.statusNote = "层云核心：无效公共牌";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const reward = rewardSnapshot
        ? { ...rewardSnapshot, gain: { ...(rewardSnapshot.gain || {}) } }
        : industry.getCornerReward(cards, card);
      beginEffectHistoryStep(workingRoot, effect.label);
      if (!reward) {
        effect.result = {
          ok: true,
          undoable: true,
          message: `${effect.label}：没有弃牌角标奖励`,
        };
        rocketState.statusNote = effect.result.message;
        completeCurrentActionEffect(workingRoot, "skipped");
        renderStateReadout();
        return effect.result;
      }

      const beforePlayer = structuredClone(currentPlayer);
      const applied = industry.applyCornerReward(players, data, currentPlayer, reward);
      if (!applied.ok) {
        endEffectHistoryStep(workingRoot);
        rocketState.statusNote = applied.message;
        renderStateReadout();
        return applied;
      }
      addScoreSourceFromGain(currentPlayer, SCORE_SOURCE_KEYS.INDUSTRY_EFFECT, reward.gain);

      if (reward.kind === "move") {
        insertActionEffectsAfterCurrent([{
          id: `${effect.id || "stratus-corner"}-move`,
          type: cardEffects.EFFECT_TYPES.CARD_MOVE,
          label: `${effect.label}：${reward.label}`,
          icon: "movement",
          options: {
            movementPoints: reward.movementPoints || 1,
            historyLabel: reward.label,
          },
        }]);
      }

      recordHistoryCommand(workingRoot, historyCommands.createRestorePlayerCommand(
        currentPlayer,
        beforePlayer,
        "恢复层云核心角标结算前玩家状态",
      ));

      const rewardText = reward.kind === "resource"
        ? formatCardCornerRewardMessage(reward, applied.results || [])
        : [formatPlanetRewardGain(reward.gain || {}), `${reward.movementPoints || 1}移动`]
          .filter(Boolean)
          .join("、");

      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：${rewardText}`,
        events: [createIndustryCardCornerEvent(currentPlayer, reward, "industry_stratus")],
        payload: { card, cards: effectCards, reward, dataResults: applied.results || [] },
      });
    }

    function executeIndustrySentinelCornerEffect(workingRoot, effect) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      const playedCard = effect.options?.playedCard;
      if (!currentPlayer || !playedCard) {
        rocketState.statusNote = "哨兵探测网络：无效卡牌";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      if (industry?.isAlienCard?.(playedCard)) {
        effect.result = { ok: false, undoable: true, message: "外星人卡牌不能触发哨兵弃牌角标" };
        completeCurrentActionEffect(workingRoot, "skipped");
        renderStateReadout();
        return effect.result;
      }

      const reward = industry.getCornerReward(cards, playedCard);
      if (!reward) {
        effect.result = { ok: false, undoable: true, message: "该牌没有弃牌角标奖励" };
        completeCurrentActionEffect(workingRoot, "skipped");
        renderStateReadout();
        return effect.result;
      }

      const beforePlayer = structuredClone(currentPlayer);
      beginEffectHistoryStep(workingRoot, effect.label);
      const dataResults = [];
      if (reward.kind === "resource") {
        if (reward.gain && Object.keys(reward.gain).length) {
          players.gainResources(currentPlayer, reward.gain);
          addScoreSourceFromGain(currentPlayer, SCORE_SOURCE_KEYS.INDUSTRY_EFFECT, reward.gain);
        }
        const dataCount = Math.max(0, Math.round(Number(reward.dataCount) || 0));
        for (let index = 0; index < dataCount; index += 1) {
          const gainResult = data.gainData(currentPlayer, { source: "industry_sentinel" });
          dataResults.push(gainResult);
          recordHistoryCommand(workingRoot, historyCommands.createGainDataCommand(currentPlayer, gainResult));
        }
      } else if (reward.kind === "move" && reward.gain && Object.keys(reward.gain).length) {
        players.gainResources(currentPlayer, reward.gain);
        addScoreSourceFromGain(currentPlayer, SCORE_SOURCE_KEYS.INDUSTRY_EFFECT, reward.gain);
      }

      if (reward.kind === "move") {
        insertActionEffectsAfterCurrent([{
          id: `${effect.id || "sentinel-corner"}-move`,
          type: cardEffects.EFFECT_TYPES.CARD_MOVE,
          label: `${cards.getCardLabel(playedCard)}：${reward.label}`,
          icon: "movement",
          options: {
            movementPoints: reward.movementPoints || 1,
            historyLabel: reward.label,
          },
        }]);
      }

      recordHistoryCommand(workingRoot, historyCommands.createRestorePlayerCommand(
        currentPlayer,
        beforePlayer,
        "恢复哨兵弃牌角标结算前玩家状态",
      ));

      const rewardText = reward.kind === "resource"
        ? formatCardCornerRewardMessage(reward, dataResults)
        : `${formatPlanetRewardGain(reward.gain || {})}${reward.gain?.score ? "，" : ""}${reward.label}`;

      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：${rewardText}`,
        payload: { playedCard, reward, dataResults },
      });
    }

    function createCompanyCardSummary(workingRoot, companyCard, player) {
      const { rocketState, turnState } = requireWorkingRoot(workingRoot);
      const wrap = document.createElement("div");
      wrap.className = "company-card-summary";
      wrap.append(createInitialSelectionImage(companyCard, "summary"));
      attachCardHoverPreview(wrap, companyCard?.src, companyCard?.label || "公司牌");

      const layout = industry?.getIndustryActionMarkerLayout?.(companyCard);
      if (layout && player) {
        const companyLabel = companyCard.label || "公司牌";
        const marked = industry?.isIndustryActionMarkedThisRound?.(
          player,
          turnState.roundNumber,
          turnState.turnNumber,
        );
        const markerCheck = !marked && !isInitialIncomeFlowActive()
          ? industry?.canMarkIndustryAction?.(player, turnState.roundNumber, {
            turnNumber: turnState.turnNumber,
            hasMarker: true,
            industryCard: companyCard,
          })
          : {
            ok: false,
            message: marked ? "本轮已使用过公司 1x 行动标记" : "请先完成初始收入增加",
          };
        const canMark = Boolean(markerCheck?.ok);
        const abilityPreview = canMark
          ? industry?.buildActiveAbilityFlow?.(
            player,
            companyLabel,
            turnState.roundNumber,
            turnState.turnNumber,
          )
          : null;
        const canUseAction = canMark && Boolean(abilityPreview?.ok);

        if (!marked && canUseAction) {
          wrap.classList.add("is-action-marker-pending");
        }

        if (marked) {
          const usedHitArea = document.createElement("button");
          usedHitArea.type = "button";
          usedHitArea.className = "company-action-marker-hit company-action-marker-hit--used";
          if (companyLabel === "未来跨度研究所") {
            usedHitArea.classList.add("company-action-marker-hit--future-span");
          }
          usedHitArea.dataset.companyLabel = companyCard.label || "";
          usedHitArea.setAttribute("aria-label", `公司 1x 行动标记已使用：${companyLabel}`);
          usedHitArea.title = "本轮已使用过公司 1x 行动标记";
          usedHitArea.style.left = `${layout.percentX}%`;
          usedHitArea.style.top = `${layout.percentY}%`;
          usedHitArea.style.setProperty("--company-action-radius", `${layout.radiusPercent}%`);
          usedHitArea.addEventListener("click", () => {
            rocketState.statusNote = "本轮已使用过公司 1x 行动标记";
            renderStateReadout();
          });

          const token = document.createElement("img");
          token.className = "company-action-marker-token";
          token.src = getNormalTokenAssetForPlayer(player);
          token.alt = "";
          token.decoding = "async";
          token.setAttribute("aria-hidden", "true");
          token.style.left = `${layout.percentX}%`;
          token.style.top = `${layout.percentY}%`;
          token.style.setProperty("--company-action-radius", `${layout.radiusPercent}%`);
          wrap.append(usedHitArea);
          wrap.append(token);
        } else {
          const hitArea = document.createElement("button");
          hitArea.type = "button";
          hitArea.className = "company-action-marker-hit";
          if (companyLabel === "未来跨度研究所") {
            hitArea.classList.add("company-action-marker-hit--future-span");
          }
          hitArea.dataset.companyLabel = companyCard.label || "";
          hitArea.disabled = isInitialIncomeFlowActive();
          const disabledReason = markerCheck?.message
            || abilityPreview?.message
            || "公司 1x 行动标记不可用";
          hitArea.setAttribute(
            "aria-label",
            canUseAction
              ? `放置公司 1x 行动标记：${companyCard.label || "公司牌"}`
              : `公司 1x 行动标记不可用：${companyCard.label || "公司牌"}，${disabledReason}`,
          );
          hitArea.title = canUseAction
            ? "点击在 1x 区域放置行动标记（每轮一次，可撤销）"
            : disabledReason;
          hitArea.style.left = `${layout.percentX}%`;
          hitArea.style.top = `${layout.percentY}%`;
          hitArea.style.setProperty("--company-action-radius", `${layout.radiusPercent}%`);
          if (!isInitialIncomeFlowActive()) {
            hitArea.addEventListener("click", () => {
              handleCompanyActionMarkerClick(workingRoot, companyCard);
            });
          }
          wrap.append(hitArea);
        }
      }

      if (player && industry?.shouldShowStrategyPassiveMarkers?.(player)) {
        industry.mountStrategyPassiveLayer(wrap, player, {
          getPlayerTokenAsset: getNormalTokenAssetForPlayer,
        });
      }

      if (player && industry?.shouldShowHeliosPassiveMarkers?.(player)) {
        industry.mountHeliosPassiveLayer(wrap, player, {
          getPlayerTokenAsset: getNormalTokenAssetForPlayer,
        });
      }

      if (player && companyCard?.label === "图灵系统") {
        industry.mountTuringBorrowLayer?.(wrap, player, {
          turnState,
          roundNumber: turnState.roundNumber,
          turnNumber: turnState.turnNumber,
        });
      }

      if (player && industry?.shouldShowAlienLabPanels?.(player)) {
        industry.mountAlienLabLayer(wrap, player, {
          onPanelClick: (panelId) => handleAlienLabPanelClick(workingRoot, panelId),
        });
      }

      if (player && industry?.shouldShowFutureSpanPanel?.(player)) {
        const futureCheck = canBeginIndustryFutureSpanHandSelection(workingRoot, player);
        industry.mountFutureSpanLayer(wrap, player, {
          tokenEnabled: futureCheck.ok,
          tokenTitle: futureCheck.ok ? "点击扣下一张手牌并设置目标分" : futureCheck.message,
          cardSelectable: isPlayCardSelectionActive() || canStartMainAction(),
          cardSelected: getPendingPlayCardSelection()?.source === "future_span",
          onTokenClick: () => beginIndustryFutureSpanHandSelection(workingRoot),
          onCardClick: () => handleFutureSpanPlayCardSelect(),
        });
      }

      return wrap;
    }

    function executeIndustryHeliosPassiveRewardEffect(workingRoot, effect) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      const player = getWorkingEffectOwnerPlayer(workingRoot, effect);
      const slotId = effect.options?.slotId;
      if (!player || !slotId) {
        rocketState.statusNote = "赫利昂联合体：无效奖励";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const check = industry?.canPlaceHeliosPassiveSlot?.(player, slotId);
      if (!check?.ok) {
        effect.result = { ok: false, undoable: true, message: check?.message || "无法领取奖励" };
        completeCurrentActionEffect(workingRoot, "skipped");
        renderStateReadout();
        return effect.result;
      }

      const slotLabel = industry.getHeliosPassiveSlotLabel?.(slotId) || slotId;
      const reward = industry.getHeliosSlotReward?.(slotId);
      const rewardLabel = industry.getHeliosSlotRewardLabel?.(slotId) || "";
      const beforePlayer = structuredClone(player);

      beginEffectHistoryStep(workingRoot, effect.label);
      const placeResult = industry.placeHeliosPassiveSlot(player, slotId);
      if (!placeResult?.ok) {
        endEffectHistoryStep(workingRoot);
        rocketState.statusNote = placeResult?.message || "无法放置标记";
        renderStateReadout();
        return placeResult;
      }

      const dataResults = [];
      if (reward?.energy || reward?.additionalPublicScan) {
        players.gainResources(player, {
          energy: reward.energy || 0,
          additionalPublicScan: reward.additionalPublicScan || 0,
        });
      }
      if (reward?.data) {
        const gainResult = data.gainData(player, { source: "industry_helios_passive" });
        dataResults.push(gainResult);
        recordHistoryCommand(workingRoot, historyCommands.createGainDataCommand(player, gainResult));
      }

      recordHistoryCommand(workingRoot, historyCommands.createRestorePlayerCommand(
        player,
        beforePlayer,
        `撤销赫利昂联合体：${slotLabel}奖励`,
      ));

      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：+${rewardLabel}`,
        payload: { slotId, reward, dataResults },
      }, [renderInitialSelectionArea]);
    }

    function setStrategyPassiveRewardSlot(effect, slotId) {
      if (!effect || !slotId) return effect;
      const slotLabel = industry.getStrategyPassiveSlotLabel?.(slotId) || slotId;
      effect.options = {
        ...(effect.options || {}),
        slotId,
        needsSlotChoice: false,
        rewardLabel: industry.getStrategySlotRewardLabel?.(slotId) || "",
      };
      effect.label = `宇宙战略集团：${slotLabel}奖励槽`;
      effect.icon = getStrategyPassiveRewardIcon(slotId);
      return effect;
    }

    function getStrategyPassiveSelectableSlotIds(workingRoot, effect, player) {
      const { turnState } = requireWorkingRoot(workingRoot);
      const listedSlotIds = Array.isArray(effect?.options?.eligibleSlotIds)
        ? effect.options.eligibleSlotIds
        : [];
      const currentSlotIds = industry?.getStrategyPlayEligibleSlotIds?.(player, turnState.roundNumber) || [];
      const currentSet = new Set(currentSlotIds);
      const candidateSlotIds = listedSlotIds.length ? listedSlotIds : currentSlotIds;
      return candidateSlotIds.filter((slotId, index, list) => (
        slotId
        && list.indexOf(slotId) === index
        && currentSet.has(slotId)
        && industry?.canInteractStrategyPlaySlot?.(player, slotId, turnState.roundNumber)?.ok
      ));
    }

    function closeStrategyPassiveSlotChoicePicker(workingRoot) {
      delete requireWorkingRoot(workingRoot).match.strategySlotContinuation;
      if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
      if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
      renderActionEffectBar();
      updateActionButtons();
      renderStateReadout();
    }

    function cancelStrategyPassiveSlotChoice(workingRoot) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      if (!getStrategySlotDecision(workingRoot)) return;
      delete workingRoot.match.strategySlotContinuation;
      if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
      if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
      rocketState.statusNote = "宇宙战略集团：已取消奖励槽选择，可重新点击效果或跳过";
      renderActionEffectBar();
      updateActionButtons();
      renderStateReadout();
    }

    function openStrategyPassiveSlotChoice(workingRoot, effect, player, slotIds) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      if (!els.scanTargetOverlay || !els.scanTargetActions) {
        rocketState.statusNote = "宇宙战略集团：无法打开奖励槽选择";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      workingRoot.match.strategySlotContinuation = {
        effectId: effect.id,
        slotIds: [...slotIds],
        playerId: player?.id || null,
      };
      if (els.scanTargetTitle) els.scanTargetTitle.textContent = "宇宙战略集团";
      if (els.scanTargetSubtitle) {
        els.scanTargetSubtitle.textContent = "黑色扫描角标可选择一个空奖励槽触发。";
      }
      if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
      els.scanTargetActions.replaceChildren(...slotIds.map((slotId) => {
        const slotLabel = industry.getStrategyPassiveSlotLabel?.(slotId) || slotId;
        const rewardLabel = industry.getStrategySlotRewardLabel?.(slotId) || "";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "scan-target-option-button";
        button.dataset.strategySlotChoice = slotId;
        button.innerHTML = `${slotLabel}奖励槽<small>${rewardLabel}</small>`;
        return button;
      }));
      els.scanTargetOverlay.hidden = false;
      rocketState.statusNote = "宇宙战略集团：请选择奖励槽";
      renderActionEffectBar();
      updateActionButtons();
      renderStateReadout();
      return { ok: true, pendingChoice: true, undoable: true, message: rocketState.statusNote };
    }

    function confirmStrategyPassiveSlotChoice(workingRoot, slotId) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      const pending = getStrategySlotDecision(workingRoot);
      const effect = getCurrentActionEffect(workingRoot);
      if (!pending || !effect || effect.id !== pending.effectId || effect.type !== "industry_strategy_passive_reward") {
        cancelStrategyPassiveSlotChoice(workingRoot);
        return { ok: false, message: "没有待选择的宇宙战略集团奖励槽" };
      }
      if (!pending.slotIds.includes(slotId)) {
        rocketState.statusNote = "宇宙战略集团：该奖励槽不可选";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      closeStrategyPassiveSlotChoicePicker(workingRoot);
      setStrategyPassiveRewardSlot(effect, slotId);
      return executeIndustryStrategyPassiveRewardEffect(workingRoot, effect);
    }

    function finishIndustryStrategyPassiveRewardEffect(workingRoot, effect, options = {}) {
      const { rocketState, turnState } = requireWorkingRoot(workingRoot);
      const player = getWorkingEffectOwnerPlayer(workingRoot, effect);
      const slotId = effect.options?.slotId;
      if (!player || !slotId) {
        rocketState.statusNote = "宇宙战略集团：无效奖励槽";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const check = industry?.canInteractStrategyPlaySlot?.(player, slotId, turnState.roundNumber);
      if (!check?.ok) {
        industry?.clearStrategyPlayInteraction?.(player);
        effect.result = {
          ok: true,
          skipped: true,
          undoable: true,
          message: check?.message || "无法领取奖励",
        };
        completeCurrentActionEffect(workingRoot, "skipped");
        renderInitialSelectionArea();
        renderStateReadout();
        return effect.result;
      }

      const slotLabel = industry.getStrategyPassiveSlotLabel?.(slotId) || slotId;
      const reward = industry.getStrategySlotReward?.(slotId);
      const rewardLabel = industry.getStrategySlotRewardLabel?.(slotId) || "";
      const beforePlayer = options.beforePlayerState || structuredClone(player);

      if (!uiRuntimeState.effectStepActive) beginEffectHistoryStep(workingRoot, effect.label);
      if (!options.restoreRecorded) {
        recordHistoryCommand(workingRoot, historyCommands.createRestorePlayerCommand(
          player,
          beforePlayer,
          `撤销宇宙战略集团：${slotLabel}奖励槽`,
        ));
      }

      const placeResult = industry.placeStrategyPassiveSlot(player, slotId);
      if (!placeResult?.ok) {
        endEffectHistoryStep(workingRoot);
        rocketState.statusNote = placeResult?.message || "无法放置被动标记";
        renderStateReadout();
        return placeResult;
      }

      industry.completeStrategyPlayInteraction(player);
      const dataResults = [];
      if (reward?.credits || reward?.publicity) {
        players.gainResources(player, {
          credits: reward.credits || 0,
          publicity: reward.publicity || 0,
        });
      }
      if (reward?.data && !options.skipDataGain) {
        const gainResult = data.gainData(player, { source: "industry_strategy_passive" });
        dataResults.push(gainResult);
        if (!options.restoreRecorded) {
          recordHistoryCommand(workingRoot, historyCommands.createGainDataCommand(player, gainResult));
        }
      }

      const skippedText = reward?.data && options.skipDataGain ? "（数据池已满，未获得数据）" : "";
      const placementText = options.placementMessages?.length
        ? `；${options.placementMessages.join("；")}`
        : "";
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：+${rewardLabel}${skippedText}${placementText}`,
        payload: { slotId, reward, dataResults, skippedDataGain: Boolean(options.skipDataGain) },
      }, [renderInitialSelectionArea]);
    }

    function executeIndustryStrategyPassiveRewardEffect(workingRoot, effect) {
      requireWorkingRoot(workingRoot);
      const player = getWorkingEffectOwnerPlayer(workingRoot, effect);
      let slotId = effect.options?.slotId;
      if (!slotId) {
        const slotIds = getStrategyPassiveSelectableSlotIds(workingRoot, effect, player);
        if (slotIds.length > 1) {
          return openStrategyPassiveSlotChoice(workingRoot, effect, player, slotIds);
        }
        if (slotIds.length === 1) {
          slotId = slotIds[0];
          setStrategyPassiveRewardSlot(effect, slotId);
        }
      }
      const reward = industry?.getStrategySlotReward?.(slotId);
      if (reward?.data && isDataPoolFull(player)) {
        const placeCheck = getAutoDataPlacementCheck(player);
        if (placeCheck.ok) {
          return openAutoDataPlacementPrompt(effect, player, {
            statusNote: "宇宙战略集团：数据池已满，请先放置数据或跳过这次数据获得",
            skipDescription: "仍放置宇宙战略集团 token，但不获得这 1 个数据",
            resumeKind: "industry-strategy-passive",
          });
        }
        return finishIndustryStrategyPassiveRewardEffect(workingRoot, effect, { skipDataGain: true });
      }
      return finishIndustryStrategyPassiveRewardEffect(workingRoot, effect);
    }

    function handleStrategyPassiveSlotClick(workingRoot, slotId) {
      const { rocketState, turnState } = requireWorkingRoot(workingRoot);
      if (getGameplayLockReason()) return;

      const player = getWorkingCurrentPlayer(workingRoot);
      const check = industry?.canInteractStrategyPlaySlot?.(player, slotId, turnState.roundNumber);
      if (!check?.ok) {
        rocketState.statusNote = check?.message || "无法放置被动标记";
        renderStateReadout();
        return;
      }

      const slotLabel = industry.getStrategyPassiveSlotLabel?.(slotId) || slotId;
      const reward = industry.getStrategySlotReward?.(slotId);
      const rewardLabel = industry.getStrategySlotRewardLabel?.(slotId) || "";
      const beforePlayer = structuredClone(player);

      beginQuickActionStep("strategy-passive-mark", `宇宙战略集团：${slotLabel}奖励槽`);
      const placeResult = industry.placeStrategyPassiveSlot(player, slotId);
      if (!placeResult?.ok) {
        quickActionHistory.undoLastStep();
        if (!quickActionHistory.hasUndoableStep()) {
          quickActionHistory.commitSession();
          clearHistoryStepOrderForSource(HISTORY_SOURCE_QUICK);
        }
        rocketState.statusNote = placeResult?.message || "无法放置被动标记";
        renderStateReadout();
        return;
      }

      industry.completeStrategyPlayInteraction(player);
      const dataResults = [];
      if (reward?.credits || reward?.publicity) {
        players.gainResources(player, {
          credits: reward.credits || 0,
          publicity: reward.publicity || 0,
        });
      }
      if (reward?.data) {
        const gainResult = data.gainData(player, { source: "industry_strategy_passive" });
        dataResults.push(gainResult);
      }

      recordQuickHistoryCommand(historyCommands.createRestorePlayerCommand(
        player,
        beforePlayer,
        `撤销宇宙战略集团：${slotLabel}奖励槽`,
      ));
      for (const gainResult of dataResults) {
        if (gainResult?.ok) {
          recordQuickHistoryCommand(historyCommands.createGainDataCommand(player, gainResult));
        }
      }
      completeQuickActionStep();

      rocketState.statusNote = `宇宙战略集团：${slotLabel}奖励槽 +${rewardLabel}`;
      renderInitialSelectionArea();
      renderPlayerStats();
      renderStateReadout();
    }

    function handleCompanyActionMarkerClick(workingRoot, companyCard) {
      const { rocketState: actionRocketState, turnState: actionTurnState } = requireWorkingRoot(workingRoot);
      const gameplayLockReason = null;
      if (gameplayLockReason) {
        actionRocketState.statusNote = gameplayLockReason;
        renderStateReadout();
        return { ok: false, message: gameplayLockReason };
      }

      const player = getWorkingCurrentPlayer(workingRoot);
      const layout = industry?.getIndustryActionMarkerLayout?.(companyCard);
      const check = industry?.canMarkIndustryAction?.(player, actionTurnState.roundNumber, {
        turnNumber: actionTurnState.turnNumber,
        hasMarker: Boolean(layout),
        industryCard: companyCard,
      });
      if (!check?.ok) {
        actionRocketState.statusNote = check?.message || "无法放置公司行动标记";
        renderStateReadout();
        return { ok: false, message: actionRocketState.statusNote };
      }

      const companyLabel = companyCard.label || "公司牌";
      const beforeIndustryPlayer = structuredClone(player);
      const abilityFlow = industry.buildActiveAbilityFlow(
        player,
        companyLabel,
        actionTurnState.roundNumber,
        actionTurnState.turnNumber,
      );
      if (!abilityFlow?.ok) {
        restoreObjectSnapshot(player, beforeIndustryPlayer);
        if (abilityFlow?.message && industry.hasImplementedActiveAbility?.(companyCard)) {
          actionRocketState.statusNote = abilityFlow.message;
        } else {
          actionRocketState.statusNote = "该公司 1x 行动暂未处理";
        }
        renderStateReadout();
        return { ok: false, message: actionRocketState.statusNote };
      }

      if (abilityFlow.flowType === "stratus_public_corners"
        || abilityFlow.flowType === "huanyu_free_moves"
        || abilityFlow.flowType === "fundamentalism_score_exchange"
        || abilityFlow.flowType === "pirates_raid_launch") {
        beginQuickActionStep("industry-mark", `公司行动标记：${companyLabel}`);
        const result = industry.markIndustryAction(player, actionTurnState.roundNumber, {
          turnNumber: actionTurnState.turnNumber,
        });
        if (!result.ok) {
          restoreObjectSnapshot(player, beforeIndustryPlayer);
          quickActionHistory.undoLastStep();
          if (!quickActionHistory.hasUndoableStep()) {
            quickActionHistory.commitSession();
            clearHistoryStepOrderForSource(HISTORY_SOURCE_QUICK);
          }
          actionRocketState.statusNote = result.message;
          renderStateReadout();
          return result;
        }

        recordIndustryActionRestoreCommand(workingRoot, player, beforeIndustryPlayer, companyLabel);
        completeQuickActionStep();
        const started = startIndustryAbilityFlow(workingRoot, abilityFlow);
        if (!started) {
          const undoResult = quickActionHistory.undoLastStep();
          if (undoResult.ok) {
            forgetLastHistoryStep(HISTORY_SOURCE_QUICK, undoResult.step?.id || null);
            removeLastActionLogStep(HISTORY_SOURCE_QUICK, undoResult.step?.id || null);
          }
          if (undoResult.ok && !quickActionHistory.hasUndoableStep()) {
            quickActionHistory.commitSession();
            clearHistoryStepOrderForSource(HISTORY_SOURCE_QUICK);
          }
        } else {
          actionRocketState.statusNote = abilityFlow.message || actionRocketState.statusNote;
        }
        renderInitialSelectionArea();
        renderStateReadout();
        return { ok: true, progressed: true, flow: abilityFlow, message: actionRocketState.statusNote };
      }

      beginQuickActionStep("industry-mark", `公司行动标记：${companyLabel}`);
      const result = industry.markIndustryAction(player, actionTurnState.roundNumber, {
        turnNumber: actionTurnState.turnNumber,
      });
      if (!result.ok) {
        restoreObjectSnapshot(player, beforeIndustryPlayer);
        quickActionHistory.undoLastStep();
        if (!quickActionHistory.hasUndoableStep()) {
          quickActionHistory.commitSession();
          clearHistoryStepOrderForSource(HISTORY_SOURCE_QUICK);
        }
        actionRocketState.statusNote = result.message;
        renderStateReadout();
        return result;
      }

      recordIndustryActionRestoreCommand(workingRoot, player, beforeIndustryPlayer, companyLabel);

      const started = startIndustryAbilityFlow(workingRoot, abilityFlow);
      if (!started) {
        const undoResult = quickActionHistory.undoLastStep();
        if (undoResult.ok) {
          forgetLastHistoryStep(HISTORY_SOURCE_QUICK, undoResult.step?.id || null);
          removeLastActionLogStep(HISTORY_SOURCE_QUICK, undoResult.step?.id || null);
        }
        if (undoResult.ok && !quickActionHistory.hasUndoableStep()) {
          quickActionHistory.commitSession();
          clearHistoryStepOrderForSource(HISTORY_SOURCE_QUICK);
        }
      }
      if (started) {
        actionRocketState.statusNote = abilityFlow.message || actionRocketState.statusNote;
      }
      renderInitialSelectionArea();
      renderStateReadout();
      return { ok: true, progressed: true, flow: abilityFlow, message: actionRocketState.statusNote };
    }


    return {
      isIndustryHandSelectionActive,
      isIndustryFutureSpanHandSelectionActive,
      isIndustryFreeMoveActive,
      createIndustryActionRestoreCommand,
      recordIndustryActionRestoreCommand,
      clearIndustryRollbackUi,
      rollbackPendingIndustryQuickAction,
      cancelIndustryAbilityFlow,
      finishIndustryAbilityFlow,
      startIndustryAbilityFlow,
      startIndustryStratusEffectFlow,
      startIndustryFundamentalismExchangeFlow,
      startIndustryPublicityPick,
      beginIndustryTuringBorrow,
      failIndustryTuringBorrow,
      checkIndustryTuringBorrowTile,
      confirmIndustryTuringBorrow,
      openIndustryHeliosTechPicker,
      confirmIndustryHeliosRemoveTech,
      startIndustryHuanyuMoveEffectFlow,
      beginIndustryHuanyuFreeMoves,
      executeIndustryFreeMove,
      canBeginIndustryFutureSpanHandSelection,
      beginIndustryFutureSpanHandSelection,
      handleIndustryFutureSpanHandClick,
      handleIndustryDeepspaceHandClick,
      finalizeIndustryDeepspaceSwap,
      handleAlienLabPanelClick,
      createAlienLabRestoreCommand,
      maybeConsumeAlienLabPanelForMainAction,
      maybeRestoreAlienLabPanelForTrace,
      maybeApplyIndustryLaunchScan,
      startLaunchSectorFinishEffectFlow,
      appendIndustryPlayPassiveStatus,
      getStrategyPassiveRewardIcon,
      snapshotStrategyPlayedCard,
      buildStrategyPlayPassiveEffectNodes,
      buildIndustryPlayCardAppendEffects,
      buildPlayCardEffectFlowQueue,
      applyIndustryPlayCardPassives,
      isIndustryIrreversibleFlow,
      completeIndustryAbilityQuickStep,
      commitIrreversibleIndustryQuickAction,
      appendSentinelPlayCornerEffectsToFlow,
      tryInjectSentinelPlayCornerEffectAfterArm,
      createIndustryCardCornerEvent,
      executeIndustryStratusCornerEffect,
      executeIndustrySentinelCornerEffect,
      createCompanyCardSummary,
      executeIndustryHeliosPassiveRewardEffect,
      setStrategyPassiveRewardSlot,
      getStrategyPassiveSelectableSlotIds,
      closeStrategyPassiveSlotChoicePicker,
      cancelStrategyPassiveSlotChoice,
      openStrategyPassiveSlotChoice,
      confirmStrategyPassiveSlotChoice,
      finishIndustryStrategyPassiveRewardEffect,
      executeIndustryStrategyPassiveRewardEffect,
      handleStrategyPassiveSlotClick,
      handleCompanyActionMarkerClick
    };
  }

  return {
    BROWSER_STATIC_DEPENDENCY_KEYS,
    createBrowserIndustryRuntime,
    createBrowserIndustryStaticContext,
    createIndustryRuntime,
    createIndustryStartupRuntime,
  };
});
