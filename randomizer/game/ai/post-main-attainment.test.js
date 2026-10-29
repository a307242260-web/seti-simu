"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {createSimulationRuleComposition}=require("../../training/simulation-rule-composition"),{createSeededRandom}=require("../random"),
 {buildRuleObservation}=require("../../app/rule-observation"),{createAnalysisPort}=require("./analysis-port"),
 {searchDecision}=require("./decision-search"),{createStateValueEvaluator}=require("./state-value"),agentFactory=require("./search-agent"),data=require("../data"),cards=require("../cards/deck");
const fixture=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../../../adhoc/ai-decision-corpus-20261023-v1/case-062-20261023-v1.json"))),
 initial=JSON.parse(fixture.compositionEnvelope.committedState),seatId=fixture.seatId,seed=fixture.source.seed,evaluate=createStateValueEvaluator(seatId);
function kernel(){const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});return k;}
const k=kernel(),comp=k.composition,own=s=>s.players.players.find(p=>p.id===seatId);
function controlled(energy=0,hand=0,pool=0,round=2){const s=structuredClone(initial),p=own(s);p.mainActionCompleted=true;
 s.cards.discardPile.push(...p.hand.slice(hand));p.hand=p.hand.slice(0,hand);s.turn.roundNumber=round;
 Object.assign(p.resources,{credits:0,energy,publicity:0,availableData:0,handSize:hand});p.dataState=data.createDefaultDataState();
 for(let i=0;i<pool;i+=1)assert(data.gainData(p,{root:s}).ok);return s;}
function addCard(s,corner,income){const entry=cards.CARD_CATALOG.find(c=>s.cards.drawPileCardIds.includes(c.card_id)
 && ({"0,2":["b_33.webp","b_56.webp"],"1,2":["b_70.webp","b_108.webp"],"1,0":["b_82.webp","b_97.webp","b_57.webp"],"0,0":["b_30.webp","b_12.webp","b_40.webp"]})[[corner,income].join(",")].includes(c.card_id));assert(entry);s.cards.drawPileCardIds.splice(s.cards.drawPileCardIds.indexOf(entry.card_id),1);
 const c=cards.createCommittedCardInstance(s,entry);own(s).hand.push(c);own(s).resources.handSize=own(s).hand.length;return c;}
function open(s,cache=0){assert(comp.lifecycle.restore({...fixture.compositionEnvelope,committedState:JSON.stringify(s)}).ok);
 const port=createAnalysisPort({composition:comp,seatId,maxCacheEntries:cache});return{port,root:port.openRoot(),before:comp.lifecycle.save().envelope};}
const large={transitions:4096,nodes:4097,frontier:4096,milliseconds:15000};
function solve(s,enabled,cache=0){const {port,root,before}=open(s,cache);try{
 const spec=port.postMainOptimalPlanSpec(root);assert(spec,JSON.stringify({bound:port.postMainValueBound(root),hand:own(s).hand.map(c=>[c.cardId,c.discardActionCode,c.incomeCode]),round:s.turn.roundNumber,legal:root.legalActions.map(a=>a.family)}));
 // Compare the new theorem alone with the full native graph, without older pruning theorems.
 const wrapped={...port,postMainPlanSpec:()=>null,postMainBorrowSpec:()=>null,postMainValueBound:()=>null,
  ...(!enabled?{postMainOptimalPlanSpec:()=>null}:{})};
 const result=searchDecision({port:wrapped,root,evaluate,modelKey:evaluate.modelKey,postMainPruning:true,planReuse:true,budget:large});
 assert(result.complete,result.stopReason);assert.deepEqual(comp.lifecycle.save().envelope,before);
 if(enabled){assert.equal(result.diagnostics.transitions,spec.submissions);assert.equal(result.diagnostics.nodes,spec.submissions+1);
  assert.equal(result.diagnostics.graphNodes,2);assert.equal(result.diagnostics.certificateNodes,spec.submissions-1);
  assert.equal(result.diagnostics.peakFrontier,spec.submissions);assert.equal(result.diagnostics.postMainOptimalPlans,1);
  assert.equal(result.value,evaluate(root.observation)+spec.bound.maximumValueIncrease);
  assert.equal(result.lines[0].attainedPlan.minimumInputs,spec.submissions);assert.equal(result.lines[0].edges[0].steps.length,spec.submissions);
  assert.equal(port.getDiagnostics().planPrefixEntries,spec.submissions);assert(result.planContinuation);
  for(const row of result.roots.filter(r=>r.prunedByPlan)){assert.equal(row.value,null);assert.equal(row.valueType,"not-executed");assert.equal(row.prunedByPlan.witness.value,result.value);}}
 return{result,spec};}finally{port.close();}}
