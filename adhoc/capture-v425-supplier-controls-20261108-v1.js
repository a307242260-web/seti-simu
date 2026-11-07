'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const load=n=>require(path.resolve(n)),read=p=>JSON.parse(fs.readFileSync(p));
const {createSeededRandom}=load('randomizer/game/random'),{createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=load('randomizer/app/rule-observation'),{createAnalysisPort}=load('randomizer/game/ai/analysis-port');
const {createSearchAgent}=load('randomizer/game/ai/search-agent');
const [source,out,mode='normal']=process.argv.slice(2),ref=read(source),base=ref.compositionEnvelope||ref.origin,seat='player-white',seed=JSON.parse(base.committedState).meta.seed;
const sourceState=JSON.parse(base.committedState);
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});
const c=k.composition,save=()=>c.lifecycle.save().envelope,menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const restore=e=>{assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);};
function act(w){
 const d=c.inspect().session?.decision,a=menu().find(x=>x.actionId===w.actionId&&x.actorId===seat);
 assert(a,w.summary);assert.deepEqual(a.target,w.target);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
 :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));return a;
}
function assets(e){
 const s=e.session?.session?.workingState||JSON.parse(e.committedState),p=s.players.players.find(q=>q.id===seat),
  v=c.projection({role:'player',playerId:seat}).state;
 return {turn:s.turn.turnNumber,wallet:p.resources,income:p.income,hand:p.hand.map(h=>[h.id,h.cardId]),data:p.dataState,tech:p.techState,
  probes:s.pieces.rockets.filter(x=>x.playerId===seat),wins:s.data.sectorSettlements.winsByPlayerId[seat],traces:v.selfState.traceCounts,
  projectedFinal:v.publicState.players.find(q=>q.playerId===seat).finalScore};
}

function fixture(name,envelope){fs.writeFileSync(path.join(out,name+'-20261108-v1.json'),JSON.stringify({seatId:seat,source:{seed},compositionEnvelope:envelope},null,2)+'\n',{flag:'wx'});}
try{
 restore(base);
 if(mode==='company'){
  for(const [i,a] of ref.accepted.entries()){
   if(i===1||i===2||i===5)fixture('masked-company-cold-'+i,save());
   act(a.action);
  }
  assert.deepEqual(save(),ref.stop.e);
 }else{
  const route=read(process.env.SETI_V425_ORIGINAL).accepted.slice(0,14);
  route.slice(0,8).forEach(x=>act(x.action));
  const before=structuredClone(save()),s=JSON.parse(before.committedState),api=load('randomizer/game/cards/deck');
  const isData=id=>(api.getDiscardActionRewardForCard({cardId:id})?.dataCount||0)>0;
  const deck=before.session.session.workingState.cards.drawPileCardIds,original=deck[0];
  assert.equal(original,'dlc_15.png');
  const j=deck.findIndex((id,i)=>i>0&&!isData(id));
  assert(j>0);
  function swap(o){
   if(!o||typeof o!=='object')return;
   const p=o.meta&&o.cards?.drawPileCardIds;
   if(p){assert.equal(p[0],original);[p[0],p[j]]=[p[j],p[0]];return;}
   for(const v of Object.values(o))swap(v);
  }
  swap(s);swap(before.session);before.committedState=JSON.stringify(s);
  restore(before);
  route.slice(8).forEach(x=>act(x.action));
  const after=save(),a=JSON.parse(after.committedState),offers=a.cards.publicCards.filter(Boolean);
  assert.equal(offers.filter(c=>api.getDiscardActionRewardForCard(c)?.dataCount>0).length,0);
  assert.equal(a.aliens.amiba.displayedCardIndex,8);
  fixture('masked-no-supplier',after);
 }
 restore(base);
}finally{c.dispose();}
