"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation'),{createAnalysisPort}=require('./analysis-port'),{searchDecision}=require('./decision-search'),{createStateValueEvaluator}=require('./state-value'),agent=require('./search-agent'),movement=require('./goal-movement'),ability=require('../abilities/rocket'),rockets=require('../rockets'),solar=require('../../solar-system/core');
const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/ai-decision-corpus-20261023-v1/case-062-20261023-v1.json'))),seatId=f.seatId,seed=f.source.seed;
function kernel(){const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});return k;}
const k=kernel(),comp=k.composition;assert(comp.lifecycle.restore(f.compositionEnvelope).ok);
const play=comp.inputPort.enumerateActions({}).find(a=>a.family==='play_card'&&a.target.cardInstanceId==='card-40-0');assert(comp.inputPort.submitAction(play).ok);const pending=comp.lifecycle.save().envelope,evaluate=createStateValueEvaluator(seatId);
function open(envelope,cache=0){assert(comp.lifecycle.restore(envelope).ok);const port=createAnalysisPort({composition:comp,seatId,maxCacheEntries:cache});port.setMovementPlanning(true);return{port,root:port.openRoot(),before:comp.lifecycle.save().envelope};}
// A mandatory free step covers only its one point, not the entire future route.
{
 const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-026-20261030-v1.json'))),session=f.compositionEnvelope.session.session,state=session.workingState,before=structuredClone(state);
 const endpoints=require('../production-kernel').getProbeRouteRequirements(state,f.seatId).candidates.filter(c=>c.requirementId==='rocket:3:land:mercury:planet:'||c.requirementId==='rocket:3:orbit:venus:planet:');
 assert.equal(endpoints.length,2);assert.equal(endpoints.find(c=>c.planetId==='mercury').required.movementPoints,4);assert.equal(endpoints.find(c=>c.planetId==='venus').required.movementPoints,2);
 const policy=movement.plan({state,seatId:f.seatId,actions:session.queue[0].payload.choices,status:'decision',session,endpoints:()=>endpoints});
 assert.equal(policy.chosenGoal.id,'rocket:3:orbit:venus:planet:','after the one free point, Venus has1 paid point versus Mercury3; future route costs still affect the objective');
 assert.equal(policy.intent.path.reduce((n,p)=>n+p.requiredMovePoints,0),2);assert.equal(policy.intent.prefixOnly,true);assert.deepEqual(state,before);
}
// With every other seat passed, the next own turn has no intervening rotation.
{
 const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-038-20261030-v1.json'))),seed=f.source.seed;
 const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,state=JSON.parse(before.committedState);
 assert(state.turn.activePlayerIds.filter(id=>!state.turn.passedPlayerIds.includes(id)).every(id=>id===f.seatId));const end=c.inputPort.enumerateActions({}).find(a=>a.family==='end_turn');assert(end);assert(c.inputPort.submitAction(end).ok);const after=JSON.parse(c.lifecycle.save().envelope.committedState);assert.equal(after.turn.currentPlayerId,f.seatId);assert.deepEqual(after.solarSystem.rotation,state.solarSystem.rotation);assert.deepEqual(after.pieces,state.pieces);
 assert(c.lifecycle.restore(before).ok);const p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});p.setMovementPlanning(true);
 try{const root=p.openRoot(),policy=p.goalMovementSpec(root);assert.equal(policy.selectedActionId,null,'do not force paid preparation for a rotation that cannot intervene before the next own turn');assert.equal(policy.reason,'defer-movement');assert(policy.retainedActionIds.includes(end.actionId));assert.deepEqual(c.lifecycle.save().envelope,before);}finally{p.close();c.dispose();}
}
// No rotation does not remove deadlines from a real expiring movement modifier.
{
 const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-038-20261030-v1.json'))),state=JSON.parse(f.compositionEnvelope.committedState),seat=f.seatId;
 state.turn.cardTurnEventBonuses.push({playerId:seat,duration:'turn',eventType:'move',movementModifiers:{ignoreAsteroidRestriction:true}});
 const next=structuredClone(state);require('../turn-flow').advanceTurnAfterPlayerAction(next,seat);const owner=state.players.players.find(p=>p.id===seat),future=next.players.players.find(p=>p.id===seat);assert(ability.ignoresAsteroidRestriction(state,owner));assert(!ability.ignoresAsteroidRestriction(next,future));
 const native=require('../production-kernel'),now=native.getProbeRouteRequirements(state,seat).candidates,later=native.getProbeRouteRequirements(next,seat).candidates;
 assert(now.some(a=>later.some(b=>b.requirementId===a.requirementId&&b.required.movementPoints>a.required.movementPoints)),'formal movement costs increase when the current-turn ability expires');
 const k=createSimulationRuleComposition({seed:f.source.seed,random:createSeededRandom(f.source.seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,f.source.seed,v?.playerId)});k.newGame({seed:f.source.seed});const c=k.composition;assert(c.lifecycle.restore({...f.compositionEnvelope,committedState:JSON.stringify(state)}).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});p.setMovementPlanning(true);
 try{const policy=p.goalMovementSpec(p.openRoot());assert.notEqual(policy.deferredGoal?.reason,'no-intervening-rotation-before-next-own-turn');assert.equal(policy.deferredGoal?.movementTiming?.reason,'temporary-or-company-movement-context','retain the native timing query limitation instead of treating no rotation as a cost-equivalence proof');assert.deepEqual(c.lifecycle.save().envelope,before);}finally{p.close();c.dispose();}
}
// Prepaying one movement point does not replace the objective chosen before payment.
{
 const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-025-20261030-v1.json'))),seed=f.source.seed;
 const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);const p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});p.setMovementPlanning(true);
 const root=p.openRoot(),before=c.lifecycle.save().envelope,prior=p.goalMovementSpec(root);assert(prior.selectedActionId);const first=prior.intent.path[0];
 const paid=p.expand(root,f.source.teacherActionId),bound=p.goalMovementSpec(paid);assert.equal(bound.chosenGoal.id,prior.chosenGoal.id,'recover the purpose from the native trade base state, not from a newly free whole-route estimate');const selected=paid.legalActions.find(a=>a.actionId===bound.selectedActionId);assert.equal(selected.target.deltaX,first.deltaX);assert.equal(selected.target.deltaY,first.deltaY);assert.deepEqual(c.lifecycle.save().envelope,before);p.close();
 const actual=c.inputPort.enumerateActions({}).find(a=>a.actionId===f.source.teacherActionId);assert(c.inputPort.submitQuickAction(actual).ok);const pending=c.lifecycle.save().envelope,cold=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});cold.setMovementPlanning(true);try{const recovered=cold.goalMovementSpec(cold.openRoot());assert.equal(recovered.chosenGoal.id,prior.chosenGoal.id);assert.equal(recovered.selectedActionId,bound.selectedActionId);assert.deepEqual(c.lifecycle.save().envelope,pending);}finally{cold.close();c.dispose();}
}
// DLC40 follows one complete, explicit objective; it stops at that target with free allowance left.
let routeSteps=0,goal;
{
 const {port,root,before}=open(pending);let node=root,initial=port.goalMovementSpec(node);assert(initial.chosenGoal);goal=initial.chosenGoal;assert(initial.intent.path.length>0);assert.equal(initial.isEquivalence,false);
 for(let guard=0;guard<12&&node.status==='decision';guard++){
  const spec=port.goalMovementSpec(node);assert(spec,'selected fixture has an uninterrupted native movement route');assert.equal(spec.chosenGoal.id,goal.id);
  assert.equal(node.legalActions.filter(a=>movement.isDirection(a)&&spec.retainedActionIds.includes(a.actionId)).length,spec.reason==='objective-reached'?0:1);
  const action=node.legalActions.find(a=>a.actionId===spec.selectedActionId);assert(action);if(movement.isDirection(action)){
   const step=spec.intent.path[0];assert.equal(action.target.rocketId,spec.intent.rocketId);assert.equal(action.payload.requiredMovePoints,step.requiredMovePoints);routeSteps++;
  }else assert(action.target.skip||action.target.mode==='skip');
  node=port.expand(node,action.actionId);
 }
 assert.equal(node.status,'stable');const doneSpec=port.goalMovementSpec(node);assert(doneSpec);assert.equal(doneSpec.selectedActionId,null);
 const quick=node.legalActions.find(a=>a.target?.tradeId==='energy-for-move');if(quick){assert(doneSpec.excludedActionIds.includes(quick.actionId));const paid=port.expand(node,quick.actionId),preparation=port.goalMovementSpec(paid);assert(preparation.selectedActionId);assert(preparation.intent.path.length>0);}
 assert.equal(routeSteps,initial.intent.path.length);assert(routeSteps<5);assert.deepEqual(comp.lifecycle.save().envelope,before);port.close();
}
// Native route costs, occupied destinations and wrapped geometry are honoured without state mutation.
{
 const state=structuredClone(pending.session.session.workingState),owner=state.players.players.find(p=>p.id===seatId),ship=state.pieces.rockets.find(r=>r.playerId===seatId),before=structuredClone(state);
 const actions=ability.listPlayerMoveChoices({...state,state},owner,{maxPoints:5}).map((a,i)=>({actionId:`move-${i}`,family:'choose_target',target:a,payload:{remaining:5,requiredMovePoints:a.requiredMovePoints}}));actions.push({actionId:'skip',family:'choose_target',target:{skip:true},payload:{remaining:5}});
 const spec=movement.plan({state,seatId,actions,status:'decision',session:pending.session.session});assert(spec);assert(spec.routingNodes<=32);
 for(const step of spec.intent?.path||[]){assert(rockets.canMoveFromCoordinate(state.pieces,step.from,step.deltaX,step.deltaY,ship.id).ok);assert.equal(step.requiredMovePoints,ability.getRequiredMovePointsFromCoordinate({...state,state},owner,step.from));}
 assert.deepEqual(state,before);
 const empty=structuredClone(state),p=empty.players.players.find(p=>p.id===seatId);p.reservedCards=[];p.resources.publicity=10;
 const stop=movement.plan({state:empty,seatId,actions,status:'decision',session:pending.session.session,endpoints:()=>[]});assert.equal(stop.selectedActionId,'skip');assert.equal(stop.chosenGoal,null);assert.equal(stop.reason,'no-affordable-objective');
}
// Ordinary paid movement binds its objective through a real native payment Decision.
{
 const {port,root,before}=open(f.compositionEnvelope),spec=port.goalMovementSpec(root);assert(spec?.chosenGoal);assert(spec.intent.path.length>1);
 const payment=port.expand(root,spec.selectedActionId);assert.equal(payment.status,'decision');const paymentPolicy=port.goalMovementSpec(payment);assert.equal(paymentPolicy.reason,'reserve-endpoint-energy');assert.equal(paymentPolicy.retainedActionIds.length,1);
 const paid=payment.legalActions.find(a=>a.payload?.energyCost===0&&a.target?.cardIds?.length===1)||payment.legalActions.find(a=>a.target?.choiceId==='energy');assert(paid);
 const next=port.expand(payment,paid.actionId),bound=port.goalMovementSpec(next);assert.equal(next.status,'stable');assert.equal(bound.chosenGoal.id,spec.chosenGoal.id);assert.equal(bound.reason,'continue-bound-route');assert.equal(bound.intent.path.length,spec.intent.path.length-1);assert.deepEqual(comp.lifecycle.save().envelope,before);port.close();
}
// A current-turn endpoint is one plan: route, canonical payment and the exact landing target.
{
 const {port,root,before}=open(f.compositionEnvelope),spec=port.goalMovementSpec(root);assert.equal(spec.chosenGoal.timing,'current-turn');
 const macro=port.expandGoalMovementPlan(root);assert(macro.complete);assert.equal(macro.goalStatus,'goal-completed');assert(macro.prefixes.some(p=>p.action.family==='land'));
 const last=macro.prefixes.at(-1).action;assert.equal(last.target.landTarget?.satelliteId,spec.chosenGoal.endpointTarget.satelliteId);
 assert(macro.submissions<=spec.intent.path.length*2+3);assert.deepEqual(comp.lifecycle.save().envelope,before);port.close();
}
// A prepaid step keeps its funded purpose, but its fixed prefix executes only the prepaid point.
{
 const {port,root,before}=open(f.compositionEnvelope),prior=port.goalMovementSpec(root);const action=root.legalActions.find(a=>a.target?.tradeId==='energy-for-move');assert(action);const quick=port.expand(root,action.actionId),spec=port.goalMovementSpec(quick);assert(spec.chosenGoal);assert.equal(spec.chosenGoal.id,prior.chosenGoal.id);assert.equal(spec.chosenGoal.timing,prior.chosenGoal.timing);assert.equal(spec.retainedActionIds.length,1);assert.equal(spec.intent.prefixOnly,true);const macro=port.expandGoalMovementPlan(quick);assert(macro.complete);assert.equal(macro.goalStatus,'preparation-step-completed');assert.equal(macro.submissions,1);assert(movement.isDirection(macro.prefixes[0].action));assert.equal(macro.node.status,'stable');assert.deepEqual(comp.lifecycle.save().envelope,before);port.close();
}
// Rotation cost comparison distinguishes a necessary prefix from movement that should wait.
{
 const timingCases=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/goal-movement-timing-cases-20261023-v1.json'))).cases;
 const native=require('../production-kernel');
 for(const [name,fixture]of Object.entries(timingCases)){
  const state=JSON.parse(f.compositionEnvelope.committedState),owner=state.players.players.find(p=>p.id===seatId),ship=state.pieces.rockets.find(r=>r.playerId===seatId);
  owner.mainActionCompleted=true;owner.resources.energy=4;rockets.assignRocketToSlot(ship,fixture.coordinate.x,fixture.coordinate.y,fixture.coordinate.slot);
  const before=structuredClone(state),timing=native.comparePlannedMovementTiming(state,seatId,fixture.requirementId,fixture.path,0);
  assert.equal(timing.classification,fixture.timing.classification);assert.equal(timing.bestPrefixLength,fixture.timing.bestPrefixLength);assert.equal(timing.waitPaidPoints,fixture.timing.waitPaidPoints);assert.deepEqual(state,before);
  const opened=open({...f.compositionEnvelope,committedState:JSON.stringify(state)});
  let policy=opened.port.goalMovementSpec(opened.root);
  if(name==='wait-cheaper'){
   // Isolate this future target: another current reward must remain free to win in the full policy.
   const isolated=structuredClone(state),p=isolated.players.players.find(p=>p.id===seatId);p.reservedCards=[];p.resources.publicity=10;
   policy=movement.plan({state:isolated,seatId,actions:opened.root.legalActions,status:'stable',endpoints:()=>native.getProbeRouteRequirements(isolated,seatId).candidates.filter(c=>c.requirementId===fixture.requirementId),compareTiming:(id,path,free)=>native.comparePlannedMovementTiming(isolated,seatId,id,path,free)});
   assert.equal(policy.reason,'defer-movement');assert.equal(policy.selectedActionId,null);assert(policy.deferredGoal);
  }
  else{assert.equal(policy.chosenGoal.timing,'advance-before-rotation');assert.equal(policy.intent.path.length,timing.bestPrefixLength);const macro=opened.port.expandGoalMovementPlan(opened.root);assert(macro.complete);assert.equal(macro.goalStatus,'required-prefix-completed');assert(!macro.prefixes.some(p=>['land','orbit'].includes(p.action.family)));}
  opened.port.close();
 }
}
// A future goal need not fit the current allowance: advance only an affordable cost-saving prefix.
{
 const state=structuredClone(pending.session.session.workingState),owner=state.players.players.find(p=>p.id===seatId);assert(owner.mainActionCompleted);
 const head=structuredClone(pending.session.session.queue[0]);head.payload.remaining=1;
 const actions=ability.listPlayerMoveChoices({...state,state},owner,{maxPoints:1}).map((a,i)=>({actionId:`partial-${i}`,family:'choose_target',target:a,payload:{remaining:1,requiredMovePoints:a.requiredMovePoints}}));actions.push({actionId:'skip',family:'choose_target',target:{skip:true},payload:{remaining:1}});
 const native=require('../production-kernel'),before=structuredClone(state);
 const policy=movement.plan({state,seatId,actions,status:'decision',session:{queue:[head]},endpoints:()=>native.getProbeRouteRequirements(state,seatId,head).candidates,compareTiming:(id,path,free)=>native.comparePlannedMovementTiming(state,seatId,id,path,free)});
 assert.equal(policy.chosenGoal?.timing,'advance-before-rotation');assert.equal(policy.intent.path.length,1);assert(policy.chosenGoal.movementTiming.bestTotalPaidPoints<policy.chosenGoal.movementTiming.waitPaidPoints);assert.deepEqual(state,before);
}
// A watchdog inside a plan charges only submitted native inputs and publishes no action or continuation.
for(const limit of [1,5]){
 const opened=open(pending);let clock=0;
 const timed={...opened.port,expandGoalMovementPlan(node,canContinue){return opened.port.expandGoalMovementPlan(node,()=>{clock+=2;return canContinue();});}};
 const r=searchDecision({port:timed,root:opened.root,evaluate,modelKey:evaluate.modelKey,...agent.OPTIONS,now:()=>clock,budget:{transitions:256,nodes:257,frontier:256,milliseconds:limit}});
 assert(!r.complete);assert.equal(r.actionId,null);assert.equal(r.planContinuation,null);assert.equal(r.stopReason,'watchdog');assert.equal(r.diagnostics.transitions,limit===1?0:2);assert(r.unresolved.some(n=>n.goalAttempt));assert.deepEqual(comp.lifecycle.save().envelope,opened.before);opened.port.close();
}
// Hidden draw order does not determine the movement objective, including reconstructed Session history.
{
 const changed=structuredClone(pending);for(const state of [changed.session.session.baseState,changed.session.session.workingState,...changed.session.session.undoFrames.map(f=>f.stateBefore)])if(state?.cards)state.cards.drawPileCardIds.reverse();
 const {port,root}=open(changed);assert.equal(port.goalMovementSpec(root).chosenGoal.id,goal.id);port.close();
}
// Search evidence marks policy exclusions explicitly; retained movement has no direction branching.
const results=[];
for(const cache of [0,256]){const {port,root,before}=open(pending,cache);try{
 const r=searchDecision({port,root,evaluate,modelKey:evaluate.modelKey,...agent.OPTIONS,budget:{transitions:4096,nodes:4097,frontier:4096,milliseconds:15000}});assert(r.complete,r.stopReason);assert(r.scope.includes('goal-directed-movement-policy'));assert(r.diagnostics.movementDirectionsExcluded>0);assert.equal(r.diagnostics.resourceDominance,'disabled-for-movement-policy');
 assert(r.candidates.some(c=>c.kind==='goal-plan'));for(const c of r.candidates){const a=root.legalActions.find(a=>a.actionId===(c.firstActionId||c.actionId));if(movement.isDirection(a))assert.equal(c.kind,'goal-plan');}
 assert(r.lines.some(l=>l.movementPolicy));for(const line of r.lines.filter(l=>l.movementPolicy)){assert.equal(line.movementPolicy.isEquivalence,false);assert(line.movementPolicy.retainedActionIds.includes(line.movementPolicy.selectedActionId)||line.movementPolicy.selectedActionId===null);}
 assert(r.roots.some(row=>row.completion==='excluded-by-movement-policy'&&row.isEquivalence===false));assert.deepEqual(comp.lifecycle.save().envelope,before);results.push(r);
 }finally{port.close();}}
