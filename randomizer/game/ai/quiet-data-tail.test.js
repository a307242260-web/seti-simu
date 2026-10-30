'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation'),{createAnalysisPort}=require('./analysis-port'),values=require('./state-value'),{searchDecision}=require('./decision-search'),agent=require('./search-agent');
const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/ai-decision-corpus-20261023-v1/case-152-20261023-v1.json'))),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition,evaluate=values.createStateValueEvaluator(f.seatId),budget={transitions:256,nodes:1024,frontier:256,milliseconds:5000};
try{
 for(const score of [23,25]){
  const envelope=structuredClone(f.compositionEnvelope),s=JSON.parse(envelope.committedState),owner=s.players.players.find(p=>p.id===f.seatId);owner.mainActionCompleted=true;owner.resources.score=score;envelope.committedState=JSON.stringify(s);assert(c.lifecycle.restore(envelope).ok);
  const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});p.setResourcePlanning(true);p.setCardPickPlanning(true);p.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});
  try{
   const root=p.openRoot(),spec=p.turnTailSummary(root,'blue-end-turn');assert(spec);assert(spec.dataPlans.length);assert.equal(spec.markedTiles.length,1);assert(spec.requiredNativeInputs>10);
   const proof=p.turnTailBoundary(root,spec);assert.throws(()=>proof.observation,/NO_SUCCESSOR_OBSERVATION/);assert.throws(()=>p.valueObservation(proof),/NO_SUCCESSOR_OBSERVATION/);assert.throws(()=>p.expand(proof,spec.firstActionId),/BOUNDARY_CLOSED/);
   let node=root,count=0;for(const plan of spec.dataPlans){const actual=p.resourceSpec(node).plans.find(x=>x.goal.id===plan.goal.id);assert(actual);const r=p.expandResourcePlan(node,actual,()=>null);assert(r.complete);assert.equal(r.goalStatus,'completed');assert.equal(r.submissions,plan.requiredNativeInputs);node=r.node;count+=r.submissions;}
   node=p.expand(node,node.legalActions.find(a=>a.family==='end_turn').actionId);count++;
   for(const tile of spec.markedTiles){const choice=p.localDecisionSpec(node),a=node.legalActions.find(a=>a.actionId===choice.selectedActionId);assert.equal(a.target.tileId,tile);node=p.expand(node,a.actionId);count++;}
   assert.equal(count,spec.requiredNativeInputs);assert.equal(evaluate(p.valueObservation(node)),evaluate(root.observation)+spec.netGain);assert.deepEqual(c.lifecycle.save().envelope,before);
   const interrupted=searchDecision({port:p,root,evaluate,...agent.OPTIONS,planReuse:false,budget:{...budget,nodes:1}});assert(!interrupted.complete);assert.equal(interrupted.actionId,null);assert.equal(interrupted.stopReason,'node-budget');
   let time=0;const stopped=searchDecision({port:p,root,evaluate,...agent.OPTIONS,planReuse:false,now:()=>time+=10,budget:{...budget,milliseconds:15}});assert(!stopped.complete);assert.equal(stopped.actionId,null);assert.deepEqual(c.lifecycle.save().envelope,before);
  }finally{p.close();}
 }
}finally{c.dispose();}
console.log('quiet data prerequisites, native currency income and final marks match typed plan value; budgets/root isolation passed');
// Early-round controlled board: the probe is already consumed and the company
// swap is used. Currency income and blue rewards are a closed fixed tail;
// future income and held/paid investment must remain in the scalar quote.
{
 const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-047-20261030-v1.json'))),seed=f.source.seed;
 const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
 const envelope=structuredClone(f.compositionEnvelope),state=JSON.parse(envelope.committedState),own=state.players.players.find(p=>p.id===f.seatId);own.mainActionCompleted=true;envelope.committedState=JSON.stringify(state);assert(c.lifecycle.restore(envelope).ok);
 const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0}),evaluate=values.createStateValueEvaluator(f.seatId);
 try{
  p.setResourcePlanning(true);p.setCardPickPlanning(true);p.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});const root=p.openRoot();
  assert(!state.pieces.rockets.some(r=>r.playerId===f.seatId));assert(!root.legalActions.some(a=>a.family==='industry'));
  const spec=p.turnTailSummary(root,'data-end-turn');assert(spec);assert(spec.dataPlans?.length,'an income first action cannot be quoted as an unrelated blue-only tail');
  let current=root,inputs=0;
  while(p.resourceSpec(current)?.plans.length){
   const policy=p.resourceSpec(current);assert.equal(policy.plans.length,1);assert(['income','blue-data'].includes(policy.plans[0].goal.kind));
   const actual=p.expandResourcePlan(current,policy.plans[0],()=>null);assert(actual.complete);assert(actual.submissions>0);inputs+=actual.submissions;current=actual.node;
  }
  const end=current.legalActions.find(a=>a.family==='end_turn');assert(end);current=p.expand(current,end.actionId);inputs++;
  assert.equal(inputs,spec.requiredNativeInputs);assert.equal(evaluate(current.observation),evaluate(root.observation)+spec.netGain);
  assert.deepEqual(c.lifecycle.save().envelope,before);
 }finally{p.close();c.dispose();}
}
