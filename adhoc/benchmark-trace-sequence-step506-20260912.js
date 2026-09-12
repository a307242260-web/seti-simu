"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const output = `reports/iteration/trace-sequence-step506-${commit.slice(0, 8)}-20260912.json`;
if (fs.existsSync(output)) { console.log(`已有记录，跳过：${output}`); process.exit(0); }
const source = "reports/iteration/budget-before-step506-20260912.json";
const input = JSON.parse(fs.readFileSync(source));
const env = createSimulationEnv();
const record = { commit, source, scope: "第506步冷计划普通生产决策；无CPU采样，无额外路线trace，不是整局实验" };
try {
  env.loadCheckpoint(input.checkpoint);
  assert.deepEqual(env.legalActions(), input.legalActions);
  console.log(`[单决策验收] ${commit.slice(0, 8)} 第506步开始`);
  const start = performance.now();
  const result = env.runHeuristicPolicyDecision();
  record.wallMs = performance.now() - start;
  record.selectedActionId = result.policyDecision?.actionId;
  record.searches = result.searches;
  record.plan = result.plan;
  assert.equal(result.ok, true);
  const strategic = result.searches.find(s => s.kind === "strategic").diagnostics;
  assert.deepEqual(strategic.failedNodeCountByCode, {});
  assert(strategic.totalMilliseconds < 18491.899833, "第506步搜索耗时没有低于基线");
  record.timingGatePassed = true;
  record.passed = false;
  record.pending = "仍须结合物理节点复用证据判断，不以耗时一个指标自动通过";
} catch (error) {
  record.passed = false;
  record.error = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  env.dispose();
  fs.writeFileSync(output, JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ output, timingGatePassed: record.timingGatePassed,
    wallMs: record.wallMs, searches: record.searches?.map(s => ({ kind: s.kind,
      nodes: s.diagnostics.executedNodeCount, ms: s.diagnostics.totalMilliseconds,
      transpositionHitCount: s.diagnostics.transpositionHitCount })), error: record.error }, null, 2));
}
