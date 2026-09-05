"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/round-data-income-r4-real-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const read = path => JSON.parse(fs.readFileSync(path));
  const record = read("reports/research/7a4c63fd.0d21aebf.full.json"), save = read(record.savePath);
  const report = { scope: "真实第144步轮初收入及checkpoint恢复，无AI搜索", source: record.savePath };
  const env = createSimulationEnv(), restored = createSimulationEnv(), afterRestore = createSimulationEnv();
  const load = (target, checkpoint) => {
    const copy = structuredClone(checkpoint); delete copy.replaySteps; target.loadCheckpoint(copy);
  };
  const state = target => JSON.parse(target.createCheckpoint().coreState.committedState);
  try {
    load(env, read("reports/iteration/r3-actual-opening-plan-20260906.json").beforeRoot);
    for (let i = 23; i < 143; i += 1) {
      const expected = save.replaySteps[i];
      const action = env.legalActions().find(a => a.actionId === expected.action.actionId);
      assert.deepEqual(action, expected.action); assert.equal(env.step(action).ok, true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
    }
    const before = env.createCheckpoint(); load(restored, before);
    assert.deepEqual(restored.observe(), env.observe()); assert.deepEqual(restored.legalActions(), env.legalActions());
    const action = env.legalActions().find(a => a.actionId === save.replaySteps[143].action.actionId);
    assert.deepEqual(action, save.replaySteps[143].action);
    assert.equal(env.step(action).ok, true); assert.equal(restored.step(action).ok, true);
    const actual = state(env); assert.deepEqual(state(restored), actual);
    assert.deepEqual(restored.observe(), env.observe()); assert.deepEqual(restored.legalActions(), env.legalActions());
    const blue = actual.players.players.find(player => player.id === "player-blue");
    assert.equal(blue.resources.availableData, 1); assert.equal(blue.dataState.poolTokens.length, 1);
    const old = JSON.parse(read("reports/iteration/r4-data-first-mismatch-20260906.json").coreState.committedState);
    const expected = structuredClone(old);
    expected.players.players.find(player => player.id === blue.id).dataState.poolTokens = structuredClone(blue.dataState.poolTokens);
    expected.meta.sequences.dataToken += 1;
    assert.deepEqual(actual, expected, "真实收入只新增遗漏的token及其正式序列，不改变其他canonical事实");
    const confirmed = env.createCheckpoint(); load(afterRestore, confirmed);
    assert.deepEqual(state(afterRestore), actual);
    assert.deepEqual(afterRestore.observe(), env.observe()); assert.deepEqual(afterRestore.legalActions(), env.legalActions());
    assert.equal(env.step(action).ok, false); assert.deepEqual(state(env), actual, "重复旧动作不得重复发收入");
    report.beforeSequence = JSON.parse(before.coreState.committedState).meta.sequences.dataToken;
    report.afterSequence = actual.meta.sequences.dataToken; report.blueData = blue.dataState;
    report.prefixSteps = 143; report.exactOldStateDifference = "blue.poolTokens新增1实体；dataToken序列+1";
    report.restoredBeforeAndAfterParity = true; report.repeatedActionRejectedWithoutMutation = true; report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    env.dispose(); restored.dispose(); afterRestore.dispose();
    fs.writeFileSync(output, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
  }
}
