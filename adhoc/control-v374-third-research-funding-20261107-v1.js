'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const data=require('../randomizer/game/data');
const cards=require('../randomizer/game/cards/deck');
const [fixture,out]=process.argv.slice(2), payload=JSON.parse(fs.readFileSync(fixture));
const root=payload.root, seat='player-white', seed='seti-free-analyze-v1', task='dlc9-three-sector-wins';
const make=()=>{const r=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});r.newGame({seed});return r.composition;};
const save=c=>c.lifecycle.save().envelope;
const state=c=>{const s=save(c);return s.session?.session?.workingState||JSON.parse(s.committedState);};
const player=c=>state(c).players.players.find(p=>p.id===seat);
const menu=c=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const restore=(c,s)=>{assert(c.lifecycle.restore(s).ok);assert.deepEqual(save(c),s);};
const snapshot=c=>{const p=player(c);return{wallet:p.resources,tech:p.techState,hand:p.hand.map(c=>[c.id,c.cardId]),
 computer:data.listComputerPlacedTokens(p).map(t=>t.placementSlot),blue:data.listBlueBonusPlacedTokens(p).map(t=>t.blueSlot),
 cycle:state(c).turn.actionCycleNumber};};
let physical=0;
function submit(c,a){
 const d=c.inspect().session?.decision;
 const res=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
   :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(res.ok,JSON.stringify(res));physical++;
}
function run(c,name,first,second,third,options={}){
 restore(c,root);const path=[], stages={};
 function pick(family,filter=()=>true){const found=menu(c).filter(a=>a.actorId===seat&&a.family===family&&filter(a));
  assert.equal(found.length,1,JSON.stringify(menu(c).map(x=>[x.family,x.target])));
  const a=found[0], before=snapshot(c);submit(c,a);const after=snapshot(c);path.push({id:a.actionId,family,target:a.target,before,after});}
 function research(tile,blueSlot=null){pick('research_tech');pick('choose_target',a=>a.target?.tileId===tile&&a.target.blueSlot===blueSlot);}
 function end(){pick('end_turn');assert(!c.inspect().session?.decision);}
 const slotFor=t=>t.startsWith('blue')?(player(c).techState.blueBoardSlots.blue1===3||player(c).techState.blueBoardSlots.blue4===3?4:3):null;
 research(first,slotFor(first));stages.first=snapshot(c);
 pick('complete_task',a=>a.target?.ruleId===task);stages.claim=snapshot(c);end();
 research(second,slotFor(second));stages.second=snapshot(c);
 const p=player(c), blue=Object.entries(p.techState.blueBoardSlots).find(([id,slot])=>!p.techState.disabledTiles[id]&&data.getBlueBonusPlacementReward(p,slot)?.type==='publicity');
 const prior = data.listComputerPlacedTokens(p).map(t=>t.placementSlot);
 const goalSlot=blue?.[1];const required=goalSlot&&data.getRequiredComputerSlotForBlueBonus(goalSlot);
 const needed=required?Array.from({length:required},(_,i)=>i+1).filter(i=>!prior.includes(i)).length+1:Infinity;
 const planned=Boolean(required&&needed<=p.resources.availableData&&!options.skipData);
 if(planned){
  for(let i=0;i<needed-1;i++){pick('place_data');pick('choose_target',a=>a.target?.target==='computer');}
  pick('place_data');pick('choose_target',a=>a.target?.target==='blueBonus'&&a.target.blueSlot===goalSlot);
 }
 stages.data=snapshot(c);end();
 const suppliers=player(c).hand.filter(c=>cards.getDiscardActionRewardForCard(c)?.gain?.publicity>0);
 assert.equal(suppliers.length,1);
 if(!options.skipCorner&&player(c).resources.publicity<6)pick('card_corner',a=>a.target?.cardInstanceId===suppliers[0].id);
 stages.funded=snapshot(c);
 const available=menu(c).some(a=>a.actorId===seat&&a.family==='research_tech');
 if(available){research(third,slotFor(third));stages.third=snapshot(c);end();}
 const endpoint=save(c);restore(c,root);
 return {name,first,second,third,needed:Number.isFinite(needed)?needed:null,planned,available,path,stages,endpoint};
}
const c=make();
let rows;
try{rows=[run(c,'blue4-purple1','blue4','purple1','blue1'),run(c,'purple1-blue4','purple1','blue4','blue1'),
 run(c,'blue1-blue4','blue1','blue4','purple1'),run(c,'blue1-purple1','blue1','purple1','blue4'),
 run(c,'skip-data','blue4','purple1','blue1',{skipData:true}),run(c,'skip-corner','blue4','purple1','blue1',{skipCorner:true})];}
finally{c.dispose();}
assert.deepEqual(rows[0].endpoint,rows[1].endpoint);
assert.deepEqual(rows.map(r=>r.available),[true,true,false,false,false,false]);
assert.deepEqual(rows.map(r=>r.stages.funded.wallet.publicity),[6,6,3,4,4,4]);
const independentReplays=[];
for(const row of rows){const test=make();try{restore(test,root);for(const a of row.path){
 const real=menu(test).find(x=>x.actionId===a.id);assert(real);assert.deepEqual(real.target,a.target);submit(test,real);assert.deepEqual(snapshot(test),a.after);
 }assert.deepEqual(save(test),row.endpoint);restore(test,root);independentReplays.push({name:row.name,inputs:row.path.length});}finally{test.dispose();}}
assert(physical<=256);
if(out)fs.writeFileSync(out,JSON.stringify({fixture,fixtureSha256:crypto.createHash('sha256').update(fs.readFileSync(fixture)).digest('hex'),rows,independentReplays,physical},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(rows.map(r=>({name:r.name,inputs:r.path.length,needed:r.needed,planned:r.planned,available:r.available,
 wallet:Object.fromEntries(Object.entries(r.stages).map(([k,s])=>[k,s.wallet]))}))));
