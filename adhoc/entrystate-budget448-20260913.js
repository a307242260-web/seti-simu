"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "adhoc/budget448-entrystate-dcc5e420-20260913.json";
if (fs.existsSync(output)) { console.log(`[skip] 已有诊断：${output}`); process.exit(0); }
const input = JSON.parse(fs.readFileSync("adhoc/budget448-input-20260913.json"));
const env = createSimulationEnv();
const record = { source: "adhoc/budget448-input-20260913.json", step: 448,
  scope: "第448步冷决策入口状态等价核查；只读诊断，策略与预算不改。" };
try {
  input.checkpoint.config.traceCounterfactualGoalClusters = true;
  env.loadCheckpoint(input.checkpoint);
  assert.deepEqual(env.legalActions(), input.legalActions);
  console.log("[入口状态核查] 第448步 · 白色 · 4096/256/30秒不变");
  const started = performance.now();
  const result = env.runHeuristicPolicyDecision();
  record.wallMs = performance.now() - started;
  record.ok = result.ok;
  record.actionId = result.actionId;
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
  console.log(`[入口状态核查完成] 动作=${record.actionId} 用时=${record.wallMs?.toFixed(1)}ms 证据=${output}`);
}
