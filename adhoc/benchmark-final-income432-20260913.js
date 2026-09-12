"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
let source = fs.readFileSync("adhoc/benchmark-data-trade-432-20260913.js", "utf8");
for (const [from, to] of [
  ["data-trade-432-", "final-income-432-"],
  ["/tmp/seti-trace432-20260913.MuND9M/adhoc/trace432-input-20260913.json", "/tmp/seti-income432-audit-20260913.TPxMg7/adhoc/income432-input-20260913.json"],
  ["/tmp/seti-trace432-20260913.MuND9M/adhoc/trace432-distribution-20260913.json", "/tmp/seti-income432-audit-20260913.TPxMg7/adhoc/income432-distribution-20260913.json"],
  ["player-green", "player-brown"],
  ["18745.181583, trades: report.trades < 499", "17044.438583"],
]) {
  assert.equal(source.split(from).length, 2, from);
  source = source.replace(from, to);
}
// 复用同一冷决策检查，仅替换输入、基线、席位、既定时间门槛；不要求交易减少。
new Function("require", "console", "process", "performance", source)(require, console, process, performance);
