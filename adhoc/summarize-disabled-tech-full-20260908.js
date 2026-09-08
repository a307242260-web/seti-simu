// 只读取冻结修复a6812efe的唯一完整局，未产出时不重复运行。
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { isDeepStrictEqual } = require('node:util');
const output = 'reports/iteration/disabled-tech-value-full-comparison-20260908.json';
if (fs.existsSync(output)) { console.log('已有对照：' + output); process.exit(0); }
const files = fs.readdirSync('reports/research').filter(f => f.endsWith('.a6812efe.full.json'));
if (!files.length) { console.log('等待已启动的完整局；不重跑'); process.exit(0); }
assert.equal(files.length, 1);
const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
function read(root, file) {
  const raw = JSON.parse(fs.readFileSync(path.join(root, 'reports/research', file)));
  assert.equal(raw.terminal, true);
  const save = JSON.parse(fs.readFileSync(path.resolve(root, raw.savePath)));
  const state = typeof save.committedState === 'string' ? JSON.parse(save.committedState) : save.committedState;
  const scores = Object.fromEntries(state.match.finalScores.map(s => [s.playerId, s.totalScore]));
  assert.equal(Object.keys(scores).length, 4); assert.ok(Object.values(scores).every(Number.isFinite));
  const counts = {}, executionCaps = {}, beamCaps = {}, unionCaps = {}, failures = {}, families = {};
  let nodes = 0, beamKnown = true;
  for (const { kind, diagnostics: d } of raw.metrics.searches) {
    counts[kind] = (counts[kind] || 0) + 1; nodes += d.executedNodeCount;
    if (d.executionLimitReached) executionCaps[kind] = (executionCaps[kind] || 0) + 1;
    if (!Number.isFinite(d.beamPrunedOriginCount)) beamKnown = false;
    if (d.beamPrunedOriginCount > 0) beamCaps[kind] = (beamCaps[kind] || 0) + 1;
    if (d.executionLimitReached || d.beamPrunedOriginCount > 0) unionCaps[kind] = (unionCaps[kind] || 0) + 1;
    for (const [k, v] of Object.entries(d.failedNodeCountByCode)) failures[k] = (failures[k] || 0) + v;
    for (const [k, v] of Object.entries(d.executedNodeCountByDecisionKind)) families[k] = (families[k] || 0) + v;
  }
  assert.equal(sum(families), nodes);
  return { save, summary: { file, commit: raw.gitCommit, steps: raw.steps, wallMs: raw.wallMs,
    scores, mean: sum(scores) / 4, scoreSource: 'save-final', nodes, counts, executionCaps,
    beamCaps: beamKnown ? beamCaps : null, unionCaps: beamKnown ? unionCaps : null, failures, families } };
}
const baseline = read('/Users/bilibili/code/seti-simu', 'c43c1f88.70043d34.full.json');
const candidate = read(process.cwd(), files[0]);
let i = 0;
while (i < Math.min(baseline.save.replaySteps.length, candidate.save.replaySteps.length)
  && isDeepStrictEqual(baseline.save.replaySteps[i], candidate.save.replaySteps[i])) i++;
const firstDifference = i === Math.max(baseline.save.replaySteps.length, candidate.save.replaySteps.length)
  ? null : { step: i + 1, baseline: baseline.save.replaySteps[i], candidate: candidate.save.replaySteps[i] };
const proof = JSON.parse(fs.readFileSync('reports/iteration/disabled-tech-captured-leaves-20260908.json'));
assert.equal(proof.passed, true);
const report = { baseline: baseline.summary, candidate: candidate.summary, firstDifference,
  scoreDeltas: Object.fromEntries(Object.keys(candidate.summary.scores).map(seat => [seat,
    candidate.summary.scores[seat] - baseline.summary.scores[seat]])),
  knownCounterexamplePassed: proof.passed, zeroRuleFailures: sum(candidate.summary.failures) === 0,
  fixedMeanIncreased: candidate.summary.mean > baseline.summary.mean,
  boundary: '独立估值事实修复，不含拿牌贪心。首差不是终局因果，缓存叶修正不代表拿牌与修复组合已验证；旧beam未知不按0比较。' };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, scores: candidate.summary.scores, mean: [baseline.summary.mean, candidate.summary.mean],
  nodes: [baseline.summary.nodes, candidate.summary.nodes], caps: candidate.summary.executionCaps,
  beam: candidate.summary.beamCaps, union: candidate.summary.unionCaps, firstDifference: firstDifference?.step,
  failures: candidate.summary.failures, wallMs: candidate.summary.wallMs }));
