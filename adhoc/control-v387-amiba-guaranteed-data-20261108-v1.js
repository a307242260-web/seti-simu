'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {getProbeRouteRequirements}=require('../randomizer/game/production-kernel');
const [fixture,out]=process.argv.slice(2),seat='player-white',seed='seti-free-analyze-v1';
const origin=JSON.parse(fs.readFileSync(fixture)).rows.A0.analyzed.e;
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
 for(const [label,region] of [['red','pink'],['orange','yellow']]){
  restore(origin);const actions=[],step=(family,test=()=>true)=>{
   const a=menu().find(q=>q.family===family&&test(q));assert(a,JSON.stringify(menu().map(q=>[q.family,q.target,q.summary])));actions.push(act(a));return a;
  };
  step('choose_target',a=>a.target.choiceId==='symbol:blue_1');
  const afterSymbol=view();
  for(let i=0;i<2;i++){step('place_data');step('choose_target',a=>a.target.target==='computer');}
  step('end_turn');
  const beforeRegion=view();step('play_card',a=>a.summary.startsWith('amiba_3'));const regionMenu=view();
  step('choose_target',a=>a.target.traceType===region);
  const afterRegion=view();step('end_turn');step('analyze');
  step('choose_target',a=>a.target.choiceId==='trace:1:blue:amiba:4');
  step('choose_card',a=>a.target.choiceId==='amiba:display:7');
  step('end_turn');const analyzed=view();
  restore(origin);for(const a of actions)act(a);assert.deepEqual(save(),analyzed.e);
  rows[label]={actions,afterSymbol,beforeRegion,regionMenu,afterRegion,analyzed};
  console.log(label,[afterSymbol,afterRegion,analyzed].map(x=>[x.wallet.score,x.wallet.availableData,x.wallet.handSize,x.wallet.publicity]),analyzed.hand);
 }
 restore(origin);
 fs.writeFileSync(out,JSON.stringify({origin,rows,rootRestored:true,standardExperiment:false},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();}
