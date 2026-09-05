"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const outcomeModel = require("../randomizer/game/ai/outcome-model");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/r4-green-corner-complete-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const source = JSON.parse(fs.readFileSync("reports/iteration/r4-green-corner-20260906.json"));
  const report = { scope: "正式结束唯一移动选择，比较相同现行V口径；不把即时1分视为净收益或终局改进" };
  const env = createSimulationEnv();
  try {
    const checkpoint = JSON.parse(fs.readFileSync(source.checkpointPath));
    delete checkpoint.replaySteps;
    env.loadCheckpoint(checkpoint);
    const actions = env.legalActions();
    assert.equal(actions.length,1);
    assert.equal(actions[0].target.skip,true);
    assert.equal(env.step(actions[0]).ok,true);
    report.completedAction = actions[0];
    report.after = env.observe();
    assert.notEqual(report.after.decision.decisionType,"conditional_choice");
    report.values = [source.before,report.after].map(observation=>evaluator.evaluateStateValue(
      outcomeModel.createDecisionObservation(observation,{seatId:"player-green"}),"player-green"));
    report.valueDelta = report.values[1].total-report.values[0].total;
    report.nextActions = env.legalActions();
    report.passed = true;
  } catch(error) {
    report.passed = false;report.error={message:error.message,stack:error.stack};process.exitCode=1;
  } finally {
    env.dispose();fs.writeFileSync(output,JSON.stringify(report));
    console.log(JSON.stringify({output,passed:report.passed,delta:report.valueDelta,values:report.values,error:report.error},null,2));
  }
}
