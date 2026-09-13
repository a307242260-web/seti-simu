"use strict";
const assert = require("node:assert/strict");
const { checkpointFromSave } = require("./run_research_validation");
const { createReportSave } = require("./robot-report-fixture");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const save = createReportSave();
const config = { seed: save.seed, activePlayerCount: 4 };
const input = structuredClone(save);
const env = createSimulationEnv();
try {
  env.loadCheckpoint(checkpointFromSave(save, config));
  const restored = env.saveBrowserSave();
  assert.deepEqual(JSON.parse(restored.committedState), JSON.parse(save.committedState));
  assert.deepEqual(restored.session, save.session);
  assert.deepEqual(restored.replaySteps, save.replaySteps);
  assert.deepEqual(save, input, "研究续跑适配不得修改源存档");
  const before = env.createCheckpoint();
  const bad = structuredClone(save);
  const state = JSON.parse(bad.committedState);
  state.meta.rngState.algorithm = "unsupported-random";
  bad.committedState = JSON.stringify(state);
  assert.throws(() => env.loadCheckpoint(checkpointFromSave(bad, config)), /RNG/,
    "不能替换未知随机算法标签后强行续跑");
  assert.deepEqual(env.createCheckpoint(), before);
  assert.equal(env.step(env.legalActions()[0]).ok, true);
  const next = env.saveBrowserSave();
  assert.deepEqual(next.replaySteps.slice(0, save.replaySteps.length), save.replaySteps);
  assert.equal(next.replaySteps.length, save.replaySteps.length + 1);
} finally { env.dispose(); }
console.log("research world resume tests passed");
