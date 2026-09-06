"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const step = Number(process.argv[2]);
assert.ok([24, 42].includes(step));
const output = `reports/iteration/search-statistics-step-${step}-20260906${process.argv[3] === "recovery" ? "-recovery" : ""}.json`;
const read = path => JSON.parse(fs.readFileSync(path));
const hash = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sum = counts => Object.values(counts).reduce((a, b) => a + b, 0);
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const baseline = read(`reports/iteration/node-types-baseline-step-${step}-20260906.json`);
  const checkpoint = read(`reports/iteration/node-types-before-step-${step}-20260906.json`);
  delete checkpoint.replaySteps;
  const env = createSimulationEnv();
  const report = { step, scope: "新增统计的单决策行为等价验证；非优化收益测试", baselineMs: baseline.wallMs };
  try {
    env.loadCheckpoint(checkpoint);
    const start = performance.now();
    const result = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - start;
    assert.equal(result.ok, true);
    assert.deepEqual(result.policyDecision, baseline.policyDecision);
    assert.deepEqual(result.plan, baseline.plan);
    const outcomes = result.actionOutcomes.map(({ leaves, ...outcome }) => ({
      actionId: outcome.actionId, metadataHash: hash(outcome),
      leaves: leaves.map(leaf => ({ leafId: leaf.leafId, hash: hash(leaf) })),
    }));
    assert.deepEqual(outcomes, baseline.outcomes.map(({ actionId, metadataHash, leaves }) => ({ actionId, metadataHash, leaves })));
    report.searches = result.searches;
    const after = env.createCheckpoint().coreState;
    report.afterHash = hash(after);
    if (process.argv[3] === "recovery") {
      const reference = createSimulationEnv();
      try {
        const initial = read("reports/iteration/r3-actual-opening-plan-20260906.json").beforeRoot;
        delete initial.replaySteps;
        reference.loadCheckpoint(initial);
        const record = read("reports/research/2848eba2.213f34db.full.json");
        const save = read(record.savePath);
        for (let index = 23; index < step; index += 1) assert.equal(reference.step(save.replaySteps[index].action).ok, true);
        const expected = reference.createCheckpoint().coreState;
        report.referenceHash = hash(expected);
        report.stateEqual = after.committedState === expected.committedState;
        report.expectedSession = expected.compositionEnvelope.session;
        report.actualSession = after.compositionEnvelope.session;
        assert.equal(report.referenceHash, baseline.afterHash);
        assert.equal(report.stateEqual, true);
      } finally { reference.dispose(); }
    } else assert.equal(report.afterHash, baseline.afterHash);
    for (const { diagnostics: d } of result.searches) {
      assert.equal(sum(d.attemptedNodeCountByFamily), d.executedNodeCount);
      assert.equal(sum(d.executedNodeCountByFamily) + sum(d.failedNodeCountByFamily), d.executedNodeCount);
      assert.equal(sum(d.failedNodeCountByCode), sum(d.failedNodeCountByFamily));
    }
    if (step === 24) {
      const continuation = env.runHeuristicPolicyDecision();
      assert.equal(continuation.ok, true);
      assert.deepEqual(continuation.searches, []);
      report.reuseAction = continuation.policyDecision.actionId;
    }
    report.outcomeCount = outcomes.length;
    report.leafCount = outcomes.reduce((n, o) => n + o.leaves.length, 0);
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, passed: report.passed, wallMs: report.wallMs,
      searches: report.searches?.map(({ kind, diagnostics: d }) => ({ kind, nodes: d.executedNodeCount,
        submissions: d.successfulInputSubmissionCount, failures: d.failedNodeCountByCode })), error: report.error }, null, 2));
  }
}
