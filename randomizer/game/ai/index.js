(function (root, factory) {
  "use strict";

  let outcomeModel = root.SetiOutcomeModel;
  let policyPort = root.SetiPolicyPort;
  let heuristicEvaluator = root.SetiHeuristicEvaluator;
  let expectedScoreEvaluator = root.SetiExpectedScoreEvaluator;
  let heuristicPolicy = root.SetiHeuristicPolicy;
  let machinePlayerHost = root.SetiMachinePlayerHost;

  if ((!outcomeModel || !policyPort || !heuristicEvaluator || !expectedScoreEvaluator || !heuristicPolicy || !machinePlayerHost) && typeof require === "function") {
    outcomeModel = outcomeModel || require("./outcome-model");
    policyPort = policyPort || require("./policy-port");
    heuristicEvaluator = heuristicEvaluator || require("./heuristic-evaluator");
    expectedScoreEvaluator = expectedScoreEvaluator || require("./expected-score-evaluator");
    heuristicPolicy = heuristicPolicy || require("./heuristic-policy");
    machinePlayerHost = machinePlayerHost || require("./machine-player-host");
  }

  const api = factory(outcomeModel, policyPort, heuristicEvaluator, expectedScoreEvaluator, heuristicPolicy, machinePlayerHost);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAI = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (outcomeModel, policyPort, heuristicEvaluator, expectedScoreEvaluator, heuristicPolicy, machinePlayerHost) {
  "use strict";

  return Object.freeze({
    outcomeModel,
    policyPort,
    heuristicEvaluator,
    expectedScoreEvaluator,
    heuristicPolicy,
    machinePlayerHost,
  });
});
