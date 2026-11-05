(function(root,factory){
 'use strict';const common=typeof module==='object'&&module.exports;
 const api=factory(common?require('../aliens/amiba'):root.SetiAlienAmiba,common?require('../aliens/state'):root.SetiAlienState,
  common?require('../players'):root.SetiPlayers,common?require('../data/placement'):root.SetiDataPlacement,
  common?require('../cards/effects'):root.SetiCardEffects,common?require('../end-game-scoring'):root.SetiEndGameScoring,
  common?require('./probe-capital'):root.SetiProbeCapital,common?require('./value-arithmetic'):root.SetiValueArithmetic);
 if(common)module.exports=api;else root.SetiAmibaAnalysisCapital=api;
})(typeof globalThis!=='undefined'?globalThis:window,function(amiba,aliens,players,placement,effects,end,probe,arithmetic){
 'use strict';const zero=reason=>({value:0,selected:null,reason});
 const inertScores=new Set(['sectorWinsByColor','techCount','distinctSignalSectors','planetOrbitOrLand','planetLandingPairs','allOrbitOrLand','probeLocation','unmarkedFinalRightmost']);
 function reservationsSafe(facts){
  return facts.reservedCards.every(card=>{
   const m=effects.getCardModel(card);if(!m||m.temporaryTasks?.length)return false;
   const consumed=card.cardEffectState?.modelCardId===card.cardId?card.cardEffectState.consumedTriggerIds||[]:[];
   if((m.triggers||[]).some(t=>!consumed.includes(t.id)&&!(t.event?.types||[t.event?.type]).every(type=>
     ['researchTech','move','visitPlanet','visitAsteroid','visitComet','launch','orbit','land'].includes(type)
     ||type==='alienTrace'&&['pink','yellow'].includes(t.event.traceType))))return false;
   if((m.tasks||[]).some(t=>!card.cardEffectState?.completedTaskIds?.includes(t.id)
     &&(!['orbitOrLandCount','completedSectors','completedSectorsByColor','probeDistanceFromEarth','traceCount'].includes(t.condition?.type)
       ||t.condition.type==='traceCount'&&(!t.condition.traceType||t.condition.traceType==='blue'))))return false;
   const rule=end.resolveCardEndGameRule(card,effects);
   return !rule||inertScores.has(rule.kind)||['traceCount','amibaTraceCount'].includes(rule.kind);
  });
 }
 function publicAliens(facts){
  return {aliens:Object.fromEntries(facts.board.aliens.slots.map(s=>[String(s.slotId),structuredClone(s)])),
   amiba:{...structuredClone(facts.researchSymbols),...structuredClone(facts.amibaTraces),revealInitialized:true,cardDeck:[]}};
 }
 // Only current blue-trace metrics can change. Other scored facts are held
 // fixed by the reservation guard; unknown new cards never become Type3 facts.
 function secured(aliensState,facts){
  const actor={id:facts.player.id,color:facts.player.color,reservedCards:facts.reservedCards,techState:facts.player.techState},context={aliens:aliensState};let value=0;
  const board=facts.board.finalScoring,mark=board?.tiles?.b?.marks?.find(m=>m.playerId===actor.id),formula=board&&end.getFormulaId('b',board.tileVariants.b);
  if(mark&&formula==='b1')value+=end.getFormulaBaseValue(formula,actor,context)*end.getSlotMultiplier(formula,mark.slotIndex);
  for(const card of facts.reservedCards){const rule=end.resolveCardEndGameRule(card,effects);
   if(rule&&['traceCount','amibaTraceCount'].includes(rule.kind)&&rule.traceType==='blue')value+=end.scoreCardEndGameRule(rule,actor,context);
  }
  return value;
 }
 function quote(facts,weights,portfolio,baseValue){
  if(!facts.amibaTraces||!facts.researchSymbols?.revealInitialized)return zero('missing-public-amiba-analysis');
  if(facts.pendingNativeEffects||!Array.isArray(facts.pendingCardTriggers)||facts.pendingCardTriggers.length)return zero('pending-amiba-analysis-effects');
  const id=facts.amibaTraces.revealedSlotId;
  if(facts.board.aliens.slots.some(s=>s.revealed&&Number(s.slotId)!==Number(id)))return zero('other-revealed-species-needs-native-value');
  if(!reservationsSafe(facts))return zero('amiba-analysis-reservation-needs-native-value');
  if(!Number.isSafeInteger(facts.board.ordinaryDrawCount)||facts.board.ordinaryDrawCount<0
    ||!Number.isSafeInteger(facts.amibaTraces.blindCardCount)||facts.amibaTraces.blindCardCount<0)return zero('missing-public-analysis-card-counts');
  const placed=facts.computerSlots,needed=[1,2,3,4,5,6].filter(s=>!placed.includes(s));
  if(needed.length&&(placed.length<4||placed.some((slot,i)=>slot!==i+1)||needed.some(slot=>slot<5)||facts.player.availableData<needed.length))return zero('analysis-not-ready');
  const payment=probe.funding(facts.player,{energy:facts.analyzeEnergyCost},weights);if(!payment)return zero('analysis-not-funded');
  const initial=facts.player,paid={...initial,credits:initial.credits-payment.spend.credits,energy:initial.energy-payment.spend.energy,availableData:initial.availableData-needed.length,
    handSize:facts.hand.length+facts.extraUnknownCount};
  const columns=Object.entries(initial.techState.blueBoardSlots).filter(([tile,slot])=>initial.techState.ownedTiles[tile]&&!initial.techState.disabledTiles[tile]&&needed.includes(placement.getRequiredComputerSlotForBlueBonus(slot))).length;
  players.gainResources({resources:paid},{score:columns*placement.getBlueColumnScoreBonus().score});
  const originalAliens=publicAliens(facts),beforeSecured=secured(originalAliens,facts),candidates=[];
  const choices=facts.board.aliens.slots.flatMap(slot=>{
   if(Number(slot.slotId)===Number(id))return amiba.TRACE_POSITIONS.filter(position=>amiba.canPlaceAmibaTrace(originalAliens,id,'blue',position).ok).map(position=>({slot,position,reward:amiba.getTraceReward(originalAliens,'blue',position)}));
   if(slot.revealed)return[];const first=!slot.traces?.blue?.firstPlaced;
   if(first&&['pink','yellow'].every(t=>slot.traces?.[t]?.firstPlaced))return[];
   return[{slot,first,reward:first?aliens.getFirstTraceRewardForSlot(slot.slotId):aliens.getExtraTraceReward()}];
  });
  for(const choice of choices){
   const context=structuredClone(originalAliens),wallet={...paid};let unknownCards=0,ordinaryLeft=facts.board.ordinaryDrawCount;
   const apply=reward=>{
    players.gainResources({resources:wallet},reward.gain||{});if(reward.dataCount)players.gainResources({resources:wallet},{availableData:reward.dataCount});
    if((reward.drawCards||0)>ordinaryLeft)return false;ordinaryLeft-=reward.drawCards||0;unknownCards+=reward.drawCards||0;return true;
   };
   if(choice.position){
    // Occupancy metric for formal scoring only; no sequence/entity is made.
    context.amiba.traceSlotsByAlienSlotId[String(id)].blue[choice.position]={traceType:'blue',position:choice.position,playerId:initial.id,playerColor:initial.color};
    if(choice.reward.pickAlienCard){
     if(context.amiba.blindCardCount>0)context.amiba.blindCardCount--;else if(context.amiba.displayedCardAvailable)context.amiba.displayedCardAvailable=false;else continue;
     unknownCards++;
    }
   }else{
    const trace=context.aliens[String(choice.slot.slotId)].traces.blue;
    if(choice.first)Object.assign(trace,{firstPlaced:true,ownerPlayerId:initial.id,ownerPlayerColor:initial.color});
    else{trace.extraCount=(trace.extraCount||0)+1;trace.extraMarkers=[...(trace.extraMarkers||[]),{playerId:initial.id,playerColor:initial.color}];}
   }
   if(!apply(choice.reward))continue;
   let region=null;
   if(choice.reward.region){region=amiba.resolveRegionReward(context,choice.reward.region);if(!region.ok)throw Error('AMIBA_ANALYSIS_REGION_QUERY_FAILED');let valid=true;
    for(const r of region.results)if(!apply(r.reward)){valid=false;break;}if(!valid)continue;
   }
   wallet.handSize+=unknownCards;
   const symbols=Object.fromEntries(Object.keys(facts.researchSymbols).map(k=>[k,context.amiba[k]])),traces={revealedSlotId:id,traceSlotsByAlienSlotId:context.amiba.traceSlotsByAlienSlotId,
    blindCardCount:context.amiba.blindCardCount,displayedCardAvailable:context.amiba.displayedCardAvailable},slots=Object.entries(context.aliens).map(([slotId,s])=>({...s,slotId:Number(slotId)}));
   const cleared={computerSlots:[],blueSlots:(facts.blueSlots||[]).map(b=>({...b,occupied:false,unlocked:false})),researchSymbols:symbols,amibaTraces:traces,
    extraUnknownCount:facts.extraUnknownCount+unknownCards,aliens:{...facts.board.aliens,slots,amiba:symbols,amibaTraces:traces},ordinaryDrawCount:ordinaryLeft};
   const securedGain=secured(context,facts)-beforeSecured;
   const delta=w=>arithmetic.sum([w.score-initial.score,securedGain,unknownCards*weights.handSize,...Object.keys(weights).filter(k=>k!=='handSize').map(k=>(w[k]-initial[k])*weights[k])],weights);
   let best={value:delta(wallet),wallet,progress:cleared,blueSlot:null};
   for(const[tileId,slot]of Object.entries(initial.techState.blueBoardSlots)){
    const required=placement.getRequiredComputerSlotForBlueBonus(slot),bonus=placement.getBlueTileDataBonus(tileId);
    if(!initial.techState.ownedTiles[tileId]||initial.techState.disabledTiles[tileId]||!required||required>=4||!bonus||!['credits','energy','publicity'].includes(bonus.type)||wallet.availableData<required+1)continue;
    const after={...wallet,availableData:wallet.availableData-required-1};
    if(required>=2)players.gainResources({resources:after},{publicity:placement.getComputerSlotBonus(2).publicity});
    const count=Object.entries(initial.techState.blueBoardSlots).filter(([tile,s])=>initial.techState.ownedTiles[tile]&&!initial.techState.disabledTiles[tile]&&placement.getRequiredComputerSlotForBlueBonus(s)<=required).length;
    players.gainResources({resources:after},{[bonus.type]:bonus[bonus.type],score:count*placement.getBlueColumnScoreBonus().score});
    const progress={...cleared,computerSlots:[1,2,3].filter(n=>n<=required),blueSlots:cleared.blueSlots.map(b=>({...b,occupied:b.slot===Number(slot),unlocked:placement.getRequiredComputerSlotForBlueBonus(b.slot)<=required}))},value=delta(after);
    if(value>best.value)best={value,wallet:after,progress,blueSlot:Number(slot)};
   }
   candidates.push({slotId:choice.slot.slotId,position:choice.position||null,traceType:'blue',payment,preparationPlacements:needed.length,blueSlot:best.blueSlot,
    planNetGain:null,localPlanValue:best.value,linearGain:delta(best.wallet),securedGain,unknownCards,region,endpoint:{resources:best.wallet,...best.progress}});
  }
  candidates.sort((a,b)=>b.localPlanValue-a.localPlanValue||a.slotId-b.slotId||(b.position||0)-(a.position||0));
  const selected=candidates[0];
  if(selected){const {resources,aliens,...progress}=selected.endpoint;selected.planNetGain=arithmetic.sum([selected.linearGain,portfolio(resources,aliens.slots,{...progress,aliens}),-baseValue],weights);}
  return{value:Math.max(0,selected?.planNetGain||0),selected:selected||null,candidates,
   reason:selected?.planNetGain>0?'funded-known-amiba-analysis':'amiba-analysis-not-profitable',
   scope:'One fixed locally greedy funded analysis/blue-trace/currency-tail plan, ranked by current formal net rewards, then exactly one shared-portfolio requote. Unselected local candidates have no planNetGain. Anonymous draw counts only; shared wallet and existing base portfolio opportunity cost. No hidden reveal, entity allocation, successor observation, new final mark or pruning bound.'};
 }
 return Object.freeze({quote});
});
