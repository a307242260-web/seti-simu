'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation'),{createAnalysisPort}=require('./analysis-port'),native=require('../production-kernel'),values=require('./state-value'),local=require('./local-decision-plans'),demand=require('./resource-demand'),data=require('../data');
const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-038-20261030-v1.json'))),seed=f.source.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
const evaluate=values.createStateValueEvaluator(f.seatId);
function port(){const p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});p.setResourcePlanning(true);p.setCardPickPlanning(true);return p;}
function plannedBlue(p,root){
 const saved=c.lifecycle.save().envelope,session=saved.session?.session,state=session?.workingState||JSON.parse(saved.committedState);
 const goal=demand.catalog({state,seatId:f.seatId,requirements:native.getResourceGoalRequirements(state,f.seatId)}).find(g=>g.kind==='blue-data');assert(goal);
 const operation={placing:root.status==='decision'},first=demand.step({state,seatId:f.seatId,goal,actions:root.legalActions,status:root.status,session,operation});assert(first.actionId);
 return{id:goal.id,goal,operation,firstActionId:first.actionId,mode:'greedy'};
}
function submit(a){const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):c.inputPort.submitQuickAction(a);assert(r.ok,JSON.stringify(r));}
try{
 assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,state=JSON.parse(before.committedState),query=native.getResourceGoalRequirements(state,f.seatId);
 assert(query.bluePlacements.some(p=>p.blueSlot===1&&p.requiredComputerSlot===1),'owned blue column must be a planned purpose before its computer prerequisite is filled');
 const p=port();let macro;
 try{const root=p.openRoot(),plan=plannedBlue(p,root);assert(plan);assert.equal(plan.goal.targetComputerSlot,1);
  macro=p.expandResourcePlan(root,plan,()=>null);assert(macro.complete);assert.equal(macro.goalStatus,'completed');assert.equal(macro.submissions,4);assert.equal(evaluate(macro.node.observation)-evaluate(root.observation),2);
  const preview=local.blueCompletion({state,seatId:f.seatId,goal:plan.goal});assert(preview.available&&preview.selected);assert.equal(preview.netGain,2);assert.equal(preview.computerPlacements,1);
  assert.deepEqual(macro.prefixes.map(x=>x.action.family),['place_data','choose_target','place_data','choose_target']);assert.equal(macro.prefixes[1].action.target.target,'computer');assert.equal(macro.prefixes[3].action.target.target,'blueBonus');
  assert.deepEqual(c.lifecycle.save().envelope,before);
  for(const reason of ['transition-budget','node-budget','frontier-budget','watchdog']){const stopped=p.expandResourcePlan(root,plan,n=>n>=1?reason:null);assert(!stopped.complete);assert.equal(stopped.submissions,1);assert.deepEqual(c.lifecycle.save().envelope,before);}
 }finally{p.close();}
 // Each pending native input can reconstruct its own fixed prerequisite/blue slot.
 for(let i=0;i<macro.prefixes.length;i++){
  const p=port();try{const root=p.openRoot(),plan=plannedBlue(p,root);assert(plan,`cold goal at ${i}`);const r=p.expandResourcePlan(root,plan,()=>null);assert(r.complete);assert.equal(r.prefixes[0].action.actionId,macro.prefixes[i].action.actionId);submit(r.prefixes[0].action);}finally{p.close();}
 }
 // The full six-data prerequisite bound includes the blue token too. A native
 // income choice at computer4 remains real execution, not a guessed reward.
 const bridge=structuredClone(f.compositionEnvelope),s=JSON.parse(bridge.committedState),owner=s.players.players.find(p=>p.id===f.seatId);owner.techState.blueBoardSlots.blue2=3;
 while(owner.resources.availableData<6)assert(data.gainData(owner,{root:s}).ok);
 bridge.committedState=JSON.stringify(s);assert(c.lifecycle.restore(bridge).ok);
 const b=port();try{const root=b.openRoot(),plan=plannedBlue(b,root);assert(plan);assert.equal(plan.goal.targetComputerSlot,5);
  const preview=local.blueCompletion({state:s,seatId:f.seatId,goal:plan.goal});assert(preview.available,'currency income uses the shared native choice builder');
  const r=b.expandResourcePlan(root,plan,()=>null);assert(r.complete);assert.equal(r.goalStatus,'completed');assert.equal(r.submissions,13);assert(r.prefixes.some(x=>x.action.target?.choiceId?.startsWith('income:')));assert.equal(r.prefixes.at(-1).action.target.blueSlot,3);assert.equal(preview.requiredNativeInputs,r.submissions);assert.equal(preview.incomeCardId,r.prefixes.find(x=>x.action.target?.choiceId?.startsWith('income:')).action.target.cardInstanceId);assert.equal(preview.netGain,evaluate(r.node.observation)-evaluate(root.observation));
  const empty=structuredClone(s),q=empty.players.players.find(p=>p.id===f.seatId);q.resources.availableData=0;q.dataState.poolTokens=[];assert(!demand.capacity(empty,f.seatId,plan.goal));
 }finally{b.close();}
 // Six computer prerequisites plus the blue token need seven data over the
 // plan, although the native pool can hold only six at once. Place first to
 // make room instead of declaring this physically reachable purpose infeasible.
 const seven=structuredClone(bridge),sevenState=JSON.parse(seven.committedState),sevenOwner=sevenState.players.players.find(p=>p.id===f.seatId);sevenOwner.techState.blueBoardSlots.blue2=4;seven.committedState=JSON.stringify(sevenState);assert(c.lifecycle.restore(seven).ok);
 const sevenBefore=c.lifecycle.save().envelope,h=port();try{
  const root=h.openRoot(),plan=plannedBlue(h,root);assert.equal(plan.goal.targetComputerSlot,6);
  assert.equal(demand.step({state:sevenState,seatId:f.seatId,goal:plan.goal,actions:root.legalActions,status:'stable'}).reason,'make-room-for-goal-data');
  assert(!demand.preparations({state:sevenState,seatId:f.seatId,goal:plan.goal,actions:root.legalActions}).some(x=>root.legalActions.find(a=>a.actionId===x.actionId).family==='card_corner'),'native full pool cannot be funded by discarding data cards');
  const r=h.expandResourcePlan(root,plan,()=>null);assert(r.complete);assert.equal(r.goalStatus,'completed');assert.equal(r.submissions,16);
  assert.equal(r.prefixes[0].action.family,'place_data');assert.equal(r.prefixes[1].action.target.target,'computer');assert.equal(r.prefixes[2].action.family,'card_corner');assert.equal(r.prefixes.at(-1).action.target.blueSlot,4);
  const preview=local.blueCompletion({state:sevenState,seatId:f.seatId,goal:plan.goal});assert(preview.available);assert.equal(preview.requiredNativeInputs,r.submissions);assert.equal(preview.netGain,evaluate(r.node.observation)-evaluate(root.observation));assert.deepEqual(c.lifecycle.save().envelope,sevenBefore);
 }finally{h.close();}
}finally{c.dispose();}
console.log('known blue prerequisites, native income, seven-data plan with six-slot pool, recovery and budgets passed');
