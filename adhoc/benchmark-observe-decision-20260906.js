"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const phase = process.argv[2];
assert.ok(["before", "after"].includes(phase));
const output = `reports/iteration/observe-decision-${phase}-20260906.json`;
if (fs.existsSync(output)) console.log(`已有基准，未重跑：${output}`);
else {
  const path = "seti-saves/seti-save-research-round-data-income-r4-20260906-6d67a974-quick-200-v93.json";
  const save = JSON.parse(fs.readFileSync(path)), env = createSimulationEnv();
  const hash = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const report = { scope: "真实条件决策状态纯observe基准，不运行AI", phase, source: path, samples: [] };
  try {
    env.loadCheckpoint({ schemaVersion: "seti-rl-checkpoint-v1", coreState: { version: 2,
      committedState: save.committedState, compositionEnvelope: { schemaVersion: "seti-rule-composition-save-v1",
        committedState: save.committedState, session: save.session } },
      config: { seed: save.seed }, replayCursor: { seed: save.seed, stepIndex: 0 }, replaySteps: null });
    const before = env.createCheckpoint();
    const viewers = ["player-white", "player-green"];
    report.hashes = Object.fromEntries(viewers.map(viewer => [viewer, hash(env.observe(viewer))]));
    for (let i = 0; i < 10; i += 1) for (const viewer of viewers) env.observe(viewer);
    for (let sample = 0; sample < 5; sample += 1) {
      const start = performance.now();
      for (let i = 0; i < 40; i += 1) for (const viewer of viewers) env.observe(viewer);
      report.samples.push(performance.now() - start);
    }
    for (const viewer of viewers) assert.equal(hash(env.observe(viewer)), report.hashes[viewer]);
    assert.deepEqual(env.createCheckpoint(), before);
    report.medianMsPer80Observations = [...report.samples].sort((a, b) => a - b)[2];
    report.inputUnchanged = true;
    if (phase === "after") assert.deepEqual(report.hashes, JSON.parse(fs.readFileSync("reports/iteration/observe-decision-before-20260906.json")).hashes);
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally { env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); }
}
