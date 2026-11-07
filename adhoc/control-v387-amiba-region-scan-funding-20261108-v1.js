'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {getProbeRouteRequirements}=require('../randomizer/game/production-kernel');
const [fixture,out]=process.argv.slice(2),seat='player-white',seed='seti-free-analyze-v1';
const cases=JSON.parse(fs.readFileSync(fixture)).rows;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4});
k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope,menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const restore=e=>{assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);};
function act(a){
 assert.deepEqual(menu().find(x=>x.actionId===a.actionId),a);
 const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):
  a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));return a;
}
function read(){
 const e=save(),s=e.session?.session?.workingState||JSON.parse(e.committedState),p=s.players.players.find(x=>x.id===seat);
 return {e,s,p};
}
function view(){
 const {e,s,p}=read();
 return{e,turn:s.turn,wallet:p.resources,income:p.income,hand:p.hand.map(q=>[q.id,q.cardId]),rng:s.meta.rngState,
  tech:p.techState,probes:s.pieces.rockets.filter(r=>r.playerId===seat)};
}
try{
 const rows={};
 for(const [label,branch] of Object.entries(cases)){
  const origin=branch.analyzed.e;
  restore(origin);const actions=[],step=(family,test=()=>true)=>{
   const a=menu().find(q=>q.family===family&&test(q));assert(a,JSON.stringify(menu().map(q=>[q.family,q.target,q.summary])));actions.push(act(a));return a;
  };
  step('research_tech');step('choose_target',a=>a.target.tileId==='purple1');
  step('card_corner',a=>a.target.cardInstanceId==='alien-amiba-7-10');
  for(let i=0;i<4;i++){step('place_data');step('choose_target',a=>a.target.target==='computer');}
  step('choose_card',a=>a.target.cardInstanceId==='alien-amiba-1-2');
  const afterIncome=view();
  if(afterIncome.wallet.availableData){step('place_data');step('choose_target',a=>a.target.target==='blueBonus'&&a.target.blueSlot===1);}
  step('end_turn');
  const endpoint=view(),actionsAvailable=menu().filter(a=>a.family==='scan'||a.family==='quick_trade').map(x=>[x.family,x.target]);
  assert.equal(actionsAvailable.some(x=>x[0]==='scan'),label==='orange');
  restore(origin);for(const a of actions)act(a);assert.deepEqual(save(),endpoint.e);
  rows[label]={origin,actions,afterIncome,endpoint,actionsAvailable};
  console.log(label,afterIncome.wallet,endpoint.wallet,endpoint.hand,actionsAvailable);
  restore(origin);
 }
 fs.writeFileSync(out,JSON.stringify({rows,rootRestored:true,standardExperiment:false},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();}
