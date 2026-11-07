'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const [funding,runs,output,autonomy]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p));
const name='corner-for-income-first',origin=read(funding).rows[name].analyzed.e,baseline=read(runs).rows[name];
const seed='seti-free-analyze-v1',seatId='player-white',k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope;
function restore(e){assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);}
function act(pred){
 const d=c.inspect().session?.decision,menu=d?.choices||c.inputPort.enumerateActions({}),a=menu.find(pred);
 assert(a,JSON.stringify(menu.map(a=>[a.family,a.summary,a.target])));
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
  :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok);return a;
}
const snap=()=>{const e=save(),s=JSON.parse(e.committedState),p=s.players.players.find(x=>x.id===seatId);
 return{e,wallet:p.resources,income:p.income,hand:p.hand.map(x=>[x.id,x.cardId]),
  tech:p.techState,computer:p.dataState.placedTokens.filter(x=>x.placementKind==='computer').map(x=>x.placementSlot),
  blue:p.dataState.placedTokens.filter(x=>x.placementKind==='blueBonus').map(x=>x.blueSlot)};};
try{
 restore(origin);const prefix=[];
 for(const {action} of baseline.accepted){
  if(action.family==='card_corner'&&action.summary.startsWith('amiba_2'))break;
  assert.deepEqual(act(a=>a.actionId===action.actionId),action);prefix.push(action);
 }
 assert.equal(prefix.length,24);
 const source=snap(),rows={};
 for(const label of ['a2-to-income-keep-a5','blue-then-a9-income']){
  restore(source.e);const steps=[];
  const take=(family,p=()=>true)=>steps.push(act(a=>a.family===family&&p(a)));
  take('card_corner',a=>a.summary.startsWith('amiba_2'));const funded=snap();
  take('place_data');
  if(label==='a2-to-income-keep-a5'){
   take('choose_target',a=>a.target.target==='computer');
   take('choose_card',a=>a.summary==='收入 amiba_5.webp');
  }else{
   take('choose_target',a=>a.target.target==='blueBonus'&&a.target.blueSlot===1);
   take('card_corner',a=>a.summary.startsWith('amiba_5'));
   take('place_data');take('choose_target',a=>a.target.target==='computer');
   take('choose_card',a=>a.summary==='收入 amiba_9.webp');
  }
  take('end_turn');const analyzed=snap();
  assert.deepEqual([analyzed.income.credits,analyzed.income.energy],[7,4]);
  restore(origin);
  for(const a of [...prefix,...steps])assert.deepEqual(act(x=>x.actionId===a.actionId),a);
  assert.deepEqual(save(),analyzed.e);rows[label]={steps,analyzed,funded};
  console.log(label,analyzed.wallet,analyzed.income,analyzed.hand);
 }
 restore(origin);
 fs.writeFileSync(output,JSON.stringify({rows,origin,source,prefix,rootRestored:true,standardExperiment:false},null,2)+'\n',{flag:'wx'});
 fs.writeFileSync(autonomy,JSON.stringify({rows:Object.fromEntries(Object.entries(rows).map(([k,x])=>[k,{analyzed:{e:x.analyzed.e}}]))})+'\n',{flag:'wx'});
}finally{c.dispose();}
