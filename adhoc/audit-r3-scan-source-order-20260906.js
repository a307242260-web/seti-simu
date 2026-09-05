"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/r3-scan-source-order-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const checkpoint = JSON.parse(fs.readFileSync("reports/iteration/mercury-scan-directory-audit-20260906.json")).checkpoint;
  const report = { createdAt: new Date().toISOString(), scope: "隔离正式扫描：同一能力并集下地球/水星来源交换，检查实际选择顺序及绑定队列；无AI搜索",
    sourceSha256: crypto.createHash("sha256").update(fs.readFileSync("randomizer/game/effects/science-session.js")).digest("hex"), rows: [] };
  try {
    for (const rotation of [0, 4]) {
      const input = structuredClone(checkpoint);
      delete input.replaySteps;
      const state = JSON.parse(input.coreState.committedState);
      state.solarSystem.rotation.wheel1Steps = rotation;
      state.meta.gameId += `:source-order:${rotation}`;
      input.coreState.committedState = JSON.stringify(state);
      input.coreState.compositionEnvelope.committedState = input.coreState.committedState;
      const env = createSimulationEnv();
      try {
        env.loadCheckpoint(input);
        const before = env.observe();
        assert.equal(env.step(env.legalActions().find((a) => a.family === "scan")).ok, true);
        const firstChoices = env.legalActions();
        const queueCheckpoint = env.createCheckpoint();
        const earth = firstChoices.find((a) => a.target?.nebulaId);
        assert.ok(earth);
        assert.equal(env.step(earth).ok, true);
        const secondChoices = env.legalActions();
        const mercury = secondChoices.find((a) => a.target?.nebulaId);
        assert.ok(mercury);
        const beforeMercury = env.observe().publicState.players.find((p) => p.playerId === "player-brown");
        assert.equal(env.step(mercury).ok, true);
        const afterMercury = env.observe().publicState.players.find((p) => p.playerId === "player-brown");
        assert.equal(beforeMercury.publicity - afterMercury.publicity, 1);
        report.rows.push({ rotation, accessSources: before.sectorWinRequirements.accessSources,
          firstChoices, secondChoices, beforeMercury, afterMercury, queueCheckpoint });
      } finally { env.dispose(); }
    }
    assert.deepEqual(report.rows[0].accessSources, report.rows[1].accessSources);
    assert.equal(report.rows[0].firstChoices[0].target.nebulaId, "sector-1-a");
    assert.equal(report.rows[1].firstChoices[0].target.nebulaId, "sector-4-a");
    assert.equal(report.rows[0].secondChoices.find((a) => a.target?.nebulaId).target.nebulaId, "sector-4-a");
    assert.equal(report.rows[1].secondChoices.find((a) => a.target?.nebulaId).target.nebulaId, "sector-1-a");
    report.reproduced = true;
  } catch (error) {
    report.reproduced = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(output, JSON.stringify(report));
    console.log(JSON.stringify({ output, reproduced: report.reproduced, rows: report.rows.map((r) => ({
      rotation: r.rotation, accessSources: r.accessSources, first: r.firstChoices[0].target,
      second: r.secondChoices.find((a) => a.target?.nebulaId)?.target,
    })), error: report.error }));
  }
}
