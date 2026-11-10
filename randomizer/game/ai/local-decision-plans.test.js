'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const plans=require('./local-decision-plans'),{createAnalysisPort}=require('./analysis-port'),{searchDecision}=require('./decision-search'),agent=require('./search-agent'),{createStateValueEvaluator}=require('./state-value');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation');
const read=p=>fs.readFileSync(path.resolve(__dirname,'../../..',p)),fixture=JSON.parse(read('adhoc/ai-decision-corpus-20261023-v1/case-062-20261023-v1.json'));
const raw=JSON.parse(zlib.gunzipSync(read('adhoc/ai-decision-corpus-20261023-v1/audit-case-062-shared-prefix-final-20261028-v1.raw.json.gz')));
function open(envelope=fixture.compositionEnvelope){const seed=fixture.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(envelope).ok);return c;}
function normalized(envelope){const names=new Map();return JSON.parse(JSON.stringify(envelope).replace(/effect-session-[0-9]+(?=[:"\\])/g,name=>{if(!names.has(name))names.set(name,'session-'+names.size);return names.get(name);}));}
function actions(c){const v=c.inspect();return v.phase==='awaiting_input'?v.session.decision.choices:c.inputPort.enumerateActions({});}
function submit(c,id){const v=c.inspect(),a=actions(c).find(a=>a.actionId===id);assert(a,id);const r=v.phase==='awaiting_input'?c.inputPort.submitDecision({decisionId:v.session.decision.decisionId,decisionVersion:v.session.decision.decisionVersion,ownerId:v.session.decision.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));}
// Reach a real final-mark boundary through the recorded native path, without manufacturing state fields.
const incoming=new Map(raw.sharedPrefixGraph.edges.map(e=>[e.to,e])),markEdge=raw.sharedPrefixGraph.edges.find(e=>raw.diagnosticActions[e.actionId].target?.choiceId?.startsWith('final:'));
let at=markEdge.from;const pathIds=[];while(at!==0){const e=incoming.get(at);assert(e,'recorded mark must be root-connected');pathIds.unshift(e.actionId);at=e.from;}
const markComp=open();for(const id of pathIds)submit(markComp,id);const saved=markComp.lifecycle.save().envelope,before=structuredClone(saved),state=saved.session.session.workingState;
const mark=plans.finalMark({state,seatId:fixture.seatId,actions:actions(markComp)});assert(mark);assert.equal(mark.scores.length,4);assert.equal(mark.retainedActionIds.length,1);assert.equal(mark.excludedActionIds.length,3);assert.equal(mark.isEquivalence,false);assert(mark.scores.every(s=>s.score<=mark.scores[0].score));assert.deepEqual(saved,before);
for(const cache of [0,256]){const p=createAnalysisPort({composition:markComp,seatId:fixture.seatId,maxCacheEntries:cache});const root=p.openRoot(),r=searchDecision({port:p,root,evaluate:createStateValueEvaluator(fixture.seatId),...agent.OPTIONS,budget:{transitions:256,nodes:257,frontier:256,milliseconds:15000}});assert(r.complete,r.stopReason);assert.equal(r.lines[0].decisionPolicy.selectedActionId,mark.selectedActionId);assert.equal(r.lines[0].edges.length,1);assert.equal(r.roots.filter(r=>r.completion==='excluded-by-local-decision-policy').length,3);assert.deepEqual(markComp.lifecycle.save().envelope,before);p.close();}
const reversed=plans.finalMark({state,seatId:fixture.seatId,actions:[...actions(markComp)].reverse()});assert.equal(reversed.selectedActionId,mark.selectedActionId);
// Existing end-game cards affect the marginal value of occupying a board, not just its printed formula.
{
 const s=structuredClone(state),cards=require('../cards/deck'),effects=require('../cards/effects'),scoring=require('../end-game-scoring'),final=require('../final-scoring'),own=s.players.players.find(p=>p.id===fixture.seatId);
 own.income.credits+=2;s.finalScoring.tileVariants.a=1;
 const added=cards.createCommittedCardInstance(s,cards.CARD_CATALOG.find(c=>c.card_id==='b_115.webp'),'policy-test');
 s.cards.drawPileCardIds=s.cards.drawPileCardIds.filter(c=>c!=='b_115.webp');for(const p of s.players.players){p.hand=p.hand.filter(c=>c.cardId!=='b_115.webp');p.reservedCards=p.reservedCards.filter(c=>c.cardId!=='b_115.webp');}own.reservedCards.push(added);
 const before=structuredClone(s),r=plans.finalMark({state:s,seatId:fixture.seatId,actions:actions(markComp)}),context={...s,players:s.players.players,cardEffects:effects,getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)},base=scoring.computePlayerFinalScore(context,own).totalScore;let differs=false;
 for(const score of r.scores){const q=structuredClone(s);assert(final.markTile(q.finalScoring,score.tileId,q.players.players.find(p=>p.id===fixture.seatId),{root:q}).ok);const expected=scoring.computePlayerFinalScore({...context,finalScoring:q.finalScoring},own).totalScore-base;assert.equal(score.currentValue,expected);const printed=scoring.getFormulaBaseValue(score.formulaId,own,context,{getCardTypeCode:context.getCardTypeCode})*scoring.getSlotMultiplier(score.formulaId,score.slot);differs ||= printed!==expected;}
 assert(differs,'unmarked-board card must exercise a real scoring interaction');assert.deepEqual(s,before);
}
const restored=open(saved);submit(markComp,mark.selectedActionId);submit(restored,mark.selectedActionId);assert.deepEqual(JSON.parse(markComp.lifecycle.save().envelope.committedState),JSON.parse(restored.lifecycle.save().envelope.committedState));assert.deepEqual(normalized(markComp.lifecycle.save().envelope),normalized(restored.lifecycle.save().envelope));markComp.dispose();restored.dispose();
// Scan purposes share deterministic native steps. All reachable native sectors remain named goals.
const comp=open(),rootBefore=comp.lifecycle.save().envelope,p=createAnalysisPort({composition:comp,seatId:fixture.seatId,maxCacheEntries:0});p.setResourcePlanning(true);p.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});const root=p.openRoot(),spec=p.resourceSpec(root),scans=spec.plans.filter(p=>p.goal.kind==='scan-flow');assert(scans.length>1);assert.equal(new Set(scans.map(p=>p.goal.nebulaId)).size,scans.length);assert(root.legalActions.filter(a=>a.family==='scan').every(a=>!spec.retainedActionIds.includes(a.actionId)));
let interrupted=false;
for(const plan of scans){const r=p.expandResourcePlan(root,plan,()=>null);assert(r.complete);assert(r.submissions>=2);assert(r.prefixes.some(p=>p.action.target?.nebulaId));assert.equal(r.prefixes[0].action.family,'scan');assert(r.preparations.some(p=>p.reason==='fixed-scan-card-and-sector'));const stop=p.expandResourcePlan(root,plan,n=>n>=1?'watchdog':null);assert(!stop.complete);assert.equal(stop.stopReason,'watchdog');interrupted=true;}
assert(interrupted);assert.deepEqual(comp.lifecycle.save().envelope,rootBefore);assert(p.getDiagnostics().stableRestoreSkips>0);p.close();
// Native source choice is rebuilt after a real first input and cold restore, without hidden plan state.
submit(comp,actions(comp).find(a=>a.family==='scan').actionId);const pending=comp.lifecycle.save().envelope,cold=open(pending),chosen=[];for(const c of [comp,cold]){const q=createAnalysisPort({composition:c,seatId:fixture.seatId,maxCacheEntries:0}),n=q.openRoot(),r=searchDecision({port:q,root:n,evaluate:createStateValueEvaluator(fixture.seatId),...agent.OPTIONS,budget:{transitions:256,nodes:257,frontier:256,milliseconds:15000}});assert(r.complete,r.stopReason);chosen.push(r.actionId);q.close();}assert.equal(chosen[0],chosen[1]);submit(comp,chosen[0]);submit(cold,chosen[1]);assert.deepEqual(JSON.parse(comp.lifecycle.save().envelope.committedState),JSON.parse(cold.lifecycle.save().envelope.committedState));assert.deepEqual(normalized(comp.lifecycle.save().envelope),normalized(cold.lifecycle.save().envelope));comp.dispose();cold.dispose();
// Optional paid scans must not choose a native input whose runtime payment cannot succeed.
{
 const s=JSON.parse(fixture.compositionEnvelope.committedState),own=s.players.players.find(p=>p.id===fixture.seatId);own.resources.publicity=0;
 const legal=[{actionId:'scan-paid',family:'choose_target',target:{nebulaId:'sector-2-a'},payload:{gainData:true}},{actionId:'skip',family:'choose_target',target:{skip:true}}],session={queue:[{payload:{options:{cost:{publicity:1}}}}]};
 const r=plans.scanStep({state:s,seatId:fixture.seatId,goal:{kind:'scan-flow',nebulaId:'sector-2-a'},actions:legal,status:'decision',session});assert.equal(r.actionId,'skip');assert.equal(r.reason,'skip-unfunded-scan-cost');
}
// Only fixed native steps are allowed to consume input/state/frontier limits; interruption never submits.
for(const [reason,budget] of [['transition-budget',{transitions:1}],['node-budget',{nodes:2}],['frontier-budget',{frontier:1}]]){
 const c=open(),before=c.lifecycle.save().envelope,q=createAnalysisPort({composition:c,seatId:fixture.seatId,maxCacheEntries:0}),n=q.openRoot(),port={...q,resourceSpec(x){const s=q.resourceSpec(x);return x===n?{...s,retainedActionIds:[],plans:s.plans.filter(p=>p.goal.kind==='scan-flow')}:s;}};
 const r=searchDecision({port,root:n,evaluate:createStateValueEvaluator(fixture.seatId),...agent.OPTIONS,budget:{transitions:256,nodes:257,frontier:256,milliseconds:15000,...budget}});assert(!r.complete);assert.equal(r.stopReason,reason);assert.equal(r.actionId,null);assert.equal(r.planContinuation,null);assert.deepEqual(c.lifecycle.save().envelope,before);q.close();c.dispose();
}
// Reorganization is a fixed greedy chain: charge the lost hand card, keep ties,
// value known capped rewards and existing scoring, and never enumerate subsets.
{
 const f=JSON.parse(read('adhoc/ai-decision-corpus-20261029-reorg-v1/step295-20261029-v1.json')),c=open(f.compositionEnvelope),before=c.lifecycle.save().envelope;
 const q=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});q.setResourcePlanning(true);q.setCardPickPlanning(true);q.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});
 const n=q.openRoot(),policy=q.resourceSpec(n),plan=policy.plans.find(p=>p.goal.cardId==='card-57-0');assert(plan);
 const started=q.expand(n,plan.firstActionId),play=c.inputPort.enumerateActions({}).find(a=>a.actionId===plan.firstActionId);
 submit(c,play.actionId);const pending=c.lifecycle.save().envelope,working=pending.session.session.workingState,session=pending.session.session,legal=actions(c);
 const tie=plans.reorganization({state:working,seatId:f.seatId,actions:legal,session});assert(tie);assert.equal(tie.kind,'fixed-reorganization');assert.equal(tie.isEquivalence,false);assert.equal(tie.netGain,0);assert(legal.find(a=>a.actionId===tie.selectedActionId).target.done);assert(tie.gains.every(g=>g.netGain===0));
 const direct=plans.reorganization({state:working,seatId:f.seatId,actions:[...legal].reverse(),session});assert.equal(direct.selectedActionId,tie.selectedActionId);
 const changed=structuredClone(working),actor=changed.players.players.find(p=>p.id===f.seatId),dataCards=actor.hand.slice(0,3);for(const card of dataCards)card.incomeCode=3;
 const original=structuredClone(changed),gain=plans.reorganization({state:changed,seatId:f.seatId,actions:legal,session});assert.equal(gain.netGain,2.5,'one known data is 3 final points plus .5 resource minus one hand card');assert(dataCards.some(card=>card.id===legal.find(a=>a.actionId===gain.selectedActionId).target.cardInstanceId));
 const capped=structuredClone(session);capped.queue[0].payload.pendingIncomeGain={availableData:2};const done=plans.reorganization({state:changed,seatId:f.seatId,actions:legal,session:capped});assert(legal.find(a=>a.actionId===done.selectedActionId).target.done,'already selected reward consumes the remaining capacity before choosing another card');assert(done.gains.filter(g=>dataCards.some(c=>c.id===g.cardId)).every(g=>g.netGain===-1));assert.deepEqual(changed,original);
 const hidden=structuredClone(changed);hidden.cards.drawPileCardIds.reverse();assert.deepEqual(plans.reorganization({state:hidden,seatId:f.seatId,actions:legal,session}),gain,'unknown draw identities cannot affect the fixed decision');
 assert.equal(plans.reorganization({state:working,seatId:f.seatId,actions:legal,session:{...session,queue:[]}}),null,'other discard/payment rules are not reorganization');
 const cold=open(pending),picked=[];for(const current of [c,cold]){const p=createAnalysisPort({composition:current,seatId:f.seatId,maxCacheEntries:0});p.setResourcePlanning(true);p.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});const root=p.openRoot(),local=p.localDecisionSpec(root);assert.equal(local.kind,'fixed-reorganization');picked.push(local.selectedActionId);p.close();}
 assert.equal(picked[0],picked[1]);submit(c,picked[0]);submit(cold,picked[1]);assert.deepEqual(normalized(c.lifecycle.save().envelope),normalized(cold.lifecycle.save().envelope));cold.dispose();
 assert(c.lifecycle.restore(before).ok);const macro=q.expandResourcePlan(n,plan,()=>null);assert(macro.complete);assert.equal(macro.submissions,2);assert(!macro.fallbackReason);assert.equal(macro.prefixes[1].action.target.done,true);assert.equal(macro.node.status,'stable');assert.deepEqual(c.lifecycle.save().envelope,before);
 const interrupted=q.expandResourcePlan(n,plan,count=>count>=1?'transition-budget':null);assert(!interrupted.complete);assert.equal(interrupted.submissions,1);assert.deepEqual(c.lifecycle.save().envelope,before);q.close();c.dispose();
}
// A genuinely profitable chain uses the native queue, stops at capacity, and is
// rebuilt identically after the first real discard without persisting a new plan.
{
 const f=JSON.parse(read('adhoc/ai-decision-corpus-20261029-reorg-v1/step295-20261029-v1.json')),s=JSON.parse(f.compositionEnvelope.committedState),actor=s.players.players.find(p=>p.id===f.seatId);
 const dataIds=actor.hand.filter(c=>c.id!=='card-57-0').slice(0,3).map(c=>c.id);for(const card of actor.hand)if(dataIds.includes(card.id))card.incomeCode=3;
 const c=open({...f.compositionEnvelope,committedState:JSON.stringify(s)}),before=c.lifecycle.save().envelope,q=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});q.setResourcePlanning(true);q.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});
 const root=q.openRoot(),plan=q.resourceSpec(root).plans.find(p=>p.goal.cardId==='card-57-0'),macro=q.expandResourcePlan(root,plan,()=>null);assert(macro.complete);assert.equal(macro.submissions,4);assert(!macro.fallbackReason);assert.equal(macro.prefixes.filter(p=>dataIds.includes(p.action.target?.cardInstanceId)).length,2);assert(macro.prefixes.at(-1).action.target.done);
 const end=macro.node.observation.publicState.players.find(p=>p.playerId===f.seatId);assert.equal(end.availableData,6);assert.equal(macro.node.observation.selfState.hand.filter(c=>dataIds.includes(c.id)).length,1);assert.equal(createStateValueEvaluator(f.seatId)(macro.node.observation)-createStateValueEvaluator(f.seatId)(root.observation),3,'native leaf gain equals two profitable discards minus play cost');assert.deepEqual(c.lifecycle.save().envelope,before);
 submit(c,macro.prefixes[0].action.actionId);submit(c,macro.prefixes[1].action.actionId);const checkpoint=c.lifecycle.save().envelope,cold=open(checkpoint);
 for(let i=2;i<macro.prefixes.length;i++){
  const chosen=[];for(const current of [c,cold]){const port=createAnalysisPort({composition:current,seatId:f.seatId,maxCacheEntries:0});port.setResourcePlanning(true);const node=port.openRoot(),choice=port.localDecisionSpec(node);chosen.push(choice.selectedActionId);port.close();}
  assert.equal(chosen[0],macro.prefixes[i].action.actionId);assert.equal(chosen[1],chosen[0]);submit(c,chosen[0]);submit(cold,chosen[1]);
 }
 assert.deepEqual(normalized(c.lifecycle.save().envelope),normalized(cold.lifecycle.save().envelope));q.close();c.dispose();cold.dispose();
}
console.log(JSON.stringify({localFinalMarkAndScan:'passed',nativeMarkOptions:4,retainedMarkOptions:1,scanPurposes:scans.length,nativeRecoveryAndRootIsolation:true,stableRestoreSkipped:true}));

