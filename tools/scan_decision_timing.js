#!/usr/bin/env node
"use strict";
// 逐步决策耗时扫描（2026-08-21 调研工具）：重放存档，逐决策调用
// runHeuristicPolicyDecision 记录耗时与搜索量（candidate/executed/limit），
// 输出 top N 慢决策（步数/席位/动作/耗时/搜索量）——定位"谁在哪里搜索多了"。
// 注意：逐步重新决策可能与存档动作分叉，耗时分布代表该代码在该状态的决策成本。
//
// 用法: node tools/scan_decision_timing.js <存档> [topN] [起始步] [结束步]
const fs = require("node:fs");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");

const [savePath, topNArg, fromArg, toArg] = process.argv.slice(2);
if (!savePath) {
  console.error("用法: node tools/scan_decision_timing.js <存档> [topN] [起始步] [结束步]");
  process.exit(2);
}
const topN = Number(topNArg) || 30;
const from = Number(fromArg) || 0;
const to = Number(toArg) || Infinity;

const save = JSON.parse(fs.readFileSync(savePath, "utf-8"));
const env = createSimulationEnv();
env.reset({ seed: save.seed, activePlayerCount: 4 });
const replaySteps = save.replaySteps || [];
const records = [];
const limit = Math.min(to, replaySteps.length);
for (let i = 0; i < limit; i++) {
  if (i < from) { env.step(replaySteps[i].action); continue; }
  const t0 = Date.now();
  const res = env.runHeuristicPolicyDecision(false);
  const ms = Date.now() - t0;
  const diag = env.getCounterfactualDiagnostics?.() || {};
  const archiveAction = String(replaySteps[i]?.action?.actionId || "");
  const chosenAction = String(res.actionId || "");
  records.push({
    step: i,
    seat: res.actorPlayerId || replaySteps[i]?.actorPlayerId || "?",
    action: chosenAction.split(":")[0],
    ms,
    match: chosenAction === archiveAction || chosenAction.split(":")[0] === archiveAction.split(":")[0],
    candidates: diag.candidateCount ?? null,
    executed: diag.executedNodeCount ?? null,
    limit: Boolean(diag.executionLimitReached),
    frontier: diag.remainingFrontierNodeCount ?? null,
  });
  if (i % 50 === 0) process.stderr.write(`[scan] 步 ${i}/${limit}\n`);
}
env.dispose();

records.sort((a, b) => b.ms - a.ms);
const totalMs = records.reduce((s, r) => s + r.ms, 0);
console.log(`\n== 耗时扫描（${records.length} 决策，总 ${Math.round(totalMs / 1000)}s，平均 ${(totalMs / records.length / 1000).toFixed(2)}s/决策）==`);
console.log("== Top " + topN + " 慢决策 ==");
for (const r of records.slice(0, topN)) {
  console.log(`  步${r.step} ${r.seat} ${r.action.padEnd(12)} ${(r.ms / 1000).toFixed(1)}s 根=${r.candidates} 执行=${r.executed} 触顶=${r.limit} frontier=${r.frontier}`);
}
// 按席位汇总
const bySeat = {};
let mismatch = 0;
for (const r of records) {
  const s = bySeat[r.seat] || (bySeat[r.seat] = { count: 0, ms: 0, slow: 0 });
  s.count += 1; s.ms += r.ms;
  if (r.ms > 5000) s.slow += 1;
  if (r.match === false) mismatch += 1;
}
console.log(`\n== 与存档动作不一致决策数: ${mismatch}/${records.length} ==`);
console.log("\n== 按席位汇总 ==");
for (const [seat, s] of Object.entries(bySeat)) {
  console.log(`  ${seat}: ${s.count} 决策 ${(s.ms / 1000).toFixed(0)}s (${(s.ms / s.count / 1000).toFixed(2)}s/平均) 慢决策(>5s): ${s.slow}`);
}
