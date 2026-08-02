"use strict";

const assert = require("node:assert/strict");
const { buildSearchTrace } = require("./heuristic-policy-turn-report");

const actionOutcomes = [
  {
    actionId: "launch:a",
    status: "settled",
    confidence: "high",
    leaves: [{ leafId: "leaf-1" }, { leafId: "leaf-2" }],
  },
  {
    actionId: "quick_trade:b",
    status: "unresolved",
    confidence: "none",
    leaves: [],
    reasonCodes: ["not-a-result-goal"],
  },
];
const rankedEvaluations = [
  {
    actionId: "launch:a",
    summary: "发射",
    evaluation: {
      selectable: true,
      value: 12,
      primaryValue: 15,
      actualScoreDelta: 5,
      techValue: 5,
      incomeValue: 5,
      opportunityCost: 3,
      quickTradeCount: 0,
      routeTargetId: "orbit:mars:planet:",
      actionChain: ["launch:a", "move:b", "orbit:c"],
      reasonCodes: ["strategic-goal-score"],
    },
  },
  {
    actionId: "quick_trade:b",
    summary: "2 钱换 1 电",
    evaluation: {
      selectable: false,
      score: null,
      reasonCodes: ["counterfactual-unresolved"],
    },
  },
];
const diagnostics = {
  candidateCount: 1,
  rootTargetCount: 2,
  executedNodeCount: 9,
  maxFrontierOriginCount: 3,
  transpositionHitCount: 1,
  completedGoalTransitionCount: 2,
  maxCompletedGoalDepth: 2,
  completionDominatedOriginCount: 1,
  targetEquivalentChoicePrunedCount: 4,
  targetSchedulerPrunedCount: 5,
  unreachableRouteOriginCount: 1,
  focalPassBoundaryLeafCount: 2,
  executionLimitReached: false,
  executedNodeCountByFamily: { move: 4, launch: 2, orbit: 1 },
  executedOriginCountByTarget: { "orbit:mars:planet:": 7 },
  completionDominatedOriginCountByTarget: { "orbit:mars:planet:": 1 },
  routeEntryStatsByTarget: {
    "orbit:mars:planet:": {
      bindingOriginCount: 2,
      distinctEntryStateCount: 1,
      completedTransitionCount: 2,
      retainedCompletedTransitionCount: 1,
    },
  },
  completedRouteGroupsByTarget: {
    "orbit:mars:planet:": [{
      routeFamilies: ["launch", "move", "orbit"],
      quickTradeCount: 0,
      completedTransitionCount: 2,
      retainedCompletedTransitionCount: 1,
    }],
  },
};

const trace = buildSearchTrace(
  actionOutcomes,
  rankedEvaluations,
  diagnostics,
  "launch:a",
);

assert.equal(trace.legalActionCount, 2);
assert.equal(trace.strategicCandidateCount, 1);
assert.equal(trace.rootCandidates[0].selected, true);
assert.equal(trace.rootCandidates[0].leafCount, 2);
assert.deepEqual(trace.rootCandidates[0].actionChain, ["launch:a", "move:b", "orbit:c"]);
assert.equal(trace.rootCandidates[1].selectable, false);
assert.equal(trace.targetRows[0].targetId, "orbit:mars:planet:");
assert.equal(trace.targetRows[0].executedOriginCount, 7);
assert.equal(trace.targetRows[0].completionDominatedCount, 1);
assert.deepEqual(trace.targetRows[0].routeGroups[0].routeFamilies, ["launch", "move", "orbit"]);
assert.deepEqual(trace.nodeFamilies.map(({ family }) => family), ["move", "launch", "orbit"]);
assert.equal(Object.isFrozen(trace), true);
assert.equal(Object.isFrozen(trace.targetRows[0].routeGroups[0]), true);

console.log("heuristic turn report search trace tests passed");
