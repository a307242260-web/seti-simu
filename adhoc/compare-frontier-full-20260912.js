"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const source = process.argv[2];
assert(source, "传入已完成的新完整局记录路径，不运行AI");
const baseline = "/Users/bilibili/code/seti-simu/reports/research/5097a6bb.a83f69ec.full.json";
const read = file => JSON.parse(fs.readFileSync(file));
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const inputs = [baseline, path.resolve(source)].map(file => {
  const record = read(file);
  assert.equal(record.terminal, true);
  const savePath = path.resolve(path.dirname(file), "../..", record.savePath);
  const save = read(savePath);
  return { file, sha256: hash(file), record, savePath, saveHash: hash(savePath), save,
    state: JSON.parse(save.committedState) };
});
const output = `reports/iteration/frontier-full-comparison-${inputs[1].record.gitCommit.slice(0, 8)}-20260912.json`;
if (fs.existsSync(output)) { console.log(`已有比较：${output}`); process.exit(0); }
function metrics(input) {
  const searches = input.record.metrics.searches;
  const strategic = searches.filter(s => s.kind === "strategic");
  return { commit: input.record.gitCommit, steps: input.record.steps, wallMs: input.record.wallMs,
    scores: input.state.players.players.map(p => ({ playerId: p.id,
      finalScore: p.finalScore, breakdown: p.finalScoreBreakdown })),
    searches: searches.length, strategicSearches: strategic.length,
    strategicNodes: strategic.reduce((sum, s) => sum + s.diagnostics.executedNodeCount, 0),
    strategicMs: strategic.reduce((sum, s) => sum + s.diagnostics.totalMilliseconds, 0),
    executionTruncated: searches.filter(s => s.diagnostics.budgetLimits.execution.truncated).length,
    frontierTruncated: searches.filter(s => s.diagnostics.budgetLimits.frontier.truncated).length,
    failures: searches.flatMap(s => Object.entries(s.diagnostics.failedNodeCountByCode)
      .filter(([, count]) => count > 0).map(([code, count]) => ({ step: s.step, kind: s.kind, code, count }))),
  };
}
const identity = step => JSON.stringify({ action: step.action, after: step.after });
let firstDifference = null;
for (let i = 0; i < Math.max(...inputs.map(x => x.save.replaySteps.length)); i += 1) {
  const [before, after] = inputs.map(x => x.save.replaySteps[i]);
  if (!before || !after || identity(before) !== identity(after)) {
    firstDifference = { step: i + 1, before, after }; break;
  }
}
const summary = { inputs: inputs.map(({ file, sha256, savePath, saveHash }) => ({ file, sha256, savePath, saveHash })),
  before: metrics(inputs[0]), after: metrics(inputs[1]), firstDifference,
  allActionDescriptorsAndStepResultsEqual: firstDifference === null,
  scope: "逐步比较完整描述符与after摘要，终局采用正式拆分；若发生分歧须进一步归因，不能按步号比较分歧后的决策。此脚本不判定整个专项完成。" };
fs.writeFileSync(output, JSON.stringify(summary, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ output, before: summary.before, after: summary.after,
  firstDifferenceStep: firstDifference?.step || null }, null, 2));
