'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),z=require('node:zlib');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation'),{createAnalysisPort}=require('./analysis-port'),movement=require('./goal-movement'),native=require('../production-kernel');
const f=JSON.parse(z.gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/free-scan-funded-prefix-20261118-v1.json.gz')))),seat='player-white',seed=JSON.parse(f.root.committedState).meta.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v,c)=>buildRuleObservation(s,seed,v?.playerId,[],{cheap:v?.cheap===true,valueOnly:v?.valueOnly===true,trustedCommitted:c?.trustedCommitted===true})});k.newGame({seed});const c=k.composition;
const menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const state=()=>{const e=c.lifecycle.save().envelope;return e.session?.session?.workingState||JSON.parse(e.committedState)};
function submit(match){const a=menu().find(match);assert(a);const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok);return a}
assert(c.lifecycle.restore(f.root).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
try{
 p.setMovementPlanning(true);const root=p.openRoot(),policy=p.goalMovementSpec(root),a=root.legalActions.find(a=>a.actionId===policy.selectedActionId);
 assert.equal(a?.target.deltaX,0,'no intervening rotation: use free prefix toward the funded known landing');assert.equal(a.target.deltaY,1);
 assert.equal(policy.chosenGoal.planetId,'saturn');assert.equal(policy.chosenGoal.remainingPaidMovementPoints,1);assert.equal(policy.intent.path.length,1);
 assert.equal(policy.retainedActionIds.filter(id=>root.legalActions.some(a=>a.actionId===id&&Number.isInteger(a.target.deltaX))).length,1);
 const source=f.root.session.session.workingState,session=f.root.session.session;
 const quote=s=>movement.plan({state:s,seatId:seat,actions:root.legalActions,status:'decision',session,
  endpoints:()=>native.getProbeRouteRequirements(s,seat,session.queue[0]).candidates,
  compareTiming:(id,path,free)=>native.comparePlannedMovementTiming(s,seat,id,path,free)});
 for(const kind of ['draw-pile','alien-decks','no-energy','no-fee','opponent-active','unknown-card','temporary-move']){
  const s=structuredClone(source),owner=s.players.players.find(p=>p.id===seat);
  if(kind==='draw-pile')s.cards.drawPileCardIds.reverse();
  if(kind==='alien-decks'){s.aliens.chong.cardDeck.reverse();s.aliens.amiba.cardDeck.reverse()}
  if(kind==='no-energy')owner.resources.energy=0;
  if(kind==='no-fee')owner.resources.credits=0;
  if(kind==='opponent-active')s.turn.passedPlayerIds=s.turn.passedPlayerIds.filter(id=>id!=='player-green');
  if(kind==='unknown-card')owner.hand.find(c=>c.cardId==='chong_6.webp').hidden=true;
  if(kind==='temporary-move')s.turn.cardTurnEventBonuses.push({playerId:seat,movementModifiers:{ignoreAsteroidRestriction:true}});
  const beforeQuote=structuredClone(s),q=quote(s);assert.deepEqual(s,beforeQuote);
  if(['draw-pile','alien-decks'].includes(kind))assert.equal(q.selectedActionId,policy.selectedActionId,kind);
  else assert.equal(q.chosenGoal?.remainingPaidMovementPoints,undefined,kind+' must not borrow the prefix guarantee');
 }
 assert.deepEqual(c.lifecycle.save().envelope,before);p.close();
 submit(a=>a.actionId===policy.selectedActionId);for(const a of f.tail)submit(x=>x.actionId===a.actionId);
 assert.equal(state().turn.currentPlayerId,seat);assert.deepEqual(state().solarSystem.rotation,f.root.session.session.workingState.solarSystem.rotation);
 const starting=structuredClone(state().players.players.find(p=>p.id===seat).resources);
 submit(a=>a.family==='move'&&a.target.rocketId===7&&a.target.deltaX===0&&a.target.deltaY===1);
 submit(a=>a.family==='choose_payment'&&a.target?.kind==='move-payment'&&!a.target.cardIds?.length);
 submit(a=>a.family==='play_card'&&a.target.cardInstanceId===policy.chosenGoal.cardId);
 submit(a=>a.target?.landTarget?.satelliteId==='enceladus'&&a.target.rocketId===7);
 const after=state().players.players.find(p=>p.id===seat).resources;
 assert.equal(after.score,starting.score+13);assert.equal(after.credits,starting.credits-1);assert.equal(after.energy,starting.energy-1);
 assert(c.lifecycle.restore(before).ok);
 const currentPort=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
 try{
  const agent=require('./search-agent').createSearchAgent({seatId:seat,analysisPort:currentPort});
  assert(menu().some(a=>a.actionId===f.priorSelected.actionId),'old direction is still legal, so legality alone cannot validate the old plan');
  assert.notEqual(agent.getProvenance().modelChecksum,f.priorAgentCheckpoint.modelChecksum);
  agent.loadCheckpoint(f.priorAgentCheckpoint);assert.equal(agent.createCheckpoint(),null);
  const result=agent.decide({seatId:seat,legalActions:menu()});
  assert(result.search.complete);assert.equal(result.actionId,policy.selectedActionId);assert(result.search.diagnostics.nativeExecutions<=256);
  assert.deepEqual(c.lifecycle.save().envelope,before);
 }finally{currentPort.close()}
 console.log(JSON.stringify({fundedFreePrefix:true,nativePrintedLanding:13,actualRemainingEnergy:1,noInterveningRotation:true,rootAndRngIsolated:true}));
}finally{p.close();c.dispose()}
