"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createHash } = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "adhoc/budget37-input-20260913.json";
if (fs.existsSync(output)) { console.log(`[skip] 已有输入：${output}`); process.exit(0); }
const source = "seti-saves/seti-save-research-data-corner-greedy-20260913-236c6969-full-v278.json";
const save = JSON.parse(fs.readFileSync(source));
const env = createSimulationEnv();
try {
  env.reset({ seed: save.seed, activePlayerCount: 4, aiDifficulty: "laughable" });
  for (let index = 0; index < 36; index += 1) {
    const expected = save.replaySteps[index];
    const action = env.legalActions().find(a => a.actionId === expected.action.actionId);
    assert.deepEqual(action, expected.action, `第${index + 1}步完整动作`);
    assert.equal(env.step(action).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after, `第${index + 1}步结果`);
    if ((index + 1) % 25 === 0) console.log(`[输入重放，无AI] ${index + 1}/36`);
  }
  const expectedAction = save.replaySteps[36].action;
  assert.equal(expectedAction.actorId, "player-green");
  assert.equal(expectedAction.actionId, "industry:5bda1856");
  assert.deepEqual(env.legalActions().find(a => a.actionId === expectedAction.actionId), expectedAction);
  const checkpoint = env.createCheckpoint();
  delete checkpoint.replaySteps;
  delete checkpoint.effectSessionJournals;
  delete checkpoint.browserReplaySteps;
  fs.writeFileSync(output, JSON.stringify({ source, sourceHash: createHash("sha256").update(fs.readFileSync(source)).digest("hex"),
    step: 37, verifiedReplaySteps: 36, expectedAction, checkpoint,
    legalActions: env.legalActions(), observation: env.observe("player-green") }, null, 2) + "\n", { flag: "wx" });
  console.log(`[输入完成，无AI] ${output}`);
} finally { env.dispose(); }
