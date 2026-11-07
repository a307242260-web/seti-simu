'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const load=n=>require(path.resolve(n)),read=p=>JSON.parse(fs.readFileSync(p));
const {createSeededRandom}=load('randomizer/game/random'),{createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=load('randomizer/app/rule-observation'),{createAnalysisPort}=load('randomizer/game/ai/analysis-port');
const {createSearchAgent}=load('randomizer/game/ai/search-agent');
const cards=load('randomizer/game/cards/deck');
const [proofPath,out,priorControl]=process.argv.slice(2),proof=read(proofPath),seat='player-white',seed='seti-free-analyze-v1';
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});
const c=k.composition,save=()=>c.lifecycle.save().envelope,old=proof.rows['V375-legal-fixed-route'].steps;
const origin=proof.root,restore=e=>{assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);};
const state=()=>{const e=save();return e.session?.session?.workingState||JSON.parse(e.committedState);};
const player=()=>state().players.players.find(q=>q.id===seat);
const menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const same=require('node:util').isDeepStrictEqual;
function act(a){
 const d=c.inspect().session?.decision;assert(menu().some(x=>x.actionId===a.actionId&&x.actorId===seat),a.summary);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
   :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));return a;
}
function usual(index){
 const wanted=old.find(x=>x.index===index).action;
 const a=menu().find(q=>q.family===wanted.family&&same(q.target,wanted.target));assert(a,wanted.summary);
 return act(a);
}
function assets(){
 const s=state(),p=player(),v=c.projection({role:'player',playerId:seat}).state;
 return {score:p.resources.score,tech:p.techState,income:p.income,wallet:p.resources,hand:p.hand.map(q=>({id:q.id,card:q.cardId,income:cards.getIncomeGainForCard(q),corner:cards.getDiscardActionRewardForCard(q)})),
  data:p.dataState,probes:s.pieces.rockets.filter(q=>q.playerId===seat),wins:s.data.sectorSettlements.winsByPlayerId[seat]||[],
  traces:v.selfState.traceCounts,finalProjected:v.publicState.players.find(q=>q.playerId===seat).finalScore};
}
function controlledStart(keepMoney,pinkSlot){
 const fixed=[];
 for(let i=179;i<=182;i++)fixed.push(usual(i));
 const swap=menu(),summary=swap.filter(a=>a.family==='choose_card').map(a=>[a.summary,a.target]);
 for(const label of (keepMoney?['amiba_0.webp','amiba_9.webp']:['amiba_1.webp','amiba_0.webp'])){
  const a=menu().find(q=>q.summary===label);assert(a,label);fixed.push(act(a));
 }
 const confirm=menu().find(a=>a.summary.includes('确认弃牌'));assert(confirm);fixed.push(act(confirm));
 for(let i=186;i<=188;i++)fixed.push(usual(i));
 const options=menu().filter(a=>a.target?.traceType==='pink').map(a=>[a.summary,a.target]);
 const take=menu().find(a=>a.target?.traceType==='pink'&&a.target?.position===pinkSlot&&a.target?.alienSlotId===1);
 if(!take)return {fixed,unavailable:{options,pinkSlot},summary,assets:assets(),envelope:save()};
 fixed.push(act(take));
 const offered=menu().filter(a=>a.family==='choose_card').map(a=>({summary:a.summary,target:a.target}));
 if(offered.length>0){
  // A known display only. Do not choose an anonymous draw.
  const display=menu().find(a=>a.family==='choose_card'&&a.target?.source==='display');
  if(!display)return {fixed,unavailable:{offered},summary,assets:assets(),envelope:save()};
  fixed.push(act(display));
 }
 return {fixed,summary,options,offered,assets:assets(),envelope:save()};
}
try{
 const rows={};
 for(const [name,keep,pink] of [['preserveMoneyPink2',true,2],['publicDisplayPink3',false,3],['preserveMoneyAndPublicDisplay',true,3]]){
  const prior=priorControl&&read(priorControl).rows[name];
  if(prior?.nativeReplayExact){rows[name]=prior;continue;}
  restore(origin);
  const start=controlledStart(keep,pink),accepted=[];
  if(start.unavailable){rows[name]={start,accepted,stop:'control-unavailable'};continue;}
  const agent=createSearchAgent({seatId:seat,analysisPort:createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0})});
  let stop=null;
  for(let i=0;i<75;i++){
   const e=save(),d=agent.decide({seatId:seat,legalActions:menu()}),r=d.search,a=menu().find(x=>x.actionId===d.actionId);
   assert.deepEqual(save(),e);
   if(!r.complete||r.unresolved.length||r.diagnostics.nativeExecutions>256||r.rootAndSearchMilliseconds>600){
    stop={kind:'gate',envelope:e,search:r};break;
   }
   if(a.family==='pass'){stop={kind:'settled-before-pass',envelope:e};break;}
   accepted.push({action:act(a),native:r.diagnostics.nativeExecutions,ms:r.rootAndSearchMilliseconds,value:r.value,assets:assets()});
  }
  assert(stop);const final=assets();
  restore(origin);
  for(const step of [...start.fixed,...accepted.map(q=>q.action)])act(step);
  assert.deepEqual(save(),stop.envelope);
  rows[name]={start,accepted,stop,final,nativeReplayExact:true};
 }
 restore(origin);
 const summary=Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,{stopped:v.stop?.kind||v.stop,start:v.start.assets?.hand,
  final:v.final&&[v.final.score,Object.keys(v.final.tech.ownedTiles).length,v.final.income.credits,v.final.income.energy,v.final.probes.length],
  unavailable:v.start.unavailable}]));
 fs.writeFileSync(out,JSON.stringify({scope:'Same R179 checkpoint. Use money income supplier or already visible red-sector display as concrete purposes for payment and reward. Then production agent continues, not a standard run.',
  rows,summary,rootAndRngRestored:true,newAutonomousRuns:0},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(summary));
}finally{c.dispose();}
