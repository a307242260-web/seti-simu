"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const read = path => JSON.parse(fs.readFileSync(path));
const output = "reports/iteration/white-404-state-20260906.json";
const checkpointPath = "reports/iteration/company-before-step-404-20260906.json";
if (fs.existsSync(output)) console.log(`已有证据，跳过：${output}`);
else {
  const env = createSimulationEnv(), report = { scope: "仅重放既有动作并检查404状态，不重新搜索", checkpointPath };
  try {
    const record = read("reports/research/ffb71a57.553e19c6.full.json"), save = read(record.savePath);
    if (fs.existsSync(checkpointPath)) {
      const cp = read(checkpointPath); delete cp.replaySteps; env.loadCheckpoint(cp);
    } else {
      const initial = read("reports/iteration/r3-actual-opening-plan-20260906.json").beforeRoot;
      delete initial.replaySteps; env.loadCheckpoint(initial);
      for (let index = 23; index < 403; index++) {
        const expected = save.replaySteps[index];
        const action = env.legalActions().find(a => a.actionId === expected.action.actionId);
        assert.ok(action, `第${index + 1}步缺少动作`);
        assert.deepEqual(JSON.parse(JSON.stringify(action)), expected.action);
        assert.equal(env.step(action).ok, true);
        assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
      }
      fs.writeFileSync(checkpointPath, JSON.stringify(env.createCheckpoint()));
    }
    const root = JSON.parse(env.createCheckpoint().coreState.compositionEnvelope.committedState);
    report.player = root.players.players.find(p => p.id === "player-white");
    report.rockets = root.pieces.rockets;
    report.actions = env.legalActions();
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({output,passed:report.passed,actions:report.actions?.map(a=>({family:a.family,summary:a.summary,target:a.target})),error:report.error},null,2));
  }
}
