"use strict";
const fs = require("node:fs"), vm = require("node:vm"), assert = require("node:assert/strict");
const commit = "f0ce26ea";
const sourcePath = "adhoc/compare-probe-owner-full-20260912.js";
let source = fs.readFileSync(sourcePath, "utf8");
for (const [from, to] of [
  ["reports/iteration/probe-owner-full-comparison-40ce8e97-20260912.json", `reports/iteration/data-trade-full-comparison-${commit}-20260913.json`],
  [".40ce8e97.full.json", `.${commit}.full.json`],
  ["364f3d65.18a0d75b.full.json", "76414b52.3544e2df.full.json"],
]) {
  assert.equal(source.split(from).length, 2);
  source = source.replace(from, to);
}
// 仅读取本次终局及受测基线，不重放、不启动AI。完成前执行会显式失败。
vm.runInNewContext(source, { require, console, process }, { filename: sourcePath });
