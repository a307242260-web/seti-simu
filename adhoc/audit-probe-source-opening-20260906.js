"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/probe-source-opening-20260906.json.gz";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const sourcePath = "reports/iteration/r3-actual-opening-plan-20260906.json";
  const raw = fs.readFileSync(sourcePath);
  const source = JSON.parse(raw);
  const report = { createdAt: new Date().toISOString(), sourcePath,
    sourceHash: crypto.createHash("sha256").update(raw).digest("hex"),
    scope: "同一真实首个白方行动状态，当前生产代码一次冷决策；不重跑整局、不冒充历史版本重现。" };
  const env = createSimulationEnv();
  try {
    const checkpoint = structuredClone(source.beforeRoot);
    delete checkpoint.replaySteps;
    env.loadCheckpoint(checkpoint);
    report.observation = env.observe();
    const actions = env.legalActions();
    const start = performance.now();
    const decision = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - start;
    assert.equal(decision.ok, true);
    report.chosen = decision.policyDecision.actionId;
    report.diagnostics = env.getCounterfactualDiagnostics();
    report.outcomes = decision.actionOutcomes;
    report.comparison = actions.filter((action) => action.family === "launch" || action.summary === "b_117.webp")
      .map((action) => {
        const outcome = report.outcomes.find((item) => item.actionId === action.actionId);
        const evaluation = evaluator.evaluateOutcome({ seatId: "player-white", observation: report.observation,
          actionOutcomes: report.outcomes }, action);
        return { action, evaluation, selectedLeaf: outcome.leaves.find((leaf) => leaf.leafId === evaluation.selectedLeafId),
          stops: outcome.leaves.reduce((counts, leaf) => {
            counts[leaf.terminalReason || leaf.status] = (counts[leaf.terminalReason || leaf.status] || 0) + 1;
            return counts;
          }, {}) };
      });
    assert.ok(report.wallMs <= 10000, "超过单决策性能门槛，停止扩大实验");
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    env.dispose();
    fs.writeFileSync(output, zlib.gzipSync(JSON.stringify(report)));
    console.log(JSON.stringify({ output, passed: report.passed, wallMs: report.wallMs, chosen: report.chosen,
      nodes: report.diagnostics?.executedNodeCount, comparison: report.comparison?.map((row) => ({
        action: row.action.summary, score: row.evaluation.score, delta: row.evaluation.actualScoreDelta,
        income: row.evaluation.incomeValue, tech: row.evaluation.techValue, stops: row.stops,
        rootPlan: row.selectedLeaf?.rootRoutePlanId, steps: row.selectedLeaf?.actionChain })), error: report.error }, null, 2));
  }
}
