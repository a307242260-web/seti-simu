'use strict';
const placement=require('../randomizer/game/data/placement'),cards=require('../randomizer/game/cards/deck'),effects=require('../randomizer/game/cards/effects'),players=require('../randomizer/game/players');
// Typed resource quote only. It never constructs an observation or game node.
function quote({facts,hand,wallet,income,traceSlots,investment},weights){
 const zero=reason=>({value:0,selected:null,reason});
 const slots=facts.computerSlots,blues=facts.blueSlots||facts.player.dataProgress?.blueSlots;
 if(facts.passing||facts.round>=4||!Array.isArray(slots)||!Array.isArray(blues))return zero('data-facts-unavailable');
 if(slots.some(s=>s<1||s>4)||!Array.isArray(facts.reservedCards))return zero('data-window-needs-native-value');
 if(facts.reservedCards.some(c=>{const m=effects.getCardModel(c);return !m||m.triggers?.length||m.temporaryTasks?.length||m.endGameScoring;}))return zero('reserved-card-needs-native-value');
 if((traceSlots||facts.board.aliens.slots).some(s=>s.revealed||['blue','pink','yellow'].every(t=>s.traces?.[t]?.firstPlaced)))return zero('alien-needs-native-value');
 const available=blues.filter(b=>!b.occupied&&b.slot<=2&&facts.player.techState.ownedTiles[b.tileId]&&!facts.player.techState.disabledTiles[b.tileId]);
 if(!available.length)return zero('currency-blue-unavailable');
 const base=investment(hand,wallet.publicity,{resources:wallet,income,startingIncome:0}),candidates=[];
 const incomeCards=slots.includes(4)?[]:hand.filter(c=>!c.hidden&&c.cardId&&(()=>{const gain=cards.getIncomeGainForCard(c);return gain&&Object.keys(gain).every(k=>['credits','energy'].includes(k));})());
 for(const blue of available){
  const bonus=placement.getBlueTileDataBonus(blue.tileId);
  if(!bonus||!['credits','energy','publicity'].includes(bonus.type))continue;
  for(const incomeCard of [null,...incomeCards]){
   const through=incomeCard?4:placement.getRequiredComputerSlotForBlueBonus(blue.slot),missing=[1,2,3,4].filter(s=>s<=through&&!slots.includes(s)),need=missing.length+1;
   if(wallet.availableData<need)continue;
   // A blue-only path crossing computer4 would still require an income choice.
   if(!incomeCard&&missing.includes(4)&&hand.length)continue;
   const next={credits:wallet.credits,energy:wallet.energy,publicity:wallet.publicity,availableData:wallet.availableData-need},nextIncome={...income};let score=0;
   for(const slot of missing){
    const gain=placement.getComputerSlotBonus(slot);if(gain?.type==='publicity')players.gainResources({resources:next},{publicity:gain.publicity});
    if(Object.entries(facts.player.techState.blueBoardSlots).some(([id,b])=>facts.player.techState.ownedTiles[id]&&!facts.player.techState.disabledTiles[id]&&placement.getRequiredComputerSlotForBlueBonus(b)===slot))score+=placement.getBlueColumnScoreBonus().score;
   }
   let remaining=hand,linearIncome=0;
   if(incomeCard){const gain=cards.getIncomeGainForCard(incomeCard);remaining=hand.filter(c=>c.id!==incomeCard.id);players.gainResources({resources:next},gain);for(const[k,n]of Object.entries(gain))nextIncome[k]+=n;linearIncome=Object.entries(gain).reduce((n,[k,x])=>n+x*weights[k],0)*(4-facts.round)-weights.handSize;}
   players.gainResources({resources:next},{[bonus.type]:bonus[bonus.type]});
   const linear=score+linearIncome+['credits','energy','publicity','availableData'].reduce((n,k)=>n+(next[k]-wallet[k])*weights[k],0);
   const after=investment(remaining,next.publicity,{resources:next,income:nextIncome,startingIncome:0}),value=linear+after-base;
   candidates.push({blueSlot:blue.slot,blueTileId:blue.tileId,incomeCardId:incomeCard?.id||null,neededData:need,computerSlots:[...slots,...missing].sort((a,b)=>a-b),wallet:next,income:nextIncome,handIds:remaining.map(c=>c.id),scoreGain:score,linear,baseCapital:base,afterCapital:after,value});
  }
 }
 candidates.sort((a,b)=>b.value-a.value||a.neededData-b.neededData||a.blueSlot-b.blueSlot||String(a.incomeCardId).localeCompare(String(b.incomeCardId)));
 return{value:Math.max(0,candidates[0]?.value||0),selected:candidates[0]||null,candidates,reason:'one-fixed-income-and-currency-blue-tail',scope:'One current-data-funded computer/income/currency-blue continuation after one mission; shared wallet and known hand, no corners, exchanges, unknown identities, observations, search or pruning bounds.'};
}
module.exports={quote};
