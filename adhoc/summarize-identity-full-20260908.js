// 只读本轮唯一完整局及两个既有基线；未结束时不生成“完成”报告。
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = '/private/tmp/seti-counterfactual-identity-20260908';
const output = 'reports/iteration/counterfactual-identity-full-comparison-20260908.json';
if (fs.existsSync(output)) { console.log('已有完整局对照：' + output); process.exit(0); }
const matches = fs.readdirSync(root + '/reports/research').filter(f => f.endsWith('.0b01af15.full.json'));
assert.equal(matches.length, 1, '需要本轮已完成的唯一记录，不重复模拟');
function read(base, file) {
  const r = JSON.parse(fs.readFileSync(path.join(base, 'reports/research', file)));
  assert.equal(r.terminal, true);
  const counts = {}, caps = {}, beam = {}, union = {}, failures = {};
  let nodes = 0, inputs = 0, knownBeam = true;
  for (const s of r.metrics.searches) {
    const d = s.diagnostics, kind = s.kind;
    counts[kind] = (counts[kind] || 0) + 1;
    nodes += d.executedNodeCount; inputs += d.successfulInputSubmissionCount;
    if (d.executionLimitReached) caps[kind] = (caps[kind] || 0) + 1;
    if (!Object.hasOwn(d, 'beamPrunedOriginCount')) knownBeam = false;
    if (d.beamPrunedOriginCount > 0) beam[kind] = (beam[kind] || 0) + 1;
    if (d.executionLimitReached || d.beamPrunedOriginCount > 0) union[kind] = (union[kind] || 0) + 1;
    for (const [k, v] of Object.entries(d.failedNodeCountByCode || {})) failures[k] = (failures[k] || 0) + v;
  }
  return { file, commit: r.gitCommit, summary: r.summary, steps: r.steps, wallMs: r.wallMs,
    nodes, inputs, counts, executionCaps: caps, beamCaps: knownBeam ? beam : null,
    executionOrBeamSearches: knownBeam ? union : null, failures,
    savePath: path.resolve(base, r.savePath) };
}
const correctBaseline = read(process.cwd(), '1a061690.1501ebfd.full.json');
const directBaseline = read(process.cwd(), '95016f07.438305b4.full.json');
const candidate = read(root, matches[0]);
const deltas = baseline => ({ mean: candidate.summary.avgScore - baseline.summary.avgScore,
  nodes: candidate.nodes - baseline.nodes, wallMs: candidate.wallMs - baseline.wallMs,
  seats: Object.fromEntries(Object.keys(candidate.summary.scores).map(id => [id, candidate.summary.scores[id] - baseline.summary.scores[id]])) });
const report = { correctBaseline, directBaseline, candidate, versusCorrect: deltas(correctBaseline), versusDirect: deltas(directBaseline),
  boundary: '无前沿字段的旧记录保留null；执行或前沿裁剪的搜索按并集计数，不重复相加。总节点减少不替代指定行为的节省及正确性证据。' };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report));
