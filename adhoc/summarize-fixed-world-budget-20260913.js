"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const input = process.argv[2];
if (!input) throw new Error("需要新固定世界完整局研究记录路径");
const record = JSON.parse(fs.readFileSync(input, "utf8"));
assert.equal(record.terminal, true);
assert.equal(record.world?.worldVersion, "human-405-world-v1");
assert.ok(Array.isArray(record.metrics?.searches), "缺本次搜索明细");
const searches = record.metrics.searches.filter(search => search.kind === "strategic");
const allTruncated = record.metrics.searches.filter(search => Object.values(search.diagnostics.budgetLimits).some(limit => limit.truncated));
const truncated = searches.filter(search => Object.values(search.diagnostics.budgetLimits).some(limit => limit.truncated));
const ranked = [...allTruncated].sort((left, right) => right.diagnostics.executedNodeCount - left.diagnostics.executedNodeCount
  || right.diagnostics.totalMilliseconds - left.diagnostics.totalMilliseconds || left.step - right.step);
const selected = ranked[0] || null;
const result = { source: input, world: record.world, gitCommit: record.gitCommit,
  selectionRule: "战略/控制均只看实际截断；先按执行节点数，最大节点数并列时按耗时选择调查入口，不猜未执行节点数。",
  strategicSearches: searches.length, truncatedSearches: truncated.length,
  allTruncatedSearches: allTruncated.length,
  controlTruncatedSearches: allTruncated.filter(search => search.kind === "control"),
  executionTruncated: searches.filter(search => search.diagnostics.budgetLimits.execution.truncated).length,
  frontierTruncated: searches.filter(search => search.diagnostics.budgetLimits.frontier.truncated).length,
  maxNodeTies: selected ? ranked.filter(search => search.diagnostics.executedNodeCount === selected.diagnostics.executedNodeCount)
    .map(search => ({ step: search.step, kind: search.kind, seat: search.seat, action: search.action, milliseconds: search.diagnostics.totalMilliseconds })) : [],
  selected, topFamilies: selected ? Object.entries(selected.diagnostics.attemptedNodeCountByFamily)
    .sort((left, right) => right[1] - left[1]) : [],
};
const output = path.join(__dirname, `fixed-world-budget-${record.gitCommit}-20260913.json`);
if (fs.existsSync(output)) throw new Error(`已有同记录的预算分析：${output}`);
fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ output, strategicSearches: result.strategicSearches,
  truncatedSearches: result.truncatedSearches, tiedMaxNodes: result.maxNodeTies.length,
  selected: selected ? { step: selected.step, kind: selected.kind, seat: selected.seat, action: selected.action,
    nodes: selected.diagnostics.executedNodeCount, milliseconds: selected.diagnostics.totalMilliseconds } : null,
  topFamilies: result.topFamilies }));
