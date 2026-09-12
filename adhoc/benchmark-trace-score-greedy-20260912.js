"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const output = `reports/iteration/trace-score-greedy-step506-${commit.slice(0, 8)}-20260912.json`;
if (fs.existsSync(output)) { console.log(`已有记录，不重跑：${output}`); process.exit(0); }
const source = "reports/iteration/budget-before-step506-20260912.json";
const input = JSON.parse(fs.readFileSync(source));
const env = createSimulationEnv();
const report = { commit, source, scope: "第506步冷计划普通生产决策，无trace、无CPU采样。" };
try {
  env.loadCheckpoint(input.checkpoint);
  assert.deepEqual(env.legalActions(), input.legalActions);
  console.log(`[单决策验收] ${commit.slice(0, 8)} 第506步开始`);
  const start = performance.now();
  const result = env.runHeuristicPolicyDecision();
  report.wallMs = performance.now() - start;
  report.action = result.policyDecision?.actionId;
  report.searches = result.searches;
  report.diagnostics = env.getCounterfactualDiagnostics();
  report.plan = result.plan;
  assert.equal(result.ok, true);
  const strategic = result.searches.find(s => s.kind === "strategic").diagnostics;
  assert.deepEqual(strategic.failedNodeCountByCode, {});
  assert(strategic.totalMilliseconds < 18491.899833, "第506步耗时未低于基线");
  report.singleDecisionGatePassed = true;
} catch (error) {
  report.singleDecisionGatePassed = false;
  report.error = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  env.dispose();
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ output, gate: report.singleDecisionGatePassed, action: report.action,
    wallMs: report.wallMs, nodes: report.diagnostics?.executedNodeCount,
    ms: report.diagnostics?.totalMilliseconds, error: report.error }, null, 2));
}
