(function (root, factory) {
  "use strict";

  let policyPort = root.SetiPolicyPort;
  let standardAction = root.SetiStandardAction;
  let heuristicEvaluator = root.SetiHeuristicEvaluator;
  let expectedScoreEvaluator = root.SetiExpectedScoreEvaluator;
  let outcomeModel = root.SetiOutcomeModel;

  if ((!policyPort || !standardAction || !heuristicEvaluator || !expectedScoreEvaluator || !outcomeModel) && typeof require === "function") {
    policyPort = policyPort || require("./policy-port");
    standardAction = standardAction || require("../actions/standard-action");
    heuristicEvaluator = heuristicEvaluator || require("./heuristic-evaluator");
    expectedScoreEvaluator = expectedScoreEvaluator || require("./expected-score-evaluator");
    outcomeModel = outcomeModel || require("./outcome-model");
  }

  const api = factory(policyPort, standardAction, heuristicEvaluator, expectedScoreEvaluator, outcomeModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiHeuristicPolicy = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (policyPort, standardAction, heuristicEvaluator, expectedScoreEvaluator, outcomeModel) {
  "use strict";

  const POLICY_TYPE = "heuristic";
  const POLICY_VERSION = "seti-heuristic-policy-v3";
  const DEFAULT_DIFFICULTY = "laughable";
  const KNOWN_FAMILIES = Object.freeze(new Set(standardAction.ALL_FAMILIES));

  class HeuristicPolicyError extends Error {
    constructor(code, message, details = {}) {
      super(message);
      this.name = "HeuristicPolicyError";
      this.code = code;
      Object.assign(this, details);
    }
  }

  function stableSerialize(value) {
    if (value == null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }

  function stableHash(value) {
    const input = stableSerialize(value);
    let hash = 0x811c9dc5;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function isObservationFeasible(context, action) {
    const isMoveLike = action.family === "move"
      || (action.family === "card_corner" && action.payload?.actionKind === "move");
    if (!isMoveLike) return true;
    const rockets = context.observation?.publicState?.board?.rockets;
    if (!Array.isArray(rockets)) return true;
    return rockets.some((rocket) => (
      rocket?.playerId === context.seatId
      && rocket?.surface === "solar-board"
    ));
  }

  function assertContext(context) {
    if (context?.schemaVersion !== policyPort.CONTEXT_SCHEMA_VERSION) {
      throw new HeuristicPolicyError("HEURISTIC_POLICY_CONTEXT_INVALID", "Heuristic Policy 需要公共 DecisionContext");
    }
    if (!Array.isArray(context.legalActions) || context.legalActions.length === 0) {
      throw new HeuristicPolicyError("HEURISTIC_POLICY_EMPTY_LEGAL_SET", "Heuristic Policy 不接受空 legal set");
    }
    const unknownFamilies = [...new Set(context.legalActions
      .map((action) => action.family)
      .filter((family) => !KNOWN_FAMILIES.has(family)))];
    if (unknownFamilies.length) {
      throw new HeuristicPolicyError(
        "HEURISTIC_POLICY_UNSUPPORTED_FAMILY",
        `Heuristic Policy 不支持 family: ${unknownFamilies.join(", ")}`,
        { families: unknownFamilies },
      );
    }
    try {
      outcomeModel.assertOutcomeSet(context.actionOutcomes, context.legalActions);
    } catch (error) {
      throw new HeuristicPolicyError(
        "HEURISTIC_POLICY_OUTCOME_INVALID",
        error?.message || "Heuristic Policy 需要与 legal set 对齐的标准 outcome",
      );
    }
    const malformed = context.legalActions.find((action) => (
      standardAction.PHASE_BY_FAMILY[action.family] !== action.phase
    ));
    if (malformed) {
      throw new HeuristicPolicyError(
        "HEURISTIC_POLICY_DESCRIPTOR_INVALID",
        `Heuristic Policy descriptor family/phase 不匹配: ${malformed.family}/${malformed.phase}`,
        { actionId: malformed.actionId },
      );
    }
  }

  function createHeuristicPolicy(options = {}) {
    const difficulty = String(options.difficulty || DEFAULT_DIFFICULTY);
    const evaluationParameters = expectedScoreEvaluator.mergeParameters(options.evaluationParameters);
    const evaluateAction = options.evaluateAction || ((context, action) => (
      expectedScoreEvaluator.evaluateAction(context, action, evaluationParameters)
    ));
    if (typeof evaluateAction !== "function" || typeof heuristicEvaluator?.selectLegalAction !== "function") {
      throw new HeuristicPolicyError("HEURISTIC_POLICY_CONFIG_INVALID", "Heuristic Policy 缺少纯 action evaluator");
    }
    const provenance = Object.freeze({
      type: POLICY_TYPE,
      version: POLICY_VERSION,
      config: Object.freeze({ difficulty, evaluationParameters }),
      configChecksum: stableHash({ difficulty, evaluationParameters }),
    });

    function decide(context) {
      assertContext(context);
      const selected = heuristicEvaluator.selectLegalAction(context, {
        evaluateAction,
        isFeasible: isObservationFeasible,
      });
      if (!selected) {
        throw new HeuristicPolicyError("HEURISTIC_POLICY_NO_SELECTION", "Heuristic Policy 未能选择 legal descriptor");
      }
      return policyPort.createPolicyDecision(context, {
        actionId: selected.actionId,
        policyType: POLICY_TYPE,
        policyVersion: POLICY_VERSION,
        modelChecksum: null,
        diagnostics: {
          reasonCode: `heuristic:${selected.family}`,
          traceId: `${context.requestId}:${provenance.configChecksum}`,
        },
      });
    }

    return Object.freeze({ decide, getProvenance: () => provenance });
  }

  return Object.freeze({
    POLICY_TYPE,
    POLICY_VERSION,
    DEFAULT_DIFFICULTY,
    HeuristicPolicyError,
    createHeuristicPolicy,
  });
});