const cash=controlled(0,1,4),blind=controlled(0,0,4);addCard(blind,0,2);
const cornerCash=controlled(0,0,3,1);addCard(cornerCash,1,0);addCard(cornerCash,0,0);
const cornerBlind=controlled(0,0,3,1);const keptBlind=addCard(cornerBlind,1,2);addCard(cornerBlind,1,0);
const starving=controlled(0,0,3,1);addCard(starving,1,0);
const rows=[];
for(const [name,s] of [["end-now",controlled()],["unprofitable-move",controlled(1)],["cash-income",cash],["blind-income",blind],
 ["data-corner-cash",cornerCash],["preserve-blind-data-card",cornerBlind],["must-retain-income-card",starving],["late-income-tie",controlled(0,1,4,3)]]){
 const raw=solve(s,false),fast=solve(s,true),cached=solve(s,true,256);
 for(const actual of [fast,cached]){assert.equal(actual.result.actionId,raw.result.actionId,name);assert.equal(actual.result.value,raw.result.value,name);
  assert.equal(actual.result.lines[0].distance,raw.result.lines[0].distance,name);}
 if(name==="preserve-blind-data-card"){assert(fast.spec.blind);const opened=open(s);const action=opened.root.legalActions.find(a=>a.actionId===fast.result.actionId);assert.notEqual(action.target.cardInstanceId,keptBlind.id);opened.port.close();}
 rows.push({name,raw:raw.result.diagnostics.transitions,attained:fast.result.diagnostics.transitions,value:fast.result.value,distance:fast.result.lines[0].distance});
}
// The optimistic publicity reward is not attained when slot 2 is capped: reject the shortcut.
{
 const capped=structuredClone(cash);own(capped).resources.publicity=require("../players").RESOURCE_LIMITS.publicity;
 const opened=open(capped);let node=opened.root;
 const bound=opened.port.postMainValueBound(node);assert(bound);assert.equal(opened.port.postMainOptimalPlanSpec(node),null);
 assert.throws(()=>opened.port.expandPostMainOptimalPlan(node),/OPTIMAL_PLAN_INVALID/);
 for(let i=0;i<2;i+=1){node=opened.port.expand(node,node.legalActions.find(a=>a.family==="place_data").actionId);
  node=opened.port.expand(node,node.legalActions.find(a=>a.target?.target==="computer").actionId);}
 const suffix=opened.port.postMainOptimalPlanSpec(node);assert(suffix,"宣传格已经过后不能过度拒绝");
 const completed=opened.port.expandPostMainOptimalPlan(node);assert(completed.complete);
 assert.equal(evaluate(completed.node.observation),evaluate(opened.root.observation)+bound.maximumValueIncrease-0.5);
 assert.equal(evaluate(completed.node.observation),evaluate(node.observation)+suffix.bound.maximumValueIncrease);
 const result=searchDecision({port:opened.port,root:opened.root,evaluate,postMainPruning:true,budget:{...large,transitions:128,nodes:129,frontier:128}});
 assert.equal(result.lines[0].attainedPlan,undefined);if(!result.complete)assert.equal(result.actionId,null);
 assert.deepEqual(comp.lifecycle.save().envelope,opened.before);opened.port.close();
}
// Every private prefix consumes global node/frontier/transition budgets, even without plan reuse.
for(const limits of [{transitions:9},{nodes:10},{frontier:9}]){const opened=open(cash);try{
 const result=searchDecision({port:opened.port,root:opened.root,evaluate,postMainPruning:true,planReuse:true,budget:{...large,...limits}});
 assert(!result.complete);assert.equal(result.actionId,null);assert.equal(result.planContinuation,null);
 assert.equal(result.diagnostics.postMainOptimalPlans,0);assert.equal(result.diagnostics.certificateNodes,0);
 assert.deepEqual(comp.lifecycle.save().envelope,opened.before);
 }finally{opened.port.close();}}
// A watchdog interruption inside the constructive witness remains explicitly unresolved.
{
 const opened=open(cash);let time=0;
 const timed={...opened.port,expandPostMainOptimalPlan(node,hasTime){return opened.port.expandPostMainOptimalPlan(node,()=>{time+=2;return hasTime();});}};
 const result=searchDecision({port:timed,root:opened.root,evaluate,postMainPruning:true,planReuse:true,now:()=>time,budget:{...large,milliseconds:7}});
 assert(!result.complete);assert.equal(result.stopReason,"watchdog");assert.equal(result.actionId,null);assert.equal(result.planContinuation,null);
 assert.equal(result.diagnostics.transitions,3);assert.equal(result.diagnostics.certificateNodes,3);assert.equal(result.diagnostics.nodes,4);
 assert.equal(result.unresolved.length,1);assert.equal(result.unresolved[0].attainmentAttempt.submissions,3);
 assert.equal(result.unresolved[0].attainmentAttempt.steps.length,3);assert.equal(result.unresolved[0].attainmentAttempt.pendingCertificateStates,3);
 assert(result.unresolved[0].actionIds.length>1);assert.deepEqual(comp.lifecycle.save().envelope,opened.before);opened.port.close();
}
function actions(c){const current=c.inspect();return current.phase==="awaiting_input"?current.session.decision.choices:c.inputPort.enumerateActions({});}
function submit(c,id){const current=c.inspect(),action=actions(c).find(a=>a.actionId===id);assert(action);
 const result=current.phase==="awaiting_input"?c.inputPort.submitDecision({decisionId:current.session.decision.decisionId,decisionVersion:current.session.decision.decisionVersion,
 ownerId:current.session.decision.ownerId,choice:action}):action.phase==="quick"?c.inputPort.submitQuickAction(action):c.inputPort.submitAction(action);assert(result.ok,JSON.stringify(result));}
