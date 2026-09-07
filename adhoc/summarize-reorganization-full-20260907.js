"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const output = "reports/iteration/reorganization-full-review-20260907.json";
const names = fs.readdirSync("reports/research").filter(name => name.includes(".e6923ed1.") && name.endsWith(".full.json"));
assert.equal(names.length, 1, "必须有且仅有本生产版本的固定完整局记录");
const name = names[0], record = JSON.parse(fs.readFileSync(`reports/research/${name}`));
const save = JSON.parse(fs.readFileSync(record.savePath)), state = JSON.parse(save.committedState);
assert.equal(record.terminal, true);
const searches = record.metrics.searches;
const sum = (rows, key) => rows.reduce((total, row) => total + (row.diagnostics[key] || 0), 0);
const distribution = (rows, key) => {
  const result = {};
  for (const row of rows) for (const [label, n] of Object.entries(row.diagnostics[key] || {})) result[label] = (result[label] || 0) + n;
  return Object.fromEntries(Object.entries(result).sort((a, b) => b[1] - a[1]));
};
const full = searches.filter(row => row.kind === "strategic" && row.diagnostics.executedNodeCount >= row.diagnostics.maxExecutionNodes);
const cutoffs = searches.filter(row => row.diagnostics.executionLimitReached);
const finals = state.match.finalScores;
assert.deepEqual(Object.fromEntries(finals.map(p => [p.playerId, p.totalScore])), record.summary.scores);
const result = { record: name, codeCommit: record.gitCommit, steps: record.steps, wallMs: record.wallMs,
  scores: record.summary.scores, avgScore: record.summary.avgScore, finals,
  searches: searches.length, nodes: sum(searches, "executedNodeCount"), inputs: sum(searches, "successfulInputSubmissionCount"),
  failedByCode: distribution(searches, "failedNodeCountByCode"),
  families: distribution(searches, "executedNodeCountByFamily"),
  decisions: distribution(searches, "executedNodeCountByDecisionKind"),
  fullBudgetSearches: full.length, fullBudgetNodes: sum(full, "executedNodeCount"),
  fullBudgetDecisions: distribution(full, "executedNodeCountByDecisionKind"),
  cutoffs: cutoffs.map(row => ({ step: row.step, seat: row.seat, kind: row.kind,
    nodes: row.diagnostics.executedNodeCount, limit: row.diagnostics.maxExecutionNodes })),
  reorganizationPlays: save.replaySteps.flatMap((row, index) => row.action.family === "play_card" && row.action.summary === "dlc_28.png"
    ? [{ step: index + 1, actor: row.action.actorId, action: row.action }] : []),
  acceptance: "规则bug修复不要求维持含错误收益的旧分数；局部正确性证据与本局异常统计联合验收，不等于性能Goal完成" };
fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
assert.deepEqual(result.failedByCode, {}, "完整局实际搜索失败必须显式检查");
