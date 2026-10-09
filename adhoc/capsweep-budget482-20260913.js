"use strict";
const fs = require("node:fs");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "adhoc/budget482-capsweep-20260913.json";
if (fs.existsSync(output)) { console.log(`[skip] ${output}`); process.exit(0); }
const input = JSON.parse(fs.readFileSync("adhoc/budget482-input-20260913.json"));
const combos = [];
for (const chain of [Infinity, 24, 20, 16, 12, 8]) {
  combos.push({ chain, entries: Infinity, perTarget: Infinity });
}
for (const entries of [64, 16, 8]) {
  combos.push({ chain: Infinity, entries, perTarget: Infinity });
}
for (const perTarget of [16, 4]) {
  combos.push({ chain: Infinity, entries: Infinity, perTarget });
}
for (const chain of [12, 8]) {
  combos.push({ chain, entries: 16, perTarget: 4 });
}
const out = { source: "adhoc/budget482-input-20260913.json", step: 482, combos: [] };
const env = createSimulationEnv();
try {
  for (const combo of combos) {
    const setEnv = (key, value) => {
      if (Number.isFinite(value)) process.env[key] = String(value);
      else delete process.env[key];
    };
    setEnv("SETI_DIAG_MAX_MACRO_CHAIN", combo.chain);
    setEnv("SETI_DIAG_MAX_ENTRIES_PER_TARGET", combo.entries);
    setEnv("SETI_DIAG_MAX_FRONTIER_PER_TARGET", combo.perTarget);
    input.checkpoint.config.traceCounterfactualGoalClusters = false;
    env.loadCheckpoint(input.checkpoint);
    const started = performance.now();
    const result = env.runHeuristicPolicyDecision();
    const wallMs = performance.now() - started;
    const diagnostics = env.getCounterfactualDiagnostics();
    out.combos.push({
      chain: combo.chain, entries: combo.entries, perTarget: combo.perTarget,
      wallMs, actionId: result.actionId,
      planSteps: (result.plan?.steps || []).length,
      executedNodeCount: diagnostics.executedNodeCount,
      executionTruncated: diagnostics.budgetLimits.execution.truncated,
      frontierTruncated: diagnostics.budgetLimits.frontier.truncated,
      frontierTrimCount: diagnostics.budgetLimits.frontier.trimCount,
      remainingFrontierNodeCount: diagnostics.remainingFrontierNodeCount,
      targetBeamPrunedOriginCount: diagnostics.targetBeamPrunedOriginCount,
      targetEntryCapSkippedCount: diagnostics.targetEntryCapSkippedCount,
      macroChainCapPrunedCount: diagnostics.macroChainCapPrunedCount,
      failedCodes: diagnostics.failedNodeCountByCode,
    });
    const last = out.combos.at(-1);
    console.log(JSON.stringify({
      chain: combo.chain === Infinity ? "off" : combo.chain,
      entries: combo.entries === Infinity ? "off" : combo.entries,
      perTarget: combo.perTarget === Infinity ? "off" : combo.perTarget,
      wallMs: Math.round(wallMs), action: last.actionId, planSteps: last.planSteps,
      nodes: last.executedNodeCount, execTrunc: last.executionTruncated,
      trim: last.frontierTrimCount, frontierTrunc: last.frontierTruncated, left: last.remainingFrontierNodeCount,
      chainPruned: last.macroChainCapPrunedCount, entrySkipped: last.targetEntryCapSkippedCount,
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
  console.log(`[capsweep 完成] ${output}`);
}
