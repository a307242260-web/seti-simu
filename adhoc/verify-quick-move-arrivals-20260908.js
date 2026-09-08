"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const req = require("node:module").createRequire(process.cwd() + "/adhoc/arrivals.js");
const { createSimulationRuleComposition } = req("../randomizer/game/production-kernel");
const { createSeededRandom } = req("../randomizer/game/random");
const rocket = req("../randomizer/game/abilities/rocket");
const base = "/Users/bilibili/code/seti-simu/reports/iteration/";
const output = base + "quick-move-arrivals-c50e4f01-20260908.json";
if (fs.existsSync(output)) { console.log(`已有checkpoint：${output}`); process.exit(0); }
const report = { passed: false, cases: [] };
let composition;
try {
  const fixture = JSON.parse(fs.readFileSync(base + "quick-move-events-v3-81ee9ed6-20260908.json")).fixture;
  const seed = JSON.parse(fixture.committedState).meta.seed;
  composition = createSimulationRuleComposition({ seed, random: createSeededRandom(seed) }).composition;
  assert.equal(composition.lifecycle.restore(fixture).ok, true);
  const trade = composition.inputPort.enumerateActions().find(a => a.target?.tradeId === "energy-for-move");
  assert.ok(trade);
  assert.equal(composition.inputPort.submitAction(trade).ok, true);
  const pending = composition.lifecycle.save().envelope;
  const choices = composition.inspect().session.decision.choices;
  assert.equal(choices.length, 4);
  for (const action of choices) {
    assert.equal(composition.lifecycle.restore(pending).ok, true);
    const d = composition.inspect().session.decision;
    const expectedState = structuredClone(pending.session.session.workingState);
    const expected = rocket.moveProbe(expectedState, { rocketId: Number(action.target.rocketId),
      deltaX: Number(action.target.deltaX), deltaY: Number(action.target.deltaY),
      movementPoints: 1, cost: {}, source: "quick_move" });
    assert.equal(expected.ok, true);
    const actual = composition.inputPort.submitDecision({ decisionId: d.decisionId,
      decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: action });
    assert.equal(actual.ok, true);
    assert.equal(composition.inspect().phase, "idle");
    const after = JSON.parse(composition.lifecycle.save().envelope.committedState);
    assert.deepEqual(after.pieces, expectedState.pieces);
    for (const p of expectedState.players.players) {
      assert.deepEqual(after.players.players.find(a => a.id === p.id).resources, p.resources);
    }
    const events = actual.journal.events;
    for (const e of expected.events) {
      const matches = events.filter(a => a.type === e.type && a.rocketId === e.rocketId);
      assert.equal(matches.length, 1);
      for (const [key, value] of Object.entries(e)) assert.deepEqual(matches[0][key], value);
    }
    assert.equal(events.filter(e => e.type === "quick_move").length, 1);
    assert.deepEqual(events.map(e => e.type), ["quick_trade", ...expected.events.map(e => e.type), "quick_move"]);
    report.cases.push({ direction: action.target.direction, events, coordinatesAndResourcesEqual: true });
  }
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  composition?.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, passed: report.passed, error: report.error,
    cases: report.cases.map(c => ({ direction: c.direction, events: c.events.map(e => e.type) })) }, null, 2));
}
