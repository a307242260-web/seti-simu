(function(root,factory){
 'use strict';const common=typeof module==='object'&&module.exports;
 const api=factory(common?require('../cards/effects'):root.SetiCardEffects,common?require('../aliens/amiba'):root.SetiAlienAmiba,
  common?require('../players'):root.SetiPlayers,common?require('./probe-capital'):root.SetiProbeCapital,common?require('./value-arithmetic'):root.SetiValueArithmetic);
 if(common)module.exports=api;else root.SetiKnownSymbolCapital=api;
})(typeof globalThis!=='undefined'?globalThis:window,function(effects,amiba,players,probe,arithmetic){
 'use strict';
 const readOnlyRewards=Object.freeze({readOnlyRewards:true});
 const zero=reason=>({value:0,selected:null,candidates:[],reason}),models=new WeakMap();
 const keys=(value,allowed)=>Object.keys(value||{}).every(k=>allowed.includes(k));
 function supported(card){
  if(!card?.cardId||card.hidden)return null;
  const m=effects.getCardModel(card);if(!m)return null;if(models.has(m))return models.get(m);
  const body=effects.buildPlayEffects(card),[data,symbol]=body;
  const result=m.cardType===1&&!m.tasks?.length&&!m.temporaryTasks?.length&&!m.endGameScoring&&body.length===2
   &&data.type==='gain_data'&&Number.isSafeInteger(data.options.count)&&data.options.count>0&&keys(data.options,['count','repeat'])
   &&symbol.type==='amiba_choose_symbol_reward'&&Object.hasOwn(amiba.REGION_SYMBOL_SLOTS,symbol.options?.region)
   &&keys(symbol.options,['region','repeat'])&&body.every(e=>(e.options?.repeat??1)===1)
   &&(m.triggers||[]).every(t=>t.event?.type==='alienTrace'&&t.effect?.type==='gain_data')
    ?{dataCount:data.options.count,region:symbol.options.region}:null;
  if(Object.isFrozen(m))models.set(m,result);return result;
 }
 function quote(facts,weights,portfolio,currentCapital){
  const eligible=facts.hand.filter(supported);
  if(!eligible.length||facts.terminal||facts.passing||facts.round>=4)return zero('no-funded-known-symbol-window');
  if(facts.companyState?.abilityId!=='deepspace_swap_cards')return zero('symbol-card-company-not-audited');
  if(!facts.researchSymbols?.revealInitialized)return zero('no-public-symbol-layout');
  if(!Array.isArray(facts.pendingCardTriggers)||!Array.isArray(facts.pendingHandCardTriggers))return zero('missing-symbol-card-trigger-facts');
  if(facts.pendingCardTriggers.length||facts.pendingNativeEffects)return zero('pending-native-trigger');
  if(facts.reservedCards.some(c=>{const m=effects.getCardModel(c);return!m||m.temporaryTasks?.length
    ||(m.tasks||[]).some(t=>!['orbitOrLandCount','completedSectors','completedSectorsByColor','traceCount','probeDistanceFromEarth'].includes(t.condition?.type))
    ||m.endGameScoring&&!['sectorWinsByColor','traceCount','techCount','distinctSignalSectors','planetOrbitOrLand','probeLocation','unmarkedFinalRightmost','planetLandingPairs','allOrbitOrLand'].includes(m.endGameScoring.kind)
    ||(m.triggers||[]).some(t=>!['researchTech','alienTrace'].includes(t.event?.type));}))return zero('symbol-card-reservation-needs-native-value');
  const candidates=[];
  function apply(wallet,reward){
   const before={...wallet};players.gainResources({resources:wallet},reward.gain||{});
   if(reward.dataCount)players.gainResources({resources:wallet},{availableData:reward.dataCount});
   return arithmetic.sum([wallet.score-before.score,(wallet.publicity-before.publicity)*weights.publicity,
    (wallet.availableData-before.availableData)*weights.availableData,(reward.drawCards||0)*weights.handSize],weights);
  }
  for(const card of eligible){
   if(facts.pendingHandCardTriggers.some(t=>t.cardInstanceId===card.id))continue;
   const cost=effects.getCardPlayCost(card);
   if(!keys(cost,['credits','energy'])||Object.values(cost).some(v=>!Number.isSafeInteger(v)||v<0))continue;
   const payment=probe.funding(facts.player,cost,weights);if(!payment)continue;
   const body=supported(card),wallet={...facts.player,credits:facts.player.credits-payment.spend.credits,
    energy:facts.player.energy-payment.spend.energy,handSize:facts.hand.length+facts.extraUnknownCount-1};
   players.gainResources({resources:wallet},{availableData:body.dataCount});
   const alien={amiba:amiba.copyPublicSymbolState(facts.researchSymbols)};
   const choices=amiba.listSymbolsInRegion(alien,body.region,readOnlyRewards).map(entry=>({entry,value:apply({...wallet},entry.reward)}))
    .sort((a,b)=>b.value-a.value||a.entry.slotId.localeCompare(b.entry.slotId));
   if(!choices.length)continue;
   const resolved=amiba.resolveSymbolAtSlot(alien,choices[0].entry.slotId,readOnlyRewards);if(!resolved.ok)throw Error('KNOWN_SYMBOL_CARD_NATIVE_QUERY_FAILED');
   apply(wallet,resolved.reward);const blindCount=resolved.reward.drawCards||0;wallet.handSize+=blindCount;
   const symbols=Object.fromEntries(Object.keys(facts.researchSymbols).map(k=>[k,alien.amiba[k]]));
   const reserved=structuredClone(card);effects.ensureCardEffectState(reserved);
   const after={...facts,player:wallet,hand:facts.hand.filter(c=>c.id!==card.id),extraUnknownCount:facts.extraUnknownCount+blindCount,
    reservedCards:[...facts.reservedCards,reserved],researchSymbols:symbols,
    pendingHandCardTriggers:facts.pendingHandCardTriggers.filter(t=>t.cardInstanceId!==card.id),
    board:{...facts.board,aliens:{...facts.board.aliens,amiba:symbols}}};
   const linear=arithmetic.sum([wallet.score-facts.player.score,...Object.entries(weights).map(([k,w])=>(k==='handSize'?blindCount-1:wallet[k]-facts.player[k])*w)],weights);
   const afterCapital=portfolio(after),netGain=arithmetic.sum([linear,afterCapital,-currentCapital],weights);
   if(!Number.isFinite(netGain))throw Error('KNOWN_SYMBOL_CARD_VALUE_INVALID');
   candidates.push({cardId:card.id,payment,slotId:choices[0].entry.slotId,reward:resolved.reward,move:resolved.move,
    linear,afterCapital,netGain,wallet,symbols});
  }
  candidates.sort((a,b)=>b.netGain-a.netGain||a.cardId.localeCompare(b.cardId));
  return{value:Math.max(0,candidates[0]?.netGain||0),selected:candidates[0]||null,candidates,
   scope:'One currently funded known data/region-symbol card, greedy current public reward and formal symbol movement, then the existing shared-wallet portfolio without this card; no future draw identity, native successor, new final mark, repeated latent trigger or pruning bound.'};
 }
 return Object.freeze({supported,quote});
});
