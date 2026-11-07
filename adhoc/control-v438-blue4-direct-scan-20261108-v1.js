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
 const r=read(process.env.SETI_R179_PREFIX),branch=r.rows.find(x=>x.removal.actionId==='choose_target:30cf5375');
 assert(branch);restore(branch.endRemoval);
 const actualOrigin=save(),before=assetState=>JSON.stringify(assetState);
 function select(f,pred){choose(f,pred);}
 if(mode.startsWith('blue-producer')){
  const data=load('randomizer/game/data');
  select('play_card',t=>t.cardInstanceId==='alien-amiba-0-1');
  select('choose_target',t=>JSON.stringify(t).includes('blue_2'));
  if(mode!=='blue-producer-play'){
   for(const slot of [5,6]){
    select('place_data');
    select('choose_target',t=>t.target==='computer');
   }
   select('end_turn');
   if(mode==='blue-producer-analysis'){
    select('analyze');
    select('choose_target',t=>t.traceType==='blue'&&t.position===4);
    select('choose_card',t=>t.source==='display');
   }
  }
 }else if(mode==='blue-buy-fodder'){
   select('quick_trade',t=>t.tradeId==='publicity-for-card');
   const bought=menu().find(a=>a.family==='choose_card'&&a.summary==='dlc_20.png');
   assert(bought);fixed.push(act(bought));
   select('quick_trade',t=>t.tradeId==='cards-for-energy');
   for(const id of ['alien-amiba-0-1','card-62-0'])select('choose_payment',t=>t.cardInstanceId===id);
   select('choose_payment',t=>t.confirm===true||t.kind==='confirm');
 }else if(mode.startsWith('blue4-scan')){
   select('research_tech');select('choose_target',t=>t.tileId==='blue4');
   const before=assets(save());
   assert.equal(before.wallet.energy,2);
   assert(before.hand.some(([id])=>id==='alien-amiba-1-2'));
   select('end_turn');
   select('scan');
   console.log(JSON.stringify({mode,before,firstScanMenu:menu()}));
   if(mode!=='blue4-scan'){
    const earth=menu().filter(a=>a.family==='choose_target');
    assert.equal(earth.length,1);
    fixed.push(act(earth[0]));
    console.log(JSON.stringify({mode,secondScanMenu:menu()}));
    if(mode==='blue4-scan-pink3'){
     select('choose_card',t=>t.cardInstanceId==='card-61-0'&&t.nebulaId==='sector-3-a');
     select('choose_target',t=>t.traceType==='pink'&&t.position===3);
     if(menu().some(a=>a.family==='choose_card'&&a.target.source==='display'))select('choose_card',t=>t.source==='display');
    }
   }
 }else if(mode==='blue-research-energy'){
   select('research_tech');select('choose_target',t=>t.tileId==='blue4');
 }else if(mode==='blue-preserve-money'){
   select('quick_trade',t=>t.tradeId==='cards-for-energy');
   for(const id of ['alien-amiba-0-1','alien-amiba-9-5'])
    select('choose_payment',t=>t.cardInstanceId===id);
   select('choose_payment',t=>t.confirm===true||t.kind==='confirm');
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
 assert(stop);const end=assets(stop.e);restore(actualOrigin);fixed.forEach(act);accepted.forEach(x=>act(x.action));assert.deepEqual(save(),stop.e);restore(base);
 const summary={stop:stop.kind,assets:[end.wallet.score,Object.keys(end.tech.ownedTiles).length,end.income.credits,end.income.energy,end.probes.length],projectedFinal:end.projectedFinal,
  inputs:accepted.length,maxNative:Math.max(...accepted.map(a=>a.native)),maxMs:Math.max(...accepted.map(a=>a.ms))};
 fs.writeFileSync(out,JSON.stringify({scope:'Same actual Blue removal root. Fixed known Blue4 supplies scan energy without a discard; after the listed override the frozen agent chooses all remaining inputs. No standard run.',mode,origin:actualOrigin,fixed,accepted,stop,end,summary,rootAndRngRestored:true,nativeReplayExact:true,newAutonomousRuns:0},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(summary));
}finally{c.dispose();}
