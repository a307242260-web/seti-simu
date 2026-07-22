(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserActionBar = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const STANDARD_ACTION_SCHEMA = "seti-standard-action-v1";

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function fail(code, message, details = {}) {
    return { ok: false, code, message, ...clone(details) };
  }

  function normalizeControl(action) {
    return {
      actionId: String(action.actionId),
      family: String(action.family),
      phase: String(action.phase),
      label: action.summary || action.family,
      disabledReason: action.disabledReason || null,
    };
  }

  function createActionBarModel(projection) {
    const controls = projection?.controls || {};
    const actions = Array.isArray(controls.actions) ? controls.actions : [];
    const quickActions = Array.isArray(controls.quickActions) ? controls.quickActions : [];
    const pass = actions.find((action) => action.family === "pass") || null;
    const endTurn = actions.find((action) => action.family === "end_turn") || null;
    return {
      projectionId: projection?.projectionId || null,
      source: clone(projection?.source || {}),
      mainActions: actions
        .filter((action) => !["pass", "end_turn"].includes(action.family))
        .map(normalizeControl),
      quickActions: quickActions.map(normalizeControl),
      pass: pass ? normalizeControl(pass) : null,
      endTurn: endTurn ? normalizeControl(endTurn) : null,
      undo: {
        enabled: controls.canUndo === true,
        disabledReason: controls.canUndo === true
          ? null
          : (controls.undoDisabledReason || "没有可撤销的 Effect"),
      },
      progress: clone(projection?.feedback?.progress || null),
    };
  }

  function createActionBarController(options = {}) {
    if (typeof options.dispatchIntent !== "function") {
      throw new TypeError("Action Bar controller 需要 dispatchIntent()");
    }
    if (typeof options.dispatchUndo !== "function") {
      throw new TypeError("Action Bar controller 需要 Effect Session dispatchUndo()");
    }
    let projection = null;

    function setProjection(nextProjection) {
      projection = nextProjection || null;
      return createActionBarModel(projection);
    }

    function findAction(actionId) {
      const controls = projection?.controls || {};
      return [...(controls.actions || []), ...(controls.quickActions || [])]
        .find((action) => String(action.actionId) === String(actionId)) || null;
    }

    function submitAction(actionId) {
      const action = findAction(actionId);
      if (!action) return fail("ACTION_BAR_ACTION_STALE", "actionId 不在当前 projection controls 中", { actionId });
      if (action.disabledReason) {
        return fail("ACTION_BAR_ACTION_DISABLED", action.disabledReason, { actionId });
      }
      if (action.schemaVersion !== STANDARD_ACTION_SCHEMA) {
        return fail("ACTION_BAR_ACTION_SCHEMA_INVALID", "Action Bar 只提交 Standard Action", { actionId });
      }
      return options.dispatchIntent({ kind: "action", action: clone(action) });
    }

    function submitUndo() {
      const model = createActionBarModel(projection);
      if (!model.undo.enabled) {
        return fail("ACTION_BAR_UNDO_DISABLED", model.undo.disabledReason);
      }
      return options.dispatchUndo({
        sessionId: projection?.source?.sessionId || null,
        sessionRevision: projection?.source?.sessionRevision ?? null,
      });
    }

    function activate(intent = {}) {
      if (intent.type === "action") return submitAction(intent.actionId);
      if (intent.type === "undo") return submitUndo();
      return fail("ACTION_BAR_INTENT_UNKNOWN", `未知 Action Bar intent: ${intent.type || "<missing>"}`);
    }

    return Object.freeze({ setProjection, createModel: () => createActionBarModel(projection), activate });
  }

  function createActionBarRenderer(options = {}) {
    const documentRef = options.document;
    const rootNode = options.root;
    const controller = options.controller;
    if (!documentRef?.createElement || !rootNode?.replaceChildren) {
      throw new TypeError("Action Bar renderer 需要 document/root");
    }
    if (!controller?.setProjection || !controller?.activate) {
      throw new TypeError("Action Bar renderer 需要 controller");
    }

    function button(label, intent, disabledReason) {
      const node = documentRef.createElement("button");
      node.type = "button";
      node.textContent = label;
      node.dataset.actionBarIntent = intent.type;
      if (intent.actionId != null) node.dataset.actionId = String(intent.actionId);
      node.disabled = Boolean(disabledReason);
      node.title = disabledReason || "";
      return node;
    }

    function render(projection) {
      const model = controller.setProjection(projection);
      const fragment = documentRef.createDocumentFragment();
      for (const action of model.mainActions) {
        fragment.appendChild(button(action.label, { type: "action", actionId: action.actionId }, action.disabledReason));
      }
      for (const action of model.quickActions) {
        fragment.appendChild(button(action.label, { type: "action", actionId: action.actionId }, action.disabledReason));
      }
      if (model.pass) fragment.appendChild(button(model.pass.label, { type: "action", actionId: model.pass.actionId }, model.pass.disabledReason));
      if (model.endTurn) fragment.appendChild(button(model.endTurn.label, { type: "action", actionId: model.endTurn.actionId }, model.endTurn.disabledReason));
      fragment.appendChild(button("撤销", { type: "undo" }, model.undo.disabledReason));
      const progress = documentRef.createElement("output");
      progress.dataset.actionBarProgress = "true";
      progress.textContent = model.progress
        ? `${model.progress.completedEffects}/${model.progress.totalEffects} ${model.progress.currentEffectType || ""}`.trim()
        : "";
      fragment.appendChild(progress);
      rootNode.replaceChildren(fragment);
      return model;
    }

    function handleDomEvent(event) {
      const target = event?.target?.closest?.("[data-action-bar-intent]");
      if (!target || target.disabled) return { ok: true, ignored: true };
      return controller.activate({
        type: target.dataset.actionBarIntent,
        actionId: target.dataset.actionId,
      });
    }

    rootNode.addEventListener("click", handleDomEvent);
    return Object.freeze({ render, handleDomEvent, dispose: () => rootNode.removeEventListener("click", handleDomEvent) });
  }

  function createLegacyActionBarController(context = {}) {
    const { els } = context;
    const mainButtons = [
      els.actionLaunchButton, els.actionOrbitButton, els.actionLandButton, els.actionScanButton,
      els.actionAnalyzeButton, els.actionPlayCardButton, els.actionResearchTechButton,
    ];

    function setActionButtonState(button, enabled, reason) {
      if (!button) return;
      button.disabled = !enabled;
      button.classList.toggle("action-button-ready", enabled);
      button.title = enabled ? "" : (reason || "当前无法执行此行动");
      button.setAttribute("aria-disabled", String(!enabled));
    }

    function setTurnActionButtonState(button, enabled, highlighted = false) {
      if (!button) return;
      button.disabled = !enabled;
      button.classList.toggle("action-button-pending", Boolean(enabled && highlighted));
      button.setAttribute("aria-disabled", String(!enabled));
    }

    function setQuickActionButtonEnabled(enabled, reason) {
      els.actionQuickButton.disabled = !enabled;
      els.actionQuickButton.title = enabled ? "" : (reason || "当前无法执行此行动");
      els.actionQuickButton.setAttribute("aria-disabled", String(!enabled));
      els.actionQuickButton.classList.add("action-button-ready");
    }

    function setMainButtons(enabled, reason) {
      mainButtons.forEach((button) => setActionButtonState(button, enabled, reason));
    }

    function updateTurnActionButtons() {
      const pendingBlockedReason = "请先回合结束或撤销当前行动";
      if (context.isTechTilePickingActive()) {
        setTurnActionButtonState(els.actionPassButton, false);
        setTurnActionButtonState(els.actionConfirmButton, false);
        setTurnActionButtonState(els.actionUndoButton, true);
        return "请先选择科技或点击取消";
      }
      if (context.isActionEffectFlowActive()) {
        setTurnActionButtonState(els.actionPassButton, false);
        setTurnActionButtonState(els.actionConfirmButton, false);
        setTurnActionButtonState(els.actionUndoButton, context.quickActionHistory.hasUndoableStep() || context.canUndoCurrentMainAction());
        return "请先完成当前行动的效果";
      }
      if (context.isActionPending()) {
        const irreversible = context.hasCurrentMainActionIrreversibleBarrier();
        setTurnActionButtonState(els.actionPassButton, false);
        setTurnActionButtonState(els.actionConfirmButton, true, true);
        setTurnActionButtonState(els.actionUndoButton, context.quickActionHistory.hasUndoableStep() || context.canUndoCurrentMainAction(), !irreversible);
        return pendingBlockedReason;
      }
      setTurnActionButtonState(els.actionPassButton, context.canStartMainAction());
      setTurnActionButtonState(els.actionConfirmButton, false);
      setTurnActionButtonState(els.actionUndoButton, context.quickActionHistory.hasUndoableStep());
      return null;
    }

    function isQuickPanelOpen() {
      return !els.quickActionsPanel.hidden;
    }

    function updateQuickPanel() {
      if (!isQuickPanelOpen()) return;
      const actionContext = context.createReadoutActionContext();
      els.quickActionsTrades.querySelectorAll("[data-quick-trade]").forEach((button) => {
        const check = context.quickTrades.canExecuteTrade(button.dataset.quickTrade, actionContext);
        button.disabled = !check.ok;
        button.title = check.ok ? "" : (check.message || "当前无法兑换");
      });
    }

    function setQuickPanelOpen(open) {
      if (open && context.getGameplayLockReason()) return;
      if (open) context.cancelHandCardContextActions({ silent: true });
      els.quickActionsPanel.hidden = !open;
      els.actionQuickButton.setAttribute("aria-expanded", String(open));
      els.actionQuickButton.classList.add("action-button-ready");
      if (open) updateQuickPanel();
    }

    function toggleQuickPanel() {
      setQuickPanelOpen(!isQuickPanelOpen());
    }

    function updateActionButtons() {
      context.syncFinalResultButton();
      const readoutRoot = context.createReadoutRoot();
      const actionContext = context.createActionContext(readoutRoot);
      const gameplayLockReason = context.getGameplayLockReason();
      if (gameplayLockReason) return context.lockAllActionButtons(gameplayLockReason);
      if (context.isAiPlayer(readoutRoot.playerState.currentPlayerId) && !context.isAiAutomationPaused()) {
        return context.lockAllActionButtons("电脑玩家自动行动中");
      }

      const locks = {
        tech: context.isTechTilePickingActive(),
        card: context.isCardSelectionActive(),
        discard: context.isDiscardSelectionActive(),
        play: context.isPlayCardSelectionActive(),
        move: context.isMovePaymentSelectionActive(),
        handScan: context.isHandScanSelectionActive(),
        effect: context.isActionEffectFlowActive(),
        history: context.actionHistory.hasSession(),
        subFlow: context.hasActivePendingSubFlow(),
      };
      const selectionReason = locks.tech ? "请先选择科技或点击取消"
        : locks.handScan ? "请先完成手牌扫描或点击取消"
          : locks.move ? "请先确认或取消移动"
            : locks.play ? "请先打出或点击取消"
              : locks.discard ? "请先完成弃牌或点击取消" : "请先完成精选或点击取消";
      const pendingReason = updateTurnActionButtons();
      const effectReason = locks.effect ? "请先完成当前行动的效果" : pendingReason;
      const finishLocked = (reason, quickEnabled = false) => {
        setMainButtons(false, reason);
        setQuickActionButtonEnabled(quickEnabled, reason);
        updateQuickPanel();
        context.renderActionEffectBar();
      };
      if (locks.tech || locks.discard || locks.play || locks.move) return finishLocked(selectionReason);
      if (locks.card || locks.handScan) return finishLocked(effectReason || selectionReason);
      if (locks.subFlow) return finishLocked("请先完成或取消当前流程");
      if (locks.effect || context.isActionPending() || locks.history) {
        return finishLocked(pendingReason, !context.isInitialIncomeFlowActive());
      }

      const currentPlayer = context.getCurrentPlayer();
      const launch = context.actions.canExecute("launch", actionContext);
      const orbit = context.abilities.planet.getOrbitOptions(actionContext);
      const land = context.abilities.planet.getLandOptions(actionContext);
      const plutoOrbit = context.getAvailablePlutoAction("orbit");
      const plutoLand = context.getAvailablePlutoAction("land");
      const research = context.actions.canExecute("researchTech", actionContext);
      const analyze = context.canAnalyzeDataForPlayer(currentPlayer);
      const scan = context.scanEffects.canExecuteScan(currentPlayer, { standardAction: true });
      const playBlock = context.getStandardPlayCardActionBlockReason(currentPlayer);
      const canPlay = !playBlock && (Boolean(currentPlayer?.hand?.length) || context.hasPlayableFutureSpanCard(currentPlayer));
      setActionButtonState(els.actionLaunchButton, launch.ok, launch.message);
      setActionButtonState(els.actionOrbitButton, orbit.ok || plutoOrbit.ok, orbit.ok ? orbit.message : (orbit.message || plutoOrbit.message));
      setActionButtonState(els.actionLandButton, land.ok || plutoLand.ok, land.ok ? land.message : (land.message || plutoLand.message));
      setActionButtonState(els.actionScanButton, scan.ok, scan.message);
      setActionButtonState(els.actionAnalyzeButton, analyze.ok, analyze.message);
      setActionButtonState(els.actionPlayCardButton, canPlay, canPlay ? "" : (playBlock || "没有手牌可打出"));
      setActionButtonState(els.actionResearchTechButton, research.ok, research.message);
      setQuickActionButtonEnabled(true);
      updateQuickPanel();
      context.renderActionEffectBar();
    }

    return Object.freeze({
      setActionButtonState, setTurnActionButtonState, setQuickActionButtonEnabled,
      updateActionButtons, isQuickPanelOpen, setQuickPanelOpen, toggleQuickPanel, updateQuickPanel,
    });
  }

  function createLegacyUndoController(context = {}) {
    const {
      actionHistory,
      quickActionHistory,
      HISTORY_SOURCE_MAIN,
      HISTORY_SOURCE_QUICK,
      uiRuntimeState,
    } = context;

    function restoreCompletedEffectFlow(workingRoot, result, source) {
      const completedFlow = !context.getActionEffectFlow(workingRoot)
        ? context.takeCompletedEffectFlowForUndo(result.step, source)
        : null;
      if (completedFlow) {
        context.setActionEffectFlow(workingRoot, completedFlow);
        context.setActionEffectFlowActive(true);
      }
      return completedFlow;
    }

    function undoPendingActionForRoot(workingRoot) {
      if (context.isTechActionSelectionActive()) {
        const isResearchTechFlow = context.getActionEffectFlow(workingRoot)?.actionType === "researchTech";
        const shouldUseHistoryUndo = isResearchTechFlow
          && (actionHistory.hasUndoableStep() || context.hasCurrentMainActionIrreversibleBarrier());
        if (shouldUseHistoryUndo) {
          if (workingRoot.techGameState.ui.pendingTileId) {
            context.cancelPendingResearchTechTileChoice();
            return;
          }
        } else {
          context.cancelTechSelection();
          return;
        }
      }
      if (
        !context.isActionPending()
        && !context.isActionEffectFlowActive()
        && !actionHistory.hasUndoableStep()
        && !quickActionHistory.hasUndoableStep()
      ) return;

      if (context.hasActivePendingSubFlow()) {
        context.cancelActivePendingSubFlowsForRoot(workingRoot);
        context.refreshAfterHistoryChange();
        return;
      }

      const latestUndoSource = context.getLatestUndoSource();
      const quickFlow = context.getActionEffectFlow(workingRoot);
      if (
        !latestUndoSource
        && quickFlow?.historySource === HISTORY_SOURCE_QUICK
        && !quickFlow.preHistoryCommandsApplied
        && quickFlow.preHistoryCommands?.length
      ) {
        const flowLabel = quickFlow.label || "快速行动效果";
        for (let index = quickFlow.preHistoryCommands.length - 1; index >= 0; index -= 1) {
          quickFlow.preHistoryCommands[index]?.undo?.();
        }
        uiRuntimeState.effectStepActive = false;
        if (quickActionHistory.hasSession() && !quickActionHistory.hasUndoableStep()) {
          quickActionHistory.commitSession();
          context.clearHistoryStepOrderForSource(HISTORY_SOURCE_QUICK);
        }
        context.clearActionEffectFlow(workingRoot);
        context.refreshAfterHistoryChange(`已撤销：${flowLabel}`);
        return;
      }

      if (latestUndoSource === HISTORY_SOURCE_QUICK) {
        const undoingQuickEffectFlow = context.getActionEffectFlow(workingRoot)?.historySource === HISTORY_SOURCE_QUICK;
        const result = quickActionHistory.undoLastStep();
        if (result.ok) {
          uiRuntimeState.effectStepActive = false;
          context.forgetLastHistoryStep(HISTORY_SOURCE_QUICK, result.step?.id || null);
          context.removeLastActionLogStep(HISTORY_SOURCE_QUICK, result.step?.id || null);
          const completedQuickEffectFlow = restoreCompletedEffectFlow(workingRoot, result, HISTORY_SOURCE_QUICK);
          if ((undoingQuickEffectFlow || completedQuickEffectFlow) && context.getActionEffectFlow(workingRoot)) {
            const effectIndex = result.step?.effectIndex;
            const hasRevertibleEffectStep = Number.isInteger(effectIndex)
              && Boolean(context.getActionEffectFlow(workingRoot).effects?.[effectIndex]);
            if (hasRevertibleEffectStep) context.revertEffectFlowAfterUndo(workingRoot, result.step);
            else context.clearActionEffectFlow(workingRoot);
          }
        }
        if (result.ok && !quickActionHistory.hasUndoableStep() && !context.isActionEffectFlowActive()) {
          quickActionHistory.commitSession();
          context.clearHistoryStepOrderForSource(HISTORY_SOURCE_QUICK);
        }
        context.refreshAfterHistoryChange(result.ok ? result.message : "已撤销快速行动");
        return;
      }

      const mainActionHasIrreversibleBarrier = context.hasCurrentMainActionIrreversibleBarrier();
      if ((!latestUndoSource && mainActionHasIrreversibleBarrier)
        || (mainActionHasIrreversibleBarrier && !actionHistory.hasUndoableStep())) {
        const irreversibleReason = context.getCurrentActionIrreversibleReason();
        workingRoot.rocketState.statusNote = irreversibleReason
          ? `不可撤销：${irreversibleReason}`
          : "当前行动已有不可撤销影响";
        context.updateActionButtons();
        context.renderStateReadout();
        return;
      }

      if (
        latestUndoSource === HISTORY_SOURCE_MAIN
        && mainActionHasIrreversibleBarrier
        && actionHistory.hasUndoableStep()
      ) {
        const result = actionHistory.undoLastStep();
        if (result.ok) {
          uiRuntimeState.effectStepActive = false;
          context.forgetLastHistoryStep(HISTORY_SOURCE_MAIN, result.step?.id || null);
          context.removeLastActionLogStep(HISTORY_SOURCE_MAIN, result.step?.id || null);
          restoreCompletedEffectFlow(workingRoot, result, HISTORY_SOURCE_MAIN);
          context.revertEffectFlowAfterUndo(workingRoot, result.step);
        }
        context.refreshAfterHistoryChange(result.ok ? result.message : result.message || "当前行动不能撤销");
        return;
      }

      if (context.isActionEffectFlowActive() && actionHistory.hasUndoableStep()) {
        const result = actionHistory.undoLastStep();
        if (result.ok) {
          uiRuntimeState.effectStepActive = false;
          context.forgetLastHistoryStep(HISTORY_SOURCE_MAIN, result.step?.id || null);
          context.removeLastActionLogStep(HISTORY_SOURCE_MAIN, result.step?.id || null);
          context.revertEffectFlowAfterUndo(workingRoot, result.step);
          if (!context.isActionEffectFlowActive()) context.clearFullyUndoneMainActionSession();
          context.refreshAfterHistoryChange(result.message);
          return;
        }
      }

      const completedMainFlowUndoStep = actionHistory.peekLastUndoableStep?.() || null;
      if (
        latestUndoSource === HISTORY_SOURCE_MAIN
        && !context.isActionEffectFlowActive()
        && context.peekCompletedEffectFlowForUndo(completedMainFlowUndoStep, HISTORY_SOURCE_MAIN)
        && actionHistory.hasUndoableStep()
      ) {
        const result = actionHistory.undoLastStep();
        if (result.ok) {
          uiRuntimeState.effectStepActive = false;
          context.forgetLastHistoryStep(HISTORY_SOURCE_MAIN, result.step?.id || null);
          context.removeLastActionLogStep(HISTORY_SOURCE_MAIN, result.step?.id || null);
          const completedMainEffectFlow = context.takeCompletedEffectFlowForUndo(result.step, HISTORY_SOURCE_MAIN);
          if (completedMainEffectFlow) {
            context.setActionEffectFlow(workingRoot, completedMainEffectFlow);
            context.setActionEffectFlowActive(true);
            context.revertEffectFlowAfterUndo(workingRoot, result.step);
          }
          if (!context.isActionEffectFlowActive()) context.clearFullyUndoneMainActionSession();
        }
        context.refreshAfterHistoryChange(result.ok ? result.message : result.message || "已撤销效果");
        return;
      }

      if (context.isActionPending() || actionHistory.hasSession()) {
        const result = actionHistory.rollbackSession();
        if (result.ok) {
          uiRuntimeState.effectStepActive = false;
          context.clearHistoryStepOrderForSource(HISTORY_SOURCE_MAIN);
          context.removeActionLogStepsBySource(HISTORY_SOURCE_MAIN);
          context.clearActionEffectFlow(workingRoot);
          context.clearActionPending();
        }
        context.refreshAfterHistoryChange(result.ok ? result.message : result.message || "当前行动不能撤销");
      }
    }

    return Object.freeze({ undoPendingActionForRoot });
  }

  function createLegacyActionSessionRuntime(context = {}) {
    const { actionHistory, uiRuntimeState, historySourceMain } = context;

    function markActionPending() {
      actionHistory.markActionComplete?.();
    }

    function isActionPending() {
      return Boolean(actionHistory.isActionComplete?.());
    }

    function getIrreversibleReason(result, fallback = "该步骤产生不可撤销影响") {
      if (result?.irreversible?.reason) return String(result.irreversible.reason);
      if (result?.irreversibleReason) return String(result.irreversibleReason);
      if (result?.undoable === false) return result.message || fallback;
      return null;
    }

    function getCurrentActionIrreversibleReason() {
      return actionHistory.getIrreversibleBarrier?.()?.irreversibleReason || null;
    }

    function markCurrentActionIrreversible(reason, code = "irreversible") {
      const barrierReason = reason || getCurrentActionIrreversibleReason() || "该步骤产生不可撤销影响";
      actionHistory.markIrreversible?.({
        source: historySourceMain,
        code,
        irreversibleReason: barrierReason,
      });
      return { code, reason: barrierReason };
    }

    function markResultIrreversible(result, reason, code = "irreversible") {
      if (!result) return result;
      result.undoable = false;
      result.irreversible = {
        code,
        reason: reason || result.irreversible?.reason || result.message || "该步骤产生不可撤销影响",
      };
      markCurrentActionIrreversible(result.irreversible.reason, result.irreversible.code);
      return result;
    }

    function getAlienCardGainIrreversible(result) {
      return result?.card
        ? { code: "hidden_alien_card_reveal", reason: "外星人牌获取翻开新牌" }
        : null;
    }

    function clearActionPending() {
      context.clearCompletedEffectFlowForUndo(historySourceMain);
    }

    function isMainActionOpeningStep(step) {
      return step?.source === historySourceMain
        && (step.type === "action_start" || step.type === "action-cost" || step.effectIndex === -1);
    }

    function clearFullyUndoneMainActionSession() {
      const info = actionHistory.getSessionInfo?.();
      if (!info || info.stepCount !== 0 || actionHistory.hasUndoableStep()) return false;
      uiRuntimeState.effectStepActive = false;
      actionHistory.commitSession();
      context.clearHistoryStepOrderForSource(historySourceMain);
      clearActionPending();
      context.pruneEmptyActionLogDraft();
      context.renderActionLog();
      return true;
    }

    function clearStaleFullyUndoneMainActionSession() {
      if (!actionHistory.hasSession()
        || isActionPending()
        || context.isActionEffectFlowActive()
        || actionHistory.hasUndoableStep()) return false;
      const info = actionHistory.getSessionInfo?.();
      if (!info || info.stepCount !== 0) return false;
      clearFullyUndoneMainActionSession();
      return true;
    }

    function hasCurrentMainActionIrreversibleBarrier() {
      return Boolean(actionHistory.hasIrreversibleBarrier?.());
    }

    function canUndoCurrentMainAction() {
      if (actionHistory.hasUndoableStep()) return true;
      if (hasCurrentMainActionIrreversibleBarrier()) return false;
      return Boolean(isActionPending() || context.isActionEffectFlowActive());
    }

    function getMainActionStartBlockReason(workingRoot = null) {
      const gameplayLockReason = context.getGameplayLockReason(workingRoot);
      if (gameplayLockReason) return gameplayLockReason;
      if (isActionPending()) return "请先回合结束或撤销当前行动";
      if (context.isActionEffectFlowActive(workingRoot)) return "请先完成当前行动的效果";
      if (actionHistory.hasSession()) return "请先回合结束或撤销当前行动";
      if (context.hasActivePendingSubFlow(workingRoot)) return "请先完成或取消当前流程";
      return null;
    }

    function canStartMainAction(workingRoot = null) {
      return !getMainActionStartBlockReason(workingRoot);
    }

    return Object.freeze({
      markActionPending,
      isActionPending,
      getIrreversibleReason,
      markCurrentActionIrreversible,
      getCurrentActionIrreversibleReason,
      markResultIrreversible,
      getAlienCardGainIrreversible,
      clearActionPending,
      isMainActionOpeningStep,
      clearFullyUndoneMainActionSession,
      clearStaleFullyUndoneMainActionSession,
      canUndoCurrentMainAction,
      hasCurrentMainActionIrreversibleBarrier,
      getMainActionStartBlockReason,
      canStartMainAction,
    });
  }

  function createLegacyEffectBarRenderer(options = {}) {
    const { document, els = {} } = options;
    function render(model = {}) {
      if (!els.actionEffectBar || !els.actionEffectList) return;
      const flow = model.flow || null;
      if (!flow) {
        els.actionEffectBar.hidden = true;
        els.actionEffectList.replaceChildren();
        if (els.actionEffectSkipButton) els.actionEffectSkipButton.hidden = true;
        return;
      }
      const current = model.current || null;
      const canSkip = current?.status === "active" && current.options?.skippable !== false && !current.required;
      if (els.actionEffectSkipButton) {
        const finishingCardMove = Boolean(
          canSkip && model.cardMove?.effectId === current?.id && (model.cardMove.moved || current?.result),
        );
        els.actionEffectSkipButton.textContent = finishingCardMove ? "结束移动" : "跳过";
        els.actionEffectSkipButton.setAttribute("aria-label", finishingCardMove ? "结束当前卡牌移动" : "跳过当前效果");
        els.actionEffectSkipButton.title = finishingCardMove
          ? "结束剩余移动力并结算已产生的访问触发" : "跳过当前效果";
        els.actionEffectSkipButton.hidden = !canSkip;
        els.actionEffectSkipButton.disabled = !canSkip;
      }
      const visibleEffects = (flow.effects || [])
        .map((effect, index) => ({ effect, index }))
        .filter(({ effect }) => model.shouldRender(effect));
      if (!visibleEffects.length) {
        els.actionEffectBar.hidden = true;
        els.actionEffectList.replaceChildren();
        return;
      }
      els.actionEffectBar.hidden = false;
      els.actionEffectList.replaceChildren(...visibleEffects.map(({ effect, index }) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "action-effect-button";
        button.dataset.effectIndex = String(index);
        const tooltip = model.getTooltip(effect);
        button.title = tooltip;
        button.setAttribute("aria-label", tooltip);
        button.disabled = effect.status !== "active";
        button.classList.toggle("is-active", effect.status === "active");
        button.classList.toggle("is-completed", effect.status === "completed");
        button.classList.toggle("is-skipped", effect.status === "skipped");
        button.classList.toggle("is-undoable", effect.status === "completed" && effect.undoable !== false);
        const image = document.createElement("img");
        image.src = model.getIcon(effect);
        image.alt = "";
        image.setAttribute("aria-hidden", "true");
        button.append(image);
        const badgeText = effect.badge || (
          model.cardMove?.effectId === effect.id && effect.status === "active"
            ? String(model.cardMove.poolRemaining) : null
        );
        if (badgeText != null) {
          const badge = document.createElement("span");
          badge.className = "action-effect-badge";
          badge.textContent = badgeText;
          button.append(badge);
        }
        return button;
      }));
    }
    return Object.freeze({ render });
  }

  function createLegacyEffectBarPresentation(context = {}) {
    const renderer = createLegacyEffectBarRenderer({ document: context.document, els: context.els });

    function normalizeResourceCost(cost) {
      if (!cost || typeof cost !== "object" || Array.isArray(cost)) return null;
      const normalized = Object.fromEntries(
        Object.entries(cost)
          .filter(([, value]) => Number.isFinite(Number(value)) && Number(value) > 0)
          .map(([key, value]) => [key, Math.round(Number(value))]),
      );
      return Object.keys(normalized).length ? normalized : null;
    }

    function getCost(effect) {
      return normalizeResourceCost(effect?.options?.cost);
    }

    function getCostText(effect) {
      const cost = getCost(effect);
      return cost ? context.players.formatResourceCost(cost) : "";
    }

    function getTooltip(effect) {
      const parts = [effect?.label || "效果"];
      const costText = getCostText(effect);
      if (costText) parts.push(`消耗：${costText}`);
      if (effect?.status === "completed" && effect.undoable !== false) parts.push("可撤销");
      return parts.join("；");
    }

    function getIconSrc(iconId) {
      if (context.runezu?.SYMBOL_IDS?.includes(iconId)) return context.runezu.getSymbolSrc(iconId);
      return context.scanEffectIcons?.[iconId]
        || context.planetRewardEffectIcons?.[iconId]
        || context.techEffectIcons?.[iconId]
        || context.cardEffectIcons?.[iconId]
        || context.resourceIconSrc?.[iconId]
        || "";
    }

    function getDisplayIconSrc(effect) {
      if (context.jiuzheThresholdCardEffectType
        && effect?.type === context.jiuzheThresholdCardEffectType) return context.jiuzhe?.CARD_BACK_SRC || "";
      if (context.banrenmaPanelBonusEffectType
        && effect?.type === context.banrenmaPanelBonusEffectType) {
        const player = context.resolvePlayerReference(effect.options || effect) || context.getEffectOwnerPlayer(effect);
        return context.banrenma?.getPlayerMarkSrc?.(player?.color || effect.options?.playerColor)
          || context.resourceIconSrc?.banrenmaToken
          || "";
      }
      return getIconSrc(getCostText(effect) ? "cost" : effect?.icon);
    }

    function shouldRender(effect) {
      if (context.getActionEffectFlow()?.actionType !== "initialIncome") return true;
      const owner = context.getEffectOwnerPlayer(effect);
      return !owner?.id || !context.isAiPlayer(owner.id);
    }

    function render() {
      renderer.render({
        flow: context.getActionEffectFlow(),
        current: context.getCurrentActionEffect(),
        cardMove: context.getPendingCardMoveDecision(),
        shouldRender,
        getTooltip,
        getIcon: getDisplayIconSrc,
      });
    }

    return Object.freeze({
      getCost,
      getCostText,
      getDisplayIconSrc,
      getTooltip,
      normalizeResourceCost,
      render,
      shouldRender,
    });
  }

  function createLegacyActionBarPort(context = {}) {
    const methods = [
      "setActionButtonState", "setTurnActionButtonState", "setQuickActionButtonEnabled",
      "updateActionButtons", "isQuickPanelOpen", "setQuickPanelOpen", "toggleQuickPanel", "updateQuickPanel",
    ];
    return Object.freeze(Object.fromEntries(methods.map((name) => [
      name,
      (...args) => context.getController()?.[name](...args),
    ])));
  }

  return Object.freeze({
    createActionBarModel,
    createActionBarController,
    createActionBarRenderer,
    createLegacyActionBarController,
    createLegacyUndoController,
    createLegacyActionSessionRuntime,
    createLegacyEffectBarRenderer,
    createLegacyEffectBarPresentation,
    createLegacyActionBarPort,
  });
});
