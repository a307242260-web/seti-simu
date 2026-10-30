'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createAnalysisPort}=require('./analysis-port'),{createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation');
const demand=require('./resource-demand'),zlib=require('node:zlib'),{searchDecision}=require('./decision-search'),{createStateValueEvaluator}=require('./state-value'),agent=require('./search-agent');
const fixture=id=>JSON.parse(fs.readFileSync(path.resolve(__dirname,`../../../adhoc/ai-decision-corpus-20261023-v1/case-${id}-20261023-v1.json`)));
function open(id='105',envelope=null){const f=fixture(id),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(envelope||f.compositionEnvelope).ok);const p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});p.setResourcePlanning(true);p.setCardPickPlanning(true);p.setMovementPlanning(true);p.setDecisionPlanning({scanPlanning:true,finalMarkPlanning:true});return{f,c,p,root:p.openRoot()};}
function submit(c,id){const v=c.inspect(),actions=v.phase==='awaiting_input'?v.session.decision.choices:c.inputPort.enumerateActions({}),a=actions.find(a=>a.actionId===id);assert(a,id);const r=v.phase==='awaiting_input'?c.inputPort.submitDecision({decisionId:v.session.decision.decisionId,decisionVersion:v.session.decision.decisionVersion,ownerId:v.session.decision.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));}
function close(x){x.p.close();x.c.dispose();}
function recordedNode(id,target){
 const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.resolve(__dirname,`../../../adhoc/ai-decision-corpus-20261023-v1/audit-case-${id}-data-plan-no-borrow-corpus-20261028-v2.raw.json.gz`)))),paths=new Map([[0,[]]]);
 for(const line of raw.lines)for(const e of line.edges)if(paths.has(line.node)&&!paths.has(e.target))paths.set(e.target,[...paths.get(line.node),...(e.steps||[e.actionId])]);
 const x=open(id);assert(paths.has(target));for(const action of paths.get(target))submit(x.c,action);const saved=x.c.lifecycle.save().envelope;close(x);return open(id,saved);
}
// An urgent movement prefix survives while the income plan preserves a valuable known technology card.
// Reproduce the first human405 card through native execution, without editing rule state.
{
 const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/ai-decision-corpus-20261029-teacher-v1/teacher-step-024-20261029-v1.json'))),seed=f.source.seed;
 const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);submit(c,f.source.teacherActionId);
 const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
 try{
  const root=p.openRoot(),r=searchDecision({port:p,root,evaluate:createStateValueEvaluator(f.seatId),...agent.OPTIONS,budget:{transitions:256,nodes:512,frontier:256,milliseconds:15000}}),line=r.lines[0],move=line.movementPolicy;
  assert(move.forceExecution);assert.equal(line.resourcePolicy.incomeTail.selected,false);assert(line.resourcePolicy.incomeTail.netGain<0);
  const state=JSON.parse(before.committedState),requirements=require('../production-kernel').getResourceGoalRequirements(state,f.seatId),income=demand.catalog({state,seatId:f.seatId,requirements,actions:root.legalActions}).find(g=>g.kind==='income'),first=root.legalActions.find(a=>a.family==='place_data');assert(income&&first);
  const native=p.expandResourcePlan(root,{id:income.id,goal:income,operation:{},firstActionId:first.actionId},()=>null),evaluate=createStateValueEvaluator(f.seatId);assert(native.complete);assert.equal(evaluate(native.node.observation)-evaluate(root.observation),line.resourcePolicy.incomeTail.netGain);assert(line.resourcePolicy.retainedActionIds.includes(move.selectedActionId),'preserving the known technology card must retain urgent movement');
  assert(r.complete,r.stopReason);assert(r.actionId,'the selected urgent native move must survive the combined candidate filters');assert.equal(r.actionId,move.selectedActionId);assert.equal(line.alternatives,1);assert.equal(line.edges.length,1);assert(Number.isFinite(r.value));assert.deepEqual(c.lifecycle.save().envelope,before);
 }finally{p.close();c.dispose();}
}
// 1. One funded paid budget, followed by one native payment path and deterministic cold recovery.
{
 const x=open(),before=x.c.lifecycle.save().envelope,spec=x.p.resourceSpec(x.root),paid=spec.plans.filter(p=>p.goal.paidRewardPolicy);assert.equal(paid.length,1);assert.equal(paid[0].goal.paidRewardBudget,4);
 assert(!spec.retainedActionIds.includes(x.root.legalActions.find(a=>a.family==='play_card'&&a.target.cardInstanceId===paid[0].goal.cardId).actionId));
 const r=x.p.expandResourcePlan(x.root,paid[0],()=>null);assert(r.complete);assert(!r.fallbackReason);assert.equal(r.prefixes.filter(p=>p.action.target?.pay).length,4);assert.equal(r.node.status,'stable');
 const incomeBefore=x.c.lifecycle.save().envelope;assert.deepEqual(before,incomeBefore);
 const paidAt=r.prefixes.findIndex(p=>p.action.target?.pay);assert(paidAt>0);for(let i=0;i<paidAt;i++)submit(x.c,r.prefixes[i].action.actionId);
 const pending=x.c.lifecycle.save().envelope,choices=[];for(const cur of [x,open('105',pending)]){const port=cur===x?createAnalysisPort({composition:x.c,seatId:x.f.seatId}):cur.p;port.setResourcePlanning(true);const n=cur===x?port.openRoot():cur.root,fixed=port.localDecisionSpec(n);assert.equal(fixed.kind,'fixed-paid-repeat');assert.equal(fixed.retainedActionIds.length,1);choices.push(fixed.selectedActionId);assert.deepEqual(cur.c.lifecycle.save().envelope,pending);if(cur===x)port.close();else close(cur);}assert.equal(choices[0],choices[1]);
 const stopped=x.p.expandResourcePlan(x.root,paid[0],n=>n>=1?'watchdog':null);assert(!stopped.complete);assert.equal(stopped.stopReason,'watchdog');close(x);
}
// 2. The chosen two-step advance is execution, without reopening end-turn or unrelated preparations.
{
 const x=recordedNode('152',67),before=x.c.lifecycle.save().envelope;
 const r=searchDecision({port:x.p,root:x.root,evaluate:createStateValueEvaluator(x.f.seatId),...agent.OPTIONS,budget:{transitions:256,nodes:257,frontier:256,milliseconds:15000}});
 assert(r.complete,r.stopReason);const policy=r.lines[0].movementPolicy;assert(policy.forceExecution);assert.equal(policy.chosenGoal.movementTiming.waitPaidPoints,7);assert.equal(policy.chosenGoal.movementTiming.bestTotalPaidPoints,6);assert.equal(r.lines[0].alternatives,1);assert.equal(r.lines[0].edges.length,1);assert.equal(r.lines[0].edges[0].goalPlan.objective.movementTiming.bestPrefixLength,2);assert.deepEqual(x.c.lifecycle.save().envelope,before);close(x);
}
// 3. The post-main income tail is selected once by known net value, not compared with end-turn.
{
 const x=recordedNode('105',41),before=x.c.lifecycle.save().envelope,s=x.p.resourceSpec(x.root);assert(s.incomeTail);assert.equal(s.incomeTail.selected,false);assert(s.incomeTail.netGain<=0);assert(!s.plans.some(p=>p.goal.kind==='income'));
 const nativeState=JSON.parse(before.committedState),requirements=require('../production-kernel').getResourceGoalRequirements(nativeState,x.f.seatId),income=demand.catalog({state:nativeState,seatId:x.f.seatId,requirements,actions:x.root.legalActions}).find(g=>g.kind==='income');
 const action=x.root.legalActions.find(a=>a.family==='place_data'),actual=x.p.expandResourcePlan(x.root,{id:income.id,goal:income,operation:{},firstActionId:action.actionId},()=>null),evaluate=createStateValueEvaluator(x.f.seatId);assert(actual.complete);assert.equal(evaluate(actual.node.observation)-evaluate(x.root.observation),s.incomeTail.netGain);
 assert(s.retainedActionIds.some(id=>x.root.legalActions.find(a=>a.actionId===id).family==='end_turn'));assert.deepEqual(x.c.lifecycle.save().envelope,before);close(x);
 const y=recordedNode('105',41),envelope=y.c.lifecycle.save().envelope,state=JSON.parse(envelope.committedState),own=state.players.players.find(p=>p.id===y.f.seatId);state.turn.roundNumber=1;close(y);
 const good=open('105',{...envelope,committedState:JSON.stringify(state)}),spec=good.p.resourceSpec(good.root);assert(spec.incomeTail.selected);assert.equal(spec.plans.length,1);assert.equal(spec.plans[0].goal.kind,'income');assert.equal(spec.retainedActionIds.length,0);const completed=good.p.expandResourcePlan(good.root,spec.plans[0],()=>null);assert(completed.complete);assert(!completed.fallbackReason);close(good);
}
// 4. Both one-card and two-card native PASS discard combinations become one fixed selection.
for(const [node,options,count] of [[42,5,1],[7,15,2]]){
 const x=recordedNode('152',node),before=x.c.lifecycle.save().envelope,fixed=x.p.localDecisionSpec(x.root);assert.equal(x.root.legalActions.length,options);assert.equal(fixed.kind,'fixed-pass-discard');assert.equal(fixed.discardIds.length,count);assert.equal(fixed.retainedActionIds.length,1);
 const cold=open('152',before);assert.equal(cold.p.localDecisionSpec(cold.root).selectedActionId,fixed.selectedActionId);close(cold);
 const r=x.p.expandWithCardPick(x.root,fixed.selectedActionId,()=>null);assert(r.complete);assert.equal(r.prefixes.filter(p=>p.action.target?.kind==='pass-hand-limit').length,1);assert.deepEqual(x.c.lifecycle.save().envelope,before);close(x);
}
// 5. All tech kinds remain comparable, with one native blue board destination for each kind.
{
 const x=open(),plans=x.p.resourceSpec(x.root).plans.filter(p=>p.goal.kind==='research_tech');assert.equal(plans.length,11);assert.equal(new Set(plans.map(p=>p.goal.tileId)).size,11);close(x);
 const y=recordedNode('152',37),before=y.c.lifecycle.save().envelope,policy=y.p.localDecisionSpec(y.root);assert.equal(y.root.legalActions.length,12);assert.equal(policy.kind,'greedy-blue-slots');assert.equal(policy.retainedActionIds.length,10);assert.equal(policy.excludedActionIds.length,2);assert(!policy.fixed);assert.equal(new Set(policy.retainedActionIds.map(id=>y.root.legalActions.find(a=>a.actionId===id).target.tileId)).size,10);assert.deepEqual(y.c.lifecycle.save().envelope,before);close(y);
}
// 6. A native free +3 score trigger has one accepting plan, without a skip branch or root mutation.
{
 const x=recordedNode('105',13),before=x.c.lifecycle.save().envelope,policy=x.p.localDecisionSpec(x.root);assert.equal(policy.kind,'fixed-positive-optional');assert.equal(policy.retainedActionIds.length,1);assert.equal(policy.gains[0].value,3);
 const r=x.p.expandWithCardPick(x.root,policy.selectedActionId,()=>null);assert(r.complete);const own=n=>n.observation.publicState.players.find(p=>p.playerId===x.f.seatId);assert.equal(own(r.node).score-own(x.root).score,3);assert.deepEqual(x.c.lifecycle.save().envelope,before);
 const cold=open('105',before);assert.equal(cold.p.localDecisionSpec(cold.root).selectedActionId,policy.selectedActionId);close(cold);close(x);
 assert.equal(demand.positiveResourceGain({type:'draw_cards',options:{count:1}}),null);assert.equal(demand.positiveResourceGain({type:'gain_resources',options:{gain:{credits:-1,score:3}}}),null);
}
// Fixed plans remain subject to the global state budget, with no action or reusable certificate on interruption.
for(const [id,node] of [['105',13],['152',67],['152',42],['152',37]]){
 const x=recordedNode(id,node),before=x.c.lifecycle.save().envelope,r=searchDecision({port:x.p,root:x.root,evaluate:createStateValueEvaluator(x.f.seatId),...agent.OPTIONS,budget:{transitions:256,nodes:1,frontier:256,milliseconds:15000}});assert(!r.complete);assert.equal(r.actionId,null);assert.equal(r.planContinuation,null);assert.equal(r.stopReason,'node-budget');assert.deepEqual(x.c.lifecycle.save().envelope,before);close(x);
}
console.log(JSON.stringify({sixGreedyPlans:'passed',stages:6,globalBudgetPreserved:true}));
