'use strict';
// Experimental typed resource quote, extracted from V166's fixed-data helper.
// incomeGains changes an income supplier's resource category only; no game
// state, observation, card identity or native action is fabricated or mutated.
const placement=require('../randomizer/game/data/placement'),cards=require('../randomizer/game/cards/deck'),effects=require('../randomizer/game/cards/effects'),players=require('../randomizer/game/players'),values=require('../randomizer/game/ai/state-value');
function missionDataContinuation({facts,hand,wallet,income,traceSlots,investment,incomeGains={}},weights){
 const incomeGainFor=card=>incomeGains[card.id]||cards.getIncomeGainForCard(card);
 const zero=reason=>({value:0,selected:null,reason});
 const slots=facts.computerSlots,blues=facts.blueSlots||facts.player.dataProgress?.blueSlots;
 if(facts.passing||facts.round>=4||!Array.isArray(slots)||!Array.isArray(blues))return zero('data-facts-unavailable');
 if(slots.some(s=>s<1||s>4)||!Array.isArray(facts.reservedCards))return zero('data-window-needs-native-value');
 if(facts.reservedCards.some(c=>{const m=effects.getCardModel(c);return !m||m.triggers?.length||m.temporaryTasks?.length||m.endGameScoring;}))return zero('reserved-card-needs-native-value');
 if((traceSlots||facts.board.aliens.slots).some(s=>s.revealed||['blue','pink','yellow'].every(t=>s.traces?.[t]?.firstPlaced)))return zero('alien-needs-native-value');
 const active=Object.entries(facts.player.techState.blueBoardSlots).map(([tileId,slot])=>({tileId,slot:Number(slot),occupied:blues.some(b=>b.slot===Number(slot)&&b.occupied)})).filter(b=>b.slot<=2&&facts.player.techState.ownedTiles[b.tileId]&&!facts.player.techState.disabledTiles[b.tileId]&&['blue1','blue2','blue4'].includes(b.tileId));
 if(!active.length)return zero('currency-blue-unavailable');
 const available=active.filter(b=>!b.occupied);
 const base=investment(hand,wallet.publicity,{resources:wallet,income,startingIncome:0}),candidates=[];
 const incomeCards=slots.includes(4)?[]:hand.filter(c=>!c.hidden&&c.cardId&&(()=>{const gain=incomeGainFor(c);return gain&&Object.keys(gain).every(k=>['credits','energy'].includes(k));})());
 for(const blue of [null,...available]){
  if(!blue&&slots.includes(4))continue;
  const bonus=blue&&placement.getBlueTileDataBonus(blue.tileId);
  if(blue&&(!bonus||!['credits','energy','publicity'].includes(bonus.type)))continue;
  for(const incomeCard of (blue?[null,...incomeCards]:incomeCards)){
   const through=incomeCard?4:placement.getRequiredComputerSlotForBlueBonus(blue.slot),missing=[1,2,3,4].filter(s=>s<=through&&!slots.includes(s)),need=missing.length+Number(Boolean(blue));
   if(wallet.availableData<need)continue;
   // A blue-only path crossing computer4 would still require an income choice.
   if(!incomeCard&&missing.includes(4)&&hand.length)continue;
   const next={credits:wallet.credits,energy:wallet.energy,publicity:wallet.publicity,availableData:wallet.availableData-need},nextIncome={...income};let score=0;
   for(const slot of missing){
    const gain=placement.getComputerSlotBonus(slot);if(gain?.type==='publicity')players.gainResources({resources:next},{publicity:gain.publicity});
    if(Object.entries(facts.player.techState.blueBoardSlots).some(([id,b])=>facts.player.techState.ownedTiles[id]&&!facts.player.techState.disabledTiles[id]&&placement.getRequiredComputerSlotForBlueBonus(b)===slot))score+=placement.getBlueColumnScoreBonus().score;
   }
   let remaining=hand,linearIncome=0;
   if(incomeCard){const gain=incomeGainFor(incomeCard);remaining=hand.filter(c=>c.id!==incomeCard.id);players.gainResources({resources:next},gain);for(const[k,n]of Object.entries(gain))nextIncome[k]+=n;linearIncome=Object.entries(gain).reduce((n,[k,x])=>n+x*weights[k],0)*(4-facts.round)-weights.handSize;}
   if(blue)players.gainResources({resources:next},{[bonus.type]:bonus[bonus.type]});
   const linear=score+linearIncome+['credits','energy','publicity','availableData'].reduce((n,k)=>n+(next[k]-wallet[k])*weights[k],0);
   const after=investment(remaining,next.publicity,{resources:next,income:nextIncome,startingIncome:0}),value=linear+after-base;
   candidates.push({blueSlot:blue?.slot||null,blueTileId:blue?.tileId||null,incomeCardId:incomeCard?.id||null,neededData:need,computerSlots:[...slots,...missing].sort((a,b)=>a-b),wallet:next,income:nextIncome,handIds:remaining.map(c=>c.id),scoreGain:score,linear,baseCapital:base,afterCapital:after,value});
  }
 }
 candidates.sort((a,b)=>b.value-a.value||a.neededData-b.neededData||a.blueSlot-b.blueSlot||String(a.incomeCardId).localeCompare(String(b.incomeCardId)));
 return{value:Math.max(0,candidates[0]?.value||0),selected:candidates[0]||null,candidates,reason:'one-fixed-income-and-optional-currency-blue-tail',scope:'One current-data-funded computer/income continuation with an optional currency-blue tail after one mission; shared wallet and known hand, no corners, exchanges, unknown identities, observations, search or pruning bounds.'};
}
const counts={credits:0,energy:0,handSize:0};
for(const entry of cards.CARD_CATALOG){if(entry.set.startsWith('alien:'))continue;const gain=cards.getIncomeGainForCard(cards.createCardInstance(entry,'public-prior-'+entry.card_id));for(const key of Object.keys(counts))counts[key]+=Number(gain?.[key]===1);}
function quote(facts,weights=values.DEFAULT_WEIGHTS){
 const player=facts.player,investment=(hand,publicity,funding)=>values.handCapital(hand,player.techState,facts.supply,facts.round,weights,funding)+values.researchCapital({hand,techState:player.techState,supply:facts.supply,round:facts.round,publicity,researchCost:facts.researchCost,funding},weights);
 const existing=values.purposeCapital(facts,weights).total;
 const base=investment(facts.hand,player.publicity,{resources:player,income:player.income,startingIncome:Number(facts.passing)});
 const ctx={facts,hand:facts.hand,wallet:player,income:player.income,investment};
 const fixed=missionDataContinuation(ctx,weights),baseline=base+fixed.value;
 const result={value:Math.max(0,baseline-existing),existing,base,knownFixed:fixed,baseline,expectedDataCapital:baseline,knownSwapCapital:baseline,classes:[],scope:'One optional current-data income/blue continuation, with at most one unused same-round DeepSpace swap and one already-confirmed unknown public replacement. Public catalog prior is an estimate, never an admissible bound.'};
 if(facts.terminal||facts.passing||facts.round>=4||facts.computerSlots.includes(4)||facts.companyState?.abilityId!=='deepspace_swap_cards'||facts.companyState.roundMarkRound===facts.round)return result;
 const suppliers=facts.hand.filter(c=>!c.hidden&&c.cardId&&['credits','energy'].some(k=>cards.getIncomeGainForCard(c)?.[k]===1)&&!effects.buildPlayEffects(c).some(e=>e.type==='card_research_tech'));
 if(!suppliers.length)return result;
 const publicOffers=facts.board.publicCards.filter(c=>c&&!c.hidden&&c.cardId);
 let knownBest=baseline;
 const bestByGain=gain=>Math.max(baseline,...suppliers.map(card=>{const q=missionDataContinuation({...ctx,incomeGains:{[card.id]:gain}},weights);return base+Math.max(0,...(q.candidates||[]).filter(p=>p.incomeCardId===card.id).map(p=>p.value));}));
 for(const card of publicOffers){const gain=cards.getIncomeGainForCard(card);if(!gain||!['credits','energy'].some(k=>gain[k]===1))continue;knownBest=Math.max(knownBest,bestByGain(gain));}
 result.knownSwapCapital=knownBest;
 const hidden=facts.board.publicCards.some(c=>c?.hidden===true),total=Object.values(counts).reduce((n,x)=>n+x,0);
 if(hidden){for(const [key,count] of Object.entries(counts)){const value=key==='handSize'?knownBest:Math.max(knownBest,bestByGain({[key]:1}));result.classes.push({gain:key,count,value,probability:count/total});}result.expectedDataCapital=result.classes.reduce((n,c)=>n+c.probability*c.value,0);}else result.expectedDataCapital=knownBest;
 result.value=Math.max(0,result.expectedDataCapital-existing);
 return result;
}
module.exports={quote,missionDataContinuation,counts};
