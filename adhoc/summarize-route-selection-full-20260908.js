// 只读取本版本唯一完整局，与正确基线逐步比较；未产出终局文件时不写验收结论。
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { isDeepStrictEqual } = require('node:util');
const candidateRoot = '/private/tmp/seti-route-selection-error-20260908';
const output = 'reports/iteration/route-selection-full-comparison-20260908.json';
if (fs.existsSync(output)) { console.log('已有完整局对照：' + output); process.exit(0); }
const files = fs.readdirSync(candidateRoot + '/reports/research').filter(f => f.endsWith('.70043d34.full.json'));
if (!files.length) { console.log('终局记录尚未生成；保留原运行，不重复模拟'); process.exit(0); }
assert.equal(files.length, 1);
function read(root, file) {
  const r = JSON.parse(fs.readFileSync(path.join(root, 'reports/research', file)));
  assert.equal(r.terminal, true);
  const savePath = path.resolve(root, r.savePath), save = JSON.parse(fs.readFileSync(savePath));
  const counts = {}, caps = {}, beam = {}, failures = {}; let nodes = 0, inputs = 0, beamKnown = true;
  for (const s of r.metrics.searches) {
    const d = s.diagnostics;
    counts[s.kind] = (counts[s.kind] || 0) + 1;
    nodes += d.executedNodeCount; inputs += d.successfulInputSubmissionCount;
    if (d.executionLimitReached) caps[s.kind] = (caps[s.kind] || 0) + 1;
    if (!Object.hasOwn(d, 'beamPrunedOriginCount')) beamKnown = false;
    if (d.beamPrunedOriginCount > 0) beam[s.kind] = (beam[s.kind] || 0) + 1;
    for (const [k, v] of Object.entries(d.failedNodeCountByCode || {})) failures[k] = (failures[k] || 0) + v;
  }
  return { raw: r, save, summary: { file, savePath, commit: r.gitCommit, steps: r.steps, terminal: r.terminal,
    scores: r.summary.scores, mean: r.summary.avgScore, wallMs: r.wallMs, nodes, inputs, counts,
    executionCaps: caps, beamCaps: beamKnown ? beam : null, failures } };
}
const baseline = read(process.cwd(), '1a061690.1501ebfd.full.json'), candidate = read(candidateRoot, files[0]);
const steps = Math.max(baseline.save.replaySteps.length, candidate.save.replaySteps.length);
let firstReplayDifference = null;
for (let i = 0; i < steps; i++) if (!isDeepStrictEqual(baseline.save.replaySteps[i], candidate.save.replaySteps[i])) {
  firstReplayDifference = { step: i + 1, baseline: baseline.save.replaySteps[i], candidate: candidate.save.replaySteps[i] }; break;
}
const metrics = r => r.metrics.searches.map(s => ({ step: s.step, seat: s.seat, kind: s.kind, action: s.action,
  diagnostics: Object.fromEntries(['executedNodeCount', 'successfulInputSubmissionCount', 'executionLimitReached',
    'failedNodeCountByCode', 'executedNodeCountByFamily', 'executedNodeCountByDecisionKind'].map(k => [k, s.diagnostics[k]])) }));
const report = { baseline: baseline.summary, candidate: candidate.summary,
  allReplayStepsEqual: firstReplayDifference === null, firstReplayDifference,
  searchMetricsEqual: isDeepStrictEqual(metrics(baseline.raw), metrics(candidate.raw)),
  finalScoresEqual: isDeepStrictEqual(baseline.summary.scores, candidate.summary.scores),
  boundary: '只验收异常传播修复；无错误正常路径应保持决策和节点不变，不要求或宣称本修复实现第五轮提分降节点。旧前沿字段缺失保留null。' };
report.passed = report.allReplayStepsEqual && report.searchMetricsEqual && report.finalScoresEqual
  && Object.keys(candidate.summary.failures).length === 0;
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
if (!report.passed) process.exitCode = 1;
console.log(JSON.stringify(report));
