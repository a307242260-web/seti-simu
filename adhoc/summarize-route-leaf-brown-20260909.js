// 只读两份已完成存档，按棕方行动序号及提交前轮次拆分；不运行模拟。
const fs = require('node:fs'), assert = require('node:assert/strict');
const output = 'reports/iteration/route-leaf-brown-attribution-20260909.json';
if (fs.existsSync(output)) { console.log('已有棕方对照：' + output); process.exit(0); }
const seat = 'player-brown';
function read(file) {
  const raw = JSON.parse(fs.readFileSync('reports/research/' + file));
  assert.equal(raw.terminal, true);
  const save = JSON.parse(fs.readFileSync(raw.savePath));
  const state = typeof save.committedState === 'string' ? JSON.parse(save.committedState) : save.committedState;
  const actions = save.replaySteps.filter(s => s.actorPlayerId === seat);
  const searches = raw.metrics.searches.filter(s => s.seat === seat);
  const rounds = [1, 2, 3, 4].map(round => {
    const selected = searches.filter(s => save.replaySteps[s.step - 2].after.r === round);
    const kinds = {}, families = {};
    for (const s of selected) {
      const k = kinds[s.kind] ||= { count: 0, nodes: 0 };
      k.count++; k.nodes += s.diagnostics.executedNodeCount;
      for (const [family, n] of Object.entries(s.diagnostics.executedNodeCountByDecisionKind)) families[family] = (families[family] || 0) + n;
    }
    const scoreEvents = save.replaySteps.flatMap((s, i) => {
      if (!i || save.replaySteps[i - 1].after.r !== round) return [];
      const gain = s.after.p[seat][0] - save.replaySteps[i - 1].after.p[seat][0];
      return gain ? [{ step: i + 1, actor: s.actorPlayerId, action: s.action, gain }] : [];
    });
    return { round, kinds, families, processScore: scoreEvents.reduce((n, e) => n + e.gain, 0), scoreEvents,
      searches: selected.map(s => ({ step: s.step, kind: s.kind, nodes: s.diagnostics.executedNodeCount,
        action: save.replaySteps[s.step - 1].action, executionLimitReached: s.diagnostics.executionLimitReached,
        beamPrunedOriginCount: s.diagnostics.beamPrunedOriginCount })) };
  });
  assert.equal(rounds.reduce((sum, r) => sum + r.searches.reduce((n, s) => n + s.nodes, 0), 0),
    searches.reduce((n, s) => n + s.diagnostics.executedNodeCount, 0));
  return { file, rounds, actions, final: state.match.finalScores.find(s => s.playerId === seat),
    markers: actions.filter(s => String(s.action.target?.choiceId).startsWith('final:')) };
}
const baseline = read('3c7e0003.af937808.full.json'), candidate = read('4a694948.ad676add.full.json');
const key = x => JSON.stringify([x.action.family, x.action.target, x.action.payload]);
let index = 0;
while (index < Math.min(baseline.actions.length, candidate.actions.length)
  && key(baseline.actions[index]) === key(candidate.actions[index])) index++;
const firstOwnDifference = { ordinal: index + 1, baseline: baseline.actions[index], candidate: candidate.actions[index],
  boundary: '按棕方输入序号比较family/target/payload，不含状态版本；不是同一盘面的因果证据。' };
const deltas = candidate.rounds.map((r, i) => ({ round: r.round,
  nodes: r.searches.reduce((n, s) => n + s.nodes, 0) - baseline.rounds[i].searches.reduce((n, s) => n + s.nodes, 0),
  searches: r.searches.length - baseline.rounds[i].searches.length,
  processScore: r.processScore - baseline.rounds[i].processScore }));
const report = { baseline, candidate, deltas, firstOwnDifference,
  scoreDelta: { base: candidate.final.baseScore - baseline.final.baseScore,
    cards: candidate.final.cardScore - baseline.final.cardScore, tiles: candidate.final.tileScore - baseline.final.tileScore } };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, deltas, scoreDelta: report.scoreDelta,
  first: [firstOwnDifference.baseline, firstOwnDifference.candidate].map(s => ({ step: s.stepIndex + 1, action: s.action.summary, target: s.action.target })) }));
