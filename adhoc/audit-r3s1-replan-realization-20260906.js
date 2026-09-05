"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const plans = require("../randomizer/game/ai/plan-continuation");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/r3s1-replan-realization-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const sourcePath = "reports/iteration/r3s1-green-boundary-20260906.json";
  const source = JSON.parse(fs.readFileSync(sourcePath));
  const record = JSON.parse(fs.readFileSync("reports/research/c3eebca2.4fba7beb.full.json"));
  const save = JSON.parse(fs.readFileSync(record.savePath));
  const env = createSimulationEnv();
  const report = { createdAt: new Date().toISOString(), sourcePath, savePath: record.savePath,
    scope: "复用已保存搜索叶评分与正式动作重放；无新AI搜索、无全盘实验。", boundaries: [] };
  try {
    const outcome = source.outcomes.find((o) => o.actionId === source.chosen);
    const action = outcome.leaves[0].planSteps[0].action;
    const context = { seatId: "player-green", observation: outcome.rootObservation, actionOutcomes: source.outcomes };
    report.selectedEvaluation = evaluator.evaluateOutcome(context, action);
    report.leafEvaluations = outcome.leaves.map((leaf) => ({ leafId: leaf.leafId,
      rootGoal: leaf.rootRouteTargetId, terminalReason: leaf.terminalReason,
      actions: leaf.planSteps.map((step) => step.action.family),
      evaluation: evaluator.evaluateOutcome({ ...context, actionOutcomes: [{ ...outcome, leaves: [leaf] }] }, action),
    }));
    report.selectedLeaf = outcome.leaves.find((leaf) => leaf.leafId === report.selectedEvaluation.selectedLeafId);
    assert.ok(report.selectedLeaf);
    let plan = source.plan;
    for (let i = 74; i < 79; i += 1) plan = plans.advancePlan(plan);
    env.loadCheckpoint(source.beforeDivergence);
    let lastTurn = env.observe().publicState.turnNumber;
    for (let index = 79; index < Math.min(save.replaySteps.length, 200); index += 1) {
      const expected = save.replaySteps[index];
      const actions = env.legalActions();
      const action = actions.find((a) => a.actionId === expected.action.actionId);
      assert.deepEqual(action, expected.action);
      if (action.actorId === "player-green") {
        const observation = env.observe();
        const reuse = plans.planReuseCheck(plan, observation, actions, { sameTurn: lastTurn === observation.publicState.turnNumber });
        report.boundaries.push({ index, action, nextStep: plan?.steps?.[0],
          reuse: { hit: reuse.hit, reason: reuse.reason },
          observation, matchesRecorded: reuse.hit && reuse.action.actionId === action.actionId });
        if (!reuse.hit || reuse.action.actionId !== action.actionId) {
          report.stoppedAt = index;
          report.stopCheckpoint = env.createCheckpoint();
          break;
        }
        plan = reuse.nextPlan;
        lastTurn = observation.publicState.turnNumber;
      }
      assert.equal(env.step(action).ok, true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
    }
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    env.dispose();
    fs.writeFileSync(output, JSON.stringify(report));
    console.log(JSON.stringify({ output, passed: report.passed, stop: report.stoppedAt,
      score: report.selectedEvaluation?.score, selected: report.selectedEvaluation?.selectedLeafId,
      boundaries: report.boundaries.map((b) => ({ index: b.index, action: b.action.family, reuse: b.reuse, matches: b.matchesRecorded })), error: report.error }));
  }
}
