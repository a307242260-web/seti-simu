"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/company-movement-42-20260906-v2.json";
if (fs.existsSync(output)) console.log(`已有诊断，跳过：${output}`);
else {
  const env = createSimulationEnv();
  const report = { scope: "真实42开启既有目标簇诊断；不修改策略与预算，不作为提速证据",
    source: "reports/research/25c65ece.795cd6eb.full.json" };
  try {
    const record = JSON.parse(fs.readFileSync(report.source));
    const save = JSON.parse(fs.readFileSync(record.savePath));
    const cp = JSON.parse(fs.readFileSync("reports/iteration/node-types-before-step-42-20260906.json"));
    // 此旧检查点只保留从第24步开始的18条训练轨迹，不含browser after摘要。
    assert.equal(cp.replaySteps.length, 18);
    assert.deepEqual(cp.replaySteps.map(step => step.action), save.replaySteps.slice(23, 41).map(step => step.action));
    delete cp.replaySteps;
    cp.config.traceCounterfactualGoalClusters = true;
    env.loadCheckpoint(cp);
    const started = performance.now(), result = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - started;
    assert.equal(result.ok, true);
    report.actionId = result.policyDecision.actionId;
    report.diagnostics = env.getCounterfactualDiagnostics();
    const old = record.metrics.searches.find(search => search.step === 42 && search.kind === "strategic");
    assert.equal(report.actionId, old.action);
    for (const key of ["executedNodeCount", "successfulInputSubmissionCount", "attemptedNodeCountByFamily", "failedNodeCountByCode"])
      assert.deepEqual(report.diagnostics[key], old.diagnostics[key]);
    report.sameExecutionCounts = true;
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    env.dispose();
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, passed: report.passed, wallMs: report.wallMs,
      actionId: report.actionId, clusters: report.diagnostics?.goalClusters?.length, error: report.error }));
  }
}
