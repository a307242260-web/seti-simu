"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const file = "reports/seti-current-base-robot-strategy-20260911.html";
let html = fs.readFileSync(file, "utf8");
assert(html.includes("Base: data-trade-greedy-20260913"));
const r = JSON.parse(fs.readFileSync("reports/research/8aea2b8e.5b3f3e20.full.json"));
const scores = JSON.parse(JSON.parse(fs.readFileSync(r.savePath)).committedState).match.finalScores;
const replace = (a, b) => { assert(html.includes(a), a); html = html.replaceAll(a, b); };
for (const [a, b] of [
  ["data-trade-greedy-20260913", "final-income-input-fix-20260913"],
  ["a608f874.f0ce26ea", "8aea2b8e.5b3f3e20"], ["f0ce26ea-full-v282", "5b3f3e20-full-v307"], ["f0ce26ea", "5b3f3e20"],
  ['<strong class="accent">92.75</strong>', '<strong class="accent">101.75</strong>'],
  ["<strong>551</strong>", "<strong>629</strong>"], ['<strong class="amber">38</strong>', '<strong class="amber">48</strong>'],
  ["905.3s", "1209.7s"], [">101</td>", ">119</td>"], ["190,662</td>", "242,870</td>"],
  ["1,207 / 4,096", "2,438 / 4,096"], ["1,887.7", "2,040.9"], ["48 次</td>", "61 次</td>"],
  ["38 次</td>", "48 次</td>"], ["647.6s（完整局墙钟的 71.5%）", "867.1s（完整局墙钟的 71.7%）"],
  ["metrics.budgetHits.length=45", "metrics.budgetHits.length=55"],
  ["38次战略4096节点截断、7次control截断。全部196次搜索执行190,757节点；战略8叶未启用，256队列截断48次。",
    "48次战略4096节点截断、7次control截断。全部232次搜索执行242,983节点；战略8叶未启用，256队列截断61次。"],
  ["551步、搜索诊断、动作计数与运行元数据；总耗时约905.3秒。", "629步、搜索诊断、动作计数与运行元数据；总耗时约1209.7秒。"],
  ["选即时终局分最高项。", "选即时终局分最高项。A1/A2扣除正式公司初始收入；共享观察提供该公开字段，缺少必需计分输入时显式报错。"],
]) replace(a, b);
let i = 0;
html = html.replace(/<div class="total">\d+<\/div><div class="parts">[^<]+<\/div>/g, () => {
  const s = scores[i++]; return `<div class="total">${s.totalScore}</div><div class="parts">base ${s.baseScore} · 板块 ${s.tileScore} · 卡牌 ${s.cardScore}${s.runezuSymbolScore ? ` · 符号 ${s.runezuSymbolScore}` : ""}</div>`;
}); assert.equal(i, 4);
const counts = {};
for (const seat of Object.values(r.metrics.famsBySeat)) for (const [f, n] of Object.entries(seat)) counts[f] = (counts[f] || 0) + n;
const top = Object.entries(counts).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])).slice(0,10); i = 0;
html = html.replace(/<div class="bar-row">.*?<\/div><b>\d+<\/b><\/div>/g, () => {
  const [f,n] = top[i++]; return `<div class="bar-row"><span>${f}</span><div class="bar-track"><div class="bar-fill" style="--w:${(100*n/top[0][1]).toFixed(1)}%"></div></div><b>${n}</b></div>`;
}); assert.equal(i, 10);
assert.equal((html.match(/<p>本版551步自然终局，.*?<\/p>/g) || []).length, 1);
html = html.replace(/<p>本版551步自然终局，.*?<\/p>/, '<p>本版629步自然终局，正式88/126/91/102，均101.75，全部搜索错误为空。公司初始收入修复后，第152步棕色标记从A改D：A旧估8分、正式0分，D为7分。相对基线均分92.75→101.75，但战略节点190,662→242,870、执行截断45→55、队列48→61、耗时905.3→1209.7秒；本项不是预算优化。下一并列4096节点热点为334蓝色放置数据。详见<a href="../adhoc/final-income-full-review-20260913.md">收入计分输入验收证据</a>。</p>');
fs.writeFileSync(file, html);
console.log("当前base报告已更新；数字来自正式记录和终局存档");
