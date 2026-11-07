'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {getProbeRouteRequirements}=require('../randomizer/game/production-kernel');
const [fixture,out]=process.argv.slice(2),seat='player-white',seed='seti-free-analyze-v1';
const origin=JSON.parse(fs.readFileSync(fixture)).analyzed.e;
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
 const rows={},oldHeld=new Set(readOriginHand());
 let commonPass=null;
 function readOriginHand(){return JSON.parse(origin.committedState).players.players.find(p=>p.id===seat).hand.map(q=>q.id);}
 for(const [label,incomeCard] of [['energy','alien-amiba-5-12'],['credits','card-65-0']]){
  restore(origin);const actions=[],step=(family,test=()=>true)=>{
   const a=menu().find(q=>q.family===family&&test(q));assert(a,JSON.stringify(menu().map(q=>[q.actorId,q.family,q.target,q.summary])));actions.push(act(a));return a;
  };
  step('card_corner',a=>a.target.cardInstanceId==='alien-amiba-2-14');
  for(let i=0;i<4;i++){step('place_data');step('choose_target',a=>a.target.target==='computer');}
  step('choose_card',a=>a.target.cardInstanceId===incomeCard);
  step('end_turn');step('card_corner',a=>a.target.cardInstanceId==='alien-amiba-9-5');
  step('research_tech');step('choose_target',a=>a.target.tileId==='blue1'&&a.target.blueSlot===3);step('end_turn');
  const end3=view();
  step('pass');
  commonPass??=menu().filter(a=>a.target.kind==='pass-reserve-card').map(a=>a.target.choiceId).sort()[0];
  step('choose_card',a=>a.target.kind==='pass-reserve-card'&&a.target.choiceId===commonPass);
  const r4=view(),start4=actions.length;
  while(c.inspect().session?.decision||read().s.turn.currentPlayerId!==seat){
   assert(actions.length<32);
   const d=c.inspect().session?.decision;
   if(!d){step('pass');continue;}
   const options=menu().filter(a=>['pass-reserve-card','pass-hand-limit'].includes(a.target.kind)).sort((a,b)=>a.target.choiceId.localeCompare(b.target.choiceId));
   assert(options.length&&d.ownerId!==seat);actions.push(act(options[0]));
  }
  const focal4=view(),{s}=read(),allRoutes=getProbeRouteRequirements(s,seat).candidates;
  const routes=allRoutes.filter(q=>q.rocketId===focal4.probes[0].id).map(q=>({planet:q.planetId,kind:q.endpointFamily,id:q.requirementId,path:q.path,
   endpoint:q.endpointTarget,cost:q.endpointFacts.cost,benefit:q.targetBenefit}));
  assert.equal(focal4.turn.roundNumber,4);assert.equal(focal4.turn.currentPlayerId,seat);
  const knownHand=focal4.hand.filter(([id])=>oldHeld.has(id));
  restore(origin);for(const a of actions)act(a);assert.deepEqual(save(),focal4.e);
  rows[label]={end3,r4,start4,focal4,routes,knownHand,actions};
  console.log(label,end3.wallet,focal4.wallet,knownHand,routes.slice(0,8).map(x=>[x.kind,x.planet,x.path.length,x.cost,x.benefit.score]));
 }
 assert.deepEqual(rows.energy.end3.tech,rows.credits.end3.tech);
 assert.deepEqual(rows.energy.end3.probes,rows.credits.end3.probes);
 assert.deepEqual(rows.energy.end3.rng,rows.credits.end3.rng);
 assert.deepEqual(rows.energy.focal4.rng,rows.credits.focal4.rng);
 assert.deepEqual([...rows.energy.routes].sort((a,b)=>a.id.localeCompare(b.id)),[...rows.credits.routes].sort((a,b)=>a.id.localeCompare(b.id)));
 restore(origin);fs.writeFileSync(out,JSON.stringify({origin,rows,commonPass,rootRestored:true,standardExperiment:false},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();}
