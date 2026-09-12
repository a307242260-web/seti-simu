"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const directory = "/tmp/seti-plan109-audit-20260912.qncVVm";
const expected = {
  "plan109-20260912.json": "9d0075034593ce4137b12fe7acf6fd19506439da6319f840775ad06b731dbb13",
  "route-changes-from69-20260912.json": "693ac83f3ed9a43ba61cf1c8d94b85ddab4d081db8860c7476b4ac8920a38de3",
};
const inputs = Object.entries(expected).map(([name, sha256]) => {
  const file = path.join(directory, name), bytes = fs.readFileSync(file);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), sha256);
  return { file, sha256, data: JSON.parse(bytes) };
});
const x = inputs[0].data;
assert.equal(x.sourceCommit, "40ce8e97");
assert.equal(x.check.reason, "next-step-affected");
assert.equal(x.action, "pass:c858282e");
const route = x.currentFacts.routes.find(r => r.targetId === "land:mars:planet:" && r.sourceId === "launch");
assert.equal(route.movementSteps, 4);
assert.equal(route.requiredCost.energy, 5);
assert.equal(x.currentFacts.companyAcquisition.energy, 3);
assert(x.checks.every(c => c.hit));
const strategic = x.searches.find(s => s.kind === "strategic");
assert.equal(strategic.diagnostics.executedNodeCount, 74);
assert(Object.values(strategic.diagnostics.budgetLimits).every(b => !b.truncated));
assert.deepEqual(strategic.diagnostics.failedNodeCountByCode, {});
const result = {
  sourceCommit: x.sourceCommit,
  sources: inputs.map(({ data, ...source }) => source),
  successfulPlanChecks: x.checks,
  step109: { check: x.check, chosenAction: x.action, route,
    credits: x.currentFacts.companyAcquisition.credits, energy: x.currentFacts.companyAcquisition.energy,
    searches: x.searches },
  actualRouteChanges: inputs[1].data.changes,
  conclusion: "已修复来源缓存后，真实盘面旋转使未来火星路线成本上升，109因资源不足重搜并PASS；74战略节点无预算截断。尚不能证明评分算术错误或移动贪心删路。",
  caveat: "变化序列中的非本席回合费用受当前行动席位影响，不作为蓝色费用证据；109本席的5能量需求与持有3能量为正式比较。无新完整局或AI搜索。",
};
const output = "adhoc/plan109-realization-review-20260913.json";
const serialized = JSON.stringify(result, null, 2) + "\n";
if (fs.existsSync(output)) assert.equal(fs.readFileSync(output, "utf8"), serialized);
else fs.writeFileSync(output, serialized, { flag: "wx" });
console.log(`已核对并归档：${output}`);
