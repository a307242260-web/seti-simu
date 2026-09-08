"use strict";
const fs = require('node:fs'), assert = require('node:assert/strict');
const { createSimulationRuleComposition } = require('../randomizer/game/production-kernel');
const { createSeededRandom, RNG_ALGORITHM } = require('../randomizer/game/random');
const cards = require('../randomizer/game/cards/deck');
const effects = require('../randomizer/game/cards/effects');
const domain = require('../randomizer/game/cards/play-domain');
const solar = require('../randomizer/solar-system/core');
const windowCase = process.argv.includes('--window');
const cardId = windowCase ? 'b_87.webp' : 'b_98.webp';
const effectType = windowCase ? effects.EFFECT_TYPES.EARTH_SECTOR_CONTENT_MOVE : effects.EFFECT_TYPES.COUNT_HAND_CORNER_MOVE;
const output = windowCase ? 'reports/iteration/counted-card-move-window-reproduction-20260909.json'
  : 'reports/iteration/counted-card-move-reproduction-20260909.json';
if (fs.existsSync(output)) { console.log('已有检查点：' + output); process.exit(0); }
const source = 'reports/iteration/blue50-expiry-baseline-20260908.json';
const report = { source, cardId, scope: '真实存档派生的正式打牌fixture；替换手牌以隔离数量，不运行AI', cases: [] };
for (const count of (windowCase ? [0] : [0, 2])) {
  const envelope = structuredClone(JSON.parse(fs.readFileSync(source, 'utf8')).rootEnvelope);
  const root = JSON.parse(envelope.committedState);
  const actor = root.players.players.find(p => p.id === 'player-blue');
  const ids = [cardId, ...cards.CARD_CATALOG
    .filter(c => c.discard_action_code === 2).slice(0, count).map(c => c.card_id)];
  actor.hand = ids.map(id => cards.createCommittedCardInstance(root, cards.CARD_CATALOG.find(c => c.card_id === id)));
  actor.resources.handSize = actor.hand.length;
  const snapshot = solar.createSolarSnapshot(root.solarSystem);
  const earth = snapshot.planetLocations.find(p => p.planetId === 'earth');
  assert.ok(earth);
  const countedContents = snapshot.visibleContents.filter(c => c.x === earth.x
    && (c.content.kind === 'comet' || c.content.kind === 'planet' && c.content.planetId !== 'earth'));
  const expectedCount = windowCase ? countedContents.length
    : actor.hand.slice(1).filter(c => c.discardActionCode === 2).length;
  assert.equal(expectedCount, windowCase ? 2 : count, '夹具数量必须与正式内容/角标一致');
  envelope.committedState = JSON.stringify(root);
  const random = createSeededRandom(root.meta.seed);
  const composition = createSimulationRuleComposition({ seed: root.meta.seed, activePlayerCount: 4, random,
    rngState: { algorithm: RNG_ALGORITHM, state: random.getState() } }).composition;
  try {
    const restored = composition.lifecycle.restore(envelope, { silent: true });
    assert.equal(restored.ok, true, JSON.stringify(restored));
    const action = composition.inputPort.enumerateActions().find(a => a.family === 'play_card'
      && a.target.cardInstanceId === actor.hand[0].id);
    assert.ok(action, '必须通过正式合法打牌入口');
    const begun = composition.inputPort.submitAction(action);
    assert.equal(begun.ok, true, JSON.stringify(begun));
    const inputs = [action];
    let captured = null;
    for (let i = 0; i < 12; i++) {
      const inspection = composition.inspect();
      const effect = inspection.session?.currentEffect;
      if (effect?.payload?.cardEffect?.type === effectType) {
        captured = { effect, choices: inspection.session.decision.choices,
          allowance: domain.getMovementAllowance(effect) };
        break;
      }
      const d = inspection.session?.decision;
      assert.ok(d?.choices?.length, '在到达移动阶段前不应结束或缺少选择');
      assert.ok(d.choices.every(c => String(c.target?.choiceId).startsWith('launch:')),
        '夹具只允许额外选择正式发射位置：' + JSON.stringify(d.choices));
      const choice = d.choices[0];
      const submitted = composition.inputPort.submitDecision({ decisionId: d.decisionId,
        decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice });
      assert.equal(submitted.ok, true, JSON.stringify(submitted));
      inputs.push(choice);
    }
    assert.ok(captured, '必须真正到达数量移动Decision');
    report.cases.push({ expectedCount, ...(windowCase ? { earth, countedContents } : {}), inputs, ...captured });
  } finally { composition.dispose(); }
}
report.reproduced = report.cases.every(c => c.allowance === 1 && c.allowance !== c.expectedCount);
assert.equal(report.reproduced, true, '当前版本应复现数量不为1却固定给1移动');
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, reproduced: report.reproduced,
  cases: report.cases.map(c => ({ expected: c.expectedCount, actual: c.allowance })) }));
