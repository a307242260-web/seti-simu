// 复核第五轮正式模型未漂移，并补齐不以独立effect.type出现的后续奖励/返回条件。
const fs = require('node:fs'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const output = 'reports/iteration/round5-valuation-closure-20260909.json';
if (fs.existsSync(output)) { console.log('已有估值闭包复核：' + output); process.exit(0); }
const old = require('../reports/iteration/round5-card-value-inputs-20260908.json');
const effects = require('../randomizer/game/cards/effects');
const isolated = require('/private/tmp/seti-route-leaf-eligibility-20260909/randomizer/game/cards/effects');
const embeddedNames = new Set(['afterResearchReward', 'afterTraceReward', 'afterLandRewards', 'returnToHandIfSignalCount', 'requireCondition']);
const embedded = [], optionCatalog = {}, counts = {}, serializationOmissions = [];
function inspectSerialization(value, path) {
  assert.notEqual(typeof value, 'function', 'JSON不能完整记录动态函数：' + path);
  if (value === undefined) { serializationOmissions.push(path); return; }
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) inspectSerialization(child, path + '.' + key);
}
for (const card of old.models) {
  const model = effects.getCardModel(card.cardId);
  inspectSerialization(model, card.cardId);
  assert.deepEqual(JSON.parse(JSON.stringify(model)), card.model, 'dev模型的JSON契约相对已登记输入发生变化：' + card.cardId);
  assert.deepEqual(isolated.getCardModel(card.cardId), model, '隔离候选与dev模型不同：' + card.cardId);
}
for (const [type, group] of Object.entries(old.effectTypes)) {
  const options = new Set(); counts[type] = group.instances.length;
  for (const instance of group.instances) {
    for (const [key, value] of Object.entries(instance.effect.options || {})) {
      options.add(key);
      if (embeddedNames.has(key)) embedded.push({ cardId: instance.cardId, parentType: type,
        path: instance.path + '.options.' + key, timing: instance.timing, option: key, value });
    }
  }
  optionCatalog[type] = [...options].sort();
}
assert.equal(old.models.length, 182); assert.equal(Object.keys(optionCatalog).length, 48);
assert.equal(embedded.length, 8);
const report = { scope: '模型一致性与估值设计输入完整性，不是生产估值实现或效果验收',
  source: 'round5-card-value-inputs-20260908.json',
  modelDigest: crypto.createHash('sha256').update(JSON.stringify(old.models.map(m => m.model))).digest('hex'),
  modelCount: old.models.length, effectTypeCount: 48, counts, optionCatalog, embedded, serializationOmissions,
  notes: [
    'afterLandRewards内嵌effect已在48种计数中出现：应由父结算应用目标条件，只计一次，不能又独立加一遍。',
    'afterResearchReward/afterTraceReward的kind不是独立effect.type，必须单独复用正式结算语义。',
    'returnToHandIfSignalCount与requireCondition分别影响牌成本返还和能力可用性，不可当展示字段忽略。',
    '182模型当前dev与ad676add活对象一致；既有checkpoint是JSON，省略的undefined属性逐项列在serializationOmissions，不把省略误报为语义变动。',
    '最初直接用活对象与JSON深比较，b29的可选afterLandRewards=undefined导致断言失败；未生成checkpoint。已改为分别比较活对象与序列化契约，不改规则、不吞生产异常。'
  ], passed: true };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, passed: true, modelCount: report.modelCount, effectTypeCount: 48, embedded: embedded.length, modelDigest: report.modelDigest }));
