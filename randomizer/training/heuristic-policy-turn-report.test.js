"use strict";

const assert = require("node:assert/strict");
const {
  buildSearchTrace,
  formatDecisionSearchTraceHtml,
} = require("./heuristic-policy-turn-report");

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
      goalPaths: [["orbit:mars:planet:"]],
      goalSelections: [{
        targetId: "orbit:mars:planet:",
        actions: [
          { family: "play_card", summary: "b_56.webp", target: {} },
          { family: "orbit", summary: "环绕火星", target: { planetId: "mars" } },
        ],
        quickTradeCount: 0,
      }],
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
  goalClusters: [{
    depth: 1,
    path: ["orbit:mars:planet:"],
    parentPath: [],
    targetId: "orbit:mars:planet:",
    entryCount: 1,
    firstExecutionOrder: 1,
    executedOriginCount: 7,
    completedTransitionCount: 2,
    survivingCompletionCount: 1,
    routeVariants: [{
      actions: [
        { family: "play_card", summary: "b_56.webp", target: {} },
        { family: "orbit", summary: "环绕火星", target: { planetId: "mars" } },
      ],
      quickTradeCount: 0,
      completedTransitionCount: 2,
      survivingCompletionCount: 1,
    }],
    childTargets: [],
  }],
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
assert.equal(trace.goalClusters[0].selectedPath, true);
assert.equal(trace.goalClusters[0].routeVariants[0].selectedRoute, true);

const html = formatDecisionSearchTraceHtml({
  setupChoices: [],
  turns: [{
    actions: [{
      decisionNumber: 28,
      text: "发射",
      scoreBefore: 7,
      resourcesBefore: { credits: 4, energy: 4, publicity: 4, availableData: 2 },
      decisionContext: {
        roundNumber: 1,
        turnNumber: 1,
        score: 7,
        resources: { credits: 4, energy: 4, publicity: 4, availableData: 2 },
        income: { credits: 3, energy: 2, handSize: 1 },
        hand: [{ cardId: "b_56.webp", cardName: "离子推迸系统", price: 3 }],
        publicCards: [{ cardId: "b_124.webp", cardName: "深空观测", price: 1 }],
        dataProgress: { computerSlots: [], analyzeReady: false },
        techState: { ownedTiles: {}, disabledTiles: {}, blueBoardSlots: {} },
        board: {
          rotation: {},
          planets: [{ planetId: "mars", x: 1, y: 2 }],
          rockets: [],
          aliens: [],
          techSupply: [{ tileId: "blue1", techType: "blue", bonusId: "gain-card", remaining: 4 }],
          playerTech: [],
          planetMarkers: [],
          sectorData: [],
          sectorWins: [],
        },
      },
      timing: { totalMilliseconds: 123 },
      searchTrace: trace,
      followups: [],
    }],
  }],
}, 28);
assert.match(html, /第 1 层 · 本层第 1 个目标/);
assert.match(html, /最终采用路线的次级目标顺序/);
assert.match(html, /打出卡牌：离子推迸系统/);
assert.match(html, /决策现场/);
assert.match(html, /太阳系盘面/);
assert.match(html, /白色玩家手牌/);
assert.match(html, /公共牌/);
assert.match(html, /深空观测/);
assert.match(html, /科技供应与白色科技/);
assert.match(html, /blue1/);
assert.match(html, /数据计算机与扇区/);
assert.match(html, /id="imageLightbox"/);
assert.match(html, /closest\("\[data-image-src\]"\)/);
assert.doesNotMatch(html, /launch:a|move:b|orbit:c/);

console.log("heuristic turn report search trace tests passed");
