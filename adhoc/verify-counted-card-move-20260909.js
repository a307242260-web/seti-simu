"use strict";
const fs = require('node:fs'), assert = require('node:assert/strict');
const { createSimulationRuleComposition } = require('../randomizer/game/production-kernel');
const { createSeededRandom, RNG_ALGORITHM } = require('../randomizer/game/random');
const cards = require('../randomizer/game/cards/deck');
const domain = require('../randomizer/game/cards/play-domain');
const source = '/Users/bilibili/code/seti-simu/reports/iteration/blue50-expiry-baseline-20260908.json';
const output = 'reports/iteration/counted-card-move-verification-20260909.json';
if (fs.existsSync(output)) { console.log('已有检查点：' + output); process.exit(0); }
const report = { source, scope: '正式打牌与移动生命周期，无AI全局搜索', cases: [] };
for (const spec of [{ id: 'b_98.webp', hand: 0, points: 0 },
  { id: 'b_98.webp', hand: 2, points: 2 }, { id: 'b_87.webp', hand: 0, points: 2 },
  { id: 'b_77.webp', hand: 0, points: 1 }]) {
  const envelope = structuredClone(JSON.parse(fs.readFileSync(source, 'utf8')).rootEnvelope);
  const root = JSON.parse(envelope.committedState), actorId = 'player-blue';
  const actor = root.players.players.find(p => p.id === actorId);
  const ids = [spec.id, ...cards.CARD_CATALOG.filter(c => c.discard_action_code === 2)
    .slice(0, spec.hand).map(c => c.card_id)];
  actor.hand = ids.map(id => cards.createCommittedCardInstance(root, cards.CARD_CATALOG.find(c => c.card_id === id)));
  actor.resources.handSize = actor.hand.length;
  envelope.committedState = JSON.stringify(root);
  const random = createSeededRandom(root.meta.seed);
  const composition = createSimulationRuleComposition({ seed: root.meta.seed, activePlayerCount: 4, random,
    rngState: { algorithm: RNG_ALGORITHM, state: random.getState() } }).composition;
  const evidence = { ...spec, inputs: [], allowances: [], restoreChecks: 0, rejectedOwner: false };
  const submit = (choice, d) => {
    const result = d ? composition.inputPort.submitDecision({ decisionId: d.decisionId,
      decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice }) : composition.inputPort.submitAction(choice);
    assert.equal(result.ok, true, JSON.stringify(result)); evidence.inputs.push(choice);
    return result;
  };
  try {
    const restored = composition.lifecycle.restore(envelope, { silent: true });
    assert.equal(restored.ok, true, JSON.stringify(restored));
    const action = composition.inputPort.enumerateActions().find(a => a.family === 'play_card'
      && a.target.cardInstanceId === actor.hand[0].id);
    assert.ok(action); submit(action);
    let moved = 0;
    for (let i = 0; i < 20; i++) {
      const inspection = composition.inspect(), d = inspection.session?.decision;
      if (!d) break;
      const effect = inspection.session.currentEffect;
      if (!String(effect?.payload?.cardEffect?.type).includes('move')) {
        assert.ok(d.choices.every(c => String(c.target?.choiceId).startsWith('launch:')),
          '仅允许前序发射：' + JSON.stringify(d.choices));
        submit(d.choices[0], d); continue;
      }
      const allowance = domain.getMovementAllowance(effect);
      assert.equal(allowance, spec.points - moved);
      assert.equal(effect.payload.remaining, allowance, '首次Decision已冻结额度');
      evidence.allowances.push(allowance);
      const projection = composition.projection({ playerId: actorId, role: 'player' });
      const movement = projection.state.probeRouteRequirements.movementContext;
      assert.equal(movement.cardRemaining, allowance);
      const saved = composition.lifecycle.save().envelope;
      assert.equal(composition.lifecycle.restore(saved, { silent: true }).ok, true);
      assert.deepEqual(composition.inspect(), inspection);
      evidence.restoreChecks++;
      const choice = d.choices.find(c => c.payload?.requiredMovePoints === 1 && !c.target.skip);
      assert.ok(choice, '夹具需有单点正式移动');
      const rejected = composition.inputPort.submitDecision({ decisionId: d.decisionId,
        decisionVersion: d.decisionVersion, ownerId: 'player-white', choice });
      assert.equal(rejected.ok, false); assert.deepEqual(composition.lifecycle.save().envelope, saved);
      evidence.rejectedOwner = true;
      submit(choice, d); moved++;
    }
    assert.equal(moved, spec.points);
    assert.equal(composition.inspect().session?.decision ?? null, null);
    assert.deepEqual(evidence.allowances, Array.from({ length: spec.points }, (_, i) => spec.points - i));
    evidence.passed = true; report.cases.push(evidence);
  } finally { composition.dispose(); }
}
report.passed = true;
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, passed: true, cases: report.cases.map(c => ({ id: c.id, points: c.points,
  allowances: c.allowances, restored: c.restoreChecks })) }));
