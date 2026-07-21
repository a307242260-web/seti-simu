"use strict";

const assert = require("node:assert/strict");
const {
  formatTurnReportMarkdown,
  runFixedBoardTurnReport,
} = require("./heuristic-policy-turn-report");

const report = runFixedBoardTurnReport();
assert.equal(report.schemaVersion, "seti-heuristic-turn-report-v1");
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

const markdown = formatTurnReportMarkdown(report);
assert.match(markdown, /## 第 1 轮/);
assert.match(markdown, /T01 白色/);
assert.match(markdown, /\| 1 \| 白色 \| 24 \|/);
assert.doesNotMatch(markdown, /结束回合；/);

console.log("training/heuristic-policy-turn-report.test.js ok");
