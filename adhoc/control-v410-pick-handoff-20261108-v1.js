'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const load=n=>require(path.resolve(n)),read=p=>JSON.parse(fs.readFileSync(p));
const {createSeededRandom}=load('randomizer/game/random'),{createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=load('randomizer/app/rule-observation'),{createAnalysisPort}=load('randomizer/game/ai/analysis-port');
const {createSearchAgent}=load('randomizer/game/ai/search-agent');
const [source,out]=process.argv.slice(2),ref=read(source),base=ref.fixtures['0'].compositionEnvelope,seat='player-white',seed=ref.fixtures['6'].source.seed;
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
const rows={};
try{
 for(const branch of ['retained-supplier']){
  restore(base);const port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0}),agent=createSearchAgent({seatId:seat,analysisPort:port});
  try{
   const setup=[];
   for(let i=0;i<6;i++){
    const e=save(),r=agent.decide({seatId:seat,legalActions:menu()}),s=r.search,a=menu().find(x=>x.actionId===r.actionId);
    assert.deepEqual(save(),e);assert(a);assert(s.complete&&!s.unresolved.length&&s.diagnostics.nativeExecutions<=256&&s.rootAndSearchMilliseconds<=600);
    setup.push({action:act(a),native:s.diagnostics.nativeExecutions,ms:s.rootAndSearchMilliseconds,value:s.value});
   }
   assert.deepEqual(save(),ref.fixtures['6'].compositionEnvelope);
   const fixed=[];
   function choose(label,filter){const hits=menu().filter(filter);if(hits.length!==1)throw Error(label+': '+JSON.stringify(menu().map(a=>[a.family,a.summary,a.target])));fixed.push(act(hits[0]));}
   choose('fund A5',a=>a.target?.tradeId==='cards-for-credit');
   for(const id of ['card-64-0','card-61-0'])choose(id,a=>a.target?.cardInstanceId===id);
   choose('confirm',a=>a.target?.confirm);
   choose('play A5',a=>a.family==='play_card'&&a.target?.cardInstanceId==='alien-amiba-5-12');
   const start=save(),accepted=[];let stop=null;
   for(let i=0;i<65;i++){
    const e=save(),r=agent.decide({seatId:seat,legalActions:menu()}),s=r.search,a=menu().find(x=>x.actionId===r.actionId);
    assert.deepEqual(save(),e);assert(a);
    if(!s.complete||s.unresolved.length||s.diagnostics.nativeExecutions>256||s.rootAndSearchMilliseconds>600){stop={kind:'gate',e,s};break;}
    if(a.family==='pass'){stop={kind:'settled-before-pass',e};break;}
    const action=act(a);accepted.push({action,native:s.diagnostics.nativeExecutions,ms:s.rootAndSearchMilliseconds,value:s.value,assets:assets(save())});
   }
   assert(stop);const end=assets(stop.e);restore(base);setup.forEach(x=>act(x.action));fixed.forEach(act);assert.deepEqual(save(),start);
   for(const a of accepted)act(a.action);assert.deepEqual(save(),stop.e);
   rows[branch]={setup,fixed,start,accepted,stop,end,nativeReplayExact:true};
  }finally{port.close();}
 }
 restore(base);
 const summary=Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,{stop:v.stop.kind,assets:[v.end.wallet.score,Object.keys(v.end.tech.ownedTiles).length,
 v.end.income.credits,v.end.income.energy,v.end.probes.length],projectedFinal:v.end.projectedFinal,native:v.accepted.length,maxNative:Math.max(...v.accepted.map(a=>a.native)),maxMs:Math.max(...v.accepted.map(a=>a.ms))}]));
 fs.writeFileSync(out,JSON.stringify({scope:'After Orange1 launch, V408 autonomously prepares and finishes its turn. Fix only payment retaining DLC25 and play A5; V410 chooses its public pickup and continues. No standard run.',
  base,rows,summary,rootAndRngRestored:true,newAutonomousRuns:0},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(summary));
}finally{c.dispose();}
