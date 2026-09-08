// 只读既有第24步来源日志；核验保留填数入口是否继续承载分析目标，不重跑搜索。
const fs = require('node:fs'), zlib = require('node:zlib'), assert = require('node:assert/strict');
const output = 'reports/iteration/quick-turn-goal-obligations-20260908.json';
if (fs.existsSync(output)) { console.log('已有证据：' + output); process.exit(0); }
const baselinePath = 'reports/iteration/step24-entry-states-1501ebfd-20260908.json.gz';
const candidatePath = '/private/tmp/seti-quick-turn-order-20260908/reports/iteration/step24-entry-states-quick-turn-2694b744-20260908.json.gz';
const read = file => JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
const baseline = read(baselinePath), candidate = read(candidatePath);
assert.equal(baseline.passed, true); assert.equal(candidate.passed, true);
const pairs = JSON.parse(fs.readFileSync('reports/iteration/step24-quick-duplicates-1501ebfd-20260908.json')).pairs;
const starts = (chain, prefix) => prefix.every((id, i) => chain[i] === id);
function paths(trace, prefix) {
  return trace.rows.filter(row => row.strategic).flatMap(row => row.node.origins
    .filter(origin => starts([...origin.chain, row.node.action.actionId], prefix)
      && origin.target === 'data:analyze')
    .map(origin => ({ ordinal: row.ordinal, family: row.node.action.family,
      target: origin.target, plan: origin.plan, proxyDepth: origin.proxyDepth,
      chain: [...origin.chain, row.node.action.actionId] })));
}
const findings = pairs.map(pair => {
  const oldBefore = paths(baseline, pair.beforePrefix), oldAfter = paths(baseline, pair.afterPrefix);
  const kept = paths(candidate, pair.beforePrefix);
  const analyses = rows => rows.filter(row => row.family === 'analyze');
  return { beforeOrdinal: pair.beforeOrdinal, afterOrdinal: pair.afterOrdinal,
    beforeTargetPlans: pair.beforeTargetPlans, afterTargetPlans: pair.afterTargetPlans,
    baselineBeforeAnalyses: analyses(oldBefore), baselineAfterAnalyses: analyses(oldAfter),
    candidateBeforeAnalyses: analyses(kept), candidateEntry: kept.filter(row => row.chain.length === pair.beforePrefix.length),
    candidateAfterCount: paths(candidate, pair.afterPrefix).length };
});
const report = { baselinePath, candidatePath, pairCount: findings.length,
  entriesWithAnalysisGoal: findings.filter(x => x.candidateEntry.length).length,
  entriesReachingAnalysis: findings.filter(x => x.candidateBeforeAnalyses.length).length,
  removedAfterEntries: findings.filter(x => x.candidateAfterCount === 0).length,
  scope: '按精确前缀核对来源目标与实际分析动作；不要求随机奖励后的动作链相同，不外推第175步或整局降分原因。', findings };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ ...report, findings: undefined }));
