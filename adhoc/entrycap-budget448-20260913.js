"use strict";
const fs = require("node:fs");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "adhoc/budget448-entrycap-dcc5e420-20260913.json";
if (fs.existsSync(output)) { console.log(`[skip] ${output}`); process.exit(0); }
const input = JSON.parse(fs.readFileSync("adhoc/budget448-input-20260913.json"));
// 关掉队列级配额，只测“目标入口状态生成配额”。
const caps = [1000000, 128, 64, 32, 16, 8];
const out = { source: "adhoc/budget448-input-20260913.json", step: 448, caps: [] };
const env = createSimulationEnv();
try {
  for (const cap of caps) {
    process.env.SETI_DIAG_MAX_ENTRIES_PER_TARGET = String(cap);
    process.env.SETI_DIAG_MAX_FRONTIER_PER_TARGET = "1000000";
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
      frontierTruncated: diagnostics.budgetLimits.frontier.truncated,
      frontierTrimCount: diagnostics.budgetLimits.frontier.trimCount,
      remainingFrontierNodeCount: diagnostics.remainingFrontierNodeCount,
      targetEntryCapSkippedCount: diagnostics.targetEntryCapSkippedCount,
      leafCount: (result.actionOutcomes || []).reduce((total, outcome) => total + (outcome.leaves || []).length, 0),
      completedGoalTransitionCount: diagnostics.completedGoalTransitionCount,
      failedCodes: diagnostics.failedNodeCountByCode,
    });
    const last = out.caps.at(-1);
    console.log(JSON.stringify({
      cap,
      wallMs: Math.round(wallMs),
      actionId: last.actionId,
      nodes: last.executedNodeCount,
      execTrunc: last.executionTruncated,
      frontierTrunc: last.frontierTruncated,
      skipped: last.targetEntryCapSkippedCount,
      leaves: last.leafCount,
    }));
  }
} catch (error) {
  out.error = { message: error.message, stack: error.stack };
  console.error(error);
  process.exitCode = 1;
} finally {
  delete process.env.SETI_DIAG_MAX_ENTRIES_PER_TARGET;
  delete process.env.SETI_DIAG_MAX_FRONTIER_PER_TARGET;
  env.dispose();
  fs.writeFileSync(output, JSON.stringify(out, null, 2) + "\n", { flag: "wx" });
  console.log(`[entrycap 完成] ${output}`);
}
