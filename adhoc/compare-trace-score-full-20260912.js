"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
assert(process.argv[2], "需要已完成的完整局记录，不运行AI");
const files = ["/Users/bilibili/code/seti-simu/reports/research/1d63c8e7.eee63294.full.json", path.resolve(process.argv[2])];
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const inputs = files.map(file => {
  const record = JSON.parse(fs.readFileSync(file));
  assert.equal(record.terminal, true, file);
  const savePath = path.resolve(path.dirname(file), "../..", record.savePath);
  const save = JSON.parse(fs.readFileSync(savePath));
  const state = JSON.parse(save.committedState);
  assert(state.match.finalScores);
  return { file, record, savePath, save, state };
});
const output = `reports/iteration/trace-score-full-comparison-${inputs[1].record.gitCommit.slice(0, 8)}-20260912.json`;
if (fs.existsSync(output)) { console.log(`已有比较：${output}`); process.exit(0); }
const summarize = ({ record, state }) => {
  const searches = record.metrics.searches;
  const strategic = searches.filter(s => s.kind === "strategic");
  const nodeKinds = {};
  for (const search of strategic) for (const [kind, count] of Object.entries(search.diagnostics.executedNodeCountByDecisionKind)) {
    nodeKinds[kind] = (nodeKinds[kind] || 0) + count;
  }
  return { commit: record.gitCommit, steps: record.steps, wallMs: record.wallMs,
    finalScores: state.match.finalScores, searches: searches.length, strategicSearches: strategic.length,
    strategicNodes: strategic.reduce((n, s) => n + s.diagnostics.executedNodeCount, 0),
    strategicMs: strategic.reduce((n, s) => n + s.diagnostics.totalMilliseconds, 0), nodeKinds,
    budgets: Object.fromEntries(["leaves", "frontier", "execution"].map(kind => [kind, {
      enabled: searches.filter(s => s.diagnostics.budgetLimits[kind].enabled).length,
      reached: searches.filter(s => s.diagnostics.budgetLimits[kind].reached).length,
      truncated: searches.filter(s => s.diagnostics.budgetLimits[kind].truncated).length,
    }])),
    failures: searches.flatMap(s => Object.entries(s.diagnostics.failedNodeCountByCode)
      .filter(([, count]) => count > 0).map(([code, count]) => ({ step: s.step, code, count }))),
    nextHotspots: strategic.filter(s => s.diagnostics.budgetLimits.execution.truncated
      || s.diagnostics.budgetLimits.frontier.truncated)
      .sort((a, b) => b.diagnostics.executedNodeCount - a.diagnostics.executedNodeCount
        || b.diagnostics.totalMilliseconds - a.diagnostics.totalMilliseconds || a.step - b.step)
      .slice(0, 10).map(s => ({ step: s.step, seat: s.seat, action: s.action,
        nodes: s.diagnostics.executedNodeCount, ms: s.diagnostics.totalMilliseconds })),
  };
};
let firstDifference = null;
for (let i = 0; i < Math.max(...inputs.map(x => x.save.replaySteps.length)); i += 1) {
  const [before, after] = inputs.map(x => x.save.replaySteps[i]);
  if (!before || !after || JSON.stringify({ action: before.action, after: before.after })
    !== JSON.stringify({ action: after.action, after: after.after })) {
    firstDifference = { step: i + 1, before, after }; break;
  }
}
const result = { inputs: inputs.map(x => ({ record: x.file, recordHash: hash(x.file), save: x.savePath, saveHash: hash(x.savePath) })),
  before: summarize(inputs[0]), after: summarize(inputs[1]), firstDifference,
  scope: "仅比较已完成局；分歧后不按步号对齐决策。无AI，不自动宣称小目标或专项通过。" };
fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ output, firstDifferenceStep: firstDifference?.step,
  before: { nodes: result.before.strategicNodes, ms: result.before.strategicMs, budgets: result.before.budgets },
  after: { nodes: result.after.strategicNodes, ms: result.after.strategicMs, budgets: result.after.budgets,
    scores: result.after.finalScores.map(s => ({ playerId: s.playerId, totalScore: s.totalScore })) } }, null, 2));
