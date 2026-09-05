"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/r3-green-pass-choice-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const sourcePath = "reports/iteration/r3-green-pass-20260906.json";
  const raw = fs.readFileSync(sourcePath);
  const source = JSON.parse(raw);
  const env = createSimulationEnv();
  const report = { createdAt: new Date().toISOString(), sourcePath,
    sha256: crypto.createHash("sha256").update(raw).digest("hex"),
    scope: "正式恢复229步前状态，执行已存弃牌角标，230步单次冷决策；不重跑完整局。" };
  try {
    const checkpoint = structuredClone(source.checkpoint);
    delete checkpoint.replaySteps;
    env.loadCheckpoint(checkpoint);
    const corner = env.legalActions().find((action) => action.actionId === source.chosen);
    assert.ok(corner);
    assert.equal(env.step(corner).ok, true);
    report.beforePass = env.createCheckpoint();
    report.observation = env.observe();
    report.legalActions = env.legalActions();
    assert.ok(report.legalActions.some((action) => action.actionId === source.recordedNext.actionId));
    const start = performance.now();
    const decision = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - start;
    assert.equal(decision.ok, true);
    report.chosen = decision.policyDecision.actionId;
    report.matchesRecorded = report.chosen === source.recordedNext.actionId;
    report.diagnostics = env.getCounterfactualDiagnostics();
    const context = { seatId: "player-green", observation: report.observation,
      actionOutcomes: decision.actionOutcomes };
    report.outcomes = decision.actionOutcomes.map((outcome) => {
      const action = report.legalActions.find((item) => item.actionId === outcome.actionId);
      return { action, evaluation: evaluator.evaluateOutcome(context, action), outcome };
    });
    assert.ok(report.wallMs <= 10000, "超过单决策性能门槛，停止进一步搜索");
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    env.dispose();
    fs.writeFileSync(output, JSON.stringify(report));
    console.log(JSON.stringify({ output, passed: report.passed, wallMs: report.wallMs,
      chosen: report.chosen, matchesRecorded: report.matchesRecorded,
      nodes: report.diagnostics?.executedNodeCount,
      outcomes: report.outcomes?.map(({ action, evaluation, outcome }) => ({ action: action.summary,
        score: evaluation.score, code: outcome.code, leafCount: outcome.leaves.length })), error: report.error }, null, 2));
  }
}
