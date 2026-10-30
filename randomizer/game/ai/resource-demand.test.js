'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const demand=require('./resource-demand'),cards=require('../cards/deck'),data=require('../data'),effects=require('../cards/effects');
const {createAnalysisPort}=require('./analysis-port'),{createSimulationRuleComposition}=require('../../training/simulation-rule-composition');
const {createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation');
const fixture=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/ai-decision-corpus-20261023-v1/case-062-20261023-v1.json'))),seatId=fixture.seatId;
const initial=JSON.parse(fixture.compositionEnvelope.committedState),own=s=>s.players.players.find(p=>p.id===seatId);
const card=(name,id)=>{const {cardName,src,...c}=cards.createCardInstance(cards.CARD_CATALOG.find(c=>c.card_id===name),id);return c;};
function state(){const s=structuredClone(initial),p=own(s);p.reservedCards=[];p.hand=[card('b_78.webp','target'),card('b_59.webp','spare1'),card('b_82.webp','spare2')];p.mainActionCompleted=false;p.resources.credits=0;p.resources.energy=2;p.resources.publicity=0;p.resources.availableData=0;p.resources.handSize=p.hand.length;p.dataState=data.createDefaultDataState();return s;}
const goal={id:'play:card-target',kind:'play_card',cardId:'card-target',required:{credits:1}};
const trade=(id,cost,gain)=>({actionId:id,family:'quick_trade',target:{tradeId:id},payload:{cost,gain}});
const money=trade('energy-for-credit',{energy:2},{credits:1}),pair=trade('cards-for-credit',{handSize:2},{credits:1});
const corner=(c)=>({actionId:'corner:'+c.id,family:'card_corner',target:{cardInstanceId:c.id},payload:{kind:'resource',multiplier:1}});
// A source is admitted only for an unmet concrete requirement; the beneficiary card stays protected.
{
 const s=state(),before=structuredClone(s),actions=[money,pair,...own(s).hand.map(corner)];
 const funded=demand.step({state:s,seatId,goal,actions,status:'stable'});assert.equal(funded.kind,'fixed');assert.equal(funded.actionId,'energy-for-credit');assert.deepEqual(funded.discardIds,[]);
 const payState=state();own(payState).resources.energy=0;const pay=demand.step({state:payState,seatId,goal,actions,status:'stable'});assert.equal(pay.actionId,'cards-for-credit');assert.deepEqual(pay.discardIds,['card-spare1','card-spare2']);assert.equal(funded.demand.credits,1);
 own(s).resources.credits=1;const ready=demand.step({state:s,seatId,goal,actions:[...actions,{actionId:'target-play',family:'play_card',target:{cardInstanceId:goal.cardId}}],status:'stable'});assert.equal(ready.kind,'target');assert.equal(ready.actionId,'target-play');assert.deepEqual(before,state());
 const noCards=state();own(noCards).hand=[own(noCards).hand[0]];own(noCards).resources.energy=0;assert.equal(demand.capacity(noCards,seatId,goal),false);assert.equal(demand.step({state:noCards,seatId,goal,actions,status:'stable'}).kind,'infeasible');
 const dataGoal={id:'analyze',kind:'analyze',targetComputerSlot:6,required:{energy:1}};assert.equal(demand.capacity(state(),seatId,dataGoal),false,'two data corners cannot fund six slots');
}
// Observed discard identities are a real unresolved choice. Fallback remains scoped to the same requirement.
{
 const s=state(),trigger=cards.CARD_CATALOG.find(e=>{const m=effects.getCardModel(card(e.card_id,'observer'));return m?.triggers?.some(t=>(t.event.types||[t.event.type]).includes('cardCorner'));});assert(trigger);
 own(s).reservedCards=[card(trigger.card_id,'observer')];const g={id:'publicity',kind:'research_tech',required:{publicity:1}};
 const r=demand.step({state:s,seatId,goal:g,actions:own(s).hand.map(corner),status:'stable'});assert.equal(r.kind,'fallback');assert.equal(r.reason,'observed-resource-preparation');assert(r.actionIds.length);assert(r.candidates.every(c=>c.reduction>0));
}
// Greedy payment identities that consume essential data fall back only within this goal's native payment.
{
 const s=state(),p=own(s);p.resources.energy=0;p.hand.push(card('b_123.webp','spare3'),card('b_2.webp','spare4'));p.resources.handSize=p.hand.length;
 const g={...goal,targetComputerSlot:2};assert(demand.capacity(s,seatId,g));
 const start=demand.step({state:s,seatId,goal:g,actions:[pair],status:'stable'});assert.equal(start.kind,'fallback');assert.equal(start.reason,'greedy-payment-cannot-preserve-goal');assert.deepEqual(start.actionIds,['cards-for-credit']);
 const pending={kind:'discard',count:2,selected:[]},session={baseState:s,queue:[{payload:{decisionContext:pending}}],journal:{actions:[{action:pair}]}},actions=p.hand.map(c=>({actionId:'choose:'+c.id,family:'choose_card',target:{cardInstanceId:c.id}}));actions.push({actionId:'confirm',family:'choose_card',target:{confirm:true}});
 const choose=demand.step({state:s,seatId,goal:g,actions,status:'decision',session});assert.equal(choose.kind,'fallback');assert(!choose.actionIds.includes('choose:'+g.cardId));assert(!choose.actionIds.includes('confirm'));
 pending.selected=['card-spare3','card-spare4'];const finish=demand.step({state:s,seatId,goal:g,actions,status:'decision',session});assert.equal(finish.actionId,'confirm');assert.equal(finish.reason,'feasible-fallback-payment');
}
function native(s){s=structuredClone(s);const hand=own(s).hand,ids=new Set(hand.map(c=>c.cardId));function clean(v){if(!v||typeof v!=='object')return;for(const [k,a] of Object.entries(v)){if(a===hand)continue;if(Array.isArray(a)){v[k]=a.filter(c=>!ids.has(typeof c==='string'?c:c?.cardId));v[k].forEach(clean);}else clean(a);}}clean(s);const seed=fixture.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(v,w)=>buildRuleObservation(v,seed,w?.playerId)});k.newGame({seed});const restored=k.composition.lifecycle.restore({...fixture.compositionEnvelope,committedState:JSON.stringify(s)});assert(restored.ok,JSON.stringify(restored));return k.composition;}
// A native exchange/payment chain is one goal alternative with every physical input charged and replayable.
{
 const s=state();own(s).resources.energy=0;const c=native(s),before=c.lifecycle.save().envelope;
 const p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});p.setResourcePlanning(true);p.setCardPickPlanning(true);const root=p.openRoot(),spec=p.resourceSpec(root),plan=spec.plans.find(x=>x.goal.id===goal.id);assert(plan);
 for(const a of root.legalActions.filter(demand.isPreparation))assert(!spec.retainedActionIds.includes(a.actionId));
 const result=p.expandResourcePlan(root,plan,()=>null);assert(result.complete);assert.equal(result.goalStatus,'completed');assert.equal(result.submissions,5);assert.equal(result.prefixes.length,5);
 assert.equal(result.preparations[0].demand.credits,1);assert(result.prefixes[0].action.target.tradeId==='cards-for-credit');assert.equal(result.prefixes.at(-1).action.family,'play_card');
 assert.equal(result.node.observation.selfState.hand.some(x=>x.id===goal.cardId),false);assert.deepEqual(c.lifecycle.save().envelope,before);
 const {searchDecision}=require('./decision-search'),{createStateValueEvaluator}=require('./state-value');
 const filtered={...p,resourceSpec(n){const q=p.resourceSpec(n);return n===root?{...q,retainedActionIds:[],plans:[plan]}:{...q,plans:[],retainedActionIds:n.legalActions.filter(a=>a.family==='end_turn').map(a=>a.actionId)};}};
 const evaluate=createStateValueEvaluator(seatId),run=budget=>searchDecision({port:filtered,root,evaluate,resourcePlanning:true,cardPickPlanning:true,budget:{transitions:20,nodes:21,frontier:20,milliseconds:10000,...budget}});
 const searched=run({});assert(searched.complete);assert.equal(searched.diagnostics.transitions,6);assert.equal(searched.diagnostics.nodes,7);assert.equal(searched.candidates[0].kind,'resource-goal-plan');
 for(const [reason,budget] of [['transition-budget',{transitions:2}],['node-budget',{nodes:3}],['frontier-budget',{frontier:1}]]){const r=run(budget);assert(!r.complete);assert.equal(r.stopReason,reason);assert.equal(r.actionId,null);assert.equal(r.planContinuation,null);assert(r.diagnostics.transitions<6);}

 for(const stop of ['transition-budget','node-budget','frontier-budget','watchdog']){const r=p.expandResourcePlan(root,plan,n=>n>=1?stop:null);assert(!r.complete);assert.equal(r.submissions,1);assert.equal(r.stopReason,stop);assert.deepEqual(c.lifecycle.save().envelope,before);}
 // At each actual native input, reconstruct a fresh analysis port and compare with the uninterrupted fixed chain.
 for(let i=0;i<result.prefixes.length;i++){
   const cold=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});cold.setResourcePlanning(true);const n=cold.openRoot(),policy=cold.resourceSpec(n);const continuation=policy.plans.find(x=>x.goal.id===goal.id);assert(continuation||i===4,`recover goal during payment at input ${i}`);
   const r=continuation?cold.expandResourcePlan(n,continuation,()=>null):{complete:true,prefixes:[{action:n.legalActions.find(a=>a.family==='play_card'&&a.target.cardInstanceId===goal.cardId)}]};assert(r.complete);assert.equal(r.prefixes[0].action.actionId,result.prefixes[i].action.actionId);
   const a=n.legalActions.find(a=>a.actionId===r.prefixes[0].action.actionId);const decision=c.inspect().session?.decision;const applied=decision?c.inputPort.submitDecision({decisionId:decision.decisionId,decisionVersion:decision.decisionVersion,ownerId:seatId,choice:a}):a.phase==="quick"?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(applied.ok,JSON.stringify(applied));cold.close();
 }
 p.close();c.dispose();
}
// No remaining goal means no optional corner/exchange/data-placement candidate, even though native inputs are legal.
{
 const s=state(),p=own(s);p.mainActionCompleted=true;p.hand=p.hand.slice(0,1);p.resources.handSize=1;p.resources.availableData=0;p.resources.energy=8;const c=native(s),port=createAnalysisPort({composition:c,seatId});port.setResourcePlanning(true);const root=port.openRoot(),spec=port.resourceSpec(root);assert(!spec.plans.length);assert(root.legalActions.some(demand.isPreparation));assert(root.legalActions.filter(a=>spec.retainedActionIds.includes(a.actionId)).every(a=>!demand.isPreparation(a)));port.close();c.dispose();
}
// Funded income cards and non-publicity research sources retain explicit purposes.
{
 const tech=cards.CARD_CATALOG.find(c=>effects.buildPlayEffects(card(c.card_id,'inspect')).some(e=>e.type==='card_research_tech'));
 const income=cards.CARD_CATALOG.find(c=>effects.buildPlayEffects(card(c.card_id,'inspect')).some(e=>e.type==='card_tuck_played_card_to_income'));
 assert(tech&&income);const s=state(),p=own(s);p.hand=[card(tech.card_id,'free-tech'),card(income.card_id,'income')];p.resources.credits=10;p.resources.energy=10;p.resources.publicity=10;p.resources.handSize=2;
 const c=native(s),port=createAnalysisPort({composition:c,seatId});port.setResourcePlanning(true);const root=port.openRoot(),policy=port.resourceSpec(root);
 for(const id of ['card-free-tech','card-income']){
  const plan=policy.plans.find(p=>p.goal.kind==='effect-purpose'&&p.goal.cardId===id);assert(plan,id);
  assert(!policy.retainedActionIds.includes(plan.firstActionId),'source enters only its purpose plan');
  const macro=port.expandResourcePlan(root,plan,()=>null);assert(macro.complete);assert(macro.prefixes.length>0);
  if(macro.fallbackReason){const next=port.resourceSpec(macro.node);assert(next.bound);assert.equal(next.goal.id,plan.goal.id);
   const tiles=macro.node.legalActions.filter(a=>a.target?.tileId&&'blueSlot' in a.target);
   if(tiles.length){const expected=demand.greedyTechPlans({state:s,seatId,plans:tiles.map(action=>({...action.target,action}))}).map(p=>p.action.actionId).sort();assert.deepEqual(next.plans.map(p=>p.firstActionId).sort(),expected);}
  }
 }
 port.close();c.dispose();
}
// Real unbounded-search counterexample: a spent data corner's one-card discard set
// must expire before a later two-card trade with identity-sensitive fallback.
{
 const captured=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/unbounded-payment-failure-20261029-v1.json')));
 const base=captured.envelope.session.session.baseState,seed=base.meta.seed;
 const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
 assert(c.lifecycle.restore({...captured.envelope,committedState:JSON.stringify(base),session:null}).ok);
 const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:captured.seatId,maxCacheEntries:0});p.setResourcePlanning(true);const root=p.openRoot();
 const source=captured.envelope.session.session.journal.actions[0].action,action=root.legalActions.find(a=>a.actionId===source.actionId);assert(action);
 const result=p.expandResourcePlan(root,{id:'expired-corner-discard',goal:captured.goal,operation:captured.operation,firstActionId:action.actionId},()=>null);
 assert(result.complete);assert.equal(result.submissions,1);assert.equal(result.fallbackReason,'greedy-payment-cannot-preserve-goal');
 const pending=p.resourceSpec(result.node);assert(pending.bound);assert.equal(pending.goal.id,captured.goal.id);assert.equal(pending.operation.discardIds,null);
 assert.equal(pending.plans.length,2);assert(pending.plans.every(plan=>plan.mode==='search-fallback'));
 assert.deepEqual(c.lifecycle.save().envelope,before);p.close();c.dispose();
}
console.log(JSON.stringify({resourceDemand:'passed',noLoosePreparations:true,protectedCards:true,exactNeed:true,nativePaymentAndRestore:true,boundedFallback:true}));
// Orbit and landing already at the probe's location are distinct main purposes,
// even when the movement policy chooses one route for future travel.
{
 const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-039-20261030-v1.json'))),seed=f.source.seed;
 const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});p.setResourcePlanning(true);
 try{const root=p.openRoot(),routes=p.resourceSpec(root).plans.filter(p=>p.goal.kind==='route'),direct=routes.filter(p=>p.goal.movementPoints===0);assert(direct.some(p=>p.goal.family==='land'&&p.goal.planetId==='mars'));assert(direct.some(p=>p.goal.family==='orbit'&&p.goal.planetId==='mars'),'the legal Mars orbit cannot disappear because greedy landing has a higher route estimate');assert(routes.filter(p=>p.goal.movementPoints>0).length<=1,'future movement still follows one fixed destination');assert.deepEqual(c.lifecycle.save().envelope,before);}finally{p.close();c.dispose();}
}
