// 只汇总已有证据，不重新搜索或重跑完整局。
const fs = require('node:fs'), assert = require('node:assert/strict'), zlib = require('node:zlib');
const output = 'reports/iteration/identity-attribution-20260908.json';
if (fs.existsSync(output)) { console.log('已有汇总：' + output); process.exit(0); }
function read(file) {
  return JSON.parse(fs.existsSync(file) ? fs.readFileSync(file) : zlib.gunzipSync(fs.readFileSync(file + '.gz')));
}
const files = [
  'identity-green-cross-baseline-candidate', 'identity-green-cross-baseline-identity',
  'identity-green-cross-candidate-candidate', 'identity-green-cross-candidate-identity',
  'identity-blue-cross-baseline-candidate', 'identity-blue-cross-baseline-identity',
];
const crossed = files.map(name => {
  const file = `reports/iteration/${name}-20260908.json`, r = read(file);
  assert.equal(r.passed, true); assert.deepEqual(r.errors, []);
  const c = r.captures[0];
  return { file: file + '.gz', board: r.board, policy: r.policy, commit: r.commit, step: r.decisionStep,
    seat: r.seat, chosen: c.chosen, roots: c.ranked.filter(x => x.evaluation.selectable).map(x => ({
      action: x.action, score: x.evaluation.score, leaf: x.evaluation.selectedLeafId,
      terminalReason: x.leaf?.terminalReason, plan: x.leaf?.planSteps?.map(s => s.action),
    })) };
});
const runs = ['95016f07.438305b4.full.json', '362fa7f3.0b01af15.full.json'].map(name => {
  const file = 'reports/research/' + name, r = read(file), bySeat = {};
  for (const s of r.metrics.searches) {
    const key = s.seat + '/' + s.kind;
    const a = bySeat[key] ||= { count: 0, nodes: 0, searchMs: 0 };
    a.count++; a.nodes += s.diagnostics.executedNodeCount; a.searchMs += s.diagnostics.totalMilliseconds;
  }
  return { file, bySeat, wallMs: r.wallMs };
});
const borrow = read('reports/iteration/blue-borrow-expiry-20260908.json');
assert.equal(borrow.passed, true);
for (const o of borrow.orders) {
  assert.ok(Number.isInteger(o.state.turn.roundNumber));
  assert.ok(Number.isInteger(o.state.turn.turnNumber));
  const p = o.state.players.players.find(p => p.id === 'player-blue');
  assert.equal(p.industryBorrowedTechTileId, null);
  assert.equal(p.industryBorrowedTechRound, 0);
  assert.equal(p.industryBorrowedTechTurn, 0);
}
const report = { date: '2026-09-08', scope: '同盘面交叉及正式输入对照；不外推完整终局48分的因果',
  crossed, runs, borrow: { file: 'reports/iteration/blue-borrow-expiry-20260908.json', differences: borrow.differences,
    conclusion: '借用后立刻结束回合未改变资源、得分或科技；借用字段正式清零，保留公司初始化字段和版本差异。新旧计划都有此行为。' },
  findings: [
    '绿方旧盘面两种搜索均选填数据80；新盘面两种搜索均选研究科技，填数据均28。盘面变化触发本次改选，未证明身份合并直接删掉填数方案。',
    '整局前76步一致，77步蓝方新计划额外借用紫2后结束回合；该动作来自第49步计划，并非77步重新搜索。',
    '第49步同根两版均打同一张牌，但旧获胜计划85，新95.5；后续路径不同。无收益借用不能单独解释后续盘面或整局损失。',
    '战略搜索次数白+7、蓝+9、棕+4、绿-3，总计+17；耗时需区分调用次数和单次成本，不能把所有增加归为去重恢复成本。',
  ], unresolved: ['绿方新盘面为何使填数长链不可达及其对终局的贡献', '白蓝更多重搜的具体计划失效原因', '身份规范恢复开销与展开路径变化的耗时分解'],
};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, captures: crossed.length, runs: runs.map(r => ({ file: r.file, bySeat: r.bySeat })) }));
