"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const read = path => JSON.parse(fs.readFileSync(path));
const output = "reports/iteration/green-605-company-failure-20260906-v2.json";
const checkpointPath = "reports/iteration/card-trace-before-step-605-20260906.json";
if (fs.existsSync(output)) console.log(`已有证据，跳过重复执行：${output}`);
else {
  const record = read("reports/research/220d6a11.6cd56452.full.json"), save = read(record.savePath);
  const env = createSimulationEnv();
  const report = { scope: "真实605盘面只读重放，直接逐项提交公司合法移动，不运行AI搜索", source: record.savePath, checkpointPath };
  try {
    if (fs.existsSync(checkpointPath)) {
      const checkpoint = read(checkpointPath);
      delete checkpoint.replaySteps;
      env.loadCheckpoint(checkpoint);
    }
    else {
      const initial = read("reports/iteration/r3-actual-opening-plan-20260906.json").beforeRoot;
      delete initial.replaySteps;
      env.loadCheckpoint(initial);
      for (let index = 23; index < 604; index++) {
        const expected = save.replaySteps[index];
        const action = env.legalActions().find(a => a.actionId === expected.action.actionId);
        assert.ok(action, `第${index + 1}步缺少合法动作`);
        assert.deepEqual(JSON.parse(JSON.stringify(action)), expected.action);
        assert.equal(env.step(action).ok, true);
        assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
      }
      fs.writeFileSync(checkpointPath, JSON.stringify(env.createCheckpoint()));
    }
    const company = env.legalActions().find(a => a.family === "industry");
    assert.ok(company);
    report.company = company;
    report.start = env.step(company);
    assert.equal(report.start.ok, true);
    const pending = env.createCheckpoint(), choices = env.legalActions().filter(a => a.family === "choose_target");
    delete pending.replaySteps;
    assert.ok(choices.length);
    report.choices = [];
    for (const choice of choices) {
      env.loadCheckpoint(pending);
      const result = env.step(choice);
      report.choices.push({ choice, result });
    }
    report.failedChoices = report.choices.filter(c => !c.result.ok).length;
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    env.dispose();
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, passed: report.passed, failedChoices: report.failedChoices,
      choices: report.choices?.map(c => ({ summary: c.choice.summary, ok: c.result.ok,
        failure: c.result.failure?.failure })), error: report.error }, null, 2));
  }
}
