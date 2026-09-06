"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const play = require("../randomizer/game/cards/play-domain");
const solar = require("../randomizer/solar-system/core");
const rockets = require("../randomizer/game/rockets");
const cards = require("../randomizer/game/cards/effects");
const scoring = require("../randomizer/game/end-game-scoring");
const finalScoring = require("../randomizer/game/final-scoring");
const finalRead = require("../randomizer/game/final-read-model");
const { buildRuleObservation } = require("../randomizer/app/rule-observation");
const output = "reports/iteration/final-probe-location-reproduction-v2-20260907.json";
if (fs.existsSync(output)) console.log(`已有证据：${output}`);
else {
  const env = createSimulationEnv(), report = { scope: "基于真实42完整状态，受控加入b82保留牌并把一个已有探测器移到小行星，比较正式计分输入有无位置事实；不是历史终局重放，不运行AI" };
  let fork;
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
    delete cp.replaySteps; env.loadCheckpoint(cp); fork = env.createCounterfactualFork().composition;
    const root = structuredClone(fork.projection({ role: "simulation" }).state);
    const player = root.players.players.find(p => p.id === "player-green");
    const probe = root.pieces.rockets.find(r => r.playerId === player.id);
    const asteroid = solar.collectVisibleCoordinateContents(root.solarSystem).find(c => c.content.kind === "asteroid");
    assert.ok(probe && asteroid);
    rockets.assignRocketToSlot(probe, asteroid.x, asteroid.y, 0);
    player.reservedCards.push({ id: "diagnostic-b82", cardId: "b_82.webp", cardTypeCode: 3 });
    const locations = play.buildProbeLocationData(root);
    const context = { ...root, players: root.players.players, currentPlayer: player, cardEffects: cards,
      getCardTypeCode: c => cards.getRuntimeCardTypeCode(c, cards.getCardModel(c)?.cardType) };
    const without = scoring.computePlayerFinalScore({ ...context, finalScoring: structuredClone(root.finalScoring) }, player);
    const withLocations = scoring.computePlayerFinalScore({ ...context,
      probeLocations: locations.index, probeLocationDetails: locations.details }, player);
    const ui = finalRead.createFinalReadModelOwner({ finalScoring, endGameScoring: scoring, cardEffects: cards })
      .project(structuredClone(root)).players.find(p => p.id === player.id);
    const observation = buildRuleObservation(structuredClone(root), cp.seed, player.id);
    report.input = { playerId: player.id, probe: structuredClone(probe), card: player.reservedCards.at(-1), locations };
    report.without = without; report.withLocations = withLocations;
    report.browserBreakdown = ui.breakdown;
    report.observedPlayer = observation.publicState.players.find(p => p.playerId === player.id);
    assert.ok(report.observedPlayer, "必需的观察玩家不能缺失");
    assert.equal(report.observedPlayer.finalScore, without.totalScore);
    assert.equal(withLocations.cardScore - without.cardScore, 13);
    assert.equal(ui.breakdown.cardScore, without.cardScore);
    report.reproduced = true;
  } catch (error) { report.reproduced = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally { fork?.dispose(); env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, reproduced: report.reproduced, error: report.error })); }
}
