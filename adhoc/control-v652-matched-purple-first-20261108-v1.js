'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const load=p=>require(path.resolve(p)),read=p=>JSON.parse(fs.readFileSync(p)),hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const [fixture,comparisonPath,out]=process.argv.slice(2),root=read(fixture).compositionEnvelope;
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

const comparison=read(comparisonPath);
try{
 const rows=[];
 for(const row of comparison.rows){
  const origin=row.origin,reference=row.sides.find(x=>x.label==='analysis-first'),plan=reference.actions;
  // Original A: analyze, blue trace, card, END; then purple, its choice,
  // fixed income and blue tail, END; then the public Amiba scan and task.
  assert.deepEqual(plan.slice(0,7).map(a=>a.family),['analyze','choose_target','choose_card','end_turn','research_tech','choose_target','place_data']);
  restore(origin);
  const ordered=[...plan.slice(4,6),plan[3],...plan.slice(0,3),...plan.slice(6)];
  const actions=ordered.map(execute),after=assets(),end=save();
  assert.deepEqual(actions.filter(a=>a.phase==='main').map(a=>a.family),['research_tech','analyze','scan']);
  assert.equal(after.turn[1],12);
  restore(origin);actions.forEach(execute);assert.deepEqual(save(),end);restore(origin);
  const diffs=Object.keys(after).filter(k=>JSON.stringify(after[k])!==JSON.stringify(reference.after[k]));
  rows.push({world:row.index,actions,after,end,vsAnalysisFirstDiffs:diffs,replayExact:true});
  console.log(JSON.stringify({world:row.index,score:after.wallet.score,valueFloor:after.realized,hand:after.wallet.handSize,publicity:after.wallet.publicity,diffs}));
 }
 fs.writeFileSync(out,JSON.stringify({scope:'Same purple1 research, then analysis, then same publicly funded scan. No search or unknown rewards relied upon.',rows},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();}
