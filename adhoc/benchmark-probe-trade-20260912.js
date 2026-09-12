"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const output = `reports/iteration/probe-trade-step465-${commit.slice(0, 8)}-20260912.json`;
if (fs.existsSync(output)) { console.log(`已有证据，不重跑：${output}`); process.exit(0); }
assert.equal(execFileSync("git", ["diff", "HEAD", "--", "randomizer"], { encoding: "utf8" }).trim(), "",
  "单决策验收要求生产代码及测试已提交");
const source = "reports/iteration/budget-before-step465-20260912.json";
const input = JSON.parse(fs.readFileSync(source));
const env = createSimulationEnv();
const report = { commit, source, scope: "探测资源准备择一第465步普通冷决策；非完整局，无采样扰动。" };
try {
  env.loadCheckpoint(input.checkpoint);
  assert.deepEqual(env.legalActions(), input.legalActions);
  console.log(`[单决策验收] ${commit.slice(0, 8)} 第465步开始`);
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
  assert(strategic.totalMilliseconds <= 18900.896959, "超过本项基线战略耗时门槛");
  const tradeNodes = strategic.executedNodeCountByFamily.quick_trade;
  assert(Number.isInteger(tradeNodes), "缺少交易节点诊断");
  report.tradeNodes = tradeNodes;
  assert(tradeNodes < 1376, "交易节点未少于1376");
  report.singleDecisionGatePassed = true;
} catch (error) {
  report.singleDecisionGatePassed = false;
  report.error = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  env.dispose();
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ output, gate: report.singleDecisionGatePassed,
    wallMs: report.wallMs, action: report.action, error: report.error }, null, 2));
}
