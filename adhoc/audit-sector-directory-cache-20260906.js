"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const solar = require("../randomizer/solar-system/core");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/sector-directory-cache-audit-20260906.json";
if (fs.existsSync(output)) {
  console.log(`已有记录，未重跑：${output}`);
} else {
  const checkpoint = JSON.parse(fs.readFileSync("reports/iteration/mercury-scan-directory-audit-20260906.json")).checkpoint;
  const base = JSON.parse(checkpoint.coreState.committedState);
  const actor = base.players.players.find((p) => p.id === "player-brown");
  delete actor.techState.ownedTiles.purple2;
  base.tech.stacks.purple2.remaining += 1;
  base.meta.gameId = `${base.meta.gameId}:sector-cache-audit`;
  const report = { createdAt: new Date().toISOString(),
    scope: "隔离同gameId/数据/科技/手牌，仅改变轮盘位置的冷热缓存对照；不运行AI搜索",
    rows: [] };
  function inspect(state, label) {
    const input = structuredClone(checkpoint);
    input.coreState.committedState = JSON.stringify(state);
    input.coreState.compositionEnvelope.committedState = input.coreState.committedState;
    const env = createSimulationEnv();
    try {
      env.loadCheckpoint(input);
      const observed = env.observe().sectorWinRequirements;
      const earth = solar.collectPlanetLocations(state.solarSystem).find((p) => p.planetId === "earth");
      const expected = solar.getNebulaAtCoordinate(earth.x, 5, state.solarSystem.sectorBySlot).id;
      const row = { label, expected, actual: observed.accessSources[0].sectorIds, input };
      report.rows.push(row);
      return row;
    } finally { env.dispose(); }
  }
  try {
    const first = inspect(base, "原始位置");
    assert.deepEqual(first.actual, [first.expected]);
    const rotated = structuredClone(base);
    rotated.solarSystem.rotation.wheel1Steps = 2;
    const warm = inspect(rotated, "同gameId旋转后");
    const cold = structuredClone(rotated);
    cold.meta.gameId += ":cold";
    const fresh = inspect(cold, "相同旋转位置新gameId");
    assert.notEqual(warm.expected, first.expected);
    assert.deepEqual(warm.actual, first.actual, "复现同键错误保留旧地球扫描范围");
    assert.deepEqual(fresh.actual, [fresh.expected], "相同规则盘面冷计算应匹配正式位置");
    report.discrepancyReproduced = true;
  } catch (error) {
    report.discrepancyReproduced = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(output, JSON.stringify(report));
    console.log(JSON.stringify({ output, reproduced: report.discrepancyReproduced,
      rows: report.rows.map(({ input, ...row }) => row), error: report.error }, null, 2));
  }
}
