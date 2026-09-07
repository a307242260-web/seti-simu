"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const current = JSON.parse(fs.readFileSync("reports/research/9e486f54.4212b427.full.json"));
const baseline = JSON.parse(fs.readFileSync("reports/research/13a491f3.e6923ed1.full.json"));
assert.deepEqual(current.metrics.revealEvents.map(e => [e.slotId, e.alienId]), [[1, "阿米巴"], [2, "虫"]]);
const groups = {}, summaries = {}, origins = {};
let traceNodes = 0;
for (const s of current.metrics.searches) {
  for (const [k, n] of Object.entries(s.diagnostics.executedNodeCountByDecisionKind || {})) {
    if (k.includes("effect=science_domain_alien_trace")) traceNodes += n;
  }
  for (const [k, n] of Object.entries(s.diagnostics.executedNodeCountByActionSummary || {})) {
    if (!k.startsWith("choose_target:")) continue;
    const m = k.match(/外星人 ([12]) ([粉黄蓝])(\d+)号位/);
    const group = m ? (m[1] === "2" && m[2] === "蓝" ? "虫族蓝色特殊位" : m[1] === "1" ? "阿米巴普通位" : "虫族粉黄普通位")
      : /外星人 [12] 额外痕迹位/.test(k) ? "额外3分"
      : /外星人 [12] [粉黄蓝]色痕迹/.test(k) ? "未揭示痕迹" : null;
    if (group) { groups[group] = (groups[group] || 0) + n; summaries[k] = (summaries[k] || 0) + n; }
  }
  for (const [k, n] of Object.entries(s.diagnostics.executedOriginCountByTargetAndDecisionKind || {})) {
    if (k.includes("effect=science_domain_alien_trace")) origins[k] = (origins[k] || 0) + n;
  }
}
assert.equal(Object.values(groups).reduce((a, b) => a + b, 0), traceNodes, "摘要分类必须覆盖且对齐痕迹物理节点");
const bySearchKind = r => Object.fromEntries(["control", "strategic"].map(kind => {
  const rows = r.metrics.searches.filter(s => s.kind === kind);
  const nodes = rows.reduce((n, s) => n + s.diagnostics.executedNodeCount, 0);
  return [kind, { calls: rows.length, nodes, averageNodes: nodes / rows.length }];
}));
function boundaries(record) {
  const save = JSON.parse(fs.readFileSync(record.savePath));
  const sizes = {}, roundsAndSeats = {}, rows = [];
  for (const search of record.metrics.searches.filter(s => s.kind === "strategic")) {
    const row = save.replaySteps[search.step - 1];
    const nodes = search.diagnostics.executedNodeCount;
    const size = nodes <= 10 ? "1-10" : nodes < 4096 ? "11-4095" : "4096";
    const bucket = sizes[size] ||= { calls: 0, nodes: 0 };
    bucket.calls++; bucket.nodes += nodes;
    const key = `R${row.after.r}:${search.seat}`;
    const seatBucket = roundsAndSeats[key] ||= { calls: 0, nodes: 0 };
    seatBucket.calls++; seatBucket.nodes += nodes;
    rows.push({ step: search.step, seat: search.seat, round: row.after.r, nodes,
      selectedFamily: row.action.family, selectedSummary: row.action.summary });
  }
  return { sizes, roundsAndSeats, rows };
}
const result = { source: "9e486f54.4212b427.full.json", traceNodes, groups,
  summaries: Object.fromEntries(Object.entries(summaries).sort((a, b) => b[1] - a[1])),
  origins: Object.fromEntries(Object.entries(origins).sort((a, b) => b[1] - a[1])),
  before: bySearchKind(baseline), after: bySearchKind(current),
  searchBoundaries: { before: boundaries(baseline), after: boundaries(current) },
  caveats: ["物理痕迹总数含卡牌来源56个，不能与仅普通来源14103混用",
    "origin是来源归属次数；同物理节点可有多个origin，不能把origin占比当物理节点占比",
    "累计多次选到同槽不证明同状态重复；现有聚合记录不包含每次筛选前后的候选与状态",
    "新增搜索调用的具体原因未记录，不能据此认定计划复用有bug；需按实际动作与搜索边界进一步核对"] };
fs.writeFileSync("reports/iteration/alien-trace-remaining-20260907.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ traceNodes, groups, before: result.before, after: result.after }, null, 2));
