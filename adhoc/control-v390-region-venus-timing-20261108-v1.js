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
  probes:s.pieces.rockets.filter(r=>r.playerId===seat),rng:s.meta.rngState,turn:s.turn,
  orbitReady:menu().some(q=>q.family==='orbit'&&q.target?.planetId==='venus')};
}
try{
 const rows={};
 for(const [label,branch] of Object.entries(input.rows)){
  const origin=branch.ready.e,steps=[];restore(origin);const start=view();
  const step=test=>{const a=menu().find(test);assert(a,JSON.stringify(menu().map(q=>[q.family,q.target,q.summary])));steps.push(a);submit(a);return a;};
  if(label==='red')step(a=>a.family==='launch');
  const ready=view(),ship=ready.probes[0];assert(ship);
  const route=getProbeRouteRequirements(get(ready.e),seat).candidates.find(q=>q.rocketId===ship.id&&q.planetId==='venus'&&q.endpointFamily==='orbit');
  assert(route);
  for(const {deltaX,deltaY} of route.path){
   step(a=>a.family==='move'&&a.target.rocketId===ship.id&&a.target.deltaX===deltaX&&a.target.deltaY===deltaY);
   if(c.inspect().session?.decision)step(a=>a.family==='choose_payment'&&a.target.choiceId==='energy');
  }
  const aligned=view();assert.equal(aligned.orbitReady,label==='orange');
  if(label==='orange'){
   step(a=>a.family==='orbit'&&a.target.planetId==='venus'&&a.target.rocketId===ship.id);
   const oldHand=new Set(branch.pre.hand.map(([id])=>id));
   step(a=>a.family==='choose_card'&&a.target.choiceId?.startsWith('income:')&&oldHand.has(a.target.cardInstanceId));
  }
  const endpoint=view();
  assert(steps.length<14);assert.equal(endpoint.turn.roundNumber,4);
  restore(origin,independent);for(const a of steps)submit(a,independent);
  assert.deepEqual(save(independent),endpoint.e);restore(origin);
  rows[label]={start,aligned,endpoint,steps,independentStateSessionRng:true};
  console.log(label,steps.map(a=>a.summary),endpoint.wallet,endpoint.income);
 }
 fs.writeFileSync(out,JSON.stringify({rows,standardExperiment:false},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();independent.dispose();}
