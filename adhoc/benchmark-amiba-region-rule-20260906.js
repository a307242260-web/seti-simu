"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/amiba-region-rule-green210-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const env = createSimulationEnv();
  const report = { scope: "区域规则修复工作树，真实绿210单决策；不是完整局验收", inputs: [] };
  try {
    const checkpoint = JSON.parse(fs.readFileSync("reports/iteration/round-income-green-before-search-20260906.json"));
    delete checkpoint.replaySteps;
    env.loadCheckpoint(checkpoint);
    const start = performance.now(), result = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - start;
    assert.equal(result.ok, true);
    report.decision = result.policyDecision;
    report.plan = result.plan;
    report.searches = result.searches;
    report.outcomes = result.actionOutcomes.map(o => ({ actionId: o.actionId, status: o.status,
      code: o.code, message: o.message, leaves: o.leaves.length }));
    assert.ok(result.searches.every(s => !s.diagnostics.failedNodeCountByCode.COUNTERFACTUAL_EXECUTION_FAILED),
      "不得以搜索执行异常制造提速");
    for (const step of result.plan?.steps || []) {
      const action = env.legalActions().find(a => a.actionId === step.actionId);
      if (!action) { report.nextBoundary = step.actionId; break; }
      assert.equal(env.step(action).ok, true);
      report.inputs.push({ actionId: action.actionId, family: action.family, target: action.target });
    }
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, passed: report.passed, wallMs: report.wallMs,
      inputs: report.inputs.length, searches: report.searches?.map(s => ({ kind: s.kind,
        nodes: s.diagnostics.executedNodeCount, submissions: s.diagnostics.successfulInputSubmissionCount,
        failures: s.diagnostics.failedNodeCountByCode })), error: report.error }, null, 2));
  }
}
