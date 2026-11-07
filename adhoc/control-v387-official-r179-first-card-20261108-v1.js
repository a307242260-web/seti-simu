'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {getProbeRouteRequirements}=require('../randomizer/game/production-kernel');
const [fixture,out,autonomy]=process.argv.slice(2),seat='player-white',seed='seti-free-analyze-v1';
const origin=JSON.parse(fs.readFileSync(fixture)).rows.officialR179.analyzed.e;
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
 for(const label of ['A0','A3']){
  restore(origin);
  const a=menu().find(a=>a.family==='play_card'&&a.summary.startsWith(label==='A0'?'amiba_0':'amiba_3'));
  assert(a);act(a);
  const analyzed=view();rows[label]={actions:[a],analyzed};
  restore(origin);act(a);assert.deepEqual(save(),analyzed.e);
 }
 restore(origin);
 fs.writeFileSync(out,JSON.stringify({origin,rows,rootRestored:true,standardExperiment:false},null,2)+'\n',{flag:'wx'});
 fs.writeFileSync(autonomy,JSON.stringify({rows:Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,{analyzed:{e:v.analyzed.e}}]))})+'\n',{flag:'wx'});
}finally{c.dispose();}
