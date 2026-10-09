"use strict";
const fs = require("node:fs");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "adhoc/budget448-capgrid-dcc5e420-20260913.json";
if (fs.existsSync(output)) { console.log(`[skip] ${output}`); process.exit(0); }
const input = JSON.parse(fs.readFileSync("adhoc/budget448-input-20260913.json"));
const combos = [];
for (const chain of [3, 4, 5, 6, 7, 8]) {
  combos.push({ chain, entries: 4, perTarget: 2 });
}
for (const entries of [2, 4, 8, 16]) {
  for (const perTarget of [1, 2, 4, 8]) {
    combos.push({ chain: 6, entries, perTarget });
  }
}
const out = { source: "adhoc/budget448-input-20260913.json", step: 448, combos: [] };
const env = createSimulationEnv();
try {
  for (const combo of combos) {
    process.env.SETI_DIAG_MAX_MACRO_CHAIN = String(combo.chain);
    process.env.SETI_DIAG_MAX_ENTRIES_PER_TARGET = String(combo.entries);
    process.env.SETI_DIAG_MAX_FRONTIER_PER_TARGET = String(combo.perTarget);
    input.checkpoint.config.traceCounterfactualGoalClusters = false;
    env.loadCheckpoint(input.checkpoint);
    const started = performance.now();
    const result = env.runHeuristicPolicyDecision();
    const wallMs = performance.now() - started;
    const diagnostics = env.getCounterfactualDiagnostics();
    const row = {
      ...combo,
      wallMs,
      actionId: result.actionId,
      planSteps: (result.plan?.steps || []).length,
      executedNodeCount: diagnostics.executedNodeCount,
      executionTruncated: diagnostics.budgetLimits.execution.truncated,
      frontierTruncated: diagnostics.budgetLimits.frontier.truncated,
      frontierTrimCount: diagnostics.budgetLimits.frontier.trimCount,
      remainingFrontierNodeCount: diagnostics.remainingFrontierNodeCount,
      leafCount: (result.actionOutcomes || []).reduce((total, outcome) => total + (outcome.leaves || []).length, 0),
      failedCodes: diagnostics.failedNodeCountByCode,
    };
    out.combos.push(row);
    console.log(JSON.stringify({
      chain: combo.chain, entries: combo.entries, perTarget: combo.perTarget,
      wallMs: Math.round(wallMs), action: row.actionId, planSteps: row.planSteps,
      nodes: row.executedNodeCount, execTrunc: row.executionTruncated,
      frontierTrunc: row.frontierTruncated, trim: row.frontierTrimCount, left: row.remainingFrontierNodeCount,
    }));
  }
} catch (error) {
  out.error = { message: error.message, stack: error.stack };
  console.error(error);
  process.exitCode = 1;
} finally {
  delete process.env.SETI_DIAG_MAX_MACRO_CHAIN;
  delete process.env.SETI_DIAG_MAX_ENTRIES_PER_TARGET;
  delete process.env.SETI_DIAG_MAX_FRONTIER_PER_TARGET;
  env.dispose();
  fs.writeFileSync(output, JSON.stringify(out, null, 2) + "\n", { flag: "wx" });
  console.log(`[capgrid 完成] ${output}`);
}
