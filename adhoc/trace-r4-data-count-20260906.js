"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/r4-data-count-trace-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const read = path => JSON.parse(fs.readFileSync(path));
  const record = read("reports/research/7a4c63fd.0d21aebf.full.json");
  const save = read(record.savePath), env = createSimulationEnv();
  const report = { scope: "正式重放并检查资源计数与数据池；无AI搜索", savePath: record.savePath, changes: [] };
  let previous = {};
  function inspect(index) {
    const checkpoint = env.createCheckpoint();
    const state = JSON.parse(checkpoint.coreState.committedState);
    for (const player of state.players.players) {
      const value = { count: player.resources.availableData, pool: player.dataState?.poolTokens?.length || 0,
        placed: player.dataState?.placedTokens?.length || 0 };
      const old = previous[player.id];
      if ((!old && value.count !== value.pool) || (old && value.count - value.pool !== old.count - old.pool)) {
        report.changes.push({ step: index + 1, playerId: player.id, before: old, after: value,
          action: index >= 23 ? save.replaySteps[index].action : null });
        if (!report.firstMismatchCheckpoint && index >= 23 && value.count !== value.pool) {
          report.firstMismatchCheckpoint = "reports/iteration/r4-data-first-mismatch-20260906.json";
          fs.writeFileSync(report.firstMismatchCheckpoint, JSON.stringify(checkpoint));
        }
      }
      previous[player.id] = value;
    }
  }
  try {
    const initial = read("reports/iteration/r3-actual-opening-plan-20260906.json").beforeRoot;
    delete initial.replaySteps; env.loadCheckpoint(initial); inspect(22);
    for (let i = 23; i < 552; i++) {
      const expected = save.replaySteps[i];
      const action = env.legalActions().find(a => a.actionId === expected.action.actionId);
      assert.deepEqual(action, expected.action); assert.equal(env.step(action).ok, true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
      inspect(i);
    }
    report.final = previous; report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
}
