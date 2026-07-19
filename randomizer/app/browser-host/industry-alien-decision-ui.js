(function (root, factory) {
  "use strict";

  let standardAction = root.SetiStandardAction;
  let domainSession = root.SetiIndustryAlienSession;
  if (typeof require === "function") {
    standardAction = standardAction || require("../../game/actions/standard-action");
    domainSession = domainSession || require("../../game/effects/industry-alien-session");
  }

  const api = factory(standardAction, domainSession);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserIndustryAlienDecisionUi = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (standardAction, domainSession) {
  "use strict";

  if (!standardAction?.SCHEMA_VERSION) throw new Error("SetiStandardAction is required before industry/alien Decision UI");
  if (!domainSession?.DECISION_KINDS) throw new Error("SetiIndustryAlienSession is required before industry/alien Decision UI");

  const DECISION_KINDS = Object.freeze(Object.values(domainSession.DECISION_KINDS));
  const RENDERER_KEY_BY_KIND = Object.freeze({
    [domainSession.DECISION_KINDS.INDUSTRY_PICKER]: "industry",
    [domainSession.DECISION_KINDS.ALIEN_TRACE_PLACEMENT]: "alien-trace",
    [domainSession.DECISION_KINDS.ALIEN_OPPORTUNITY]: "alien-opportunity",
    [domainSession.DECISION_KINDS.ALIEN_CARD_GAIN]: "alien-card",
    [domainSession.DECISION_KINDS.ALIEN_TASK]: "alien-task",
    [domainSession.DECISION_KINDS.ALIEN_SPECIES_BRANCH]: "alien-branch",
  });
  const CANCEL_ROLES = new Set(["cancel", "skip"]);

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function isDomainDecision(decision) {
    return DECISION_KINDS.includes(decision?.kind || decision?.decisionKind);
  }

  function createDomainDecisionPresenter(options = {}) {
    const fallback = typeof options.fallback === "function" ? options.fallback : null;
    return function presentDomainDecision(rawDecision, choice, index) {
      const kind = rawDecision?.kind || rawDecision?.decisionKind;
      if (!DECISION_KINDS.includes(kind)) {
        if (fallback) return fallback(rawDecision, choice, index);
        return null;
      }
      if (
        choice?.schemaVersion !== standardAction.SCHEMA_VERSION
        || !choice.actionId
        || choice.family !== domainSession.FAMILY_BY_KIND[kind]
        || choice.actorId !== rawDecision.ownerId
        || choice.payload?.domainDecisionKind !== kind
      ) {
        throw new TypeError(`${kind} choice 缺少 Standard Action identity 或 owner/family 不匹配`);
      }
      const target = clone(choice.target || {});
      const payload = clone(choice.payload || {});
      const role = payload.role || target.role || null;
      return {
        choiceId: choice.actionId,
        label: choice.summary || payload.label || target.label || choice.actionId,
        presentation: {
          role,
          domain: RENDERER_KEY_BY_KIND[kind],
          speciesId: payload.speciesId || null,
          companyId: payload.companyId || null,
          entityRef: clone(payload.entityRef || target.entityRef || target || null),
          icon: payload.icon || null,
          image: payload.image || null,
          reward: clone(payload.reward || null),
          card: clone(payload.card || null),
          task: clone(payload.task || null),
          branch: clone(payload.branch || null),
          status: payload.status || null,
        },
        disabledReason: choice.disabledReason || null,
      };
    };
  }

  function domainChoices(decision) {
    return (decision.choices || []).filter((choice) => (
      !CANCEL_ROLES.has(String(choice.presentation?.role || "").toLowerCase())
    ));
  }

  function renderDomain(type, decision, fields) {
    return {
      ok: true,
      type,
      speciesId: decision.choices.find((choice) => choice.presentation?.speciesId)?.presentation?.speciesId || null,
      companyId: decision.choices.find((choice) => choice.presentation?.companyId)?.presentation?.companyId || null,
      choices: domainChoices(decision).map((choice) => ({
        choiceId: choice.choiceId,
        label: choice.label,
        disabledReason: choice.disabledReason,
        ...Object.fromEntries(fields.map((field) => [field, clone(choice.presentation?.[field] ?? null)])),
      })),
    };
  }

  const RENDERERS = Object.freeze({
    industry: ({ decision }) => renderDomain("industry", decision, ["entityRef", "icon", "reward", "status"]),
    "alien-trace": ({ decision }) => renderDomain("alien-trace", decision, ["entityRef", "icon", "reward", "status"]),
    "alien-opportunity": ({ decision }) => renderDomain("alien-opportunity", decision, ["entityRef", "reward", "card", "status"]),
    "alien-card": ({ decision }) => renderDomain("alien-card", decision, ["card", "image", "reward", "status"]),
    "alien-task": ({ decision }) => renderDomain("alien-task", decision, ["task", "entityRef", "reward", "status"]),
    "alien-branch": ({ decision }) => renderDomain("alien-branch", decision, ["branch", "entityRef", "reward", "status"]),
  });

  function createIndustryAlienDecisionRegistry(decisionUi) {
    if (!decisionUi?.createDecisionRendererRegistry) {
      throw new TypeError("industry/alien Decision UI 需要通用 renderer registry");
    }
    const registry = decisionUi.createDecisionRendererRegistry();
    for (const kind of DECISION_KINDS) {
      const key = RENDERER_KEY_BY_KIND[kind];
      registry.register(key, RENDERERS[key], { matches: (decision) => decision.kind === kind });
    }
    assertRendererCoverage(registry);
    return registry;
  }

  function assertRendererCoverage(registry) {
    const missing = DECISION_KINDS.filter((kind) => {
      const resolved = registry?.resolve?.({ kind, presentationHint: RENDERER_KEY_BY_KIND[kind] });
      return !resolved || resolved.key !== RENDERER_KEY_BY_KIND[kind];
    });
    if (missing.length) throw new Error(`industry/alien Decision renderer 不完整: ${missing.join(", ")}`);
    return true;
  }

  function createIndustryAlienDecisionUiController(decisionUi, options = {}) {
    if (!decisionUi?.createDecisionUiController) throw new TypeError("缺少通用 Decision UI controller");
    return decisionUi.createDecisionUiController({
      registry: options.registry || createIndustryAlienDecisionRegistry(decisionUi),
      dispatchIntent: options.dispatchIntent,
    });
  }

  return Object.freeze({
    DECISION_KINDS,
    RENDERER_KEY_BY_KIND,
    isDomainDecision,
    createDomainDecisionPresenter,
    createIndustryAlienDecisionRegistry,
    assertRendererCoverage,
    createIndustryAlienDecisionUiController,
  });
});
