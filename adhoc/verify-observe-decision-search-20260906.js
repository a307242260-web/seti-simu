"use strict";
const fs = require("node:fs"), crypto = require("node:crypto"), assert = require("node:assert/strict");
const path = require("node:path");
const [phase, codeRoot] = process.argv.slice(2);
assert.ok(["before", "after"].includes(phase)); assert.ok(path.isAbsolute(codeRoot));
const output = `reports/iteration/observe-decision-search-${phase}-20260906.json`;
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const { createSimulationEnv } = require(path.join(codeRoot, "randomizer/app/simulation-env"));
  const env = createSimulationEnv();
  const source = "reports/iteration/round-income-green-before-search-20260906.json";
  const hash = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const report = { phase, codeRoot, source, scope: "真实绿方210步新旧完整决策对照；每叶单独hash，避免整棵共享图一次展开" };
  try {
    const checkpoint = JSON.parse(fs.readFileSync(source)); delete checkpoint.replaySteps;
    env.loadCheckpoint(checkpoint);
    report.inputHash = hash(env.createCheckpoint().coreState);
    const start = performance.now(); const result = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - start;
    assert.equal(result.ok, true);
    report.chosen = result.policyDecision.actionId;
    report.plan = result.plan;
    report.policyDecision = result.policyDecision;
    report.outcomes = result.actionOutcomes.map(({ leaves, ...outcome }) => ({
      metadataHash: hash(outcome), actionId: outcome.actionId,
      leaves: leaves.map(leaf => ({ leafId: leaf.leafId, hash: hash(leaf) })),
    }));
    report.afterStateHash = hash(env.createCheckpoint().coreState);
    report.afterObservationHash = hash(env.observe());
    report.afterLegalHash = hash(env.legalActions());
    report.diagnostics = Object.fromEntries(Object.entries(env.getCounterfactualDiagnostics())
      .filter(([key]) => !key.endsWith("Milliseconds")));
    report.passed = true;
    if (phase === "after") {
      const old = JSON.parse(fs.readFileSync("reports/iteration/observe-decision-search-before-20260906.json"));
      for (const key of ["inputHash", "chosen", "plan", "policyDecision", "outcomes", "afterStateHash", "afterObservationHash", "afterLegalHash", "diagnostics"]) {
        assert.deepEqual(report[key], old[key], `前后不一致：${key}`);
      }
      report.equivalent = true;
    }
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ output, passed: report.passed, equivalent: report.equivalent, ms: report.wallMs,
      chosen: report.chosen, leaves: report.outcomes?.reduce((n, o) => n + o.leaves.length, 0), error: report.error }, null, 2));
  }
}
