'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition');
const {createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation');
const {createAnalysisPort}=require('./analysis-port'),{createSearchAgent}=require('./search-agent');
const f=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/blue-transport-r3-20261108-v1.json.gz'))));
const seatId='player-white',seed=JSON.parse(f.beforeMove.committedState).meta.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(state,viewer)=>buildRuleObservation(state,seed,viewer?.playerId)});
k.newGame({seed});
const c=k.composition,save=()=>c.lifecycle.save().envelope;
const menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
function restore(envelope){
  const restored=c.lifecycle.restore(envelope);
  assert(restored.ok,JSON.stringify(restored.error));
  assert.deepEqual(save(),envelope);
}
function decide(envelope,checkpoint){
  restore(envelope);
  const actions=menu(),port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
  try {
    const agent=createSearchAgent({seatId,analysisPort:port});
    if(checkpoint)agent.loadCheckpoint(checkpoint);
    const q=agent.decide({seatId,legalActions:actions}).search;
    assert(q.complete&&!q.unresolved.length&&q.diagnostics.nativeExecutions<=256);
    assert.deepEqual(save(),envelope);
    return {action:actions.find(a=>a.actionId===q.actionId),q,checkpoint:structuredClone(agent.createCheckpoint()),
      quotes:q.lines.flatMap(r=>r.knownResearchTransport?[r.knownResearchTransport]:[])};
  } finally {port.close();}
}
try {
  const move=decide(f.beforeMove);
  assert.equal(move.action.family,'move');
  assert.equal(move.action.target.deltaY,1);
  assert.equal(move.q.value,168.5);
  assert(c.inputPort.submitQuickAction(move.action).ok);
  const payment=decide(save()),d=c.inspect().session.decision;
  assert.deepEqual(payment.action.target.cardIds,['alien-chong-2-6']);
  assert(c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:payment.action}).ok);
  const player=JSON.parse(save().committedState).players.players.find(p=>p.id===seatId);
  assert.equal(player.resources.publicity,5);
  assert(player.hand.some(card=>card.cardId==='chong_3.webp'));
  assert(player.hand.some(card=>card.cardId==='dlc_20.png'));

  const direct=decide(f.beforeResearch);
  assert.equal(direct.action.family,'research_tech');
  assert.equal(direct.q.value,168.5);
  assert.deepEqual(direct.quotes.map(x=>[x.value,x.landingScore,x.landData,x.movePublicity]),[[6.5,8,2,1]]);
  const changed=structuredClone(f.beforeResearch),state=JSON.parse(changed.committedState);
  const future=state.tech.stacks.blue1.bonusQueue;[future[1],future[2]]=[future[2],future[1]];
  const pile=state.cards.drawPileCardIds;[pile[0],pile[1]]=[pile[1],pile[0]];
  changed.committedState=JSON.stringify(state);
  const hidden=decide(changed);
  assert.deepEqual([hidden.action,hidden.q.roots,hidden.quotes],[direct.action,direct.q.roots,direct.quotes]);

  const missing=structuredClone(f.beforeMove),modified=JSON.parse(missing.committedState);
  const p=modified.players.players.find(p=>p.id===seatId);
  p.hand=p.hand.filter(card=>card.cardId!=='chong_2.webp');
  p.resources.handSize=p.hand.length;
  missing.committedState=JSON.stringify(modified);
  const alternative=decide(missing);
  assert.notEqual(alternative.action.family,'move');
  assert.deepEqual(alternative.quotes,[]);
  const preparation=decide(f.beforePublicPreparation);
  assert.equal(preparation.action.family,'place_data');
  assert.equal(preparation.q.value,173.5);
  const proof=preparation.q.lines.find(line=>line.knownTransportPreparation).knownTransportPreparation;
  assert.equal(proof.bluePickSlot,2);
  assert.equal(proof.blueCashSlot,3);
  assert.equal(proof.route.value,11.5);
  const suffix=['place_data','choose_target','place_data','choose_target','choose_card','end_turn'];
  for(const [i,family] of suffix.entries()){
    const {action}=i===0?preparation:decide(save());
    assert.equal(action.family,family);
    const pending=c.inspect().session?.decision;
    assert((pending?c.inputPort.submitDecision({decisionId:pending.decisionId,decisionVersion:pending.decisionVersion,ownerId:pending.ownerId,choice:action})
      :c.inputPort.submitQuickAction(action)).ok);
  }
  const after=JSON.parse(save().committedState).players.players.find(p=>p.id===seatId);
  assert.equal(after.resources.availableData,1);
  assert(after.dataState.placedTokens.some(t=>t.placementSlot===5));
  assert(after.hand.some(card=>card.id===proof.publicPaymentCard));
  const company=decide(f.beforeCompanyPreparation);
  const plan=company.q.lines.find(line=>line.knownTransportPreparation)?.knownTransportPreparation;
  assert.equal(company.action.target.abilityId,'deepspace_swap_cards');
  assert.equal(company.q.value,173.5);
  assert(company.q.roots.some(r=>r.actionId===company.action.actionId&&r.value===company.q.value));
  assert.equal(plan.blueCashSlot,3);
  assert.equal(plan.bluePickSlot,null);
  for(const [i,family] of ['industry','choose_card','choose_card',...suffix.slice(0,2),'end_turn'].entries()){
    const {action}=i===0?company:decide(save());
    assert.equal(action.family,family);
    if(i===1)assert.equal(action.target.cardInstanceId,plan.swapOutId);
    if(i===2)assert.equal(action.target.cardInstanceId,plan.publicPaymentCard);
    const pending=c.inspect().session?.decision;
    assert((pending?c.inputPort.submitDecision({decisionId:pending.decisionId,decisionVersion:pending.decisionVersion,ownerId:pending.ownerId,choice:action})
      :c.inputPort.submitQuickAction(action)).ok);
  }
  const companyEnd=JSON.parse(save().committedState),owner=companyEnd.players.players.find(p=>p.id===seatId);
  assert.equal(owner.resources.availableData,1);
  assert(owner.dataState.placedTokens.some(t=>t.placementSlot===5));
  assert(owner.hand.some(card=>card.id===plan.publicPaymentCard));
  assert(companyEnd.cards.publicCards.some(card=>card?.id===plan.swapOutId));
  const before=decide(f.beforeTransportResearch);
  assert.equal(before.action.family,'research_tech');
  assert.equal(before.q.value,173.5);
  const tracePlan=before.q.lines.find(line=>line.knownTransportPreparation)?.knownTransportPreparation;
  assert.deepEqual(tracePlan.route.knownYellowTrace,{slotId:2,position:2,score:5});
  const preResearchState=JSON.parse(f.beforeTransportResearch.committedState);
  assert(preResearchState.cards.publicCards.some(card=>card?.id===tracePlan.publicPaymentCard));
  const preparedEdges=before.q.lines.flatMap(line=>line.edges).filter(e=>e.resourcePlan?.goal.id==='data:known-transport-payment:company');
  assert(preparedEdges.some(edge=>edge.cost===6&&edge.goalStatus==='boundary'&&edge.resourcePlan.goal.cardId===tracePlan.publicPaymentCard));
  const researchMenu=decide(f.pendingTransportResearch);
  assert.equal(researchMenu.action.target.tileId,'orange1');
  assert.equal(researchMenu.q.value,173.5);
  const unavailable=structuredClone(f.beforeTransportResearch);
  preResearchState.cards.publicCards=preResearchState.cards.publicCards.map(card=>card?.id===tracePlan.publicPaymentCard?null:card);
  unavailable.committedState=JSON.stringify(preResearchState);
  const withoutPayer=decide(unavailable);
  assert.equal(withoutPayer.q.value,170);
  assert(!withoutPayer.q.lines.some(line=>line.knownTransportPreparation));
  const scan=decide(f.beforeTransportScan);
  assert.equal(scan.action.family,'scan');
  assert.equal(scan.q.value,163);
  const quote=scan.q.lines.flatMap(line=>line.knownDisplayedTransport?[line.knownDisplayedTransport]:[]);
  assert(quote.length&&quote.every(v=>v.gain===5&&v.competing===6.5&&v.route.value===11.5));
  const trace=decide(f.beforeTransportTrace);
  assert.equal(trace.action.target.speciesId,'chong');
  assert.equal(trace.action.target.position,4);
  assert.equal(trace.q.value,163);
  assert.deepEqual(c.projection({role:'player',playerId:seatId}).state.publicState.board.aliens.chongOffer,{slotId:2,displayedCardIndex:3});
  const withoutMarket=structuredClone(f.beforeTransportTrace),saved=JSON.parse(withoutMarket.committedState);
  for(const state of [saved,withoutMarket.session.session.baseState,withoutMarket.session.session.workingState]){
    state.cards.publicCards[1]=null;
  }
  withoutMarket.committedState=JSON.stringify(saved);
  const missingMarket=decide(withoutMarket);
  assert.equal(missingMarket.action.target.speciesId,'amiba');
  assert(!missingMarket.q.lines.some(line=>line.knownDisplayedTransport));
  const researchToScan=decide(f.beforeFundedChongScanResearch);
  assert.equal(researchToScan.action.family,'research_tech');
  assert.equal(researchToScan.q.value,156);
  const knownScan=researchToScan.q.lines.find(line=>line.planSummary?.nextFundedScan)?.planSummary.nextFundedScan;
  assert.equal(knownScan.value,6);
  assert.deepEqual(knownScan.cost,{credits:1,energy:2});
  assert.equal(knownScan.publicCardId,'card-61-0');
  assert.equal(knownScan.displayedCard.cardId,'chong_3.webp');
  assert.deepEqual([knownScan.remaining.score,knownScan.remaining.publicity,knownScan.remaining.availableData,knownScan.remaining.handSize],[86,10,2,5]);
  const paidForScan=decide(f.pendingFundedChongScanResearch);
  assert.equal(paidForScan.action.target.tileId,'purple1');
  assert.equal(paidForScan.q.value,156);
  const noKnownSignal=structuredClone(f.beforeFundedChongScanResearch),snapshot=JSON.parse(noKnownSignal.committedState);
  snapshot.cards.publicCards[2]=null;
  noKnownSignal.committedState=JSON.stringify(snapshot);
  assert(!decide(noKnownSignal).q.lines.some(line=>line.planSummary?.nextFundedScan?.displayedCard?.cardId==='chong_3.webp'));
  const afterFirstSlot=decide(f.afterFirstComputerBeforeResearch);
  assert.equal(afterFirstSlot.action.family,'research_tech');
  assert.equal(afterFirstSlot.q.value,156);
  assert(afterFirstSlot.q.lines.some(line=>line.edges.some(edge=>edge.turnTailPlanValue?.computerThenQuietEnd?.placements===2)));
  const traceBeforePick=decide(f.beforeChongTraceAtPublicityCap);
  assert.equal(traceBeforePick.action.target.choiceId,'trace:2:blue:chong:9');
  const pendingTrace=c.inspect().session.decision;
  assert(c.inputPort.submitDecision({decisionId:pendingTrace.decisionId,decisionVersion:pendingTrace.decisionVersion,
    ownerId:pendingTrace.ownerId,choice:traceBeforePick.action}).ok);
  assert.deepEqual(save(),f.beforeChongPickAtPublicityCap);
  const atChoice=decide(save(),traceBeforePick.checkpoint);
  assert.equal(atChoice.q.diagnostics.nativeExecutions,0);
  assert.equal(atChoice.action.target.choiceId,'chong:display:9');
  const pendingChong=c.inspect().session.decision;
  assert(c.inputPort.submitDecision({decisionId:pendingChong.decisionId,decisionVersion:pendingChong.decisionVersion,
    ownerId:pendingChong.ownerId,choice:atChoice.action}).ok);
  assert.deepEqual(save(),f.afterChongPickAtPublicityCap);
  const atCap=decide(save());
  assert.equal(atCap.action.family,'end_turn');
  assert(c.inputPort.submitAction(atCap.action).ok);
  const next=decide(save());
  assert.equal(next.action.family,'research_tech');
  assert.equal(next.q.value,156);
  const canCollect=structuredClone(f.afterChongPickAtPublicityCap),notCapped=JSON.parse(canCollect.committedState);
  notCapped.players.players.find(p=>p.id===seatId).resources.publicity--;
  canCollect.committedState=JSON.stringify(notCapped);
  assert.equal(decide(canCollect).action.family,'place_data');
  const {deferredComputerPublicity}=require('./local-decision-plans');
  assert.equal(deferredComputerPublicity({state:JSON.parse(f.afterChongPickAtPublicityCap.committedState),
    seatId,goal:{kind:'computer-prefix',targetComputerSlot:3},blueTail:true,
    knownTech:()=>false,noAcquisition:()=>true}),null);
  const matchedQuotes=q=>q.lines.flatMap(l=>l.matchedAnalysisScan?[[l.matchedAnalysisScan.order,l.matchedAnalysisScan.value]]:[]).sort();
  const knownOrder=decide(f.beforeMatchedAnalysisScan);
  assert.equal(knownOrder.action.family,'research_tech');
  assert.deepEqual(matchedQuotes(knownOrder.q),[['analysis',160],['research',160],['scan',157]]);
  assert.equal(knownOrder.q.roots.find(r=>r.actionId==='analyze:a5629aa3').value,160);
  const privateOrder=structuredClone(f.beforeMatchedAnalysisScan),hiddenState=JSON.parse(privateOrder.committedState);
  for(const deck of [hiddenState.aliens.chong.cardDeck,hiddenState.cards.drawPileCardIds]) [deck[0],deck[1]]=[deck[1],deck[0]];
  privateOrder.committedState=JSON.stringify(hiddenState);
  const hiddenOrder=decide(privateOrder);
  assert.deepEqual([hiddenOrder.action,hiddenOrder.q.roots,matchedQuotes(hiddenOrder.q)],
    [knownOrder.action,knownOrder.q.roots,matchedQuotes(knownOrder.q)]);
  const paidResearch=decide(f.afterMatchedPurple1);
  assert.equal(paidResearch.action.family,'analyze');
  assert.deepEqual(matchedQuotes(paidResearch.q),[['analysis',160],['scan',155.5]]);
  const noMarket=structuredClone(f.beforeMatchedAnalysisScan),missingScan=JSON.parse(noMarket.committedState);
  missingScan.cards.publicCards[2]=null;noMarket.committedState=JSON.stringify(missingScan);
  assert.deepEqual(matchedQuotes(decide(noMarket).q),[]);
  // Start with both transport payments already held and the company swap
  // spent. The fixed public-card pick and exact route reach the native reward
  // choice without using the replacement display or the fossil identity.
  const held=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/held-transport-no-company-swap-r3-20261108-v1.json.gz'))));
  const launch=decide(held.beforeLaunch);
  const preparationQuote=launch.q.lines.find(l=>l.knownTransportPreparation?.heldPaymentCard)?.knownTransportPreparation;
  assert.equal(preparationQuote?.value,179.5);
  assert.equal(preparationQuote.route.knownLandingTask.credits,1);
  assert.equal(preparationQuote.route.knownYellowTrace.score,5);
  assert.equal(preparationQuote.swapOutId,undefined);
  const privateRefill=structuredClone(held.beforeLaunch),privateState=JSON.parse(privateRefill.committedState);
  for(const deck of [privateState.cards.drawPileCardIds,privateState.aliens.chong.cardDeck]) [deck[0],deck[1]]=[deck[1],deck[0]];
  privateRefill.committedState=JSON.stringify(privateState);
  const hiddenLaunch=decide(privateRefill);
  assert.deepEqual(hiddenLaunch.q.roots,launch.q.roots);
  assert.deepEqual(hiddenLaunch.q.lines.find(l=>l.knownTransportPreparation?.heldPaymentCard)?.knownTransportPreparation,preparationQuote);
  const noHeldMover=structuredClone(held.beforeLaunch),lacksMover=JSON.parse(noHeldMover.committedState);
  const white=lacksMover.players.players.find(p=>p.id===seatId);
  white.hand=white.hand.filter(card=>card.cardId!=='chong_7.webp');
  white.resources.handSize=white.hand.length;
  noHeldMover.committedState=JSON.stringify(lacksMover);
  assert(!decide(noHeldMover).q.lines.some(l=>l.knownTransportPreparation?.heldPaymentCard));
  const independentlyFunded=decide(held.beforeBlue);
  assert.equal(independentlyFunded.action.family,'move');
  assert.equal(independentlyFunded.q.value,179.5);
  assert(independentlyFunded.quotes.some(x=>x.knownLandingTask?.score===3&&x.routeId.includes('land:saturn:planet')));
  let cursor=held.beforeLaunch,heldCheckpoint;
  for(const expected of held.expectedNativeActions){
    const {action,checkpoint}=decide(cursor,heldCheckpoint);
    assert.deepEqual(action,expected);
    const pending=c.inspect().session?.decision;
    const result=pending?c.inputPort.submitDecision({decisionId:pending.decisionId,decisionVersion:pending.decisionVersion,ownerId:pending.ownerId,choice:action})
      :action.phase==='quick'?c.inputPort.submitQuickAction(action):c.inputPort.submitAction(action);
    assert(result.ok,JSON.stringify(result));
    cursor=save();heldCheckpoint=checkpoint;
  }
  // Cold restoration can renumber an uncommitted Native session. All
  // contents, including RNG and the pending reward, must otherwise agree.
  const sessionContents=e=>JSON.parse(JSON.stringify(e).replaceAll(e.session.session.sessionId,'effect-session-test'));
  assert.deepEqual(sessionContents(cursor),sessionContents(held.afterLanding));
  const column=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/deferred-computer-blue-column-r3-20261109-v1.json.gz'))));
  const keepData=decide(column['post-orange']);
  assert.equal(keepData.action.family,'end_turn');
  assert.equal(keepData.q.lines[0].resourcePolicy.deferredBlueColumn,true);
  const hiddenRefill=structuredClone(column['post-orange']),refill=JSON.parse(hiddenRefill.committedState);
  const columnPile=refill.cards.drawPileCardIds;[columnPile[0],columnPile[1]]=[columnPile[1],columnPile[0]];
  hiddenRefill.committedState=JSON.stringify(refill);
  assert.deepEqual(decide(hiddenRefill).q.roots,keepData.q.roots);
  const noKnownDataCard=structuredClone(column['post-orange']),noSupply=JSON.parse(noKnownDataCard.committedState);
  noSupply.cards.publicCards[1]=null;noKnownDataCard.committedState=JSON.stringify(noSupply);
  assert(!decide(noKnownDataCard).q.lines[0].resourcePolicy?.deferredBlueColumn);
  const blueBefore=decide(column['start-blue-turn']);
  assert.equal(blueBefore.action.family,'move');
  assert.equal(blueBefore.q.value,192.5);
  assert.equal(decide(column['after-blue']).q.roots.find(x=>x.actionId==='place_data:8fd12fd3').goal.id,'data:computer6-blue1-cash');
  let tailCursor=column['post-orange'],tailCheckpoint;
  for(const expected of column.actions){
    const {action,checkpoint}=decide(tailCursor,tailCheckpoint);
    assert.deepEqual(action,expected);
    const pending=c.inspect().session?.decision;
    const result=pending?c.inputPort.submitDecision({decisionId:pending.decisionId,decisionVersion:pending.decisionVersion,ownerId:pending.ownerId,choice:action})
      :action.phase==='quick'?c.inputPort.submitQuickAction(action):c.inputPort.submitAction(action);
    assert(result.ok,JSON.stringify(result));
    tailCursor=save();tailCheckpoint=checkpoint;
  }
  assert.deepEqual(tailCursor,column['after-cash']);
  const columnPlayer=JSON.parse(tailCursor.committedState).players.players.find(p=>p.id===seatId);
  assert.deepEqual([columnPlayer.resources.score,columnPlayer.resources.credits,columnPlayer.resources.availableData],[105,1,0]);
  console.log(JSON.stringify({knownTransportQuote:direct.quotes[0],coldPayment:payment.action.target.cardIds,
    privateCardsAndNextTechDoNotChangeRanking:true,knownHeldTransportAutonomousInputs:held.expectedNativeActions.length,
    deferredColumnInputs:column.actions.length}));
} finally {c.dispose();}
