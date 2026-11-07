'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const cards=require('../randomizer/game/cards/effects'),deck=require('../randomizer/game/cards/deck'),data=require('../randomizer/game/data'),scoring=require('../randomizer/game/end-game-scoring');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),{createStateValueEvaluator}=require('../randomizer/game/ai/state-value');
const {searchDecision}=require('../randomizer/game/ai/decision-search'),{BUDGET,OPTIONS}=require('../randomizer/game/ai/search-agent');
const [source,early,late,output]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p)),q=read(source);
const path=read(early).rows[0].path,tail=read(late).rows[0].path;
const seed='seti-free-analyze-v1',seat='player-white',n=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,
 trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});n.newGame({seed});
const c=n.composition,save=()=>c.lifecycle.save().envelope;
let currentRoot=q.env;
const restore=()=>{assert(c.lifecycle.restore(currentRoot).ok);assert.deepEqual(save(),currentRoot);};
function swapUnknown(offset){
 const e=structuredClone(q.env);
 const adjust=s=>{const a=s?.aliens?.amiba;if(!a)return;assert.equal(a.displayedCardIndex,5);
  const cards=a.cardDeck;[cards[0],cards[offset]]=[cards[offset],cards[0]];
 };
 const s=JSON.parse(e.committedState);adjust(s);e.committedState=JSON.stringify(s);
 const session=e.session.session;
 for(const s of [session.baseState,session.workingState,session.committedState,...session.undoFrames.map(f=>f.stateBefore)])adjust(s);
 return e;
}
const list=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
function step(id){
 const d=c.inspect().session?.decision,action=list().find(a=>a.actionId===id);assert(action,JSON.stringify({id,menu:list().map(x=>[x.actionId,x.summary])}));
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:action})
  :action.phase==='quick'?c.inputPort.submitQuickAction(action):c.inputPort.submitAction(action);assert(r.ok);
 return{id,family:action.family,target:action.target,summary:action.summary};
}
function assets(){
 const e=save(),s=JSON.parse(e.committedState),p=s.players.players.find(p=>p.id===seat);
 return {e,wallet:p.resources,income:p.income,hand:p.hand.map(c=>[c.id,c.cardId]),reserved:p.reservedCards.map(c=>[c.id,c.cardId]),tech:p.techState,
  turn:s.turn.turnNumber,placed:data.listComputerPlacedTokens(p).map(t=>t.placementSlot),blue:data.listBlueBonusPlacedTokens(p).map(t=>t.blueSlot),
  score:scoring.computePlayerFinalScore({...s,players:s.players.players,cardEffects:cards,getCardTypeCode:c=>cards.getRuntimeCardTypeCode(c,cards.getCardModel(c)?.cardType)},p),menu:list().map(x=>[x.actionId,x.family,x.summary])};
}
function apply(items){return items.map(x=>step(x.id));}
try{
 const worlds=[];
 for(let offset=0;offset<q.env.session.session.workingState.aliens.amiba.cardDeck.length;offset++){
 currentRoot=swapUnknown(offset);restore();
 const port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0}),evaluate=createStateValueEvaluator(seat);
 let choiceResult;try{const at=performance.now(),root=port.openRoot(),search=searchDecision({port,root,evaluate,budget:BUDGET,modelKey:evaluate.modelKey,...OPTIONS});
  const target=root.legalActions.find(a=>a.actionId===search.actionId)?.target;
  assert(search.complete&&!search.unresolved.length&&search.diagnostics.nativeExecutions<=256&&performance.now()-at<=600);
  assert.equal(target.position,3);assert.equal(search.value,169);
  choiceResult={ms:performance.now()-at,target,native:search.diagnostics.nativeExecutions,search};
  assert.deepEqual(save(),currentRoot);
 }finally{port.close();}
 const rows={};
 for(const name of ['pink2','pink3']){
  restore();
  const trace=q.choices.find(z=>z.target?.position===Number(name.at(-1)));
  const choice=list().find(x=>x.target.choiceId===trace.target.choiceId);
  const steps=name==='pink3'?apply(path.slice(31,34)):[step(choice.actionId),step(path[33].id)];
  const afterTrace=assets();
  steps.push(...apply(path.slice(34,49)));
  const beforeAnalyzePrep=assets();
  steps.push(...apply(tail.slice(4,6)));
  const beforeAnalyze=assets();
  steps.push(...apply(tail.slice(7,9)));
  const offered=list().find(a=>a.target?.source==='display');
  assert(offered);steps.push(step(offered.actionId));
  const afterAnalyze=assets();
  // Spend only now-known data corners needed for the fourth computer slot.
  // Each world retains the same public DLC25 cash/electric decision before the reveal.
  let pool=afterAnalyze.wallet.availableData;
  for(const [id] of afterAnalyze.hand){
   const card=JSON.parse(save().committedState).players.players.find(p=>p.id===seat).hand.find(c=>c.id===id);
   if(pool>=4||!deck.getDiscardActionRewardForCard(card)?.dataCount)continue;
   const a=list().find(a=>a.family==='card_corner'&&a.target.cardInstanceId===id);
   steps.push(step(a.actionId));pool=assets().wallet.availableData;
  }
  for(let i=0;i<Math.min(4,pool);i++)steps.push(step(tail[12].id),step(tail[13].id));
  if(pool>=4)steps.push(step(tail[20].id));
  steps.push(step(tail.at(-1).id));
  const boundary=assets();
  restore();for(const x of steps)step(x.id);assert.deepEqual(save(),boundary.e);
  rows[name]={steps,afterTrace,beforeAnalyzePrep,beforeAnalyze,afterAnalyze,boundary,independentReplayExact:true};
 }
 worlds.push({offset,source:currentRoot,choiceResult,rows});
 }
 currentRoot=q.env;restore();
 fs.writeFileSync(output,JSON.stringify({worlds,rootRestored:true},null,2)+'\n',{flag:'wx'});
 for(const w of worlds)for(const [name,row] of Object.entries(w.rows))console.log(w.offset,name,row.afterAnalyze.hand.map(x=>x[1]),
   {score:row.boundary.wallet.score,energyIncome:row.boundary.income.energy,energy:row.boundary.wallet.energy,hand:row.boundary.hand.map(x=>x[1]),placed:row.boundary.placed,folded:row.boundary.score.totalScore});
}finally{c.dispose();}
