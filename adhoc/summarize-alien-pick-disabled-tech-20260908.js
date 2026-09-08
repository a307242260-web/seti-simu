// 读取第186步已缓存的组合交叉，不进行新搜索或整局。
const fs = require('node:fs'), assert = require('node:assert/strict');
const output = 'reports/iteration/alien-pick-disabled-tech-single-20260908.json';
if (fs.existsSync(output)) { console.log('已有组合总结：' + output); process.exit(0); }
const rows = [];
for (const [board, policy] of [['baseline', 'baseline'], ['baseline', 'candidate'], ['baseline', 'fixed'],
  ['baseline', 'combined'], ['candidate', 'combined']]) {
  const file = `reports/iteration/alien-pick-brown-cross-${board}-${policy}-20260908.json`;
  const r = JSON.parse(fs.readFileSync(file)), d = r.diagnostics;
  assert.equal(r.passed, true); assert.deepEqual(d.failedNodeCountByCode, {});
  const scored = r.captures[0].ranked.filter(x => ['orbit', 'research_tech'].includes(x.action.family));
  const row = { board, policy, file, chosen: r.captures[0].chosen.family, searchMs: r.searchMs,
    nodes: d.executedNodeCount, executionLimitReached: d.executionLimitReached,
    beamPrunedOrigins: d.beamPrunedOriginCount,
    alienPickNodes: Object.entries(d.executedNodeCountByDecisionKind).filter(([k]) => k.includes('effect=residual_alien_card_decision'))
      .reduce((sum, [, n]) => sum + n, 0),
    scores: Object.fromEntries(scored.map(x => [x.action.family, x.evaluation.score])) };
  if (policy === 'combined') {
    assert.ok(r.searchMs < 30000); assert.equal(d.maxExecutionNodes, 4096); assert.equal(d.maxFrontierNodes, 256);
    assert.ok(r.captures[0].snapshot.plan.executionSteps.every(s => s.valid));
    assert.equal(row.chosen, 'orbit');
    const best = scored.find(x => x.action.family === 'orbit');
    row.tech = best.leaf.observation.publicState.players.find(p => p.playerId === 'player-brown').techState;
    assert.equal(row.tech.ownedTiles.purple2, true); assert.notEqual(row.tech.disabledTiles.purple2, true);
    row.chosenPlan = best.leaf.planSteps.map(s => s.action);
    row.scoreParts = { actual: best.evaluation.actualScoreDelta, tech: best.evaluation.techValue,
      income: best.evaluation.incomeValue, publicity: best.evaluation.publicityResearchValue };
  }
  rows.push(row);
}
assert.deepEqual(rows[3].scores, rows[4].scores);
const report = { rows, localCorrectnessPassed: true, fullGameRun: false,
  conclusion: '组合在两盘面均选环绕37.8333、研究30，优胜链保留有效紫2，不再选择虚增科技收益路线。拿牌310→151；总4096仍截断，原盘面队列裁剪来源5223→4204。没有完整局成绩，不将单点改选等同于恢复棕方14分或独立修复33分损失。' };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, rows: rows.map(({ chosenPlan, tech, ...r }) => r), localCorrectnessPassed: true }));
