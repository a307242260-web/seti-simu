(function(root,factory){
 'use strict';const common=typeof module==='object'&&module.exports;
 const api=factory(common?require('../aliens/amiba'):root.SetiAlienAmiba,common?require('../aliens/state'):root.SetiAlienState,
  common?require('../players'):root.SetiPlayers,common?require('../data/placement'):root.SetiDataPlacement,
  common?require('../cards/effects'):root.SetiCardEffects,common?require('../end-game-scoring'):root.SetiEndGameScoring,
  common?require('./probe-capital'):root.SetiProbeCapital,common?require('./value-arithmetic'):root.SetiValueArithmetic,common?require('../cards/deck'):root.SetiCards,common?require('./income-card-order'):root.SetiIncomeCardOrder);
 if(common)module.exports=api;else root.SetiAmibaAnalysisCapital=api;
})(typeof globalThis!=='undefined'?globalThis:window,function(amiba,aliens,players,placement,effects,end,probe,arithmetic,cards,incomeOrder){
 'use strict';const zero=reason=>({value:0,selected:null,reason});
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
  return {aliens:Object.fromEntries(facts.board.aliens.slots.map(s=>[String(s.slotId),s])),
   amiba:{...facts.researchSymbols,...facts.amibaTraces,traceSlotsByAlienSlotId:{...facts.amibaTraces.traceSlotsByAlienSlotId},revealInitialized:true,cardDeck:[]}};
 }
 function analysisAliens(source,copySymbols=true){
  // Only blue occupancy/counts and symbol slot locations are written below.
  // Other trace colors and marker entries are read-only scoring inputs.
  return{aliens:Object.fromEntries(Object.entries(source.aliens).map(([id,slot])=>[id,{...slot,traces:{...slot.traces,blue:{...slot.traces.blue}}}])),
   amiba:{...(copySymbols?amiba.copyPublicSymbolState(source.amiba):source.amiba),
    traceSlotsByAlienSlotId:Object.fromEntries(Object.entries(source.amiba.traceSlotsByAlienSlotId).map(([id,grid])=>[id,{...grid,blue:{...grid.blue}}]))}};
 }
 const geometryQuotes=new Map(),unsupportedGeometry=Object.freeze({});
 function geometryKey(value){
  const active=new Set();
  function encode(v){
   if(v===null)return 'null';
   if(typeof v==='undefined')return 'undefined';
   if(typeof v==='string')return 's'+JSON.stringify(v);
   if(typeof v==='boolean')return v?'true':'false';
   if(typeof v==='number'){if(!Number.isFinite(v))throw unsupportedGeometry;return Object.is(v,-0)?'-0':'n'+v;}
   if(typeof v!=='object'||active.has(v))throw unsupportedGeometry;
   const array=Array.isArray(v),proto=Object.getPrototypeOf(v);
   if(array?proto!==Array.prototype:proto!==Object.prototype&&proto!==null)throw unsupportedGeometry;
   active.add(v);let out=array?'array{':proto===null?'null-object{':'object{';
   for(const name of Reflect.ownKeys(v)){
    if(typeof name!=='string')throw unsupportedGeometry;
    const d=Object.getOwnPropertyDescriptor(v,name);if(!Object.hasOwn(d,'value'))throw unsupportedGeometry;
    out+=JSON.stringify(name)+':'+encode(d.value)+';';
   }
   active.delete(v);return out+'}';
  }
  try{return encode(value);}catch(error){if(error!==unsupportedGeometry)throw error;return null;}
 }
 function freezeGeometry(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freezeGeometry);Object.freeze(v);}return v;}
 function analysisGeometry(facts,originalAliens,id,mixed){
  const key=geometryKey([facts.board.aliens.slots,facts.researchSymbols,facts.amibaTraces,id,mixed,facts.player.id,facts.player.color,facts.board.ordinaryDrawCount]);
  if(key!==null&&geometryQuotes.has(key))return geometryQuotes.get(key);
  const choices=facts.board.aliens.slots.flatMap(slot=>{
   if(Number(slot.slotId)===Number(id))return[...amiba.TRACE_POSITIONS.filter(position=>amiba.canPlaceAmibaTrace(originalAliens,id,'blue',position).ok).map(position=>({slot,position,reward:amiba.getTraceReward(originalAliens,'blue',position)})),
    ...(mixed&&slot.traces?.blue?.firstPlaced?[{slot,first:false,reward:aliens.getExtraTraceReward()}]:[])];
   if(slot.revealed)return slot.traces?.blue?.firstPlaced?[{slot,first:false,reward:aliens.getExtraTraceReward()}]:[];const first=!slot.traces?.blue?.firstPlaced;
   if(first&&['pink','yellow'].every(t=>slot.traces?.[t]?.firstPlaced))return[];
   return[{slot,first,reward:first?aliens.getFirstTraceRewardForSlot(slot.slotId):aliens.getExtraTraceReward()}];
  });
  const prepared=choices.flatMap(choice=>{
   const context=analysisAliens(originalAliens,Boolean(choice.reward.region));
   if(choice.position){
    context.amiba.traceSlotsByAlienSlotId[String(id)].blue[choice.position]={traceType:'blue',position:choice.position,playerId:facts.player.id,playerColor:facts.player.color};
    if(choice.reward.pickAlienCard){
     if(context.amiba.blindCardCount>0)context.amiba.blindCardCount--;
     else if(context.amiba.displayedCardAvailable)context.amiba.displayedCardAvailable=false;
     else return[];
    }
   }else{
    const trace=context.aliens[String(choice.slot.slotId)].traces.blue;
    if(choice.first)Object.assign(trace,{firstPlaced:true,ownerPlayerId:facts.player.id,ownerPlayerColor:facts.player.color});
    else{trace.extraCount=(trace.extraCount||0)+1;trace.extraMarkers=[...(trace.extraMarkers||[]),{playerId:facts.player.id,playerColor:facts.player.color}];}
   }
   // The original quote does not reach the region if its first draw cannot
   // be supplied. Keep that exact public-count boundary before resolution.
   const region=choice.reward.region&&(choice.reward.drawCards||0)<=facts.board.ordinaryDrawCount
    ?amiba.resolveRegionReward(context,choice.reward.region):null;
   if(region&&!region.ok)throw Error('AMIBA_ANALYSIS_REGION_QUERY_FAILED');
   const symbols=Object.fromEntries(Object.keys(facts.researchSymbols).map(k=>[k,context.amiba[k]])),
    traces={revealedSlotId:id,traceSlotsByAlienSlotId:context.amiba.traceSlotsByAlienSlotId,blindCardCount:context.amiba.blindCardCount,displayedCardAvailable:context.amiba.displayedCardAvailable},
    slots=Object.entries(context.aliens).map(([slotId,s])=>({...s,slotId:Number(slotId)}));
   return[{choice,context,region,symbols,traces,slots}];
  });
  if(key===null)return prepared;
  // Detach before freezing: borrowed source marker/symbol entries must stay
  // caller-owned. Cached public templates never become writable game state.
  const saved=freezeGeometry(structuredClone(prepared));
  if(geometryQuotes.size>=32)geometryQuotes.delete(geometryQuotes.keys().next().value);
  geometryQuotes.set(key,saved);return saved;
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
  const options=facts.hand.filter(c=>c.cardId&&!c.hidden).flatMap(card=>{
   const gain=cards.getIncomeGainForCard(card);if(!gain||!Object.keys(gain).length||Object.keys(gain).some(k=>!['credits','energy'].includes(k)))return[];
   const wallet={...initial,availableData:initial.availableData-1,handSize:facts.hand.length+facts.extraUnknownCount-1,income:{...initial.income}};
   players.gainResources({resources:wallet},gain);for(const[k,v]of Object.entries(gain))wallet.income[k]+=v;
   const columns=Object.entries(initial.techState.blueBoardSlots).filter(([id,slot])=>initial.techState.ownedTiles[id]&&!initial.techState.disabledTiles[id]&&placement.getRequiredComputerSlotForBlueBonus(slot)===4).length;
   players.gainResources({resources:wallet},{score:columns*placement.getBlueColumnScoreBonus().score});
   const nextFinalMark=facts.nextFinalMark&&{...facts.nextFinalMark,options:facts.nextFinalMark.options.map(o=>['a1','a2'].includes(o.formulaId)?{...o,currentValue:end.getFormulaBaseValue(o.formulaId,wallet,{})*o.multiplier}:o)};
   const hand=facts.hand.filter(c=>c.id!==card.id),progress={hand,computerSlots:[1,2,3,4],blueSlots:facts.blueSlots,nextFinalMark};
   const removalClass=portfolio.incomeRemovalClass?.(card),key=removalClass==null?null:JSON.stringify([removalClass,gain]);
   const after=key!==null&&scalarQuotes.has(key)?scalarQuotes.get(key):portfolio(wallet,facts.board.aliens.slots,progress);
   if(key!==null)scalarQuotes.set(key,after);
   const linear=arithmetic.sum([wallet.score-initial.score,incomeScore(wallet)-incomeScore(initial),-weights.handSize,
    ...Object.entries(weights).filter(([k])=>k!=='handSize').map(([k,w])=>(wallet[k]-initial[k])*w),
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
  return{...tail,value:Math.max(0,net),selected:{...tail.selected,incomeCardId:selected.cardId,preparationPlacements:3,incomePreparation:{linear:selected.linear,capitalAfter:selected.after,greedyValue:selected.value},planNetGain:net},
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
  // Technology ownership, column rewards and arithmetic key order stay the
  // same across this quote's local trace wallets. Funding remains per wallet.
  const resourceKeys=Object.keys(weights).filter(k=>k!=='handSize');
  const blueTails=Object.entries(initial.techState.blueBoardSlots).flatMap(([tileId,slot])=>{
   const required=placement.getRequiredComputerSlotForBlueBonus(slot),bonus=placement.getBlueTileDataBonus(tileId);
   if(!initial.techState.ownedTiles[tileId]||initial.techState.disabledTiles[tileId]||!required||required>=4||!bonus||!['credits','energy','publicity'].includes(bonus.type))return[];
   const columns=Object.entries(initial.techState.blueBoardSlots).filter(([tile,s])=>initial.techState.ownedTiles[tile]&&!initial.techState.disabledTiles[tile]&&placement.getRequiredComputerSlotForBlueBonus(s)<=required).length;
   return[{slot:Number(slot),required,bonus,columns}];
  });
  for(const {choice,context,region,symbols,traces,slots}of analysisGeometry(facts,originalAliens,id,mixed)){
   const wallet={...paid};let unknownCards=Number(Boolean(choice.position&&choice.reward.pickAlienCard)),ordinaryLeft=facts.board.ordinaryDrawCount;
   const apply=reward=>{
    players.gainResources({resources:wallet},reward.gain||{});if(reward.dataCount)players.gainResources({resources:wallet},{availableData:reward.dataCount});
    if((reward.drawCards||0)>ordinaryLeft)return false;ordinaryLeft-=reward.drawCards||0;unknownCards+=reward.drawCards||0;return true;
   };
   if(!apply(choice.reward))continue;
   if(region){let valid=true;for(const r of region.results)if(!apply(r.reward)){valid=false;break;}if(!valid)continue;}
   if(nextThreshold!==null&&wallet.score>=nextThreshold){markBoundary=true;continue;}
   const traceCounts=facts.traceCounts?{...facts.traceCounts,blue:facts.traceCounts.blue+1}:null;
   const trigger=scope.blueData?blueDataChoice(traceCounts?{...facts,traceCounts}:facts,weights,wallet,context,scope.stableB1):null;
   if(trigger)Object.assign(wallet,trigger.wallet);
   wallet.handSize+=unknownCards;
   const cleared={...(traceCounts?{traceCounts}:{}),computerSlots:[],blueSlots:(facts.blueSlots||[]).map(b=>({...b,occupied:false,unlocked:false})),researchSymbols:symbols,amibaTraces:traces,
    extraUnknownCount:facts.extraUnknownCount+unknownCards,aliens:{...facts.board.aliens,slots,amiba:symbols,amibaTraces:traces},ordinaryDrawCount:ordinaryLeft,
    ...(trigger?{reservedCards:trigger.reservedCards,nextFinalMark:facts.nextFinalMark&&{...facts.nextFinalMark,options:facts.nextFinalMark.options.map(o=>o.tileId==='c'?{...o,currentValue:end.getFormulaBaseValue(o.formulaId,{...wallet,reservedCards:trigger.reservedCards},{})*o.multiplier}:o)}}:{})};
   const securedGain=scope.fixed?0:secured(context,{...facts,...(traceCounts?{traceCounts}:{}),player:wallet,reservedCards:trigger?.reservedCards||facts.reservedCards},scope.stableB1)-beforeSecured;
   const delta=w=>arithmetic.sum([w.score-initial.score,securedGain,unknownCards*weights.handSize,...resourceKeys.map(k=>(w[k]-initial[k])*weights[k])],weights);
   let best={value:delta(wallet),wallet,progress:cleared,blueSlot:null};
   for(const {slot,required,bonus,columns}of blueTails){
    if(wallet.availableData<required+1)continue;
    const after={...wallet,availableData:wallet.availableData-required-1};
    if(required>=2)players.gainResources({resources:after},{publicity:placement.getComputerSlotBonus(2).publicity});
    players.gainResources({resources:after},{[bonus.type]:bonus[bonus.type],score:columns*placement.getBlueColumnScoreBonus().score});
    const progress={...cleared,computerSlots:[1,2,3].filter(n=>n<=required),blueSlots:cleared.blueSlots.map(b=>({...b,occupied:b.slot===Number(slot),unlocked:placement.getRequiredComputerSlotForBlueBonus(b.slot)<=required}))},value=delta(after);
    if(value>best.value)best={value,wallet:after,progress,blueSlot:Number(slot)};
   }
   candidates.push({slotId:choice.slot.slotId,position:choice.position||null,traceType:'blue',payment,preparationPlacements:needed.length,blueSlot:best.blueSlot,
    planNetGain:null,localPlanValue:best.value,linearGain:delta(best.wallet),securedGain,unknownCards,region,...(trigger?{blueDataTrigger:trigger.trigger}:{}),endpoint:{resources:best.wallet,...best.progress}});
  }
  candidates.sort((a,b)=>b.localPlanValue-a.localPlanValue||a.slotId-b.slotId||(b.position||0)-(a.position||0));
  const selected=candidates[0];
  if(!selected&&markBoundary)return zero('mixed-analysis-final-mark-needs-native-value');
  if(selected){const {resources,aliens,...progress}=selected.endpoint;selected.planNetGain=arithmetic.sum([selected.linearGain,portfolio(resources,aliens.slots,{...progress,aliens}),-baseValue],weights);}
  return{value:Math.max(0,selected?.planNetGain||0),selected:selected||null,candidates,
   reason:selected?.planNetGain>0?'funded-known-amiba-analysis':'amiba-analysis-not-profitable',
   scope:'One fixed locally greedy funded analysis/blue-trace/currency-tail plan, ranked by current formal net rewards, then exactly one shared-portfolio requote. Unselected local candidates have no planNetGain. Anonymous draw counts only; shared wallet and existing base portfolio opportunity cost. No hidden reveal, entity allocation, successor observation, new final mark or pruning bound.'};
 }
 return Object.freeze({quote});
});
