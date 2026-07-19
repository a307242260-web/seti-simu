(function (root, factory) {
  "use strict";

  let policyPort = root.SetiPolicyPort;
  let standardAction = root.SetiStandardAction;
  let legacyPolicy = root.SetiAIPolicy;

  if ((!policyPort || !standardAction || !legacyPolicy) && typeof require === "function") {
    policyPort = policyPort || require("./policy-port");
    standardAction = standardAction || require("../actions/standard-action");
    legacyPolicy = legacyPolicy || require("./policy");
  }

  const api = factory(policyPort, standardAction, legacyPolicy);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiHeuristicPolicy = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (policyPort, standardAction, legacyPolicy) {
  "use strict";

  const POLICY_TYPE = "heuristic";
  const POLICY_VERSION = "seti-heuristic-policy-v1";
  const DEFAULT_DIFFICULTY = "laughable";
  const LEGACY_ID_BY_FAMILY = Object.freeze({
    launch: "launch",
    orbit: "orbit",
    land: "land",
    scan: "scan",
    analyze: "analyze",
    research_tech: "researchTech",
    play_card: "playCard",
    pass: "pass",
    move: "move",
    quick_trade: "quickTrade",
    industry: "industry",
    card_corner: "cardCorner",
    place_data: "placeData",
    runezu_face_symbol: "runezuFaceSymbol",
    end_turn: "end-turn",
  });
  const KNOWN_FAMILIES = Object.freeze(new Set(standardAction.ALL_FAMILIES));
  const OPTIONAL_NEGATIVE_TOKENS = Object.freeze(["cancel", "skip", "decline", "跳过", "取消", "放弃"]);

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

  function cloneVisible(value) {
    return value == null ? value : structuredClone(value);
  }

  function toLegacyCandidate(action) {
    return {
      ...cloneVisible(action.payload || {}),
      ...cloneVisible(action.target || {}),
      id: LEGACY_ID_BY_FAMILY[action.family] || action.family,
      family: action.family,
      actionId: action.actionId,
      kind: action.phase,
      label: action.summary,
      target: cloneVisible(action.target || null),
      payload: cloneVisible(action.payload || {}),
      available: true,
    };
  }

  function optionalChoicePenalty(action) {
    const text = `${action.summary || ""} ${stableSerialize(action.target || {})}`.toLowerCase();
    return OPTIONAL_NEGATIVE_TOKENS.some((token) => text.includes(token)) ? -1000 : 0;
  }

  function numericChoiceScore(action) {
    const candidates = [
      action.payload?.value,
      action.payload?.amount,
      action.payload?.gain,
      action.target?.value,
      action.target?.amount,
    ];
    const value = candidates.map(Number).find(Number.isFinite);
    return value == null ? 0 : value;
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

  function chooseConditionalAction(actions, selectors) {
    const preferredActionIds = new Set();
    for (const family of new Set(actions.map((action) => action.family))) {
      const familyActions = actions.filter((action) => action.family === family);
      const selector = selectors[family];
      let selected = null;
      if (typeof selector === "function") {
        selected = selector(Object.freeze([...familyActions]));
      } else if (family === "choose_card") {
        selected = legacyPolicy.choosePlayCard(familyActions.map(toLegacyCandidate));
      }
      if (selected?.actionId) preferredActionIds.add(selected.actionId);
    }
    return actions
      .map((action, index) => ({
        action,
        index,
        score: optionalChoicePenalty(action)
          + numericChoiceScore(action)
          + (preferredActionIds.has(action.actionId) ? 100 : 0),
      }))
      .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.action || null;
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
  }

  function createHeuristicPolicy(options = {}) {
    const difficulty = String(options.difficulty || DEFAULT_DIFFICULTY);
    const strategyWeights = normalizeWeights(options.strategyWeights);
    const conditionalSelectors = Object.freeze({ ...(options.conditionalSelectors || {}) });
    for (const [family, selector] of Object.entries(conditionalSelectors)) {
      if (!standardAction.CONDITIONAL_FAMILIES.includes(family) || typeof selector !== "function") {
        throw new HeuristicPolicyError("HEURISTIC_POLICY_CONFIG_INVALID", `conditional selector 配置无效: ${family}`);
      }
    }
    const provenance = Object.freeze({
      type: POLICY_TYPE,
      version: POLICY_VERSION,
      config: Object.freeze({ difficulty, strategyWeights }),
      configChecksum: stableHash({ difficulty, strategyWeights }),
    });

    function decide(context) {
      assertContext(context);
      const weighted = context.legalActions.map((action, index) => ({
        action,
        index,
        weight: strategyWeights[action.family] ?? 1,
      })).filter((entry) => entry.weight > 0 && isObservationFeasible(context, entry.action));
      if (!weighted.length) {
        throw new HeuristicPolicyError("HEURISTIC_POLICY_NO_ENABLED_ACTION", "配置禁用了当前全部 legal action");
      }

      const conditional = weighted.every((entry) => entry.action.phase === "conditional");
      let selected = null;
      if (conditional) {
        selected = chooseConditionalAction(
          weighted.map((entry) => entry.action),
          conditionalSelectors,
        );
      } else {
        const legacyCandidates = weighted.map((entry) => ({
          ...toLegacyCandidate(entry.action),
          score: (Number(entry.action.payload?.value) || 0) * entry.weight,
        }));
        const legacySelected = legacyPolicy.chooseTurnAction(legacyCandidates, {
          observation: context.observation,
          deterministicContext: context.deterministicContext,
          difficulty,
        });
        selected = weighted.find((entry) => entry.action.actionId === legacySelected?.actionId)?.action || null;
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
  });
});
