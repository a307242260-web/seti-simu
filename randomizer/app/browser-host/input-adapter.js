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

  function createRuleInputDispatcher(options = {}) {
    let stableRecoverySnapshot = null;

    function ensureStableRecoverySnapshot() {
      if (options.inspect().phase === "idle" && !stableRecoverySnapshot) {
        stableRecoverySnapshot = options.createRecoverySnapshot({
          label: "Standard Action 开始前稳定恢复点",
        });
      }
    }

    function dispatch(request, fallbackOptions = null, explicitActionContext = null) {
      const action = typeof request === "string"
        ? { kind: request, payload: fallbackOptions || null }
        : { ...(request || {}) };
      if (action.kind === "standard_enumerate") {
        ensureStableRecoverySnapshot();
        return { ok: true, candidates: options.enumerateActions(action.payload || {}) };
      }
      if (action.kind === "standard_resolve" || action.kind === "standard_validate") {
        return options.dispatchRuntimeAction(action, fallbackOptions, explicitActionContext);
      }
      let descriptor = action.standardAction
        || (action.schemaVersion === options.standardActionSchemaVersion ? action : null);
      if (action.kind === "standard_intent") {
        ensureStableRecoverySnapshot();
        const resolved = options.dispatchRuntimeAction({
          kind: "standard_resolve",
          family: action.family,
          selector: action.selector || {},
          payload: action.payload || {},
        }, fallbackOptions, explicitActionContext);
        if (!resolved?.ok) return resolved;
        descriptor = resolved.action;
      }
      if (descriptor) {
        if (options.inspect().phase === "idle") ensureStableRecoverySnapshot();
        const result = descriptor.phase === "quick"
          ? options.submitQuickAction(descriptor)
          : options.submitAction(descriptor);
        if (options.inspect().phase === "idle") stableRecoverySnapshot = null;
        return result;
      }
      return options.dispatchRuntimeAction(action, fallbackOptions, explicitActionContext);
    }

    return Object.freeze({ dispatch });
  }

  function createStandardIntentPort(options = {}) {
    if (typeof options.dispatch !== "function") {
      throw new TypeError("StandardIntentPort 需要 dispatch port");
    }
    function runAction(actionId, actionOptions = {}) {
      const selector = actionOptions.selector || (actionId === "land"
        ? {
          ...(actionOptions.rocketId == null ? {} : { rocketId: Number(actionOptions.rocketId) }),
          ...(actionOptions.target?.type ? { type: actionOptions.target.type } : {}),
          ...(actionOptions.target?.satelliteId ? { satelliteId: actionOptions.target.satelliteId } : {}),
        }
        : (actionOptions.rocketId == null ? {} : { rocketId: Number(actionOptions.rocketId) }));
      return options.dispatch({
        kind: "standard_intent",
        family: actionId,
        selector,
        payload: actionOptions.payload || actionOptions,
      });
    }
    return Object.freeze({ runAction });
  }

  function createActiveDecisionPort(options = {}) {
    if (typeof options.inspect !== "function" || typeof options.submitDecision !== "function") {
      throw new TypeError("ActiveDecisionPort 需要 inspect/submitDecision ports");
    }
    function submit(kind, matches) {
      const inspection = options.inspect();
      const decision = inspection.session?.decision || null;
      const choice = (decision?.choices || []).find((candidate) => {
        const target = candidate?.target || candidate?.standardAction?.target || null;
        return target?.kind === kind && matches(target, candidate);
      });
      if (inspection.phase !== "awaiting_input" || !decision || !choice) {
        return { ok: false, code: "CARD_DECISION_REQUIRED", message: "当前输入不在 active Decision 合法项中" };
      }
      return options.submitDecision({
        decisionId: decision.decisionId,
        decisionVersion: decision.decisionVersion,
        ownerId: decision.ownerId,
        choice,
      });
    }
    function submitDirectional(kind, deltaX, deltaY, rocketId) {
      const direction = deltaX === 1 ? "cw" : deltaX === -1 ? "ccw" : deltaY === 1 ? "out" : "in";
      return submit(
        kind,
        (target) => Number(target.rocketId) === Number(rocketId) && target.direction === direction,
      );
    }
    return Object.freeze({ submit, submitDirectional });
  }

  return Object.freeze({
    SCHEMA_VERSION,
    createBrowserInputAdapter,
    createRuleInputDispatcher,
    createStandardIntentPort,
    createActiveDecisionPort,
  });
});
