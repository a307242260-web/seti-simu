(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserActionBar = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const ACTION_BAR_PROJECTION_SCHEMA = "seti-action-bar-projection-v1";

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function deepFreeze(value) {
    if (value == null || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
  }

  function fail(code, message, details = {}) {
    return deepFreeze({ ok: false, code, message, ...clone(details) });
  }

  function selectActionBarProjection(browserProjection, options = {}) {
    if (browserProjection?.schemaVersion !== "seti-browser-host-v1"
      || !Object.isFrozen(browserProjection)) {
      throw new TypeError("Action Bar 只接受深冻结 BrowserProjection");
    }
    const session = options.inspection?.session || null;
    if (session && (
      session.sessionId !== browserProjection.source.sessionId
      || session.revision !== browserProjection.source.sessionRevision
    )) {
      throw new TypeError("Action Bar projection 与 Composition inspection 不一致");
    }
    const normalize = (action) => clone(action);
    return deepFreeze({
      schemaVersion: ACTION_BAR_PROJECTION_SCHEMA,
      projectionId: browserProjection.projectionId,
      source: clone(browserProjection.source),
      seat: {
        currentPlayerId: String(browserProjection.match.currentPlayerId),
        viewerPlayerId: browserProjection.viewer.playerId == null
          ? null : String(browserProjection.viewer.playerId),
        machineControlled: options.machineControlled === true,
        automationPaused: options.automationPaused === true,
      },
      controls: {
        actions: (browserProjection.controls?.actions || []).map(normalize),
        quickActions: (browserProjection.controls?.quickActions || []).map(normalize),
        canUndo: session?.controls?.canUndo === true || browserProjection.controls?.canUndo === true,
        undoDisabledReason: session?.controls?.undoDisabledReason
          || browserProjection.controls?.undoDisabledReason
          || "没有可撤销的 Effect",
      },
      feedback: {
        progress: clone(session?.progress || browserProjection.feedback?.progress || null),
      },
    });
  }

  function createActionBarModel(projection) {
    const actions = projection?.controls?.actions || [];
    const quickActions = projection?.controls?.quickActions || [];
    const normalize = (action) => ({
      actionId: action.actionId,
      family: action.family,
      phase: action.phase,
      label: action.summary || action.family,
      disabledReason: action.disabledReason || null,
    });
    return {
      projectionId: projection?.projectionId || null,
      source: clone(projection?.source || {}),
      mainActions: actions.filter((action) => !["pass", "end_turn"].includes(action.family)).map(normalize),
      quickActions: quickActions.map(normalize),
      pass: actions.find((action) => action.family === "pass") || null,
      endTurn: actions.find((action) => action.family === "end_turn") || null,
      undo: {
        enabled: projection?.controls?.canUndo === true,
        disabledReason: projection?.controls?.undoDisabledReason || "没有可撤销的 Effect",
      },
      progress: clone(projection?.feedback?.progress || null),
    };
  }

  function createActionBarController(options = {}) {
    if (typeof options.dispatchIntent !== "function" || typeof options.dispatchUndo !== "function") {
      throw new TypeError("Action Bar controller 缺少 Standard input/undo port");
    }
    let projection = null;
    function setProjection(next) {
      projection = next;
      return createActionBarModel(projection);
    }
    function activate(intent = {}) {
      if (intent.type === "undo") return options.dispatchUndo(clone(projection?.source || {}));
      const action = [
        ...(projection?.controls?.actions || []),
        ...(projection?.controls?.quickActions || []),
      ].find((candidate) => String(candidate.actionId) === String(intent.actionId));
      if (!action) return fail("ACTION_BAR_ACTION_STALE", "actionId 不在当前 projection 中");
      if (action.disabledReason) return fail("ACTION_BAR_ACTION_DISABLED", action.disabledReason);
      return options.dispatchIntent({ kind: "action", action: clone(action) });
    }
    return Object.freeze({ setProjection, createModel: () => createActionBarModel(projection), activate });
  }

  function createDesktopActionBarController(context = {}) {
    const { els } = context;
    if (typeof context.getProjection !== "function" || typeof context.dispatchIntent !== "function") {
      throw new TypeError("DesktopActionBar 缺少 projection/input port");
    }
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
    const read = () => {
      projection = context.getProjection();
      if (projection?.schemaVersion !== ACTION_BAR_PROJECTION_SCHEMA || !Object.isFrozen(projection)) {
        throw new TypeError("DesktopActionBar selector 未返回冻结 DTO");
      }
      return projection;
    };
    const list = () => [
      ...(projection?.controls?.actions || []),
      ...(projection?.controls?.quickActions || []),
    ];
    function activateAction(actionId) {
      read();
      const action = list().find((candidate) => String(candidate.actionId) === String(actionId));
      if (!action) return fail("ACTION_BAR_ACTION_STALE", "actionId 不在当前 DTO 中");
      return context.dispatchIntent({ kind: "action", action: clone(action) });
    }
    function setButton(button, action, reason) {
      if (!button) return;
      button.disabled = !action;
      button.dataset.actionId = action?.actionId || "";
      button.title = action ? "" : reason;
      button.setAttribute("aria-disabled", String(!action));
    }
    function isQuickPanelOpen() {
      return !els.quickActionsPanel.hidden;
    }
    function updateQuickPanel() {
      if (!isQuickPanelOpen()) return;
      read();
      els.quickActionsTrades.querySelectorAll("[data-quick-trade]").forEach((button) => {
        const action = projection.controls.quickActions.find((candidate) => (
          candidate.family === "quick_trade"
          && !candidate.disabledReason
          && String(candidate.target?.tradeId) === String(button.dataset.quickTrade)
        ));
        setButton(button, action, "当前无法兑换");
      });
    }
    function setQuickPanelOpen(open) {
      read();
      const available = projection.controls.quickActions.some((action) => !action.disabledReason);
      els.quickActionsPanel.hidden = !(open && available);
      els.actionQuickButton.setAttribute("aria-expanded", String(open && available));
      if (open && available) updateQuickPanel();
    }
    function updateActionButtons() {
      context.syncFinalResultButton?.();
      read();
      for (const [button, family] of mainFamilies) {
        const legal = projection.controls.actions.filter((action) => (
          action.family === family && !action.disabledReason
        ));
        setButton(button, legal.length === 1 ? legal[0] : null, "当前无法执行此行动");
      }
      setButton(
        els.actionPassButton,
        projection.controls.actions.find((action) => action.family === "pass" && !action.disabledReason),
        "当前无法 PASS",
      );
      setButton(
        els.actionConfirmButton,
        projection.controls.actions.find((action) => action.family === "end_turn" && !action.disabledReason),
        "当前无法结束回合",
      );
      setButton(els.actionUndoButton, projection.controls.canUndo ? { actionId: "" } : null, "没有可撤销的 Effect");
      const quickAvailable = projection.controls.quickActions.some((action) => !action.disabledReason);
      els.actionQuickButton.disabled = !quickAvailable;
      els.actionQuickButton.title = quickAvailable ? "" : "当前没有可执行的快速行动";
      updateQuickPanel();
      return projection;
    }
    return Object.freeze({
      activateAction,
      updateActionButtons,
      isQuickPanelOpen,
      updateQuickPanel,
      setQuickPanelOpen,
      toggleQuickPanel: () => setQuickPanelOpen(!isQuickPanelOpen()),
    });
  }

  function createBrowserDesktopActionBarController(options = {}) {
    const { projectionPort, inputPort, hostPort } = options;
    if (!projectionPort || !inputPort || !hostPort) {
      throw new TypeError("DesktopActionBar bootstrap 缺少 owner");
    }
    return createDesktopActionBarController({
      ...hostPort,
      getProjection: projectionPort.getProjection,
      dispatchIntent: inputPort.dispatchIntent,
    });
  }

  return Object.freeze({
    ACTION_BAR_PROJECTION_SCHEMA,
    selectActionBarProjection,
    createActionBarModel,
    createActionBarController,
    createDesktopActionBarController,
    createBrowserDesktopActionBarController,
  });
});
