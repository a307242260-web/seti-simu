(function(root,factory){
 'use strict';const common=typeof module==='object'&&module.exports;
 const api=factory(common?require('../data'):root.SetiData,common?require('../effects/science-session'):root.SetiScienceSession,
  common?require('../actions/scan-effects'):root.SetiScanEffects,common?require('../cards/effects'):root.SetiCardEffects,
  common?require('../industry'):root.SetiIndustry,common?require('../aliens/state'):root.SetiAlienState,
  common?require('../end-game-scoring'):root.SetiEndGameScoring,common?require('./probe-capital'):root.SetiProbeCapital,
  common?require('./value-arithmetic'):root.SetiValueArithmetic);
 if(common)module.exports=api;else root.SetiScanAnalysisIncomeUtility=api;
})(typeof globalThis!=='undefined'?globalThis:window,function(data,science,scans,effects,industry,aliens,end,probe,arithmetic){
 'use strict';const zero=reason=>({value:0,selected:null,reason});
 const inertScores=new Set(['sectorWinsByColor','techCount','distinctSignalSectors','planetOrbitOrLand','planetLandingPairs','allOrbitOrLand','probeLocation']);
 function reservationsSafe(player){
  return(player.reservedCards||[]).every(card=>{const model=effects.getCardModel(card);
   return model&&!model.temporaryTasks?.length
    &&(model.tasks||[]).every(t=>['orbitOrLandCount','completedSectors','completedSectorsByColor','probeDistanceFromEarth'].includes(t.condition?.type))
    &&(model.triggers||[]).every(t=>(t.event?.types||[t.event?.type]).every(type=>['researchTech','move','visitPlanet','visitAsteroid','visitComet','launch','orbit','land'].includes(type)))
    &&(!model.endGameScoring||inertScores.has(model.endGameScoring.kind));
  });
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
  const root={data:state.data,solarSystem:state.solarSystem,cards:{publicCards:(state.cards.publicCards||[]).map(c=>c?.cardId&&!c.hidden?c:null)}};
  if(data.NEBULA_IDS.some(id=>data.isSectorReadyToSettle(state.data,id)))return zero('scan-analysis-pending-sector');
  const first=scans.buildScanEffectQueue(player,{turn:state.turn})[0],source=science.getPlanetScanSource(root,first.type);if(!source)return zero('scan-analysis-earth-source-missing');
  const used=new Set(),choose=actions=>actions.flatMap(action=>{
   const id=action.target.nebulaId,bucket=state.data.nebulae[id];
   const available={...state.data,nebulae:{...state.data.nebulae,[id]:{...bucket,tokens:bucket.tokens.filter(t=>!used.has(t.id))}}},next=data.getNextReplaceableNebulaToken(available,id);if(!next)return[];
   const after={...available,nebulae:{...available.nebulae,[id]:{...available.nebulae[id],tokens:available.nebulae[id].tokens.filter(t=>t.id!==next.id)}}};
   if(!data.getNextReplaceableNebulaToken(after,id))return[];
   return[{nebulaId:id,cardInstanceId:action.target.cardInstanceId||null,tokenId:next.id,slotIndex:next.slotIndex,score:data.getNebulaSlotScoreReward(id,next.slotIndex)}];
  }).sort((a,b)=>b.score-a.score||a.nebulaId.localeCompare(b.nebulaId)||(a.cardInstanceId||'').localeCompare(b.cardInstanceId||''))[0];
  const normal=choose(science.listScanStepChoices(root,player,{mode:'specified',...source,gainData:true}));if(!normal)return zero('scan-analysis-no-safe-earth-data');used.add(normal.tokenId);
  const publicScan=choose(science.listScanStepChoices(root,player,{mode:'public',selected:0}));if(!publicScan)return zero('scan-analysis-no-safe-public-data');
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
 return Object.freeze({quote});
});
