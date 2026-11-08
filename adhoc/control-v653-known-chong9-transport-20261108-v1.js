'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const load=p=>require(path.resolve(p)),read=p=>JSON.parse(fs.readFileSync(p)),hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const [comparisonPath,referencePath,out]=process.argv.slice(2),comparison=read(comparisonPath),root=comparison.rows[0].sides.find(r=>r.label==='analysis-first').end;
const seat='player-white',seed=JSON.parse(root.committedState).meta.seed;
const {createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition'),{createSeededRandom}=load('randomizer/game/random');
const {buildRuleObservation}=load('randomizer/app/rule-observation'),{createAnalysisPort}=load('randomizer/game/ai/analysis-port'),{createSearchAgent}=load('randomizer/game/ai/search-agent');
const chong=load('randomizer/game/aliens/chong'),data=load('randomizer/game/data');
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});
const c=k.composition,save=()=>c.lifecycle.save().envelope,view=(pid=seat)=>c.projection({role:'player',playerId:pid}).state,menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const state=()=>save().session?.session?.workingState||JSON.parse(save().committedState),player=()=>state().players.players.find(p=>p.id===seat);
const restore=e=>{const v=c.lifecycle.restore(e);assert(v.ok,JSON.stringify(v));assert.deepEqual(save(),e);};
function execute(w){
 const d=c.inspect().session?.decision,a=menu().find(x=>x.actionId===w.actionId&&x.actorId===w.actorId);
 assert(a,w.summary);assert.deepEqual(a.target,w.target);
 const v=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
  :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(v.ok,JSON.stringify(v));return a;
}
function assets(){
 const p=player(),s=state(),v=view();
 return {wallet:p.resources,income:p.income,tech:p.techState,hand:p.hand.map(c=>[c.id,c.cardId]),reserve:p.reservedCards.map(c=>[c.id,c.cardId]),
  computer:data.listComputerPlacedTokens(p).map(t=>t.placementSlot),blue:data.listBlueBonusPlacedTokens(p).map(t=>t.blueSlot),probes:s.pieces.rockets.filter(x=>x.playerId===seat),
  sectorWins:s.data.sectorSettlements.winsByPlayerId[seat],signals:Object.entries(s.data.nebulae).map(([id,x])=>[id,x.tokens.filter(t=>t.replacedByPlayerId===seat).map(t=>t.slotIndex)]).filter(x=>x[1].length),
  traceCounts:v.selfState.traceCounts,aliens:v.publicState.board.aliens,marks:s.finalScoring,realized:v.publicState.players.find(p=>p.playerId===seat).finalScore,
  turn:[s.turn.roundNumber,s.turn.turnNumber],market:s.cards.publicCards.map(x=>x&&[x.id,x.cardId]),knownChongOffer:chong.isChongRevealedSlot(s.aliens,2)?s.aliens.chong.displayedCardIndex:null};
}











function input(family,test=()=>true){
 const a=menu().find(a=>a.family===family&&test(a));assert(a,family);return execute(a);
}

const ref=read(referencePath).row;
try{
 const rows=[];
 for(const world of comparison.rows){
  const origin=world.sides.find(r=>r.label==='analysis-first').end;
  restore(origin);const actions=[];
  const add=a=>actions.push(execute(a));
  const fixed=ref.accepted.map(x=>x.action);
  for(const i of [26,27,28,32,33,34,35,36,37,38,39,40,41,42,43])add(fixed[i]);
  const ch7=player().hand.find(c=>c.cardId==='chong_7.webp');
  actions.push(input('choose_payment',a=>a.target.cardIds?.length===1&&a.target.cardIds[0]===ch7.id));
  const beforePayment=save(),wallet=assets();
  const mover=menu().find(a=>a.family==='move'&&a.target.deltaX===-1&&a.target.deltaY===0);
  const suffixes=[];
  for(const trade of ['cards-for-credit','cards-for-energy']){
   restore(beforePayment);const trial=[input('quick_trade',a=>a.target.tradeId===trade)];
   const ids=player().hand.filter(c=>c.cardId!=='chong_9.webp').map(c=>c.id);
   assert.equal(ids.length,2);
   for(const id of ids)trial.push(input('choose_payment',a=>a.target.cardInstanceId===id&&a.target.select===true));
   trial.push(input('choose_payment',a=>a.target.confirm===true));
   if(trade==='cards-for-energy'&&mover){
    trial.push(execute(mover));
    if(save().session){
     trial.push(input('choose_payment',a=>a.target.kind==='move-payment'&&(a.target.cardIds?.length===0||a.target.choiceId==='energy')));
    }
   }
   const before=assets(),held=player().hand.find(c=>c.cardId==='chong_9.webp');
   const play=menu().find(a=>a.family==='play_card'&&a.target.cardInstanceId===held.id);
   if(play)trial.push(execute(play));
   suffixes.push({trade,trial,before,play:!!play,next:menu().map(a=>[a.family,a.summary,a.target]),endpoint:save(),after:assets()});
  }
  restore(origin);actions.forEach(execute);assert.deepEqual(save(),beforePayment);restore(origin);
  for(const s of suffixes){actions.forEach(execute);s.trial.forEach(execute);assert.deepEqual(save(),s.endpoint);restore(origin);}
  rows.push({world:world.index,wallet,actions,beforePayment,suffixes,referenceExact:true});
  console.log(JSON.stringify({world:world.index,suffixes:suffixes.map(s=>[s.trade,s.before.wallet,s.play,s.next.slice(0,4)])}));
 }
 restore(root);fs.writeFileSync(out,JSON.stringify({scope:'Attempt early transport with already visible Chong9, never relying on the new Chong display or on a hidden ordinary card identity.',rows},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();}
