"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const source = "reports/research/7dfcf27e.aaaed8d0.full.json";
const output = "reports/iteration/full-search-hotspots-aaaed8d0-20260907.json";
if (fs.existsSync(output)) console.log(`已有统计：${output}`);
else {
  const record = JSON.parse(fs.readFileSync(source));
  assert.equal(record.terminal, true);
  const top = object => Object.entries(object).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const full = record.metrics.searches.filter(s => s.kind === "strategic"
    && s.diagnostics.executedNodeCount >= s.diagnostics.maxExecutionNodes);
  const rows = full.map(s => {
    const d = s.diagnostics;
    assert.equal(Object.values(d.executedNodeCountByDecisionKind).reduce((a, b) => a + b, 0), d.executedNodeCount);
    return { step: s.step, seat: s.seat, nodes: d.executedNodeCount,
      inputs: d.successfulInputSubmissionCount, milliseconds: d.totalMilliseconds,
      decisions: top(d.executedNodeCountByDecisionKind), choices: top(d.executedNodeCountByActionSummary),
      targetOrigins: top(d.executedOriginCountByTarget),
      targetDecisionOrigins: top(d.executedOriginCountByTargetAndDecisionKind) };
  });
  fs.writeFileSync(output, JSON.stringify({ source, scope: "完整局27次满额搜索的既有统计，无AI重跑",
    counting: "nodes/decisions/choices是物理执行；targetOrigins按来源计数，同一物理节点可服务多个目标，不能相加当作物理节点。重复summary不证明状态等价。",
    rows }, null, 2) + "\n");
  console.log(`已保存${rows.length}次满额搜索的具体选择及目标来源：${output}`);
}
