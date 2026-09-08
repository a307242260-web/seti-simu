"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const commit = process.argv[2] || "4212b427";
const baselinePath = process.argv[3] || "reports/research/13a491f3.e6923ed1.full.json";
const outputPath = process.argv[4] || "reports/iteration/alien-trace-full-review-20260907.json";
const names = fs.readdirSync("reports/research").filter(n => n.includes(`.${commit}.`) && n.endsWith(".full.json"));
assert.equal(names.length, 1, "读取本轮唯一完整局，不运行AI");
const current = JSON.parse(fs.readFileSync(`reports/research/${names[0]}`));
const baseline = JSON.parse(fs.readFileSync(baselinePath));
function summarize(record) {
  assert.equal(record.terminal, true);
  const save = JSON.parse(fs.readFileSync(record.savePath));
  const finalScores = JSON.parse(save.committedState).match.finalScores;
  assert.deepEqual(Object.fromEntries(finalScores.map(p => [p.playerId, p.totalScore])), record.summary.scores);
  const searches = record.metrics.searches;
  const sum = (rows, key) => rows.reduce((n, s) => n + (s.diagnostics[key] || 0), 0);
  const counts = (rows, key) => {
    const result = {};
    for (const s of rows) for (const [k, n] of Object.entries(s.diagnostics[key] || {})) result[k] = (result[k] || 0) + n;
    return Object.fromEntries(Object.entries(result).sort((a, b) => b[1] - a[1]));
  };
  const full = searches.filter(s => s.kind === "strategic" && s.diagnostics.executedNodeCount >= s.diagnostics.maxExecutionNodes);
  const cutoffs = searches.filter(s => s.diagnostics.executionLimitReached);
  return { commit: record.gitCommit, steps: record.steps, wallMs: record.wallMs, scores: record.summary.scores,
    avgScore: record.summary.avgScore, searches: searches.length, nodes: sum(searches, "executedNodeCount"),
    inputs: sum(searches, "successfulInputSubmissionCount"), failedByCode: counts(searches, "failedNodeCountByCode"),
    decisions: counts(searches, "executedNodeCountByDecisionKind"), fullBudgetSearches: full.length,
    fullBudgetNodes: sum(full, "executedNodeCount"), fullBudgetDecisions: counts(full, "executedNodeCountByDecisionKind"),
    cutoffs: cutoffs.map(s => ({ step: s.step, seat: s.seat, kind: s.kind,
      round: save.replaySteps[s.step - 1]?.after?.r, nodes: s.diagnostics.executedNodeCount,
      limit: s.diagnostics.maxExecutionNodes })), finalScores };
}
const before = summarize(baseline), after = summarize(current);
const rows = Object.keys({ ...before.decisions, ...after.decisions }).map(kind => ({
  kind, before: before.decisions[kind] || 0, after: after.decisions[kind] || 0,
  afterPercent: 100 * (after.decisions[kind] || 0) / after.nodes,
  fullBudgetAfter: after.fullBudgetDecisions[kind] || 0,
  fullBudgetAfterPercent: after.fullBudgetNodes ? 100 * (after.fullBudgetDecisions[kind] || 0) / after.fullBudgetNodes : 0,
})).sort((a, b) => b.after - a.after);
const result = { scope: "固定完整局对照；行动轨迹可能不同，不作为单机制节点节省的严格因果分解",
  source: names[0], before, after, rows, deltas: Object.fromEntries(["nodes", "inputs", "wallMs", "avgScore", "fullBudgetSearches"]
    .map(k => [k, after[k] - before[k]])), acceptance: "待人工核对实现与分数变化；未自动判定通过" };
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ before: { ...before, decisions: undefined, fullBudgetDecisions: undefined, finalScores: undefined },
  after: { ...after, decisions: undefined, fullBudgetDecisions: undefined, finalScores: undefined }, deltas: result.deltas }, null, 2));
assert.deepEqual(after.failedByCode, {}, "实际规则搜索失败不可忽略");
