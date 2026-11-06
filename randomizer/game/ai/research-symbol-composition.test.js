'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),values=require('./state-value'),probe=require('./probe-capital'),ready=require('./ready-analysis-capital'),research=require('./research-symbol-capital'),demand=require('./resource-demand'),{createAnalysisPort}=require('./analysis-port');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation');
const F='reports/ai-foundation-20261105/third-round-teacher-v1/',read=p=>JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../..',p))),fixture=read(F+'v218-corner-safety-purple2-3-root-20261106-v1.json'),controls=read(F+'v238-paid-research-decomposition-20261106-v1.checkpoint.json'),seat=fixture.seatId,seed=fixture.source.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition,observe=()=>c.projection({role:'player',playerId:seat}).state;
function facts(o){const p=o.publicState.players.find(p=>p.playerId===seat);return {...probe.factsFromObservation(o,seat),supply:o.publicState.board.techSupply,researchCost:p.researchPublicityCost,computerSlots:p.dataProgress.computerSlots,analyzeEnergyCost:ready.energyCost(p.industryAbilityId),reservedCards:o.selfState.reservedCards};}
try{assert(c.lifecycle.restore(fixture.compositionEnvelope).ok);const original=c.lifecycle.save().envelope,before=observe(),f=facts(before),base=values.evaluateStateValue(before,seat);
 assert(c.lifecycle.restore(controls.branches.purple1.envelope).ok);const endpoint=observe(),after=values.evaluateStateValue(endpoint,seat);
 assert(base.total>=after.total,'an already funded known research/symbol route must carry the moved symbol and its remaining portfolio before execution');
 assert.equal(base.total,after.total);const quote=values.purposeCapital(f).researchSymbolPlan;assert.equal(quote.selected.tileId,'purple1');assert.equal(quote.candidates.filter(p=>p.tileId.startsWith('purple')).length,3);
 const own=o=>o.publicState.players.find(p=>p.playerId===seat),b=own(before),legal=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
 let replayInputs=0;const submit=a=>{assert(a);const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));replayInputs++;};
 // Declining an unsupported scalar input must neither invent a Native state
 // nor price a reward before its prerequisite is paid.
 const q=next=>research.quote(next,values.DEFAULT_WEIGHTS,()=>0,0,values.technologyCapital);
 for(const change of [x=>x.uncontestedRound=false,x=>x.pendingNativeEffects=true,x=>x.passing=true,x=>x.round=4,
  x=>x.researchSymbols.revealInitialized=false,x=>x.companyState.abilityId='turing_borrow_tech',
  x=>x.hand=x.hand.filter(c=>c.id!==quote.selected.beneficiaryCardId),x=>x.player.publicity=0,
  x=>x.nextFinalMark.valuationSafe=false,x=>delete x.nextFinalMark.followingThreshold,
  x=>x.nextFinalMark.options=x.nextFinalMark.options.filter(o=>o.tileId!=='b'),
  x=>x.computerSlots=[1,2],x=>x.player.availableData=1,
  x=>x.reservedCards.find(c=>c.cardId==='amiba_1.webp').cardEffectState.consumedTriggerIds.push('amiba1-purple-tech','amiba1-orange-tech')]){
   const changed=structuredClone(f);change(changed);const snapshot=JSON.stringify(changed);assert.equal(q(changed).value,0);assert.equal(JSON.stringify(changed),snapshot);
 }
 assert(c.lifecycle.restore(original).ok);
 const state=JSON.parse(original.committedState),owner=state.players.players.find(p=>p.id===seat);
 assert.deepEqual(demand.planningCapital(state,owner),values.purposeCapital(f).total,'Native and common-observation facts share the same composition');
 const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
 const fixedSource=freeze(structuredClone(state)),fixedOwner=fixedSource.players.players.find(p=>p.id===seat),expectedRemoval=[3,9.833333333333334,9.833333333333334];
 for(let repeat=0;repeat<3;repeat++)for(let i=0;i<fixedOwner.hand.length;i++)assert.equal(demand.cardOpportunityCost(fixedSource,seat,fixedOwner.hand[i]),expectedRemoval[i]);
 const shallow=structuredClone(state),mutable=shallow.players.players.find(p=>p.id===seat),supplier=mutable.hand.find(c=>c.id===quote.selected.beneficiaryCardId);Object.freeze(shallow);
 const priorCost=demand.cardOpportunityCost(shallow,seat,supplier);mutable.resources.publicity=0;
 assert.notEqual(demand.cardOpportunityCost(shallow,seat,supplier),priorCost,'a shallow-frozen source with a mutable wallet cannot retain an old removal quote');
 mutable.resources.publicity=owner.resources.publicity;assert.equal(demand.cardOpportunityCost(shallow,seat,supplier),priorCost);

 const port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
 try{const root=port.openRoot();assert.deepEqual(values.evaluateStateValue(port.valueObservation(root),seat),base,'compact projection preserves all public research inputs');assert.deepEqual(c.lifecycle.save().envelope,original);}finally{port.close();}

 for(const [tile,branch]of Object.entries(controls.branches)){assert(c.lifecycle.restore(original).ok);for(const step of branch.steps)submit(legal().find(a=>a.actionId===step.actionId));assert.deepEqual(c.lifecycle.save().envelope,branch.envelope,'domain query extraction preserves every accepted Native state/session/RNG');const native=observe(),n=own(native),candidate=quote.candidates.find(p=>p.tileId===tile);assert(candidate,tile);
  const linear=values.sumValueParts([n.finalScore-b.finalScore,...Object.entries(values.DEFAULT_WEIGHTS).filter(([key])=>key!=='handSize').map(([key,w])=>(n[key]-b[key])*w),(native.selfState.hand.length-before.selfState.hand.length)*values.DEFAULT_WEIGHTS.handSize,values.technologyCapital(n.techState,3)-values.technologyCapital(b.techState,3)]);
  assert.equal(candidate.linear,linear,tile+' native linear ledger');assert.equal(candidate.afterCapital,values.purposeCapital(facts(native)).total,tile+' native remaining portfolio');assert.equal(values.sumValueParts([base.total,-quote.value,candidate.netGain]),values.evaluateStateValue(native,seat).total);
 }
 // The same final-B scoring profile is used by analysis whether already
 // claimed in Native or prospectively earned by this one known research.
 assert(c.lifecycle.restore(controls.branches.purple1.envelope).ok);
 const marked=facts(observe()),without=structuredClone(marked),earned=without.board.finalScoring.tiles.b.marks.find(m=>m.playerId===seat);
 without.board.finalScoring.tiles.b.marks=without.board.finalScoring.tiles.b.marks.filter(m=>m.playerId!==seat);
 without.forecastFinalMark={tileId:'b',formulaId:'b1',slotIndex:earned.slotIndex};
 assert.equal(values.purposeCapital(without).total,values.purposeCapital(marked).total,'one earned B profile carries identical later analysis growth without creating a Native marker');
 // Continue a saved legal prefix by one actual end-turn, leaving the known
 // publicity corner unspent until the next real research plan needs it.
 const engine=read(F+'v237-engine-before-research-control-20261106-v1.checkpoint.json');assert(c.lifecycle.restore(engine.prefixes[0]).ok);
 const end=c.inputPort.enumerateActions({}).find(a=>a.family==='end_turn');assert(end);assert(c.inputPort.submitAction(end).ok);
 const deferred=c.lifecycle.save().envelope,unpaid=facts(observe()),unpaidQuote=values.purposeCapital(unpaid).researchSymbolPlan;
 assert.equal(unpaidQuote.selected.tileId,'purple1');assert.equal(unpaidQuote.selected.cornerCardId,engine.plan.corner);assert.equal(unpaidQuote.selected.beneficiaryCardId,quote.selected.beneficiaryCardId);
 const fixed=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
 try{fixed.setResourcePlanning(true);fixed.setCardPickPlanning(true);const root=fixed.openRoot(),plans=fixed.resourceSpec(root).plans.filter(p=>p.goal.kind==='research_tech');
  const selected=plans.find(p=>p.goal.tileId==='purple1');assert(selected);assert.equal(selected.goal.continuationCardId,quote.selected.beneficiaryCardId);assert.equal(root.legalActions.find(a=>a.actionId===selected.firstActionId)?.target.cardInstanceId,engine.plan.corner);
  assert.deepEqual(c.lifecycle.save().envelope,deferred);
  const realized=fixed.expandResourcePlan(root,selected,()=>null);assert(realized.complete);assert(realized.prefixes.length>=3);assert.equal(realized.prefixes[0].action.target.cardInstanceId,engine.plan.corner);
  assert.deepEqual(c.lifecycle.save().envelope,deferred,'fixed plan executes only in its fork');
 }finally{fixed.close();}
 submit(legal().find(a=>a.family==='card_corner'&&a.target?.cardInstanceId===engine.plan.corner));
 for(const step of controls.branches.purple1.steps)submit(legal().find(a=>a.actionId===step.actionId));
 assert.equal(values.evaluateStateValue(observe(),seat).total,values.evaluateStateValue(before,seat).total,'deferred corner realizes the same quoted Native endpoint');
 assert(c.lifecycle.restore(original).ok);assert.deepEqual(c.lifecycle.save().envelope,original);console.log(JSON.stringify({researchSymbolComposition:'passed',nativeSourceInputs:19,nativeReplayInputs:replayInputs,newNativeInputs:1,unsupportedInputsDecline:14,nativeAndCompactParity:true,deferredPublicityPreservesBeneficiary:true,beforeAndAfter:base.total,plans:quote.candidates.map(p=>({tile:p.tileId,linear:p.linear,afterCapital:p.afterCapital,net:p.netGain})),rootAndRngRestored:true}));
}finally{c.dispose();}
