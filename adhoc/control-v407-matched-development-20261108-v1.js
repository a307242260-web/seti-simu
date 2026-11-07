'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const load=n=>require(path.resolve(n)),read=p=>JSON.parse(fs.readFileSync(p));
const {createSeededRandom}=load('randomizer/game/random'),{createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=load('randomizer/app/rule-observation'),{createAnalysisPort}=load('randomizer/game/ai/analysis-port');
const {createSearchAgent}=load('randomizer/game/ai/search-agent'),{createStateValueEvaluator}=load('randomizer/game/ai/state-value');
const cards=load('randomizer/game/cards/deck');
const [input,continuation,out]=process.argv.slice(2),origin=read(input).compositionEnvelope,prior=read(continuation).rows['179'];
const seat='player-white',seed=JSON.parse(origin.committedState).meta.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});
const c=k.composition,save=()=>c.lifecycle.save().envelope,menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const restore=e=>{assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);},evaluate=createStateValueEvaluator(seat);
const state=e=>e.session?.session?.workingState||JSON.parse(e.committedState);
function apply(w){
 const d=c.inspect().session?.decision,a=menu().find(x=>x.actionId===w.actionId&&x.actorId===seat);
 assert(a,w.summary);assert.deepEqual(a.target,w.target);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
 :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));return a;
}
function assets(e){
 const s=state(e),p=s.players.players.find(q=>q.id===seat),obs=c.projection({role:'player',playerId:seat}).state;
 return {turn:s.turn.turnNumber,main:p.mainActionCompleted,wallet:p.resources,income:p.income,
  hand:p.hand.map(x=>({card:x.cardId,corner:cards.getDiscardActionRewardForCard(x),income:cards.getIncomeGainForCard(x)})),
  reserved:p.reservedCards.map(x=>x.cardId),publicCards:s.cards.publicCards.map(x=>x?.cardId),
  data:p.dataState,tech:p.techState,probes:s.pieces.rockets.filter(x=>x.playerId===seat),wins:s.data.sectorSettlements.winsByPlayerId[seat],
  traces:obs.selfState.traceCounts,projectedFinal:obs.publicState.players.find(q=>q.playerId===seat).finalScore,
  value:evaluate(obs),details:obs.selfState};
}
function line(x){return Object.fromEntries(Object.entries(x).filter(([k])=>!['actionOutcomes','observation','expandedActions'].includes(k)));}
const rows={};
try{
 for(const branch of ['A0','A3']){
  restore(origin);
  const port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0}),agent=createSearchAgent({seatId:seat,analysisPort:port});
  try{
   const actions=[],checkpoints=[],cold=[];
   const first=menu().find(a=>a.family==='play_card'&&a.summary===('amiba_'+branch[1]+'.webp'));assert(first);
   const applyAndRecord=(a,i)=>{
    const oldTurn=state(save()).turn.turnNumber,native=apply(a),e=save(),next=state(e).turn.turnNumber;
    actions.push(native);
    if(next!==oldTurn){assert.equal(next,oldTurn+1);assert(!e.session);
     checkpoints.push({after:i,completedTurn:oldTurn,envelope:e,assets:assets(e)});}
   };
   applyAndRecord(first,179);
   let stop=null;
   if(branch==='A0'){
    assert.deepEqual(first,prior.fixed[0]);
    for(const x of prior.accepted)applyAndRecord(x.action,x.input);
    assert.deepEqual(save(),prior.stop.envelope);
    stop={kind:'settled-before-pass',e:save()};
   }else{
    for(let i=180;i<275;i++){
     const e=save(),r=agent.decide({seatId:seat,legalActions:menu()}),s=r.search,a=menu().find(x=>x.actionId===r.actionId);
     assert.deepEqual(save(),e);
     cold.push({input:i,summary:a?.summary,native:s.diagnostics.nativeExecutions,ms:s.rootAndSearchMilliseconds,value:s.value});
     if(!s.complete||s.unresolved.length||s.diagnostics.nativeExecutions>256||s.rootAndSearchMilliseconds>600){stop={kind:'gate',e,s};break;}
     if(a.family==='pass'){stop={kind:'settled-before-pass',e};break;}
     applyAndRecord(a,i);
    }
   }
   assert(stop);const end=assets(stop.e);restore(origin);
   for(const a of actions)apply(a);
   assert.deepEqual(save(),stop.e);rows[branch]={actions,checkpoints,cold,stop,end,replayExact:true};
  }finally{port.close();}
 }
 restore(origin);
 const summary=Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,{stop:v.stop.kind,turns:v.checkpoints.map(q=>summaryAsset(q.assets)),end:summaryAsset(v.end)}]));
 fs.writeFileSync(out,JSON.stringify({scope:'A0 logged V404 route replayed and A3 V406 counterpart from the exact same Native R179 root. Same own turn count, no standard run.',
  origin,rows,summary,rootAndRngRestored:true,newAutonomousRuns:0},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(summary));
}finally{c.dispose();}
function summaryAsset(a){return [a.turn,a.wallet.score,Object.keys(a.tech.ownedTiles).length,a.income.credits,a.income.energy,a.probes.length,a.wallet.availableData,
 a.data.placedTokens.length,a.wallet.handSize,a.projectedFinal,a.value];}
