"use strict";
// 从真实检查点派生单一规则边界fixture；不代表历史盘面发生过此场景，不运行AI。
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const req = require("node:module").createRequire(process.cwd() + "/adhoc/turing-pass.js");
const { createSimulationEnv } = req("../randomizer/app/simulation-env");
const base = "/Users/bilibili/code/seti-simu/reports/iteration/";
const output = base + "turing-pass-consumption-v2-20260908.json";
if (fs.existsSync(output)) { console.log(`已有checkpoint：${output}`); process.exit(0); }
const original = JSON.parse(fs.readFileSync(base + "blue50-expiry-baseline-20260908.json"));
const fixture = structuredClone(original.rootEnvelope);
const root = JSON.parse(fixture.committedState);
const blue = root.players.players.find(p => p.id === "player-blue");
blue.reservedCards.push({ id: "fixture-dlc33", cardId: "dlc_33.png", cardTypeCode: 1, faceUp: true });
// 使用已有正式探测器结构，仅改归属，构造普通上限已经满1艘的边界。
assert.equal(root.pieces.rockets.length, 1);
root.pieces.rockets[0].playerId = blue.id;
root.pieces.rockets[0].color = blue.color;
root.pieces.playerRocketSequences = { [blue.id]: [root.pieces.rockets[0].playerSequence] };
fixture.committedState = JSON.stringify(root);
const report = { passed: false, codeHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  scope: "真实根派生规则fixture：新增DLC33保留牌、把已有探测器改属蓝方；其他状态保留。不执行AI，不作为历史轨迹/分数/性能证据。",
  fixture, cases: [] };
let env, fork;
function state() {
  const inspection = fork.inspect();
  return inspection.session?.workingState || JSON.parse(fork.lifecycle.save().envelope.committedState);
}
function fact() {
  const s = state(), p = s.players.players.find(p => p.id === blue.id);
  return { borrow: p.industryBorrowedTechTileId || null,
    probes: s.pieces.rockets.filter(r => r.playerId === blue.id && r.surface === "solar-board").length,
    reserved: p.reservedCards.some(c => c.id === "fixture-dlc33"),
    completedTaskCount: p.completedTaskCount,
    actor: s.turn.currentPlayerId, round: s.turn.roundNumber, turn: s.turn.turnNumber };
}
function submit(predicate, label, trace) {
  const inspection = fork.inspect(), d = inspection.session?.decision;
  const choices = inspection.phase === "awaiting_input" ? d.choices : fork.inputPort.enumerateActions();
  const matches = choices.filter(predicate);
  assert.equal(matches.length, 1, `${label}: ${JSON.stringify(choices.map(c => ({ family: c.family, target: c.target })))}`);
  const action = matches[0], before = fact();
  const result = action.phase === "conditional"
    ? fork.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: action })
    : fork.inputPort.submitAction(action);
  assert.equal(result.ok, true, JSON.stringify(result));
  trace.push({ label, action, before, after: fact() });
}
try {
  env = createSimulationEnv();
  env.reset(JSON.parse(fs.readFileSync("reports/iteration/data-root-53-aaaed8d0-20260907.json")).root.config);
  for (const borrow of [false, true]) {
    fork = env.createCounterfactualFork(fixture).composition;
    const row = { borrow, trace: [] }; report.cases.push(row);
    if (borrow) {
      submit(a => a.family === "industry" && a.target.abilityId === "turing_borrow_tech", "启用图灵", row.trace);
      submit(a => a.target?.tileId === "orange1", "借橙1", row.trace);
    }
    submit(a => a.family === "pass", "PASS", row.trace);
    let accepted = false;
    for (let i = 0; i < 20 && fork.inspect().phase === "awaiting_input"; i++) {
      const choices = fork.inspect().session.decision.choices;
      if (choices.some(a => a.target?.ruleId === "dlc33-pass-launch")) {
        row.beforeReward = fact();
        submit(a => a.target?.ruleId === "dlc33-pass-launch", "接受DLC33发射", row.trace);
        accepted = true;
      } else {
        assert.ok(choices.every(a => a.target?.kind === "pass-reserve-card"), "只允许无关PASS预留牌选择：" + JSON.stringify(choices));
        const id = [...choices].sort((a,b) => a.actionId.localeCompare(b.actionId))[0].actionId;
        submit(a => a.actionId === id, "固定选择首张PASS预留牌", row.trace);
      }
    }
    assert.equal(accepted, true);
    assert.notEqual(fork.inspect().phase, "awaiting_input");
    row.final = fact();
    assert.equal(row.beforeReward.borrow, borrow ? "orange1" : null);
    assert.equal(row.final.probes, borrow ? 2 : 1);
    assert.equal(row.final.borrow, null);
    assert.equal(row.final.reserved, false, "唯一触发槽消费后牌正式移出保留区");
    assert.equal(row.final.completedTaskCount, blue.completedTaskCount + 1);
    fork.dispose(); fork = null;
  }
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  fork?.dispose(); env?.dispose();
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ passed: report.passed, error: report.error, cases: report.cases.map(c => ({ borrow: c.borrow, beforeReward: c.beforeReward, final: c.final })), output }, null, 2));
}
