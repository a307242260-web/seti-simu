"use strict";
// 只读既有完整取证，不启动AI；历史链条不能冒充当前版本的逐节点状态。
const fs = require("node:fs"), assert = require("node:assert/strict");
const crypto = require("node:crypto");
const source = "/private/tmp/seti-rules-baseline-20260908.ohUO6T/reports/iteration/data-pick-repeats-53-8ba9b8d8-20260907.json";
const currentFile = "reports/iteration/rules-baseline-full-review-20260908.json";
const output = "reports/iteration/data-continuations-audit-20260908.json";
if (fs.existsSync(output)) { console.log(`已有checkpoint：${output}`); process.exit(0); }
const bytes = fs.readFileSync(source), trace = JSON.parse(bytes);
assert.equal(trace.passed, true);
assert.deepEqual(trace.errors, []);
const current = JSON.parse(fs.readFileSync(currentFile)).candidate.cappedSearches.find(s => s.step === 53);
assert.ok(current);
const rows = trace.rows.filter(r => r.current.family === "place_data");
assert.equal(rows.length, trace.diagnostics.executedNodeCountByDecisionKind["place_data:quick"]);
const byPreviousFamily = {}, byRootFamily = {}, byPlanSet = {}, consecutive = [];
const add = (map, key) => { map[key] = (map[key] || 0) + 1; };
const setKey = values => [...new Set(values)].sort().join("+");
for (const row of rows) {
  assert.ok(row.origins.length);
  const previous = setKey(row.origins.map(o => o.chain.length ? o.chain.at(-1).split(":")[0] : "root"));
  add(byPreviousFamily, previous);
  add(byRootFamily, setKey(row.origins.map(o => (o.chain[0] || row.current.actionId).split(":")[0])));
  add(byPlanSet, setKey(row.origins.map(o => o.plan)));
  if (previous === "place_data") consecutive.push(row);
}
for (const group of [byPreviousFamily, byRootFamily, byPlanSet])
  assert.equal(Object.values(group).reduce((a,b) => a+b, 0), rows.length);
const comparison = Object.fromEntries(["executedNodeCount", "successfulInputSubmissionCount"].map(k => [k,
  { historical: trace.diagnostics[k], current: k === "executedNodeCount" ? current.nodes : current.inputs }]));
const report = { source, sourceSha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  currentFile, scope: "历史8ba9b8d8第53步链条拆分；当前ee3ea52f同一步聚合一致不证明每个中间状态相同。来源先去重组成集合，每节点只计一次。",
  physicalDataNodes: rows.length, byPreviousFamily, byRootFamily, byPlanSet,
  consecutiveCandidateCount: consecutive.length, consecutiveCandidates: consecutive, comparison,
  currentDecisionCountsEqualHistorical: JSON.stringify(Object.entries(current.decisions).sort())
    === JSON.stringify(Object.entries(trace.diagnostics.executedNodeCountByDecisionKind).sort()),
  limitations: ["chain只含外层动作，节点内正式提交须另查planSteps及envelope", "未证明连续节点不存在并列必要后继", "未证明RNG/奖励边界可合并", "不是132个可直接删除的重复节点，也不是性能成绩"] };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ output, physicalDataNodes: rows.length, byPreviousFamily, byRootFamily,
  consecutiveCandidateCount: consecutive.length, currentDecisionCountsEqualHistorical: report.currentDecisionCountsEqualHistorical }, null, 2));
