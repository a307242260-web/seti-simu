'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const demand=require('./resource-demand'),{createAnalysisPort}=require('./analysis-port'),{createSimulationRuleComposition}=require('../../training/simulation-rule-composition');
const {createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation'),agent=require('./search-agent'),{searchDecision}=require('./decision-search'),{createStateValueEvaluator}=require('./state-value');
const fixture=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/ai-decision-corpus-20261023-v1/case-105-20261023-v1.json'))),seatId=fixture.seatId;
function open(envelope=fixture.compositionEnvelope){const seed=fixture.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(envelope).ok);return c;}
function submit(c,id){const v=c.inspect(),list=v.phase==='awaiting_input'?v.session.decision.choices:c.inputPort.enumerateActions({}),a=list.find(a=>a.actionId===id);assert(a);const r=v.phase==='awaiting_input'?c.inputPort.submitDecision({decisionId:v.session.decision.decisionId,decisionVersion:v.session.decision.decisionVersion,ownerId:seatId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));}
const c=open(),before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});p.setResourcePlanning(true);p.setDecisionPlanning({finalMarkPlanning:true});
const root=p.openRoot(),plan=p.resourceSpec(root).plans.find(g=>g.goal.kind==='income');assert(plan);
const executed=p.expandResourcePlan(root,plan,()=>null);assert(executed.complete);assert(!executed.fallbackReason);assert(executed.preparations.every(s=>!s.reason?.includes('non-equivalent')));
const incomeAt=executed.prefixes.findIndex(s=>s.action.target?.choiceId?.startsWith('income:'));assert(incomeAt>0);
assert.equal(executed.prefixes[incomeAt].node.legalActions.filter(a=>a.target?.choiceId?.startsWith('income:')).length,6,'fixture must contain a real income comparison');
for(let i=0;i<incomeAt;i++)submit(c,executed.prefixes[i].action.actionId);
const pending=c.lifecycle.save().envelope,choices=[];
for(const comp of [c,open(pending)]){
 const q=createAnalysisPort({composition:comp,seatId,maxCacheEntries:0});q.setResourcePlanning(true);q.setCardPickPlanning(true);q.setDecisionPlanning({finalMarkPlanning:true});
 const n=q.openRoot(),spec=q.localDecisionSpec(n);assert.equal(spec.kind,'fixed-data-choice');assert.equal(spec.retainedActionIds.length,1);assert.equal(spec.excludedActionIds.length,5);assert.equal(spec.isEquivalence,false);
 const fixed=q.expandWithCardPick(n,spec.selectedActionId,()=>null);assert(fixed.complete);assert(fixed.fixedChoices.some(s=>s.kind==='fixed-data-choice'));assert.equal(fixed.prefixes.filter(s=>s.action.target?.choiceId?.startsWith('income:')).length,1);assert.equal(fixed.node.status,'stable');
 const stopped=q.expandWithCardPick(n,spec.selectedActionId,()=> 'watchdog');assert(!stopped.complete);assert.equal(stopped.submissions,0);choices.push(spec.selectedActionId);assert.deepEqual(comp.lifecycle.save().envelope,pending);q.close();if(comp!==c)comp.dispose();
}
assert.equal(choices[0],choices[1]);
// Known computer/blue choices are fixed, and a beneficiary-specific blue destination is preserved.
const state=JSON.parse(fixture.compositionEnvelope.committedState),actions=[{actionId:'computer',family:'choose_target',target:{target:'computer'}},{actionId:'blue2',family:'choose_target',target:{target:'blueBonus',blueSlot:2}}];
assert.equal(demand.fixedDataChoice({state,seatId,actions}).actionId,'computer');assert.equal(demand.fixedDataChoice({state,seatId,actions,goal:{kind:'blue-data',blueSlot:2}}).actionId,'blue2');
// Disable initiating borrowing at every visited production node, while keeping native legal facts intact.
const borrow=open(),borrowBefore=borrow.lifecycle.save().envelope,port=createAnalysisPort({composition:borrow,seatId,maxCacheEntries:0}),r=searchDecision({port,root:port.openRoot(),evaluate:createStateValueEvaluator(seatId),...agent.OPTIONS,budget:{transitions:256,nodes:257,frontier:256,milliseconds:600}});
assert.equal(r.diagnostics.postMainBorrowMacros,0);assert(r.diagnostics.disabledBorrowStarts>0);
for(const line of r.lines){assert(!line.borrowPlan);assert(line.edges.every(e=>!e.borrowTileId));}
const graph=port.getResourcePrefixGraph(),forbidden=new Set(r.roots.filter(x=>x.completion==='excluded-by-resource-policy').map(x=>x.actionId));
const nativeBorrow=borrow.inputPort.enumerateActions({}).find(a=>a.target?.abilityId==='turing_borrow_tech');assert(nativeBorrow);assert(forbidden.has(nativeBorrow.actionId));assert(graph.edges.every(e=>e.actionId!==nativeBorrow.actionId));
assert.deepEqual(borrow.lifecycle.save().envelope,borrowBefore);port.close();borrow.dispose();p.close();c.dispose();
// The production policy disables Helios at the root and every successor,
// while a save already inside its native choice still has a legal continuation.
{
 const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/ai-decision-corpus-20261029-reorg-v1/step317-20261029-v1.json'))),seed=f.source.seed;
 const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const comp=k.composition;assert(comp.lifecycle.restore(f.compositionEnvelope).ok);
 const saved=comp.lifecycle.save().envelope,q=createAnalysisPort({composition:comp,seatId:f.seatId,maxCacheEntries:0});q.setResourcePlanning(true);q.setCardPickPlanning(true);const n=q.openRoot(),native=n.legalActions.find(a=>a.family==='industry'&&a.target?.abilityId==='helios_remove_tech_income');assert(native);
 const spec=q.resourceSpec(n);assert(spec.excludedActionIds.includes(native.actionId));assert(!spec.plans.some(p=>p.goal.abilityId==='helios_remove_tech_income'));
 const seen=new Set(),wrapped={...q,identity(node){for(const a of node.legalActions)if(node.status==='stable'&&a.family==='industry'&&a.target?.abilityId==='helios_remove_tech_income'){seen.add(a.actionId);assert(q.resourceSpec(node).excludedActionIds.includes(a.actionId));}return q.identity(node);}};
 const r=searchDecision({port:wrapped,root:n,evaluate:createStateValueEvaluator(f.seatId),...agent.OPTIONS,budget:agent.BUDGET});assert(r.complete);assert(r.diagnostics.disabledRemoveTechIncomeStarts>0);assert(seen.size>0);assert(q.getResourcePrefixGraph().edges.every(e=>!seen.has(e.actionId)));assert(r.lines.every(n=>n.edges.every(e=>e.resourcePlan?.goal.abilityId!=='helios_remove_tech_income')));assert.deepEqual(comp.lifecycle.save().envelope,saved);q.close();
 const submitted=native.phase==='quick'?comp.inputPort.submitQuickAction(native):comp.inputPort.submitAction(native);assert(submitted.ok);const pending=comp.lifecycle.save().envelope,decision=comp.inspect().session.decision;assert(decision.choices.length>0);
 const cold=createAnalysisPort({composition:comp,seatId:f.seatId,maxCacheEntries:0}),root=cold.openRoot(),continued=searchDecision({port:cold,root,evaluate:createStateValueEvaluator(f.seatId),...agent.OPTIONS,budget:agent.BUDGET});assert(continued.complete);assert(root.legalActions.some(a=>a.actionId===continued.actionId),'an already committed native choice remains completable');assert.deepEqual(comp.lifecycle.save().envelope,pending);cold.close();comp.dispose();
}
console.log(JSON.stringify({fixedDataPlan:'passed',incomeOptions:6,selected:1,greedyPlacement:true,coldRecovery:true,productionBorrowMacros:0}));
