"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/trace-analysis-hotspot-433-20260906.json";
if (fs.existsSync(output)) console.log(`已有诊断，跳过：${output}`);
else {
  const env = createSimulationEnv(), report = { scope: "真实433开启既有目标簇诊断的一次单决策；不改策略/预算，不作为新全盘或提速证据" };
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/amiba-overflow-before-step-433-20260906.json"));
    delete cp.replaySteps; cp.config.traceCounterfactualGoalClusters = true;
    env.loadCheckpoint(cp);
    const started = performance.now(), result = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - started;
    assert.equal(result.ok, true);
    report.actionId = result.policyDecision.actionId;
    report.diagnostics = env.getCounterfactualDiagnostics();
    const old = JSON.parse(fs.readFileSync("reports/research/25c65ece.795cd6eb.full.json"))
      .metrics.searches.find(s=>s.step===433&&s.kind==='strategic');
    assert.equal(report.actionId, old.action);
    for (const key of ["executedNodeCount", "successfulInputSubmissionCount", "attemptedNodeCountByFamily", "failedNodeCountByCode"])
      assert.deepEqual(report.diagnostics[key],old.diagnostics[key]);
    report.sameExecutionCounts = true; report.passed = true;
  } catch(error) {
    report.passed = false; report.error = {message:error.message,stack:error.stack}; process.exitCode = 1;
  } finally {
    env.dispose(); fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
    console.log(JSON.stringify({output,passed:report.passed,wallMs:report.wallMs,actionId:report.actionId,
      routeStats:report.diagnostics?.routeEntryStatsByTarget, groups:report.diagnostics?.goalClusters?.length,error:report.error},null,2));
  }
}
