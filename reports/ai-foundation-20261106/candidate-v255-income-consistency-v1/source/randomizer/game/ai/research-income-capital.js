(function(root,factory){
 'use strict';const common=typeof module==='object'&&module.exports;
 const api=factory(common?require('../data/placement'):root.SetiDataPlacement,
  common?require('../cards/deck'):root.SetiCards,common?require('../cards/effects'):root.SetiCardEffects,
  common?require('../players'):root.SetiPlayers,common?require('../tech/catalog'):root.SetiTechCatalog,
  common?require('../../solar-system/core'):root.SetiSolarSystem,common?require('../abilities/rocket'):root.SetiAbilityRocket,common?require('./value-arithmetic'):root.SetiValueArithmetic,common?require('./income-card-order'):root.SetiIncomeCardOrder);
 if(common)module.exports=api;else root.SetiResearchIncomeCapital=api;
})(typeof globalThis!=='undefined'?globalThis:window,function(placement,cards,effects,players,tech,solar,rocketAbility,arithmetic,incomeOrder){
 'use strict';
const zero = reason => ({ value: 0, selected: null, reason });
const quiet = cards => (cards || []).every(c => {
  const m = effects.getCardModel(c);
  return m && !m.endGameScoring && !m.triggers?.length && !m.temporaryTasks?.length;
});
function blueSlotFor(techState, slots) {
  const occupied = new Set(Object.values(techState.blueBoardSlots));
  const available = [1, 2, 3, 4].filter(slot => !occupied.has(slot));
  return available.sort((a, b) => {
    const x = placement.getRequiredComputerSlotForBlueBonus(a), y = placement.getRequiredComputerSlotForBlueBonus(b);
    return Number(slots.includes(y)) - Number(slots.includes(x)) || Math.max(0, x - slots.length) - Math.max(0, y - slots.length) || a - b;
  })[0];
}
function quote(facts, weights, portfolio, baseValue, technologyCapital) {
  if (facts.terminal || facts.passing || facts.round >= 4) return zero('research-window-closed');
  if(!Array.isArray(facts.computerSlots))throw new TypeError('VALUE_COMPUTER_SLOTS_MISSING');
  if (!quiet(facts.reservedCards)) return zero('reserved-card-needs-native-value');
  if (facts.computerSlots.includes(4)) return zero('income-already-used');
  const needed = [1, 2, 3, 4].filter(slot => !facts.computerSlots.includes(slot));
  if (facts.player.availableData < needed.length) return zero('existing-data-insufficient');
  if (facts.player.publicity < facts.researchCost) return zero('research-not-funded');
  const known = facts.board.publicCards.filter(c => c?.cardId && !c.hidden && cards.getIncomeGainForCard(c));
  if (!known.length) return zero('known-income-card-missing');
  const incomeCardsById=new Map(known.map(c=>[c.id,c]));
  const oldTech = facts.player.techState, blueSlot = blueSlotFor(oldTech, facts.computerSlots);
  const targets = Object.entries(facts.supply.stacks).filter(([id, stack]) => !oldTech.ownedTiles[id]
    && stack.remaining > 0 && !stack.bonusHidden && stack.bonusId === 'bonus_1c'
    && (tech.getTechType(id) !== 'blue' || blueSlot != null));
  if (!targets.length) return zero('known-selection-reward-missing');
  // Rotate only public geometry, using the native rule query on private data.
  // Other players' resource rewards do not enter our scalar; their piece slots
  // still rotate and reserve destinations in the native order.
  const rotated = { ...facts.player }, actor = { id: rotated.id, color: rotated.color,
    resources: rotated, techState: oldTech };
  const context = { players: { players: [actor] }, pieces: { rockets: structuredClone(facts.board.rockets) },
    solarSystem: structuredClone(facts.board.solarSystem), turn: { currentPlayerId: actor.id, roundNumber: facts.round } };
  const beforeRotation = context.solarSystem.rotation;
  context.solarSystem.rotation = solar.applySolarOrbitRotation(beforeRotation, 1);
  const rotation = rocketAbility.settleRocketsAfterSolarRotation(context, beforeRotation, context.solarSystem.rotation, { captureSnapshots: false });
  if (!rotation.ok) throw new Error('RESEARCH_INCOME_ROTATION_FAILED: ' + rotation.message);
  const oldCapability = technologyCapital(oldTech, facts.round, weights), candidates = [];
  for (const [tileId, stack] of targets) {
    const type = tech.getTechType(tileId), nextTech = { ...oldTech,
      ownedTiles: { ...oldTech.ownedTiles, [tileId]: true },
      blueBoardSlots: { ...oldTech.blueBoardSlots, ...(type === 'blue' ? { [tileId]: blueSlot } : {}) } };
    const supply = { ...facts.supply, stacks: { ...facts.supply.stacks,
      [tileId]: { ...stack, remaining: stack.remaining - 1, firstTakeClaimedBy: stack.firstTakeClaimedBy ?? facts.player.id, bonusId: null, bonusHidden: true } } };
    const prepared = { ...rotated, publicity: rotated.publicity - facts.researchCost,
      availableData: rotated.availableData - needed.length, techState: nextTech };
    const columns = Object.entries(nextTech.blueBoardSlots).filter(([id, slot]) => nextTech.ownedTiles[id]
      && !nextTech.disabledTiles[id] && needed.includes(placement.getRequiredComputerSlotForBlueBonus(slot))).length;
    players.gainResources({ resources: prepared }, { score: (stack.firstTakeClaimedBy == null ? tech.FIRST_TAKE_TYPE_SCORE : 0)
      + columns * placement.getBlueColumnScoreBonus().score,
      publicity: needed.includes(2) ? placement.getComputerSlotBonus(2).publicity : 0 });
    for (const card of known) {
      const gain = cards.getIncomeGainForCard(card), income = { ...facts.player.income }, wallet = { ...prepared, income };
      const { handSize = 0, ...resourceGain } = gain;
      players.gainResources({ resources: wallet }, resourceGain);
      for (const [key, amount] of Object.entries(gain)) income[key] += amount;
      wallet.handSize = facts.player.handSize + handSize;
      const board = { ...facts.board, rockets: context.pieces.rockets, solarSystem: context.solarSystem,
        publicCards: facts.board.publicCards.map(c => c?.id === card.id ? null : c) };
      const after = { ...facts, player: wallet, supply, board,
        computerSlots: [1, 2, 3, 4], extraUnknownCount: facts.extraUnknownCount + handSize };
      const resourceDelta = Object.entries(weights).reduce((n, [key, w]) => n + (key === 'handSize' ? handSize : wallet[key] - facts.player[key]) * w, 0);
      const incomeValue = Object.entries(gain).reduce((n, [key, amount]) => n + amount * (weights[key] || 0), 0) * (4 - facts.round);
      const linear = wallet.score - facts.player.score + resourceDelta + incomeValue
        + technologyCapital(nextTech, facts.round, weights) - oldCapability;
      const afterValue = portfolio(after), netGain = arithmetic.sum([linear,afterValue,-baseValue],weights);
      candidates.push({ tileId, blueSlot: type === 'blue' ? blueSlot : null,
        incomeCardId: card.id, incomeCardIdentity: card.cardId, gain, linear, afterValue, netGain,
        wallet, computerSlots: after.computerSlots });
    }
  }
  candidates.sort((a, b) => b.netGain - a.netGain || a.tileId.localeCompare(b.tileId) || incomeOrder.compare(incomeCardsById.get(a.incomeCardId),incomeCardsById.get(b.incomeCardId)));
  return { value: Math.max(0, candidates[0].netGain), selected: candidates[0], candidates,
    reason: candidates[0].netGain > 0 ? 'funded-research-income' : 'research-income-not-profitable',
    scope: 'One funded visible-selection research and known public income via existing data; joint wallet and native public rotation, no replacement card/bonus identity, no observation, search or pruning guarantee.' };
}
// Absolute scalar ceiling for the admitted no-live-probe post-main phase.
// Native actions cannot clear computer progress or gain permanent technology.
// A future research-income purpose may replace the ordinary one-paid quote;
// only a wallet that can still pay after it may carry another paid purpose.
function upperBound(facts, weights, technologyCapital) {
  if(facts.round>=4||facts.computerSlots.includes(4))return{linear:0,secondResearchPossible:false};
  const cost=facts.researchCost;if(facts.maximumPublicity<cost)return{linear:0,secondResearchPossible:false};
  const known=facts.publicCards.filter(c=>c?.cardId&&!c.hidden&&cards.getIncomeGainForCard(c));
  if(!known.length)return{linear:0,secondResearchPossible:false};
  const gains=known.map(cards.getIncomeGainForCard),income=Math.max(...gains.map(g=>Object.entries(g).reduce((n,[k,v])=>n+v*(weights[k]||0),0)))*(5-facts.round);
  const publicity=(facts.computerSlots.includes(2)?0:placement.getComputerSlotBonus(2).publicity)+Math.max(...gains.map(g=>g.publicity||0));
  const oldTech=facts.techState,occupied=new Set(Object.values(oldTech.blueBoardSlots)),missing=[1,2,3,4].filter(slot=>!facts.computerSlots.includes(slot));
  const existing=Object.entries(oldTech.blueBoardSlots).filter(([id,slot])=>oldTech.ownedTiles[id]&&!oldTech.disabledTiles[id]&&missing.includes(placement.getRequiredComputerSlotForBlueBonus(slot))).length;
  const available=[1,2,3,4].filter(slot=>!occupied.has(slot)),before=technologyCapital(oldTech,facts.round,weights);
  const ceilings=Object.entries(facts.supply.stacks).flatMap(([id,stack])=>{
    const type=tech.getTechType(id);if(!type||oldTech.ownedTiles[id]||stack.remaining<=0||stack.bonusHidden||stack.bonusId!=='bonus_1c'||type==='blue'&&!available.length)return[];
    const next={...oldTech,ownedTiles:{...oldTech.ownedTiles,[id]:true},blueBoardSlots:{...oldTech.blueBoardSlots,...(type==='blue'?{[id]:available[0]}:{})}};
    const newColumn=type==='blue'&&available.some(slot=>missing.includes(placement.getRequiredComputerSlotForBlueBonus(slot)))?1:0;
    return[(stack.firstTakeClaimedBy==null?tech.FIRST_TAKE_TYPE_SCORE:0)-cost*weights.publicity+technologyCapital(next,facts.round,weights)-before+income+(existing+newColumn)*placement.getBlueColumnScoreBonus().score+(facts.computerSlots.includes(2)?0:placement.getComputerSlotBonus(2).publicity)*weights.publicity];
  });
  return{linear:Math.max(0,...ceilings),secondResearchPossible:ceilings.length>0&&facts.maximumPublicity-cost+publicity>=cost};
}
// Typed resource quote only. It never constructs an observation or game node.
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
 const base=investment(hand,wallet.publicity,{resources:wallet,income,startingIncome:0},{computerSlots:slots,blueSlots:blues}),candidates=[];
 const incomeCards=slots.includes(4)?[]:hand.filter(c=>!c.hidden&&c.cardId&&(()=>{const gain=incomeGainFor(c);return gain&&Object.keys(gain).every(k=>['credits','energy'].includes(k));})());
 const incomeCardsById=new Map(incomeCards.map(c=>[c.id,c]));
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
   const after=investment(remaining,next.publicity,{resources:next,income:nextIncome,startingIncome:0},{computerSlots:[...slots,...missing].sort((a,b)=>a-b),blueSlots:blues}),value=arithmetic.sum([linear,after,-base],weights);
   candidates.push({blueSlot:blue?.slot||null,blueTileId:blue?.tileId||null,incomeCardId:incomeCard?.id||null,neededData:need,computerSlots:[...slots,...missing].sort((a,b)=>a-b),wallet:next,income:nextIncome,handIds:remaining.map(c=>c.id),scoreGain:score,linear,baseCapital:base,afterCapital:after,value});
  }
 }
 candidates.sort((a,b)=>b.value-a.value||a.neededData-b.neededData||a.blueSlot-b.blueSlot||incomeOrder.compare(incomeCardsById.get(a.incomeCardId),incomeCardsById.get(b.incomeCardId))||String(a.incomeCardId).localeCompare(String(b.incomeCardId)));
 return{value:Math.max(0,candidates[0]?.value||0),selected:candidates[0]||null,candidates,reason:'one-fixed-income-and-optional-currency-blue-tail',scope:'One current-data-funded computer/income continuation with an optional currency-blue tail after one mission; shared wallet and known hand, no corners, exchanges, unknown identities, observations, search or pruning bounds.'};
}

