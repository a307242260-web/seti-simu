"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const plans = require("../randomizer/game/ai/plan-continuation");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/r3-green-pass-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const recordPath = "reports/research/22cf8cea.cf4280fd.full.json";
  const record = JSON.parse(fs.readFileSync(recordPath));
  const raw = fs.readFileSync(record.savePath);
  const save = JSON.parse(raw);
  const env = createSimulationEnv();
  const report = { createdAt: new Date().toISOString(), recordPath, savePath: record.savePath,
    sha256: crypto.createHash("sha256").update(raw).digest("hex"),
    scope: "重放已有动作至229索引，仅该真实状态一次冷决策；不声称恢复历史协调器计划。" };
  try {
    env.reset({ seed: record.seed, activePlayerCount: record.activePlayerCount,
      aiDifficulty: record.aiDifficulty, policyVersion: record.policyVersion, ...record.flags });
    for (let index = 0; index < 229; index += 1) {
      const expected = save.replaySteps[index];
      const action = env.legalActions().find((item) => item.actionId === expected.action.actionId);
      assert.deepEqual(action, expected.action);
      assert.equal(env.step(action).ok, true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
    }
    report.checkpoint = env.createCheckpoint();
    report.observation = env.observe();
    const legalActions = env.legalActions();
    const start = performance.now();
    const decision = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - start;
    assert.equal(decision.ok, true);
    report.chosen = decision.policyDecision.actionId;
    report.matchesRecorded = report.chosen === save.replaySteps[229].action.actionId;
    report.plan = decision.plan;
    report.diagnostics = env.getCounterfactualDiagnostics();
    const context = { seatId: "player-green", observation: report.observation,
      actionOutcomes: decision.actionOutcomes };
    report.outcomes = decision.actionOutcomes.map((outcome) => {
      const action = legalActions.find((item) => item.actionId === outcome.actionId);
      const evaluation = evaluator.evaluateOutcome(context, action);
      return { action, evaluation, outcome };
    });
    if (report.matchesRecorded) {
      const reuse = plans.planReuseCheck(decision.plan, env.observe(), env.legalActions(), { sameTurn: true });
      report.nextReuse = { hit: reuse.hit, reason: reuse.reason, action: reuse.action };
      report.recordedNext = save.replaySteps[230].action;
    }
    assert.ok(report.wallMs <= 10000, "单决策超过10秒，禁止进一步搜索");
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    env.dispose();
    fs.writeFileSync(output, JSON.stringify(report));
    console.log(JSON.stringify({ output, passed: report.passed, wallMs: report.wallMs,
      chosen: report.chosen, matchesRecorded: report.matchesRecorded, nextReuse: report.nextReuse,
      outcomes: report.outcomes?.map(({ action, evaluation, outcome }) => ({ family: action.family,
        summary: action.summary, score: evaluation.score, leafCount: outcome.leaves.length,
        selectedLeafId: evaluation.selectedLeafId })), error: report.error }, null, 2));
  }
}
