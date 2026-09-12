"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const file="reports/seti-current-base-robot-strategy-20260911.html";
let html=fs.readFileSync(file,"utf8");assert(html.includes("Base: final-income-input-fix-20260913"));
const r=JSON.parse(fs.readFileSync("reports/research/22249691.bea7de03.full.json"));
const scores=JSON.parse(JSON.parse(fs.readFileSync("seti-saves/seti-save-research-runezu-panel-node-projection-20260913-bea7de03-full-v238.json")).committedState).match.finalScores;
for(const [a,b]of [
 ["final-income-input-fix-20260913","runezu-panel-node-projection-20260913"],["8aea2b8e.5b3f3e20","22249691.bea7de03"],["5b3f3e20-full-v307","bea7de03-full-v238"],["5b3f3e20","bea7de03"],
 ['<strong class="accent">101.75</strong>','<strong class="accent">77.75</strong>'],["<strong>629</strong>","<strong>482</strong>"],['<strong class="amber">48</strong>','<strong class="amber">36</strong>'],["1209.7s","756.5s"],[">119</td>",">87</td>"],["242,870</td>","166,078</td>"],["2,438 / 4,096","751 / 4,096"],["2,040.9","1,908.9"],["61 次</td>","42 次</td>"],["48 次</td>","36 次</td>"],["867.1s（完整局墙钟的 71.7%）","572.7s（完整局墙钟的 75.7%）"],["metrics.budgetHits.length=55","metrics.budgetHits.length=39"],
 ["48次战略4096节点截断、7次control截断。全部232次搜索执行242,983节点；战略8叶未启用，256队列截断61次。","36次战略4096节点截断、3次control截断。全部168次搜索执行166,159节点；战略8叶未启用，256队列截断42次。"],
 ["629步、搜索诊断、动作计数与运行元数据；总耗时约1209.7秒。","482步、搜索诊断、动作计数与运行元数据；总耗时约756.5秒。"],
 ["同一分析、放置数据及取数据扫描目标的普通资源准备沿既有成本排序择一；卡牌和角标来源分别保留，预算与估值不变。","修复符文三色痕迹1/4位面板符号奖励；单个物理节点内复用完整投影，按遮蔽边界隔离，观察批次复用事实副本。预算与估值权重不变。"]
]){assert(html.includes(a),a);html=html.replaceAll(a,b);}
const previous=fs.readFileSync("adhoc/update-final-income-base-report-20260913.js","utf8");
const start=previous.indexOf("let i = 0;"),end=previous.indexOf("assert.equal((html.match");assert(start>=0&&end>start);
html=new Function("html","r","scores","assert",previous.slice(start,end)+"return html;")(html,r,scores,assert);
assert.equal((html.match(/<p>本版629步自然终局，.*?<\/p>/g)||[]).length,1);
html=html.replace(/<p>本版629步自然终局，.*?<\/p>/,'<p>本版482步自然终局，正式67/93/70/81，均77.75，搜索错误为空。相对基线均分101.75→77.75，执行截断55→39、队列61→42。334共同输入冷决策65.12→23.56秒，6701叶等价；不把整局缩短全计为优化贡献。首次可见分歧231已追溯至186，仅符文修复即改变后续计划，叠加投影优化后该决策评分与链一致；整局降分未完全归因。下一并列4096节点热点为434白色交易。详见<a href="iteration/runezu-panel-node-acceptance-20260913.md">本项验收证据</a>。</p>');
fs.writeFileSync(file,html);console.log("当前base报告更新完成，数字来自正式记录和存档");
