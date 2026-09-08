const fs = require('node:fs'), assert = require('node:assert/strict');
const output = 'reports/iteration/white327-cross-summary-20260908.json';
if (fs.existsSync(output)) { console.log('已有交叉汇总：' + output); process.exit(0); }
const read = p => JSON.parse(fs.readFileSync(p));
const baseline = read('reports/iteration/combined-white327-baseline-20260908.json');
const combined = read('reports/iteration/combined-white327-combined-20260908.json');
const boundary = read('reports/iteration/combined-white327-plan-boundary-20260908.json');
for (const r of [baseline, combined]) {
  assert.equal(r.passed, true); assert.equal(r.diagnostics.executedNodeCount, 4096);
  assert.deepEqual(r.diagnostics.failedNodeCountByCode, {});
}
const winner = r => r.captures[0].ranked.find(x => x.action.family === 'launch');
const old = winner(baseline), current = winner(combined);
assert.deepEqual(old.leaf.planSteps.map(s => s.action), current.leaf.planSteps.map(s => s.action));
assert.equal(old.evaluation.score, current.evaluation.score);
assert.equal(boundary.passed, true); assert.equal(boundary.firstMiss.step, 341);
const check = boundary.checks.at(-1), before = check.expected.dependencies[0].fact;
const after = check.facts.routes.filter(x => x.targetId === 'orbit:venus:planet:' && x.sourceId === 'rocket:8');
assert.deepEqual(before.map(({ markers, ...rest }) => rest), after.map(({ markers, ...rest }) => rest));
assert.equal(before[0].markers, 3); assert.equal(after[0].markers, 4);
const rewards = require('../randomizer/game/actions/planet-rewards');
const rewardBefore = rewards.buildOrbitRewardEffects('venus', 4), rewardAfter = rewards.buildOrbitRewardEffects('venus', 5);
assert.deepEqual(rewardBefore, rewardAfter);
function pointEvents(file) {
  const raw = read('reports/research/' + file), save = read(raw.savePath);
  let score = 0; const events = [], byRound = {};
  for (const step of save.replaySteps) {
    const next = step.after.p['player-brown'][0], delta = next - score; score = next;
    if (!delta) continue;
    byRound[step.after.r] = (byRound[step.after.r] || 0) + delta;
    events.push({ step: step.stepIndex + 1, round: step.after.r, delta, actor: step.actorPlayerId, action: step.action });
  }
  return { file, byRound, events, total: score };
}
const report = { sameWinningActions: true, winnerScore: current.evaluation.score,
  winnerActions: current.leaf.planSteps.map(s => s.action),
  searches: [baseline, combined].map(r => ({ policy: r.policy, searchMs: r.searchMs,
    nodes: r.diagnostics.executedNodeCount, beamPrunedOriginCount: r.diagnostics.beamPrunedOriginCount,
    families: r.diagnostics.executedNodeCountByDecisionKind })),
  firstMiss: boundary.firstMiss, routeBefore: before, routeAfter: after, rewardBefore, rewardAfter,
  brownPoints: { baseline: pointEvents('c43c1f88.70043d34.full.json'), combined: pointEvents('80437cef.5d17835f.full.json') },
  conclusion: '同盘面两版同40输入获胜计划；341首次失效只因蓝方331新增金星环绕标记，路线与标准奖励未变。是保守依赖重搜证据，不代表完整计划所有后续依赖不变。旧等额奖励方案有后续目标事实变化教训，不能无条件恢复旧方案。过程分事件为算术拆分，非完整策略因果。' };
assert.equal(report.winnerActions.length, 40);
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, firstMiss: report.firstMiss, sameWinningActions: true,
  winnerScore: report.winnerScore, brownRoundPoints: Object.fromEntries(Object.entries(report.brownPoints).map(([k,v])=>[k,v.byRound])) }));
