'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const [source,out,resume]=process.argv.slice(2),seed='seti-free-analyze-v1',seat='player-white',read=p=>JSON.parse(fs.readFileSync(p));
const origin=read(source).rows['corner-for-income-first'].analyzed.e,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4});
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
 restore(origin);const actions=[];
 const step=(family,test=()=>true)=>{const a=menu().find(x=>x.family===family&&test(x.target));assert(a,JSON.stringify(menu().map(x=>[x.family,x.target,x.summary])));actions.push(act(a));};
 step('scan');step('choose_target',t=>t.nebulaId==='sector-3-a');
 step('choose_card',t=>t.cardInstanceId==='card-61-0'&&t.nebulaId==='sector-3-a');
 step('choose_target',t=>t.choiceId==='trace:1:pink:amiba:3');
 step('choose_card',t=>t.choiceId==='amiba:display:5');
 step('accept_optional_effect',t=>t.choiceId==='confirm:trigger:alien-amiba-0-1:amiba0-pink-data');
 step('complete_task',t=>t.ruleId==='dlc9-three-sector-wins');step('end_turn');
 const afterScan=view();
 step('research_tech');step('choose_target',t=>t.tileId==='orange1');
 step('choose_card',t=>t.cardInstanceId==='card-65-0');
 step('end_turn');
 const prepared=view();
 restore(origin);for(const a of actions)act(a);assert.deepEqual(save(),prepared.e);
 restore(origin);
 fs.writeFileSync(out,JSON.stringify({origin,actions,afterScan,prepared,rootRestored:true,standardExperiment:false},null,2)+'\n',{flag:'wx'});
 fs.writeFileSync(resume,JSON.stringify({rows:{'early-orange1':{analyzed:{e:prepared.e}}}})+'\n',{flag:'wx'});
 console.log('scan',afterScan.wallet,'launch',prepared.wallet,prepared.hand,prepared.probe);
}finally{c.dispose();}
