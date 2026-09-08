// 第五轮设计输入审计：读取正式卡牌模型与既有完整局，不执行AI、不预测牌库。
const fs = require('node:fs'), assert = require('node:assert/strict'), cp = require('node:child_process');
const effects = require('../randomizer/game/cards/effects');
const cards = require('../randomizer/game/cards/deck');
const catalog = require('../assets/cards/card_model.json');
const output = 'reports/iteration/round5-card-value-inputs-20260908.json';
if (fs.existsSync(output)) { console.log('已有第五轮输入审计：' + output); process.exit(0); }
const source = 'reports/research/c43c1f88.70043d34.full.json';
const record = JSON.parse(fs.readFileSync(source));
const effectTypes = {}, endGameKinds = {}, models = [], functionValues = [];
function walk(value, cardId, path, timing) {
  if (typeof value === 'function') { functionValues.push({ cardId, path }); return; }
  if (!value || typeof value !== 'object') return;
  if (typeof value.type === 'string' && typeof value.id === 'string') {
    const entry = effectTypes[value.type] || (effectTypes[value.type] = { count: 0, cards: [], instances: [] });
    entry.count++;
    if (!entry.cards.includes(cardId)) entry.cards.push(cardId);
    entry.instances.push({ cardId, path, timing, effect: value });
  }
  for (const [key, child] of Object.entries(value)) walk(child, cardId, path + '.' + key, timing);
}
for (const card of catalog) {
  const model = effects.getCardModel(card.card_id);
  assert.ok(model, '缺少正式模型：' + card.card_id);
  for (const key of ['playEffects', 'triggers', 'tasks', 'temporaryTasks']) {
    walk(model[key], card.card_id, key, key === 'playEffects' ? 'immediate' : 'deferred');
  }
  if (model.endGameScoring) {
    const kind = model.endGameScoring.kind;
    assert.ok(kind);
    (endGameKinds[kind] || (endGameKinds[kind] = [])).push({ cardId: card.card_id, rule: model.endGameScoring });
  }
  models.push({ cardId: card.card_id, name: card.card_name, price: card.price,
    cardType: model.cardType, discardCode: card.discard_action_code, incomeCode: card.income_code,
    playCost: effects.getCardPlayCost({ cardId: card.card_id, price: card.price }),
    fields: Object.keys(model), model });
}
assert.deepEqual(functionValues, [], '模型有动态函数时不能把JSON枚举当作完整闭包');
const totals = {}, capped = {};
let nodes = 0, cappedNodes = 0;
for (const search of record.metrics.searches) {
  const d = search.diagnostics;
  nodes += d.executedNodeCount;
  if (d.executionLimitReached) cappedNodes += d.executedNodeCount;
  for (const [kind, count] of Object.entries(d.executedNodeCountByDecisionKind)) {
    if (!kind.startsWith('choose_card:')) continue;
    totals[kind] = (totals[kind] || 0) + count;
    if (d.executionLimitReached) capped[kind] = (capped[kind] || 0) + count;
  }
}
const sum = object => Object.values(object).reduce((a, b) => a + b, 0);
const units = { score: 1, credits: 10, energy: 8, ordinaryCard: 6, availableData: 6, movement: 5, publicity: 4 };
const cornerValue = code => {
  const reward = cards.DISCARD_ACTION_REWARDS[code] || cards.DISCARD_ACTION_MOVE_REWARDS[code];
  assert.ok(reward, '角标规则缺失：' + code);
  return Object.entries(reward.gain).reduce((total, [resource, amount]) => {
    assert.ok(Object.hasOwn(units, resource)); return total + units[resource] * amount;
  }, 0) + (reward.dataCount || 0) * units.availableData + (reward.movementPoints || 0) * units.movement;
};
const averageCorner = catalog.reduce((total, card) => total + cornerValue(card.discard_action_code), 0) / catalog.length;
const grant = models.find(card => card.cardId === 'b_48.webp');
const lowCostLaunch = models.find(card => card.cardId === 'b_69.webp');
assert.equal(grant.model.playEffects[0].type, 'card_pick_card_corner_reward');
assert.equal(lowCostLaunch.model.playEffects[0].type, 'launch');
const valueChecks = {
  grant: { name: grant.name, immediate: units.ordinaryCard + averageCorner,
    cost: grant.playCost.credits * units.credits + units.ordinaryCard,
    net: averageCorner - grant.playCost.credits * units.credits },
  lowCostLaunch: { name: lowCostLaunch.name, standardLaunchCredits: 2,
    immediate: 2 * units.credits, cost: lowCostLaunch.playCost.credits * units.credits + units.ordinaryCard,
    net: (2 - lowCostLaunch.playCost.credits) * units.credits - units.ordinaryCard },
};
assert.ok(valueChecks.grant.net < 0); assert.ok(valueChecks.lowCostLaunch.net > 0);
const result = { source, commit: cp.execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  scope: '182张普通/扩展卡的正式模型及全部嵌套效果；外星牌本期仍按平均12，不假装已逐牌建模。条件与事件不是收益节点。',
  modelCount: models.length, effectTypeCount: Object.keys(effectTypes).length, functionValues,
  effectTypes, endGameKinds, models,
  choices: { totalPhysicalNodes: nodes, totalChooseCardNodes: sum(totals), share: sum(totals) / nodes,
    executionCappedPhysicalNodes: cappedNodes, cappedChooseCardNodes: sum(capped),
    cappedShare: sum(capped) / cappedNodes, totals, capped,
    note: 'capped为实际执行上限截断子集，不包含旧记录未保存的beam裁剪；每个分类按物理节点计数。' },
  valueChecks, proposedAverageCornerValue: averageCorner,
  boundary: '这是设计输入和两个算例，不是生产估值器；复合效果、变动奖励基数、收入与支付选择闭包尚需逐项确定，不能以未支持类型默认0补齐。' };
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, modelCount: result.modelCount, effectTypeCount: result.effectTypeCount,
  chooseCardNodes: result.choices.totalChooseCardNodes, share: result.choices.share,
  endGameKinds: Object.keys(endGameKinds), valueChecks }));
