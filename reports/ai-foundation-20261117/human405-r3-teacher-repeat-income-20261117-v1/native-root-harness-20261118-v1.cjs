'use strict';
const fs=require('node:fs'),z=require('node:zlib'),path=require('node:path'),assert=require('node:assert/strict');
const load=n=>require(path.resolve(n)),read=n=>JSON.parse(fs.readFileSync(n));
const {createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=load('randomizer/app/rule-observation');
const {createSeededRandom}=load('randomizer/game/random'),data=load('randomizer/game/data'),cards=load('randomizer/game/cards/deck');
const {passiveAgent}=load('tools/research-human405-round1'),{createAnalysisPort}=load('randomizer/game/ai/analysis-port'),{createSearchAgent}=load('randomizer/game/ai/search-agent');
const seat='player-white';
function open(envelope,opponents){
 const seed=JSON.parse(envelope.committedState).meta.seed;
 const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(state,viewer,projectionContext)=>buildRuleObservation(state,seed,viewer?.playerId||null,[],
   {cheap:viewer?.cheap===true,valueOnly:viewer?.valueOnly===true,trustedCommitted:projectionContext?.trustedCommitted===true, trustedFrozenWorking: projectionContext?.trustedFrozenWorking === true})});
 k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope;
 const state=()=>{const e=save();return e.session?.session?.workingState||JSON.parse(e.committedState)};
 const player=()=>state().players.players.find(p=>p.id===seat),owner=id=>c.projection({role:'player',playerId:id}).state;
 const menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
 function facts(){
  const t=state(),p=t.players.players.find(p=>p.id===seat),v=owner(seat);
  return {round:t.turn.roundNumber,turn:t.turn.turnNumber,main:p.mainActionCompleted,wallet:p.resources,income:p.income,
   hand:p.hand.map(h=>[h.id,h.cardId]),reserved:p.reservedCards.map(h=>h.cardId),tech:p.techState,taskCount:p.completedTaskCount,
   market:t.cards.publicCards.map(h=>h&&[h.id,h.cardId]),computer:data.listComputerPlacedTokens(p).map(x=>x.placementSlot),
   blue:data.listBlueBonusPlacedTokens(p).map(x=>x.blueSlot),probes:t.pieces.rockets.filter(q=>q.playerId===seat),traces:v.selfState.traceCounts,
   alienDisplay:v.publicState.board.aliens.amibaTraces?.displayedCardIndex,final:v.publicState.players.find(q=>q.playerId===seat).finalScore,
   wins:v.selfState.sectorWins,rng:t.meta.rngState};
 }
 const restore=e=>{const restored=c.lifecycle.restore(e);assert(restored.ok,JSON.stringify(restored));assert.deepEqual(save(),e);};
 let lastResult=null;
 function apply(action){
  const d=c.inspect().session?.decision,a=menu().find(x=>x.actionId===action.actionId&&x.actorId===action.actorId);
  assert(a,action.summary);assert.deepEqual(a.target,action.target);
  const v=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
   :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
  assert(v.ok,JSON.stringify(v));lastResult=v;return a;
 }
 function act(family,predicate=()=>true){
  const a=menu().find(x=>x.family===family&&predicate(x));assert(a,JSON.stringify([family,menu().map(y=>[y.family,y.summary,y.target])]).slice(0,650));return apply(a);
 }
 const play=id=>act('play_card',a=>a.target.cardInstanceId===player().hand.find(h=>h.cardId===id)?.id);
 const corner=id=>act('card_corner',a=>a.target.cardInstanceId===player().hand.find(h=>h.cardId===id)?.id&&a.payload.kind==='resource');
 const pick=id=>{
  const i=state().cards.publicCards.findIndex(h=>h?.cardId===id);assert(i>=0,id);
  return act('choose_card',a=>a.target.cardInstanceId===state().cards.publicCards[i].id
    ||a.target.source==='public'&&a.target.slotIndex===i);
 };
 function swap(out,into){
  const id=player().hand.find(h=>h.cardId===out)?.id;
  return [act('industry',a=>a.target.abilityId==='deepspace_swap_cards'),act('choose_card',a=>a.target.cardInstanceId===id),pick(into)];
 }
 function advanceOpponents(accepted){
  for(let j=0;j<30;j++){
   const legalActions=menu(),id=legalActions[0]?.actorId;assert(id);
   if(id===seat)return;
   const r=passiveAgent(id,opponents).decide({legalActions,observation:owner(id)}),a=legalActions.find(a=>a.actionId===r.actionId);
   assert(a);accepted.push(apply(a));
  }
  throw Error('unclosed opponent sequence');
 }
 function automatic(checkpoint){
  const before=save(),actions=menu(),port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
  try{
   const agent=createSearchAgent({seatId:seat,analysisPort:port});if(checkpoint)agent.loadCheckpoint(checkpoint);
   const q=agent.decide({seatId:seat,legalActions:actions}).search,a=actions.find(x=>x.actionId===q.actionId);
   assert.deepEqual(save(),before);
   return {a,checkpoint:structuredClone(agent.createCheckpoint()),value:q.value,n:q.diagnostics.nativeExecutions,
    ms:q.rootAndSearchMilliseconds,complete:q.complete&&!q.unresolved.length,roots:q.roots,lines:q.lines,diagnostics:q.diagnostics,analysis:q.analysis};
  }finally{port.close();}
 }
 restore(envelope);
 return {c,save,state,player,owner,menu,facts,restore,apply,lastResult:()=>lastResult,act,play,corner,pick,swap,advanceOpponents,automatic,dispose:()=>c.dispose()};
}
module.exports={open,read,z,seat};
if(require.main===module){
 const [fixture,...commands]=process.argv.slice(2),e=read(fixture).compositionEnvelope,m=open(e);
 try{
  for(const cmd of commands){
   const [mode,filter]=cmd.split('=');
   if(mode==='play'){m.play(filter);continue;}
   if(mode==='corner'){m.corner(filter);continue;}
   if(mode==='pick'){m.pick(filter);continue;}
   if(mode==='swap'){m.swap(...filter.split(','));continue;}
   m.act(mode,a=>!filter||a.target.choiceId===filter||a.summary.includes(filter));
  }
  const f=m.facts();console.log(JSON.stringify({f,menu:m.menu().map(a=>[a.family,a.summary,a.target])}));
 }finally{m.dispose();}
}
