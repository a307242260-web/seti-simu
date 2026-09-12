"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const file = "reports/seti-current-base-robot-strategy-20260911.html";
let html = fs.readFileSync(file, "utf8");
assert(html.includes("Base: public-card-runezu-greedy-20260913"), "仅迁移指定基线报告，不重复生成");
const r = JSON.parse(fs.readFileSync("reports/research/a608f874.f0ce26ea.full.json"));
const scores = JSON.parse(JSON.parse(fs.readFileSync(r.savePath)).committedState).match.finalScores;
const replace = (from, to) => { assert(html.includes(from), from); html = html.replaceAll(from, to); };
replace("public-card-runezu-greedy-20260913", "data-trade-greedy-20260913");
replace("76414b52.3544e2df", "a608f874.f0ce26ea");
replace("3544e2df-full-v300", "f0ce26ea-full-v282");
replace("3544e2df", "f0ce26ea");
replace("<strong class=\"accent\">99</strong>", "<strong class=\"accent\">92.75</strong>");
replace("<strong>608</strong>", "<strong>551</strong>");
replace("<strong class=\"amber\">42</strong>", "<strong class=\"amber\">38</strong>");
replace("996.6s", "905.3s");
replace("同一公共牌普通交易按现有资源成本择一，保留公司来源与未知手牌支付；使用已修复符文规则，预算不变。", "同一分析、放置数据及取数据扫描目标的普通资源准备沿既有成本排序择一；卡牌和角标来源分别保留，预算与估值不变。");
let scoreIndex = 0;
html = html.replace(/<div class="total">\d+<\/div><div class="parts">[^<]+<\/div>/g, () => {
  const s = scores[scoreIndex++];
  return `<div class="total">${s.totalScore}</div><div class="parts">base ${s.baseScore} · 板块 ${s.tileScore} · 卡牌 ${s.cardScore}${s.runezuSymbolScore ? ` · 符号 ${s.runezuSymbolScore}` : ""}</div>`;
});
assert.equal(scoreIndex, 4);
for (const [from, to] of [[">111</td>", ">101</td>"], ["208,030</td>", "190,662</td>"],
  ["939 / 4,096", "1,207 / 4,096"], ["1,874.1", "1,887.7"], ["53 次</td>", "48 次</td>"],
  ["42 次</td>", "38 次</td>"], ["725.9s（完整局墙钟的 72.8%）", "647.6s（完整局墙钟的 71.5%）"]]) replace(from, to);
const counts = {};
for (const seat of Object.values(r.metrics.famsBySeat)) for (const [family, n] of Object.entries(seat)) counts[family] = (counts[family] || 0) + n;
const top = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10);
let barIndex = 0;
html = html.replace(/<div class="bar-row">.*?<\/div><b>\d+<\/b><\/div>/g, () => {
  const [family, n] = top[barIndex++];
  return `<div class="bar-row"><span>${family}</span><div class="bar-track"><div class="bar-fill" style="--w:${(100 * n / top[0][1]).toFixed(1)}%"></div></div><b>${n}</b></div>`;
});
assert.equal(barIndex, 10);
replace("metrics.budgetHits.length=50", "metrics.budgetHits.length=45");
replace("42次战略4096节点截断、8次control截断。全部211次搜索执行208,130节点；战略8叶未启用，256队列截断53次。", "38次战略4096节点截断、7次control截断。全部196次搜索执行190,757节点；战略8叶未启用，256队列截断48次。");
html = html.replace(/<p>本版608步自然终局，.*?<\/p>/, '<p>本版551步自然终局，正式70/135/76/90，均92.75，全部搜索错误为空。相对基线战略节点208,030→190,662、执行截断50→45、队列53→48；耗时996.6→905.3秒，但均分99→92.75。第315步原获胜完整链仍实际保留，新链36.5分替代29.67分；41步长计划的收益兑现仍需复核。下一并列4096节点热点为432棕色移动。详见<a href="../adhoc/data-trade-full-review-20260913.md">数据交易验收证据</a>。</p>');
replace("608步、搜索诊断、动作计数与运行元数据；总耗时约996.6秒。", "551步、搜索诊断、动作计数与运行元数据；总耗时约905.3秒。");
fs.writeFileSync(file, html);
console.log("当前base报告已按正式研究记录更新，4席拆分与Top10由记录生成");
