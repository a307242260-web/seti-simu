'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const values=require('../randomizer/game/ai/state-value'),effects=require('../randomizer/game/cards/effects');
const F='reports/ai-foundation-20261105/third-round-teacher-v1/';
const source=F+'v262-standard-r3-native-verification-prefix-20261106-v1.checkpoint.json';
const out=F+'v262-orange-choice-native-control-20261106-v1.json';
assert(!fs.existsSync(out),'Do not repeat an existing control');
const original=JSON.parse(fs.readFileSync(source)).prefixes['147'];
const committed=JSON.parse(original.committedState),seed=committed.meta.seed,seat='player-white';
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
k.newGame({seed});const c=k.composition;
const result={scope:'Exact actual V262 input147 Native root. Compare orange1 and its recorded fixed public-card pick against orange3, then the same Amiba1 orange2 reward and next own turn. From the obtained known B14 hand compare immediate play with 2C to 1E preparation. No AI search, arbitrary menu choice, future card prediction or autonomous game. Each branch stops after its stated fixed inputs; any pending menu is retained rather than silently resolved.',source,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),sourceCommit:'2055cd4f2cba4dbc2fee8433c81cd16f9276cd72',nativeInputLimit:24,nativeInputs:0,newSearchCalls:0,newAutonomousRuns:0,branches:{}};
const save=()=>fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
const envelope=()=>c.lifecycle.save().envelope;
const state=()=>{const e=envelope();return e.session?.session?.workingState||JSON.parse(e.committedState);};
const menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
function inspect(){
 const e=envelope(),s=state(),p=s.players.players.find(p=>p.id===seat),v=values.evaluateStateValue(c.projection({role:'player',playerId:seat}).state,seat);
 return {resources:p.resources,income:p.income,hand:p.hand.map(card=>({id:card.id,cardId:card.cardId,cost:effects.getCardPlayCost(card),effects:effects.buildPlayEffects(card)})),tech:p.techState,data:p.dataState,reserved:p.reservedCards.map(card=>({id:card.id,cardId:card.cardId,cardEffectState:card.cardEffectState})),ownPieces:s.pieces.rockets.filter(r=>r.playerId===seat),mainActionCompleted:p.mainActionCompleted,round:s.turn.roundNumber,actor:s.turn.currentPlayerId,value:v.total,components:v.components,menu:menu(),pendingSession:Boolean(e.session)};
}
function restore(e){assert(c.lifecycle.restore(e).ok);assert.deepEqual(envelope(),e);}
function step(b,spec){
 const d=c.inspect().session?.decision,actions=menu();
 const candidates=actions.filter(a=>(!spec.actionId||a.actionId===spec.actionId)&&(!spec.family||a.family===spec.family)&&Object.entries(spec.target||{}).every(([key,value])=>a.target?.[key]===value));
 assert.equal(candidates.length,1,JSON.stringify({spec,actions}));assert(result.nativeInputs<result.nativeInputLimit);
 const a=candidates[0],r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));result.nativeInputs++;b.steps.push(a);b.after=inspect();save();
}
try{
 restore(original);result.before=inspect();save();
 let orange1End;
 for(const tileId of ['orange1','orange3']){
  restore(original);const b={steps:[]};result.branches[tileId]=b;
  step(b,{family:'choose_target',target:{tileId}});
  if(tileId==='orange1')step(b,{actionId:'choose_card:8930efbf',target:{cardInstanceId:'card-50-0'}});
  step(b,{family:'accept_optional_effect',target:{ruleId:'amiba1-orange-tech'}});
  step(b,{family:'choose_target',target:{choiceId:'symbol:orange_2'}});
  step(b,{family:'end_turn'});
  assert(!b.after.pendingSession);assert.equal(b.after.actor,seat);assert.equal(b.after.round,3);
  b.envelope=envelope();if(tileId==='orange1')orange1End=b.envelope;
  restore(original);b.rootAndRngRestored=true;save();
 }
 for(const funded of [false,true]){
  restore(orange1End);const name=funded?'orange1B14WithEnergy':'orange1B14Direct',b={steps:[],before:inspect()};result.branches[name]=b;
  assert(b.before.hand.some(c=>c.id==='card-50-0'&&c.cardId==='b_14.webp'));
  if(funded)step(b,{family:'quick_trade',target:{tradeId:'credits-for-energy'}});
  step(b,{family:'play_card',target:{cardInstanceId:'card-50-0'}});
  b.envelope=envelope();restore(original);b.rootAndRngRestored=true;save();
 }
 assert.deepEqual(envelope(),original);result.rootAndRngRestored=true;save();
 console.log(JSON.stringify({out,nativeInputs:result.nativeInputs,branches:Object.fromEntries(Object.entries(result.branches).map(([name,b])=>[name,{steps:b.steps.length,resources:b.after.resources,hand:b.after.hand.map(c=>c.cardId),ownPieces:b.after.ownPieces,value:b.after.value,pending:b.after.pendingSession,menu:b.after.pendingSession?b.after.menu.map(a=>({family:a.family,target:a.target})):[]}]))}));
}finally{c.dispose();}
