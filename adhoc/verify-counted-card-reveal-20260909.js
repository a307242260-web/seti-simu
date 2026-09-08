// 定向反事实：根只知道b98，盲抽后数量移动不能读取未知角标；不跑AI整局。
const fs = require('node:fs'), assert = require('node:assert/strict');
const source = '/private/tmp/seti-counted-card-reveal-20260909';
const { execFileSync } = require('node:child_process');
const sourceCommit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.ok(sourceCommit.startsWith('872d80c7'));
assert.equal(execFileSync('git', ['-C', source, 'diff', 'HEAD', '--'], { encoding: 'utf8' }), '', '仅验证冻结的候选代码');
const knownMove = process.argv.includes('--known-move');
const { createSimulationRuleComposition } = require(source + '/randomizer/game/production-kernel');
const { createSeededRandom, RNG_ALGORITHM } = require(source + '/randomizer/game/random');
const cards = require(source + '/randomizer/game/cards/deck');
const { buildRuleObservation } = require(source + '/randomizer/app/rule-observation');
const launchTrigger = process.argv.includes('--launch-trigger');
const output = `reports/iteration/counted-reveal-${launchTrigger ? 'trigger' : 'trade'}-${knownMove ? 'known1' : 'known0'}-872d80c7-20260909.json`;
if (fs.existsSync(output)) { console.log('已有检查点：' + output); process.exit(0); }
const report = { sourceCommit, source, scope: launchTrigger
  ? '两种隐藏牌面替换，已知b98发射触发已打出DLC23盲抽'
  : '两种隐藏牌面替换，仅定向执行交易盲抽→已知b98', cases: [] };
for (const moveCorner of [false, true]) {
  const envelope = structuredClone(require('../reports/iteration/blue50-expiry-baseline-20260908.json').rootEnvelope);
  const root = JSON.parse(envelope.committedState), actorId = 'player-blue';
  const actor = root.players.players.find(p => p.id === actorId);
  actor.hand = [cards.createCommittedCardInstance(root, cards.CARD_CATALOG.find(c => c.card_id === 'b_98.webp'))];
  actor.resources.handSize = 1;
  actor.resources.publicity = 3;
  if (knownMove) {
    const entry = cards.getAvailablePool(root.cards, root.players).find(c => c.discard_action_code === 2);
    assert.ok(entry);
    actor.hand.push(cards.createCommittedCardInstance(root, entry));
    actor.resources.handSize += 1;
  }
  if (launchTrigger) {
    const trigger = cards.CARD_CATALOG.find(c => c.card_id === 'dlc_23.png');
    assert.ok(trigger);
    actor.reservedCards.push(cards.createCommittedCardInstance(root, trigger));
  }
  const future = cards.getAvailablePool(root.cards, root.players)
    .find(c => (c.discard_action_code === 2) === moveCorner);
  assert.ok(future); root.cards.drawPileCardIds = [future.card_id];
  envelope.committedState = JSON.stringify(root);
  const random = createSeededRandom(root.meta.seed);
  const composition = createSimulationRuleComposition({ seed: root.meta.seed, activePlayerCount: 4, random,
    projectCounterfactualState: (state, viewer) => buildRuleObservation(state, root.meta.seed, viewer?.playerId || null, [], { cheap: viewer?.cheap === true }),
    rngState: { algorithm: RNG_ALGORITHM, state: random.getState() } }).composition;
  const evidence = { moveCorner, futureCard: future.card_id, observations: [] };
  try {
    const restored = composition.lifecycle.restore(envelope, { silent: true });
    assert.equal(restored.ok, true, JSON.stringify(restored));
    const before = composition.lifecycle.save().envelope;
    const trade = composition.inputPort.enumerateActions().find(a => launchTrigger
      ? a.family === 'play_card' && a.target.cardInstanceId === actor.hand[0].id
      : a.family === 'quick_trade' && a.target.tradeId === 'publicity-for-card');
    assert.ok(trade);
    const outcomes = composition.counterfactualPort.evaluate([trade], {
      viewer: { playerId: actorId, role: 'player' }, maxNodes: 40, maxExecutionNodes: 80,
      maxFrontierNodes: 40, maxDepth: 15,
      secondaryAgentSearch: { focalSeatId: actorId, maxProxyDepth: 3,
        selectRouteTarget: () => 'diagnostic:known-count-move',
        completesRouteTarget: () => false,
        selectSuccessors({ currentAction, branchObservation, legalSuccessors }) {
          evidence.observations.push({ after: currentAction, hand: branchObservation.selfState?.hand,
            informationBoundary: branchObservation.informationBoundary,
            movementContext: branchObservation.probeRouteRequirements?.movementContext,
            choices: legalSuccessors });
          const blind = legalSuccessors.find(a => a.family === 'choose_card' && a.target.source === 'blind');
          if (blind) return [blind];
          if (launchTrigger) {
            const trigger = legalSuccessors.find(a => a.family === 'accept_optional_effect'
              && a.target.ruleId === 'dlc23-launch-draw');
            if (trigger) return [trigger];
          }
          const play = legalSuccessors.find(a => a.family === 'play_card' && a.target.cardInstanceId === actor.hand[0].id);
          if (play) return [play];
          const launch = legalSuccessors.find(a => String(a.target?.choiceId || '').startsWith('launch:'));
          return launch ? [launch] : [];
        },
      },
    });
    evidence.rootObservation = outcomes[0]?.rootObservation;
    evidence.diagnostics = composition.counterfactualPort.getDiagnostics();
    assert.ok(outcomes.every(o => o.status !== 'failed'), JSON.stringify(outcomes.map(o => ({ status: o.status, code: o.code }))));
    assert.deepEqual(evidence.diagnostics.failedNodeCountByCode, {});
    assert.deepEqual(composition.lifecycle.save().envelope, before);
    if (launchTrigger) assert.ok(evidence.observations.some(o => o.after.family === 'accept_optional_effect'),
      '必须实际接受发射抽牌触发');
    assert.ok(evidence.observations.some(o => o.after.family === 'play_card'),
      '必须实际到达b98打牌后：' + JSON.stringify({ observations: evidence.observations.map(o => ({ after: o.after.family, choices: o.choices.map(a => ({ family: a.family, target: a.target })) })),
        diagnostics: evidence.diagnostics, outcomes: outcomes.map(o => ({ status: o.status, code: o.code })) }));
    evidence.exposedMove = evidence.observations.some(o => o.informationBoundary
      && o.movementContext?.phase === 'card' && o.movementContext.cardRemaining > 0);
    report.cases.push(evidence);
  } finally { composition.dispose(); }
}
assert.deepEqual(report.cases[0].rootObservation, report.cases[1].rootObservation,
  '两个搜索根的可见信息必须相同');
assert.deepEqual(report.cases[0].observations, report.cases[1].observations,
  '替换隐藏牌面不能改变允许的后继、手牌观察和移动额度');
for (const entry of report.cases) {
  const last = entry.observations.at(-1);
  assert.equal(last.movementContext.cardRemaining, knownMove ? 1 : 0,
    '只计已知展示牌；必须保留已知移动收益');
  assert.ok(last.informationBoundary, '展示后仍保留抽牌信息屏障');
}
report.reproduced = false;
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, reproduced: report.reproduced, cases: report.cases.map(c => ({
  futureCard: c.futureCard, exposedMove: c.exposedMove, nodes: c.diagnostics.executedNodeCount })) }));
