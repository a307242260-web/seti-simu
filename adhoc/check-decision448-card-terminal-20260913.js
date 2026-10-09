"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "adhoc/decision448-card-terminal-20260913.json";
if (fs.existsSync(output)) { console.log(`[skip] ${output}`); process.exit(0); }
const input = JSON.parse(fs.readFileSync("adhoc/budget448-input-20260913.json"));
const baseline = JSON.parse(fs.readFileSync("adhoc/budget448-entrystate-dcc5e420-20260913.json"));
const env = createSimulationEnv();
const record = { source: "adhoc/budget448-input-20260913.json", step: 448,
  scope: "CARD-TERMINAL-VALUE-01 单决策性能门槛；预算 4096/256/30s 不变。" };
try {
  input.checkpoint.config.traceCounterfactualGoalClusters = false;
  env.loadCheckpoint(input.checkpoint);
  assert.deepEqual(env.legalActions(), input.legalActions);
  const started = performance.now();
  const result = env.runHeuristicPolicyDecision();
  record.wallMs = performance.now() - started;
  record.ok = result.ok;
  record.actionId = result.actionId;
  record.planKeys = (result.plan?.steps || []).map((step) => step.actionKey);
  record.baselineActionId = baseline.actionId;
  record.baselinePlanKeys = (baseline.plan?.steps || []).map((step) => step.actionKey);
  record.sameActionAsBaseline = record.actionId === record.baselineActionId;
  record.samePlanAsBaseline = JSON.stringify(record.planKeys) === JSON.stringify(record.baselinePlanKeys);
  record.diagnostics = env.getCounterfactualDiagnostics();
  assert.equal(result.ok, true);
  assert(record.wallMs < 30000, "单决策 30 秒门槛");
  assert.deepEqual(record.diagnostics.failedNodeCountByCode, {});
} catch (error) {
  record.error = { message: error.message, stack: error.stack };
  console.error(error);
  process.exitCode = 1;
} finally {
  env.dispose();
  fs.writeFileSync(output, JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({
    output,
    wallMs: Math.round(record.wallMs || 0),
    actionId: record.actionId,
    sameActionAsBaseline: record.sameActionAsBaseline,
    samePlanAsBaseline: record.samePlanAsBaseline,
    nodes: record.diagnostics?.executedNodeCount,
    trimCount: record.diagnostics?.budgetLimits?.frontier?.trimCount,
    failed: record.diagnostics?.failedNodeCountByCode,
  }));
}
