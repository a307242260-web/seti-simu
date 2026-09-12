"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");
const source = "/Users/bilibili/code/seti-simu/reports/research/5097a6bb.a83f69ec.full.json";
const output = path.resolve(__dirname, "../reports/iteration/budget-hotspot-baseline-20260912.json");
const bytes = fs.readFileSync(source);
const sourceHash = crypto.createHash("sha256").update(bytes).digest("hex");
if (fs.existsSync(output)) {
  assert.equal(JSON.parse(fs.readFileSync(output)).sourceHash, sourceHash);
  console.log(`已有同源分析，跳过：${output}`);
  process.exit(0);
}
const record = JSON.parse(bytes);
const ranked = record.metrics.searches.filter(s => s.kind === "strategic"
  && Object.values(s.diagnostics.budgetLimits).some(b => b.truncated))
  .sort((a, b) => b.diagnostics.executedNodeCount - a.diagnostics.executedNodeCount
    || b.diagnostics.totalMilliseconds - a.diagnostics.totalMilliseconds || a.step - b.step);
assert(ranked.length);
const selected = ranked[0];
const breakdown = Object.entries(selected.diagnostics.executedNodeCountByDecisionKind)
  .sort((a, b) => b[1] - a[1]);
assert.equal(breakdown.reduce((n, [, count]) => n + count, 0), selected.diagnostics.executedNodeCount);
const analysis = { source, sourceHash, sourceCommit: record.gitCommit,
  scope: "只分析已有完整局日志，不运行AI；物理节点分类可加总，目标origin不可作互斥占比；节点量不是CPU耗时分布。",
  selectionRule: "实际战略预算截断，执行节点降序；并列按已记录搜索耗时降序，再按step升序",
  truncatedSearches: ranked.length,
  tiedMaximumCount: ranked.filter(s => s.diagnostics.executedNodeCount === selected.diagnostics.executedNodeCount).length,
  ranking: ranked.map(s => ({ step: s.step, seat: s.seat, action: s.action,
    nodes: s.diagnostics.executedNodeCount, milliseconds: s.diagnostics.totalMilliseconds })),
  selected, physicalDecisionBreakdown: breakdown,
};
fs.writeFileSync(output, JSON.stringify(analysis, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ output, step: selected.step, truncatedSearches: ranked.length,
  tiedMaximumCount: analysis.tiedMaximumCount, top: breakdown.slice(0, 5) }, null, 2));
