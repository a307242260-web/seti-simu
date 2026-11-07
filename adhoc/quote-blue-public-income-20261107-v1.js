'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),z=require('node:zlib');
const demand=require('../randomizer/game/ai/resource-demand'),data=require('../randomizer/game/data'),cards=require('../randomizer/game/cards/deck'),players=require('../randomizer/game/players'),values=require('../randomizer/game/ai/state-value'),end=require('../randomizer/game/end-game-scoring'),effects=require('../randomizer/game/cards/effects');
const asset=require('node:path').resolve(process.argv[2]);
const proof=JSON.parse(z.gunzipSync(fs.readFileSync(asset)));
const root=proof.roots[165],s=JSON.parse(root.compositionEnvelope.committedState),seat=root.seatId,p=s.players.players.find(x=>x.id===seat),weights=values.DEFAULT_WEIGHTS;
const copy=x=>({...x,hand:[...x.hand],resources:{...x.resources},income:{...x.income},dataState:structuredClone(x.dataState)});
function install(state,player,offer=null){
  return {...state,players:{...state.players,players:state.players.players.map(x=>x.id===seat?player:x)},cards:offer?
    {...state.cards,publicCards:state.cards.publicCards.map(x=>x?.id===offer.id?null:x)}:state.cards};
}
function total(state,player){
  const context={...state,players:state.players.players,aliens:structuredClone(state.aliens),finalScoring:structuredClone(state.finalScoring),cardEffects:effects,getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)};
  const projected=end.computePlayerFinalScore(context,player).totalScore;
  const liquid=Object.entries(weights).reduce((n,[k,v])=>n+(player.resources[k]||0)*v,0);
  const remainingIncome=(4-state.turn.roundNumber)*Object.entries(weights).reduce((n,[k,v])=>n+(player.income[k]||0)*v,0);
  const purpose=demand.planningCapital(state,player);
  return {projected,liquid,remainingIncome,purpose,total:values.sumValueParts([projected,liquid,remainingIncome,purpose])};
}
function blue(player,slot){
  const r=data.placeDataToComputer(player,{target:data.PLACEMENT_KIND_BLUE_BONUS,blueSlot:slot});
  assert(r.ok);
  for(const b of r.slotBonuses)if(b.type!=='choose_card')players.gainResources(player,{[b.type]:b[b.type]});
}
function income(state,card){
  const r=demand.previewIncomeTail({state,seatId:seat,goal:{incomeCardId:card.id}});
  assert(r.available);
  return r.player;
}
const h=income(s,p.hand[0]);blue(h,1);
console.log(JSON.stringify({source:total(s,p),direct:total(install(s,h),h),directPlayer:{wallet:h.resources,income:h.income}}));
for(const offer of s.cards.publicCards.filter(Boolean)){
  if(!['credits','energy'].some(k=>cards.getIncomeGainForCard(offer)[k]))continue;
  const next=copy(p);blue(next,2);next.hand.push({...offer,blueBonusOwnerId:seat});next.resources.handSize++;
  const view=install(s,next,offer),after=income(view,offer);
  console.log(JSON.stringify({offer:offer.cardId,quote:total(install(view,after),after),wallet:after.resources,income:after.income}));
}
