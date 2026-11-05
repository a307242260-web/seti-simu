(function(root,factory){
 'use strict';const common=typeof module==='object'&&module.exports;
 const api=factory(common?require('../data/placement'):root.SetiDataPlacement,common?require('../data'):root.SetiData,common?require('../aliens/state'):root.SetiAlienState,
  common?require('../players'):root.SetiPlayers,common?require('../cards/effects'):root.SetiCardEffects,common?require('./probe-capital'):root.SetiProbeCapital,common?require('./value-arithmetic'):root.SetiValueArithmetic,common?require('./amiba-analysis-capital'):root.SetiAmibaAnalysisCapital);
 if(common)module.exports=api;else root.SetiReadyAnalysisCapital=api;
})(typeof globalThis!=='undefined'?globalThis:window,function(placement,data,aliens,players,effects,probe,arithmetic,amibaAnalysis){
 'use strict';
 const zero=reason=>({value:0,selected:null,reason});
 const weighted=(gain,w)=>Object.entries(gain).reduce((n,[k,v])=>n+v*(k==='score'?1:w[k]||0),0);
 function quiet(cards,allowLandingPairs=false){return(cards||[]).every(card=>{const m=effects.getCardModel(card);return m&&(!m.endGameScoring||allowLandingPairs&&m.endGameScoring.kind==='planetLandingPairs')&&(!m?.triggers?.length||allowLandingPairs&&m.triggers.every(t=>(t.event?.types||[t.event?.type]).every(type=>type==='researchTech'||type==='alienTrace'&&['pink','yellow'].includes(t.event.traceType))))&&!m?.temporaryTasks?.length;});}
 // Landing pairs and research/pink/yellow triggers do not observe computer
 // placement or the future blue trace. The prepaid asset clears with its data.
 function prepaidCapital(facts,weights){
  if(facts.terminal||facts.round+Number(facts.passing)>=4||facts.analyzeEnergyCost!==0||!quiet(facts.reservedCards,true))return 0;
  const slots=[...(facts.computerSlots||[])].sort((a,b)=>a-b);
  if(!slots.length||slots.length>=data.ANALYZE_REQUIRED_COMPUTER_SLOT||slots.some((s,i)=>s!==i+1))return 0;
  if(!Array.isArray(facts.board?.aliens?.slots))throw Error('READY_ANALYSIS_ALIEN_FACTS_MISSING');
  const rewards=facts.board.aliens.slots.flatMap(slot=>{
   if(slot.revealed)return[];const first=!slot.traces?.blue?.firstPlaced;
   if(first&&['yellow','pink'].every(type=>slot.traces?.[type]?.firstPlaced))return[];
   const gain=(first?aliens.getFirstTraceRewardForSlot(slot.slotId):aliens.getExtraTraceReward()).gain;
   if(Object.keys(gain).some(k=>!['score','publicity'].includes(k)))return[];
   const wallet={...facts.player};players.gainResources({resources:wallet},gain);
   return[wallet.score-facts.player.score+(wallet.publicity-facts.player.publicity)*weights.publicity];
  });
  return arithmetic.normalize(Math.max(0,...rewards)*slots.length/data.ANALYZE_REQUIRED_COMPUTER_SLOT,weights);
 }
 function quote(facts,weights,portfolio,baseValue){
  if(facts.terminal||facts.round+Number(facts.passing)>=4)return zero('analysis-window-closed');
  const placed=[...(facts.computerSlots||[])].sort((a,b)=>a-b),needed=[1,2,3,4,5,6].filter(slot=>!placed.includes(slot));
  if(facts.researchSymbols?.revealInitialized&&facts.companyState?.abilityId==='deepspace_swap_cards')return amibaAnalysis.quote(facts,weights,portfolio,baseValue);
  if(needed.length&&(placed.length<4||placed.some((slot,index)=>slot!==index+1)
    ||needed.some(slot=>slot<5)||facts.player.availableData<needed.length))return zero('analysis-not-ready');
  if(!quiet(facts.reservedCards))return zero('analysis-reservation-needs-native-value');
  const payment=probe.funding(facts.player,{energy:facts.analyzeEnergyCost},weights);
  if(!payment)return zero('analysis-not-funded');
  if(!Array.isArray(facts.board?.aliens?.slots))throw Error('READY_ANALYSIS_ALIEN_FACTS_MISSING');
  const initial={...facts.player},paid={...initial,credits:initial.credits-payment.spend.credits,energy:initial.energy-payment.spend.energy,
   availableData:initial.availableData-needed.length};
  const newColumns=Object.entries(initial.techState.blueBoardSlots).filter(([id,slot])=>initial.techState.ownedTiles[id]
   &&!initial.techState.disabledTiles[id]&&needed.includes(placement.getRequiredComputerSlotForBlueBonus(slot))).length;
  players.gainResources({resources:paid},{score:newColumns*placement.getBlueColumnScoreBonus().score});
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
  const cleared={computerSlots:[],blueSlots:(facts.blueSlots||[]).map(b=>({...b,occupied:false,unlocked:false}))};
  const base=delta(selected.wallet)+portfolio(selected.wallet,slots,cleared)-baseValue;
  const tails=Object.entries(facts.player.techState?.blueBoardSlots||{}).flatMap(([tileId,slot])=>{
   if(!facts.player.techState.ownedTiles[tileId]||facts.player.techState.disabledTiles?.[tileId])return[];
   const required=placement.getRequiredComputerSlotForBlueBonus(slot),bonus=placement.getBlueTileDataBonus(tileId);
   if(!required||required>=4||!bonus||!['credits','energy','publicity'].includes(bonus.type)||selected.wallet.availableData<required+1)return[];
   const wallet={...selected.wallet,availableData:selected.wallet.availableData-required-1};
   if(required>=2)players.gainResources({resources:wallet},{publicity:placement.getComputerSlotBonus(2).publicity});
   const columns=Object.entries(facts.player.techState.blueBoardSlots).filter(([id,s])=>facts.player.techState.ownedTiles[id]&&!facts.player.techState.disabledTiles?.[id]&&placement.getRequiredComputerSlotForBlueBonus(s)<=required).length;
   players.gainResources({resources:wallet},{[bonus.type]:bonus[bonus.type],score:columns*placement.getBlueColumnScoreBonus().score});
   return[{blueSlot:Number(slot),wallet,value:delta(wallet)+portfolio(wallet,slots,{computerSlots:[1,2,3].filter(n=>n<=required),blueSlots:cleared.blueSlots.map(b=>({...b,occupied:b.slot===Number(slot),unlocked:placement.getRequiredComputerSlotForBlueBonus(b.slot)<=required}))})-baseValue}];
  }).sort((a,b)=>b.value-a.value||a.blueSlot-b.blueSlot);
  const tail=tails[0]?.value>base?tails[0]:null,net=tail?.value??base;
  return{value:arithmetic.normalize(Math.max(0,net),weights),selected:{slotId:selected.slot.slotId,traceType:'blue',payment,preparationPlacements:needed.length,blueSlot:tail?.blueSlot||null,planNetGain:arithmetic.normalize(net,weights)},reason:net>0?'funded-ready-analysis':'analysis-plan-not-profitable',scope:'One existing-data-funded preparation of computer5/6, analysis and at most one known currency blue tail; no new income/card identity/species, native state transition or pruning guarantee'};
 }
 function upperBound(slots,weights,progress=null){
  const gains=[aliens.getExtraTraceReward().gain,...(slots||[]).map(s=>aliens.getFirstTraceRewardForSlot(s.slotId)?.gain).filter(Boolean)];
  const trace=Math.max(0,...gains.map(g=>weighted(g,weights))),tracePublicity=Math.max(0,...gains.map(g=>g.publicity||0));
  const blue=Math.max(0,...['blue1','blue2','blue4'].map(id=>(()=>{const b=placement.getBlueTileDataBonus(id);return b[b.type]*(weights[b.type]||0);})()));
  const preparationColumns=progress?Object.entries(progress.techState.blueBoardSlots).filter(([id,slot])=>progress.techState.ownedTiles[id]
   &&!progress.techState.disabledTiles[id]&&placement.getRequiredComputerSlotForBlueBonus(slot)>=5
   &&!progress.computerSlots.includes(placement.getRequiredComputerSlotForBlueBonus(slot))).length:2;
  return{linear:preparationColumns*placement.getBlueColumnScoreBonus().score+trace+[1,2,3].filter(slot=>placement.getBlueBoardSlotForComputerSlot(slot)!=null).length*placement.getBlueColumnScoreBonus().score+blue+placement.getComputerSlotBonus(2).publicity*weights.publicity,publicity:tracePublicity+placement.getBlueTileDataBonus('blue4').publicity+placement.getComputerSlotBonus(2).publicity};
 }
 return Object.freeze({quote,prepaidCapital,upperBound,energyCost:abilityId=>abilityId==='deepspace_swap_cards'?0:data.ANALYZE_ENERGY_COST});
});
