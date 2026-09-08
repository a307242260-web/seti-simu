// 仅计算7张已登记模型的设计算例，不接入AI。两种扫描口径并列，不把待确认项写成生产值。
const fs = require('node:fs'), assert = require('node:assert/strict');
const output = 'reports/iteration/round5-card-value-examples-20260909.json';
if (fs.existsSync(output)) { console.log('已有卡牌算例：' + output); process.exit(0); }
const inputs = require('../reports/iteration/round5-card-value-inputs-20260908.json');
const evaluator = require('../randomizer/game/ai/expected-score-evaluator');
const rocket = require('../randomizer/game/abilities/rocket'), scan = require('../randomizer/game/abilities/scan');
const effects = require('../randomizer/game/cards/effects'), deck = require('../randomizer/game/cards/deck');
const byId = new Map(inputs.models.map(c => [c.cardId, c]));
const units = evaluator.RESOURCE_UNIT_VALUES;
function resourceValue(gain) {
  return Object.entries(gain).reduce((sum, [key, n]) => {
    assert.ok(Object.hasOwn(units, key), '算例未知资源：' + key);
    assert.ok(Number.isFinite(n)); return sum + n * units[key];
  }, 0);
}
function cornerValue(cardId) {
  const c = byId.get(cardId), r = deck.DISCARD_ACTION_REWARDS[c.discardCode] || deck.DISCARD_ACTION_MOVE_REWARDS[c.discardCode];
  assert.ok(r); return resourceValue(r.gain || {}) + (r.dataCount || 0) * units.availableData + (r.movementPoints || 0) * units.movement;
}
const publicFixture = ['b_3.webp', 'b_16.webp', 'b_69.webp'];
const bestPublicCorner = Math.max(...publicFixture.map(cornerValue));
function valueEffect(e, includesData) {
  const o = e.options || {};
  switch (e.type) {
    case 'gain_resources': return resourceValue(o.gain);
    case 'gain_data': return o.count * units.availableData;
    case 'card_free_move': case 'card_move': return o.movementPoints * units.movement;
    case 'card_scan_color_choice': case 'card_any_sector_scan': case 'card_scan_nebula':
      return (o.repeat || 1) * ((includesData ? 7 - units.availableData : 7) + (o.gainData === false ? 0 : units.availableData));
    case 'card_scan_action':
      assert.equal(o.skipCost, true); return resourceValue(scan.SCAN_COST);
    case 'launch':
      assert.equal(o.skipCost, true); return resourceValue(rocket.DEFAULT_LAUNCH_COST);
    case 'draw_cards': case 'pick_card': return o.count * units.ordinaryCard;
    case 'card_pick_card_corner_reward':
      assert.equal(o.allowBlindDraw, false); return units.ordinaryCard + bestPublicCorner;
    default: throw new Error('超出明确算例范围，不以0估值：' + e.type);
  }
}
const ids = ['b_2.webp', 'b_3.webp', 'b_9.webp', 'b_16.webp', 'b_48.webp', 'b_69.webp', 'b_83.webp'];
const variants = [true, false].map(includesData => ({ scan7IncludesData: includesData,
  examples: ids.map(id => {
    const c = byId.get(id), m = effects.getCardModel(id);
    assert.equal(m.endGameScoring, undefined);
    const immediate = (m.playEffects || []).reduce((sum, e) => sum + valueEffect(e, includesData), 0);
    // 本组只有b2使用3个一次性触发槽，逐槽半值；不外推任意重复事件的触发次数。
    if (m.triggers) { assert.equal(id, 'b_2.webp'); assert.equal(m.triggers.length, 3); }
    if (m.tasks) { assert.equal(id, 'b_83.webp'); assert.equal(m.tasks.length, 1); assert.deepEqual(m.tasks[0].condition, { type: 'handEmpty' }); }
    const deferred = ((m.triggers || []).reduce((sum, t) => sum + valueEffect(t.effect, includesData), 0)
      + (m.tasks || []).reduce((sum, t) => sum + t.rewards.reduce((n, e) => n + valueEffect(e, includesData), 0), 0)) * 0.5;
    const cost = effects.getCardPlayCost({ cardId: id, price: c.price });
    const resourceCost = resourceValue(cost), cardCost = units.ordinaryCard;
    return { id, name: c.name, immediate, deferred, cost, resourceCost, cardCost, net: immediate + deferred - resourceCost - cardCost };
  }) }));
for (const v of variants) {
  assert.equal(v.examples.find(c => c.id === 'b_69.webp').net, 4);
  assert.equal(v.examples.find(c => c.id === 'b_48.webp').net, bestPublicCorner - 10);
  assert.equal(v.examples.find(c => c.id === 'b_2.webp').net, -6.5);
}
const report = { scope: '设计敏感性算例，不是182牌生产估值或性能验收',
  assumptions: ['使用第一轮名义单位；标准行动为无公司/科技减免的基础费用',
    '拨款只针对明确公开的三牌算例取最佳角标，不读取未知牌；不是全目录平均角标模型',
    'b83还有空手牌精选1张的任务，远期计3；首版无任务断言拒绝了漏算，补齐后再生成本检查点',
    '扫描7是否含数据仍待用户确认，两种口径均保留；正式搜索未改'],
  units, standardLaunch: rocket.DEFAULT_LAUNCH_COST, standardScan: scan.SCAN_COST,
  publicFixture: publicFixture.map(id => ({ id, cornerValue: cornerValue(id) })), bestPublicCorner, variants, passed: true };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, passed: true, variants: variants.map(v => ({ includesData: v.scan7IncludesData,
  values: v.examples.map(c => ({ name: c.name, net: c.net })) })) }));
