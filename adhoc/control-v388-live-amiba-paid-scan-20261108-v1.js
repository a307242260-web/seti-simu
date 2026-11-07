'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const [fixture,out,sector='sector-1-b']=process.argv.slice(2),seed='seti-free-analyze-v1',seat='player-white';
const rows={},input=JSON.parse(fs.readFileSync(fixture));
function kernel(){const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4});k.newGame({seed});return k.composition;}
const c=kernel(),replay=kernel();
const save=(k=c)=>k.lifecycle.save().envelope;
const restore=(e,k=c)=>{assert(k.lifecycle.restore(e).ok);assert.deepEqual(save(k),e);};
const menu=(k=c)=>k.inspect().session?.decision?.choices||k.inputPort.enumerateActions({});
function submit(a,k=c){
 assert.deepEqual(menu(k).find(q=>q.actionId===a.actionId),a);
 const d=k.inspect().session?.decision;
 const r=d?k.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):
   a.phase==='quick'?k.inputPort.submitQuickAction(a):k.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));
}
function read(){
 const e=save(),s=e.session?.session?.workingState||JSON.parse(e.committedState),p=s.players.players.find(x=>x.id===seat);
 assert.equal(s.turn.roundNumber,3);
 return {e,wallet:p.resources,hand:p.hand.map(q=>[q.id,q.cardId]),income:p.income,signals:Object.fromEntries([sector,'sector-3-a'].map(id=>[id,s.data.nebulae[id].tokens])),
  computers:p.dataState.placedTokens.filter(x=>x.placementKind==='computer').map(x=>x.placementSlot),
  blue:p.dataState.placedTokens.filter(x=>x.placementKind==='blueBonus').map(x=>x.blueSlot),
  rng:s.meta.rngState,publicCardIds:s.cards.publicCards.map(x=>x.id)};
}
const show=()=>menu().map(q=>[q.family,q.summary,q.target]);
try{
 for(const [label,branch] of Object.entries(input.rows)){
  const origin=branch.checkpoints.afterBlueFunding.e,steps=[];
  restore(origin);const before=read();
  const step=(family,test=()=>true)=>{
   const a=menu().find(q=>q.family===family&&test(q));
   assert(a,JSON.stringify(show()));
   assert(steps.length<16,'fixed input limit');
   steps.push(a);submit(a);return a;
  };
  if(label==='red'){
   step('quick_trade',a=>a.target.tradeId==='cards-for-energy');
   for(const id of ['alien-amiba-1-2','alien-amiba-9-5'])step('choose_payment',a=>a.target.cardInstanceId===id);
   if(menu().some(a=>a.family==='choose_payment'&&a.target.confirm===true))step('choose_payment',a=>a.target.confirm===true);
  }
  const funded=read();
  assert(funded.publicCardIds.includes('card-61-0'));
  step('scan');const options=show();
  step('choose_target',a=>a.target.nebulaId===sector);
  const afterFirstSignal=read();
  step('choose_card',a=>a.target.cardInstanceId==='card-61-0'&&a.target.nebulaId==='sector-3-a');
  const afterPublicSignal=read(),choicesAfterScan=show();
  for(let i=0;i<afterPublicSignal.wallet.availableData;i++){
   step('place_data');
   step('choose_target',a=>a.target.target==='computer');
  }
  if(label==='orange')step('choose_card',a=>a.target.cardInstanceId==='alien-amiba-1-2');
  const beforeEnd=read();
  assert.equal(beforeEnd.income.credits,label==='orange'?7:6);
  step('end_turn');
  const boundary=read();
  rows[label]={origin,before,funded,options,afterFirstSignal,afterPublicSignal,choicesAfterScan,beforeEnd,boundary,steps,next:show(),replayed:true};
  restore(origin,replay);for(const a of steps)submit(a,replay);
  assert.deepEqual(save(replay),boundary.e);
  restore(origin);
  console.log(label,'funded',funded.wallet,'signals',afterPublicSignal.wallet,'boundary',boundary.wallet,boundary.income,boundary.computers,boundary.blue);
 }
 const {red,orange}=rows;
 assert.deepEqual(red.boundary.signals,orange.boundary.signals);
 assert.deepEqual(red.boundary.rng,orange.boundary.rng);
 assert.equal(red.boundary.wallet.score-orange.boundary.wallet.score,4);
 assert.deepEqual(orange.boundary.blue,[1]);
 assert(orange.boundary.hand.some(([id])=>id==='alien-amiba-9-5'));
 fs.writeFileSync(out,JSON.stringify({rows,sector,standardExperiment:false},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();replay.dispose();}
