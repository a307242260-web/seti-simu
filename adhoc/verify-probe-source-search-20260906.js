"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/probe-source-search-verification-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const sourcePath = "reports/iteration/r3-green-pass-choice-20260906.json";
  const source = JSON.parse(fs.readFileSync(sourcePath));
  const env = createSimulationEnv();
  const report = { createdAt: new Date().toISOString(), sourcePath,
    scope: "已存真实绿方PASS前状态，一次修复后冷决策；不是完整局验收。" };
  try {
    const checkpoint = structuredClone(source.beforePass);
    delete checkpoint.replaySteps;
    env.loadCheckpoint(checkpoint);
    const observation = env.observe();
    const actions = env.legalActions();
    const start = performance.now();
    const decision = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - start;
    assert.equal(decision.ok, true);
    report.chosen = decision.policyDecision.actionId;
    report.plan = decision.plan;
    report.outcomes = decision.actionOutcomes;
    report.diagnostics = env.getCounterfactualDiagnostics();
    const trade = actions.find((action) => action.target?.tradeId === "cards-for-energy");
    const context = { seatId: "player-green", observation, actionOutcomes: report.outcomes };
    report.tradeEvaluation = evaluator.evaluateOutcome(context, trade);
    assert.equal(report.tradeEvaluation.selectable, true);
    const leaf = report.outcomes.find((outcome) => outcome.actionId === trade.actionId).leaves
      .find((item) => item.leafId === report.tradeEvaluation.selectedLeafId);
    report.tradeLeaf = leaf;
    assert.ok(leaf.planSteps.some((step) => step.action.target?.choiceId === "land:1:mars:planet:"));
    for (const step of leaf.planSteps) {
      if (step.action.family === "move" && !step.goalCompletionPending
        && String(step.routePlanId).startsWith("probe:rocket:")) {
        assert.equal(String(step.action.target.rocketId), step.routePlanId.split(":")[2]);
      }
    }
    assert.ok(report.wallMs <= 10000, "单决策超过10秒，禁止完整局");
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    env.dispose();
    fs.writeFileSync(output, JSON.stringify(report));
    console.log(JSON.stringify({ output, passed: report.passed, wallMs: report.wallMs, chosen: report.chosen,
      nodes: report.diagnostics?.executedNodeCount, evaluation: report.tradeEvaluation, error: report.error }, null, 2));
  }
}
