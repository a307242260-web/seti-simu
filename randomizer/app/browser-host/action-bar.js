(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserActionBar = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";
  function createActionBarOwnerInputPorts(registry, context = {}) {
    return Object.freeze({
      quickAction: registry.register("quick_action", {
        checkPending: (workingRoot, command) => ({
          ok: true,
          value: context.clonePresentation(
            context.checkPending(workingRoot, command.actionType ?? command.args?.[0]),
          ),
        }),
      }),
      history: registry.register("history", {
        undoPending: (workingRoot) => ({
          ok: true,
          value: context.clonePresentation(context.undoPending(workingRoot)),
        }),
      }),
    });
  }



  const STANDARD_ACTION_SCHEMA = "seti-standard-action-v1";
  const BROWSER_PROJECTION_SCHEMA = "seti-browser-host-v1";
  const ACTION_BAR_PROJECTION_SCHEMA = "seti-action-bar-projection-v1";
  const BROWSER_PROJECTION_KEYS = Object.freeze([
    "schemaVersion", "projectionId", "source", "viewer", "match", "board", "players",
    "cards", "tech", "aliens", "resident", "controls", "decision", "feedback",
  ]);
  const ACTION_KEYS = Object.freeze([
    "schemaVersion", "actionId", "family", "phase", "actorId", "stateVersion",
    "decisionVersion", "target", "payload", "summary", "disabledReason",
  ]);

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function fail(code, message, details = {}) {
    return { ok: false, code, message, ...clone(details) };
  }

  function deepFreeze(value) {
    if (value == null || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
  }

  function assertExactKeys(value, allowedKeys, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(`${label} 必须是对象`);
    }
    const unknownKeys = Object.keys(value).filter((key) => !allowedKeys.includes(key));
    if (unknownKeys.length) {
      throw new TypeError(`${label} 含伪造字段：${unknownKeys.join(", ")}`);
    }
  }

  function assertDeepFrozen(value, label) {
    if (value == null || typeof value !== "object") return;
    if (!Object.isFrozen(value)) throw new TypeError(`${label} 必须深冻结`);
    for (const child of Object.values(value)) assertDeepFrozen(child, label);
  }

  function normalizeProjectedAction(action) {
    assertExactKeys(action, ACTION_KEYS, "Action Bar Standard Action");
    if (action.schemaVersion !== STANDARD_ACTION_SCHEMA
      || !action.actionId || !action.family || !action.phase || !action.actorId
      || !Number.isSafeInteger(action.stateVersion)
      || !Number.isSafeInteger(action.decisionVersion)) {
      throw new TypeError("Action Bar Standard Action identity 不完整");
    }
    return deepFreeze({
      schemaVersion: STANDARD_ACTION_SCHEMA,
      actionId: String(action.actionId),
      family: String(action.family),
      phase: String(action.phase),
      actorId: String(action.actorId),
      stateVersion: action.stateVersion,
      decisionVersion: action.decisionVersion,
      target: clone(action.target ?? null),
      payload: clone(action.payload || {}),
      summary: action.summary || action.family,
      disabledReason: action.disabledReason || null,
    });
  }

  function selectActionBarProjection(browserProjection, options = {}) {
    assertExactKeys(browserProjection, BROWSER_PROJECTION_KEYS, "BrowserProjection");
    if (browserProjection.schemaVersion !== BROWSER_PROJECTION_SCHEMA) {
      throw new TypeError(`Action Bar 只接受 ${BROWSER_PROJECTION_SCHEMA} BrowserProjection`);
    }
    assertDeepFrozen(browserProjection, "BrowserProjection");
    if (!browserProjection.projectionId || !browserProjection.source?.kind
      || !Number.isSafeInteger(browserProjection.source.stateVersion)
      || !browserProjection.viewer?.viewerId
      || browserProjection.match?.currentPlayerId == null) {
      throw new TypeError("Action Bar BrowserProjection identity 不完整");
    }
    const inspection = options.inspection || null;
    const sessionInspection = inspection?.session || null;
    if (sessionInspection && (
      sessionInspection.sessionId !== browserProjection.source.sessionId
      || sessionInspection.revision !== browserProjection.source.sessionRevision
    )) {
      throw new TypeError("Action Bar BrowserProjection 与 Composition inspection 不一致");
    }
    const actions = (browserProjection.controls?.actions || []).map(normalizeProjectedAction);
    const quickActions = (browserProjection.controls?.quickActions || []).map(normalizeProjectedAction);
    const inspectionControls = sessionInspection?.controls || null;
    const canUndo = inspectionControls
      ? inspectionControls.canUndo === true
      : options.canUndo === true;
    return deepFreeze({
      schemaVersion: ACTION_BAR_PROJECTION_SCHEMA,
      projectionId: String(browserProjection.projectionId),
      source: {
        kind: String(browserProjection.source.kind),
        stateVersion: browserProjection.source.stateVersion,
        sessionId: browserProjection.source.sessionId ?? null,
        sessionRevision: browserProjection.source.sessionRevision ?? null,
      },
      seat: {
        currentPlayerId: String(browserProjection.match.currentPlayerId),
        viewerPlayerId: browserProjection.viewer.playerId == null
          ? null : String(browserProjection.viewer.playerId),
        machineControlled: options.machineControlled === true,
        automationPaused: options.automationPaused === true,
      },
      controls: {
        actions,
        quickActions,
        canUndo,
        undoDisabledReason: canUndo
          ? null
          : (inspectionControls?.undoDisabledReason
            || browserProjection.controls?.undoDisabledReason
            || options.undoDisabledReason
            || "没有可撤销的 Effect"),
      },
      feedback: {
        progress: clone(sessionInspection?.progress || browserProjection.feedback?.progress || null),
      },
    });
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

  function createDesktopActionBarController(context = {}) {
    const { els } = context;
    if (typeof context.getProjection !== "function") {
      throw new TypeError("DesktopActionBar 需要 Action Bar projection selector");
    }
    if (typeof context.dispatchIntent !== "function") {
      throw new TypeError("DesktopActionBar 需要 BrowserInputAdapter dispatchIntent()");
    }
    const mainButtons = [
      els.actionLaunchButton, els.actionOrbitButton, els.actionLandButton, els.actionScanButton,
      els.actionAnalyzeButton, els.actionPlayCardButton, els.actionResearchTechButton,
    ];
    const mainFamilies = new Map([
      [els.actionLaunchButton, "launch"],
      [els.actionOrbitButton, "orbit"],
      [els.actionLandButton, "land"],
      [els.actionScanButton, "scan"],
      [els.actionAnalyzeButton, "analyze"],
      [els.actionPlayCardButton, "play_card"],
      [els.actionResearchTechButton, "research_tech"],
    ]);
    let projection = null;

    function readProjection() {
      const nextProjection = context.getProjection();
      if (!nextProjection || nextProjection.schemaVersion !== ACTION_BAR_PROJECTION_SCHEMA) {
        throw new TypeError("DesktopActionBar selector 未返回冻结 Action Bar DTO");
      }
      assertDeepFrozen(nextProjection, "Action Bar DTO");
      projection = nextProjection;
      return projection;
    }

    function listActions(model = projection) {
      return [
        ...(model?.controls?.actions || []),
        ...(model?.controls?.quickActions || []),
      ];
    }

    function matchesSelector(action, selector = {}) {
      return Object.entries(selector).every(([key, value]) => (
        JSON.stringify(action.target?.[key]) === JSON.stringify(value)
        || JSON.stringify(action.payload?.[key]) === JSON.stringify(value)
      ));
    }

    function activateAction(actionId) {
      const action = listActions(readProjection()).find((candidate) => (
        String(candidate.actionId) === String(actionId)
      ));
      if (!action) {
        return fail("ACTION_BAR_ACTION_STALE", "actionId 不在当前 Action Bar DTO 中", { actionId });
      }
      if (action.disabledReason) {
        return fail("ACTION_BAR_ACTION_DISABLED", action.disabledReason, { actionId });
      }
      return context.dispatchIntent({ kind: "action", action: clone(action) });
    }

    function activateFamily(family, selector = {}) {
      const matches = listActions(readProjection()).filter((action) => (
        action.family === family && !action.disabledReason && matchesSelector(action, selector)
      ));
      if (matches.length !== 1) {
        return fail(
          matches.length ? "ACTION_BAR_ACTION_AMBIGUOUS" : "ACTION_BAR_ACTION_NOT_LEGAL",
          matches.length ? `${family} 当前有多个合法 Action` : `${family} 当前没有合法 Action`,
          { family },
        );
      }
      return activateAction(matches[0].actionId);
    }

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

    function isQuickPanelOpen() {
      return !els.quickActionsPanel.hidden;
    }

    function updateQuickPanel() {
      if (!isQuickPanelOpen()) return;
      const model = readProjection();
      els.quickActionsTrades.querySelectorAll("[data-quick-trade]").forEach((button) => {
        const action = model.controls.quickActions.find((candidate) => (
          candidate.family === "quick_trade"
          && !candidate.disabledReason
          && String(candidate.target?.tradeId) === String(button.dataset.quickTrade)
        ));
        button.disabled = !action;
        button.title = action ? "" : "当前无法兑换";
        button.dataset.actionId = action?.actionId || "";
      });
    }

    function setQuickPanelOpen(open) {
      const model = readProjection();
      const machineLocked = model.seat.machineControlled && !model.seat.automationPaused;
      if (open && (machineLocked || !model.controls.quickActions.some((action) => !action.disabledReason))) return;
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
      const model = readProjection();
      const machineLocked = model.seat.machineControlled && !model.seat.automationPaused;
      const lockReason = machineLocked ? "电脑玩家自动行动中" : "当前无法执行此行动";
      for (const button of mainButtons) {
        const family = mainFamilies.get(button);
        const enabled = !machineLocked && model.controls.actions.some((action) => (
          action.family === family && !action.disabledReason
        ));
        setActionButtonState(button, enabled, enabled ? "" : lockReason);
      }
      const passEnabled = !machineLocked
        && model.controls.actions.some((action) => action.family === "pass" && !action.disabledReason);
      const endTurnEnabled = !machineLocked
        && model.controls.actions.some((action) => action.family === "end_turn" && !action.disabledReason);
      setTurnActionButtonState(els.actionPassButton, passEnabled);
      setTurnActionButtonState(els.actionConfirmButton, endTurnEnabled, endTurnEnabled);
      setTurnActionButtonState(els.actionUndoButton, !machineLocked && model.controls.canUndo);
      setQuickActionButtonEnabled(
        !machineLocked && model.controls.quickActions.some((action) => !action.disabledReason),
        machineLocked ? lockReason : "当前没有可执行的快速行动",
      );
      updateQuickPanel();
      return model;
    }

    return Object.freeze({
      setActionButtonState, setTurnActionButtonState, setQuickActionButtonEnabled,
      updateActionButtons, isQuickPanelOpen, setQuickPanelOpen, toggleQuickPanel, updateQuickPanel,
      activateAction, activateFamily,
    });
  }

  function createBrowserDesktopActionBarController(options = {}) {
    const { projectionPort, inputPort, hostPort } = options;
    const owners = { projectionPort, inputPort, hostPort };
    for (const [name, owner] of Object.entries(owners)) {
      if (!owner || typeof owner !== "object") {
        throw new TypeError(`DesktopActionBar bootstrap 缺少 owner：${name}`);
      }
    }
    return createDesktopActionBarController({
      ...hostPort,
      getProjection: projectionPort.getProjection,
      dispatchIntent: inputPort.dispatchIntent,
    });
  }

  function createUndoController(context = {}) {
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

  function createBrowserUndoController(options = {}) {
    const {
      actionGuardRuntime,
      actionSessionRuntime,
      effectFlowRuntime,
      effectFlowUndoRuntime,
      historyRefreshRuntime,
      matchRuntime,
      pendingSubFlowRuntime,
      techRuntime,
      hostPort,
    } = options;
    const owners = {
      actionGuardRuntime,
      actionSessionRuntime,
      effectFlowRuntime,
      effectFlowUndoRuntime,
      historyRefreshRuntime,
      matchRuntime,
      pendingSubFlowRuntime,
      techRuntime,
      hostPort,
    };
    for (const [name, owner] of Object.entries(owners)) {
      if (!owner || typeof owner !== "object") {
        throw new TypeError(`Undo bootstrap 缺少 owner：${name}`);
      }
    }
    const capability = (ownerName, name) => {
      const value = owners[ownerName][name];
      if (typeof value !== "function") {
        throw new TypeError(`Undo ${ownerName} 缺少能力：${name}`);
      }
      return value;
    };
    return createUndoController({
      ...hostPort,
      isTechActionSelectionActive: capability("techRuntime", "isTechActionSelectionActive"),
      cancelPendingResearchTechTileChoice: capability(
        "techRuntime",
        "cancelPendingResearchTechTileChoice",
      ),
      cancelTechSelection: capability("techRuntime", "cancelTechSelection"),
      hasCurrentMainActionIrreversibleBarrier: capability(
        "actionSessionRuntime",
        "hasCurrentMainActionIrreversibleBarrier",
      ),
      isActionPending: capability("actionSessionRuntime", "isActionPending"),
      getCurrentActionIrreversibleReason: capability(
        "actionSessionRuntime",
        "getCurrentActionIrreversibleReason",
      ),
      clearFullyUndoneMainActionSession: capability(
        "actionSessionRuntime",
        "clearFullyUndoneMainActionSession",
      ),
      clearActionPending: capability("actionSessionRuntime", "clearActionPending"),
      isActionEffectFlowActive: capability("actionGuardRuntime", "isActionEffectFlowActive"),
      hasActivePendingSubFlow: capability("pendingSubFlowRuntime", "hasActivePendingSubFlow"),
      cancelActivePendingSubFlowsForRoot: capability(
        "pendingSubFlowRuntime",
        "cancelActivePendingSubFlowsForRoot",
      ),
      refreshAfterHistoryChange: capability(
        "historyRefreshRuntime",
        "refreshAfterHistoryChange",
      ),
      getActionEffectFlow: capability("matchRuntime", "getActionEffectFlow"),
      setActionEffectFlow: capability("matchRuntime", "setActionEffectFlow"),
      getLatestUndoSource: capability("effectFlowRuntime", "getLatestUndoSource"),
      clearHistoryStepOrderForSource: capability(
        "effectFlowRuntime",
        "clearHistoryStepOrderForSource",
      ),
      forgetLastHistoryStep: capability("effectFlowRuntime", "forgetLastHistoryStep"),
      revertEffectFlowAfterUndo: capability("effectFlowUndoRuntime", "revertEffectFlowAfterUndo"),
    });
  }

  function createActionSessionRuntime(context = {}) {
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

  function createEffectBarRenderer(options = {}) {
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

  function createEffectBarPresentation(context = {}) {
    const renderer = createEffectBarRenderer({ document: context.document, els: context.els });

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

  function createActionGuardRuntime(context = {}) {
    function isActionEffectFlowActive(workingRoot = null) {
      return context.getActionEffectFlow(workingRoot) != null;
    }

    function isInitialIncomeFlowActive(workingRoot = null) {
      return context.getActionEffectFlow(workingRoot)?.actionType === "initialIncome";
    }

    function getGameplayLockReason(workingRoot = null) {
      if (context.isGameEnded(workingRoot)) return "游戏已结束，正在进行终局计分";
      if (context.isInitialSelectionActive()) return "请先完成初始选择";
      if (isInitialIncomeFlowActive(workingRoot)) return "请先完成初始收入增加";
      return null;
    }

    function lockAllActionButtons(reason) {
      context.setTurnActionButtonState(context.els.actionPassButton, false);
      context.setTurnActionButtonState(context.els.actionConfirmButton, false);
      context.setTurnActionButtonState(context.els.actionUndoButton, false);
      for (const button of [
        context.els.actionLaunchButton,
        context.els.actionOrbitButton,
        context.els.actionLandButton,
        context.els.actionScanButton,
        context.els.actionAnalyzeButton,
        context.els.actionPlayCardButton,
        context.els.actionResearchTechButton,
      ]) context.setActionButtonState(button, false, reason);
      context.setQuickActionButtonEnabled(false, reason);
      context.updateQuickPanel();
      context.renderActionEffectBar();
    }

    function blockIncompatiblePendingQuickActionForRoot(workingRoot, actionType) {
      if (actionType !== "card-corner" && context.getPendingCardCornerQuickAction()) {
        context.cancelCardCornerQuickAction({ silent: true });
      }
      if (context.getPendingHandCardPlayAction()) {
        context.cancelHandCardPlayAction({ silent: true });
      }
      if (!context.hasActivePendingSubFlow()) return null;
      workingRoot.rocketState.statusNote = context.readPendingDecision("industry_ability")
        || context.readPendingDecision("industry_free_move")
        || context.isIndustryHandSelectionActive()
        ? "请先完成或取消公司 1x 行动"
        : "请先完成或取消当前流程";
      context.renderStateReadout();
      return { ok: false, message: workingRoot.rocketState.statusNote };
    }

    function blockIncompatiblePendingQuickAction(actionType) {
      return context.inputPort.checkPending(actionType);
    }

    return Object.freeze({
      isActionEffectFlowActive,
      isInitialIncomeFlowActive,
      getGameplayLockReason,
      lockAllActionButtons,
      blockIncompatiblePendingQuickActionForRoot,
      blockIncompatiblePendingQuickAction,
    });
  }

  function createHistoryRefreshRuntime(context = {}) {
    function refreshAfterHistoryChange(message) {
      context.renderSectorNebulaDataBoard();
      context.syncPlanetOrbitLandMarkers();
      context.renderPublicCards();
      context.updatePublicCardControls();
      context.refreshPlayerPanels();
      context.renderPlayerHand();
      context.renderReservedCards();
      context.renderInitialSelectionArea();
      context.clearStaleFullyUndoneMainActionSession();
      context.syncInteractionFocusChrome();
      if (message) context.setBrowserStatusNote(message);
      context.refreshActionState({ includeQuickPanel: false, includeStateReadout: true });
    }
    return Object.freeze({ refreshAfterHistoryChange });
  }

  function createPendingActionRecoveryRuntime(context = {}) {
    function recoverForRoot(workingRoot) {
      if (context.isActionPending()
        || context.isActionEffectFlowActive()
        || context.hasActivePendingSubFlow()
        || !context.actionHistory.hasSession()) {
        return { ok: false, message: "当前不需要恢复行动待结束状态" };
      }
      context.markActionPending();
      const info = context.actionHistory.getSessionInfo?.() || null;
      workingRoot.rocketState.statusNote = `${info?.label || "行动"}已恢复为待回合结束状态`;
      context.updateActionButtons();
      context.renderStateReadout();
      return { ok: true, message: workingRoot.rocketState.statusNote, sessionInfo: info };
    }
    return Object.freeze({ recoverForRoot });
  }

  function createUndoPort(context = {}) {
    return Object.freeze({
      undoForRoot: (...args) => context.getController().undoPendingActionForRoot(...args),
      undo: context.submitUndo,
    });
  }

  function createActionBarPort(context = {}) {
    const methods = [
      "setActionButtonState", "setTurnActionButtonState", "setQuickActionButtonEnabled",
      "updateActionButtons", "isQuickPanelOpen", "setQuickPanelOpen", "toggleQuickPanel", "updateQuickPanel",
      "activateAction", "activateFamily",
    ];
    return Object.freeze(Object.fromEntries(methods.map((name) => [
      name,
      (...args) => context.getController()?.[name](...args),
    ])));
  }

  return Object.freeze({
    createActionBarOwnerInputPorts,
    ACTION_BAR_PROJECTION_SCHEMA,
    selectActionBarProjection,
    createActionBarModel,
    createActionBarController,
    createActionBarRenderer,
    createDesktopActionBarController,
    createBrowserDesktopActionBarController,
    createUndoController,
    createBrowserUndoController,
    createActionSessionRuntime,
    createEffectBarRenderer,
    createEffectBarPresentation,
    createActionGuardRuntime,
    createHistoryRefreshRuntime,
    createPendingActionRecoveryRuntime,
    createUndoPort,
    createActionBarPort,
  });
});
