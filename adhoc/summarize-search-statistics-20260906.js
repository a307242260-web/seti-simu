"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const file = process.argv[2];
assert.ok(file?.startsWith("reports/research/"), "需要明确研究记录路径");
const record = JSON.parse(fs.readFileSync(file));
const output = `reports/iteration/search-distribution-${record.gitCommit.slice(0, 8)}-${record.mode}-20260906.json`;
const sum = object => Object.values(object).reduce((a, b) => a + b, 0);
function aggregate(searches) {
  const result = { searches: searches.length, nodes: 0, submissions: 0, failedNodes: 0,
    byFamily: {}, successfulChoices: {}, failuresByFamily: {}, failuresByCode: {} };
  const merge = (target, source) => { for (const [key, count] of Object.entries(source)) target[key] = (target[key] || 0) + count; };
  for (const { diagnostics: d } of searches) {
    assert.equal(sum(d.attemptedNodeCountByFamily), d.executedNodeCount);
    assert.equal(sum(d.executedNodeCountByFamily) + sum(d.failedNodeCountByFamily), d.executedNodeCount);
    assert.equal(sum(d.failedNodeCountByCode), sum(d.failedNodeCountByFamily));
    result.nodes += d.executedNodeCount;
    result.submissions += d.successfulInputSubmissionCount;
    result.failedNodes += sum(d.failedNodeCountByFamily);
    merge(result.byFamily, d.attemptedNodeCountByFamily);
    merge(result.successfulChoices, d.executedNodeCountByActionSummary);
    merge(result.failuresByFamily, d.failedNodeCountByFamily);
    merge(result.failuresByCode, d.failedNodeCountByCode);
  }
  result.familyShares = Object.entries(result.byFamily).sort((a, b) => b[1] - a[1])
    .map(([family, nodes]) => ({ family, nodes, percent: 100 * nodes / result.nodes }));
  return result;
}
if (fs.existsSync(output)) console.log(fs.readFileSync(output, "utf8"));
else {
  const searches = record.metrics.searches;
  assert.ok(Array.isArray(searches));
  const full = searches.filter(s => s.kind === "strategic" && s.diagnostics.executedNodeCount >= s.diagnostics.maxExecutionNodes);
  const report = { source: file, steps: record.steps, terminal: record.terminal,
    scope: "真实evaluate计数；全部尝试包含失败，成功选择摘要不包含失败；非origin重复相加",
    all: aggregate(searches), strategic: aggregate(searches.filter(s => s.kind === "strategic")),
    fullBudget: aggregate(full), fullBudgetSearches: full.map(s => ({ step: s.step, seat: s.seat })),
    fullBudgetNodeShare: aggregate(full).nodes / aggregate(searches).nodes };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, all: report.all.familyShares, fullBudget: report.fullBudget.familyShares,
    searches: report.all.searches, fullBudgetSearches: full.length, fullBudgetNodeShare: report.fullBudgetNodeShare }, null, 2));
}
