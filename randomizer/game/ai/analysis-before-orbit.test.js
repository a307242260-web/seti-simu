'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),z=require('node:zlib');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition');
const {createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation');
const {createAnalysisPort}=require('./analysis-port'),{createSearchAgent}=require('./search-agent');
const values=require('./state-value'),rules=require('../rule-composition');
const fixture=JSON.parse(z.gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/analysis-before-orbit-20261118-v1.json.gz'))));
const seatId='player-white',seed=JSON.parse(fixture.root.committedState).meta.seed;
let auditRoot=null,valueChecks=0,futureValueChecks=0;
function project(state,viewer,context){
 const observation=buildRuleObservation(state,seed,viewer?.playerId,[],{cheap:viewer?.cheap===true,valueOnly:viewer?.valueOnly===true,
  trustedCommitted:context?.trustedCommitted===true,trustedFrozenWorking:context?.trustedFrozenWorking===true});
 if(viewer?.valueOnly){
  const full=buildRuleObservation(state,seed,seatId);
  assert.deepEqual(values.evaluateStateValue(observation,seatId),values.evaluateStateValue(full,seatId));
  if(auditRoot){
   const mask=o=>rules.sanitizeHiddenInformationObservation(auditRoot,o,{code:'hidden_card_reveal'});
   assert.deepEqual(values.evaluateStateValue(mask(observation),seatId),values.evaluateStateValue(mask(full),seatId));
   if(state.turn.roundNumber===3&&state.turn.turnNumber>=auditRoot.publicState.turnNumber+4)futureValueChecks++;
  }
  valueChecks++;
 }
 return observation;
}
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:project});
k.newGame({seed});const c=k.composition,rows=[];let reference;
function run(world,enabled){
 assert(c.lifecycle.restore(world).ok);const before=c.lifecycle.save().envelope;
 auditRoot=buildRuleObservation(JSON.parse(world.committedState),seed,seatId);
 const port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
 try{
  const used=enabled?port:{...port,quoteAnalysisBeforeOrbit:()=>null};
  const agent=createSearchAgent({seatId,analysisPort:used});
  const q=agent.decide({seatId,legalActions:c.inputPort.enumerateActions({})}).search;
  assert(q.complete&&!q.unresolved.length);assert(q.diagnostics.nativeExecutions<=256&&q.rootAndSearchMilliseconds<=600);
  assert.deepEqual(c.lifecycle.save().envelope,before,'the conditional witness cannot change authoritative state or RNG');
  return {...q,checkpoint:agent.createCheckpoint()};
 }finally{port.close();}
}
try{
 for(const index of [0,1,3]){
  const world=structuredClone(fixture.root),s=JSON.parse(world.committedState),deck=s.cards.drawPileCardIds;
  [deck[0],deck[index]]=[deck[index],deck[0]];world.committedState=JSON.stringify(s);
  const base=run(world,false),q=run(world,true),proof=q.scanBeforeOrbit;
  assert(proof,'the funded public analysis and research must be compared before consuming the probe');
  assert.equal(proof.scope,'public-analysis-then-same-orbit');assert.equal(q.actionId,'scan:2d21a323');
  assert(q.scope.endsWith('+conditional-known-analysis-before-orbit'));
  assert(proof.currentTurnValue<q.value,'the public result must distinguish the fixed future witness from current-turn value');
  assert(proof.value>proof.visibleValue);assert.equal(proof.visibleValue,base.value);
  assert(proof.nativeInputs>0&&proof.nativeInputs<=14);
  assert.equal(q.diagnostics.nativeExecutions-base.diagnostics.nativeExecutions,proof.nativeInputs,'every extra native witness input is charged');
  const policy={actionId:q.actionId,value:q.value,proof,roots:q.roots,lines:q.lines};
  if(reference)assert.deepEqual(policy,reference,'unknown refills cannot alter the same public plan');else reference=policy;
  rows.push({index,value:q.value,previous:base.value,native:q.diagnostics.nativeExecutions,extra:proof.nativeInputs,ms:q.rootAndSearchMilliseconds});
 }
 const active=structuredClone(fixture.root),s=JSON.parse(active.committedState);
 s.turn.passedPlayerIds=s.turn.passedPlayerIds.filter(id=>id!=='player-green');active.committedState=JSON.stringify(s);
 assert(!run(active,true).scanBeforeOrbit,'the uncontested witness must not assume an active opponent will leave the board unchanged');
 const funding=run(fixture.fundingRoot,true);
 assert.equal(funding.actionId,'quick_trade:f385e2ac');
 assert.equal(funding.scanBeforeOrbit.scope,'public-analysis-then-same-orbit');
 assert.equal(funding.checkpoint,null,'the shared payment must not export the old orbit continuation');
 const action=c.inputPort.enumerateActions({}).find(a=>a.actionId===funding.actionId);
 assert(c.inputPort.submitQuickAction(action).ok);
 const paid=c.lifecycle.save().envelope;
 assert.deepEqual(JSON.parse(paid.committedState),JSON.parse(fixture.root.committedState));
 const continuation=run(paid,true);
 assert.equal(continuation.actionId,'scan:2d21a323','the real next decision after funding follows the scan plan');
 assert(futureValueChecks>=5,'the new four-turn native witness must be audited in full and masked value views');
 console.log(JSON.stringify({analysisBeforeOrbit:true,hiddenWorlds:rows.length,valueChecks,futureValueChecks,rows}));
}finally{c.dispose();}
