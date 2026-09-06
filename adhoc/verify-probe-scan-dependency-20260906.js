"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const step = Number(process.argv[2]);
assert.ok([466, 585].includes(step));
const output = `reports/iteration/probe-scan-dependency-step-${step}-20260906.json`;
if (fs.existsSync(output)) console.log(fs.readFileSync(output, "utf8"));
else {
  const env = createSimulationEnv();
  const report = { scope: "探测器扫描依赖修复，复用真实检查点的单决策；不是完整局或提速验收", step };
  try {
    const cp = JSON.parse(fs.readFileSync(`reports/iteration/amiba-region-before-step-${step}-20260906.json`));
    delete cp.replaySteps; env.loadCheckpoint(cp);
    const start = performance.now(), result = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - start;
    assert.equal(result.ok, true);
    report.actionId = result.policyDecision.actionId;
    report.searches = result.searches;
    report.outcomes = result.actionOutcomes.map(o => ({ actionId: o.actionId, code: o.code,
      message: o.message, status: o.status, leaves: o.leaves.length }));
    assert.ok(!report.outcomes.some(o => /rockets is not defined/.test(o.message || "")));
    assert.ok(result.searches.every(s => !Object.keys(s.diagnostics.failedNodeCountByCode)
      .some(k => /THROWN|COUNTERFACTUAL_EXECUTION_FAILED/.test(k))));
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, passed: report.passed, wallMs: report.wallMs,
      actionId: report.actionId, searches: report.searches?.map(s => ({ kind: s.kind,
        nodes: s.diagnostics.executedNodeCount, submissions: s.diagnostics.successfulInputSubmissionCount,
        failures: s.diagnostics.failedNodeCountByCode })), error: report.error }, null, 2));
  }
}
