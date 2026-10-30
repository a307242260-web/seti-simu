'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const api=require('./card-pick-planning'),cards=require('../cards/deck'),effects=require('../cards/effects'),data=require('../data');
const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/ai-decision-corpus-20261023-v1/case-062-20261023-v1.json'))),initial=JSON.parse(f.compositionEnvelope.committedState),seatId=f.seatId;
const own=s=>s.players.players.find(p=>p.id===seatId);
const card=(entry,id)=>cards.createCardInstance(entry,id);
const catalog=cards.CARD_CATALOG;
const weak=catalog.filter(e=>!effects.buildPlayEffects(card(e,'probe')).every(e=>e.type==='gain_resources'&&Object.keys(e.options?.gain||{}).every(k=>k==='score')));
function state(){const s=structuredClone(initial),p=own(s);p.mainActionCompleted=true;p.reservedCards=[];p.hand=weak.slice(0,5).map((e,i)=>card(e,'h'+i));p.resources.handSize=p.hand.length;p.dataState=data.createDefaultDataState();p.resources.availableData=0;p.resources.credits=6;p.resources.energy=6;p.resources.publicity=3;s.cards.publicCards=weak.slice(5,8).map((e,i)=>card(e,'offer'+i));return s;}
const trades=[['credits-for-card',{credits:2}],['energy-for-card',{energy:2}],['publicity-for-card',{publicity:3}],['cards-for-pick-card',{handSize:2}]].map(([id,cost])=>({actionId:id,family:'quick_trade',target:{tradeId:id},payload:{cost,gain:{handSize:1}}}));
const stop={actionId:'end',family:'end_turn',target:{}};
const offers=s=>s.cards.publicCards.map((c,i)=>({actionId:'pick:'+c.id,family:'choose_card',target:{source:'public',slotIndex:i,cardInstanceId:c.id},payload:{}}));
function plan(s,actions=trades.concat(stop),planner=api.createCardPickPlanner(),extra={}){return planner.plan({state:s,seatId,actions,status:'stable',...extra});}
// A legal trade is not a purpose. No shortage and remaining technology means no acquisition branch.
{
 const s=state(),before=structuredClone(s),r=plan(s);assert.equal(r.reason,'no-pick-purpose');assert.equal(r.selectedActionId,null);assert.deepEqual(r.retainedActionIds,['end']);assert.deepEqual(s,before);assert.equal(r.isEquivalence,false);
}
// The funded fourth computer slot genuinely lacks a spare income card.
{
 const s=state(),p=own(s);p.hand=[];p.resources.handSize=0;p.resources.availableData=4;const r=plan(s);assert.equal(r.goal.kind,'income');assert(r.selectedActionId);assert(r.selection.cardId);
 const blocked=structuredClone(s);own(blocked).resources.availableData=3;assert.equal(plan(blocked).selectedActionId,null);
}
// One missing data point is attached to completing analysis, rather than filling an arbitrary pool.
{
 const s=state(),p=own(s);p.mainActionCompleted=false;
 const neutral=weak.filter(e=>!(cards.getDiscardActionRewardForCard(card(e,'x'))?.dataCount));p.hand=neutral.slice(0,2).map((e,i)=>card(e,'nd'+i));p.resources.handSize=2;p.resources.availableData=5;
 const dataEntry=catalog.find(e=>cards.getDiscardActionRewardForCard(card(e,'x'))?.dataCount===1);s.cards.publicCards=[card(dataEntry,'data-offer')];
 const r=plan(s);assert.equal(r.goal.kind,'data');assert.equal(r.selection.cardId,'card-data-offer');
 const blocked=structuredClone(s);own(blocked).resources.availableData=4;assert.equal(plan(blocked).selectedActionId,null);
}
// A concrete movement target lacks exactly one point, with endpoint funds preserved after paying.
{
 const s=state(),p=own(s);p.mainActionCompleted=false;p.hand=[];p.resources.handSize=0;p.resources.energy=2;
 const moveEntry=catalog.find(e=>cards.getDiscardActionMoveRewardForCard(card(e,'x'))?.movementPoints===1);s.cards.publicCards=[card(moveEntry,'move-offer')];
 const target={requirementId:'rocket:goal',required:{credits:1,energy:3},targetBenefit:{score:8}};
 const r=plan(s,trades.concat(stop),undefined,{endpoints:()=>[target]});assert.equal(r.goal.kind,'move');assert.equal(r.selection.cardId,'card-move-offer');assert.notEqual(r.selectedActionId,'energy-for-card');
}
// Publicity with no takeable technology can buy a card; retained publicity scoring prevents declaring it useless.
{
 const s=state(),p=own(s);p.hand=p.hand.slice(0,2);p.resources.handSize=2;for(const id of Object.keys(s.tech.stacks))p.techState.ownedTiles[id]=true;
 const r=plan(s);assert.equal(r.goal.kind,'unused-publicity');assert.equal(r.selectedActionId,'publicity-for-card');
}
// Conditional card benefits do not become an unrestricted exceptional-card permission.
{
 const s=state();s.cards.publicCards=[card(catalog.find(e=>e.card_id==='b_13.webp'),'conditional-marker-card')];
 assert.equal(plan(s).selectedActionId,null);
}
// Ordinary publicity scoring remains a reason to keep publicity even after technologies are exhausted.
{
 const s=state(),p=own(s);p.hand=p.hand.slice(0,2);p.resources.handSize=2;for(const id of Object.keys(s.tech.stacks))p.techState.ownedTiles[id]=true;
 const entry=catalog.find(e=>{const score=effects.getCardModel(card(e,'score'))?.endGameScoring;return score?.kind==='remainingResource'&&score.resource==='publicity';});assert(entry);p.reservedCards=[card(entry,'pub-score')];assert.equal(plan(s).selectedActionId,null);
}
// A fixed native acquisition selects exactly one card and caches that selection across changed wallets and envelopes.
{
 const s=state(),planner=api.createCardPickPlanner(),before=structuredClone(s);
 const first=plan(s,offers(s),planner,{status:'decision'});assert(first.fixed);assert.equal(first.retainedActionIds.length,1);assert.equal(first.kind,'fixed-card-plan');const stats=planner.getDiagnostics();
 const changed=structuredClone(s);own(changed).resources.credits+=1;own(changed).resources.energy-=1;
 const second=plan(changed,offers(changed).map(a=>({...a,actionId:a.actionId+':new-version',stateVersion:99})),planner,{status:'decision'});
 assert.equal(second.selection.cardId,first.selection.cardId);assert.equal(second.selection.cache,'hit');assert.equal(planner.getDiagnostics().rankingCacheMisses,stats.rankingCacheMisses);assert.equal(planner.getDiagnostics().rankedCards,stats.rankedCards);assert.deepEqual(s,before);
 const changedOffer=structuredClone(s);changedOffer.cards.publicCards[0]=card(weak[10],'new-offer');plan(changedOffer,offers(changedOffer),planner,{status:'decision'});assert.equal(planner.getDiagnostics().rankingCacheMisses,stats.rankingCacheMisses+1);
 const newGoal=structuredClone(s);own(newGoal).hand=[];own(newGoal).resources.handSize=0;own(newGoal).resources.availableData=4;const income=plan(newGoal,offers(newGoal),planner,{status:'decision'});assert.equal(income.goal.kind,'income');assert.equal(planner.getDiagnostics().rankingCacheMisses,stats.rankingCacheMisses+2);
 const hidden=structuredClone(s);hidden.cards.drawPileCardIds.reverse();assert.equal(plan(hidden,offers(hidden),planner,{status:'decision'}).selectedActionId,first.selectedActionId);
}
// A committed company swap uses its native public menu without source/pick prefixes.
// Hand-swap identity and other company rewards keep their existing policy boundary.
{
 const s=state(),planner=api.createCardPickPlanner(),native=s.cards.publicCards.map((c,i)=>({actionId:'company-public:'+c.id,family:'choose_card',target:{choiceId:`public:${i}:${c.id}`,slotIndex:i,cardInstanceId:c.id},payload:{handCardInstanceId:own(s).hand[0].id}}));
 const session={queue:[{payload:{step:'swap_public',handCardInstanceId:own(s).hand[0].id}}]};
 const first=plan(s,native,planner,{status:'decision',session});assert(first?.fixed);assert.equal(first.retainedActionIds.length,1);assert.equal(first.goal.kind,'free-reward');
 const changed=structuredClone(s);own(changed).resources.credits++;
 const next=plan(changed,native.map(a=>({...a,actionId:a.actionId+':new'})),planner,{status:'decision',session});assert.equal(next.selection.cardId,first.selection.cardId);assert.equal(next.selection.cache,'hit');
 assert.equal(plan(s,native,planner,{status:'decision',session:{queue:[{payload:{step:'public_card',abilityId:'mission_publicity_pick_income'}}]}}),null);
 const scan=native.map(a=>({...a,target:{...a.target,nebulaId:'sector-1-a'}}));assert.equal(plan(s,scan,planner,{status:'decision',session}),null);
}
// A committed swap drops one least useful known hand card, keeping the incoming purpose explicit.
{
 const s=state(),p=own(s),planner=api.createCardPickPlanner();
 const available=p.hand.map(c=>({actionId:'swap:'+c.id,family:'choose_card',target:{choiceId:'hand:'+c.id,cardInstanceId:c.id}}));
 const session={queue:[{payload:{step:'swap_hand'}}]};
 const r=plan(s,available,planner,{status:'decision',session});assert(r?.fixed);assert.equal(r.retainedActionIds.length,1);assert.equal(r.goal.kind,'company-swap');assert.equal(r.reason,'fixed-swap-outgoing');assert.equal(r.isEquivalence,false);
 assert.equal(plan(s,available,planner,{status:'decision',session:{queue:[{payload:{step:'income_card'}}]}}),null);
 const b=structuredClone(s);b.cards.drawPileCardIds.reverse();assert.equal(plan(b,available,planner,{status:'decision',session}).selectedActionId,r.selectedActionId);
}
// Native fixed payment and selection are one plan edge; all four physical inputs remain charged.
{
 const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation'),{createAnalysisPort}=require('./analysis-port'),{searchDecision}=require('./decision-search'),{createStateValueEvaluator}=require('./state-value'),agent=require('./search-agent');
 const seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);
 assert(c.inputPort.submitQuickAction(c.inputPort.enumerateActions({}).find(a=>a.target?.tradeId==='cards-for-pick-card')).ok);const before=c.lifecycle.save().envelope,evaluate=createStateValueEvaluator(seatId);
 function run(budget,clock){const port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0}),root=port.openRoot();let wrapped=port;
  if(clock)wrapped={...port,expandWithCardPick(node,id,check){return port.expandWithCardPick(node,id,count=>{clock.time+=2;return check(count);});}};
  const r=searchDecision({port:wrapped,root,evaluate,modelKey:evaluate.modelKey,...agent.OPTIONS,budget,...(clock?{now:()=>clock.time}:{})});assert.deepEqual(c.lifecycle.save().envelope,before);port.close();return r;}
 const complete=run({transitions:256,nodes:257,frontier:256,milliseconds:15000});assert(complete.complete);assert.equal(complete.diagnostics.transitions,4);assert.equal(complete.diagnostics.graphNodes,2);assert.equal(complete.diagnostics.certificateNodes,3);assert.equal(complete.candidates.length,1);assert.equal(complete.candidates[0].kind,'fixed-card-plan');assert(complete.lines[0].edges[0].fixedChoices.some(s=>s.reason==='fixed-card-pick'));
 const limited=run({transitions:1,nodes:257,frontier:256,milliseconds:15000});assert(!limited.complete);assert.equal(limited.stopReason,'transition-budget');assert.equal(limited.diagnostics.transitions,1);assert.equal(limited.actionId,null);assert.equal(limited.planContinuation,null);
 for(const [kind,budget] of [['node-budget',{transitions:256,nodes:2,frontier:256,milliseconds:15000}],['frontier-budget',{transitions:256,nodes:257,frontier:1,milliseconds:15000}]]){const r=run(budget);assert(!r.complete);assert.equal(r.stopReason,kind);assert.equal(r.diagnostics.transitions,1);assert.equal(r.actionId,null);assert.equal(r.planContinuation,null);}
 const timed=run({transitions:256,nodes:257,frontier:256,milliseconds:5},{time:0});assert(!timed.complete);assert.equal(timed.stopReason,'watchdog');assert.equal(timed.actionId,null);assert.equal(timed.planContinuation,null);assert(timed.diagnostics.transitions<4);c.dispose();
}
// Legacy equal-V pick reductions cannot override the card identity fixed by the purpose.
{
 const {searchDecision}=require('./decision-search'),{createStateValueEvaluator}=require('./state-value');
 const obs={terminal:false,selfState:{playerId:'p1',hand:[]},publicState:{roundNumber:2,players:[{playerId:'p1',score:0,finalScore:0,credits:1,energy:0,publicity:0,availableData:0,additionalPublicScan:0,income:{credits:0,energy:0,publicity:0,availableData:0,additionalPublicScan:0,handSize:0}}]}};
 const actions=['a-wrong','z-fixed'].map(actionId=>({actionId,actorId:'p1',family:'choose_card',target:{kind:'trade-card-selection'}})),root={status:'decision',observation:obs,legalActions:actions},leaf={status:'information-barrier',observation:{...obs,selfState:{playerId:'p1',hand:[{id:'known-fixed-card'}]}},legalActions:[]};
 const spec={fixed:true,kind:'fixed-card-plan',policy:api.VERSION,goal:{kind:'data',id:'critical-data'},selectedActionId:'z-fixed',retainedActionIds:['z-fixed'],excludedActionIds:['a-wrong'],isEquivalence:false};
 const port={identity:n=>n===root?'root':'leaf',expand:()=>assert.fail('fixed plan must use its native macro'),cardPickSpec:n=>n===root?spec:null,cardTradeBound:()=>({handDelta:1,proof:'old-numeric-equivalence'}),
  expandWithCardPick(node,id){assert.equal(id,'z-fixed');return{complete:true,node:leaf,submissions:1,prefixes:[{node:root,action:actions[1]}],fixedChoices:[spec]};}};
 const r=searchDecision({port,root,evaluate:createStateValueEvaluator('p1'),cardPickPlanning:true,cardChoiceEquivalence:true});assert(r.complete);assert.equal(r.actionId,'z-fixed');
}
console.log(JSON.stringify({purposeCardPick:'passed',noUnmotivatedTrades:true,incomeMoveDataAndUnusedPublicity:true,fixedCardAndSemanticCache:true}));
// A funded fourth computer slot needs a spare income card when the only held
// card is a valuable known future purpose. Native currency exchange can fund it.
{
 const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-037-20261030-v1.json'))),session=f.compositionEnvelope.session.session,s=session.workingState,before=structuredClone(s),planner=api.createCardPickPlanner(),actions=offers(s);
 const choose=state=>planner.plan({state,seatId:f.seatId,actions,status:'decision',session});
 const r=choose(s);assert.equal(r.goal.kind,'ready-income');assert.equal(r.goal.fundsCardId,'card-15-0');assert.equal(r.selection.cardId,'card-18-0','energy income plus the existing energy funds DLC9 through native2-to1 exchange');assert.equal(r.retainedActionIds.length,1);assert.equal(r.isEquivalence,false);
 const hidden=structuredClone(s);hidden.cards.drawPileCardIds.reverse();assert.equal(choose(hidden).selection.cardId,r.selection.cardId);assert.equal(choose(hidden).selection.cache,'hit');
 const short=structuredClone(s);short.players.players.find(p=>p.id===f.seatId).resources.availableData=3;assert.notEqual(choose(short).goal.kind,'ready-income');
 const funded=structuredClone(s);funded.players.players.find(p=>p.id===f.seatId).resources.credits=3;assert.notEqual(choose(funded).goal.kind,'ready-income');
 const noEnergy=structuredClone(s);noEnergy.players.players.find(p=>p.id===f.seatId).resources.energy=0;assert.equal(choose(noEnergy).selection.cardId,'card-17-0','one energy alone cannot pay the two-energy exchange');
 assert.deepEqual(s,before);
}
// The identified income and exchange actually pay the preserved card through
// native actions. Unknown replacement/drawn card identities are never used.
{
 const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation');
 const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-037-20261030-v1.json'))),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);
 try{
  function legal(){return c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});}
  function submit(match){const d=c.inspect().session?.decision,a=legal().find(match);assert(a);const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));}
  submit(a=>a.target?.cardInstanceId==='card-18-0');
  for(let i=0;i<4;i++){submit(a=>a.family==='place_data');submit(a=>a.target?.target==='computer');}
  submit(a=>a.target?.cardInstanceId==='card-18-0'&&a.target?.choiceId?.startsWith('income:'));
  let p=JSON.parse(c.lifecycle.save().envelope.committedState).players.players.find(p=>p.id===f.seatId);assert.equal(p.resources.credits,2);assert.equal(p.resources.energy,2);assert.deepEqual(p.hand.map(c=>c.id),['card-15-0']);
  submit(a=>a.target?.tradeId==='energy-for-credit');
  p=JSON.parse(c.lifecycle.save().envelope.committedState).players.players.find(p=>p.id===f.seatId);assert.equal(p.resources.credits,3);assert.equal(p.resources.energy,0);
  submit(a=>a.family==='end_turn');submit(a=>a.family==='play_card'&&a.target?.cardInstanceId==='card-15-0');submit(a=>a.target?.tileId==='purple4');
  p=JSON.parse(c.lifecycle.save().envelope.committedState).players.players.find(p=>p.id===f.seatId);assert(p.techState.ownedTiles.purple4);assert.equal(p.resources.credits,0);
 }finally{c.dispose();}
}
// A free pick before an already committed own income reward has an income
// purpose, even when the player already holds cards and completed the main action.
{
 const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-040-20261030-v1.json'))),session=f.compositionEnvelope.session.session,s=session.workingState,before=structuredClone(s),planner=api.createCardPickPlanner(),actions=offers(s);
 const choose=(state=s,pending=session)=>planner.plan({state,seatId:f.seatId,actions,status:'decision',session:pending});
 const r=choose();assert.equal(r.goal.kind,'queued-income');assert.equal(r.goal.fundsCardId,'card-15-0');assert.equal(r.selection.cardId,'card-40-0','equal income value:1credit reduces the known DLC9 funding gap;1unknown card does not');assert.equal(r.retainedActionIds.length,1);assert.equal(r.isEquivalence,false);
 const hidden=structuredClone(s);hidden.cards.drawPileCardIds.reverse();assert.equal(choose(hidden).selection.cardId,r.selection.cardId);assert.equal(choose(hidden).selection.cache,'hit');
 const without={...session,queue:session.queue.slice(0,2)},fallback=choose(s,without);assert.equal(fallback.goal.kind,'free-reward');assert.equal(fallback.selection.cardId,'card-17-0','ordinary free pick remains a distinct purpose');
 const otherOwner={...session,queue:session.queue.map((e,i)=>i===2?{...e,ownerId:'player-blue'}:e)};assert.equal(choose(s,otherOwner).goal.kind,'free-reward');
 const conditional={...session,queue:[session.queue[0],{type:'unresolved-conditional',ownerId:f.seatId},...session.queue.slice(1)]};assert.equal(choose(s,conditional).goal.kind,'free-reward','unknown queue effects are not assumed to grant income');
 const funded=structuredClone(s);funded.players.players.find(p=>p.id===f.seatId).resources.credits=3;const cash=choose(funded);assert.equal(cash.selection.cardId,'card-17-0');assert.equal(cash.selection.cache,'miss','a changed funding need invalidates income selection');
 assert.deepEqual(s,before);
}
// The actual queued orbit reward keeps one fixed acquisition and executes the
// native scan/income tail, including recovery when no old plan is supplied.
{
 const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation'),{createAnalysisPort}=require('./analysis-port'),{searchDecision}=require('./decision-search'),{createStateValueEvaluator}=require('./state-value'),agent=require('./search-agent');
 const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-040-20261030-v1.json'))),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope;
 try{
  for(const limit of [256,1]){
   const port=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});try{
    const root=port.openRoot(),r=searchDecision({port,root,evaluate:createStateValueEvaluator(f.seatId),...agent.OPTIONS,budget:{transitions:limit,nodes:512,frontier:256,milliseconds:15000}});
    assert.deepEqual(c.lifecycle.save().envelope,before);
    if(limit===1){assert(!r.complete);assert.equal(r.actionId,null);assert.equal(r.planContinuation,null);assert.equal(r.stopReason,'transition-budget');}
    else{assert(r.complete);assert.equal(root.legalActions.find(a=>a.actionId===r.actionId).target.cardInstanceId,'card-40-0');assert.equal(r.candidates.length,1);assert.equal(r.value,59.5); // Includes the visible purple4 publicity bonus in held DLC9 capital.
    assert(r.diagnostics.transitions<256);}
   }finally{port.close();}
  }
 }finally{c.dispose();}
}
// A committed swap can acquire the precise income needed to fund the preserved main card.
{
 const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-046-20261030-v1.json'))),session=f.compositionEnvelope.session.session,s=session.workingState,before=structuredClone(s),planner=api.createCardPickPlanner(),actions=s.cards.publicCards.map((c,i)=>({actionId:'public:'+c.id,family:'choose_card',target:{choiceId:`public:${i}:${c.id}`,slotIndex:i,cardInstanceId:c.id}}));
 const r=planner.plan({state:s,seatId:f.seatId,actions,status:'decision',session});assert.equal(r.goal.fundsCardId,'card-15-0');assert.equal(r.selection.cardId,'card-41-0','credit income funds DLC9; drawing another card does not');assert.equal(r.retainedActionIds.length,1);assert.deepEqual(s,before);
 const funded=structuredClone(s),p=funded.players.players.find(p=>p.id===f.seatId);p.resources.credits=3;const after=planner.plan({state:funded,seatId:f.seatId,actions,status:'decision',session});assert.equal(after.goal.kind,'income');assert.equal(after.goal.protectedCardId,'card-15-0','the outgoing B48 no longer counts as an available income card');
 const paid=planner.plan({state:s,seatId:f.seatId,actions:trades.concat(stop),status:'stable'});assert(!paid.goal?.fundsCardId,'acquisition cost must leave the intended main card fundable');
 const hidden=structuredClone(s);hidden.cards.drawPileCardIds.reverse();assert.equal(planner.plan({state:hidden,seatId:f.seatId,actions,status:'decision',session}).selectedActionId,r.selectedActionId);
}
