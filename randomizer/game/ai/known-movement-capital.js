(function(root,factory){
 'use strict';const common=typeof module==='object'&&module.exports;
 const api=factory(common?require('../cards/effects'):root.SetiCardEffects,common?require('./probe-capital'):root.SetiProbeCapital,
  common?require('../abilities/rocket'):root.SetiAbilityRocket,common?require('../rockets'):root.SetiRocketActions,
  common?require('../../solar-system/core'):root.SetiSolarSystem,common?require('../players'):root.SetiPlayers,common?require('./value-arithmetic'):root.SetiValueArithmetic);
 if(common)module.exports=api;else root.SetiKnownMovementCapital=api;
})(typeof globalThis!=='undefined'?globalThis:window,function(effects,probe,rocket,pieces,solar,players,arithmetic){
 'use strict';
 // A typed resource/position quote. A quoted launch is not a game entity,
 // native action, successor envelope or observation and never reaches inputPort.
const zero=reason=>({value:0,selected:null,candidates:[],reason});
const models=new WeakMap();
function supported(card){
 if(!card?.cardId||card.hidden||!['basic','space-agency'].includes(card.set))return false;
 const m=effects.getCardModel(card);if(!m)return false;if(models.has(m))return models.get(m);
 const e=effects.buildPlayEffects(card),keys=(value,allowed)=>Object.keys(value||{}).every(k=>allowed.includes(k));
 const result=m.cardType===0&&!m.triggers?.length&&!m.tasks?.length&&!m.temporaryTasks?.length&&!m.endGameScoring&&e.length===3
  &&e[0].type==='gain_data'&&e[0].options.count===1&&keys(e[0].options,['count','repeat'])
  &&e[1].type==='card_move'&&e[1].options.movementPoints===1&&keys(e[1].options,['movementPoints','repeat'])
  &&e[2].type==='card_return_played_card_to_hand_if'&&e[2].options.condition?.type==='probeAdjacentEarth'
  &&keys(e[2].options,['condition','repeat'])&&keys(e[2].options.condition,['type'])&&e.every(x=>(x.options.repeat??1)===1);
 if(Object.isFrozen(m)&&(m.playEffects||[]).every(x=>Object.isFrozen(x)&&Object.isFrozen(x.options)))models.set(m,result);return result;
}
function routes(facts,ship){
 const found=probe.requirements(facts).filter(g=>g.requirementId.startsWith(ship.id+':'));
 return found.map(goal=>{let at=pieces.getRocketSectorCoordinate(ship);const path=goal.route.path.map(step=>{const move=pieces.canMoveFromCoordinate({rockets:facts.board.rockets},at,step.deltaX,step.deltaY,ship.id);if(!move.ok)throw Error('TOOL_REQUIREMENT_ROUTE_STALE');const entry={from:at,to:move.to,...step};at=move.to;return entry;});return{goalId:goal.requirementId,path,endpointCost:goal.endpointFacts.cost};});
}
function quote(facts,weights,portfolio){
 if(facts.terminal||facts.passing||facts.round>=4||facts.analyzeEnergyCost!==0||facts.player.availableData>=players.RESOURCE_LIMITS.availableData||!facts.computerSlots||facts.computerSlots.length!==4||[1,2,3,4].some(x=>!facts.computerSlots.includes(x)))return zero('outside-audited-analysis-tool-window');
 if(!facts.blueSlots?.some(b=>b.slot<=2&&['blue1','blue2','blue4'].includes(b.tileId)&&facts.player.techState.ownedTiles[b.tileId]&&!facts.player.techState.disabledTiles[b.tileId]))return zero('no-existing-currency-blue');
 if(facts.companyState?.abilityId!=='deepspace_swap_cards')return zero('company-not-audited');
 const cards=facts.hand.filter(supported);if(!cards.length)return zero('no-supported-known-tool');
 if(facts.board.aliens.slots.some(s=>s.revealed)||facts.reservedCards.some(c=>{const m=effects.getCardModel(c);return!m||m.triggers?.length||m.temporaryTasks?.length||m.endGameScoring;}))return zero('complex-public-effects');
 const ownedCount=probe.ownedProbes(facts.board.rockets,facts.player).length;
 if(ownedCount>1||facts.board.rockets.filter(r=>r.playerId===facts.player.id&&pieces.isControllablePlayerRocket(r)).length!==ownedCount)return zero('multiple-or-nonstandard-probes-not-audited');
 const period={...facts,player:{...facts.player,handSize:facts.hand.length+facts.extraUnknownCount},hand:facts.hand.slice()};
 const initial={...period.player},baseline=portfolio(period),candidates=[];let portfolioQueries=0;
 for(const card of cards){const owned=probe.ownedProbes(period.board.rockets,period.player);let start=period,launchPayment=null;
  if(!owned.length){const cost=rocket.DEFAULT_LAUNCH_COST;if(Object.keys(cost).length!==1||!Number.isSafeInteger(cost.credits))throw Error('TOOL_LAUNCH_COST_CHANGED');if(period.player.credits<cost.credits)continue;launchPayment={spend:{credits:cost.credits,energy:0},value:cost.credits*weights.credits};const earth=solar.collectPlanetLocations(period.board.solarSystem).find(x=>x.planetId==='earth');if(!earth)throw Error('TOOL_EARTH_MISSING');const slot=pieces.findAvailableSlotIndex({rockets:period.board.rockets},earth.x,earth.y);if(slot==null)continue;const ship={id:-1,playerId:period.player.id,color:period.player.color,kind:'standard',surface:'solar-board',sectorX:earth.x,sectorY:earth.y,slotIndex:slot};start={...period,player:{...period.player,credits:period.player.credits-launchPayment.spend.credits,energy:period.player.energy-launchPayment.spend.energy},board:{...period.board,rockets:[...period.board.rockets,ship]}};}
  const ship=probe.ownedProbes(start.board.rockets,start.player)[0],seen=new Set();
  for(const target of routes(start,ship)){let current=start,returned=true,path=[];for(const step of target.path){if(!returned||step.requiredMovePoints!==1||current.player.availableData>=players.RESOURCE_LIMITS.availableData)break;const key=JSON.stringify([ship.id,...path.map(s=>[s.deltaX,s.deltaY]),step.deltaX,step.deltaY]);path=[...path,step];if(path.length>2)throw Error('TOOL_RETURN_PROGRESS_BOUND_BROKEN');
    const cost=effects.getCardPlayCost(card);if(Object.keys(cost).some(k=>k!=='credits')||!Number.isSafeInteger(cost.credits)||cost.credits<0)continue;if(current.player.credits<cost.credits)break;const payment={spend:{credits:cost.credits,energy:0},value:cost.credits*weights.credits};const wallet={...current.player,credits:current.player.credits-payment.spend.credits,energy:current.player.energy-payment.spend.energy,handSize:current.player.handSize-1};players.gainResources({resources:wallet},{availableData:1});
    const destinationSlot=pieces.findAvailableSlotIndex({rockets:current.board.rockets},step.to.x,step.to.y,ship.id);if(destinationSlot==null)break;
    const rockets=current.board.rockets.map(r=>r.id===ship.id?{...r,sectorX:step.to.x,sectorY:step.to.y,slotIndex:destinationSlot}:r);const actor={id:wallet.id,color:wallet.color,resources:wallet,techState:wallet.techState},context={solarSystem:current.board.solarSystem,pieces:{rockets},turn:{roundNumber:current.round}};const content=solar.resolveVisibleContent(step.to.x,step.to.y,current.board.solarSystem).content;if(content.kind==='comet'||content.kind==='planet'&&content.planetId!=='earth'||content.kind==='asteroid'&&players.playerOwnsTech(actor,'orange2',context))players.gainResources({resources:wallet},{publicity:1});
    const locations=pieces.buildProbeLocationData(context);returned=effects.taskConditionMet({condition:{type:'probeAdjacentEarth'}},actor,{probeLocationDetails:locations.details});let hand=current.hand.filter(c=>c.id!==card.id);if(returned){hand.push(card);wallet.handSize++;}current={...current,player:wallet,hand,board:{...current.board,rockets}};
    if(seen.has(key))continue;seen.add(key);const linear=Object.entries(weights).reduce((n,[k,w])=>n+(wallet[k]-initial[k])*w,0),afterCapital=portfolio(current),netGain=arithmetic.sum([linear,afterCapital,-baseline],weights);portfolioQueries++;candidates.push({cardId:card.id,cardIdentity:card.cardId,preparationDebt:path.length+Number(Boolean(launchPayment)),geometryAssumption:'unchanged-board-between-own-tool-turns',prospectiveLaunch:!!launchPayment,launchPayment,goalId:target.goalId,rocketId:ship.id<0?null:ship.id,path,uses:path.length,returned,payment,linear,baseline,afterCapital,netGain,endpoint:{resources:wallet,handIds:hand.map(c=>c.id),probeCoordinate:step.to}});
   }
  }
 }
 candidates.sort((a,b)=>b.netGain-a.netGain||a.uses-b.uses||a.goalId.localeCompare(b.goalId));return{value:Math.max(0,candidates[0]?.netGain||0),selected:candidates[0]||null,candidates,portfolioQueries,scope:'Typed purpose quote: one known1data/1move/adjacentEarth-return card, cheapest named mission prefixes, one owned or quoted standard launch and current known wallet only; no future income, max two progress plays before return fails. No native action execution, new entity allocation, fake RuleObservation or successor game node; forecast, never pruning bound.'};
}
return Object.freeze({supported,quote});
});
