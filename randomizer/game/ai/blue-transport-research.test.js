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
  assert(c.lifecycle.restore(envelope).ok);
  assert.deepEqual(save(),envelope);
}
function decide(envelope){
  restore(envelope);
  const actions=menu(),port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
  try {
    const q=createSearchAgent({seatId,analysisPort:port}).decide({seatId,legalActions:actions}).search;
    assert(q.complete&&!q.unresolved.length&&q.diagnostics.nativeExecutions<=256);
    assert.deepEqual(save(),envelope);
    return {action:actions.find(a=>a.actionId===q.actionId),q,
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
  console.log(JSON.stringify({knownTransportQuote:direct.quotes[0],coldPayment:payment.action.target.cardIds,privateCardsAndNextTechDoNotChangeRanking:true}));
} finally {c.dispose();}
