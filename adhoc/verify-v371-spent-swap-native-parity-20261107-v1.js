'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),demand=require('../randomizer/game/ai/resource-demand');
const D='reports/ai-foundation-20261105/third-round-teacher-v1/',P='reports/ai-foundation-20261107/v367-blue1-dlc19-native-v1/',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const fixtures=[D+'v209-income-before-amiba-root-20261106-v1.json',P+'v367-r3-blue1-before-dlc19-root-20261107-v1.json',read(D+'v371-cold-v323-actual-r3-step-189-20261107-v1.json').fixture];
const rows=[];let inputs=0;
for(const path of fixtures){
 const f=read(path),seed=f.source.seed,seat=f.seatId,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});
 const c=k.composition,save=()=>c.lifecycle.save().envelope,restore=e=>assert(c.lifecycle.restore(e).ok),menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({}),select=(s,p)=>s.players.players.find(x=>x.id===p);
 function act(family,test=()=>true){const d=c.inspect().session?.decision,choices=menu().filter(a=>a.actorId===seat&&a.family===family&&test(a));assert.equal(choices.length,1);const a=choices[0],r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):c.inputPort.submitQuickAction(a);assert(r.ok);inputs++;return a.actionId;}
 try{
  restore(f.compositionEnvelope);const before=save();assert.equal(before.session,null);const state=JSON.parse(before.committedState),p=select(state,seat);
  const outgoing=p.hand.find(c=>c.cardId==='amiba_3.webp')||p.hand.find(c=>c.cardId==='amiba_9.webp')||p.hand[0],offered=state.cards.publicCards.filter(Boolean);
  const raw=demand.planningCapital(state,p),quotes=demand.knownSwapPortfolioQuotes({state,seatId:seat,outgoing,offered},raw);
  assert(quotes.length);
  for(const q of quotes){
   restore(before);const steps=[act('industry',a=>a.target.abilityId==='deepspace_swap_cards'),act('choose_card',a=>a.target.cardInstanceId===outgoing.id),act('choose_card',a=>a.target.cardInstanceId===q.card.id)];
   const current=save();assert.equal(current.session,null);const after=JSON.parse(current.committedState),p2=select(after,seat);
   assert.equal(p2.industryRoundMarkRound,state.turn.roundNumber);assert.equal(p2.industryRoundMarkTurn,state.turn.turnNumber);
   assert.deepEqual(after.meta.rngState,state.meta.rngState);
   assert(!menu().some(a=>a.family==='industry'&&a.target.abilityId==='deepspace_swap_cards'));
   const actual=demand.planningCapital(after,p2)-raw;
   assert.equal(q.gain,actual,JSON.stringify({fixture:path,outgoing:outgoing.cardId,incoming:q.card.cardId}));
   rows.push({fixture:path,fixtureSha256:sha(path),outgoing:outgoing.cardId,incoming:q.card.cardId,steps,gain:actual,round:p2.industryRoundMarkRound,turn:p2.industryRoundMarkTurn});
  }
  restore(before);assert.deepEqual(save(),before);
 }finally{c.dispose();}
}
const result={rows,inputs,rootAndRngUnchanged:true,companyRoundMarkSpent:true,noSecondSwap:true,newAutonomousRuns:0};
fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({nativeOffers:rows.length,inputs,rootAndRngUnchanged:true,newAutonomousRuns:0}));
