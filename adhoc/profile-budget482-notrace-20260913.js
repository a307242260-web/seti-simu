"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "adhoc/budget482-trace-notrace-20260913.json";
if (fs.existsSync(output)) { console.log(`[skip] 已有诊断：${output}`); process.exit(0); }
const input = JSON.parse(fs.readFileSync("adhoc/budget482-input-20260913.json"));
const env = createSimulationEnv();
const record = { source: "adhoc/budget482-input-20260913.json",
  commit: execFileSync("git", ["rev-parse", "HEAD"], {encoding:"utf8"}).trim(),
  scope: "第482步白席 industry 最慢决策耗时剖析；只读诊断，策略与预算不改。" };
try {
  input.checkpoint.config.traceCounterfactualGoalClusters = false;
  env.loadCheckpoint(input.checkpoint);
  assert.deepEqual(env.legalActions(), input.legalActions);
  console.log("[耗时剖析] 第482步 · 白色 · 4096/256/30秒不变");
  const start = performance.now();
  const result = env.runHeuristicPolicyDecision();
  record.wallMs = performance.now() - start;
  record.ok = result.ok;
  record.actionId = result.actionId;
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
  console.log(`[耗时剖析完成] 动作=${record.actionId} 用时=${record.wallMs?.toFixed(1)}ms 证据=${output}`);
}
