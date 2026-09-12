"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = path.resolve(__dirname, "../reports/iteration/budget-before-step506-20260912.json");
if (fs.existsSync(output)) {
  console.log(`已有输入checkpoint，不重复重放：${output}`);
  process.exit(0);
}
const source = "/Users/bilibili/code/seti-simu/seti-saves/seti-save-research-frontier-materialization-20260912-eee63294-full-v285.json";
const save = JSON.parse(fs.readFileSync(source));
const env = createSimulationEnv();
try {
  env.reset({ seed: save.seed, activePlayerCount: 4, aiDifficulty: "laughable" });
  for (let index = 0; index < 505; index += 1) {
    const expected = save.replaySteps[index];
    const action = env.legalActions().find(a => a.actionId === expected.action.actionId);
    assert(action, `第${index + 1}步动作不匹配`);
    assert.equal(env.step(action).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after,
      `第${index + 1}步结果与原记录不一致`);
    if ((index + 1) % 25 === 0) console.log(`[输入重放，无AI] ${index + 1}/505`);
  }
  const expectedAction = save.replaySteps[505].action;
  assert.equal(expectedAction.actorId, "player-white");
  assert.equal(expectedAction.actionId, "move:547412a6");
  assert(env.legalActions().some(a => a.actionId === expectedAction.actionId));
  const checkpoint = env.createCheckpoint();
  delete checkpoint.replaySteps;
  delete checkpoint.effectSessionJournals;
  delete checkpoint.browserReplaySteps;
  fs.writeFileSync(output, JSON.stringify({ source, step: 506, expectedAction,
    verifiedReplaySteps: 505, checkpoint, legalActions: env.legalActions() }, null, 2) + "\n",
  { flag: "wx" });
  console.log(`[输入重放完成，无AI] ${output}`);
} finally {
  env.dispose();
}
