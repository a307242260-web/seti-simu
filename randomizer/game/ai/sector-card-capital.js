(function(root,factory){
 'use strict';const common=typeof module==='object'&&module.exports;
 const api=factory(common?require('../cards/effects'):root.SetiCardEffects,common?require('../data'):root.SetiData,
  common?require('../effects/science-session'):root.SetiScienceSession,common?require('../players'):root.SetiPlayers,
  common?require('../aliens/state'):root.SetiAlienState,common?require('./probe-capital'):root.SetiProbeCapital,common?require('./value-arithmetic'):root.SetiValueArithmetic,
  common?require('../state/state-store').copyForkData:root.SetiStateStore.copyForkData);
 if(common)module.exports=api;else root.SetiSectorCardCapital=api;
})(typeof globalThis!=='undefined'?globalThis:window,function(effects,data,science,players,aliens,probe,arithmetic,copyForkData){
 'use strict';
 const zero=reason=>({value:0,selected:null,reason}),models=new WeakMap();
 function supported(card){
  if(!card?.cardId||card.hidden||!['basic','space-agency'].includes(card.set))return null;
  const model=effects.getCardModel(card);if(!model)return null;if(models.has(model))return models.get(model);
  const body=effects.buildPlayEffects(card),e=body.length===1&&body[0],o=e?.options;
  const result=model.cardType===0&&!model.triggers?.length&&!model.tasks?.length&&!model.temporaryTasks?.length&&!model.endGameScoring
   &&e.type==='card_conditional_sector_scan'&&o?.allMatching===true&&o.gainData===false&&(o.repeat??1)===1
   &&(o.noAutoRepeatExpansion==null||o.noAutoRepeatExpansion===true)&&o.condition?.type==='hasPlayerSignal'&&Object.keys(o.condition).length===1
   &&Object.keys(o).every(k=>['condition','allMatching','gainData','repeat','noAutoRepeatExpansion'].includes(k))?o:null;
  if(Object.isFrozen(model))models.set(model,result);return result;
 }
 function quote(facts,weights,portfolio,currentCapital){
  const eligible=facts.hand.filter(supported);if(!eligible.length||facts.terminal||facts.round+Number(facts.passing)>=4)return zero('no-known-sector-tool');
  if((facts.reservedCards||[]).some(c=>{const m=effects.getCardModel(c);return!m||m.triggers?.length||m.temporaryTasks?.length||m.endGameScoring;}))return zero('sector-tool-reservation-needs-native-value');
  if(facts.board.aliens.slots.some(s=>s.revealed))return zero('sector-tool-species-needs-native-value');
  const candidates=[],weighted=g=>Object.entries(g).reduce((n,[k,v])=>n+v*(k==='score'?1:weights[k]||0),0);
  for(const card of eligible){
   const cost=effects.getCardPlayCost(card);if(Object.keys(cost).some(k=>!['credits','energy'].includes(k)||!Number.isSafeInteger(cost[k])||cost[k]<0))continue;
   const payment=probe.funding(facts.player,cost,weights);if(!payment)continue;
   const wallet={...facts.player,credits:facts.player.credits-payment.spend.credits,energy:facts.player.energy-payment.spend.energy,handSize:facts.hand.length+facts.extraUnknownCount-1},actor={id:wallet.id,color:wallet.color,resources:wallet,techState:wallet.techState};
   const signals=copyForkData(facts.board.data),root={data:signals,solarSystem:facts.board.solarSystem,players:{players:[actor]}};
   if(data.NEBULA_IDS.some(id=>data.isSectorReadyToSettle(signals,id)))continue;
   const targets=science.listScanStepChoices(root,actor,{mode:'conditional',...supported(card)}).map(a=>a.target.nebulaId);
   if(targets.length>8||new Set(targets).size!==targets.length)throw Error('SECTOR_CARD_TARGETS_INVALID');
   const ledger=[];let order=Math.max(0,...Object.values(signals.nebulae).flatMap(b=>b.tokens.map(t=>t.replacementOrder||0)),...Object.values(signals.sectorExtraMarks||{}).flat().map(t=>t.replacementOrder||0));
   for(const id of targets){
    const next=data.getNextReplaceableNebulaToken(signals,id);
    if(next){const token=signals.nebulae[id].tokens.find(t=>t.id===next.id);token.replacedByPlayerId=wallet.id;token.replacedByPlayerColor=wallet.color;token.replacementOrder=++order;
     const gain={score:data.getNebulaSlotScoreReward(id,token.slotIndex)};players.gainResources({resources:wallet},gain);ledger.push({kind:'signal',nebulaId:id,slot:token.slotIndex,gain});
    }else{signals.sectorExtraMarks ||= {};signals.sectorExtraMarks[id] ||= [];signals.sectorExtraMarks[id].push({replacedByPlayerId:wallet.id,replacedByPlayerColor:wallet.color,replacementOrder:++order});}
   }
   // Signal counts/rank only: no entity allocation, sector reset, native node
   // or successor observation. Spent old tokens remain unavailable to later
   // missions; no refill or sector reset is invented in this count ledger.
   const traceSlots=copyForkData(facts.board.aliens.slots);let safe=true;
   for(const id of data.NEBULA_IDS){
    if(!data.isSectorReadyToSettle(signals,id))continue;
    const participants=data.getSectorRanking(signals,id),settlement={ok:true,sectorId:id,participants,winner:participants[0],settlementNumber:(signals.sectorSettlements?.sectors?.[id]?.settlementCount||0)+1};
    for(const reward of data.buildSectorRewardDescriptors(settlement)){
     if(reward.owner.playerId!==wallet.id&&reward.owner.playerColor!==wallet.color){if(reward.kind==='alien_trace'){safe=false;break;}continue;}
     if(reward.kind==='resource'){players.gainResources({resources:wallet},reward.gain);ledger.push({kind:'settlement',sectorId:id,gain:reward.gain});}
     else if(reward.kind==='alien_trace'){
      const type=reward.traceType,choices=traceSlots.flatMap(slot=>{
       const first=!slot.traces[type].firstPlaced;if(first&&Object.entries(slot.traces).filter(([t,v])=>t!==type&&v.firstPlaced).length===2)return[];
       const gain=(first?aliens.getFirstTraceRewardForSlot(slot.slotId):aliens.getExtraTraceReward()).gain;
       if(Object.keys(gain).some(k=>!['score','credits','energy','publicity'].includes(k)))return[];
       const preview={...wallet};players.gainResources({resources:preview},gain);
       return[{slot,first,gain,value:weighted(Object.fromEntries(Object.keys(gain).map(k=>[k,preview[k]-wallet[k]])))}];
      }).sort((a,b)=>b.value-a.value||a.slot.slotId-b.slot.slotId),choice=choices[0];
      if(!choice){safe=false;break;}if(choice.first)choice.slot.traces[type]={...choice.slot.traces[type],firstPlaced:true,ownerPlayerColor:wallet.color};
      players.gainResources({resources:wallet},choice.gain);ledger.push({kind:'trace',sectorId:id,slotId:choice.slot.slotId,traceType:type,first:choice.first,gain:choice.gain});
     }else{safe=false;break;}
    }
    if(!safe)break;
   }
   if(!safe)continue;
   const after={...facts,player:wallet,hand:facts.hand.filter(c=>c!==card),board:{...facts.board,data:signals,aliens:{slots:traceSlots}}};
   const linear=wallet.score-facts.player.score+Object.entries(weights).reduce((n,[k,w])=>n+(k==='handSize'?-1:wallet[k]-facts.player[k])*w,0),afterCapital=portfolio(after),netGain=arithmetic.sum([linear,afterCapital,-currentCapital],weights);
   if(!Number.isFinite(netGain))throw Error('SECTOR_CARD_VALUE_INVALID');candidates.push({cardId:card.id,targets,payment,ledger,linear,afterCapital,netGain});
  }
  candidates.sort((a,b)=>b.netGain-a.netGain||a.cardId.localeCompare(b.cardId));return{value:Math.max(0,candidates[0]?.netGain||0),selected:candidates[0]||null,candidates,
   scope:'One current-wallet-funded known all-matching no-data sector card, known trace rewards and one shared-wallet held/research/prepared-analysis/mission continuation; missions use only remaining old tokens after this card, never a sector refill, foreign trace choice, new identity, species reveal or pruning bound'};
 }
 return Object.freeze({supported,quote});
});
