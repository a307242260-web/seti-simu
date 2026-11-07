'use strict';
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const {createSimulationRuleComposition}=require('../randomizer/game/production-kernel'),{createSeededRandom}=require('../randomizer/game/random');
const [control,finance,out]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p)),seat='player-white',seed='seti-free-analyze-v1';
const q=read(control),f=read(finance),filename=path.resolve(__dirname,'../randomizer/game/ai/local-decision-plans.js');
const original=fs.readFileSync(filename,'utf8'),start=original.indexOf(' function quoteAmibaRegionFollowup'),end=original.indexOf(' function deferredPublicityTask',start);
const withList=original.slice(start,end).replace('return rows.sort((a,b)=>b.value-a.value||a.traceType.localeCompare(b.traceType)||a.position-b.position)[0]||null;','return rows;');
assert(withList.includes('return rows;'));
const instrumented=new Module(filename,module);instrumented.filename=filename;instrumented.paths=module.paths;
instrumented._compile(original.slice(0,start)+withList+original.slice(end),filename);
const plans=instrumented.exports,source=JSON.parse(q.rows.orange.beforeRegion.e.committedState),actor=source.players.players.find(p=>p.id===seat);
const purpose={source:actor.reservedCards.find(x=>x.cardId==='amiba_0.webp').id,card:actor.hand.find(x=>x.cardId==='amiba_3.webp').id};
const quotes=plans.quoteAmibaRegionFollowup({state:source,seatId:seat,purpose}),hidden=structuredClone(source),pile=hidden.cards.drawPileCardIds;
[pile[0],pile[1]]=[pile[1],pile[0]];assert.deepEqual(plans.quoteAmibaRegionFollowup({state:hidden,seatId:seat,purpose}),quotes);
assert(quotes.some(x=>x.region==='orange'&&x.anonymousDrawCount===1&&x.data===1));
const results={};let inputs=0;
for(const [label,row] of Object.entries(q.rows)){
 const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4});k.newGame({seed});
 const c=k.composition,save=()=>c.lifecycle.save().envelope;
 try{
  assert(c.lifecycle.restore(q.origin).ok);assert.deepEqual(save(),q.origin);
  const a=[...row.actions,...f.rows[label].actions];
  for(const [i,step] of a.entries()){
   const d=c.inspect().session?.decision,menu=d?.choices||c.inputPort.enumerateActions({}),found=menu.find(x=>x.actionId===step.actionId);
   assert.deepEqual(found,step);
   const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:found}):
    found.phase==='quick'?c.inputPort.submitQuickAction(found):c.inputPort.submitAction(found);
   assert(r.ok);inputs++;
   if(i===row.actions.length-1)assert.deepEqual(save(),row.analyzed.e);
  }
  assert.deepEqual(save(),f.rows[label].endpoint.e);
  results[label]={analysisData:row.analyzed.wallet.availableData,wallet:f.rows[label].endpoint.wallet,scan:c.inputPort.enumerateActions({}).some(x=>x.family==='scan')};
  assert(c.lifecycle.restore(q.origin).ok);assert.deepEqual(save(),q.origin);
 }finally{c.dispose();}
}
assert.deepEqual([results.red.analysisData,results.orange.analysisData],[1,3]);
assert.deepEqual([results.red.scan,results.orange.scan],[false,true]);
fs.writeFileSync(out,JSON.stringify({results,quotes,inputs,rootAndRngRestored:true,drawIdentityUsed:false,standardExperiment:false},null,2)+'\n',{flag:'wx'});
console.log(inputs,quotes.map(q=>[q.region,q.value,q.data,q.anonymousDrawCount||0]));
