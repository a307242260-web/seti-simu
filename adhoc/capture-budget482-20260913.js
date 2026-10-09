"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createHash } = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "adhoc/budget482-input-20260913.json";
if (fs.existsSync(output)) { console.log(`[skip] 已有输入：${output}`); process.exit(0); }
const source = "seti-saves/seti-save-research-card-terminal-value-20260913-22891395-full-v272.json";
const save = JSON.parse(fs.readFileSync(source));
const env = createSimulationEnv();
// JSON 存档丢弃 undefined 字段；比较前做同一归一，避免把序列化差异当成动作不一致。
const normalize = (value) => JSON.parse(JSON.stringify(value));
try {
  env.reset({ seed: save.seed, activePlayerCount: 4, aiDifficulty: "laughable" });
  for (let index = 0; index < 481; index += 1) {
    const expected = save.replaySteps[index];
    const action = env.legalActions().find(a => a.actionId === expected.action.actionId);
    assert.deepEqual(normalize(action), normalize(expected.action), `第${index + 1}步完整动作`);
    assert.equal(env.step(action).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after, `第${index + 1}步结果`);
    if ((index + 1) % 50 === 0) console.log(`[输入重放，无AI] ${index + 1}/481`);
  }
  const expectedAction = save.replaySteps[481].action;
  assert.equal(expectedAction.actorId, "player-white");
  assert.equal(expectedAction.actionId, "industry:e887dc52");
  const checkpoint = env.createCheckpoint();
  delete checkpoint.replaySteps;
  delete checkpoint.effectSessionJournals;
  delete checkpoint.browserReplaySteps;
  fs.writeFileSync(output, JSON.stringify({ source, sourceHash: createHash("sha256").update(fs.readFileSync(source)).digest("hex"),
    step: 482, verifiedReplaySteps: 481, expectedAction, checkpoint,
    legalActions: env.legalActions(), observation: env.observe("player-white") }, null, 2) + "\n", { flag: "wx" });
  console.log(`[输入完成，无AI] ${output}`);
} finally { env.dispose(); }
