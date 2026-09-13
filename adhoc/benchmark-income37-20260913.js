"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
const output = `adhoc/income37-${commit}-20260913.json`;
if (fs.existsSync(output)) { console.log(`[skip] ${output}`); process.exit(0); }
const input = require("./budget37-input-20260913.json");
const baseline = require("./budget37-trace-9c679f08-20260913.json");
const env = createSimulationEnv(), record = { commit, source: "adhoc/budget37-input-20260913.json" };
try {
  input.checkpoint.config.traceCounterfactualGoalClusters = true;
  env.loadCheckpoint(input.checkpoint);
  assert.deepEqual(env.legalActions(), input.legalActions);
  console.log(`[单决策] ${commit} · 第37步 · 同收入收益贪心 · 4096节点/256队列/30秒`);
  const start = performance.now();
  const result = env.runHeuristicPolicyDecision();
  record.wallMs = performance.now() - start;
  assert.equal(result.ok, true);
  record.actionId = result.actionId;
  record.plan = result.plan;
  record.searches = result.searches;
  record.diagnostics = env.getCounterfactualDiagnostics();
  record.sameWinningActions = JSON.stringify(result.plan?.steps.map(s => s.actionKey)) === JSON.stringify(baseline.plan.steps.map(s => s.actionKey));
  record.outcomes = (result.actionOutcomes || []).map(outcome => ({ actionId: outcome.actionId,
    status: outcome.status, leaves: (outcome.leaves || []).map(leaf => ({
      leafId: leaf.leafId, terminalReason: leaf.terminalReason, status: leaf.status,
      actionChain: leaf.actionChain,
      actions: (leaf.planSteps || []).map(step => step.action),
    })) }));
  assert(record.wallMs < 30000, "单决策30秒门槛");
  assert.deepEqual(record.diagnostics.failedNodeCountByCode, {});
} catch (error) {
  record.error = { message: error.message, stack: error.stack };
  console.error(error);
  process.exitCode = 1;
} finally {
  env.dispose();
  console.log(`[单决策完成] ${JSON.stringify({ output, wallMs: record.wallMs, actionId: record.actionId, sameWinningActions: record.sameWinningActions, nodes: record.diagnostics?.executedNodeCount, error: record.error })}`);
  fs.writeFileSync(output, JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
}
