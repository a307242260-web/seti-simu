// 归档四次既有冷搜索及科技失效估值反例，无新搜索。
const fs = require('node:fs'), assert = require('node:assert/strict');
const evaluator = require('../randomizer/game/ai/expected-score-evaluator');
const outcome = require('../randomizer/game/ai/outcome-model');
const playerTech = require('../randomizer/game/tech/player-tech');
const output = 'reports/iteration/alien-pick-brown-cross-summary-20260908.json';
if (fs.existsSync(output)) { console.log('已有交叉汇总：' + output); process.exit(0); }
const rows = [];
for (const board of ['baseline', 'candidate']) for (const policy of ['baseline', 'candidate']) {
  const file = `reports/iteration/alien-pick-brown-cross-${board}-${policy}-20260908.json`;
  const r = JSON.parse(fs.readFileSync(file)); assert.equal(r.passed, true);
  rows.push({ board, policy, file, nodes: r.diagnostics.executedNodeCount,
    executionLimitReached: r.diagnostics.executionLimitReached, beamPrunedOriginCount: r.diagnostics.beamPrunedOriginCount,
    chosen: r.captures[0].chosen.family, plans: r.captures[0].ranked
      .filter(x => ['orbit', 'research_tech'].includes(x.action.family)).map(x => ({
        family: x.action.family, score: x.evaluation.score, actualScoreDelta: x.evaluation.actualScoreDelta,
        techValue: x.evaluation.techValue, incomeValue: x.evaluation.incomeValue,
        publicityResearchValue: x.evaluation.publicityResearchValue, incomeDelta: x.evaluation.incomeDelta,
        steps: x.leaf.planSteps.map(s => s.action),
      })) });
}
for (const policy of ['baseline', 'candidate']) {
  assert.deepEqual(rows.filter(r => r.policy === policy).map(r => r.plans.map(p => p.score))[0],
    rows.filter(r => r.policy === policy).map(r => r.plans.map(p => p.score))[1]);
}
const captured = JSON.parse(fs.readFileSync('reports/iteration/alien-pick-brown-cross-baseline-candidate-20260908.json'));
const actualLeaf = captured.captures[0].ranked.find(x => x.action.family === 'research_tech').leaf.observation;
const enabled = structuredClone(actualLeaf);
const p = enabled.publicState.players.find(p => p.playerId === 'player-brown');
assert.equal(p.techState.disabledTiles.purple2, true);
delete p.techState.disabledTiles.purple2;
const disabled = structuredClone(enabled), q = disabled.publicState.players.find(p => p.playerId === 'player-brown');
assert.equal(playerTech.removePlayerTile(q.techState, 'purple2').ok, true);
assert.deepEqual(q.techState, actualLeaf.publicState.players.find(p => p.playerId === 'player-brown').techState);
const seat = 'player-brown';
const before = outcome.createDecisionObservation(enabled, { seatId: seat });
const after = outcome.createDecisionObservation(disabled, { seatId: seat });
const beforeV = evaluator.evaluateStateValue(before, seat), afterV = evaluator.evaluateStateValue(after, seat);
const bug = { tile: 'purple2', ownedBefore: playerTech.playerOwnsTile(p.techState, 'purple2'),
  ownedAfter: playerTech.playerOwnsTile(q.techState, 'purple2'),
  activeBefore: playerTech.playerHasActiveTile(p.techState, 'purple2'),
  activeAfter: playerTech.playerHasActiveTile(q.techState, 'purple2'),
  projectionOwnedBefore: before.outcomeProjection.progress.ownedTechIds,
  projectionOwnedAfter: after.outcomeProjection.progress.ownedTechIds,
  techFutureBefore: beforeV.components.techEfficiencyValue,
  techFutureAfter: afterV.components.techEfficiencyValue,
  beforeV, afterV };
assert.equal(bug.activeBefore, true); assert.equal(bug.activeAfter, false);
assert.deepEqual(beforeV, afterV, '现有估值缺陷：仅使科技失效，V完全不变');
const result = { rows, bug, conclusion: '两盘面上旧搜索均环绕32.3333，新搜索均研究41.6667；改选来自搜索，而非此前盘面。正式失效的紫2仍被算作20未来价值，已复现独立估值缺陷；尚未证明其解释棕方终局14分下降。' };
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, choices: rows.map(r => ({ board: r.board, policy: r.policy, chosen: r.chosen })),
  activeBefore: bug.activeBefore, activeAfter: bug.activeAfter, unchangedV: true, beforeV, afterV }));
