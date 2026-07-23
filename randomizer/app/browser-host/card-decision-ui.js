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

  function createCardSelectionState(context = {}) {
    const readRoot = (workingRoot = null) => workingRoot || context.getRuleReadout();
    function isCardSelectionActive(workingRoot = null) {
      return context.cards.isSelectionActive(readRoot(workingRoot).cardState);
    }
    function isDiscardSelectionActive(workingRoot = null) {
      return Boolean(context.getPendingDiscardDecision(workingRoot));
    }
    function isPlayCardSelectionActive(workingRoot = null) {
      return context.cards.isPlayCardSelectionActive(readRoot(workingRoot).cardState);
    }
    function allowsBlindDrawInSelection() {
      return context.getPendingCardSelectionDecision()?.allowBlindDraw !== false;
    }
    function isPublicScanMultiSelectActive() {
      const pending = context.getPendingCardSelectionDecision();
      return isCardSelectionActive() && pending?.type === "public_scan" && (pending.maxSelectable ?? 1) > 1;
    }
    function isPublicCornerDiscardSelectionActive() {
      return isCardSelectionActive() && context.getPendingCardSelectionDecision()?.type === "card_public_corner_discard";
    }
    function isPublicCardMultiSelectActive() {
      return isPublicScanMultiSelectActive() || isPublicCornerDiscardSelectionActive();
    }
    function getPublicCardMultiSelectMinSelectable(pending = context.getPendingCardSelectionDecision()) {
      if (pending?.type === "public_scan") return context.getPublicScanMinSelectable(pending);
      const maxSelectable = Math.max(1, Math.round(Number(pending?.maxSelectable) || 1));
      const requested = Math.max(1, Math.round(Number(pending?.minSelectable) || maxSelectable));
      return Math.min(maxSelectable, requested);
    }
    return Object.freeze({
      isCardSelectionActive,
      isDiscardSelectionActive,
      isPlayCardSelectionActive,
      allowsBlindDrawInSelection,
      isPublicScanMultiSelectActive,
      isPublicCornerDiscardSelectionActive,
      isPublicCardMultiSelectActive,
      getPublicCardMultiSelectMinSelectable,
    });
  }

  return Object.freeze({
    CARD_DECISION_KINDS: Object.freeze([...CARD_DECISION_KINDS]),
    createCardDecisionPresenter,
    createCardDecisionRegistry,
    createCardDecisionUiController,
    createCardSelectionState,
  });
});
