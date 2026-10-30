'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation'),{createAnalysisPort}=require('./analysis-port'),values=require('./state-value');
const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/ai-decision-corpus-20261023-v1/case-105-20261023-v1.json'))),seed=f.source.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
try{
 assert(c.lifecycle.restore(f.compositionEnvelope).ok);
 const s=JSON.parse(f.compositionEnvelope.committedState),own=s.players.players.find(p=>p.id===f.seatId),card=own.hand.find(c=>c.cardId==='b_78.webp');assert(card);
 const play=c.inputPort.enumerateActions({}).find(a=>a.family==='play_card'&&a.target.cardInstanceId===card.id);assert(play);assert(c.inputPort.submitAction(play).ok);
 const ready=c.lifecycle.save().envelope;
 for(const pendingHistory of [false,true]){
  const envelope=structuredClone(ready);
  if(pendingHistory){
   const state=JSON.parse(envelope.committedState),p=state.players.players.find(p=>p.id===f.seatId),b71=p.reservedCards.find(c=>c.cardId==='b_71.webp');
   b71.cardEffectState.consumedTriggerIds=b71.cardEffectState.consumedTriggerIds.filter(id=>id!=='b71-mercury-draw');
   state.turn.type1TriggerEvents=[{type:'visitPlanet',playerId:f.seatId,planetId:'mercury'}];
   envelope.committedState=JSON.stringify(state);
  }
  assert(c.lifecycle.restore(envelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});p.setResourcePlanning(true);p.setCardPickPlanning(true);
  try{
   const root=p.openRoot(),spec=p.turnTailSummary(root,'end-turn'),end=root.legalActions.find(a=>a.family==='end_turn');assert(end);
   if(pendingHistory){
    assert.equal(spec,null,'end-turn recollects historical visits; active history cannot be treated as inert');
    let actual=p.expand(root,end.actionId);assert.equal(actual.status,'decision');
    const accept=actual.legalActions.find(a=>a.family==='accept_optional_effect');assert(accept);actual=p.expand(actual,accept.actionId);assert.equal(actual.status,'information-barrier');
    assert(actual.observation.selfState.hand.length>root.observation.selfState.hand.length,'the pending Mercury trigger really draws a native card');
   }else{
    assert(spec,'an end-only plan cannot create a fresh visit even with a live probe and unused visit rewards');
    assert.equal(spec.requiredNativeInputs,1);assert.equal(spec.netGain,0);
    const actual=p.expand(root,end.actionId);assert.equal(values.evaluateStateValue(actual.observation,f.seatId).total,values.evaluateStateValue(root.observation,f.seatId).total+spec.netGain);
    assert.deepEqual(actual.observation.publicState.board,root.observation.publicState.board);
    const proof=p.turnTailBoundary(root,spec);assert.throws(()=>proof.observation,/NO_SUCCESSOR_OBSERVATION/);assert.throws(()=>p.valueObservation(proof),/NO_SUCCESSOR_OBSERVATION/);
   }
   assert.deepEqual(c.lifecycle.save().envelope,before);
  }finally{p.close();}
 }
}finally{c.dispose();}
console.log(JSON.stringify({endOnlyVisitInertness:true,pendingHistoryNativeDrawGuard:true,rootAndRngUnchanged:true}));
