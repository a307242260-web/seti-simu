'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),z=require('node:zlib');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition');
const {createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation');
const {createAnalysisPort}=require('./analysis-port'),{createSearchAgent}=require('./search-agent');
const data=require('../data');
const fixture=JSON.parse(z.gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/known-income-after-blind-draw-20261118-v1.json.gz'))));
const seatId='player-white',seed=JSON.parse(fixture.root.committedState).meta.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(state,viewer,context)=>buildRuleObservation(state,seed,viewer?.playerId,[],
  {cheap:viewer?.cheap===true,valueOnly:viewer?.valueOnly===true,trustedCommitted:context?.trustedCommitted===true,trustedFrozenWorking:context?.trustedFrozenWorking===true})});
k.newGame({seed});
const c=k.composition,menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const results=[],drawn=new Set();let reference;
function submit(action){
 const d=c.inspect().session?.decision;
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:seatId,choice:action})
  :action.phase==='quick'?c.inputPort.submitQuickAction(action):c.inputPort.submitAction(action);
 assert(r.ok,JSON.stringify(r));
}
try{
 for(const index of [0,1,3,8]){
 const world=structuredClone(fixture.root);
 const swap=s=>{const deck=s.cards.drawPileCardIds;[deck[0],deck[index]]=[deck[index],deck[0]];};
 const committed=JSON.parse(world.committedState);swap(committed);world.committedState=JSON.stringify(committed);
 swap(world.session.session.baseState);swap(world.session.session.workingState);
 assert(c.lifecycle.restore(world).ok);
 const root=c.lifecycle.save().envelope,port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
 try{
  const q=createSearchAgent({seatId,analysisPort:port}).decide({seatId,legalActions:menu()}).search;
  assert(q.complete&&!q.unresolved.length);
  assert(q.diagnostics.nativeExecutions<=256&&q.rootAndSearchMilliseconds<=600);
  assert.equal(q.actionId,fixture.expected,'a blind draw must not hide the affordable known electricity-income plan');
  assert.deepEqual(c.lifecycle.save().envelope,root,'search must preserve authoritative rule state, session and RNG');
  const policy={action:q.actionId,value:q.value,roots:q.roots,lines:q.lines};
  if(reference)assert.deepEqual(policy,reference,'hidden deck identities must not change any candidate, value or fixed plan');
  else reference=policy;
  // Independently replay the complete fixed income purpose through the
  // production input port. The unknown card is neither spent nor inspected
  // by the proof; the currently displayed alien is the only income supplier.
  const start=port.openRoot();port.setMovementPlanning(true);port.setCardPickPlanning(true);port.setResourcePlanning(true);
  port.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true,rankKnownFossilTraces:true});
  const trace=start.legalActions.find(a=>a.actionId===fixture.expected),card=port.expand(start,trace.actionId);
  const display=card.legalActions.find(a=>a.target?.source==='display'&&a.target.cardIndex===9);assert(display);
  const acquired=port.expand(card,display.actionId),plan=port.resourceSpec(acquired).plans[0];
  assert.equal(plan.goal.kind,'income');assert.equal(plan.goal.incomeCardId,'alien-amiba-9-5');
  const witness=port.expandResourcePlan(acquired,plan,n=>n>=256?'test-budget':null);
  assert(witness.complete);assert.equal(witness.prefixes.length,9);
  const steps=[trace,display,...witness.prefixes.map(x=>x.action)];
  assert.equal(steps.at(-1).target.cardInstanceId,plan.goal.incomeCardId);
  assert(steps.every(a=>!a.target?.cardInstanceId||a.target.cardInstanceId===plan.goal.incomeCardId));
  steps.forEach(a=>{const native=menu().find(x=>x.actionId===a.actionId);assert(native);assert.deepEqual(native.target,a.target);submit(native);});
  const end=c.lifecycle.save().envelope,s=JSON.parse(end.committedState),p=s.players.players.find(p=>p.id===seatId);
  assert.equal(end.session,null);assert.equal(p.income.energy,4);assert.equal(p.resources.energy,3);
  assert.deepEqual(data.listComputerPlacedTokens(p).map(x=>x.placementSlot),[1,2,3,4]);
  assert.equal(p.hand.length,1);assert.equal(p.hand[0].cardId,world.session.session.workingState.cards.drawPileCardIds[0]);
  drawn.add(p.hand[0].cardId);
  assert.deepEqual(s.meta.rngState,world.session.session.workingState.meta.rngState,'fixed preparation does not consume RNG');
  results.push({hiddenIndex:index,value:q.value,native:q.diagnostics.nativeExecutions,ms:q.rootAndSearchMilliseconds,actualInputs:steps.length});
 }finally{port.close();}
 }
 assert.equal(drawn.size,4,'the hidden-world controls must produce different actual blind draws');
 console.log(JSON.stringify({knownIncomeAfterBlindDraw:true,hiddenWorlds:drawn.size,results}));
}finally{c.dispose();}
