(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppIndustryRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  "use strict";

  function createIndustryRuntime(context = {}) {
    const {
      Array,
      Boolean,
      HISTORY_SOURCE_MAIN,
      HISTORY_SOURCE_QUICK,
      INDUSTRY_TURING_BORROW_TECH_TYPES,
      Math,
      Number,
      Object,
      SCORE_SOURCE_KEYS,
      Set,
      String,
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
      cardState,
      cards,
      canStartMainAction,
      clearActionEffectFlow,
      clearHistoryStepOrderForSource,
      completeCurrentActionEffect,
      completeQuickActionStep,
      createActionContext,
      decisionSessions,
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
      getCurrentPlayer,
      getEarthSectorCoordinate,
      getEffectOwnerPlayer,
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
      rocketState,
      selectDefaultRocketForCurrentPlayer,
      startCardEffectFlow,
      startIndustryPiratesRaidLaunchFlow,
      startPendingActionSession,
      structuredClone,
      syncCardSelectionChrome,
      syncDiscardSelectionChrome,
      syncIndustryHandSelectionChrome,
      syncInteractionFocusChrome,
      syncTechSelectionChrome,
      tech,
      techGameState,
      turnState,
      uiRuntimeState,
      updateActionButtons
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
    const STRATEGY_SLOT_DECISION = "strategy_passive_slot";
    const getStrategySlotDecision = () => decisionSessions.peek(STRATEGY_SLOT_DECISION);
    const industryAbilitySession = {
      get value() { return decisionSessions.peek("industry_ability"); },
      set value(session) {
        if (session == null) decisionSessions.clear("industry_ability");
        else decisionSessions.open("industry_ability", session);
      },
    };

    function isIndustryHandSelectionActive() {
      return decisionState.cardSelectionAction?.type === "industry_deepspace_hand"
        || decisionState.cardSelectionAction?.type === "industry_future_hand";
    }

    function isIndustryFutureSpanHandSelectionActive() {
      return decisionState.cardSelectionAction?.type === "industry_future_hand";
    }

    function isIndustryFreeMoveActive() {
      return Boolean(uiRuntimeState.industryFreeMoveState);
    }

    function createIndustryActionRestoreCommand(player, beforePlayer, companyLabel, options = {}) {
      if (!player || !beforePlayer) return null;
      return {
        label: `撤销公司 1x：${companyLabel || "公司牌"}`,
        describe: `恢复${companyLabel || "公司牌"} 1x 行动前状态`,
        undo() {
          cancelIndustryAbilityFlow({ silent: true });
          if (options.clearEffectFlow) {
            clearActionEffectFlow();
          }
          restoreObjectSnapshot(player, beforePlayer);
          renderInitialSelectionArea();
        },
      };
    }

    function recordIndustryActionRestoreCommand(player, beforePlayer, companyLabel) {
      const command = createIndustryActionRestoreCommand(player, beforePlayer, companyLabel);
      if (command) recordQuickHistoryCommand(command);
    }

    function clearIndustryRollbackUi() {
      if (decisionState.scanTargetAction?.type === "industry_remove_tech") {
        decisionState.scanTargetAction = null;
        if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
        if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
      }
      if (decisionState.discardAction?.type === "industry_helios_income") {
        decisionState.discardAction = null;
        cards.setDiscardSelectionActive(cardState, false, 0);
        syncDiscardSelectionChrome();
      }
      if (decisionState.cardSelectionAction?.type?.startsWith?.("industry_")) {
        decisionState.cardSelectionAction = null;
        cards.setSelectionActive(cardState, false);
        syncCardSelectionChrome();
      }
      if (techGameState?.ui?.industryBorrowMode) {
        techGameState.ui.industryBorrowMode = false;
        tech.setTechSelectionActive(techGameState, false);
        syncTechSelectionChrome();
      }
      if (uiRuntimeState.moveHighlightRocketId != null || uiRuntimeState.industryFreeMoveState) {
        deactivateMoveMode();
      }
      industryAbilitySession.value = null;
      uiRuntimeState.industryFreeMoveState = null;
      syncIndustryHandSelectionChrome();
      syncInteractionFocusChrome();
    }

    function rollbackPendingIndustryQuickAction(message = "已取消公司 1x 行动") {
      const result = quickActionHistory.hasSession()
        ? quickActionHistory.undoLastStep()
        : { ok: false, message: "没有可撤销的公司 1x 行动" };
      if (result.ok) {
        uiRuntimeState.effectStepActive = false;
        forgetLastHistoryStep(HISTORY_SOURCE_QUICK, result.step?.id || null);
        removeLastActionLogStep(HISTORY_SOURCE_QUICK, result.step?.id || null);
      }
      clearIndustryRollbackUi();
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

    function cancelIndustryAbilityFlow(options = {}) {
      if (techGameState?.ui?.industryBorrowMode) {
        techGameState.ui.industryBorrowMode = false;
        tech.setTechSelectionActive(techGameState, false);
        syncTechSelectionChrome();
      }
      if (decisionState.cardSelectionAction?.type?.startsWith?.("industry_")) {
        if (decisionState.cardSelectionAction.refundCost && decisionState.cardSelectionAction.player) {
          players.gainResources(decisionState.cardSelectionAction.player, decisionState.cardSelectionAction.refundCost);
        }
        decisionState.cardSelectionAction = null;
        cards.setSelectionActive(cardState, false);
        syncCardSelectionChrome();
      }
      industryAbilitySession.value = null;
      uiRuntimeState.industryFreeMoveState = null;
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

    function finishIndustryAbilityFlow(message) {
      const flowType = industryAbilitySession.value?.flowType;
      industryAbilitySession.value = null;
      uiRuntimeState.industryFreeMoveState = null;
      cards.setSelectionActive(cardState, false);
      decisionState.cardSelectionAction = null;
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
        completeIndustryAbilityQuickStep(message || rocketState.statusNote || null);
      }
    }

    function startIndustryAbilityFlow(flow, options = {}) {
      if (!flow?.ok) {
        rocketState.statusNote = flow?.message || "公司 1x 行动无法启动";
        renderStateReadout();
        return false;
      }

      industryAbilitySession.value = { ...flow };
      switch (flow.flowType) {
        case "stratus_public_corners":
          return startIndustryStratusEffectFlow(flow, options);
        case "turing_borrow_tech":
          return beginIndustryTuringBorrow(flow);
        case "sentinel_arm_play_corner": {
          const injected = tryInjectSentinelPlayCornerEffectAfterArm();
          finishIndustryAbilityFlow(injected
            ? `${flow.message}；已加入打牌效果队列`
            : flow.message);
          return true;
        }
        case "huanyu_free_moves":
          return startIndustryHuanyuMoveEffectFlow(flow, options);
        case "fundamentalism_score_exchange":
          return startIndustryFundamentalismExchangeFlow(flow, options);
        case "pirates_raid_launch":
          return startIndustryPiratesRaidLaunchFlow(flow, options);
        case "helios_remove_tech":
          return openIndustryHeliosTechPicker(flow);
        case "mission_publicity_pick":
          return startIndustryPublicityPick(flow, "industry_mission_pick");
        case "fenwick_publicity_pick":
          return startIndustryPublicityPick(flow, "industry_fenwick_pick");
        case "deepspace_swap":
          decisionState.cardSelectionAction = {
            type: "industry_deepspace_hand",
            player: getCurrentPlayer(),
            allowBlindDraw: false,
          };
          rocketState.statusNote = flow.message;
          syncIndustryHandSelectionChrome();
          renderStateReadout();
          return true;
        case "future_span_pick":
          beginCardSelection({
            type: "industry_future_pick",
            player: getCurrentPlayer(),
            allowBlindDraw: false,
            advanceAmount: flow.advanceAmount,
          });
          rocketState.statusNote = flow.message;
          renderStateReadout();
          return true;
        case "strategy_pick":
          beginCardSelection({
            type: "industry_strategy_pick",
            player: getCurrentPlayer(),
            allowBlindDraw: false,
          });
          rocketState.statusNote = flow.message;
          renderStateReadout();
          return true;
        default:
          cancelIndustryAbilityFlow({ silent: true });
          rocketState.statusNote = flow.message || "未实现的公司 1x 行动";
          renderStateReadout();
          return false;
      }
    }

    function startIndustryStratusEffectFlow(flow, options = {}) {
      const nodes = industry?.buildStratusPublicCornerEffectNodes?.(cards, cardState.publicCards) || [];
      industryAbilitySession.value = null;
      decisionState.cardSelectionAction = null;
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

    function startIndustryFundamentalismExchangeFlow(flow, options = {}) {
      const groupId = `industry-fundamentalism-${turnState.roundNumber}-${turnState.turnNumber}`;
      const nodes = industry?.buildFundamentalismScoreExchangeEffectNodes?.({
        label: flow.label || "原教旨主义",
        count: flow.exchangeCount ?? industry?.FUNDAMENTALISM_EXCHANGE_COUNT ?? 3,
        groupId,
      }) || [];
      industryAbilitySession.value = null;
      decisionState.cardSelectionAction = null;
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

    function startIndustryPublicityPick(flow, pendingType) {
      const player = getCurrentPlayer();
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

    function beginIndustryTuringBorrow(flow) {
      tech.setTechSelectionActive(techGameState, true);
      techGameState.ui.industryBorrowMode = true;
      techGameState.ui.selectedTileId = null;
      techGameState.ui.pendingTileId = null;
      techGameState.ui.allowedTechTypes = [...INDUSTRY_TURING_BORROW_TECH_TYPES];
      techGameState.ui.statusNote = flow.message;
      rocketState.statusNote = flow.message;
      syncTechSelectionChrome();
      renderTechBoard();
      renderStateReadout();
      return true;
    }

    function failIndustryTuringBorrow(message) {
      techGameState.ui.statusNote = message;
      rocketState.statusNote = message;
      renderTechBoard();
      renderStateReadout();
      return { ok: false, message };
    }

    function checkIndustryTuringBorrowTile(tileId) {
      const techType = tech.getTechType?.(tileId) || null;
      if (!INDUSTRY_TURING_BORROW_TECH_TYPES.includes(techType)) {
        return { ok: false, message: "图灵系统只能借用橙色或紫色科技" };
      }

      const player = getCurrentPlayer();
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

    function confirmIndustryTuringBorrow(tileId) {
      const borrowCheck = checkIndustryTuringBorrowTile(tileId);
      if (!borrowCheck.ok) {
        return failIndustryTuringBorrow(borrowCheck.message || "无法借用该科技");
      }

      const player = getCurrentPlayer();
      const beforePlayer = structuredClone(player);
      player.industryBorrowedTechTileId = tileId;
      player.industryBorrowedTechRound = turnState.roundNumber;
      player.industryBorrowedTechTurn = turnState.turnNumber;
      tech.setTechSelectionActive(techGameState, false);
      techGameState.ui.industryBorrowMode = false;
      syncTechSelectionChrome();
      recordQuickHistoryCommand(historyCommands.createRestorePlayerCommand(
        player,
        beforePlayer,
        "恢复图灵借用前玩家状态",
      ));
      finishIndustryAbilityFlow(`图灵系统：当前回合借用 ${tileId} 效果`);
      return { ok: true, tileId };
    }

    function openIndustryHeliosTechPicker(flow) {
      const player = getCurrentPlayer();
      const removable = (tech.playerTech?.listActiveOwnedTileIds?.(player.techState) || [])
        .filter((tileId) => !String(tileId).startsWith("blue"));
      if (!removable.length) {
        finishIndustryAbilityFlow("赫利昂联合体：没有可无效的非蓝色科技");
        return false;
      }
      return openScanTargetPicker({
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

    function confirmIndustryHeliosRemoveTech(tileId) {
      const player = getCurrentPlayer();
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
      renderTechBoard();
      renderInitialSelectionArea();
      industryAbilitySession.value = { flowType: "helios_remove_tech", removedTileId: tileId };
      recordQuickHistoryCommand(historyCommands.createRestorePlayerCommand(
        player,
        beforePlayer,
        "恢复赫利昂无效科技前玩家状态",
      ));
      const incomeStart = beginDiscardSelection(1, {
        type: "industry_helios_income",
        player,
        beforePlayer,
        beforeCardState,
        removedTileId: tileId,
      });
      if (!incomeStart.ok) {
        restoreObjectSnapshot(player, beforePlayer);
        renderTechBoard();
        renderInitialSelectionArea();
        industryAbilitySession.value = null;
        rollbackPendingIndustryQuickAction(incomeStart.message || "赫利昂联合体：收入无法结算，已撤回 1x 行动");
        return { ok: false, message: incomeStart.message || "赫利昂联合体：收入无法结算" };
      }
      rocketState.statusNote = incomeStart.ok
        ? `赫利昂联合体：已无效 ${tileId}，请选择 1 张手牌增加收入`
        : incomeStart.message;
      renderPlayerStats();
      renderStateReadout();
      return removeResult;
    }

    function startIndustryHuanyuMoveEffectFlow(flow, options = {}) {
      const groupId = `industry-huanyu-${turnState.roundNumber}-${turnState.turnNumber}`;
      const nodes = industry?.buildHuanyuFreeMoveEffectNodes?.({
        label: flow.label || "寰宇动力",
        count: flow.movesLeft ?? industry?.HUANYU_FREE_MOVE_COUNT ?? 2,
        groupId,
      }) || [];
      industryAbilitySession.value = null;
      decisionState.cardSelectionAction = null;
      uiRuntimeState.industryFreeMoveState = null;
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
          actionType: "industryHuanyu",
          historySource: HISTORY_SOURCE_QUICK,
          consumesMainAction: false,
          preHistoryCommands,
        },
      );
      if (started) {
        const movableCount = getMovableTokensForPlayer(getCurrentPlayer()?.id).length;
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

    function beginIndustryHuanyuFreeMoves(flow) {
      const player = getCurrentPlayer();
      uiRuntimeState.industryFreeMoveState = {
        movesLeft: flow.movesLeft ?? 2,
        movedRocketIds: [],
        beforePlayer: structuredClone(player),
        label: flow.label || "寰宇动力",
      };
      player.industryHuanyuFreeMovesLeft = uiRuntimeState.industryFreeMoveState.movesLeft;
      player.industryHuanyuFreeMoveTurn = turnState.turnNumber;
      const rocketsForPlayer = getMovableTokensForPlayer(player.id);
      rocketState.statusNote = rocketsForPlayer.length
        ? `${flow.message}（剩余 ${uiRuntimeState.industryFreeMoveState.movesLeft} 次）`
        : `${flow.message}：当前没有可移动火箭`;
      syncInteractionFocusChrome();
      renderRockets();
      if (rocketsForPlayer.length === 1) {
        activateMoveMode(rocketsForPlayer[0].id);
      } else if (rocketsForPlayer.length > 1) {
        selectDefaultRocketForCurrentPlayer();
      } else {
        finishIndustryAbilityFlow(rocketState.statusNote);
        return false;
      }
      renderStateReadout();
      return true;
    }

    function executeIndustryFreeMove(deltaX, deltaY, rocketId, payment = {}) {
      const state = uiRuntimeState.industryFreeMoveState;
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

      const currentPlayer = getCurrentPlayer();
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

      const playerBeforeMove = structuredClone(getCurrentPlayer());
      const freeMoveStateBefore = {
        movesLeft: state.movesLeft,
        movedRocketIds: [...state.movedRocketIds],
        label: state.label,
      };
      const energyCost = Math.max(0, Math.round(Number(payment.energyCost) || 0));
      const result = abilities.executeAbility("moveProbe", createActionContext(), {
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
      const player = getCurrentPlayer();
      player.industryHuanyuMovedRocketIds = [...state.movedRocketIds];
      player.industryHuanyuFreeMovesLeft = Math.max(0, state.movesLeft);
      recordQuickHistoryCommand({
        label: "恢复寰宇免费移动次数",
        undo() {
          if (!uiRuntimeState.industryFreeMoveState) {
            uiRuntimeState.industryFreeMoveState = {
              movesLeft: freeMoveStateBefore.movesLeft,
              movedRocketIds: [...freeMoveStateBefore.movedRocketIds],
              label: freeMoveStateBefore.label,
            };
            industryAbilitySession.value = {
              flowType: "huanyu_free_moves",
              label: freeMoveStateBefore.label,
            };
          } else {
            uiRuntimeState.industryFreeMoveState.movesLeft = freeMoveStateBefore.movesLeft;
            uiRuntimeState.industryFreeMoveState.movedRocketIds = [...freeMoveStateBefore.movedRocketIds];
            uiRuntimeState.industryFreeMoveState.label = freeMoveStateBefore.label;
          }
        },
      });
      if (payment.discardCommand) recordQuickHistoryCommand(payment.discardCommand);
      recordQuickHistoryCommand(historyCommands.createRestorePlayerCommand(
        player,
        playerBeforeMove,
        "恢复公司免费移动前玩家状态",
      ));
      recordAbilityCommands(result, quickActionHistory);

      if (state.movesLeft <= 0) {
        finishIndustryAbilityFlow(`${state.label}：免费移动已完成`);
        return result;
      }

      rocketState.statusNote = `${state.label}：还可免费移动 ${state.movesLeft} 枚火箭`;
      deactivateMoveMode();
      renderRockets();
      renderStateReadout();
      return result;
    }

    function canBeginIndustryFutureSpanHandSelection(player = getCurrentPlayer()) {
      if (!industry?.shouldShowFutureSpanPanel?.(player)) {
        return { ok: false, message: "当前玩家没有未来跨度研究所" };
      }
      const parkCheck = industry.canParkFutureSpanCard?.(player);
      if (!parkCheck?.ok) return { ok: false, message: parkCheck?.message || "未来跨度专属标记不可用" };
      if (isActionEffectFlowActive()
        || isCardSelectionActive()
        || isDiscardSelectionActive()
        || isPlayCardSelectionActive()
        || isTechTilePickingActive()
        || isHandScanSelectionActive()
        || isMovePaymentSelectionActive()
        || industryAbilitySession.value
        || uiRuntimeState.industryFreeMoveState
        || isIndustryHandSelectionActive()) {
        return { ok: false, message: "请先完成或取消当前流程" };
      }
      if (!hasFutureSpanEligibleHandCard(player)) {
        return { ok: false, message: "没有可用的信用点费用手牌" };
      }
      return { ok: true, message: "可以放置未来跨度专属标记" };
    }

    function beginIndustryFutureSpanHandSelection() {
      const player = getCurrentPlayer();
      const check = canBeginIndustryFutureSpanHandSelection(player);
      if (!check.ok) {
        rocketState.statusNote = check.message;
        renderStateReadout();
        return check;
      }
      decisionState.cardSelectionAction = {
        type: "industry_future_hand",
        player,
        allowBlindDraw: false,
      };
      rocketState.statusNote = "未来跨度研究所：选择一张费用为信用点的手牌，扣下并设置目标分";
      syncIndustryHandSelectionChrome();
      renderInitialSelectionArea();
      renderStateReadout();
      return { ok: true, message: rocketState.statusNote };
    }

    function handleIndustryFutureSpanHandClick(handIndex) {
      if (!isIndustryFutureSpanHandSelectionActive()) return;
      const player = getCurrentPlayer();
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

      decisionState.cardSelectionAction = null;
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

    function handleIndustryDeepspaceHandClick(handIndex) {
      if (!isIndustryHandSelectionActive()) return;
      const player = getCurrentPlayer();
      const index = Math.round(handIndex);
      const card = player?.hand?.[index];
      if (!card) {
        rocketState.statusNote = "无效的手牌位置";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      decisionState.cardSelectionAction = {
        type: "industry_deepspace_public",
        player,
        handIndex: index,
        handCard: card,
        allowBlindDraw: false,
      };
      cards.setSelectionActive(cardState, true);
      rocketState.statusNote = `深空探测：已选手牌 ${cards.getCardLabel(card)}，请选择 1 张公共牌交换`;
      syncCardSelectionChrome();
      renderPlayerHand();
      renderPublicCards();
      renderStateReadout();
      return { ok: true, message: rocketState.statusNote };
    }

    function finalizeIndustryDeepspaceSwap(publicSlotIndex) {
      const pending = decisionState.cardSelectionAction;
      const player = pending?.player || getCurrentPlayer();
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

      decisionState.cardSelectionAction = null;
      cards.setSelectionActive(cardState, false);
      syncCardSelectionChrome();
      finishIndustryAbilityFlow(`深空探测：${cards.getCardLabel(handCard)} 与 ${cards.getCardLabel(publicCard)} 已交换`);
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

    function handleAlienLabPanelClick(panelId) {
      const player = getCurrentPlayer();
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

    function maybeConsumeAlienLabPanelForMainAction(actionId, result, player = getCurrentPlayer()) {
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

    function maybeApplyIndustryLaunchScan(result) {
      const player = getCurrentPlayer();
      if (!result?.ok || !industry?.shouldScanEarthOnLaunch?.(player)) return result;
      const earth = getEarthSectorCoordinate();
      const scanResult = abilities.executeAbility("scanSector", createActionContext(), {
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

    function startLaunchSectorFinishEffectFlow(result) {
      if (!result?.ok || !resultHasSignalMarkedEvent(result)) return false;

      const followups = buildReadySectorFinishEffects({
        nebulaIds: getMarkedNebulaIdsFromEvents(result.events),
      });
      if (!followups.length) return false;

      const currentPlayer = getCurrentPlayer();
      startPendingActionSession("launch", "发射行动");
      recordAbilityCommands(result);
      endEffectHistoryStep({
        result: {
          ok: true,
          undoable: result.undoable,
          irreversible: result.irreversible || null,
          message: result.message || "发射行动",
        },
      });

      decisionState.actionEffectFlow = abilities.chain.startAbilityChain(
        "launch-sector-finish",
        "发射后扇区结算",
        followups,
      );
      decisionState.actionEffectFlow.actionType = "launch";
      decisionState.actionEffectFlow.playerId = currentPlayer?.id || null;
      assignEffectFlowOwner(decisionState.actionEffectFlow, decisionState.actionEffectFlow.playerId);
      decisionState.actionEffectFlow.historySource = HISTORY_SOURCE_MAIN;
      decisionState.actionEffectFlow.consumesMainAction = true;

      els.appWrap?.classList.toggle("action-effect-flow-active", true);
      rocketState.statusNote = "发射完成：请处理哨兵扫描触发的扇区结算";
      activateNextActionEffect();
      return true;
    }

    function appendIndustryPlayPassiveStatus(result) {
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

    function buildStrategyPlayPassiveEffectNodes(player, playedCard) {
      if (!industry?.isStrategyPlayInteractionActive?.(player, turnState.roundNumber)) return [];
      const eligibleSlotIds = industry.getStrategyPlayEligibleSlotIds?.(player, turnState.roundNumber) || [];
      if (!eligibleSlotIds.length) return [];
      const scanCode = industry.getStrategyPlayScanCode?.(player);
      const needsSlotChoice = Number(scanCode) === 3 && eligibleSlotIds.length > 1;
      const slotId = needsSlotChoice
        ? null
        : (industry.getAutomaticStrategyPlaySlotId?.(player, turnState.roundNumber) || eligibleSlotIds[0]);
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

    function buildIndustryPlayCardAppendEffects(player, playedCard) {
      const sentinelEffects = industry?.buildSentinelPlayCornerEffectNodes?.(
        cards,
        player,
        turnState.roundNumber,
        turnState.turnNumber,
        playedCard,
      ) || [];
      const strategyEffects = buildStrategyPlayPassiveEffectNodes(player, playedCard);
      return {
        immediateEffects: sentinelEffects,
        deferredEndEffects: strategyEffects,
      };
    }

    function buildPlayCardEffectFlowQueue(player, playedCard, playEffects) {
      const industryAppendEffects = buildIndustryPlayCardAppendEffects(player, playedCard);
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

    function applyIndustryPlayCardPassives(playedCard, typeCode) {
      const player = getCurrentPlayer();
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
      player.industryPlayedCardRound = turnState.roundNumber;
      player.industryPlayedCardTurn = turnState.turnNumber;
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
        turnState.roundNumber,
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

    function completeIndustryAbilityQuickStep(detail = null) {
      if (quickActionHistory.hasUndoableStep()) {
        completeQuickActionStep(detail);
      }
    }

    function commitIrreversibleIndustryQuickAction(label, message, options = {}) {
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

    function appendSentinelPlayCornerEffectsToFlow(nodes) {
      if (!decisionState.actionEffectFlow || !nodes?.length) return false;
      if (decisionState.actionEffectFlow.effects.some((effect) => effect.type === "industry_sentinel_corner")) {
        return false;
      }
      decisionState.actionEffectFlow.effects.push(...nodes.map((node) => ({
        ...node,
        status: "pending",
      })));
      decisionState.actionEffectFlow.completed = false;
      const hasActiveEffect = decisionState.actionEffectFlow.effects.some((effect) => effect.status === "active");
      if (!hasActiveEffect) {
        els.appWrap?.classList.toggle("action-effect-flow-active", true);
        activateNextActionEffect();
      }
      return true;
    }

    function tryInjectSentinelPlayCornerEffectAfterArm() {
      const player = getCurrentPlayer();
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

      if (isActionEffectFlowActive() && decisionState.actionEffectFlow.actionType === "playCard") {
        return appendSentinelPlayCornerEffectsToFlow(nodes);
      }

      if (!isActionPending()) return false;

      return startCardEffectFlow(
        "industry-sentinel-corner",
        "哨兵探测网络",
        nodes,
        { actionType: "playCard", industryPlayedCard: playedCard },
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

    function executeIndustryStratusCornerEffect(effect) {
      const currentPlayer = getEffectOwnerPlayer(effect) || getCurrentPlayer();
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
      beginEffectHistoryStep(effect.label);
      if (!reward) {
        effect.result = {
          ok: true,
          undoable: true,
          message: `${effect.label}：没有弃牌角标奖励`,
        };
        rocketState.statusNote = effect.result.message;
        completeCurrentActionEffect("skipped");
        renderStateReadout();
        return effect.result;
      }

      const beforePlayer = structuredClone(currentPlayer);
      const applied = industry.applyCornerReward(players, data, currentPlayer, reward);
      if (!applied.ok) {
        endEffectHistoryStep();
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

      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
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

    function executeIndustrySentinelCornerEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      const playedCard = effect.options?.playedCard;
      if (!currentPlayer || !playedCard) {
        rocketState.statusNote = "哨兵探测网络：无效卡牌";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      if (industry?.isAlienCard?.(playedCard)) {
        effect.result = { ok: false, undoable: true, message: "外星人卡牌不能触发哨兵弃牌角标" };
        completeCurrentActionEffect("skipped");
        renderStateReadout();
        return effect.result;
      }

      const reward = industry.getCornerReward(cards, playedCard);
      if (!reward) {
        effect.result = { ok: false, undoable: true, message: "该牌没有弃牌角标奖励" };
        completeCurrentActionEffect("skipped");
        renderStateReadout();
        return effect.result;
      }

      const beforePlayer = structuredClone(currentPlayer);
      beginEffectHistoryStep(effect.label);
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
          recordHistoryCommand(historyCommands.createGainDataCommand(currentPlayer, gainResult));
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

      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
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

    function createCompanyCardSummary(companyCard, player) {
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
              handleCompanyActionMarkerClick(companyCard);
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
          onPanelClick: handleAlienLabPanelClick,
        });
      }

      if (player && industry?.shouldShowFutureSpanPanel?.(player)) {
        const futureCheck = canBeginIndustryFutureSpanHandSelection(player);
        industry.mountFutureSpanLayer(wrap, player, {
          tokenEnabled: futureCheck.ok,
          tokenTitle: futureCheck.ok ? "点击扣下一张手牌并设置目标分" : futureCheck.message,
          cardSelectable: isPlayCardSelectionActive() || canStartMainAction(),
          cardSelected: getPendingPlayCardSelection()?.source === "future_span",
          onTokenClick: () => beginIndustryFutureSpanHandSelection(),
          onCardClick: () => handleFutureSpanPlayCardSelect(),
        });
      }

      return wrap;
    }

    function executeIndustryHeliosPassiveRewardEffect(effect) {
      const player = getCurrentPlayer();
      const slotId = effect.options?.slotId;
      if (!player || !slotId) {
        rocketState.statusNote = "赫利昂联合体：无效奖励";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const check = industry?.canPlaceHeliosPassiveSlot?.(player, slotId);
      if (!check?.ok) {
        effect.result = { ok: false, undoable: true, message: check?.message || "无法领取奖励" };
        completeCurrentActionEffect("skipped");
        renderStateReadout();
        return effect.result;
      }

      const slotLabel = industry.getHeliosPassiveSlotLabel?.(slotId) || slotId;
      const reward = industry.getHeliosSlotReward?.(slotId);
      const rewardLabel = industry.getHeliosSlotRewardLabel?.(slotId) || "";
      const beforePlayer = structuredClone(player);

      beginEffectHistoryStep(effect.label);
      const placeResult = industry.placeHeliosPassiveSlot(player, slotId);
      if (!placeResult?.ok) {
        endEffectHistoryStep();
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
        recordHistoryCommand(historyCommands.createGainDataCommand(player, gainResult));
      }

      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
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

    function getStrategyPassiveSelectableSlotIds(effect, player) {
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

    function closeStrategyPassiveSlotChoicePicker() {
      decisionSessions.clear(STRATEGY_SLOT_DECISION);
      if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
      if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
      renderActionEffectBar();
      updateActionButtons();
      renderStateReadout();
    }

    function cancelStrategyPassiveSlotChoice() {
      if (!getStrategySlotDecision()) return;
      decisionSessions.clear(STRATEGY_SLOT_DECISION);
      if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
      if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
      rocketState.statusNote = "宇宙战略集团：已取消奖励槽选择，可重新点击效果或跳过";
      renderActionEffectBar();
      updateActionButtons();
      renderStateReadout();
    }

    function openStrategyPassiveSlotChoice(effect, player, slotIds) {
      if (!els.scanTargetOverlay || !els.scanTargetActions) {
        if (globalThis.SetiHeadlessRuntimeConfig?.enabled) {
          decisionSessions.open(STRATEGY_SLOT_DECISION, {
            effectId: effect.id,
            slotIds: [...slotIds],
            playerId: player?.id || null,
            playerColor: player?.color || null,
          });
          return { ok: true, pendingChoice: true, undoable: true, message: "宇宙战略集团：请选择奖励槽" };
        }
        rocketState.statusNote = "宇宙战略集团：无法打开奖励槽选择";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      decisionSessions.open(STRATEGY_SLOT_DECISION, {
        effectId: effect.id,
        slotIds: [...slotIds],
      });
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

    function confirmStrategyPassiveSlotChoice(slotId) {
      const pending = getStrategySlotDecision();
      const effect = getCurrentActionEffect();
      if (!pending || !effect || effect.id !== pending.effectId || effect.type !== "industry_strategy_passive_reward") {
        cancelStrategyPassiveSlotChoice();
        return { ok: false, message: "没有待选择的宇宙战略集团奖励槽" };
      }
      if (!pending.slotIds.includes(slotId)) {
        rocketState.statusNote = "宇宙战略集团：该奖励槽不可选";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      closeStrategyPassiveSlotChoicePicker();
      setStrategyPassiveRewardSlot(effect, slotId);
      return executeIndustryStrategyPassiveRewardEffect(effect);
    }

    function finishIndustryStrategyPassiveRewardEffect(effect, options = {}) {
      const player = getEffectOwnerPlayer(effect) || getCurrentPlayer();
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
        completeCurrentActionEffect("skipped");
        renderInitialSelectionArea();
        renderStateReadout();
        return effect.result;
      }

      const slotLabel = industry.getStrategyPassiveSlotLabel?.(slotId) || slotId;
      const reward = industry.getStrategySlotReward?.(slotId);
      const rewardLabel = industry.getStrategySlotRewardLabel?.(slotId) || "";
      const beforePlayer = options.beforePlayerState || structuredClone(player);

      if (!uiRuntimeState.effectStepActive) beginEffectHistoryStep(effect.label);
      if (!options.restoreRecorded) {
        recordHistoryCommand(historyCommands.createRestorePlayerCommand(
          player,
          beforePlayer,
          `撤销宇宙战略集团：${slotLabel}奖励槽`,
        ));
      }

      const placeResult = industry.placeStrategyPassiveSlot(player, slotId);
      if (!placeResult?.ok) {
        endEffectHistoryStep();
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
          recordHistoryCommand(historyCommands.createGainDataCommand(player, gainResult));
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

    function executeIndustryStrategyPassiveRewardEffect(effect) {
      const player = getEffectOwnerPlayer(effect) || getCurrentPlayer();
      let slotId = effect.options?.slotId;
      if (!slotId) {
        const slotIds = getStrategyPassiveSelectableSlotIds(effect, player);
        if (slotIds.length > 1) {
          return openStrategyPassiveSlotChoice(effect, player, slotIds);
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
            onAfterPlacement: ({ messages, restoreRecorded, beforePlayerState }) => finishIndustryStrategyPassiveRewardEffect(
              effect,
              { placementMessages: messages, restoreRecorded, beforePlayerState },
            ),
            onSkip: ({ beforePlayerState }) => finishIndustryStrategyPassiveRewardEffect(
              effect,
              { skipDataGain: true, beforePlayerState },
            ),
          });
        }
        return finishIndustryStrategyPassiveRewardEffect(effect, { skipDataGain: true });
      }
      return finishIndustryStrategyPassiveRewardEffect(effect);
    }

    function handleStrategyPassiveSlotClick(slotId) {
      if (getGameplayLockReason()) return;

      const player = getCurrentPlayer();
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

    function handleCompanyActionMarkerClick(companyCard) {
      const gameplayLockReason = getGameplayLockReason();
      if (gameplayLockReason) {
        rocketState.statusNote = gameplayLockReason;
        renderStateReadout();
        return { ok: false, message: gameplayLockReason };
      }

      const player = getCurrentPlayer();
      const layout = industry?.getIndustryActionMarkerLayout?.(companyCard);
      const check = industry?.canMarkIndustryAction?.(player, turnState.roundNumber, {
        turnNumber: turnState.turnNumber,
        hasMarker: Boolean(layout),
        industryCard: companyCard,
      });
      if (!check?.ok) {
        rocketState.statusNote = check?.message || "无法放置公司行动标记";
        renderStateReadout();
        return;
      }

      const companyLabel = companyCard.label || "公司牌";
      const beforeIndustryPlayer = structuredClone(player);
      const abilityFlow = industry.buildActiveAbilityFlow(
        player,
        companyLabel,
        turnState.roundNumber,
        turnState.turnNumber,
      );
      if (!abilityFlow?.ok) {
        restoreObjectSnapshot(player, beforeIndustryPlayer);
        if (abilityFlow?.message && industry.hasImplementedActiveAbility?.(companyCard)) {
          rocketState.statusNote = abilityFlow.message;
        } else {
          rocketState.statusNote = "该公司 1x 行动暂未处理";
        }
        renderStateReadout();
        return;
      }

      if (abilityFlow.flowType === "stratus_public_corners"
        || abilityFlow.flowType === "huanyu_free_moves"
        || abilityFlow.flowType === "fundamentalism_score_exchange"
        || abilityFlow.flowType === "pirates_raid_launch") {
        const result = industry.markIndustryAction(player, turnState.roundNumber, {
          turnNumber: turnState.turnNumber,
        });
        if (!result.ok) {
          restoreObjectSnapshot(player, beforeIndustryPlayer);
          rocketState.statusNote = result.message;
          renderStateReadout();
          return;
        }

        const markerRestoreCommand = createIndustryActionRestoreCommand(
          player,
          beforeIndustryPlayer,
          companyLabel,
          { clearEffectFlow: true },
        );
        const started = startIndustryAbilityFlow(abilityFlow, { markerRestoreCommand });
        if (!started) {
          markerRestoreCommand?.undo();
        } else {
          rocketState.statusNote = abilityFlow.message || rocketState.statusNote;
        }
        renderInitialSelectionArea();
        renderStateReadout();
        return;
      }

      beginQuickActionStep("industry-mark", `公司行动标记：${companyLabel}`);
      const result = industry.markIndustryAction(player, turnState.roundNumber, {
        turnNumber: turnState.turnNumber,
      });
      if (!result.ok) {
        restoreObjectSnapshot(player, beforeIndustryPlayer);
        quickActionHistory.undoLastStep();
        if (!quickActionHistory.hasUndoableStep()) {
          quickActionHistory.commitSession();
          clearHistoryStepOrderForSource(HISTORY_SOURCE_QUICK);
        }
        rocketState.statusNote = result.message;
        renderStateReadout();
        return;
      }

      recordIndustryActionRestoreCommand(player, beforeIndustryPlayer, companyLabel);

      const started = startIndustryAbilityFlow(abilityFlow);
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
        rocketState.statusNote = abilityFlow.message || rocketState.statusNote;
      }
      renderInitialSelectionArea();
      renderStateReadout();
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

  return { createIndustryRuntime };
});
