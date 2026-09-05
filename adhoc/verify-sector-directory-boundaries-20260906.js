"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const data = require("../randomizer/game/data");
const output = "reports/iteration/sector-directory-boundaries-20260906.json";
if (fs.existsSync(output)) {
  console.log(`已有记录，未重跑：${output}`);
} else {
  const checkpoint = JSON.parse(fs.readFileSync("reports/iteration/mercury-scan-directory-audit-20260906.json")).checkpoint;
  const state = JSON.parse(checkpoint.coreState.committedState);
  state.meta.gameId += ":directory-boundaries";
  const player = state.players.players.find((p) => p.id === "player-brown");
  const report = { createdAt: new Date().toISOString(), scope: "隔离规则输入：正式数据primitive改变竞争/结算后的目录等价，以及正式水星跳过；不运行AI搜索",
    sourceSha256: crypto.createHash("sha256").update(fs.readFileSync("randomizer/game/production-kernel.js")).digest("hex"), rows: [] };
  function createEnv(inputState) {
    const input = structuredClone(checkpoint);
    delete input.replaySteps;
    input.coreState.committedState = JSON.stringify(inputState);
    input.coreState.compositionEnvelope.committedState = input.coreState.committedState;
    const env = createSimulationEnv();
    try { env.loadCheckpoint(input); return env; }
    catch (error) { env.dispose(); throw error; }
  }
  function inspect(inputState) {
    const env = createEnv(inputState);
    try { return env.observe().sectorWinRequirements; }
    finally { env.dispose(); }
  }
  function compare(label) {
    const warm = inspect(state);
    const coldState = structuredClone(state);
    coldState.meta.gameId += `:cold:${label}`;
    const cold = inspect(coldState);
    assert.deepEqual(warm, cold);
    report.rows.push({ label, warm, cold });
    return warm;
  }
  try {
    const before = compare("before-data");
    assert.equal(data.replaceNextNebulaDataToken(state.data, "sector-1-a", player, { root: state }).ok, true);
    const marked = compare("after-mark");
    const candidate = (directory) => directory.candidates.find((c) => c.sectorId === "sector-1-a");
    assert.equal(candidate(marked).ownCount, candidate(before).ownCount + 1);
    assert.equal(candidate(marked).openSlotCount, candidate(before).openSlotCount - 1);
    while (data.getNextReplaceableNebulaToken(state.data, "sector-1-a")) {
      assert.equal(data.replaceNextNebulaDataToken(state.data, "sector-1-a", player, { root: state }).ok, true);
    }
    assert.equal(candidate(compare("filled-before-settle")), undefined);
    const settlement = data.settleSector(state.data, "sector-1-a", { root: state, players: state.players.players });
    assert.equal(settlement.ok, true);
    const settled = compare("after-settle");
    assert.equal(candidate(settled).nextSettlementNumber, candidate(before).nextSettlementNumber + 1);
    report.settlement = settlement;

    const scanState = JSON.parse(checkpoint.coreState.committedState);
    const env = createEnv(scanState);
    try {
      assert.equal(env.step(env.legalActions().find((a) => a.family === "scan")).ok, true);
      assert.equal(env.step(env.legalActions().find((a) => a.target?.nebulaId === "sector-1-a")).ok, true);
      const beforeSkip = env.observe();
      const choices = env.legalActions();
      assert.ok(choices.some((a) => a.target?.nebulaId === "sector-4-a"));
      const skip = choices.find((a) => a.target?.skip === true);
      assert.ok(skip);
      assert.equal(env.step(skip).ok, true);
      const afterSkip = env.observe();
      const resources = (observation) => observation.publicState.players.find((p) => p.playerId === "player-brown");
      assert.deepEqual(resources(beforeSkip), resources(afterSkip));
      assert.deepEqual(beforeSkip.sectorWinRequirements, afterSkip.sectorWinRequirements);
      report.skip = { choices, before: resources(beforeSkip), after: resources(afterSkip) };
    } finally { env.dispose(); }
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(output, JSON.stringify(report));
    console.log(JSON.stringify({ output, passed: report.passed, rows: report.rows.map((r) => r.label), error: report.error }));
  }
}