// A completed non-scoring task remains a fixed payout when the next actor
// is the same seat and an existing fossil stays in transit.
{
 const envelope=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'final-own-b117-20261110-v1.fixture.json.gz'))));
 const seed=JSON.parse(envelope.committedState).meta.seed,seatId='player-white';
 const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
   projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId,[],{cheap:v?.cheap===true,valueOnly:v?.valueOnly===true})});
 k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(envelope).ok);
 const initial=c.lifecycle.save().envelope,port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
 const evaluate=createStateValueEvaluator(seatId),pending=(node)=>port.expand(node,node.legalActions.find(a=>a.family==='end_turn').actionId);
 const trade=node=>node.legalActions.find(a=>a.family==='quick_trade'&&a.target.tradeId==='credits-for-energy');
 try{
  const root=port.openRoot();port.setResourcePlanning(true);port.setDecisionPlanning({finalMarkPlanning:true});
  for(const branch of [null,trade(root)]){
   assert(branch===null||branch.actionId);
   const start=branch?port.expand(root,branch.actionId):root;
   const menu=pending(start),spec=port.localDecisionSpec(menu);
   assert.equal(spec.reason,'greedy-final-end-task-no-overflow');
   assert.equal(spec.excludedActionIds.length,1);
   const after=port.expand(menu,spec.selectedActionId);
   assert.equal(after.status,'turn-boundary');assert.deepEqual(after.legalActions,[]);
   assert.deepEqual(c.lifecycle.save().envelope,initial);
   if(branch)submit(c,branch.actionId);
   submit(c,actions(c).find(a=>a.family==='end_turn').actionId);
   assert(actions(c).some(a=>a.actionId===spec.selectedActionId));
   const session=c.lifecycle.save().envelope.session.session,knownCards=new Set([session.queue[0].payload.cardInstanceId]);
   assert.equal(plans.pureOptional({state:session.workingState,seatId,actions:actions(c),session,knownCards}),null,
     'an unknown reserved card can still observe the task payout');
   submit(c,spec.selectedActionId);
   assert.equal(evaluate(port.valueObservation(after)),evaluate(c.projection({role:'player',playerId:seatId,valueOnly:true}).state));
   const next=JSON.parse(c.lifecycle.save().envelope.committedState),old=JSON.parse(initial.committedState);
   assert.equal(next.turn.currentPlayerId,seatId);assert.deepEqual(next.aliens.chong,old.aliens.chong);
   assert.deepEqual(next.meta.rngState,old.meta.rngState);
   assert(c.lifecycle.restore(initial).ok);
  }
  assert.equal(port.getDiagnostics().provedQuietEndMenus,1);
  assert.equal(port.getDiagnostics().provedFinalEndTaskInputs,2);
 }finally{port.close();c.dispose();}
}

