'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),z=require('node:zlib');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),cards=require('../randomizer/game/cards/deck'),data=require('../randomizer/game/data');
const [source,raw,out]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(source)),graph=JSON.parse(z.gunzipSync(fs.readFileSync(raw))),seed=f.source.seed,seat=f.seatId;
function kernel(){const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4});k.newGame({seed});return k.composition;}
const c=kernel(),v=kernel(),save=k=>k.lifecycle.save().envelope,state=k=>save(k).session?.session?.workingState||JSON.parse(save(k).committedState),owner=k=>state(k).players.players.find(p=>p.id===seat);
const menu=k=>k.inspect().session?.decision?.choices||k.inputPort.enumerateActions({});
function restore(k,e){assert(k.lifecycle.restore(e).ok);assert.deepEqual(save(k),e);}
function submit(k,test){
 const d=k.inspect().session?.decision,a=menu(k).find(x=>typeof test==='string'?x.actionId===test:test(x));assert(a,JSON.stringify(menu(k).map(x=>[x.actionId,x.target])));
 const r=d?k.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?k.inputPort.submitQuickAction(a):k.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));return a;
}
try{
 restore(c,f.compositionEnvelope);restore(v,f.compositionEnvelope);
 const first=graph.lines[0].edges.find(x=>x.actionId===graph.actionId),goal=first.fixedCardPlan.companySwap;
 assert.equal(goal.goal.id,'data:analyze:6');assert.equal(goal.selection.cardId,'card-49-0');assert.deepEqual(goal.discardIds,['card-51-0']);
 const start=owner(c),input=[];
 assert.equal(start.resources.availableData,2);assert.equal(data.listComputerPlacedTokens(start).length,3);
 assert(!start.hand.some(a=>cards.getDiscardActionRewardForCard(a)?.dataCount));
 const apply=q=>{const a=submit(c,q);input.push(a);return a;};
 for(const id of first.steps)apply(id);
 const afterSwap=owner(c),e=graph.lines[first.target].edges.find(x=>x.resourcePlan?.goal.id==='data:analyze:6');
 assert(afterSwap.hand.some(a=>a.id===goal.selection.cardId));
 assert(!afterSwap.hand.some(a=>a.id===goal.discardIds[0]));
 for(const id of e.steps)apply(id);
 for(let i=0;i<2;i++){apply(x=>x.family==='place_data');apply(x=>x.family==='choose_target'&&x.target.target==='computer');}
 const ready=owner(c);assert.equal(data.listComputerPlacedTokens(ready).length,6);
 assert.equal(ready.resources.availableData,0);assert(ready.hand.every(a=>!input.some(x=>x.family==='card_corner'&&x.target.cardInstanceId===a.id)));
 assert.equal(input.filter(a=>a.family==='card_corner').length,1);
 assert.equal(input.find(a=>a.family==='card_corner').target.cardInstanceId,goal.selection.cardId);
 apply(a=>a.family==='analyze');
 for(const a of input)assert.deepEqual(submit(v,a.actionId),a);
 const result=save(c);assert.deepEqual(save(v),result);
 restore(c,f.compositionEnvelope);
 fs.writeFileSync(out,JSON.stringify({completeStateSessionRng:true,goal,input,start:{stock:2,placed:3},ready:{stock:0,placed:6},result},null,2)+'\n',{flag:'wx'});
 console.log(input.length,goal.goal.id);
}finally{c.dispose();v.dispose();}