assert.equal(results[0].actionId,results[1].actionId);assert.equal(results[0].value,results[1].value);
// Recovered native Session history reconstructs the same objective; one real click adds one input.
{
 const {port,root}=open(pending);const first=searchDecision({port,root,evaluate,modelKey:evaluate.modelKey,...agent.OPTIONS,budget:{transitions:4096,nodes:4097,frontier:4096,milliseconds:15000}});assert(first.complete);const d=comp.inspect().session.decision,a=d.choices.find(a=>a.actionId===first.actionId);assert(a,JSON.stringify({first:first.actionId,root:root.legalActions.map(a=>a.actionId),actual:d.choices.map(a=>a.actionId),edges:first.lines[0].edges}));assert(comp.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}).ok);const after=comp.lifecycle.save().envelope;
 port.close();const nextRoot=port.openRoot(),warm=searchDecision({port,root:nextRoot,evaluate,modelKey:evaluate.modelKey,...agent.OPTIONS,planContinuation:first.planContinuation,budget:{transitions:4096,nodes:4097,frontier:4096,milliseconds:15000}});assert(warm.complete);assert.equal(warm.diagnostics.planContinuation,'hit');assert.equal(warm.diagnostics.transitions,0);const afterWarm=comp.lifecycle.save().envelope;assert.deepEqual(afterWarm,after);port.close();
 const restored=open(after);const cold=searchDecision({port:restored.port,root:restored.root,evaluate,modelKey:evaluate.modelKey,...agent.OPTIONS,budget:{transitions:4096,nodes:4097,frontier:4096,milliseconds:15000}});assert(cold.complete);assert.equal(warm.actionId,cold.actionId);assert.equal(warm.value,cold.value);assert.equal(warm.lines[0]?.distance??warm.reusedCoverage.distance,cold.lines[0].distance);restored.port.close();
}
comp.dispose();console.log(JSON.stringify({goalMovement:'passed',goal,routeSteps,searchInputs:results[0].diagnostics.transitions,policyExclusions:results[0].diagnostics.movementDirectionsExcluded,cacheAndRestore:true}));
