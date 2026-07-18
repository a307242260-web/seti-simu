"use strict";

const assert = require("node:assert/strict");
const {
  REPORT_SCHEMA,
  buildEpisodeReport,
  renderEpisodeReportHtml,
} = require("./episode-report");

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

console.log("training/episode-report tests passed");
