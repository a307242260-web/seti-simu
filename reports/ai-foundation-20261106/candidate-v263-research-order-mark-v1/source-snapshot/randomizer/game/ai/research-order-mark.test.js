'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const values=require('./state-value'),probe=require('./probe-capital'),trigger=require('./research-trigger-capital'),effects=require('../cards/effects'),end=require('../end-game-scoring');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation');
const fixture=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../reports/ai-foundation-20261105/third-round-teacher-v1/v263-research-order-mark-native-fixture-20261106-v1.json'))),original=fixture.compositionEnvelope,state=JSON.parse(original.committedState),seatId='player-white',seed=state.meta.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
try{
 assert(c.lifecycle.restore(original).ok);const observation=c.projection({role:'player',playerId:seatId}).state,p=state.players.players.find(p=>p.id===seatId),facts={...probe.factsFromObservation(observation,seatId),supply:state.tech},wallet={resources:facts.player,income:facts.player.income,startingIncome:0},funding=values.researchFunding(facts,wallet);
 assert.equal(facts.player.score,64);assert.equal(facts.nextFinalMark.threshold,70);assert(facts.nextFinalMark.options.every(o=>o.currentValue===0));
 assert(funding.newFinalMark,'known completion can make C1 valuable even when every current unclaimed mark is worth zero');
 const context=trigger.describe(facts,wallet),gains=trigger.gains(context,values.DEFAULT_WEIGHTS);
 assert.deepEqual(gains.development(['orange1','blue4']),{scoreGain:4,completedTaskGain:1});
 assert.deepEqual(gains.development(['blue4']),{scoreGain:4,completedTaskGain:0});
 assert.equal(gains.development(['orange1','orange2']).completedTaskGain,0,'same color cannot consume the missing blue rule');
 assert.deepEqual(gains.outcome(['orange1','blue4']),{value:5,dataGain:0},'the existing greedy ledger prefers the known one-card quantity over half a point of data');
 const changed=structuredClone(context);changed.completionGroups[0].ruleIds.push('not-consumed');assert.equal(trigger.gains(changed,values.DEFAULT_WEIGHTS).development(['orange1','blue4']).completedTaskGain,0,'mutable completion inputs cannot reuse an older completed quote');
 const allRules={...facts,reservedCards:facts.reservedCards.map(card=>card.cardId==='amiba_1.webp'?{...card,cardEffectState:{...card.cardEffectState,consumedTriggerIds:[]}}:card)},three=trigger.describe(allRules,wallet);
 assert.equal(trigger.gains(three,values.DEFAULT_WEIGHTS).development(['orange1','blue4']).completedTaskGain,0,'a third unconsumed purple slot prevents completion');
 const supply={stacks:{orange1:state.tech.stacks.orange1,blue4:state.tech.stacks.blue4}},hand=p.hand.filter(card=>card.cardId==='b_101.webp'),params={hand,techState:p.techState,supply,round:3,publicity:6,researchCost:6};
 const joint=f=>values.sumValueParts([values.handCapital(hand,p.techState,supply,3,values.DEFAULT_WEIGHTS,f),values.researchCapital({...params,funding:f})]);
 assert.equal(joint(funding)-joint({...funding,newFinalMark:null}),4,'held-first order completes Amiba1 at the first70 crossing and earns C1 once');
 const paidOnly=f=>values.researchCapital({...params,hand:[],supply:{stacks:{blue4:supply.stacks.blue4}},funding:f});
 assert.equal(paidOnly(funding),paidOnly({...funding,newFinalMark:null}),'paid blue research crosses70 before orange completion and cannot claim the later4 points');
 for(const [name,b]of Object.entries(fixture.branches)){
  const s=JSON.parse(b.afterResearchEnvelope.committedState),owner=s.players.players.find(p=>p.id===seatId),mark=Object.values(s.finalScoring.tiles).flatMap(t=>t.marks).find(m=>m.playerId===seatId&&m.threshold===70),formula=end.getFormulaId(mark.tileId,s.finalScoring.tileVariants[mark.tileId]),actual=end.getFormulaBaseValue(formula,owner,{...s,cardEffects:effects})*end.getSlotMultiplier(formula,mark.slotIndex);
  assert.equal(actual,name==='heldOrange1-paidBlue4'?4:0);assert.equal(owner.completedTaskCount,1);assert(b.rootAndRngRestored);
 }
 assert.equal(values.researchFunding({...facts,uncontestedRound:false},wallet).newFinalMark,null);
 assert.equal(values.researchFunding({...facts,pendingNativeEffects:true},wallet).newFinalMark,null);
 assert.equal(values.researchFunding({...facts,pendingCardTriggers:['unsettled']},wallet).newFinalMark,null);
 const partial={...wallet,resources:{credits:7,energy:1,publicity:6,availableData:0}};assert.equal(values.researchFunding(facts,partial).newFinalMark,null,'a balances-only wallet cannot manufacture a score ledger');
 assert.deepEqual(c.lifecycle.save().envelope,original);console.log(JSON.stringify({heldFirstCompletionMark:4,paidFirstMark:0,nativeOrdersShareRoot:true,noDoubleCompletionOrFutureFunding:true,rootAndRngUnchanged:true}));
}finally{c.dispose();}
