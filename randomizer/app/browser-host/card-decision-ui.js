(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserCardDecisionUi = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function isCardDecision(decision) {
    return ["choose_card", "card_selection", "discard", "pass_reserve"].includes(decision?.kind)
      || decision?.presentationHint === "card";
  }

  function createCardDecisionPresenter(options = {}) {
    const fallback = options.fallback;
    return function present(decision, choice, index) {
      if (!isCardDecision(decision)) return fallback(decision, choice, index);
      const card = choice.presentation?.card || choice.target?.card || null;
      return {
        choiceId: String(choice.actionId || choice.choiceId || card?.id || `card:${index}`),
        label: choice.summary || choice.label || card?.cardName || `卡牌 ${index + 1}`,
        presentation: {
          cardId: card?.id || choice.target?.cardId || choice.target?.cardInstanceId || null,
          cardName: card?.cardName || choice.presentation?.cardName || null,
          image: card?.src || choice.presentation?.image || null,
          source: choice.target?.source || null,
        },
        disabledReason: choice.disabledReason || null,
      };
    };
  }

  function renderCardDecision({ decision }) {
    return {
      ok: true,
      type: "card",
      choices: decision.choices.map((choice) => ({
        choiceId: choice.choiceId,
        label: choice.label,
        cardId: choice.presentation?.cardId || null,
        cardName: choice.presentation?.cardName || null,
        image: choice.presentation?.image || null,
        disabledReason: choice.disabledReason || null,
      })),
    };
  }

  function registerCardDecisionRenderer(decisionUi, registry) {
    if (!decisionUi?.createDecisionRendererRegistry || !registry?.register) {
      throw new TypeError("Card Decision renderer 需要 presentation registry");
    }
    registry.register("card", renderCardDecision, { matches: isCardDecision });
    return registry;
  }

  function createCardDecisionRegistry(decisionUi) {
    return registerCardDecisionRenderer(
      decisionUi,
      decisionUi.createDecisionRendererRegistry(),
    );
  }

  function createCardDecisionUiController(decisionUi, options = {}) {
    if (!decisionUi?.createDecisionUiController) {
      throw new TypeError("Card Decision UI 需要通用 Decision controller");
    }
    return decisionUi.createDecisionUiController({
      ...options,
      registry: options.registry || createCardDecisionRegistry(decisionUi),
    });
  }

  return Object.freeze({
    isCardDecision,
    createCardDecisionPresenter,
    renderCardDecision,
    registerCardDecisionRenderer,
    createCardDecisionRegistry,
    createCardDecisionUiController,
  });
});