// Session runtime handles are regenerated on restore; all references must remain bijective.
function normalize(envelope){const names=new Map(),value={...envelope,committedState:JSON.parse(envelope.committedState)};return JSON.parse(JSON.stringify(value).replace(/effect-session-[0-9]+(?=[:"\\])/g,name=>{
 if(!names.has(name))names.set(name,`session-ref-${names.size}`);return names.get(name);}));}
// The real shared factory submits exactly one input per call; all macro interiors survive cold restore.
assert(comp.lifecycle.restore(fixture.compositionEnvelope).ok);
const play=actions(comp).find(a=>a.family==="play_card"&&a.target?.cardInstanceId==="card-3-0");assert(play);submit(comp,play.actionId);
const actualStart=comp.lifecycle.save().envelope,port=createAnalysisPort({composition:comp,seatId,maxCacheEntries:0}),agent=agentFactory.createSearchAgent({seatId,analysisPort:port});
let hits=0,inputs=0,firstAction;
for(let step=0;step<10;step+=1){const before=comp.lifecycle.save().envelope,choice=agent.decide({seatId,legalActions:actions(comp)}),r=choice.search;
 assert(r.complete);assert.equal(r.value,43.5);assert.deepEqual(comp.lifecycle.save().envelope,before);
 if(!step){assert.equal(r.diagnostics.transitions,10);assert.equal(r.lines[0].distance,10);firstAction=choice.actionId;}
 else{if(r.diagnostics.planContinuation==="hit"){assert.equal(r.diagnostics.transitions,0);hits+=1;}else assert(r.diagnostics.transitions>0);console.log(JSON.stringify({prefixStep:step,continuation:r.diagnostics.planContinuation,inputs:r.diagnostics.transitions}));}
 const recovered=kernel();assert(recovered.composition.lifecycle.restore(before).ok);
 const coldPort=createAnalysisPort({composition:recovered.composition,seatId,maxCacheEntries:0});
 const cold=searchDecision({port:coldPort,root:coldPort.openRoot(),evaluate,modelKey:evaluate.modelKey,...agentFactory.OPTIONS,budget:agentFactory.BUDGET});
 assert(cold.complete,cold.stopReason);assert.equal(cold.actionId,choice.actionId);assert.equal(cold.value,r.value);assert.equal(cold.lines[0].distance,10-step);
 coldPort.close();submit(comp,choice.actionId);submit(recovered.composition,cold.actionId);
 assert.deepEqual(normalize(comp.lifecycle.save().envelope),normalize(recovered.composition.lifecycle.save().envelope));recovered.composition.dispose();inputs+=1;
}
assert.equal(hits,8);assert.equal(inputs,10);port.close();
// New runtimes discard tokens; a restored first prefix still computes the same forced input.
assert(comp.lifecycle.restore(actualStart).ok);submit(comp,firstAction);
const resetPort=createAnalysisPort({composition:comp,seatId,maxCacheEntries:0}),resetAgent=agentFactory.createSearchAgent({seatId,analysisPort:resetPort});
const reset=resetAgent.decide({seatId,legalActions:actions(comp)});assert.equal(reset.search.diagnostics.planContinuation,"not-requested");assert(reset.search.diagnostics.transitions>0);assert.equal(reset.search.value,43.5);resetPort.close();
// A still-legal forced interior input is insufficient when another state dependency changes.
{
 const opened=open(cash),r=searchDecision({port:opened.port,root:opened.root,evaluate,modelKey:evaluate.modelKey,...agentFactory.OPTIONS,budget:agentFactory.BUDGET});
 assert(r.complete);const token=r.planContinuation;opened.port.close();submit(comp,r.actionId);
 const changed=structuredClone(comp.lifecycle.save().envelope),state=changed.session?.session?.workingState||JSON.parse(changed.committedState);
 own(state).resources.energy+=1;if(!changed.session)changed.committedState=JSON.stringify(state);
 assert(comp.lifecycle.restore(changed).ok);const root=opened.port.openRoot();assert.equal(root.legalActions.length,1);
 const stale=searchDecision({port:opened.port,root,evaluate,modelKey:evaluate.modelKey,...agentFactory.OPTIONS,planContinuation:token,
  budget:{...agentFactory.BUDGET,transitions:1}});
 assert.equal(stale.diagnostics.planContinuation,"dependencies-changed");assert(!stale.complete);assert.equal(stale.actionId,null);assert.equal(stale.planContinuation,null);opened.port.close();
}
comp.dispose();console.log(JSON.stringify({postMainAttainment:"passed",rows,realFactoryInputs:inputs,reusedInteriorPrefixes:hits}));
