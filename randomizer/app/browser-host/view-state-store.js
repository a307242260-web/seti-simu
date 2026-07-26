(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserViewStateStore = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SCHEMA_VERSION = "seti-browser-view-state-v3";

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
      focus: { entityRef: null, controlId: null },
      draft: { intentKind: null, selectedChoiceIds: [], text: "" },
      presentation: { decisionCollapsed: false },
      projection: { projectionId: null, decisionId: null, decisionVersion: null },
    };
  }

  function validateSnapshot(snapshot) {
    if (!snapshot || snapshot.schemaVersion !== SCHEMA_VERSION) {
      return deepFreeze({ ok: false, code: "VIEW_STATE_SCHEMA_UNSUPPORTED" });
    }
    const expected = Object.keys(createInitialState()).sort();
    const actual = Object.keys(snapshot).sort();
    if (expected.length !== actual.length || expected.some((key, index) => key !== actual[index])) {
      return deepFreeze({ ok: false, code: "VIEW_STATE_ROOT_FIELDS_INVALID" });
    }
    const required = ["focus", "draft", "presentation", "projection"];
    if (required.some((key) => snapshot[key] == null || typeof snapshot[key] !== "object" || Array.isArray(snapshot[key]))) {
      return deepFreeze({ ok: false, code: "VIEW_STATE_SNAPSHOT_INVALID" });
    }
    return deepFreeze({ ok: true });
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
        case "focus.set":
          next.focus = { entityRef: clone(intent.entityRef || null), controlId: intent.controlId || null };
          break;
        case "focus.clear":
          next.focus = { entityRef: null, controlId: null };
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
        case "decision.collapse":
          next.presentation.decisionCollapsed = true;
          break;
        case "decision.expand":
          next.presentation.decisionCollapsed = false;
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
        next.presentation.decisionCollapsed = false;
      } else if (versionChanged) {
        const legalIds = new Set((decision?.choices || []).map((choice) => String(choice.choiceId)));
        next.draft.selectedChoiceIds = next.draft.selectedChoiceIds.filter((id) => legalIds.has(id));
      }
      next.projection = {
        projectionId: projection?.projectionId || null,
        decisionId: decision?.decisionId || null,
        decisionVersion: decision?.decisionVersion ?? null,
      };
      if (!decision) next.presentation.decisionCollapsed = false;
      state = next;
      return publish({ type: "projection.reconcile" });
    }

    function clear() {
      state = createInitialState();
      return publish({ type: "reset" });
    }

    function restore(snapshot) {
      const validation = validateSnapshot(snapshot);
      if (!validation.ok) return validation;
      state = clone(snapshot);
      publish({ type: "restore" });
      return deepFreeze({ ok: true });
    }

    function subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("ViewState listener 必须是函数");
      listeners.add(listener);
      return () => listeners.delete(listener);
    }

    return Object.freeze({ getSnapshot, dispatch, reconcileProjection, clear, validate: validateSnapshot, restore, subscribe });
  }

  return Object.freeze({ SCHEMA_VERSION, createInitialState, validateSnapshot, createViewStateStore });
});
