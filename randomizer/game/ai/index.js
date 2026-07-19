(function (root, factory) {
  "use strict";

  let valuation = root.SetiAIValuation;
  let goals = root.SetiAIGoals;
  let raceModel = root.SetiAIRaceModel;
  let actionGraph = root.SetiAIActionGraph;
  let planner = root.SetiAIPlanner;
  let evaluator = root.SetiAIEvaluator;
  let policy = root.SetiAIPolicy;
  let policyPort = root.SetiPolicyPort;
  let analytics = root.SetiAIBattleAnalytics;

  if ((!valuation || !goals || !raceModel || !actionGraph || !planner || !evaluator || !policy || !policyPort || !analytics) && typeof require === "function") {
    valuation = valuation || require("./valuation");
    goals = goals || require("./goals");
    raceModel = raceModel || require("./race-model");
    actionGraph = actionGraph || require("./action-graph");
    planner = planner || require("./planner");
    evaluator = evaluator || require("./evaluator");
    policy = policy || require("./policy");
    policyPort = policyPort || require("./policy-port");
    analytics = analytics || require("./battle-analytics");
  }

  const api = factory(valuation, goals, raceModel, actionGraph, planner, evaluator, policy, policyPort, analytics);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAI = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (valuation, goals, raceModel, actionGraph, planner, evaluator, policy, policyPort, analytics) {
  "use strict";

  return Object.freeze({
    valuation,
    goals,
    raceModel,
    actionGraph,
    planner,
    evaluator,
    policy,
    policyPort,
    analytics,
  });
});
