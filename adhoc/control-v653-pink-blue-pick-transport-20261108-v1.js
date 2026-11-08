'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const load=p=>require(path.resolve(p)),read=p=>JSON.parse(fs.readFileSync(p)),hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const [fixture,reference,out]=process.argv.slice(2),root=read(fixture).rows.find(r=>r.goal==='chong_2-kept-after-scan').end;
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

const ref=read(reference).row,known=load('randomizer/game/cards/deck');
try{
 restore(root);const actions=[],at=[],add=a=>actions.push(execute(a));
 const remember=label=>at.push({label,asset:assets(),snapshot:save()});
 remember('source');
 actions.push(input('place_data'),input('choose_target',a=>a.target.blueSlot===2),input('choose_card',a=>a.target.cardInstanceId==='card-64-0'));
 remember('blue-public-card');
 const fixed=ref.accepted.slice(26,43).map(x=>x.action);
 let failure;
 for(let i=0;i<fixed.length;i++){
  const a=fixed[i],same=menu().find(v=>v.actionId===a.actionId&&v.actorId===a.actorId);
  if(!same){failure={referenceInput:i+27,action:a,choices:menu()};break;}
  add(a);if([2,5,8,10,13].includes(i))remember('after-'+(i+27));
 }
 assert(failure);
 const end=save(),after=assets();
 const hand=player().hand.map(c=>({id:c.id,card:c.cardId,corner:known.getDiscardActionRewardForCard(c),move:known.getDiscardActionMoveRewardForCard(c)}));
 restore(root);actions.forEach(execute);assert.deepEqual(save(),end);restore(root);
 fs.writeFileSync(out,JSON.stringify({scope:'Fix the single public blue pick of B16 on the higher-score pink route, then replay the already proved transport preparation until the first unreachable Native action.',actions,at,failure,end,after,hand,replayExact:true},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({firstMissing:failure.referenceInput,action:failure.action.summary,preparations:at.map(e=>[e.label,e.asset.wallet.availableData,e.asset.wallet.publicity,e.asset.hand.map(h=>h[1])]),wallet:after.wallet,hand}));
}finally{c.dispose();}
