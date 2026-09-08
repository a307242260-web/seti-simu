// 只读数量移动修复4bc44eb2唯一完整局，与dev正式存档对照，不启动模拟。
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { isDeepStrictEqual } = require('node:util');
const root = '/Users/bilibili/code/seti-simu';
const candidateRoot = '/private/tmp/seti-counted-card-move-20260909';
const output = path.join(root, 'reports/iteration/counted-card-move-full-comparison-20260909.json');
if (fs.existsSync(output)) { console.log('已有对照：' + output); process.exit(0); }
const files = fs.readdirSync(path.join(candidateRoot, 'reports/research')).filter(f => f.endsWith('.4bc44eb2.full.json'));
if (!files.length) { console.log('数量移动完整局尚未产出，保留现有运行；不重跑'); process.exit(0); }
assert.equal(files.length, 1);
const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
function read(dir, file) {
  const raw = JSON.parse(fs.readFileSync(path.join(dir, 'reports/research', file)));
  assert.equal(raw.terminal, true);
  const save = JSON.parse(fs.readFileSync(path.resolve(dir, raw.savePath)));
  const state = typeof save.committedState === 'string' ? JSON.parse(save.committedState) : save.committedState;
  const scores = Object.fromEntries(state.match.finalScores.map(s => [s.playerId, s.totalScore]));
  assert.equal(Object.keys(scores).length, 4); assert.ok(Object.values(scores).every(Number.isFinite));
  const counts = {}, executionCaps = {}, beamCaps = {}, unionCaps = {}, failures = {}, families = {}, cappedSearches = [], bySeat = {};
  let nodes = 0, beamKnown = true;
  for (const search of raw.metrics.searches) {
    const d = search.diagnostics, kind = search.kind;
    assert.ok(Number.isFinite(d.executedNodeCount));
    assert.ok(search.seat && search.seat !== '?');
    const seat = bySeat[search.seat] ||= { nodes: 0, searches: 0, alienCardNodes: 0, executionCaps: 0, observedUnionCaps: 0 };
    seat.nodes += d.executedNodeCount; seat.searches++;
    if (d.executionLimitReached) seat.executionCaps++;
    if (d.executionLimitReached || d.beamPrunedOriginCount > 0) seat.observedUnionCaps++;
    nodes += d.executedNodeCount; counts[kind] = (counts[kind] || 0) + 1;
    if (d.executionLimitReached) executionCaps[kind] = (executionCaps[kind] || 0) + 1;
    if (!Number.isFinite(d.beamPrunedOriginCount)) beamKnown = false;
    if (d.beamPrunedOriginCount > 0) beamCaps[kind] = (beamCaps[kind] || 0) + 1;
    if (d.executionLimitReached || d.beamPrunedOriginCount > 0) {
      unionCaps[kind] = (unionCaps[kind] || 0) + 1;
      cappedSearches.push({ step: search.step, seat: search.seat, kind, nodes: d.executedNodeCount,
        executionLimitReached: d.executionLimitReached, beamPrunedOriginCount: d.beamPrunedOriginCount });
    }
    for (const [k, v] of Object.entries(d.failedNodeCountByCode)) failures[k] = (failures[k] || 0) + v;
    for (const [k, v] of Object.entries(d.executedNodeCountByDecisionKind)) {
      families[k] = (families[k] || 0) + v;
      if (k.startsWith('choose_card:') && k.includes('effect=residual_alien_card_decision')) seat.alienCardNodes += v;
    }
  }
  assert.equal(sum(families), nodes);
  const alienCardNodes = sum(Object.fromEntries(Object.entries(families).filter(([k]) =>
    k.startsWith('choose_card:') && k.includes('effect=residual_alien_card_decision'))));
  return { replay: save.replaySteps, summary: { file, commit: raw.gitCommit, steps: raw.steps,
    wallMs: raw.wallMs, scores, mean: sum(scores) / 4, scoreSource: 'save-final', nodes, alienCardNodes,
    counts, executionCaps, beamCaps: beamKnown ? beamCaps : null, unionCaps: beamKnown ? unionCaps : null,
    executionCapRate: sum(executionCaps) / sum(counts), unionCapRate: beamKnown ? sum(unionCaps) / sum(counts) : null,
    failures, families, cappedSearches, bySeat } };
}
const candidate = read(candidateRoot, files[0]);
const references = {
  dev: read(root, 'c43c1f88.70043d34.full.json'),
};
const comparisons = {};
for (const [name, baseline] of Object.entries(references)) {
  const b = baseline.summary, c = candidate.summary;
  let i = 0;
  while (i < Math.min(baseline.replay.length, candidate.replay.length)
    && isDeepStrictEqual(baseline.replay[i], candidate.replay[i])) i++;
  comparisons[name] = { baseline: b,
    firstDifference: i === Math.max(baseline.replay.length, candidate.replay.length) ? null
      : { step: i + 1, baseline: baseline.replay[i], candidate: candidate.replay[i] },
    scoreDeltas: Object.fromEntries(Object.keys(c.scores).map(seat => [seat, c.scores[seat] - b.scores[seat]])),
    totalNodeReductionRatio: 1 - c.nodes / b.nodes,
    strategicSearchDelta: (c.counts.strategic || 0) - (b.counts.strategic || 0),
    meanIncreased: c.mean > b.mean,
    allCapsReducedProven: c.unionCaps !== null && sum(c.unionCaps) < sum(b.unionCaps || b.executionCaps),
  };
}
const report = { candidate: candidate.summary, comparisons,
  zeroRuleFailures: sum(candidate.summary.failures) === 0,
  boundary: '旧dev前沿截断未知，仅以下界证明改善；分别列节点下降比例，不用任意小下降自动判定大幅减少。首差不是终局因果证明。' };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, candidate: { ...candidate.summary, families: undefined, cappedSearches: undefined },
  comparisons: Object.fromEntries(Object.entries(comparisons).map(([k, v]) => [k, { ...v, baseline: undefined,
    firstDifference: v.firstDifference?.step }])) }));
