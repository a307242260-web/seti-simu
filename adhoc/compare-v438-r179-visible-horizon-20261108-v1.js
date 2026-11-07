'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const load=n=>require(path.resolve(n)),read=p=>JSON.parse(fs.readFileSync(p));
const {createSeededRandom}=load('randomizer/game/random');
const {createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=load('randomizer/app/rule-observation');
const {quoteReadyAnalysisFunding}=load('randomizer/game/ai/local-decision-plans');
const [source,reverse,prefix,out]=process.argv.slice(2),ref=read(source),base=ref.compositionEnvelope,seat=ref.seatId;
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
 restore(base);const rows=[];
 const witness=read(reverse),prefixes=read(prefix);
 assert.deepEqual(witness.origin,base);assert.deepEqual(prefixes.source,base);
 const reverseInputs=[...witness.fixed,...witness.accepted.slice(0,9).map(a=>a.action)];
 const reverseOrigin=view(),reverseStates=reverseInputs.map(a=>{act(a);return view();});
 rows.push({mode:'A0-first-blue-then-A3-orange',start:reverseOrigin,actions:reverseInputs,states:reverseStates,end:save()});
 for(const region of ['blue','orange']){
  const removals=prefixes.rows.filter(x=>x.removal.target.region===region);
  assert.equal(removals.length,1);
  const removal=removals[0];restore(base);
  const startActions=[choose('play_card',t=>t.cardInstanceId==='alien-amiba-3-3'),act(removal.removal),choose('end_turn')];
  assert.deepEqual(save(),removal.endRemoval);
  const a0=choose('play_card',t=>t.cardInstanceId==='alien-amiba-0-1'),pending=save(),symbols=menu();
  assert(symbols.length>0&&symbols.length<=6);
  for(const symbol of symbols){
   restore(pending);
   const controls=[...startActions,a0,act(symbol)],states=[view()];
   for(let i=0;i<2;i++){
    controls.push(choose('place_data'),choose('choose_target',t=>t.target==='computer'));states.push(view());
   }
   controls.push(choose('end_turn'));states.push(view());
   const end=save();restore(base);controls.forEach(act);assert.deepEqual(save(),end);
   rows.push({mode:'A3-first-'+region+'-then-A0',symbol:symbol.summary,actions:controls,states,end});
  }
 }
 restore(base);
 assert(rows.every(x=>x.states.at(-1).turn===root.turn.turnNumber+2));
 fs.writeFileSync(out,JSON.stringify({scope:'Matched two main actions, no identity for root-hidden draws, exact Native source/RNG restore',source:base,rows,rootAndRngRestored:true},null,2)+'\n',{flag:'wx'});
 for(const x of rows){
  const v=x.states.at(-1),w=v.wallet;
  console.log(JSON.stringify({mode:x.mode,symbol:x.symbol,score:w.score,credits:w.credits,energy:w.energy,publicity:w.publicity,pool:w.availableData,
   hand:v.hand,computer:v.computer,owned:v.scoreFromOwnedAssets,quote:v.knownFunding?.value??null}));
 }
}finally{c.dispose();}
