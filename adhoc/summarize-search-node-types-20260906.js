"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const output = "reports/iteration/node-types-census-20260906.json";
if (fs.existsSync(output)) console.log(`已有统计：${output}`);
else {
  const paths = [24, 42, 49, 52].map(step => `reports/iteration/node-types-baseline-step-${step}-20260906.json`);
  paths.push("reports/iteration/observe-decision-search-after-20260906.json");
  const rows = paths.map(path => {
    const report = JSON.parse(fs.readFileSync(path));
    assert.equal(report.passed, true);
    const d = report.diagnostics;
    const classified = Object.values(d.executedNodeCountByFamily).reduce((sum, n) => sum + n, 0);
    assert.ok(classified <= d.executedNodeCount);
    const computer = Object.entries(d.executedNodeCountByActionSummary)
      .filter(([key]) => key.startsWith("choose_target:第一排放置位"));
    return { path, step: report.step || 210, wallMs: report.wallMs,
      chosen: report.chosen, nodes: d.executedNodeCount, successfulClassifiedNodes: classified,
      failedExecutionAttempts: d.executedNodeCount - classified,
      familyCounts: d.executedNodeCountByFamily,
      computerChoiceCount: computer.reduce((sum, [, n]) => sum + n, 0),
      computerChoices: Object.fromEntries(computer),
      topChoices: Object.entries(d.executedNodeCountByActionSummary).slice(0, 15),
      targetOriginCounts: d.executedOriginCountByTarget,
      targetDecisionKindOriginCounts: d.executedOriginCountByTargetAndDecisionKind,
    };
  });
  const report = { scope: "五个固定输入样本独立统计，不代表整局分布；失败尝试在executeNode返回后、成功family计数前退出；具体错误原因尚未计数",
    productionCommit: "213f34db", rawBudgetHitRows: 347,
    budgetHitCaveat: "复用计划时会重复携带旧诊断，不是独立搜索次数",
    rows };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(rows.map(({ step, wallMs, nodes, familyCounts, computerChoiceCount, failedExecutionAttempts }) => ({
    step, wallMs, nodes, chooseTarget: familyCounts.choose_target || 0,
    chooseCard: familyCounts.choose_card || 0, placeData: familyCounts.place_data || 0,
    computerChoiceCount, failedExecutionAttempts,
  })), null, 2));
}
