(function (root, factory) {
  "use strict";

  let policyPort = root.SetiPolicyPort;
  let standardAction = root.SetiStandardAction;
  let heuristicEvaluator = root.SetiHeuristicEvaluator;

  if ((!policyPort || !standardAction || !heuristicEvaluator) && typeof require === "function") {
    policyPort = policyPort || require("./policy-port");
    standardAction = standardAction || require("../actions/standard-action");
    heuristicEvaluator = heuristicEvaluator || require("./heuristic-evaluator");
  }

  const api = factory(policyPort, standardAction, heuristicEvaluator);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiHeuristicPolicy = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (policyPort, standardAction, heuristicEvaluator) {
  "use strict";

  const POLICY_TYPE = "heuristic";
  const POLICY_VERSION = "seti-heuristic-policy-v1";
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

  function normalizeWeights(input = {}) {
    const result = {};
    for (const [family, rawValue] of Object.entries(input || {})) {
      if (!KNOWN_FAMILIES.has(family)) {
        throw new HeuristicPolicyError("HEURISTIC_POLICY_CONFIG_INVALID", `未知策略权重 family: ${family}`);
      }
      const value = Number(rawValue);
      if (!Number.isFinite(value) || value < 0) {
        throw new HeuristicPolicyError("HEURISTIC_POLICY_CONFIG_INVALID", `${family} 权重必须是非负有限数值`);
      }
      result[family] = value;
    }
    return Object.freeze(result);
  }

  function decideChoice(input = {}) {
    const seatId = String(input.seatId || "");
    const family = String(input.family || "");
    const stateVersion = Number(input.stateVersion ?? 0);
    const decisionVersion = Number(input.decisionVersion ?? 0);
    const choices = Array.isArray(input.choices) ? input.choices : [];
    try {
      if (!seatId) throw new HeuristicPolicyError("HEURISTIC_POLICY_CHOICE_OWNER_INVALID", "机器选择缺少 seatId");
      if (!standardAction.CONDITIONAL_FAMILIES.includes(family)) {
        throw new HeuristicPolicyError("HEURISTIC_POLICY_UNSUPPORTED_FAMILY", `机器选择不支持 family: ${family}`, { families: [family] });
      }
      if (!Number.isSafeInteger(stateVersion) || stateVersion < 0
        || !Number.isSafeInteger(decisionVersion) || decisionVersion < 0) {
        throw new HeuristicPolicyError("HEURISTIC_POLICY_CHOICE_VERSION_INVALID", "机器选择版本必须是非负安全整数");
      }
      if (!choices.length) throw new HeuristicPolicyError("HEURISTIC_POLICY_EMPTY_LEGAL_SET", "机器选择没有 legal descriptor");
      const ids = new Set();
      const legalActions = choices.map((choice, index) => {
        const choiceId = String(choice?.choiceId ?? "");
        const value = Number(choice?.value);
        if (!choiceId || ids.has(choiceId)) {
          throw new HeuristicPolicyError("HEURISTIC_POLICY_DESCRIPTOR_INVALID", "机器选择 choiceId 必须非空且唯一");
        }
        if (!Number.isFinite(value)) {
          throw new HeuristicPolicyError("HEURISTIC_POLICY_DESCRIPTOR_INVALID", `机器选择 ${choiceId} 缺少有限 evaluator value`);
        }
        ids.add(choiceId);
        return Object.freeze({
          schemaVersion: policyPort.STANDARD_ACTION_SCHEMA_VERSION,
          family,
          phase: standardAction.PHASE_BY_FAMILY[family],
          actionId: `${family}:${stableHash({ seatId, family, choiceId, target: choice.target || null })}`,
          actorId: seatId,
          stateVersion,
          decisionVersion,
          target: Object.freeze({ choiceId, ...(choice.target || {}) }),
          payload: Object.freeze({
            value,
            ...(family === "choose_card" ? { score: value } : {}),
            ...(choice.payload || {}),
          }),
          summary: String(choice.summary || choiceId),
        });
      });
      const context = policyPort.createDecisionContext({
        requestId: String(input.requestId || `browser-choice:${seatId}:${family}:${stateVersion}:${decisionVersion}`),
        seatId,
        stateVersion,
        decisionVersion,
        observation: input.observation || {},
        legalActions,
        deterministicContext: {
          decisionFamily: family,
          decisionId: input.decisionId == null ? null : String(input.decisionId),
        },
      });
      const policy = input.policy || createHeuristicPolicy(input.policyOptions || {});
      const decision = policy.decide(context);
      const validation = policyPort.validatePolicyDecision(context, decision, {
        registry: { validate: (_runtimeContext, action) => ({ ok: legalActions.some((item) => item.actionId === action.actionId) }) },
        runtimeContext: { seatId, stateVersion, decisionVersion },
      });
      if (!validation.ok) return Object.freeze(validation);
      const selectedIndex = legalActions.findIndex((action) => action.actionId === decision.actionId);
      return Object.freeze({
        ok: true,
        choice: choices[selectedIndex],
        action: validation.action,
        decision,
        context,
        provenance: policy.getProvenance(),
      });
    } catch (error) {
      return Object.freeze({
        ok: false,
        code: error?.code || "HEURISTIC_POLICY_CHOICE_FAILED",
        message: error?.message || String(error),
        family,
        seatId: seatId || null,
      });
    }
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
    const strategyWeights = normalizeWeights(options.strategyWeights);
    const evaluateAction = options.evaluateAction || heuristicEvaluator?.evaluateAction;
    if (typeof evaluateAction !== "function" || typeof heuristicEvaluator?.selectLegalAction !== "function") {
      throw new HeuristicPolicyError("HEURISTIC_POLICY_CONFIG_INVALID", "Heuristic Policy 缺少纯 action evaluator");
    }
    const provenance = Object.freeze({
      type: POLICY_TYPE,
      version: POLICY_VERSION,
      config: Object.freeze({ difficulty, strategyWeights }),
      configChecksum: stableHash({ difficulty, strategyWeights }),
    });

    function decide(context) {
      assertContext(context);
      const selected = heuristicEvaluator.selectLegalAction(context, {
        evaluateAction,
        strategyWeights,
        isFeasible: isObservationFeasible,
      });
      if (!selected && context.legalActions.some((action) => (strategyWeights[action.family] ?? 1) <= 0)) {
        throw new HeuristicPolicyError("HEURISTIC_POLICY_NO_ENABLED_ACTION", "配置禁用了当前全部 legal action");
      }
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
    decideChoice,
  });
});
