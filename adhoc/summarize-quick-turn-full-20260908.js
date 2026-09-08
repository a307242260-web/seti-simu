// 只读已完成的固定局；运行记录和存档从各自工作树解析，不重新模拟。
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const output = 'reports/iteration/quick-turn-full-comparison-20260908.json';
if (fs.existsSync(output)) { console.log('已有对照：' + output); process.exit(0); }
const candidateRoot = '/private/tmp/seti-quick-turn-order-20260908';
const matches = fs.readdirSync(candidateRoot + '/reports/research').filter(f => f.endsWith('.438305b4.full.json'));
assert.equal(matches.length, 1, '需要本轮唯一完整局记录');
function summarize(root, file) {
  const r = JSON.parse(fs.readFileSync(path.join(root, 'reports/research', file)));
  assert.equal(r.terminal, true);
  const counts = {}, caps = {}, beamCounts = {}, failures = {}, normalizedByFamily = {};
  let nodes = 0, inputs = 0, beamRecorded = 0, beamOrigins = 0, normalizedOrigins = 0;
  for (const s of r.metrics.searches) {
    const d = s.diagnostics;
    counts[s.kind] = (counts[s.kind] || 0) + 1;
    if (d.executionLimitReached) caps[s.kind] = (caps[s.kind] || 0) + 1;
    if (Object.hasOwn(d, 'beamPrunedOriginCount')) {
      beamRecorded++;
      beamOrigins += d.beamPrunedOriginCount;
      if (d.beamPrunedOriginCount > 0) beamCounts[s.kind] = (beamCounts[s.kind] || 0) + 1;
    }
    nodes += d.executedNodeCount; inputs += d.successfulInputSubmissionCount;
    normalizedOrigins += d.quickTurnOrderPrunedOriginCount || 0;
    for (const [k, v] of Object.entries(d.quickTurnOrderPrunedOriginCountByFamily || {})) normalizedByFamily[k] = (normalizedByFamily[k] || 0) + v;
    for (const [k, v] of Object.entries(d.failedNodeCountByCode || {})) failures[k] = (failures[k] || 0) + v;
  }
  return { file, commit: r.gitCommit, summary: r.summary, steps: r.steps, wallMs: r.wallMs,
    nodes, inputs, counts, caps, failures, normalizedOrigins, normalizedByFamily,
    beamRecorded, beamCounts: beamRecorded === r.metrics.searches.length ? beamCounts : null,
    beamOrigins: beamRecorded === r.metrics.searches.length ? beamOrigins : null,
    savePath: path.resolve(root, r.savePath) };
}
const baseline = summarize(process.cwd(), '1a061690.1501ebfd.full.json');
const candidate = summarize(candidateRoot, matches[0]);
const a = JSON.parse(fs.readFileSync(baseline.savePath)).replaySteps;
const b = JSON.parse(fs.readFileSync(candidate.savePath)).replaySteps;
let first = 0;
while (first < Math.min(a.length, b.length) && JSON.stringify(a[first]) === JSON.stringify(b[first])) first++;
const report = { baseline, candidate,
  firstDifference: first < Math.max(a.length, b.length) ? { step: first + 1, baseline: a[first], candidate: b[first] } : null,
  scoreDeltas: Object.fromEntries(Object.entries(candidate.summary.scores).map(([seat, n]) => [seat, n - baseline.summary.scores[seat]])),
  scope: '前沿记录缺失为null；来源归一数不冒充物理节省。首差仅是归因入口，不以总分变化推断因果。' };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, baseline: baseline.summary, candidate: candidate.summary,
  nodes: [baseline.nodes, candidate.nodes], caps: [baseline.caps, candidate.caps],
  searches: [baseline.counts, candidate.counts], beamCounts: candidate.beamCounts,
  failures: candidate.failures, firstDifference: report.firstDifference?.step }));
