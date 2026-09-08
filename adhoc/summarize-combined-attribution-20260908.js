// 既有完整局按轮次分解白方节点，核对棕方正式板块得分与第284步冷搜索。
const fs = require('node:fs'), assert = require('node:assert/strict');
const output = 'reports/iteration/combined-attribution-20260908.json';
if (fs.existsSync(output)) { console.log('已有归因检查点：' + output); process.exit(0); }
function read(file) {
  const raw = JSON.parse(fs.readFileSync('reports/research/' + file));
  assert.equal(raw.terminal, true);
  const save = JSON.parse(fs.readFileSync(raw.savePath));
  const state = typeof save.committedState === 'string' ? JSON.parse(save.committedState) : save.committedState;
  const white = raw.metrics.searches.filter(s => s.seat === 'player-white');
  const rounds = Array.from({ length: 4 }, (_, i) => {
    const searches = white.filter(s => save.replaySteps[Math.max(0, s.step - 2)].after.r === i + 1);
    const kinds = {}, families = {};
    for (const s of searches) {
      const k = kinds[s.kind] ||= { count: 0, nodes: 0 };
      k.count++; k.nodes += s.diagnostics.executedNodeCount;
      for (const [key, n] of Object.entries(s.diagnostics.executedNodeCountByDecisionKind)) families[key] = (families[key] || 0) + n;
    }
    return { round: i + 1, kinds, nodes: searches.reduce((n, s) => n + s.diagnostics.executedNodeCount, 0), families,
      searches: searches.map(s => ({ step: s.step, kind: s.kind, nodes: s.diagnostics.executedNodeCount,
        action: save.replaySteps[s.step - 1].action, executionLimitReached: s.diagnostics.executionLimitReached,
        beamPrunedOriginCount: s.diagnostics.beamPrunedOriginCount })) };
  });
  assert.equal(rounds.reduce((n, r) => n + r.nodes, 0), white.reduce((n, s) => n + s.diagnostics.executedNodeCount, 0));
  const brown = save.replaySteps.filter(s => s.actorPlayerId === 'player-brown');
  return { file, rounds, brownFinal: state.match.finalScores.find(s => s.playerId === 'player-brown'),
    brownMarkers: brown.filter(s => String(s.action.target?.choiceId).startsWith('final:')),
    brownActions: brown.filter(s => s.phase === 'main' || ['industry', 'complete_task'].includes(s.action.family)) };
}
const baseline = read('c43c1f88.70043d34.full.json'), combined = read('80437cef.5d17835f.full.json');
const cold = JSON.parse(fs.readFileSync('reports/iteration/combined-brown-final284-20260908.json'));
assert.equal(cold.passed, true); assert.equal(cold.diagnostics.executedNodeCount, 4);
assert.equal(cold.diagnostics.executionLimitReached, false); assert.equal(cold.diagnostics.beamPrunedOriginCount, 0);
const markerValues = cold.captures[0].ranked.map(r => ({ action: r.action.summary,
  rankingScore: r.evaluation.score, rootSecured: r.evaluation.rootValue.securedEndGameBonus,
  actualScoreDelta: r.evaluation.actualScoreDelta,
  securedAfter: r.evaluation.rootValue.securedEndGameBonus + r.evaluation.actualScoreDelta }));
assert.deepEqual(markerValues.map(r => r.securedAfter), [11, 0, 0, 5]);
const whiteRoundDeltas = combined.rounds.map((r, i) => ({ round: r.round, before: baseline.rounds[i].nodes,
  after: r.nodes, delta: r.nodes - baseline.rounds[i].nodes }));
const report = { baseline, combined, whiteRoundDeltas, markerValues,
  brownScoreDelta: { base: combined.brownFinal.baseScore - baseline.brownFinal.baseScore,
    tiles: combined.brownFinal.tileScore - baseline.brownFinal.tileScore,
    tileD: combined.brownFinal.tileScoresById.d - baseline.brownFinal.tileScoresById.d },
  boundary: '轮次按提交前上一输入after记录；节点轮次拆分不是新增搜索因果。标记选择4节点全部展开，当前A11>D5；事后D倍率损失不证明当时决策bug。不预测对手，不回滚正确失效事实以追回分数。过程分差仍未归因。' };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, whiteRoundDeltas, markerValues, brownScoreDelta: report.brownScoreDelta,
  whiteKinds: combined.rounds.map(r => ({ round: r.round, kinds: r.kinds })) }));
