"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/probe-source-consumers-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const source = JSON.parse(fs.readFileSync("reports/iteration/r3-green-pass-choice-20260906.json"));
  const witness = JSON.parse(fs.readFileSync("reports/iteration/r3-green-land-witness-20260906.json"));
  const env = createSimulationEnv();
  const report = { createdAt: new Date().toISOString(),
    scope: "正式重放已验证支付，直接调用纯目录/后继函数；无AI搜索、无完整局。" };
  try {
    const checkpoint = structuredClone(source.beforePass);
    delete checkpoint.replaySteps;
    env.loadCheckpoint(checkpoint);
    for (const step of witness.steps.slice(0, 4)) {
      const action = env.legalActions().find((candidate) => candidate.actionId === step.actionId);
      assert.ok(action);
      assert.equal(env.step(action).ok, true);
    }
    const observation = env.observe();
    const legal = env.legalActions();
    report.genericLand = legal.find((action) => action.family === "land");
    assert.deepEqual(report.genericLand.target, { select: true });
    const binding = { focalSeatId: "player-green", branchObservation: observation,
      legalSuccessors: legal, routeTargetId: "land:mars:planet:",
      routePlanId: "probe:rocket:1:land:mars:planet:", actionChain: [witness.steps[0].actionId],
      focalProxyDepth: 0, maxProxyDepth: 15 };
    report.selected = evaluator.selectSecondaryAgentSuccessors(binding);
    const reversed = structuredClone(observation);
    reversed.probeRouteRequirements.candidates.reverse();
    report.reversedSelected = evaluator.selectSecondaryAgentSuccessors({ ...binding, branchObservation: reversed });
    report.rootTargets = evaluator.enumerateSecondaryAgentRootTargets({ focalSeatId: "player-green",
      rootObservation: observation, legalActions: legal, maxProxyDepth: 15 });
    assert.ok(report.selected.some((action) => action.family === "move" && action.target.rocketId === 5));
    assert.ok(!report.selected.some((action) => action.family === "land"));
    assert.ok(!report.reversedSelected.some((action) => action.family === "land"));
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    env.dispose();
    fs.writeFileSync(output, JSON.stringify(report));
    console.log(JSON.stringify({ output, passed: report.passed, selected: report.selected,
      reversedSelected: report.reversedSelected,
      marsRoots: report.rootTargets?.filter((target) => target.targetId === "land:mars:planet:"),
      error: report.error }, null, 2));
  }
}
