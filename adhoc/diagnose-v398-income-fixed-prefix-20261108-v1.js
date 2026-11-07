'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const load=n=>require(path.resolve(n)),read=p=>JSON.parse(fs.readFileSync(p));
const {createSeededRandom}=load('randomizer/game/random'),{createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=load('randomizer/app/rule-observation'),{createAnalysisPort}=load('randomizer/game/ai/analysis-port');
const {createSearchAgent}=load('randomizer/game/ai/search-agent');
const [oldFile,incomeFile,out]=process.argv.slice(2),old=read(oldFile),income=read(incomeFile),origin=old.root,seat='player-white',seed=JSON.parse(origin.committedState).meta.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});
const c=k.composition,save=()=>c.lifecycle.save().envelope,menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const restore=e=>{assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);};
function act(a){
 const d=c.inspect().session?.decision;
 const native=menu().find(x=>x.actionId===a.actionId&&x.actorId===seat);assert(native,a.summary);assert.deepEqual(native.target,a.target);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:native})
   :native.phase==='quick'?c.inputPort.submitQuickAction(native):c.inputPort.submitAction(native);
 assert(r.ok,JSON.stringify(r));return native;
}
function assets(){
 const e=save(),s=e.session?.session?.workingState||JSON.parse(e.committedState),p=s.players.players.find(x=>x.id===seat),v=c.projection({role:'player',playerId:seat}).state;
 return {wallet:p.resources,income:p.income,hand:p.hand.map(h=>[h.id,h.cardId]),data:p.dataState,tech:p.techState,
  probes:s.pieces.rockets.filter(x=>x.playerId===seat),wins:s.data.sectorSettlements.winsByPlayerId[seat],traceCounts:v.selfState.traceCounts,
  currentFinal:v.publicState.players.find(x=>x.playerId===seat).finalScore};
}
try{
 const rows={};
 for(const endpoint of [185,188,192]){
  restore(origin);
  const fixed=income.rows.normal.route.filter(x=>x.after.index<=endpoint).map(x=>act(x.action));
  const start=save(),initial=assets(),accepted=[],agent=createSearchAgent({seatId:seat,analysisPort:createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0})});
  let stop=null,firstDifference=null;
  for(let i=0;i<85;i++){
   const e=save(),r=agent.decide({seatId:seat,legalActions:menu()}),search=r.search,a=menu().find(x=>x.actionId===r.actionId);
   assert.deepEqual(save(),e);
   const attempted=endpoint+1+i;
   const expected=income.rows.normal.route.find(x=>x.after.index===attempted)?.action;
   if(!firstDifference&&a?.actionId!==expected?.actionId)firstDifference={input:attempted,action:a,expected,envelope:e,search};
   if(!search.complete||search.unresolved.length||search.diagnostics.nativeExecutions>256||search.rootAndSearchMilliseconds>600){
    stop={kind:'gate',search,envelope:e};break;
   }
   if(a.family==='pass'){stop={kind:'settled-before-pass',envelope:e};break;}
   accepted.push({input:attempted,action:act(a),native:search.diagnostics.nativeExecutions,ms:search.rootAndSearchMilliseconds,value:search.value,assets:assets()});
  }
  assert(stop);const final=assets();
  restore(origin);fixed.forEach(act);assert.deepEqual(save(),start);accepted.forEach(x=>act(x.action));assert.deepEqual(save(),stop.envelope);
  rows[endpoint]={initial,fixed,start,accepted,firstDifference,stop,final,nativeReplayExact:true};
 }
 restore(origin);
 const summary=Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,{stop:v.stop.kind,first:v.firstDifference&&[v.firstDifference.input,v.firstDifference.action?.summary,v.firstDifference.expected?.summary],
  final:[v.final.wallet.score,Object.keys(v.final.tech.ownedTiles).length,v.final.income.credits,v.final.income.energy,v.final.probes.length],
  currentFinal:v.final.currentFinal}]));
 fs.writeFileSync(out,JSON.stringify({scope:'V398 production agent after three legal prefixes of the existing full money/energy route. Each starts from the exact official R179 Native root; no new standard run.',
  rows,summary,rootAndRngRestored:true,newAutonomousRuns:0},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(summary));
}finally{c.dispose();}
