"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const req = require("node:module").createRequire(process.cwd() + "/adhoc/turing-launch.js");
const { createSimulationRuleComposition } = req("../randomizer/game/production-kernel");
const { createSeededRandom, RNG_ALGORITHM } = req("../randomizer/game/random");
const base = "/Users/bilibili/code/seti-simu/reports/iteration/";
const output = base + "turing-launch-consumption-81ee9ed6-20260908.json";
if (fs.existsSync(output)) { console.log(`已有checkpoint：${output}`); process.exit(0); }
const fixture = structuredClone(JSON.parse(fs.readFileSync(base + "blue50-expiry-baseline-20260908.json")).rootEnvelope);
const root = JSON.parse(fixture.committedState), actorId = "player-blue";
const player = root.players.players.find(p => p.id === actorId);
player.hand.push({ id: "fixture-b37", cardId: "b_37.webp", cardTypeCode: 0, faceUp: true });
player.resources.handSize = player.hand.length;
fixture.committedState = JSON.stringify(root);
const report = { passed: false, fixture, cases: [],
  codeHead: require("node:child_process").execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  scope: "既有第50步根派生规则fixture：增加b37，不运行AI；检查launch事件是否足以证明橙1消费，不作为历史得分或性能证据" };
let composition;
function submit(predicate, actions) {
  const d = composition.inspect().session?.decision;
  const choices = d?.choices || composition.inputPort.enumerateActions();
  const matches = choices.filter(predicate);
  assert.equal(matches.length, 1, JSON.stringify(choices));
  const a = matches[0];
  const result = a.phase === "conditional"
    ? composition.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: a })
    : composition.inputPort.submitAction(a);
  assert.equal(result.ok, true, JSON.stringify(result));
  actions.push(a);
  return result;
}
try {
  for (const borrow of [false, true]) {
    const random = createSeededRandom(root.meta.seed);
    composition = createSimulationRuleComposition({ seed: root.meta.seed, activePlayerCount: 4, random,
      rngState: { algorithm: RNG_ALGORITHM, state: random.getState() } }).composition;
    assert.equal(composition.lifecycle.restore(fixture, { silent: true }).ok, true);
    const actions = [];
    if (borrow) {
      submit(a => a.family === "industry" && a.target?.abilityId === "turing_borrow_tech", actions);
      submit(a => a.target?.tileId === "orange1", actions);
    }
    const result = submit(a => a.family === "play_card" && a.target?.cardInstanceId === "fixture-b37", actions);
    assert.equal(composition.inspect().phase, "idle");
    const after = composition.lifecycle.save().envelope;
    const state = JSON.parse(after.committedState), p = state.players.players.find(p => p.id === actorId);
    const launches = result.journal.events.filter(e => e.type === "launch" && e.playerId === actorId);
    assert.equal(launches.length, 2);
    report.cases.push({ borrow, actions, after, launches, history: result.journal.history,
      outcome: { pieces: state.pieces, resources: p.resources, hand: p.hand, rng: state.meta.rngState } });
    composition.dispose(); composition = null;
  }
  assert.deepEqual(report.cases[0].outcome, report.cases[1].outcome,
    "忽略上限的两次发射：借橙1不得改变探测器、资源、手牌或RNG结果");
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  composition?.dispose();
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ passed: report.passed, error: report.error, output,
    cases: report.cases.map(c => ({ borrow: c.borrow, launches: c.launches })) }, null, 2));
}
