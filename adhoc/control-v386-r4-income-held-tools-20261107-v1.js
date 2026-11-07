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
 for(const planet of ['saturn','venus']){
  const cases=rows[planet]={};
  for(const [label,branch] of Object.entries(pair.rows[planet])){
   const origin=branch.end.e,actions=[];
   restore(origin);
   const step=(family,test=()=>true)=>{
    const a=menu().find(q=>q.family===family&&test(q));assert(a,JSON.stringify(menu().map(q=>[q.actorId,q.family,q.target,q.summary])));actions.push(act(a));return a;
   };
   step('end_turn');
   if(c.inspect().session?.decision)step('accept_optional_effect',a=>a.target.choiceId==='skip:task:card-13-0:b117-orbit-land-count-task');
   while(c.inspect().session?.decision||read().s.turn.currentPlayerId!==seat){
    assert(actions.length<20);
    const d=c.inspect().session?.decision;
    if(!d){step('pass',a=>a.actorId!==seat);continue;}
    const opts=menu().filter(a=>a.target.kind==='pass-hand-limit').sort((a,b)=>a.target.choiceId.localeCompare(b.target.choiceId));
    assert(d.ownerId!==seat&&opts.length);actions.push(act(opts[0]));
   }
   const pre=view(),card=label==='energy'?'card-65-0':'alien-amiba-5-12';
   step('play_card',a=>a.target.cardInstanceId===card);
   const stages=[];
   if(label==='energy'){
    const paidCount=planet==='saturn'?3:1;
    for(let i=0;i<paidCount;i++){
     step('choose_reward',a=>a.target.pay);stages.push(view().wallet);
    }
    if(c.inspect().session?.decision)step('choose_reward',a=>a.target.skip);
   }else{
    step('choose_card',a=>a.target.choiceId==='public:1'&&a.summary==='dlc_20.png');
    step('choose_target',a=>a.target.choiceId==='symbol:red_2');
   }
   assert(!c.inspect().session?.decision,JSON.stringify(menu().map(q=>[q.family,q.target])));
   const endpoint=view();
   restore(origin);for(const a of actions)act(a);assert.deepEqual(save(),endpoint.e);
   restore(origin);cases[label]={origin,pre,endpoint,actions,stages};
   console.log(planet,label,endpoint.wallet,stages.map(a=>[a.score,a.credits,a.publicity]));
  }
 }
 fs.writeFileSync(out,JSON.stringify({rows,rootRestored:true,standardExperiment:false},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();}
