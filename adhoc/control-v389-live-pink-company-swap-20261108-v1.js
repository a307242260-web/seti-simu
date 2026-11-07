'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const [fixture,graph,out]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p)),seed='seti-free-analyze-v1',seat='player-white';
const input=read(fixture).rows.red,old=read(graph)['red-after-region'].search;
const selected=old.lines[0].edges.find(a=>a.actionId===old.actionId);
assert.equal(selected.fixedCardPlan?.companySwap?.goal?.kind,'known-portfolio-swap');
assert.equal(selected.steps.length,3);assert.deepEqual(selected.fixedCardPlan.companySwap.discardIds,['alien-amiba-1-2']);
assert.equal(selected.fixedCardPlan.companySwap.selection.cardId,'card-60-0');
function kernel(){const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4});k.newGame({seed});return k.composition;}
const c=kernel(),independent=kernel(),save=(k=c)=>k.lifecycle.save().envelope;
const restore=(e,k=c)=>{assert(k.lifecycle.restore(e).ok);assert.deepEqual(save(k),e);};
const menu=(k=c)=>k.inspect().session?.decision?.choices||k.inputPort.enumerateActions({});
function submit(a,k=c){
 assert.deepEqual(menu(k).find(q=>q.actionId===a.actionId),a);
 const d=k.inspect().session?.decision,r=d?k.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):
   a.phase==='quick'?k.inputPort.submitQuickAction(a):k.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));
}
try{
 const origin=input.after.e;
 restore(origin);
 const steps=selected.steps.map(id=>{const a=menu().find(q=>q.actionId===id);assert(a,id);submit(a);return a;});
 const e=save(),s=JSON.parse(e.committedState),p=s.players.players.find(q=>q.id===seat);
 assert(p.hand.some(q=>q.id==='card-60-0')&&!p.hand.some(q=>q.id==='alien-amiba-1-2'));
 restore(origin,independent);for(const a of steps)submit(a,independent);assert.deepEqual(save(independent),e);
 restore(origin);
 const rows={red:{...input,origin,steps,after:{...input.after,e,wallet:p.resources,hand:p.hand.map(x=>[x.id,x.cardId])}}};
 fs.writeFileSync(out,JSON.stringify({rows,policy:selected.fixedCardPlan,independentStateSessionRng:true,standardExperiment:false},null,2)+'\n',{flag:'wx'});
 console.log(rows.red.after.hand,rows.red.after.wallet);
}finally{c.dispose();independent.dispose();}
