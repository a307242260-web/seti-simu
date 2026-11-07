'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),values=require('../randomizer/game/ai/state-value');
const fixture=process.argv[2],f=JSON.parse(fs.readFileSync(fixture)),seat=f.seatId,seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;
const save=()=>c.lifecycle.save().envelope,menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({}),restore=e=>assert(c.lifecycle.restore(e).ok);
const snapshot=()=>{const e=save(),s=e.session?.session?.workingState||JSON.parse(e.committedState),p=s.players.players.find(p=>p.id===seat),o=c.projection({role:'player',playerId:seat}).state;
 return {round:s.turn.roundNumber,wallet:p.resources,income:p.income,tech:p.techState,hand:p.hand.map(c=>[c.id,c.cardId]),data:p.dataState,probes:s.pieces.rockets.filter(r=>r.playerId===seat),traces:o.selfState.traceCounts,projected:o.publicState.players.find(p=>p.playerId===seat).finalScore,model:values.evaluateStateValue(o,seat),envelope:e};};
let inputs=0;
function execute(find){const m=menu().filter(x=>x.actorId===seat&&find(x));assert.equal(m.length,1,JSON.stringify(menu()));const a=m[0],d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));inputs++;return{id:a.actionId,family:a.family,target:a.target};}
try{
 restore(f.compositionEnvelope);const original=save(),start=snapshot(),rows=[];
 assert.equal(start.round,3);assert.equal(start.wallet.publicity,7);assert.equal(start.wallet.score,96);
 const tiles=process.env.SETI_PURPLE_DATA_CONTROL?['purple1']:['purple2','purple1','orange3'];
 for(const tile of tiles){
  restore(original);const path=[execute(a=>a.family==='research_tech'),execute(a=>a.target?.tileId===tile)];
  if(process.env.SETI_PURPLE_DATA_CONTROL)for(let i=0;i<2;i++)path.push(execute(a=>a.family==='place_data'),execute(a=>a.family==='choose_target'&&a.target?.target==='computer'));
  path.push(execute(a=>a.family==='end_turn'));
  assert(menu().some(a=>a.actorId===seat&&a.family==='pass'));const end=snapshot();assert.equal(end.round,3);assert.equal(end.tech.ownedTiles[tile],true);assert.deepEqual(end.income,start.income);
  rows.push({tile,path,end});
 }
 restore(original);assert.deepEqual(save(),original);assert.equal(inputs,process.env.SETI_PURPLE_DATA_CONTROL?7:9);
 const result={fixture,fixtureSha256:crypto.createHash('sha256').update(fs.readFileSync(fixture)).digest('hex'),start,rows,inputs,rootAndRngUnchanged:true,newAiQueries:0,newAutonomousRuns:0};
 fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(rows.map(({tile,end})=>({tile,wallet:end.wallet,computer:end.data.placedTokens.map(t=>[t.placementKind,t.placementSlot]),projected:end.projected,model:end.model.total,components:end.model.components}))));
}finally{c.dispose();}
