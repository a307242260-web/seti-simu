"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
let source = fs.readFileSync("adhoc/compare-probe-owner-full-20260912.js", "utf8");
for (const [from, to] of [
  ["reports/iteration/probe-owner-full-comparison-40ce8e97-20260912.json", "reports/iteration/final-income-full-comparison-5b3f3e20-20260913.json"],
  [".40ce8e97.full.json", ".5b3f3e20.full.json"],
  ["364f3d65.18a0d75b.full.json", "a608f874.f0ce26ea.full.json"],
]) {
  assert.equal(source.split(from).length, 2, from);
  source = source.replace(from, to);
}
// 仅读取受测基线与本次正式终局，不重放、不运行AI。
new Function("require", "console", "process", source)(require, console, process);
