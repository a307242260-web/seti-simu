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
 const proof=port.turnTailSummary(root,'data-end-turn');assert(proof,'the known Amiba prefix has an exact quiet data/end scalar proof');assert.equal(proof.netGain,4);assert.equal(proof.requiredNativeInputs,5);assert.throws(()=>port.turnTailBoundary(root,proof).observation,/NO_SUCCESSOR_OBSERVATION/);
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
 const end=c.inputPort.enumerateActions({}).find(a=>a.family==='end_turn');assert(end);assert(apply(end).ok);
 assert.equal(values.sumValueParts([evaluate(c.projection({role:'player',playerId:seatId}).state),-evaluate(root.observation)]),proof.netGain,'all five actual inputs must match the scalar-only Amiba tail');
 // Current data only: do not spend a card or cross the native income choice.
 assert.equal(demand.capacity(base,seatId,{...plan.goal,targetComputerSlot:4}),false);
 const short=structuredClone(base);own(short).dataState.poolTokens.pop();own(short).resources.availableData--;assert.equal(demand.capacity(short,seatId,plan.goal),false);assert.equal(local.computerCompletion({state:short,seatId,goal:plan.goal}).selected,false);
 const gap=structuredClone(base);own(gap).dataState.placedTokens.find(t=>t.placementKind==='computer').placementSlot=2;assert.equal(local.computerCompletion({state:gap,seatId,goal:plan.goal}).selected,false);
 const noProfit=structuredClone(base);own(noProfit).resources.publicity=10;own(noProfit).techState.disabledTiles.blue1=true;assert.equal(local.computerCompletion({state:noProfit,seatId,goal:{...plan.goal,targetComputerSlot:2}}).selected,false);
 // A prefix crossing50 must include the same native final mark as the proof.
 const crossing=structuredClone(base);own(crossing).resources.score=49;own(crossing).scoreSources.initialScore+=3;
 assert(c.lifecycle.restore({...envelope,committedState:JSON.stringify(crossing)}).ok);const marked=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});marked.setResourcePlanning(true);marked.setCardPickPlanning(true);
 try{const n=marked.openRoot(),tail=marked.turnTailSummary(n,'data-end-turn');assert(tail);const g=marked.resourceSpec(n).plans[0],native=marked.expandResourcePlan(n,g,()=>null);assert(native.complete);
  for(const prefix of native.prefixes){const d=c.inspect().session?.decision,a=(d?.choices||c.inputPort.enumerateActions({})).find(a=>a.actionId===prefix.action.actionId);assert(a);assert(apply(a).ok);}
  assert(apply(c.inputPort.enumerateActions({}).find(a=>a.family==='end_turn')).ok);const d=c.inspect().session.decision;assert(d.choices.every(a=>a.target.choiceId.startsWith('final:')));
  const working=c.lifecycle.save().envelope.session.session.workingState,selected=local.finalMark({state:working,seatId,actions:d.choices});assert(apply(d.choices.find(a=>a.actionId===selected.selectedActionId)).ok);
  assert.equal(tail.requiredNativeInputs,6);assert.equal(values.sumValueParts([evaluate(c.projection({role:'player',playerId:seatId}).state),-evaluate(n.observation)]),tail.netGain);
 }finally{marked.close();}
 for(const kind of ['pending-reveal','historical-trigger']){
  const changed=structuredClone(base);
  if(kind==='pending-reveal')for(const type of ['blue','pink'])Object.assign(changed.aliens.aliens['2'].traces[type],{firstPlaced:true,ownerPlayerColor:'white'});
  else{const event={type:'researchTech',techType:'orange',playerId:seatId};assert(require('../cards/effects').collectMatchingTriggers(own(changed),event).length);changed.turn.type1TriggerEvents=[...(changed.turn.type1TriggerEvents||[]),event];}
  const restored=c.lifecycle.restore({...envelope,committedState:JSON.stringify(changed)});assert(restored.ok,kind+': '+JSON.stringify(restored));const negative=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});negative.setResourcePlanning(true);negative.setCardPickPlanning(true);
  try{assert.equal(negative.turnTailSummary(negative.openRoot(),'data-end-turn'),null,kind+' must keep native continuation');}finally{negative.close();}
 }
 assert(c.lifecycle.restore(f.compositionEnvelope).ok);
 for(const family of ['launch','end_turn','play_card']){const action=c.inputPort.enumerateActions({}).find(a=>a.family===family&&(family!=='play_card'||a.target.cardInstanceId==='alien-amiba-1-2'));assert(action);assert(apply(action).ok);}
 const live=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});live.setResourcePlanning(true);live.setCardPickPlanning(true);
 try{assert.equal(live.turnTailSummary(live.openRoot(),'data-end-turn'),null,'a real native launch must retain movement and cold-intent continuation');}finally{live.close();}
 assert(c.lifecycle.restore(envelope).ok);const proved=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
 try{const r=require('./decision-search').searchDecision({port:proved,root:proved.openRoot(),evaluate,...require('./search-agent').OPTIONS,modelKey:evaluate.modelKey,budget:{transitions:null,nodes:null,frontier:null,milliseconds:null}});assert(r.complete);assert.equal(r.diagnostics.nativeExecutions,0);assert.equal(r.diagnostics.provedTurnTailInputs,5);assert.equal(r.actionId,plan.firstActionId);assert.equal(r.value,values.sumValueParts([evaluate(root.observation),proof.netGain]));}finally{proved.close();}
 assert.deepEqual(c.lifecycle.save().envelope,envelope);
 console.log(JSON.stringify({computerPrefixPlan:true,prefixInputs:4,quotedAndNativeValueGain:4,coldRestoreAtEveryInput:true,quietAmibaTailNativeInputControls:[5,6],pendingRevealHistoryAndProbeRefuseProof:true,noUnfundedOrIncomeCrossing:true,rootAndRngUnchanged:true}));
}finally{port?.close();c.dispose();}
