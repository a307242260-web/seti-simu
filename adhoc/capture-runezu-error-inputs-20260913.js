"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const oldRoot = "/tmp/seti-public-card-greedy-20260913.87etUF";
const source = path.join(oldRoot, "seti-saves/seti-save-research-public-card-trade-greedy-20260913-a5e6170c-full-v300.json");
const bytes = fs.readFileSync(source), save = JSON.parse(bytes);
const targets = [196, 264, 303, 428, 430, 445, 452, 508, 564];
const directory = "adhoc/runezu-error-inputs-20260913";
fs.mkdirSync(directory, { recursive: true });
if (targets.every(step => fs.existsSync(path.join(directory, `step-${step}.json`)))) {
  console.log("共同输入均已存在，不重复重放"); process.exit(0);
}
const env = require(path.join(oldRoot, "randomizer/app/simulation-env")).createSimulationEnv();
try {
  env.reset({ seed: save.seed, activePlayerCount: 4, aiDifficulty: "laughable" });
  for (let i = 0; i < 564; i += 1) {
    const expected = save.replaySteps[i];
    assert.deepEqual(env.legalActions().find(a => a.actionId === expected.action.actionId), expected.action, `动作${i + 1}`);
    if (targets.includes(i + 1)) {
      const file = path.join(directory, `step-${i + 1}.json`);
      if (!fs.existsSync(file)) {
        const checkpoint = env.createCheckpoint();
        delete checkpoint.replaySteps; delete checkpoint.effectSessionJournals; delete checkpoint.browserReplaySteps;
        fs.writeFileSync(file, JSON.stringify({ source, sourceHash: createHash("sha256").update(bytes).digest("hex"),
          verifiedReplaySteps: i, step: i + 1, checkpoint, legalActions: env.legalActions() }) + "\n", { flag: "wx" });
      }
      console.log(`[共同输入，无AI] 已核对并保存第${i + 1}步`);
    }
    if (i === 563) break;
    assert.equal(env.step(expected.action).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after, `结果${i + 1}`);
  }
} finally { env.dispose(); }
