'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const [fixture,out,resume]=process.argv.slice(2),seat='player-white',seed='seti-free-analyze-v1';
const origin=JSON.parse(fs.readFileSync(fixture)).rows['corner-for-income-first'].analyzed.e;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4});
k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope;
function restore(e){assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);}
function menu(){return c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});}
function act(test){
 const a=menu().find(test);assert(a,JSON.stringify(menu().map(a=>[a.family,a.target,a.summary])));
 const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):
  a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));return a;
}
function view(){
 const e=save(),s=e.session?.session?.workingState||JSON.parse(e.committedState),p=s.players.players.find(x=>x.id===seat);
 return {e,wallet:p.resources,income:p.income,tech:p.techState,hand:p.hand.map(c=>[c.id,c.cardId]),data:p.dataState,
  probes:s.pieces.rockets.filter(r=>r.playerId===seat),next:menu()};
}
const [reference,prefix]=process.argv.slice(5);
const prior=JSON.parse(fs.readFileSync(reference)).rows['corner-for-income-first'].accepted.map(x=>x.action);
const launched=JSON.parse(fs.readFileSync(prefix)).rows['keep-a9'].launched.e;
const actions=[];
try{
 restore(launched);
 for(const x of prior.slice(3,11)){
  const a=act(v=>v.family===x.family&&JSON.stringify(v.target)===JSON.stringify(x.target));
  assert.equal(a.summary,x.summary);actions.push(a);
 }
 const prepared=view();
 restore(launched);for(const a of actions)assert.deepEqual(act(x=>x.actionId===a.actionId),a);assert.deepEqual(save(),prepared.e);
 restore(origin);
 fs.writeFileSync(out,JSON.stringify({launch:launched,actions,prepared,rootRestored:true,standardExperiment:false},null,2)+'\n',{flag:'wx'});
 fs.writeFileSync(resume,JSON.stringify({rows:{'launch-pink3-blue1':{analyzed:{e:prepared.e}}}})+'\n',{flag:'wx'});
 console.log(prepared.wallet,prepared.hand,prepared.probes.length,prepared.tech.ownedTiles);
}finally{c.dispose();}
