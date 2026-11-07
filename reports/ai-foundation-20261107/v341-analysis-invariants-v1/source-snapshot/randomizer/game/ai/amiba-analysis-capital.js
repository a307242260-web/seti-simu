(function(root,factory){
 'use strict';const common=typeof module==='object'&&module.exports;
 const api=factory(common?require('../aliens/amiba'):root.SetiAlienAmiba,common?require('../aliens/state'):root.SetiAlienState,
  common?require('../players'):root.SetiPlayers,common?require('../data/placement'):root.SetiDataPlacement,
  common?require('../cards/effects'):root.SetiCardEffects,common?require('../end-game-scoring'):root.SetiEndGameScoring,
  common?require('./probe-capital'):root.SetiProbeCapital,common?require('./value-arithmetic'):root.SetiValueArithmetic,common?require('../cards/deck'):root.SetiCards,common?require('./income-card-order'):root.SetiIncomeCardOrder);
 if(common)module.exports=api;else root.SetiAmibaAnalysisCapital=api;
})(typeof globalThis!=='undefined'?globalThis:window,function(amiba,aliens,players,placement,effects,end,probe,arithmetic,cards,incomeOrder){
 'use strict';
 const readOnlyRewards=Object.freeze({readOnlyRewards:true});const zero=reason=>({value:0,selected:null,reason});
 const inertScores=new Set(['sectorWinsByColor','techCount','distinctSignalSectors','planetOrbitOrLand','planetLandingPairs','allOrbitOrLand','probeLocation','unmarkedFinalRightmost']);
 const traceCount=(facts,context,type)=>facts.traceCounts?.[type]??end.countTraceMarkers({id:facts.player.id,color:facts.player.color},context,type);
 const blueDataRule=t=>t.event?.type==='alienTrace'&&t.event.traceType==='blue'
  &&Object.keys(t.event).every(k=>['type','traceType'].includes(k))&&t.effect?.type==='gain_data'
  &&Number.isSafeInteger(t.effect.options?.count)&&t.effect.options.count>0
  &&Object.keys(t.effect.options).every(k=>['count','repeat'].includes(k))&&(t.effect.options.repeat??1)===1;
 function reservationsSafe(facts){
  return facts.reservedCards.every(card=>{
   const m=effects.getCardModel(card);if(!m||m.temporaryTasks?.length)return false;
   const consumed=card.cardEffectState?.modelCardId===card.cardId?card.cardEffectState.consumedTriggerIds||[]:[];
   if((m.triggers||[]).some(t=>!consumed.includes(t.id)&&!(t.event?.types||[t.event?.type]).every(type=>
     ['researchTech','move','visitPlanet','visitAsteroid','visitComet','launch','orbit','land'].includes(type)
     ||type==='alienTrace'&&(['pink','yellow'].includes(t.event.traceType)||blueDataRule(t)))))return false;
   if((m.triggers||[]).some(t=>!consumed.includes(t.id)&&blueDataRule(t))
     &&(card.cardEffectState?.modelCardId!==card.cardId||!Array.isArray(card.cardEffectState?.consumedTriggerIds)))return false;
   if((m.tasks||[]).some(t=>!card.cardEffectState?.completedTaskIds?.includes(t.id)
     &&(!['orbitOrLandCount','completedSectors','completedSectorsByColor','probeDistanceFromEarth','traceCount'].includes(t.condition?.type)
       ||t.condition.type==='traceCount'&&(!t.condition.traceType||t.condition.traceType==='blue'))))return false;
   const rule=end.resolveCardEndGameRule(card,effects);
   return !rule||inertScores.has(rule.kind)||['traceCount','amibaTraceCount'].includes(rule.kind);
  });
 }
 function publicAliens(facts){
  return {aliens:Object.fromEntries(facts.board.aliens.slots.map(s=>[String(s.slotId),{...s}])),
   amiba:{...facts.researchSymbols,...facts.amibaTraces,traceSlotsByAlienSlotId:{...facts.amibaTraces.traceSlotsByAlienSlotId},revealInitialized:true,cardDeck:[]}};
 }
 function analysisAliens(source,choice){
  // Copy the only trace path this candidate writes. All other trace colors,
  // species and face grids remain read-only inputs to the pure portfolio.
  const context={aliens:source.aliens,amiba:{...source.amiba}},id=String(choice.slot.slotId);
  if(choice.position){
   const grid=source.amiba.traceSlotsByAlienSlotId[id];
   context.amiba.traceSlotsByAlienSlotId={...source.amiba.traceSlotsByAlienSlotId,[id]:{...grid,blue:{...grid.blue}}};
  }else{
   const slot=source.aliens[id];
   context.aliens={...source.aliens,[id]:{...slot,traces:{...slot.traces,blue:{...slot.traces.blue}}}};
  }
  return context;
 }
 // Blue-trace metrics and one known completed trigger card can change.
 // Unknown new cards never become Type3 scoring facts.
 function secured(aliensState,facts,stableB1=null){
  const actor={id:facts.player.id,color:facts.player.color,reservedCards:facts.reservedCards,techState:facts.player.techState,completedTaskCount:facts.player.completedTaskCount},context={aliens:aliensState};let value=0;
  const board=facts.board.finalScoring,mark=board?.tiles?.b?.marks?.find(m=>m.playerId===actor.id)||(facts.forecastFinalMark?.tileId==='b'?facts.forecastFinalMark:null),formula=board&&end.getFormulaId('b',board.tileVariants.b);
  if(mark&&formula==='b1')value+=stableB1===null?Math.min(...['yellow','pink','blue'].map(type=>traceCount(facts,aliensState,type)))*end.getSlotMultiplier(formula,mark.slotIndex):stableB1;
  const cMark=board?.tiles?.c?.marks?.find(m=>m.playerId===actor.id),cFormula=board&&end.getFormulaId('c',board.tileVariants.c);
  if(cMark)value+=end.getFormulaBaseValue(cFormula,actor,context)*end.getSlotMultiplier(cFormula,cMark.slotIndex);
  for(const card of facts.reservedCards){const rule=end.resolveCardEndGameRule(card,effects);
   if(rule&&['traceCount','amibaTraceCount'].includes(rule.kind)&&rule.traceType==='blue')value+=rule.kind==='traceCount'&&facts.traceCounts?Number(rule.scorePer||0)*facts.traceCounts.blue:end.scoreCardEndGameRule(rule,actor,context);
  }
  return value;
 }
 function securedScope(aliensState,facts){
  const board=facts.board.finalScoring;
  const mark=board?.tiles?.b?.marks?.find(m=>m.playerId===facts.player.id)||(facts.forecastFinalMark?.tileId==='b'?facts.forecastFinalMark:null);
  const formula=board&&end.getFormulaId('b',board.tileVariants.b);let capped=true,stableB1=null;
  if(mark&&formula==='b1'){
   const cap=Math.min(traceCount(facts,aliensState,'yellow'),traceCount(facts,aliensState,'pink'));
   // Every local candidate adds only a blue marker. Other colors and their
   // owners remain read-only; an already capped B1 cannot grow in this quote.
   capped=traceCount(facts,aliensState,'blue')>=cap;
   if(capped)stableB1=cap*end.getSlotMultiplier(formula,mark.slotIndex);
  }
  let blueData=false,blueScore=false;
  for(const card of facts.reservedCards){
   const model=effects.getCardModel(card),consumed=card.cardEffectState?.consumedTriggerIds||[];
   if((model.triggers||[]).some(t=>!consumed.includes(t.id)&&blueDataRule(t)))blueData=true;
   const rule=end.resolveCardEndGameRule(card,effects);
   if(rule&&['traceCount','amibaTraceCount'].includes(rule.kind)&&rule.traceType==='blue')blueScore=true;
  }
  // Without this event's data trigger no reserved card is completed/removed,
  // so C1/C2 and the other admitted secured inputs also remain unchanged.
  return{stableB1,blueData,fixed:capped&&!blueData&&!blueScore};
 }
 // Native merges every matching slot/card into one choice for this event.
 // Keep the selected consumption in the typed endpoint; another blue trace
 // may consume another slot, never this same one for a second time.
 function blueDataChoice(facts,weights,wallet,context,stableB1){
  const choices=[];
  for(const card of facts.reservedCards){
   const model=effects.getCardModel(card),consumed=card.cardEffectState?.consumedTriggerIds||[];
   for(const trigger of model.triggers||[]){
    if(consumed.includes(trigger.id)||!blueDataRule(trigger))continue;
    const copy=structuredClone(card);effects.consumeTrigger(copy,trigger.id);
    const completed=effects.areAllTriggersConsumed(copy);
    if(completed&&(!Number.isSafeInteger(wallet.completedTaskCount)||wallet.completedTaskCount<0))throw TypeError('VALUE_COMPLETED_TASK_COUNT_INVALID');
    const after={...wallet,...(completed?{completedTaskCount:wallet.completedTaskCount+1}:{})};
    players.gainResources({resources:after},{availableData:trigger.effect.options.count});
    const reservedCards=facts.reservedCards.flatMap(c=>c!==card?[c]:completed?[]:[copy]);
    const nextFacts={...facts,player:after,reservedCards},gain=after.availableData-wallet.availableData;
    const net=gain*weights.availableData+secured(context,nextFacts,stableB1)-secured(context,{...facts,player:wallet},stableB1);
    choices.push({available:true,wallet:after,reservedCards,trigger:{cardInstanceId:card.id,ruleId:trigger.id,gainedData:gain,completed},net});
   }
  }
  choices.sort((a,b)=>b.net-a.net||Number(b.trigger.completed)-Number(a.trigger.completed)||a.trigger.cardInstanceId.localeCompare(b.trigger.cardInstanceId)||a.trigger.ruleId.localeCompare(b.trigger.ruleId));
  const selected=choices[0];
  return selected&&(selected.trigger.gainedData>0||selected.trigger.completed)?selected:null;
 }
 function incomePreparation(facts,weights,portfolio,baseValue){
  const placed=facts.computerSlots;
  if(placed.length!==3||placed.some((s,i)=>s!==i+1)||facts.player.availableData<3)return zero('analysis-not-ready');
  const initial=facts.player,board=facts.board.finalScoring,aMark=board?.tiles?.a?.marks?.find(m=>m.playerId===initial.id);
  const formula=aMark&&end.getFormulaId('a',board.tileVariants.a),incomeScore=wallet=>aMark?end.getFormulaBaseValue(formula,wallet,{})*end.getSlotMultiplier(formula,aMark.slotIndex):0;
  const scalarQuotes=new Map(),incomeCards=new Map(facts.hand.map(c=>[c.id,c]));
  let shared;
  const options=facts.hand.filter(c=>c.cardId&&!c.hidden).flatMap(card=>{
   const gain=cards.getIncomeGainForCard(card);if(!gain||!Object.keys(gain).length||Object.keys(gain).some(k=>!['credits','energy'].includes(k)))return[];
   const wallet={...initial,availableData:initial.availableData-1,handSize:facts.hand.length+facts.extraUnknownCount-1,income:{...initial.income}};
   players.gainResources({resources:wallet},gain);for(const[k,v]of Object.entries(gain))wallet.income[k]+=v;
   // The pre-income score, columns, and arithmetic order do not depend on
   // the candidate card. Its live wallet and hand removal still do.
   shared??={columnScore:Object.entries(initial.techState.blueBoardSlots)
    .filter(([id,slot])=>initial.techState.ownedTiles[id]&&!initial.techState.disabledTiles[id]&&placement.getRequiredComputerSlotForBlueBonus(slot)===4).length*placement.getBlueColumnScoreBonus().score,
    incomeScore:incomeScore(initial),weights:Object.entries(weights).filter(([k])=>k!=='handSize')};
   players.gainResources({resources:wallet},{score:shared.columnScore});
   const nextFinalMark=facts.nextFinalMark&&{...facts.nextFinalMark,options:facts.nextFinalMark.options.map(o=>['a1','a2'].includes(o.formulaId)?{...o,currentValue:end.getFormulaBaseValue(o.formulaId,wallet,{})*o.multiplier}:o)};
   const hand=facts.hand.filter(c=>c.id!==card.id),progress={hand,computerSlots:[1,2,3,4],blueSlots:facts.blueSlots,nextFinalMark};
   const removalClass=portfolio.incomeRemovalClass?.(card),key=removalClass==null?null:JSON.stringify([removalClass,gain]);
   const after=key!==null&&scalarQuotes.has(key)?scalarQuotes.get(key):portfolio(wallet,facts.board.aliens.slots,progress);
   if(key!==null)scalarQuotes.set(key,after);
   const linear=arithmetic.sum([wallet.score-initial.score,incomeScore(wallet)-shared.incomeScore,-weights.handSize,
    ...shared.weights.map(([k,w])=>(wallet[k]-initial[k])*w),
    ...Object.entries(gain).map(([k,v])=>v*(weights[k]||0)*(4-facts.round))],weights);
   return[{cardId:card.id,wallet,progress,after,linear,value:arithmetic.sum([linear,after,-baseValue],weights)}];
  }).sort((a,b)=>b.value-a.value||incomeOrder.compare(incomeCards.get(a.cardId),incomeCards.get(b.cardId)));
  const selected=options[0];if(!selected)return zero('analysis-known-currency-income-missing');
  const next={...facts,...selected.progress,player:selected.wallet},tail=quote(next,weights,(wallet,slots,progress={})=>portfolio(wallet,slots,{...selected.progress,...progress}),selected.after);
  if(!tail.selected)return zero('income-analysis-tail-unavailable');
  if(facts.nextFinalMark&&tail.selected.endpoint.resources.score>=facts.nextFinalMark.threshold){
   const mark=facts.nextFinalMark,source=facts.sourcePendingFinalMarkChoice,before=probe.pendingFinalMarkOption(facts),after=probe.pendingFinalMarkOption(next);
   const sameB=(a,b)=>a&&b&&a.tileId==='b'&&b.tileId===a.tileId&&b.formulaId===a.formulaId&&b.slotIndex===a.slotIndex;
   const nextThreshold=mark.followingThreshold;
   if(!(mark.currentScore>=mark.threshold)||!sameB(source,before)||!sameB(source,after)||nextThreshold===undefined
     ||nextThreshold!==null&&tail.selected.endpoint.resources.score>=nextThreshold)return zero('income-analysis-new-mark-needs-native-value');
  }
  const net=arithmetic.sum([selected.linear,tail.selected.planNetGain,selected.after,-baseValue],weights);
  return{value:Math.max(0,net),selected:{...tail.selected,incomeCardId:selected.cardId,preparationPlacements:3,incomePreparation:{linear:selected.linear,capitalAfter:selected.after,greedyValue:selected.value},planNetGain:net},get candidates(){return tail.candidates;},set candidates(value){tail.candidates=value;},
   reason:net>0?'funded-known-income-amiba-analysis':'income-amiba-analysis-not-profitable',
   scope:'One current-data-funded computer4 income followed by the existing fixed computer5/6 and analysis plan. Greedy known currency income ranked once by linear income and shared base portfolio, then one analysis quote; same hand, wallet and data, no unknown identity or new mark funding, native successor, search or pruning bound.'};
 }
 function quote(facts,weights,portfolio,baseValue){
  if(!facts.amibaTraces||!facts.researchSymbols?.revealInitialized)return zero('missing-public-amiba-analysis');
  if(facts.pendingNativeEffects||!Array.isArray(facts.pendingCardTriggers)||facts.pendingCardTriggers.length)return zero('pending-amiba-analysis-effects');
  const id=facts.amibaTraces.revealedSlotId;
  const mixed=facts.board.aliens.slots.some(s=>s.revealed&&Number(s.slotId)!==Number(id));
  if(mixed&&!facts.traceCounts)throw TypeError('VALUE_TRACE_COUNTS_MISSING');
  if(facts.traceCounts&&['blue','pink','yellow'].some(type=>!Number.isSafeInteger(facts.traceCounts[type])||facts.traceCounts[type]<0))throw TypeError('VALUE_TRACE_COUNTS_INVALID');
  if(!reservationsSafe(facts))return zero('amiba-analysis-reservation-needs-native-value');
  if(!Number.isSafeInteger(facts.board.ordinaryDrawCount)||facts.board.ordinaryDrawCount<0
    ||!Number.isSafeInteger(facts.amibaTraces.blindCardCount)||facts.amibaTraces.blindCardCount<0)return zero('missing-public-analysis-card-counts');
  const placed=facts.computerSlots,needed=[1,2,3,4,5,6].filter(s=>!placed.includes(s));
  if(placed.length===3)return incomePreparation(facts,weights,portfolio,baseValue);
  if(needed.length&&(placed.length<4||placed.some((slot,i)=>slot!==i+1)||needed.some(slot=>slot<5)||facts.player.availableData<needed.length))return zero('analysis-not-ready');
  const payment=probe.funding(facts.player,{energy:facts.analyzeEnergyCost},weights);if(!payment)return zero('analysis-not-funded');
  const initial=facts.player,paid={...initial,credits:initial.credits-payment.spend.credits,energy:initial.energy-payment.spend.energy,availableData:initial.availableData-needed.length,
    handSize:facts.hand.length+facts.extraUnknownCount};
  const columns=Object.entries(initial.techState.blueBoardSlots).filter(([tile,slot])=>initial.techState.ownedTiles[tile]&&!initial.techState.disabledTiles[tile]&&needed.includes(placement.getRequiredComputerSlotForBlueBonus(slot))).length;
  players.gainResources({resources:paid},{score:columns*placement.getBlueColumnScoreBonus().score});
  const originalAliens=publicAliens(facts),scope=securedScope(originalAliens,facts);
  const beforeSecured=scope.fixed?0:secured(originalAliens,facts,scope.stableB1),candidates=[];
  const nextThreshold=mixed&&facts.nextFinalMark?(initial.score<facts.nextFinalMark.threshold?facts.nextFinalMark.threshold:facts.nextFinalMark.followingThreshold):null;
  if(nextThreshold===undefined)return zero('mixed-analysis-following-mark-missing');
  let markBoundary=false;
  const choices=facts.board.aliens.slots.flatMap(slot=>{
   if(Number(slot.slotId)===Number(id))return[...amiba.TRACE_POSITIONS.filter(position=>amiba.canPlaceAmibaTrace(originalAliens,id,'blue',position).ok).map(position=>({slot,position,reward:amiba.getTraceReward(originalAliens,'blue',position,readOnlyRewards)})),
    ...(mixed&&slot.traces?.blue?.firstPlaced?[{slot,first:false,reward:aliens.getExtraTraceReward()}]:[])];
   if(slot.revealed)return slot.traces?.blue?.firstPlaced?[{slot,first:false,reward:aliens.getExtraTraceReward()}]:[];const first=!slot.traces?.blue?.firstPlaced;
   if(first&&['pink','yellow'].every(t=>slot.traces?.[t]?.firstPlaced))return[];
   return[{slot,first,reward:first?aliens.getFirstTraceRewardForSlot(slot.slotId):aliens.getExtraTraceReward()}];
  });
  // Technology ownership, column rewards and arithmetic key order stay the
  // same across this quote's local trace wallets. Funding remains per wallet.
  const resourceKeys=Object.keys(weights).filter(k=>k!=='handSize');
  // A root-visible displayed card can fund one immediate computer placement
  // after this analysis. Price the actual printed corner without inventing a
  // hand entity, using a blind outcome, or treating the replacement as known.
  const display=facts.amibaTraces.displayedCardIndex;
  const known=arithmetic.isDefault(weights)&&scope.fixed&&facts.turnCardBonusCount===0
   &&facts.companyState?.abilityId==='deepspace_swap_cards'&&facts.amibaTraces.displayedCardAvailable
   &&Number.isSafeInteger(display)?amiba.getCardDefinition(display):null;
  const corner=known&&cards.getDiscardActionRewardForCode(known.discardActionCode);
  const cornerColumnScore=corner?.dataCount===1&&Object.keys(corner.gain||{}).every(k=>k==='score')
   &&Object.keys(corner).every(k=>['code','label','gain','dataCount'].includes(k))
   ?Object.entries(initial.techState.blueBoardSlots).filter(([tile,slot])=>initial.techState.ownedTiles[tile]
    &&!initial.techState.disabledTiles[tile]&&placement.getRequiredComputerSlotForBlueBonus(slot)===1).length*placement.getBlueColumnScoreBonus().score:0;
  const blueTails=Object.entries(initial.techState.blueBoardSlots).flatMap(([tileId,slot])=>{
   const required=placement.getRequiredComputerSlotForBlueBonus(slot),bonus=placement.getBlueTileDataBonus(tileId);
   if(!initial.techState.ownedTiles[tileId]||initial.techState.disabledTiles[tileId]||!required||required>=4||!bonus||!['credits','energy','publicity'].includes(bonus.type))return[];
   const columns=Object.entries(initial.techState.blueBoardSlots).filter(([tile,s])=>initial.techState.ownedTiles[tile]&&!initial.techState.disabledTiles[tile]&&placement.getRequiredComputerSlotForBlueBonus(s)<=required).length;
   return[{slot:Number(slot),required,bonus,columns}];
  });
  // Snapshot value-copied metadata at quote time. Lazy explanations never
  // read a later wallet, slot shell, blue progress or final-mark input.
  const symbolKeys=Object.keys(facts.researchSymbols),blueSnapshot=(facts.blueSlots||[]).map(b=>({...b,occupied:false,unlocked:false})),alienSnapshot={...facts.board.aliens},extraUnknownCount=facts.extraUnknownCount;
  // Fixed secured score without blue-data observers does not inspect the
  // new face marker while ranking. Snapshot its original blue grid once;
  // selected portfolio/explanation still gets the complete owned context.
  const deferFaces=scope.fixed&&choices.some(choice=>choice.position),faceGrid=deferFaces?originalAliens.amiba.traceSlotsByAlienSlotId[String(id)]:null;
  const faceSource=deferFaces?{...originalAliens,amiba:{...originalAliens.amiba,traceSlotsByAlienSlotId:{...originalAliens.amiba.traceSlotsByAlienSlotId,[String(id)]:{...faceGrid,blue:{...faceGrid.blue}}}}}:null;
  const actor={playerId:initial.id,playerColor:initial.color};
  function materialize(candidate){
   if(candidate.materialized)return candidate.plan;
   const {plan,traceCounts,triggerProgress,wallet,required,ordinaryLeft}=candidate;
   let context=candidate.context;
   if(!context){
    context=analysisAliens(faceSource,{slot:{slotId:plan.slotId},position:plan.position});
    context.amiba.traceSlotsByAlienSlotId[String(id)].blue[plan.position]={traceType:'blue',position:plan.position,...actor};
    context.amiba.blindCardCount=candidate.blindCardCount;context.amiba.displayedCardAvailable=candidate.displayedCardAvailable;
    if(plan.region){const prepared=regionalPlans.get(plan.region.region);context.amiba.symbolSlots=prepared.symbolSlots;context.amiba.symbolsById=prepared.symbolsById;}
   }
   const symbols=Object.fromEntries(symbolKeys.map(k=>[k,context.amiba[k]])),traces={revealedSlotId:id,traceSlotsByAlienSlotId:context.amiba.traceSlotsByAlienSlotId,
    blindCardCount:context.amiba.blindCardCount,displayedCardAvailable:context.amiba.displayedCardAvailable},slots=Object.entries(context.aliens).map(([slotId,s])=>({...s,slotId:Number(slotId)}));
   plan.endpoint={resources:wallet,...(traceCounts?{traceCounts}:{}),computerSlots:required===null?[]:[1,2,3].filter(n=>n<=required),
    blueSlots:blueSnapshot.map(b=>required===null?{...b}:{...b,occupied:b.slot===plan.blueSlot,unlocked:placement.getRequiredComputerSlotForBlueBonus(b.slot)<=required}),researchSymbols:symbols,amibaTraces:traces,
    extraUnknownCount:extraUnknownCount+plan.unknownCards,aliens:{...alienSnapshot,slots,amiba:symbols,amibaTraces:traces},ordinaryDrawCount:ordinaryLeft,...triggerProgress};
   if(plan.region)plan.region={...plan.region,results:plan.region.results.map(r=>({...r,move:r.move&&{...r.move}}))};
   candidate.materialized=true;return plan;
  }
  // Every blue position resolves the same original symbol layout. Execute
  // that Native prefix once per region, then apply its rewards to each wallet.
  // Only privately copied symbol maps/entries are shared read-only; each
  // candidate still owns its traces, draw counts, wallet and result wrappers.
  const regionalPlans=new Map();
  function regionalPlan(region){
   if(regionalPlans.has(region))return regionalPlans.get(region);
   const alien={amiba:amiba.copyPublicSymbolState(originalAliens.amiba)},result=amiba.resolveRegionReward(alien,region,readOnlyRewards);
   if(!result.ok)throw Error('AMIBA_ANALYSIS_REGION_QUERY_FAILED');
   Object.values(alien.amiba.symbolsById).forEach(Object.freeze);
   const plan={result,symbolSlots:Object.freeze(alien.amiba.symbolSlots),symbolsById:Object.freeze(alien.amiba.symbolsById)};
   regionalPlans.set(region,plan);return plan;
  }
  for(const choice of choices){
   const deferredFace=scope.fixed&&Boolean(choice.position),context=deferredFace?null:analysisAliens(originalAliens,choice),wallet={...paid};let unknownCards=0,ordinaryLeft=facts.board.ordinaryDrawCount;
   let blindCardCount=originalAliens.amiba.blindCardCount,displayedCardAvailable=originalAliens.amiba.displayedCardAvailable;
   const apply=reward=>{
    players.gainResources({resources:wallet},reward.gain||{});if(reward.dataCount)players.gainResources({resources:wallet},{availableData:reward.dataCount});
    if((reward.drawCards||0)>ordinaryLeft)return false;ordinaryLeft-=reward.drawCards||0;unknownCards+=reward.drawCards||0;return true;
   };
   if(choice.position){
    // Occupancy metric for formal scoring only; no sequence/entity is made.
    if(context)context.amiba.traceSlotsByAlienSlotId[String(id)].blue[choice.position]={traceType:'blue',position:choice.position,playerId:initial.id,playerColor:initial.color};
    if(choice.reward.pickAlienCard){
     if(blindCardCount>0)blindCardCount--;else if(displayedCardAvailable)displayedCardAvailable=false;else continue;
     if(context){context.amiba.blindCardCount=blindCardCount;context.amiba.displayedCardAvailable=displayedCardAvailable;}
     unknownCards++;
    }
   }else{
    const trace=context.aliens[String(choice.slot.slotId)].traces.blue;
    if(choice.first)Object.assign(trace,{firstPlaced:true,ownerPlayerId:initial.id,ownerPlayerColor:initial.color});
    else{trace.extraCount=(trace.extraCount||0)+1;trace.extraMarkers=[...(trace.extraMarkers||[]),{playerId:initial.id,playerColor:initial.color}];}
   }
   if(!apply(choice.reward))continue;
   let region=null;
   if(choice.reward.region){
    const plan=regionalPlan(choice.reward.region);if(context){context.amiba.symbolSlots=plan.symbolSlots;context.amiba.symbolsById=plan.symbolsById;}
    region=plan.result;let valid=true;
    for(const r of region.results)if(!apply(r.reward)){valid=false;break;}if(!valid)continue;
   }
   if(nextThreshold!==null&&wallet.score>=nextThreshold){markBoundary=true;continue;}
   const traceCounts=facts.traceCounts?{...facts.traceCounts,blue:facts.traceCounts.blue+1}:null;
   const trigger=scope.blueData?blueDataChoice(traceCounts?{...facts,traceCounts}:facts,weights,wallet,context,scope.stableB1):null;
   if(trigger)Object.assign(wallet,trigger.wallet);
   wallet.handSize+=unknownCards;
   // Trigger consumption and final-mark facts are captured now; only their
   // explanatory endpoint container may be built after local ranking.
   const triggerProgress=trigger?{reservedCards:trigger.reservedCards,nextFinalMark:facts.nextFinalMark&&{...facts.nextFinalMark,options:facts.nextFinalMark.options.map(o=>o.tileId==='c'?{...o,currentValue:end.getFormulaBaseValue(o.formulaId,{...wallet,reservedCards:trigger.reservedCards},{})*o.multiplier}:o)}}:null;
   const securedGain=scope.fixed?0:secured(context,{...facts,...(traceCounts?{traceCounts}:{}),player:wallet,reservedCards:trigger?.reservedCards||facts.reservedCards},scope.stableB1)-beforeSecured;
   const delta=(w,extra=unknownCards)=>arithmetic.sum([w.score-initial.score,securedGain,extra*weights.handSize,...resourceKeys.map(k=>(w[k]-initial[k])*weights[k])],weights);
   let best={value:delta(wallet),wallet,required:null,blueSlot:null};
   for(const {slot,required,bonus,columns}of blueTails){
    if(wallet.availableData<required+1)continue;
    const after={...wallet,availableData:wallet.availableData-required-1};
    if(required>=2)players.gainResources({resources:after},{publicity:placement.getComputerSlotBonus(2).publicity});
    players.gainResources({resources:after},{[bonus.type]:bonus[bonus.type],score:columns*placement.getBlueColumnScoreBonus().score});
    const value=delta(after);
    if(value>best.value)best={value,wallet:after,required,blueSlot:Number(slot)};
   }
   if(cornerColumnScore>0&&choice.reward.pickAlienCard&&wallet.availableData<players.RESOURCE_LIMITS.availableData){
    const after={...wallet,handSize:wallet.handSize-1};
    players.gainResources({resources:after},{...corner.gain,availableData:corner.dataCount});
    after.availableData--;players.gainResources({resources:after},{score:cornerColumnScore});
    // Pending or newly crossed marks require the actual Native decision.
    if(!facts.nextFinalMark||after.score<facts.nextFinalMark.threshold){
     const value=delta(after,unknownCards-1);
     if(value>best.value)best={value,wallet:after,required:1,blueSlot:null,publicCorner:{cardIndex:display,cardId:known.cardId,computerSlot:1,cornerScore:corner.gain?.score||0,placementScore:cornerColumnScore}};
    }
   }
   const remainingUnknown=unknownCards-Number(Boolean(best.publicCorner));
   const plan={slotId:choice.slot.slotId,position:choice.position||null,traceType:'blue',payment,preparationPlacements:needed.length,blueSlot:best.blueSlot,
    planNetGain:null,localPlanValue:best.value,linearGain:delta(best.wallet,remainingUnknown),securedGain,unknownCards:remainingUnknown,region,...(best.publicCorner?{publicCorner:best.publicCorner}:{}),...(trigger?{blueDataTrigger:trigger.trigger}:{})};
   candidates.push({plan,context,traceCounts,triggerProgress,wallet:best.wallet,required:best.required,ordinaryLeft,blindCardCount,displayedCardAvailable,materialized:false});
  }
  candidates.sort((a,b)=>b.plan.localPlanValue-a.plan.localPlanValue||a.plan.slotId-b.plan.slotId||(b.plan.position||0)-(a.plan.position||0));
  const selected=candidates.length?materialize(candidates[0]):null;
  if(!selected&&markBoundary)return zero('mixed-analysis-final-mark-needs-native-value');
  if(selected){const {resources,aliens,...progress}=selected.endpoint;selected.planNetGain=arithmetic.sum([selected.linearGain,portfolio(resources,aliens.slots,{...progress,aliens}),-baseValue],weights);}
  let explanations,explanationsReady=false;
  return{value:Math.max(0,selected?.planNetGain||0),selected:selected||null,
   get candidates(){if(!explanationsReady){explanations=candidates.map(materialize);explanationsReady=true;}return explanations;},
   set candidates(value){explanations=value;explanationsReady=true;},
   reason:selected?.planNetGain>0?'funded-known-amiba-analysis':'amiba-analysis-not-profitable',
   scope:'One fixed locally greedy funded analysis/blue-trace/currency-tail plan, ranked by current formal net rewards, then exactly one shared-portfolio requote. Unselected local candidates have no planNetGain. Unknown draw counts or one publicly displayed score/data corner followed by computer1; shared wallet and existing base portfolio opportunity cost. No hidden reveal, entity allocation, successor observation, new final mark or pruning bound.'};
 }
 return Object.freeze({quote});
});
