"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/node-failure-42-20260906.json";
if (fs.existsSync(output)) console.log(fs.readFileSync(output, "utf8"));
else {
  const env = createSimulationEnv();
  const source = "reports/iteration/node-types-before-step-42-20260906.json";
  const report = { source, scope: "专门补取已保存真实绿42输入的分支错误明细；单次决策，不重跑整局，不作为新的性能基准" };
  try {
    const checkpoint = JSON.parse(fs.readFileSync(source)); delete checkpoint.replaySteps;
    env.loadCheckpoint(checkpoint);
    const result = env.runHeuristicPolicyDecision();
    assert.equal(result.ok, true);
    report.chosen = result.policyDecision.actionId;
    report.outcomes = result.actionOutcomes.map(o => ({ actionId: o.actionId, status: o.status,
      code: o.code, message: o.message, reasonCodes: o.reasonCodes, searchCompleteness: o.searchCompleteness,
      leafCount: o.leaves.length }));
    const d = env.getCounterfactualDiagnostics();
    report.nodes = d.executedNodeCount;
    report.successfulClassifiedNodes = Object.values(d.executedNodeCountByFamily).reduce((a, b) => a + b, 0);
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
  }
}
