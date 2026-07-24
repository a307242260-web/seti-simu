(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserInputAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SCHEMA_VERSION = "seti-browser-host-v1";
  const STANDARD_ACTION_SCHEMA = "seti-standard-action-v1";
  const STANDARD_ACTION_KEYS = Object.freeze([
    "schemaVersion", "actionId", "family", "phase", "actorId", "stateVersion",
    "decisionVersion", "target", "payload", "decision", "summary", "disabledReason",
  ]);

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function deepFreeze(value) {
    if (value == null || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
  }

  function stableSerialize(value) {
    if (value == null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableSerialize(value[key])}`
    )).join(",")}}`;
  }

  function comparableAction(action) {
    const unknownKeys = Object.keys(action || {})
      .filter((key) => !STANDARD_ACTION_KEYS.includes(key));
    if (unknownKeys.length) return null;
    return {
      schemaVersion: action.schemaVersion,
      actionId: action.actionId,
      family: action.family,
      phase: action.phase,
      actorId: action.actorId,
      stateVersion: action.stateVersion,
      decisionVersion: action.decisionVersion,
      target: action.target ?? null,
      payload: action.payload || {},
      decision: action.decision || null,
      summary: action.summary || action.family,
      disabledReason: action.disabledReason || null,
    };
  }

  function createHumanActionInputAdapter(options = {}) {
    if (typeof options.readLegalActions !== "function") {
      throw new TypeError("HumanActionInputAdapter 需要 readLegalActions()");
    }
    if (typeof options.dispatchAction !== "function") {
      throw new TypeError("HumanActionInputAdapter 需要唯一 dispatchAction port");
    }
    const beforeDispatch = typeof options.beforeDispatch === "function"
      ? options.beforeDispatch : () => {};
    const afterDispatch = typeof options.afterDispatch === "function"
      ? options.afterDispatch : () => {};

    function listLegalActions() {
      const actions = options.readLegalActions();
      if (!Array.isArray(actions)) {
        throw new TypeError("HumanActionInputAdapter legal set 必须是数组");
      }
      return deepFreeze(actions.map((action) => clone(action)));
    }

    function reject(code, message, action) {
      return {
        ok: false,
        code,
        message,
        actionId: action?.actionId ?? null,
      };
    }

    function submit(action) {
      if (!action || action.schemaVersion !== STANDARD_ACTION_SCHEMA
        || !action.actionId || !action.actorId
        || !Number.isSafeInteger(action.stateVersion)
        || !Number.isSafeInteger(action.decisionVersion)) {
        return reject("HUMAN_ACTION_DESCRIPTOR_INVALID", "人类输入必须提交完整 Standard Action descriptor", action);
      }
      const legal = listLegalActions();
      const current = legal.find((candidate) => String(candidate.actionId) === String(action.actionId));
      if (!current) {
        return reject("HUMAN_ACTION_REMOVED", "该行动已不在当前 legal set 中", action);
      }
      if (current.actorId !== action.actorId) {
        return reject("HUMAN_ACTION_WRONG_ACTOR", "该行动不属于当前 actor", action);
      }
      if (current.stateVersion !== action.stateVersion
        || current.decisionVersion !== action.decisionVersion) {
        return reject("HUMAN_ACTION_STALE", "该行动的状态版本已失效", action);
      }
      const currentComparable = comparableAction(current);
      const submittedComparable = comparableAction(action);
      if (!currentComparable || !submittedComparable
        || stableSerialize(currentComparable) !== stableSerialize(submittedComparable)) {
        return reject("HUMAN_ACTION_DESCRIPTOR_STALE", "该行动 descriptor 与当前 legal set 不一致", action);
      }
      beforeDispatch(clone(current));
      const result = options.dispatchAction(clone(current));
      afterDispatch(clone(result), clone(current));
      return result;
    }

    function submitActionId(actionId) {
      const action = listLegalActions()
        .find((candidate) => String(candidate.actionId) === String(actionId));
      return action
        ? submit(action)
        : reject("HUMAN_ACTION_REMOVED", "该行动已不在当前 legal set 中", { actionId });
    }

    return Object.freeze({ listLegalActions, submit, submitActionId });
  }

  function createHumanDecisionInputAdapter(options = {}) {
    if (typeof options.readDecisionProjection !== "function") {
      throw new TypeError("HumanDecisionInputAdapter 需要 readDecisionProjection()");
    }
    if (typeof options.readActiveDecision !== "function") {
      throw new TypeError("HumanDecisionInputAdapter 需要 readActiveDecision()");
    }
    if (typeof options.submitDecision !== "function") {
      throw new TypeError("HumanDecisionInputAdapter 需要唯一 submitDecision port");
    }
    const beforeSubmit = typeof options.beforeSubmit === "function"
      ? options.beforeSubmit : () => {};
    const afterSubmit = typeof options.afterSubmit === "function"
      ? options.afterSubmit : () => {};

    function reject(code, message, submission) {
      return {
        ok: false,
        code,
        message,
        decisionId: submission?.decisionId ?? null,
        choiceId: submission?.choice?.choiceId ?? null,
      };
    }

    function choiceIdentity(choice) {
      return choice?.actionId ?? choice?.choiceId ?? null;
    }

    function submit(submission) {
      const choiceKeys = Object.keys(submission?.choice || {});
      if (!submission?.decisionId
        || !Number.isSafeInteger(submission.decisionVersion)
        || !submission.ownerId
        || choiceKeys.length !== 1
        || choiceKeys[0] !== "choiceId"
        || submission.choice.choiceId == null) {
        return reject(
          "HUMAN_DECISION_SUBMISSION_INVALID",
          "人类 Decision 输入必须只提交 decisionId/version/owner/choice identity",
          submission,
        );
      }

      const projected = clone(options.readDecisionProjection());
      if (!projected) {
        return reject("HUMAN_DECISION_REMOVED", "当前 viewer 没有可提交的 Decision", submission);
      }
      if (submission.ownerId !== projected.ownerId) {
        return reject("HUMAN_DECISION_WRONG_OWNER", "Decision 不属于当前 viewer", submission);
      }
      if (submission.decisionId !== projected.decisionId
        || submission.decisionVersion !== projected.decisionVersion) {
        return reject("HUMAN_DECISION_STALE", "Decision identity 已失效", submission);
      }
      const projectedChoice = (projected.choices || []).find((choice) => (
        String(choice.choiceId) === String(submission.choice.choiceId)
      ));
      if (!projectedChoice || projectedChoice.disabledReason) {
        return reject("HUMAN_DECISION_CHOICE_REMOVED", "choice 不在当前 viewer legal set 中", submission);
      }

      const active = clone(options.readActiveDecision());
      if (!active
        || active.decisionId !== projected.decisionId
        || active.decisionVersion !== projected.decisionVersion
        || active.ownerId !== projected.ownerId) {
        return reject("HUMAN_DECISION_STALE", "active Effect Session Decision 已变化", submission);
      }
      const legalChoice = (active.choices || []).find((choice) => (
        String(choiceIdentity(choice)) === String(projectedChoice.choiceId)
      ));
      if (!legalChoice) {
        return reject("HUMAN_DECISION_CHOICE_REMOVED", "choice 已从 active Decision 移除", submission);
      }

      const normalized = {
        decisionId: active.decisionId,
        decisionVersion: active.decisionVersion,
        ownerId: active.ownerId,
        choice: legalChoice,
      };
      beforeSubmit(clone(normalized));
      const result = options.submitDecision(clone(normalized));
      afterSubmit(clone(result), clone(normalized));
      return result;
    }

    return Object.freeze({ submit });
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

  return Object.freeze({
    SCHEMA_VERSION,
    STANDARD_ACTION_SCHEMA,
    createBrowserInputAdapter,
    createHumanActionInputAdapter,
    createHumanDecisionInputAdapter,
  });
});