// A normal fourth-round handover leaves in-transit cargo where it is.
// An actual arrival still uses the full native handoff.
{
 const envelope=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'final-foreign-cargo-end-20261111-v1.fixture.json.gz'))));
 const seatId='player-white',source=JSON.parse(envelope.committedState),c=open(envelope);
 const port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
 try{
  const initial=c.lifecycle.save().envelope;
  const root=port.openRoot();port.setResourcePlanning(true);
  const action=root.legalActions.find(a=>a.family==='end_turn');
  const knownCards=new Set(source.players.players.find(p=>p.id===seatId).reservedCards.map(c=>c.id));
  const cargo=source.pieces.rockets.find(r=>r.fossilId);
  assert(cargo);assert.equal(plans.hasPendingFossilArrival(source),false);
  const preview=plans.previewFinalEndPrelude({state:source,seatId,action,knownCards,allowSameSeat:true});
  assert(preview?.finished,'ordinary end-turn handover with stationary cargo has a complete preview');
  const child=port.expand(root,action.actionId);
  assert.equal(child.status,'other-owner');assert.deepEqual(child.legalActions,[]);
  assert.equal(port.getDiagnostics().submissionCount,0);
  assert.deepEqual(c.lifecycle.save().envelope,initial);
  submit(c,action.actionId);
  const end=c.lifecycle.save().envelope,next=JSON.parse(end.committedState);
  assert.equal(end.session,null);assert.notEqual(next.turn.currentPlayerId,seatId);
  assert.deepEqual(preview.finished,next);
  assert.deepEqual(next.aliens.chong,source.aliens.chong);
  assert.deepEqual(next.meta.rngState,source.meta.rngState);
  const value=createStateValueEvaluator(seatId);
  assert.equal(value(port.valueObservation(child)),value(c.projection({role:'player',playerId:seatId,valueOnly:true}).state));

  const arrived=structuredClone(source);
  const destination=Object.values(arrived.aliens.chong.transportTasksByRocketId).find(task=>task.fossilId===cargo.fossilId).destinationPlanetId;
  const {collectPlanetLocations}=require('../../solar-system/core');
  const {x,y}=collectPlanetLocations(arrived.solarSystem).find(p=>p.planetId===destination);
  const carrier=arrived.pieces.rockets.find(r=>r.id===cargo.id);
  Object.assign(carrier,{sectorX:x,sectorY:y});
  assert(plans.hasPendingFossilArrival(arrived));
  assert.equal(plans.previewFinalEndPrelude({state:arrived,seatId,action,knownCards,allowSameSeat:true}),null);
 }finally{port.close();c.dispose();}
}

