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
const b16='card-64-0',a9='alien-amiba-9-5',dlc25='card-60-0';
const rows={};try{
 for(const [label,discard] of Object.entries({'keep-a9':[b16,dlc25],'keep-dlc25':[a9,b16]})){
  restore(origin);const actions=[],step=(family,filter=()=>true)=>actions.push(act(a=>a.family===family&&filter(a.target)));
  step('place_data');step('choose_target',t=>t.target==='blueBonus'&&t.blueSlot===2);
  step('choose_card',t=>t.cardInstanceId===dlc25);
  step('quick_trade',t=>t.tradeId==='cards-for-energy');
  for(const id of discard)actions.push(act(a=>a.target.cardInstanceId===id));
  actions.push(act(a=>a.target.kind==='confirm'));
  const funded=view();assert.equal(funded.wallet.energy,3);
  step('scan');
  step('choose_target',t=>t.nebulaId==='sector-3-a');
  step('choose_card',t=>t.cardInstanceId==='card-61-0'&&t.nebulaId==='sector-3-a');
  step('choose_target',t=>t.mode==='launch');
  const launched=view();assert.equal(launched.probes.length,1);
  restore(origin);for(const a of actions)assert.deepEqual(act(x=>x.actionId===a.actionId),a);assert.deepEqual(save(),launched.e);
  rows[label]={actions,funded,launched};console.log(label,launched.wallet,launched.hand,launched.probes,launched.next.map(a=>[a.family,a.summary]).slice(0,6));
 }
 restore(origin);
 fs.writeFileSync(out,JSON.stringify({origin,rows,rootRestored:true,standardExperiment:false},null,2)+'\n',{flag:'wx'});
 fs.writeFileSync(resume,JSON.stringify({rows:Object.fromEntries(Object.entries(rows).map(([k,r])=>[k,{analyzed:{e:r.launched.e}}]))})+'\n',{flag:'wx'});
}finally{c.dispose();}
