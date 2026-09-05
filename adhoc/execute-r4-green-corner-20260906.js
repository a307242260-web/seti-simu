"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/r4-green-corner-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const env = createSimulationEnv();
  const report = { scope: "从实际PASS前状态正式执行amiba_1弃牌角标；只验证该动作和公开后续，不运行AI搜索",
    source: "reports/iteration/r4-green-before-pass-20260906.json" };
  try {
    const checkpoint = JSON.parse(fs.readFileSync(report.source));
    delete checkpoint.replaySteps;
    env.loadCheckpoint(checkpoint);
    report.before = env.observe();
    report.action = env.legalActions().find(a=>a.family === "card_corner" && a.target.cardInstanceId === "alien-amiba-1-2");
    assert.ok(report.action);
    assert.equal(env.step(report.action).ok, true);
    report.after = env.observe();
    report.nextActions = env.legalActions();
    report.checkpointPath = "reports/iteration/r4-green-after-corner-20260906.json";
    fs.writeFileSync(report.checkpointPath,JSON.stringify(env.createCheckpoint()));
    report.passed = true;
  } catch(error) {
    report.passed = false;
    report.error = {message:error.message,stack:error.stack};
    process.exitCode = 1;
  } finally {
    env.dispose();
    fs.writeFileSync(output,JSON.stringify(report));
    console.log(JSON.stringify({output,passed:report.passed,
      before:report.before?.publicState.players.find(p=>p.playerId==="player-green"),
      after:report.after?.publicState.players.find(p=>p.playerId==="player-green"),
      decision:report.after?.decision,actions:report.nextActions,error:report.error},null,2));
  }
}
