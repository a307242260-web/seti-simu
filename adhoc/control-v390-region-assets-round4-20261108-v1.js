'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {getProbeRouteRequirements}=require('../randomizer/game/production-kernel');
const [fixture,out]=process.argv.slice(2),input=JSON.parse(fs.readFileSync(fixture)),seed='seti-free-analyze-v1',seat='player-white';
function kernel(){const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4});k.newGame({seed});return k.composition;}
const c=kernel(),independent=kernel(),save=(k=c)=>k.lifecycle.save().envelope;
const get=e=>e.session?.session?.workingState||JSON.parse(e.committedState),owner=s=>s.players.players.find(p=>p.id===seat);
const restore=(e,k=c)=>{assert(k.lifecycle.restore(e).ok);assert.deepEqual(save(k),e);};
const menu=(k=c)=>k.inspect().session?.decision?.choices||k.inputPort.enumerateActions({});
function submit(a,k=c){
 assert.deepEqual(menu(k).find(q=>q.actionId===a.actionId),a);
 const d=k.inspect().session?.decision,r=d?k.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):
  a.phase==='quick'?k.inputPort.submitQuickAction(a):k.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));
}
function view(){
 const e=save(),s=get(e),p=owner(s);
 return {e,wallet:p.resources,income:p.income,hand:p.hand.map(q=>[q.id,q.cardId]),tech:p.techState,
  computer:p.dataState.placedTokens.filter(q=>q.placementKind==='computer').map(q=>q.placementSlot),
  probes:s.pieces.rockets.filter(r=>r.playerId===seat),rng:s.meta.rngState,turn:s.turn};
}
try{
 const rows={};let commonReserve;
 for(const [label,branch] of Object.entries(input.rows)){
  assert.equal(branch.stop,'pass-before-rewards');
  const origin=branch.endpoint.e,steps=[];restore(origin);const pre=view();
  const step=test=>{const a=menu().find(test);assert(a,JSON.stringify(menu().map(q=>[q.family,q.target,q.summary])));steps.push(a);submit(a);return a;};
  step(a=>a.family==='pass'&&a.actorId===seat);
  commonReserve??=menu().filter(a=>a.target?.kind==='pass-reserve-card').map(a=>a.target.choiceId).sort()[0];
  step(a=>a.family==='choose_card'&&a.target?.choiceId===commonReserve);
  while(c.inspect().session?.decision||get(save()).turn.currentPlayerId!==seat){
   assert(steps.length<14);
   const d=c.inspect().session?.decision;
   if(!d){step(a=>a.family==='pass'&&a.actorId!==seat);continue;}
   assert.notEqual(d.ownerId,seat);
   const a=menu().filter(q=>['pass-reserve-card','pass-hand-limit'].includes(q.target?.kind)).sort((a,b)=>a.target.choiceId.localeCompare(b.target.choiceId))[0];
   assert(a);steps.push(a);submit(a);
  }
  const ready=view(),s=get(ready.e);assert.equal(ready.turn.roundNumber,4);
  const routes=getProbeRouteRequirements(s,seat).candidates.map(q=>({rocketId:q.rocketId,planetId:q.planetId,kind:q.endpointFamily,needsLaunch:q.launchRequired,path:q.path,
   target:q.endpointTarget,cost:q.endpointFacts.cost,benefit:q.targetBenefit}));
  restore(origin,independent);for(const a of steps)submit(a,independent);
  assert.deepEqual(save(independent),ready.e);restore(origin);
  rows[label]={pre,steps,ready,routes,independentStateSessionRng:true};
  console.log(label,ready.wallet,ready.probes.map(p=>[p.id,p.sectorX,p.sectorY]),routes.map(r=>[r.kind,r.planetId,r.path.length,r.cost,r.needsLaunch]).slice(0,17));
 }
 fs.writeFileSync(out,JSON.stringify({rows,commonReserve,standardExperiment:false},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();independent.dispose();}
