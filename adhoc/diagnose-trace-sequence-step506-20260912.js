"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/trace-sequence-step506-diagnostic-20260912.json";
if (fs.existsSync(output)) { console.log(`已有诊断，不重跑：${output}`); process.exit(0); }
const source = "reports/iteration/budget-before-step506-20260912.json";
const input = JSON.parse(fs.readFileSync(source));
const env = createSimulationEnv();
const report = { source, gitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  configDifference: { traceCounterfactualGoalClusters: true },
  scope: "显式目标trace及原生复用归因；独立于普通benchmark，耗时不作普通运行比较。" };
try {
  input.checkpoint.config.traceCounterfactualGoalClusters = true;
  env.loadCheckpoint(input.checkpoint);
  assert.deepEqual(env.legalActions(), input.legalActions);
  console.log("[单决策诊断] 第506步：目标trace与编号排列复用归因开启");
  const result = env.runHeuristicPolicyDecision();
  report.ok = result.ok;
  report.action = result.policyDecision?.actionId;
  report.searches = result.searches;
  report.diagnostics = env.getCounterfactualDiagnostics();
  assert.equal(result.ok, true);
  assert.deepEqual(report.diagnostics.failedNodeCountByCode, {});
  assert(report.diagnostics.tracePermutationReuse, "必须实际开启归因采集");
} catch (error) {
  report.error = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  env.dispose();
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ output, ok: report.ok, action: report.action,
    reuse: report.diagnostics?.tracePermutationReuse,
    transpositions: report.diagnostics?.transpositionHitCount,
    nodes: report.diagnostics?.executedNodeCount, error: report.error }, null, 2));
}
