'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const [source,out]=process.argv.slice(2),seed='seti-free-analyze-v1',seat='player-white',read=p=>JSON.parse(fs.readFileSync(p));
const origin=read(source).prepared.e,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4});
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
 const fill=()=>{step('place_data');step('choose_target',t=>t.target==='computer');};
 fill();fill();step('analyze');step('choose_target',t=>t.choiceId==='trace:1:blue:amiba:3');
 step('choose_card',t=>t.choiceId==='amiba:display:2');
 const analyzed=view();
 assert.equal(analyzed.wallet.availableData,3);
 step('card_corner',t=>t.cardInstanceId==='alien-amiba-2-14');
 for(let i=0;i<4;i++)fill();
 step('choose_card',t=>t.cardInstanceId==='alien-amiba-5-12');
 step('end_turn');
 const inserted=view();
 assert.equal(inserted.wallet.publicity,4);
 step('card_corner',t=>t.cardInstanceId==='alien-amiba-9-5');
 step('research_tech');step('choose_target',t=>t.tileId==='blue1'&&t.blueSlot===3);
 step('end_turn');
 const endpoint=view(),s=JSON.parse(endpoint.e.committedState),p=s.players.players.find(x=>x.id===seat);
 assert(endpoint.probe===1&&p.income.credits===7&&p.income.energy===4&&Object.keys(p.techState.ownedTiles).length===6);
 assert(endpoint.hand.includes('b_16.webp')&&endpoint.hand.includes('dlc_17.png'));
 restore(origin);for(const a of actions)act(a);assert.deepEqual(save(),endpoint.e);
 restore(origin);
 fs.writeFileSync(out,JSON.stringify({origin,actions,analyzed,inserted,endpoint,rootRestored:true,standardExperiment:false},null,2)+'\n',{flag:'wx'});
 console.log(endpoint.wallet,endpoint.hand,endpoint.probe,p.income,p.techState);
}finally{c.dispose();}
