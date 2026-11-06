(function(root,factory){
 'use strict';const common=typeof module==='object'&&module.exports;
 const api=factory(common?require('../cards/deck'):root.SetiCards,common?require('../players'):root.SetiPlayers,
  common?require('./value-arithmetic'):root.SetiValueArithmetic);
 if(common)module.exports=api;else root.SetiAnalysisPublicityCapital=api;
})(typeof globalThis!=='undefined'?globalThis:window,function(cards,players,arithmetic){
 'use strict';
 const zero=reason=>({value:0,selected:null,reason});
 function quote(facts,weights,portfolio,base){
  if(facts.terminal||facts.passing||facts.round>=4||!facts.uncontestedRound
   ||facts.companyState?.abilityId!=='deepspace_swap_cards'||facts.analyzeEnergyCost!==0
   ||facts.pendingNativeEffects)return zero('outside-known-publicity-preparation-window');
  if(facts.turnCardBonusCount!==0)return zero('publicity-preparation-turn-bonuses-not-proven-absent');
  const analysis=base.analysisPlan,endpoint=analysis?.selected?.endpoint?.resources;
  if(!(analysis?.value>0)||!Number.isSafeInteger(endpoint?.publicity)||!Number.isSafeInteger(facts.researchCost)
   ||facts.player.availableData<6-facts.computerSlots.length)return zero('no-funded-analysis-publicity-purpose');
  if(facts.nextFinalMark&&facts.player.score>=facts.nextFinalMark.threshold)return zero('pending-mark-before-publicity-preparation');
  const missing=facts.researchCost-endpoint.publicity,target=facts.player.publicity+missing;
  if(missing<=0||target>players.RESOURCE_LIMITS.publicity)return zero('analysis-publicity-already-funded');
  const incomeCardId=analysis.selected.incomeCardId||null;
  const sources=facts.hand.filter(c=>c.id&&c.cardId&&!c.hidden&&c.id!==incomeCardId).flatMap(card=>{
   const reward=cards.getDiscardActionRewardForCard(card);
   return reward&&!reward.dataCount&&reward.gain.publicity>0&&Object.keys(reward.gain).every(k=>k==='publicity')
    ?[{card,gain:reward.gain.publicity}]:[];
  });
  let current=facts,currentCapital=base.total;const steps=[];
  // One greedy real-ID sequence, not hand subsets or a Native successor.
  // Each step consumes one known source, so the current hand bounds the loop.
  while(current.player.publicity<target){
   const deficit=target-current.player.publicity;
   const choices=sources.filter(s=>current.hand.some(c=>c.id===s.card.id)).map(source=>{
    const hand=current.hand.filter(c=>c.id!==source.card.id),player={...current.player,handSize:hand.length+facts.extraUnknownCount};
    const removed={...current,hand,player},afterRemoval=portfolio(removed).total;
    return{...source,hand,player,loss:arithmetic.sum([weights.handSize,currentCapital,-afterRemoval],weights),reduction:Math.min(deficit,source.gain)};
   }).sort((a,b)=>a.loss*b.reduction-b.loss*a.reduction||a.card.id.localeCompare(b.card.id));
   const chosen=choices[0];if(!chosen)return zero('known-publicity-suppliers-insufficient');
   players.gainResources({resources:chosen.player},{publicity:chosen.gain});
   if(chosen.player.publicity<=current.player.publicity)return zero('publicity-preparation-capped');
   steps.push({cardId:chosen.card.id,publicityGain:chosen.player.publicity-current.player.publicity,opportunityCost:chosen.loss});
   current={...current,player:chosen.player,hand:chosen.hand};currentCapital=portfolio(current).total;
  }
  const linear=arithmetic.sum([(current.player.publicity-facts.player.publicity)*weights.publicity,-steps.length*weights.handSize],weights);
  const netGain=arithmetic.sum([linear,currentCapital,-base.total],weights);
  return{value:Math.max(0,netGain),selected:{cornerCardIds:steps.map(s=>s.cardId),incomeCardId,targetPublicity:target,
    steps,linear,capitalAfter:currentCapital,netGain},reason:netGain>0?'known-deferred-publicity-preparation':'publicity-preparation-not-profitable',
   scope:'One finite greedy pure-publicity corner sequence from current known owned IDs, protected selected income, and the same lower shared portfolio. Uncontested free-analysis window with no turn card bonus; no new card, Native state, action, observation, search or pruning bound. Executing the preparation transfers this potential to the already-funded portfolio.'};
 }
 return Object.freeze({quote});
});
