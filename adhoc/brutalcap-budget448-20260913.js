"use strict";
const fs = require("node:fs");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "adhoc/budget448-brutalcap-dcc5e420-20260913.json";
if (fs.existsSync(output)) { console.log(`[skip] ${output}`); process.exit(0); }
const input = JSON.parse(fs.readFileSync("adhoc/budget448-input-20260913.json"));
const combos = [
  { chain: 8, entries: 8, perTarget: 4 },
  { chain: 6, entries: 4, perTarget: 2 },
  { chain: 4, entries: 4, perTarget: 2 },
  { chain: 3, entries: 2, perTarget: 1 },
];
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
    out.combos.push({
      ...combo,
      wallMs,
      actionId: result.actionId,
      planSteps: (result.plan?.steps || []).length,
      executedNodeCount: diagnostics.executedNodeCount,
      executionTruncated: diagnostics.budgetLimits.execution.truncated,
      frontierTruncated: diagnostics.budgetLimits.frontier.truncated,
      remainingFrontierNodeCount: diagnostics.remainingFrontierNodeCount,
      macroChainCapPrunedCount: diagnostics.macroChainCapPrunedCount,
      targetEntryCapSkippedCount: diagnostics.targetEntryCapSkippedCount,
      targetBeamPrunedOriginCount: diagnostics.targetBeamPrunedOriginCount,
      leafCount: (result.actionOutcomes || []).reduce((total, outcome) => total + (outcome.leaves || []).length, 0),
      failedCodes: diagnostics.failedNodeCountByCode,
    });
    const last = out.combos.at(-1);
    console.log(JSON.stringify({
      combo,
      wallMs: Math.round(wallMs),
      actionId: last.actionId,
      planSteps: last.planSteps,
      nodes: last.executedNodeCount,
      execTrunc: last.executionTruncated,
      frontierTrunc: last.frontierTruncated,
      left: last.remainingFrontierNodeCount,
      leaves: last.leafCount,
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
  console.log(`[brutalcap 完成] ${output}`);
}
