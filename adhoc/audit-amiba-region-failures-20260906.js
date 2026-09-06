"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const read = path => JSON.parse(fs.readFileSync(path));
const step = Number(process.argv[2]);
assert.ok([466, 585, 621].includes(step));
const output = `reports/iteration/amiba-region-failure-step-${step}-20260906-v2.json`;
if (fs.existsSync(output)) console.log(fs.readFileSync(output, "utf8"));
else {
  const record = read("reports/research/857426ea.be6bd7b6.full.json"), save = read(record.savePath);
  const report = { scope: "已完成整局的异常边界只读重放与单决策错误取证，不重跑全盘，不作为提速数据", step, source: record.savePath };
  const env = createSimulationEnv();
  try {
    const initial = read("reports/iteration/r3-actual-opening-plan-20260906.json").beforeRoot;
    delete initial.replaySteps;
    env.loadCheckpoint(initial);
    for (let index = 23; index < step - 1; index++) {
      const expected = save.replaySteps[index];
      const action = env.legalActions().find(a => a.actionId === expected.action.actionId);
      assert.ok(action, `第${index + 1}步缺少合法动作`);
      assert.deepEqual(JSON.parse(JSON.stringify(action)), expected.action);
      assert.equal(env.step(action).ok, true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
    }
    report.checkpointPath = `reports/iteration/amiba-region-before-step-${step}-20260906.json`;
    fs.writeFileSync(report.checkpointPath, JSON.stringify(env.createCheckpoint()));
    const result = env.runHeuristicPolicyDecision();
    assert.equal(result.ok, true);
    report.chosen = result.policyDecision.actionId;
    report.expectedAction = save.replaySteps[step - 1].action.actionId;
    report.searches = result.searches;
    report.outcomes = result.actionOutcomes.filter(o => o.code).map(o => ({
      actionId: o.actionId, code: o.code, message: o.message, status: o.status, leaves: o.leaves.length,
    }));
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, passed: report.passed, chosen: report.chosen,
      expected: report.expectedAction, outcomes: report.outcomes, error: report.error }, null, 2));
  }
}
