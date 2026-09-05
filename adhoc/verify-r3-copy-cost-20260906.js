"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = process.argv[2] || "reports/iteration/r3-copy-cost-verification-20260906.json";
const hash = (raw) => crypto.createHash("sha256").update(raw).digest("hex");
if (fs.existsSync(output)) {
  console.log(`已有记录，未重跑：${output}`);
} else {
  const baselinePath = "reports/iteration/r3-brown-route-selection-20260906.json";
  const baselineRaw = fs.readFileSync(baselinePath);
  const baseline = JSON.parse(baselineRaw).samples[0];
  const checkpointRaw = fs.readFileSync(baseline.checkpointPath);
  const files = ["randomizer/game/ai/outcome-model.js", "randomizer/game/ai/policy-port.js",
    "randomizer/game/production-kernel.js"];
  const report = { createdAt: new Date().toISOString(), baselinePath,
    baselineSha256: hash(baselineRaw), checkpointPath: baseline.checkpointPath,
    checkpointSha256: hash(checkpointRaw),
    scope: "工作树性能优化的单状态等价与性能验证（源码哈希见sourceHashes）；不是版本全盘验收",
    sourceHashes: Object.fromEntries(files.map((file) => [file, hash(fs.readFileSync(file))])),
    baselineWallMs: baseline.wallMs, checks: {} };
  const env = createSimulationEnv();
  try {
    assert.equal(report.checkpointSha256, baseline.checkpointSha256);
    env.loadCheckpoint(JSON.parse(checkpointRaw));
    const legalActions = env.legalActions();
    const observation = env.observe();
    const start = performance.now();
    const decision = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - start;
    assert.equal(decision.ok, true);
    report.chosenAction = decision.policyDecision.actionId;
    report.diagnostics = env.getCounterfactualDiagnostics();
    report.plan = decision.plan;
    const context = { seatId: baseline.recordedAction.actorId, observation, actionOutcomes: decision.actionOutcomes };
    report.outcomes = decision.actionOutcomes.map((outcome) => {
      const action = legalActions.find((candidate) => candidate.actionId === outcome.actionId);
      const value = evaluator.evaluateOutcome(context, action);
      const winner = outcome.leaves.find((leaf) => leaf.leafId === value.selectedLeafId);
      return { action, status: outcome.status, code: outcome.code, leafCount: outcome.leaves.length,
        evaluation: value, selectedLeaf: winner || null };
    });
    // 基线是JSON checkpoint，消除undefined字段/浮点负零等序列化表示差异后比较业务值。
    const plain = (value) => JSON.parse(JSON.stringify(value));
    assert.equal(report.chosenAction, baseline.chosenAction);
    report.checks.action = true;
    assert.deepEqual(plain(report.outcomes), baseline.outcomes);
    report.checks.allRootEvaluationsAndSelectedLeaves = true;
    assert.deepEqual(plain(report.plan), baseline.plan);
    report.checks.plan = true;
    assert.equal(report.diagnostics.executedNodeCount, baseline.diagnostics.executedNodeCount);
    report.checks.nodeCount = true;
    report.checks.performance = report.wallMs <= 10000;
    assert.ok(report.checks.performance, "单决策仍超过10秒，不运行后续批量分析");
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    env.dispose();
    fs.writeFileSync(output, JSON.stringify(report));
    console.log(JSON.stringify({ output, passed: report.passed, checks: report.checks,
      baselineWallMs: report.baselineWallMs, wallMs: report.wallMs,
      chosen: report.chosenAction, nodes: report.diagnostics?.executedNodeCount,
      error: report.error?.message }, null, 2));
  }
}
