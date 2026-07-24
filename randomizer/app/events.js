(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppEvents = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  "use strict";

  function routeMainActionButtonClick(event, context) {
    const button = event.target.closest("button");
    if (!button || !context.actionBarMain?.contains(button)) return false;
    if (button === context.quickButton) return false;
    if (button.disabled || button.getAttribute("aria-disabled") === "true") return false;
    const handlers = {
      "action-launch-button": () => context.activateAction(button.dataset.actionId),
      "action-orbit-button": () => context.activateAction(button.dataset.actionId),
      "action-land-button": () => context.activateAction(button.dataset.actionId),
      "action-scan-button": () => context.activateAction(button.dataset.actionId),
      "action-analyze-button": () => context.activateAction(button.dataset.actionId),
      "action-play-card-button": () => context.activateAction(button.dataset.actionId),
      "action-research-tech-button": () => context.activateAction(button.dataset.actionId),
    };
    const handler = handlers[button.id];
    if (typeof handler !== "function") return false;
    handler();
    return true;
  }

  function createAppEventState(context = {}) {
    const pending = context.pending || {};
    const alien = context.alien || {};
    const ui = context.ui || {};
    return {
      get pendingChongFossilChoice() { return alien.getPendingChongFossilChoice?.(); },
      get pendingChongCardGain() { return alien.getPendingChongCardGain?.(); },
      get pendingAmibaTraceRemoval() { return alien.getPendingAmibaTraceRemoval?.(); },
      get pendingAmibaSymbolChoice() { return alien.getPendingAmibaSymbolChoice?.(); },
      get pendingAmibaCardGain() { return alien.getPendingAmibaCardGain?.(); },
      get pendingAomomoCardGain() { return alien.getPendingAomomoCardGain?.(); },
      get pendingRunezuFaceSymbolPlacement() { return alien.getPendingRunezuFaceSymbolPlacement?.(); },
      get pendingRunezuSymbolBranch() { return alien.getPendingRunezuSymbolBranch?.(); },
      get pendingRunezuCardGain() { return alien.getPendingRunezuCardGain?.(); },
      get pendingBanrenmaCardGain() { return alien.getPendingBanrenmaCardGain?.(); },
      get pendingBanrenmaOpportunity() { return alien.getPendingBanrenmaOpportunity?.(); },
      get pendingYichangdianCardGain() { return alien.getPendingYichangdianCardGain?.(); },
      get pendingJiuzheCardPlay() { return alien.getPendingJiuzheCardPlay?.(); },
      get jiuzheCardViewOpen() { return Boolean(ui.jiuzheCardViewOpen); },
      get hasStrategySlotDecision() { return Boolean(pending.readPendingDecision?.("strategy_slot")); },
      get alienTracePickerState() { return ui.alienTracePickerState; },
      set alienTracePickerState(value) { ui.alienTracePickerState = value; },
      get pendingAlienRevealConfirmation() { return ui.alienRevealConfirmation; },
      get moveHighlightRocketId() { return ui.moveHighlightRocketId; },
      get pendingCardTriggerFreeMove() { return pending.getPendingCardTriggerFreeMove?.(); },
      get pendingCardCornerFreeMove() { return pending.getPendingCardCornerFreeMove?.(); },
      get pendingActionEffectFlow() { return pending.getActionEffectFlow?.(); },
    };
  }

  function bindAppEvents(context) {
    if (!context || !context.els) {
      throw new Error("bindAppEvents requires app context");
    }

    const {
      window: windowRef = root,
      document: documentRef = root.document,
      state,
      els,
      tech,
      data,
      aliens,
      aomomo,
      jiuzhe,
      yichangdian,
      fangzhou,
      banrenma,
      chong,
      amiba,
      runezu,
      techRenderContext,
      getEventsProjection,
      assertEventsProjection,
      setStatusNote,
      startNewGameFromStartScreen,
      continueGameFromStartScreen,
      syncStartScreenDebugOption,
      syncStartScreenActionLogOption,
      handleStartAlienOptionChange,
      handleStartIndustryOptionChange,
      cancelTechSelection,
      toggleQuickPanel,
      activateActionBarAction,
      undoPendingAction,
      closeScanTargetPicker,
      submitHumanActionId,
      closeHumanActionPicker,
      moveRocket,
      handleBoardPointerDown,
      openFinalResultDialog,
      downloadActionLogMarkdown,
      minimizeFinalResultDialog,
      closeFinalResultDialog,
      closeActionBriefing,
      openActionBriefingDetailLog,
      blockManualAiSharedOverlayInputIfNeeded,
      setDebugOpen,
      setDebugPlayerMenuOpen,
      toggleSectorWinDebug,
      openFangzhouCard1Dialog,
      handlePublicBlindDrawClick,
      handlePublicCardClick,
      selectPassReserveCard,
      dismissPassReserveSelectionOverlay,
      cancelCardSelection,
      confirmPublicScanSelection,
      confirmPlayCardSelection,
      cancelPlayCardSelection,
      confirmHandCardPlayAction,
      confirmCardCornerQuickAction,
      getCurrentPlayer,
      getInterfacePlayer,
      isAiAutomationInputLocked,
      blockManualAiAutomationInput,
      openJiuzheCardDialog,
      openBanrenmaCardConditionCompletionPicker,
      openCardTaskCompletionPicker,
      isPlayCardSelectionActive,
      handlePlayCardSelect,
      handleHandCardCornerQuickAction,
      renderStateReadout,
      syncTechRenderContext,
      setLogOpen,
      setReportTab,
      renderAlienPanels,
      renderSectorNebulaDataBoard,
      logAomomoDebugCoordinates,
      resize,
    } = context;
    if (typeof getEventsProjection !== "function" || typeof assertEventsProjection !== "function") {
      throw new TypeError("bindAppEvents requires frozen EventsProjection provider");
    }
    const readEventsProjection = () => assertEventsProjection(getEventsProjection());

    if (!state) {
      throw new Error("bindAppEvents requires mutable app state accessors");
    }

    function shouldBlockTrustedManualAiSharedInput(event) {
      return Boolean(event?.isTrusted && blockManualAiSharedOverlayInputIfNeeded?.());
    }

    els.startScreenStartButton?.addEventListener("click", startNewGameFromStartScreen);
    els.startScreenContinueButton?.addEventListener("click", () => {
      if (els.startScreenContinueButton.disabled) return;
      continueGameFromStartScreen();
    });
    els.startDebugEnabled?.addEventListener("change", syncStartScreenDebugOption);
    els.startActionLogEnabled?.addEventListener("change", syncStartScreenActionLogOption);
    els.startAlienOptions?.addEventListener("change", handleStartAlienOptionChange);
    els.startIndustryOptions?.addEventListener("change", handleStartIndustryOptionChange);
    els.actionBarMain?.addEventListener("click", (event) => routeMainActionButtonClick(event, {
      actionBarMain: els.actionBarMain,
      quickButton: els.actionQuickButton,
      activateAction: activateActionBarAction,
    }));
    els.techSelectionCancel?.addEventListener("click", cancelTechSelection);
    els.actionQuickButton.addEventListener("click", toggleQuickPanel);
    els.actionPassButton?.addEventListener("click", () => {
      if (els.actionPassButton.disabled) return;
      activateActionBarAction(els.actionPassButton.dataset.actionId);
    });
    els.actionConfirmButton?.addEventListener("click", () => {
      if (els.actionConfirmButton.disabled) return;
      activateActionBarAction(els.actionConfirmButton.dataset.actionId);
    });
    els.actionUndoButton?.addEventListener("click", () => {
      if (els.actionUndoButton.disabled) return;
      undoPendingAction();
    });
    els.finalResultButton?.addEventListener("click", openFinalResultDialog);
    els.finalResultDownloadLog?.addEventListener("click", () => downloadActionLogMarkdown({ allowIncomplete: true }));
    els.finalResultMinimize?.addEventListener("click", minimizeFinalResultDialog);
    els.finalResultOverlay?.addEventListener("click", (event) => {
      if (event.target === els.finalResultOverlay) closeFinalResultDialog();
    });
    els.quickActionsTrades.addEventListener("click", (event) => {
      const button = event.target.closest("[data-quick-trade]");
      if (!button || button.disabled) return;
      activateActionBarAction(button.dataset.actionId);
    });
    els.scanTargetActions?.addEventListener("click", (event) => {
      if (blockManualAiSharedOverlayInputIfNeeded?.()) return;
      const humanAction = event.target.closest("[data-human-action-id]");
      if (humanAction && !humanAction.disabled) {
        submitHumanActionId(humanAction.dataset.humanActionId);
        closeHumanActionPicker();
        return;
      }
    });
    els.scanTargetCancel?.addEventListener("click", () => {
      if (blockManualAiSharedOverlayInputIfNeeded?.()) return;
      closeScanTargetPicker();
    });
    els.scanTargetOverlay?.addEventListener("click", (event) => {
      if (event.target === els.scanTargetOverlay) {
        if (blockManualAiSharedOverlayInputIfNeeded?.()) return;

        closeScanTargetPicker();
      }
    });
    els.tokenLayer?.addEventListener("click", (event) => {
      if (event.target.closest(".rocket-token")) {
        event.stopPropagation();
      }
    });
    els.moveArrowLayer?.addEventListener("pointerdown", (event) => {
      const button = event.target.closest("[data-move-x]");
      if (!button || state.moveHighlightRocketId == null) return;
      event.stopPropagation();
      event.preventDefault();
      if (isAiAutomationInputLocked?.()) {
        blockManualAiAutomationInput?.("电脑玩家自动移动中");
        return;
      }
      moveRocket(Number(button.dataset.moveX), Number(button.dataset.moveY), state.moveHighlightRocketId);
    });
    els.wheelWrap.addEventListener("pointerdown", handleBoardPointerDown);
    els.debugToggle.addEventListener("click", () => {
      setDebugOpen(els.appWrap.classList.contains("debug-collapsed"));
    });
    els.debugPlayerSwitchButton?.addEventListener("click", () => {
      setDebugPlayerMenuOpen(els.debugPlayerMenu?.hidden);
    });
    els.debugSectorWinButton?.addEventListener("click", toggleSectorWinDebug);
    documentRef.addEventListener("click", (event) => {
      const viewButton = event.target.closest("[data-fangzhou-card-view]");
      if (!viewButton) return;
      openFangzhouCard1Dialog(Number(viewButton.dataset.fangzhouCardView));
    });
    els.playCardActionButton?.addEventListener("click", confirmPlayCardSelection);
    els.playCardSelectionCancel?.addEventListener("click", cancelPlayCardSelection);
    els.handCardPlayActionButton?.addEventListener("click", confirmHandCardPlayAction);
    els.cardCornerActionButton?.addEventListener("click", confirmCardCornerQuickAction);
    els.playerHandFan?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-hand-index]");
      if (!button || button.disabled) return;
      if (isPlayCardSelectionActive()) {
        handlePlayCardSelect(Number(button.dataset.handIndex));
        return;
      }
      handleHandCardCornerQuickAction(Number(button.dataset.handIndex));
    });
    syncTechRenderContext();
    els.logToggle.addEventListener("click", () => {
      setLogOpen(els.appWrap.classList.contains("log-collapsed"));
    });
    els.stateLogTab?.addEventListener("click", () => {
      setReportTab("state");
    });
    els.actionLogTab?.addEventListener("click", () => {
      setReportTab("action");
    });
    els.actionBriefingConfirm?.addEventListener("click", () => {
      closeActionBriefing();
    });
    els.actionBriefingDetailLog?.addEventListener("click", () => {
      openActionBriefingDetailLog();
    });
    aliens.bindAlienTraceDragging?.({
      onPositionChange: (payload) => {
        setStatusNote(payload?.message || "外星人坐标已更新");
        if (payload?.message) console.info("[外星人坐标拖动]", payload.message, payload);
        renderAlienPanels();
        renderStateReadout();
      },
    });
    data.bindNebulaDataDragging?.({
      onPositionChange: (payload) => {
        setStatusNote(payload?.message || "星云数据坐标已更新");
        if (payload?.message) console.info("[星云数据坐标拖动]", payload.message, payload);
        if (payload?.nebulaId === aomomo?.NEBULA_ID) {
          console.info(
            "[奥陌陌调试坐标]",
            `数据槽 ${payload.slotIndex} = 盘面(${payload.percentX}%, ${payload.percentY}%)`
            + ` radial=${payload.radialFraction} angular=${payload.angularFraction}`,
          );
          logAomomoDebugCoordinates();
        }
        renderSectorNebulaDataBoard();
        renderStateReadout();
      },
      onSectorWinPositionChange: (payload) => {
        setStatusNote(payload?.message || "扇区胜利坐标已更新");
        if (payload?.message) console.info("[扇区胜利坐标]", payload.message, payload);
        renderSectorNebulaDataBoard();
        renderStateReadout();
      },
    });
    windowRef.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !els.actionBriefingOverlay?.hidden) {
        closeActionBriefing();
        return;
      }
      if (event.key !== "Escape" || els.finalResultOverlay?.hidden) return;
      closeFinalResultDialog();
    });
    windowRef.addEventListener("resize", resize);
  }

  return { bindAppEvents, createAppEventState, routeMainActionButtonClick };
});
