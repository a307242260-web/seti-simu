'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const load=n=>require(path.resolve(n)),read=p=>JSON.parse(fs.readFileSync(p));
const {createSeededRandom}=load('randomizer/game/random'),{createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=load('randomizer/app/rule-observation'),{createAnalysisPort}=load('randomizer/game/ai/analysis-port');
const {createSearchAgent}=load('randomizer/game/ai/search-agent');
const [source,out,mode='normal']=process.argv.slice(2),ref=read(source),base=ref.compositionEnvelope||ref.origin,seat='player-white',seed=JSON.parse(base.committedState).meta.seed;
const sourceState=JSON.parse(base.committedState);
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});
const c=k.composition,save=()=>c.lifecycle.save().envelope,menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const restore=e=>{assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);};
function act(w){
 const d=c.inspect().session?.decision,a=menu().find(x=>x.actionId===w.actionId&&x.actorId===seat);
 assert(a,w.summary);assert.deepEqual(a.target,w.target);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
 :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));return a;
}
function assets(e){
 const s=e.session?.session?.workingState||JSON.parse(e.committedState),p=s.players.players.find(q=>q.id===seat),
  v=c.projection({role:'player',playerId:seat}).state;
 return {turn:s.turn.turnNumber,wallet:p.resources,income:p.income,hand:p.hand.map(h=>[h.id,h.cardId]),data:p.dataState,tech:p.techState,
  probes:s.pieces.rockets.filter(x=>x.playerId===seat),wins:s.data.sectorSettlements.winsByPlayerId[seat],traces:v.selfState.traceCounts,
  projectedFinal:v.publicState.players.find(q=>q.playerId===seat).finalScore};
}

const data=load('randomizer/game/data'),cards=load('randomizer/game/cards/deck'),effects=load('randomizer/game/cards/effects'), amiba=load('randomizer/game/aliens/amiba');
const l=load('randomizer/game/ai/local-decision-plans');
const original=read(process.env.SETI_YELLOW_WITNESS),known=new Set();
function q(){
 const e=save(),s=e.session?.session?.workingState||JSON.parse(e.committedState),p=s.players.players.find(q=>q.id===seat);
 return {e,s,p};
}
function actFirst(family){const a=menu().find(a=>a.family===family);assert(a);return act(a);}
function visible(){
 const {s,p}=q();
 return {wallet:p.resources,knownHand:p.hand.map(c=>known.has(c.id)?c.cardId:'opaque'),
  reserved:p.reservedCards.map(c=>[c.cardId,c.cardEffectState]),symbols:s.aliens.amiba.symbolSlots,
  blue:amiba.listSymbolsInRegion(s.aliens,'blue').map(v=>[v.slotId,v.reward]),display:s.aliens.amiba.displayedCardIndex,
  turn:s.turn.turnNumber};
}
try{
 restore(base);const before=q();
 for(const c of [...before.p.hand,...before.p.reservedCards,...before.s.cards.publicCards.filter(Boolean)])known.add(c.id);
 act(menu().find(a=>a.family==='play_card'&&a.summary==='amiba_3.webp'));
 const pending=save(),rows=[];
 for(const x of menu()){
  restore(pending);act(x);
  const reward=visible(),atRemoval=save();
  if(!q().e.session&&menu().some(a=>a.family==='end_turn'))actFirst('end_turn');
  const endRemoval=save(),atStart=visible();
  if(!menu().some(a=>a.family==='play_card'&&a.summary==='amiba_0.webp')){
   rows.push({removal:x,reward,atStart,atRemoval,endRemoval});continue;
  }
  const plays=original.accepted.slice(1,8).map(r=>r.action),states=[];
  for(const a of plays){
   const actual=menu().find(v=>v.actionId===a.actionId);
   if(!actual)break;
   act(actual);
   states.push(visible());
  }
  const {s,p,e}=q(),copy=structuredClone(s),own=copy.players.players.find(v=>v.id===seat);
  own.hand=own.hand.map(c=>known.has(c.id)?c:{hidden:true,faceUp:false});
  const knownTech=(id,stack)=>stack?.bonusIndex===before.s.tech.stacks[id].bonusIndex&&!stack.bonusHidden;
  const quote=states.length===plays.length&&l.quoteReadyAnalysisFunding({state:copy,seatId:seat,knownCards:known,knownTech,knownAlienDisplay:before.s.aliens.amiba.displayedCardIndex});
  const finalData={pool:p.resources.availableData,comp:data.listComputerPlacedTokens(p).length};
  rows.push({removal:x,reward,atStart,atRemoval,endRemoval,states,quote,finalData,afterPreparation:e});
 }
 restore(base);
 fs.writeFileSync(out,JSON.stringify({source:base,pending,rows,rootAndRngRestored:true},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();}
