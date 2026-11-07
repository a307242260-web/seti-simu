'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const load=n=>require(path.resolve(n)),read=p=>JSON.parse(fs.readFileSync(p));
const {createSeededRandom}=load('randomizer/game/random'),{createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=load('randomizer/app/rule-observation');
const [source,out]=process.argv.slice(2),ref=read(source),base=structuredClone(ref.base),seat='player-white',seed=JSON.parse(base.committedState).meta.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});
const c=k.composition,save=()=>c.lifecycle.save().envelope,menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
function act(w){
 const d=c.inspect().session?.decision,a=menu().find(x=>x.actionId===w.actionId&&x.actorId===seat);
 assert(a,w.summary);assert.deepEqual(a.target,w.target);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
 :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));
}
try{
 const s0=JSON.parse(base.committedState),deck=s0.cards.drawPileCardIds,old=s0.cards.publicCards[2],index=deck.indexOf('b_9.webp');
 assert(index>=0&&old.cardId==='dlc_15.png');
 const cards=load('randomizer/game/cards/deck'),{cardName,src,...replacement}=cards.createCardInstance(cards.getCatalogEntryForCard(deck[index]),old.id.slice(5));
 assert.equal(replacement.id,old.id);s0.cards.publicCards[2]=replacement;deck[index]=old.cardId;
 assert(s0.cards.publicCards.every(c=>(cards.getDiscardActionRewardForCard(c)?.dataCount||0)===0));
 base.committedState=JSON.stringify(s0);
 assert(c.lifecycle.restore(base).ok);const canonical=save();
 const fixed=ref.rows['retained-supplier'].fixed;
 fixed.slice(0,-1).forEach(act);
 const e=save(),s=e.session.session,actions=menu();
 const payload=JSON.stringify({seatId:seat,source:{seed},compositionEnvelope:e},null,2)+'\n';
 if(fs.existsSync(out))assert.equal(fs.readFileSync(out,'utf8'),payload);
 else fs.writeFileSync(out,payload,{flag:'wx'});
 console.log(JSON.stringify({queue:s.queue.map(x=>[x.type,x.payload?.cardEffect?.type,x.payload?.cardInstanceId]),
  actions:actions.map(a=>[a.summary,a.target]),main:s.workingState.players.players.find(p=>p.id===seat).mainActionCompleted}));
 assert(c.lifecycle.restore(base).ok);assert.deepEqual(save(),canonical);
}finally{c.dispose();}
