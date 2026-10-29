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
