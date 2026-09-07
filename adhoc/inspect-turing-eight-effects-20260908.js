"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const req = require("node:module").createRequire(process.cwd() + "/adhoc/turing-eight.js");
const { createSimulationEnv } = req("../randomizer/app/simulation-env");
const base = "/Users/bilibili/code/seti-simu/reports/iteration/";
const output = base + "turing-eight-effects-native-20260908.json";
if (fs.existsSync(output)) { console.log(`已有checkpoint：${output}`); process.exit(0); }
const report = { passed: false, codeHead: require("node:child_process").execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), cases: [] };
let env;
try {
  const config = JSON.parse(fs.readFileSync("reports/iteration/data-root-53-aaaed8d0-20260907.json")).root.config;
  const root = JSON.parse(fs.readFileSync(base + "blue161-borrowed-cache-fixed-20260908.json")).rootEnvelope;
  env = createSimulationEnv(); env.reset(config);
  const checkpoint = env.createCheckpoint();
  checkpoint.coreState.committedState = root.committedState;
  checkpoint.coreState.compositionEnvelope = root;
  delete checkpoint.replaySteps;
  function restore() { env.loadCheckpoint(checkpoint); }
  function project() { return env.observe("player-blue"); }
  function actions() { return env.legalActions().filter(a => a.family !== "industry")
    .map(a => ({ family: a.family, phase: a.phase, target: a.target, payload: a.payload })); }
  restore();
  const before = project(), beforeActions = actions(), original = JSON.parse(root.committedState);
  const player = original.players.players.find(p => p.id === "player-blue");
  report.activeOwned = Object.keys(player.techState.ownedTiles).filter(t => !player.techState.disabledTiles[t]);
  report.before = { probe: before.probeRouteRequirements, sector: before.sectorWinRequirements };
  assert.ok(report.before.probe); assert.ok(report.before.sector);
  for (const tile of ["orange1", "orange2", "orange3", "orange4", "purple1", "purple2", "purple3", "purple4"]) {
    restore();
    const started = performance.now();
    const ability = env.legalActions().find(a => a.family === "industry" && a.target.abilityId === "turing_borrow_tech");
    assert.ok(ability); assert.equal(env.step(ability).ok, true);
    const choice = env.legalActions().find(a => a.target.tileId === tile); assert.ok(choice);
    assert.equal(env.step(choice).ok, true);
    const after = project(), afterActions = actions();
    const state = JSON.parse(env.createCheckpoint().coreState.committedState);
    const changedPlayers = state.players.players.flatMap(p => {
      const old = original.players.players.find(q => q.id === p.id);
      return Object.keys(p).filter(k => JSON.stringify(old[k]) !== JSON.stringify(p[k])).map(k => ({ playerId: p.id, field: k, before: old[k], after: p[k] }));
    });
    const sameProbe = JSON.stringify(before.probeRouteRequirements) === JSON.stringify(after.probeRouteRequirements);
    const sameSector = JSON.stringify(before.sectorWinRequirements) === JSON.stringify(after.sectorWinRequirements);
    const sameLegalExceptCompany = JSON.stringify(beforeActions) === JSON.stringify(afterActions);
    const result = { tile, ms: performance.now() - started, alreadyActive: report.activeOwned.includes(tile),
      sameProbe, sameSector, sameLegalExceptCompany, changedPlayers,
      probe: after.probeRouteRequirements, sector: after.sectorWinRequirements,
      otherStateChanges: Object.keys(state).filter(k => k !== "players" && JSON.stringify(state[k]) !== JSON.stringify(original[k])) };
    if (result.alreadyActive) {
      assert.equal(sameProbe, true); assert.equal(sameSector, true); assert.equal(sameLegalExceptCompany, true);
      assert.ok(changedPlayers.every(c => c.playerId === "player-blue" && ["industryRoundMarkRound", "industryRoundMarkTurn", "industryBorrowedTechTileId", "industryBorrowedTechRound", "industryBorrowedTechTurn"].includes(c.field)));
      assert.deepEqual(result.otherStateChanges, ["meta"]);
      const a = { ...state.meta }, b = { ...original.meta }; delete a.stateVersion; delete b.stateVersion;
      assert.deepEqual(a, b, "RNG和实体序号不得因重复能力变化");
    }
    report.cases.push(result);
    console.log(JSON.stringify({ tile, alreadyActive: result.alreadyActive, sameProbe, sameSector, sameLegalExceptCompany, ms: result.ms }));
  }
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally { env?.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n"); console.log(JSON.stringify({ output, passed: report.passed, error: report.error })); }
