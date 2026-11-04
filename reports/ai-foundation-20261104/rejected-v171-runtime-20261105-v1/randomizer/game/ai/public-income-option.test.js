'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const values=require('./state-value'),demand=require('./resource-demand'),rules=require('../rule-composition'),{createAnalysisPort}=require('./analysis-port');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation');
const read=p=>JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../'+p))),folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/',reference=read(folder+'public-income-option-native-20261105-v1.json'),controls=read(reference.source);
const seed=JSON.parse(controls.plans[0].rootEnvelope.committedState).meta.seed,seatId='player-white',k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(controls.plans[0].rootEnvelope).ok);const original=c.lifecycle.save().envelope,observe=()=>c.projection({role:'player',playerId:seatId}).state,rootObservation=observe(),knownAtRoot=new Set([...rootObservation.selfState.hand,...rootObservation.publicState.board.publicCards].filter(Boolean).map(c=>c.id));let nativeInputs=0,stablePrefixes=0,swapInputs=0;
const legal=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
function submit(id){const d=c.inspect().session?.decision,a=legal().find(a=>a.actionId===id);assert(a);const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));nativeInputs++;}
function near(a,b){assert(Math.abs(a-b)<1e-12,`${a} != ${b}`);}
try{
 for(let n=0;n<controls.plans.length;n++){
  const plan=controls.plans[n],expected=reference.rows[n];assert(c.lifecycle.restore(plan.rootEnvelope).ok);
  for(let i=0;i<plan.steps.length;i++){
   submit(plan.steps[i].actionId);const row=expected.stablePrefixes.find(p=>p.inputs===i+1);if(!row)continue;
   const observation=observe(),masked=rules.sanitizeHiddenInformationObservation(rootObservation,observation,{code:'hidden_card_reveal'}),known=values.evaluateStateValue(observation,seatId),hidden=values.evaluateStateValue(masked,seatId);near(known.total,row.known.augmented);near(hidden.total,row.masked.augmented);stablePrefixes++;
   const envelope=c.lifecycle.save().envelope,state=JSON.parse(envelope.committedState),p=state.players.players.find(p=>p.id===seatId);near(demand.planningCapital(state,p),known.components.handPotential+known.components.researchPotential+known.components.probePotential+known.components.analysisPotential+known.components.researchIncomePotential+known.components.dataPotential);
   if(p.hand.every(card=>knownAtRoot.has(card.id))){
    const hiddenSlots=state.cards.publicCards.flatMap((card,index)=>card&&!knownAtRoot.has(card.id)?[index]:[]),planning={...state,cards:{...state.cards,publicCards:state.cards.publicCards.map(card=>card&&knownAtRoot.has(card.id)?card:null),unknownPublicSlotIndices:hiddenSlots}};
    near(demand.planningCapital(planning,p),hidden.components.handPotential+hidden.components.researchPotential+hidden.components.probePotential+hidden.components.analysisPotential+hidden.components.researchIncomePotential+hidden.components.dataPotential);
   }
   if(i===4&&plan.incomeCode===0&&!plan.useSwap){
    const before=c.lifecycle.save().envelope;
    for(let step=0;step<3;step++){
     const snapshot=c.lifecycle.save().envelope,port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});port.setResourcePlanning(true);port.setCardPickPlanning(true);let id;
     try{const root=port.openRoot(),policy=port.cardPickSpec(root);assert(policy);id=policy.selectedActionId;const a=legal().find(a=>a.actionId===id);assert(a);if(step===0){assert.equal(a.family,'industry');assert.equal(policy.companySwap.reason,'realize-known-income-funding-option');assert.deepEqual(policy.companySwap.discardIds,['card-18-0']);}else assert.equal(a.target.cardInstanceId,step===1?'card-18-0':'card-41-0');assert.deepEqual(c.lifecycle.save().envelope,snapshot);}finally{port.close();}
     submit(id);swapInputs++;
    }
    const swapped=observe(),actor=swapped.publicState.players.find(p=>p.playerId===seatId);assert.equal(swapped.selfState.companyState.roundMarkRound,swapped.publicState.roundNumber);near(values.evaluateStateValue(swapped,seatId).total,65.5);assert(c.lifecycle.restore(before).ok);assert.deepEqual(c.lifecycle.save().envelope,before);
   }
  }
  assert.deepEqual(c.lifecycle.save().envelope,plan.endpointEnvelope);
 }
 const {searchDecision}=require('./decision-search'),agent=require('./search-agent'),searchControls=[];
 for(const code of [0,1,2]){
  const plan=controls.plans.find(p=>p.incomeCode===code&&!p.useSwap);assert(c.lifecycle.restore(plan.rootEnvelope).ok);assert.deepEqual(observe(),rootObservation);
  for(const proofsOff of code===0?[false,true]:[false]){
   const before=c.lifecycle.save().envelope,port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
   try{const root=port.openRoot(),evaluate=values.createStateValueEvaluator(seatId),proxy=proofsOff?{...port,turnTailSummary:()=>null,incomePlanSummary:()=>null}:port,result=searchDecision({port:proxy,root,evaluate,...agent.OPTIONS,modelKey:evaluate.modelKey,budget:agent.BUDGET});
    assert(result.complete);assert.deepEqual(result.unresolved,[]);assert.equal(root.legalActions.find(a=>a.actionId===result.actionId).family,'orbit');near(result.value,64.5+62/182);assert.deepEqual(c.lifecycle.save().envelope,before);searchControls.push({incomeCode:code,proofsOff,nativeInputs:result.diagnostics.nativeExecutions,value:result.value,actionId:result.actionId});
   }finally{port.close();}
  }
 }
 assert.equal(nativeInputs,108);assert.equal(swapInputs,3);assert(c.lifecycle.restore(original).ok);assert.deepEqual(c.lifecycle.save().envelope,original);console.log(JSON.stringify({publicIncomeOption:'passed',nativeInputs,stablePrefixes,searchControls,committedSwapColdRecovery:3,knownCreditValue:65.5,unknownExpectedValue:64.5+62/182,rootAndRngRestored:true}));
}finally{c.dispose();}
