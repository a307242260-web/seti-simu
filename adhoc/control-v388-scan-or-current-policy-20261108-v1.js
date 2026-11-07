'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {createStateValueEvaluator}=require('../randomizer/game/ai/state-value');
const {BUDGET,OPTIONS}=require('../randomizer/game/ai/search-agent');
const {searchDecision}=require('../randomizer/game/ai/decision-search');
const [fixture,out]=process.argv.slice(2),input=JSON.parse(fs.readFileSync(fixture)),seed='seti-free-analyze-v1',seat='player-white';
function kernel(){
 const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
   projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
 k.newGame({seed});return k.composition;
}
const c=kernel(),independent=kernel(),evaluate=createStateValueEvaluator(seat);
const save=(k=c)=>k.lifecycle.save().envelope;
const restore=(e,k=c)=>{assert(k.lifecycle.restore(e).ok);assert.deepEqual(save(k),e);};
function view(){
 const e=save(),s=e.session?.session?.workingState||JSON.parse(e.committedState),p=s.players.players.find(x=>x.id===seat);
 return {e,turn:s.turn.turnNumber,round:s.turn.roundNumber,actor:s.turn.currentPlayerId,
  wallet:p.resources,income:p.income,tech:Object.keys(p.techState.ownedTiles),blue:p.techState.blueBoardSlots,
  hand:p.hand.map(q=>[q.id,q.cardId]),data:p.dataState.placedTokens.map(q=>[q.placementKind,q.placementSlot??q.blueSlot]),rng:s.meta.rngState};
}
function submit(action,k=c){
 const d=k.inspect().session?.decision;
 const a=(d?.choices||k.inputPort.enumerateActions({})).find(q=>q.actionId===action.actionId);
 assert.deepEqual(a,action);
 const r=d?k.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):
   a.phase==='quick'?k.inputPort.submitQuickAction(a):k.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));
}
try{
 const rows={};
 for(const [label,branch] of Object.entries(input.rows)){
  const start=branch.checkpoints.nextTurn.e,steps=[];
  restore(start);
  const initial=view();
  // Only one turn per outcome. Same production budget, exact restore of
  // source and decision, no PASS or advance to another round on gate failure.
  let stop='turn-ended';
  while(view().turn===initial.turn){
   if(steps.length===20){stop='fixed-experiment-input-limit';break;}
   const pre=save(),port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
   let found,ms,action;
   try{
    const at=performance.now(),root=port.openRoot();
    found=searchDecision({port,root,evaluate,budget:BUDGET,modelKey:evaluate.modelKey,...OPTIONS});
    ms=performance.now()-at;action=root.legalActions.find(a=>a.actionId===found.actionId);
   }finally{port.close();}
   assert.deepEqual(save(),pre);
   const native=found.diagnostics.nativeExecutions;
   if(!found.complete||!action||native>256||ms>600){stop={reason:'gate',found,ms,native};break;}
   if(action.family==='pass'){stop='pass-before-rewards';break;}
   steps.push({action,native,ms,value:found.value});submit(action);
  }
  const endpoint=view();assert.equal(endpoint.round,3);
  restore(start,independent);for(const {action} of steps)submit(action,independent);
  assert.deepEqual(save(independent),endpoint.e);
  rows[label]={initial,endpoint,steps,stop,independentStateSessionRng:true};
  console.log(label,stop,steps.map(q=>[q.action.summary,q.native,Math.round(q.ms)]),endpoint.wallet,endpoint.income,endpoint.tech,endpoint.hand,endpoint.data);
 }
 fs.writeFileSync(out,JSON.stringify({rows,standardExperiment:false},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();independent.dispose();}
