"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/trade-failure-516-20260907.json";
const read = path => JSON.parse(fs.readFileSync(path));
if (fs.existsSync(output)) console.log(`已有证据：${output}`);
else {
  const env = createSimulationEnv();
  const report = { scope: "从既有42正式检查点只读重放7613a096存档到516，逐个提交真实选择；不运行AI，不修改盘面", cases: [] };
  let fork;
  try {
    const record = read("reports/research/64334dc7.7613a096.full.json");
    const save = read(record.savePath);
    const checkpoint = read("reports/iteration/company-movement-input-42-20260906.json").checkpoint;
    delete checkpoint.replaySteps;
    env.loadCheckpoint(checkpoint);
    for (let index = 41; index < 515; index++) {
      const expected = save.replaySteps[index];
      const action = env.legalActions().find(a => a.actionId === expected.action.actionId);
      assert.ok(action, `第${index + 1}步动作不存在`);
      assert.deepEqual(JSON.parse(JSON.stringify(action)), expected.action);
      assert.equal(env.step(action).ok, true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
    }
    report.checkpointPath = "reports/iteration/before-trade-516-20260907.json";
    fs.writeFileSync(report.checkpointPath, JSON.stringify(env.createCheckpoint()));
    fork = env.createCounterfactualFork().composition;
    const envelope = fork.lifecycle.save().envelope;
    report.before = fork.inspect();
    for (const choice of report.before.session.decision.choices) {
      assert.equal(fork.lifecycle.restore(envelope).ok, true);
      const decision = fork.inspect().session.decision;
      const result = fork.inputPort.submitDecision({ decisionId: decision.decisionId,
        decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice }, { skipProjection: true });
      report.cases.push({ choice, result });
    }
    const failed = report.cases.filter(c => !c.result.ok);
    assert.equal(failed.length, 1);
    assert.equal(failed[0].choice.target.kind, "confirm");
    assert.ok(failed[0].choice.disabledReason);
    assert.equal(failed[0].result.failure.code, "QUICK_TRADE_DISCARD_INCOMPLETE");
    report.inspectionComplete = true;
  } catch (error) {
    report.inspectionComplete = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    fork?.dispose(); env.dispose();
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, inspectionComplete: report.inspectionComplete,
      cases: report.cases.map(c => ({ choice: c.choice, ok: c.result.ok, failure: c.result.failure })), error: report.error }, null, 2));
  }
}
