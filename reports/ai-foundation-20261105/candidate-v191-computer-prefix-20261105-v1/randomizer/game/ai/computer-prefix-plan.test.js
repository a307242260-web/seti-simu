'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation');
const {createAnalysisPort}=require('./analysis-port'),values=require('./state-value'),demand=require('./resource-demand'),local=require('./local-decision-plans');
const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../reports/ai-foundation-20261105/third-round-teacher-v1/teacher-r3-before-safety-protocol-root-20261105-v1.json'))),seatId=f.seatId,seed=f.source.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert(c.lifecycle.restore(f.compositionEnvelope).ok);
function apply(action){const d=c.inspect().session?.decision;return d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:action}):action.phase==='quick'?c.inputPort.submitQuickAction(action):c.inputPort.submitAction(action);}
const safety=c.inputPort.enumerateActions({}).find(a=>a.family==='play_card'&&a.target.cardInstanceId==='alien-amiba-1-2');assert(safety);assert(apply(safety).ok);
const envelope=c.lifecycle.save().envelope,base=JSON.parse(envelope.committedState),own=s=>s.players.players.find(p=>p.id===seatId),p=own(base);assert.equal(p.resources.publicity,5);assert.equal(p.resources.availableData,2);assert(p.mainActionCompleted);
let port;
try{
 port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});port.setResourcePlanning(true);port.setCardPickPlanning(true);
 const root=port.openRoot(),spec=port.resourceSpec(root),plan=spec.plans.find(p=>p.goal.kind==='computer-prefix');
 assert(plan,'current paid card must retain the profitable held-data computer2/3 preparation instead of only ending');
 assert.equal(plan.goal.targetComputerSlot,3);assert.equal(spec.plans.filter(p=>p.goal.kind==='computer-prefix').length,1,'prefix selection is greedy, not placement search');
 const quoted=local.computerCompletion({state:base,seatId,goal:plan.goal});assert(quoted.selected);assert.equal(quoted.netGain,4);assert.equal(quoted.requiredNativeInputs,4);
 const tail=local.dataTailCompletion({state:base,seatId});assert(tail.available);assert.equal(tail.netGain,quoted.netGain);assert.equal(tail.requiredNativeInputs,5);assert.equal(tail.plans[0].goal.id,plan.goal.id);
 const result=port.expandResourcePlan(root,plan,()=>null);assert(result.complete);assert.equal(result.goalStatus,'completed');assert.equal(result.submissions,4);assert.deepEqual(result.prefixes.map(p=>p.action.family),['place_data','choose_target','place_data','choose_target']);assert(result.prefixes.filter(p=>p.action.family==='choose_target').every(p=>p.action.target.target==='computer'));
 const after=result.node.observation.publicState.players.find(p=>p.playerId===seatId);assert.equal(after.score,48);assert.equal(after.publicity,6);assert.equal(after.availableData,0);
 const evaluate=values.createStateValueEvaluator(seatId);assert.equal(values.sumValueParts([evaluate(result.node.observation),-evaluate(root.observation)]),quoted.netGain);
 assert.deepEqual(c.lifecycle.save().envelope,envelope,'counterfactual preparation must preserve the exact root and RNG');
 const stopped=port.expandResourcePlan(root,plan,n=>n>=2?'transition-budget':null);assert(!stopped.complete);assert.equal(stopped.submissions,2);assert.deepEqual(c.lifecycle.save().envelope,envelope);
 for(const prefix of result.prefixes){
  const cold=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});cold.setResourcePlanning(true);cold.setCardPickPlanning(true);
  try{const n=cold.openRoot(),policy=cold.resourceSpec(n),same=policy?.plans.find(p=>p.goal.id===plan.goal.id);assert(same,'native pending/partial computer prefix must recover its purpose');const continuation=cold.expandResourcePlan(n,same,()=>null);assert(continuation.complete);assert.equal(continuation.prefixes[0].action.actionId,prefix.action.actionId);}finally{cold.close();}
  const d=c.inspect().session?.decision,a=(d?.choices||c.inputPort.enumerateActions({})).find(a=>a.actionId===prefix.action.actionId);assert(a);assert(apply(a).ok);
 }
 const actual=JSON.parse(c.lifecycle.save().envelope.committedState),a=own(actual);assert.equal(a.resources.score,p.resources.score+2);assert.equal(a.resources.publicity,p.resources.publicity+1);assert.equal(a.resources.availableData,0);assert.deepEqual(a.hand,p.hand);assert.deepEqual(a.techState,p.techState);assert.deepEqual(a.income,p.income);assert.deepEqual(a.dataState.placedTokens.filter(t=>t.placementKind==='computer').map(t=>t.placementSlot),[1,2,3]);
 // Current data only: do not spend a card or cross the native income choice.
 assert.equal(demand.capacity(base,seatId,{...plan.goal,targetComputerSlot:4}),false);
 const short=structuredClone(base);own(short).dataState.poolTokens.pop();own(short).resources.availableData--;assert.equal(demand.capacity(short,seatId,plan.goal),false);assert.equal(local.computerCompletion({state:short,seatId,goal:plan.goal}).selected,false);
 const gap=structuredClone(base);own(gap).dataState.placedTokens.find(t=>t.placementKind==='computer').placementSlot=2;assert.equal(local.computerCompletion({state:gap,seatId,goal:plan.goal}).selected,false);
 const noProfit=structuredClone(base);own(noProfit).resources.publicity=10;own(noProfit).techState.disabledTiles.blue1=true;assert.equal(local.computerCompletion({state:noProfit,seatId,goal:{...plan.goal,targetComputerSlot:2}}).selected,false);
 assert(c.lifecycle.restore(envelope).ok);assert.deepEqual(c.lifecycle.save().envelope,envelope);
 console.log(JSON.stringify({computerPrefixPlan:true,nativeInputs:4,quotedAndNativeValueGain:4,coldRestoreAtEveryInput:true,noUnfundedOrIncomeCrossing:true,rootAndRngUnchanged:true}));
}finally{port?.close();c.dispose();}
