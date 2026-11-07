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
const [fixture, redPath, beforeAmiba, output] = process.argv.slice(2);
const roots = new Map([[182, read(fixture)],[179,read(beforeAmiba)]]);
assert.equal(roots.get(179).source.recordSha256,roots.get(182).source.recordSha256);
const red = read(redPath);
assert.equal(sha(fixture),red.fixtureSha256);
assert(red.rootAndRngRestored&&red.taskReady&&red.path.length===8);
const seat = 'player-white';
const seed = roots.get(182).source.seed;
const recordPath = roots.get(182).source.record;
assert.equal(sha(recordPath), roots.get(182).source.recordSha256);
const record = read(recordPath);
const proof = read(roots.get(182).source.proof);
assert.equal(sha(record.savePath), proof.saveSha256);
const history = read(record.savePath).replaySteps;
function make() {
  const rules = createSimulationRuleComposition({
    seed, random: createSeededRandom(seed), activePlayerCount: 4, trustedProjectionReader: true,
    projectCounterfactualState: (s, w) => buildRuleObservation(s, seed, w?.playerId),
  });
  rules.newGame({seed});
  return rules.composition;
}
const composition = make();
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
function submit(comp, d, a) {
  const r = d ? comp.inputPort.submitDecision({
    decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: a,
  }) : a.phase === 'quick' ? comp.inputPort.submitQuickAction(a) : comp.inputPort.submitAction(a);
  assert(r.ok, JSON.stringify(r));
}
const describe = a => wire({actionId: a.actionId, family: a.family, actorId: a.actorId, target: a.target, payload: a.payload});
function apply(a) {
  assert(a, JSON.stringify(show()));
  submit(composition, decision(), a);
  totalInputs++;
  const action = describe(a);
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

const task = 'dlc9-three-sector-wins';
function claim(mode) {
  if(mode==='direct')return pick('complete_task',a=>a.target.ruleId===task);
  return pick('accept_optional_effect',a=>a.target.choiceId.startsWith(mode+':task:')&&a.target.choiceId.endsWith(':'+task));
}
let opening='actual';
function redWin() {
  return useCommon('red:'+opening,()=>{
    if(opening==='actual'||opening==='red-pink2'){
      for(const x of red.path.slice(0,opening==='actual'?8:7))apply(menu().find(a=>a.actionId===x.id&&a.actorId===seat));
      if(opening==='actual')assert.deepEqual(snapshot(),red.endpoint);
      else pick('choose_target',a=>a.target.choiceId==='trace:1:pink:amiba:2');
    }else{
      pick('play_card',a=>a.target.cardInstanceId==='alien-amiba-3-3');
      pick('choose_target',a=>a.target.choiceId==='trace:pink:1');
      pick('end_turn');
      pick('quick_trade',a=>a.target.tradeId==='cards-for-energy');
      for(const id of ['alien-amiba-0-1','alien-amiba-1-2'])pick('choose_payment',a=>a.target.cardInstanceId===id&&a.target.select===true);
      pick('choose_payment',a=>a.target.confirm===true);
      pick('scan');
      pick('choose_target',a=>a.target.nebulaId==='sector-3-a');
      pick('choose_card',a=>a.target.nebulaId==='sector-3-a');
      pick('choose_target',a=>a.target.choiceId==='trace:1:pink:state-extra');
    }
    return {red:report()};
  });
}
function research(tile) {
  pick('research_tech');
  pick('choose_target',a=>a.target.tileId===tile&&(!['blue1','blue4'].includes(tile)||a.target.blueSlot===3));
  if(tile==='orange1')pick('choose_card',a=>a.target.cardInstanceId==='card-60-0');
}
function pair(second, mode='defer') {
  return useCommon('pair:'+opening+':'+second+':'+mode,()=>{
    const pre=redWin();
    pick('end_turn');
    const pending=snapshot();
    claim(mode==='defer'?'skip':'confirm');
    research('purple1');
    const afterFirst=report();
    if(mode==='defer')claim('direct');
    const funded=report();
    pick('end_turn');
    const available=menu().some(a=>a.family==='research_tech'&&a.actorId===seat);
    if(available)research(second);
    return {...pre,pending,afterFirst,funded,secondAvailable:available};
  });
}
function analyzeAndAmiba(second) {
  return useCommon('amiba:'+opening+':'+second,()=>{
    const pre=pair(second);
    assert(pre.secondAvailable);
    pick('end_turn');
    place('computer');
    place('computer');
    pick('analyze');
    pick('choose_target',a=>a.target.choiceId==='trace:1:blue:amiba:4');
    pick('choose_card',a=>a.target.choiceId==='amiba:display:7');
    pick('end_turn');
    const amiba=report().hand.find(([,id])=>id==='amiba_7.webp');
    const source=report().publicCards.findIndex(row=>row&&row[1]==='b_16.webp');
    assert(amiba&&source>=0);
    pick('play_card',a=>a.target.cardInstanceId===amiba[0]);
    pick('choose_card',a=>a.target.source==='public'&&a.target.slotIndex===source);
    if(opening!=='actual')pick('choose_target',a=>a.target.choiceId==='symbol:blue_2');
    else assert(!decision(),JSON.stringify(show()));
    pick('end_turn');
    assert(menu().some(a=>a.family==='pass'&&a.actorId===seat));
    return pre;
  });
}
function third(tile, funding, second='purple2') {
  const pre=analyzeAndAmiba(second);
  const before=report();
  pick('card_corner',a=>a.target.cardInstanceId===before.hand.find(([,id])=>id==='amiba_9.webp')[0]);
  if(funding==='computer'){place('computer');place('computer');}
  else if(funding==='corner')pick('card_corner',a=>a.target.cardInstanceId===before.hand.find(([,id])=>id==='b_16.webp')[0]);
  else if(funding==='both'){
    place('computer');place('computer');
    pick('card_corner',a=>a.target.cardInstanceId===before.hand.find(([,id])=>id==='b_16.webp')[0]);
  }
  if(!menu().some(a=>a.family==='research_tech'))return {...pre,before,blocked:show()};
  research(tile);
  pick('end_turn');
  assert(menu().some(a=>a.family==='pass'&&a.actorId===seat));
  return {...pre,before};
}
function verify(row) {
  const independent = make(), root = roots.get(row.step).compositionEnvelope;
  const save = () => independent.lifecycle.save().envelope;
  try {
    assert(independent.lifecycle.restore(root).ok);
    assert.deepEqual(save(),root);
    for(const {originalStep,...expected} of row.path){
      const d = independent.inspect().session?.decision;
      const a = (d?.choices||independent.inputPort.enumerateActions({})).find(x=>x.actionId===expected.actionId&&x.actorId===expected.actorId);
      assert(a,JSON.stringify(expected));
      assert.deepEqual(describe(a),expected);
      submit(independent,d,a);
    }
    assert.deepEqual(save(),row.endpoint);
    assert(independent.lifecycle.restore(root).ok);
    assert.deepEqual(save(),root);
    return {name:row.name,inputs:row.path.length,endpointAndRootExact:true};
  } finally { independent.dispose(); }
}
try {
  const cases=[
    ['actual',()=>replay(182,212)],
    ['immediate-task',()=>pair('purple2','immediate')],
    ...['blue1','purple2','orange1','orange3'].map(tile=>['red-purple1-'+tile,()=>analyzeAndAmiba(tile)]),
    ...[['orange1','held'],['orange1','computer'],['blue1','held'],['blue1','computer'],['orange3','held']].map(([tile,source])=>['red-third-'+tile+'-'+source,()=>third(tile,source)]),
  ];
  const chosen=name=>!process.env.SETI_CASE||process.env.SETI_CASE===name;
  const rows=cases.filter(([name])=>chosen(name)).map(([name,run])=>arm(182,name,run));
  opening='pink';
  for(const [tile,funding] of [['blue1','computer'],['orange1','computer'],['blue1','held']]){
    const name='pink-third-'+tile+'-'+funding;
    if(chosen(name))rows.push(arm(179,name,()=>third(tile,funding)));
  }
  opening='red-pink2';
  for(const [tile,funding,second] of [['blue1','computer','purple2'],['orange1','computer','purple2'],['orange1','corner','purple2'],
    ['orange1','both','blue1'],['blue1','both','orange1']]){
    const name='red-pink2-'+second+'-'+tile+'-'+funding;
    if(chosen(name))rows.push(arm(182,name,()=>third(tile,funding,second)));
  }
  for(const r of rows){
    const {wallet,income,data,hand,rockets,tech,projected,sectorSettlements}=r.end;
    console.log(JSON.stringify({name:r.name,wallet,income,data:data.placedTokens.map(x=>[x.placementKind,x.placementSlot??x.blueSlot]),hand,probe:rockets.length,
     tech:Object.keys(tech.ownedTiles),projected,wins:sectorSettlements.winsByPlayerId[seat].length,funded:r.checkpoints.funded?.wallet.publicity,before:r.checkpoints.before?.wallet.publicity,
     blocked:r.checkpoints.blocked,secondAvailable:r.checkpoints.secondAvailable}));
  }
  const expected={actual:[98,5,0,2], 'red-pink2-blue1-orange1-both':[103,6,1,3],
    'red-pink2-purple2-blue1-computer':[101,6,0,3], 'red-pink2-purple2-orange1-computer':[98,6,1,3]};
  const independentReplays = rows.filter(r=>Object.hasOwn(expected,r.name)).map(r=>{
    assert.deepEqual([r.end.wallet.score,Object.keys(r.end.tech.ownedTiles).length,r.end.rockets.length,
      r.end.sectorSettlements.winsByPlayerId[seat].length],expected[r.name]);
    return verify(r);
  });
  if(output)fs.writeFileSync(output,JSON.stringify({fixture,fixtureSha256:sha(fixture),redPath,redSha256:sha(redPath),beforeAmiba,
    beforeAmibaSha256:sha(beforeAmiba),rows,totalInputs,independentReplays,rootAndRngRestored:true,newAutonomousRuns:0},null,2)+'\n',{flag:'wx'});
}finally{composition.dispose();}
