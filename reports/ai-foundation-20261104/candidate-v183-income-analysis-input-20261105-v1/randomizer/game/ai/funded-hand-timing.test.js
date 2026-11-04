'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),values=require('./state-value'),demand=require('./resource-demand'),probe=require('./probe-capital'),effects=require('../cards/effects'),{createSimulationEnv}=require('../../app/simulation-env');
const read=p=>JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../..',p))),record=read('reports/research/35f648b3.28f4e95c.quick-400.json'),save=read(record.savePath),env=createSimulationEnv(),seatId='player-white';
try{const checkpoint=read(record.roundEnds[0].checkpointPath);env.loadCheckpoint({...checkpoint,config:{...checkpoint.config,agentType:'completion'}});const original=env.createCheckpoint(),before=env.observe(seatId),p=before.publicState.players.find(p=>p.playerId===seatId),card=before.selfState.hand.find(c=>c.cardId==='dlc_9.png');assert(card);assert.equal(p.credits,0);assert.equal(p.energy,0);assert.deepEqual(effects.getCardPlayCost(card),{credits:3});assert(!env.legalActions().some(a=>a.family==='play_card'&&a.target.cardInstanceId===card.id),'native wallet cannot pay DLC9 this round');
 const beforeValue=values.evaluateStateValue(before,seatId);
 for(let i=record.roundEnds[0].beforeInput-1;i<73;i++){const e=save.replaySteps[i],a=env.legalActions().find(a=>a.actionId===e.action.actionId&&a.actorId===e.actorPlayerId);assert(a);assert(env.step(a).ok);}
 const next=env.observe(seatId),n=next.publicState.players.find(p=>p.playerId===seatId);assert.equal(next.publicState.roundNumber,2);assert(env.legalActions().some(a=>a.family==='play_card'&&a.target.cardInstanceId===card.id));const nextValue=values.evaluateStateValue(next,seatId);
 assert.equal(beforeValue.components.handPotential,nextValue.components.handPotential,'an unaffordable held technology must not claim the extra current-round capability window');
 const transport=values.FORECAST.usefulScansPerLaterRound,currentCard=3*transport-1.5,deferredCard=2*transport-1.5;
 assert.equal(beforeValue.components.handPotential,deferredCard);
 env.loadCheckpoint(original);assert.deepEqual(env.createCheckpoint().coreState.compositionEnvelope,original.coreState.compositionEnvelope);
 const state=JSON.parse(original.coreState.committedState),native=state.players.players.find(p=>p.id===seatId),supply=before.publicState.board.techSupply;
 const quote=(resources,income=p.income,startingIncome=0)=>values.handCapital([card],p.techState,supply,1,values.DEFAULT_WEIGHTS,{resources,income,startingIncome});
 assert.equal(quote({credits:3,energy:0}),currentCard);assert.equal(quote({credits:2,energy:2}),currentCard-1,'current native exchange loss is charged');assert.equal(quote({credits:0,energy:0}),deferredCard);assert.equal(quote({credits:0,energy:0},{credits:0,energy:0}),0);assert.equal(quote({credits:0,energy:6}),Math.max(currentCard-3,deferredCard),'compare the exact current exchange loss with the later known-income window');
 const held=demand.heldAndResearchCapital(state,native);assert.equal(held,beforeValue.components.handPotential+beforeValue.components.researchPotential);assert.equal(demand.planningCapital(state,native),held+beforeValue.components.probePotential);
 const hidden=structuredClone(before);hidden.publicState.board.publicCards.reverse();assert.equal(values.evaluateStateValue(hidden,seatId).components.handPotential,beforeValue.components.handPotential);assert.deepEqual(env.createCheckpoint().coreState.compositionEnvelope,original.coreState.compositionEnvelope);
 // The generalized native2-to1 funding query includes multi-credit card costs.
 let fundingControls=0;for(const weights of [values.DEFAULT_WEIGHTS,{...values.DEFAULT_WEIGHTS,credits:3,energy:1}])for(let c=0;c<=3;c++)for(let e=0;e<=3;e++)for(let C=0;C<=6;C++)for(let E=0;E<=6;E++){
  const options=[];for(let x=0;x<=c;x++)for(let y=0;y<=e+2*x;y++){const spend={credits:c-x+2*y,energy:e-y+2*x};if(spend.credits<=C&&spend.energy<=E)options.push(spend.credits*weights.credits+spend.energy*weights.energy);}
  const expected=options.length?Math.min(...options):null,actual=probe.funding({credits:C,energy:E},{credits:c,energy:e},weights);assert.equal(actual?.value??null,expected);fundingControls++;
 }
 // Both mission branches are exact recorded native inputs from the same
 // AI wallet. Landing spends the funds needed by heldDLC9; orbit keeps them.
 const opening=require('../../../tools/research-human405-round1');env.loadCheckpoint(opening.opening().checkpoint);
 for(let i=23;i<49;i++){const e=save.replaySteps[i],a=env.legalActions().find(a=>a.actionId===e.action.actionId&&a.actorId===e.actorPlayerId);assert(a);assert(env.step(a).ok);}
 const missionRoot=env.createCheckpoint(),joint={};assert.equal(values.evaluateStateValue(env.observe(seatId),seatId).components.handPotential,currentCard);
 for(const row of read('reports/ai-foundation-20261104/two-rounds-teacher-v2/v129-orbit-land-native-assets-20261104-v1.json').rows){
  env.loadCheckpoint(missionRoot);for(const step of row.steps){const a=env.legalActions().find(a=>a.actionId===step.actionId);assert(a);assert(env.step(a).ok);}
  assert.deepEqual(env.createCheckpoint().coreState.compositionEnvelope,row.checkpoint);
  const observation=env.observe(seatId),actor=observation.publicState.players.find(p=>p.playerId===seatId),value=values.evaluateStateValue(observation,seatId);joint[row.goal]={hand:values.handCapital(observation.selfState.hand,actor.techState,observation.publicState.board.techSupply,1,values.DEFAULT_WEIGHTS,{resources:actor,income:actor.income,startingIncome:0}),value:value.total};
 }
 assert.equal(joint.orbit.hand,currentCard);assert.equal(joint.land.hand,deferredCard);assert(joint.orbit.value>joint.land.value,'the complete native orbit keeps the funded development advantage');
 env.loadCheckpoint(original);assert.deepEqual(env.createCheckpoint().coreState.compositionEnvelope,original.coreState.compositionEnvelope);
 // A memoized purpose quote must agree with the independent calculation
 // after in-place wallet, known income and pass-phase changes.
 const capitalState=JSON.parse(missionRoot.coreState.committedState),capitalOwner=capitalState.players.players.find(p=>p.id===seatId);
 const directCapital=()=>{const v=values.evaluateStateValue(require('../../app/rule-observation').buildRuleObservation(capitalState,capitalState.meta.seed,seatId),seatId);return values.sumValueParts(['handPotential','researchPotential','probePotential','analysisPotential','researchIncomePotential','dataPotential'].map(k=>v.components[k]));};
 let memoControls=0;for(const passed of [false,true])for(const credits of [0,2,3,5])for(const energy of [0,1,2,6]){
  capitalOwner.resources.credits=credits;capitalOwner.resources.energy=energy;capitalState.passingPlayerIds=passed?[seatId]:[];
  for(const income of [0,2]){capitalOwner.income.credits=income;const expected=directCapital();assert.equal(demand.planningCapital(capitalState,capitalOwner),expected);assert.equal(demand.planningCapital(capitalState,capitalOwner),expected);memoControls++;}
 }
 // Shallow-frozen callers still have mutable nested wallets. They must not
 // acquire a stale immutable-source memo merely from their outer wrappers.
 capitalState.passingPlayerIds=[];Object.freeze(capitalOwner);Object.freeze(capitalState);
 capitalOwner.resources.energy=0;capitalOwner.resources.credits=0;const shallowBefore=directCapital();assert.equal(demand.planningCapital(capitalState,capitalOwner),shallowBefore);
 capitalOwner.resources.credits=5;const shallowAfter=directCapital();assert.notEqual(shallowAfter,shallowBefore);assert.equal(demand.planningCapital(capitalState,capitalOwner),shallowAfter);
 // A valid visible-card transfer isolates income ranking: both the catalog
 // and the eventual native choice must use the same post-income funding value.
 const incomeFixture=read('adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-038-20261030-v1.json'),incomeState=JSON.parse(incomeFixture.compositionEnvelope.committedState),incomeOwner=incomeState.players.players.find(p=>p.id===seatId);
 assert(incomeOwner.mainActionCompleted);const publicIndex=incomeState.cards.publicCards.findIndex(c=>c?.cardId==='b_2.webp');assert(publicIndex>=0);incomeOwner.hand.push(incomeState.cards.publicCards[publicIndex]);incomeState.cards.publicCards[publicIndex]=null;incomeOwner.resources.handSize=incomeOwner.hand.length;
 const liveRank=incomeOwner.hand.map(card=>({card,value:demand.incomeCardValue(incomeState,seatId,card)})).sort((a,b)=>b.value-a.value||(a.card.id<b.card.id?-1:1));assert.equal(liveRank[0].card.cardId,'b_2.webp','the live mission/data portfolio also values a second known income source');assert.equal(demand.catalog({state:incomeState,seatId,requirements:{bluePlacements:[]}}).find(g=>g.kind==='income').incomeCardId,incomeOwner.hand.find(c=>c.cardId==='b_48.webp').id,'computer4 income consumes its data first, so its choice differs from an immediate mission income');
 // Remove the deployed probe in a separate controlled state to isolate the
 // immediate same-round payment contract from that future mission purpose.
 incomeState.pieces.rockets=incomeState.pieces.rockets.filter(r=>r.playerId!==seatId);incomeState.pieces.activeRocketId=null;
 // This control isolates the existing energy-income payment; an unused
 // company could now improve it by acquiring the known credit income.
 incomeOwner.industryRoundMarkRound=incomeState.turn.roundNumber;incomeOwner.industryRoundMarkTurn=incomeState.turn.turnNumber;
 const incomeRank=incomeOwner.hand.map(card=>({card,value:demand.computerIncomeValue(incomeState,seatId,card)})).sort((a,b)=>b.value-a.value||(a.card.id<b.card.id?-1:1));
 assert.equal(incomeRank[0].card.cardId,'b_48.webp','energy income improves the preservedDLC9 payment window');
 const incomeGoal=demand.catalog({state:incomeState,seatId,requirements:{bluePlacements:[]}}).find(g=>g.kind==='income');assert(incomeGoal);assert.equal(incomeGoal.incomeCardId,incomeRank[0].card.id,'income catalog must choose the same funded marginal value as native income choice');
 // Execute the chosen income through the production kernel. It enables a
 // real2-energy-to1-credit payment andDLC9 research in this same first round.
 const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation'),{createAnalysisPort}=require('./analysis-port');
 const seed=incomeFixture.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;
 assert(c.lifecycle.restore({...incomeFixture.compositionEnvelope,committedState:JSON.stringify(incomeState)}).ok);const nativeOriginal=c.lifecycle.save().envelope,port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});let nativeIncomeInputs;
 const legal=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
 function submit(a){assert(a);const decision=c.inspect().session?.decision,r=decision?c.inputPort.submitDecision({decisionId:decision.decisionId,decisionVersion:decision.decisionVersion,ownerId:decision.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));}
 try{
  port.setResourcePlanning(true);port.setCardPickPlanning(true);const root=port.openRoot(),plan=port.resourceSpec(root).plans.find(p=>p.goal.kind==='income');assert.equal(plan.goal.incomeCardId,incomeGoal.incomeCardId);
  const actual=port.expandResourcePlan(root,plan,()=>null);assert(actual.complete);assert.equal(actual.submissions,9);assert.equal(actual.prefixes.at(-1).action.target.cardInstanceId,incomeGoal.incomeCardId);assert.deepEqual(c.lifecycle.save().envelope,nativeOriginal);
  for(const prefix of actual.prefixes)submit(legal().find(a=>a.actionId===prefix.action.actionId));nativeIncomeInputs=actual.submissions;
  let nativeState=JSON.parse(c.lifecycle.save().envelope.committedState),recipient=nativeState.players.players.find(p=>p.id===seatId);assert.equal(recipient.resources.credits,2);assert.equal(recipient.resources.energy,2);assert.equal(recipient.income.energy,incomeOwner.income.energy+1);
  submit(legal().find(a=>a.family==='end_turn'));nativeState=JSON.parse(c.lifecycle.save().envelope.committedState);assert.equal(nativeState.turn.currentPlayerId,seatId);assert.equal(nativeState.turn.roundNumber,1);
  submit(legal().find(a=>a.family==='quick_trade'&&a.target.tradeId==='energy-for-credit'));
  const dlc=incomeOwner.hand.find(c=>c.cardId==='dlc_9.png');submit(legal().find(a=>a.family==='play_card'&&a.target.cardInstanceId===dlc.id));submit(legal().find(a=>a.target?.tileId==='purple4'));
  nativeState=JSON.parse(c.lifecycle.save().envelope.committedState);recipient=nativeState.players.players.find(p=>p.id===seatId);assert(recipient.techState.ownedTiles.purple4);assert.equal(nativeState.turn.roundNumber,1);
  assert(c.lifecycle.restore(nativeOriginal).ok);assert.deepEqual(c.lifecycle.save().envelope,nativeOriginal);
 }finally{port.close();c.dispose();}
 console.log(JSON.stringify({heldResearchFundingTiming:true,oldRound1NativeCannotPay:true,nextRoundNativeCanPay:true,unfundedCurrentValue:beforeValue.components.handPotential,nextRoundValue:nextValue.components.handPotential,fundingControls,memoControls,shallowFrozenWalletInvalidation:true,nativeIncomeInputs,sameRoundFundedResearch:true,jointNativeMissionFunds:joint,rootAndRngUnchanged:true}));
}finally{env.dispose();}
