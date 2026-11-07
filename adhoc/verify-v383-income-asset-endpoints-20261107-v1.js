'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {createStateValueEvaluator}=require('../randomizer/game/ai/state-value'),{searchDecision}=require('../randomizer/game/ai/decision-search');
const {BUDGET,OPTIONS}=require('../randomizer/game/ai/search-agent');
const [recovery,localInput,localRuns,earlyInput,earlyRuns,output]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p));
const seed='seti-free-analyze-v1',seatId='player-white',evaluate=createStateValueEvaluator(seatId);
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope;
function restore(e){assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);}
function action(expected){
 const d=c.inspect().session?.decision,a=(d?.choices||c.inputPort.enumerateActions({})).find(a=>a.actionId===expected.actionId);
 assert.deepEqual(a,expected);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
  :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok);
}
function forecast(e){
 restore(e);const port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
 try{
  const root=port.openRoot(),r=searchDecision({port,root,evaluate,modelKey:evaluate.modelKey,budget:BUDGET,...OPTIONS});
  assert(r.complete&&!r.unresolved.length);assert.deepEqual(save(),e);
  return{actionId:r.actionId,value:r.value,native:r.diagnostics.nativeExecutions,policy:r.lines[0].resourcePolicy?.recoveredDataOrder,
   funding:r.lines[0].resourcePolicy?.sharedDataFunding};
 }finally{port.close();}
}
function asset(e){
 const s=JSON.parse(e.committedState),p=s.players.players.find(x=>x.id===seatId),obs=buildRuleObservation(s,seed,seatId);
 return{score:p.resources.score,resources:p.resources,income:p.income,hand:p.hand.map(c=>c.cardId),tech:p.techState,
  data:p.dataState.placedTokens.map(t=>[t.placementKind,t.placementSlot,t.blueSlot]),probes:s.pieces.rockets.filter(r=>r.playerId===seatId),
  final:obs.publicState.players.find(p=>p.playerId===seatId).finalScore};
}
try{
 const restored=read(recovery).rows,cold=[];
 for(const {e,expected} of restored){
  const actual=forecast(e);assert.equal(actual.actionId,expected.actionId);cold.push(actual);
 }
 assert.equal(cold[0].funding.incomeCardId,'alien-amiba-5-12');
 assert.equal(cold[2].policy.selected,'income');assert.equal(cold[3].policy.selected,'income');
 const before=restored[0].e,blind=JSON.parse(before.committedState),deck=blind.cards.drawPileCardIds;
 [deck[0],deck[1]]=[deck[1],deck[0]];
 const permuted=forecast({...before,committedState:JSON.stringify(blind)});assert.deepEqual(permuted,cold[0]);
 const assets={};
 for(const [input,runs] of [[localInput,localRuns],[earlyInput,earlyRuns]]){
  const starting=read(input).rows;
  for(const [label,row] of Object.entries(read(runs).rows)){
   if(row.stop.reason!=='pass-before-settlement'){assets[label]={reason:row.stop.reason};continue;}
   restore(starting[label].analyzed.e);
   for(const {action:a,native,ms} of row.accepted){assert(native<=256&&ms<=600);action(a);}
   assert.deepEqual(save(),row.stop.envelope);assets[label]={inputs:row.accepted.length,...asset(save())};
  }
 }
 assert.equal(assets['income-fork'].score,113);
 assert.deepEqual([assets['income-fork'].income.credits,assets['income-fork'].income.energy],[7,4]);
 assert.equal(Object.keys(assets['income-fork'].tech.ownedTiles).length,6);
 restore(before);
 fs.writeFileSync(output,JSON.stringify({cold,permuted,assets,rootRestored:true,standardExperiment:false},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(Object.fromEntries(Object.entries(assets).map(([k,x])=>[k,[x.score,x.income?.credits,x.income?.energy,x.final,x.inputs]]))));
}finally{c.dispose();}
