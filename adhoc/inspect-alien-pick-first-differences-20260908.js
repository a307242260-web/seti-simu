// 逐席行动首差与搜索增量，只读既有完整局，不作为降分因果证明。
const fs = require('node:fs'), assert = require('node:assert/strict');
const { isDeepStrictEqual } = require('node:util');
const output = 'reports/iteration/alien-card-pick-first-differences-20260908.json';
if (fs.existsSync(output)) { console.log('已有首差检查：' + output); process.exit(0); }
function read(file) {
  const raw = JSON.parse(fs.readFileSync('reports/research/' + file));
  assert.equal(raw.terminal, true);
  return { raw, save: JSON.parse(fs.readFileSync(raw.savePath)) };
}
const baseline = read('c43c1f88.70043d34.full.json');
const candidate = read('b6c44201.aa277dac.full.json');
function signature(step) {
  const { family, phase, summary, target } = step.action;
  return { family, phase, summary, target };
}
const rows = [];
for (const seat of ['player-blue', 'player-green', 'player-brown', 'player-white']) {
  const before = baseline.save.replaySteps.filter(s => s.actorPlayerId === seat && s.action.family !== 'end_turn');
  const after = candidate.save.replaySteps.filter(s => s.actorPlayerId === seat && s.action.family !== 'end_turn');
  let i = 0;
  while (i < Math.min(before.length, after.length) && isDeepStrictEqual(signature(before[i]), signature(after[i]))) i++;
  const searches = ({ raw }) => raw.metrics.searches.filter(s => s.seat === seat);
  const a = searches(baseline), b = searches(candidate);
  rows.push({ seat, matchedOwnActions: i, baselineContext: before.slice(Math.max(0, i - 2), i + 3),
    candidateContext: after.slice(Math.max(0, i - 2), i + 3),
    searchCount: [a.length, b.length], physicalNodes: [a, b].map(ss => ss.reduce((sum, s) => sum + s.diagnostics.executedNodeCount, 0)) });
}
fs.writeFileSync(output, JSON.stringify({ baseline: '70043d34', candidate: 'aa277dac', rows,
  boundary: '忽略stateVersion/actionId及结束回合，仅按family/phase/summary/target比较逐席输入；错位之后不作动作配对，不将首差自动视为终局降分原因。' }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(rows.map(r => ({ seat: r.seat, matchedOwnActions: r.matchedOwnActions,
  searchCount: r.searchCount, physicalNodes: r.physicalNodes,
  baseline: r.baselineContext[2]?.action.summary, candidate: r.candidateContext[2]?.action.summary })), null, 2));
