// 比较本轮与正确计分基线的已有完整局，绝不启动模拟。
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const output = 'reports/iteration/grant-full-comparison-v2-20260908.json';
if (fs.existsSync(output)) { console.log('已有对照：' + output); process.exit(0); }
const candidatePath = process.argv[2];
assert.ok(candidatePath, '需要完整局记录路径');
function summarize(file) {
  const r = JSON.parse(fs.readFileSync(file));
  assert.equal(r.terminal, true, '必须是完整终局');
  const failures = {}, caps = {}, counts = {}, beamCaps = {}, families = {}, decisions = {};
  let nodes = 0, inputs = 0, beamOrigins = 0, beamRecordedSearches = 0;
  for (const s of r.metrics.searches) {
    const d = s.diagnostics;
    nodes += d.executedNodeCount; inputs += d.successfulInputSubmissionCount;
    counts[s.kind] = (counts[s.kind] || 0) + 1;
    if (d.executionLimitReached) caps[s.kind] = (caps[s.kind] || 0) + 1;
    if (Object.hasOwn(d, 'beamPrunedOriginCount')) beamRecordedSearches++;
    if (d.beamPrunedOriginCount > 0) beamCaps[s.kind] = (beamCaps[s.kind] || 0) + 1;
    beamOrigins += d.beamPrunedOriginCount || 0;
    for (const [k, v] of Object.entries(d.failedNodeCountByCode || {})) failures[k] = (failures[k] || 0) + v;
    for (const [k, v] of Object.entries(d.executedNodeCountByFamily || {})) families[k] = (families[k] || 0) + v;
    for (const [k, v] of Object.entries(d.executedNodeCountByDecisionKind || {})) decisions[k] = (decisions[k] || 0) + v;
  }
  return { file: path.resolve(file), commit: r.gitCommit, summary: r.summary, steps: r.steps,
    wallMs: r.wallMs, nodes, inputs, failures, caps, counts,
    beamRecordedSearches,
    beamCaps: beamRecordedSearches === r.metrics.searches.length ? beamCaps : null,
    beamOrigins: beamRecordedSearches === r.metrics.searches.length ? beamOrigins : null,
    families, decisions, savePath: r.savePath };
}
const baseline = summarize('reports/research/73d04d3a.670441bc.full.json');
const candidate = summarize(candidatePath);
const a = JSON.parse(fs.readFileSync(baseline.savePath)).replaySteps;
const b = JSON.parse(fs.readFileSync(candidate.savePath)).replaySteps;
let first = 0;
while (first < Math.min(a.length, b.length) && JSON.stringify(a[first]) === JSON.stringify(b[first])) first++;
const report = { baseline, candidate,
  firstDifference: first < Math.max(a.length, b.length)
    ? { step: first + 1, baseline: a[first], candidate: b[first] } : null,
  scoreDeltas: Object.fromEntries(Object.entries(candidate.summary.scores).map(([seat, score]) => [seat, score - baseline.summary.scores[seat]])),
  scope: '执行预算和前沿裁剪分别计数，两者可重叠；前沿字段未保存时记null，不视作0。来源数不冒充物理节点。首差不代表终局差值归因已完成。初版未区分缺失字段，使用本v2。' };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, baseline: baseline.summary, candidate: candidate.summary,
  nodes: [baseline.nodes, candidate.nodes], caps: [baseline.caps, candidate.caps],
  beamCaps: [baseline.beamCaps, candidate.beamCaps], failures: candidate.failures,
  firstDifference: report.firstDifference?.step }));
