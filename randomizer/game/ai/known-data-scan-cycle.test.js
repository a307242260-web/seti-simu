'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),z=require('node:zlib');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition');
const {createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation');
const {createAnalysisPort}=require('./analysis-port'),{createSearchAgent}=require('./search-agent');
const V=require('./state-value'),rules=require('../rule-composition'),data=require('../data');
const fixture=JSON.parse(z.gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/known-data-scan-cycle-20261118-v1.json.gz'))));
const seatId='player-white',seed=JSON.parse(fixture.beforePlay.committedState).meta.seed;
let auditRoot,valueChecks=0,futureChecks=0;
function project(s,v,c){
 const options={cheap:v?.cheap===true,valueOnly:v?.valueOnly===true,trustedCommitted:c?.trustedCommitted===true,trustedFrozenWorking:c?.trustedFrozenWorking===true};
 const o=buildRuleObservation(s,seed,v?.playerId,[],options);
 if(options.valueOnly){
  const full=buildRuleObservation(s,seed,seatId);
  assert.deepEqual(V.evaluateStateValue(o,seatId),V.evaluateStateValue(full,seatId));
  if(auditRoot){const mask=x=>rules.sanitizeHiddenInformationObservation(auditRoot,x,{code:'hidden_card_reveal'});
   assert.deepEqual(V.evaluateStateValue(mask(o),seatId),V.evaluateStateValue(mask(full),seatId));
   if(s.turn.turnNumber>=auditRoot.publicState.turnNumber+3)futureChecks++;
  }
  valueChecks++;
 }
 return o;
}
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:project});
k.newGame({seed});const c=k.composition,rows=[];
const menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
function submit(a){
 const native=menu().find(n=>n.actionId===a.actionId);assert(native);assert.deepEqual(native.target,a.target);
 const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:seatId,choice:native})
  :native.phase==='quick'?c.inputPort.submitQuickAction(native):c.inputPort.submitAction(native);assert(r.ok,JSON.stringify(r));
}
function run(world,enabled=true){
 assert(c.lifecycle.restore(world).ok);const before=c.lifecycle.save().envelope;
 auditRoot=buildRuleObservation(world.session?.session?.workingState||JSON.parse(world.committedState),seed,seatId);
 const p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
 try{
  const agent=createSearchAgent({seatId,analysisPort:enabled?p:{...p,quoteKnownDataScans:()=>null}});
  const decision=agent.decide({seatId,legalActions:menu()}),q=decision.search;
  assert(q.complete&&!q.unresolved.length&&q.diagnostics.nativeExecutions<=256&&q.rootAndSearchMilliseconds<=600);
  assert.deepEqual(c.lifecycle.save().envelope,before,'the quote preserves authoritative state, session and RNG');
  return {...q,checkpoint:agent.createCheckpoint(),reason:decision.reasonCode};
 }finally{p.close();}
}
try{
 for(const [name,source]of Object.entries(fixture)){
  let reference;const hiddenDisplays=new Set();
  for(const index of [0,1,3]){
   const world=structuredClone(source),swap=s=>{
    if(index)s.aliens.aliens[2].assignedAlienId=index===1?"方舟":"九折";
    const deck=s.cards.drawPileCardIds;[deck[0],deck[index]]=[deck[index],deck[0]];
    const alien=s.aliens.amiba.cardDeck;const j=Math.min(index,alien.length-1);[alien[0],alien[j]]=[alien[j],alien[0]];
   };
   const s=JSON.parse(world.committedState);swap(s);world.committedState=JSON.stringify(s);
   if(world.session){swap(world.session.session.baseState);swap(world.session.session.workingState);}
   const base=run(world,false),q=run(world),proof=q.knownDataScans;
   assert(proof,'a payable two-scan purpose must be compared with the publicity/research forecast');
   assert.equal(q.reason,'search:proved-known-funded-scan-cycle');assert(q.scope.endsWith('+conditional-known-funded-scan-cycle'));
   assert.equal(q.actionId,name==='beforePlay'?'play_card:6682e09b':'choose_card:11e736f6');
   assert.equal(q.value,143.25);assert(q.value>base.value);assert.equal(q.realization,null);assert.equal(q.preparationDebt,null);
   assert.equal(proof.currentTurnValue,q.roots.find(r=>r.actionId===q.actionId).value);
   assert(proof.nativeInputs<=48&&proof.nativeInputs>0);assert.equal(proof.steps.length,proof.nativeInputs);
   assert.equal(q.diagnostics.nativeExecutions-base.diagnostics.nativeExecutions,proof.nativeInputs,'every witness input is charged');
   assert.equal(q.checkpoint,null,'a conditional future witness cannot export the old winning execution plan');
   const policy={actionId:q.actionId,value:q.value,proof,roots:q.roots,lines:q.lines};
   if(reference)assert.deepEqual(policy,reference,'unknown refills and future alien displays cannot change the policy');else reference=policy;
   const rootObservation=auditRoot,rng=(world.session?.session?.workingState||JSON.parse(world.committedState)).meta.rngState;
   proof.steps.forEach(submit);const end=c.lifecycle.save().envelope,state=JSON.parse(end.committedState),p=state.players.players.find(p=>p.id===seatId);
   assert.equal(end.session,null);assert.equal(state.turn.roundNumber,3);assert.equal(state.turn.turnNumber,rootObservation.publicState.turnNumber+3);
   assert.equal(p.resources.score,80);assert.equal(p.income.energy,4);assert.equal(p.resources.availableData,5);
   assert.deepEqual(data.listComputerPlacedTokens(p).map(t=>t.placementSlot),[1,2,3,4,5,6]);
   assert.deepEqual(state.meta.rngState,rng);assert.equal(p.hand.length,1);assert.equal(p.hand[0].cardId,'amiba_9.webp');
   const masked=rules.sanitizeHiddenInformationObservation(rootObservation,buildRuleObservation(state,seed,seatId),{code:'hidden_card_reveal'});
   assert.equal(V.evaluateStateValue(masked,seatId).total,q.value,'independent Native execution must realize the complete masked quote');
   hiddenDisplays.add(state.aliens.amiba.displayedCardIndex);
   rows.push({name,index,n:q.diagnostics.nativeExecutions,extra:proof.nativeInputs,ms:q.rootAndSearchMilliseconds,value:q.value,previous:base.value});
  }
  assert(hiddenDisplays.size>=2,'hidden controls must actually change the replacement alien display');
 }
 const inactive=structuredClone(fixture.beforePlay),s=JSON.parse(inactive.committedState);s.turn.passedPlayerIds=s.turn.passedPlayerIds.filter(id=>id!=='player-green');inactive.committedState=JSON.stringify(s);
 for(const [world,limit]of [[inactive,48],[fixture.beforeDiscard,5]]){
  assert(c.lifecycle.restore(world).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
  try{p.openRoot();assert.equal(p.quoteKnownDataScans(V.createStateValueEvaluator(seatId),(used,total)=>used<limit&&total<limit),null);
   assert.equal(p.getDiagnostics().submissionCount,world===inactive?0:5);assert.deepEqual(c.lifecycle.save().envelope,before);
  }finally{p.close();}
 }
 const first=run(fixture.beforePlay);submit(menu().find(a=>a.actionId===first.actionId));
 const paid=c.lifecycle.save().envelope;
 assert.equal(paid.committedState,fixture.beforeDiscard.committedState);
 assert.deepEqual(paid.session.session.workingState,fixture.beforeDiscard.session.session.workingState);
 assert.equal(run(c.lifecycle.save().envelope).actionId,'choose_card:11e736f6','the real next decision follows the proved data source');
 assert(futureChecks>=6);console.log(JSON.stringify({knownDataScanCycle:true,valueChecks,futureChecks,rows}));
}finally{c.dispose()}
