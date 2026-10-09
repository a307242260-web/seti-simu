"use strict";
const fs = require("node:fs");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "adhoc/budget482-armsweep-20260913.json";
if (fs.existsSync(output)) { console.log(`[skip] ${output}`); process.exit(0); }
const input = JSON.parse(fs.readFileSync("adhoc/budget482-input-20260913.json"));
const arms = [0, 1024, 1536, 2048, 2560, 3072, 3584];
const out = { source: "adhoc/budget482-input-20260913.json", step: 482, arms: [] };
const env = createSimulationEnv();
try {
  for (const arm of arms) {
    if (arm > 0) process.env.SETI_DIAG_QUOTA_ARM_AT = String(arm);
    else delete process.env.SETI_DIAG_QUOTA_ARM_AT;
    input.checkpoint.config.traceCounterfactualGoalClusters = false;
    env.loadCheckpoint(input.checkpoint);
    const started = performance.now();
    const result = env.runHeuristicPolicyDecision();
    const wallMs = performance.now() - started;
    const dg = env.getCounterfactualDiagnostics();
    out.arms.push({ arm, wallMs, actionId: result.actionId,
      planSteps: (result.plan?.steps || []).length,
      executedNodeCount: dg.executedNodeCount,
      executionTruncated: dg.budgetLimits.execution.truncated,
      frontierTrimCount: dg.budgetLimits.frontier.trimCount,
      remainingFrontierNodeCount: dg.remainingFrontierNodeCount,
      targetBeamPrunedOriginCount: dg.targetBeamPrunedOriginCount,
      targetEntryCapSkippedCount: dg.targetEntryCapSkippedCount,
      macroChainCapPrunedCount: dg.macroChainCapPrunedCount,
      failedCodes: dg.failedNodeCountByCode });
    const last = out.arms.at(-1);
    console.log(JSON.stringify({ arm: arm || "off", wallMs: Math.round(wallMs), action: last.actionId,
      planSteps: last.planSteps, nodes: last.executedNodeCount, execTrunc: last.executionTruncated,
      trim: last.frontierTrimCount, left: last.remainingFrontierNodeCount,
      chainPruned: last.macroChainCapPrunedCount, entrySkipped: last.targetEntryCapSkippedCount,
      targetPruned: last.targetBeamPrunedOriginCount }));
  }
} catch (error) {
  out.error = { message: error.message, stack: error.stack };
  console.error(error);
  process.exitCode = 1;
} finally {
  delete process.env.SETI_DIAG_QUOTA_ARM_AT;
  env.dispose();
  fs.writeFileSync(output, JSON.stringify(out, null, 2) + "\n", { flag: "wx" });
  console.log(`[armsweep 完成] ${output}`);
}
