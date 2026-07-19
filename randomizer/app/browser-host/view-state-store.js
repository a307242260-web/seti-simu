(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserViewStateStore = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SCHEMA_VERSION = "seti-browser-host-v1";

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function deepFreeze(value) {
    if (value == null || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
  }

  function createInitialState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      overlay: { activeId: null, minimizedIds: [] },
      hover: { entityRef: null, anchorRef: null },
      focus: { entityRef: null, controlId: null },
      tabs: { report: null, playerPanel: null, alienPanel: null },
      scroll: {},
      layout: { viewport: null, panelSizes: {}, collapsedRegions: [] },
      draft: { intentKind: null, selectedChoiceIds: [], text: "" },
      animation: { acknowledgedEventIds: [] },
      projection: { projectionId: null, decisionId: null, decisionVersion: null },
    };
  }

  function uniqueStrings(values) {
    return [...new Set((Array.isArray(values) ? values : []).map(String))];
  }

  function createViewStateStore() {
    let state = createInitialState();
    const listeners = new Set();

    function getSnapshot() {
      return deepFreeze(clone(state));
    }

    function publish(intent) {
      const snapshot = getSnapshot();
      for (const listener of [...listeners]) listener(snapshot, clone(intent));
      return snapshot;
    }

    function dispatch(intent) {
      const type = intent?.type;
      const next = clone(state);
      switch (type) {
        case "overlay.set":
          next.overlay.activeId = intent.activeId == null ? null : String(intent.activeId);
          break;
        case "overlay.minimize": {
          const id = String(intent.overlayId);
          next.overlay.minimizedIds = uniqueStrings([...next.overlay.minimizedIds, id]);
          if (next.overlay.activeId === id) next.overlay.activeId = null;
          break;
        }
        case "hover.set":
          next.hover = { entityRef: clone(intent.entityRef || null), anchorRef: clone(intent.anchorRef || null) };
          break;
        case "hover.clear":
          next.hover = { entityRef: null, anchorRef: null };
          break;
        case "focus.set":
          next.focus = { entityRef: clone(intent.entityRef || null), controlId: intent.controlId || null };
          break;
        case "focus.clear":
          next.focus = { entityRef: null, controlId: null };
          break;
        case "tabs.set":
          if (!["report", "playerPanel", "alienPanel"].includes(intent.tabGroup)) {
            return deepFreeze({ ok: false, code: "VIEW_STATE_TAB_GROUP_UNKNOWN" });
          }
          next.tabs[intent.tabGroup] = intent.value == null ? null : String(intent.value);
          break;
        case "scroll.set":
          if (!intent.regionId || !Number.isFinite(intent.offset)) {
            return deepFreeze({ ok: false, code: "VIEW_STATE_SCROLL_INVALID" });
          }
          next.scroll[String(intent.regionId)] = intent.offset;
          break;
        case "layout.set":
          next.layout = {
            viewport: clone(intent.viewport ?? next.layout.viewport),
            panelSizes: clone(intent.panelSizes ?? next.layout.panelSizes),
            collapsedRegions: uniqueStrings(intent.collapsedRegions ?? next.layout.collapsedRegions),
          };
          break;
        case "draft.set":
          next.draft.intentKind = intent.intentKind == null ? null : String(intent.intentKind);
          next.draft.selectedChoiceIds = uniqueStrings(intent.selectedChoiceIds);
          next.draft.text = intent.text == null ? "" : String(intent.text);
          break;
        case "draft.toggleChoice": {
          const id = String(intent.choiceId);
          next.draft.selectedChoiceIds = next.draft.selectedChoiceIds.includes(id)
            ? next.draft.selectedChoiceIds.filter((entry) => entry !== id)
            : [...next.draft.selectedChoiceIds, id];
          break;
        }
        case "draft.clear":
          next.draft = { intentKind: null, selectedChoiceIds: [], text: "" };
          break;
        case "animation.acknowledge":
          next.animation.acknowledgedEventIds = uniqueStrings([
            ...next.animation.acknowledgedEventIds,
            ...(intent.eventIds || []),
          ]);
          break;
        case "reset":
          state = createInitialState();
          return publish(intent);
        default:
          return deepFreeze({ ok: false, code: "VIEW_STATE_INTENT_UNKNOWN", intentType: type || null });
      }
      state = next;
      return publish(intent);
    }

    function reconcileProjection(projection) {
      const next = clone(state);
      const decision = projection?.decision || null;
      const previous = next.projection;
      const decisionChanged = previous.decisionId !== (decision?.decisionId || null);
      const versionChanged = previous.decisionVersion !== (decision?.decisionVersion ?? null)
        || previous.projectionId !== (projection?.projectionId || null);
      if (decisionChanged) {
        next.draft = { intentKind: null, selectedChoiceIds: [], text: "" };
      } else if (versionChanged) {
        const legalIds = new Set((decision?.choices || []).map((choice) => String(choice.choiceId)));
        next.draft.selectedChoiceIds = next.draft.selectedChoiceIds.filter((id) => legalIds.has(id));
      }
      next.projection = {
        projectionId: projection?.projectionId || null,
        decisionId: decision?.decisionId || null,
        decisionVersion: decision?.decisionVersion ?? null,
      };
      state = next;
      return publish({ type: "projection.reconcile" });
    }

    function clear() {
      state = createInitialState();
      return publish({ type: "reset" });
    }

    function subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("ViewState listener 必须是函数");
      listeners.add(listener);
      return () => listeners.delete(listener);
    }

    return Object.freeze({ getSnapshot, dispatch, reconcileProjection, clear, subscribe });
  }

  return Object.freeze({ SCHEMA_VERSION, createInitialState, createViewStateStore });
});
