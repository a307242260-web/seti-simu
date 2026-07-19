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

  return Object.freeze({ createActionBarModel, createActionBarController, createActionBarRenderer });
});
