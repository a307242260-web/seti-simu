"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/data-settlement-p2-step52-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const report = { scope: "P2未提交候选，真实棕52单决策；不跑完整局", plannedInputs: [] };
  const env = createSimulationEnv();
  try {
    const input = JSON.parse(fs.readFileSync("reports/iteration/node-types-before-step-52-20260906.json"));
    delete input.replaySteps; env.loadCheckpoint(input);
    const start = performance.now();
    const result = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - start;
    assert.equal(result.ok, true);
    report.decision = result.policyDecision;
    report.plan = result.plan;
    report.searches = result.searches;
    report.outcomes = result.actionOutcomes.map(o => ({ actionId: o.actionId, status: o.status,
      leafCount: o.leaves.length, searchCompleteness: o.searchCompleteness }));
    for (const step of result.plan?.steps || []) {
      const action = env.legalActions().find(a => a.actionId === step.actionId);
      if (!action) { report.nextBoundary = step.actionId; break; }
      const submitted = env.step(action);
      assert.equal(submitted.ok, true);
      report.plannedInputs.push({ actionId: action.actionId, family: action.family, target: action.target });
    }
    report.passed = true;
  } catch (error) { report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally {
    env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, passed: report.passed, wallMs: report.wallMs,
      action: report.decision?.actionId, plannedInputs: report.plannedInputs.length,
      searches: report.searches?.map(s => ({ kind: s.kind, nodes: s.diagnostics.executedNodeCount,
        submissions: s.diagnostics.successfulInputSubmissionCount, families: s.diagnostics.attemptedNodeCountByFamily })), error: report.error }, null, 2));
  }
}
