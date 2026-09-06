"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = process.argv[2] || "reports/iteration/projection-freeze-471-20260907.json";
if (fs.existsSync(output)) console.log(fs.readFileSync(output, "utf8"));
else {
  const env = createSimulationEnv();
  const report = { scope: "同一真实471取消输入，仅改变执行前投影读取方式；不运行AI搜索", cases: [] };
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/before-choice-471-20260907.json"));
    delete cp.replaySteps; env.loadCheckpoint(cp);
    for (const [name, viewer] of [
      ["no-read", null], ["simulation-full", { role: "simulation" }],
      ["simulation-cheap", { role: "simulation", cheap: true }],
      ["player-full", { playerId: "player-blue" }],
      ["player-cheap", { playerId: "player-blue", cheap: true }],
    ]) {
      const fork = env.createCounterfactualFork().composition;
      try {
        const before = fork.lifecycle.save().envelope;
        if (viewer) fork.projection(viewer);
        assert.deepEqual(fork.lifecycle.save().envelope, before, "读取不得改变可序列化值");
        const d = fork.inspect().session.decision;
        const cancel = d.choices.find(c => c.target.source === "cancel");
        const result = fork.inputPort.submitDecision({ decisionId: d.decisionId,
          decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: cancel }, { skipProjection: true });
        report.cases.push({ name, result: { ok: result.ok, phase: result.phase, failure: result.failure } });
      } finally { fork.dispose(); }
    }
    report.inspectionComplete = true;
    if (process.argv[2]) assert.ok(report.cases.every(entry => entry.result.ok), "修复后所有读取方式都应正常执行");
  } catch (error) {
    report.inspectionComplete = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
  }
}
