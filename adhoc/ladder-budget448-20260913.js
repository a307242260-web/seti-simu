"use strict";
const fs = require("node:fs");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "adhoc/budget448-ladder-dcc5e420-20260913.json";
if (fs.existsSync(output)) { console.log(`[skip] ${output}`); process.exit(0); }
const input = JSON.parse(fs.readFileSync("adhoc/budget448-input-20260913.json"));
const budgets = [512, 1024, 2048, 4096];
const out = { source: "adhoc/budget448-input-20260913.json", step: 448, results: [] };
const env = createSimulationEnv();
try {
  for (const budget of budgets) {
    process.env.SETI_DIAG_MAX_EXECUTION_NODES = String(budget);
    input.checkpoint.config.traceCounterfactualGoalClusters = false;
    env.loadCheckpoint(input.checkpoint);
    const started = performance.now();
    const result = env.runHeuristicPolicyDecision();
    const wallMs = performance.now() - started;
    const diagnostics = env.getCounterfactualDiagnostics();
    const outcomes = (result.actionOutcomes || []).map((outcome) => ({
      actionId: outcome.actionId,
      status: outcome.status,
      totalLeaves: (outcome.leaves || []).length,
      completedLeaves: (outcome.leaves || []).filter((leaf) => leaf.terminalReason === "goal-completed").length,
      leafKeys: (outcome.leaves || [])[0] ? Object.keys((outcome.leaves || [])[0]) : [],
      leafScores: (outcome.leaves || []).map((leaf) => ({
        terminalReason: leaf.terminalReason,
        score: leaf.score ?? leaf.expectedScore ?? leaf.totalScore ?? null,
        steps: (leaf.planSteps || []).length,
        chain: (leaf.actionChain || []).length,
      })),
    }));
    out.results.push({
      budget,
      wallMs,
      actionId: result.actionId,
      planKeys: (result.plan?.steps || []).map((step) => step.actionKey),
      executedNodeCount: diagnostics.executedNodeCount,
      executionTruncated: diagnostics.budgetLimits.execution.truncated,
      frontierTrimCount: diagnostics.budgetLimits.frontier.trimCount,
      remainingFrontierNodeCount: diagnostics.remainingFrontierNodeCount,
      completedGoalTransitionCount: diagnostics.completedGoalTransitionCount,
      outcomes,
    });
    console.log(JSON.stringify({
      budget,
      wallMs: Math.round(wallMs),
      actionId: result.actionId,
      nodes: diagnostics.executedNodeCount,
      executionTruncated: diagnostics.budgetLimits.execution.truncated,
      frontierTrim: diagnostics.budgetLimits.frontier.trimCount,
      planSteps: (result.plan?.steps || []).length,
    }));
  }
} catch (error) {
  out.error = { message: error.message, stack: error.stack };
  console.error(error);
  process.exitCode = 1;
} finally {
  env.dispose();
  fs.writeFileSync(output, JSON.stringify(out, null, 2) + "\n", { flag: "wx" });
  console.log(`[ladder 完成] ${output}`);
}
