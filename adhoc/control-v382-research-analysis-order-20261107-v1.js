'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=require('../randomizer/app/rule-observation'),{createStateValueEvaluator}=require('../randomizer/game/ai/state-value');
const [source,output]=process.argv.slice(2),origin=JSON.parse(fs.readFileSync(source)).rows['blue-then-yellow'].second.e;
const seed='seti-free-analyze-v1',seatId='player-white',evaluate=createStateValueEvaluator(seatId);
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope;
function restore(e){assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);}
function act(pred){
 const d=c.inspect().session?.decision,choices=d?.choices||c.inputPort.enumerateActions({}),a=choices.find(pred);
 assert(a,JSON.stringify(choices.map(a=>[a.family,a.summary,a.target])));
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
  :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok);return a;
}
function state(){
 const e=save(),s=JSON.parse(e.committedState),p=s.players.players.find(p=>p.id===seatId);
 return {e,wallet:p.resources,hand:p.hand.map(c=>[c.id,c.cardId]),data:p.dataState,tech:p.techState,income:p.income,
  value:evaluate.details(buildRuleObservation(s,seed,seatId)),publicity:p.resources.publicity,turn:s.turn.turnNumber};
}
try{
 const rows={};
 for(const tile of ['blue1','purple1'])for(const order of ['analyze-first','research-first']){
  restore(origin);const actions=[],snapshots=[];
  const take=p=>actions.push(act(p));
  function analyze(){
   take(a=>a.family==='analyze');
   take(a=>a.family==='choose_target'&&a.target?.choiceId==='trace:1:blue:amiba:4');
   take(a=>a.family==='choose_card'&&a.target?.choiceId==='amiba:display:7');
  }
  function research(){
   take(a=>a.family==='research_tech');
   take(a=>a.family==='choose_target'&&a.target?.tileId===tile&&(tile!=='blue1'||a.target.blueSlot===3));
  }
  for(const step of order==='analyze-first'?[analyze,research]:[research,analyze]){
   step();take(a=>a.family==='end_turn');assert(!save().session);snapshots.push(state());
  }
  const end=snapshots.at(-1);
  restore(origin);for(const a of actions)assert.deepEqual(act(x=>x.actionId===a.actionId),a);assert.deepEqual(save(),end.e);
  rows[tile+'/'+order]={actions,snapshots,independentReplay:true};
  console.log(tile,order,snapshots.map(x=>[x.wallet.score,x.wallet.availableData,x.publicity,x.value.value,x.hand.map(c=>c[1])]));
 }
 restore(origin);
 fs.writeFileSync(output,JSON.stringify({rows,source:origin,rootRestored:true,standardExperiment:false},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();}
