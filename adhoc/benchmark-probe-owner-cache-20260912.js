"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const output = `adhoc/probe-owner-step435-${commit.slice(0, 8)}-20260912.json`;
if (fs.existsSync(output)) { console.log(`已有证据，不重跑：${output}`); process.exit(0); }
assert.equal(execFileSync("git", ["diff", "HEAD", "--", "randomizer"], { encoding: "utf8" }).trim(), "");
const source = "/tmp/seti-income-choice-20260912.IDDQWq/reports/iteration/budget-before-step435-20260912.json";
const input = JSON.parse(fs.readFileSync(source));
const env = createSimulationEnv(), report = { commit, source, scope: "缓存来源隔离435冷决策；不改预算或估值" };
try {
  env.loadCheckpoint(input.checkpoint); assert.deepEqual(env.legalActions(), input.legalActions);
  console.log(`[单决策验收] ${commit.slice(0, 8)} 第435步开始`);
  const start = performance.now(), result = env.runHeuristicPolicyDecision();
  report.wallMs = performance.now() - start;
  report.action = result.policyDecision?.actionId; report.searches = result.searches;
  assert.equal(result.ok, true);
  const strategic = result.searches.find(s => s.kind === "strategic").diagnostics;
  assert.deepEqual(strategic.failedNodeCountByCode, {});
  assert.equal(strategic.budgetLimits.execution.limit, 4096);
  assert.equal(strategic.budgetLimits.frontier.limit, 256);
  assert(strategic.totalMilliseconds <= 16403.406917, "超过实施前战略耗时门槛");
  report.singleDecisionGatePassed = true;
} catch (error) {
  report.singleDecisionGatePassed = false; report.error = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ output, gate: report.singleDecisionGatePassed, wallMs: report.wallMs,
    action: report.action, error: report.error }, null, 2));
}
