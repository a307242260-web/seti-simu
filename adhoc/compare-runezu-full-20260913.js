"use strict";
const fs = require("node:fs"), vm = require("node:vm"), assert = require("node:assert/strict");
const sourcePath = "adhoc/compare-probe-owner-full-20260912.js";
let source = fs.readFileSync(sourcePath, "utf8");
for (const [from, to] of [
  ["reports/iteration/probe-owner-full-comparison-40ce8e97-20260912.json", "reports/iteration/runezu-full-comparison-f105f8ea-20260913.json"],
  [".40ce8e97.full.json", ".f105f8ea.full.json"],
  ["364f3d65.18a0d75b.full.json", "6502f820.40ce8e97.full.json"],
]) {
  assert.equal(source.split(from).length, 2);
  source = source.replace(from, to);
}
// 读取已完成记录与save-final，不运行规则或AI。
vm.runInNewContext(source, { require, console, process }, { filename: sourcePath });
