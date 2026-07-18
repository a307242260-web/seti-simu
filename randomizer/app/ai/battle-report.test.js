"use strict";

const assert = require("node:assert/strict");
const { createAiBattleReport } = require("./battle-report");

const state = { enabled: true, running: false, playerIds: ["p1"], aiDifficulty: "weak_start", logs: [], bugs: [], lastSummary: null };
const runtime = createAiBattleReport({
  aiAutoBattleState: state,
  state: {},
  turnState: { passedPlayerIds: [] },
  rocketState: {},
  els: {},
  getActivePlayers: () => [],
  computePlayerFinalScoreBreakdown: () => ({}),
  rocketActions: {},
  getAiMarkedFinalFormulaEntries: () => [],
  getAiFinalFormulaProgressForPlayer: () => ({}),
  getAiIndustryCard: () => null,
  summarizeAiResultCards: () => [],
  countAiPlayerTech: () => 0,
  getAiPlayerTechTypeCounts: () => ({}),
  getAiB1TraceCounts: () => ({}),
  getCurrentActionEffect: () => null,
  isActionEffectFlowActive: () => false,
  isIndustryHandSelectionActive: () => false,
  isAiAutomationPaused: () => false,
  getAiDifficultyLabel: () => "开始弱小的",
  getAiStrategyWeights: () => ({ engine: 1 }),
  getAiStrategyTuningHistory: () => [],
  getAiStrategyTuningRecommendation: () => null,
  buildAiLowMarkPlayerDiagnostics: () => [],
  ai: null,
});

const report = runtime.getAiAutoBattleReport({ includeAnalysis: false, includeDiagnostics: false });
assert.equal(report.enabled, true);
assert.deepEqual(report.playerIds, ["p1"]);
assert.deepEqual(report.pendingState.currentEffect, null);
assert.equal(runtime.getAiAutoBattleProgress().logCount, 0);

console.log("app/ai/battle-report.test.js ok");
