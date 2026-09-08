// 只读既有完整局和追踪，归档对照；不运行AI。
const fs = require('node:fs'), assert = require('node:assert/strict');
const output = 'reports/iteration/income-boundary-full-comparison-20260908.json';
if (fs.existsSync(output)) { console.log('已有对照：' + output); process.exit(0); }
function summarize(file) {
  const r = JSON.parse(fs.readFileSync('reports/research/' + file));
  const failures = {}, caps = {}, counts = {};
  let nodes = 0, inputs = 0;
  for (const s of r.metrics.searches) {
    const d = s.diagnostics;
    nodes += d.executedNodeCount; inputs += d.successfulInputSubmissionCount;
    counts[s.kind] = (counts[s.kind] || 0) + 1;
    if (d.executionLimitReached) caps[s.kind] = (caps[s.kind] || 0) + 1;
    for (const [k, v] of Object.entries(d.failedNodeCountByCode || {})) failures[k] = (failures[k] || 0) + v;
  }
  return { file, commit: r.gitCommit, summary: r.summary, terminal: r.terminal, steps: r.steps,
    wallMs: r.wallMs, nodes, inputs, failures, caps, counts, savePath: r.savePath };
}
const baseline = summarize('7dfcf27e.aaaed8d0.full.json');
const candidate = summarize('197640a3.f520347d.full.json');
const a = JSON.parse(fs.readFileSync(baseline.savePath)).replaySteps;
const b = JSON.parse(fs.readFileSync(candidate.savePath)).replaySteps;
let first = 0;
while (first < Math.min(a.length, b.length) && JSON.stringify(a[first]) === JSON.stringify(b[first])) first++;
assert.equal(first, 23); assert.equal(candidate.terminal, true); assert.deepEqual(candidate.failures, {});
const report = { baseline, candidate, firstDifference: { step: first + 1, baseline: a[first], candidate: b[first] },
  scoreDeltas: Object.fromEntries(Object.entries(candidate.summary.scores).map(([seat, score]) => [seat, score - baseline.summary.scores[seat]])),
  conclusion: '收入信息边界修复后首次行为变化为第24步放数据改发射；修复与单点屏障传播已验证，但完整局降14分的路径归因尚未闭合，不能将所有下降自动归为纠错。战略截断27/98变28/96，未达到第五轮完整性目标。',
  scope: '只比较既有记录；没有重跑完整局，也不根据终局差值推断单一路线因果。' };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report, null, 2));
