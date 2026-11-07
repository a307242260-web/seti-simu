'use strict';

const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {createSimulationRuleComposition} = require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom} = require('../randomizer/game/random');
const {buildRuleObservation} = require('../randomizer/app/rule-observation');
const {computePlayerFinalScore} = require('../randomizer/game/end-game-scoring');
const cardEffects = require('../randomizer/game/cards/effects');
const dataModule = require('../randomizer/game/data');

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
  const card = c => c && [c.id, c.cardId, c.incomeCode];
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
    finalScoring: s.finalScoring, sectorSettlements: s.data.sectorSettlements,
    paidTasks: p.reservedCards.map(c=>[c.cardId,c.cardEffectState?.completedTaskIds||[]]),
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

const common = new Map();
function useCommon(key, execute) {
  const before = snapshot(), from = path.length;
  if(common.has(key)) {
    const saved=common.get(key);
    assert.deepEqual(before,saved.before);
    restore(saved.after);
    assert.deepEqual(snapshot(),saved.after);
    path.push(...saved.actions);
    return saved.checkpoints;
  }
  const checkpoints=execute();
  common.set(key,{before,after:snapshot(),actions:path.slice(from),checkpoints});
  return checkpoints;
}
function keepCompanyMars() {
  return useCommon('mars',prepareMars);
}
function prepareMars() {
  const before = report();
  const supply = before.publicCards.find(([,id]) => id === 'dlc_31.png');
  const input = before.hand.find(([,id]) => id === 'dlc_32.png');
  assert(supply && input);
  pick('card_corner', a => a.target.cardInstanceId === input[0]);
  place('blueBonus', 2);
  pick('choose_card', a => a.target.cardInstanceId === supply[0]);
  const acquired = report();
  replay(154, 161);
  pick('play_card', a => a.target.cardInstanceId === supply[0]);
  replay(163, 164);
  const landed = report();
  replay(165, 174);
  return {acquired, landed, menu: show()};
}
function winBlack() { return useCommon('black',playBlack); }
function playBlack() {
  const prefix = keepCompanyMars();
  const held = report().hand.find(([,id])=>id==='dlc_19.png');
  assert(held, 'DLC19 must be visible in hand before using its identity');
  pick('play_card', a=>a.target.cardInstanceId===held[0]);
  for(let i=0;i<2;i++) pick('choose_target',a=>a.target.nebulaId==='sector-1-b');
  pick('choose_target',a=>a.target.choiceId==='trace:1:pink:amiba:4');
  pick('choose_card',a=>a.target.choiceId==='amiba:display:9');
  pick('end_turn');
  return {...prefix, afterBlack:report()};
}
function scanRed() { return useCommon('red',playRed); }
function playRed() {
  const prior=winBlack();
  pick('quick_trade',a=>a.target.tradeId==='cards-for-energy');
  for(const id of ['alien-amiba-1-2','alien-amiba-0-1']) pick('choose_payment',a=>a.target.cardInstanceId===id&&a.target.select===true);
  pick('choose_payment',a=>a.target.confirm===true);
  pick('scan');
  pick('choose_target',a=>a.target.nebulaId==='sector-3-a');
  pick('choose_card',a=>a.target.cardInstanceId==='card-61-0'&&a.target.nebulaId==='sector-3-a');
  pick('choose_target',a=>a.target.choiceId==='trace:1:pink:state-extra');
  return {...prior, afterRed:report()};
}
function research(tile) {
  pick('research_tech');
  pick('choose_target',a=>a.target.tileId===tile&&(tile!=="blue1"||a.target.blueSlot===3));
}
function researchPair(tile) {
  const prior=scanRed();
  pick('end_turn');
  const pendingTask=snapshot();
  pick('accept_optional_effect',a=>a.target.choiceId==='skip:task:card-15-0:dlc9-three-sector-wins');
  research('purple1');
  const afterFirstResearch=report();
  pick('complete_task',a=>a.target.cardInstanceId==='card-15-0'&&a.target.ruleId==='dlc9-three-sector-wins');
  const funded=report();
  pick('end_turn');
  research(tile);
  if(tile==='orange1') pick('choose_card',a=>a.target.cardInstanceId==='card-60-0');
  return {...prior,pendingTask,afterFirstResearch,funded,afterSecondResearch:report()};
}
function finishThird(tile) { return useCommon('through-amiba7-'+tile,()=>playAmiba7(tile)); }
function playAmiba7(tile) {
  const prior=researchPair(tile);
  pick('end_turn');
  place('computer');
  place('computer');
  const computerReady=report();
  pick('analyze');
  pick('choose_target',a=>a.target.choiceId==='trace:1:blue:amiba:4');
  pick('choose_card',a=>a.target.choiceId==='amiba:display:7');
  pick('end_turn');
  const amiba=report().hand.find(([,id])=>id==='amiba_7.webp');
  const supply=report().publicCards.find(row=>row&&row[1]==='b_16.webp');
  assert(amiba&&supply);
  pick('play_card',a=>a.target.cardInstanceId===amiba[0]);
  pick('choose_card',a=>a.target.source==='public'&&a.target.slotIndex===report().publicCards.findIndex(row=>row&&row[0]===supply[0]));
  pick('choose_target',a=>a.target.choiceId==='symbol:blue_2');
  pick('end_turn');
  assert(menu().some(a=>a.family==='pass'&&a.actorId===seat));
  return {...prior, computerReady};
}
function thirdTech(tile, supply) {
  const prior=finishThird('purple2');
  const beforeFunding=report();
  assert.equal(beforeFunding.wallet.publicity,3);
  const amiba9=beforeFunding.hand.find(([,id])=>id==='amiba_9.webp');
  const b16=beforeFunding.hand.find(([,id])=>id==='b_16.webp');
  assert(amiba9&&b16);
  pick('card_corner',a=>a.target.cardInstanceId===amiba9[0]);
  if(supply==='corner') pick('card_corner',a=>a.target.cardInstanceId===b16[0]);
  else {place('computer');place('computer');}
  assert.equal(report().wallet.publicity,6);
  research(tile);
  if(tile==='orange1') pick('choose_card',a=>a.target.cardInstanceId==='card-60-0');
  pick('end_turn');
  assert(menu().some(a=>a.family==='pass'&&a.actorId===seat));
  return {...prior,beforeFunding,supply,tile};
}
try {
  const rows = [
    arm(151, 'v371-actual-mars', () => {replay(151, 174);return {menu: show()};}),
    arm(151, 'v371-actual-r3', () => {replay(151, 204);assert(menu().some(a=>a.family==='pass'));}),
    arm(151, 'blue3-supplies-mars-keeps-company', keepCompanyMars),
    arm(151, 'blue3-dlc19-win-black-then-paid-red', scanRed),
    ...['blue1','orange1','orange3','purple2'].map(tile=>arm(151, 'blue3-dual-win-purple1-'+tile, ()=>finishThird(tile))),
    ...[['orange1','corner'],['orange1','computer'],['blue1','computer'],['orange3','computer']].map(([tile,supply])=>
      arm(151, 'blue3-dual-win-third-'+tile+'-'+supply, ()=>thirdTech(tile,supply))),
  ];
  for (const r of rows) {
    const p = (r.endpoint.session?.session?.workingState||JSON.parse(r.endpoint.committedState)).players.players.find(x=>x.id===seat);
    console.log(JSON.stringify({name:r.name, inputs:r.path.length, wallet:r.end.wallet, income:r.end.income,
      hand:r.end.hand, publicCards:r.end.publicCards, projected:r.end.projected, tech:r.end.tech,
      data:r.end.data, rockets:r.end.rockets, companyRound:p.industryRoundMarkRound, menu:r.checkpoints.menu}));
  }
  const controlsInputs=totalInputs, verified=[];
  for(const name of ['blue3-dual-win-purple1-blue1','blue3-dual-win-third-orange1-computer','blue3-dual-win-third-blue1-computer']){
    const row=rows.find(x=>x.name===name);
    restore(roots.get(151).compositionEnvelope);
    const original=snapshot();
    path=[];
    for(const expected of row.path){
      const found=menu().find(a=>a.actionId===expected.actionId&&a.actorId===expected.actorId);
      assert(found, 'Missing replay action '+expected.actionId);
      const {originalStep,...action}=expected;
      assert.deepEqual(apply(found),action);
    }
    assert.deepEqual(snapshot(),row.endpoint);
    restore(original);
    assert.deepEqual(snapshot(),original);
    verified.push({name,inputs:path.length,endpointAndRngExact:true});
  }
  assert(controlsInputs<=256);
  if(output)fs.writeFileSync(output,JSON.stringify({scope:'Known DLC31 through a blue reward, then identical V371 Mars and initial income actions. Later use DLC19 only from a real revealed hand and target known sector/task rewards; stop before R3 PASS.',manifest:manifestPath,manifestSha256:sha(manifestPath),controlsInputs,rows,verified,rootAndRngRestored:true,newAutonomousRuns:0},null,2)+'\n',{flag:'wx'});
} finally {
  composition.dispose();
}
