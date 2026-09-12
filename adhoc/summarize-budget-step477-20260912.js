"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const output = "reports/iteration/budget-step477-profile-summary-20260912.json";
if (fs.existsSync(output)) {
  console.log(`已有汇总：${output}`);
  process.exit(0);
}
const source = "reports/iteration/budget-step477-profile-20260912.json";
const cpuSource = "reports/iteration/budget-step477-20260912.cpuprofile";
const result = JSON.parse(fs.readFileSync(source));
const profile = JSON.parse(fs.readFileSync(cpuSource));
assert.equal(result.ok, true);
const nodes = new Map(profile.nodes.map(n => [n.id, n]));
const own = new Map();
for (let i = 0; i < profile.samples.length; i += 1) {
  const frame = nodes.get(profile.samples[i]).callFrame;
  const key = `${frame.functionName} ${frame.url}:${frame.lineNumber + 1}`;
  own.set(key, (own.get(key) || 0) + profile.timeDeltas[i]);
}
const d = result.diagnostics;
const summary = { source, cpuSource, commit: result.gitCommit, wallMs: result.wallMs,
  cpuSelfMilliseconds: [...own].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([frame, us]) => ({ frame, ms: us / 1000 })),
  searchTiming: Object.fromEntries(Object.entries(d).filter(([key]) => key.endsWith("Milliseconds"))),
  budgetLimits: d.budgetLimits, failedNodeCountByCode: d.failedNodeCountByCode,
  routeEntryStatsByTarget: d.routeEntryStatsByTarget,
  completedRouteGroupsByTarget: d.completedRouteGroupsByTarget,
  scope: "采样自身耗时而非调用链累计；采样和路线trace有额外成本，不将28.08秒与完整局单步耗时差异称为退化。目标来源与路线完成计数不是互斥物理节点。",
};
fs.writeFileSync(output, JSON.stringify(summary, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ output, searchTiming: summary.searchTiming,
  cpuTop: summary.cpuSelfMilliseconds.slice(0, 3), failures: summary.failedNodeCountByCode }, null, 2));
