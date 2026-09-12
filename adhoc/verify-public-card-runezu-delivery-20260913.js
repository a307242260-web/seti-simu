"use strict";
const fs = require("node:fs"), vm = require("node:vm"), path = require("node:path"), assert = require("node:assert/strict");
const replacements = {
  "frontier-materialization-20260912": "public-card-runezu-greedy-20260913", "eee63294": "3544e2df",
  "597": "608", "97.75": "99", "75, 125, 102, 89": "84, 141, 86, 85",
  "203": "211", "233757": "208130", "54": "50", "60": "53",
};
const source = fs.readFileSync(path.join(__dirname, "verify-frontier-delivery-20260912.js"), "utf8")
  .replace(/frontier-materialization-20260912|eee63294|75, 125, 102, 89|97\.75|\b(?:597|203|233757|54|60)\b/g,
    value => replacements[value]);
vm.runInNewContext(source, { require, console, __dirname });
const root = path.resolve(__dirname, ".."), read = file => fs.readFileSync(path.join(root, file), "utf8");
const record = JSON.parse(read("reports/research/76414b52.3544e2df.full.json"));
const html = read("reports/seti-current-base-robot-strategy-20260911.html");
const counts = {};
for (const seat of Object.values(record.metrics.famsBySeat)) {
  for (const [kind, count] of Object.entries(seat)) counts[kind] = (counts[kind] || 0) + count;
}
for (const [, family, count] of html.matchAll(/class="bar-row"><span>(\w+)<\/span>.*?<b>(\d+)<\/b>/g)) {
  assert.equal(Number(count), counts[family]);
}
for (const search of record.metrics.searches) assert.deepEqual(search.diagnostics.failedNodeCountByCode, {});
assert(html.includes("939 / 4,096"));
assert(html.includes("base 63 · 板块 16 · 卡牌 4 · 符号 1"));
assert(html.includes("base 59 · 板块 24 · 卡牌 0 · 符号 3"));
console.log("动作构成、符号终局拆分与全部搜索错误核验通过");
