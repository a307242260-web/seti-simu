"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/r3-green-land-witness-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const sourcePath = "reports/iteration/r3-green-pass-choice-20260906.json";
  const source = JSON.parse(fs.readFileSync(sourcePath));
  const env = createSimulationEnv();
  const report = { createdAt: new Date().toISOString(), sourcePath,
    scope: "同一真实PASS前状态，正式执行两牌换能量和1号火箭登陆火星；不调用AI。", steps: [] };
  const self = () => env.observe().publicState.players.find((p) => p.playerId === "player-green");
  function execute(action) {
    assert.ok(action, "缺少指定正式动作");
    report.steps.push(action);
    assert.equal(env.step(action).ok, true);
  }
  try {
    const checkpoint = structuredClone(source.beforePass);
    delete checkpoint.replaySteps;
    env.loadCheckpoint(checkpoint);
    report.before = self();
    const leaf = source.outcomes.find((entry) => entry.action.target?.tradeId === "cards-for-energy").outcome.leaves[0];
    assert.equal(leaf.rootRoutePlanId, "probe:rocket:1:land:mars:planet:");
    assert.equal(leaf.planSteps[4].action.target.rocketId, 5);
    for (const step of leaf.planSteps.slice(0, 4)) {
      execute(env.legalActions().find((action) => action.actionId === step.action.actionId));
    }
    report.afterTrade = self();
    execute(env.legalActions().find((action) => action.family === "land"));
    report.landingChoices = env.legalActions();
    const target = report.landingChoices.find((action) => action.target?.rocketId === 1
      && action.target?.planetId === "mars");
    execute(target);
    report.afterLand = self();
    report.remainingChoices = env.legalActions();
    report.afterCheckpoint = env.createCheckpoint();
    assert.equal(report.afterTrade.energy, 1);
    assert.equal(report.afterLand.score - report.before.score, 6);
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    env.dispose();
    fs.writeFileSync(output, JSON.stringify(report));
    console.log(JSON.stringify({ output, passed: report.passed, steps: report.steps,
      landingChoices: report.landingChoices, afterLand: report.afterLand, error: report.error }, null, 2));
  }
}
