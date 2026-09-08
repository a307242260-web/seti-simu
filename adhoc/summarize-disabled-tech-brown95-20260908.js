// 只读第95步两次完整冷搜索，重估旧计划确认第127步改选原因。
const fs = require('node:fs'), assert = require('node:assert/strict');
const { isDeepStrictEqual } = require('node:util');
const output = 'reports/iteration/disabled-tech-brown95-summary-20260908.json';
if (fs.existsSync(output)) { console.log('已有第95步汇总：' + output); process.exit(0); }
const baseline = JSON.parse(fs.readFileSync('reports/iteration/disabled-tech-brown95-baseline-baseline-20260908.json'));
const fixed = JSON.parse(fs.readFileSync('reports/iteration/disabled-tech-brown95-baseline-fixed-20260908.json'));
for (const r of [baseline, fixed]) {
  assert.equal(r.passed, true); assert.equal(r.diagnostics.executedNodeCount, 239);
  assert.equal(r.diagnostics.executionLimitReached, false); assert.equal(r.diagnostics.beamPrunedOriginCount, 0);
  assert.ok(r.captures[0].snapshot.plan.executionSteps.every(s => s.valid));
}
const before = baseline.captures[0].ranked.find(x => x.action.family === 'research_tech');
const after = fixed.captures[0].ranked.find(x => x.action.family === 'research_tech');
const source = '/private/tmp/seti-disabled-tech-value-20260908/randomizer/game/ai/';
const outcome = require(source + 'outcome-model'), evaluator = require(source + 'expected-score-evaluator');
const seatId = 'player-brown';
const rootObservation = outcome.createDecisionObservation(baseline.captures[0].snapshot.rootObservation, { seatId });
const leaf = { ...before.leaf, observation: outcome.createDecisionObservation(before.leaf.observation, { seatId }) };
const rescored = evaluator.evaluateOutcome({ seatId, actionOutcomes: [{ schemaVersion: outcome.OUTCOME_SCHEMA_VERSION,
  actionId: before.action.actionId, status: 'settled', rootObservation, leaves: [leaf],
}] }, before.action);
assert.ok(Math.abs(rescored.score - 15.5) < 1e-9);
assert.ok(after.evaluation.score > rescored.score);
const row = x => ({ score: x.evaluation.score, actual: x.evaluation.actualScoreDelta,
  techValue: x.evaluation.techValue, incomeValue: x.evaluation.incomeValue,
  publicityValue: x.evaluation.publicityResearchValue, steps: x.leaf.planSteps.map(s => s.action),
  disabled: x.leaf.observation.publicState.players.find(p => p.playerId === seatId).techState.disabledTiles });
const report = { baseline: row(before), fixed: row(after), oldPlanRescored: { score: rescored.score,
  techValue: rescored.techValue, incomeValue: rescored.incomeValue, actual: rescored.actualScoreDelta },
  samePhysicalClassification: isDeepStrictEqual(baseline.diagnostics.executedNodeCountByDecisionKind,
    fixed.diagnostics.executedNodeCountByDecisionKind), nodes: [239, 239], executionCaps: [false, false], beam: [0, 0],
  conclusion: '旧计划紫4失效仍同时计30科技+18收入−2.5宣传机会=45.5；修复后该计划15.5，保留紫4计划27.5更高。第127步不换收入符合修复排序预期，不是预算截断。此单点不证明全局33分下降因果，也不证明每轮科技估值10合理。' };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, old: before.evaluation.score, oldRescored: rescored.score,
  fixed: after.evaluation.score, samePhysicalClassification: report.samePhysicalClassification }));
