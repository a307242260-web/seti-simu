"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const source = "reports/research/91f9a83a.73e7b2ca.full.json";
const output = "reports/iteration/card-choice-census-20260907.json";
const sum = object => Object.values(object).reduce((a, b) => a + b, 0);
const merge = (a, b) => { for (const [key, n] of Object.entries(b)) a[key] = (a[key] || 0) + n; };
const selected = (object, prefix) => Object.fromEntries(Object.entries(object).filter(([key]) => key.startsWith(prefix)));
function aggregate(searches) {
  const result = { nodes: 0, attempts: 0, failures: 0, kinds: {}, summaries: {} };
  for (const { diagnostics: d } of searches) {
    result.nodes += d.executedNodeCount;
    result.attempts += d.attemptedNodeCountByFamily.choose_card || 0;
    result.failures += d.failedNodeCountByFamily.choose_card || 0;
    merge(result.kinds, selected(d.executedNodeCountByDecisionKind, "choose_card:"));
    merge(result.summaries, selected(d.executedNodeCountByActionSummary, "choose_card:"));
  }
  assert.equal(sum(result.kinds) + result.failures, result.attempts);
  assert.equal(sum(result.summaries) + result.failures, result.attempts);
  result.kinds = Object.fromEntries(Object.entries(result.kinds).sort((a,b) => b[1]-a[1]));
  result.summaries = Object.fromEntries(Object.entries(result.summaries).sort((a,b) => b[1]-a[1]));
  result.percentOfNodes = result.attempts * 100 / result.nodes;
  return result;
}
if (fs.existsSync(output)) console.log(`已有统计，跳过：${output}`);
else {
  const bytes = fs.readFileSync(source), record = JSON.parse(bytes), searches = record.metrics.searches;
  const report = { source, sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    scope: "只读现有逐次搜索；kind与summary为两种独立口径，不交叉推断；origin可重叠，不相加为物理节点",
    all: aggregate(searches),
    fullBudget: aggregate(searches.filter(s => s.kind === "strategic" && s.diagnostics.executedNodeCount >= s.diagnostics.maxExecutionNodes)),
    hotspots: searches.filter(s => s.diagnostics.attemptedNodeCountByFamily.choose_card)
      .map(s => ({ step: s.step, seat: s.seat, ...aggregate([s]),
        originKinds: Object.fromEntries(Object.entries(s.diagnostics.executedOriginCountByTargetAndDecisionKind)
          .filter(([key]) => key.includes(" -> choose_card:")).sort((a,b) => b[1]-a[1])) }))
      .sort((a,b) => b.attempts-a.attempts) };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ all: { attempts: report.all.attempts, percent: report.all.percentOfNodes, kinds: report.all.kinds },
    fullBudget: { attempts: report.fullBudget.attempts, percent: report.fullBudget.percentOfNodes, kinds: report.fullBudget.kinds },
    hotspots: report.hotspots.slice(0, 6).map(({step,seat,attempts,kinds})=>({step,seat,attempts,kinds})) }, null, 2));
}
