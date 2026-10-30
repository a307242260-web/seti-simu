'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),values=require('../randomizer/game/ai/state-value'),search=require('../randomizer/game/ai/decision-search'),agent=require('../randomizer/game/ai/search-agent'),scenario=require('../tools/research-human405-round1');
const output='reports/ai-foundation-20261023/human405-v119-movement-recovery-counterexample-20261031-v1.json',sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');assert(!fs.existsSync(output),'Reuse checkpoint');
const recordPath='reports/research/12231ee9.2fb2b091.quick-200.json',record=JSON.parse(fs.readFileSync(recordPath)),save=JSON.parse(fs.readFileSync(record.savePath)),seed=record.seed,seatId='player-white';
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition,opening=scenario.opening().checkpoint.coreState.compositionEnvelope;assert(c.lifecycle.restore(opening).ok);
const warm=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});let cold;
try{
 for(const p of [warm]){p.setMovementPlanning(true);p.setCardPickPlanning(true);p.setResourcePlanning(true);p.setDecisionPlanning({scanPlanning:true,finalMarkPlanning:true});}
 let node=warm.openRoot();
 for(const entry of save.replaySteps.slice(23,26)){
  warm.goalMovementSpec(node);
  node=warm.expand(node,entry.action.actionId);
  const decision=c.inspect().session?.decision,action=(decision?.choices||c.inputPort.enumerateActions({})).find(a=>a.actionId===entry.action.actionId);assert(action);
  const result=decision?c.inputPort.submitDecision({decisionId:decision.decisionId,decisionVersion:decision.decisionVersion,ownerId:decision.ownerId,choice:action}):action.phase==='quick'?c.inputPort.submitQuickAction(action):c.inputPort.submitAction(action);assert(result.ok);
 }
 const before=c.lifecycle.save().envelope;
 const fixture='adhoc/ai-decision-corpus-20261031-v119-recovery-v1/autonomous-after-input026-20261031-v1.json';fs.mkdirSync(require('node:path').dirname(fixture),{recursive:true});fs.writeFileSync(fixture,JSON.stringify({source:{seed,recordPath,afterInput:26,recordSha256:sha(recordPath)},seatId,compositionEnvelope:before},null,2)+'\n');
 cold=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});cold.setMovementPlanning(true);cold.setCardPickPlanning(true);cold.setResourcePlanning(true);cold.setDecisionPlanning({scanPlanning:true,finalMarkPlanning:true});const root=cold.openRoot();
 assert.deepEqual(node.observation,root.observation,'same full native observation after identical real inputs');
 const warmMovement=warm.goalMovementSpec(node),coldMovement=cold.goalMovementSpec(root),warmResources=warm.resourceSpec(node),coldResources=cold.resourceSpec(root),spec=warm.incomePlanSummary(node);assert(spec);
 const plan=warmResources.plans.find(p=>p.goal.kind==='income');assert(plan);const native=warm.expandResourcePlan(node,plan,()=>null);assert(native.complete);const nativeValue=values.evaluateStateValue(warm.valueObservation(native.node),seatId).total;
 const evaluate=values.createStateValueEvaluator(seatId),result=search.searchDecision({port:cold,root,evaluate,...agent.OPTIONS,budget:agent.BUDGET});assert(result.complete);assert(nativeValue>result.value);
 assert.deepEqual(c.lifecycle.save().envelope,before);
 const sourceHashes=Object.fromEntries(Object.keys(require.cache).filter(p=>p.startsWith(process.cwd()+'/randomizer/')).sort().map(p=>[p.slice(process.cwd().length+1),sha(p)]));
 const report={schemaVersion:'seti-human405-plan-recovery-counterexample-v1',sourceCommit:record.gitCommit,recordPath,recordSha256:sha(recordPath),fixture,fixtureSha256:sha(fixture),sourceHashes,sameNativeValueObservation:true,rootAndRngUnchanged:true,
  warm:{movement:warmMovement,resourcePlans:warmResources.plans.map(p=>p.goal),incomeProof:spec,nativeInputs:native.submissions,nativeValue},cold:{movement:coldMovement,resourcePlans:coldResources.plans.map(p=>p.goal),value:result.value,inputs:result.diagnostics.nativeExecutions,actionId:result.actionId},
  finding:'After the same first three real white inputs, retained Mars movement intent admits a native income plan, while a fresh root recovers a new forced Venus movement intent and suppresses that legal income purpose. The better income witness is executed natively; this is candidate/recovery policy inconsistency, not an unverified score tradeoff.',goalStatus:'active',productionFixed:false};
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,warmValue:nativeValue,coldValue:result.value,warmNativeInputs:native.submissions,coldInputs:result.diagnostics.nativeExecutions,warmGoal:warmMovement?.chosenGoal?.id,coldGoal:coldMovement?.chosenGoal?.id}));
}finally{warm.close();cold?.close();c.dispose();}
