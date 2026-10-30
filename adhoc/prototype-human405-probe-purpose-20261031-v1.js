'use strict';
// A source-bound value hypothesis. This module is not loaded by production,
// does not submit actions and does not establish an admissible pruning bound.
const ordinary=new Set(['mercury','venus','mars','jupiter','saturn','uranus','neptune']);
function knownProbePurpose(observation,seatId,weights,{fundedOnly=false}={}){
 const player=observation.publicState.players.find(p=>p.playerId===seatId);
 const probes=(observation.publicState.board?.rockets||[]).filter(r=>r.surface==='solar-board'&&(r.kind??'standard')==='standard'&&r.fossilId==null
  &&[r.playerId,r.playerColor,r.color].some(x=>x===seatId||x===player.color));
 if(observation.terminal||!probes.length)return{value:0,grossCeiling:0,selected:null,candidates:[]};
 const facts=observation.probeRouteRequirements;
 if(facts?.playerId!==seatId||!Array.isArray(facts.candidates))throw Error('PROTOTYPE_NATIVE_PROBE_FACTS_MISSING');
 const candidates=[];
 for(const goal of facts.candidates){
  if(goal.launchRequired||!ordinary.has(goal.planetId)||goal.playerId!==seatId||!probes.some(r=>r.id===goal.rocketId))continue;
  let gross=0;const included=[],excluded=[];
  for(const reward of goal.endpointFacts.rewards){
   if(reward.type==='gain_resources'){
    const value=Object.entries(reward.options?.gain||{}).reduce((n,[key,amount])=>n+amount*(key==='score'?1:weights[key]||0),0);
    if(!Number.isFinite(value)||value<0)throw Error('PROTOTYPE_REWARD_INVALID');gross+=value;included.push({type:reward.type,value});
   }else if(['pick_card','draw_cards'].includes(reward.type)){
    const count=reward.options?.count??1;if(!Number.isSafeInteger(count)||count<0)throw Error('PROTOTYPE_REWARD_COUNT_INVALID');
    const value=count*weights.handSize;gross+=value;included.push({type:reward.type,value});
   }else excluded.push(reward.type);
  }
  const cost=Object.entries(weights).reduce((n,[key,w])=>n+(goal.required[key]||0)*w,0);
  if(!Number.isFinite(cost)||cost<0)throw Error('PROTOTYPE_NATIVE_COST_INVALID');
  const funded=(goal.required.credits||0)<=player.credits&&(goal.required.energy||0)<=player.energy;
  candidates.push({requirementId:goal.requirementId,planet:goal.planetId,family:goal.endpointFamily,gross,cost,net:Math.max(0,gross-cost),fundedNow:funded,required:goal.required,included,excluded});
 }
 const ranked=candidates.filter(x=>!fundedOnly||x.fundedNow).sort((a,b)=>b.net-a.net||a.cost-b.cost||a.requirementId.localeCompare(b.requirementId));
 return{value:ranked[0]?.net||0,grossCeiling:Math.max(0,...candidates.map(x=>x.gross)),selected:ranked[0]||null,candidates};
}
module.exports={knownProbePurpose};
