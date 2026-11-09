'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createEnvironment } = require('../tools/research-free-analyze-random20');
const root = 'reports/ai-foundation-20261109';
const verified = `${root}/v661-random20-v1/v661-random20-verified-20261109-v1.json`;
const repaired = `${root}/v661-random20-repair-v1/repaired-terminals-20261109-v1.json`;
const archive = `${root}/v661-random20-repair-v1/native-recovery-evidence-20261109-v1.tar.gz`;
const white = 'player-white';
const read = p => JSON.parse(fs.readFileSync(p));
const resourceKeys = ['credits', 'energy', 'availableData', 'handSize', 'additionalPublicScan', 'publicity'];
const asset = (round, score, technology, income, resources) => ({
  round, score, tech: Object.keys(technology.ownedTiles).filter(id => technology.ownedTiles[id]).length,
  income: Object.fromEntries(resourceKeys.map(key => [key, income[key] ?? 0])),
  reserve: Object.fromEntries(resourceKeys.filter(key => key !== 'additionalPublicScan').map(key => [key, resources[key] ?? 0])),
});
const members = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n');
const fixes = new Map(read(repaired).map(r => [r.board, r]));
const rows = read(verified).rows.map(row => {
  const recorded = fs.readFileSync(row.record + '.round-ends.jsonl', 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(recorded.map(x => [x.round, x.score]), row.rounds);
  assert(recorded.every(x => x.phase === 'before-pass-card-and-income'));
  const ends = recorded.map(x => asset(x.round, x.score, x.technology, x.income, x.resources));
  if (row.terminal) {
    assert.deepEqual(ends.map(x => x.round), [1, 2, 3, 4]);
    assert.equal(ends[3].score, row.boardScore);
    return { ...row, ends };
  }
  const fix = fixes.get(row.number);
  assert(fix?.terminal && fix.nativeStateAndRngExact);
  const member = members.filter(n => n.startsWith(`seti-v661-random20-recover-${String(row.number).padStart(2, '0')}-`)).sort().at(-1);
  assert(member);
  const recovered = JSON.parse(execFileSync('tar', ['-xOzf', archive, member], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }));
  assert(recovered.terminal && recovered.replayNativeStateSessionRngExact);
  assert.equal(recovered.sourceSha256, row.recordSha256);
  assert.equal(recovered.recoveryInputs, fix.newInputs);
  const env = createEnvironment();
  const replayEnds = [];
  try {
    const record = read(row.record);
    env.reset({ seed: row.seed, agentType: 'custom', seat: white, activePlayerCount: 4,
      compactReplay: true, opponentIdentity: record.scenario.opponentPolicyVersion });
    for (const [i, entry] of recovered.save.replaySteps.entries()) {
      const a = env.legalActions().find(a => a.actionId === entry.action.actionId && a.actorId === entry.actorPlayerId);
      assert(a, `board ${row.number}, input ${i + 1}`);
      if (a.actorId === white && a.family === 'pass') {
        const cp = env.createCheckpoint().coreState;
        const state = cp.compositionEnvelope.session?.session?.workingState || JSON.parse(cp.committedState);
        const p = state.players.players.find(p => p.id === white);
        replayEnds.push(asset(state.turn.roundNumber, p.resources.score, p.techState, p.income, p.resources));
      }
      assert(env.step(a).ok, `board ${row.number}, input ${i + 1}`);
    }
    assert(env.isTerminal());
    assert.deepEqual(env.createCheckpoint().coreState.compositionEnvelope, recovered.checkpoint.coreState.compositionEnvelope);
    assert.deepEqual(replayEnds.slice(0, ends.length), ends);
    assert.deepEqual(replayEnds.map(x => x.round), [1, 2, 3, 4]);
    assert.equal(replayEnds[3].score, fix.base);
    assert.equal(recovered.white.totalScore, fix.score);
  } finally {
    env.dispose();
  }
  return { ...row, repair: fix, ends: replayEnds };
});
fs.writeFileSync(process.argv[2], JSON.stringify({ phase: 'before-pass-card-and-income', verified, repaired, rows }, null, 2) + '\n');
