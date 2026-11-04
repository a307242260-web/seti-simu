'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation'),values=require('./state-value'),demand=require('./resource-demand'),probe=require('./probe-capital'),data=require('../data'),tech=require('../tech/resolver'),industry=require('../industry/passives'),{createAnalysisPort}=require('./analysis-port'),{searchDecision}=require('./decision-search'),agent=require('./search-agent');
const w=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../reports/ai-foundation-20261104/two-rounds-teacher-v2/v148-research-analysis-order-native-20261104-v1.json'))),seed=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../'+w.fixture))).source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
try{
 for(const row of [...w.rows].reverse()){
  const e=row.afterFirst.envelope;assert(c.lifecycle.restore(e).ok);const observation=c.projection({role:'player',playerId:'player-white'}).state,v=values.evaluateStateValue(observation,'player-white'),state=JSON.parse(e.committedState),p=state.players.players.find(p=>p.id==='player-white'),before=JSON.stringify(state);
  assert.equal(v.total,row.name==='research-first'?90:89.5,'ready analysis is a funded asset, not discarded when the turn ends');
  assert.equal(v.components.analysisPotential,row.name==='research-first'?8.5:0);
  assert.equal(demand.planningCapital(state,p),v.components.handPotential+v.components.researchPotential+v.components.probePotential+v.components.analysisPotential,'state plans and viewer-safe observations share the same capital');
  assert.equal(JSON.stringify(state),before);assert.deepEqual(c.lifecycle.save().envelope,e);
 }
 const nativeControls=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../reports/ai-foundation-20261104/two-rounds-teacher-v2/v149-ready-analysis-capital-native-controls-20261104-v1.json'))).rows;
 const source=w.rows.find(r=>r.name==='research-first').afterFirst.envelope,totals=new Map();let controls=0,funded=0,nativeInputs=0;
 const legal=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
 const submit=a=>{assert(a);const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));nativeInputs++;};
 const value=()=>values.evaluateStateValue(c.projection({role:'player',playerId:'player-white'}).state,'player-white');
 for(const company of ['deep-space','stratus'])for(const credits of [0,1,2,4])for(const energy of [0,1,2])for(const stock of [0,1,2,4])for(const publicity of [0,11]){
  const e=structuredClone(source),s=JSON.parse(e.committedState),p=s.players.players.find(p=>p.id==='player-white');if(company==='stratus')p.initialSelection.industry='层云核心';Object.assign(p.resources,{credits,energy,publicity});for(const k of Object.keys(p.blueBonusResources||{}))p.blueBonusResources[k]=Math.min(p.blueBonusResources[k],p.resources[k]);
  while(p.dataState.poolTokens.length>stock){p.dataState.poolTokens.pop();p.dataState.discardedCount++;}p.resources.availableData=p.dataState.poolTokens.length;while(p.resources.availableData<stock)assert(data.gainData(p,{root:s}).ok);
  e.committedState=JSON.stringify(s);assert(c.lifecycle.restore(e).ok);const original=c.lifecycle.save().envelope,before=value(),serialized=JSON.stringify(s),facts={...probe.factsFromState(s,p),supply:s.tech,researchCost:tech.getResearchPublicityCost(p),computerSlots:data.listComputerPlacedTokens(p).map(t=>t.placementSlot),reservedCards:p.reservedCards,analyzeEnergyCost:industry.canAnalyzeWithoutEnergy(p)?0:data.ANALYZE_ENERGY_COST},capital=values.purposeCapital(facts),q=capital.analysisPlan;
  assert.equal(JSON.stringify(s),serialized);assert.equal(demand.planningCapital(s,p),capital.total);assert.equal(before.components.analysisPotential,q.value);const witnessed=nativeControls.find(r=>r.industry===company&&r.credits===credits&&r.energy===energy&&r.stock===stock&&r.publicity===publicity);assert(witnessed);assert(q.value>=(witnessed.netGain||0),'must retain every independently native-verified ready-analysis/blue payoff');totals.set(JSON.stringify([company,credits,energy,stock,publicity]),before.total);controls++;
  if(!q.selected){assert.equal(q.reason,'analysis-not-funded');assert.equal(q.value,0);continue;}
  funded++;for(let n=0;n<q.selected.payment.energyPurchases;n++)submit(legal().find(a=>a.target?.tradeId==='credits-for-energy'));for(let n=0;n<q.selected.payment.creditPurchases;n++)submit(legal().find(a=>a.target?.tradeId==='energy-for-credit'));
  submit(legal().find(a=>a.family==='analyze'));submit(legal().find(a=>a.target?.alienSlotId===q.selected.slotId&&a.target?.traceType==='blue'));
  if(q.selected.blueSlot){const needed=data.getRequiredComputerSlotForBlueBonus(q.selected.blueSlot);for(let n=0;n<needed;n++){submit(legal().find(a=>a.family==='place_data'));submit(legal().find(a=>a.target?.target==='computer'));}submit(legal().find(a=>a.family==='place_data'));submit(legal().find(a=>a.target?.target==='blueBonus'&&a.target?.blueSlot===q.selected.blueSlot));}
  const after=value();assert.equal(after.components.analysisPotential,0);assert.equal(after.total-(before.total-before.components.analysisPotential),q.selected.planNetGain,JSON.stringify({company,credits,energy,stock,publicity,q}));assert.equal(q.value,Math.max(0,q.selected.planNetGain));assert(c.lifecycle.restore(original).ok);assert.deepEqual(c.lifecycle.save().envelope,original);
 }
 for(const[key,total]of totals){const [company,credits,energy,stock,publicity]=JSON.parse(key);for(const [c,e]of [[credits+1,energy],[credits,energy+1]]){const more=totals.get(JSON.stringify([company,c,e,stock,publicity]));if(more!==undefined)assert(more>=total,JSON.stringify({company,credits,energy,stock,publicity,total,more,c,e}));}}
 // Native post-main upper bounds must cover activating analysis through a
 // real blue-slot6 prerequisite, while rejecting imaginary computer6 goals.
 for(const kind of ['not-reachable','already-ready','blue-slot6']){
  const e=structuredClone(w.rows.find(r=>r.name===(kind==='not-reachable'?'analyze-first':'research-first')).afterFirst.envelope),s=JSON.parse(e.committedState),p=s.players.players.find(p=>p.id==='player-white');s.pieces.rockets=[];s.pieces.activeRocketId=null;p.mainActionCompleted=true;p.resources.score=10;
  if(kind==='blue-slot6'){
   p.techState.blueBoardSlots.blue1=4;
   const last=p.dataState.placedTokens.find(t=>t.placementKind==='computer'&&t.placementSlot===6);assert(last);
   p.dataState.placedTokens=p.dataState.placedTokens.filter(t=>t!==last&&!(t.placementKind==='blueBonus'&&t.blueSlot===2));p.dataState.discardedCount++;
   const slot=[1,2,3,4,5,6].find(slot=>!p.dataState.poolTokens.some(t=>t.slotIndex===slot));p.dataState.poolTokens.push({id:last.id,index:last.index,slotIndex:slot});p.resources.availableData=p.dataState.poolTokens.length;
  }
  e.committedState=JSON.stringify(s);const restored=c.lifecycle.restore(e);assert(restored.ok,JSON.stringify(restored));const original=c.lifecycle.save().envelope,port=createAnalysisPort({composition:c,seatId:'player-white',maxCacheEntries:0});
  try{port.setResourcePlanning(true);port.setCardPickPlanning(true);const root=port.openRoot(),bound=port.postMainValueBound(root);assert(bound,'typed post-main bound must cover this below-threshold native control: '+kind);assert.equal(bound.analysisReachableByFixedDataPolicy,kind!=='not-reachable');assert.equal(bound.maximumAnalysisLinear,kind==='not-reachable'?0:11);
   const evaluate=values.createStateValueEvaluator('player-white'),result=searchDecision({port,root,evaluate,...agent.OPTIONS,modelKey:evaluate.modelKey,budget:{transitions:256,nodes:1024,frontier:256,milliseconds:5000}});assert(result.complete);assert(result.value<=evaluate(root.observation)+bound.maximumValueIncrease);
   if(kind==='blue-slot6'){
    assert.equal(values.evaluateStateValue(root.observation,'player-white').components.analysisPotential,0);const plan=port.resourceSpec(root).plans.find(x=>x.goal.kind==='blue-data'&&x.goal.blueSlot===4);assert(plan);const actual=port.expandResourcePlan(root,plan,()=>null);assert(actual.complete);assert(values.evaluateStateValue(port.valueObservation(actual.node),'player-white').components.analysisPotential>0,'native prerequisite must activate ready analysis');
   }
   assert.deepEqual(c.lifecycle.save().envelope,original);
  }finally{port.close();}
 }
 let moneyControls=0;
 for(const weights of [values.DEFAULT_WEIGHTS,{...values.DEFAULT_WEIGHTS,credits:.1,energy:5},{...values.DEFAULT_WEIGHTS,credits:5,energy:.1}])for(const company of ['deep-space','stratus']){
  const totals=new Map();for(let credits=0;credits<=6;credits++)for(let energy=0;energy<=3;energy++){
   const s=JSON.parse(source.committedState),p=s.players.players.find(p=>p.id==='player-white');if(company==='stratus')p.initialSelection.industry='层云核心';Object.assign(p.resources,{credits,energy});
   const facts={...probe.factsFromState(s,p),supply:s.tech,researchCost:tech.getResearchPublicityCost(p),computerSlots:data.listComputerPlacedTokens(p).map(t=>t.placementSlot),reservedCards:p.reservedCards,analyzeEnergyCost:industry.canAnalyzeWithoutEnergy(p)?0:data.ANALYZE_ENERGY_COST};
   totals.set(`${credits}:${energy}`,credits*weights.credits+energy*weights.energy+values.purposeCapital(facts,weights).total);moneyControls++;
  }
  for(let credits=0;credits<=6;credits++)for(let energy=0;energy<=3;energy++){const current=totals.get(`${credits}:${energy}`);for(const[c,e]of [[credits+1,energy],[credits,energy+1]])if(totals.has(`${c}:${e}`))assert(totals.get(`${c}:${e}`)>=current-1e-9,'funded analysis must preserve the positive-money dominance contract');}
 }
 assert.equal(moneyControls,168);
 assert.equal(controls,192);assert.equal(funded,176);console.log(JSON.stringify({nativeFundedControls:funded,unfunded:controls-funded,nativeInputs,moneyMonotone:true,stateObservationParity:true,rootAndRngUnchanged:true}));
}finally{c.dispose();}
console.log('ready analysis and research ordering share funded portfolio value with immutable native inputs');
