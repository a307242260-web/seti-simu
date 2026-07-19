(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserCardDecisionUi = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const CARD_DECISION_KINDS = new Set([
    "choose_card", "choose_payment", "choose_reward", "choose_branch", "accept_optional_effect",
  ]);
  const PRESENTATION_KEYS = Object.freeze([
    "role", "cardId", "image", "cost", "remaining", "reward", "branch", "targetRef", "icon",
  ]);

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function isCardDecision(decision) {
    return decision?.presentationHint === "card" || CARD_DECISION_KINDS.has(decision?.kind || decision?.decisionKind);
  }

  function pickPresentation(choice) {
    const source = choice?.presentation || {};
    const target = choice?.target || {};
    const payload = choice?.payload || {};
    const output = {};
    for (const key of PRESENTATION_KEYS) {
      const value = source[key] ?? target[key] ?? payload[key];
      if (value != null) output[key] = clone(value);
    }
    return Object.keys(output).length ? output : null;
  }

  function createCardDecisionPresenter(options = {}) {
    const fallback = options.fallback || null;
    return function presentCardDecision(rawDecision, choice, index) {
      if (!isCardDecision(rawDecision)) {
        if (typeof fallback === "function") return fallback(rawDecision, choice, index);
        const choiceId = choice?.actionId ?? choice?.choiceId ?? choice?.id ?? `choice:${index}`;
        return {
          choiceId: String(choiceId),
          label: choice?.label || choice?.summary || String(choiceId),
          presentation: pickPresentation(choice),
          disabledReason: choice?.disabledReason || null,
        };
      }
      const kind = rawDecision.kind || rawDecision.decisionKind;
      if (!choice?.schemaVersion || !choice?.actionId || choice.family !== kind || choice.actorId !== rawDecision.ownerId) {
        throw new TypeError(`${kind} card decision choice 缺少 Standard Action identity 或 owner/family 不匹配`);
      }
      return {
        choiceId: String(choice.actionId),
        label: choice.summary || choice.label || String(choice.actionId),
        presentation: pickPresentation(choice),
        disabledReason: choice.disabledReason || null,
      };
    };
  }

  function renderCardDecision({ decision }) {
    const choices = decision.choices || [];
    return {
      ok: true,
      type: "card",
      family: decision.kind,
      choices: choices.filter((choice) => !["cancel", "skip"].includes(choice?.presentation?.role)).map((choice) => ({
        choiceId: choice.choiceId,
        label: choice.label,
        presentation: clone(choice.presentation),
        disabledReason: choice.disabledReason || null,
      })),
    };
  }

  function renderGeneric({ decision }) {
    return {
      ok: true,
      type: "choices",
      choices: (decision.choices || []).map((choice) => ({
        choiceId: choice.choiceId,
        label: choice.label,
        presentation: clone(choice.presentation),
        disabledReason: choice.disabledReason || null,
      })),
    };
  }

  function createCardDecisionRegistry(decisionUi) {
    if (!decisionUi?.createDecisionRendererRegistry) {
      throw new TypeError("card decision UI 需要通用 Decision renderer registry");
    }
    const registry = decisionUi.createDecisionRendererRegistry();
    registry.register("card", renderCardDecision, { matches: isCardDecision });
    registry.register("generic", renderGeneric);
    return registry;
  }

  function createCardDecisionUiController(decisionUi, options = {}) {
    if (!decisionUi?.createDecisionUiController) {
      throw new TypeError("card decision UI 需要通用 Decision UI controller");
    }
    return decisionUi.createDecisionUiController({
      ...options,
      registry: options.registry || createCardDecisionRegistry(decisionUi),
    });
  }

  return Object.freeze({
    CARD_DECISION_KINDS: Object.freeze([...CARD_DECISION_KINDS]),
    createCardDecisionPresenter,
    createCardDecisionRegistry,
    createCardDecisionUiController,
  });
});