// A closure of one existing-data income/blue plan. A free company swap can
// change the supplier's resource category, but consumes the same income slot,
// outgoing hand card and shared wallet. A confirmed hidden public card uses
// the public catalog prior; it is never a native payoff or pruning bound.
const incomeCounts={credits:0,energy:0,handSize:0};
for(const entry of cards.CARD_CATALOG)if(!entry.set.startsWith('alien:')){
 const key=['credits','energy','handSize'][entry.income_code];if(key)incomeCounts[key]++;
}
function incomeOptions({facts,investment,baseCapital},weights){
 const ctx={facts,hand:facts.hand,wallet:facts.player,income:facts.player.income,investment};
 const fixed=missionDataContinuation(ctx,weights),baseline=arithmetic.sum([baseCapital,fixed.value],weights);
 const result={total:baseline,baseline,knownSwapCapital:baseline,knownSwapPlan:null,fixed,classes:[]};
 if(facts.terminal||facts.passing||facts.round>=4||facts.computerSlots.includes(4)
   ||facts.companyState?.abilityId!=='deepspace_swap_cards'||facts.companyState.roundMarkRound===facts.round)return result;
 // With equal currency weights, a swap can only improve this investment
 // portfolio by changing a known held research card's payment window/loss.
 if(weights.credits===weights.energy&&!facts.hand.some(c=>effects.buildPlayEffects(c).some(e=>e.type==='card_research_tech')))return result;
 const suppliers=facts.hand.filter(c=>!c.hidden&&c.cardId&&['credits','energy'].some(k=>cards.getIncomeGainForCard(c)?.[k]===1)
   &&!effects.buildPlayEffects(c).some(e=>e.type==='card_research_tech'));
 if(!suppliers.length)return result;
 const categories=new Map();
 function bestFor(key){
  if(categories.has(key))return categories.get(key);
  let best={total:baseline,plan:null};
  for(const card of suppliers){
   const q=missionDataContinuation({...ctx,incomeGains:{[card.id]:{[key]:1}}},weights);
   for(const plan of q.candidates||[])if(plan.incomeCardId===card.id&&arithmetic.sum([baseCapital,plan.value],weights)>best.total)
    best={total:arithmetic.sum([baseCapital,plan.value],weights),plan:{outgoingCardId:card.id,continuation:plan}};
  }
  categories.set(key,best);return best;
 }
 for(const incoming of facts.board.publicCards.filter(c=>c&&!c.hidden&&c.cardId)){
  const gain=cards.getIncomeGainForCard(incoming),key=['credits','energy'].find(k=>gain?.[k]===1);if(!key)continue;
  const best=bestFor(key);
  if(best.total>result.knownSwapCapital){result.knownSwapCapital=best.total;result.knownSwapPlan={...best.plan,incomingCardId:incoming.id,netGain:best.total-baseline};}
 }
 result.total=result.knownSwapCapital;
 if(facts.board.publicCards.some(c=>c?.hidden===true)){
  const count=Object.values(incomeCounts).reduce((n,x)=>n+x,0);
  for(const [key,n]of Object.entries(incomeCounts))result.classes.push({gain:key,count:n,probability:n/count,total:key==='handSize'?result.knownSwapCapital:Math.max(result.knownSwapCapital,bestFor(key).total)});
  result.total=arithmetic.normalize(result.classes.reduce((n,c)=>n+c.probability*c.total,0),weights);
 }
 return result;
}
return Object.freeze({quote,upperBound,missionDataContinuation,incomeOptions});
});
