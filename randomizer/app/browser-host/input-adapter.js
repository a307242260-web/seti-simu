(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserInputAdapter = api;
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

  function createBrowserInputAdapter(options = {}) {
    const actionPort = options.dispatchAction;
    const decisionPort = options.submitDecision;
    const viewStateStore = options.viewStateStore;
    const refreshProjection = options.refreshProjection || (() => null);
    if (typeof actionPort !== "function") throw new TypeError("BrowserInputAdapter 需要 dispatchAction port");
    if (typeof decisionPort !== "function") throw new TypeError("BrowserInputAdapter 需要 submitDecision port");
    if (!viewStateStore?.dispatch || !viewStateStore?.getSnapshot) {
      throw new TypeError("BrowserInputAdapter 需要 ViewStateStore");
    }
    if (typeof refreshProjection !== "function") throw new TypeError("refreshProjection 必须是函数");

    let lastResult = null;
    let submissionSequence = 0;

    function isStale(result) {
      return result?.ok === false && typeof result.code === "string" && result.code.includes("STALE");
    }

    function finish(kind, result) {
      submissionSequence += 1;
      const refreshedProjection = isStale(result) ? refreshProjection() : null;
      lastResult = deepFreeze({
        kind,
        sequence: submissionSequence,
        result: clone(result),
        refreshedProjection: clone(refreshedProjection),
      });
      return lastResult.result;
    }

    function dispatchAction(action) {
      return finish("action", actionPort(clone(action)));
    }

    function submitDecision(submission) {
      return finish("decision", decisionPort(clone(submission)));
    }

    function dispatchViewIntent(intent) {
      const viewIntent = { ...clone(intent) };
      delete viewIntent.kind;
      return finish("view", viewStateStore.dispatch(viewIntent));
    }

    function dispatchIntent(intent) {
      switch (intent?.kind) {
        case "action":
          return dispatchAction(intent.action);
        case "decision":
          return submitDecision(intent.submission);
        case "view":
          return dispatchViewIntent(intent);
        default:
          return finish("unknown", {
            ok: false,
            code: "BROWSER_INPUT_INTENT_UNKNOWN",
            message: `未知 Browser UI intent: ${intent?.kind || "<missing>"}`,
          });
      }
    }

    function inspectInputState() {
      return deepFreeze({
        schemaVersion: SCHEMA_VERSION,
        submissionSequence,
        lastResult: clone(lastResult),
        viewState: viewStateStore.getSnapshot(),
      });
    }

    return Object.freeze({
      dispatchAction,
      submitDecision,
      dispatchViewIntent,
      dispatchIntent,
      inspectInputState,
    });
  }

  return Object.freeze({ SCHEMA_VERSION, createBrowserInputAdapter });
});
