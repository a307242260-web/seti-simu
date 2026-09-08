// 读取唯一完整局终局，按正式计数器核对收入、痕迹、科技、标记与牌，不运行模拟。
const fs = require('node:fs'), assert = require('node:assert/strict');
const scoring = require('../randomizer/game/end-game-scoring');
const output = 'reports/iteration/brown-final-conditions-20260909.json';
if (fs.existsSync(output)) { console.log('已有终局条件检查点：' + output); process.exit(0); }
const report = { scope: '终局直接计分条件；不证明替代策略最优或全部反事实因果', versions: [] };
for (const key of ['3c7e0003.af937808.full.json', '4a694948.ad676add.full.json']) {
  const record = JSON.parse(fs.readFileSync('reports/research/' + key));
  const save = JSON.parse(fs.readFileSync(record.savePath)), state = JSON.parse(save.committedState);
  const player = state.players.players.find(p => p.id === 'player-brown');
  const final = state.match.finalScores.find(p => p.playerId === player.id);
  const traces = Object.fromEntries(['pink', 'yellow', 'blue'].map(t => [t, scoring.countTraceMarkers(player, state.aliens, t)]));
  const baseIncome = scoring.getPlayerCompanyBaseIncome(player);
  const incomeGrowth = Object.fromEntries(['credits', 'energy', 'handSize'].map(k => [k, player.income[k] - baseIncome[k]]));
  const marks = Object.values(state.finalScoring.tiles).flatMap(t => t.marks).filter(m => m.playerId === player.id);
  const row = { record: key, final, traces, income: player.income, baseIncome, incomeGrowth,
    ownedTechIds: Object.keys(player.techState.ownedTiles).filter(k => player.techState.ownedTiles[k]),
    reservedCards: player.reservedCards, marks,
    markInputs: save.replaySteps.flatMap((s, i) => s.action.actorId === player.id && s.action.summary.startsWith('标记 ')
      ? [{ step: i + 1, action: s.action, after: s.after }] : []) };
  assert.equal(final.baseScore + final.cardScore + final.tileScore, final.totalScore);
  for (const t of final.tiles) {
    const base = t.formulaId === 'a2' ? Math.min(...Object.values(incomeGrowth))
      : t.formulaId === 'b1' ? Math.min(...Object.values(traces))
        : t.formulaId === 'd2' ? Math.floor(row.ownedTechIds.length / 2) : null;
    assert.notEqual(base, null, '本例出现未审查计分公式');
    assert.equal(base, t.baseValue); assert.equal(base * t.multiplier, t.score);
  }
  report.versions.push(row);
}
const [old, current] = report.versions;
assert.deepEqual(old.traces, { pink: 2, yellow: 2, blue: 2 });
assert.deepEqual(current.traces, { pink: 0, yellow: 3, blue: 1 });
assert.equal(old.final.cardScore, 4); assert.equal(current.final.cardScore, 0);
report.passed = true;
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, passed: true, totals: report.versions.map(v => v.final.totalScore), traces: report.versions.map(v => v.traces) }));
