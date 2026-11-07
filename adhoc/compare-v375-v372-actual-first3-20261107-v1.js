'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const read = p => JSON.parse(fs.readFileSync(p));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const root = 'reports/ai-foundation-20261107/';
const before = root + 'v372-blue-landing-supply-v1/v372-first3-native-development-20261107-v1.json';
const after = root + 'v375-known-research-data-v1/v375-first3-native-development-20261107-v1.json';
const prior = read(before), current = read(after);
assert.equal(sha(prior.save), prior.saveSha256);
assert.equal(sha(current.save), current.saveSha256);
const old = read(prior.save).replaySteps, next = read(current.save).replaySteps;
let common = 0;
while (old[common] && next[common] && old[common].actorPlayerId === next[common].actorPlayerId
    && JSON.stringify(old[common].action) === JSON.stringify(next[common].action)) common++;
const detail = (steps, from, to) => steps.slice(from - 1, to).map((row, i) => ({
  input: from + i, actor: row.actorPlayerId, family: row.action.family, target: row.action.target, summary: row.action.summary,
}));
const comparisons = current.compare.map(row => {
  const priorRow = prior.compare.find(x => x.round === row.round), a = priorRow.ai.assets, b = row.ai.assets;
  assert.deepEqual(priorRow.teacher.assets, row.teacher.assets);
  return {round: row.round, changedFields: Object.keys(a).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])),
    oldScore: a.boardScore, newScore: b.boardScore, oldIncome: a.income, newIncome: b.income, oldData: a.data, newData: b.data};
});
assert(comparisons.length >= 2 && comparisons.slice(0, 2).every(x => !x.changedFields.length));
assert(common>=128);
const result = {scope: 'Compare actual runs; preserve exact first two endpoints and separate teacher checkpoint.',
  before, beforeSha256: sha(before), after, afterSha256: sha(after), equalInitialActions: common,
  firstDifference: {old: detail(old, common+1, common+1)[0], new: detail(next, common+1, common+1)[0]},
  comparisons, oldThirdRound: detail(old, common+1, old.length), newThirdRound: detail(next, common+1, next.length), newAutonomousRuns: 0};
fs.writeFileSync(process.argv[2], JSON.stringify(result, null, 2)+'\n', {flag: 'wx'});
console.log(JSON.stringify({common, rounds: comparisons.map(x=>[x.round,x.oldScore,x.newScore,x.changedFields])}));
