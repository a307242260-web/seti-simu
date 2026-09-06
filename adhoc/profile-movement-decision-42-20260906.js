"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/movement-cpu-decision-42-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，跳过：${output}`);
else {
  const env = createSimulationEnv(), report = { scope: "真实42冷决策CPU采样；关闭目标簇诊断，预算与策略不变；非全盘实验" };
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
    delete cp.replaySteps; env.loadCheckpoint(cp);
    const started = performance.now(), result = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - started;
    assert.equal(result.ok, true);
    report.actionId = result.policyDecision.actionId;
    report.diagnostics = env.getCounterfactualDiagnostics();
    const old = JSON.parse(fs.readFileSync("reports/research/25c65ece.795cd6eb.full.json"))
      .metrics.searches.find(s => s.step === 42 && s.kind === "strategic");
    report.historicalComparison = Object.fromEntries(["executedNodeCount", "successfulInputSubmissionCount",
      "attemptedNodeCountByFamily", "failedNodeCountByCode"].map(key => [key, {
        recorded: old.diagnostics[key], current: report.diagnostics[key],
        equal: JSON.stringify(old.diagnostics[key]) === JSON.stringify(report.diagnostics[key]),
      }]));
    assert.equal(report.actionId, old.action);
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, passed: report.passed, wallMs: report.wallMs,
      actionId: report.actionId, comparison: report.historicalComparison, error: report.error }));
  }
}
