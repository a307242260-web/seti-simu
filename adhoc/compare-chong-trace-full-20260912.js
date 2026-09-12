"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const output = "reports/iteration/chong-trace-full-comparison-35ee7180-20260912.json";
if (fs.existsSync(output)) { console.log(`已有比较：${output}`); process.exit(0); }
const files = ["/Users/bilibili/code/seti-simu/reports/research/42bace26.126ed66e.full.json",
  path.resolve("reports/research/d4702a6f.35ee7180.full.json")];
const hash = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const inputs = files.map(file => {
  const record = JSON.parse(fs.readFileSync(file));
  assert.equal(record.terminal, true);
  const savePath = path.resolve(path.dirname(file), "../..", record.savePath);
  const save = JSON.parse(fs.readFileSync(savePath));
  const state = JSON.parse(save.committedState);
  assert(state.match.finalScores);
  return { file, record, savePath, save, state };
});
const summarize = ({ record, state }) => {
  const searches = record.metrics.searches, strategic = searches.filter(s => s.kind === "strategic");
  return { commit: record.gitCommit, steps: record.steps, wallMs: record.wallMs,
    finalScores: state.match.finalScores, searches: searches.length,
    strategicSearches: strategic.length,
    strategicNodes: strategic.reduce((n, s) => n + s.diagnostics.executedNodeCount, 0),
    strategicMs: strategic.reduce((n, s) => n + s.diagnostics.totalMilliseconds, 0),
    budgets: Object.fromEntries(["leaves", "frontier", "execution"].map(kind => [kind, {
      enabled: searches.filter(s => s.diagnostics.budgetLimits[kind].enabled).length,
      reached: searches.filter(s => s.diagnostics.budgetLimits[kind].reached).length,
      truncated: searches.filter(s => s.diagnostics.budgetLimits[kind].truncated).length,
    }])),
    failures: searches.flatMap(s => Object.entries(s.diagnostics.failedNodeCountByCode)
      .filter(([, n]) => n > 0).map(([code, count]) => ({ step: s.step, code, count }))),
    hotspots: strategic.filter(s => s.diagnostics.budgetLimits.execution.truncated
      || s.diagnostics.budgetLimits.frontier.truncated).sort((a, b) =>
      b.diagnostics.executedNodeCount - a.diagnostics.executedNodeCount
      || b.diagnostics.totalMilliseconds - a.diagnostics.totalMilliseconds).slice(0, 5)
      .map(s => ({ step: s.step, seat: s.seat, action: s.action,
        nodes: s.diagnostics.executedNodeCount, ms: s.diagnostics.totalMilliseconds,
        kinds: s.diagnostics.executedNodeCountByDecisionKind })),
  };
};
const differences = [];
for (let i = 0; i < Math.max(...inputs.map(x => x.save.replaySteps.length)); i += 1) {
  const [before, after] = inputs.map(x => x.save.replaySteps[i]);
  if (JSON.stringify(before?.action) !== JSON.stringify(after?.action)
    || JSON.stringify(before?.after) !== JSON.stringify(after?.after)) {
    differences.push({ step: i + 1, before, after });
  }
}
const result = { inputs: inputs.map(x => ({ record: x.file, recordHash: hash(x.file),
  save: x.savePath, saveHash: hash(x.savePath) })), before: summarize(inputs[0]), after: summarize(inputs[1]),
  differences, scope: "读取既有终局，不重放、不运行AI。差异逐索引列举，不假设分歧后仍是相同决策。" };
fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ output, differenceSteps: differences.map(d => d.step),
  before: result.before, after: result.after }, null, 2));
