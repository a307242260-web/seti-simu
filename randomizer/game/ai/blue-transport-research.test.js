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
  assert.equal(preparation.q.value,168.5);
  const proof=preparation.q.lines.find(line=>line.knownTransportPreparation).knownTransportPreparation;
  assert.equal(proof.bluePickSlot,2);
  assert.equal(proof.blueCashSlot,3);
  assert.equal(proof.route.value,6.5);
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
  console.log(JSON.stringify({knownTransportQuote:direct.quotes[0],coldPayment:payment.action.target.cardIds,privateCardsAndNextTechDoNotChangeRanking:true}));
} finally {c.dispose();}
