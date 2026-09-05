"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = process.argv[2] || "reports/iteration/income-reserve-search-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const sourcePath = "reports/iteration/r3s1-green-boundary-20260906.json";
  const source = JSON.parse(fs.readFileSync(sourcePath));
  const env = createSimulationEnv();
  const report = { createdAt: new Date().toISOString(), sourcePath,
    scope: "真实绿方第74步checkpoint单次冷决策，检查正式收入叶与资源准备；无全盘实验。",
    sources: Object.fromEntries(["production-kernel.js", "ai/expected-score-evaluator.js"].map((file) => [file,
      crypto.createHash("sha256").update(fs.readFileSync(`randomizer/game/${file}`)).digest("hex")])) };
  try {
    env.loadCheckpoint(source.beforeRoot);
    report.observation = env.observe();
    const actions = env.legalActions();
    const start = performance.now();
    const decision = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - start;
    assert.equal(decision.ok, true);
    report.chosen = decision.policyDecision.actionId;
    report.plan = decision.plan;
    report.outcomes = decision.actionOutcomes;
    report.diagnostics = env.getCounterfactualDiagnostics();
    report.incomeLeaves = [];
    for (const outcome of decision.actionOutcomes) {
      const action = actions.find((a) => a.actionId === outcome.actionId);
      for (const leaf of outcome.leaves) {
        if (leaf.rootRoutePlanId !== "income:data:computer-slot-4") continue;
        const value = evaluator.evaluateOutcome({ seatId: "player-green", observation: outcome.rootObservation,
          actionOutcomes: [{ ...outcome, leaves: [leaf] }] }, action);
        report.incomeLeaves.push({ leafId: leaf.leafId, actionId: outcome.actionId, incomeDelta: value.incomeDelta,
          incomeValue: value.incomeValue, score: value.score, reason: leaf.terminalReason,
          steps: leaf.planSteps.map((s) => ({ action: s.action, target: s.routeTargetId })) });
      }
    }
    assert.ok(report.incomeLeaves.some((l) => l.incomeValue > 0), "实际收入路线至少有正式兑现收入的叶");
    assert.ok(report.wallMs <= 10000, "单决策超过10秒，停止全盘");
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    env.dispose();
    fs.writeFileSync(output, JSON.stringify(report));
    console.log(JSON.stringify({ output, passed: report.passed, ms: report.wallMs, chosen: report.chosen,
      incomeLeaves: report.incomeLeaves?.map((l) => ({ id: l.leafId, income: l.incomeValue, score: l.score, reason: l.reason })), error: report.error }));
  }
}
