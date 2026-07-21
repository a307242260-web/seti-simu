"use strict";

const assert = require("node:assert/strict");
const {
  REPORT_SCHEMA,
  buildEpisodeReport,
  renderEpisodeReportHtml,
} = require("./episode-report");
const { formatTurnReportMarkdown } = require("./heuristic-policy-turn-report");

const report = buildEpisodeReport({
  episodeIndex: 7,
  seed: "report-seed",
  mode: "training",
  terminal: true,
  steps: 3,
  players: [{
    playerId: "player-blue",
    playerLabel: "蓝色玩家",
    finalScore: 42,
    scoreBreakdown: { totalScore: 42, baseScore: 30, tileScore: 8, cardScore: 4 },
    scoreSources: { blueTechScore: 5, landScore: 7, orbitScore: 3, taskCardScore: 4 },
  }],
}, [
  { actorPlayerId: "player-blue", action: { family: "scan" }, resourceDelta: { energy: 2, availableData: 1 } },
  { actorPlayerId: "player-blue", action: { family: "scan" }, resourceDelta: { energy: -1, publicity: 2 } },
  { actorPlayerId: "player-blue", action: { family: "land" }, resourceDelta: { energy: 1 } },
]);

assert.equal(report.schemaVersion, REPORT_SCHEMA);
assert.equal(report.players[0].finalScore, 42);
assert.deepEqual(report.players[0].resourcesGained, { energy: 3, availableData: 1, publicity: 2 });
assert.deepEqual(report.players[0].actionCounts, { scan: 2, land: 1 });
assert.deepEqual(report.players[0].scoreCategories.slice(0, 6), [
  { label: "终局板块", value: 8 },
  { label: "终局卡牌", value: 4 },
  { label: "蓝科", value: 5 },
  { label: "着陆", value: 7 },
  { label: "环绕", value: 3 },
  { label: "任务", value: 4 },
]);
assert.match(renderEpisodeReportHtml(report), /蓝色玩家/);
assert.match(renderEpisodeReportHtml(report), /42<small>分/);
assert.doesNotMatch(renderEpisodeReportHtml({ ...report, seed: "<script>" }), /<script>/);

const resourcesBefore = { credits: 5, energy: 3, publicity: 4, availableData: 3, handCount: 3, reservedCount: 0 };
const resourcesAfter = { credits: 4, energy: 3, publicity: 5, availableData: 3, handCount: 3, reservedCount: 0 };
const turnMarkdown = formatTurnReportMarkdown({
  boardId: "report-board-v1",
  seed: "report-seed",
  boardFingerprint: "sha256:fixture",
  decisionCount: 1,
  setupChoices: [{ playerLabel: "白色", text: "选择公司" }],
  diagnostics: {
    zeroScoreTurnCount: 1,
    evaluatedDecisionCount: 1,
    tiedTopChoiceCount: 1,
    nonPositiveChoiceCount: 0,
    optimisticScoreMisses: [{
      roundNumber: 1,
      turnNumber: 1,
      playerLabel: "白色",
      decisionNumber: 1,
      action: "扫描 | A",
      expectedImmediateScore: 2,
      actualScoreDelta: 0,
    }],
  },
  turns: [{
    roundNumber: 1,
    turnNumber: 1,
    playerLabel: "白色",
    scoreBefore: 6,
    scoreAfter: 6,
    resourcesBefore,
    resourcesAfter,
    actions: [{
      decisionNumber: 1,
      text: "扫描 | A",
      scoreDelta: 0,
      resourceDelta: { credits: -1, energy: 0, publicity: 1, availableData: 0, handCount: 0, reservedCount: 0 },
      value: {
        score: 2,
        weight: 1,
        evaluation: {
          realizedDelta: 2,
          lockedFinalDelta: 0,
          selectedPlans: [],
          leftoverSalvageDelta: 0,
          riskPenalty: 0,
          tempoCost: 0,
        },
      },
      alternatives: [{ summary: "结束回合", score: 0 }],
    }],
  }],
  finalScores: [{ playerLabel: "白色", finalScore: 6, resources: resourcesAfter }],
});
assert.match(turnMarkdown, /自动诊断摘要/);
assert.match(turnMarkdown, /持有资源：钱 5→4\(-1\)/);
assert.match(turnMarkdown, /Q=2/);
assert.match(turnMarkdown, /扫描 \\| A/);
assert.match(turnMarkdown, /\| 1 \| 白色 \| 6 \| -94 \|/);

console.log("training/episode-report tests passed");