// Closing a land session with a score-only pink trace must not change RNG,
// scoring attribution or placement. The region reward still opens its real menu.
{
 const envelope=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'last-plain-pink-20261110-v1.fixture.json.gz'))));
 const seed=JSON.parse(envelope.committedState).meta.seed,seatId='player-white';
 const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
   projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId,[],{cheap:v?.cheap===true,valueOnly:v?.valueOnly===true})});
 k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(envelope).ok);
 const initial=c.lifecycle.save().envelope,s=initial.session.session;
 const port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
 const nativePort=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
 try{
  const root=port.openRoot(),nativeRoot=nativePort.openRoot();port.setResourcePlanning(true);
  const menu=actions(c),extra=menu.find(a=>a.target.stateExtra),printed=menu.find(a=>a.target.speciesId==='chong'&&a.target.position===1);
  const region=menu.find(a=>a.target.speciesId==='amiba'&&a.target.position===3);
  assert(extra&&printed&&region);
  const known=new Set(s.workingState.players.players.find(p=>p.id===seatId).reservedCards.map(c=>c.id));
  assert(known.size);
  assert.equal(plans.previewLastPlainPinkTrace(s,printed,new Set()),null);
  assert.equal(plans.previewLastPlainPinkTrace(s,region,known),null);
  for(const a of [extra,printed,region]){
   const child=port.expand(root,a.actionId);
   assert.deepEqual(c.lifecycle.save().envelope,initial);
   submit(c,a.actionId);
   const native=c.lifecycle.save().envelope;
   if(a!==region){
    assert.equal(native.session,null);
    assert.deepEqual(plans.previewLastPlainPinkTrace(s,a,known),JSON.parse(native.committedState));
    assert.deepEqual(child.observation,nativePort.expand(nativeRoot,a.actionId).observation);
   }else{
    assert(native.session,'region reward must still be resolved');
    assert.deepEqual(child.legalActions,actions(c));
   }
   assert(c.lifecycle.restore(initial).ok);
  }
  assert.equal(port.getDiagnostics().provedLastPlainPinkInputs,2);
 }finally{nativePort.close();port.close();c.dispose();}
}

