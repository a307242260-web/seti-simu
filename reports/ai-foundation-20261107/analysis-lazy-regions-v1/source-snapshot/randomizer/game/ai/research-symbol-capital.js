(function(root,factory){
 'use strict';const common=typeof module==='object'&&module.exports;
 const api=factory(common?require('../cards/effects'):root.SetiCardEffects,common?require('../cards/deck'):root.SetiCards,
  common?require('../aliens/amiba'):root.SetiAlienAmiba,common?require('./probe-capital'):root.SetiProbeCapital,
  common?require('../players'):root.SetiPlayers,common?require('../tech/catalog'):root.SetiTechCatalog,
  common?require('../effects/science-session'):root.SetiScienceSession,common?require('../end-game-scoring'):root.SetiEndGameScoring,
  common?require('./value-arithmetic'):root.SetiValueArithmetic,common?require('./known-symbol-capital'):root.SetiKnownSymbolCapital,
  common?require('./sector-card-capital'):root.SetiSectorCardCapital,common?require('./known-movement-capital'):root.SetiKnownMovementCapital,
  common?require('./research-trigger-capital'):root.SetiResearchTriggerCapital);
 if(common)module.exports=api;else root.SetiResearchSymbolCapital=api;
})(typeof globalThis!=='undefined'?globalThis:window,function(effects,cards,amiba,probe,players,tech,science,end,arithmetic,symbol,sector,movement,triggers){
 'use strict';
 const readOnlyRewards=Object.freeze({readOnlyRewards:true});
 const zero=reason=>({value:0,selected:null,candidates:[],reason});
 const inertTasks=new Set(['orbitOrLandCount','completedSectors','completedSectorsByColor','traceCount','probeDistanceFromEarth']);
 const inertScoring=new Set(['sectorWinsByColor','traceCount','amibaTraceCount','distinctSignalSectors','planetOrbitOrLand','probeLocation','planetLandingPairs','allOrbitOrLand']);
 function quiet(facts){
  return facts.reservedCards.every(card=>{const m=effects.getCardModel(card);return m&&!m.temporaryTasks?.length
   &&(m.tasks||[]).every(t=>card.cardEffectState?.completedTaskIds?.includes(t.id)||inertTasks.has(t.condition?.type))
   &&(!m.endGameScoring||inertScoring.has(m.endGameScoring.kind))
   &&(m.triggers||[]).every(t=>t.event?.type==='researchTech'||t.event?.type==='alienTrace'&&['pink','yellow'].includes(t.event.traceType));});
 }
 function corner(facts,beneficiary){
  if(facts.player.publicity>=facts.researchCost)return{card:null,gain:0};
  const needed=facts.researchCost-facts.player.publicity;
  const choices=facts.hand.filter(c=>!c.hidden&&c.cardId&&c.id!==beneficiary.id&&!symbol.supported(c)&&!sector.supported(c)&&!movement.supported(c)
    &&!effects.buildPlayEffects(c).some(e=>['card_research_tech','card_land','card_orbit','card_move','card_launch','card_scan'].includes(e.type)))
   .map(card=>({card,reward:cards.getDiscardActionRewardForCard(card)}))
   .filter(({reward})=>reward&&!reward.dataCount&&Object.keys(reward.gain||{}).every(k=>k==='publicity')&&reward.gain.publicity>=needed)
   .sort((a,b)=>a.reward.gain.publicity-b.reward.gain.publicity||(effects.getCardPrice(a.card)||0)-(effects.getCardPrice(b.card)||0)||a.card.id.localeCompare(b.card.id));
  return choices[0]?{card:choices[0].card,gain:choices[0].reward.gain.publicity}:null;
 }
 function markGain(facts,nextTech){
  const board=facts.board.finalScoring,mark=board.tiles.d.marks.find(m=>m.playerId===facts.player.id);if(!mark)return 0;
  const formula=end.getFormulaId('d',board.tileVariants.d),value=t=>end.getFormulaBaseValue(formula,{techState:t},{})*end.getSlotMultiplier(formula,mark.slotIndex);
  return value(nextTech)-value(facts.player.techState);
 }
 function apply(wallet,reward){players.gainResources({resources:wallet},reward.gain||{});if(reward.dataCount)players.gainResources({resources:wallet},{availableData:reward.dataCount});}
 function rewardValue(wallet,reward,weights){const next={...wallet};apply(next,reward);return arithmetic.sum([next.score-wallet.score,
  ...Object.entries(weights).filter(([k])=>k!=='handSize').map(([k,w])=>(next[k]-wallet[k])*w),(reward.drawCards||0)*weights.handSize],weights);}
 function freePickRank(card){
  const play=effects.buildPlayEffects(card),cost=effects.getCardPlayCost(card),certain=play.length&&play.every(e=>e.type==='gain_resources'&&Object.keys(e.options?.gain||{}).every(k=>k==='score'));
  return certain?play.reduce((n,e)=>n+(e.options.gain.score||0),0)-Object.values(cost).reduce((n,v)=>n+v,0)-1:0;
 }
 function quote(facts,weights,portfolio,currentCapital,technologyCapital){
  const p=facts.player,mark=facts.nextFinalMark;
  if(facts.terminal||facts.passing||facts.round>=4||!facts.uncontestedRound||facts.companyState?.abilityId!=='deepspace_swap_cards'
    ||!facts.researchSymbols?.revealInitialized||!facts.amibaTraces||facts.pendingNativeEffects
    ||facts.board.aliens.slots.some(s=>s.revealed&&Number(s.slotId)!==Number(facts.amibaTraces.revealedSlotId))
    ||!Array.isArray(facts.pendingCardTriggers)||facts.pendingCardTriggers.length||!Array.isArray(facts.pendingHandCardTriggers)
    ||facts.board.rockets.some(r=>r.playerId===p.id)||!Number.isSafeInteger(facts.researchCost)||facts.researchCost<0)return zero('outside-known-research-symbol-window');
  const beneficiaries=facts.hand.filter(c=>symbol.supported(c)&&!facts.pendingHandCardTriggers.some(t=>t.cardInstanceId===c.id));
  if(!beneficiaries.length||facts.hand.some(c=>sector.supported(c)||movement.supported(c)))return zero('no-isolated-known-symbol-beneficiary');
  if(!mark?.valuationSafe||mark.playerId!==p.id||!(p.score<mark.threshold)||mark.followingThreshold===undefined
    ||!mark.options.some(o=>o.tileId==='b'&&o.formulaId==='b1')||!quiet(facts))return zero('research-symbol-mark-needs-native-value');
  const missingIncome=Math.max(0,4-facts.computerSlots.length);
  if(facts.computerSlots.length!==3||p.availableData>=missingIncome)return zero('research-symbol-not-before-funded-income');
  if(!Number.isSafeInteger(facts.board.ordinaryDrawCount)||facts.board.ordinaryDrawCount<0)return zero('missing-public-research-draw-count');
  const ctx=triggers.describe(facts,{resources:p,income:p.income,startingIncome:0},p.publicity);
  if(!ctx.available)return zero(ctx.reason);
  const candidates=[];
  for(const beneficiary of beneficiaries){
   const payment=corner(facts,beneficiary);if(!payment)continue;
   if(p.availableData+symbol.supported(beneficiary).dataCount<6-facts.computerSlots.length)continue;
   const hand=facts.hand.filter(c=>c.id!==payment.card?.id);
   if(!hand.some(c=>!c.hidden&&c.id!==beneficiary.id&&['credits','energy'].some(k=>cards.getIncomeGainForCard(c)?.[k])))continue;
   const funded={...p,handSize:facts.hand.length+facts.extraUnknownCount-Number(Boolean(payment.card))};
   players.gainResources({resources:funded},{publicity:payment.gain});if(funded.publicity<facts.researchCost)continue;
   for(const rule of ctx.rules){
    const regional={amiba:amiba.copyPublicSymbolState(facts.researchSymbols)},wallet={...funded,publicity:funded.publicity-facts.researchCost};
    const choices=amiba.listSymbolsInRegion(regional,rule.region,readOnlyRewards).map(entry=>({entry,value:rewardValue(wallet,entry.reward,weights)}))
      .sort((a,b)=>b.value-a.value||a.entry.slotId.localeCompare(b.entry.slotId));
    if(!choices.length)continue;const firstMove=amiba.resolveSymbolAtSlot(regional,choices[0].entry.slotId,readOnlyRewards);if(!firstMove.ok)throw Error('RESEARCH_SYMBOL_MOVE_QUERY_FAILED');
    if(!amiba.REGION_SYMBOL_SLOTS[symbol.supported(beneficiary).region].includes(firstMove.move?.toSlotId))continue;
    for(const[tileId,stack]of Object.entries(facts.supply?.stacks||{})){
     if(tech.getTechType(tileId)!==rule.techType||rule.techType==='blue'||p.techState.ownedTiles[tileId]||!(stack.remaining>0)||stack.bonusHidden)continue;
     const bonus=tech.BONUS_EFFECTS[stack.bonusId];if(!bonus)continue;
     const alien={amiba:amiba.copyPublicSymbolState(facts.researchSymbols)},next={...wallet},owned={...p.techState,ownedTiles:{...p.techState.ownedTiles,[tileId]:true}};
     const first=stack.firstTakeClaimedBy==null?tech.FIRST_TAKE_TYPE_SCORE:0;
     players.gainResources({resources:next},{...Object.fromEntries(Object.entries(bonus).filter(([k])=>k!=='cardSelection')),score:first+(bonus.score||0)});
     players.gainResources({resources:next},{availableData:science.getResearchDataCount(tileId)});
     const ranked=amiba.listSymbolsInRegion(alien,rule.region,readOnlyRewards).map(entry=>({entry,value:rewardValue(next,entry.reward,weights)}))
       .sort((a,b)=>b.value-a.value||a.entry.slotId.localeCompare(b.entry.slotId));
     const chosen=ranked[0];if(!chosen)continue;const resolved=amiba.resolveSymbolAtSlot(alien,chosen.entry.slotId,readOnlyRewards);if(!resolved.ok)throw Error('RESEARCH_SYMBOL_REWARD_QUERY_FAILED');
     if(!amiba.REGION_SYMBOL_SLOTS[symbol.supported(beneficiary).region].includes(resolved.move?.toSlotId)
       ||resolved.reward.pickCard||resolved.reward.pickAlienCard||resolved.reward.region)continue;
     apply(next,resolved.reward);let unknown=resolved.reward.drawCards||0,draws=facts.board.ordinaryDrawCount-unknown;if(draws<0)continue;
     next.handSize+=unknown;next.techState=owned;
     const reservedCards=facts.reservedCards.map(card=>card.id===rule.cardInstanceId?{...card,cardEffectState:{...card.cardEffectState,
       consumedTriggerIds:[...card.cardEffectState.consumedTriggerIds,rule.ruleId]}}:card);
     let afterHand=hand,publicCards=facts.board.publicCards,bonusCardId=null;
     if(bonus.cardSelection){
      if(bonus.cardSelection!==1)continue;
      const offers=publicCards.filter(c=>c&&!c.hidden&&c.cardId&&!afterHand.some(h=>!h.hidden&&h.id===c.id)).sort((a,b)=>freePickRank(b)-freePickRank(a)||a.id.localeCompare(b.id));
      const incoming=offers[0];if(!incoming)continue;const model=effects.getCardModel(incoming);
      if(!model||model.triggers?.length||model.temporaryTasks?.length||sector.supported(incoming)||movement.supported(incoming))continue;
      afterHand=[...afterHand,incoming];next.handSize++;bonusCardId=incoming.id;
      publicCards=publicCards.map(c=>c===incoming?(draws>0?{hidden:true,faceUp:false}:null):c);if(draws>0)draws--;
     }
     if(next.score<mark.threshold||mark.followingThreshold!==null&&next.score>=mark.followingThreshold)continue;
     const beforeClaim={...facts,player:next,hand:afterHand,extraUnknownCount:facts.extraUnknownCount+unknown,reservedCards,
      nextFinalMark:{...mark,currentScore:next.score}};
     const earned=probe.pendingFinalMarkOption(beforeClaim);if(earned?.tileId!=='b'||earned.formulaId!=='b1')continue;
     const symbols=Object.fromEntries(Object.keys(facts.researchSymbols).map(k=>[k,alien.amiba[k]]));
     // Only the earned B scoring profile is forecast. No Native mark/entity,
     // successor envelope, observation, sequence or board rotation is made.
     const after={...beforeClaim,researchSymbols:symbols,forecastFinalMark:{tileId:'b',formulaId:earned.formulaId,slotIndex:earned.slotIndex},
      sourcePendingFinalMarkChoice:null,nextFinalMark:mark.followingThreshold===null?null:{...mark,currentScore:next.score,
       threshold:mark.followingThreshold,followingThreshold:undefined,options:mark.options.filter(o=>o.tileId!==earned.tileId)},
      board:{...facts.board,publicCards,ordinaryDrawCount:draws,aliens:{...facts.board.aliens,amiba:symbols}}};
     const linear=arithmetic.sum([next.score-p.score,markGain(facts,owned),earned.currentValue,
      ...Object.entries(weights).filter(([k])=>k!=='handSize').map(([k,w])=>(next[k]-p[k])*w),
      (next.handSize-(facts.hand.length+facts.extraUnknownCount))*weights.handSize,
      technologyCapital(owned,facts.round,weights)-technologyCapital(p.techState,facts.round,weights)],weights);
     const afterCapital=portfolio(after),netGain=arithmetic.sum([linear,afterCapital,-currentCapital],weights);
     candidates.push({tileId,beneficiaryCardId:beneficiary.id,cornerCardId:payment.card?.id||null,bonusCardId,
      sourceRule:{cardId:rule.cardInstanceId,ruleId:rule.ruleId},slotId:chosen.entry.slotId,move:resolved.move,
      linear,afterCapital,netGain,wallet:next,symbols,forecastFinalMark:after.forecastFinalMark,ordinaryDrawCountAfter:draws});
    }
   }
  }
  candidates.sort((a,b)=>b.netGain-a.netGain||a.tileId.localeCompare(b.tileId)||a.beneficiaryCardId.localeCompare(b.beneficiaryCardId));
  return{value:Math.max(0,candidates[0]?.netGain||0),selected:candidates[0]||null,candidates,
   reason:candidates[0]?.netGain>0?'funded-research-symbol-continuation':'research-symbol-not-profitable',
   scope:'One known greedy publicity corner if needed, one funded nonblue research whose consumed public symbol moves into a held known data/symbol region, and the existing lower shared portfolio. Native bonus/data/domain scoring, one earned B profile, immutable existing identities; no owned probe, hidden identity, synthetic Native state/observation/entity, research recursion, search or pruning bound. Remaining Native purposes stay independent.'};
 }
 return Object.freeze({quote});
});
