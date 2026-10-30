'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const v=require('./state-value'),{createAnalysisPort}=require('./analysis-port'),{searchDecision}=require('./decision-search'),agent=require('./search-agent'),demand=require('./resource-demand');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation');
const read=n=>JSON.parse(fs.readFileSync(path.resolve(__dirname,`../../../adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-${String(n).padStart(3,'0')}-20261030-v1.json`)));
const f=read(60),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;
function opened(envelope=f.compositionEnvelope){assert(c.lifecycle.restore(envelope).ok);const p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});p.setResourcePlanning(true);p.setCardPickPlanning(true);return{p,root:p.openRoot(),before:c.lifecycle.save().envelope};}
try{
 const {p,root,before}=opened();try{
  const obs=root.observation,own=obs.publicState.players.find(p=>p.playerId===f.seatId),a=v.evaluateStateValue(obs,f.seatId);
  assert(a.components.technologyPotential>0);assert.equal(a.components.handPotential,0);
  assert.equal(v.evaluateStateValue({...obs,terminal:true},f.seatId).total,own.finalScore);
  assert.equal(v.technologyCapital(own.techState,4),0);
  const disabled=structuredClone(own.techState);disabled.disabledTiles.purple4=true;
  assert(v.technologyCapital(own.techState,1)>v.technologyCapital(disabled,1));
  const spec=p.turnTailSummary(root,'end-turn');assert(spec);assert.equal(spec.requiredNativeInputs,1);assert.equal(spec.netGain,0);
  const leaf=p.turnTailBoundary(root,spec);assert.notEqual(p.identity(root),p.identity(leaf));
  assert.throws(()=>leaf.observation,/NO_SUCCESSOR_OBSERVATION/);assert.throws(()=>p.valueObservation(leaf),/NO_SUCCESSOR_OBSERVATION/);assert.throws(()=>p.expand(leaf,spec.firstActionId),/BOUNDARY_CLOSED/);
  const actual=p.expand(root,spec.firstActionId);assert.equal(v.evaluateStateValue(actual.observation,f.seatId).total,a.total);
  const compact=p.valueObservation(actual),full=actual.observation;
  assert.deepEqual(compact.publicState,full.publicState);assert.deepEqual(compact.selfState,full.selfState);
  assert.deepEqual(v.evaluateStateValue(compact,f.seatId),v.evaluateStateValue(full,f.seatId));
  assert.deepEqual(c.lifecycle.save().envelope,before);
  const evaluate=v.createStateValueEvaluator(f.seatId),budget={transitions:1,nodes:32,frontier:32,milliseconds:5000};
  const result=searchDecision({port:p,root,evaluate,...agent.OPTIONS,budget});assert(result.complete);assert(result.diagnostics.turnTailProofs);assert.equal(result.diagnostics.transitions,0);
  const limited=searchDecision({port:p,root,evaluate,...agent.OPTIONS,budget:{...budget,nodes:1}});assert(!limited.complete);assert.equal(limited.actionId,null);assert.equal(limited.stopReason,'node-budget');
  let clock=0;const timed=searchDecision({port:p,root,evaluate,...agent.OPTIONS,now:()=>clock+=10,budget:{...budget,milliseconds:15}});assert(!timed.complete);assert.equal(timed.actionId,null);
  const custom=obs=>v.evaluateStateValue(obs,f.seatId,{weights:{credits:2}}).total;
  const fallback=searchDecision({port:{...p,turnTailSummary(){throw Error('Custom value cannot use the default proof');}},root,evaluate:custom,resourcePlanning:true,cardPickPlanning:true,budget:{...budget,transitions:128}});assert(fallback.complete);assert.equal(fallback.diagnostics.turnTailProofs,0);assert(fallback.diagnostics.transitions>0);
  assert.deepEqual(c.lifecycle.save().envelope,before);
 }finally{p.close();}
 // First take belongs to a public supply stack, not this player's owned type.
 const s=JSON.parse(read(47).compositionEnvelope.committedState),own=s.players.players.find(p=>p.id===f.seatId),card=own.hand.find(c=>c.cardId==='dlc_9.png');assert(card);
 const current=v.knownCardCapital(card,own.techState,s.tech,1);assert(current>0);
 const claimed=structuredClone(s.tech);claimed.stacks.purple4.firstTakeClaimedBy='player-green';assert(v.knownCardCapital(card,own.techState,claimed,1)<current);
 assert.equal(v.knownCardCapital({hidden:true},own.techState,s.tech,1),0);
 assert.equal(v.knownCardCapital(card,own.techState,s.tech,4),0);
 assert.equal(v.handCapital([card,{...card,id:'other'}],own.techState,s.tech,1),current,'duplicate cards cannot each claim the same future option');
 // Real cold recovery of an already-started blue funding input. Generic
 // computer-first advice must not erase its concrete native resource choice.
 const cold=opened(read(57).compositionEnvelope);try{
  const evaluate=v.createStateValueEvaluator(f.seatId),r=searchDecision({port:cold.p,root:cold.root,evaluate,...agent.OPTIONS,budget:{transitions:256,nodes:1024,frontier:256,milliseconds:5000}});
  assert(r.complete);assert(r.actionId);assert.equal(cold.root.legalActions.find(a=>a.actionId===r.actionId).target.target,'blueBonus');assert.deepEqual(c.lifecycle.save().envelope,cold.before);
 }finally{cold.p.close();}
 // A ready orbit/land task is not a quiet turn-end state.
 const ready=structuredClone(f.compositionEnvelope),state=JSON.parse(ready.committedState),white=state.players.players.find(p=>p.id===f.seatId);
 for(const planet of ['mercury','venus','saturn'])state.planets.planets[planet].orbitMarkers.push({playerId:white.id,color:white.color});
 ready.committedState=JSON.stringify(state);const guarded=opened(ready);try{assert(guarded.root.legalActions.some(a=>a.family==='complete_task'));assert.equal(guarded.p.turnTailSummary(guarded.root,'end-turn'),null);}finally{guarded.p.close();}
}finally{c.dispose();}
console.log('purpose capital, typed turn-tail proofs, default-model guard, budgets and cold blue funding passed');
