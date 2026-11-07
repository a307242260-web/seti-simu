'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=require('../randomizer/app/rule-observation'),{createStateValueEvaluator}=require('../randomizer/game/ai/state-value');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),{searchDecision}=require('../randomizer/game/ai/decision-search'),{BUDGET,OPTIONS}=require('../randomizer/game/ai/search-agent');
const [incomeStart,income,known,launch,launchAI,pink3,pink3AI,assetsControl,out]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p));
const seed='seti-free-analyze-v1',seatId='player-white',evaluate=createStateValueEvaluator(seatId);
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope;
function restore(e){assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);}
function act(a){
 const d=c.inspect().session?.decision,action=(d?.choices||c.inputPort.enumerateActions({})).find(x=>x.actionId===a.actionId);
 assert.deepEqual(action,a);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:action})
  :action.phase==='quick'?c.inputPort.submitQuickAction(action):c.inputPort.submitAction(action);assert(r.ok,JSON.stringify(r));
}
function finish(r){
 assert.equal(r.stop.reason,'pass-before-settlement');assert(r.accepted.every(x=>x.native<=256&&x.ms<=600));
 for(const {action} of r.accepted)act(action);
 assert.deepEqual(save(),r.stop.envelope);
 const state=JSON.parse(save().committedState),p=state.players.players.find(x=>x.id===seatId);
 const obs=buildRuleObservation(state,seed,seatId),final=obs.publicState.players.find(v=>v.playerId===seatId).finalScore;
 assert.equal(state.turn.roundNumber,3);assert.equal(state.turn.currentPlayerId,seatId);
 return {score:p.resources.score,tech:p.techState,income:p.income,resources:p.resources,hand:p.hand.map(x=>x.cardId),data:p.dataState,
  probes:state.pieces.rockets.filter(r=>r.playerId===seatId),final,inputs:r.accepted.length,maxNative:Math.max(...r.accepted.map(x=>x.native)),
  maxMs:Math.max(...r.accepted.map(x=>x.ms))};
}
const rank=r=>r.roots.map(x=>[x.actionId,x.goal?.id,...([x.value,x.realization,x.preparationDebt].map(v=>v===0?0:v))]);
function cold(e){
 restore(e);
 const p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
 try{
  const root=p.openRoot(),r=searchDecision({port:p,root,evaluate,modelKey:evaluate.modelKey,budget:BUDGET,...OPTIONS});
  assert(r.complete&&!r.unresolved.length);assert.deepEqual(save(),e);
  return {action:root.legalActions.find(x=>x.actionId===r.actionId),rank:rank(r),native:r.diagnostics.nativeExecutions,value:r.value};
 }finally{p.close();}
}
try{
 const start=read(incomeStart).rows['income-fork'].analyzed.e,paid=read(known),incomeRun=read(income).rows['income-fork'];
 restore(start);
 const assets={income:finish(incomeRun)};
 assert.deepEqual(save(),paid.rows['a9-only'].analyzed.e);
 assert.deepEqual(assets.income.hand,['b_16.webp']);assert.equal(assets.income.income.energy,4);
 for(const r of Object.values(paid.rows)){
  restore(paid.origin);for(const a of r.actions)act(a);assert.deepEqual(save(),r.analyzed.e);
 }
 const e=paid.origin,mutated=JSON.parse(e.committedState),pile=mutated.cards.drawPileCardIds,stack=mutated.tech.stacks.orange3;
 [pile[0],pile[1]]=[pile[1],pile[0]];
 [stack.bonusQueue[1],stack.bonusQueue[2]]=[stack.bonusQueue[2],stack.bonusQueue[1]];
 const hidden={...e,committedState:JSON.stringify(mutated)},knownResult=cold(e),hiddenResult=cold(hidden);
 assert.deepEqual(hiddenResult,knownResult);
 assert.equal(knownResult.action.target.cardInstanceId,'alien-amiba-9-5');
 assert.deepEqual(knownResult.rank,rank(paid.analysis.search));
 const scan=read(launch),scanned=read(launchAI).rows;
 for(const [label,r] of Object.entries(scan.rows)){
  restore(scan.origin);for(const a of r.actions)act(a);assert.deepEqual(save(),r.launched.e);
  const v=assets[label]=finish(scanned[label]);assert(v.probes.length===1&&v.income.energy===3&&v.score===110&&Object.keys(v.tech.ownedTiles).length===6);
 }
 const prepared=read(pink3),paidLaunch=scan.rows['keep-a9'].launched.e;
 assert.deepEqual(prepared.launch,paidLaunch);
 restore(paidLaunch);for(const a of prepared.actions)act(a);assert.deepEqual(save(),prepared.prepared.e);
 const v=assets['launch-pink3-blue1']=finish(read(pink3AI).rows['launch-pink3-blue1']);
 assert(v.probes.length===1&&v.income.energy===3&&v.score===119&&Object.keys(v.tech.ownedTiles).length===6);
 const missing=read(assetsControl);
 assert.deepEqual(missing.origin,prepared.prepared.e);
 restore(missing.origin);for(const a of missing.actions)act(a);assert.deepEqual(save(),missing.snapshots.endpoint.e);
 assert.equal(missing.snapshots.endpoint.wallet.availableData,0);
 assert.equal(missing.snapshots.endpoint.data.placedTokens.filter(t=>t.placementKind==='computer').length,3);
 assert(missing.snapshots.endpoint.hand.some(([,id])=>id==='amiba_5.webp'));
 restore(start);
 fs.writeFileSync(out,JSON.stringify({assets,hiddenResult,independentReplay:true,rootAndRngRestored:true,standardExperiment:false},null,2)+'\n',{flag:'wx'});
 console.log(Object.fromEntries(Object.entries(assets).map(([k,v])=>[k,[v.score,v.income.credits,v.income.energy,v.probes.length,v.final.totalScore??v.final,v.inputs,v.maxNative]])));
}finally{c.dispose();}
