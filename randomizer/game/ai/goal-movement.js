(function(root,factory){
  "use strict";
  const common=typeof module==="object"&&module.exports;
  const api=factory(common?require('../abilities/rocket'):root.SetiAbilityRocket,
    common?require('../rockets'):root.SetiRocketActions,common?require('../../solar-system/core'):root.SetiSolarSystem,
    common?require('../cards/deck'):root.SetiCards,common?require('../cards/effects'):root.SetiCardEffects,
    common?require('../cards/play-domain'):root.SetiCardPlayDomain,common?require('../players'):root.SetiPlayers);
  if(common)module.exports=api;else root.SetiGoalMovement=api;
})(typeof globalThis!=="undefined"?globalThis:window,function(ability,rockets,solar,cards,effects,cardPlay,players){
  "use strict";
  const VERSION='seti-goal-movement-policy-v1';
  const direction=action=>Number.isInteger(action.target?.rocketId)&&Number.isInteger(action.target.deltaX)
    &&Number.isInteger(action.target.deltaY)&&Math.abs(action.target.deltaX)+Math.abs(action.target.deltaY)===1;
  const startsMovement=action=>action.target?.tradeId==='energy-for-move'||action.family==='card_corner'&&action.payload?.kind==='move';
  const ending=action=>action.target?.skip===true||action.target?.mode==='skip';
  const same=(a,b)=>a&&b&&a.x===b.x&&a.y===b.y;
  const value=effect=>{
    const options=effect?.options||{};
    if(effect?.type==='gain_resources')return Object.entries(options.gain||{}).reduce((n,[key,v])=>n+v*({score:1,credits:1,energy:1,publicity:.5}[key]||0),0);
    return ['draw_cards','pick_card','gain_data'].includes(effect?.type)?Math.max(1,options.count||1)*(effect.type==='gain_data'?.5:1):0;
  };
  // 几何寻路只访问每探测器至多32个坐标；不创建游戏分支或执行奖励。
  function routes(state,owner,ship,cache){
    const cacheKey=JSON.stringify([state.solarSystem,state.pieces,owner.id,owner.techState,owner.industryBorrowedTechTileId,owner.industryBorrowedTechRound,owner.industryBorrowedTechTurn,state.turn.roundNumber,state.turn.turnNumber,state.turn.cardTurnEventBonuses||[],ship.id]);
    if(cache?.has(cacheKey))return{best:cache.get(cacheKey),settled:0};
    const context={state,players:state.players,pieces:state.pieces,turn:state.turn,solarSystem:state.solarSystem};
    const start=rockets.getRocketSectorCoordinate(ship),best=new Map(),queue=[{coordinate:start,cost:0,path:[],key:''}];let settled=0;
    while(queue.length){queue.sort((a,b)=>a.cost-b.cost||a.path.length-b.path.length||(a.key<b.key?-1:a.key>b.key?1:0));
      const next=queue.shift(),key=`${next.coordinate.x},${next.coordinate.y}`;if(best.has(key))continue;best.set(key,next);settled+=1;
      const cost=ability.getRequiredMovePointsFromCoordinate(context,owner,next.coordinate);if(!Number.isSafeInteger(cost)||cost<1)throw new Error('GOAL_MOVEMENT_COST_INVALID');

      for(const d of ability.MOVE_DIRECTIONS){const move=rockets.canMoveFromCoordinate(state.pieces,next.coordinate,d.deltaX,d.deltaY,ship.id);if(!move.ok)continue;
        if(best.has(`${move.to.x},${move.to.y}`))continue;const step={from:next.coordinate,to:move.to,deltaX:d.deltaX,deltaY:d.deltaY,requiredMovePoints:cost};
        queue.push({coordinate:move.to,cost:next.cost+cost,path:[...next.path,step],key:next.key+'/'+d.id});
      }
    }
    if(cache){if(cache.size>=64)cache.delete(cache.keys().next().value);cache.set(cacheKey,best);}
    return{best,settled};
  }
  function plan({state,seatId,actions,status,session,intent=null,endpoints=()=>[],objectiveOnly=false,routeCache=null,compareTiming=null}){
    const moving=actions.filter(direction);
    const owner=state.players.players.find(p=>p.id===seatId);if(!owner)throw new Error('GOAL_MOVEMENT_OWNER_MISSING');
    const payment=intent&&actions.filter(a=>a.family==='choose_payment'&&a.target?.kind==='move-payment');
    if(payment?.length){
      const reserve=intent.goal.timing==='current-turn'?(intent.goal.endpointCost?.energy||0):0;
      const choices=payment.filter(a=>owner.resources.energy-(a.payload?.energyCost||0)>=reserve)
        .sort((a,b)=>(a.target.cardIds?.length||0)-(b.target.cardIds?.length||0)||(a.actionId<b.actionId?-1:1));
      if(!choices.length)throw new Error('GOAL_MOVEMENT_PAYMENT_UNAVAILABLE');
      return{policy:VERSION,selectionBasis:'committed-goal-payment',isEquivalence:false,reason:'reserve-endpoint-energy',chosenGoal:intent.goal,intent,
        selectedActionId:choices[0].actionId,retainedActionIds:[choices[0].actionId],excludedActionIds:actions.filter(a=>a!==choices[0]).map(a=>a.actionId),
        excludedDirectionCount:0,routingNodes:0,objectiveCount:0};
    }
    if(!moving.length&&!objectiveOnly)return null;
    const free=status==='decision',head=session?.queue?.[0];
    const allowance=free?(cardPlay.getMovementAllowance(head,state)??moving.find(a=>Number.isInteger(a.payload?.remaining))?.payload.remaining??head?.payload?.remaining??1):
      owner.resources.energy+owner.hand.reduce((n,c)=>n+(cards.getDiscardActionMoveRewardForCard(c)?.movementPoints||0),0);
    if(!Number.isSafeInteger(allowance)||allowance<0)throw new Error('GOAL_MOVEMENT_ALLOWANCE_INVALID');
    const stop=actions.find(ending),mandatoryPrefix=!objectiveOnly&&free&&!stop&&actions.length>0&&actions.every(direction),matches=(a,ship,step)=>a.target.rocketId===ship&&a.target.deltaX===step.deltaX&&a.target.deltaY===step.deltaY;
    function result(chosen,selected,why,routingNodes=0,objectiveCount=0){
      const retained=actions.filter(a=>direction(a)?a===selected:!free&&startsMovement(a)?false:free&&ending(a)?a===selected:true).map(a=>a.actionId);
      if(!retained.length){const error=new Error('GOAL_MOVEMENT_NO_LEGAL_EXIT');error.details={status,allowance,actions:actions.map(a=>({target:a.target,payload:a.payload})),resources:owner.resources,handCount:owner.hand.length};throw error;}
      return{policy:VERSION,selectionBasis:'explicit-objective-policy',isEquivalence:false,reason:why,
        chosenGoal:chosen?.goal||null,plan:chosen?{kind:'goal-plan',objective:chosen.goal,route:chosen.path,execution:'deterministic-native-route'}:null,intent:chosen?{goal:chosen.goal,rocketId:chosen.rocketId,path:chosen.path,startedTurn:chosen.startedTurn,startedRound:chosen.startedRound,free:chosen.free,prefixOnly:chosen.prefixOnly===true}:null,selectedActionId:selected?.actionId||null,retainedActionIds:retained,
        excludedActionIds:actions.filter(a=>!retained.includes(a.actionId)).map(a=>a.actionId),excludedDirectionCount:actions.filter(a=>direction(a)&&!retained.includes(a.actionId)).length,routingNodes,objectiveCount};
    }
    if(intent){const endpointCost=intent.goal.timing==='current-turn'?(intent.goal.endpointCost||{}):{},resourceValid=(endpointCost.credits||0)<=owner.resources.credits
      &&(endpointCost.energy||0)<=owner.resources.energy&&intent.path.reduce((n,s)=>n+s.requiredMovePoints,0)+(free?0:(endpointCost.energy||0))<=allowance;const ship=state.pieces.rockets.find(r=>r.id===intent.rocketId),at=ship&&rockets.getRocketSectorCoordinate(ship);
      if(resourceValid&&!intent.path.length&&same(at,intent.goal.coordinate))return result(intent,free?stop:null,'objective-reached');
      const next=intent.path[0],selected=next&&same(at,next.from)&&moving.find(a=>matches(a,intent.rocketId,next));
      if((resourceValid||mandatoryPrefix)&&selected&&next.requiredMovePoints<=allowance)return result(intent,selected,'continue-bound-route');
    }
    const ships=state.pieces.rockets.filter(r=>r.playerId===seatId&&rockets.isControllablePlayerRocket(r)),goals=[],pathByShip=new Map();let routingNodes=0;
    for(const ship of ships){const found=routes(state,owner,ship,routeCache);routingNodes+=found.settled;pathByShip.set(ship.id,found.best);}
    const normalized={...owner,reservedCards:owner.reservedCards.map(c=>{const copy=structuredClone(c);effects.ensureCardEffectState(copy);return copy;})};
    const arrivalValue=content=>owner.resources.publicity>=players.RESOURCE_LIMITS.publicity?0:
      content.kind==='comet'||content.kind==='planet'&&content.planetId!=='earth'||content.kind==='asteroid'&&players.playerOwnsTech(owner,'orange2',{turn:state.turn})? 0.5 : 0;
    function add(goal,ship,route,gain,endpointCost=0){if(!route||mandatoryPrefix&&!route.path.length||!mandatoryPrefix&&goal.timing!=='next-turn'&&route.cost>allowance)return;const first=route.path[0],selected=first&&moving.find(a=>matches(a,ship.id,first));if(!objectiveOnly&&route.path.length&&!selected)return;
      const net=gain-endpointCost-(free?0:route.cost);if(!(net>0))return;
      goals.push({goal,rocketId:ship.id,path:route.path,cost:route.cost,net,selected,startedTurn:state.turn.turnNumber,startedRound:state.turn.roundNumber,free,prefixOnly:mandatoryPrefix});
    }
    for(const ship of ships)for(const route of pathByShip.get(ship.id).values()){
      if(!route.path.length)continue;const c=solar.resolveVisibleContent(route.coordinate.x,route.coordinate.y,state.solarSystem).content;
      const type={planet:'visitPlanet',asteroid:'visitAsteroid',comet:'visitComet'}[c.kind];if(!type)continue;
      const ownOrbit=(state.planets.planets[c.planetId]?.orbitMarkers||[]).some(m=>m.playerId===seatId||m.playerColor===owner.color||m.color===owner.color);
      const event={type,planetId:c.planetId,playerId:seatId,source:free?'card':'move',hasOwnOrbit:ownOrbit};
      const rewards=effects.collectMatchingTriggers(normalized,event).map(match=>({id:`${match.card.id}:${match.trigger.id}`,value:value(match.trigger.effect)})).sort((a,b)=>b.value-a.value||(a.id<b.id?-1:1));
      const reward=rewards[0],gain=arrivalValue(c)+(reward?.value||0);
      add({id:`visit:${ship.id}:${route.coordinate.x}:${route.coordinate.y}:${reward?.id||'publicity'}`,kind:'visit',timing:'current-turn',label:reward?`领取访问奖励 ${reward.id}`:'领取到达宣传',coordinate:route.coordinate},ship,route,gain);
    }
    // Production给出合法环绕/登陆终点、费用与收益；本策略只确定目标及路线。
    for(const candidate of endpoints()){
      const ship=ships.find(s=>s.id===candidate.rocketId);if(!ship)continue;
      const location=solar.createSolarSnapshot(state.solarSystem).planetLocations.find(p=>p.planetId===candidate.planetId);if(!location)continue;
      const coordinate={x:location.x,y:location.y},route=pathByShip.get(ship.id).get(`${coordinate.x},${coordinate.y}`),cost=candidate.endpointFacts?.cost||{};
      if(!mandatoryPrefix&&!owner.mainActionCompleted&&((cost.credits||0)>owner.resources.credits||(cost.energy||0)>owner.resources.energy
        ||!free&&(route?.cost||0)+(cost.energy||0)>allowance))continue;
      const benefit=candidate.targetBenefit;if(!benefit)throw new Error('GOAL_MOVEMENT_ENDPOINT_BENEFIT_MISSING');
      add({id:candidate.requirementId,kind:candidate.endpointFamily,label:`${candidate.endpointFamily} ${candidate.planetId}`,coordinate,
        timing:mandatoryPrefix?'preparation':owner.mainActionCompleted?'next-turn':'current-turn',planetId:candidate.planetId,endpointTarget:{...candidate.endpointTarget},endpointCost:{...cost}},ship,route,benefit.score+benefit.dataCount*.5+benefit.incomeCount*(4-state.turn.roundNumber),
        (cost.credits||0)+(cost.energy||0));
    }
    goals.sort((a,b)=>b.net-a.net||a.cost-b.cost||a.path.length-b.path.length||(a.goal.id<b.goal.id?-1:1));
    let chosen=null,deferredGoal=null;
    for(const candidate of goals){
      if(!candidate.path.length&&owner.mainActionCompleted&&!mandatoryPrefix){
        deferredGoal ||= {...candidate.goal,timing:'defer'};continue;
      }
      let executable=candidate;
      if(owner.mainActionCompleted&&!mandatoryPrefix&&['orbit','land'].includes(candidate.goal.kind)&&compareTiming){
        let timing=compareTiming(candidate.goal.id,candidate.path.map(step=>({...step,rocketId:candidate.rocketId})),free?allowance:0);
        if(timing.comparable){
          const feasible=timing.alternatives.filter(a=>!a.prefixLength||a.prefixMovementPoints<=allowance);
          const best=feasible.reduce((best,a)=>a.totalPaidPoints<best.totalPaidPoints?a:best);
          timing={...timing,availablePrefixPoints:allowance,bestPrefixLength:best.prefixLength,bestTotalPaidPoints:best.totalPaidPoints,
            classification:best.prefixLength?'advance-before-rotation':'defer'};
        }
        if(!timing.comparable||!timing.bestPrefixLength){
          deferredGoal ||= {...candidate.goal,timing:'defer',movementTiming:timing};continue;
        }
        const path=candidate.path.slice(0,timing.bestPrefixLength);
        executable={...candidate,path,goal:{...candidate.goal,targetCoordinate:candidate.goal.coordinate,coordinate:path[path.length-1].to,
          timing:'advance-before-rotation',movementTiming:timing}};
      }
      chosen=executable;break;
    }
    if(!chosen&&deferredGoal){
      if(objectiveOnly)return null;
      return {...result(null,free?stop:null,'defer-movement',routingNodes,goals.length),deferredGoal};
    }
    if(objectiveOnly)return chosen?{routingNodes,intent:{goal:chosen.goal,rocketId:chosen.rocketId,path:chosen.path,startedTurn:chosen.startedTurn,startedRound:chosen.startedRound,free:chosen.free,prefixOnly:chosen.prefixOnly===true}}:null;
    return result(chosen||null,chosen?.selected||(free?stop:null),chosen?'selected-objective':'no-affordable-objective',routingNodes,goals.length);
  }
  return Object.freeze({VERSION,isDirection:direction,movementAllowance:(head,state)=>cardPlay.getMovementAllowance(head,state),plan});
});