// A real hidden fossil or public refill remains a boundary after the exact
// trace settlement. Search cannot act on the newly exposed identities.
{
 const witnesses=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'pink-fossil-refill-20261110-v1.fixture.json.gz'))));
 for(const [index,{envelope,actionId}] of witnesses.entries()){
  const seed=JSON.parse(envelope.committedState).meta.seed,seatId='player-white';
  const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
    projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId,[],{cheap:v?.cheap===true,valueOnly:v?.valueOnly===true})});
  k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(envelope).ok);
  const initial=c.lifecycle.save().envelope;
  const port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0}),native=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
  try{
   const root=port.openRoot(),nativeRoot=native.openRoot();port.setResourcePlanning(true);
   const actual=port.expand(root,actionId),control=native.expand(nativeRoot,actionId);
   const boundary=index===0?'hidden_chong_fossil_offer':'hidden_card_reveal';
   assert.equal(actual.status,'information-barrier');
   assert.equal(actual.boundary,boundary);
   assert.deepEqual(actual.legalActions,[]);
   assert.deepEqual(actual.observation,control.observation);
   assert.deepEqual(actual.boundary,control.boundary);
   assert.deepEqual(c.lifecycle.save().envelope,initial);
   assert.equal(port.getDiagnostics()[index===0?'provedPinkFossilMenus':'provedPinkRefills'],1);
  }finally{native.close();port.close();c.dispose();}
 }
}

