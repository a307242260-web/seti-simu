'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation'),{createAnalysisPort}=require('./analysis-port'),search=require('./decision-search'),values=require('./state-value'),agent=require('./search-agent');
const fixture=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-024-20261030-v1.json'))),seed=fixture.source.seed,seatId=fixture.seatId;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(fixture.compositionEnvelope).ok);
const evaluate=values.createStateValueEvaluator(seatId),budget={transitions:256,nodes:1024,frontier:256,milliseconds:10000},options={...agent.OPTIONS,evaluate,modelKey:evaluate.modelKey,budget};
let p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0}),token=null,initialInputs,initialNodes,after26,checkpoint;
function submit(actionId){const d=c.inspect().session?.decision,action=(d?.choices||c.inputPort.enumerateActions({})).find(a=>a.actionId===actionId);assert(action);const result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:action}):action.phase==='quick'?c.inputPort.submitQuickAction(action):c.inputPort.submitAction(action);assert(result.ok);return action;}
try{
 for(let i=0;i<12;i++){
  const before=c.lifecycle.save().envelope,root=p.openRoot(),result=search.searchDecision({...options,port:p,root,planContinuation:token});assert(result.complete,result.stopReason);assert.equal(result.value,60);assert.deepEqual(c.lifecycle.save().envelope,before);
  if(i===0){initialInputs=result.diagnostics.nativeExecutions;initialNodes=result.diagnostics.nodes;assert(result.planContinuation);}
  else {assert.equal(result.diagnostics.planContinuation,'hit',`the committed native plan must survive input${23+i}`);assert.equal(result.diagnostics.nativeExecutions,0);}
  const action=root.legalActions.find(a=>a.actionId===result.actionId);assert(action);
  if(i===3){assert.equal(action.family,'place_data','after the required Mars prefix, keep the winning income purpose instead of retargeting Venus');after26=before;checkpoint=p.exportPlan(result.planContinuation);assert(checkpoint.rows.some(r=>r.committedGoal));}
  if(i>=3&&i<11)assert.equal(action.family,(i-3)%2?'choose_target':'place_data');
  if(i===11){assert.equal(action.family,'choose_card');assert.equal(action.target.cardInstanceId,'card-13-0');}
  token=result.planContinuation;const saved=p.exportPlan(token);p.close();submit(result.actionId);
  // Recreate the port and import its exact certificate at every native input.
  p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});token=p.importPlan(saved);
 }
 assert.equal(values.evaluateStateValue(c.projection({role:'player',playerId:seatId}).state,seatId).total,60);
 assert(initialInputs>80&&initialInputs<=256,'only the winning fixed tail adds native work to the original80-input complete root');p.close();
 for(const changed of ['money','hand']){
  const envelope=structuredClone(after26),state=JSON.parse(envelope.committedState),owner=state.players.players.find(v=>v.id===seatId);
  if(changed==='money')owner.resources.energy+=1;else owner.hand.reverse();
  envelope.committedState=JSON.stringify(state);assert(c.lifecycle.restore(envelope).ok);
  p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});const token=p.importPlan(checkpoint),root=p.openRoot();assert.equal(p.reusePlan(root,token,checkpoint.modelKey).hit,false,changed+' invalidates exact committed-plan dependencies');p.close();
 }
 for(const [key,limit,reason] of [['transitions',initialInputs-1,'transition-budget'],['nodes',initialNodes-1,'node-budget']]){
  assert(c.lifecycle.restore(fixture.compositionEnvelope).ok);p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});const before=c.lifecycle.save().envelope;
  const limited=search.searchDecision({...options,port:p,root:p.openRoot(),budget:{...budget,[key]:limit}});
  assert(!limited.complete);assert.equal(limited.actionId,null);assert.equal(limited.planContinuation,null);assert.equal(limited.stopReason,reason);assert(limited.unresolved.some(x=>x.winningPlanAttempt));assert.deepEqual(c.lifecycle.save().envelope,before);p.close();
 }
 assert(c.lifecycle.restore(fixture.compositionEnvelope).ok);p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});let expired=false;const before=c.lifecycle.save().envelope;
 const timed=search.searchDecision({...options,port:{...p,expandResourcePlan(node,plan,capacity){if(p.hasMovementIntent(node)&&plan.goal.kind==='income')expired=true;return p.expandResourcePlan(node,plan,capacity);}},root:p.openRoot(),now:()=>expired?10001:0});
 assert(!timed.complete);assert.equal(timed.actionId,null);assert.equal(timed.planContinuation,null);assert.equal(timed.stopReason,'watchdog');assert(timed.unresolved.some(x=>x.winningPlanAttempt));assert.deepEqual(c.lifecycle.save().envelope,before);
}finally{p.close();c.dispose();}
console.log(JSON.stringify({winningIncomeNativeContinuation:true,coldCertificateRecovery:true,exactDependencyInvalidation:true,sharedBudgetEnforced:true,initialInputs}));
