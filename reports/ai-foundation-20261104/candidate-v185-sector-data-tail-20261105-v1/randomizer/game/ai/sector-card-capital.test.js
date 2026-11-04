'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),values=require('./state-value'),demand=require('./resource-demand'),probe=require('./probe-capital'),{createAnalysisPort}=require('./analysis-port'),{createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation');
const read=p=>JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../..',p))),folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/',w=read(folder+'v178-known-sector-card-continuation-native-20261105-v2.json'),source=w.checkpoints[0],seat='player-white',state=JSON.parse(source.checkpoint.coreState.committedState),seed=state.meta.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(source.checkpoint.coreState.compositionEnvelope).ok);const original=c.lifecycle.save().envelope,observe=()=>c.projection({role:'player',playerId:seat}).state;
const facts=o=>({...probe.factsFromObservation(o,seat),supply:o.publicState.board.techSupply,reservedCards:o.selfState.reservedCards,researchCost:o.publicState.players.find(p=>p.playerId===seat).researchPublicityCost,analyzeEnergyCost:0});let nativeInputs=0,stablePrefixes=0;
try{
 for(const row of w.checkpoints)assert.equal(values.evaluateStateValue(row.observation,seat).total,75.5,'the known card, existing-data preparation and analysis must cash the same75.5 across stable native prefixes');
 const capital=values.purposeCapital(facts(observe()));assert.equal(capital.analysisPotential,4.5);assert.equal(capital.sectorCardPlan.value,14);assert.equal(capital.handPotential,14);assert.equal(capital.sectorCardPlan.selected.linear,7);assert.equal(capital.sectorCardPlan.selected.afterCapital,11.5);assert.deepEqual(capital.sectorCardPlan.selected.targets,['sector-2-a','sector-4-b']);
 const port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});try{port.setResourcePlanning(true);port.setCardPickPlanning(true);const root=port.openRoot();assert.equal(port.postMainValueBound(root),null,'a prior technology-only hand ceiling cannot prune this newly valued sector card');assert.deepEqual(c.lifecycle.save().envelope,original);}finally{port.close();}
 for(const step of w.steps){const d=c.inspect().session?.decision,legal=d?.choices||c.inputPort.enumerateActions({}),a=legal.find(a=>a.actionId===step.actionId);assert(a);assert((d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a)).ok);nativeInputs++;
  const e=c.lifecycle.save().envelope;if(!e.session){const o=observe(),v=values.evaluateStateValue(o,seat),s=JSON.parse(e.committedState),p=s.players.players.find(p=>p.id===seat);assert.equal(v.total,75.5);assert.equal(demand.planningCapital(s,p),['handPotential','researchPotential','probePotential','analysisPotential','researchIncomePotential','dataPotential'].reduce((n,k)=>n+v.components[k],0));stablePrefixes++;}
 }
 assert.equal(nativeInputs,10);assert(stablePrefixes>=5);assert.deepEqual(c.lifecycle.save().envelope,w.checkpoints.at(-1).checkpoint.coreState.compositionEnvelope);assert(c.lifecycle.restore(original).ok);
 const base=observe(),before=structuredClone(base),dup=structuredClone(base),tool=dup.selfState.hand.find(c=>c.cardId==='dlc_37.png');dup.selfState.hand.push({...tool,id:'duplicate-known-tool'});assert.equal(values.evaluateStateValue(dup,seat).total,76.5,'another known tool is one hand card, not another claim on the same sector');assert.equal(values.purposeCapital(facts(dup)).sectorCardPlan.value,14);
 const unknown=structuredClone(base);unknown.selfState.hand=unknown.selfState.hand.map(c=>c.cardId==='dlc_37.png'?{id:c.id,hidden:true}:c);assert.equal(values.purposeCapital(facts(unknown)).sectorCardPlan.value,0);
 const short=facts(base);short.player={...short.player,availableData:1};const shortCapital=values.purposeCapital(short);assert.equal(shortCapital.analysisPlan.value,0,'one data cannot fund two computer prerequisites');assert.equal(shortCapital.analysisPotential,shortCapital.computerPotential);assert.equal(shortCapital.sectorCardPlan.selected.afterCapital,shortCapital.computerPotential,'the retained preparation is an asset, not a fabricated completed analysis');
 const gap=facts(base);gap.computerSlots=[1,2,4];assert.equal(values.purposeCapital(gap).analysisPotential,0,'the quote does not cross the income slot or invent missing computer3');
 const revealed=structuredClone(base);revealed.publicState.board.aliens.slots[0].revealed=true;assert.equal(values.purposeCapital(facts(revealed)).sectorCardPlan.value,0);
 const third=structuredClone(base);for(const s of third.publicState.board.aliens.slots){s.traces.blue.firstPlaced=true;s.traces.yellow.firstPlaced=true;s.traces.pink.firstPlaced=false;}assert.equal(values.purposeCapital(facts(third)).sectorCardPlan.value,0,'unknown species discovery is outside this quote');
 const guarded=facts(base);guarded.reservedCards=[...guarded.reservedCards,{id:'trigger-control',cardId:'b_71.webp',set:'basic'}];assert.equal(values.purposeCapital(guarded).sectorCardPlan.value,0);
 let moneyControls=0;
 for(const weights of [values.DEFAULT_WEIGHTS,{...values.DEFAULT_WEIGHTS,credits:.1,energy:5},{...values.DEFAULT_WEIGHTS,credits:5,energy:.1}]){
  const totals=new Map();for(let credits=0;credits<=6;credits++)for(let energy=0;energy<=3;energy++){const o=structuredClone(base),p=o.publicState.players.find(p=>p.playerId===seat);Object.assign(p,{credits,energy});totals.set(`${credits}:${energy}`,values.evaluateStateValue(o,seat,{weights}).total);moneyControls++;}
  for(let credits=0;credits<=6;credits++)for(let energy=0;energy<=3;energy++)for(const [c,e]of [[credits+1,energy],[credits,energy+1]])if(totals.has(`${c}:${e}`))assert(totals.get(`${c}:${e}`)>=totals.get(`${credits}:${energy}`)-1e-9,'known sector/analysis max must preserve positive-money dominance');
 }
 assert.equal(moneyControls,84);
 // The independent sector card must preserve the already-funded blue data tail.
 const actual=read(folder+'v184-round2-purpose-realization-native-20261105-v1.json');
 const endpoint=name=>actual.rows.find(row=>row.name===name).endpoint;
 const totalAt=envelope=>{assert(c.lifecycle.restore(envelope).ok);return values.evaluateStateValue(observe(),seat).total;};
 const initialValue=totalAt(actual.before.envelope),analyzedValue=totalAt(endpoint('prepared-analysis').envelope);
 const afterAnalysis=c.lifecycle.save().envelope,analysisCapital=values.purposeCapital(facts(observe()));
 assert(analysisCapital.dataPotential>0,'two remaining pool data have an independently funded blue tail');
 const beforeCard=observe(),beforePlayer=beforeCard.publicState.players.find(p=>p.playerId===seat),plan=analysisCapital.sectorCardPlan.selected;
 assert(plan&&plan.targets.length,'the known sector purpose remains executable after analysis');
 const submit=a=>{assert(a);const decision=c.inspect().session?.decision;assert((decision?c.inputPort.submitDecision({decisionId:decision.decisionId,decisionVersion:decision.decisionVersion,ownerId:decision.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a)).ok);nativeInputs++;};
 const legal=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
 submit(legal().find(a=>a.family==='play_card'&&a.target?.cardInstanceId===plan.cardId));
 for(let i=0;c.inspect().session;i++){assert(i<8);submit(legal().find(a=>plan.targets.includes(a.target?.nebulaId)));}
 submit(legal().find(a=>a.family==='end_turn'));
 const afterCard=observe(),afterPlayer=afterCard.publicState.players.find(p=>p.playerId===seat),afterCapital=values.purposeCapital(facts(afterCard));
 assert.equal(afterPlayer.availableData,beforePlayer.availableData,'playing this no-data sector card does not spend the existing data tail');
 const realizedNet=values.sumValueParts([afterPlayer.score-beforePlayer.score,-values.DEFAULT_WEIGHTS.handSize],values.DEFAULT_WEIGHTS);
 assert.equal(analysisCapital.sectorCardPlan.value,realizedNet,'the sector quote must not subtract an unchanged blue-data portfolio');
 assert.equal(afterCapital.dataPotential,analysisCapital.dataPotential);
 assert.equal(values.evaluateStateValue(afterCard,seat).total,analyzedValue,'the funded card cashes its quoted capital without losing unconsumed data');
 assert.equal(analyzedValue,initialValue,'known prepared analysis and known sector card can be realized in either order');
 assert.equal(totalAt(endpoint('both').envelope),analyzedValue);
 assert.deepEqual(afterCard.selfState.hand,observe().selfState.hand);
 const bothPlayer=observe().publicState.players.find(p=>p.playerId===seat);
 for(const key of ['score','credits','energy','publicity','availableData','dataProgress','techState','income'])assert.deepEqual(afterPlayer[key],bothPlayer[key],key+' must be independent of main-purpose realization order');
 assert(c.lifecycle.restore(afterAnalysis).ok);assert.deepEqual(c.lifecycle.save().envelope,afterAnalysis);
 assert(c.lifecycle.restore(original).ok);
 assert.deepEqual(base,before);assert.deepEqual(c.lifecycle.save().envelope,original);console.log(JSON.stringify({knownSectorAndAnalysis:'passed',nativeInputs,stablePrefixes,moneyControls,value:75.5,sectorCapital:14,preparedAnalysisCapital:4.5,duplicateClaimsPrevented:true,hiddenAndDiscoveryGuards:true,stateObservationParity:true,rootAndRngRestored:true}));
}finally{c.dispose();}
