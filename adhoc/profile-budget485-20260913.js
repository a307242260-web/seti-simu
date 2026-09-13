"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "adhoc/budget485-trace-093a25c6-20260913.json";
if (fs.existsSync(output)) { console.log(`[skip] 已有诊断：${output}`); process.exit(0); }
const input = JSON.parse(fs.readFileSync("adhoc/budget485-input-20260913.json"));
const env = createSimulationEnv();
const record = { source: "adhoc/budget485-input-20260913.json", commit: execFileSync("git", ["rev-parse", "HEAD"], {encoding:"utf8"}).trim(),
  scope: "第485步冷决策目标簇跟踪；不重复AI完整局，策略和预算不改。" };
try {
  input.checkpoint.config.traceCounterfactualGoalClusters = true;
  env.loadCheckpoint(input.checkpoint);
  assert.deepEqual(env.legalActions(), input.legalActions);
  console.log("[单决策诊断] 第485步 · 绿色 · 4096节点/256队列/既有30秒期限 · 开始目标簇跟踪");
  const start = performance.now();
  const result = env.runHeuristicPolicyDecision();
  record.wallMs = performance.now() - start;
  record.ok = result.ok;
  record.actionId = result.actionId || result.policyDecision?.actionId;
  record.searches = result.searches;
  record.plan = result.plan;
  record.diagnostics = env.getCounterfactualDiagnostics();
  assert.equal(result.ok, true);
} catch (error) {
  record.error = { message: error.message, stack: error.stack };
  console.error(error);
  process.exitCode = 1;
} finally {
  env.dispose();
  fs.writeFileSync(output, JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
  console.log(`[单决策诊断完成] 动作=${record.actionId} 用时=${record.wallMs?.toFixed(1)}ms 成功=${record.ok} 证据=${output}`);
}
