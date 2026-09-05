"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/r3-brown-second-round-20260906.json";
if (fs.existsSync(output)) {
  console.log(`已有记录，未重跑：${output}`);
} else {
  const source = JSON.parse(fs.readFileSync("reports/iteration/r3-brown-route-selection-20260906.json"));
  const sample = structuredClone(source.samples[1]);
  const report = { createdAt: new Date().toISOString(),
    gitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    scope: "从已有真实第172步checkpoint做一次冷计划决策；不重放、不跑全盘",
    sample };
  const env = createSimulationEnv();
  try {
    const raw = fs.readFileSync(sample.checkpointPath);
    assert.equal(crypto.createHash("sha256").update(raw).digest("hex"), sample.checkpointSha256);
    env.loadCheckpoint(JSON.parse(raw));
    const legalActions = env.legalActions();
    const observation = env.observe();
    const start = performance.now();
    const decision = env.runHeuristicPolicyDecision();
    sample.wallMs = performance.now() - start;
    assert.equal(decision.ok, true);
    sample.chosenAction = decision.policyDecision.actionId;
    sample.matchesRecorded = sample.chosenAction === sample.recordedAction.actionId;
    sample.plan = decision.plan;
    sample.diagnostics = env.getCounterfactualDiagnostics();
    const context = { seatId: sample.recordedAction.actorId, observation, actionOutcomes: decision.actionOutcomes };
    sample.outcomes = decision.actionOutcomes.map((outcome) => {
      const action = legalActions.find((candidate) => candidate.actionId === outcome.actionId);
      const value = evaluator.evaluateOutcome(context, action);
      const winner = outcome.leaves.find((leaf) => leaf.leafId === value.selectedLeafId);
      return { action, status: outcome.status, code: outcome.code, leafCount: outcome.leaves.length,
        evaluation: value, selectedLeaf: winner || null };
    });
    assert.ok(sample.wallMs <= 10000, "单决策超过10秒，停止后续批量分析");
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    env.dispose();
    fs.writeFileSync(output, JSON.stringify(report));
    console.log(JSON.stringify({ output, passed: report.passed, ms: sample.wallMs,
      chosen: sample.chosenAction, matches: sample.matchesRecorded,
      nodes: sample.diagnostics?.executedNodeCount,
      outcomes: sample.outcomes?.map((row) => ({ action: row.action?.summary,
        leaves: row.leafCount, score: row.evaluation.score, code: row.code,
        delta: row.evaluation.actualScoreDelta, income: row.evaluation.incomeValue,
        tech: row.evaluation.techValue, atoms: row.evaluation.executionStepCount })),
      error: report.error }, null, 2));
  }
}
