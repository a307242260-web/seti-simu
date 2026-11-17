'use strict';
const assert=require('node:assert/strict');
const {createSimulationRuleComposition}=require('../training/simulation-rule-composition');
const {createSeededRandom}=require('../game/random');
const {buildRuleObservation}=require('./rule-observation');
const {evaluateStateValue}=require('../game/ai/state-value');
const seed='seti-value-observation-20261118',seatId='player-white';
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4});
k.newGame({seed});
try{
 const state=JSON.parse(k.composition.lifecycle.save().envelope.committedState),before=structuredClone(state);
 const full=buildRuleObservation(state,seed,seatId),value=buildRuleObservation(state,seed,seatId,[],{valueOnly:true});
 assert.deepEqual(value.selfState,full.selfState);
 assert.deepEqual(evaluateStateValue(value,seatId),evaluateStateValue(full,seatId));
 assert.deepEqual(state,before,'both observation modes preserve the canonical rule state');
 for(const key of ['rockets','planets','data','solarSystem','finalScoring']){
  value.publicState.board[key].isolationProbe=true;
  assert.deepEqual(state,before,'mutating returned value geometry cannot affect canonical rule state');
  assert.equal(full.publicState.board[key].isolationProbe,undefined);
 }
 console.log(JSON.stringify({detachedValueObservation:true,fullValueParity:true,canonicalStatePreserved:true}));
}finally{k.composition.dispose();}
