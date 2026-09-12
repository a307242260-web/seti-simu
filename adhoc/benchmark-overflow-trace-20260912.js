"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const output = `reports/iteration/overflow-trace-step542-${commit.slice(0, 8)}-20260912.json`;
if (fs.existsSync(output)) { console.log(`已有结果：${output}`); process.exit(0); }
const evidence = JSON.parse(fs.readFileSync("reports/iteration/step542-overflow-choices-20260912.json"));
const selection = evaluator.selectSecondaryAgentRootActions({ focalSeatId: "player-green",
  rootObservation: evidence.before, legalActions: evidence.legal });
assert.equal(evidence.legal.length, 2);
assert.equal(selection.length, 1);
const input = JSON.parse(fs.readFileSync("reports/iteration/budget-before-step542-20260912.json"));
const env = createSimulationEnv();
const report = { commit, input: "budget-before-step542-20260912.json", realRewardCandidates: [2, selection.length],
  scope: "普通冷决策，无trace或CPU采样；统计诊断标签只用于归因，不参与策略。" };
try {
  env.loadCheckpoint(input.checkpoint);
  assert.deepEqual(env.legalActions(), input.legalActions);
  console.log(`[单决策] 第542步 ${commit.slice(0, 8)} 开始`);
  const result = env.runHeuristicPolicyDecision();
  report.ok = result.ok;
  report.action = result.policyDecision?.actionId;
  report.searches = result.searches;
  report.diagnostics = env.getCounterfactualDiagnostics();
  const d = result.searches.find(s => s.kind === "strategic").diagnostics;
  report.extraNodes = Object.entries(d.executedNodeCountByActionSummary)
    .filter(([key]) => key.includes("额外痕迹位")).reduce((n, [,count]) => n + count, 0);
  assert.equal(result.ok, true);
  assert.deepEqual(d.failedNodeCountByCode, {});
  assert(report.extraNodes < 686, "额外位节点未减少");
  assert(d.totalMilliseconds <= 18920.616, "单步耗时门槛未达到");
  report.pass = true;
} catch (error) {
  report.pass = false;
  report.error = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  env.dispose();
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ output, pass: report.pass, extraNodes: report.extraNodes,
    ms: report.diagnostics?.totalMilliseconds, error: report.error }, null, 2));
}