// The last-round satellite setup is one funded plan. It preserves the paid
// landing card, reaches the native end-of-turn boundary, and keeps the refill hidden.
{
 const {root:envelope,actions:expected,end}=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'satellite-scan-setup-20261110-v1.fixture.json.gz'))));
 const seed=JSON.parse(envelope.committedState).meta.seed,seatId='player-white';
 const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
   projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId,[],{cheap:v?.cheap===true,valueOnly:v?.valueOnly===true})});
 k.newGame({seed});const c=k.composition;
 function planFromCurrent(){
  const port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
  try{
   const root=port.openRoot();
   port.setMovementPlanning(true);port.setCardPickPlanning(true);port.setResourcePlanning(true);
   port.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});
   const plan=port.resourceSpec(root)?.plans.find(x=>x.goal.kind==='satellite-scan-setup');
   if(!plan)return null;
   const result=port.expandResourcePlan(root,plan,()=>null);
   return {plan,actions:result.prefixes.map(x=>x.action),status:result.node.status,boundary:result.node.boundary,
    value:createStateValueEvaluator(seatId)(port.valueObservation(result.node))};
  }finally{port.close();}
 }
 try{
  assert(c.lifecycle.restore(envelope).ok);
  const start=c.lifecycle.save().envelope,proof=planFromCurrent();
  assert.deepEqual(c.lifecycle.save().envelope,start);
  assert.equal(proof.actions.length,14);
  assert.deepEqual(proof.actions.map(a=>a.actionId),expected.map(a=>a.actionId));
  assert.equal(proof.status,'information-barrier');
  assert.equal(proof.boundary,'hidden_card_reveal');
  assert.equal(proof.value,212); // Includes the once-payable public Amiba pink reward.
  for(let i=0;i<expected.length;i++){
   if(i===1||i===2){
    const cold=planFromCurrent();
    assert.deepEqual(cold.actions.map(a=>a.actionId),expected.slice(i).map(a=>a.actionId));
   }
   submit(c,expected[i].actionId);
  }
  assert.deepEqual(c.lifecycle.save().envelope,end);
  const poor=JSON.parse(envelope.committedState);
  poor.players.players.find(p=>p.id===seatId).resources.credits=1;
  assert(c.lifecycle.restore({...envelope,committedState:JSON.stringify(poor)}).ok);
  assert.equal(planFromCurrent(),null,'scanning must leave enough money to play the landing card');
 }finally{c.dispose();}
}

