"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/company-movement-input-42-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，跳过：${output}`);
else {
  const env = createSimulationEnv(), report = { scope: "新建正式环境重放41步，比较旧检查点，不运行AI搜索" };
  try {
    const record = JSON.parse(fs.readFileSync("reports/research/25c65ece.795cd6eb.full.json"));
    const save = JSON.parse(fs.readFileSync(record.savePath));
    env.reset({ seed: record.seed, activePlayerCount: record.activePlayerCount,
      aiDifficulty: record.aiDifficulty, policyVersion: record.policyVersion, ...record.flags });
    for (let i = 0; i < 41; i++) {
      const expected = save.replaySteps[i];
      const action = env.legalActions().find(a => a.actionId === expected.action.actionId);
      assert.deepEqual(JSON.parse(JSON.stringify(action)), expected.action);
      assert.equal(env.step(action).ok, true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
    }
    report.checkpoint = env.createCheckpoint();
    const old = JSON.parse(fs.readFileSync("reports/iteration/node-types-before-step-42-20260906.json"));
    const before = JSON.parse(old.coreState.compositionEnvelope.committedState);
    const after = JSON.parse(report.checkpoint.coreState.compositionEnvelope.committedState);
    report.stateDifferences = [];
    function diff(a, b, path) {
      if (JSON.stringify(a) === JSON.stringify(b)) return;
      if (a && b && typeof a === "object" && typeof b === "object") {
        for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[key], b[key], `${path}.${key}`);
      } else report.stateDifferences.push({ path, before: a, after: b });
    }
    diff(before, after, "state");
    report.sameSession = JSON.stringify(old.coreState.compositionEnvelope.session)
      === JSON.stringify(report.checkpoint.coreState.compositionEnvelope.session);
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, passed: report.passed, differences: report.stateDifferences,
      sameSession: report.sameSession, error: report.error }));
  }
}
