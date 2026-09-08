const fs = require('node:fs'), assert = require('node:assert/strict');
const source = '/private/tmp/seti-counted-card-reveal-20260909';
const { createSimulationRuleComposition } = require(source + '/randomizer/game/production-kernel');
const { createSeededRandom, RNG_ALGORITHM } = require(source + '/randomizer/game/random');
const cards = require(source + '/randomizer/game/cards/deck');
const { buildRuleObservation } = require(source + '/randomizer/app/rule-observation');
const outcomeModel = require(source + '/randomizer/game/ai/outcome-model');
const { createHeuristicDecisionFunction } = require(source + '/randomizer/game/ai/heuristic-decision-function');
const working = process.argv.includes('--working');
const cp = require('node:child_process');
const sourceCommit = cp.execFileSync('git', ['-C', source, 'rev-parse', '--short=8', 'HEAD'], { encoding: 'utf8' }).trim();
const output = `reports/iteration/counted-reveal-large-hand-${working ? 'working-v2' : sourceCommit}-20260909.json`;
const sourceDiff = cp.execFileSync('git', ['-C', source, 'diff', 'HEAD', '--'], { encoding: 'utf8' });
if (!working) assert.equal(sourceDiff, '');
const sourceDiffSha256 = require('node:crypto').createHash('sha256').update(sourceDiff).digest('hex');
if (fs.existsSync(output)) {
  const saved = JSON.parse(fs.readFileSync(output));
  console.log('已有检查点：' + output);
  process.exit(saved.passed === false ? 1 : 0);
}
const records = [];
for (const count of [34]) {
  const envelope = structuredClone(require('../reports/iteration/blue50-expiry-baseline-20260908.json').rootEnvelope);
  const root = JSON.parse(envelope.committedState), seatId = 'player-blue';
  const actor = root.players.players.find(p => p.id === seatId);
  actor.hand = [cards.createCommittedCardInstance(root, cards.CARD_CATALOG.find(c => c.card_id === 'b_98.webp'))];
  for (const entry of cards.getAvailablePool(root.cards, root.players).filter(c => c.discard_action_code === 2).slice(0, count)) {
    actor.hand.push(cards.createCommittedCardInstance(root, entry));
  }
  actor.resources.handSize = actor.hand.length;
  envelope.committedState = JSON.stringify(root);
  const random = createSeededRandom(root.meta.seed);
  const { composition } = createSimulationRuleComposition({ seed: root.meta.seed, activePlayerCount: 4, random,
    rngState: { algorithm: RNG_ALGORITHM, state: random.getState() },
    projectCounterfactualState: (state, viewer) => buildRuleObservation(state, root.meta.seed, viewer?.playerId || null, [], { cheap: viewer?.cheap === true }),
  });
  try {
    assert.equal(composition.lifecycle.restore(envelope, { silent: true }).ok, true);
    const play = composition.inputPort.enumerateActions().find(a => a.family === 'play_card' && a.target.cardInstanceId === actor.hand[0].id);
    assert.ok(play);
    assert.equal(composition.inputPort.submitAction(play).ok, true);
    const pending = composition.inspect();
    assert.equal(pending.phase, 'awaiting_input');
    const legalActions = pending.session.decision.choices;
    assert.ok(legalActions.every(a => a.target.kind === 'counted-move-reveal'), JSON.stringify(legalActions.map(a => ({ family: a.family, target: a.target }))));
    assert.equal(legalActions.length, count + 1);
    const expected = count ? legalActions.find(a => a.target.cardInstanceId === actor.hand[1].id) : legalActions[0];
    const observation = outcomeModel.createDecisionObservation(composition.projection({ playerId: seatId, role: 'player' }).state,
      { seatId, stateVersion: legalActions[0].stateVersion, decisionVersion: legalActions[0].decisionVersion });
    const before = composition.lifecycle.save().envelope;
    const started = performance.now();
    const decision = createHeuristicDecisionFunction({ composition }).run({ seatId, legalActions, observation });
    assert.equal(decision.actionId, expected.actionId);
    assert.deepEqual(composition.lifecycle.save().envelope, before);
    assert.ok(decision.searches.every(s => Object.keys(s.diagnostics.failedNodeCountByCode).length === 0));
    const submits = decision.searches.reduce((sum, search) => sum + search.diagnostics.successfulInputSubmissionCount, 0);
    if (submits !== count + 1) {
      const failed = { sourceCommit, passed: false, count, submits,
        searches: decision.searches, outcomes: decision.actionOutcomes.map(outcome => ({
          actionId: outcome.actionId, status: outcome.status, code: outcome.code,
          completeness: outcome.searchCompleteness,
          leaves: outcome.leaves.map(leaf => ({ terminalReason: leaf.terminalReason,
            movement: leaf.observation.probeRouteRequirements?.movementContext })),
        })) };
      fs.writeFileSync(output, JSON.stringify(failed, null, 2) + '\n', { flag: 'wx' });
      console.log(JSON.stringify(failed));
    }
    assert.equal(submits, count + 1, '越过32次自动结算保护后，仍须完整展示并结束，不枚举排列');
    assert.ok(decision.searches.every(search => !search.diagnostics.executionLimitReached));
    const record = { count, submits, actionId: decision.actionId, target: expected.target, milliseconds: performance.now() - started,
      searches: decision.searches };
    records.push(record);
    console.log(JSON.stringify(record));
  } finally { composition.dispose(); }
}
fs.writeFileSync(output, JSON.stringify({ source, sourceCommit, working, sourceDiffSha256, passed: true, records }, null, 2) + '\n', { flag: 'wx' });
