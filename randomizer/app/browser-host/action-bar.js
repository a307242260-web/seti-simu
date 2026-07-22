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

  return Object.freeze({
    createActionBarModel,
    createActionBarController,
    createActionBarRenderer,
    createLegacyActionBarController,
  });
});
