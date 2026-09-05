"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/probe-completion-boundary-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const witness = JSON.parse(fs.readFileSync("reports/iteration/r3-green-land-witness-20260906.json"));
  const source = JSON.parse(fs.readFileSync("reports/iteration/r3-green-pass-choice-20260906.json"));
  const env = createSimulationEnv();
  const report = { createdAt: new Date().toISOString(),
    scope: "恢复已验证正式登陆后的checkpoint，只调用完成判定，不执行新动作或AI搜索。" };
  try {
    const checkpoint = structuredClone(witness.afterCheckpoint);
    delete checkpoint.replaySteps;
    env.loadCheckpoint(checkpoint);
    const observation = env.observe();
    const markers = (state) => state.publicState.board.planets.planets.mars.landingMarkers
      .filter((marker) => marker.playerId === "player-green").length;
    report.beforeMarks = markers(source.observation);
    report.afterMarks = markers(observation);
    report.actualChoice = witness.steps.at(-1);
    report.actualCompletion = evaluator.completesSecondaryAgentRouteTarget({ action: report.actualChoice,
      targetId: "land:mars:planet:", planId: "probe:rocket:1:land:mars:planet:",
      focalSeatId: "player-green", rootObservation: source.observation, branchObservation: observation });
    assert.equal(report.afterMarks - report.beforeMarks, 1);
    assert.equal(report.actualChoice.target.choiceId, "land:1:mars:planet:");
    assert.equal(report.actualCompletion, false, "旧完成判定缺陷已不再复现，应复核代码版本");
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
