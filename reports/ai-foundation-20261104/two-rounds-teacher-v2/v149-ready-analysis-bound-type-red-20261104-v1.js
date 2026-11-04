(function(root,factory){
 'use strict';const common=typeof module==='object'&&module.exports;
 const api=factory(common?require('../data/placement'):root.SetiDataPlacement,common?require('../data'):root.SetiData,common?require('../aliens/state'):root.SetiAlienState,
  common?require('../players'):root.SetiPlayers,common?require('../cards/effects'):root.SetiCardEffects,common?require('./probe-capital'):root.SetiProbeCapital);
 if(common)module.exports=api;else root.SetiReadyAnalysisCapital=api;
})(typeof globalThis!=='undefined'?globalThis:window,function(placement,data,aliens,players,effects,probe){
 'use strict';
 const zero=reason=>({value:0,selected:null,reason});
 const weighted=(gain,w)=>Object.entries(gain).reduce((n,[k,v])=>n+v*(k==='score'?1:w[k]||0),0);
 function quiet(cards){return(cards||[]).every(card=>{const m=effects.getCardModel(card);return m&&!m.endGameScoring&&!m?.triggers?.length&&!m?.temporaryTasks?.length;});}
 function quote(facts,weights,portfolio,baseValue){
  if(facts.terminal||facts.round+Number(facts.passing)>=4)return zero('analysis-window-closed');
  if(!facts.computerSlots?.includes(6))return zero('analysis-not-ready');
  if(!quiet(facts.reservedCards))return zero('analysis-reservation-needs-native-value');
  const payment=probe.funding(facts.player,{energy:facts.analyzeEnergyCost},weights);
  if(!payment)return zero('analysis-not-funded');
  if(!Array.isArray(facts.board?.aliens?.slots))throw Error('READY_ANALYSIS_ALIEN_FACTS_MISSING');
  const initial={...facts.player},paid={...initial,credits:initial.credits-payment.spend.credits,energy:initial.energy-payment.spend.energy};
  const candidates=facts.board.aliens.slots.flatMap(slot=>{
   if(slot.revealed)return[];const first=!slot.traces?.blue?.firstPlaced;
   if(first&&['yellow','pink'].every(type=>slot.traces?.[type]?.firstPlaced))return[];
   const reward=first?aliens.getFirstTraceRewardForSlot(slot.slotId):aliens.getExtraTraceReward();
   if(!reward||Object.keys(reward.gain).some(k=>!['score','credits','energy','publicity'].includes(k)))return[];
   const wallet={...paid};players.gainResources({resources:wallet},reward.gain);
   return[{slot,first,wallet,value:wallet.score-paid.score+Object.keys(weights).reduce((n,k)=>n+(k==='handSize'?0:wallet[k]-paid[k])*weights[k],0)}];
  }).sort((a,b)=>b.value-a.value||a.slot.slotId-b.slot.slotId);
  const selected=candidates[0];if(!selected)return zero('analysis-trace-needs-native-boundary');
  const slots=facts.board.aliens.slots.map(slot=>slot===selected.slot?{...slot,traces:{...slot.traces,blue:{...slot.traces.blue,firstPlaced:true,ownerPlayerColor:facts.player.color}}}:slot);
  const delta=wallet=>wallet.score-initial.score+Object.keys(weights).reduce((n,k)=>n+(k==='handSize'?0:wallet[k]-initial[k])*weights[k],0);
  const base=delta(selected.wallet)+portfolio(selected.wallet,slots)-baseValue;
  const tails=Object.entries(facts.player.techState?.blueBoardSlots||{}).flatMap(([tileId,slot])=>{
   if(!facts.player.techState.ownedTiles[tileId]||facts.player.techState.disabledTiles?.[tileId])return[];
   const required=placement.getRequiredComputerSlotForBlueBonus(slot),bonus=placement.getBlueTileDataBonus(tileId);
   if(!required||required>=4||!bonus||!['credits','energy','publicity'].includes(bonus.type)||selected.wallet.availableData<required+1)return[];
   const wallet={...selected.wallet,availableData:selected.wallet.availableData-required-1};
   if(required>=2)players.gainResources({resources:wallet},{publicity:placement.getComputerSlotBonus(2).publicity});
   players.gainResources({resources:wallet},{[bonus.type]:bonus[bonus.type],score:placement.getBlueColumnScoreBonus().score});
   return[{blueSlot:Number(slot),wallet,value:delta(wallet)+portfolio(wallet,slots)-baseValue}];
  }).sort((a,b)=>b.value-a.value||a.blueSlot-b.blueSlot);
  const tail=tails[0]?.value>base?tails[0]:null,net=tail?.value??base;
  return{value:Math.max(0,net),selected:{slotId:selected.slot.slotId,traceType:'blue',payment,blueSlot:tail?.blueSlot||null,planNetGain:net},reason:net>0?'funded-ready-analysis':'analysis-plan-not-profitable',scope:'One funded ready analysis and at most one known currency blue tail; no new income/card identity/species, native state transition or pruning guarantee'};
 }
 function upperBound(slots,weights){
  const gains=[aliens.getExtraTraceReward().gain,...(slots||[]).map(s=>aliens.getFirstTraceRewardForSlot(s.slotId)?.gain).filter(Boolean)];
  const trace=Math.max(0,...gains.map(g=>weighted(g,weights))),tracePublicity=Math.max(0,...gains.map(g=>g.publicity||0));
  const blue=Math.max(0,...['blue1','blue2','blue4'].map(id=>weighted(placement.getBlueTileDataBonus(id),weights)));
  return{linear:trace+placement.getBlueColumnScoreBonus().score+blue+placement.getComputerSlotBonus(2).publicity*weights.publicity,publicity:tracePublicity+placement.getBlueTileDataBonus('blue4').publicity+placement.getComputerSlotBonus(2).publicity};
 }
 return Object.freeze({quote,upperBound,energyCost:abilityId=>abilityId==='deepspace_swap_cards'?0:data.ANALYZE_ENERGY_COST});
});
