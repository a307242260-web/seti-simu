'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{gunzipSync}=require('node:zlib');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition');
const {buildRuleObservation}=require('../../app/rule-observation');
const {createSeededRandom}=require('../random'),{createAnalysisPort}=require('./analysis-port'),{createSearchAgent}=require('./search-agent');
const seat='player-white',envelope=JSON.parse(gunzipSync(fs.readFileSync(path.join(__dirname,'scan-income-after-free-move.fixture.json.gz'))));
const seed=JSON.parse(envelope.committedState).meta.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(state,viewer)=>buildRuleObservation(state,seed,viewer?.playerId)});
k.newGame({seed});const c=k.composition;
assert(c.lifecycle.restore(envelope).ok);
const port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
try{
 const legalActions=c.inputPort.enumerateActions({}),scan=legalActions.find(a=>a.family==='scan');
 const q=createSearchAgent({seatId:seat,analysisPort:port}).decide({seatId:seat,legalActions}).search;
 assert(q.complete&&!q.unresolved.length);
 assert(port.getDiagnostics().provedResearchSelections>0,
  'known third-round research choices reuse their native resolution');
 assert(port.getDiagnostics().provedPublicScanChoices>0,
  'root-visible Amiba does not block exact public scans before the native Purple 4 menu');
 const result=q.roots.find(a=>a.actionId===scan.actionId);
 const lines=new Map(q.lines.map(l=>[l.node,l])),post=lines.get(result.target);
 const scanEdge=lines.get(0).edges.find(e=>e.actionId===scan.actionId&&e.target===result.target);
 assert.equal(scanEdge.preparations.at(-1).reason,'fixed-movement-in-scan');
 assert.equal(post.boundary,'hidden_card_reveal');
 const plan=post.edges.find(e=>e.resourcePlan?.goal.kind==='income');
 assert(plan,'a completed free move must not block the already known data corner and electricity plan');
 assert.equal(plan.preparations.length,10);
 assert.equal(plan.resourcePlan.goal.incomeCardId,'alien-amiba-5-9');
 assert.equal(plan.goalStatus,'completed');
 assert.equal(lines.get(plan.target).value,142+5/6);
 assert.deepEqual(c.lifecycle.save().envelope,envelope);
 console.log('completed free scan movement preserves the known electricity plan across public refill');
 // With Purple 4 disabled, a second public scan is still a real choice.
 port.close();
 const state=JSON.parse(envelope.committedState),player=state.players.players.find(p=>p.id===seat);
 player.techState.disabledTiles.purple4=true;
 player.resources.additionalPublicScan=1;
 assert(c.lifecycle.restore({...envelope,committedState:JSON.stringify(state)}).ok);
 const before=c.lifecycle.save().envelope;
 const successors=[];
 for(const reuse of [false,true]){
  const p=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
  try{
   p.setResourcePlanning(reuse);p.setDecisionPlanning({scanPlanning:true});
   let node=p.openRoot();
   for(const select of [a=>a.family==='scan',a=>a.family==='choose_target'&&a.target.nebulaId,
     a=>a.family==='choose_card'&&a.target.publicSlotIndex!==undefined]){
    const action=node.legalActions.find(select);assert(action);
    node=p.expand(node,action.actionId);
   }
   assert(node.legalActions.some(a=>a.target.done));
   assert(node.legalActions.some(a=>a.target.publicSlotIndex!==undefined));
   assert.equal(p.getDiagnostics().provedPublicScanChoices,Number(reuse));
   successors.push([node.status,node.legalActions,node.observation]);
  }finally{p.close();}
 }
 assert.deepEqual(successors[1],successors[0]);
 assert.deepEqual(c.lifecycle.save().envelope,before);

 // Last data: two complete plans produce the same value and immediate energy.
 // Prefer the one that also pays permanent income after the round.
 const tieState=JSON.parse(envelope.committedState),owner=tieState.players.players.find(p=>p.id===seat);
 const data=require('../data'),amiba=require('../aliens/amiba');
 tieState.cards.discardPile.push(...owner.hand);owner.hand=[];
 owner.resources={...owner.resources,credits:0,energy:0,publicity:5,availableData:0,handSize:0};
 owner.mainActionCompleted=true;
 owner.dataState=data.createDefaultDataState();owner.blueBonusResources={credits:0,energy:0};
 for(let i=0;i<3;i++){assert(data.gainData(owner,{root:tieState}).ok);assert(data.placeDataToComputer(owner).ok);}
 assert(data.gainData(owner,{root:tieState}).ok);
 tieState.cards.removedFromGameCardIds=tieState.cards.removedFromGameCardIds.filter(id=>id!=='amiba_9.webp');
 owner.reservedCards.push(amiba.createAlienCard(9,tieState.meta.sequences.alienEntity++));
 assert(c.lifecycle.restore({...envelope,committedState:JSON.stringify(tieState)}).ok);
 const submit=a=>{
  const d=c.inspect().session?.decision;
  const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
    :c.inputPort.submitQuickAction(a);
  assert(r.ok,JSON.stringify(r));
 };
 submit(c.inputPort.enumerateActions({}).find(a=>a.target?.tradeId==='publicity-for-card'));
 submit(c.inspect().session.decision.choices.find(a=>a.target?.cardInstanceId===tieState.cards.publicCards.find(c=>c.cardId==='dlc_25.png').id));
 submit(c.inputPort.enumerateActions({}).find(a=>a.family==='place_data'));
 const tieRoot=c.lifecycle.save().envelope,tiePort=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
 try{
  const legalActions=c.inspect().session.decision.choices;
  const computer=legalActions.find(a=>a.target?.target==='computer');
  const blue=legalActions.find(a=>a.target?.blueSlot===1);
  const q=createSearchAgent({seatId:seat,analysisPort:tiePort}).decide({seatId:seat,legalActions}).search;
  assert(q.complete);
  const [a,b]=[computer,blue].map(x=>q.roots.find(y=>y.actionId===x.actionId));
  assert.equal(a.completion,'complete');assert.equal(b.completion,'complete');assert.equal(a.value,b.value);
  assert.equal(q.actionId,computer.actionId,'same immediate electricity and value favor recurring income');
  assert.deepEqual(c.lifecycle.save().envelope,tieRoot);
  submit(computer);submit(c.inspect().session.decision.choices[0]);
  const paid=JSON.parse(c.lifecycle.save().envelope.committedState).players.players.find(p=>p.id===seat);
  assert.equal(paid.resources.energy,1);
  assert.equal(paid.income.energy,owner.income.energy+1);
  assert.equal(paid.hand.length,0);
 }finally{tiePort.close();}
 console.log('completed electricity tie prefers the recurring income');
}finally{port.close();c.dispose();}


