// 从两份唯一完整局的after摘要提取棕方第二、三轮过程得分；不模拟、不改口径。
const fs = require('node:fs'), assert = require('node:assert/strict');
const output = 'reports/iteration/brown-round2-3-score-events-20260909.json';
if (fs.existsSync(output)) { console.log('已有轮次得分检查点：' + output); process.exit(0); }
const report = { scope: '过程得分，不含终局；按实际after轮次记录所有席位行动引起的棕方分数变化', versions: [] };
for (const key of ['3c7e0003.af937808.full.json', '4a694948.ad676add.full.json']) {
  const record = JSON.parse(fs.readFileSync('reports/research/' + key));
  const steps = JSON.parse(fs.readFileSync(record.savePath)).replaySteps;
  const v = { record: key, rounds: {} }; report.versions.push(v);
  for (const round of [2, 3]) {
    const row = { scoreGain: 0, scoringEvents: [], ownActions: [] }; v.rounds[round] = row;
    for (let i = 1; i < steps.length; i++) {
      const s = steps[i], before = steps[i - 1].after;
      if (s.after.r !== round) continue;
      const delta = s.after.p['player-brown'][0] - before.p['player-brown'][0];
      assert.ok(Number.isFinite(delta)); row.scoreGain += delta;
      const entry = { step: i + 1, action: s.action, beforeScore: before.p['player-brown'][0], afterScore: s.after.p['player-brown'][0], delta };
      if (delta) row.scoringEvents.push(entry);
      if (s.action.actorId === 'player-brown') row.ownActions.push(entry);
    }
  }
}
report.deltas = Object.fromEntries([2, 3].map(r => [r, report.versions[1].rounds[r].scoreGain - report.versions[0].rounds[r].scoreGain]));
assert.deepEqual(report.deltas, { 2: -2, 3: -16 });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, gains: report.versions.map(v => Object.fromEntries(Object.entries(v.rounds).map(([r, x]) => [r, x.scoreGain]))), deltas: report.deltas }));
