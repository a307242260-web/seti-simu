'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation'),{createAnalysisPort}=require('./analysis-port'),{searchDecision}=require('./decision-search'),values=require('./state-value'),agent=require('./search-agent'),local=require('./local-decision-plans');
const read=p=>JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../..',p)));
const f=read('adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-037-20261030-v1.json'),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition,evaluate=values.createStateValueEvaluator(f.seatId),budget={transitions:256,nodes:1024,frontier:256,milliseconds:5000};
// Keep the valuable research card and fund income with the actual newly picked
// low-opportunity card. The first choice is submitted through the real kernel.
assert(c.lifecycle.restore(f.compositionEnvelope).ok);
const pickDecision=c.inspect().session.decision,pick=pickDecision.choices.find(a=>a.summary==='b_2.webp');assert(pick);
assert(c.inputPort.submitDecision({decisionId:pickDecision.decisionId,decisionVersion:pickDecision.decisionVersion,ownerId:pickDecision.ownerId,choice:pick}).ok);
f.compositionEnvelope=c.lifecycle.save().envelope;
function open(envelope=f.compositionEnvelope){assert(c.lifecycle.restore(envelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0}),root=p.openRoot();return{before,p,root};}
try{
 const {before,p,root}=open();try{
  const r=searchDecision({port:p,root,evaluate,...agent.OPTIONS,modelKey:evaluate.modelKey,budget});assert(r.complete,r.stopReason);assert.equal(r.diagnostics.nativeExecutions,0);assert.equal(r.diagnostics.transitions,0);assert.equal(r.diagnostics.incomePlanProofs,1);assert.equal(r.diagnostics.provedIncomeInputs,9);
  const spec=p.incomePlanSummary(root),leaf=p.incomePlanBoundary(root,spec);assert.equal(leaf.status,'income-plan-value');assert.equal(spec.requiredNativeInputs,9);assert.throws(()=>leaf.observation,/NO_SUCCESSOR_OBSERVATION/);assert.throws(()=>p.valueObservation(leaf),/NO_SUCCESSOR_OBSERVATION/);assert.throws(()=>p.expand(leaf,spec.firstActionId),/BOUNDARY_CLOSED/);assert.notEqual(p.identity(root),p.identity(leaf));
  const plan=p.resourceSpec(root).plans[0],actual=p.expandResourcePlan(root,plan,()=>null);assert(actual.complete);assert.equal(actual.submissions,spec.requiredNativeInputs);assert.equal(actual.node.status,'information-barrier');assert.equal(evaluate(actual.node.observation),r.value);assert.equal(r.value,evaluate(root.observation)+spec.netGain);
  const saved=p.exportPlan(r.planContinuation);assert(saved);assert.equal(saved.rows.length,1,'only the actual pre-plan state can be reused; no invented intermediate states');assert.equal(saved.rows[0].actionId,r.actionId);
  const reused=searchDecision({port:p,root,evaluate,...agent.OPTIONS,modelKey:evaluate.modelKey,planContinuation:r.planContinuation,budget});assert(reused.complete);assert.equal(reused.diagnostics.planContinuation,'hit');assert.equal(reused.value,r.value);
  const limited=searchDecision({port:p,root,evaluate,...agent.OPTIONS,planReuse:false,budget:{...budget,nodes:1}});assert(!limited.complete);assert.equal(limited.stopReason,'node-budget');assert.equal(limited.actionId,null);
  const tiny=searchDecision({port:p,root,evaluate,...agent.OPTIONS,planReuse:false,budget:{...budget,transitions:1}});assert(tiny.complete);assert.equal(tiny.diagnostics.transitions,0);assert.equal(tiny.value,r.value);
  let clock=0;const timed=searchDecision({port:p,root,evaluate,...agent.OPTIONS,planReuse:false,now:()=>clock+=10,budget:{...budget,milliseconds:15}});assert(!timed.complete);assert.equal(timed.actionId,null);assert.deepEqual(c.lifecycle.save().envelope,before);
  const first=root.legalActions.find(a=>a.actionId===r.actionId);assert(c.inputPort.submitQuickAction(first).ok);const changed=c.lifecycle.save().envelope;p.close();const next=p.openRoot();const resumed=searchDecision({port:p,root:next,evaluate,...agent.OPTIONS,modelKey:evaluate.modelKey,planContinuation:r.planContinuation,budget});assert(resumed.complete);assert.notEqual(resumed.diagnostics.planContinuation,'hit');assert.equal(resumed.value,r.value);assert.deepEqual(c.lifecycle.save().envelope,changed);
 }finally{p.close();}
 const {before:fullBefore,p:full,root:fullRoot}=open();try{
  const proxy={...full,incomePlanSummary(){throw new Error('custom value must execute native inputs');}},custom=obs=>values.evaluateStateValue(obs,f.seatId,{weights:{credits:2}}).total;
  const r=searchDecision({port:proxy,root:fullRoot,evaluate:custom,resourcePlanning:true,cardPickPlanning:true,budget});assert(r.complete);assert(r.diagnostics.nativeExecutions>=9);assert.equal(r.diagnostics.incomePlanProofs,0);assert.deepEqual(c.lifecycle.save().envelope,fullBefore);
 }finally{full.close();}
 const empty=structuredClone(f.compositionEnvelope),emptyState=JSON.parse(empty.committedState);emptyState.cards.drawPileCardIds=[];empty.committedState=JSON.stringify(emptyState);const e=open(empty);try{e.p.setResourcePlanning(true);e.p.setCardPickPlanning(true);assert.equal(e.p.incomePlanSummary(e.root),null);}finally{e.p.close();}
 // A pure resource blue reward can lose value through native end-game data scoring.
 const t=read('adhoc/ai-decision-corpus-20261029-learning-v1/v41-step322-terminal-blue-20261029-v1.json'),state=JSON.parse(t.compositionEnvelope.committedState),player=state.players.players.find(p=>p.id===t.seatId);
 for(const [slot,net] of [[1,-3.5],[2,-2.5]]){const r=local.blueCompletion({state,seatId:t.seatId,goal:{blueSlot:slot}});assert(r.available);assert.equal(r.netGain,net);assert.equal(r.selected,false);}
 const positive=structuredClone(state),owner=positive.players.players.find(p=>p.id===t.seatId),removed=owner.reservedCards.find(c=>c.cardId==='dlc_8.png');owner.reservedCards=owner.reservedCards.filter(c=>c!==removed);positive.cards.discardPile.push(removed);assert(local.blueCompletion({state:positive,seatId:t.seatId,goal:{blueSlot:2}}).selected);
 const belowCap=structuredClone(state);belowCap.players.players.find(p=>p.id===t.seatId).resources.publicity=8;assert.equal(local.blueCompletion({state:belowCap,seatId:t.seatId,goal:{blueSlot:1}}).netGain,-.5);
 for(const done of [false,true]){
  const controlled=structuredClone(t.compositionEnvelope),source=JSON.parse(controlled.committedState);source.players.players.find(p=>p.id===t.seatId).mainActionCompleted=done;controlled.committedState=JSON.stringify(source);assert(c.lifecycle.restore(controlled).ok);const port=createAnalysisPort({composition:c,seatId:t.seatId});try{port.setResourcePlanning(true);port.setCardPickPlanning(true);const n=port.openRoot(),spec=port.resourceSpec(n);if(done)assert(spec.blueTails.some(t=>t.available&&!t.selected));else assert(!spec.blueTails?.length,'the negative idle-tail filter does not act before the main action; blue funding is bound to concrete resource demand');}finally{port.close();}
 }
 assert.equal(player.resources.availableData,6);
}finally{c.dispose();}
console.log(JSON.stringify({incomePlanValue:'passed',nativeControlInputs:9,noInventedSuccessor:true,nodeAndTimeBudgets:true,realFirstInputRecovery:true,customValueNativeFallback:true,negativeBlueEndGameValue:true}));
