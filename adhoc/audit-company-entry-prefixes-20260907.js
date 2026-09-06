"use strict";
const fs = require("node:fs"), v8 = require("node:v8"), zlib = require("node:zlib"), crypto = require("node:crypto");
const assert = require("node:assert/strict");
const input = "reports/iteration/policy-input-42-20260906.v8.gz";
const output = "reports/iteration/company-entry-prefixes-20260907.json";
if (fs.existsSync(output)) console.log(`已有证据：${output}`);
else {
  const bytes = fs.readFileSync(input), graph = v8.deserialize(zlib.gunzipSync(bytes));
  const entries = new Map();
  const report = { scope: "只读历史42保留叶中的公司入口与前置链；出现次数是保留计划引用数，不是物理节点数，不补造已剪枝路径", input,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"), leafCount: 0, companyOccurrences: 0, boundOccurrences: 0 };
  for (const outcome of graph.actionOutcomes) for (const leaf of outcome.leaves) {
    report.leafCount++;
    for (const [index, step] of (leaf.planSteps || []).entries()) {
      if (step.action.family !== "industry" || step.action.target.abilityId !== "huanyu_free_moves") continue;
      report.companyOccurrences++;
      if (step.routeTargetId) report.boundOccurrences++;
      const prefix = leaf.planSteps.slice(0, index + 1);
      const signature = JSON.stringify(prefix.map(s => s.action.actionId));
      let entry = entries.get(signature);
      if (!entry) {
        entry = { prefixId: crypto.createHash("sha256").update(signature).digest("hex").slice(0, 16), references: 0,
          rootActionId: outcome.actionId, prefix: prefix.map(s => ({ action: s.action, routeTargetId: s.routeTargetId,
            routePlanId: s.routePlanId, goalDepth: s.goalDepth })),
          routeRocketIds: [...new Set(step.facts.routes.map(r => r.rocketId))].sort((a,b) => a-b),
          companyRouteTargetId: step.routeTargetId, companyRoutePlanId: step.routePlanId,
          nextChoices: {}, facts: step.facts };
        entries.set(signature, entry);
      }
      entry.references++;
      const next = leaf.planSteps[index + 1];
      if (next) entry.nextChoices[next.action.summary] = (entry.nextChoices[next.action.summary] || 0) + 1;
    }
  }
  report.entries = [...entries.values()].sort((a,b) => b.references-a.references || a.prefixId.localeCompare(b.prefixId));
  assert.ok(report.entries.length > 0);
  assert.equal(report.entries.reduce((n,e) => n+e.references,0), report.companyOccurrences);
  report.byRocketSet = {};
  for (const e of report.entries) {
    const key = e.routeRocketIds.join(",");
    const aggregate = report.byRocketSet[key] ||= { uniquePrefixes: 0, references: 0 };
    aggregate.uniquePrefixes++; aggregate.references += e.references;
  }
  report.verified = true;
  fs.writeFileSync(output, JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ output, leafCount: report.leafCount, occurrences: report.companyOccurrences,
    bound: report.boundOccurrences, uniquePrefixes: report.entries.length, byRocketSet: report.byRocketSet,
    top: report.entries.slice(0,3).map(e=>({prefixId:e.prefixId,references:e.references,rockets:e.routeRocketIds,
      chain:e.prefix.map(s=>s.action.summary),next:e.nextChoices})) },null,2));
}
