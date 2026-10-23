"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation'),{createAnalysisPort}=require('./analysis-port'),{searchDecision}=require('./decision-search'),{createStateValueEvaluator}=require('./state-value'),agent=require('./search-agent'),movement=require('./goal-movement'),ability=require('../abilities/rocket'),rockets=require('../rockets'),solar=require('../../solar-system/core');
const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/ai-decision-corpus-20261023-v1/case-062-20261023-v1.json'))),seatId=f.seatId,seed=f.source.seed;
function kernel(){const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});return k;}
const k=kernel(),comp=k.composition;assert(comp.lifecycle.restore(f.compositionEnvelope).ok);
const play=comp.inputPort.enumerateActions({}).find(a=>a.family==='play_card'&&a.target.cardInstanceId==='card-40-0');assert(comp.inputPort.submitAction(play).ok);const pending=comp.lifecycle.save().envelope,evaluate=createStateValueEvaluator(seatId);
function open(envelope,cache=0){assert(comp.lifecycle.restore(envelope).ok);const port=createAnalysisPort({composition:comp,seatId,maxCacheEntries:cache});port.setMovementPlanning(true);return{port,root:port.openRoot(),before:comp.lifecycle.save().envelope};}
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
// A prepaid one-step quick movement has no skip: it makes one directed preparation step, not an impossible optional stop.
{
 const {port,root,before}=open(f.compositionEnvelope);const action=root.legalActions.find(a=>a.target?.tradeId==='energy-for-move');assert(action);const quick=port.expand(root,action.actionId),spec=port.goalMovementSpec(quick);assert(spec.chosenGoal);assert.equal(spec.chosenGoal.timing,'preparation');assert.equal(spec.retainedActionIds.length,1);assert.equal(spec.intent.prefixOnly,true);const next=port.expand(quick,spec.selectedActionId);assert.equal(next.status,'stable');assert.deepEqual(comp.lifecycle.save().envelope,before);port.close();
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
