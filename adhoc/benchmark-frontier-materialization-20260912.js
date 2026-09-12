"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const output = `reports/iteration/frontier-materialization-step188-${commit.slice(0, 8)}-20260912.json`;
if (fs.existsSync(output)) { console.log(`已有记录，跳过：${output}`); process.exit(0); }
const source = "reports/iteration/budget-before-step188-20260912.json";
const input = JSON.parse(fs.readFileSync(source));
const env = createSimulationEnv();
const record = { commit, source, scope: "188步冷计划完整生产决策，无CPU采样及路线trace，不是整局实验" };
try {
  delete input.checkpoint.replaySteps;
  env.loadCheckpoint(input.checkpoint);
  assert.deepEqual(env.legalActions(), input.legalActions);
  console.log(`[单决策验收] ${commit.slice(0, 8)} 第188步开始`);
  const start = performance.now();
  const result = env.runHeuristicPolicyDecision();
  record.wallMs = performance.now() - start;
  record.selectedActionId = result.policyDecision?.actionId;
  record.searches = result.searches;
  record.plan = result.plan;
  const strategic = result.searches.find(s => s.kind === "strategic").diagnostics;
  assert.equal(result.ok, true);
  assert.equal(record.selectedActionId, input.expectedAction.actionId);
  assert.equal(strategic.executedNodeCount, 4096);
  assert.deepEqual(strategic.failedNodeCountByCode, {});
  assert.equal(strategic.budgetLimits.execution.truncated, true);
  assert.equal(strategic.budgetLimits.frontier.truncated, true);
  assert(strategic.totalMilliseconds < 21172.366291, "正式搜索耗时必须低于原记录");
  record.passed = true;
} catch (error) {
  record.passed = false;
  record.error = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  env.dispose();
  fs.writeFileSync(output, JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ output, passed: record.passed, wallMs: record.wallMs,
    searches: record.searches?.map(s => ({ kind: s.kind, nodes: s.diagnostics.executedNodeCount,
      ms: s.diagnostics.totalMilliseconds })), error: record.error }, null, 2));
}
