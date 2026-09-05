"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/sector-directory-verification-20260906-v2.json";
if (fs.existsSync(output)) {
  console.log(`已有记录，未重跑：${output}`);
} else {
  const checkpoint = JSON.parse(fs.readFileSync("reports/iteration/mercury-scan-directory-audit-20260906.json")).checkpoint;
  const base = JSON.parse(checkpoint.coreState.committedState);
  const playerOf = (state) => state.players.players.find((p) => p.id === "player-brown");
  const player = playerOf(base);
  delete player.techState.ownedTiles.purple2;
  base.tech.stacks.purple2.remaining += 1;
  base.meta.gameId += ":verified-directory";
  const report = { createdAt: new Date().toISOString(), scope: "隔离规则输入的完整目录冷热一致性与正式水星支付验证，不运行AI搜索",
    sourceSha256: crypto.createHash("sha256").update(fs.readFileSync("randomizer/game/production-kernel.js")).digest("hex"), rows: [] };
  const cases = [
    ["baseline", () => {}],
    ["rotation", (s) => { s.solarSystem.rotation.wheel1Steps = 2; }],
    ["public-card", (s) => { s.cards.publicCards.push(s.cards.discardPile.pop()); }],
    ["purple2", (s) => { playerOf(s).techState.ownedTiles.purple2 = true; s.tech.stacks.purple2.remaining -= 1; }],
    ["borrow-active", (s) => { Object.assign(playerOf(s), { industryBorrowedTechTileId: "purple1", industryBorrowedTechRound: s.turn.roundNumber, industryBorrowedTechTurn: s.turn.turnNumber }); }],
    ["borrow-expired", (s) => { Object.assign(playerOf(s), { industryBorrowedTechTileId: "purple1", industryBorrowedTechRound: s.turn.roundNumber, industryBorrowedTechTurn: s.turn.turnNumber - 1 }); }],
    ["company-cost", (s) => { playerOf(s).initialSelection.industry = { id: "industry:异星实验室.png" }; }],
    ["company-panel-off", (s) => { playerOf(s).initialSelection.industry = { id: "industry:异星实验室.png" }; playerOf(s).industryAlienLabPanels = { yellow: false }; }],
  ];
  function createEnv(state) {
    const input = structuredClone(checkpoint);
    input.coreState.committedState = JSON.stringify(state);
    input.coreState.compositionEnvelope.committedState = input.coreState.committedState;
    const env = createSimulationEnv();
    try { env.loadCheckpoint(input); return env; }
    catch (error) { env.dispose(); throw error; }
  }
  function inspect(state) {
    const env = createEnv(state);
    try { return env.observe().sectorWinRequirements; }
    finally { env.dispose(); }
  }
  try {
    for (const [label, change] of cases) {
      const state = structuredClone(base);
      change(state);
      const warm = inspect(state);
      const cold = structuredClone(state);
      cold.meta.gameId += `:cold:${label}`;
      const fresh = inspect(cold);
      assert.deepEqual(warm, fresh, `${label}冷热完整目录应一致`);
      report.rows.push({ label, warm, fresh });
    }
    assert.notDeepEqual(report.rows[0].warm.accessSources, report.rows[1].warm.accessSources);
    assert.notDeepEqual(report.rows[0].warm.accessSources, report.rows[2].warm.accessSources);
    assert.notDeepEqual(report.rows[0].warm.accessSources, report.rows[4].warm.accessSources);
    assert.deepEqual(report.rows[0].warm.accessSources, report.rows[5].warm.accessSources);
    assert.deepEqual(report.rows[6].warm.standardScanCost, { energy: 2 });
    assert.deepEqual(report.rows[7].warm.standardScanCost, { credits: 1, energy: 2 });
    report.mercury = [];
    for (const publicity of [0, 3]) {
      const state = JSON.parse(checkpoint.coreState.committedState);
      state.meta.gameId += `:mercury:${publicity}`;
      playerOf(state).resources.publicity = publicity;
      const env = createEnv(state);
      try {
        const source = env.observe().sectorWinRequirements.accessSources[0];
        assert.ok(source.sectorIds.includes("sector-4-a"), "能力目录包含水星，不虚称即时可付费");
        assert.equal(env.step(env.legalActions().find((a) => a.family === "scan")).ok, true);
        assert.equal(env.step(env.legalActions().find((a) => a.target?.nebulaId === "sector-1-a")).ok, true);
        const choices = env.legalActions();
        const mercury = choices.find((a) => a.target?.nebulaId === "sector-4-a");
        assert.equal(Boolean(mercury), publicity > 0);
        if (mercury) assert.equal(env.step(mercury).ok, true);
        const after = env.observe().publicState.players.find((p) => p.playerId === "player-brown");
        assert.equal(after.publicity, publicity > 0 ? publicity - 1 : 0);
        report.mercury.push({ publicity, choices, after });
      } finally { env.dispose(); }
    }
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(output, JSON.stringify(report));
    console.log(JSON.stringify({ output, passed: report.passed, rows: report.rows.map((r) => ({ label: r.label, sources: r.warm.accessSources, cost: r.warm.standardScanCost })), error: report.error }, null, 2));
  }
}
