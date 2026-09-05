"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const plans = require("../randomizer/game/ai/plan-continuation");
const output = "reports/iteration/probe-source-plan-verification-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const source = JSON.parse(fs.readFileSync("reports/iteration/r3-green-pass-choice-20260906.json"));
  const search = JSON.parse(fs.readFileSync("reports/iteration/probe-source-search-verification-20260906.json"));
  const launch = JSON.parse(fs.readFileSync("reports/iteration/probe-source-performance-20260906.json"));
  const report = { createdAt: new Date().toISOString(), scope: "正式执行已保存计划至登陆奖励；不重跑AI。",
    productionHashes: Object.fromEntries(["randomizer/game/rule-composition.js",
      "randomizer/game/ai/expected-score-evaluator.js", "randomizer/game/ai/heuristic-decision-function.js"]
      .map((file) => [file, crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")])), steps: [] };
  const env = createSimulationEnv();
  try {
    const checkpoint = structuredClone(source.beforePass);
    delete checkpoint.replaySteps;
    env.loadCheckpoint(checkpoint);
    let plan = search.plan;
    for (let index = 0; index <= 6; index += 1) {
      const expected = search.tradeLeaf.planSteps[index];
      const legal = env.legalActions();
      const action = legal.find((candidate) => candidate.actionId === expected.action.actionId);
      assert.ok(action);
      if (index) {
        const reuse = plans.planReuseCheck(plan, env.observe(), legal, { sameTurn: true });
        report.steps.push({ index, actionId: action.actionId, hit: reuse.hit, reason: reuse.reason });
        assert.equal(reuse.hit, true);
        assert.equal(reuse.action.actionId, action.actionId);
        plan = reuse.nextPlan;
      }
      assert.equal(env.step(action).ok, true);
    }
    assert.equal(search.tradeLeaf.planSteps[6].goalCompletionPending, true);
    assert.ok(!search.plan.steps[5].dependencies.some((dependency) => dependency.scope.kind === "route"));
    const leaf = launch.sample.outcomes.find((outcome) => outcome.action.family === "launch").selectedLeaf;
    assert.ok(leaf.planSteps[0].routePlanId.startsWith("probe:launch:"));
    assert.ok(leaf.planSteps[1].routePlanId.startsWith("probe:rocket:4:"));
    assert.ok(launch.sample.plan.steps.every((step) => step.valid));
    report.launchTransition = leaf.planSteps.slice(0, 2).map((step) => ({
      action: step.action.actionId, planId: step.routePlanId }));
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    env.dispose();
    fs.writeFileSync(output, JSON.stringify(report));
    console.log(JSON.stringify(report, null, 2));
  }
}
