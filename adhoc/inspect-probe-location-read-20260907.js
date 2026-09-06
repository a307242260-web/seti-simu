"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const play = require("../randomizer/game/cards/play-domain"), solar = require("../randomizer/solar-system/core");
const output = "reports/iteration/probe-location-read-20260907.json";
if (fs.existsSync(output)) console.log(`已有位置读模型证据：${output}`);
else {
  const env = createSimulationEnv(), report = { scope: "真实42检查点与已正式执行到火星的位置输入，比较卡牌正式位置读模型与盘面；不运行AI，不改变生产状态", cases: [] };
  let fork;
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
    delete cp.replaySteps; env.loadCheckpoint(cp); fork = env.createCounterfactualFork().composition;
    const root = fork.projection({ role: "simulation" }).state;
    const arrivals = JSON.parse(fs.readFileSync("reports/iteration/company-arrivals-42-v2-20260907.json"));
    const mars = arrivals.cases.find(c => c.events.some(e => e.type === "visitPlanet" && e.planetId === "mars"));
    assert.ok(mars);
    const inputs = [{ label: "真实42根位置", root }, { label: "已保存的正式火星到达位置", root: {
      ...root, pieces: { ...root.pieces, rockets: root.pieces.rockets.map(r => r.id === mars.rocket.id ? mars.rocket : r) },
    } }];
    for (const input of inputs) {
      const before = JSON.stringify(input.root), observed = play.buildProbeLocationData(input.root);
      assert.equal(JSON.stringify(input.root), before, "读取不改变输入值");
      report.cases.push({ label: input.label, observed,
        board: input.root.pieces.rockets.map(r => ({ rocketId: r.id, playerId: r.playerId,
          x: r.sectorX, y: r.sectorY,
          content: solar.resolveVisibleContent(r.sectorX, r.sectorY, input.root.solarSystem).content })),
      });
    }
    report.reproduced = report.cases[1].board.some(r => r.content.planetId === "mars")
      && report.cases[1].observed.details.every(d => d.planetId === null && d.locationType === "solar" && !("distanceFromEarth" in d));
    assert.equal(report.reproduced, true);
  } catch (error) { report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally { fork?.dispose(); env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2)); }
}
