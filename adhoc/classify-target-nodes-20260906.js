"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const file = process.argv[2];
assert.ok(file?.startsWith("reports/research/"));
const r = JSON.parse(fs.readFileSync(file));
const output = `reports/iteration/target-node-classes-${r.gitCommit.slice(0, 8)}-${r.mode}-20260906.json`;
function classify(summary) {
  if (/外星人.*(?:痕迹|号位)/.test(summary)) return "痕迹位置";
  if (/^(?:第一排放置位|blue\d+ 下方)/.test(summary)) return "数据放置";
  if (/^(?:移动 |R\d+ |结束移动)/.test(summary)) return "移动选择";
  if (/^扫描 /.test(summary)) return "扫描扇区";
  if (/^(?:研究 |借用 )/.test(summary)) return "科技选择";
  if (/^标记 [ABCD]$/.test(summary)) return "终局板块标记";
  return "待逐项核对";
}
function aggregate(searches) {
  const result = { nodes: 0, attemptedTargets: 0, failedTargets: 0, classes: {}, unclassified: {}, byDecisionKind: {} };
  for (const s of searches) {
    const d = s.diagnostics;
    result.nodes += d.executedNodeCount;
    result.attemptedTargets += d.attemptedNodeCountByFamily.choose_target || 0;
    result.failedTargets += d.failedNodeCountByFamily.choose_target || 0;
    for (const [key, n] of Object.entries(d.executedNodeCountByActionSummary)) {
      if (!key.startsWith("choose_target:")) continue;
      const summary = key.slice("choose_target:".length), group = classify(summary);
      result.classes[group] = (result.classes[group] || 0) + n;
      if (group === "待逐项核对") result.unclassified[summary] = (result.unclassified[summary] || 0) + n;
    }
    for (const [kind, n] of Object.entries(d.executedNodeCountByDecisionKind)) {
      if (kind.startsWith("choose_target:")) result.byDecisionKind[kind] = (result.byDecisionKind[kind] || 0) + n;
    }
  }
  assert.equal(Object.values(result.classes).reduce((a,b)=>a+b,0) + result.failedTargets, result.attemptedTargets);
  result.ranking = Object.entries(result.classes).sort((a,b)=>b[1]-a[1]).map(([group,nodes])=>({group,nodes,percentOfAll:100*nodes/result.nodes}));
  return result;
}
if (fs.existsSync(output)) console.log(`已有统计，跳过：${output}`);
else {
  const report = { source: file, scope: "只读既有物理节点；成功choose_target按完整summary规则分组，失败单列；不是冗余判定，不将origin重复相加",
    all: aggregate(r.metrics.searches), fullBudget: aggregate(r.metrics.searches.filter(s=>s.kind==='strategic'&&s.diagnostics.executedNodeCount>=s.diagnostics.maxExecutionNodes)) };
  fs.writeFileSync(output, JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({output,all:report.all.ranking,fullBudget:report.fullBudget.ranking,unclassified:report.all.unclassified},null,2));
}
