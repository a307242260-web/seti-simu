// 复用既有正式重放状态，核对前置数据是否改变扫描支付与能力队列；不运行AI。
const fs = require('node:fs'), assert = require('node:assert/strict');
const scan = require('../randomizer/game/actions/scan-effects');
const placement = require('../randomizer/game/data/placement');
const output = 'reports/iteration/data-scan-dependencies-20260908.json';
if (fs.existsSync(output)) { console.log('已有依赖证据：' + output); process.exit(0); }
const source = 'reports/iteration/known-data-preparation-v2-20260908.json';
const r = JSON.parse(fs.readFileSync(source)); assert.equal(r.passed, true);
const [extra, direct] = r.variants;
const save = JSON.parse(fs.readFileSync('seti-saves/seti-save-research-grant-data-route-20260908-1501ebfd-full-v316.json'));
const context = save.replaySteps[22].after;
assert.equal(context.c, 'player-white');
const options = { roundNumber: context.r, turnNumber: context.t };
assert.equal(options.roundNumber, 1); assert.equal(options.turnNumber, 1);
const rows = [extra.afterIncome, extra.beforeScan, direct.beforeScan].map(player => ({
  resources: player.resources,
  cost: scan.getStandardScanCost(player),
  affordable: scan.canExecuteScan(player).ok,
  queue: scan.buildScanEffectQueue(player, options),
}));
assert.ok(rows.every(row => row.affordable));
for (const row of rows.slice(1)) {
  assert.deepEqual(row.cost, rows[0].cost);
  assert.deepEqual(row.queue, rows[0].queue);
}
const report = { source, scope: '第24步正式重放的白方状态，轮1回合1；支付与扫描能力队列核验，不外推所有公司/科技/触发奖励。',
  checks: rows, slot5Reward: placement.getComputerSlotBonus(5),
  blueSlot3Prerequisite: placement.getRequiredComputerSlotForBlueBonus(3),
  passed: true, conclusion: '本例在弃牌前已能支付扫描，弃牌并填5格未增加扫描能力；排除为了支付或扫描科技才先填5格的解释。蓝位解锁及任意触发依赖仍不能由本检查自动豁免。' };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, passed: report.passed, cost: rows[0].cost,
  queue: rows[0].queue.map(e => e.type), slot5Reward: report.slot5Reward }));
