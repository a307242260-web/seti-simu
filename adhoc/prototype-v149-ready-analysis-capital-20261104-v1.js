'use strict';
// Independent scalar purpose quote, deliberately outside Production until its
// native parity, information, budget and pruning obligations have been met.
const data=require('../randomizer/game/data'),players=require('../randomizer/game/players'),passives=require('../randomizer/game/industry/passives'),aliens=require('../randomizer/game/aliens/state'),probe=require('../randomizer/game/ai/probe-capital'),demand=require('../randomizer/game/ai/resource-demand'),local=require('../randomizer/game/ai/local-decision-plans'),values=require('../randomizer/game/ai/state-value'),end=require('../randomizer/game/end-game-scoring'),effects=require('../randomizer/game/cards/effects');
const owner=(s,id)=>s.players.players.find(p=>p.id===id),weights=values.DEFAULT_WEIGHTS;
function nativeFinal(s,p){return end.computePlayerFinalScore({...s,players:s.players.players,cardEffects:effects,getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)},p).totalScore;}
function readyAnalysisCapital(state,seatId){
 const original=owner(state,seatId);
 if(state.turn.gameEnded||state.turn.passedPlayerIds.includes(seatId)||!data.listComputerPlacedTokens(original).some(t=>t.placementSlot===data.ANALYZE_REQUIRED_COMPUTER_SLOT))return{available:false,reason:'analysis-not-ready'};
 const cost=passives.canAnalyzeWithoutEnergy(original)?{}:{energy:data.ANALYZE_ENERGY_COST},payment=probe.funding(original.resources,cost,weights);
 if(!payment)return{available:false,reason:'analysis-not-funded'};
 // Real rule helpers operate on private containers; this result is a scalar
 // forecast and never a successor observation or a graph/search node.
 const player=structuredClone(original),preview={...state,aliens:structuredClone(state.aliens),players:{...state.players,players:state.players.players.map(p=>p.id===seatId?player:p)}};
 if(!players.spendResources(player,payment.spend).ok)throw new Error('READY_ANALYSIS_PAYMENT_FAILED');
 if(!data.analyzeDataWithoutEnergy(player).ok)throw new Error('READY_ANALYSIS_CLEAR_FAILED');
 const choices=Object.entries(preview.aliens.aliens).filter(([id])=>Number.isSafeInteger(Number(id))).map(([id])=>({target:{alienSlotId:Number(id),traceType:'blue'}})).map(action=>{
  const slot=preview.aliens.aliens[action.target.alienSlotId],copy=structuredClone(preview.aliens);
  if(slot.revealed)return null;
  const placed=aliens.placeFirstTrace(copy,action.target.alienSlotId,'blue',player.color);
  if(!placed.ok||placed.readyToReveal)return null;
  const gain={...(placed.extraOnly?aliens.getExtraTraceReward():aliens.getFirstTraceRewardForSlot(action.target.alienSlotId)).gain};
  if(Object.keys(gain).some(k=>!['score','credits','energy','publicity'].includes(k)))return null;
  const p=structuredClone(player);players.gainResources(p,gain);const value=Object.entries(weights).reduce((n,[k,w])=>n+(p.resources[k]-player.resources[k])*w,0)+(p.resources.score-player.resources.score);
  return{action,gain,value,aliens:copy};
 }).filter(Boolean).sort((a,b)=>b.value-a.value||a.action.target.alienSlotId-b.action.target.alienSlotId);
 if(!choices.length)return{available:false,reason:'analysis-trace-needs-native-boundary'};
 const chosen=choices[0];preview.aliens=chosen.aliens;players.gainResources(player,chosen.gain);
 const base=nativeFinal(preview,player)-nativeFinal(state,original)+Object.entries(weights).reduce((n,[k,w])=>n+(player.resources[k]-original.resources[k])*w,0)+demand.planningCapital(preview,player)-demand.planningCapital(state,original);
 // One presently funded, known blue resource tail. It cannot cross an income
 // identity boundary, buy/discard a card or assume any new data/technology.
 const tails=data.listBluePlacementRequirements(player).filter(r=>r.requiredComputerSlot<4&&player.resources.availableData>=r.requiredComputerSlot+1).map(r=>({goal:{kind:'blue-data',blueSlot:r.blueSlot,targetComputerSlot:r.requiredComputerSlot,required:{}},preview:local.blueCompletion({state:preview,seatId,goal:{blueSlot:r.blueSlot}})})).filter(r=>r.preview.available&&!r.preview.incomeCardId&&!r.preview.dataCornerIds?.length&&r.preview.netGain>0).sort((a,b)=>b.preview.netGain-a.preview.netGain||a.goal.blueSlot-b.goal.blueSlot);
 const tail=tails[0]||null;
 const planNetGain=base+(tail?.preview.netGain||0);
 return{available:true,planNetGain,selected:planNetGain>0,netGain:Math.max(0,planNetGain),baseNetGain:base,payment,trace:{target:chosen.action.target,gain:chosen.gain},blueTail:tail,nativeInputs:1+payment.energyPurchases+payment.creditPurchases+1+(tail?.preview.requiredNativeInputs||0),scope:'One current-wallet-funded ready analysis and one known resource-only blue tail, without another player, hidden identity, species reveal or unearned income. Forecast hypothesis; not an admissible bound.'};
}
module.exports={readyAnalysisCapital};
