(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserPendingDecision = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const DECISION_EFFECT_TYPE = "standard_action_session_decision";
  const SUPPORTED_KINDS = Object.freeze([
    "move_payment",
    "discard",
    "hand_scan",
    "pass_reserve",
  ]);

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function createBrowserPendingDecisionOwner(options = {}) {
    if (typeof options.inspectSession !== "function"
      || typeof options.enumerate !== "function") {
      throw new TypeError("browser pending Decision owner 缺少 inspect/enumerate capability");
    }

    let activeRuleTransaction = null;

    function readDecision() {
      const inspection = options.inspectSession();
      return inspection?.session?.decision || inspection?.decision || null;
    }

    function read(kind = null) {
      const decision = readDecision();
      const context = decision?.choices?.[0]?.decisionContext || null;
      if (!context || (kind && context.kind !== kind)) return null;
      return clone(context.pending || null);
    }

    function runRuleTransaction(workingRoot, operation) {
      if (!workingRoot || typeof workingRoot !== "object" || typeof operation !== "function") {
        throw new TypeError("browser pending Decision transaction 缺少 workingRoot/operation");
      }
      if (activeRuleTransaction) return operation();
      activeRuleTransaction = { workingRoot, openedDecisionEffect: null };
      try {
        return operation();
      } finally {
        activeRuleTransaction = null;
      }
    }

    function open(workingRoot, kind, rawPending) {
      if (!SUPPORTED_KINDS.includes(kind)) {
        throw new TypeError(`不支持的 browser pending Decision: ${kind || "<missing>"}`);
      }
      if (!activeRuleTransaction || activeRuleTransaction.workingRoot !== workingRoot) {
        throw new Error("browser pending DecisionEffect 只能在当前规则事务内 open");
      }
      if (activeRuleTransaction.openedDecisionEffect) {
        throw new Error("同一规则事务不能 open 两个 browser pending DecisionEffect");
      }
      const pending = clone(rawPending || {});
      const described = options.enumerate(workingRoot, kind, pending);
      const choices = (described?.candidates || described?.choices || []).map((choice) => ({
        ...clone(choice),
        decisionContext: { kind, pending: clone(pending) },
      }));
      if (!choices.length) {
        throw new Error(`${kind} DecisionEffect 没有合法选项`);
      }
      const ownerId = described?.ownerId || described?.actorPlayer?.id || pending.playerId || null;
      const effect = {
        ownerId,
        type: DECISION_EFFECT_TYPE,
        kind: "decision",
        decisionKind: described?.decisionKind || choices[0]?.family || kind,
        payload: { choices },
      };
      activeRuleTransaction.openedDecisionEffect = effect;
      return clone(pending);
    }

    function takeOpenedDecisionEffect() {
      const effect = activeRuleTransaction?.openedDecisionEffect || null;
      if (!effect) return null;
      activeRuleTransaction.openedDecisionEffect = null;
      return clone(effect);
    }

    return Object.freeze({
      read,
      open,
      runRuleTransaction,
      takeOpenedDecisionEffect,
    });
  }

  return Object.freeze({
    DECISION_EFFECT_TYPE,
    SUPPORTED_KINDS,
    createBrowserPendingDecisionOwner,
  });
});
