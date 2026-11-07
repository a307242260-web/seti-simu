'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {getProbeRouteRequirements}=require('../randomizer/game/production-kernel');
const [fixture,out]=process.argv.slice(2),seat='player-white',seed='seti-free-analyze-v1';
const pair=JSON.parse(fs.readFileSync(fixture));
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
 for(const [kind,planet] of [['land','saturn'],['orbit','venus']]){
  const cases=rows[planet]={};
  for(const [label,branch] of Object.entries(pair.rows)){
   const origin=branch.focal4.e,route=branch.routes.find(q=>q.kind===kind&&q.planet===planet);
   restore(origin);const actions=[],step=(family,test=()=>true)=>{
    const a=menu().find(q=>q.family===family&&test(q));assert(a,JSON.stringify(menu().map(q=>[q.actorId,q.family,q.target,q.summary])));actions.push(act(a));return a;
   };
   const pre=view(),rocketId=pre.probes[0].id,trades=[];
   function afford(need){
    while(read().p.resources.energy<need){
     trades.push(step('quick_trade',a=>a.target.tradeId==='credits-for-energy'));
    }
   }
   for(const {deltaX,deltaY} of route.path){
    afford(1);
    step('move',a=>a.target.rocketId===rocketId&&a.target.deltaX===deltaX&&a.target.deltaY===deltaY);
    if(c.inspect().session?.decision)step('choose_payment',a=>a.target.choiceId==='energy');
   }
   afford(route.cost.energy||0);
   const target=a=>a.target.rocketId===rocketId&&a.target.planetId===planet&&(kind==='orbit'||a.target.landTarget?.type==='planet');
   if(kind==='land'&&menu().some(a=>a.family==='land'&&a.target.select)){
    step('land',a=>a.target.select);
    const choice=menu().find(target);
    if(choice)actions.push(act(choice));
    else assert(c.inspect().session?.decision&&menu().every(a=>a.target.traceType==='yellow'));
   }else step(kind,target);
   const pending=menu().map(a=>[a.family,a.target,a.summary]);
   if(planet==='venus'){
    step('choose_card',a=>a.target.cardInstanceId==='card-64-0'&&a.target.choiceId?.startsWith('income:'));
   }else if(c.inspect().session?.decision){
    step('choose_target',a=>a.target.choiceId==='trace:1:yellow:amiba:2'||a.target.choiceId==='trace:1:yellow:state-extra');
    if(c.inspect().session?.decision)step('accept_optional_effect',a=>a.target.choiceId==='confirm:trigger:alien-amiba-0-1:amiba0-yellow-data');
   }
   assert(!c.inspect().session?.decision,JSON.stringify(menu().map(a=>[a.family,a.target,a.summary])));
   const end=view();
   assert(end.wallet.score-pre.wallet.score>=route.benefit.score);
   restore(origin);for(const a of actions)act(a);assert.deepEqual(save(),end.e);
   restore(origin);cases[label]={pre,end,actions,trades:trades.length,pending};
   console.log(planet,label,end.wallet,route.cost,trades.length);
  }
  assert.equal(cases.energy.end.wallet.score,cases.credits.end.wallet.score);
 }
 fs.writeFileSync(out,JSON.stringify({rows,rootRestored:true,standardExperiment:false},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();}
