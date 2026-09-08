"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const req = require("node:module").createRequire(process.cwd() + "/adhoc/quick-move.js");
const { createSimulationRuleComposition } = req("../randomizer/game/production-kernel");
const { createSeededRandom, RNG_ALGORITHM } = req("../randomizer/game/random");
const rocket = req("../randomizer/game/abilities/rocket");
const base = "/Users/bilibili/code/seti-simu/reports/iteration/";
const output = base + "quick-move-events-v3-81ee9ed6-20260908.json";
if (fs.existsSync(output)) { console.log(`已有checkpoint：${output}`); process.exit(0); }
const report = { reproduced: false, cases: [], scope: "真实第50步派生正式规则fixture，不运行AI" };
let composition;
try {
  const fixture = structuredClone(JSON.parse(fs.readFileSync(base + "blue50-expiry-baseline-20260908.json")).rootEnvelope);
  const root = JSON.parse(fixture.committedState), actorId = "player-blue";
  const actor = root.players.players.find(p => p.id === actorId);
  const cardIndex = root.cards.publicCards.findIndex(c => c?.cardId === "b_2.webp");
  assert.ok(cardIndex >= 0);
  actor.reservedCards.push(root.cards.publicCards.splice(cardIndex, 1)[0]);
  assert.equal(root.pieces.rockets.length, 1);
  root.pieces.rockets[0].playerId = actorId;
  root.pieces.rockets[0].color = actor.color;
  root.pieces.playerRocketSequences = { [actorId]: [root.pieces.rockets[0].playerSequence] };
  fixture.committedState = JSON.stringify(root); report.fixture = fixture;
  const random = createSeededRandom(root.meta.seed);
  composition = createSimulationRuleComposition({ seed: root.meta.seed, activePlayerCount: 4, random,
    rngState: { algorithm: RNG_ALGORITHM, state: random.getState() } }).composition;
  const restored = composition.lifecycle.restore(fixture, { silent: true });
  assert.equal(restored.ok, true, JSON.stringify(restored));
  const actions = composition.inputPort.enumerateActions();
  const trades = actions.filter(a => a.family === "quick_trade" && a.target?.tradeId === "energy-for-move");
  assert.equal(trades.length, 1, JSON.stringify(actions.filter(a => a.family === "quick_trade")));
  const begun = composition.inputPort.submitAction(trades[0]); assert.equal(begun.ok, true);
  const pending = composition.lifecycle.save().envelope;
  const choices = composition.inspect().session.decision.choices;
  assert.ok(choices.length > 0);
  for (const action of choices) {
    assert.equal(composition.lifecycle.restore(pending, { silent: true }).ok, true);
    const inspection = composition.inspect(), d = inspection.session.decision;
    const state = structuredClone(pending.session.session.workingState);
    const expected = rocket.moveProbe(state, { rocketId: Number(action.target.rocketId),
      deltaX: Number(action.target.deltaX), deltaY: Number(action.target.deltaY),
      movementPoints: 1, cost: {}, source: "quick_move" });
    assert.equal(expected.ok, true);
    const actual = composition.inputPort.submitDecision({ decisionId: d.decisionId,
      decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: action });
    assert.equal(actual.ok, true);
    const events = actual.journal.events;
    const missing = expected.events.filter(e => !events.some(a => JSON.stringify(a) === JSON.stringify(e)));
    report.cases.push({ action, expectedEvents: expected.events, actualEvents: events, missing,
      nextDecision: composition.inspect().session?.decision || null });
  }
  assert.ok(report.cases.every(c => c.missing.some(e => e.type === "move")));
  report.reproduced = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  composition?.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, reproduced: report.reproduced, error: report.error,
    cases: report.cases.map(c => ({ direction: c.action.target.direction,
      missing: c.missing.map(e => e.type), nextDecision: c.nextDecision?.choices })) }, null, 2));
}
