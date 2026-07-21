"use strict";

const assert = require("node:assert/strict");
const {
  formatTurnReportMarkdown,
  runFixedBoardTurnReport,
} = require("./heuristic-policy-turn-report");

const report = runFixedBoardTurnReport();
assert.equal(report.schemaVersion, "seti-heuristic-turn-report-v2");
assert.equal(report.boardId, "seti-104-board-v1");
assert.equal(report.decisionCount, 221);
assert.equal(report.setupChoices.length, 6);
assert.equal(report.turns.length, 36);
assert.deepEqual(
  report.finalScores.map(({ playerLabel, finalScore }) => [playerLabel, finalScore]),
  [["白色", 24], ["蓝色", 21], ["棕色", 20], ["绿色", 16]],
);
assert.equal(report.turns[0].roundNumber, 1);
assert.equal(report.turns.at(-1).roundNumber, 4);
assert.deepEqual(report.turns[0].resourcesBefore, {
  credits: 5,
  energy: 3,
  publicity: 4,
  availableData: 3,
  handCount: 3,
  reservedCount: 0,
});
assert.ok(report.turns[0].actions.some((action) => (
  action.value?.evaluation?.evaluationModel === "expected-terminal-score-v1"
)));
assert.ok(report.turns[0].actions.some((action) => action.alternatives.length > 0));
assert.ok(report.diagnostics.zeroScoreTurnCount > 0);
assert.ok(report.diagnostics.tiedTopChoiceCount > 0);
assert.ok(report.diagnostics.optimisticScoreMisses.length > 0);

const markdown = formatTurnReportMarkdown(report);
assert.match(markdown, /## 第 1 轮/);
assert.match(markdown, /T01 白色/);
assert.match(markdown, /持有资源：钱 5→/);
assert.match(markdown, /Q=/);
assert.match(markdown, /同时可选的高价值备选/);
assert.match(markdown, /自动诊断摘要/);
assert.match(markdown, /估值区分度不足/);
assert.match(markdown, /\| 1 \| 白色 \| 24 \| -76 \|/);

console.log("training/heuristic-policy-turn-report.test.js ok");
