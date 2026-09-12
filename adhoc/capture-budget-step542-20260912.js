"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/budget-before-step542-20260912.json";
if (fs.existsSync(output)) { console.log(`已有输入，不重放：${output}`); process.exit(0); }
const source = "seti-saves/seti-save-research-trace-score-greedy-input-20260912-d75fb99a-full-v285.json";
const inputPath = "reports/iteration/budget-before-step506-20260912.json";
const input = JSON.parse(fs.readFileSync(inputPath));
const save = JSON.parse(fs.readFileSync(source));
const env = createSimulationEnv();
try {
  env.loadCheckpoint(input.checkpoint);
  assert.deepEqual(env.legalActions(), input.legalActions);
  for (let i = 505; i < 541; i += 1) {
    const expected = save.replaySteps[i];
    const action = env.legalActions().find(a => a.actionId === expected.action.actionId);
    assert.deepEqual(action, expected.action, `第${i + 1}步完整动作不同`);
    assert.equal(env.step(action).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
    console.log(`[输入重放，无AI] ${i + 1}/541`);
  }
  const expectedAction = save.replaySteps[541].action;
  assert.equal(expectedAction.actorId, "player-green");
  assert.equal(expectedAction.actionId, "quick_trade:76cce73d");
  assert.deepEqual(env.legalActions().find(a => a.actionId === expectedAction.actionId), expectedAction);
  const checkpoint = env.createCheckpoint();
  delete checkpoint.replaySteps;
  delete checkpoint.effectSessionJournals;
  delete checkpoint.browserReplaySteps;
  const observation = env.observe("player-green");
  const hash = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  fs.writeFileSync(output, JSON.stringify({ source, sourceHash: hash(source), inputPath,
    inputHash: hash(inputPath), verifiedReplayRange: [506, 541], step: 542, expectedAction,
    checkpoint, legalActions: env.legalActions(), observation }, null, 2) + "\n", { flag: "wx" });
  console.log(`[输入完成] ${output}；合法动作${env.legalActions().length}`);
} finally { env.dispose(); }
