(function (root, factory) {
  "use strict";

  let standardAction = root.SetiStandardAction;
  let standardActionSession = root.SetiStandardActionSession;
  if ((!standardAction || !standardActionSession) && typeof require === "function") {
    standardAction = standardAction || require("./actions/standard-action");
    standardActionSession = standardActionSession || require("./effects/standard-action-session");
  }

  const api = factory(standardAction, standardActionSession);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiProductionComposition = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (
  standardAction,
  standardActionSession,
) {
  "use strict";

  const PACK_ID = "seti-production-domain-pack-v1";

  function assertNoHostRuleOverrides(options) {
    const forbidden = ["actionRegistry", "effectDomains", "standardActionDomain"];
    const supplied = forbidden.filter((key) => options[key] != null);
    if (supplied.length) {
      throw new TypeError(
        `Production Composition 禁止 host 自定义规则 owner: ${supplied.join(", ")}`,
      );
    }
    const duplicateExecutors = Object.keys(options.hostFamilyExecutors || {})
      .filter((family) => standardAction.ALL_FAMILIES.includes(family));
    if (duplicateExecutors.length) {
      throw new Error(`重复 Production family executor: ${duplicateExecutors.join(", ")}`);
    }
  }

  function createProductionDomainPack(options = {}) {
    assertNoHostRuleOverrides(options);
    if (typeof options.createStandardActionRegistry !== "function") {
      throw new TypeError("Production Domain Pack 缺少 Standard Action registry factory");
    }
    if (typeof standardActionSession?.createStandardActionDomain !== "function") {
      throw new TypeError("Production Domain Pack 缺少 Standard Action Effect domain");
    }
    const actionRegistry = options.createStandardActionRegistry();
    if (typeof actionRegistry?.enumerate !== "function"
      || typeof actionRegistry?.validate !== "function"
      || typeof actionRegistry?.execute !== "function") {
      throw new TypeError("Production Domain Pack registry 缺少 enumerate/validate/execute");
    }

    const familyOwners = new Map();
    const claimFamilies = (owner, families) => {
      for (const family of families || []) {
        const previous = familyOwners.get(family);
        if (previous) throw new Error(`重复 Effect domain family: ${family} (${previous}, ${owner})`);
        familyOwners.set(family, owner);
      }
    };
    claimFamilies("standard_action", standardAction.ALL_FAMILIES);
    for (const descriptor of options.additionalDomains || []) {
      claimFamilies(descriptor?.id || "host_domain", descriptor?.families || []);
    }

    const standardDomain = Object.freeze({
      id: "standard_action",
      families: standardAction.ALL_FAMILIES,
      create: standardActionSession.createStandardActionDomain,
      options: Object.freeze({
        actionFamilies: standardAction.ALL_FAMILIES,
        ...(options.standardActionDomainOptions || {}),
      }),
    });
    const effectDomains = Object.freeze([standardDomain, ...(options.additionalDomains || [])]);
    return Object.freeze({
      packId: PACK_ID,
      actionRegistry,
      effectDomains,
      familyOwners: Object.freeze(Object.fromEntries(familyOwners)),
    });
  }

  function createProductionComposition(options = {}) {
    assertNoHostRuleOverrides(options);
    if (typeof options.ruleCompositionApi?.createRuleComposition !== "function") {
      throw new TypeError("Production Composition 缺少 Rule Composition factory");
    }
    const ruleOptions = { ...(options.ruleOptions || {}) };
    if (ruleOptions.createActionRegistry || ruleOptions.effectDomains) {
      throw new TypeError("Production Composition 的 registry/domain 只能由 Domain Pack 安装");
    }
    const domainPack = createProductionDomainPack(options);
    const composition = options.ruleCompositionApi.createRuleComposition({
      ...ruleOptions,
      createActionRegistry: () => domainPack.actionRegistry,
      effectDomains: domainPack.effectDomains,
    });
    return Object.freeze({ composition, domainPack });
  }

  return Object.freeze({
    PACK_ID,
    createProductionDomainPack,
    createProductionComposition,
  });
});
