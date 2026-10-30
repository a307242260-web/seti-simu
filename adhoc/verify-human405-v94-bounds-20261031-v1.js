'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),values=require('../randomizer/game/ai/state-value'),search=require('../randomizer/game/ai/decision-search'),agent=require('../randomizer/game/ai/search-agent');
assert.equal(search.VERSION,'seti-complete-decision-search-v94');
const [kind,id]=process.argv.slice(2),fixture=kind==='teacher'?`adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-${id.padStart(3,'0')}-20261030-v1.json`:`adhoc/ai-decision-corpus-20261023-v1/case-${id.padStart(3,'0')}-20261023-v1.json`,output=`reports/ai-foundation-20261023/human405-v94-native-bound-controls-${kind}-${id}-20261030-v1.json`;
assert(!fs.existsSync(output),'Reuse the existing checkpoint');
const f=JSON.parse(fs.readFileSync(fixture)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0}),evaluate=values.createStateValueEvaluator(f.seatId),budget={transitions:16384,nodes:32768,frontier:16384,milliseconds:30000},sources=new WeakMap();
const noShortcuts=port=>({...port,postMainValueBound:()=>null,turnTailSummary:()=>null,incomePlanSummary:()=>null});
try{
 const proofs=[],income=[];const proxy={...p,turnTailBoundary(node,spec){const proof=p.turnTailBoundary(node,spec);proofs.push({node,spec,proof});return proof;},incomePlanBoundary(node,spec){const proof=p.incomePlanBoundary(node,spec);income.push({node,spec,proof});return proof;},postMainValueBound(node){const bound=p.postMainValueBound(node);if(bound)sources.set(bound,node);return bound;}};
 const result=search.searchDecision({port:proxy,root:p.openRoot(),evaluate,...agent.OPTIONS,budget});assert(result.complete,result.stopReason);const actualSearchInputs=p.getDiagnostics().submissionCount,controls=[];
 const proofControls=[];
 for(const {node,spec,proof} of [...proofs,...income]){
  const sourceValue=evaluate(p.valueObservation(node));let child=node,logical=0;
  if(['blue-end-turn','data-end-turn'].includes(spec.kind)){
   const expected=spec.dataPlans||[{goal:{kind:'blue-data',blueSlot:spec.blueSlot}}];
   for(const item of expected){
    const plan=p.resourceSpec(child)?.plans.find(x=>x.goal.kind===item.goal.kind&&(item.goal.id?x.goal.id===item.goal.id:x.goal.blueSlot===item.goal.blueSlot));assert(plan);
    const r=p.expandResourcePlan(child,plan,()=>null);assert(r.complete);assert.equal(r.goalStatus,'completed');logical+=r.submissions;child=r.node;
    if(item.dataCornerIds)assert.deepEqual(r.prefixes.filter(x=>x.action.family==='card_corner').map(x=>x.action.target.cardInstanceId),item.dataCornerIds);
    if(item.incomeCardId)assert.equal(r.prefixes.find(x=>x.action.target?.choiceId?.startsWith('income:')).action.target.cardInstanceId,item.incomeCardId);
   }
  }else if(spec.kind!=='end-turn'){
   const plan=p.resourceSpec(node).plans.find(x=>x.goal.id===spec.goal.id),r=p.expandResourcePlan(node,plan,()=>null);assert(r.complete);logical+=r.submissions;child=r.node;
  }
  if(spec.kind){const end=child.legalActions.find(a=>a.family==='end_turn');assert(end);child=p.expand(child,end.actionId);logical++;
   for(const tile of spec.markedTiles||[]){const choice=p.localDecisionSpec(child);assert(choice);const action=child.legalActions.find(a=>a.actionId===choice.selectedActionId);assert.equal(action.target.tileId,tile);child=p.expand(child,action.actionId);logical++;}
   assert(['other-owner','turn-boundary','terminal','information-barrier'].includes(child.status),child.status);const a=p.valueObservation(node).publicState,b=p.valueObservation(child).publicState;assert.notDeepEqual([a.roundNumber,a.turnNumber,a.actionCycleNumber],[b.roundNumber,b.turnNumber,b.actionCycleNumber],'native end must actually advance the turn even when an earlier refill barrier is carried');
  }
  assert.equal(logical,spec.requiredNativeInputs);const nativeValue=evaluate(p.valueObservation(child));assert.equal(nativeValue,sourceValue+spec.netGain,JSON.stringify({spec,sourceValue,nativeValue}));
  assert.throws(()=>proof.observation,/NO_SUCCESSOR_OBSERVATION/);assert.throws(()=>p.valueObservation(proof),/NO_SUCCESSOR_OBSERVATION/);assert.throws(()=>p.expand(proof,spec.firstActionId||spec.goal.id),/BOUNDARY_CLOSED/);
  proofControls.push({kind:spec.kind||'income',sourceValue,predictedValue:sourceValue+spec.netGain,nativeValue,logicalNativeInputs:logical,dataPlans:spec.dataPlans||null});
 }
 for(const line of result.lines){const prune=line.prunedByBound;if(prune?.boundKind!=='post-main-continuation')continue;
  const node=sources.get(prune.bound);assert(node);const reference=search.searchDecision({port:noShortcuts(p),root:node,evaluate,...agent.OPTIONS,planReuse:false,budget});assert(reference.complete,reference.stopReason);assert(reference.value<=prune.upperBound,JSON.stringify({node:line.node,nativeValue:reference.value,upper:prune.upperBound,bound:prune.bound}));
  controls.push({node:line.node,sourceValue:prune.currentValue,maximumIncrease:prune.bound.maximumValueIncrease,upperBound:prune.upperBound,nativeBestValue:reference.value,nativeInputs:reference.diagnostics.nativeExecutions,bound:prune.bound});
 }
 assert.deepEqual(c.lifecycle.save().envelope,before);p.close();
 const native=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});let reference;
 try{reference=search.searchDecision({port:noShortcuts(native),root:native.openRoot(),evaluate,...agent.OPTIONS,planReuse:false,budget});assert(reference.complete,reference.stopReason);assert.equal(reference.actionId,result.actionId);assert.equal(reference.value,result.value);assert.deepEqual(c.lifecycle.save().envelope,before);}finally{native.close();}
 const sourceHashes=Object.fromEntries(Object.keys(require.cache).filter(p=>p.startsWith(process.cwd()+'/randomizer/')).sort().map(p=>[p.slice(process.cwd().length+1),crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
 fs.writeFileSync(output,JSON.stringify({schemaVersion:'seti-capital-native-bound-controls-v1',searchVersion:search.VERSION,fixture,actualSearchInputs,controlSearchInputs:reference.diagnostics.nativeExecutions,bestAction:result.actionId,value:result.value,sameBestAsFreshNativePolicy:true,sourceRootAndRngUnchanged:true,controls,proofControls,sourceHashes,scope:'Every pruned post-main continuation executes the same policy to closure with numeric bounds and both plan-value shortcuts disabled. A fresh full root control additionally compares best action/value. Diagnostic verification is not speed admission.'},null,2)+'\n');console.log(JSON.stringify({kind,id,controls:controls.length,proofControls:proofControls.length,actualSearchInputs,fullNativeInputs:reference.diagnostics.nativeExecutions,sameBestActionAndValue:true}));
}finally{p.close();c.dispose();}
