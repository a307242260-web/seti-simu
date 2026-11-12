'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition');
const {createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation');
const {createAnalysisPort}=require('./analysis-port'),{createSearchAgent}=require('./search-agent');
const f=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/public-displayed-transport-r3-20261109-v1.json.gz'))));
const seat='player-white',seed=JSON.parse(f.launch.committedState).meta.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(state,viewer)=>buildRuleObservation(state,seed,viewer?.playerId)});
k.newGame({seed});
const c=k.composition,save=()=>c.lifecycle.save().envelope,legal=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
function restore(envelope){assert(c.lifecycle.restore(envelope).ok);assert.deepEqual(save(),envelope);}
function play(a){
  const d=c.inspect().session?.decision;
  const result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
    :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
  assert(result.ok,JSON.stringify(result.error));
}
function choose(checkpoint){
  const before=save(),menu=legal(),port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
  try{
    assert(menu.every(a=>a.actorId===seat));
    const agent=createSearchAgent({seatId:seat,analysisPort:port});if(checkpoint)agent.loadCheckpoint(checkpoint);
    const q=agent.decide({seatId:seat,legalActions:menu}).search,a=menu.find(x=>x.actionId===q.actionId);
    assert(a&&q.complete&&!q.unresolved.length&&q.diagnostics.nativeExecutions<=256);
    assert.deepEqual(save(),before);
    return {q,a,checkpoint:structuredClone(agent.createCheckpoint())};
  }finally{port.close();}
}
const routes=q=>q.lines.flatMap(x=>x.knownResearchTransport?[x.knownResearchTransport]:[]);
function replaceCards(envelope,replace){
  const source=structuredClone(envelope),state=JSON.parse(source.committedState);
  replace(state);
  const {createStateStore}=require('../state/state-store');
  const encoded=createStateStore(state).serialize(state);
  assert(encoded.ok);
  source.committedState=encoded.serialized;
  return source;
}
try{
  restore(f.launch);
  const opening=choose(),proof=routes(opening.q);
  assert.equal(opening.a.family,'research_tech');
  assert(proof.some(p=>p.kind==='known-launch-and-displayed-transport'&&p.display===9&&p.trace===9&&p.cashSlot===3));
  const observed=c.projection({role:'player',playerId:seat}).state;
  restore(replaceCards(f.launch,state=>{
    const deck=state.aliens.chong.cardDeck;
    [deck[0],deck[1]]=[deck[1],deck[0]];
    const ordinary=state.cards.drawPileCardIds;
    [ordinary[0],ordinary[1]]=[ordinary[1],ordinary[0]];
  }));
  assert.deepEqual(c.projection({role:'player',playerId:seat}).state,observed);
  const alternate=choose();
  assert.deepEqual([alternate.a,alternate.q.roots,alternate.q.lines],[opening.a,opening.q.roots,opening.q.lines]);

  restore(f.postOrange);
  const move=choose();
  assert.deepEqual([move.a.family,move.a.target.deltaX,move.a.target.deltaY],['move',0,1]);
  play(move.a);
  const payment=choose();
  const m=save().session.session.workingState.players.players.find(p=>p.id===seat);
  assert.equal(m.hand.find(c=>c.id===payment.a.target.cardIds[0]).cardId,'dlc_20.png');
  assert.deepEqual(payment.a.target.cardIds,choose(move.checkpoint).a.target.cardIds);

  restore(f.pretrade);
  const trade=choose();
  assert.equal(trade.a.target.tradeId,'cards-for-credit');
  const plan=trade.q.roots.find(x=>x.actionId===trade.a.actionId).goal;
  assert.equal(plan.planetId,'saturn');
  assert.equal(new Set([plan.cardId,...plan.path.map(x=>x.paymentCardId),...plan.creditPaymentIds]).size,5);
  assert(plan.path.every(step=>step.scoredCorner));
  const advance=(checkpoint=null)=>{
    const next=choose(checkpoint);
    if(checkpoint)assert.deepEqual(next.a,choose().a);
    play(next.a);
    return next;
  };
  const funding=[];
  let transport=trade;
  for(let i=0;i<4;i++){
    funding.push(transport.a);play(transport.a);
    if(i<3)transport=choose(transport.checkpoint);
  }
  for(const step of plan.path){
    transport=advance(transport.checkpoint);
    assert.equal(transport.a.family,'card_corner');
    assert.equal(transport.a.target.cardInstanceId,step.paymentCardId);
    transport=advance(transport.checkpoint);
    assert.deepEqual([transport.a.target.deltaX,transport.a.target.deltaY],[step.deltaX,step.deltaY]);
  }
  const scored=JSON.parse(save().committedState);
  restore(f.pretrade);funding.forEach(play);
  for(const step of plan.path){
    play(legal().find(a=>a.family==='move'&&a.target.rocketId===plan.rocketId
      &&a.target.deltaX===step.deltaX&&a.target.deltaY===step.deltaY));
    play(legal().find(a=>a.target.kind==='move-payment'&&a.target.cardIds?.length===1
      &&a.target.cardIds[0]===step.paymentCardId));
  }
  const ordinary=JSON.parse(save().committedState),player=s=>s.players.players.find(p=>p.id===seat);
  assert.equal(player(scored).resources.score,player(ordinary).resources.score+2);
  assert.deepEqual({...player(scored).resources,score:player(ordinary).resources.score},player(ordinary).resources);
  assert.deepEqual(player(scored).hand,player(ordinary).hand);
  assert.deepEqual(scored.pieces,ordinary.pieces);
  assert.deepEqual(scored.meta.rngState,ordinary.meta.rngState);

  restore(replaceCards(f.pretrade,state=>{
    state.finalScoring.thresholds.push(player(state).resources.score+1);
    state.finalScoring.thresholds.sort((a,b)=>a-b);
  }));
  const guarded=choose().q.lines[0].edges.find(e=>e.resourcePlan?.goal.directTransport)?.resourcePlan.goal;
  assert(guarded&&!guarded.path.some(step=>step.scoredCorner));


  restore(replaceCards(f.pretrade,state=>{
    const p=state.players.players.find(x=>x.id===seat);
    p.hand=p.hand.filter(x=>x.cardId!=='chong_2.webp');
    p.resources.handSize=p.hand.length;
  }));
  const unfunded=choose();
  assert(!unfunded.q.roots.some(x=>x.goal?.directTransport));

  restore(replaceCards(f.pretrade,state=>{
    const chong=state.aliens.chong;
    for(const id of chong.planetFossilIds.saturn){
      chong.fossilsById[id].status='delivered';
    }
  }));
  const empty=choose();
  assert(!empty.q.roots.some(x=>x.goal?.directTransport));

  restore(f.launch);
  let checkpoint,settled=false;const accepted=[];
  for(let i=0;i<80;i++){
    const r=choose(checkpoint),a=r.a;
    if(i===1)assert.equal(a.actionId,f.expected.launchMain);
    if(a.family==='pass'){settled=true;break;}
    play(a);accepted.push(a);checkpoint=r.checkpoint;
  }
  assert(settled);
  const end=save(),s=JSON.parse(end.committedState),p=s.players.players.find(x=>x.id===seat);
  assert.equal(p.resources.score,129);
  assert.equal(p.resources.credits,1);
  assert.equal(p.income.energy,3);
  assert.deepEqual(p.hand.map(x=>x.cardId),['chong_3.webp']);
  assert(s.pieces.rockets.some(x=>x.playerId===seat&&x.fossilId==='fossil_01'));
  restore(f.launch);accepted.forEach(play);assert.deepEqual(save(),end);
}finally{c.dispose();}
