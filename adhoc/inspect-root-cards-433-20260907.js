"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/root-cards-433-20260907.json";
if (fs.existsSync(output)) console.log(fs.readFileSync(output, "utf8"));
else {
  const env = createSimulationEnv(), report = { scope: "真实433根状态三张合法牌逐个正式提交，不运行AI搜索", cases: [] };
  let fork;
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/amiba-overflow-before-step-433-20260906.json"));
    delete cp.replaySteps; env.loadCheckpoint(cp);
    fork = env.createCounterfactualFork().composition;
    const envelope = fork.lifecycle.save().envelope;
    const actions = fork.inputPort.enumerateActions().filter(action => action.family === "play_card");
    assert.equal(actions.length, 3);
    for (const action of actions) {
      assert.equal(fork.lifecycle.restore(envelope).ok, true);
      const result = fork.inputPort.submitAction(action, { skipProjection: true });
      report.cases.push({ action, ok: result.ok, phase: result.phase, failure: result.failure,
        pending: fork.inspect().session?.currentEffect });
    }
    report.inspectionComplete = true;
  } catch (error) {
    report.inspectionComplete = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    fork?.dispose(); env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
  }
}
