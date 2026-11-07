'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const [source,out]=process.argv.slice(2),seed='seti-free-analyze-v1',seat='player-white',read=p=>JSON.parse(fs.readFileSync(p));
const origin=read(source).rows['keep-a9'].funded.e,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4});
k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope,menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const restore=e=>{assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);};
function act(a){assert.deepEqual(menu().find(x=>x.actionId===a.actionId),a);
 const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):
  a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));return a;
}
function view(){
 const e=save(),s=e.session?.session?.workingState||JSON.parse(e.committedState),p=s.players.players.find(x=>x.id===seat);
 return{e,wallet:p.resources,hand:p.hand.map(x=>x.cardId),wins:Object.values(s.data.sectorSettlements).filter(x=>x.playerId===seat||x.winnerPlayerId===seat).length,
  probe:s.pieces.rockets.filter(r=>r.playerId===seat).length};
}
try{
 restore(origin);const scan=act(menu().find(a=>a.family==='scan')),opened=save(),targets=menu(),rows=[];
 for(const first of targets){
  restore(opened);act(first);const ready=save(),second=menu();
  assert(second.every(a=>a.family==='choose_card'&&a.target.cardInstanceId));
  for(const pub of second){
   restore(ready);act(pub);
   const rocket=menu().find(a=>a.target.mode==='launch');assert(rocket);act(rocket);
   const launched=view(),launchedMenu=menu(),pink=launchedMenu.find(a=>a.target.choiceId==='trace:1:pink:amiba:3');
   const actions=[scan,first,pub,rocket];let rewarded=null;
   if(pink){
    actions.push(act(pink));
    const a5=menu().find(a=>a.target.choiceId==='amiba:display:5');assert(a5);
    actions.push(act(a5));
    const data=menu().find(a=>a.target.choiceId==='confirm:trigger:alien-amiba-0-1:amiba0-pink-data');assert(data);
    actions.push(act(data));rewarded=view();
   }
   const endpoint=save();
   restore(origin);for(const a of actions)act(a);assert.deepEqual(save(),endpoint);
   rows.push({first:first.target.nebulaId,second:pub.target.nebulaId,card:pub.target.cardInstanceId,launched,rewarded,actions,
    rewardMenu:launchedMenu.map(x=>[x.actionId,x.family,x.summary])});
  }
 }
 restore(origin);assert(rows.length>0&&rows.length<=36);
 fs.writeFileSync(out,JSON.stringify({origin,rows,rootRestored:true,standardExperiment:false},null,2)+'\n',{flag:'wx'});
 for(const r of rows)console.log(r.first,r.second,r.card,r.launched.wallet.availableData,r.rewarded?.wallet.availableData,r.rewardMenu[0]);
}finally{c.dispose();}
