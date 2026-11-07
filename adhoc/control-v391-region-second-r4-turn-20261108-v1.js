'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
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
  const origin=branch.endpoint.e,steps=[];restore(origin);const start=view();
  const step=test=>{const a=menu().find(test);assert(a,JSON.stringify(menu().map(q=>[q.family,q.target,q.summary])));assert(steps.length<24);steps.push(a);submit(a);return a;};
  step(a=>a.family==='end_turn'&&a.actorId===seat);
  while(c.inspect().session?.decision||get(save()).turn.currentPlayerId!==seat){
   const d=c.inspect().session?.decision;
   if(!d){step(a=>a.family==='pass'&&a.actorId!==seat);continue;}
   if(d.ownerId===seat){step(a=>a.family==='accept_optional_effect'&&a.target.choiceId?.startsWith('skip:'));continue;}
   const chosen=menu().filter(q=>['pass-reserve-card','pass-hand-limit'].includes(q.target?.kind)).sort((a,b)=>a.target.choiceId.localeCompare(b.target.choiceId))[0];
   assert(chosen);step(a=>a.actionId===chosen.actionId);
  }
  const next=view();let afterAnalysis=null;
  if(label==='red'){
   step(a=>a.family==='orbit'&&a.target.planetId==='venus');
   step(a=>a.family==='choose_card'&&a.target.choiceId?.startsWith('income:')&&a.target.cardInstanceId==='card-64-0');
  }else{
   step(a=>a.family==='card_corner'&&a.target.cardInstanceId==='card-65-0');
   step(a=>a.family==='place_data');
   step(a=>a.family==='choose_target'&&a.target.target==='computer');
   step(a=>a.family==='analyze');
   afterAnalysis=view();
   const options=menu().filter(a=>a.target.traceType==='blue'&&a.target.alienSlotId===1);
   assert(options.length,JSON.stringify(menu()));
   const card=options.find(a=>a.target.choiceId==='trace:1:blue:amiba:3')||options[0];
   step(a=>a.actionId===card.actionId);
   if(menu().some(a=>a.family==='choose_card'&&a.target.choiceId==='amiba:display:5'))
    step(a=>a.family==='choose_card'&&a.target.choiceId==='amiba:display:5');
  }
  const endpoint=view();
  assert.equal(endpoint.turn.roundNumber,4);
  restore(origin,independent);for(const a of steps)submit(a,independent);
  assert.deepEqual(save(independent),endpoint.e);restore(origin);
  rows[label]={start,next,endpoint,afterAnalysis,steps,independentStateSessionRng:true};
  console.log(label,steps.map(a=>a.summary),endpoint.wallet,endpoint.income);
 }
 assert.equal(rows.red.next.turn.turnNumber,rows.orange.next.turn.turnNumber);
 fs.writeFileSync(out,JSON.stringify({rows,standardExperiment:false},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();independent.dispose();}
