"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const replacements = { "frontier-materialization-20260912": "final-income-input-fix-20260913",
  "eee63294": "5b3f3e20", "597": "629", "97.75": "101.75", "75, 125, 102, 89": "88, 126, 91, 102",
  "203": "232", "233757": "242983", "54": "55", "60": "61" };
const source = fs.readFileSync("adhoc/verify-frontier-delivery-20260912.js", "utf8")
  .replace(/frontier-materialization-20260912|eee63294|75, 125, 102, 89|97\.75|\b(?:597|203|233757|54|60)\b/g, x => replacements[x]);
new Function("require", "console", "__dirname", source)(require, console, __dirname);
const r = JSON.parse(fs.readFileSync("reports/research/8aea2b8e.5b3f3e20.full.json"));
const html = fs.readFileSync("reports/seti-current-base-robot-strategy-20260911.html", "utf8");
const counts = {};
for (const seat of Object.values(r.metrics.famsBySeat)) for (const [f,n] of Object.entries(seat)) counts[f] = (counts[f] || 0) + n;
for (const [, f,n] of html.matchAll(/class="bar-row"><span>(\w+)<\/span>.*?<b>(\d+)<\/b>/g)) assert.equal(Number(n), counts[f]);
for (const s of r.metrics.searches) assert.deepEqual(s.diagnostics.failedNodeCountByCode, {});
assert(html.includes("2,438 / 4,096"));
assert(html.includes("A旧估8分、正式0分，D为7分"));
assert.equal(JSON.parse(fs.readFileSync("reports/iteration/registry.json")).warnings.filter(x => x.level === "warn").length, 5);
console.log("收入输入修复：动作构成、异常、分位数、分歧说明及历史警告核验通过");
