// 只读唯一完整局产物；没有终局时不重复启动实验。
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { isDeepStrictEqual } = require('node:util');
const output = 'reports/iteration/alien-card-pick-greedy-full-comparison-20260908.json';
if (fs.existsSync(output)) { console.log('已有对照：' + output); process.exit(0); }
const files = fs.readdirSync('reports/research').filter(f => f.endsWith('.aa277dac.full.json'));
if (!files.length) { console.log('终局尚未生成，等待现有实验'); process.exit(0); }
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
  const cappedSearches = [];
  for (const search of raw.metrics.searches) {
    const d = search.diagnostics, kind = search.kind;
    counts[kind] = (counts[kind] || 0) + 1; nodes += d.executedNodeCount;
    if (d.executionLimitReached) executionCaps[kind] = (executionCaps[kind] || 0) + 1;
    if (!Number.isFinite(d.beamPrunedOriginCount)) beamKnown = false;
    if (d.beamPrunedOriginCount > 0) beamCaps[kind] = (beamCaps[kind] || 0) + 1;
    if (d.executionLimitReached || d.beamPrunedOriginCount > 0) {
      unionCaps[kind] = (unionCaps[kind] || 0) + 1;
      cappedSearches.push({ step: search.step, seat: search.seat, kind, nodes: d.executedNodeCount,
        executionLimitReached: d.executionLimitReached, beamPrunedOriginCount: d.beamPrunedOriginCount });
    }
    for (const [key, value] of Object.entries(d.failedNodeCountByCode)) failures[key] = (failures[key] || 0) + value;
    for (const [key, value] of Object.entries(d.executedNodeCountByDecisionKind)) families[key] = (families[key] || 0) + value;
  }
  assert.equal(sum(families), nodes);
  const alienCardNodes = sum(Object.fromEntries(Object.entries(families)
    .filter(([key]) => key.startsWith('choose_card:') && key.includes('effect=residual_alien_card_decision'))));
  const chooseCardNodes = sum(Object.fromEntries(Object.entries(families).filter(([key]) => key.startsWith('choose_card:'))));
  return { save, summary: { file, commit: raw.gitCommit, steps: raw.steps, wallMs: raw.wallMs,
    scores, scoreSource: 'save-final', mean: sum(scores) / 4, nodes, alienCardNodes, chooseCardNodes,
    counts, executionCaps, beamCaps: beamKnown ? beamCaps : null, unionCaps: beamKnown ? unionCaps : null,
    failures, families, cappedSearches } };
}
const baseline = read('/Users/bilibili/code/seti-simu', 'c43c1f88.70043d34.full.json');
const candidate = read(process.cwd(), files[0]);
let i = 0;
while (i < Math.min(baseline.save.replaySteps.length, candidate.save.replaySteps.length)
  && isDeepStrictEqual(baseline.save.replaySteps[i], candidate.save.replaySteps[i])) i++;
const firstDifference = i === Math.max(baseline.save.replaySteps.length, candidate.save.replaySteps.length)
  ? null : { step: i + 1, baseline: baseline.save.replaySteps[i], candidate: candidate.save.replaySteps[i] };
const report = { baseline: baseline.summary, candidate: candidate.summary, firstDifference,
  scoreDeltas: Object.fromEntries(Object.keys(candidate.summary.scores).map(seat => [seat,
    candidate.summary.scores[seat] - baseline.summary.scores[seat]])),
  gates: {
    targetedPhysicalNodesReduced: candidate.summary.alienCardNodes < baseline.summary.alienCardNodes,
    fixedMeanIncreased: candidate.summary.mean > baseline.summary.mean,
    executionCapsReduced: sum(candidate.summary.executionCaps) < sum(baseline.summary.executionCaps),
    // 旧beam未知：候选全部截断低于旧执行截断下界，才足以证明总截断更少。
    allCapsReducedProven: candidate.summary.unionCaps != null
      && sum(candidate.summary.unionCaps) < sum(baseline.summary.executionCaps),
    zeroRuleFailures: sum(candidate.summary.failures) === 0,
  },
  boundary: '物理节点按正式输入来源统计；首差是归因入口，不代表终局分数因果。旧beam未知不按0。' };
report.allThreeGatesProven = report.gates.targetedPhysicalNodesReduced && report.gates.fixedMeanIncreased
  && report.gates.allCapsReducedProven && report.gates.zeroRuleFailures;
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, scores: candidate.summary.scores,
  mean: [baseline.summary.mean, candidate.summary.mean], nodes: [baseline.summary.nodes, candidate.summary.nodes],
  alienCardNodes: [baseline.summary.alienCardNodes, candidate.summary.alienCardNodes],
  executionCaps: candidate.summary.executionCaps, beamCaps: candidate.summary.beamCaps,
  firstDifference: firstDifference?.step, gates: report.gates }));
