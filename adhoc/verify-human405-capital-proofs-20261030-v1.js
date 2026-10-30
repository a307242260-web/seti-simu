'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),values=require('../randomizer/game/ai/state-value'),search=require('../randomizer/game/ai/decision-search'),agent=require('../randomizer/game/ai/search-agent');
assert.equal(search.VERSION,"seti-complete-decision-search-v78","Restore the archived v78 candidate in an isolated base snapshot; production v67 is not this experiment");
const step=Number(process.argv[2]),version=search.VERSION.split('-').at(-1),output=`reports/ai-foundation-20261023/human405-${version}-capital-native-controls-${step}-20261030-v1.json`;assert(!fs.existsSync(output),'Reuse native controls');
const fixture=`adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-${String(step).padStart(3,'0')}-20261030-v1.json`,f=JSON.parse(fs.readFileSync(fixture)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0}),proofs=[],income=[],evaluate=values.createStateValueEvaluator(f.seatId),budget={transitions:4096,nodes:8192,frontier:4096,milliseconds:15000};
const value=n=>evaluate(p.valueObservation(n));
try{
 const proxy={...p,turnTailBoundary(node,spec){const r=p.turnTailBoundary(node,spec);proofs.push({node,spec,proof:r});return r;},incomePlanBoundary(node,spec){const r=p.incomePlanBoundary(node,spec);income.push({node,spec,proof:r});return r;}};
 const result=search.searchDecision({port:proxy,root:p.openRoot(),evaluate,...agent.OPTIONS,budget});assert(result.complete,result.stopReason);const actualSearchInputs=p.getDiagnostics().submissionCount,controls=[];
 for(const {node,spec,proof} of [...proofs,...income]){
  const sourceValue=value(node),countBefore=p.getDiagnostics().submissionCount;let child=node,logical=0;
  const submit=id=>{assert(id);child=p.expand(child,id);logical++;};
  if(spec.kind==='end-turn')submit(spec.firstActionId);
  else if(spec.kind==='blue-end-turn'){
   submit(spec.firstActionId);submit(child.legalActions.find(a=>a.target?.target==='blueBonus'&&a.target.blueSlot===spec.blueSlot)?.actionId);submit(child.legalActions.find(a=>a.family==='end_turn')?.actionId);
  }else{
   const plan=p.resourceSpec(node).plans.find(p=>p.goal.id===spec.goal.id),r=p.expandResourcePlan(node,plan,()=>null);assert(r.complete);child=r.node;logical=r.submissions;
  }
  assert.equal(logical,spec.requiredNativeInputs);assert.equal(value(child),sourceValue+spec.netGain);
  assert.throws(()=>proof.observation,/NO_SUCCESSOR_OBSERVATION/);assert.throws(()=>p.valueObservation(proof),/NO_SUCCESSOR_OBSERVATION/);assert.throws(()=>p.expand(proof,spec.firstActionId),/BOUNDARY_CLOSED/);
  controls.push({kind:spec.kind||'income',beforeValue:sourceValue,predictedValue:sourceValue+spec.netGain,nativeValue:value(child),logicalNativeInputs:logical,newNativeInputs:p.getDiagnostics().submissionCount-countBefore,actualBoundary:child.status});
 }
 assert.deepEqual(c.lifecycle.save().envelope,before);p.close();
 // A fresh full native search of exactly the same policy set. Both plan-value
 // shortcuts are disabled; this control does not reuse the admission execution DAG.
 const native=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});let reference;
 try{reference=search.searchDecision({port:{...native,turnTailSummary:()=>null,incomePlanSummary:()=>null},root:native.openRoot(),evaluate,...agent.OPTIONS,budget});assert(reference.complete,reference.stopReason);assert.equal(reference.actionId,result.actionId);assert.equal(reference.value,result.value);assert.deepEqual(c.lifecycle.save().envelope,before);}finally{native.close();}
 const sourceHashes=Object.fromEntries(Object.keys(require.cache).filter(p=>p.startsWith(process.cwd()+'/randomizer/')).sort().map(p=>[p.slice(process.cwd().length+1),crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
 const report={schemaVersion:'seti-capital-native-plan-controls-v1',searchVersion:search.VERSION,fixture,actualSearchInputs,controlSearchInputs:reference.diagnostics.nativeExecutions,bestAction:result.actionId,value:result.value,sameBestAsFreshFullyExecutedPolicy:true,controls,sourceRootAndRngUnchanged:true,scope:'Native controls for every used income/quiet-tail proof in this root; a separate fresh search disables both shortcuts. Diagnostic timings are not performance admission.',sourceHashes};fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({step,controls:controls.length,kinds:controls.reduce((a,c)=>(a[c.kind]=(a[c.kind]||0)+1,a),{}),actualSearchInputs,fullNativeInputs:reference.diagnostics.nativeExecutions,sameBestActionAndValue:true}));
}finally{p.close();c.dispose();}