const finalScanCases=JSON.parse(gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/r4-scan4-launch-20261111-v1.json.gz'))));
for(const {root,actionId,value} of finalScanCases){
 const finalKernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(state,viewer)=>buildRuleObservation(state,seed,viewer?.playerId)});
 finalKernel.newGame({seed});const composition=finalKernel.composition;
 const finalPort=createAnalysisPort({composition,seatId:seat,maxCacheEntries:0});
 try{
  assert(composition.lifecycle.restore(root).ok);
  const legalActions=composition.inputPort.enumerateActions({});
  const q=createSearchAgent({seatId:seat,analysisPort:finalPort}).decide({seatId:seat,legalActions}).search;
  assert(q.complete&&!q.unresolved.length);
  assert.deepEqual([q.actionId,q.value],[actionId,value]);
  assert(q.diagnostics.nativeExecutions<=256);
  assert(finalPort.getDiagnostics().provedScan4QuietLaunchSkips>0);
  assert.deepEqual(composition.lifecycle.save().envelope,root);
 }finally{finalPort.close();composition.dispose();}
}

const visitCases=JSON.parse(gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/r4-scan4-visit-20261111-v1.json.gz'))));
const cards=require('../cards/deck');
for(const {root,actionId} of visitCases){
 const visitKernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(state,viewer)=>buildRuleObservation(state,seed,viewer?.playerId,[],{valueOnly:viewer?.valueOnly===true})});
 visitKernel.newGame({seed});const composition=visitKernel.composition;
 function moveArrival(source,reuse){
  assert(composition.lifecycle.restore(source).ok);
  const before=composition.lifecycle.save().envelope;
  const port=createAnalysisPort({composition,seatId:seat,maxCacheEntries:0});
  try{
   port.setResourcePlanning(reuse);
   port.setMovementPlanning(true);
   port.setDecisionPlanning({scanPlanning:true});
   const node=port.openRoot();
   const action=node.legalActions.find(a=>a.actionId===actionId);
   assert(action);
   const child=port.expand(node,action.actionId);
   assert.deepEqual(composition.lifecycle.save().envelope,before);
   return {result:[child.status,child.boundary,child.legalActions,child.observation],reused:port.getDiagnostics().provedScan4QuietMoves};
  }finally{port.close();}
 }
 try{
  const ordinary=moveArrival(root,false),planned=moveArrival(root,true);
  assert.equal(ordinary.reused,0);
  assert.equal(planned.reused,1,'an untriggered free Saturn visit is reusable');
  assert.deepEqual(planned.result,ordinary.result);
  const triggering=structuredClone(root);
  const state=triggering.session.session.workingState;
  const card=cards.createCommittedCardInstance(state,cards.getCatalogEntryForCard({cardId:'b_92.webp'}));
  state.players.players.find(player=>player.id===seat).reservedCards.push(card);
  const index=state.cards.drawPileCardIds.indexOf(card.cardId);
  if(index!==-1)state.cards.drawPileCardIds.splice(index,1);
  const nativeTrigger=moveArrival(triggering,false),plannedTrigger=moveArrival(triggering,true);
  assert.equal(plannedTrigger.reused,0,'a Saturn trigger still needs Native');
  assert(plannedTrigger.result[2].some(action=>action.family==='accept_optional_effect'));
  assert.deepEqual(plannedTrigger.result,nativeTrigger.result);
 }finally{composition.dispose();}
}

const markerCases=JSON.parse(gunzipSync(fs.readFileSync(path.join(__dirname,
 "fixtures/r4-stationary-scan-marker-20261111-v1.json.gz"))));
for(const {root,actionId,value,n} of markerCases){
 const kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(state,viewer)=>buildRuleObservation(state,seed,viewer?.playerId,[],
   {cheap:viewer?.cheap===true,valueOnly:viewer?.valueOnly===true})});
 kernel.newGame({seed});const composition=kernel.composition;
 const port=createAnalysisPort({composition,seatId:seat,maxCacheEntries:0});
 try{
  assert(composition.lifecycle.restore(root).ok);
  const legalActions=composition.inputPort.enumerateActions({});
  const q=createSearchAgent({seatId:seat,analysisPort:port}).decide({seatId:seat,legalActions}).search;
  assert(q.complete&&!q.unresolved.length);
  assert.deepEqual([q.actionId,q.value,q.diagnostics.nativeExecutions],[actionId,value,n]);
  assert(n<=256);
  assert(q.analysis.provedScan4QuietLaunchSkips>=28&&q.analysis.provedPublicScanChoices>=112);
  assert.deepEqual(composition.lifecycle.save().envelope,root);
 }finally{port.close();composition.dispose();}
}
