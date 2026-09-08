"use strict";
// 正式借用后的目录差分诊断；只读既有根，不运行AI或伪造未来事件。
const fs = require("node:fs"), assert = require("node:assert/strict");
const req = require("node:module").createRequire(process.cwd() + "/adhoc/turing-directory.js");
const { createSimulationRuleComposition } = req("../randomizer/game/production-kernel");
const { createSeededRandom, RNG_ALGORITHM } = req("../randomizer/game/random");
const scan = req("../randomizer/game/actions/scan-effects");
const rocket = req("../randomizer/game/abilities/rocket");
const base = "/Users/bilibili/code/seti-simu/reports/iteration/";
const output = base + "turing-directory-delta-81ee9ed6-20260908.json";
if (fs.existsSync(output)) { console.log(`已有checkpoint：${output}`); process.exit(0); }
const envelope = JSON.parse(fs.readFileSync(base + "blue50-expiry-baseline-20260908.json")).rootEnvelope;
const initial = JSON.parse(envelope.committedState);
const report = { passed: false, codeHead: require("node:child_process").execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  scope: "第50步既有根及其正式发射后状态；不运行AI，不作为完整搜索或降分归因证据", cases: [] };
let composition;
function restore() {
  composition?.dispose();
  const random = createSeededRandom(initial.meta.seed);
  composition = createSimulationRuleComposition({ seed: initial.meta.seed, activePlayerCount: 4, random,
    rngState: { algorithm: RNG_ALGORITHM, state: random.getState() } }).composition;
  assert.equal(composition.lifecycle.restore(envelope, { silent: true }).ok, true);
}
function submit(predicate, label, actions) {
  const d = composition.inspect().session?.decision;
  const choices = d?.choices || composition.inputPort.enumerateActions();
  const matches = choices.filter(predicate);
  assert.equal(matches.length, 1, `${label}: ${JSON.stringify(choices)}`);
  const action = matches[0];
  const result = action.phase === "conditional"
    ? composition.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: action })
    : composition.inputPort.submitAction(action);
  assert.equal(result.ok, true, JSON.stringify(result));
  actions.push(action);
}
function facts() {
  const before = composition.lifecycle.save().envelope;
  const projected = composition.projection({ playerId: "player-blue", role: "player" }).state;
  const state = JSON.parse(before.committedState);
  const player = state.players.players.find(p => p.id === "player-blue");
  const context = { ...state, state };
  const result = {
    probes: state.pieces.rockets.filter(r => r.playerId === player.id && r.surface === "solar-board").length,
    rocketLimit: rocket.getRocketLimitForPlayer(player, context),
    probe: projected.probeRouteRequirements,
    sector: projected.sectorWinRequirements,
    fullScanTypes: scan.buildScanEffectQueue(player, { turn: state.turn, fullScanAction: true }).map(e => e.type),
  };
  assert.ok(result.probe && result.sector, "正式投影必须包含两个需求目录");
  assert.deepEqual(composition.lifecycle.save().envelope, before, "读取目录/能力不得修改状态");
  return result;
}
try {
  for (const launched of [false, true]) {
    restore();
    const setup = [];
    if (launched) submit(a => a.family === "launch", "正式发射", setup);
    const before = facts();
    submit(a => a.family === "industry" && a.target?.abilityId === "turing_borrow_tech", "启用图灵", setup);
    const tiles = composition.inspect().session.decision.choices.map(a => a.target.tileId);
    for (const tile of tiles) {
      restore();
      const actions = [];
      if (launched) submit(a => a.family === "launch", "正式发射", actions);
      submit(a => a.family === "industry" && a.target?.abilityId === "turing_borrow_tech", "启用图灵", actions);
      submit(a => a.target?.tileId === tile, "正式借科技", actions);
      const after = facts();
      const same = key => JSON.stringify(before[key]) === JSON.stringify(after[key]);
      report.cases.push({ launched, tile, actions, before, after,
        probeDirectoryEqual: same("probe"), sectorDirectoryEqual: same("sector"), scanTypesEqual: same("fullScanTypes") });
    }
  }
  const orange1 = report.cases.find(c => c.launched && c.tile === "orange1");
  assert.ok(orange1);
  assert.equal(orange1.before.probes, 1);
  assert.equal(orange1.after.rocketLimit, orange1.before.rocketLimit + 1);
  assert.equal(orange1.probeDirectoryEqual, true, "能力增加但当前单船目录不变");
  const purple4 = report.cases.find(c => !c.launched && c.tile === "purple4");
  assert.ok(purple4);
  assert.equal(purple4.sectorDirectoryEqual, true);
  assert.equal(purple4.scanTypesEqual, false, "扇区目录不变但整次扫描新增实际能力");
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  composition?.dispose();
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ passed: report.passed, error: report.error, output,
    cases: report.cases.map(c => ({ launched: c.launched, tile: c.tile, probeEqual: c.probeDirectoryEqual,
      sectorEqual: c.sectorDirectoryEqual, scanTypesEqual: c.scanTypesEqual,
      limitBefore: c.before.rocketLimit, limitAfter: c.after.rocketLimit })) }, null, 2));
}
