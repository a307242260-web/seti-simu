"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/choice-failure-471-20260907.json";
const read = path => JSON.parse(fs.readFileSync(path));
if (fs.existsSync(output)) console.log(fs.readFileSync(output, "utf8"));
else {
  const env = createSimulationEnv();
  const report = { scope: "恢复既有433检查点，正式重放到471，逐个执行真实选择；不运行AI搜索", cases: [] };
  let fork;
  try {
    const record = read("reports/research/dd9a1dab.a4453b64.full.json");
    const save = read(record.savePath);
    const checkpoint = read("reports/iteration/amiba-overflow-before-step-433-20260906.json");
    delete checkpoint.replaySteps;
    env.loadCheckpoint(checkpoint);
    for (let index = 432; index < 470; index++) {
      const expected = save.replaySteps[index];
      const action = env.legalActions().find(a => a.actionId === expected.action.actionId);
      assert.ok(action, `第${index + 1}步动作不存在`);
      assert.deepEqual(JSON.parse(JSON.stringify(action)), expected.action);
      assert.equal(env.step(action).ok, true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
    }
    report.checkpointPath = "reports/iteration/before-choice-471-20260907.json";
    fs.writeFileSync(report.checkpointPath, JSON.stringify(env.createCheckpoint()));
    fork = env.createCounterfactualFork().composition;
    const envelope = fork.lifecycle.save().envelope;
    const choices = fork.inspect().session.decision.choices;
    assert.equal(choices.length, 3);
    for (const choice of choices) {
      assert.equal(fork.lifecycle.restore(envelope).ok, true);
      const decision = fork.inspect().session.decision;
      const result = fork.inputPort.submitDecision({ decisionId: decision.decisionId,
        decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice }, { skipProjection: true });
      report.cases.push({ choice, result });
    }
    report.inspectionComplete = true;
  } catch (error) {
    report.inspectionComplete = false; report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    fork?.dispose(); env.dispose();
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, inspectionComplete: report.inspectionComplete,
      cases: report.cases, error: report.error }, null, 2));
  }
}
