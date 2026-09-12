"use strict";
const fs = require("node:fs"), vm = require("node:vm"), path = require("node:path"), assert = require("node:assert/strict");
const replacements = { "frontier-materialization-20260912": "data-trade-greedy-20260913",
  "eee63294": "f0ce26ea", "597": "551", "97.75": "92.75", "75, 125, 102, 89": "70, 135, 76, 90",
  "203": "196", "233757": "190757", "54": "45", "60": "48" };
const source = fs.readFileSync(path.join(__dirname, "verify-frontier-delivery-20260912.js"), "utf8")
  .replace(/frontier-materialization-20260912|eee63294|75, 125, 102, 89|97\.75|\b(?:597|203|233757|54|60)\b/g, v => replacements[v]);
vm.runInNewContext(source, { require, console, __dirname });
const record = JSON.parse(fs.readFileSync("reports/research/a608f874.f0ce26ea.full.json"));
const html = fs.readFileSync("reports/seti-current-base-robot-strategy-20260911.html", "utf8");
const counts = {};
for (const seat of Object.values(record.metrics.famsBySeat)) for (const [f, n] of Object.entries(seat)) counts[f] = (counts[f] || 0) + n;
for (const [, family, n] of html.matchAll(/class="bar-row"><span>(\w+)<\/span>.*?<b>(\d+)<\/b>/g)) assert.equal(Number(n), counts[family]);
for (const s of record.metrics.searches) assert.deepEqual(s.diagnostics.failedNodeCountByCode, {});
assert(html.includes("1,207 / 4,096"));
assert(html.includes("base 61 · 板块 14 · 卡牌 0 · 符号 1"));
console.log("数据交易：动作构成、全部错误、节点分位及终局拆分核验通过");
