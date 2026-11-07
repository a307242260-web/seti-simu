'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSimulationRuleComposition}=require('../randomizer/game/production-kernel'),{createSeededRandom}=require('../randomizer/game/random');
const [income,travel,tools,out]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p)),seed='seti-free-analyze-v1';
const i=read(income),m=read(travel),t=read(tools),results={};
for(const planet of ['saturn','venus']){
 const cases=results[planet]={};
 for(const [label,branch] of Object.entries(i.rows)){
  const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4});k.newGame({seed});
  const c=k.composition,save=()=>c.lifecycle.save().envelope;
  try{
   assert(c.lifecycle.restore(i.origin).ok);assert.deepEqual(save(),i.origin);
   const move=m.rows[planet][label],tool=t.rows[planet][label],actions=[...branch.actions,...move.actions,...tool.actions];
   assert.deepEqual(branch.focal4.e,move.pre.e);assert.deepEqual(move.end.e,tool.origin);
   let n=0;
   for(const a of actions){
    const d=c.inspect().session?.decision,menu=d?.choices||c.inputPort.enumerateActions({});
    const q=menu.find(q=>q.actionId===a.actionId);assert.deepEqual(q,a);
    if(n>=branch.actions.length&&a.actorId==='player-white'&&a.family==='play_card')
      assert(branch.knownHand.some(([id])=>id===a.target.cardInstanceId));
    const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:q}):
      q.phase==='quick'?c.inputPort.submitQuickAction(q):c.inputPort.submitAction(q);
    assert(r.ok,JSON.stringify(r));n++;
    if(n===branch.actions.length)assert.deepEqual(save(),branch.focal4.e);
    if(n===branch.actions.length+move.actions.length)assert.deepEqual(save(),move.end.e);
   }
   assert.deepEqual(save(),tool.endpoint.e);assert(c.lifecycle.restore(i.origin).ok);assert.deepEqual(save(),i.origin);
   cases[label]={actions:n,transfers:move.trades,travel:move.end.wallet,afterTool:tool.endpoint.wallet};
  }finally{c.dispose();}
 }
}
const sat=results.saturn,ven=results.venus;
assert.deepEqual([sat.energy.travel.score,sat.credits.travel.score,sat.energy.transfers,sat.credits.transfers],[119,119,0,2]);
assert.deepEqual([sat.energy.afterTool.score,sat.credits.afterTool.score,sat.energy.afterTool.publicity,sat.credits.afterTool.publicity],[125,123,7,1]);
assert(sat.energy.afterTool.credits===4&&sat.credits.afterTool.credits===4);
assert.deepEqual([ven.energy.travel.score,ven.credits.travel.score,ven.energy.transfers,ven.credits.transfers],[117,117,0,1]);
assert.deepEqual([ven.energy.afterTool.score,ven.credits.afterTool.score,ven.energy.afterTool.energy,ven.credits.afterTool.energy],[119,121,1,0]);
fs.writeFileSync(out,JSON.stringify({results,completeStateSessionRng:true,rootRestored:true,standardExperiment:false},null,2)+'\n',{flag:'wx'});
console.log(Object.values(results).flatMap(x=>Object.values(x)).reduce((n,x)=>n+x.actions,0),'Native inputs independently replayed');
