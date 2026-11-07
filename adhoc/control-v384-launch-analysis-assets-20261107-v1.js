'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const [fixture,out]=process.argv.slice(2),seat='player-white',seed='seti-free-analyze-v1';
const origin=JSON.parse(fs.readFileSync(fixture)).prepared.e;
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
const actions=[],snapshots={};
try{
 restore(origin);
 const step=(family,test=()=>true)=>actions.push(act(a=>a.family===family&&test(a.target)));
 const fill=()=>{step('place_data');step('choose_target',t=>t.target==='computer');};
 fill();fill();step('analyze');step('choose_target',t=>t.choiceId==='trace:1:blue:amiba:3');
 step('choose_card',t=>t.choiceId==='amiba:display:2');
 const analyzed=view();snapshots.analyzed=analyzed;
 step('card_corner',t=>t.cardInstanceId==='alien-amiba-2-14');
 snapshots.funded=view();
 while(view().wallet.availableData>0&&view().data.placedTokens.filter(t=>t.placementKind==='computer').length<4)fill();
 snapshots.endpoint=view();
 restore(origin);for(const a of actions)assert.deepEqual(act(x=>x.actionId===a.actionId),a);assert.deepEqual(save(),snapshots.endpoint.e);
 restore(origin);
 fs.writeFileSync(out,JSON.stringify({origin,actions,snapshots,rootRestored:true,standardExperiment:false},null,2)+'\n',{flag:'wx'});
 for(const [label,r] of Object.entries(snapshots))console.log(label,r.wallet,r.hand,r.data.placedTokens.filter(t=>t.placementKind==='computer').map(t=>t.placementSlot),r.next.map(a=>a.summary).slice(0,20));
}finally{c.dispose();}
