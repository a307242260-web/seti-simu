"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const plans = require("../randomizer/game/ai/plan-continuation");
const output = "reports/iteration/r3-first-divergence-choice-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const sourcePath = "reports/iteration/r3-actual-opening-plan-20260906.json";
  const raw = fs.readFileSync(sourcePath);
  const source = JSON.parse(raw);
  const report = { createdAt: new Date().toISOString(), sourcePath,
    sourceSha256: crypto.createHash("sha256").update(raw).digest("hex"),
    gitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    scope: "已有实际第27步边界checkpoint，单次当前代码冷决策；核对旧缓存计划和当前搜索，不重跑完整局、不当作历史搜索重现" };
  const env = createSimulationEnv();
  try {
    env.loadCheckpoint(source.beforeDivergence);
    const observation = env.observe();
    const legalActions = env.legalActions();
    let cachedPlan = source.actualPlan;
    cachedPlan = plans.advancePlan(plans.advancePlan(cachedPlan));
    const reuse = plans.planReuseCheck(cachedPlan, observation, legalActions, { sameTurn: true });
    report.cached = { nextActionId: cachedPlan.nextActionId, reuse };
    report.observation = observation;
    const start = performance.now();
    const decision = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - start;
    assert.equal(decision.ok, true);
    report.chosenAction = decision.policyDecision.actionId;
    report.plan = decision.plan;
    report.diagnostics = env.getCounterfactualDiagnostics();
    const context = { seatId: "player-white", observation, actionOutcomes: decision.actionOutcomes };
    report.outcomes = decision.actionOutcomes.map((outcome) => {
      const action = legalActions.find((item) => item.actionId === outcome.actionId);
      const evaluation = evaluator.evaluateOutcome(context, action);
      return { action, status: outcome.status, code: outcome.code, leafCount: outcome.leaves.length,
        evaluation, selectedLeaf: outcome.leaves.find((leaf) => leaf.leafId === evaluation.selectedLeafId) || null };
    });
    assert.ok(report.wallMs <= 10000, "单决策超过10秒，不运行批量或完整局");
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    env.dispose();
    fs.writeFileSync(output, JSON.stringify(report));
    console.log(JSON.stringify({ output, passed: report.passed, wallMs: report.wallMs,
      cached: report.cached?.nextActionId, hit: report.cached?.reuse.hit, chosen: report.chosenAction,
      nodes: report.diagnostics?.executedNodeCount,
      outcomes: report.outcomes?.map((r) => ({ action: r.action.summary, leaves: r.leafCount,
        score: r.evaluation.score, actual: r.evaluation.actualScoreDelta, income: r.evaluation.incomeValue,
        tech: r.evaluation.techValue, atoms: r.evaluation.executionStepCount, code: r.code })), error: report.error }, null, 2));
  }
}