// Equal public card uses must refill the same slots in the same order when
// comparing two empty sectors. A live signal or missing marker breaks that pair.
{
 const c=open(),s=JSON.parse(c.lifecycle.save().envelope.committedState);c.dispose();
 const seatId=fixture.seatId,p=s.players.players.find(x=>x.id===seatId),cards=require('../cards/deck');
 const science=require('../effects/science-session');
 const make=id=>cards.createCommittedCardInstance(s,cards.CARD_CATALOG.find(x=>x.card_id===id),'scan-pair');
 s.turn.currentPlayerId=seatId;s.turn.roundNumber=3;p.resources.additionalPublicScan=1;
 for(const a of Object.values(s.aliens.aliens)){a.revealed=false;a.traces={blue:null,pink:null,yellow:null};}
 for(const bucket of Object.values(s.data.nebulae))for(const token of bucket.tokens){token.replacedByPlayerId=null;token.replacedByPlayerColor=null;token.replacementOrder=null;}
 s.cards.publicCards=['dlc_30.png','dlc_31.png','b_14.webp'].map(make);
 const [first,,last]=s.cards.publicCards;
 const options={mode:'public',selected:0,max:2,consumeMarkers:true};
 const session={queue:[{payload:{options}}],journal:{actions:[{action:{family:'scan'}}]}};
 const actions=science.listPublicScanChoices(s).map((a,i)=>({...a,actionId:'scan-choice-'+i}));
 const ids=['sector-1-a','sector-2-a'];
 for(const nebulaId of ids){
  const goal=plans.scanGoals({state:s,seatId,actions,session}).find(g=>g.nebulaId===nebulaId);
  assert.deepEqual(goal.publicBluePair,[last.id,first.id]);
  const step=plans.scanStep({state:s,seatId,goal,actions,status:'decision',session});
  const selected=actions.find(a=>a.actionId===step.actionId);
  assert.equal(selected.target.nebulaId,nebulaId);
  assert.equal(selected.target.cardInstanceId,last.id);
 }
 const token=s.data.nebulae[ids[0]].tokens[0];
 token.replacedByPlayerId=seatId;token.replacedByPlayerColor=p.color;
 assert(plans.scanGoals({state:s,seatId,actions,session}).every(g=>!g.publicBluePair));
 token.replacedByPlayerId=null;token.replacedByPlayerColor=null;
 p.resources.additionalPublicScan=0;
 assert(plans.scanGoals({state:s,seatId,actions,session}).every(g=>!g.publicBluePair));
}
