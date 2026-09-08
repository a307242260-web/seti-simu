// 从已完成的正式重放提取中间收益；不重复执行实验。
const fs = require('node:fs'), assert = require('node:assert/strict');
const output = 'reports/iteration/data-preparation-footprint-20260908.json';
if (fs.existsSync(output)) { console.log('已有检查：' + output); process.exit(0); }
const evidence = JSON.parse(fs.readFileSync('reports/iteration/known-data-preparation-v2-20260908.json'));
assert.equal(evidence.passed, true);
const v = evidence.variants.find(v => v.discard), before = v.afterIncome, after = v.beforeScan;
assert.equal(before.dataState.placedTokens.length, 4); assert.equal(after.dataState.placedTokens.length, 5);
assert.ok(before.hand.some(c => c.id === 'card-15-0'));
assert.deepEqual(after.hand, before.hand.filter(c => c.id !== 'card-15-0'));
const { hand: beforeHand, dataState: beforeData, resources: beforeResources, ...beforeOther } = before;
const { hand: afterHand, dataState: afterData, resources: afterResources, ...afterOther } = after;
assert.deepEqual(afterOther, beforeOther);
assert.deepEqual(afterResources, { ...beforeResources, handSize: beforeResources.handSize - 1 });
assert.deepEqual(afterData, { ...beforeData, placedTokens: [...beforeData.placedTokens, afterData.placedTokens.at(-1)] });
assert.equal(afterData.placedTokens.at(-1).placementSlot, 5);
const report = { source: 'known-data-preparation-v2-20260908.json', passed: true,
  scope: '第24步已知DLC9角标至填5格的玩家完整字段；不含公共牌堆、RNG或其他玩家，不能称全状态等价',
  effects: { removedCard: 'card-15-0', computerSlots: [4, 5], unchangedResourcesExceptHandSize: true,
    remainingPlayerFieldsUnchanged: true },
  constraints: ['第5格本身没有基础资源奖励，但可解锁蓝科技附加位，其他盘面需检查相关依赖',
    '标准扫描包含地球/公共牌等独立步骤；已无可取数据的扇区可追加标记而不获得数据，不能全局硬编码2数据'],
  ruleSources: ['randomizer/game/data/placement.js:COMPUTER_SLOT_BONUSES/BLUE_BONUS_REQUIRED_COMPUTER_SLOT',
    'randomizer/game/abilities/scan.js:placeNebulaToken', 'randomizer/game/effects/science-session.js:scanQueue/publicScanChoices'] };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, passed: true, effects: report.effects }));
