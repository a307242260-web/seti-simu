'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation'),{createAnalysisPort}=require('./analysis-port'),{searchDecision}=require('./decision-search'),{createStateValueEvaluator}=require('./state-value'),agentFactory=require('./search-agent');
const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/ai-decision-corpus-20261023-v1/case-062-20261023-v1.json'))),seed=f.source.seed,seatId=f.seatId,evaluate=createStateValueEvaluator(seatId);
function kernel(envelope=f.compositionEnvelope){const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});assert(k.composition.lifecycle.restore(envelope).ok);return k;}
function actions(c){const v=c.inspect();return v.phase==='awaiting_input'?v.session.decision.choices:c.inputPort.enumerateActions({});}
function submit(c,id){const v=c.inspect(),a=actions(c).find(a=>a.actionId===id);assert(a);const r=v.phase==='awaiting_input'?c.inputPort.submitDecision({decisionId:v.session.decision.decisionId,decisionVersion:v.session.decision.decisionVersion,ownerId:v.session.decision.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));}
function normalize(e){const names=new Map(),v={...e,committedState:JSON.parse(e.committedState)};return JSON.parse(JSON.stringify(v).replace(/effect-session-[0-9]+(?=[:"\\])/g,n=>{if(!names.has(n))names.set(n,`session-ref-${names.size}`);return names.get(n);}));}
const budget={transitions:4096,nodes:8192,frontier:4096,milliseconds:15000};
// Compare the actual production factory with a fresh fully executed policy on
// every real prefix. The former linear lower-bound macro is incompatible with
// the Round2 capability value and must not be restored to satisfy old counts.
const k=kernel(),c=k.composition;submit(c,actions(c).find(a=>a.family==='play_card'&&a.target.cardInstanceId==='card-3-0').actionId);
const initial=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0}),agent=agentFactory.createSearchAgent({seatId,analysisPort:p});let inputs=0,hits=0,closed=false,first;
try{
 for(let step=0;step<32;step++){
  const before=c.lifecycle.save().envelope,choice=agent.decide({seatId,legalActions:actions(c)}),r=choice.search;assert(r.complete);assert.deepEqual(c.lifecycle.save().envelope,before);if(!first)first=choice.actionId;
  const recovered=kernel(before),q=createAnalysisPort({composition:recovered.composition,seatId,maxCacheEntries:0});
  try{
   const root=q.openRoot(),native={...q,turnTailSummary:()=>null,incomePlanSummary:()=>null,postMainValueBound:()=>null,postMainOptimalPlanSpec:()=>null};
   const cold=searchDecision({port:native,root,evaluate,...agentFactory.OPTIONS,planReuse:false,budget});assert(cold.complete,cold.stopReason);assert.equal(cold.actionId,choice.actionId);assert.equal(cold.value,r.value);assert.equal(r.diagnostics.postMainOptimalPlans,0);
   if(r.diagnostics.planContinuation==='hit'){assert.equal(r.diagnostics.nativeExecutions,0);hits++;}
   const next=q.expand(root,cold.actionId);closed=['other-owner','turn-boundary','terminal','information-barrier'].includes(next.status);
   submit(c,choice.actionId);submit(recovered.composition,cold.actionId);inputs++;assert.deepEqual(normalize(c.lifecycle.save().envelope),normalize(recovered.composition.lifecycle.save().envelope));
  }finally{q.close();recovered.composition.dispose();}
  if(closed)break;
 }
 assert(closed,'the fixed production window must reach a real native boundary');assert(inputs>1);p.close();
 // The next native input remains legal after an unrelated resource changes,
 // but it is insufficient evidence for reusing the old competitive result.
 assert(c.lifecycle.restore(initial).ok);const source=p.openRoot(),full=searchDecision({port:p,root:source,evaluate,...agentFactory.OPTIONS,budget});assert(full.complete);const token=full.planContinuation;assert(token);p.close();submit(c,full.actionId);
 const changed=structuredClone(c.lifecycle.save().envelope),state=changed.session?.session?.workingState||JSON.parse(changed.committedState);state.players.players.find(p=>p.id===seatId).resources.energy++;if(!changed.session)changed.committedState=JSON.stringify(state);assert(c.lifecycle.restore(changed).ok);
 const root=p.openRoot(),stale=searchDecision({port:p,root,evaluate,...agentFactory.OPTIONS,planContinuation:token,budget:{...budget,nodes:1}});assert.equal(stale.diagnostics.planContinuation,'dependencies-changed');assert(!stale.complete);assert.equal(stale.actionId,null);assert.equal(stale.planContinuation,null);
}finally{p.close();c.dispose();}
console.log(JSON.stringify({productionPostMainPlan:'passed',actualInputs:inputs,reusedPrefixes:hits,freshNativeAtEveryPrefix:true,changedDependenciesRejected:true}));
