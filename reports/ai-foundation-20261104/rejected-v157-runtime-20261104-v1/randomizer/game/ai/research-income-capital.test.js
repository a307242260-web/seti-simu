'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const values=require('./state-value'),probe=require('./probe-capital'),demand=require('./resource-demand'),data=require('../data'),cards=require('../cards/deck'),tech=require('../tech/resolver');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation'),rules=require('../rule-composition');
const {createAnalysisPort}=require('./analysis-port'),{searchDecision}=require('./decision-search'),agent=require('./search-agent');
const read=p=>JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../'+p)));
const native=read('reports/ai-foundation-20261104/two-rounds-teacher-v2/v152-research-income-native-controls-20261104-v2.json'),w=read(native.source),seed=read(w.fixture).source.seed,seatId='player-white';
assert.equal(native.status,'complete');
function control(spec){
 const s=JSON.parse(w.freeFirstTurn.envelope.committedState),p=s.players.players.find(p=>p.id===seatId);s.turn.roundNumber=spec.round;s.turn.currentPlayerId=seatId;
 Object.assign(p.resources,{credits:spec.credits,energy:spec.energy,publicity:spec.publicity});for(const k of Object.keys(p.blueBonusResources||{}))p.blueBonusResources[k]=Math.min(p.blueBonusResources[k],p.resources[k]);
 while(p.dataState.poolTokens.length>spec.stock){p.dataState.poolTokens.pop();p.dataState.discardedCount++;}p.resources.availableData=p.dataState.poolTokens.length;
 if(spec.onlyIncomeCode!=null){const zones=[s.cards.publicCards,s.cards.discardPile,...Object.values(s.cards.passReservePiles)],card=zones.flat().find(c=>c&&cards.getIncomeCodeForCard(c)===spec.onlyIncomeCode),zone=zones.find(z=>z.some(c=>c?.id===card.id)),at=zone.findIndex(c=>c?.id===card.id);zone[at]=s.cards.publicCards[0];s.cards.publicCards[0]=card;s.cards.discardPile.push(...s.cards.publicCards.slice(1).filter(Boolean));s.cards.publicCards=[card,null,null];}
 return s;
}
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition,legal=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});let nativeInputs=0,matchedPlans=0,funded=0;
function submit(a){assert(a);const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));nativeInputs++;}
try{
 for(const row of native.rows){const s=control(row.spec),p=s.players.players.find(p=>p.id===seatId),unchanged=JSON.stringify(s),facts={...probe.factsFromState(s,p),supply:s.tech,researchCost:tech.getResearchPublicityCost(p),computerSlots:data.listComputerPlacedTokens(p).map(t=>t.placementSlot),reservedCards:p.reservedCards},capital=values.purposeCapital(facts),q=capital.researchIncomePlan;
  assert.equal(q.value,row.netGain);assert.equal(q.selected?.tileId,row.selected?.tileId);assert.equal(q.selected?.incomeCardId,row.selected?.incomeCardId);assert.equal(demand.planningCapital(s,p),capital.total);assert.equal(JSON.stringify(s),unchanged);
  for(const plan of q.candidates||[]){const actual=row.nativePlans.find(n=>n.tileId===plan.tileId&&n.blueSlot===plan.blueSlot&&n.incomeCardId===plan.incomeCardId);assert(actual);assert.equal(plan.netGain,actual.netGain);matchedPlans++;}
  const e={...w.freeFirstTurn.envelope,committedState:JSON.stringify(s)},restored=c.lifecycle.restore(e);assert(restored.ok,JSON.stringify(restored));const original=c.lifecycle.save().envelope,view=c.projection({role:'player',playerId:seatId}).state,before=values.evaluateStateValue(view,seatId);
  assert.equal(before.components.researchIncomePotential,q.value);assert.equal(before.components.handPotential+before.components.researchPotential+before.components.probePotential+before.components.analysisPotential+before.components.researchIncomePotential,capital.total);
  if(!q.selected)continue;funded++;const plan=q.selected;
  submit(legal().find(a=>a.family==='research_tech'));submit(legal().find(a=>a.target?.tileId===plan.tileId&&(a.target.blueSlot??null)===plan.blueSlot));submit(legal().find(a=>a.family==='choose_card'&&a.target?.cardInstanceId===plan.incomeCardId));
  const placements=[1,2,3,4].filter(slot=>!facts.computerSlots.includes(slot)).length;for(let n=0;n<placements;n++){submit(legal().find(a=>a.family==='place_data'));submit(legal().find(a=>a.target?.target==='computer'));}
  submit(legal().find(a=>a.family==='choose_card'&&a.target?.cardInstanceId===plan.incomeCardId));assert(!c.inspect().session);
  const after=values.evaluateStateValue(rules.sanitizeHiddenInformationObservation(view,c.projection({role:'player',playerId:seatId}).state,{code:'hidden_research_income_control'}),seatId);
  assert.equal(after.total-(before.total-q.value),plan.netGain);assert.equal(after.components.researchIncomePotential,0);
  assert(c.lifecycle.restore(original).ok);assert.deepEqual(c.lifecycle.save().envelope,original);
 }
 assert.equal(matchedPlans,408);assert.equal(funded,66);
 for(const publicity of [5,7,12]){
  const s=control({round:1,credits:2,energy:1,publicity,stock:4}),p=s.players.players.find(p=>p.id===seatId);s.pieces.rockets=[];s.pieces.activeRocketId=null;p.mainActionCompleted=true;p.resources.score=10;
  const e={...w.freeFirstTurn.envelope,committedState:JSON.stringify(s)},restored=c.lifecycle.restore(e);assert(restored.ok,JSON.stringify(restored));const original=c.lifecycle.save().envelope,port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
  try{port.setResourcePlanning(true);port.setCardPickPlanning(true);const root=port.openRoot(),bound=port.postMainValueBound(root);assert(bound,'funded-income ceiling must be available for this quiet no-probe control');assert(bound.maximumResearchIncomeLinear>0,'post-main public/data rewards may activate the funded purpose');assert.equal(bound.maximumResearchAfterIncome>0,publicity===12);
   const evaluate=values.createStateValueEvaluator(seatId),result=searchDecision({port,root,evaluate,...agent.OPTIONS,modelKey:evaluate.modelKey,budget:{transitions:256,nodes:1024,frontier:256,milliseconds:5000}});assert(result.complete);assert(result.value<=evaluate(root.observation)+bound.maximumValueIncrease);assert.deepEqual(c.lifecycle.save().envelope,original);
  }finally{port.close();}
 }
 assert(c.lifecycle.restore(w.freeFirstTurn.envelope).ok);assert.deepEqual(c.lifecycle.save().envelope,w.freeFirstTurn.envelope);
 console.log(JSON.stringify({nativeScalarPlans:matchedPlans,nativeSelectedPaths:funded,nativeInputs,postMainFundingBounds:3,stateObservationParity:true,rootAndRngUnchanged:true}));
}finally{c.dispose();}
