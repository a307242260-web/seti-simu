"use strict";
const fs = require("node:fs");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "adhoc/budget448-chaincap-dcc5e420-20260913.json";
if (fs.existsSync(output)) { console.log(`[skip] ${output}`); process.exit(0); }
const input = JSON.parse(fs.readFileSync("adhoc/budget448-input-20260913.json"));
const caps = [0, 20, 18, 16, 14, 12, 10];
const out = { source: "adhoc/budget448-input-20260913.json", step: 448, caps: [] };
const env = createSimulationEnv();
try {
  for (const cap of caps) {
    if (cap > 0) process.env.SETI_DIAG_MAX_MACRO_CHAIN = String(cap);
    else delete process.env.SETI_DIAG_MAX_MACRO_CHAIN;
    process.env.SETI_DIAG_MAX_FRONTIER_PER_TARGET = "1000000";
    process.env.SETI_DIAG_MAX_ENTRIES_PER_TARGET = "1000000";
    input.checkpoint.config.traceCounterfactualGoalClusters = false;
    env.loadCheckpoint(input.checkpoint);
    const started = performance.now();
    const result = env.runHeuristicPolicyDecision();
    const wallMs = performance.now() - started;
    const diagnostics = env.getCounterfactualDiagnostics();
    out.caps.push({
      cap,
      wallMs,
      actionId: result.actionId,
      planSteps: (result.plan?.steps || []).length,
      planKeys: (result.plan?.steps || []).map((step) => step.actionKey),
      executedNodeCount: diagnostics.executedNodeCount,
      executionTruncated: diagnostics.budgetLimits.execution.truncated,
      frontierTruncated: diagnostics.budgetLimits.frontier.truncated,
      frontierTrimCount: diagnostics.budgetLimits.frontier.trimCount,
      remainingFrontierNodeCount: diagnostics.remainingFrontierNodeCount,
      macroChainCapPrunedCount: diagnostics.macroChainCapPrunedCount,
      leafCount: (result.actionOutcomes || []).reduce((total, outcome) => total + (outcome.leaves || []).length, 0),
      outcomeKeys: (result.actionOutcomes || [])[0] ? Object.keys((result.actionOutcomes || [])[0]) : [],
      outcomeValues: (result.actionOutcomes || []).map((outcome) => ({
        actionId: outcome.actionId,
        status: outcome.status,
        value: outcome.value ?? outcome.score ?? outcome.totalScore ?? null,
      })),
      failedCodes: diagnostics.failedNodeCountByCode,
    });
    const last = out.caps.at(-1);
    console.log(JSON.stringify({
      cap: cap || "off",
      wallMs: Math.round(wallMs),
      actionId: last.actionId,
      planSteps: last.planSteps,
      nodes: last.executedNodeCount,
      execTrunc: last.executionTruncated,
      frontierTrunc: last.frontierTruncated,
      chainPruned: last.macroChainCapPrunedCount,
      leaves: last.leafCount,
    }));
  }
} catch (error) {
  out.error = { message: error.message, stack: error.stack };
  console.error(error);
  process.exitCode = 1;
} finally {
  delete process.env.SETI_DIAG_MAX_MACRO_CHAIN;
  delete process.env.SETI_DIAG_MAX_FRONTIER_PER_TARGET;
  delete process.env.SETI_DIAG_MAX_ENTRIES_PER_TARGET;
  env.dispose();
  fs.writeFileSync(output, JSON.stringify(out, null, 2) + "\n", { flag: "wx" });
  console.log(`[chaincap 完成] ${output}`);
}
