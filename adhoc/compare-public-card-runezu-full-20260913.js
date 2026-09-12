"use strict";
const fs = require("node:fs"), vm = require("node:vm"), assert = require("node:assert/strict");
const commit = process.argv[2];
assert(/^[0-9a-f]{8}$/.test(commit || ""), "传入完整局受测提交的8位hash");
const sourcePath = "adhoc/compare-probe-owner-full-20260912.js";
let source = fs.readFileSync(sourcePath, "utf8");
for (const [from, to] of [
  ["reports/iteration/probe-owner-full-comparison-40ce8e97-20260912.json", `reports/iteration/public-card-runezu-full-comparison-${commit}-20260913.json`],
  [".40ce8e97.full.json", `.${commit}.full.json`],
  ["364f3d65.18a0d75b.full.json", "e16bc101.f105f8ea.full.json"],
]) {
  assert.equal(source.split(from).length, 2);
  source = source.replace(from, to);
}
// 仅读取已完成记录及save-final；不重放、不运行AI。
vm.runInNewContext(source, { require, console, process }, { filename: sourcePath });
