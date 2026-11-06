'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createAnalysisPort}=require('./analysis-port'),values=require('./state-value');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation');
const control=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../reports/ai-foundation-20261107/anonymous-data-continuation-v1/actual156-blue4-known-data-native-20261107-v1.json'))),root=control.root,seat='player-white',seed=JSON.parse(root.committedState).meta.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;
function open(){const p=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});p.setResourcePlanning(true);p.setCardPickPlanning(true);p.setMovementPlanning(true);p.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});return p;}
function variant(rotation){const e=structuredClone(root),committed=JSON.parse(e.committedState);for(const s of [committed,e.session?.session?.baseState,e.session?.session?.workingState].filter(Boolean)){
 const deck=s.cards.drawPileCardIds;s.cards.drawPileCardIds=[...deck.slice(rotation),...deck.slice(0,rotation)];
 const amiba=s.aliens.amiba;if(amiba?.cardDeck?.length){const a=amiba.cardDeck,known=amiba.initialConfiguration.cardDeck.length-a.length;amiba.cardDeck=[...a.slice(rotation%a.length),...a.slice(0,rotation%a.length)];amiba.initialConfiguration.cardDeck=[...amiba.initialConfiguration.cardDeck.slice(0,known),...amiba.cardDeck];}
 }e.committedState=JSON.stringify(committed);return e;}
const worlds=[];
try{
 for(let rotation=0;rotation<6;rotation++){
  const source=variant(rotation);assert(c.lifecycle.restore(source).ok);const before=c.lifecycle.save().envelope,p=open();
  try{
   let node=p.openRoot();node=p.expand(node,control.sequence[0]);
   // The recorded display9 is public. Use the Native blind alternative to
   // retain this test's two genuinely anonymous-card obligation.
   const blind=node.legalActions.find(a=>a.target.choiceId==='amiba:blind');assert(blind);node=p.expand(node,blind.actionId);
   assert.equal(node.status,'stable','two anonymous new cards must not stop the same known funded data plan');
   const observation=p.valueObservation(node),unknown=observation.selfState.hand.filter(card=>card.hidden);
   assert.equal(unknown.length,2);assert(unknown.every(card=>!card.id&&!card.cardId));assert.equal(values.evaluateStateValue(observation,seat).total,138);
   const spec=p.turnTailSummary(node,'blue-end-turn');assert(spec);assert.equal(spec.requiredNativeInputs,5);assert.equal(spec.netGain,2);
   assert.equal(values.sumValueParts([values.evaluateStateValue(observation,seat).total,spec.netGain]),control.prefixes.at(-1).maskedValue.total);
   const menu=node.legalActions,policy=p.resourceSpec(node),steps=[];
   assert.equal(policy.plans.length,1);assert.equal(policy.plans[0].goal.kind,'blue-data');
   for(let i=2;i<control.sequence.length-1;i++){
    const action=node.legalActions.find(a=>a.actionId===control.sequence[i]);assert(action);assert(['place_data','choose_target','end_turn'].includes(action.family));steps.push(action);
    node=p.expand(node,action.actionId);assert.deepEqual(values.evaluateStateValue(p.valueObservation(node),seat),control.prefixes[i].maskedValue,'same Native input and masked portfolio at every prefix');
   }
   assert.equal(node.status,'information-barrier');assert.equal(values.evaluateStateValue(p.valueObservation(node),seat).total,140);
   assert.equal(control.prefixes.at(-2).maskedValue.total,control.prefixes.at(-1).maskedValue.total,'the independently replayed native end leaves this value unchanged');
   worlds.push({policy,menu,spec,value:values.evaluateStateValue(p.valueObservation(node),seat),steps});assert.deepEqual(c.lifecycle.save().envelope,before);
  }finally{p.close();}
 }
 for(const world of worlds.slice(1))assert.deepEqual(world,worlds[0],'both hidden decks leave anonymous quantity, Native plan and value unchanged');
 for(const disabled of ['resource','movement']){
  assert(c.lifecycle.restore(root).ok);const before=c.lifecycle.save().envelope,p=open();try{if(disabled==='resource')p.setResourcePlanning(false);else p.setMovementPlanning(false);let n=p.openRoot();for(const id of control.sequence.slice(0,2))n=p.expand(n,id);assert.equal(n.status,'information-barrier');assert.deepEqual(c.lifecycle.save().envelope,before);}finally{p.close();}
 }
 assert(c.lifecycle.restore(root).ok);assert.deepEqual(c.lifecycle.save().envelope,root);
 console.log(JSON.stringify({anonymousKnownDataContinuation:'passed',anonymousCards:2,hiddenDeckWorlds:6,preparationNativeInputs:5,fullNativeControlInputs:7,before:138,after:140,unknownIdentityUsed:false,rootAndRngRestored:true,newAiQueries:0}));
}finally{c.dispose();}
