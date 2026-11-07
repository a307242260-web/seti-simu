'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const [fixture,out]=process.argv.slice(2),input=JSON.parse(fs.readFileSync(fixture)),seed='seti-free-analyze-v1',seat='player-white';
const build=()=>{const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4});k.newGame({seed});return k.composition;};
const c=build(),independent=build(),rows={};
const save=(k=c)=>k.lifecycle.save().envelope;
const restore=(e,k=c)=>{assert(k.lifecycle.restore(e).ok);assert.deepEqual(save(k),e);};
const menu=(k=c)=>k.inspect().session?.decision?.choices||k.inputPort.enumerateActions({});
function submit(action,k=c){
 assert.deepEqual(menu(k).find(q=>q.actionId===action.actionId),action);
 const d=k.inspect().session?.decision;
 const r=d?k.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:action}):
   action.phase==='quick'?k.inputPort.submitQuickAction(action):k.inputPort.submitAction(action);
 assert(r.ok,JSON.stringify(r));
}
function view(){
 const e=save(),s=e.session?.session?.workingState||JSON.parse(e.committedState),p=s.players.players.find(x=>x.id===seat);
 assert.equal(s.turn.roundNumber,3);
 return {e,wallet:p.resources,income:p.income,tech:Object.keys(p.techState.ownedTiles),hand:p.hand.map(q=>[q.id,q.cardId]),
   data:p.dataState.placedTokens.map(q=>[q.placementKind,q.placementSlot??q.blueSlot]),rng:s.meta.rngState};
}
try{
 for(const [label,branch] of Object.entries(input.rows)){
  const start=branch.checkpoints.nextTurn.e,steps=[];
  restore(start);
  const step=(family,test=()=>true)=>{
   const action=menu().find(a=>a.family===family&&test(a));
   assert(action,JSON.stringify(menu().map(a=>[a.family,a.target,a.summary])));
   assert(steps.length<20);steps.push(action);submit(action);
  };
  const begin=view();
  step('card_corner',a=>a.target.cardInstanceId==='alien-amiba-9-5');
  for(let i=0;i<Math.min(3,begin.wallet.availableData);i++){
   step('place_data');step('choose_target',a=>a.target.target==='computer');
  }
  const afterComputer=view(),funded=menu().some(a=>a.family==='research_tech');
  assert.equal(funded,label==='orange');
  if(funded){
   step('research_tech');step('choose_target',a=>a.target.tileId==='purple1');
   for(let i=0;i<2;i++){
    step('place_data');step('choose_target',a=>a.target.target==='computer');
    if(i===0)step('choose_card',a=>a.target.cardInstanceId==='alien-amiba-1-2');
   }
   step('end_turn');
  }
  const endpoint=view();
  restore(start,independent);for(const action of steps)submit(action,independent);
  assert.deepEqual(save(independent),endpoint.e);
  assert(steps.every(a=>!a.target?.cardInstanceId||['alien-amiba-9-5','alien-amiba-1-2'].includes(a.target.cardInstanceId)));
  restore(start);
  rows[label]={begin,afterComputer,funded,endpoint,steps,independentStateSessionRng:true};
  console.log(label,funded,afterComputer.wallet,endpoint.wallet,endpoint.income,endpoint.tech,endpoint.hand);
 }
 fs.writeFileSync(out,JSON.stringify({rows,usesOnlyPreRegionHandOrGuaranteedData:true,standardExperiment:false},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();independent.dispose();}
