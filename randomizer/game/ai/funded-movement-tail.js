(function(root,factory){
 'use strict';const common=typeof module==='object'&&module.exports;
 const api=factory(common?require('../abilities/rocket'):root.SetiAbilityRocket,common?require('../rockets'):root.SetiRocketActions,
  common?require('../players'):root.SetiPlayers,common?require('../cards/effects'):root.SetiCardEffects,
  common?require('../actions/quick-trades'):root.SetiQuickTrades,common?require('./card-pick-planning'):root.SetiCardPickPlanning,
  common?require('./local-decision-plans'):root.SetiLocalDecisionPlans,common?require('./resource-demand'):root.SetiResourceDemand,
  common?require('./state-value'):root.SetiStateValue,common?require('../end-game-scoring'):root.SetiEndGameScoring,common?require('../data'):root.SetiData,common?require('../effects/probe-turn-session'):root.SetiProbeTurnSession,common?require('../cards/deck'):root.SetiCards);
 if(common)module.exports=api;else root.SetiFundedMovementTail=api;
})(typeof globalThis!=='undefined'?globalThis:window,function(ability,rockets,players,effects,trades,pick,local,demand,values,end,data,probeTurn,cards){
 'use strict';
const owner=(s,id)=>s.players.players.find(p=>p.id===id),weighted=p=>Object.entries(values.DEFAULT_WEIGHTS).reduce((n,[k,w])=>n+p.resources[k]*w,0);
const pickSources=trades.TRADE_ACTIONS.filter(t=>['credits-for-card','energy-for-card','publicity-for-card','cards-for-pick-card'].includes(t.id)).map(t=>({actionId:'quote-only:'+t.id,family:'quick_trade',target:{tradeId:t.id},payload:{cost:t.cost,gain:t.gain}}));
function mayStartPaidPick(state,seatId){
 // All four static payment sources are an overapproximation of the legal
 // menu. A positive result rejects the certificate; none is ever submitted.
 return Boolean(pick.createCardPickPlanner().plan({state,seatId,actions:pickSources,status:'stable',endpoints:()=>[]})?.selectedActionId);
}
function finalScore(state,p){return end.computePlayerFinalScore({...state,players:state.players.players,aliens:structuredClone(state.aliens),finalScoring:structuredClone(state.finalScoring),cardEffects:effects,getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)},p).totalScore;}
function movementTail({state,seatId,intent}){
 let nativeMoveQueries=0;const p=owner(state,seatId),zero=reason=>({available:false,reason,nativeMoveQueries});
 if(state.turn.roundNumber>4)return zero('movement-round-needs-native-continuation');
 if(!p?.mainActionCompleted||!intent||intent.free||intent.prefixOnly||!intent.path.length||intent.goal.timing!=='advance-before-rotation')return zero('not-a-complete-paid-prefix');
 const company=p.initialSelection?.industry?.id||p.initialSelection?.industry;
 if(String(company).includes('深空探测'))return zero('company-swap-needs-native-continuation');
 if(state.turn.roundNumber<4&&p.resources.energy<intent.path.reduce((n,s)=>n+s.requiredMovePoints,0))return zero('movement-needs-card-payment');
 const copy=structuredClone(p),future={...state,cards:{...state.cards,discardPile:[...state.cards.discardPile]},pieces:structuredClone(state.pieces),players:{...state.players,players:state.players.players.map(v=>v.id===seatId?copy:v)}};
 const normalized={...copy,reservedCards:copy.reservedCards.map(c=>{const card=structuredClone(c);effects.ensureCardEffectState(card);return card;})},moves=[];
 const context={state:future,players:future.players,pieces:future.pieces,solarSystem:future.solarSystem,turn:future.turn,planets:future.planets};
 for(const step of intent.path){
  const ship=future.pieces.rockets.find(r=>r.id===intent.rocketId),at=ship&&rockets.getRocketSectorCoordinate(ship);
  if(!at||at.x!==step.from.x||at.y!==step.from.y)return zero('movement-route-invalidated');
  const required=ability.getRequiredMovePointsFromCoordinate(context,copy,at);
  if(required!==step.requiredMovePoints)return zero('movement-cost-invalidated');
  let payment={payload:{energyCost:required},target:{cardIds:[]}};
  if(state.turn.roundNumber===4){
   const choices=probeTurn.getMovePaymentChoices(future,{ownerId:seatId,payload:{action:{payload:{requiredMovePoints:required}}}},future);
   payment=choices.sort((a,b)=>(a.target.cardIds?.length||0)-(b.target.cardIds?.length||0)||(a.actionId<b.actionId?-1:1))[0];
   if(!payment)return zero('movement-native-payment-unavailable');
   const ids=new Set(payment.target.cardIds);
   for(let i=copy.hand.length-1;i>=0;i--)if(ids.has(copy.hand[i].id)){
    const discarded=cards.discardFromHandAtIndex(copy,i);if(!discarded.ok)return zero('movement-native-discard-failed');
    cards.addToDiscardPile(future.cards,discarded.card);
   }
  }
  nativeMoveQueries++;const moved=ability.moveProbe(context,{rocketId:intent.rocketId,deltaX:step.deltaX,deltaY:step.deltaY,movementPoints:required,cost:payment.payload.energyCost?{energy:payment.payload.energyCost}:{},source:'move'});
  if(!moved.ok)return zero('movement-native-query-rejected');
  // requiresOwnOrbit is overapproximated too. Any possibly matching trigger,
  // including a draw/data choice, remains on its complete native path.
  if((moved.events||[]).some(e=>effects.collectMatchingTriggers(normalized,{...e,...(e.type==='visitPlanet'?{hasOwnOrbit:true}:{})}).length))return zero('movement-trigger-needs-native-continuation');
  moves.push({rocketId:intent.rocketId,deltaX:step.deltaX,deltaY:step.deltaY,energy:payment.payload.energyCost,cardIds:payment.target.cardIds,events:moved.events});
 }
 const destination=rockets.getRocketSectorCoordinate(future.pieces.rockets.find(r=>r.id===intent.rocketId));
 if(destination.x!==intent.goal.coordinate.x||destination.y!==intent.goal.coordinate.y)return zero('movement-goal-not-reached');
 if(mayStartPaidPick(future,seatId))return zero('movement-paid-pick-needs-native-continuation');
 const closedDataPolicy=preview=>{
  if(mayStartPaidPick(preview,seatId))return false;
  const actor=owner(preview,seatId),goals=demand.catalog({state:preview,seatId,requirements:{bluePlacements:data.listBluePlacementRequirements(actor)}}),income=goals.find(g=>g.kind==='income'),blue=goals.find(g=>g.kind==='blue-data');
  if(income&&blue){const i=local.incomeCompletion({state:preview,seatId,goal:income}),b=local.blueCompletion({state:preview,seatId,goal:blue});if(i.selected&&b.available&&b.selected&&b.netGain>i.netGain)return false;}
  return true;
 };
 const tail=local.dataTailCompletion({state:future,seatId,canLeaveProbeStationary:closedDataPolicy,fixedDataOrdering:state.turn.roundNumber===4});
 if(!tail.available)return zero(tail.reason);
 const net=values.sumValueParts([finalScore(future,copy),-finalScore(state,p),weighted(copy),-weighted(p),demand.planningCapital(future,copy),-demand.planningCapital(state,p),tail.netGain]);
 if(!Number.isFinite(net))throw new Error('MOVEMENT_TAIL_VALUE_INVALID');
 return{available:true,nativeMoveQueries,netGain:net,movementNetGain:net-tail.netGain,moves,tail,requiredNativeInputs:moves.length*2+tail.requiredNativeInputs,
  scope:'Entire fixed paid prefix with shared Native greedy payments (R4 includes known hand cards), no matching movement triggers or paid-pick purpose, then the existing fixed currency/data/end policy. Requires the caller quiet-turn proof. Scalar only; not a native successor or general movement equivalence.'};
}
return Object.freeze({quote:movementTail});
});
