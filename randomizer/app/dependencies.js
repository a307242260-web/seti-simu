(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiAppDependencies = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const REQUIRED_GLOBALS = Object.freeze([
    ["productionKernel", "SetiProductionKernel"],
    ["browserRuleComposition", "SetiAppBrowserRuleComposition"],
    ["projectionAdapter", "SetiBrowserProjectionAdapter"],
    ["viewStateStore", "SetiBrowserViewStateStore"],
    ["inputAdapter", "SetiBrowserInputAdapter"],
    ["actionBar", "SetiBrowserActionBar"],
    ["decisionUi", "SetiBrowserDecisionUi"],
    ["residentRenderer", "SetiBrowserResidentRenderer"],
    ["browserServices", "SetiBrowserServices"],
    ["gameRecovery", "SetiAppGameRecovery"],
    ["publicApi", "SetiAppPublicApi"],
    ["dom", "SetiAppDom"],
    ["finalReadModel", "SetiFinalReadModel"],
    ["browserReadModel", "SetiBrowserReadModel"],
    ["finalScoring", "SetiFinalScoring"],
    ["endGameScoring", "SetiEndGameScoring"],
    ["cardEffects", "SetiCardEffects"],
    ["solar", "SetiSolarSystem"],
    ["aliens", "SetiAliens"],
    ["tech", "SetiTech"],
  ]);

  function collectDependencies(target = globalThis) {
    const dependencies = {};
    const missing = [];
    for (const [key, globalName] of REQUIRED_GLOBALS) {
      if (!target[globalName]) missing.push(globalName);
      else dependencies[key] = target[globalName];
    }
    if (missing.length) {
      throw new Error(`Missing SETI app dependencies: ${missing.join(", ")}`);
    }
    return Object.freeze(dependencies);
  }

  return Object.freeze({ REQUIRED_GLOBALS, collectDependencies });
});
