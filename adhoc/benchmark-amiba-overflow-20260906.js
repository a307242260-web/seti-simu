"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const commit = execFileSync("git", ["rev-parse", "--short=8", "HEAD"], { encoding: "utf8" }).trim();
const output = `reports/iteration/amiba-overflow-search-404-${commit}-20260906.json`;
if (fs.existsSync(output)) console.log(`已有证据，跳过：${output}`);
else {
  const env = createSimulationEnv(), report = { commit, step: 404, scope: "真实404单决策；非全盘验收" };
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/company-before-step-404-20260906.json"));
    delete cp.replaySteps; env.loadCheckpoint(cp);
    const started = performance.now(), result = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - started;
    assert.equal(result.ok, true);
    report.policyDecision = result.policyDecision; report.plan = result.plan; report.searches = result.searches;
    report.outcomes = result.actionOutcomes.map(o => ({ actionId: o.actionId, status: o.status,
      code: o.code, message: o.message, leaves: o.leaves.length }));
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, passed: report.passed, wallMs: report.wallMs,
      actionId: report.policyDecision?.actionId, searches: report.searches?.map(s => ({ kind: s.kind,
        nodes: s.diagnostics.executedNodeCount, submissions: s.diagnostics.successfulInputSubmissionCount,
        failures: s.diagnostics.failedNodeCountByCode, searchMs: s.diagnostics.totalMilliseconds })), error: report.error }, null, 2));
  }
}
