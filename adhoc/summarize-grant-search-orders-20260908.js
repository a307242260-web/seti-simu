// 只读已完成单点的保留叶，定位跨回合顺序；路线计数不冒充物理节点数。
const fs = require('node:fs');
const crypto = require('node:crypto');
const source = '/private/tmp/seti-grant-data-route-20260908/reports/iteration/grant-data-route-search-v4-20260908.json';
const output = 'reports/iteration/grant-search-orders-20260908.json';
if (fs.existsSync(output)) { console.log('已有证据：' + output); process.exit(0); }
const raw = fs.readFileSync(source);
const report = JSON.parse(raw);
if (!report.passed) throw new Error('来源单点尚未通过');
const groups = new Map();
for (const leaf of report.search.grantOutcome.leaves) {
  const steps = leaf.planSteps || [];
  const analyze = steps.findIndex(s => s.action.family === 'analyze');
  if (analyze < 0) continue;
  const actions = steps.slice(0, analyze + 1).map(s => ({
    family: s.action.family, target: s.action.target || null,
  }));
  const key = JSON.stringify(actions.filter(a => a.family !== 'end_turn'));
  if (!groups.has(key)) groups.set(key, new Map());
  const variants = groups.get(key);
  const sequence = JSON.stringify(actions);
  if (!variants.has(sequence)) variants.set(sequence, { leafId: leaf.leafId, actions });
}
const duplicates = [...groups.values()].filter(v => v.size > 1).map(v => [...v.values()]);
const d = report.search.diagnostics;
const result = {
  source, sha256: crypto.createHash('sha256').update(raw).digest('hex'),
  productionCommit: 'b30cc80f',
  scope: '仅拨款根保留叶；截至首次分析的动作前缀。相同非结束回合动作不证明完整状态等价。',
  search: { nodes: d.executedNodeCount, inputs: d.successfulInputSubmissionCount,
    wallMs: report.search.wallMs, executionLimitReached: d.executionLimitReached,
    beamPrunedOriginCount: d.beamPrunedOriginCount,
    completeness: report.search.grantOutcome.searchCompleteness,
    failures: d.failedNodeCountByCode },
  retainedLeaves: report.search.grantOutcome.leaves.length,
  distinctNonEndTurnPrefixes: groups.size,
  prefixesWithMultipleEndTurnOrders: duplicates.length,
  duplicateOrderExamples: duplicates.slice(0, 5),
};
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, groups: groups.size, duplicateOrderGroups: duplicates.length,
  nodes: result.search.nodes, beamPrunedOrigins: result.search.beamPrunedOriginCount }));
