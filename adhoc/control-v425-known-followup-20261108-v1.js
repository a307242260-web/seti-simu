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
 restore(base);
 const origin=save(),accepted=[],fixed=[];let stop,checkpoint=null;
 const choose=(family,predicate=()=>true)=>{
  const action=menu().find(a=>a.family===family&&predicate(a.target));
  assert(action,JSON.stringify(menu().map(a=>[a.family,a.target])));
  fixed.push(act(action));
 };
 if(mode==='purple1'){
  choose('research_tech');choose('choose_target',t=>t.tileId==='purple1');
 } else if(mode==='income-first'){
  const q=JSON.parse(require('node:zlib').gunzipSync(fs.readFileSync(process.env.SETI_V425_EXACT_BLUE3)));
  assert(q.complete&&q.diagnostics.nativeExecutions===292);
  const e=q.lines[0].edges.find(x=>x.resourcePlan?.id==='data:income:4'&&x.actionId===q.actionId);
  assert(e&&e.steps.length===10&&e.goalStatus==='completed');
  for(const id of e.steps){
   const a=menu().find(a=>a.actionId===id);
   assert(a,id);fixed.push(act(a));
  }
 } else if(mode.startsWith('known-company')){
  const take=read(process.env.SETI_V425_ORIGINAL).accepted.slice(0,14);
  for(const x of take)fixed.push(act(x.action));
  if(process.env.SETI_V425_FIXTURE){
   fs.writeFileSync(process.env.SETI_V425_FIXTURE,JSON.stringify({seatId:seat,source:{seed},compositionEnvelope:save()},null,2)+'\n',{flag:'wx'});
  }
  if(mode==='known-company'){
  choose('industry',t=>t.abilityId==='deepspace_swap_cards');
  choose('choose_card',t=>t.cardInstanceId==='card-64-0');
  const p=save().session.session.workingState.cards.publicCards.find(c=>c?.cardId==='dlc_15.png');
  assert(p);
  choose('choose_card',t=>t.cardInstanceId===p.id);
  }
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
   const override=null;
   if(override){fixed.push(override);checkpoint=null;}
   const action=act(override||a);accepted.push({action,native:q.diagnostics.nativeExecutions,ms:q.rootAndSearchMilliseconds,
    value:q.value,continuation:q.diagnostics.planContinuation,inputCheckpoint,...(planned.length||rootPlans.length?{before:e,planned,rootPlans}:{}),assets:assets(save())});
  }finally{port.close();}
 }
 assert(stop);const end=assets(stop.e);restore(origin);fixed.forEach(act);accepted.forEach(x=>act(x.action));assert.deepEqual(save(),stop.e);restore(base);
 const summary={stop:stop.kind,assets:[end.wallet.score,Object.keys(end.tech.ownedTiles).length,end.income.credits,end.income.energy,end.probes.length],projectedFinal:end.projectedFinal,
  inputs:accepted.length,maxNative:Math.max(...accepted.map(a=>a.native)),maxMs:Math.max(...accepted.map(a=>a.ms))};
 fs.writeFileSync(out,JSON.stringify({scope:'Same reversed-order public scan root. Only optional override is Pink3; retain Native actions and machine checkpoints. No standard run.',mode,origin,fixed,accepted,stop,end,summary,rootAndRngRestored:true,nativeReplayExact:true,newAutonomousRuns:0},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(summary));
}finally{c.dispose();}
