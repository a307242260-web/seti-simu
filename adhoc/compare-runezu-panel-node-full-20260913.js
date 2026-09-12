"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
let source = fs.readFileSync("adhoc/compare-probe-owner-full-20260912.js", "utf8");
for (const [from, to] of [
  ["reports/iteration/probe-owner-full-comparison-40ce8e97-20260912.json", "reports/iteration/runezu-panel-node-full-comparison-bea7de03-20260913.json"],
  [".40ce8e97.full.json", ".bea7de03.full.json"],
  ["364f3d65.18a0d75b.full.json", "8aea2b8e.5b3f3e20.full.json"],
  ["searches: searches.length,", "searches: searches.length, allNodes: searches.reduce((n, s) => n + s.diagnostics.executedNodeCount, 0),"],
]) {
  assert.equal(source.split(from).length, 2, from);
  source = source.replace(from, to);
}
// 读取两份正式终局；不运行AI，不将规则纠错导致的分歧计为性能改动贡献。
new Function("require", "console", "process", source)(require, console, process);
