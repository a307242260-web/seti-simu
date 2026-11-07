'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const load=n=>require(path.resolve(n)),read=p=>JSON.parse(fs.readFileSync(p));
const {createSeededRandom}=load('randomizer/game/random'),{createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=load('randomizer/app/rule-observation'),{createAnalysisPort}=load('randomizer/game/ai/analysis-port');
const search=load('randomizer/game/ai/decision-search'),agent=load('randomizer/game/ai/search-agent'),values=load('randomizer/game/ai/state-value');
const [fixture,oldRecord,out]=process.argv.slice(2),f=read(fixture),before=read(oldRecord).rows['179'].stop.search,seat=f.seatId,seed=f.source.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});
const c=k.composition,p=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
const evaluate=values.createStateValueEvaluator(seat),proofs=new Map();
try{
 assert(c.lifecycle.restore(f.compositionEnvelope).ok);const initial=c.lifecycle.save().envelope;
 const port={...p,turnTailBoundary(node,spec){if(spec.computerThenQuietEnd?.unprofitableBlue)proofs.set(node,spec);return p.turnTailBoundary(node,spec);}};
 const r=search.searchDecision({port,root:p.openRoot(),evaluate,...agent.OPTIONS,modelKey:evaluate.modelKey,budget:agent.BUDGET});
 assert(r.complete&&r.unresolved.length===0&&r.diagnostics.nativeExecutions<=256);
 const ranks=q=>q.roots.map(x=>[x.actionId,x.goal||null,x.value,x.realization??null,x.preparationDebt??null]);
 assert.deepEqual(JSON.parse(JSON.stringify(ranks(r))),ranks(before));assert.equal(r.actionId,before.actionId);
 assert.equal(proofs.size,7);
 const rows=[];
 for(const [node,spec]of proofs){
  const start=evaluate.details(p.valueObservation(node)),resource=p.resourceSpec(node);
  assert.equal(resource.plans.length,1);assert.equal(resource.plans[0].goal.id,'data:computer-prefix:3');
  const fixed=p.expandResourcePlan(node,resource.plans[0],()=>null);
  assert(fixed.complete);assert.equal(fixed.newSubmissions,6);
  assert.deepEqual(p.valueObservation(fixed.node).publicState.players.find(x=>x.playerId===seat).dataProgress.computerSlots,[1,2,3]);
  const remaining=p.resourceSpec(fixed.node);
  assert.equal(remaining.plans.length,0);
  const rejected=remaining.blueTails.find(t=>t.goalId==='data:blue:1');
  assert.equal(rejected.selected,false);assert.equal(rejected.netGain,0);assert.equal(rejected.dataCornerId,spec.computerThenQuietEnd.unprofitableBlue.cardId);
  const end=fixed.node.legalActions.find(a=>a.family==='end_turn');
  assert(remaining.retainedActionIds.includes(end.actionId));
  const endpoint=p.expand(fixed.node,end.actionId),after=evaluate.details(p.valueObservation(endpoint));
  assert.equal(after.value,values.sumValueParts([start.value,spec.netGain]));
  assert.equal(values.sumValueParts([after.unrealizedPurposeValue,-start.unrealizedPurposeValue]),spec.unrealizedPurposeDelta);
  assert.equal(fixed.submissions+1,spec.requiredNativeInputs);
  rows.push({beforeValue:start.value,afterValue:after.value,inputs:fixed.submissions+1,
   previousCard:rejected.dataCornerId,blueNet:rejected.netGain,companyAfter:p.cardPickSpec(fixed.node)?.goal||null});
 }
 assert.deepEqual(c.lifecycle.save().envelope,initial);
 fs.writeFileSync(out,JSON.stringify({scope:'Seven previously materialized quiet tails independently expanded through Native current policy; complete root ranking same.',
  oldNativeInputs:before.diagnostics.nativeExecutions,newNativeInputs:r.diagnostics.nativeExecutions,rows,
  rootAndRngUnchanged:true,newAutonomousRuns:0},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({ranksExact:true,paths:rows.length,replayed:rows.reduce((n,x)=>n+x.inputs,0),oldNative:before.diagnostics.nativeExecutions,newNative:r.diagnostics.nativeExecutions}));
}finally{p.close();c.dispose();}
