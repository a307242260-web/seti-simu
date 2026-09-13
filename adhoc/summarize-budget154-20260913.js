"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const output = "adhoc/budget154-findings-20260913.json";
if (fs.existsSync(output)) { console.log(`[skip] 已有汇总：${output}`); process.exit(0); }
const source = "adhoc/budget154-trace-ea9efe16-20260913.json";
const trace = JSON.parse(fs.readFileSync(source));
const full = JSON.parse(fs.readFileSync("reports/research/b235ff5f.bddcdae9.full.json"));
const baseline = full.metrics.searches.find(s => s.step===154 && s.kind==="strategic");
assert.equal(trace.ok, true);
assert.equal(trace.actionId, baseline.action);
assert.deepEqual(trace.diagnostics.attemptedNodeCountByFamily, baseline.diagnostics.attemptedNodeCountByFamily);
const d = trace.diagnostics;
const examples = d.goalClusters.filter(c=>c.targetId==="land:venus:planet:" && c.routeVariants.length).map(c=>({
  path:c.path, executedOrigins:c.executedOriginCount, completedRouteVariants:c.routeVariants.length,
  firstFour:c.routeVariants.slice(0,4).map(v=>v.actions),
}));
const report = { source, fullSource:"reports/research/b235ff5f.bddcdae9.full.json", world:full.world,
  actionId:trace.actionId, wallMs:trace.wallMs, sameActionAndFamilyNodeCounts:true,
  executedNodeCount:d.executedNodeCount, budgetLimits:d.budgetLimits,
  topPhysicalActionSummaries:Object.entries(d.executedNodeCountByActionSummary).sort((a,b)=>b[1]-a[1]).slice(0,20),
  routeExamples:examples,
  winningPlan:trace.plan.steps.map(s=>({actionId:s.actionId,action:JSON.parse(s.actionKey),routeTargetId:s.routeTargetId})),
  caveat:"目标来源计数可一节点多目标，不作为互斥物理节点占比。相似摘要和移动顺序不是状态等价证明；尚未修改贪心。",
};
fs.writeFileSync(output, JSON.stringify(report,null,2)+"\n",{flag:"wx"});
console.log(JSON.stringify({output, sameActionAndFamilyNodeCounts:true, executedNodeCount:d.executedNodeCount,
  topPhysicalActionSummaries:report.topPhysicalActionSummaries.slice(0,3)}));
