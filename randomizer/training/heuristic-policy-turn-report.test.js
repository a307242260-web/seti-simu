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

const traceWithWinner = {
  ...trace,
  rootCandidates: trace.rootCandidates.map((candidate) => candidate.selected ? {
    ...candidate,
    winningState: {
      roundNumber: 1,
      turnNumber: 6,
      score: 18,
      securedEndGameBonus: 2,
      resources: { credits: 1, energy: 1, publicity: 0, availableData: 0, handCount: 2 },
      income: { credits: 4, energy: 3, handSize: 1 },
      hand: [{ id: "remaining-card", cardName: "剩余牌" }],
      dataProgress: { computerSlots: [1, 2, 3, 4], analyzeReady: false },
      ownedTechIds: ["blue1"],
    },
  } : candidate),
};

const html = formatDecisionSearchTraceHtml({
  setupChoices: [],
  turns: [{
    actions: [{
      decisionNumber: 28,
      playerLabel: "白色玩家",
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
          sectorBySlot: { 1: 3, 2: 4, 3: 1, 4: 2 },
          planets: [{ planetId: "mars", x: 1, y: 2 }],
          rockets: [],
          aliens: [],
          techSupply: [{ tileId: "blue1", techType: "blue", bonusId: "gain-card", remaining: 4 }],
          playerTech: [],
          planetMarkers: [{
            planetId: "mars",
            orbitSlotCount: 5,
            landSlotCount: 5,
            orbitOwners: ["player-white"],
            landingOwners: [],
            nextOrbitReward: "精选 1 张卡牌；火星扇区扫描；获得 1 次收入",
            nextLandReward: "首次登陆：额外获得 2 个数据；获得 6 分",
            satellites: [{
              satelliteId: "phobos-deimos",
              satelliteName: "火卫一/火卫二",
              owner: null,
              reward: "获得 8 分；获得收入 1/2；获得收入 2/2",
            }],
          }],
          planetBoardTokens: [{
            id: "planet:mars:orbit:1",
            kind: "orbit",
            color: "white",
            playerId: "player-white",
            percentX: 25,
            percentY: 50,
            referenceOffsetTokenWidths: 0,
            imageSrc: "../assets/tokens/normal_token-white.png",
          }],
          sectorData: [{
            sectorId: "sector-3-a",
            label: "开普勒22",
            color: "yellow",
            boardSlot: 2,
            side: "left",
            capacity: 5,
            tokens: [{ id: "data-1", slotIndex: 1, playerId: "player-white", playerColor: "white" }],
            signals: [{ playerId: "player-white", playerColor: "white", slotIndex: 1 }],
            leaderPlayerId: "player-white",
            ownCount: 1,
            maxOpponentCount: 0,
            minimumOwnMarks: 4,
            settlementCount: 0,
          }],
          sectorWins: [],
        },
      },
      timing: { totalMilliseconds: 123 },
      searchTrace: traceWithWinner,
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
assert.match(html, /科技供应与白色玩家科技/);
assert.match(html, /blue1/);
assert.match(html, /太阳系盘面与外围 8 个扇区/);
assert.match(html, /数据计算机/);
assert.match(html, /solar-sector-2/);
assert.match(html, /行星环绕与登陆版图/);
assert.match(html, /assets\/core\/background\/planets\.png/);
assert.match(html, /assets\/tokens\/normal_token-white\.png/);
assert.match(html, /assets\/core\/sectors\/sector-3\.png/);
assert.doesNotMatch(html, /下一次：首次登陆/);
assert.match(html, /最终优胜状态/);
assert.match(html, /正式分数/);
assert.match(html, /新增 blue1/);
assert.match(html, /4\/6/);
assert.match(html, /id="imageLightbox"/);
assert.match(html, /closest\("\[data-image-src\]"\)/);
assert.doesNotMatch(html, /launch:a|move:b|orbit:c/);

const greenHtml = formatDecisionSearchTraceHtml({
  setupChoices: [],
  turns: [{
    actions: [{
      decisionNumber: 320,
      playerLabel: "绿色玩家",
      text: "放置数据",
      scoreBefore: 26,
      resourcesBefore: { credits: 7, energy: 3, publicity: 1, availableData: 3 },
      decisionContext: {
        roundNumber: 4,
        turnNumber: 1,
        score: 26,
        resources: { credits: 7, energy: 3, publicity: 1, availableData: 3 },
        hand: [],
      },
      timing: { totalMilliseconds: 11930 },
      searchTrace: traceWithWinner,
      followups: [],
    }],
  }],
}, 320);
assert.match(greenHtml, /绿色玩家 #320/);
assert.match(greenHtml, /绿色玩家行动前/);
assert.match(greenHtml, /绿色玩家手牌/);
assert.doesNotMatch(greenHtml, /白色玩家行动前/);

const incomeHtml = formatDecisionSearchTraceHtml({
  setupChoices: [],
  turns: [{
    actions: [{
      decisionNumber: 29,
      text: "放置数据",
      scoreBefore: 7,
      resourcesBefore: { credits: 4, energy: 4, publicity: 4, availableData: 2 },
      timing: { totalMilliseconds: 10 },
      searchTrace: {
        ...trace,
        rootCandidates: [{ ...trace.rootCandidates[0], goalSelections: [] }],
        goalClusters: [{
          ...trace.goalClusters[0],
          targetId: "income:gain:3,3,0,0,1,0",
          path: ["income:gain:3,3,0,0,1,0"],
          routeVariants: [],
        }],
      },
      followups: [],
    }],
  }],
}, 29);
assert.match(incomeHtml, /继续提升收入（当前基线：钱 3、电 3、手牌 1）/);

console.log("heuristic turn report search trace tests passed");
