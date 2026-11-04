'use strict';
// A scalar certificate prototype. It never produces a game envelope or V
// observation. Its caller must already hold the quiet native turn-end proof.
const ability=require('../randomizer/game/abilities/rocket'),rockets=require('../randomizer/game/rockets'),players=require('../randomizer/game/players'),effects=require('../randomizer/game/cards/effects'),trades=require('../randomizer/game/actions/quick-trades'),pick=require('../randomizer/game/ai/card-pick-planning'),local=require('../randomizer/game/ai/local-decision-plans'),demand=require('../randomizer/game/ai/resource-demand'),values=require('../randomizer/game/ai/state-value'),end=require('../randomizer/game/end-game-scoring');
const owner=(s,id)=>s.players.players.find(p=>p.id===id),weighted=p=>Object.entries(values.DEFAULT_WEIGHTS).reduce((n,[k,w])=>n+p.resources[k]*w,0);
const pickSources=trades.TRADE_ACTIONS.filter(t=>['credits-for-card','energy-for-card','publicity-for-card','cards-for-pick-card'].includes(t.id)).map(t=>({actionId:'quote-only:'+t.id,family:'quick_trade',target:{tradeId:t.id},payload:{cost:t.cost,gain:t.gain}}));
function mayStartPaidPick(state,seatId){
 // All four static payment sources are an overapproximation of the legal
 // menu. A positive result rejects the certificate; none is ever submitted.
 return Boolean(pick.createCardPickPlanner().plan({state,seatId,actions:pickSources,status:'stable',endpoints:()=>[]})?.selectedActionId);
}
function finalScore(state,p){return end.computePlayerFinalScore({...state,players:state.players.players,aliens:structuredClone(state.aliens),data:structuredClone(state.data),cardEffects:effects,getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)},p).totalScore;}
function movementTail({state,seatId,intent}){
 const p=owner(state,seatId),zero=reason=>({available:false,reason});
 if(!p?.mainActionCompleted||!intent||intent.free||intent.prefixOnly||!intent.path.length||intent.goal.timing!=='advance-before-rotation')return zero('not-a-complete-paid-prefix');
 const company=p.initialSelection?.industry?.id||p.initialSelection?.industry;
 if(String(company).includes('深空探测'))return zero('company-swap-needs-native-continuation');
 if(p.resources.energy<intent.path.reduce((n,s)=>n+s.requiredMovePoints,0))return zero('movement-needs-card-payment');
 const copy=structuredClone(p),future={...state,pieces:structuredClone(state.pieces),players:{...state.players,players:state.players.players.map(v=>v.id===seatId?copy:v)}};
 const normalized={...copy,reservedCards:copy.reservedCards.map(c=>{const card=structuredClone(c);effects.ensureCardEffectState(card);return card;})},moves=[];
 const context={state:future,players:future.players,pieces:future.pieces,solarSystem:future.solarSystem,turn:future.turn,planets:future.planets};
 for(const step of intent.path){
  const ship=future.pieces.rockets.find(r=>r.id===intent.rocketId),at=ship&&rockets.getRocketSectorCoordinate(ship);
  if(!at||at.x!==step.from.x||at.y!==step.from.y)return zero('movement-route-invalidated');
  const required=ability.getRequiredMovePointsFromCoordinate(context,copy,at);
  if(required!==step.requiredMovePoints)return zero('movement-cost-invalidated');
  const moved=ability.moveProbe(context,{rocketId:intent.rocketId,deltaX:step.deltaX,deltaY:step.deltaY,movementPoints:required,cost:{energy:required},source:'move'});
  if(!moved.ok)return zero('movement-native-query-rejected');
  // requiresOwnOrbit is overapproximated too. Any possibly matching trigger,
  // including a draw/data choice, remains on its complete native path.
  if((moved.events||[]).some(e=>effects.collectMatchingTriggers(normalized,{...e,...(e.type==='visitPlanet'?{hasOwnOrbit:true}:{})}).length))return zero('movement-trigger-needs-native-continuation');
  moves.push({rocketId:intent.rocketId,deltaX:step.deltaX,deltaY:step.deltaY,energy:required,events:moved.events});
 }
 const destination=rockets.getRocketSectorCoordinate(future.pieces.rockets.find(r=>r.id===intent.rocketId));
 if(destination.x!==intent.goal.coordinate.x||destination.y!==intent.goal.coordinate.y)return zero('movement-goal-not-reached');
 if(mayStartPaidPick(future,seatId))return zero('movement-paid-pick-needs-native-continuation');
 const tail=local.dataTailCompletion({state:future,seatId,canLeaveProbeStationary:preview=>!mayStartPaidPick(preview,seatId)});
 if(!tail.available)return zero(tail.reason);
 const net=finalScore(future,copy)-finalScore(state,p)+weighted(copy)-weighted(p)
  +demand.planningCapital(future,copy)-demand.planningCapital(state,p)+tail.netGain;
 if(!Number.isFinite(net))throw new Error('MOVEMENT_TAIL_VALUE_INVALID');
 return{available:true,netGain:net,movementNetGain:net-tail.netGain,moves,tail,requiredNativeInputs:moves.length*2+tail.requiredNativeInputs,
  scope:'Entire fixed paid prefix with energy-only payments, no matching movement triggers or paid-pick purpose, then the existing fixed currency/data/end policy. Requires the caller quiet-turn proof. Scalar only; not a native successor or general movement equivalence.'};
}
module.exports={movementTail};
