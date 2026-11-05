'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation'),{createAnalysisPort}=require('./analysis-port'),values=require('./state-value'),search=require('./decision-search'),agent=require('./search-agent');
const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../reports/ai-foundation-20261105/third-round-teacher-v1/v223-paired-purple2-known-analysis-single-3-root-20261106-v1.json'))),seed=f.source.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);const original=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0}),evaluate=values.createStateValueEvaluator(f.seatId),proofs=new Map();
try{
 const port={...p,turnTailBoundary(node,spec){if(spec.publicAmibaCurrencyTail)proofs.set(node,spec);return p.turnTailBoundary(node,spec);}},r=search.searchDecision({port,root:p.openRoot(),evaluate,...agent.OPTIONS,modelKey:evaluate.modelKey,budget:agent.BUDGET});
 assert(r.complete);assert(r.diagnostics.nativeExecutions<=256);assert.equal(r.actionId,'play_card:52a456f8');assert.equal(r.value,125.58333333333333,'same choice and value as retained V223279-input native data-tail graph');assert(proofs.size>=9);
 let controls=0,inputs=0;
 for(const[node,spec]of proofs){
  assert.throws(()=>p.turnTailBoundary(node,spec).observation,/NO_SUCCESSOR_OBSERVATION/);const before=evaluate.details(p.valueObservation(node));let next=node,count=0;
  for(const step of spec.dataPlans){const plan=p.resourceSpec(next).plans.find(p=>p.goal.id===step.goal.id);assert(plan);const native=p.expandResourcePlan(next,plan,()=>null);assert(native.complete);next=native.node;count+=native.submissions;}
  const end=next.legalActions.find(a=>a.family==='end_turn');assert(end);next=p.expand(next,end.actionId);count++;
  while(next.status==='decision'){const fixed=p.localDecisionSpec(next);assert.equal(fixed?.kind,'fixed-final-mark');next=p.expand(next,fixed.selectedActionId);count++;}
  const after=evaluate.details(p.valueObservation(next));assert.equal(count,spec.requiredNativeInputs);assert.equal(after.value,values.sumValueParts([before.value,spec.netGain]));assert.equal(values.sumValueParts([after.unrealizedPurposeValue,-before.unrealizedPurposeValue]),spec.unrealizedPurposeDelta);assert.equal(before.purposePreparationDebt,0);assert.equal(after.purposePreparationDebt,0);controls++;inputs+=count;
 }
 assert.deepEqual(c.lifecycle.save().envelope,original);console.log(JSON.stringify({publicAmibaFixedCurrencyTail:true,nativeSearchInputs:r.diagnostics.nativeExecutions,nativeTailControls:controls,nativeTailInputs:inputs,fullNativeChoiceValueAndRealizationMatch:true,noInventedObservation:true,rootAndRngUnchanged:true}));
}finally{p.close();c.dispose();}
