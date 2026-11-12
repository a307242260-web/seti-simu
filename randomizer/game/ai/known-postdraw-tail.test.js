'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createAnalysisPort}=require('./analysis-port'),values=require('./state-value');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation');
const F='reports/ai-foundation-20261105/third-round-teacher-v1/',read=p=>JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../..',p))),f=read(F+'v239-actual-before-132-root-20261106-v1.json'),controls=read(F+'v239-free-alien-card-boundary-control-20261106-v1.checkpoint.json'),reference=read(F+'v239-free-card-known-suffix-control-20261106-v1.json'),seat=f.seatId,seed=f.source.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const replay=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});replay.newGame({seed});const nativePort=replay.composition,c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);const original=c.lifecycle.save().envelope;let checked=0;
function open(){const p=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});p.setMovementPlanning(true);p.setResourcePlanning(true);p.setCardPickPlanning(true);p.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});return p;}
// Public display acquisitions are covered by public-alien-offer.test.js.
// This tail proof specifically excludes new known purposes and tests only opaque rewards.
try{for(const name of ['cancel','blind']){const p=open();try{let node=p.openRoot();for(const id of controls.contexts['387'].path)node=p.expand(node,id);assert.equal(node.status,'decision');node=p.expand(node,controls.contexts['387'].branches[name].acceptedActionId);
  assert.equal(node.status,'stable',name+': a certified root-known fixed tail must survive a free anonymous owned-card reward');
  const view=p.valueObservation(node),base=values.evaluateStateValue(view,seat),spec=p.turnTailSummary(node,'data-end-turn');assert(spec,name+': one fixed income/blue/end proof must cover the remaining known window');assert.equal(spec.requiredNativeInputs,6);assert.equal(values.sumValueParts([base.total,spec.netGain]),reference.branches[name].finalMasked.total,name+': exact independent Native suffix');
  if(name!=='cancel'){assert.equal(view.selfState.hand.filter(c=>c.hidden).length,1);assert(view.selfState.hand.filter(c=>c.hidden).every(c=>!c.id&&!c.cardId),'anonymous slots are not entities');const newlyOwned=controls.contexts['387'].branches[name].immediate.rawHand.filter(c=>!controls.contexts['387'].before.rawHand.some(before=>before.id===c.id));assert.equal(newlyOwned.length,1);assert(!JSON.stringify(node.legalActions).includes(newlyOwned[0].id),'new card must never become an executable selection');}
  const leaf=p.turnTailBoundary(node,spec);assert.equal(leaf.status,'turn-tail-value');assert.throws(()=>leaf.observation,/NO_SUCCESSOR_OBSERVATION/);assert.throws(()=>p.expand(leaf,spec.firstActionId),/BOUNDARY_CLOSED/);assert.deepEqual(c.lifecycle.save().envelope,original);checked++;
 }finally{p.close();}}
 // Hidden deck permutations keep every revealed/owned fact and quantity.
 // New Native identities remain opaque and must not change the known tail.
 const maskedVariants=[];
 for(let rotation=0;rotation<6;rotation++){
  const state=JSON.parse(original.committedState);if(rotation){state.aliens.amiba.cardDeck=[...state.aliens.amiba.cardDeck.slice(rotation),...state.aliens.amiba.cardDeck.slice(0,rotation)];const known=state.aliens.amiba.initialConfiguration.cardDeck.length-state.aliens.amiba.cardDeck.length;state.aliens.amiba.initialConfiguration.cardDeck=[...state.aliens.amiba.initialConfiguration.cardDeck.slice(0,known),...state.aliens.amiba.cardDeck];}
  const variant={...original,committedState:JSON.stringify(state)};assert(c.lifecycle.restore(variant).ok);const before=c.lifecycle.save().envelope,p=open();
  try{let node=p.openRoot();for(const id of controls.contexts['387'].path)node=p.expand(node,id);node=p.expand(node,controls.contexts['387'].branches.blind.acceptedActionId);assert.equal(node.status,'stable');const view=p.valueObservation(node),spec=p.turnTailSummary(node,'data-end-turn');assert(spec);assert.equal(values.sumValueParts([values.evaluateStateValue(view,seat).total,spec.netGain]),125.25);maskedVariants.push({value:values.evaluateStateValue(view,seat),netGain:spec.netGain,policy:p.resourceSpec(node),legalActions:node.legalActions,pendingHand:view.selfState.pendingHandCardTriggers});assert.deepEqual(c.lifecycle.save().envelope,before);}finally{p.close();}
 }
 for(const variant of maskedVariants.slice(1))assert.deepEqual(maskedVariants[0],variant,'unknown alien identities cannot influence value, fixed suppliers, Native selections or hand-history facts');assert(c.lifecycle.restore(original).ok);
 const disabled=open();try{let node=disabled.openRoot();for(const id of controls.contexts['387'].path)node=disabled.expand(node,id);disabled.setResourcePlanning(false);node=disabled.expand(node,controls.contexts['387'].branches.blind.acceptedActionId);assert.equal(node.status,'information-barrier','without a fixed-resource proof the original boundary remains');assert.deepEqual(c.lifecycle.save().envelope,original);}finally{disabled.close();}
 const p=open();try{let node=p.openRoot();for(const id of controls.contexts['125'].path)node=p.expand(node,id);node=p.expand(node,controls.contexts['125'].branches.display.acceptedActionId);
   assert.equal(node.status,'stable','a display identity known at the root admits existing same-turn continuation');
   assert.equal(node.observation.publicState.board.aliens.amibaTraces.displayedCardIndex,null,'replacement display remains hidden');
   assert.equal(node.observation.publicState.board.aliens.amibaTraces.displayedCardHidden,true);
   assert(node.legalActions.length>0);
   assert(!node.legalActions.some(a=>a.family==='pass'),'cannot progress another turn or round from this rule menu');
   console.log(JSON.stringify({priorGuard:'information-barrier',newStatus:node.status,knownDisplay:'amiba_9.webp',hiddenReplacement:true,legal:node.legalActions.map(a=>a.family)}));assert(node.observation.selfState.hand.some(c=>c.cardId==='amiba_9.webp'&&!c.hidden));assert.deepEqual(c.lifecycle.save().envelope,original);}finally{p.close();}
 // A known main card's blind reward must not cut a fixed held-data plan.
 // The complete compound scalar proof declines competing computer/blue goals;
 // these four actual inputs must still be materialized, with new cards opaque.
 const teacher=read('reports/ai-foundation-20261106/analysis-blue-choice-v1/teacher167-root-20261106-v1.json'),native=read(F+'v274-teacher167-postdraw-blue-native-control-20261106-v1.json');
 const maskedDataWorlds=[];
 for(let rotation=0;rotation<6;rotation++){
  const state=JSON.parse(teacher.compositionEnvelope.committedState),deck=state.cards.drawPileCardIds;
  state.cards.drawPileCardIds=[...deck.slice(rotation),...deck.slice(0,rotation)];
  const source={...teacher.compositionEnvelope,committedState:JSON.stringify(state)};
  assert(c.lifecycle.restore(source).ok);const before=c.lifecycle.save().envelope,q=open();
  try{
   const knownRoot=q.openRoot();let node=knownRoot;for(const id of ['play_card:5d3aef4d','choose_card:3fd1e1f1','choose_target:4ca50ef1'])node=q.expand(node,id);
   assert.equal(node.status,'stable','a new blind card cannot cut an existing funded data plan');
   const policy=q.resourceSpec(node);assert.equal(policy.plans.length,1);assert.equal(policy.plans[0].goal.kind,'blue-data');
   // An applicable scalar proof may replace these same Native inputs; the independent replay still checks them.
   const view=q.valueObservation(node);assert.equal(view.selfState.hand.filter(c=>c.hidden).length,1);
   assert(view.selfState.hand.filter(c=>c.hidden).every(c=>!c.id&&!c.cardId));
   const done=q.expandResourcePlan(node,policy.plans[0],()=>null);assert(done.complete);assert.equal(done.submissions,4);
   assert.equal(done.goalStatus,'boundary');assert.equal(done.node.status,'information-barrier','uncovered later actions keep an explicit boundary');
   for(let i=0;i<4;i++){
    assert.equal(done.prefixes[i].action.actionId,native.prefixes[i+4].action.actionId);
    assert.deepEqual(done.prefixes[i].action.target,native.prefixes[i+4].action.target);
    assert(nativePort.lifecycle.restore(native.prefixes[i+4].envelope).ok);
    const formal=nativePort.projection({role:'player',playerId:seat}).state;
    assert.deepEqual(values.evaluateStateValue(q.valueObservation(i<3?done.prefixes[i+1].node:done.node),seat),values.evaluateStateValue(require('../rule-composition').sanitizeHiddenInformationObservation(knownRoot.observation,formal,{code:'hidden_card_draw'}),seat));
   }
   const value=values.evaluateStateValue(q.valueObservation(done.node),seat);assert.equal(value.total,native.branches.blue.maskedValue.total);
   maskedDataWorlds.push({policy,value,legalActions:node.legalActions,steps:done.prefixes.map(x=>x.action.actionId)});
   assert.deepEqual(c.lifecycle.save().envelope,before);
  }finally{q.close();}
 }
 for(const result of maskedDataWorlds.slice(1))assert.deepEqual(result,maskedDataWorlds[0],'unknown ordinary deck identities cannot affect a fixed data plan');
 assert(c.lifecycle.restore(teacher.compositionEnvelope).ok);const noMovement=open();
 try{noMovement.setMovementPlanning(false);let node=noMovement.openRoot();for(const id of ['play_card:5d3aef4d','choose_card:3fd1e1f1','choose_target:4ca50ef1'])node=noMovement.expand(node,id);assert.equal(node.status,'information-barrier','without movement timing policy the Native continuation is unproved');}finally{noMovement.close();}
 // With the swap still available, an acquired public display and one
 // opaque ordinary card can still leave an independent funded blue tail.
 const display=JSON.parse(require('node:zlib').gunzipSync(fs.readFileSync(path.join(__dirname,
  'fixtures/r3-analysis-display-unspent-company-20261113-v1.json.gz'))));
 assert(c.lifecycle.restore(display.before).ok);
 const main=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
 try{
  const before=c.lifecycle.save().envelope,legalActions=c.inputPort.enumerateActions({});
  const q=require('./search-agent').createSearchAgent({seatId:seat,analysisPort:main}).decide({seatId:seat,legalActions}).search;
  assert(q.complete&&!q.unresolved.length&&q.diagnostics.nativeExecutions<=256);
  assert.equal(legalActions.find(a=>a.actionId===q.actionId).family,'place_data');
  assert.equal(q.value,127.08333333333333);
  assert.deepEqual(c.lifecycle.save().envelope,before);
 }finally{main.close();}
 const variants=[];
 for(const kind of ['original','ordinary','alien']){
  const source=structuredClone(display.display);
  const reorder=state=>{
   const pile=kind==='ordinary'?state.cards.drawPileCardIds:kind==='alien'?state.aliens.amiba.cardDeck:null;
   if(pile)[pile[0],pile[1]]=[pile[1],pile[0]];
  };
  const s=JSON.parse(source.committedState);reorder(s);source.committedState=JSON.stringify(s);
  for(const key of ['baseState','workingState','committedState']){
   const s=source.session.session[key];if(s)reorder(s);
  }
  assert(c.lifecycle.restore(source).ok);const p=open();
  try{
   const root=p.openRoot(),node=p.expand(root,display.card);
   assert.equal(node.status,'stable');
   const view=p.valueObservation(node);
   const opaque=view.selfState.hand.filter(c=>c.hidden);assert.equal(opaque.length,1);assert(!opaque[0].id&&!opaque[0].cardId);
   assert(view.selfState.hand.some(c=>c.cardId==='amiba_9.webp'&&!c.hidden));
   assert.equal(view.publicState.board.aliens.amibaTraces.displayedCardIndex,null);
   const proof=p.turnTailSummary(node,'blue-end-turn');assert(proof);
   assert.equal(proof.requiredNativeInputs,5);
   assert(nativePort.lifecycle.restore(display.after).ok);
   const after=nativePort.projection({role:'player',playerId:seat}).state;
   const acquired=after.selfState.hand.find(c=>c.cardId==='amiba_9.webp');
   const masked=require('../rule-composition').sanitizeHiddenInformationObservation(root.observation,after,{code:'hidden_card_draw'},[acquired.id]);
   assert.equal(values.sumValueParts([values.evaluateStateValue(view,seat).total,proof.netGain]),
    values.evaluateStateValue(masked,seat).total,'the fixed blue tail agrees with the independent Native suffix');
   const blind=root.legalActions.find(a=>a.target?.choiceId==='amiba:blind');
   assert(blind);assert.equal(p.expand(root,blind.actionId).status,'information-barrier','no public acquisition means the old opaque boundary still applies');
   variants.push({v:values.evaluateStateValue(view,seat),proof,actions:node.legalActions});
   assert.deepEqual(c.lifecycle.save().envelope,source);
  }finally{p.close();}
 }
 for(const v of variants.slice(1))assert.deepEqual(v,variants[0]);
 assert(c.lifecycle.restore(original).ok);
 console.log(JSON.stringify({knownPostdrawTail:'passed',nativeControlledBranches:checked,referenceNativeInputs:18,anonymousCardUsed:false,freeCardValue:125.25,cancelValue:124.25,hiddenDeckWorldsIndependent:6,closedUnprovedBoundary:true,rootAndRngUnchanged:true,fixedPostdrawDataNativeInputs:4,ordinaryDeckWorldsIndependent:6,newAiSearches:1,unspentCompanyMaskedControls:3}));
}finally{nativePort.dispose();c.dispose();}
