(function(root,factory){
 'use strict';const common=typeof module==='object'&&module.exports;
 const api=factory(common?require('../data'):root.SetiData,common?require('../effects/science-session'):root.SetiScienceSession,
  common?require('../actions/scan-effects'):root.SetiScanEffects,common?require('../cards/effects'):root.SetiCardEffects,
  common?require('../industry'):root.SetiIndustry,common?require('../aliens/state'):root.SetiAlienState,
  common?require('../end-game-scoring'):root.SetiEndGameScoring,common?require('./probe-capital'):root.SetiProbeCapital,
  common?require('./value-arithmetic'):root.SetiValueArithmetic,common?require('../cards/deck'):root.SetiCards);
 if(common)module.exports=api;else root.SetiScanAnalysisIncomeUtility=api;
})(typeof globalThis!=='undefined'?globalThis:window,function(data,science,scans,effects,industry,aliens,end,probe,arithmetic,cards){
 'use strict';const zero=reason=>({value:0,selected:null,reason});
 const inertScores=new Set(['sectorWinsByColor','techCount','distinctSignalSectors','planetOrbitOrLand','planetLandingPairs','allOrbitOrLand','probeLocation']);
 function reservationsSafe(player,fundingTie=false){
  return(player.reservedCards||[]).every(card=>{const model=effects.getCardModel(card);
   return model&&!model.temporaryTasks?.length
    &&(model.tasks||[]).every(t=>['orbitOrLandCount','completedSectors','completedSectorsByColor','probeDistanceFromEarth'].includes(t.condition?.type))
    &&(model.triggers||[]).every(t=>(t.event?.types||[t.event?.type]).every(type=>['researchTech','move','visitPlanet','visitAsteroid','visitComet','launch','orbit','land'].includes(type)))
    &&(!model.endGameScoring||inertScores.has(model.endGameScoring.kind)||fundingTie&&model.endGameScoring.kind==='traceCount');
  });
 }
 function knownScanPair({state,player}){
  const root={data:state.data,solarSystem:state.solarSystem,cards:{publicCards:(state.cards.publicCards||[]).map(c=>c?.cardId&&!c.hidden?c:null)}};
  if(data.NEBULA_IDS.some(id=>data.isSectorReadyToSettle(state.data,id)))return{available:false,reason:'scan-analysis-pending-sector'};
  const first=scans.buildScanEffectQueue(player,{turn:state.turn})[0],source=science.getPlanetScanSource(root,first.type);if(!source)return{available:false,reason:'scan-analysis-earth-source-missing'};
  const used=new Set(),choose=actions=>actions.flatMap(action=>{
   const id=action.target.nebulaId,bucket=state.data.nebulae[id];
   const available={...state.data,nebulae:{...state.data.nebulae,[id]:{...bucket,tokens:bucket.tokens.filter(t=>!used.has(t.id))}}},next=data.getNextReplaceableNebulaToken(available,id);if(!next)return[];
   const after={...available,nebulae:{...available.nebulae,[id]:{...available.nebulae[id],tokens:available.nebulae[id].tokens.filter(t=>t.id!==next.id)}}};
   if(!data.getNextReplaceableNebulaToken(after,id))return[];
   return[{nebulaId:id,cardInstanceId:action.target.cardInstanceId||null,tokenId:next.id,slotIndex:next.slotIndex,score:data.getNebulaSlotScoreReward(id,next.slotIndex)}];
  }).sort((a,b)=>b.score-a.score||a.nebulaId.localeCompare(b.nebulaId)||(a.cardInstanceId||'').localeCompare(b.cardInstanceId||''))[0];
  const normal=choose(science.listScanStepChoices(root,player,{mode:'specified',...source,gainData:true}));if(!normal)return{available:false,reason:'scan-analysis-no-safe-earth-data'};used.add(normal.tokenId);
  const publicScan=choose(science.listScanStepChoices(root,player,{mode:'public',selected:0}));if(!publicScan)return{available:false,reason:'scan-analysis-no-safe-public-data'};
  return{available:true,normal,publicScan};
 }
 function quote({state,player,weights=arithmetic.DEFAULT_WEIGHTS}){
  const round=state.turn.roundNumber,passed=state.passingPlayerIds||state.turn.passedPlayerIds||[];
  if(state.turn.gameEnded||round>=4||passed.includes(player.id)||player.passCompletionPending)return zero('scan-analysis-window-closed');
  if(!industry.canAnalyzeWithoutEnergy(player))return zero('scan-analysis-not-free');
  if(!state.turn.activePlayerIds?.length||state.turn.activePlayerIds.some(id=>id!==player.id&&!passed.includes(id)))return zero('scan-analysis-contested');
  const slots=data.listComputerPlacedTokens(player).map(t=>t.placementSlot).sort((a,b)=>a-b),needed=6-slots.length,stock=player.resources.availableData;
  if(slots.length<4||slots.length>=6||slots.some((s,i)=>s!==i+1)||stock>=needed||stock+2<needed)return zero('scan-analysis-data-gap');
  if(!reservationsSafe(player))return zero('scan-analysis-reservation-needs-native-value');
  const trace=Object.entries(state.aliens.aliens||{}).find(([,s])=>s.revealed&&s.traces?.blue?.firstPlaced);
  if(!trace)return zero('scan-analysis-no-known-extra-blue');
  const cost=scans.getStandardScanCost(player),wallet={...player.resources},known=player.hand.filter(c=>c.cardId&&!c.hidden);let payment=probe.funding(wallet,cost,weights),trade=null,consumed=[];
  if(!payment){
   // Exactly one known pair: no hand subsets, unknown card or currency tree.
   if(known.length!==2)return zero('scan-analysis-needs-known-pair');
   const currency=wallet.credits<(cost.credits||0)?'credits':'energy';wallet[currency]++;
   payment=probe.funding(wallet,cost,weights);if(!payment)return zero('scan-analysis-wallet-insufficient');
   trade=currency==='credits'?'cards-for-credit':'cards-for-energy';consumed=known.map(c=>c.id);
  }
  const pair=knownScanPair({state,player});if(!pair.available)return zero(pair.reason);
  const {normal,publicScan}=pair;
  const columns=Object.entries(player.techState.blueBoardSlots).filter(([id,slot])=>player.techState.ownedTiles[id]&&!player.techState.disabledTiles[id]
   &&data.getRequiredComputerSlotForBlueBonus(slot)>slots.length).length;
  const score=normal.score+publicScan.score+columns*data.getBlueColumnScoreBonus().score+(aliens.getExtraTraceReward().gain.score||0);
  const mark=end.describeNextFinalMark({...state,cardEffects:effects},player);if(mark&&player.resources.score+score>=mark.threshold)return zero('scan-analysis-new-mark');
  const tradeGain=trade?weights[trade==='cards-for-credit'?'credits':'energy']:0;
  const net=arithmetic.sum([score,tradeGain,-payment.value,-consumed.length*weights.handSize,(2-needed)*weights.availableData],weights);
  if(!Number.isFinite(net))throw TypeError('SCAN_ANALYSIS_INCOME_UTILITY_INVALID');
  return{value:Math.max(0,net),selected:{trade,consumedCardIds:consumed,payment,normal,publicScan,computerPlacements:needed,extraBlueSlot:Number(trace[0]),scoreGain:score,netGain:net},
   scope:'Greedy income ranking only: one funded nonsettling two-data scan, existing computer prefix, free analysis and ordinary extra blue trace. Known pair only; no new identity, native successor, executable continuation, extra search branch or pruning bound.'};
 }

 // A primary utility tie can hide the loss of an extra currency pair. Keep
 // one known paid full-scan/free-analysis purpose; no supplier combinations,
 // fabricated successor, added value term or pruning certificate.
 function preferPaidCardFunding({state,player,rows}){
  const turn=state.turn,top=rows[0],currency=card=>{
   const gain=cards.getIncomeGainForCard(card),keys=Object.keys(gain||{});
   return keys.length===1&&['credits','energy'].includes(keys[0])&&gain[keys[0]]===1?keys[0]:null;
  };
  if(!top||!currency(top.card)||player.mainActionCompleted||player.passCompletionPending
    ||!industry.canAnalyzeWithoutEnergy(player)||!reservationsSafe(player,true)
    ||turn.currentPlayerId!==player.id||!turn.activePlayerIds?.includes(player.id)
    ||turn.activePlayerIds.some(id=>id!==player.id&&!turn.passedPlayerIds.includes(id))
    ||state.pieces.rockets.some(r=>r.playerId===player.id)
    ||player.hand.some(c=>!c.id||!c.cardId||c.hidden)
    ||player.resources.handSize!==player.hand.length)return null;
  const slots=data.listComputerPlacedTokens(player).map(t=>t.placementSlot).sort((a,b)=>a-b),remaining=4-slots.length;
  if(remaining<0||slots.some((s,i)=>s!==i+1)||player.resources.availableData!==remaining
    ||!Object.values(state.aliens.aliens||{}).some(s=>s.traces?.blue?.firstPlaced))return null;
  const scans=player.hand.flatMap(card=>{
   const model=effects.getCardModel(card),play=effects.buildPlayEffects(card),cost=effects.getCardPlayCost(card);
   if(!model||card.set?.startsWith('alien:')||Object.keys(cost).some(k=>k!=='credits')
     ||!Number.isSafeInteger(cost.credits)||cost.credits<=0
     ||play.filter(e=>e.type==='card_scan_action'&&e.options?.skipCost).length!==1
     ||play.some(e=>e.type!=='card_scan_action'&&(e.type!=='gain_resources'
       ||Object.keys(e.options?.gain||{}).some(k=>k!=='publicity'))))return[];
   return[{card,cost:cost.credits}];
  }).sort((a,b)=>a.cost-b.cost||a.card.id.localeCompare(b.card.id));
  if(!scans.length)return null;
  const scan=scans[0],tied=rows.filter(r=>r.value===top.value&&currency(r.card));
  if(tied.length<2||!tied.some(r=>currency(r.card)!==currency(top.card)))return null;
  const pair=knownScanPair({state,player});if(!pair.available)return null;
  const scoreFloor=pair.normal.score+pair.publicScan.score+(aliens.getExtraTraceReward().gain.score||0);
  function funding(row){
   if(row.card.id===scan.card.id)return null;
   const key=currency(row.card),wallet={credits:player.resources.credits,energy:player.resources.energy};wallet[key]++;
   const deficit=Math.max(0,scan.cost-wallet.credits),energyTrades=Math.min(deficit,Math.floor(wallet.energy/2)),pairs=deficit-energyTrades;
   const spare=player.hand.filter(c=>c.id!==row.card.id&&c.id!==scan.card.id&&!c.set?.startsWith('alien:')
     &&effects.getCardModel(c)?.cardType!==3
     &&!effects.buildPlayEffects(c).some(e=>e.type==='card_research_tech'));
   if(spare.length<2*pairs)return null;
   const after={credits:Math.max(0,wallet.credits-scan.cost),energy:wallet.energy-2*energyTrades};
   return{cardId:scan.card.id,feeCredits:scan.cost,currencyPairCount:pairs,energyTrades,
    consumedSpareCards:2*pairs,afterWallet:after,scoreFloor,
    netScoreFloor:scoreFloor-scan.cost-1-pairs-energyTrades,
    remainingUtility:after.credits+after.energy-2*pairs};
  }
  const base=funding(top);let best=base?{row:top,quote:base}:null;
  for(const row of tied){const quote=funding(row);if(quote&&(!best||quote.remainingUtility>best.quote.remainingUtility))best={row,quote};}
  return best&&best.row!==top&&best.quote.netScoreFloor>0
   ?{...best.row,knownScanFunding:best.quote}:null;
 }
 return Object.freeze({quote,knownScanPair,preferPaidCardFunding});
});
