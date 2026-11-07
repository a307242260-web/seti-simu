'use strict';

const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {createSimulationRuleComposition} = require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom} = require('../randomizer/game/random');
const {buildRuleObservation} = require('../randomizer/app/rule-observation');
const {computePlayerFinalScore} = require('../randomizer/game/end-game-scoring');
const cardEffects = require('../randomizer/game/cards/effects');
const {passiveAgent} = require('../tools/research-human405-round1');

const read = p => JSON.parse(fs.readFileSync(p));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const wire = value => JSON.parse(JSON.stringify(value));
const [manifestPath, output] = process.argv.slice(2);
const manifest = read(manifestPath);
const roots = new Map(manifest.rows.map(row => {
  assert.equal(sha(row.fixture), row.fixtureSha256);
  return [row.step, read(row.fixture)];
}));
const seat = 'player-white';
const seed = roots.get(151).source.seed;
const recordPath = roots.get(151).source.record;
assert.equal(sha(recordPath), roots.get(151).source.recordSha256);
const record = read(recordPath);
const proof = read(roots.get(151).source.proof);
assert.equal(sha(record.savePath), proof.saveSha256);
const history = read(record.savePath).replaySteps;
const rules = createSimulationRuleComposition({
  seed, random: createSeededRandom(seed), activePlayerCount: 4, trustedProjectionReader: true,
  projectCounterfactualState: (s, w) => buildRuleObservation(s, seed, w?.playerId),
});
rules.newGame({seed});
const composition = rules.composition;
const snapshot = () => composition.lifecycle.save().envelope;
const decision = () => composition.inspect().session?.decision;
const state = () => {
  const e = snapshot();
  return e.session?.session?.workingState || JSON.parse(e.committedState);
};
const menu = () => decision()?.choices || composition.inputPort.enumerateActions({});
const show = () => menu().map(a => [a.family, a.target]);
const restore = e => {
  const r = composition.lifecycle.restore(e);
  assert(r.ok, JSON.stringify(r));
};
let totalInputs = 0;
let path = [];
function apply(a) {
  assert(a, JSON.stringify(show()));
  const d = decision();
  const r = d ? composition.inputPort.submitDecision({
    decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: a,
  }) : a.phase === 'quick' ? composition.inputPort.submitQuickAction(a) : composition.inputPort.submitAction(a);
  assert(r.ok, JSON.stringify(r));
  totalInputs++;
  const action = wire({actionId: a.actionId, family: a.family, actorId: a.actorId, target: a.target, payload: a.payload});
  path.push(action);
  return action;
}
function pick(family, predicate = () => true) {
  const matched = menu().filter(a => a.family === family && a.actorId === seat && predicate(a));
  assert.equal(matched.length, 1, JSON.stringify(show()));
  return apply(matched[0]);
}
function replay(first, last, stopOnMissing = false) {
  for (let step = first; step <= last; step++) {
    const row = history[step - 1];
    const action = menu().find(a => a.actorId === row.actorPlayerId && a.actionId === row.action.actionId);
    if (!action && stopOnMissing) return {step, expected: row.action, menu: show(), state: report()};
    assert(action, 'Original Native input unavailable at ' + step + ': ' + JSON.stringify(show()));
    assert.deepEqual(wire(action.target), row.action.target, 'Original Native target at ' + step);
    apply(action).originalStep = step;
  }
  return null;
}
function report() {
  const s = state(), p = s.players.players.find(player => player.id === seat);
  const o = composition.projection({role: 'player', playerId: seat}).state;
  const card = c => [c.id, c.cardId, c.incomeCode];
  const projectedBreakdown = computePlayerFinalScore({
    ...s, players: s.players.players, currentPlayer: p, finalScoring: structuredClone(s.finalScoring), cardEffects,
    getCardTypeCode: card => cardEffects.getRuntimeCardTypeCode(card, cardEffects.getCardModel(card)?.cardType),
  }, p);
  assert.equal(projectedBreakdown.totalScore, o.publicState.players.find(x => x.playerId === seat).finalScore);
  return {
    round: s.turn.roundNumber, cycle: s.turn.actionCycleNumber, mainActionCompleted: p.mainActionCompleted,
    wallet: p.resources, income: p.income, tech: p.techState, hand: p.hand.map(card),
    publicCards: s.cards.publicCards.map(card), reservedCards: p.reservedCards.map(card),
    data: p.dataState, rockets: s.pieces.rockets.filter(r => r.playerId === seat),
    traces: o.selfState.traceCounts, projectedBreakdown, projected: o.publicState.players.find(x => x.playerId === seat).finalScore,
  };
}
function place(target, blueSlot = null) {
  pick('place_data');
  return pick('choose_target', a => a.target.target === target && a.target.blueSlot === blueSlot);
}
function arm(step, name, execute) {
  restore(roots.get(step).compositionEnvelope);
  const root = snapshot();
  assert.deepEqual(root, roots.get(step).compositionEnvelope);
  path = [];
  const start = report();
  const checkpoints = execute() || {};
  const end = report(), endpoint = snapshot();
  restore(root);
  assert.deepEqual(snapshot(), root);
  return {step, name, start, path, checkpoints, end, endpoint, rootRestoredExactly: true};
}
function assertPassAvailable() {
  assert(!decision());
  assert(menu().some(a => a.actorId === seat && a.family === 'pass'), JSON.stringify(show()));
}
let marsLandingPrefix;
function replayMarsLanding() {
  assert.deepEqual(snapshot(), roots.get(151).compositionEnvelope);
  if (!marsLandingPrefix) {
    replay(151, 164);
    marsLandingPrefix = {envelope: snapshot(), path: path.slice()};
  } else {
    restore(marsLandingPrefix.envelope);
    assert.deepEqual(snapshot(), marsLandingPrefix.envelope);
    path.push(...marsLandingPrefix.path);
  }
}
function marsRoute(source, card) {
  replayMarsLanding();
  const landed = report();
  assert(landed.publicCards.some(([id]) => id === card), 'Only choose a public card known before the preparation');
  if (source === 'blue3') place('blueBonus', 2);
  else pick('quick_trade', a => a.target.tradeId === 'publicity-for-card');
  pick('choose_card', a => a.target.cardInstanceId === card);
  place('computer');
  pick('choose_card', a => a.target.cardInstanceId === card);
  if (source === 'publicity') place('blueBonus', 1);
  const prepared = report();
  replay(170, 174);
  return {landed, prepared, followUpMenu: show()};
}
function marsKnownSuffix(source, card, currency, tile = null) {
  const preparation = marsRoute(source, card);
  const beforeFunding = report();
  if (beforeFunding.wallet.energy === 0) pick('quick_trade', a => a.target.tradeId === 'credits-for-energy');
  if (report().wallet.energy === 1) {
    pick('quick_trade', a => a.target.tradeId === 'cards-for-energy');
    for (const id of ['alien-amiba-1-2', 'card-29-pass-2-5']) {
      pick('choose_payment', a => a.target.cardInstanceId === id && a.target.select === true);
    }
    pick('choose_payment', a => a.target.confirm === true);
  }
  const funded = report();
  assert.equal(funded.wallet.energy, 2);
  // The common recorded scan targets the untouched slot 2. Stop before a later
  // public selection could choose a replacement whose identity was unknown.
  const missing = replay(179, tile ? 189 : currency === 'credits' ? 201 : 204, true);
  if (!missing && tile) lateTech(tile, true);
  if (!missing && currency === 'energy') assertPassAvailable();
  return {...preparation, beforeFunding, funded, missing,
    stoppedBeforeReplacement: !missing && currency === 'credits'};
}
function lateTech(tile, analysis) {
  replay(190, 190);
  pick('choose_target', a => a.target.tileId === tile);
  const acquired = report();
  replay(192, 192);
  place('computer');
  place('computer');
  const computerReady = report();
  assert.equal(computerReady.data.placedTokens.filter(t => t.placementKind === 'computer').length, 6);
  if (analysis) replay(197, 204);
  assertPassAvailable();
  return {acquired, computerReady};
}
function enterRoundFour() {
  const prePass = snapshot();
  const pathStart = path.length;
  pick('pass');
  pick('choose_card', a => a.target.cardId === 'b_32.webp');
  for (let i = 0; i < 12; i++) {
    const other = decision()?.ownerId || state().turn.currentPlayerId;
    if (other === seat) break;
    const observation = composition.projection({role: 'player', playerId: other}).state;
    const actions = menu();
    const id = passiveAgent(other).decide({observation, legalActions: actions}).actionId;
    const action = actions.find(a => a.actionId === id);
    assert(action?.actorId === other && (action.family === 'pass' || decision()?.ownerId === other));
    apply(action);
  }
  assert.equal(state().turn.roundNumber, 4);
  assert.equal(state().turn.currentPlayerId, seat);
  const r4Start = report();
  const startEnvelope = snapshot();
  const entryPath = path.splice(pathStart);
  pick('scan');
  pick('choose_target', a => a.target.choiceId === 'nebula:sector-4-b');
  pick('choose_card', a => a.target.choiceId === 'public:card-64-0:sector-4-a');
  pick('choose_card', a => a.target.choiceId === 'public:done');
  pick('choose_target', a => a.target.choiceId === 'scan4:skip');
  assert(!decision());
  const afterScan = report();
  const b32 = r4Start.hand.find(([, id]) => id === 'b_32.webp');
  assert(b32 && b32[2] === 2, 'Common known PASS card is the card-income supplier');
  assert([2, 4].includes(afterScan.wallet.availableData));
  for (let i = 0; i < afterScan.wallet.availableData; i++) place('computer');
  if (afterScan.wallet.availableData === 4) pick('choose_card', a => a.target.cardInstanceId === b32[0]);
  assert(!decision());
  const sharedScan = {path: path.splice(pathStart), afterScan, afterData: report(), envelope: snapshot()};
  restore(prePass);
  assert.deepEqual(snapshot(), prePass);
  return {entryPath, r4Start, startEnvelope, sharedScan};
}
const cases = [
  [151, 'mars-actual-card-income', () => {
    replayMarsLanding(); const landed = report(); replay(165, 169); const prepared = report();
    replay(170, 174); return {landed, prepared, followUpMenu: show()};
  }],
  [151, 'mars-blue3-credit-income', () => marsRoute('blue3', 'card-49-0')],
  [151, 'mars-blue3-energy-income', () => marsRoute('blue3', 'card-60-0')],
  [151, 'mars-publicity-credit-income', () => marsRoute('publicity', 'card-49-0')],
  [151, 'mars-publicity-energy-income', () => marsRoute('publicity', 'card-60-0')],
  [151, 'mars-blue3-credit-income-suffix', () => marsKnownSuffix('blue3', 'card-49-0', 'credits')],
  [151, 'mars-blue3-energy-income-suffix', () => marsKnownSuffix('blue3', 'card-60-0', 'energy')],
  [151, 'mars-publicity-energy-income-suffix', () => marsKnownSuffix('publicity', 'card-60-0', 'energy')],
  [151, 'mars-blue3-energy-blue4-r4', () => ({...marsKnownSuffix('blue3', 'card-60-0', 'energy', 'blue4'), r4: enterRoundFour()})],
  [151, 'mars-blue3-energy-purple1-r4', () => ({...marsKnownSuffix('blue3', 'card-60-0', 'energy', 'purple1'), r4: enterRoundFour()})],
  [151, 'mars-blue3-energy-orange3-r4', () => ({...marsKnownSuffix('blue3', 'card-60-0', 'energy', 'orange3'), r4: enterRoundFour()})],
  [197, 'late-analysis-actual-r4', () => {replay(197, 204); assertPassAvailable(); return {r4: enterRoundFour()};}],
  [190, 'late-research-purple1-r4', () => ({...lateTech('purple1', true), r4: enterRoundFour()})],
  [190, 'late-research-orange3-r4', () => ({...lateTech('orange3', true), r4: enterRoundFour()})],
  [197, 'late-analysis-actual', () => {replay(197, 204); assertPassAvailable();}],
  [197, 'late-analysis-defer-to-r4', () => {assertPassAvailable();}],
  ...['blue4', 'purple1', 'purple2', 'orange3', 'orange4'].map(tile => [190, 'late-research-' + tile + '-analysis', () => lateTech(tile, true)]),
  [190, 'late-research-purple1-defer-to-r4', () => lateTech('purple1', false)],
];
try {
  const casesSelected = process.env.SETI_REVIEW_CASE ? cases.filter(x => x[1] === process.env.SETI_REVIEW_CASE) : cases;
  assert(casesSelected.length);
  const rows = casesSelected.map(args => arm(...args));
  assert(totalInputs <= 600, 'Closed list of controls; no tree search');
  if (casesSelected.length === cases.length) {
    const named = Object.fromEntries(rows.map(row => [row.name, row]));
    const baseline = named['late-analysis-actual'];
    const exact = named['late-research-blue4-analysis'];
    assert.deepEqual(exact.endpoint, baseline.endpoint, 'Same actual Native endpoint from the two roots');
    const official = record.roundEnds.at(-1);
    assert.equal(baseline.end.wallet.score, official.score);
    assert.deepEqual(baseline.end.wallet, official.resources);
    assert.deepEqual(baseline.end.income, official.income);
    assert.deepEqual(baseline.end.tech, official.technology);
    for (const row of rows.filter(r => r.name.startsWith('mars-') && !r.name.endsWith('-suffix') && !r.name.endsWith('-r4'))) {
      assert.deepEqual(row.checkpoints.landed, rows[0].checkpoints.landed);
      assert.equal(row.end.wallet.score, rows[0].end.wallet.score);
      assert.deepEqual(row.end.traces, rows[0].end.traces);
    }
  }
  if (casesSelected.length === cases.length) {
    const byName = name => rows.find(r => r.name === name);
    const actual = byName('late-analysis-actual-r4').checkpoints.r4;
    const replacement = byName('mars-blue3-energy-purple1-r4').checkpoints.r4;
    assert.equal(actual.r4Start.projectedBreakdown.tileScoresById.a, 11);
    assert.equal(replacement.r4Start.projectedBreakdown.tileScoresById.a, 0);
    assert.equal(replacement.sharedScan.afterData.projectedBreakdown.tileScoresById.a, 11);
    const scanTargets = result => result.sharedScan.path.slice(0, 5).map(a => [a.family, a.target?.choiceId || a.target?.kind]);
    assert.deepEqual(scanTargets(replacement), scanTargets(actual));
  }
  if (output) {
    assert.equal(casesSelected.length, cases.length, 'Do not save an incomplete control');
    const result = {
      scope: 'Exact V371 actual roots; fixed Mars landing and known public income controls through common Amiba3 and B mark; second research and analysis controls through pre-PASS and an identical R4 opening scan/data funding with known B32, no search or autonomous run.',
      sourceRecord: recordPath, sourceRecordSha256: sha(recordPath), manifest: manifestPath, manifestSha256: sha(manifestPath),
      totalInputs, sharedExactNativePrefix: [151, 164], rootAndRngRestored: true, newAutonomousRuns: 0, rows,
    };
    fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
  }
  for (const r of rows) {
    const {wallet, income, data, hand, projected} = r.end;
    console.log(JSON.stringify({name: r.name, inputs: r.path.length, wallet, income, hand: hand.map(c=>c[1]),
      computer: data.placedTokens.filter(t=>t.placementKind==='computer').length,
      blue: data.placedTokens.filter(t=>t.placementKind==='blueBonus').map(t=>t.blueSlot),
      projected, projectedBreakdown:r.end.projectedBreakdown, r4:r.checkpoints.r4?.r4Start, scan:r.checkpoints.r4?.sharedScan && {afterScan:r.checkpoints.r4.sharedScan.afterScan.wallet, afterData:r.checkpoints.r4.sharedScan.afterData.wallet, projected:r.checkpoints.r4.sharedScan.afterData.projectedBreakdown}, missing:r.checkpoints.missing?.step, stoppedBeforeReplacement:r.checkpoints.stoppedBeforeReplacement, followUpMenu: r.checkpoints.followUpMenu?.map(([family, target]) => [family, target?.tradeId || target?.kind])}));
  }
} finally {
  composition.dispose();
}
