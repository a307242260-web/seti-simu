'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const load=n=>require(path.resolve(n)),read=p=>JSON.parse(fs.readFileSync(p));
const {createSeededRandom}=load('randomizer/game/random'),{createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=load('randomizer/app/rule-observation'),{createAnalysisPort}=load('randomizer/game/ai/analysis-port');
const {createStateValueEvaluator}=load('randomizer/game/ai/state-value'),{searchDecision}=load('randomizer/game/ai/decision-search');
const {BUDGET,OPTIONS}=load('randomizer/game/ai/search-agent');
const [proofPath,out,mode='amiba3']=process.argv.slice(2),proof=read(proofPath),seat='player-white',seed='seti-free-analyze-v1';
assert(['amiba3','purple1'].includes(mode));
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});
const c=k.composition,save=()=>c.lifecycle.save().envelope,old=proof.rows['V375-legal-fixed-route'].steps;
const origin=proof.root,restore=e=>{assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);};
function act(want){
 const d=c.inspect().session?.decision,a=(d?.choices||c.inputPort.enumerateActions({})).find(q=>q.actionId===want.actionId&&q.actorId===want.actorId);
 assert(a,'Not legal: '+want.actionId);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
   :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));return a;
}
function endAssets(e){
 const s=e.session?.session?.workingState||JSON.parse(e.committedState),p=s.players.players.find(q=>q.id===seat);
 const v=c.projection({role:'player',playerId:seat}).state;
 return {round:s.turn.roundNumber,score:p.resources.score,tech:p.techState,income:p.income,wallet:p.resources,hand:p.hand.map(q=>[q.id,q.cardId]),data:p.dataState,
  probes:s.pieces.rockets.filter(q=>q.playerId===seat),wins:s.data.sectorSettlements.winsByPlayerId[seat]||[],traces:v.selfState.traceCounts,
  finalProjected:v.publicState.players.find(q=>q.playerId===seat).finalScore};
}
try{
 restore(origin);
 const fixed=old.slice(0,mode==='purple1'?15:3).map(row=>act(row.action));
 assert.deepEqual(fixed.slice(0,3).map(a=>a.family),['play_card','choose_target','end_turn']);
 if(mode==='purple1')assert.equal(fixed.at(-1).target.tileId,'purple1');
 const start=save(),part=out+'.progress.json',accepted=[];
 const existing=fs.existsSync(part)?read(part):null;
 if(existing){assert.deepEqual(existing.start,start);accepted.push(...existing.accepted);restore(existing.current);}
 let stop=null;
 for(let i=accepted.length;i<75;i++){
  const e=save(),s=JSON.parse(e.committedState);
  assert.equal(s.turn.roundNumber,3);assert(s.turn.activePlayerIds.every(id=>id===seat||s.turn.passedPlayerIds.includes(id)));
  const p=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0}),evaluate=createStateValueEvaluator(seat);
  let r,ms,a;try{
   const t=performance.now(),root=p.openRoot();r=searchDecision({port:p,root,evaluate,modelKey:evaluate.modelKey,budget:BUDGET,...OPTIONS,planContinuation:null});
   ms=performance.now()-t;a=root.legalActions.find(x=>x.actionId===r.actionId);
   assert.deepEqual(save(),e);
  }finally{p.close();}
  if(!r.complete||r.unresolved.length||r.diagnostics.nativeExecutions>256||ms>600||!a){
   stop={reason:'native-gate',e,ms,nativeInputs:r.diagnostics.nativeExecutions,raw:r};break;
  }
  if(a.family==='pass'){stop={reason:'settled-before-pass',e,ms,nativeInputs:r.diagnostics.nativeExecutions};break;}
  const action=act(a),after=save();
  accepted.push({input:179+fixed.length+i,action,ms,nativeInputs:r.diagnostics.nativeExecutions,value:r.value,selectedPurpose:r.goal||null,
    ...(i===0?{raw:r}:{}),assets:endAssets(after)});
  fs.writeFileSync(part+'.tmp',JSON.stringify({start,current:after,accepted})+'\n');fs.renameSync(part+'.tmp',part);
 }
 assert(stop);
 const assets=endAssets(stop.e),firstAfterAmiba3=accepted[0]?.action||null;
 restore(origin);fixed.forEach(act);assert.deepEqual(save(),start);accepted.forEach(x=>act(x.action));assert.deepEqual(save(),stop.e);
 restore(origin);
 const result={scope:'Fix the selected prior action prefix, then V397 decides from a fresh Native port for each input; no standard run.',mode,
  fixed,start,accepted,stop,assets,firstAfterAmiba3,rootAndRngRestored:true,independentNativeReplayExact:true,newAutonomousRuns:0};
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({stop:stop.reason,inputs:accepted.length,firstAfterAmiba3:firstAfterAmiba3?.actionId,score:assets.score,tech:assets.tech.ownedTiles,income:assets.income,probes:assets.probes.length}));
}finally{c.dispose();}
