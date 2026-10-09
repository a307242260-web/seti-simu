"use strict";
const fs = require("node:fs");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "adhoc/budget448-targetcap-dcc5e420-20260913.json";
if (fs.existsSync(output)) { console.log(`[skip] ${output}`); process.exit(0); }
const input = JSON.parse(fs.readFileSync("adhoc/budget448-input-20260913.json"));
const caps = [1000000, 64, 32, 16, 8, 4];
const out = { source: "adhoc/budget448-input-20260913.json", step: 448, caps: [] };
const env = createSimulationEnv();
try {
  for (const cap of caps) {
    process.env.SETI_DIAG_MAX_FRONTIER_PER_TARGET = String(cap);
    process.env.SETI_DIAG_MAX_EXECUTION_NODES = "4096";
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
      planKeys: (result.plan?.steps || []).map((step) => step.actionKey),
      executedNodeCount: diagnostics.executedNodeCount,
      executionTruncated: diagnostics.budgetLimits.execution.truncated,
      frontierTrimCount: diagnostics.budgetLimits.frontier.trimCount,
      targetPrunedOriginCount: diagnostics.targetBeamPrunedOriginCount,
      beamPrunedOriginCount: diagnostics.beamPrunedOriginCount,
      remainingFrontierNodeCount: diagnostics.remainingFrontierNodeCount,
      leafCount: (result.actionOutcomes || []).reduce((total, outcome) => total + (outcome.leaves || []).length, 0),
      failedCodes: diagnostics.failedNodeCountByCode,
      incompleteReasons: [...new Set((result.actionOutcomes || []).flatMap((outcome) => (
        outcome.searchCompleteness?.reasons || []
      )))].sort(),
    });
    const last = out.caps.at(-1);
    console.log(JSON.stringify({
      cap,
      wallMs: Math.round(wallMs),
      actionId: last.actionId,
      nodes: last.executedNodeCount,
      execTrunc: last.executionTruncated,
      trim: last.frontierTrimCount,
      targetPruned: last.targetPrunedOriginCount,
      leaves: last.leafCount,
    }));
  }
} catch (error) {
  out.error = { message: error.message, stack: error.stack };
  console.error(error);
  process.exitCode = 1;
} finally {
  delete process.env.SETI_DIAG_MAX_FRONTIER_PER_TARGET;
  env.dispose();
  fs.writeFileSync(output, JSON.stringify(out, null, 2) + "\n", { flag: "wx" });
  console.log(`[targetcap 完成] ${output}`);
}
