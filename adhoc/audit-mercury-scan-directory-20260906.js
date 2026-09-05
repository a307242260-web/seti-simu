"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const solar = require("../randomizer/solar-system/core");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/mercury-scan-directory-audit-20260906.json";
if (fs.existsSync(output)) {
  console.log(`已有记录，未重跑：${output}`);
} else {
  const checkpoint = JSON.parse(fs.readFileSync("reports/iteration/r3-brown-before-171-20260906.json"));
  const state = JSON.parse(checkpoint.coreState.committedState);
  const player = state.players.players.find((p) => p.id === "player-brown");
  // 隔离规则输入：不是实际历史盘面；消除公共牌扫描来源以让水星来源可区分。
  player.techState.ownedTiles.purple2 = true;
  state.tech.stacks.purple2.remaining -= 1;
  player.resources.energy = 3;
  player.resources.publicity = 3;
  state.solarSystem = solar.createBaselineState();
  state.cards.discardPile.push(...state.cards.publicCards.filter(Boolean));
  state.cards.publicCards = [];
  delete checkpoint.replaySteps;
  checkpoint.coreState.committedState = JSON.stringify(state);
  checkpoint.coreState.compositionEnvelope.committedState = checkpoint.coreState.committedState;
  const env = createSimulationEnv();
  const report = { createdAt: new Date().toISOString(),
    scope: "独立隔离规则输入：棕方持紫2、3能量/3宣传、基准旋转、公共牌移至弃牌堆；非历史轨迹，不执行AI搜索",
    checkpoint, actions: [] };
  try {
    env.loadCheckpoint(checkpoint);
    const observation = env.observe();
    const mercury = solar.collectPlanetLocations(state.solarSystem).find((p) => p.planetId === "mercury");
    report.mercurySector = solar.getNebulaAtCoordinate(mercury.x, 5, state.solarSystem.sectorBySlot).id;
    report.accessSources = observation.sectorWinRequirements.accessSources;
    const scan = env.legalActions().find((a) => a.family === "scan");
    assert.ok(scan);
    assert.equal(env.step(scan).ok, true);
    report.actions.push(scan);
    for (let guard = 0; guard < 20; guard += 1) {
      const actions = env.legalActions();
      const mercuryChoice = actions.find((a) => a.target?.nebulaId === report.mercurySector);
      if (mercuryChoice) {
        report.formalMercuryChoice = mercuryChoice;
        report.beforeMercury = env.observe();
        assert.equal(env.step(mercuryChoice).ok, true);
        report.afterMercury = env.observe();
        break;
      }
      const choice = actions.find((a) => a.family === "choose_target" && a.target?.nebulaId);
      if (!choice) { report.stoppedLegal = actions; break; }
      assert.equal(env.step(choice).ok, true);
      report.actions.push(choice);
    }
    assert.ok(report.formalMercuryChoice, "必须走到正式水星扫描选择并成功提交");
    report.directoryIncludesMercury = report.accessSources.some((s) => s.sectorIds.includes(report.mercurySector));
    report.discrepancyReproduced = !report.directoryIncludesMercury;
    assert.equal(report.discrepancyReproduced, true, "原目录遗漏必须复现，不能仅凭源码猜测");
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    env.dispose();
    fs.writeFileSync(output, JSON.stringify(report));
    console.log(JSON.stringify({ output, passed: report.passed, mercurySector: report.mercurySector,
      accessSources: report.accessSources, formalChoice: report.formalMercuryChoice,
      stoppedLegal: report.stoppedLegal, discrepancy: report.discrepancyReproduced,
      error: report.error }, null, 2));
  }
}
