"use strict";
// 只读诊断：已有536旧计划研究橙3后的状态，逐项正式借用→结束回合，对照直接结束。
const fs = require("node:fs"), assert = require("node:assert/strict");
const req = require("node:module").createRequire(process.cwd() + "/adhoc/expiry.js");
const { createSimulationEnv } = req("../randomizer/app/simulation-env");
const base = "/Users/bilibili/code/seti-simu/reports/iteration/";
const output = base + "turing-immediate-expiry-20260908.json";
if (fs.existsSync(output)) { console.log(`已有checkpoint：${output}`); process.exit(0); }
const report = { passed: false, cases: [] };
let env, fork;
function act(action) {
  const d = fork.inspect().session?.decision;
  const result = action.phase === "conditional"
    ? fork.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion,
      ownerId: d.ownerId, choice: action }) : fork.inputPort.submitAction(action);
  assert.equal(result.ok, true);
  if (action.family === "end_turn") assert.equal(fork.counterfactualPort.advanceFocalPlanningTurn("player-blue").ok, true);
}
function legal() {
  const s = fork.inspect();
  return s.phase === "awaiting_input" ? s.session.decision.choices : fork.inputPort.enumerateActions();
}
function differences(a, b, path = "", out = []) {
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  if (a && b && typeof a === "object" && typeof b === "object") {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) differences(a[key], b[key], `${path}.${key}`, out);
  } else out.push({ path, direct: a ?? null, borrowed: b ?? null });
  return out;
}
try {
  const old = JSON.parse(fs.readFileSync(base + "blue536-turing-baseline-20260908.json"));
  env = createSimulationEnv();
  env.reset(JSON.parse(fs.readFileSync("reports/iteration/data-root-53-aaaed8d0-20260907.json")).root.config);
  fork = env.createCounterfactualFork(old.rootEnvelope).composition;
  for (const step of old.leaf.planSteps.slice(0, 12)) {
    const action = legal().find(a => a.actionId === step.action.actionId); assert.ok(action); act(action);
  }
  const root = fork.lifecycle.save().envelope;
  report.rootEnvelope = root;
  act(legal().find(a => a.family === "end_turn"));
  const direct = JSON.parse(fork.lifecycle.save().envelope.committedState);
  const directObservation = fork.projection({ playerId: "player-blue", role: "player" }).state;
  assert.equal(fork.lifecycle.restore(root, { silent: true }).ok, true);
  act(legal().find(a => a.target?.abilityId === "turing_borrow_tech"));
  const tiles = legal().map(a => a.target.tileId);
  for (const tile of tiles) {
    assert.equal(fork.lifecycle.restore(root, { silent: true }).ok, true);
    act(legal().find(a => a.target?.abilityId === "turing_borrow_tech"));
    act(legal().find(a => a.target?.tileId === tile));
    act(legal().find(a => a.family === "end_turn"));
    const after = JSON.parse(fork.lifecycle.save().envelope.committedState);
    const observation = fork.projection({ playerId: "player-blue", role: "player" }).state;
    const rootDiff = differences(direct, after);
    const p = after.players.players.find(p => p.id === "player-blue");
    assert.equal(p.industryBorrowedTechTileId, null, "回合结束正式清除借用能力");
    for (const key of ["probeRouteRequirements", "sectorWinRequirements", "dataAnalyzeRequirements",
      "incomeGainRequirements", "techGainRequirements"]) assert.deepEqual(observation[key], directObservation[key], key);
    report.cases.push({ tile, rootDiff, directoriesEqual: true });
  }
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  fork?.dispose(); env?.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, passed: report.passed, error: report.error, cases: report.cases }, null, 2));
}
