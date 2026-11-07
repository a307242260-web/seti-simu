'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const load=n=>require(path.resolve(n)),read=p=>JSON.parse(fs.readFileSync(p));
const {createSeededRandom}=load('randomizer/game/random'),{createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=load('randomizer/app/rule-observation'),{createAnalysisPort}=load('randomizer/game/ai/analysis-port');
const {createSearchAgent}=load('randomizer/game/ai/search-agent');
const [source,out,mode='normal']=process.argv.slice(2),ref=read(source),base=ref.compositionEnvelope||ref.origin,seat='player-white',seed=JSON.parse(base.committedState).meta.seed;
const sourceState=JSON.parse(base.committedState);
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});
const c=k.composition,save=()=>c.lifecycle.save().envelope,menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const restore=e=>{assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);};
function act(w){
 const d=c.inspect().session?.decision,a=menu().find(x=>x.actionId===w.actionId&&x.actorId===seat);
 assert(a,w.summary);assert.deepEqual(a.target,w.target);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
 :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));return a;
}
function assets(e){
 const s=e.session?.session?.workingState||JSON.parse(e.committedState),p=s.players.players.find(q=>q.id===seat),
  v=c.projection({role:'player',playerId:seat}).state;
 return {turn:s.turn.turnNumber,wallet:p.resources,income:p.income,hand:p.hand.map(h=>[h.id,h.cardId]),data:p.dataState,tech:p.techState,
  probes:s.pieces.rockets.filter(x=>x.playerId===seat),wins:s.data.sectorSettlements.winsByPlayerId[seat],traces:v.selfState.traceCounts,
  projectedFinal:v.publicState.players.find(q=>q.playerId===seat).finalScore};
}
try{
 const s=structuredClone(sourceState);
 if(mode.includes('masked')){
  assert(!base.session);
  for(const ids of [s.cards.drawPileCardIds,s.aliens.amiba.cardDeck]){
   assert(ids.length>=2);
   [ids[0],ids[1]]=[ids[1],ids[0]];
  }
 }
 assert(c.lifecycle.restore(mode.includes('masked')?{...base,committedState:JSON.stringify(s)}:base).ok);
 const origin=save(),accepted=[],fixed=[];let stop,checkpoint=null;
 const play=menu().find(a=>a.family==='play_card'&&a.summary==='amiba_3.webp');assert(play);fixed.push(act(play));
 if(mode!=='default'){
  const a=menu().find(a=>a.actionId===mode.replace('masked-', '').replace('-then-a0', ''));assert(a);fixed.push(act(a));
 }
 if(mode.includes('then-a0')){
  const end=menu().find(a=>a.family==='end_turn');assert(end);fixed.push(act(end));
  const source=menu().find(a=>a.family==='play_card'&&a.summary==='amiba_0.webp');assert(source);fixed.push(act(source));
 }
 for(let i=0;i<105;i++){
  const e=save(),port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
  try{
   const agent=createSearchAgent({seatId:seat,analysisPort:port});
   if(checkpoint)agent.loadCheckpoint(checkpoint);
   const r=agent.decide({seatId:seat,legalActions:menu()}),q=r.search,a=menu().find(x=>x.actionId===r.actionId);
   const inputCheckpoint=checkpoint;checkpoint=structuredClone(agent.createCheckpoint());
   assert.deepEqual(save(),e);assert(a);
   if(!q.complete||q.unresolved.length||q.diagnostics.nativeExecutions>256||q.rootAndSearchMilliseconds>600){stop={kind:'gate',e,q};break;}
   if(a.family==='pass'){stop={kind:'settled-before-pass',e};break;}
   const planned=q.lines.filter(x=>x.resourcePolicy?.protectedIncome||x.knownAnalysisFunding||x.cardPickPolicy?.goal?.kind==='late-public-data-income');
   const rootPlans=(q.candidates||[]).filter(x=>x.plan?.goal?.continuationCardId);
   const action=act(a);accepted.push({action,native:q.diagnostics.nativeExecutions,ms:q.rootAndSearchMilliseconds,
    value:q.value,continuation:q.diagnostics.planContinuation,inputCheckpoint,...(planned.length||rootPlans.length?{before:e,planned,rootPlans}:{}),assets:assets(save())});
  }finally{port.close();}
 }
 assert(stop);const end=assets(stop.e);restore(origin);fixed.forEach(act);accepted.forEach(x=>act(x.action));assert.deepEqual(save(),stop.e);restore(base);
 const summary={stop:stop.kind,assets:[end.wallet.score,Object.keys(end.tech.ownedTiles).length,end.income.credits,end.income.energy,end.probes.length],projectedFinal:end.projectedFinal,
  inputs:accepted.length,maxNative:Math.max(...accepted.map(a=>a.native)),maxMs:Math.max(...accepted.map(a=>a.ms))};
 fs.writeFileSync(out,JSON.stringify({scope:'Same actual R179 state. Fixed A3 and at most one original legal removal target; the rest is autonomous and restores the machine plan. Not a standard run.',mode,origin,fixed,accepted,stop,end,summary,rootAndRngRestored:true,nativeReplayExact:true,newAutonomousRuns:0},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(summary));
}finally{c.dispose();}
