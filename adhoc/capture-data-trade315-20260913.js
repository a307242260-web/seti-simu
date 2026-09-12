"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const output = "adhoc/data-trade315-input-20260913.json";
if (fs.existsSync(output)) { console.log("已有315输入，不重复重放"); process.exit(0); }
const source = "/Users/bilibili/code/seti-simu/seti-saves/seti-save-research-public-card-runezu-greedy-20260913-3544e2df-full-v300.json";
const bytes = fs.readFileSync(source), save = JSON.parse(bytes);
const env = require("../randomizer/app/simulation-env").createSimulationEnv();
try {
  env.reset({ seed: save.seed, activePlayerCount: 4, aiDifficulty: "laughable" });
  for (let i = 0; i < 314; i += 1) {
    const expected = save.replaySteps[i];
    assert.deepEqual(env.legalActions().find(a => a.actionId === expected.action.actionId), expected.action, `动作${i + 1}`);
    assert.equal(env.step(expected.action).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after, `结果${i + 1}`);
  }
  const checkpoint = env.createCheckpoint();
  delete checkpoint.replaySteps; delete checkpoint.effectSessionJournals; delete checkpoint.browserReplaySteps;
  fs.writeFileSync(output, JSON.stringify({ source, sourceHash: crypto.createHash("sha256").update(bytes).digest("hex"),
    verifiedReplaySteps: 314, checkpoint, legalActions: env.legalActions() }) + "\n", { flag: "wx" });
  console.log("前314步完整action/after一致，已保存315输入；未运行AI");
} finally { env.dispose(); }
