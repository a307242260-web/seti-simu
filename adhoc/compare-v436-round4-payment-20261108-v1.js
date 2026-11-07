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
const pc=load('randomizer/game/ai/probe-capital'),weights=load('randomizer/game/ai/state-value').DEFAULT_WEIGHTS;
function raw(){
 const e=save();
 return e.session?.session?.workingState||JSON.parse(e.committedState);
}
function step(w){
 const d=c.inspect().session?.decision,a=menu().find(x=>x.actionId===w.actionId);
 assert(a);assert.deepEqual(a.target,w.target);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
 :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));return a;
}
const sources=process.argv.slice(4);
try{
 const rows=[];
 for(const file of sources){
  const d=read(file),origin=d.stop.e;restore(origin);
  const accepted=[];
  for(let n=0;n<30;n++){
   if(raw().turn.roundNumber===4&&!save().session)break;
   const next=menu().find(a=>a.family==='pass'||a.family==='choose_card'&&a.target?.kind==='pass-reserve-card'
     ||a.family==='accept_optional_effect'&&a.target?.choiceId?.startsWith('skip:'));
   assert(next,JSON.stringify(menu().map(a=>[a.family,a.target])));
   accepted.push(step(next));
  }
  assert.equal(raw().turn.roundNumber,4);assert.equal(save().session,null);
  const end=save(),s=raw(),p=s.players.players.find(p=>p.id===seat),wallet=p.resources;
  const costs=pc.requirements(pc.factsFromState(s,p)).map(g=>{
   const cost={...g.endpointFacts.cost,energy:(g.endpointFacts.cost.energy||0)+g.route.cost};
   return {id:g.requirementId,family:g.endpointFamily,planet:g.planetId,cost,payment:pc.funding(wallet,cost,weights)};
  });
  restore(origin);accepted.forEach(step);assert.deepEqual(save(),end);
  rows.push({file:path.basename(file),origin,accepted,end,assets:assets(end),costs});
 }
 restore(base);
 fs.writeFileSync(out,JSON.stringify({rows,replayExact:true},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();}
