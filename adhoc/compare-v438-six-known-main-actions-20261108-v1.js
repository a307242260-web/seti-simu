'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const load=n=>require(path.resolve(n)),read=p=>JSON.parse(fs.readFileSync(p));
const {createSeededRandom}=load('randomizer/game/random');
const {createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=load('randomizer/app/rule-observation');
const {quoteReadyAnalysisFunding}=load('randomizer/game/ai/local-decision-plans');
const [source,reverse,official,out]=process.argv.slice(2),ref=read(source),base=ref.compositionEnvelope,seat=ref.seatId;
const root=JSON.parse(base.committedState),seed=root.meta.seed,owner=s=>s.players.players.find(p=>p.id===seat);
const native=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});
native.newGame({seed});
const c=native.composition,save=()=>c.lifecycle.save().envelope,menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const known=new Set([...owner(root).hand,...owner(root).reservedCards,...root.cards.publicCards].map(c=>c.id));
function restore(e){assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);}
function act(w){
 const d=c.inspect().session?.decision,a=menu().find(x=>x.actionId===w.actionId&&x.actorId===seat);
 assert(a,w.summary);assert.deepEqual(a.target,w.target);
 const result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
  :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(result.ok,JSON.stringify(result));return a;
}
function choose(f,pred=()=>true){const a=menu().find(x=>x.family===f&&pred(x.target,x));assert(a,JSON.stringify(menu().map(x=>x.target)));return act(a);}
function view(e=save()){
 const s=e.session?.session?.workingState||JSON.parse(e.committedState),p=owner(s),v=c.projection({role:'player',playerId:seat}).state;
 const quoteState=structuredClone(s);
 owner(quoteState).hand=owner(quoteState).hand.map(c=>known.has(c.id)?c:{hidden:true,faceUp:false});
 const knownTech=(id,stack)=>stack?.bonusIndex===root.tech.stacks[id].bonusIndex&&!stack.bonusHidden;
 const quote=quoteReadyAnalysisFunding({state:quoteState,seatId:seat,knownCards:known,knownTech,
  knownAlienDisplay:root.aliens.amiba.displayedCardIndex});
 return {round:s.turn.roundNumber,turn:s.turn.turnNumber,wallet:p.resources,income:p.income,
  hand:p.hand.map(c=>known.has(c.id)?c.cardId:'opaque'),computer:p.dataState.placedTokens.filter(t=>t.placementKind==='computer').map(t=>t.placementSlot),
  traces:v.selfState.traceCounts,researchDisplay:s.aliens.amiba.displayedCardIndex,winCount:(s.data.sectorSettlements.winsByPlayerId[seat]||[]).length,
  knownFunding:quote,tech:p.techState,scoreFromOwnedAssets:v.publicState.players.find(p=>p.playerId===seat).finalScore};
}
try{
 restore(base);
 const rows=[];
 for(const [mode,fixture,endCount] of [['A0-first',read(reverse),6],['A3-blue-first',read(official),6]]){
  restore(base);const steps=[],rounds=[],inputList=[...fixture.fixed,...fixture.accepted.map(a=>a.action)];
  const adjusted=[];
  for(const w of inputList){
   let a;
   if(mode==='A0-first'&&w.target?.choiceId?.startsWith('income:')&&w.target.cardInstanceId!=='alien-amiba-1-2'){
    a=choose('choose_card',t=>t.cardInstanceId==='alien-amiba-1-2');
   }else if(mode==='A0-first'&&w.family==='choose_card'&&w.target.nebulaId==='sector-3-a'){
    a=choose('choose_card',t=>t.cardInstanceId==='card-61-0'&&t.nebulaId==='sector-3-a');
   }else if(w.family==='choose_card'&&w.target.source==='display'){
    a=choose('choose_card',t=>t.source==='display');
   }else{
    a=act(w);
   }
   if(a.actionId!==w.actionId)adjusted.push({wanted:w,actual:a});
   const v=view();
   steps.push({action:a,view:v});
   if(v.turn===root.turn.turnNumber+rounds.length+1)rounds.push({asset:v,step:steps.length,envelope:save()});
   if(rounds.length===endCount)break;
  }
  assert.equal(rounds.length,endCount);
  const end=save();restore(base);steps.forEach(x=>act(x.action));assert.deepEqual(save(),end);
  rows.push({mode,rounds,steps,adjusted,end});
 }
 restore(base);
 fs.writeFileSync(out,JSON.stringify({scope:'Matched six main actions; do not use identity of root-hidden draws. Fixed witness, not autonomous or new formal experiment.',source:base,rows,rootAndRngRestored:true},null,2)+'\n',{flag:'wx'});
 for(const x of rows){
  for(const {asset:v,step} of x.rounds){
   const w=v.wallet;
   console.log(JSON.stringify({mode:x.mode,turn:v.turn,step,score:w.score,credits:w.credits,energy:w.energy,publicity:w.publicity,pool:w.availableData,
    hand:v.hand,computer:v.computer,income:[v.income.credits,v.income.energy],wins:v.winCount,tech:Object.keys(v.tech.ownedTiles),owned:v.scoreFromOwnedAssets}));
  }
 }
}finally{c.dispose();}
