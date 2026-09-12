"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const output = `reports/iteration/alien-pick-greedy-step506-${commit.slice(0, 8)}-20260912.json`;
if (fs.existsSync(output)) { console.log(`已有证据，不重跑：${output}`); process.exit(0); }
assert.equal(execFileSync("git", ["diff", "HEAD", "--", "randomizer"], { encoding: "utf8" }).trim(), "",
  "单决策验收要求生产代码及测试已提交");
const source = "reports/iteration/budget-before-step506-20260912.json";
const input = JSON.parse(fs.readFileSync(source));
const env = createSimulationEnv();
const report = { commit, source, scope: "外星拿牌局部贪心第506步普通冷决策；非完整局，无采样扰动。" };
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
  assert(strategic.totalMilliseconds <= 18747.470125, "超过本项基线战略耗时门槛");
  const alienPickNodes = strategic.executedNodeCountByDecisionKind["choose_card:conditional/decision=choose_card/effect=residual_alien_card_decision"];
  assert(Number.isInteger(alienPickNodes), "诊断缺少外星拿牌节点，不得补零");
  report.alienPickNodes = alienPickNodes;
  assert(alienPickNodes < 548, "外星拿牌节点未少于基线548");
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
