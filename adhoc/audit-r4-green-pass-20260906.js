"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/r4-green-pass-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const record = JSON.parse(fs.readFileSync("reports/research/76d49ed1.8a6ef25e.full.json"));
  const raw = fs.readFileSync(record.savePath), save = JSON.parse(raw);
  const report = { scope: "正式重放保存动作到绿方第二轮PASS前，只读合法集/观察，不运行AI搜索；不含当时未保存的计划缓存",
    savePath: record.savePath, sourceHash: crypto.createHash("sha256").update(raw).digest("hex"),
    verifiedThrough: 22 };
  const env = createSimulationEnv();
  try {
    const source = JSON.parse(fs.readFileSync("reports/iteration/r3-actual-opening-plan-20260906.json"));
    const checkpoint = structuredClone(source.beforeRoot);
    delete checkpoint.replaySteps;
    env.loadCheckpoint(checkpoint);
    const target = save.replaySteps.findIndex((step, index) => index > 23 && step.actorPlayerId === "player-green"
      && step.action.family === "pass" && save.replaySteps[index-1].after.r === 2);
    assert.ok(target > 23);
    for (let index = 23; index < target; index++) {
      const expected = save.replaySteps[index];
      const action = env.legalActions().find((item) => item.actionId === expected.action.actionId);
      assert.deepEqual(action, expected.action, `第${index+1}步合法动作不符`);
      assert.equal(env.step(action).ok, true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
      report.verifiedThrough = index;
    }
    report.targetIndex = target;
    report.recordedAction = save.replaySteps[target].action;
    report.observation = env.observe();
    report.legalActions = env.legalActions();
    report.checkpointPath = "reports/iteration/r4-green-before-pass-20260906.json";
    fs.writeFileSync(report.checkpointPath, JSON.stringify(env.createCheckpoint()));
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    env.dispose();
    fs.writeFileSync(output, JSON.stringify(report));
    console.log(JSON.stringify({output, passed:report.passed, targetIndex:report.targetIndex,
      actions:report.legalActions?.map(a=>({family:a.family,summary:a.summary,target:a.target})),error:report.error},null,2));
  }
}
