(function(root,factory){
 'use strict';const common=typeof module==='object'&&module.exports;
 const api=factory(common?require('../final-scoring'):root.SetiFinalScoring,common?require('../end-game-scoring'):root.SetiEndGameScoring,
  common?require('../cards/deck'):root.SetiCards,common?require('../cards/effects'):root.SetiCardEffects,
  common?require('../data'):root.SetiData,common?require('../players'):root.SetiPlayers,
  common?require('../actions/scan-effects'):root.SetiScanEffects,common?require('../effects/science-session'):root.SetiScienceSession,common?require('./resource-demand'):root.SetiResourceDemand,common?require('../effects/residual-domain-session'):root.SetiResidualDomainSession,common?require('./state-value'):root.SetiStateValue,common?require('./income-card-order'):root.SetiIncomeCardOrder,common?require('../tech/resolver'):root.SetiTechResolver,common?require('../tech/catalog'):root.SetiTechCatalog,common?require('../data/placement'):root.SetiDataPlacement,common?require('../aliens'):root.SetiAliens,common?require('../industry/catalog'):root.SetiIndustryCatalog,common?require('../abilities'):root.SetiAbilities,common?require('../turn-flow'):root.SetiTurnFlow,common?require('./probe-capital'):root.SetiProbeCapital,
  common?require("../state/state-store").copyForkData:root.SetiStateStore.copyForkData);
 if(common)module.exports=api;else root.SetiLocalDecisionPlans=api;
})(typeof globalThis!=='undefined'?globalThis:window,function(finalScoring,endScoring,cards,effects,data,players,scanEffects,science,demand,residual,stateValue,incomeOrder,tech,catalog,placement,aliens,industry,abilities,turnFlow,probeCapital,copyForkData){
 'use strict';
 const VERSION='seti-local-mark-and-scan-purpose-v12';
 const owner=(s,id)=>s.players.players.find(p=>p.id===id);
 const tie=(a,b)=>a.actionId<b.actionId?-1:a.actionId>b.actionId?1:0;
 function readyIncomePlayer(p){
  const placed=data.listComputerPlacedTokens(p).length;
  if(placed>=4||p.resources.availableData<4-placed)return p;
  const income=p.hand.filter(c=>cards.getIncomeGainForCard(c)).sort((a,b)=>{
   const v=c=>Object.entries(cards.getIncomeGainForCard(c)).reduce((n,[k,x])=>n+x*({credits:1,energy:1,handSize:1,publicity:.5,availableData:.5}[k]||0),0);
   return v(b)-v(a)||incomeOrder.compare(a,b);
  })[0];
  if(!income)return p;const copy={...p,income:{...p.income}};
  for(const [k,v] of Object.entries(cards.getIncomeGainForCard(income)))copy.income[k]=(copy.income[k]||0)+v;
  return copy;
 }
 function finalMark({state,seatId,actions}){
  if(!actions.length||!actions.every(a=>a.family==='choose_target'&&a.target?.choiceId?.startsWith('final:')))return null;
  const p=owner(state,seatId),projected=readyIncomePlayer(p),board=structuredClone(state.finalScoring);
  const context={...state,aliens:structuredClone(state.aliens)},helpers={getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)};
  const total=(player,finalBoard)=>endScoring.computePlayerFinalScore({...context,players:state.players.players,currentPlayer:player,finalScoring:finalBoard,cardEffects:effects,getCardTypeCode:helpers.getCardTypeCode},player).totalScore;
  const currentBefore=total(p,structuredClone(board)),forecastBefore=total(projected,structuredClone(board));
  const scores=actions.map(a=>{
   const preview=structuredClone(board),sequenceRoot={meta:{...state.meta,sequences:{...state.meta.sequences}}};
   const marked=finalScoring.markTile(preview,a.target.tileId,p,{root:sequenceRoot});if(!marked.ok)throw new Error('FINAL_MARK_QUERY_NOT_LEGAL');
   const formulaId=endScoring.getFormulaId(a.target.tileId,board.tileVariants[a.target.tileId]);
   const current=total(p,preview)-currentBefore,forecast=total(projected,preview)-forecastBefore;
   if(!Number.isFinite(current)||!Number.isFinite(forecast))throw new Error('FINAL_MARK_LOCAL_VALUE_INVALID');
   return{actionId:a.actionId,tileId:a.target.tileId,formulaId,slot:marked.mark.slotIndex,currentValue:current,readyIncomeValue:forecast,score:forecast};
  }).sort((a,b)=>b.score-a.score||b.currentValue-a.currentValue||tie(a,b));
  return{policy:VERSION,kind:'fixed-final-mark',isEquivalence:false,selectedActionId:scores[0].actionId,retainedActionIds:[scores[0].actionId],excludedActionIds:scores.slice(1).map(s=>s.actionId),scores,assumption:'native current facts plus an immediately fundable fourth-slot income card; no unknown future growth'};
 }
 function fixedChoice(actions,selected,kind,evidence){
  return{policy:'seti-greedy-plan-choices-v1',kind,fixed:true,isEquivalence:false,selectedActionId:selected.actionId,
   retainedActionIds:[selected.actionId],excludedActionIds:actions.filter(a=>a!==selected).map(a=>a.actionId),...evidence};
 }
 function passDiscard({state,seatId,actions,goal={}}){
  if(!actions.length||!actions.every(a=>a.family==='choose_card'&&a.target?.kind==='pass-hand-limit'))return null;
  const p=owner(state,seatId),cardValues=p.hand.map(card=>{
   const gain=cards.getIncomeGainForCard(card)||{},income=Object.entries(gain).reduce((n,[k,v])=>n+v*({credits:1,energy:1,publicity:.5,availableData:.5,handSize:1}[k]||0),0)*Math.max(0,4-state.turn.roundNumber);
   const corner=cards.getDiscardActionRewardForCard(card),move=cards.getDiscardActionMoveRewardForCard(card);
   return{id:card.id,value:(effects.getCardPrice(card)||0)+income+(corner?.dataCount||0)*.5+(move?.movementPoints||0)*.5,protected:card.id===goal.cardId||card.id===goal.incomeCardId};
  });
  const ranks=actions.map(action=>({action,cards:action.target.cardIds,value:action.target.cardIds.reduce((n,id)=>n+(cardValues.find(c=>c.id===id)?.value||0),0),protected:action.target.cardIds.some(id=>cardValues.find(c=>c.id===id)?.protected)}))
   .sort((a,b)=>Number(a.protected)-Number(b.protected)||a.value-b.value||tie(a.action,b.action));
  return fixedChoice(actions,ranks[0].action,'fixed-pass-discard',{reason:'greedy-pass-hand-limit',cardValues,discardIds:ranks[0].cards,assumption:'known card cost, income and corner utility; protect explicit beneficiary cards'});
 }
 function blueResearch({state,seatId,actions}){
  if(!actions.length||!actions.every(a=>a.family==='choose_target'&&a.target?.tileId&&'blueSlot' in a.target))return null;
  const retained=demand.greedyTechPlans({state,seatId,plans:actions.map(action=>({...action.target,action}))}).map(p=>p.action);
  if(retained.length===actions.length)return null;
  return{policy:'seti-greedy-blue-placement-v1',kind:'greedy-blue-slots',isEquivalence:false,fixed:retained.length===1,
   ...(retained.length===1?{selectedActionId:retained[0].actionId}:{}),retainedActionIds:retained.map(a=>a.actionId),excludedActionIds:actions.filter(a=>!retained.includes(a)).map(a=>a.actionId),reason:'one-board-slot-per-tech-type',
   assumption:'prefer an already covered computer column, otherwise nearest known computer progress; keep every tech type'};
 }
 function sectorPublicityReward(card){
  const model=card&&effects.getCardModel(card),task=model?.tasks?.length===1&&model.tasks[0];
  if(!task||task.condition?.type!=='completedSectors'||model.triggers?.length
    ||model.temporaryTasks?.length||task.rewards.length!==1)return null;
  const reward=task.rewards[0],gain=reward.options?.gain;
  if(reward.type!=='gain_resources'||(reward.options.repeat??1)!==1||!gain||Object.keys(gain).length!==1
    ||!Number.isSafeInteger(gain.publicity)||gain.publicity<=0)return null;
  return {task,gain,model};
 }
 // This task grants only publicity, possibly capped. Keep the native
 // completed-count and reservation/removal effects in both audited cases.
 function previewCappedSectorClaim({state,seatId,task,allowPublicityGain=false}){
  const p=owner(state,seatId),card=p.reservedCards.find(c=>c.id===task.cardId),entry=sectorPublicityReward(card);
  if(entry?.task.id!==task.taskId||entry.model.cardType!==2||entry.model.endGameScoring
    ||!allowPublicityGain&&p.resources.publicity!==players.RESOURCE_LIMITS.publicity)return null;
  const publicity=Math.min(players.RESOURCE_LIMITS.publicity,p.resources.publicity+entry.gain.publicity);
  const copy={...p,resources:{...p.resources},reservedCards:structuredClone(p.reservedCards)};
  const next={...state,players:{...state.players,players:state.players.players.map(q=>q===p?copy:q)},
    cards:{...state.cards,removedFromGameCardIds:[...state.cards.removedFromGameCardIds]}};
  const settled=residual.settleReadyTaskDirect(next,seatId,card.id,task.taskId);
  if(!settled.ok||settled.irreversible||settled.spawnedEffects?.length
    ||copy.completedTaskCount!==(p.completedTaskCount||0)+1
    ||Object.keys(p.resources).some(k=>(k==='publicity'?publicity:p.resources[k])!==copy.resources[k]))return null;
  return next;
 }
 function deferredSectorPublicityQuote({state,seatId,knownCards}){
  const p=owner(state,seatId),turn=state.turn;
  if(turn.roundNumber!==3||turn.gameEnded||turn.currentPlayerId!==seatId||p.mainActionCompleted||p.passCompletionPending
    ||turn.passedPlayerIds.includes(seatId)||!turn.activePlayerIds?.length
    ||!turn.activePlayerIds.every(id=>id===seatId||turn.passedPlayerIds.includes(id)))return null;
  const publicity=p.resources.publicity,limit=players.RESOURCE_LIMITS.publicity,cost=tech.getResearchPublicityCost(p);
  if(publicity<cost||publicity-cost>=cost)return null;
  const ready=p.reservedCards.flatMap(card=>{
    if(!knownCards.has(card.id))return [];
    const entry=sectorPublicityReward(card);
    if(!entry||entry.model.cardType!==2||entry.model.endGameScoring)return [];
    const gain=entry.gain.publicity,task=entry.task;
    if(publicity+gain<=limit||publicity-cost+gain>limit||publicity-cost+gain<cost
      ||!effects.taskConditionMet(task,p,{data:state.data}))return [];
    if(!residual.queryCardSettlement(state,seatId,{kind:'task',cardInstanceId:card.id,ruleId:task.id}))return [];
    return [{cardId:card.id,taskId:task.id,publicity,afterFirst:publicity-cost,afterClaim:publicity-cost+gain,researchCost:cost,gain}];
  });
  if(ready.length!==1||tech.listTakeableTiles(state.tech,p.techState).length<2)return null;
  // Already earned, still held, and fully usable after paying for one known
  // research. Only price the publicity itself, without any tile reward.
  return {...ready[0],value:ready[0].gain*stateValue.DEFAULT_WEIGHTS.publicity};
 }
 function researchDataPurpose({state,seatId,knownCards}){
  const p=owner(state,seatId),turn=state.turn;
  if(p.hand.length!==1||!knownCards.has(p.hand[0].id)||turn.cardTurnEventBonuses?.length
    ||state.pieces.rockets.some(r=>r.playerId===seatId)
    ||Object.values(state.aliens.aliens).some(s=>s.revealed&&s.alienId==='符文族')
    ||state.finalScoring.thresholds.some(n=>!Object.values(state.finalScoring.tiles).some(t=>t.marks.some(m=>m.playerId===seatId&&m.threshold===n)))
    ||p.reservedCards.some(c=>{const m=effects.getCardModel(c);return !m||m.triggers?.length||m.temporaryTasks?.length;}))return null;
  const occupied=data.listComputerPlacedTokens(p).map(t=>t.placementSlot);
  if(occupied.length!==4||![1,2,3,4].every(s=>occupied.includes(s)))return null;
  const corner=cards.getDiscardActionRewardForCard(p.hand[0]);
  if(!corner?.gain?.publicity||corner.dataCount||Object.keys(corner.gain).some(k=>k!=='publicity'))return null;
  const ready=deferredSectorPublicityQuote({state,seatId,knownCards});if(!ready)return null;
  const targets=tech.listTakeableTiles(state.tech,p.techState);
  const production=targets.filter(id=>science.getResearchDataCount(id)>0);
  const funding=targets.filter(id=>placement.getBlueTileDataBonus(id)?.type==='publicity');
  if(production.length!==1||funding.length!==1||production[0]===funding[0])return null;
  return {pair:[production[0],funding[0]],bonusIds:Object.fromEntries([...production,...funding].map(id=>[id,state.tech.stacks[id].bonusId])),
   techState:p.techState,cornerCardId:p.hand[0].id,cornerPublicity:corner.gain.publicity,ready,
   taskCardId:p.reservedCards.find(c=>c.id===ready.cardId).cardId,completedTasks:p.completedTaskCount||0};
 }
 function quoteResearchDataPurpose({state,seatId,purpose}){
  const p=owner(state,seatId),turn=state.turn;
  if(turn.currentPlayerId!==seatId||p.passCompletionPending||turn.passedPlayerIds.includes(seatId)
    ||p.hand.length!==1||p.hand[0].id!==purpose.cornerCardId||turn.cardTurnEventBonuses?.length
    ||p.resources.publicity<purpose.ready.researchCost
    ||p.completedTaskCount!==purpose.completedTasks+1||p.reservedCards.some(c=>c.id===purpose.ready.cardId)
    ||!state.cards.removedFromGameCardIds.includes(purpose.taskCardId))return null;
  const first=Object.keys(p.techState.ownedTiles).filter(id=>!purpose.techState.ownedTiles[id]);
  if(first.length!==1||!purpose.pair.includes(first[0]))return null;
  const second=purpose.pair.find(id=>id!==first[0]),[producer,blue]=purpose.pair,stack=state.tech.stacks[second];
  if(!tech.listTakeableTiles(state.tech,p.techState).includes(second)||stack.bonusId!==purpose.bonusIds[second])return null;
  const bonus=catalog.BONUS_EFFECTS[stack.bonusId];
  if(!bonus||Object.keys(bonus).some(k=>!['score','energy','publicity'].includes(k)))return null;
  const progress=data.listComputerPlacedTokens(p).map(t=>t.placementSlot);
  if(progress.length!==4||![1,2,3,4].every(s=>progress.includes(s)))return null;
  const free=tech.getAvailableBlueSlots(p.techState);
  const blueSlot=p.techState.blueBoardSlots[blue]??free[0],through=data.getRequiredComputerSlotForBlueBonus(blueSlot);
  if(through!==5||data.listBlueBonusPlacedTokens(p).some(t=>t.blueSlot===blueSlot))return null;
  const dataGain=second===producer?science.getResearchDataCount(second):0,copy=dataPreviewPlayer(p),cost=purpose.ready.researchCost;
  if(copy.resources.availableData+dataGain>players.RESOURCE_LIMITS.availableData||copy.resources.availableData+dataGain<2)return null;
  const techState=copy.techState={...p.techState,ownedTiles:{...p.techState.ownedTiles,[second]:true},
   blueBoardSlots:{...p.techState.blueBoardSlots,...(second===blue?{[second]:blueSlot}:{})}};
  const localRoot={meta:structuredClone(state.meta)};
  if(!players.spendResources(copy,{publicity:cost}).ok)return null;
  if(stack.firstTakeClaimedBy==null)players.gainResources(copy,{score:catalog.FIRST_TAKE_TYPE_SCORE});
  players.gainResources(copy,bonus);
  for(let i=0;i<dataGain;i++)if(!data.gainData(copy,{source:second,root:localRoot}).ok)return null;
  for(const place of [{},{target:data.PLACEMENT_KIND_BLUE_BONUS,blueSlot}]){
   const result=data.placeDataToComputer(copy,place);if(!result.ok)return null;
   for(const gain of result.slotBonuses){
    if(!['score','publicity'].includes(gain.type))return null;
    players.gainResources(copy,{[gain.type]:gain[gain.type]});
   }
  }
  if(copy.resources.publicity>=cost||copy.resources.publicity+purpose.cornerPublicity<cost)return null;
  const board={...state.tech,stacks:{...state.tech.stacks,[second]:{...stack,remaining:0,depleted:true,bonusId:null}}};
  if(!tech.listTakeableTiles(board,techState).some(id=>{
   const gain=catalog.BONUS_EFFECTS[board.stacks[id].bonusId];return gain&&!gain.cardSelection;
  }))return null;
  // The next two payments and data placements are a fixed purpose. Compare
  // with the whole existing portfolio, then carry only the now-funded
  // analysis/held-publicity preparation value; do not also carry the old data.
  const after={...state,tech:board,players:{...state.players,players:state.players.players.map(v=>v.id===seatId?copy:v)}};
  const score=(s,q)=>endScoring.computePlayerFinalScore({...s,players:s.players.players,aliens:structuredClone(s.aliens),
   finalScoring:structuredClone(s.finalScoring),cardEffects:effects,getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)},q).totalScore;
  const weights=stateValue.DEFAULT_WEIGHTS;
  const linear=Object.entries(weights).reduce((n,[k,w])=>n+(copy.resources[k]-p.resources[k])*w,0);
  const analysis=demand.planningAnalysisCapital(after,copy),baseline=demand.planningCapital(state,p);
  const value=stateValue.sumValueParts([score(after,copy),-score(state,p),linear,
   stateValue.technologyCapital(techState,3),-stateValue.technologyCapital(p.techState,3),analysis,-baseline]);
  return value>0?{value,first:first[0],second,blueSlot,cornerCardId:purpose.cornerCardId,publicityAfterPlacement:copy.resources.publicity,
   dataAfterPlacement:copy.resources.availableData,analysis,baseline}:null;
 }
 // One typed same-round purpose: a known scored data corner fills computer
 // 2, its publicity and a held corner pay the visible data-producing tech,
 // and its two data buy a known permanent income. No other main is assumed.
 function deferredComputerIncomeSource({state,seatId,knownCards}){
  const p=owner(state,seatId),turn=state.turn;
  if(turn.roundNumber!==3||turn.currentPlayerId!==seatId||turn.gameEnded||p.passCompletionPending
    ||!turn.activePlayerIds?.includes(seatId)||turn.activePlayerIds.some(id=>id!==seatId&&!turn.passedPlayerIds.includes(id))
    ||turn.passedPlayerIds.includes(seatId)||turn.cardTurnEventBonuses?.length||p.industryBorrowedTechTileId
    ||state.pieces.rockets.some(r=>r.playerId===seatId||r.color===p.color)
    ||Object.values(state.aliens.aliens).some(x=>x.revealed&&x.alienId!=='阿米巴')
    ||[...p.hand,...p.reservedCards].some(c=>!knownCards.has(c.id))
    ||p.hand.length<3||p.hand.length>5||p.resources.availableData>1)return null;
  const n=data.listComputerPlacedTokens(p).map(t=>t.placementSlot);
  if(n.length>1||n.some(s=>s!==1)||n.length+p.resources.availableData<1)return null;
  if(p.reservedCards.some(c=>{const m=effects.getCardModel(c);return !m||m.temporaryTasks?.length
    ||m.triggers?.some(t=>!(t.event.types||[t.event.type]).every(type=>type==='alienTrace'));}))return null;
  const dataCorners=p.hand.filter(c=>{
    const r=cards.getDiscardActionRewardForCard(c);
    return r?.dataCount===1&&r.gain?.score===1&&Object.keys(r.gain).length===1;
  });
  if(dataCorners.length!==1)return null;
  const publicity=c=>{const r=cards.getDiscardActionRewardForCard(c);return r&&!r.dataCount&&Object.keys(r.gain).length===1?r.gain.publicity||0:0;};
  const cost=tech.getResearchPublicityCost(p),computerGain=placement.getComputerSlotBonus(2).publicity;
  if(p.resources.publicity+computerGain>=cost)return null;
  const suppliers=p.hand.filter(c=>publicity(c)>0&&p.resources.publicity+computerGain+publicity(c)>=cost);
  if(!suppliers.length)return null;
  // With equal printed publicity, spend a card whose main cannot be paid
  // on the source wallet before spending a card already ready to play.
  const payable=c=>Object.entries(effects.getCardPlayCost(c)).every(([k,v])=>p.resources[k]>=v);
  suppliers.sort((a,b)=>Number(payable(a))-Number(payable(b))||publicity(a)-publicity(b)||a.id.localeCompare(b.id));
  const supplier=suppliers[0],producers=tech.listTakeableTiles(state.tech,p.techState).filter(id=>science.getResearchDataCount(id)===2);
  if(producers.length!==1||catalog.getTechType(producers[0])==='blue')return null;
  const tileId=producers[0],stack=state.tech.stacks[tileId],bonus=catalog.BONUS_EFFECTS[stack.bonusId];
  if(!bonus||Object.keys(bonus).some(k=>!['credits','energy','publicity','score'].includes(k)))return null;
  return{tileId,bonusId:stack.bonusId,cornerCardId:dataCorners[0].id,publicityCardId:supplier.id,publicityGain:publicity(supplier),cost};
 }
 function quoteDeferredComputerIncome({state,seatId,knownCards,source}){
  const same=deferredComputerIncomeSource({state,seatId,knownCards}),p=owner(state,seatId);
  if(!same||Object.keys(source).some(k=>source[k]!==same[k])
    ||p.resources.availableData!==0||data.listComputerPlacedTokens(p).length!==1)return null;
  const copy=dataPreviewPlayer(p),stack=state.tech.stacks[source.tileId],bonus=catalog.BONUS_EFFECTS[source.bonusId];
  const replace=(s,player)=>({...s,players:{...s.players,players:s.players.players.map(v=>v.id===seatId?player:v)}});
  const root={meta:structuredClone(state.meta)};
  const consume=(id,gain)=>{copy.hand=copy.hand.filter(c=>c.id!==id);copy.resources.handSize=copy.hand.length;players.gainResources(copy,gain);};
  consume(source.cornerCardId,{score:1});
  if(!data.gainData(copy,{root}).ok)return null;
  const second=data.placeDataToComputer(copy);if(!second.ok||second.placementSlot!==2)return null;
  for(const reward of second.slotBonuses){
    if(!['publicity','score'].includes(reward.type))return null;
    players.gainResources(copy,{[reward.type]:reward[reward.type]});
  }
  consume(source.publicityCardId,{publicity:source.publicityGain});
  if(!players.spendResources(copy,{publicity:source.cost}).ok)return null;
  copy.techState={...copy.techState,ownedTiles:{...copy.techState.ownedTiles,[source.tileId]:true}};
  if(stack.firstTakeClaimedBy==null)players.gainResources(copy,{score:catalog.FIRST_TAKE_TYPE_SCORE});
  players.gainResources(copy,bonus);
  for(let i=0;i<2;i++)if(!data.gainData(copy,{source:source.tileId,root}).ok)return null;
  const board={...state.tech,stacks:{...state.tech.stacks,[source.tileId]:{...stack,bonusId:null,bonusHidden:true,bonusQueue:[],bonusIndex:stack.bonusIndex+1,
    remaining:stack.remaining-1,firstTakeClaimedBy:stack.firstTakeClaimedBy??seatId,depleted:stack.remaining===1}}};
  // Use the same public orbit operation; if rotation has any arrival reward
  // requiring settlement, keep the existing value instead of quoting it.
  const research={...replace({...state,tech:board},copy),solarSystem:structuredClone(state.solarSystem),pieces:structuredClone(state.pieces),
    players:{...state.players,players:state.players.players.map(q=>q.id===seatId?copy:structuredClone(q))}};
  const rotation=tech.rotateForResearch(science.createActionContext(research,seatId));
  if(!rotation.ok||rotation.events.length)return null;
  // One income target, chosen with the same native menu and greedy rank.
  const menu=science.formalizeChoices(research,seatId,science.listIncomeChoices(research,seatId));
  const selected=demand.incomeChoice({state:research,seatId,goal:{required:{}},actions:menu});
  const incomeCardId=menu.find(a=>a.actionId===selected?.actionId)?.target.cardInstanceId;
  const gain=cards.getIncomeGainForCard(copy.hand.find(c=>c.id===incomeCardId));
  if(!gain||Object.keys(gain).length!==1||!['credits','energy'].some(k=>gain[k]===1))return null;
  const placed=demand.previewIncomeTail({state:research,seatId,goal:{incomeCardId}});if(!placed.available||placed.placements!==2)return null;
  const next=placed.player,after=replace(research,next);
  if(finalScoring.getPendingMarksForPlayer(structuredClone(after.finalScoring),next).length)return null;
  const score=(s,player)=>endScoring.computePlayerFinalScore({...s,players:s.players.players,aliens:structuredClone(s.aliens),
    finalScoring:structuredClone(s.finalScoring),cardEffects:effects,getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)},player).totalScore;
  const weights=stateValue.DEFAULT_WEIGHTS;
  const linear=Object.entries(weights).reduce((n,[k,w])=>n+(next.resources[k]-p.resources[k]+next.income[k]-p.income[k])*w,0);
  const baseline=demand.planningCapital(state,p),afterCapital=demand.planningCapital(after,next);
  const value=stateValue.sumValueParts([score(after,next),-score(state,p),linear,stateValue.technologyCapital(next.techState,3),
    -stateValue.technologyCapital(p.techState,3),afterCapital,-baseline]);
  // This is an alternative purpose forecast, never a successor or a bound.
  return value>0?{...source,incomeCardId,gain,wallet:next.resources,value,baseline,afterCapital}:null;
 }
 // Quote only a concrete two-mark win from a known research -> data ->
 // existing currency-slot sequence. This never expands another turn or
 // supplies a successor. The current-turn search still compares every goal.
 function researchScanPurpose({state,seatId,knownCards}){
  const p=owner(state,seatId),turn=state.turn,cost=scanEffects.getStandardScanCost(p);
  const slots=data.listComputerPlacedTokens(p).map(t=>t.placementSlot);
  const producer=tech.listTakeableTiles(state.tech,p.techState).filter(id=>science.getResearchDataCount(id)>0);
  const solo=turn.activePlayerIds?.includes(seatId)&&turn.activePlayerIds.every(id=>id===seatId||turn.passedPlayerIds.includes(id));
  const incomeNeeded=slots.length===3&&p.resources.credits===cost.credits-1;
  const incomePaid=slots.length===4&&p.resources.credits===cost.credits;
  if(turn.roundNumber!==3||!solo||p.mainActionCompleted||p.passCompletionPending||turn.currentPlayerId!==seatId
    ||turn.cardTurnEventBonuses?.length||state.pieces.rockets.some(r=>r.playerId===seatId||r.color===p.color)
    ||!(incomeNeeded||incomePaid)||slots.some((slot,i)=>slot!==i+1)||p.resources.availableData!==0
    ||Object.keys(cost).length!==2||p.resources.energy!==cost.energy-1
    ||p.hand.length<(incomeNeeded?3:2)||p.hand.length>(incomeNeeded?4:2)||!p.hand.every(c=>knownCards.has(c.id))||p.resources.publicity<tech.getResearchPublicityCost(p)
    ||producer.length!==1||Object.values(state.aliens.aliens).filter(s=>s.revealed).some(s=>s.alienId!=='阿米巴')
    ||!state.aliens.amiba?.revealInitialized||Object.keys(state.aliens.chong?.transportTasksByRocketId||{}).length)return null;
  const cashSources=p.hand.filter(c=>{
   const gain=cards.getIncomeGainForCard(c);return gain?.credits===1&&Object.keys(gain).length===1;
  }).map(c=>c.id);
  if(incomeNeeded&&!cashSources.length)return null;
  return {tileId:producer[0],cost,hand:p.hand.map(c=>c.id),owned:p.techState.ownedTiles,knownCards,
   incomeNeeded,cashSources,income:p.income};
 }
 function quoteResearchScanPurpose({state,seatId,purpose}){
  const p=owner(state,seatId),{tileId,cost,hand,owned,knownCards,incomeNeeded,cashSources,income}=purpose;
  const handNow=p.hand.map(c=>c.id),used=hand.filter(id=>!handNow.includes(id));
  const occupied=new Set(data.listComputerPlacedTokens(p).map(t=>t.placementSlot)),filled=new Set(data.listBlueBonusPlacedTokens(p).map(t=>t.blueSlot));
  const blueSlots=Object.keys(data.BLUE_BONUS_DATA_SLOTS).map(Number).filter(slot=>occupied.has(data.getRequiredComputerSlotForBlueBonus(slot))
    &&data.hasBlueTechInBoardSlot(p,slot)&&data.getBlueBonusPlacementReward(p,slot)?.type==='energy');
  const expectedData=science.getResearchDataCount(tileId)-(incomeNeeded?2:0),expectedEnergy=cost.energy-(incomeNeeded?0:1);
  if(!p.techState.ownedTiles[tileId]||Object.keys(p.techState.ownedTiles).some(id=>id!==tileId&&p.techState.ownedTiles[id]!==owned[id])
    ||p.resources.credits!==cost.credits||p.resources.energy!==expectedEnergy||p.resources.availableData!==expectedData
    ||used.length!==Number(incomeNeeded)||!handNow.every(id=>hand.includes(id))||!p.dataState
    ||incomeNeeded&&(!cashSources.includes(used[0])||!occupied.has(4)||p.income.credits!==income.credits+1)
    ||turnHasScanObservers(state,p)||state.pieces.rockets.some(r=>r.playerId===seatId||r.color===p.color))return null;
  const blueSlot=blueSlots.find(slot=>filled.has(slot)===incomeNeeded);
  if(!blueSlot)return null;
  const paid=dataPreviewPlayer(p);
  if(!incomeNeeded){
   const blue=data.placeDataToComputer(paid,{target:data.PLACEMENT_KIND_BLUE_BONUS,blueSlot});
   if(!blue.ok||blue.slotBonuses.length!==1||blue.slotBonuses[0].type!=='energy'||blue.slotBonuses[0].energy!==1)return null;
   players.gainResources(paid,{energy:1});
  }
  if(!players.spendResources(paid,cost).ok)return null;
  return quoteKnownSector({state,seatId,p,paid,knownCards,details:{tileId,blueSlot,keptCardIds:handNow,...(incomeNeeded?{incomeCardId:used[0]}:{})}});
 }
 // A proved followup is an alternative, valued from the same wallet as the
 // scan. It never materializes a successor or treats a refill as known.
 function previewKnownPaidSector({state,seatId,paid,knownCards}){
  const first=scanEffects.buildScanEffectQueue(paid,{turn:state.turn})[0],source=science.getPlanetScanSource(state,first.type);
  if(!source||data.NEBULA_IDS.some(id=>data.isSectorReadyToSettle(state.data,id)))return null;
  const publicCards=state.cards.publicCards.map(c=>c&&knownCards.has(c.id)?c:null);
  const scanRoot={...state,cards:{...state.cards,publicCards}};
  const candidates=science.listNebulaChoices(scanRoot,{...source,gainData:true}).flatMap(mark=>{
   const id=mark.target.nebulaId,slots=data.listNebulaTokens(state.data,id);
   if(id===data.AOMOMO_NEBULA_ID||slots.filter(t=>!t.replacedByPlayerId&&!t.replacedByPlayerColor).length!==2)return [];
   const card=science.listPublicScanChoices(scanRoot).find(a=>a.target.nebulaId===id);return card?[{id,mark,card}]:[];
  });
  if(candidates.length!==1)return null;
  const {id,mark,card}=candidates[0],q={...scanRoot,meta:structuredClone(state.meta),data:structuredClone(state.data),
   match:{...state.match,cardPlayContext:{...state.match.cardPlayContext}},players:{...state.players,players:state.players.players.map(v=>v.id===seatId?paid:v)},
   cards:{...scanRoot.cards,publicCards:[...publicCards]}};
  if(!science.executeNebulaScan(q,seatId,mark,{...source,gainData:true}).ok
    ||!science.executeNebulaScan(q,seatId,mark,{nebulaIds:[id],gainData:true}).ok)return null;
  const settlement=data.settleSector(q.data,id,{players:q.players.players,source:'science',root:q});
  if(!settlement.ok||settlement.winner.playerId!==seatId)return null;
  q.cards.publicCards[card.target.publicSlotIndex]=null; // Ignore the unknown refill.
  const rewards=data.buildSectorRewardDescriptors(settlement).filter(r=>r.owner.playerId===seatId);
  const traces=rewards.filter(r=>r.kind==='alien_trace');
  if(traces.length!==1||rewards.some(r=>!['alien_trace','resource'].includes(r.kind)))return null;
  for(const r of rewards)if(r.kind==='resource')players.gainResources(paid,r.gain);
  return {q,id,card,traceType:traces[0].traceType};
 }
 function quoteKnownSector({state,seatId,p,paid,knownCards,details,followup=null,knownAlienDisplay=null,claimNewPublicity=false,knownLaunchTech=null}){
  const preview=previewKnownPaidSector({state,seatId,paid,knownCards});
  if(!preview)return null;
  const {q,id,card,traceType}=preview;
  const alienId=Object.keys(q.aliens.aliens).find(id=>q.aliens.aliens[id].revealed&&q.aliens.aliens[id].alienId==='阿米巴');
  if(!alienId)return null;
  const quotes=[];
  const total=(s,actor)=>endScoring.computePlayerFinalScore({...s,players:s.players.players,currentPlayer:actor,
   finalScoring:structuredClone(s.finalScoring),aliens:structuredClone(s.aliens),
   cardEffects:effects,getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)},actor).totalScore;
  const base=total(state,p),baseCapital=demand.planningCapital(state,p);
  for(const position of aliens.amiba.TRACE_POSITIONS){
   const root={...q,meta:structuredClone(q.meta),aliens:structuredClone(q.aliens)},copy=dataPreviewPlayer(paid);
   root.players={...q.players,players:q.players.players.map(v=>v.id===seatId?copy:v)};
   const trace=previewKnownAmibaTrace({root,copy,alienId,traceType,position,knownAlienDisplay,seatId});
   if(!trace)continue;
   const {displayed}=trace;
   // Crossing a mark or creating an unproved trigger must remain Native.
   if(state.finalScoring.thresholds.some(n=>n>p.resources.score&&n<=copy.resources.score))continue;
   const weights=stateValue.DEFAULT_WEIGHTS,linear=Object.entries(weights).reduce((n,[k,w])=>n+(copy.resources[k]-p.resources[k])*w,0);
   const capital=demand.planningCapital(root,copy),score=total(root,copy);
   let scanValue=stateValue.sumValueParts([score,-base,linear,capital,-baseCapital]),claimedTask=null,knownLaunch=null;
   if(claimNewPublicity){
    const tasks=copy.reservedCards.flatMap(card=>{
     const r=knownCards.has(card.id)&&sectorPublicityReward(card);
     return r&&r.model.cardType===2&&!r.model.endGameScoring
       &&copy.resources.publicity+r.gain.publicity<=players.RESOURCE_LIMITS.publicity
       &&!effects.taskConditionMet(r.task,p,{data:state.data})
       &&effects.taskConditionMet(r.task,copy,{data:root.data})
       ?[{cardId:card.id,taskId:r.task.id,gain:r.gain.publicity}]:[];
    });
    if(tasks.length===1){
     const claim=previewCappedSectorClaim({state:root,seatId,task:tasks[0],allowPublicityGain:true});
     if(claim){
      const settled=owner(claim,seatId),after=stateValue.sumValueParts([total(claim,settled),-base,linear,
       (settled.resources.publicity-copy.resources.publicity)*weights.publicity,
       demand.planningCapital(claim,settled),-baseCapital]);
      if(after>scanValue){
       claimedTask={...tasks[0],delta:after-scanValue};scanValue=after;
       if(knownLaunchTech){
        knownLaunch=quoteKnownResearchLaunch({state:claim,seatId,knownCards,knownTech:knownLaunchTech,
         scanPublicSlot:card.target.publicSlotIndex,total});
        if(knownLaunch)scanValue=stateValue.sumValueParts([scanValue,knownLaunch.value]);
       }
      }
     }
    }
   }
   const continuation=followup?.(root,copy,score,capital);
   if(followup&&!continuation)continue;
   const value=continuation?stateValue.sumValueParts([scanValue,continuation.value]):scanValue;
   if(value>0)quotes.push({value,sectorId:id,publicCardId:card.target.cardInstanceId,traceType,tracePosition:position,
    scoreGain:copy.resources.score-p.resources.score,dataGain:copy.resources.availableData-p.resources.availableData,...details,
    ...(claimedTask?{claimedTask}:{}),...(knownLaunch?{knownLaunch}:{}),
    ...(continuation?{scanValue,research:continuation}:{}),...(displayed?{displayedCard:{id:displayed.id,cardId:displayed.cardId}}:{})});
  }
  return quotes.sort((a,b)=>b.value-a.value||a.tracePosition-b.tracePosition)[0]||null;
 }
 function quoteKnownResearchLaunch({state,seatId,knownCards,knownTech,scanPublicSlot,total}){
  const p=owner(state,seatId),tileId='orange1',stack=state.tech.stacks[tileId],bonus=catalog.BONUS_EFFECTS[stack?.bonusId];
  if(industry.getPlayerIndustryDefinition(p)?.activeAbilityId!=='deepspace_swap_cards'
    ||p.resources.credits||p.resources.energy||p.resources.availableData!==3
    ||data.listComputerPlacedTokens(p).map(t=>t.placementSlot).join(',')!=='1,2,3,4'
    ||p.resources.publicity<tech.getResearchPublicityCost(p)||!knownTech(tileId,stack)
    ||p.reservedCards.some(c=>effects.getCardModel(c)?.triggers?.some(t=>(t.event.types||[t.event.type]).some(type=>type==='researchTech'||type==='launch')))
    ||p.reservedCards.some(c=>effects.getCardModel(c)?.tasks?.some(t=>effects.taskConditionMet(t,p,{data:state.data})))
    ||effects.listPendingTriggerKeys(p,state.turn).length
    ||state.cards.drawPileCardIds.length<2||bonus?.cardSelection!==1||Object.keys(bonus).length!==1)return null;
  const offers=science.listPickCardChoices(state).filter(a=>knownCards.has(a.target.cardInstanceId));
  if(offers.length!==1)return null;
  const before=quietEndCompletion({state,seatId});
  if(!before.available||before.markedTiles.length)return null;
  const next=structuredClone(state),copy=owner(next,seatId);
  const advanced=turnFlow.advanceTurnAfterPlayerAction(next,seatId);
  if(!advanced.turnAdvanced||advanced.roundAdvanced||advanced.gameEnded||advanced.nextPlayerId!==seatId)return null;
  copy.mainActionCompleted=false;
  const take=next.tech.stacks[tileId];
  take.bonusQueue=take.bonusQueue.map((id,i)=>i===take.bonusIndex?id:null);
  const context=science.createActionContext(next,seatId),rotated=tech.rotateForResearch(context,1);
  const action=rotated.ok&&!rotated.events.length&&science.listResearchChoices(next,seatId,{skipRotate:true}).find(a=>a.target.tileId===tileId);
  const result=action&&science.executeResearchChoice(next,seatId,action,{skipRotate:true});
  if(!result?.ok||!result.awaitingCardSelection||result.events.some(e=>e.type!=='researchTech')
    ||state.finalScoring.thresholds.some(n=>n>p.resources.score&&n<=copy.resources.score))return null;
  if(!abilities.executeAbility('launchProbe',context,{skipCost:true,source:'tech'}).ok)return null;
  const {publicSlotIndex:index,cardInstanceId}=offers[0].target,offer=next.cards.publicCards[index];
  if(!offer||offer.id!==cardInstanceId||copy.hand.some(c=>c.id===offer.id))return null;
  copy.hand.push(offer);copy.resources.handSize=copy.hand.length;copy.mainActionCompleted=true;
  next.cards.publicCards[index]=null;
  next.cards.unknownPublicSlotIndices=[...new Set([...(next.cards.unknownPublicSlotIndices||[]),scanPublicSlot,index])];
  next.cards.drawPileCardIds=new Array(next.cards.drawPileCardIds.length-2).fill(null);
  const ready=fillQuietAnalysisComputer(next,seatId),q=ready&&owner(ready,seatId);
  if(!q||q.resources.availableData!==1)return null;
  const end=quietEndCompletion({state:ready,seatId});
  if(!end.available||end.markedTiles.length)return null;
  const weights=stateValue.DEFAULT_WEIGHTS;
  const linear=Object.entries(weights).reduce((n,[k,w])=>n+(q.resources[k]-p.resources[k])*w,0);
  const value=stateValue.sumValueParts([total(ready,q),-total(state,p),linear,
   stateValue.technologyCapital(q.techState,3),-stateValue.technologyCapital(p.techState,3),
   demand.planningCapital(ready,q),-demand.planningCapital(state,p)]);
  return value>0?{value,tileId,cardInstanceId,computerPlacements:2,probe:1}:null;
 }
 function previewKnownAmibaTrace({root,copy,alienId,traceType,position,knownAlienDisplay,seatId}){
   const event={type:'alienTrace',traceType,playerId:seatId,alienSlotId:Number(alienId)};
   if(!aliens.amiba.canPlaceAmibaTrace(root.aliens,alienId,traceType,position).ok)return null;
   const placed=aliens.amiba.placeAmibaTrace(root.aliens,alienId,traceType,position,copy,{sequence:root.meta.sequences.alienEntity});
   if(!placed.ok)return null;
   let displayed=null;
   const apply=r=>{
    if(!r||r.pickCard||r.drawCards)return false;
    if(r.pickAlienCard){
     const amiba=root.aliens.amiba;
     if(displayed||knownAlienDisplay===null||amiba.displayedCardHidden||amiba.displayedCardIndex!==knownAlienDisplay)return false;
     // The native placement consumes one entity sequence before this choice.
     const sequence=root.meta.sequences.alienEntity+1;
     const card=aliens.amiba.createAlienCard(knownAlienDisplay,sequence);
     if(!card||copy.hand.some(c=>c.id===card.id))return false;
     displayed=card;copy.hand.push(card);copy.resources.handSize=copy.hand.length;
     const drawCount=amiba.cardDeck.length;
     amiba.displayedCardIndex=null;amiba.displayedCardHidden=drawCount>0;
     amiba.cardDeck=new Array(Math.max(0,drawCount-1)).fill(null);
    }
    players.gainResources(copy,r.gain||{});
    for(let i=0;i<(r.dataCount||0);i++){const added=data.gainData(copy,{root});if(!added.ok&&!added.discarded)return false;}
    return true;
   };
   if(!apply(placed.reward))return null;
   if(placed.reward.region){
    const symbols=aliens.amiba.listSymbolsInRegion(root.aliens,placed.reward.region);
    if(!symbols.every(symbol=>apply(symbol.reward))||!aliens.amiba.resolveRegionReward(root.aliens,placed.reward.region).ok)return null;
   }
   if(displayed&&copy.reservedCards.some(c=>effects.getCardModel(c)?.triggers?.some(t=>(t.event.types||[t.event.type]).includes('alien_card_gain'))))return null;
   copy.reservedCards=structuredClone(copy.reservedCards);
   const traceEvent={...event,region:placed.reward.region},matches=effects.collectMatchingTriggers(copy,traceEvent);
   if(matches.length){
    if(matches.length!==1)return null;
    const {card,trigger}=matches[0],settled=residual.queryCardSettlement(root,seatId,{kind:'trigger',cardInstanceId:card.id,ruleId:trigger.id,event:traceEvent});
    if(settled?.effects.length!==1||settled.effects[0].type!=='gain_data'||settled.effects[0].options?.count!==1||(settled.effects[0].options?.repeat??1)!==1)return null;
    const consumed=structuredClone(card);
    if(!effects.consumeTrigger(consumed,trigger.id)||effects.areAllTriggersConsumed(consumed)||!data.gainData(copy,{root}).ok)return null;
    copy.reservedCards=copy.reservedCards.map(c=>c.id===consumed.id?consumed:c);
   }
   return {displayed};
 }
 // Prove the known analysis and immediate energy purchase without
 // looking past the currently displayed alien card.
 function previewPickupAnalysisForCargo({state,seatId,knownAlienDisplay,knownCards}){
  const q=owner(state,seatId),alienId=state.aliens.amiba?.revealedSlotId;
  if(!alienId||!Number.isSafeInteger(knownAlienDisplay)||!industry.getPlayerIndustryDefinition(q)?.passiveIds.includes('deepspace_free_analyze')
    ||q.resources.availableData!==3||q.resources.energy||q.techState.blueBoardSlots.blue2!==1||!q.techState.ownedTiles.blue2
    ||q.techState.disabledTiles.blue2||data.listComputerPlacedTokens(q).length!==5||data.listBlueBonusPlacedTokens(q).length!==3
    ||effects.listPendingTriggerKeys(q,state.turn).length||!q.reservedCards.every(c=>{
      const m=effects.getCardModel(c);return knownCards.has(c.id)&&m&&!m.triggers?.length&&!m.temporaryTasks?.length;
    }))return null;
  const choice=aliens.amiba.TRACE_POSITIONS.map(position=>({position,reward:aliens.amiba.getTraceReward(state.aliens,'blue',position)}))
   .filter(x=>x.reward?.pickAlienCard&&aliens.amiba.canPlaceAmibaTrace(state.aliens,alienId,'blue',x.position).ok)
   .sort((a,b)=>(b.reward.gain?.score||0)-(a.reward.gain?.score||0))[0];
  if(!choice)return null;
  const next=structuredClone(state),p=owner(next,seatId);
  next.cards.drawPileCardIds.fill(null);
  next.aliens.amiba.cardDeck.fill(null);
  next.aliens.chong.cardDeck.fill(null);
  const fill=data.placeDataToComputer(p,{target:data.PLACEMENT_KIND_COMPUTER});
  if(!fill.ok||fill.slotBonuses?.length||!data.analyzeDataWithoutEnergy(p).ok)return null;
  const trace=previewKnownAmibaTrace({root:next,copy:p,alienId,traceType:'blue',position:choice.position,knownAlienDisplay,seatId});
  if(!trace?.displayed||p.resources.availableData!==3||p.resources.energy)return null;
  const first=data.placeDataToComputer(p,{target:data.PLACEMENT_KIND_COMPUTER});
  const blue=data.placeDataToComputer(p,{target:data.PLACEMENT_KIND_BLUE_BONUS,blueSlot:1});
  if(!first.ok||!blue.ok||blue.slotBonuses?.length!==1||blue.slotBonuses[0].type!=='energy'
    ||blue.slotBonuses[0].energy!==1||p.resources.availableData!==1)return null;
  return {next,p};
 }
 const visibleOrOpaque=(c,known,opaque)=>known.has(c.id)||Boolean(opaque&&c.hidden&&!c.id&&!c.cardId);
 function quoteFundedSector({state,seatId,knownCards,knownAlienDisplay,allowOpaque=false,claimNewPublicity=false,knownLaunchTech=null}){
  const p=owner(state,seatId),t=state.turn;
  if(t.roundNumber!==3||t.currentPlayerId!==seatId||t.gameEnded||p.passCompletionPending
    ||!t.activePlayerIds?.includes(seatId)||t.activePlayerIds.some(id=>id!==seatId&&!t.passedPlayerIds.includes(id))
    ||p.resources.availableData!==0||p.hand.some(c=>!visibleOrOpaque(c,knownCards,allowOpaque))||p.reservedCards.some(c=>!knownCards.has(c.id))
    ||turnHasScanObservers(state,p)||state.pieces.rockets.some(r=>r.playerId===seatId||r.color===p.color)
    ||!state.aliens.amiba?.revealInitialized||Object.values(state.aliens.aliens).some(a=>a.revealed&&a.alienId!=='阿米巴'))return null;
  const cost=scanEffects.getStandardScanCost(p),types=scanEffects.EFFECT_TYPES;
  if(p.resources.credits!==cost.credits||p.resources.energy!==cost.energy
    ||scanEffects.buildScanEffectQueue(p,{turn:t}).some(e=>![types.EARTH_SECTOR_SCAN,types.IMPROVED_SECTOR_SCAN,types.PUBLIC_CARD_SCAN,types.SCAN_ACTION_4].includes(e.type)))return null;
  const paid=dataPreviewPlayer(p);
  if(!players.spendResources(paid,cost).ok)return null;
  return quoteKnownSector({state,seatId,p,paid,knownCards,knownAlienDisplay,claimNewPublicity,knownLaunchTech,details:{cost}});
 }
 // One paid scan after the already proved income and blue currency tail.
 // The displayed card and the task must be known; neither refill is consulted.
 function quoteFundedChongSector({state,seatId,knownCards,offer}){
  const p=owner(state,seatId),t=state.turn,chong=aliens.chong,slot=offer?.slotId,index=offer?.displayedCardIndex;
  if(t.roundNumber!==3||t.currentPlayerId!==seatId||p.passCompletionPending||t.gameEnded
    ||!t.activePlayerIds.includes(seatId)||t.activePlayerIds.some(id=>id!==seatId&&!t.passedPlayerIds.includes(id))
    ||p.resources.availableData!==0||p.hand.some(c=>!knownCards.has(c.id))||p.reservedCards.some(c=>!knownCards.has(c.id))
    ||turnHasScanObservers(state,p)||state.pieces.rockets.some(r=>r.playerId===seatId)
    ||!Number.isSafeInteger(index)||!chong.isChongRevealedSlot(state.aliens,slot)||state.aliens.chong.displayedCardIndex!==index)return null;
  const model=effects.getCardModel({cardId:chong.getCardDefinition(index)?.cardId,set:'alien:虫'});
  if(!model?.playEffects?.some(e=>e.type==='chong_pickup_fossil')||model.playEffects[0].type!=='card_move')return null;
  const cost=scanEffects.getStandardScanCost(p),types=scanEffects.EFFECT_TYPES;
  const queue=scanEffects.buildScanEffectQueue(p,{turn:t});
  if(p.resources.credits!==cost.credits||p.resources.energy!==cost.energy||queue.length!==3
    ||![types.EARTH_SECTOR_SCAN,types.IMPROVED_SECTOR_SCAN].includes(queue[0].type)
    ||queue[1].type!==types.PUBLIC_CARD_SCAN||queue[2].type!==types.SCAN_ACTION_4)return null;
  const paid=dataPreviewPlayer(p);
  if(!players.spendResources(paid,cost).ok)return null;
  const preview=previewKnownPaidSector({state,seatId,paid,knownCards});
  if(!preview||preview.traceType!=='pink')return null;
  const {q,id,card,traceType}=preview,root={...q,aliens:structuredClone(q.aliens)};
  const options=chong.getPositionsForTraceType(traceType).flatMap(position=>{
   if(!chong.canPlaceChongTrace(root.aliens,slot,traceType,position,paid).ok)return [];
   const r=chong.getTraceReward(root.aliens,traceType,position);
   return r?.pickAlienCard&&!r.pickCard&&!r.drawCards&&!r.dataCount&&!r.fossilPanel&&!r.chooseFossilRewardOnly
    &&Object.keys(r.gain).length===1&&r.gain.score>0?[{position,score:r.gain.score}]:[];
  }).sort((a,b)=>b.score-a.score||a.position-b.position);
  if(!options.length)return null;
  const {position,score}=options[0],traceEvent={type:'alienTrace',traceType,playerId:seatId,alienSlotId:Number(slot),region:null};
  paid.reservedCards=structuredClone(paid.reservedCards);
  if(effects.collectMatchingTriggers(paid,traceEvent).length
    ||effects.collectMatchingTriggers(paid,{...traceEvent,alienId:'虫'}).length||paid.reservedCards.some(c=>
    effects.getCardModel(c)?.triggers?.some(r=>(r.event.types||[r.event.type]).includes('alien_card_gain'))))return null;
  const seq=root.meta.sequences.alienEntity,displayed=chong.createAlienCard(index,seq+1);
  if(!displayed||paid.hand.some(c=>c.id===displayed.id))return null;
  const placed=chong.placeChongTrace(root.aliens,slot,traceType,position,paid,{sequence:seq});
  if(!placed.ok)return null;
  players.gainResources(paid,{score});
  paid.hand.push(displayed);paid.resources.handSize=paid.hand.length;
  root.aliens.chong.displayedCardIndex=null;
  root.aliens.chong.cardDeck=new Array(Math.max(0,root.aliens.chong.cardDeck.length-1)).fill(null);
  const tasks=paid.reservedCards.flatMap(c=>{
   const r=knownCards.has(c.id)&&sectorPublicityReward(c);
   return r&&!effects.taskConditionMet(r.task,p,{data:state.data})&&effects.taskConditionMet(r.task,paid,{data:root.data})
    ?[{cardId:c.id,taskId:r.task.id}]:[];
  });
  if(tasks.length!==1)return null;
  const claimed=previewCappedSectorClaim({state:root,seatId,task:tasks[0],allowPublicityGain:true});
  if(!claimed)return null;
  const after=owner(claimed,seatId);
  if(state.finalScoring.thresholds.some(n=>n>p.resources.score&&n<=after.resources.score))return null;
  const total=(s,actor)=>endScoring.computePlayerFinalScore({...s,players:s.players.players,currentPlayer:actor,
   finalScoring:structuredClone(s.finalScoring),aliens:structuredClone(s.aliens),cardEffects:effects,
   getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)},actor).totalScore;
  const linear=Object.entries(stateValue.DEFAULT_WEIGHTS).map(([k,w])=>(after.resources[k]-p.resources[k])*w);
  const realized=Math.min(after.resources.score-p.resources.score,total(claimed,after)-total(state,p));
  const capitalChange=Math.min(0,demand.planningCapital(claimed,after)-demand.planningCapital(state,p));
  const value=stateValue.sumValueParts([realized,...linear,capitalChange]);
  return value>0?{value,sectorId:id,publicCardId:card.target.cardInstanceId,traceType,tracePosition:position,
   scoreGain:score,dataGain:after.resources.availableData-p.resources.availableData,cost,
   displayedCard:{index,cardId:displayed.cardId},claimedTask:tasks[0],remaining:after.resources}:null;
 }
 // After a known analysis has reset the computer, prove one new
 // research can pay both the income and blue-energy placements with data.
 // Compare three fixed orders of the same publicly payable development.
 // This only mutates disposable scalar-preview states. No new card identity
 // or technology reward from a hidden refill may become a supplier.
 // Purpose-specific match for the first legal endpoint of a fixed order.
 // Tokens with the same position are fungible here: no slot observers, spend
 // identities, pending effects or unknown refill choices enter this proof.
 function matchedAnalysisScanSignature(state,seatId,publicIds){
  const p=owner(state,seatId),sort=o=>Object.entries(o).sort(([a],[b])=>a<b?-1:a>b?1:0);
  const traces=table=>Object.entries(table||{}).flatMap(([slot,types])=>Object.entries(types).flatMap(([type,positions])=>
   Object.entries(positions||{}).flatMap(([position,x])=>x?[[slot,type,position,x.playerId||null,x.playerColor||null]]:[])));
  const sectors=sort(state.data.nebulae).map(([id,n])=>[id,n.tokens.map(x=>[x.slotIndex,x.replacedByPlayerId||null,x.replacedByPlayerColor||null])]);
  const marks=sort(state.finalScoring.tiles).map(([id,x])=>[id,x.marks.map(m=>[m.playerId,m.threshold,m.slotIndex])]);
  return JSON.stringify([state.turn.roundNumber,state.solarSystem.rotation,sectors,marks,
   sort(p.resources),sort(p.income),sort(p.techState.ownedTiles),
   sort(p.techState.blueBoardSlots),sort(p.techState.disabledTiles),p.hand.map(c=>[c.id,c.cardId]),
   p.reservedCards.map(c=>[c.id,c.cardId]),p.completedTaskCount||0,
   data.listComputerPlacedTokens(p).map(x=>x.placementSlot),data.listBlueBonusPlacedTokens(p).map(x=>x.blueSlot),
   state.data.sectorSettlements.winsByPlayerId[seatId],state.cards.publicCards.map(c=>c&&publicIds.has(c.id)?c.id:null),
   traces(state.aliens.amiba.traceSlotsByAlienSlotId),traces(state.aliens.chong.traceSlotsByAlienSlotId)]);
 }
 function matchedAnalysisScanValue(state,seatId){
  const p=owner(state,seatId),w=stateValue.DEFAULT_WEIGHTS;
  const established=endScoring.computePlayerFinalScore({...state,players:state.players.players,currentPlayer:p,
   aliens:structuredClone(state.aliens),finalScoring:structuredClone(state.finalScoring),cardEffects:effects,
   getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)},p).totalScore;
  return stateValue.sumValueParts([established,
   ...Object.entries(w).map(([k,v])=>((k==='handSize'?p.hand.length:p.resources[k])+p.income[k]*(4-state.turn.roundNumber))*v),
   stateValue.technologyCapital(p.techState,state.turn.roundNumber),demand.planningCapital(state,p)]);
 }
 function previewMatchedAnalysisScan({state,seatId,knownCards,knownTech,amibaOffer,chongOffer,retainedRegion=false}){
  const start=owner(state,seatId),turn=state.turn,chong=aliens.chong;
  const owned=Object.keys(start.techState.ownedTiles).find(id=>start.techState.ownedTiles[id]&&science.getResearchDataCount(id)===2);
  const occupied=p=>data.listComputerPlacedTokens(p).map(x=>x.placementSlot).join(',');
  if(turn.roundNumber!==3||turn.currentPlayerId!==seatId||turn.gameEnded||start.mainActionCompleted!==retainedRegion||start.passCompletionPending
    ||!turn.activePlayerIds.includes(seatId)||turn.activePlayerIds.some(id=>id!==seatId&&!turn.passedPlayerIds.includes(id))
    ||(owned?start.resources.availableData!==5||start.resources.publicity+1>players.RESOURCE_LIMITS.publicity
      :start.resources.availableData!==3||start.resources.publicity!==players.RESOURCE_LIMITS.publicity)
    ||start.resources.credits!==0||start.resources.energy!==1||start.hand.length!==4||occupied(start)!=='1,2,3,4,5,6'
    ||!industry.getPlayerIndustryDefinition(start)?.passiveIds.includes('deepspace_free_analyze')
    ||start.hand.some(c=>!visibleOrOpaque(c,knownCards,retainedRegion))||start.reservedCards.some(c=>!knownCards.has(c.id))||turnHasScanObservers(state,start)
    ||state.pieces.rockets.some(r=>r.playerId===seatId||r.color===start.color)
    ||Object.values(state.aliens.aliens).some(s=>s.revealed&&!['阿米巴','虫'].includes(s.alienId))
    ||!state.aliens.amiba?.revealInitialized||!Number.isSafeInteger(amibaOffer)||state.aliens.amiba.displayedCardIndex!==amibaOffer
    ||!Number.isSafeInteger(chongOffer?.displayedCardIndex)||state.aliens.chong.displayedCardIndex!==chongOffer.displayedCardIndex
    ||!chong.isChongRevealedSlot(state.aliens,chongOffer.slotId))return null;
  const production=tech.listTakeableTiles(state.tech,start.techState).filter(id=>science.getResearchDataCount(id)===2);
  if(!owned&&(production.length!==1||!knownTech(production[0],state.tech.stacks[production[0]])))return null;
  const tileId=owned||production[0],amibaId=state.aliens.amiba.revealedSlotId,chongId=chongOffer.slotId,index=chongOffer.displayedCardIndex;
  const taskChoices=start.reservedCards.flatMap(c=>{
   const r=sectorPublicityReward(c);
   return r&&r.model.cardType===2&&!r.model.endGameScoring&&!effects.taskConditionMet(r.task,start,{data:state.data})
    ?[{cardId:c.id,taskId:r.task.id}]:[];
  });
  if(taskChoices.length!==1||(retainedRegion&&owned))return null;
  const task=taskChoices[0],cost=scanEffects.getStandardScanCost(start),types=scanEffects.EFFECT_TYPES;
  if(cost.credits!==1||cost.energy!==2)return null;
  const originalMarks=state.finalScoring.thresholds;
  const income=(s,currency,known)=>{
   const p=owner(s,seatId),choices=p.hand.filter(c=>{
    const gain=cards.getIncomeGainForCard(c);
    return known.has(c.id)&&gain?.[currency]===1&&Object.keys(gain).length===1;
   });
   const menu=science.formalizeChoices(s,seatId,science.listIncomeChoices(s,seatId)).filter(a=>choices.some(c=>c.id===a.target.cardInstanceId));
   const selected=demand.incomeChoice({state:s,seatId,goal:{required:{}},actions:menu});
   const card=choices.find(c=>menu.some(a=>a.actionId===selected?.actionId&&a.target.cardInstanceId===c.id));
   const tail=card&&demand.previewIncomeTail({state:s,seatId,goal:{incomeCardId:card.id}});
   if(!tail?.available||tail.placements!==4||(owned?tail.player.resources.availableData<1:tail.player.resources.availableData!==1))return null;
   const blueSlots=data.listBluePlacementRequirements(tail.player).filter(x=>data.getBlueBonusPlacementReward(tail.player,x.blueSlot)?.type==='energy');
   if(blueSlots.length!==1)return null;
   const {blueSlot}=blueSlots[0],a=data.placeDataToComputer(tail.player,{target:data.PLACEMENT_KIND_BLUE_BONUS,blueSlot});
   if(!a.ok||a.slotBonuses?.length!==1||a.slotBonuses[0].type!=='energy'||a.slotBonuses[0].energy!==1)return null;
   players.gainResources(tail.player,{energy:1});
   s.players.players=s.players.players.map(v=>v===p?tail.player:v);
   s.cards.removedFromGameCardIds.push(card.cardId);
   return {cardId:card.id,card:card.cardId,blueSlot};
  };
  const research=s=>{
   const p=owner(s,seatId),stack=s.tech.stacks[tileId],bonus=catalog.BONUS_EFFECTS[stack?.bonusId];
   if(!bonus||!knownTech(tileId,stack)||Object.keys(bonus).some(k=>!['credits','energy','publicity','score'].includes(k))
    ||p.resources.availableData+2>players.RESOURCE_LIMITS.availableData
    ||p.reservedCards.some(c=>effects.getCardModel(c)?.triggers?.some(t=>(t.event.types||[t.event.type]).includes('researchTech'))))return false;
   const rotated=tech.rotateForResearch(science.createActionContext(s,seatId),1);
   const choice=rotated.ok&&!rotated.events.length&&science.listResearchChoices(s,seatId,{skipRotate:true}).find(a=>a.target.tileId===tileId);
   const result=choice&&science.executeResearchChoice(s,seatId,choice,{skipRotate:true});
   return Boolean(result?.ok&&!result.awaitingCardSelection&&result.events.every(e=>e.type==='researchTech'));
  };
  const analyze=(s,known)=>{
   const p=owner(s,seatId);
   if(occupied(p)!=='1,2,3,4,5,6'||s.aliens.chong.displayedCardIndex!==index
    ||p.reservedCards.some(c=>effects.getCardModel(c)?.triggers?.some(t=>(t.event.types||[t.event.type]).some(type=>['analyze','alien_card_gain'].includes(type))))
    ||!data.analyzeDataWithoutEnergy(p).ok)return null;
   const options=chong.getPositionsForTraceType('blue').flatMap(position=>{
    if(!chong.canPlaceChongTrace(s.aliens,chongId,'blue',position,p).ok)return [];
    const r=chong.getTraceReward(s.aliens,'blue',position);
    return r?.pickAlienCard&&!r.pickCard&&!r.drawCards&&!r.dataCount&&!r.fossilPanel&&!r.chooseFossilRewardOnly
      &&Object.keys(r.gain).length===1&&r.gain.score>0?[{position,score:r.gain.score}]:[];
   }).sort((a,b)=>b.score-a.score);
   if(!options.length||options[1]?.score===options[0].score)return null;
   const {position,score}=options[0],event={type:'alienTrace',traceType:'blue',playerId:seatId,alienSlotId:Number(chongId),region:null};
   for(const c of p.reservedCards)effects.ensureCardEffectState(c);
   if(effects.collectMatchingTriggers(p,event).length||effects.collectMatchingTriggers(p,{...event,alienId:'虫'}).length)return null;
   const seq=s.meta.sequences.alienEntity,card=chong.createAlienCard(index,seq+1);
   if(!card||p.hand.some(c=>c.id===card.id)||!chong.placeChongTrace(s.aliens,chongId,'blue',position,p,{sequence:seq}).ok)return null;
   s.meta.sequences.alienEntity+=2;
   p.hand.push(card);p.resources.handSize=p.hand.length;known.add(card.id);
   players.gainResources(p,{score});
   s.aliens.chong.displayedCardIndex=null;
   s.aliens.chong.cardDeck=new Array(Math.max(0,s.aliens.chong.cardDeck.length-1)).fill(null);
   return {position,cardId:card.id,card:card.cardId};
  };
  const scan=(s,known,needsFunding)=>{
   const p=owner(s,seatId),queue=scanEffects.buildScanEffectQueue(p,{turn:s.turn});
   if(queue.length!==3||![types.EARTH_SECTOR_SCAN,types.IMPROVED_SECTOR_SCAN].includes(queue[0].type)
    ||queue[1].type!==types.PUBLIC_CARD_SCAN||queue[2].type!==types.SCAN_ACTION_4)return null;
   const discarded=[];
   if(needsFunding)for(const currency of ['credits','energy']){
    if(p.resources[currency]!==cost[currency]-1)return null;
    const pay=demand.paymentCards(s,seatId,{kind:'scan',required:cost},2);
    if(!pay||pay.some(id=>!known.has(id)))return null;
    const cards=p.hand.filter(c=>pay.includes(c.id));
    p.hand=p.hand.filter(c=>!pay.includes(c.id));p.resources.handSize=p.hand.length;
    s.cards.discardPile.push(...cards);players.gainResources(p,{[currency]:1});discarded.push(...pay);
   }
   if(p.resources.credits!==cost.credits||p.resources.energy!==cost.energy||!players.spendResources(p,cost).ok)return null;
   const seen=previewKnownPaidSector({state:s,seatId,paid:p,knownCards:known});
   if(!seen||seen.traceType!=='pink')return null;
   const root={...seen.q,aliens:structuredClone(seen.q.aliens)},options=aliens.amiba.TRACE_POSITIONS.flatMap(position=>{
    if(!aliens.amiba.canPlaceAmibaTrace(root.aliens,amibaId,'pink',position).ok)return [];
    const r=aliens.amiba.getTraceReward(root.aliens,'pink',position);
    return r?.pickAlienCard&&!r.pickCard&&!r.drawCards&&!r.dataCount
     &&Object.keys(r.gain||{}).every(k=>k==='score')?[{position,score:r.gain.score||0}]:[];
   }).sort((a,b)=>b.score-a.score);
   if(!options.length||options[1]?.score===options[0].score)return null;
   const position=options[0].position,trace=previewKnownAmibaTrace({root,copy:p,alienId:amibaId,traceType:'pink',position,knownAlienDisplay:amibaOffer,seatId});
   if(!trace?.displayed)return null;
   root.meta.sequences.alienEntity+=2;
   known.add(trace.displayed.id);
   root.cards.drawPileCardIds=new Array(Math.max(0,root.cards.drawPileCardIds.length-1)).fill(null);
   root.cards.unknownPublicSlotIndices=[...new Set([...(root.cards.unknownPublicSlotIndices||[]),seen.card.target.publicSlotIndex])];
   return {root,sectorId:seen.id,cardId:seen.card.target.cardInstanceId,tracePosition:position,displayed:trace.displayed.cardId,discarded};
  };
  const end=s=>{
   const p=owner(s,seatId);
   if(originalMarks.some(n=>n>start.resources.score&&n<=p.resources.score)||effects.listPendingTriggerKeys(p,s.turn).length)return false;
   const quiet=quietEndCompletion({state:s,seatId});
   if(!quiet.available||quiet.markedTiles.length||quiet.netGain)return false;
   const t=turnFlow.advanceTurnAfterPlayerAction(s,seatId);p.mainActionCompleted=false;
   return t.turnAdvanced&&!t.roundAdvanced&&!t.gameEnded&&t.nextPlayerId===seatId;
  };
  const run=order=>{
   let s=structuredClone(state),known=new Set(knownCards),dataIncome,analysis,sector,first,taskClaimed=false;
   s.cards.drawPileCardIds.fill(null);s.aliens.chong.cardDeck.fill(null);s.aliens.amiba.cardDeck.fill(null);
   for(const [id,stack] of Object.entries(s.tech.stacks))stack.bonusQueue=stack.bonusQueue.map((reward,i)=>i===stack.bonusIndex&&knownTech(id,stack)?reward:null);
   if(retainedRegion&&!end(s))return null;
   for(let i=0;i<order.length;i++){
    const family=order[i];
    if(family==='scan'){
     const result=scan(s,known,i===0);if(!result)return null;
     const {root,...evidence}=result;s=root;sector=evidence;
    }else if(family==='analyze'){
     analysis=analyze(s,known);if(!analysis)return null;
    }else if(!research(s))return null;
    const p=owner(s,seatId);p.mainActionCompleted=true;
    if(family==='analyze'&&(owned||retainedRegion)||i===1&&!owned){
     dataIncome=income(s,order[0]==='scan'?'energy':'credits',known);if(!dataIncome)return null;
    }
    if(!taskClaimed&&(i===order.length-1||owned&&i===0&&family==='scan')){
     const claimed=previewCappedSectorClaim({state:s,seatId,task,allowPublicityGain:true});
     if(!claimed)return null;s=claimed;taskClaimed=true;
    }
    if(i===0)first=matchedAnalysisScanSignature(s,seatId,knownCards);
    if(!end(s))return null;
   }
   return {state:s,value:matchedAnalysisScanValue(s,seatId),first,analysis,sector,dataIncome};
  };
  if(retainedRegion){
   const funding=run(['research','analyze','scan']);
   return funding&&{tileId,funding,originValue:matchedAnalysisScanValue(state,seatId)};
  }
  const analysis=run(owned?['analyze','scan']:['analyze','research','scan']),researchFirst=owned?null:run(['research','analyze','scan']),
   scanFirst=run(owned?['scan','analyze']:['scan','analyze','research']);
  if(!analysis||!scanFirst||!owned&&!researchFirst)return null;
  if(![researchFirst,scanFirst].filter(Boolean).every(x=>['sectorId','cardId','tracePosition','displayed'].every(k=>x.sector[k]===analysis.sector[k])
    &&x.analysis.position===analysis.analysis.position&&x.analysis.card===analysis.analysis.card))return null;
  return {tileId,task,analysis,research:researchFirst,scan:scanFirst};
 }
 function quoteResearchIncomeScan({state,seatId,knownCards,knownTech,allowOpaque=false}){
  const p=owner(state,seatId),cost=scanEffects.getStandardScanCost(p);
  if(p.resources.credits!==cost.credits-1||p.resources.energy!==cost.energy-1
    ||p.resources.publicity<tech.getResearchPublicityCost(p)||data.listComputerPlacedTokens(p).length!==0
    ||p.resources.availableData<=0||p.resources.availableData>=5||p.hand.length!==4
    ||p.hand.some(c=>!visibleOrOpaque(c,knownCards,allowOpaque))||p.reservedCards.some(c=>!knownCards.has(c.id))||turnHasScanObservers(state,p)
    ||p.reservedCards.some(c=>effects.getCardModel(c)?.triggers?.some(x=>(x.event.types||[x.event.type]).includes('researchTech')))
    ||state.pieces.rockets.some(r=>r.playerId===seatId||r.color===p.color))return null;
  const suppliers=p.hand.filter(c=>{
   const gain=cards.getIncomeGainForCard(c);return gain?.credits===1&&Object.keys(gain).length===1;
  });
  const producer=tech.listTakeableTiles(state.tech,p.techState).filter(id=>science.getResearchDataCount(id)===5-p.resources.availableData);
  if(suppliers.length===0||producer.length!==1||!knownTech(producer[0],state.tech.stacks[producer[0]]))return null;
  const tile=producer[0],stack=state.tech.stacks[tile],bonus=catalog.BONUS_EFFECTS[stack.bonusId];
  if(!bonus||stack.bonusHidden||Object.keys(bonus).some(k=>!['credits','energy','publicity','score'].includes(k)))return null;
  const source=structuredClone(state),copy=owner(source,seatId),take=source.tech.stacks[tile];
  take.bonusQueue=take.bonusQueue.map((id,i)=>i===take.bonusIndex?id:null);
  const rotated=tech.rotateForResearch(science.createActionContext(source,seatId),1);
  const choice=rotated.ok&&!rotated.events.length&&science.listResearchChoices(source,seatId,{skipRotate:true}).find(a=>a.target.tileId===tile);
  const result=choice&&science.executeResearchChoice(source,seatId,choice,{skipRotate:true});
  if(!result?.ok||result.awaitingCardSelection||result.events.some(e=>e.type!=='researchTech')
    ||copy.resources.availableData!==5||copy.resources.credits!==p.resources.credits||copy.resources.energy!==p.resources.energy)return null;
  copy.mainActionCompleted=true;
  const menu=science.formalizeChoices(source,seatId,science.listIncomeChoices(source,seatId));
  const ids=new Set(suppliers.map(c=>c.id)),selection=demand.incomeChoice({state:source,seatId,goal:{required:{}},actions:menu.filter(a=>ids.has(a.target.cardInstanceId))});
  const supplier=suppliers.find(c=>menu.some(a=>a.actionId===selection?.actionId&&a.target.cardInstanceId===c.id));
  const income=supplier&&demand.previewIncomeTail({state:source,seatId,goal:{incomeCardId:supplier.id}});
  if(!income?.available||income.placements!==4||income.player.resources.availableData!==1)return null;
  const replace=(s,a)=>({...s,players:{...s.players,players:s.players.players.map(v=>v.id===seatId?a:v)}});
  const placed=replace({...source,cards:{...source.cards,removedFromGameCardIds:[...source.cards.removedFromGameCardIds,supplier.cardId]}},income.player);
  const blueSlots=data.listBluePlacementRequirements(income.player).filter(x=>data.getBlueBonusPlacementReward(income.player,x.blueSlot)?.type==='energy');
  if(blueSlots.length!==1)return null;
  const blueSlot=blueSlots[0].blueSlot,blue=previewBlueCompletion({state:placed,seatId,goal:{blueSlot}});
  if(!blue.available||blue.computerPlacements||blue.incomeCardId||blue.dataCornerId||blue.player.resources.availableData!==0)return null;
  const charged=replace(placed,blue.player),end=quietEndCompletion({state:charged,seatId});
  if(!end.available||end.netGain!==0||end.markedTiles.length)return null;
  const total=(s,q)=>endScoring.computePlayerFinalScore({...s,players:s.players.players,currentPlayer:q,
   finalScoring:structuredClone(s.finalScoring),aliens:structuredClone(s.aliens),cardEffects:effects,
   getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)},q).totalScore;
  const weights=stateValue.DEFAULT_WEIGHTS;
  const funded=ready=>{
   const scan=quoteFundedSector({state:ready,seatId,knownCards,knownAlienDisplay:null,allowOpaque,claimNewPublicity:true,knownLaunchTech:knownTech});
   if(!scan)return null;
   const q=owner(ready,seatId);
   const linear=Object.entries(weights).reduce((n,[k,w])=>n+(q.resources[k]-p.resources[k]+q.income[k]-p.income[k])*w,0);
   const fundedValue=stateValue.sumValueParts([total(ready,q),-total(state,p),linear,
     stateValue.technologyCapital(q.techState,3),-stateValue.technologyCapital(p.techState,3),
     demand.planningCapital(ready,q),-demand.planningCapital(state,p)]);
   const value=stateValue.sumValueParts([fundedValue,scan.value]);
   return value>0?{value,fundedValue,tileId:tile,incomeCardId:supplier.id,blueSlot,scan}:null;
  };
  const base=funded(charged);
  if(!base)return null;
  const stock=blue.player;
  if(industry.getPlayerIndustryDefinition(stock)?.activeAbilityId!=='deepspace_swap_cards')return base;
  const extraSlots=data.listBluePlacementRequirements(stock).filter(x=>data.getBlueBonusPlacementReward(stock,x.blueSlot)?.type==='choose_card');
  const sources=stock.hand.filter(c=>knownCards.has(c.id)&&c.set==='alien:阿米巴'&&cards.getDiscardActionRewardForCard(c)?.dataCount===1);
  const offers=charged.cards.publicCards.filter(c=>{
   const gain=c&&cards.getIncomeGainForCard(c);
   return c&&knownCards.has(c.id)&&gain?.energy===1&&Object.keys(gain).length===1;
  });
  if(extraSlots.length!==1||sources.length!==1||offers.length!==1||!charged.cards.drawPileCardIds.length)return base;
  const extraSlot=extraSlots[0].blueSlot,corner=sources[0],offer=offers[0];
  if(!data.listComputerPlacedTokens(stock).some(t=>t.placementSlot===data.getRequiredComputerSlotForBlueBonus(extraSlot))
    ||stock.hand.some(c=>c.id===offer.id))return base;
  const cornerRoot=previewScoredAmibaDataCorner({state:charged,seatId,cardId:corner.id});
  if(!cornerRoot)return base;
  const extra=owner(cornerRoot,seatId),bonusResult=data.placeDataToComputer(extra,{target:data.PLACEMENT_KIND_BLUE_BONUS,blueSlot:extraSlot});
  if(!bonusResult.ok||bonusResult.slotBonuses?.length!==1||bonusResult.slotBonuses[0].type!=='choose_card'
    ||charged.finalScoring.thresholds.some(n=>n>stock.resources.score&&n<=extra.resources.score))return base;
  const picked=science.listPickCardChoices(cornerRoot).find(a=>a.target.cardInstanceId===offer.id);
  if(!picked)return base;
  extra.hand.push({...offer,blueBonusOwnerId:seatId});extra.resources.handSize=extra.hand.length;
  const index=picked.target.publicSlotIndex;
  const quoted=funded({...cornerRoot,cards:{...cornerRoot.cards,
    publicCards:cornerRoot.cards.publicCards.map((c,i)=>i===index?null:c),
    unknownPublicSlotIndices:[...new Set([...(cornerRoot.cards.unknownPublicSlotIndices||[]),index])],
    drawPileCardIds:new Array(cornerRoot.cards.drawPileCardIds.length-1).fill(null)}});
  if(!quoted||quoted.value<=base.value||quoted.scan.sectorId!==base.scan.sectorId||quoted.scan.publicCardId!==base.scan.publicCardId)return base;
  return {...quoted,knownBlueMarket:{blueSlot:extraSlot,cornerId:corner.id,publicCardId:offer.id,deltaAgainstNoPick:quoted.value-base.value}};
 }
 function quoteReadyAnalysisFunding({state,seatId,knownCards,knownTech,knownAlienDisplay}){
  const p=owner(state,seatId),t=state.turn,amiba=state.aliens.amiba;
  const occupied=data.listComputerPlacedTokens(p).map(x=>x.placementSlot);
  if(t.roundNumber!==3||t.currentPlayerId!==seatId||t.gameEnded||p.passCompletionPending
    ||!t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id))
    ||p.resources.availableData!==2||p.resources.credits!==0||p.resources.energy!==1||p.hand.length!==3
    ||occupied.join(',')!=='1,2,3,4,5,6'||p.hand.some(c=>!visibleOrOpaque(c,knownCards,true))
    ||p.reservedCards.some(c=>!knownCards.has(c.id))||turnHasScanObservers(state,p)
    ||state.pieces.rockets.some(r=>r.playerId===seatId||r.color===p.color)
    ||!amiba?.revealInitialized||amiba.displayedCardHidden||knownAlienDisplay===null||amiba.displayedCardIndex!==knownAlienDisplay
    ||Object.values(state.aliens.aliens).some(a=>a.revealed&&a.alienId!=='阿米巴'))return null;
  const alienId=String(amiba.revealedSlotId),quotes=[];
  const total=(s,q)=>endScoring.computePlayerFinalScore({...s,players:s.players.players,currentPlayer:q,
   finalScoring:structuredClone(s.finalScoring),aliens:structuredClone(s.aliens),
   cardEffects:effects,getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)},q).totalScore;
  const beforeScore=total(state,p),beforeCapital=demand.planningCapital(state,p);
  for(const position of aliens.amiba.TRACE_POSITIONS){
   if(!aliens.amiba.getTraceReward(state.aliens,'blue',position)?.pickAlienCard)continue;
   const q=dataPreviewPlayer(p),root={...state,meta:structuredClone(state.meta),aliens:structuredClone(state.aliens),
    players:{...state.players,players:state.players.players.map(v=>v===p?q:v)}};
   if(!data.analyzeDataWithoutEnergy(q).ok)continue;
   const trace=previewKnownAmibaTrace({root,copy:q,alienId,traceType:'blue',position,knownAlienDisplay,seatId});
   if(!trace?.displayed||q.resources.availableData!==3||q.hand.length!==4
     ||state.finalScoring.thresholds.some(n=>n>p.resources.score&&n<=q.resources.score))continue;
   const known=new Set([...knownCards,trace.displayed.id]);
   const funding=quoteResearchIncomeScan({state:root,seatId,knownCards:known,knownTech,allowOpaque:true});
   if(!funding)continue;
   const linear=Object.entries(stateValue.DEFAULT_WEIGHTS).reduce((n,[k,w])=>n+(q.resources[k]-p.resources[k])*w,0);
   const analysisValue=stateValue.sumValueParts([total(root,q),-beforeScore,linear,demand.planningCapital(root,q),-beforeCapital]);
   const value=stateValue.sumValueParts([analysisValue,funding.value]);
   if(value>0)quotes.push({value,analysisValue,tracePosition:position,displayedCardId:trace.displayed.cardId,funding});
  }
  return quotes.sort((a,b)=>b.value-a.value||a.tracePosition-b.tracePosition)[0]||null;
 }
 function scanTimingSource({state,seatId,knownCards,trade}){
  const p=owner(state,seatId),t=state.turn;
  if(t.roundNumber!==3||t.currentPlayerId!==seatId||p.passCompletionPending||t.gameEnded
    ||!t.activePlayerIds?.includes(seatId)||t.activePlayerIds.some(id=>id!==seatId&&!t.passedPlayerIds.includes(id))
    ||p.resources.availableData!==0||p.resources.credits===0||p.hand.length<3||[...p.hand,...p.reservedCards].some(c=>!knownCards.has(c.id))
    ||data.listComputerPlacedTokens(p).map(x=>x.placementSlot).join(',')!=='1,2,3,4'
    ||turnHasScanObservers(state,p)||state.pieces.rockets.some(r=>r.playerId===seatId||r.color===p.color)
    ||!state.aliens.amiba?.revealInitialized||Object.values(state.aliens.aliens).some(a=>a.revealed&&a.alienId!=='阿米巴')
    ||!trade||trade.cost.handSize!==2||Object.keys(trade.cost).length!==1||trade.gain.energy!==1||Object.keys(trade.gain).length!==1)return null;
  const cost=scanEffects.getStandardScanCost(p),types=scanEffects.EFFECT_TYPES;
  if(p.resources.credits<cost.credits||p.resources.energy!==cost.energy-1
    ||scanEffects.buildScanEffectQueue(p,{turn:t}).some(e=>![types.EARTH_SECTOR_SCAN,types.PUBLIC_CARD_SCAN,types.SCAN_ACTION_4].includes(e.type)))return null;
  return {cost,trade};
 }
 function quoteScanTiming({state,seatId,knownCards,trade,knownTech}){
  const source=scanTimingSource({state,seatId,knownCards,trade});if(!source)return null;
  const p=owner(state,seatId),{cost}=source,discard=demand.paymentCards(state,seatId,{kind:'scan',required:cost},trade.cost.handSize);
  if(!discard)return null;
  const paid=dataPreviewPlayer(p);
  paid.hand=paid.hand.filter(c=>!discard.includes(c.id));paid.resources.handSize=paid.hand.length;
  players.gainResources(paid,trade.gain);
  if(!players.spendResources(paid,cost).ok||paid.resources.energy!==0)return null;
  const total=(s,q)=>endScoring.computePlayerFinalScore({...s,players:s.players.players,currentPlayer:q,
   finalScoring:structuredClone(s.finalScoring),aliens:structuredClone(s.aliens),
   cardEffects:effects,getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)},q).totalScore;
  return quoteKnownSector({state,seatId,p,paid,knownCards,details:{discard},followup:(root,afterScan,score,capital)=>{
   const actor={...afterScan,mainActionCompleted:false};
   const next={...root,players:{...root.players,players:root.players.players.map(v=>v===afterScan?actor:v)}};
   const purpose=researchDataPurpose({state:next,seatId,knownCards});
   if(!purpose||!purpose.pair.every(id=>knownTech?.(id,next.tech.stacks[id])))return null;
   const producer=purpose.pair[0],stack=next.tech.stacks[producer],bonus=catalog.BONUS_EFFECTS[stack.bonusId];
   if(!bonus||stack.bonusHidden||Object.keys(bonus).some(k=>!['credits','energy','publicity','score'].includes(k)))return null;
   const research=structuredClone(next),r=owner(research,seatId),take=research.tech.stacks[producer];
   // Hide the next bonus before taking this visible one; no later
   // purpose can use the newly revealed item or its identity.
   take.bonusQueue=take.bonusQueue.map((id,i)=>i===take.bonusIndex?id:null);
   const choice=science.listResearchChoices(research,seatId).find(a=>a.target.tileId===producer);
   const chosen=choice&&science.executeResearchChoice(research,seatId,choice);
   if(!chosen?.ok||chosen.awaitingCardSelection||chosen.events.some(e=>e.type!=='researchTech')
      ||research.finalScoring.thresholds.some(n=>n>actor.resources.score&&n<=r.resources.score))return null;
   const claimed=previewCappedSectorClaim({state:research,seatId,task:purpose.ready,allowPublicityGain:true});
   const player=claimed&&owner(claimed,seatId),continuation=claimed&&quoteResearchDataPurpose({state:claimed,seatId,purpose});
   if(!continuation)return null;
   const linear=Object.entries(stateValue.DEFAULT_WEIGHTS).reduce((n,[k,w])=>n+(player.resources[k]-actor.resources[k])*w,0);
   const value=stateValue.sumValueParts([total(claimed,player),-score,linear,
    stateValue.technologyCapital(player.techState,3),-stateValue.technologyCapital(actor.techState,3),
    demand.planningCapital(claimed,player),-capital,continuation.value]);
   return {value,first:producer,taskId:purpose.ready.taskId,continuation};
  }});
 }
 function turnHasScanObservers(state,p){
  return state.turn.cardTurnEventBonuses?.length||p.reservedCards.some(c=>{
   const m=effects.getCardModel(c);return !m||m.temporaryTasks?.length||m.triggers?.some(t=>(t.event?.types||[t.event?.type])
    .some(type=>!['alienTrace','visitPlanet','visitAsteroid','visitComet','researchTech','orbit','land','launch','playCard'].includes(type)));
  });
 }
 function amibaRegionFollowup({state,seatId,knownCards}){
  const p=owner(state,seatId),t=state.turn,types=aliens.amiba.EFFECT_TYPES;
  if(t.roundNumber!==3||t.currentPlayerId!==seatId||p.mainActionCompleted||p.passCompletionPending
    ||!t.activePlayerIds?.includes(seatId)||t.activePlayerIds.some(id=>id!==seatId&&!t.passedPlayerIds.includes(id))
    ||t.cardTurnEventBonuses?.length||state.pieces.rockets.some(r=>r.playerId===seatId||r.color===p.color)
    ||!state.aliens.amiba?.revealInitialized||p.resources.availableData||data.listComputerPlacedTokens(p).map(x=>x.placementSlot).join(',')!=='1,2,3,4')return null;
  const hand=p.hand.filter(c=>knownCards.has(c.id));
  const source=hand.filter(c=>{
   const e=effects.buildPlayEffects(c),model=effects.getCardModel(c);
   return model?.cardType===1&&e.length===2&&e[0].type==='gain_data'&&e[0].options?.count>=2&&e[1].type===types.CHOOSE_SYMBOL_REWARD;
  });
  const reward=hand.filter(c=>{
   const e=effects.buildPlayEffects(c);
   return effects.getCardModel(c)?.cardType===0&&e.length===1&&e[0].type===types.REMOVE_TRACE_FOR_REGION_REWARD&&!Object.values(effects.getCardPlayCost(c)).some(n=>n>0);
  });
  return source.length===1&&reward.length===1?{source:source[0].id,card:reward[0].id}:null;
 }
 function quoteAmibaRegionFollowup({state,seatId,purpose,continueKnownSwap=null,continueAnalysis=null}){
  const p=owner(state,seatId),slot=state.aliens.amiba?.revealedSlotId;
  const card=p.hand.find(c=>c.id===purpose.card),positions=data.listComputerPlacedTokens(p).map(t=>t.placementSlot);
  if(!slot||!card||!p.reservedCards.some(c=>c.id===purpose.source)||positions.length+p.resources.availableData<6
    ||positions.some((slot,i)=>slot!==i+1)||Object.values(effects.getCardPlayCost(card)).some(n=>n>0)
    ||state.turn.cardTurnEventBonuses?.length
    ||p.reservedCards.some(c=>!effects.getCardModel(c)||effects.getCardModel(c).temporaryTasks?.length)
    ||effects.listPendingTriggerKeys(p,state.turn).length)return null;
  const total=(s,p)=>endScoring.computePlayerFinalScore({...s,players:s.players.players,currentPlayer:p,
   finalScoring:structuredClone(s.finalScoring),aliens:structuredClone(s.aliens),cardEffects:effects,
   getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)},p).totalScore;
  const base=total(state,p),capital=demand.planningCapital(state,p),weights=stateValue.DEFAULT_WEIGHTS,rows=[];
  const visible={aliens:structuredClone(state.aliens),meta:structuredClone(state.meta)};
  // The Native removal menu first migrates public first traces onto the
  // species board. Without it a legal position-1 removal vanishes.
  aliens.amiba.migrateLegacyTraces(visible.aliens,slot,{takeSequence:()=>visible.meta.sequences.alienEntity++});
  for(const choice of aliens.amiba.listPlayerTraceOptions(visible.aliens,slot,p)){
   const symbols=aliens.amiba.listSymbolsInRegion(visible.aliens,choice.region);
   if(!symbols.length||symbols.some(x=>x.reward?.pickCard||x.reward?.pickAlienCard))continue;
   const anonymous=symbols.reduce((n,x)=>n+(x.reward?.drawCards||0),0),stock=symbols.reduce((n,x)=>n+(x.reward?.dataCount||0),0);
   if(anonymous&&(anonymous!==1||!stock||p.resources.availableData+stock>players.RESOURCE_LIMITS.availableData
     ||!state.cards.drawPileCardIds?.length||p.hand.some(c=>c.hidden)
     ||p.reservedCards.some(c=>effects.getCardModel(c)?.triggers?.some(trigger=>(trigger.event.types||[trigger.event.type])
       .some(type=>["drawCard","drawCards","amiba_symbol_resolved","amiba_trace_removed"].includes(type))))))continue;
   const copy=dataPreviewPlayer(p),q={...state,meta:structuredClone(visible.meta),aliens:structuredClone(visible.aliens),
    players:{...state.players,players:state.players.players.map(v=>v.id===seatId?copy:v)}};
   copy.hand=copy.hand.filter(c=>c.id!==card.id);copy.resources.handSize=copy.hand.length;
   if(!aliens.amiba.removePlayerTrace(q.aliens,slot,choice.traceType,choice.position,copy).ok)continue;
   let valid=true;
   for(const x of symbols){
    players.gainResources(copy,x.reward?.gain||{});
    for(let i=0;i<(x.reward?.dataCount||0);i++)if(!data.gainData(copy,{root:q}).ok)valid=false;
   }
   if(!valid||!aliens.amiba.resolveRegionReward(q.aliens,choice.region).ok
     ||state.finalScoring.thresholds.some(n=>n>p.resources.score&&n<=copy.resources.score))continue;
   copy.mainActionCompleted=true;
   const linear=Object.entries(weights).reduce((n,[k,w])=>n+(copy.resources[k]-p.resources[k])*w,0);
   const directCapital=demand.planningCapital(q,copy);
   // Awarding this known data does not require identifying the blind card.
   // Count the hand increment separately; no hand/tool/swap query can use it.
   const direct=stateValue.sumValueParts([total(q,copy),-base,linear,directCapital,-capital,anonymous*weights.handSize]);
   const swap=anonymous?null:continueKnownSwap?.(q,copy,directCapital);
   const analysisFunding=continueAnalysis?.(q,copy,anonymous);
   const value=stateValue.sumValueParts([direct,Math.max(0,swap?.value||0,analysisFunding?.value||0)]);
   if(value>0)rows.push({value,direct,cardId:card.id,traceType:choice.traceType,position:choice.position,region:choice.region,
    symbols:symbols.map(x=>x.symbolId),score:copy.resources.score-p.resources.score,data:copy.resources.availableData-p.resources.availableData,
    ...(anonymous?{anonymousDrawCount:anonymous}:{}),...(swap?.value>0?{companySwap:swap}:{}),
    ...(analysisFunding?.value>0?{analysisFunding}:{})});
  }
  return rows.sort((a,b)=>b.value-a.value||a.traceType.localeCompare(b.traceType)||a.position-b.position)[0]||null;
 }
 function preparedRegionPurpose({state,seatId,knownCards}){
  const p=owner(state,seatId),t=state.turn,types=aliens.amiba.EFFECT_TYPES;
  if(t.roundNumber!==3||t.currentPlayerId!==seatId||p.passCompletionPending
    ||!t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id))
    ||p.resources.credits!==0||p.resources.energy!==1||p.hand.length!==3
    ||[...p.hand,...p.reservedCards].some(c=>!knownCards.has(c.id))
    ||turnHasScanObservers(state,p)||state.pieces.rockets.some(r=>r.playerId===seatId||r.color===p.color)
    ||!state.aliens.amiba?.revealInitialized)return null;
  const slots=data.listComputerPlacedTokens(p).map(x=>x.placementSlot);
  if(slots.length<4||slots.length>6||slots.length+p.resources.availableData!==7||slots.some((s,i)=>s!==i+1))return null;
  const source=p.reservedCards.filter(c=>{
   const e=effects.buildPlayEffects(c);
   return e.length===2&&e[0].type==='gain_data'&&e[0].options?.count>=2&&e[1].type===types.CHOOSE_SYMBOL_REWARD;
  });
  const remover=p.hand.filter(c=>{
   const e=effects.buildPlayEffects(c);
   return effects.getCardModel(c)?.cardType===0&&e.length===1&&e[0].type===types.REMOVE_TRACE_FOR_REGION_REWARD
     &&!Object.values(effects.getCardPlayCost(c)).some(n=>n>0);
  });
  return source.length===1&&remover.length===1?{source:source[0].id,card:remover[0].id}:null;
 }
 function quotePreparedRegionAnalysis({state,seatId,knownCards,knownTech,knownAlienDisplay,purpose}){
  const p=owner(state,seatId);
  if(data.listComputerPlacedTokens(p).length!==6||p.resources.availableData!==1)return null;
  return quoteAmibaRegionFollowup({state,seatId,purpose,continueAnalysis:(q,actor,anonymous)=>{
   if(anonymous!==1||actor.resources.availableData!==2||actor.hand.length!==2)return null;
   const withOpaque={...actor,hand:[...actor.hand,{hidden:true,faceUp:false}],resources:{...actor.resources,handSize:actor.hand.length+1}};
   const next={...q,players:{...q.players,players:q.players.players.map(v=>v===actor?withOpaque:v)}};
   return quoteReadyAnalysisFunding({state:next,seatId,knownCards,knownTech,knownAlienDisplay});
  }});
 }
 function fillQuietAnalysisComputer(state,seatId,stock=7){
  const p=owner(state,seatId),slots=data.listComputerPlacedTokens(p).map(x=>x.placementSlot);
  if(slots.length<4||slots.length>6||slots.some((s,i)=>s!==i+1)||slots.length+p.resources.availableData!==stock)return null;
  if(slots.length===6)return state;
  const copy=dataPreviewPlayer(p);
  for(let i=slots.length+1;i<=6;i++){
   const placed=data.placeDataToComputer(copy);
   if(!placed.ok||placed.placementSlot!==i||placed.slotBonuses.length
     ||effects.collectMatchingTriggers(copy,{type:'placeData',playerId:seatId,placementKind:'computer',placementSlot:i}).length)return null;
  }
  return {...state,players:{...state.players,players:state.players.players.map(v=>v===p?copy:v)}};
 }
 function previewAnalysisPreparation({state,seatId,knownCards,knownTech,knownAlienDisplay,purpose}){
  if(!owner(state,seatId).mainActionCompleted)return null;
  const ready=fillQuietAnalysisComputer(state,seatId);
  const quote=ready&&ready!==state&&quotePreparedRegionAnalysis({state:ready,seatId,knownCards,knownTech,knownAlienDisplay,purpose});
  return quote?.analysisFunding?quote:null;
 }
 function previewReversedAnalysisPreparation({state,seatId,knownCards,knownTech,knownAlienDisplay}){
  const p=owner(state,seatId);
  if(!p.mainActionCompleted||p.resources.availableData<3||p.resources.availableData>4)return null;
  const ready=fillQuietAnalysisComputer(state,seatId,8);
  return ready&&ready!==state?quoteReadyAnalysisFunding({state:ready,seatId,knownCards,knownTech,knownAlienDisplay}):null;
 }
    function preserveResearchInThreeCornerIncome(state,p,goal){
      const source=p.hand.find(c=>c.id===goal.incomeCardId),gain=source&&cards.getIncomeGainForCard(source);
      if(gain?.energy!==1||Object.keys(gain).length!==1||!tech.listTakeableTiles(state.tech,p.techState).length)return null;
      const publicity=card=>cards.getDiscardActionRewardForCard(card)?.gain?.publicity||0;
      const need=tech.getResearchPublicityCost(p)-p.resources.publicity-(data.getComputerSlotBonus(2)?.publicity||0);
      if(need<=0||publicity(source)!==need||p.hand.filter(c=>publicity(c)>=need).length!==1)return null;
      const supplier=p.hand.filter(c=>{
        const effect=cards.getIncomeGainForCard(c);
        return c!==source&&effect?.energy===1&&Object.keys(effect).length===1
          &&!(cards.getDiscardActionRewardForCard(c)?.dataCount>0)&&publicity(c)<need;
      }).sort((a,b)=>publicity(a)-publicity(b)||a.id.localeCompare(b.id))[0];
      return supplier?{...goal,incomeCardId:supplier.id}:null;
    }

 function previewAnalysisSwapSupply({state,seatId,knownCards,knownAlienDisplay,readyNow=false,emptyPool=false}){
  const p=owner(state,seatId),t=state.turn;
  if(p.industryRoundMarkRound===t.roundNumber||data.listComputerPlacedTokens(p).length!==(readyNow||emptyPool?6:4)
    ||[...p.hand,...p.reservedCards].some(c=>!knownCards.has(c.id))
    ||p.hand.filter(c=>cards.getDiscardActionRewardForCard(c)?.dataCount===1).length!==(readyNow?2:1))return null;
  const incoming=state.cards.publicCards.filter(c=>{
   const corner=c&&cards.getDiscardActionRewardForCard(c);
   const gain=c&&cards.getIncomeGainForCard(c);
   return c&&knownCards.has(c.id)&&corner?.dataCount===1&&!Object.keys(corner.gain).length
    &&(!emptyPool||gain?.credits===1&&Object.keys(gain).length===1);
  });
  const outgoing=p.hand.filter(c=>{
   const gain=cards.getIncomeGainForCard(c),corner=cards.getDiscardActionRewardForCard(c);
   return gain?.credits===1&&Object.keys(gain).length===1&&!(corner?.dataCount>0)&&!cards.getDiscardActionMoveRewardForCard(c);
  });
  const analysis={seatId,knownCards,knownAlienDisplay,prepare:!readyNow&&!emptyPool,allowKnownTraceWithoutCard:readyNow,...(emptyPool?{emptyPool:true,minimumHand:3}:{})};
  if((emptyPool?incoming.length<1:incoming.length!==1)||outgoing.length!==1
    ||quoteLateAnalysisIncome({state,...analysis,allowThreeCorners:readyNow}))return null;
  const before=demand.planningCapital(state,p),ranked=[];
  for(const card of incoming){
   const copy=dataPreviewPlayer(p);
   copy.hand=copy.hand.map(c=>c===outgoing[0]?card:c);
   copy.industryRoundMarkRound=t.roundNumber;copy.industryRoundMarkTurn=t.turnNumber;
   const preview={...state,cards:{...state.cards,publicCards:state.cards.publicCards.map(c=>c===card?(emptyPool?outgoing[0]:null):c)},
    players:{...state.players,players:state.players.players.map(v=>v===p?copy:v)}};
   const quote=quoteLateAnalysisIncome({state:preview,...analysis,allowThreeCorners:true});
   if(!quote?.corners.includes(card.id))continue;
   const netGain=stateValue.sumValueParts([quote.value,demand.planningCapital(preview,copy),-before]);
   if(netGain>0)ranked.push({goal:{kind:'known-late-analysis-supply',id:'income:company-data:'+card.id,netGain,quote},
    discardIds:[outgoing[0].id],selection:{cardId:card.id,blind:false},reason:'company-data-funds-electricity-income'});
  }
  return ranked.sort((a,b)=>b.goal.netGain-a.goal.netGain||a.selection.cardId.localeCompare(b.selection.cardId))[0]||null;
 }
 function blueCashCard(card){
  if(card.set!=='alien:阿米巴')return null;
  const cost=effects.getCardPlayCost(card),play=effects.buildPlayEffects(card);
  return cost.credits===1&&Object.keys(cost).length===1&&play.length===2
    &&play[0].type==='pick_card'&&play[0].options?.count===1
    &&play[1].type===aliens.amiba.EFFECT_TYPES.CHOOSE_SYMBOL_REWARD?play[1].options?.region:null;
 }
 function knownBlueCashOffers(state,knownCards){
  return state.cards.publicCards.filter(c=>{
   const corner=c&&cards.getDiscardActionRewardForCard(c),income=c&&cards.getIncomeGainForCard(c);
   return c&&knownCards.has(c.id)&&corner?.dataCount===1&&!Object.keys(corner.gain).length
    &&income?.credits===1&&Object.keys(income).length===1;
  });
 }
 function quoteBlueCashAnalysis({state,seatId,knownCards,knownAlienDisplay,cardId}){
  const p=owner(state,seatId),t=state.turn;
  if(p.resources.credits!==1||p.resources.energy!==0||p.resources.availableData||p.hand.length!==3
    ||p.passCompletionPending||p.industryRoundMarkRound===t.roundNumber||data.listComputerPlacedTokens(p).length!==6
    ||[...p.hand,...p.reservedCards].some(c=>!knownCards.has(c.id))||turnHasScanObservers(state,p))return null;
  const card=p.hand.find(c=>c.id===cardId),region=card&&blueCashCard(card);
  const symbols=region&&aliens.amiba.listSymbolsInRegion(state.aliens,region);
  const reward=symbols?.length===1&&symbols[0].reward,gain=reward?.gain;
  if(!gain||Object.keys(gain).join(',')!=='score'||!Number.isSafeInteger(gain.score)||gain.score<=0
    ||reward.dataCount||reward.drawCards||reward.pickCard||reward.pickAlienCard
    ||state.finalScoring.thresholds.some(n=>n>p.resources.score&&n<=p.resources.score+gain.score)
    ||effects.listPendingTriggerKeys(p,t).length
    ||p.reservedCards.some(c=>effects.getCardModel(c)?.triggers?.some(x=>(x.event.types||[x.event.type])
      .some(type=>['playCard','drawCard','drawCards','amiba_symbol_resolved'].includes(type)))))return null;
  const offers=knownBlueCashOffers(state,knownCards);
  if(offers.length!==2)return null;
  const copy=dataPreviewPlayer(p);
  if(!players.spendResources(copy,{credits:1}).ok)return null;
  copy.hand=copy.hand.map(c=>c===card?offers[0]:c);
  copy.reservedCards=[...p.reservedCards,card];copy.mainActionCompleted=true;
  const preview={...state,meta:structuredClone(state.meta),aliens:structuredClone(state.aliens),
    cards:{...state.cards,publicCards:state.cards.publicCards.map(c=>c===offers[0]?null:c)},
    players:{...state.players,players:state.players.players.map(v=>v===p?copy:v)}};
  if(!aliens.amiba.resolveSymbolAtSlot(preview.aliens,symbols[0].slotId).ok)return null;
  players.gainResources(copy,gain);
  const swap=previewAnalysisSwapSupply({state:preview,seatId,knownCards,knownAlienDisplay,emptyPool:true});
  if(!swap||swap.selection.cardId!==offers[1].id)return null;
  const total=(s,q)=>endScoring.computePlayerFinalScore({...s,players:s.players.players,currentPlayer:q,
    finalScoring:structuredClone(s.finalScoring),aliens:structuredClone(s.aliens),cardEffects:effects,
    getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)},q).totalScore;
  const value=stateValue.sumValueParts([total(preview,copy),-total(state,p),-1,demand.planningCapital(preview,copy),
    -demand.planningCapital(state,p),swap.goal.netGain]);
  return value>0?{value,cardId,pickedCardId:offers[0].id,knownSwapCardId:offers[1].id,analysis:swap.goal.quote}:null;
 }
 // Price the one fully visible delivery only after funding its spare pool
 // slots. Compare both leaves after those same placements, so the forecast
 // credits the reward and does not count the computer placements themselves.
 function knownDeliveredCargo({state,seatId,knownCards,knownFossilIds}){
  const p=owner(state,seatId),chong=aliens.chong;
  const jobs=Object.values(state.aliens.chong?.transportTasksByRocketId||{});
  if(jobs.length!==1||!jobs[0].delivered||!knownFossilIds.has(jobs[0].fossilId))return null;
  const [job]=jobs;
  const matching=p.reservedCards.filter(c=>{
   const task=c.chongTask||chong.getCardTask(c);
   return !c.chongTaskCompleted&&task?.kind==='transport'&&task.destinationPlanetId===job.destinationPlanetId;
  });
  if(matching.length!==1||matching[0].id!==job.cardId||!knownCards.has(job.cardId))return null;
  const card=matching[0],rule=card.chongTask||chong.getCardTask(card),ruleId=rule.id||rule.kind;
  const reward=chong.getFossilReward(job.fossilId);
  if(rule.dataCount!==2||rule.fossilRewardRepeat!==1||Object.keys(rule.gain||{}).length
    ||rule.effects||rule.rewards||rule.pickCard||rule.pickAlienCard||rule.drawCards
    ||!reward||reward.dataCount||reward.drawCards||reward.pickCard||reward.pickAlienCard||reward.chooseFossilRewardOnly
    ||Object.keys(reward.gain||{}).length!==1||!(reward.gain.credits>0))return null;
  return {card,rule,ruleId,reward,job};
 }
 function previewKnownCargoClaim({state,seatId,cargo}){
  const {card,rule,ruleId,reward,job}=cargo;
  // The audited delivery only changes the task owner, the data sequence,
  // cards, the fossil panel and its transport piece. Frozen board geometry
  // and other players can be shared by subsequent read-only quotes.
  const p=owner(state,seatId);
  const claim=Object.isFrozen(state)?{...state,...structuredClone({
    meta:state.meta,pieces:state.pieces,aliens:state.aliens,cards:state.cards
  }),players:{...state.players,players:state.players.players.map(q=>q===p?structuredClone(q):q)}}:structuredClone(state);
  const r=owner(claim,seatId);
  const settlement=residual.queryCardSettlement(claim,seatId,{kind:'chong_task',cardInstanceId:card.id,ruleId});
  if(settlement?.fossilId!==job.fossilId)return null;
  const applied=residual.settleReadyTaskDirect(claim,seatId,card.id,ruleId);
  if(!applied.ok)throw new Error('KNOWN_TRANSPORT_SETTLEMENT_FAILED:'+applied.code);
  const dataGain=r.resources.availableData-p.resources.availableData,credits=r.resources.credits-p.resources.credits;
  const expectedData=Math.min(rule.dataCount,players.RESOURCE_LIMITS.availableData-p.resources.availableData);
  if(applied.spawnedEffects.length||applied.irreversible||dataGain!==expectedData||credits!==reward.gain.credits
    ||r.hand.length!==p.hand.length||r.completedTaskCount!==(p.completedTaskCount||0)+1)return null;
  return {state:claim,player:r,dataGain,credits};
 }
 function quoteDeferredCargo({state,seatId,knownCards,knownFossilIds}){
  const t=state.turn,p=owner(state,seatId);
  if(t.roundNumber!==4||t.currentPlayerId!==seatId||t.gameEnded||p.mainActionCompleted
    ||t.passedPlayerIds.includes(seatId)||!t.activePlayerIds.includes(seatId)
    ||!t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id))
    ||p.passCompletionPending||Object.keys(t.cardTurnEventBonuses||{}).length
    ||p.reservedCards.some(c=>!knownCards.has(c.id)))return null;
  const cargo=knownDeliveredCargo({state,seatId,knownCards,knownFossilIds});
  if(!cargo)return null;
  const {card,rule,ruleId,reward,job}=cargo;
  const overflow=p.resources.availableData+rule.dataCount-players.RESOURCE_LIMITS.availableData;
  if(overflow<1||overflow>2||p.dataState.poolTokens.length!==p.resources.availableData)return null;
  const ready=structuredClone(state),q=owner(ready,seatId),slots=[];
  for(let i=0;i<overflow;i++){
   const result=data.placeDataToComputer(q),slot=result.placementSlot;
   if(!result.ok||![5,6].includes(slot)||result.slotBonuses.length
     ||effects.collectMatchingTriggers(q,{type:'placeData',playerId:seatId,placementKind:'computer',placementSlot:slot}).length)return null;
   slots.push(slot);
  }
  const applied=previewKnownCargoClaim({state:ready,seatId,cargo});
  if(!applied||applied.dataGain!==rule.dataCount)return null;
  const {state:claim,player:r,dataGain,credits}=applied;
  const total=(s,p)=>endScoring.computePlayerFinalScore({...s,players:s.players.players,currentPlayer:p,cardEffects:effects,
    getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)},p).totalScore;
  const established=total(claim,r)-total(ready,q),weights=stateValue.DEFAULT_WEIGHTS;
  const value=stateValue.sumValueParts([established,demand.planningCapital(claim,r),-demand.planningCapital(ready,q),
   credits*weights.credits,dataGain*weights.availableData]);
  return value>0?{value,cardId:card.id,fossilId:job.fossilId,slots,credits,dataGain,established}:null;
 }
 // This is an additional final-round cash-out choice. A card that is
 // still a useful input to another plan is not removed from that plan.
 function scoredEndCorner({state,seatId,actions,knownCards}){
  const p=owner(state,seatId),t=state.turn;
  if(t.roundNumber!==4||!p.mainActionCompleted||p.resources.availableData!==0
    ||p.dataState.poolTokens.length||p.passCompletionPending
    ||t.passedPlayerIds.includes(seatId)||!t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id))
    ||Object.keys(t.cardTurnEventBonuses||{}).length||p.industryBorrowedTechTileId
    ||Object.keys(state.aliens.chong?.transportTasksByRocketId||{}).length
    ||p.reservedCards.some(c=>!knownCards.has(c.id))
    ||data.listComputerPlacedTokens(p).length!==4||data.listBlueBonusPlacedTokens(p).length<2
    ||finalScoring.getPendingMarksForPlayer(structuredClone(state.finalScoring),p).length
    ||state.finalScoring.thresholds.some(n=>n>p.resources.score&&n<=p.resources.score+1))return null;
  const picks=actions.flatMap(a=>{
   if(a.family!=='card_corner'||a.payload?.kind!=='resource'||a.payload.multiplier!==1)return [];
   const c=p.hand.find(c=>c.id===a.target.cardInstanceId&&knownCards.has(c.id));
   const reward=c&&cards.getDiscardActionRewardForCard(c);
   return reward?.dataCount===1&&reward.gain.score===1&&Object.keys(reward.gain).length===1?[{a,c,reward}]:[];
  });
  if(picks.length!==1)return null;
  const {a,c,reward}=picks[0],copy=dataPreviewPlayer(p);
  if(effects.collectMatchingTriggers({...copy,reservedCards:structuredClone(copy.reservedCards)},{type:'cardCorner',playerId:seatId,
     cardInstanceId:c.id,cornerCode:cards.normalizeDiscardActionTriggerCode(reward.code),cornerKind:'resource'}).length)return null;
  const q={...state,meta:structuredClone(state.meta),players:{...state.players,players:state.players.players.map(v=>v===p?copy:v)}};
  if(!data.gainData(copy,{root:q}).ok||!cards.discardFromHandAtIndex(copy,copy.hand.findIndex(v=>v.id===c.id)).ok)return null;
  players.gainResources(copy,{score:1});
  const total=(s,p)=>endScoring.computePlayerFinalScore({...s,aliens:structuredClone(s.aliens),finalScoring:structuredClone(s.finalScoring),
    players:s.players.players,currentPlayer:p,cardEffects:effects,getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)},p).totalScore;
  const capital=stateValue.sumValueParts([demand.planningCapital(q,copy),-demand.planningCapital(state,p)]);
  const weights=stateValue.DEFAULT_WEIGHTS,value=stateValue.sumValueParts([total(q,copy)-total(state,p),capital,weights.availableData,-weights.handSize]);
  return value>0?{actionId:a.actionId,cardId:c.id,value,capital}:null;
 }
 function knownFossilTraceQuotes({state,player,actions,symbols,knownAmibaDisplay,knownChongDisplay}){
  if(probeCapital.ownedProbes(state.pieces.rockets,player).length)return [];
  const weights=stateValue.DEFAULT_WEIGHTS,quotes=[];
  const finalScoringBoard=structuredClone(state.finalScoring);
  const context={...state,finalScoring:finalScoringBoard,players:state.players.players,cardEffects:effects,
   getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)};
  const pureScore=r=>r&&Object.keys(r.gain||{}).every(k=>k==='score')
   &&Object.keys(r).every(k=>['gain','region','pickAlienCard'].includes(k)||!r[k]);
  for(const action of actions){
   const a=action.target,slot=aliens.getAlienSlot(state.aliens,a?.alienSlotId);
   if(action.actorId!==player.id||action.family!=='choose_target'||a?.kind!=='planet-reward-alien-trace'
     ||a.traceType!=='pink'||a.fangzhouUnlock||!slot?.revealed||!slot.traces?.pink?.firstPlaced
     ||!['阿米巴','虫'].includes(slot.alienId))continue;
   const species=aliens.getSpeciesTraceApi(slot);
   if(!a.stateExtra&&a.speciesId!==species?.speciesId)continue;
   const region=!a.stateExtra&&species.speciesId==='amiba'?'red':null;
   if(effects.hasMatchingTrigger(player,{type:'alienTrace',playerId:player.id,traceType:'pink',alienSlotId:a.alienSlotId,region}))continue;
   const copy={...player,resources:{...player.resources},scoreSources:{...player.scoreSources}};
   const board=structuredClone(state.aliens);
   const placed=aliens.placeTraceForActor(players,board,copy,a.alienSlotId,'pink',a.position,
    {stateExtra:!!a.stateExtra,sequence:state.meta.sequences.alienEntity});
   if(!placed.ok)throw new Error('FOSSIL_TRACE_QUOTE_STALE: '+action.actionId);
   let handGain=0;
   if(!a.stateExtra){
    const reward=placed.reward;
    if(!pureScore(reward)||(reward.region||null)!==region)continue;
    if(reward.pickAlienCard){
     const index=species.speciesId==='amiba'?knownAmibaDisplay:knownChongDisplay;
     if(!Number.isSafeInteger(index)||state.aliens[species.speciesId]?.displayedCardIndex!==index
       ||!species.api.getCardDefinition(index)
       ||effects.hasMatchingTrigger(player,{type:'alien_card_gain',playerId:player.id,alienId:slot.alienId,source:'display'}))continue;
     // The window closes before any use of the card. Only hand count is
     // needed; do not inspect or simulate the replacement display.
     handGain=1;
    }
    players.gainResources(copy,reward.gain,'alienTracePinkScore');
    if(region&&symbols.length){
     for(const {reward:gain} of symbols)players.gainResources(copy,gain.gain,'alienEffectScore');
     if(!aliens.amiba.resolveRegionReward(board,region).ok)throw new Error('FOSSIL_TRACE_REGION_INVALID');
    }
   }
   const established=endScoring.computePlayerFinalScore({...context,aliens:board},copy).totalScore;
   const resources=Object.entries(weights).reduce((n,[k,w])=>n+(k==='handSize'?0:copy.resources[k]*w),0);
   quotes.push({actionId:action.actionId,established,handGain,
    value:stateValue.sumValueParts([established,resources,(player.hand.length+handGain)*weights.handSize])});
  }
  return quotes;
 }
 // Score dominance within this turn's visible window only. The Native
 // slots remain different; keep both when any later choice can use that fact.
 function pinkScoreBeforeUnknownFossil({state,seatId,actions,session,knownCards,knownFossilIds,knownAmibaDisplay,knownChongDisplay,rankKnownFossilTraces=false}){
  const [head,pickup]=session?.queue||[],origin=session?.journal?.actions?.[0]?.action;
  if(session?.queue.length!==2||session.interruptContext||head?.ownerId!==seatId||head.allowQuickActions
    ||head.type!==science.EFFECT_TYPES.ALIEN_TRACE||head.payload?.traceType!=='pink'||Object.keys(head.payload).length!==1
    ||pickup.type!=='card_play_domain_effect:effect:chong_pickup_fossil'||pickup.ownerId!==seatId||pickup.allowQuickActions
    ||pickup.kind!=='effect'||origin?.family!=='play_card'||pickup.payload?.cardInstanceId!==origin.target.cardInstanceId)return null;
  const p=owner(state,seatId),t=state.turn,amiba=aliens.amiba;
  if(t.roundNumber!==4||t.currentPlayerId!==seatId||t.gameEnded||!p?.mainActionCompleted||p.passCompletionPending
    ||t.cardTurnEventBonuses?.length||!t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id))
    ||p.reservedCards.some(c=>!knownCards.has(c.id))||residual.hasPendingFossilArrival(state))return null;
  const byPosition=new Map(actions.filter(a=>a.actorId===seatId&&a.family==='choose_target'
    &&a.target?.kind==='planet-reward-alien-trace'&&a.target.traceType==='pink'&&a.target.speciesId==='amiba'
    &&[1,2,3,4].includes(a.target.position)).map(a=>[a.target.position,a]));
  if(!(byPosition.has(1)&&byPosition.has(2)||byPosition.has(3)&&byPosition.has(4)))return null;
  const slotId=state.aliens.amiba?.revealedSlotId,slot=aliens.getAlienSlot(state.aliens,slotId);
  if(!slot?.revealed||slot.alienId!=='阿米巴'||aliens.isAlienReadyToReveal(slot)
    ||[...byPosition.values()].some(a=>String(a.target.alienSlotId)!==String(slotId)))return null;
  const score=p.resources.score;
  if(!state.finalScoring.thresholds.every(n=>n<=score&&Object.values(state.finalScoring.tiles).some(tile=>
    tile.marks?.some(mark=>mark.playerId===seatId&&Number(mark.threshold)===n))))return null;
  const symbols=amiba.listSymbolsInRegion(state.aliens,'red',{readOnlyRewards:true});
  if(symbols.some(({reward})=>!reward||Object.keys(reward.gain).some(k=>k!=='score')
    ||Object.keys(reward).some(k=>k!=='gain'&&reward[k])))return null;
  const events=[{type:'alienTrace',playerId:seatId,traceType:'pink',alienSlotId:Number(slotId),region:'red'},
    {type:'card_effect',playerId:seatId,effectType:amiba.EFFECT_TYPES.RESOLVE_REGION_REWARD},
    ...symbols.map(({symbolId,slotId})=>({type:'amiba_symbol_resolved',symbolId,slotId,region:'red'}))];
  if(events.some(event=>effects.hasMatchingTrigger(p,event)))return null;
  const planet=state.match?.cardPlayContext?.lastLanding?.planetId;
  const fossils=['jupiter','saturn'].includes(planet)&&aliens.chong.getAvailablePlanetFossils(state.aliens,planet);
  if(!fossils?.length||fossils.some(f=>knownFossilIds.has(f.fossilId)))return null;
  const omitted=[],proof=[];
  const quotes=rankKnownFossilTraces
   ?knownFossilTraceQuotes({state,player:p,actions,symbols,knownAmibaDisplay,knownChongDisplay}):[];
  if(quotes.length>1){
   const top=Math.max(...quotes.map(q=>q.value));
   for(const q of quotes)if(q.value<top)omitted.push(q.actionId);
   if(omitted.length)return {policy:'seti-ranked-pink-before-hidden-fossil-v1',kind:'rank-automatic-scan-traces',
    fixed:false,isEquivalence:false,retainedActionIds:actions.filter(a=>!omitted.includes(a.actionId)).map(a=>a.actionId),
    excludedActionIds:omitted,quotes};
  }
  for(const n of [1,3]){
   const low=byPosition.get(n),high=byPosition.get(n+1);
   if(!low||!high)continue;
   const card=n===3;
   if(card&&(!Number.isSafeInteger(knownAmibaDisplay)||state.aliens.amiba.displayedCardIndex!==knownAmibaDisplay
     ||effects.hasMatchingTrigger(p,{type:'alien_card_gain',playerId:seatId,alienId:'阿米巴',source:'display'})))continue;
   const a=amiba.getTraceReward(state.aliens,'pink',n,{readOnlyRewards:true}),
    b=amiba.getTraceReward(state.aliens,'pink',n+1,{readOnlyRewards:true});
   const sameReward=r=>r?.region==='red'&&Boolean(r.pickAlienCard)===card
    &&Object.keys(r.gain).every(k=>k==='score')&&Object.keys(r).every(k=>['gain','region','pickAlienCard'].includes(k)||!r[k]);
   if(!sameReward(a)||!sameReward(b)||(b.gain.score||0)-(a.gain.score||0)!==1)continue;
   omitted.push(low.actionId);
   proof.push({lower:low.actionId,higher:high.actionId,scoreDelta:1,sameRegion:'red',sameFixedCardReward:card});
  }
  return omitted.length?{policy:'seti-pink-score-before-hidden-fossil-v1',kind:'rank-automatic-scan-traces',
   fixed:false,isEquivalence:false,retainedActionIds:actions.filter(a=>!omitted.includes(a.actionId)).map(a=>a.actionId),
   excludedActionIds:omitted,proof}:null;
 }
 // Price only automatic trace rewards. Any real card/fossil selection
 // remains a native branch. This uses the same alien placement primitives.
 function previewQuietPinkTrace({state,seatId,action}){
  const target=action.target,slot=aliens.getAlienSlot(state.aliens,target?.alienSlotId);
  if(action.family!=='choose_target'||target?.traceType!=='pink'||!slot?.revealed
    ||!['虫','阿米巴'].includes(slot.alienId)||target.fangzhouUnlock)return null;
  const source=owner(state,seatId),p={...source,resources:{...source.resources},
   scoreSources:{...source.scoreSources},reservedCards:structuredClone(source.reservedCards)};
  const q={...state,aliens:structuredClone(state.aliens),
   players:{...state.players,players:state.players.players.map(x=>x===source?p:x)}};
  const placed=aliens.placeTraceForActor(players,q.aliens,p,target.alienSlotId,'pink',target.position,
   {stateExtra:!!target.stateExtra,sequence:q.meta.sequences.alienEntity});
  if(!placed.ok)throw new Error('KNOWN_SCAN_TRACE_PLACEMENT_FAILED:'+placed.code);
  function pure(reward){
   if(!reward||reward.pickCard||reward.pickAlienCard||reward.drawCards||reward.dataCount
     ||reward.fossilPanel||reward.panelSymbol||reward.chooseFossilRewardOnly
     ||Object.keys(reward.gain||{}).some(k=>k!=='score'))return false;
   players.gainResources(p,reward.gain||{});
   return true;
  }
  // The shared extra-slot placement already awards its score.
  if(!target.stateExtra&&!pure(placed.reward))return null;
  const region=placed.reward?.region||null;
  const event={type:'alienTrace',playerId:seatId,traceType:'pink',alienSlotId:target.alienSlotId,alienId:slot.alienId,region};
  if(effects.collectMatchingTriggers(p,event).length||effects.collectMatchingTriggers(p,{...event,alienId:undefined}).length)return null;
  if(region){
   if(slot.alienId!=='阿米巴')return null;
   const symbols=aliens.amiba.listSymbolsInRegion(q.aliens,region);
   if(!symbols.every(x=>!x.reward?.region&&pure(x.reward)))return null;
   if(symbols.length&&!aliens.amiba.resolveRegionReward(q.aliens,region).ok)return null;
  }
  return {state:q,player:p};
 }
 function quoteAnalysisLaunchPick({state,seatId,knownCards,knownAlienDisplay,offers}){
  const p=owner(state,seatId),independent=p.resources.availableData===4;
  const analysis={seatId,knownCards,knownAlienDisplay,prepare:true,allowKnownTraceWithoutCard:independent};
  if(!p.mainActionCompleted||p.resources.credits!==0||p.resources.energy!==0||![3,4].includes(p.resources.availableData)||p.hand.length!==4
    ||data.listComputerPlacedTokens(p).length!==4||p.hand.filter(c=>cards.getDiscardActionRewardForCard(c)?.dataCount===1).length!==1
    ||quoteLateAnalysisIncome({state,...analysis}))return null;
  const choices=offers.filter(({card})=>{
   const corner=cards.getDiscardActionRewardForCard(card);
   return knownCards.has(card.id)&&corner?.dataCount===1&&!Object.keys(corner.gain).length;
  });
  if(choices.length!==1)return null;
  const {card,action}=choices[0],copy=dataPreviewPlayer(p);
  copy.hand.push(card);copy.resources.handSize=copy.hand.length;
  const preview={...state,cards:{...state.cards,publicCards:state.cards.publicCards.map(c=>c===card?null:c)},
    players:{...state.players,players:state.players.players.map(v=>v===p?copy:v)}};
  const quote=quoteLateAnalysisIncome({state:preview,...analysis,allowThreeCorners:true});
  return quote?.corners.includes(card.id)?{cardId:card.id,action,quote}:null;
 }
 function quoteLateAnalysisIncome({state,seatId,knownCards,knownAlienDisplay,prepare=false,minimumHand=4,allowThreeCorners=false,allowKnownTraceWithoutCard=false,emptyPool=false}){
  const p=owner(state,seatId),t=state.turn,amiba=state.aliens.amiba;
  if(t.roundNumber!==3||t.currentPlayerId!==seatId||t.gameEnded||p.passCompletionPending
    ||!t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id))
    ||p.resources.credits!==0||p.resources.energy!==0||(emptyPool?p.resources.availableData!==0:p.resources.availableData<1||p.resources.availableData>(prepare?4:3))
    ||p.hand.length<minimumHand||p.hand.length>5||[...p.hand,...p.reservedCards].some(c=>!knownCards.has(c.id))
    ||turnHasScanObservers(state,p)||Object.keys(state.aliens.chong?.transportTasksByRocketId||{}).length
    ||!amiba?.revealInitialized||amiba.displayedCardHidden||knownAlienDisplay===null||amiba.displayedCardIndex!==knownAlienDisplay
    ||!state.pieces.rockets.some(r=>r.playerId===seatId||r.color===p.color))return null;
  const end=quietEndCompletion({state,seatId});
  if(!end.available||end.markedTiles.length)return null;
  const stock=data.listComputerPlacedTokens(p).length+p.resources.availableData;
  const ready=prepare?fillQuietAnalysisComputer(state,seatId,stock===8?8:7):state;
  if(!ready||data.listComputerPlacedTokens(owner(ready,seatId)).length!==6)return null;
  const alienId=String(amiba.revealedSlotId),quotes=[];
  const total=(s,q)=>endScoring.computePlayerFinalScore({...s,players:s.players.players,currentPlayer:q,
   finalScoring:structuredClone(s.finalScoring),aliens:structuredClone(s.aliens),cardEffects:effects,
   getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)},q).totalScore;
  const beforeScore=total(state,p),beforeCapital=demand.planningCapital(state,p);
  for(const position of aliens.amiba.TRACE_POSITIONS){
   const reward=aliens.amiba.getTraceReward(state.aliens,'blue',position);
   if(allowKnownTraceWithoutCard?(!reward||reward.pickAlienCard||reward.pickCard||reward.drawCards):!reward?.pickAlienCard)continue;
   const q=dataPreviewPlayer(owner(ready,seatId)),root={...ready,meta:structuredClone(ready.meta),aliens:structuredClone(ready.aliens),
    players:{...ready.players,players:ready.players.players.map(v=>v.id===seatId?q:v)}};
   if(!data.analyzeDataWithoutEnergy(q).ok)continue;
   q.mainActionCompleted=true;
   const trace=previewKnownAmibaTrace({root,copy:q,alienId,traceType:'blue',position,knownAlienDisplay,seatId});
   const three=allowThreeCorners&&trace&&q.resources.availableData===1
     &&(emptyPool?trace.displayed&&q.hand.length===4:q.hand.length===(trace.displayed?6:5))
     &&q.hand.filter(c=>cards.getDiscardActionRewardForCard(c)?.dataCount===1).length===3;
   if(!trace||(allowKnownTraceWithoutCard?trace.displayed||!three&&q.resources.availableData!==2:!trace.displayed)||q.resources.availableData!==2&&!three
     ||state.finalScoring.thresholds.some(n=>n>p.resources.score&&n<=q.resources.score+7))continue;
   let goal=demand.catalog({state:root,seatId,requirements:{bluePlacements:data.listBluePlacementRequirements(q)}}).find(g=>g.kind==='income');
   if(three&&goal)goal=preserveResearchInThreeCornerIncome(root,q,goal)||goal;
   if(!goal)continue;
   const fundedGoals=[goal],primary=q.hand.find(c=>c.id===goal.incomeCardId);
   if(stock===8&&q.resources.availableData===2&&cards.getIncomeGainForCard(primary)?.energy===1
     &&cards.getDiscardActionRewardForCard(primary)?.dataCount===1){
    const score=c=>cards.getDiscardActionRewardForCard(c)?.gain?.publicity||0;
    const dedicated=q.hand.filter(c=>{
     const gain=cards.getIncomeGainForCard(c);
     return c!==primary&&gain?.energy===1&&Object.keys(gain).length===1
      &&!(cards.getDiscardActionRewardForCard(c)?.dataCount>0);
    }).sort((a,b)=>score(a)-score(b)||a.id.localeCompare(b.id))[0];
    if(dedicated)fundedGoals.push({...goal,incomeCardId:dedicated.id});
   }
   for(const funded of fundedGoals){
    const incomeCard=q.hand.find(c=>c.id===funded.incomeCardId),gain=incomeCard&&cards.getIncomeGainForCard(incomeCard);
    if(gain?.energy!==1||Object.keys(gain).length!==1)continue;
    const actions=q.hand.filter(c=>cards.getDiscardActionRewardForCard(c)?.dataCount===1&&!cards.getDiscardActionMoveRewardForCard(c))
     .map(c=>({family:'card_corner',actionId:'known-corner:'+c.id,target:{cardInstanceId:c.id},payload:{kind:'resource',multiplier:1}}));
    const payment=demand.dataIncomeFunding({state:root,seatId,goal:funded,actions,maxCorners:three?3:2});
    if(!payment)continue;
    const paid=previewIncomeCompletion({state:payment.state,seatId,goal:funded});
    if(!paid.preview?.available||paid.placements!==4)continue;
    const after=paid.preview.player,completed={...payment.state,cards:{...payment.state.cards,
     removedFromGameCardIds:[...payment.state.cards.removedFromGameCardIds,incomeCard.cardId]},
     players:{...payment.state.players,players:payment.state.players.players.map(v=>v.id===seatId?after:v)}};
    const linear=Object.entries(stateValue.DEFAULT_WEIGHTS).reduce((n,[k,w])=>n+(after.resources[k]-p.resources[k]+after.income[k]-p.income[k])*w,0);
    const value=stateValue.sumValueParts([total(completed,after),-beforeScore,linear,demand.planningCapital(completed,after),-beforeCapital]);
    if(value>0)quotes.push({value,tracePosition:position,displayedCardId:trace.displayed?.cardId??null,incomeCardId:incomeCard.id,corners:payment.corners.map(c=>c.cardId)});
   }
  }
  return quotes.sort((a,b)=>b.value-a.value||a.tracePosition-b.tracePosition)[0]||null;
 }
 function quoteLatePublicDataPick({state,seatId,knownCards,knownAlienDisplay,region,offers}){
  const p=owner(state,seatId),slots=data.listComputerPlacedTokens(p).length;
  if(state.turn.roundNumber!==3||!p.mainActionCompleted||p.passCompletionPending||slots!==6||p.resources.availableData!==1
    ||p.resources.credits!==0||p.resources.energy!==0||p.hand.length!==2
    ||p.hand.some(c=>(cards.getDiscardActionRewardForCard(c)?.dataCount||0)>0)
    ||!p.hand.some(c=>cards.getIncomeGainForCard(c)?.energy===1)||!state.aliens.amiba?.revealInitialized)return null;
  const choices=offers.filter(({card})=>{
   const reward=cards.getDiscardActionRewardForCard(card);
   return knownCards.has(card.id)&&reward?.dataCount===1&&!Object.keys(reward.gain).length&&!cards.getDiscardActionMoveRewardForCard(card);
  });
  const symbols=aliens.amiba.listSymbolsInRegion(state.aliens,region);
  if(!choices.length||symbols.length!==1)return null;
  const {reward}=symbols[0],gain=reward?.gain;
  if(!gain||Object.keys(gain).join(',')!=='score'||!(gain.score>0)||reward.dataCount||reward.drawCards||reward.pickCard||reward.pickAlienCard
    ||state.finalScoring.thresholds.some(n=>n>p.resources.score&&n<=p.resources.score+gain.score))return null;
  if(p.reservedCards.some(c=>effects.getCardModel(c)?.triggers?.some(t=>(t.event.types||[t.event.type])
    .some(type=>['drawCard','drawCards','amiba_symbol_resolved'].includes(type)))))return null;
  const ranked=choices.flatMap(({card,action})=>{
   const copy=dataPreviewPlayer(p),preview={...state,meta:structuredClone(state.meta),aliens:structuredClone(state.aliens),
    cards:{...state.cards,publicCards:state.cards.publicCards.map(c=>c===card?null:c)},
    players:{...state.players,players:state.players.players.map(v=>v===p?copy:v)}};
   copy.hand.push(card);copy.resources.handSize=copy.hand.length;
   players.gainResources(copy,gain);
   if(!aliens.amiba.resolveSymbolAtSlot(preview.aliens,symbols[0].slotId).ok)return [];
   const quote=quoteLateAnalysisIncome({state:preview,seatId,knownCards,knownAlienDisplay,minimumHand:3});
   return quote?.corners.includes(card.id)?[{action,cardId:card.id,quote}]:[];
  });
  return ranked.sort((a,b)=>b.quote.value-a.quote.value||a.cardId.localeCompare(b.cardId))[0]||null;
 }
 function lateIncomePayment({state,seatId,knownCards,knownAlienDisplay,goals,trade}){
  const p=owner(state,seatId);
  if(p.mainActionCompleted||p.passCompletionPending||p.resources.credits!==0||p.resources.energy!==0||p.resources.availableData!==1
    ||p.hand.length!==5||data.listComputerPlacedTokens(p).length!==6
    ||[...p.hand,...p.reservedCards].some(c=>!knownCards.has(c.id))
    ||trade?.payload?.cost?.handSize!==2||Object.keys(trade.payload.cost).length!==1
    ||trade.payload.gain?.credits!==1||Object.keys(trade.payload.gain).length!==1)return null;
  const plays=goals.flatMap(goal=>{
   if(goal.kind!=='play_card'||goal.required.credits!==1||Object.keys(goal.required).length!==1)return [];
   const card=p.hand.find(c=>c.id===goal.cardId);
   if(!card||card.set!=='alien:阿米巴'||effects.getCardModel(card)?.cardType!==3)return [];
   const play=effects.buildPlayEffects(card),cost=effects.getCardPlayCost(card);
   return cost.credits===1&&Object.keys(cost).length===1&&play.length===2&&play[0].type==='pick_card'&&play[0].options?.count===1
    &&play[1].type===aliens.amiba.EFFECT_TYPES.CHOOSE_SYMBOL_REWARD&&play[1].options?.region
     ?[{goal,card,region:play[1].options.region}]:[];
  });
  if(plays.length!==1)return null;
  const {goal,card,region}=plays[0];
  const income=p.hand.filter(c=>{
   const gain=cards.getIncomeGainForCard(c),corner=cards.getDiscardActionRewardForCard(c);
   return c!==card&&gain?.energy===1&&Object.keys(gain).length===1&&!(corner?.dataCount>0);
  }).sort((a,b)=>(cards.getDiscardActionRewardForCard(a)?.gain?.publicity||0)-(cards.getDiscardActionRewardForCard(b)?.gain?.publicity||0)
    ||a.id.localeCompare(b.id))[0];
  if(!income)return null;
  // Slot 2 supplies one publicity. Preserve a different held corner
  // only when it uniquely pays the otherwise unfunded following research.
  const researchGap=tech.getResearchPublicityCost(p)-p.resources.publicity-(data.getComputerSlotBonus(2)?.publicity||0);
  const research=researchGap>0&&tech.listTakeableTiles(state.tech,p.techState).length
   ?p.hand.filter(c=>c!==card&&c!==income&&cards.getDiscardActionRewardForCard(c)?.gain?.publicity===researchGap):[];
  const goalWithSupplier={...goal,continuationCardId:income.id,...(research.length===1?{retainedResearchCardId:research[0].id}:{})};
  if(!demand.paymentCards(state,seatId,goal,2)?.includes(income.id))return null;
  const discard=demand.paymentCards(state,seatId,goalWithSupplier,2);
  if(!discard||!demand.capacity(state,seatId,goalWithSupplier))return null;
  const copy=dataPreviewPlayer(p),preview={...state,players:{...state.players,players:state.players.players.map(v=>v===p?copy:v)}};
  copy.hand=copy.hand.filter(c=>c!==card&&!discard.includes(c.id));copy.resources.handSize=copy.hand.length;
  copy.reservedCards=[...copy.reservedCards,card];copy.mainActionCompleted=true;
  const offers=state.cards.publicCards.filter(Boolean).map(card=>({card}));
  const proof=quoteLatePublicDataPick({state:preview,seatId,knownCards,knownAlienDisplay,region,offers});
  if(proof?.quote?.incomeCardId!==income.id)return null;
  return {goal:goalWithSupplier,proof:{discard,incomeCardId:income.id,pickCardId:proof.cardId,retainedResearchCardId:goalWithSupplier.retainedResearchCardId??null,forecast:proof.quote}};
 }
 function knownSectorPublicityTask({state,seatId,cardId,taskId,single=false}){
  const p=owner(state,seatId),turn=state.turn;
  if(!p.mainActionCompleted||p.passCompletionPending||turn.currentPlayerId!==seatId||!turn.activePlayerIds?.length
    ||!turn.activePlayerIds.every(id=>id===seatId||turn.passedPlayerIds.includes(id)))return null;
  const card=p.reservedCards.find(c=>c.id===cardId),entry=sectorPublicityReward(card);
  if(entry?.task.id!==taskId||single&&p.reservedCards.some(c=>c.amibaTask||aliens.amiba.getCardTask(c)||c.chongTask))return null;
  return entry;
 }
 function canDeferSectorPublicityTask(args){
  const entry=knownSectorPublicityTask(args);
  if(!entry)return null;
  const {state,seatId,taskId}=args,p=owner(state,seatId);
  const publicity=p.resources.publicity,limit=players.RESOURCE_LIMITS.publicity,cost=tech.getResearchPublicityCost(p);
  if(publicity<cost||publicity+entry.gain.publicity<=limit||publicity-cost+entry.gain.publicity>limit
    ||!tech.listTakeableTiles(state.tech,p.techState).length)return null;
  return {overflow:publicity+entry.gain.publicity-limit,researchCost:cost,taskId};
 }
 function deferredPublicityTask({state,seatId,actions,session,payload}){
  const advance=session.queue[1];
  if(actions.length!==2||session.queue.length!==2||advance?.type!=='probe_turn_advance'
    ||advance.ownerId!==seatId||advance.payload?.didPass!==false)return null;
  const fact=canDeferSectorPublicityTask({state,seatId,cardId:payload.cardInstanceId,taskId:payload.ruleId});
  if(!fact)return null;
  const skip=actions.find(a=>a.target?.choiceId===`skip:task:${payload.cardInstanceId}:${payload.ruleId}`);
  const confirm=actions.some(a=>a.target?.choiceId===`confirm:task:${payload.cardInstanceId}:${payload.ruleId}`);
  if(!skip||!confirm)return null;
  return fixedChoice(actions,skip,'fixed-defer-overflow-task',{reason:'claim-after-funded-research',...fact,
    assumption:'already affordable research; a persistent held sector task is still manually claimable next turn'});
 }
 function fixedPositiveEndTask({state,seatId,actions,session,payload}){
  const p=owner(state,seatId),turn=state.turn,advance=session.queue[1];
  if(turn.roundNumber!==3||!p.mainActionCompleted||p.passCompletionPending||turn.currentPlayerId!==seatId
    ||actions.length!==2||session.queue.length!==2||session.interruptContext
    ||advance?.type!=='probe_turn_advance'||advance.ownerId!==seatId||advance.payload?.didPass!==false
    ||turn.activePlayerIds.some(id=>id!==seatId&&!turn.passedPlayerIds.includes(id))
    ||!Object.values(state.aliens.aliens).every(s=>s.revealed&&['阿米巴','虫'].includes(s.alienId))
    ||Object.keys(state.aliens.chong?.transportTasksByRocketId||{}).length
    ||p.reservedCards.some(c=>c.set==='alien:虫')
    ||state.finalScoring.thresholds.some(n=>!Object.values(state.finalScoring.tiles).some(t=>t.marks.some(m=>m.playerId===seatId&&m.threshold===n))))return null;
  const card=p.reservedCards.find(c=>c.id===payload.cardInstanceId),model=card&&effects.getCardModel(card);
  const task=model?.tasks?.length===1&&model.tasks[0],reward=task?.rewards?.length===1&&task.rewards[0],gain=reward?.options?.gain;
  if(!card||card.hidden||!model||model.cardType!==2||model.endGameScoring||model.triggers?.length||model.temporaryTasks?.length
    ||task?.id!==payload.ruleId||task.condition?.type!=='orbitOrLandCount'||reward?.type!=='gain_resources'
    ||(reward.options?.repeat??1)!==1||!gain||Object.keys(gain).length!==2
    ||!Number.isSafeInteger(gain.score)||gain.score<=0||!Number.isSafeInteger(gain.credits)||gain.credits<=0)return null;
  const confirm=actions.find(a=>a.target?.choiceId===`confirm:task:${payload.cardInstanceId}:${payload.ruleId}`);
  if(!confirm||!actions.some(a=>a.target?.choiceId===`skip:task:${payload.cardInstanceId}:${payload.ruleId}`))return null;
  return fixedChoice(actions,confirm,'fixed-positive-optional',{reason:'greedy-free-known-task-score-credit',
   assumption:'known completed task adds score and currency at end of own turn without forfeiting reserved triggers or scoring'});
 }
 function knownFinalPositiveTask({state,seatId,payload,knownCards,eventType}){
  const p=owner(state,seatId),turn=state.turn;
  const sameSeat=turn.activePlayerIds.every(id=>id===seatId||turn.passedPlayerIds.includes(id));
  if(turn.roundNumber!==4||!p.mainActionCompleted||p.passCompletionPending||turn.currentPlayerId!==seatId
    ||turn.gameEnded||turn.passedPlayerIds.includes(seatId)||state.match.initialSetup
    ||!knownCards?.has(payload.cardInstanceId)||p.reservedCards.some(card=>!knownCards.has(card.id))
    ||turn.cardTurnEventBonuses?.length
    ||(sameSeat?payload.ruleId!=='b117-orbit-land-count-task'||residual.hasPendingFossilArrival(state)
      :Object.values(state.aliens.chong?.transportTasksByRocketId||{}).some(job=>!job.delivered))
    ||state.finalScoring.thresholds.some(n=>!Object.values(state.finalScoring.tiles).some(t=>t.marks.some(m=>m.playerId===seatId&&m.threshold===n))))return null;
  const card=p.reservedCards.find(c=>c.id===payload.cardInstanceId), model=card&&effects.getCardModel(card);
  const supported={"b117-orbit-land-count-task":"credits","b60-jupiter-task":"publicity"}, currency=supported[payload.ruleId];
  const task=model?.tasks?.length===1&&model.tasks[0], reward=task?.rewards?.length===1&&task.rewards[0];
  const gain=reward?.options?.gain;
  if(!currency||!card||card.hidden||model.cardType!==2||model.endGameScoring||model.triggers?.length||model.temporaryTasks?.length
    ||task?.id!==payload.ruleId||reward?.type!=='gain_resources'||(reward.options.repeat??1)!==1
    ||!gain||Object.keys(gain).length!==2||!Number.isSafeInteger(gain.score)||gain.score<=0
    ||!Number.isSafeInteger(gain[currency])||gain[currency]<=0
    ||p.resources[currency]+gain[currency]>(players.RESOURCE_LIMITS[currency]??Infinity))return null;
  const event={type:eventType,playerId:seatId,cardInstanceId:card.id,ruleId:task.id,
    ...(eventType==='card_rule_settled'?{ruleKind:'task'}:{})};
  return effects.hasMatchingTrigger(p,event)?null:{card,task,gain,event,sameSeat};
 }
 function fixedFinalEndTask({state,seatId,actions,session,payload,knownCards}){
  const advance=session.queue[1];
  if(session.queue.length!==2||session.interruptContext||session.irreversibleBarrier
    ||session.journal.actions[0]?.action?.family!=='end_turn'||advance?.type!=='probe_turn_advance'
    ||advance.ownerId!==seatId||advance.payload?.didPass!==false||actions.length!==2)return null;
  const known=knownFinalPositiveTask({state,seatId,payload,knownCards,eventType:'card_rule_settled'});
  if(!known)return null;
  const {card,task,gain}=known;
  const confirm=actions.find(a=>a.target?.choiceId===`confirm:task:${card.id}:${task.id}`);
  if(!confirm||!actions.some(a=>a.target?.choiceId===`skip:task:${card.id}:${task.id}`))return null;
  return fixedChoice(actions,confirm,'fixed-positive-optional',{reason:'greedy-final-end-task-no-overflow',gain,
    assumption:'one known non-scoring task, full score/currency payout and unchanged turn advance'});
 }
 function previewFinalPositiveTaskClaim({state,seatId,action,knownCards}){
  if(action?.family!=='complete_task'||action.phase!=='quick'||state.turn.gameEnded||state.turn.passedPlayerIds.includes(seatId))return null;
  const p=owner(state,seatId);
  if(p.reservedCards.some(c=>!knownCards.has(c.id)))return null;
  const known=knownFinalPositiveTask({state,seatId,payload:action.target,knownCards,eventType:'complete_task'});
  return previewKnownPositiveTaskSettlement(state,seatId,known,state.meta.stateVersion+1);
 }
 function previewKnownPositiveTaskSettlement(state,seatId,known,version){
  if(!known)return null;
  const p=owner(state,seatId), player={...p,resources:{...p.resources},scoreSources:{...p.scoreSources},reservedCards:copyForkData(p.reservedCards)};
  const next={...state,meta:{...state.meta,stateVersion:version},aliens:copyForkData(state.aliens),
    cards:{...state.cards,drawPileCardIds:[...state.cards.drawPileCardIds],removedFromGameCardIds:[...(state.cards.removedFromGameCardIds||[])]},
    players:{...state.players,players:state.players.players.map(q=>q===p?player:q)}};
  const applied=residual.settleReadyTaskDirect(next,seatId,known.card.id,known.task.id);
  if(!applied.ok||applied.spawnedEffects.length||applied.irreversible)return null;
  if(effects.collectMatchingTriggers(player,known.event).length)return null;
  return next;
 }
 function previewFinalPositiveEndTask({state,seatId,actions,session,action,knownCards}){
  const head=session.queue[0],payload=head?.payload;
  if(head?.type!=='residual_card_decision'||head.ownerId!==seatId||payload?.kind!=='task'
    ||owner(state,seatId).reservedCards.some(c=>!knownCards.has(c.id)))return null;
  const fixed=fixedFinalEndTask({state,seatId,actions,session,payload,knownCards});
  if(fixed?.selectedActionId!==action.actionId)return null;
  const known=knownFinalPositiveTask({state,seatId,payload,knownCards,eventType:'card_rule_settled'});
  const next=previewKnownPositiveTaskSettlement(state,seatId,known,session.baseVersion+1);
  if(!next)return null;
  return next&&previewForeignTurnAfterQuietHandoffs(next,seatId,session.baseVersion+1,known.sameSeat);
 }
 function previewChongTransportQuick({state,seatId,action,knownCards,knownFossilIds}){
  const p=owner(state,seatId),t=state.turn;
  if(action?.family!=='complete_task'||action.phase!=='quick'||action.target?.ruleId!=='transport'
    ||action.actorId!==seatId||t.roundNumber!==4||t.currentPlayerId!==seatId||t.gameEnded
    ||t.passedPlayerIds.includes(seatId)||p.passCompletionPending||t.cardTurnEventBonuses?.length
    ||state.match.initialSetup||state.meta.rngState?.branch
    ||p.resources.availableData!==p.dataState.poolTokens.length
    ||p.reservedCards.some(c=>!knownCards.has(c.id)))return null;
  const cargo=knownDeliveredCargo({state,seatId,knownCards,knownFossilIds});
  if(cargo?.card.id!==action.target.cardInstanceId||cargo.ruleId!==action.target.ruleId)return null;
  const preview=previewKnownCargoClaim({state,seatId,cargo});
  if(!preview||effects.collectMatchingTriggers(preview.player,{type:'complete_task',playerId:seatId,
    cardInstanceId:cargo.card.id,ruleId:cargo.ruleId}).length)return null;
  preview.state.meta.stateVersion=state.meta.stateVersion+1;
  return preview.state;
 }
 function previewChongTraceMenu({state,seatId,action,knownCards}){
  const p=owner(state,seatId),t=state.turn,cardId=action.target?.cardInstanceId;
  if(action.family!=='complete_task'||action.phase!=='quick'||action.actorId!==seatId||action.target?.ruleId!=='trace'
    ||t.roundNumber!==4||t.currentPlayerId!==seatId||t.gameEnded||!p.mainActionCompleted||p.passCompletionPending
    ||t.passedPlayerIds.includes(seatId)||t.cardTurnEventBonuses?.length||state.meta.rngState?.branch
    ||p.reservedCards.some(c=>!knownCards.has(c.id)))return null;
  return previewChongTraceClaim(state,seatId,{type:'complete_task',playerId:seatId,cardInstanceId:cardId,ruleId:'trace'});
 }
 function previewChongTraceClaim(state,seatId,event){
  const p=owner(state,seatId),cardId=event.cardInstanceId;
  const player={...p,reservedCards:structuredClone(p.reservedCards)};
  const next={...state,aliens:structuredClone(state.aliens),
    cards:{...state.cards,drawPileCardIds:[...state.cards.drawPileCardIds],removedFromGameCardIds:[...(state.cards.removedFromGameCardIds||[])]},
    players:{...state.players,players:state.players.players.map(q=>q===p?player:q)}};
  const settlement=residual.queryCardSettlement(next,seatId,{kind:'chong_task',cardInstanceId:cardId,ruleId:'trace'});
  if(!settlement?.chooseFossilRewardOnly||settlement.effects.length||settlement.fossilId)return null;
  const result=residual.settleReadyTaskDirect(next,seatId,cardId,'trace'),spawn=result.spawnedEffects?.[0]?.effect;
  if(!result.ok||result.irreversible||result.spawnedEffects?.length!==1||spawn?.type!==residual.EFFECT_TYPES.CHONG_TASK_FOSSIL
    ||spawn.ownerId!==seatId||Object.keys(spawn.payload||{}).length||effects.collectMatchingTriggers(player,event).length)return null;
  return {source:state,working:next,event};
 }
 function previewQuietQueuedChongTask({state,seatId,session,action,knownCards,knownFossilIds}){
  const [head,next,advance]=session.queue,t=state.turn,p=owner(state,seatId),task=head?.payload;
  if(action.family!=='accept_optional_effect'||action.actorId!==seatId||session.phase!=='awaiting_input'
    ||session.interruptContext||session.irreversibleBarrier||session.failure||session.undoFrames.length
    ||session.journal.actions[0]?.action.family!=='end_turn'||head.type!=='residual_card_decision'
    ||head.ownerId!==seatId||head.allowQuickActions||task?.kind!=='chong_task'
    ||t.roundNumber!==4||t.currentPlayerId!==seatId||t.gameEnded||!p.mainActionCompleted||p.passCompletionPending
    ||t.passedPlayerIds.includes(seatId)||t.cardTurnEventBonuses?.length||p.reservedCards.some(c=>!knownCards.has(c.id)))return null;
  const stem='chong_task:'+task.cardInstanceId+':'+task.ruleId,selected=action.target?.choiceId,confirm=selected==='confirm:'+stem;
  if(!confirm&&selected!=='skip:'+stem)return null;
  const event={type:'card_rule_settled',playerId:seatId,cardInstanceId:task.cardInstanceId,ruleId:task.ruleId,ruleKind:task.kind};
  const ordinaryAdvance=e=>e?.type==='probe_turn_advance'&&e.ownerId===seatId&&e.payload?.didPass===false;
  if(task.ruleId==='trace'&&confirm&&session.queue.length===2&&ordinaryAdvance(next)&&task.chooseFossilRewardOnly){
   const trace=previewChongTraceClaim(state,seatId,event);
   return trace?{working:trace.working,event,opensFossils:true}:null;
  }
  if(task.ruleId!=='transport'||session.queue.length!==3||!ordinaryAdvance(advance)
    ||next.type!=='residual_card_decision'||next.ownerId!==seatId||next.allowQuickActions
    ||next.payload?.kind!=='chong_task'||next.payload.ruleId!=='trace')return null;
  if(!confirm)return effects.hasMatchingTrigger(p,event)?null:{working:state,event};
  const cargo=knownDeliveredCargo({state,seatId,knownCards,knownFossilIds});
  if(cargo?.card.id!==task.cardInstanceId||cargo.ruleId!==task.ruleId||cargo.job.fossilId!==task.fossilId)return null;
  const result=previewKnownCargoClaim({state,seatId,cargo});
  return result&&!effects.collectMatchingTriggers(result.player,event).length?{working:result.state,event}:null;
 }
 function chongTaskFossilChoices(state,effect){return residual.chongTaskFossilChoices(state,effect);}
 function previewQuietChongTraceSkip({state,seatId,session,action,knownCards}){
  const [head,advance]=session.queue,t=state.turn,p=owner(state,seatId),payload=head?.payload;
  if(action?.family!=='accept_optional_effect'||action.actorId!==seatId||session.phase!=='awaiting_input'
    ||session.queue.length!==2||session.interruptContext||session.irreversibleBarrier||session.failure
    ||session.journal.actions[0]?.action.family!=='end_turn'||head.type!=='residual_card_decision'
    ||head.ownerId!==seatId||head.allowQuickActions||payload?.kind!=='chong_task'||payload.ruleId!=='trace'
    ||action.target?.choiceId!==`skip:chong_task:${payload.cardInstanceId}:trace`
    ||advance.type!=='probe_turn_advance'||advance.ownerId!==seatId||advance.payload?.didPass!==false
    ||t.roundNumber!==4||t.currentPlayerId!==seatId||t.gameEnded||t.passedPlayerIds.includes(seatId)
    ||t.activePlayerIds.some(id=>id!==seatId&&!t.passedPlayerIds.includes(id))||!p.mainActionCompleted
    ||p.passCompletionPending||p.reservedCards.some(c=>!knownCards.has(c.id))
    ||effects.hasMatchingTrigger(p,{type:'card_rule_settled',playerId:seatId,
      cardInstanceId:payload.cardInstanceId,ruleId:payload.ruleId,ruleKind:payload.kind}))return null;
  return previewForeignTurnAfterQuietHandoffs(state,seatId,session.baseVersion+1,true);
 }
 function previewForeignTurnAfterQuietHandoffs(state,seatId,version,allowSameSeat=false){
  // Only a normal turn handover remains; this cannot begin a round or pass.
  const next={...state,meta:{...state.meta,stateVersion:version},turn:copyForkData(state.turn)};
  const transition=turnFlow.advanceTurnAfterPlayerAction(next,seatId,{passed:false});
  if(!transition.turnAdvanced||transition.roundAdvanced||transition.gameEnded||!allowSameSeat&&transition.nextPlayerId===seatId)return null;
  const p=owner(next,seatId),following=owner(next,transition.nextPlayerId);
  if(!following||following.passCompletionPending||effects.collectMatchingTriggers(p,{type:'end_turn',playerId:seatId,
    previousRoundNumber:state.turn.roundNumber,roundNumber:next.turn.roundNumber,nextPlayerId:transition.nextPlayerId,
    roundAdvanced:false,gameEnded:false}).length)return null;
  next.players={...next.players,players:next.players.players.map(player=>player===p?{...player,mainActionCompleted:false,passCompletionPending:false}
    :player===following?{...player,mainActionCompleted:false}:player)};
  return next;
 }
 function previewFinalEndPrelude({state,seatId,action,knownCards,allowSameSeat=false}){
  const turn=state.turn,p=owner(state,seatId);
  const sameSeat=turn.activePlayerIds.every(id=>id===seatId||turn.passedPlayerIds.includes(id));
  if(action?.family!=='end_turn'||action.phase!=='turn_control'||action.target?.kind!=='end-turn'
    ||turn.roundNumber!==4||state.match.initialSetup||!p||sameSeat&&!allowSameSeat
    ||p.reservedCards.some(c=>!knownCards.has(c.id)))return null;
  const preview=residual.previewQuietEndHandoffs(state,seatId,{stationaryCargo:sameSeat});
  if(!preview)return null;
  if(!preview.settlements.length){
   const finished=previewForeignTurnAfterQuietHandoffs(preview.state,seatId,state.meta.stateVersion+1,sameSeat);
   return finished?{finished}:null;
  }
  const [task]=preview.settlements;
  if(preview.settlements.length!==1||task.kind!=='task'
    ||!knownFinalPositiveTask({state:preview.state,seatId,payload:task,knownCards,eventType:'card_rule_settled'}))return null;
  return {source:state,working:preview.state,task};
 }
 function previewQuietChongEndPrelude({state,seatId,action,knownCards}){
  const t=state.turn,p=owner(state,seatId);
  if(action.family!=='end_turn'||action.phase!=='turn_control'||action.target?.kind!=='end-turn'||action.actorId!==seatId
    ||t.roundNumber!==4||t.currentPlayerId!==seatId||t.gameEnded||!p.mainActionCompleted||p.passCompletionPending
    ||t.passedPlayerIds.includes(seatId)||t.activePlayerIds.some(id=>id!==seatId&&!t.passedPlayerIds.includes(id))
    ||state.match.initialSetup||state.meta.rngState?.branch||p.industryBorrowedTechTileId
    ||industry.getPlayerIndustryDefinition(p)?.activeAbilityId!=='deepspace_swap_cards'
    ||p.reservedCards.some(c=>!knownCards.has(c.id)))return null;
  const preview=residual.previewQuietEndHandoffs(state,seatId);
  if(!preview)return null;
  const shape=preview.settlements.map(x=>x.kind+':'+x.ruleId).join('/');
  if(!['chong_task:trace','chong_task:transport/chong_task:trace'].includes(shape))return null;
  return {source:state,working:preview.state,settlements:preview.settlements,shape};
 }
 function finalEndTaskChoices(state,effect){return residual.cardDecisionChoices(state,effect);}
 function fixedFinalAmibaYellowData({state,seatId,actions,session,knownCards}){
  const p=owner(state,seatId),head=session?.queue?.[0],payload=head?.payload;
  if(state.turn.roundNumber!==4||!p?.mainActionCompleted||!knownCards||actions.length!==2
    ||session?.journal.actions[0]?.action?.family!=='land'||payload?.matches?.length!==1
    ||payload.matches[0].ruleId!=='amiba0-yellow-data'
    ||p.resources.availableData!==3||p.dataState.poolTokens.length!==3
    ||p.resources.availableData>=players.RESOURCE_LIMITS.availableData
    ||data.listComputerPlacedTokens(p).length!==4
    ||data.listBlueBonusPlacedTokens(p).some(token=>token.blueSlot!==1)
    ||state.finalScoring.thresholds.some(n=>!Object.values(state.finalScoring.tiles).some(t=>t.marks.some(m=>m.playerId===seatId&&m.threshold===n))))return null;
  const card=p.reservedCards.find(c=>c.id===payload.matches[0].cardInstanceId),model=card&&effects.getCardModel(card);
  if(card?.cardId!=='amiba_0.webp'||!model||model.endGameScoring||model.tasks?.length||model.temporaryTasks?.length)return null;
  const confirm=actions.find(a=>a.target?.choiceId===`confirm:trigger:${card.id}:amiba0-yellow-data`);
  if(!confirm||!actions.some(a=>a.target?.choiceId==='skip:alienTrace'))return null;
  const settled=residual.previewQuietAmibaYellowLanding(session,confirm,knownCards),after=settled&&owner(settled,seatId);
  if(!after||after.resources.availableData!==p.resources.availableData+1
    ||after.reservedCards.some(c=>c.id===card.id))return null;
  return fixedChoice(actions,confirm,'fixed-positive-optional',{reason:'greedy-final-yellow-data-last-use',
    assumption:'last unused effect of a non-scoring card; free pool data fits, four available data can fund the remaining computer and blue slots, all final marks placed'});
 }
 function fixedFinalAmibaBlueScore({state,seatId,actions,session,knownCards}){
  const head=session.queue[0],payload=head.payload,match=payload.matches?.[0],t=state.turn;
  if(t.roundNumber!==4||t.currentPlayerId!==seatId||t.gameEnded||actions.length!==2
    ||session.queue.length!==1||session.interruptContext||session.failure||head.ownerId!==seatId||head.allowQuickActions
    ||!['play_card','research_tech'].includes(session.journal.actions[0]?.action?.family)
    ||payload.matches?.length!==1||match.ruleId!=='amiba1-blue-tech'||payload.event?.type!=='researchTech'
    ||payload.event.techType!=='blue'||payload.event.playerId!==seatId||t.cardTurnEventBonuses?.length
    ||!t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id)))return null;
  const p=owner(state,seatId),card=p.reservedCards.find(c=>c.id===match.cardInstanceId),model=card&&effects.getCardModel(card);
  if(!p.mainActionCompleted||p.passCompletionPending||!knownCards||p.reservedCards.some(c=>!knownCards.has(c.id))
    ||card?.cardId!=='amiba_1.webp'||!model||model.endGameScoring||model.tasks?.length||model.temporaryTasks?.length
    ||card.cardEffectState?.modelCardId!==card.cardId
    ||model.triggers.some(trigger=>trigger.id!==match.ruleId&&!card.cardEffectState.consumedTriggerIds.includes(trigger.id))
    ||state.finalScoring.thresholds.some(n=>!Object.values(state.finalScoring.tiles).some(tile=>tile.marks.some(m=>m.playerId===seatId&&m.threshold===n)))
    ||residual.hasPendingFossilArrival(state))return null;
  const amiba=aliens.amiba,publicSymbols=amiba.getPublicSymbolState(state.aliens,{readOnly:true});
  if(!publicSymbols||publicSymbols.symbolSlots.blue_1!=='symbol_3'
    ||publicSymbols.symbolSlots.blue_2||publicSymbols.symbolSlots.blue_3)return null;
  const reward=amiba.getSymbolReward('symbol_3');
  if(Object.keys(reward.gain||{}).length!==1||reward.gain.score!==4||reward.dataCount||reward.drawCards)return null;
  const options=model.triggers.find(trigger=>trigger.id===match.ruleId)?.effect;
  if(options?.type!==amiba.EFFECT_TYPES.CHOOSE_SYMBOL_REWARD||options.options?.region!=='blue')return null;
  const event={playerId:seatId};
  if(effects.hasMatchingTrigger(p,{...event,type:'card_rule_settled',cardInstanceId:card.id,ruleId:match.ruleId,ruleKind:'trigger'})
    ||effects.hasMatchingTrigger(p,{...event,type:'amiba_symbol_resolved',symbolId:'symbol_3',slotId:'blue_1',region:'blue'}))return null;
  const accept=actions.find(a=>a.target?.choiceId===`confirm:trigger:${card.id}:${match.ruleId}`);
  if(!accept||!actions.some(a=>a.target?.choiceId==='skip:researchTech'))return null;
  return fixedChoice(actions,accept,'fixed-positive-optional',{reason:'greedy-final-single-public-blue-symbol',
    assumption:'last trigger of a non-scoring card, only one public score-only reward; the symbol stays in blue and existing final marks are already placed'});
 }
 function pureOptional({state,seatId,actions,session,knownCards}){
  if(!actions.length||!actions.every(a=>a.family==='accept_optional_effect'))return null;
  const payload=session?.queue?.[0]?.payload;
  if(payload?.kind==='task')return deferredPublicityTask({state,seatId,actions,session,payload})
    ||fixedPositiveEndTask({state,seatId,actions,session,payload})
    ||fixedFinalEndTask({state,seatId,actions,session,payload,knownCards});
  if(payload?.kind!=='trigger')return null;
  const finalBlue=fixedFinalAmibaBlueScore({state,seatId,actions,session,knownCards});
  if(finalBlue)return finalBlue;
  const confirms=actions.filter(a=>a.target?.choiceId?.startsWith('confirm:')),skip=actions.find(a=>a.target?.choiceId?.startsWith('skip:'));
  if(!confirms.length||!skip)return null;
  // A single known trigger can bank a free data token as a fixed reward.
  // Keep native branches when the card would leave the reserve, another
  // effect is queued, or the token would overflow and consume future use. Public refill
  // changes only cards; the new identities are not read.
  if(confirms.length===1&&!session.interruptContext
    &&session.queue.slice(1).every(e=>e.type===science.EFFECT_TYPES.PUBLIC_REFILL&&e.ownerId===seatId&&!e.allowQuickActions)
    &&!Object.keys(state.aliens.chong?.transportTasksByRocketId||{}).length){
   const confirm=confirms[0],settlement=residual.queryCardSettlement(state,seatId,{...payload,cardInstanceId:confirm.target.cardInstanceId||payload.cardInstanceId,ruleId:confirm.target.ruleId||payload.ruleId});
   const effect=settlement?.effects.length===1&&settlement.effects[0],p=owner(state,seatId);
   const card=p.reservedCards.find(c=>c.id===settlement?.cardInstanceId);
   if(settlement?.kind==='trigger'&&effect?.type==='gain_data'&&effect.options?.count===1&&(effect.options?.repeat??1)===1
     &&card&&p.resources.availableData===p.dataState.poolTokens.length
     &&p.resources.availableData<players.RESOURCE_LIMITS.availableData){
    const copy=structuredClone(card);
    if(effects.consumeTrigger(copy,settlement.ruleId)&&!effects.areAllTriggersConsumed(copy))
     return fixedChoice(actions,confirm,'fixed-positive-optional',{reason:'greedy-free-retained-trigger-data',gains:[{actionId:confirm.actionId,value:.5}],assumption:'one known free data, spare pool capacity, triggering card stays in reserve, at most automatic public refill after reward'});
   }
  }
  const finalYellow=fixedFinalAmibaYellowData({state,seatId,actions,session,knownCards});
  if(finalYellow)return finalYellow;
  const ranks=[];
  for(const action of confirms){
   const preview=structuredClone(state),settlement=residual.queryCardSettlement(preview,seatId,{...payload,cardInstanceId:action.target.cardInstanceId||payload.cardInstanceId,ruleId:action.target.ruleId||payload.ruleId});
   if(!settlement||settlement.kind!=='trigger'||!settlement.effects.length||!settlement.effects.every(e=>demand.positiveResourceGain(e)))return null;
   const p=owner(preview,seatId),before={...p.resources};
   for(const effect of settlement.effects)for(let i=0;i<Math.max(1,effect.options?.repeat||1);i++)players.gainResources(p,effect.options.gain);
   const value=Object.entries(p.resources).reduce((n,[k,v])=>n+(v-(before[k]||0))*({score:1,credits:1,energy:1,publicity:.5,availableData:.5,additionalPublicScan:.5}[k]||0),0);
   ranks.push({action,value});
  }
  ranks.sort((a,b)=>b.value-a.value||tie(a.action,b.action));
  return fixedChoice(actions,ranks[0].value>0?ranks[0].action:skip,'fixed-positive-optional',{reason:'greedy-pure-resource-trigger',gains:ranks.map(r=>({actionId:r.action.actionId,value:r.value})),assumption:'only known nonnegative resource-only trigger bodies; native consumption still executes'});
 }
 function reorganization({state,seatId,actions,session}){
  const payload=session?.queue?.[0]?.payload;
  if(payload?.cardEffect?.type!=='card_discard_any_for_income')return null;
  const done=actions.find(a=>a.family==='choose_card'&&a.target?.done);
  if(!done||actions.some(a=>a.family!=='choose_card'||!a.target?.done&&!a.target?.cardInstanceId))throw new Error('REORGANIZATION_CHOICES_INVALID');
  const p=owner(state,seatId),weights=stateValue.DEFAULT_WEIGHTS;
  const context={...state,aliens:structuredClone(state.aliens),finalScoring:structuredClone(state.finalScoring),cardEffects:effects,getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)};
  // Compare finishing now with discarding one more card. Previously selected
  // rewards are pending until done, and must consume capacity in both previews.
  function value(card=null){
   const copy=structuredClone(p),gain={...(payload.pendingIncomeGain||{})};
   if(card){copy.hand=copy.hand.filter(c=>c.id!==card.id);for(const [k,n] of Object.entries(cards.getIncomeGainForCard(card)||{}))gain[k]=(gain[k]||0)+n;}
   const {handSize=0,...resources}=gain;players.gainResources(copy,resources);copy.resources.handSize=copy.hand.length+handSize;
   const final=endScoring.computePlayerFinalScore({...context,players:state.players.players.map(v=>v.id===seatId?copy:v)},copy).totalScore;
   return final+Object.entries(weights).reduce((n,[k,w])=>n+(k==='handSize'?copy.hand.length+handSize:copy.resources[k]||0)*w,0);
  }
  const before=value(),gains=actions.filter(a=>!a.target.done).map(action=>{
   const card=p.hand.find(c=>c.id===action.target.cardInstanceId);if(!card)throw new Error('REORGANIZATION_CARD_MISSING');
   const netGain=value(card)-before;if(!Number.isFinite(netGain))throw new Error('REORGANIZATION_VALUE_INVALID');
   return{actionId:action.actionId,cardId:card.id,netGain};
  }).sort((a,b)=>b.netGain-a.netGain||tie(a,b));
  const positive=gains[0]?.netGain>0?gains[0]:null,chosen=positive?actions.find(a=>a.actionId===positive.actionId):done;
  return fixedChoice(actions,chosen,'fixed-reorganization',{reason:'greedy-positive-reorganization',netGain:positive?.netGain||0,gains,assumption:'current default value; capped known income-corner rewards and current native final scoring; unknown draws counted only; ties kept; no subset exploration'});
 }
 function previewIncomeCompletion({state,seatId,goal},knownSourceCapital=null){
  const {preview,capital}=demand.incomeTailWithPreview({state,seatId,goal},knownSourceCapital);if(!preview.available)return{...preview,selected:false};
  const p=owner(state,seatId),context={...state,players:state.players.players,aliens:structuredClone(state.aliens),finalScoring:structuredClone(state.finalScoring),cardEffects:effects,getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)};
  const delta=endScoring.computePlayerFinalScore(context,preview.player).totalScore-endScoring.computePlayerFinalScore(context,p).totalScore;
  const net=stateValue.sumValueParts([preview.netGain,delta,-preview.immediateScoreGain,capital.afterCapital,-capital.beforeCapital]);
  const realizesForecast=net===0&&demand.forecastDataPlan(state,p)?.fixed?.selected?.incomeCardId===goal.incomeCardId;
  return{policy:'seti-greedy-income-tail-v2',selected:net>0||realizesForecast,realizesForecast,netGain:net,placements:preview.placements,assumption:preview.assumption,capital,preview};
 }
 function incomeCompletion(input){const {capital,preview,...result}=previewIncomeCompletion(input);return result;}
 // Data plans write only these player fields. Existing card/technology
 // entities remain read-only, just as in resourceDemand.previewIncomeTail.
 function dataPreviewPlayer(p){return{...p,resources:{...p.resources},income:{...p.income},hand:[...p.hand],dataState:structuredClone(p.dataState)};}
 const fixedBluePreviews=new WeakMap(),blueGoalKeys=new Set(['id','kind','blueSlot','targetComputerSlot','required']);
 function standardBlueGoal(goal){
  if(!goal||Object.getPrototypeOf(goal)!==Object.prototype)return false;
  // Only the exact catalog goal is eligible. A protected supplier, custom
  // requirement, accessor, or alternative purpose must get its own quote.
  const fields=Object.getOwnPropertyDescriptors(goal);
  if(Reflect.ownKeys(fields).some(k=>!blueGoalKeys.has(k)||!Object.hasOwn(fields[k],'value')))return false;
  const slot=goal.blueSlot,required=goal.required;
  return goal.kind==='blue-data'&&Number.isInteger(slot)&&slot>=1&&slot<=3
   &&goal.id===`data:blue:${slot}`&&goal.targetComputerSlot===data.getRequiredComputerSlotForBlueBonus(slot)
   &&required&&Object.getPrototypeOf(required)===Object.prototype&&!Reflect.ownKeys(required).length;
 }
 function previewBlueCompletion(input,beforeCapital=null,includePlayer=true){
  const {state,seatId,goal}=input;
  if(input.cornerPolicy||beforeCapital!==null||!Object.isFrozen(state)||!standardBlueGoal(goal)||!demand.immutableCapitalInput(state))
   return computeBlueCompletion(input,beforeCapital);
  let previews=fixedBluePreviews.get(state);
  const key=seatId+':'+goal.blueSlot;
  let preview=previews?.get(key);
  if(!preview){
   preview=computeBlueCompletion(input);
   if(!previews){previews=new Map();fixedBluePreviews.set(state,previews);}
   previews.set(key,preview);
  }
  if(!preview.available)return {...preview};
  // Do not expose the stored preview through either public result. The
  // continuation may modify only its own wallet, data tokens, or hand.
  const {player,capital,dataCornerIds,...summary}=preview;
  return {...summary,dataCornerIds:[...dataCornerIds],...(includePlayer?{player:dataPreviewPlayer(player),capital:{...capital}}:{})};
 }
 const dataInvariantCardScores=new Set(['sectorWinsByColor','traceCount','techCount','distinctSignalSectors',
  'planetOrbitOrLand','planetLandingPairs','allOrbitOrLand','probeLocation','unmarkedFinalRightmost',
  'chongTraceCount','amibaTraceCount','aomomoTraceCount','runezuMaxSameSymbolCount','runezuMaxSetSize']);
 function provedDataScoreDelta(state,p,copy){
  if(state.turn.roundNumber!==4||p.techState!==copy.techState||p.reservedCards!==copy.reservedCards
   ||p.completedTaskCount!==copy.completedTaskCount||p.id!==copy.id||p.color!==copy.color
   ||!Number.isSafeInteger(p.resources.score)||!Number.isSafeInteger(copy.resources.score)
   ||['credits','energy','handSize'].some(k=>p.income[k]!==copy.income[k])
   ||state.aliens.runezu?.revealInitialized&&!p.runezuSymbols
   ||state.aliens.jiuzhe?.playerCardsById?.[p.id]
   ||endScoring.shouldApplyJiuzheThreatPenalty(p,{aliens:state.aliens,players:state.players.players}))return null;
  // These previews do not move a probe, spend a trace, mark a tile, add a
  // reservation or resolve a task. The established board and its income
  // formulas therefore cancel out, except cards that read the changed wallet.
  let delta=copy.resources.score-p.resources.score;
  for(const card of p.reservedCards){
   if(effects.getRuntimeCardTypeCode(card,effects.getCardModel(card)?.cardType)!==3)continue;
   const rule=endScoring.resolveCardEndGameRule(card,effects);
   if(typeof rule?.kind==='string'&&rule.kind.startsWith('runezu')&&!p.runezuSymbols)return null;
   if(!rule||dataInvariantCardScores.has(rule.kind))continue;
   if(rule.kind!=='remainingResource'||!Number.isSafeInteger(rule.scorePer))return null;
   delta+=endScoring.scoreCardEndGameRule(rule,copy,{})-endScoring.scoreCardEndGameRule(rule,p,{});
  }
  return Number.isSafeInteger(delta)?delta:null;
 }
 function dataScoreDelta(state,p,copy){
  const proved=provedDataScoreDelta(state,p,copy);
  if(proved!==null)return proved;
  const context={...state,players:state.players.players.map(v=>v===p?copy:v),aliens:structuredClone(state.aliens),
   finalScoring:structuredClone(state.finalScoring),cardEffects:effects,getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)};
  return endScoring.computePlayerFinalScore(context,copy).totalScore-endScoring.computePlayerFinalScore({...context,players:state.players.players},p).totalScore;
 }
 function computeBlueCompletion({state,seatId,goal,cornerPolicy=null},beforeCapital=null){
  const p=owner(state,seatId),copy=dataPreviewPlayer(p);const dataCornerIds=[];let incomeCardId=null;
  const required=data.getRequiredComputerSlotForBlueBonus(goal.blueSlot),occupied=new Set(data.listComputerPlacedTokens(p).map(t=>t.placementSlot));
  const computerPlacements=occupied.has(required)?0:Object.keys(data.COMPUTER_DATA_SLOTS).map(Number).filter(n=>n<=required&&!occupied.has(n)).length;

  // Every iteration consumes one card or fills one prerequisite. A full pool
  // first places data, matching native preparation without exceeding capacity.
  let remaining=computerPlacements,previewRoot;
  while(remaining>0||copy.resources.availableData<1){
   if(copy.resources.availableData<remaining+1&&copy.resources.availableData<players.RESOURCE_LIMITS.availableData){
    const current={...state,players:{...state.players,players:state.players.players.map(v=>v.id===seatId?copy:v)}};
    const choice=cornerPolicy?cornerPolicy(current,goal):demand.dataCornerCards({state:current,seatId,goal,selectionOnly:true})[0],candidate=choice?.card;
    if(!candidate)return{available:false,reason:'blue-tail-needs-preparation'};
    dataCornerIds.push(candidate.id);copy.hand=copy.hand.filter(c=>c.id!==candidate.id);copy.resources.handSize=copy.hand.length;
    if(choice.score)players.gainResources(copy,{score:choice.score});
    previewRoot??={meta:{...state.meta,sequences:{...state.meta.sequences}}};
    if(!data.gainData(copy,{root:previewRoot}).ok)return{available:false,reason:'blue-tail-data-unavailable'};
    continue;
   }
   const r=data.placeDataToComputer(copy);if(!r.ok)return{available:false,reason:'blue-tail-column-unavailable'};
   for(const bonus of r.slotBonuses||[]){
    if(bonus.type==='income'){
     const preview={...state,players:{...state.players,players:state.players.players.map(p=>p.id===seatId?copy:p)}};
     const actions=science.formalizeChoices(preview,seatId,science.listIncomeChoices(preview,seatId));
     if(!actions.length)continue;
     const choice=demand.incomeChoice({state:preview,seatId,goal,actions});
     const card=copy.hand.find(c=>c.id===actions.find(a=>a.actionId===choice?.actionId)?.target?.cardInstanceId),gain=card&&cards.getIncomeGainForCard(card);
     if(!card||!gain||Object.keys(gain).some(k=>!['credits','energy'].includes(k)))return{available:false,reason:'blue-tail-income-needs-native-boundary'};
     incomeCardId=card.id;copy.hand=copy.hand.filter(c=>c.id!==card.id);copy.resources.handSize=copy.hand.length;players.gainIncome(copy,gain);
    }else{
     if(!['score','publicity'].includes(bonus.type))return{available:false,reason:'blue-tail-column-needs-native-choice'};
     players.gainResources(copy,{[bonus.type]:bonus[bonus.type]});
    }
   }
   remaining--;
  }
  const placed=data.placeDataToComputer(copy,{target:data.PLACEMENT_KIND_BLUE_BONUS,blueSlot:goal.blueSlot});
  if(!placed.ok)return{available:false,reason:'blue-tail-needs-preparation'};
  const bonuses=placed.slotBonuses||[];
  if(bonuses.some(b=>!['credits','energy','publicity'].includes(b.type)||Object.keys(b).some(k=>k!=='type'&&k!==b.type)))return{available:false,reason:'blue-tail-needs-native-choice'};
  for(const b of bonuses)players.gainResources(copy,{[b.type]:b[b.type]});
  const score=dataScoreDelta(state,p,copy);
  const resource=Object.entries(stateValue.DEFAULT_WEIGHTS).reduce((n,[k,w])=>n+((copy.resources[k]||0)-(p.resources[k]||0))*w,0);
  const capital={afterCapital:demand.planningCapital(state,copy),beforeCapital:beforeCapital??demand.planningCapital(state,p)};
  const option=capital.afterCapital-capital.beforeCapital;
  const income=Object.entries(stateValue.DEFAULT_WEIGHTS).reduce((n,[k,w])=>n+((copy.income[k]||0)-(p.income[k]||0))*w,0)*(4-state.turn.roundNumber);
  const net=stateValue.sumValueParts([score,resource,option,income]);if(!Number.isFinite(net))throw new Error('BLUE_TAIL_VALUE_INVALID');
  const realizesForecast=net===0&&demand.forecastDataPlan(state,p)?.fixed?.selected?.blueSlot===goal.blueSlot;
  return{policy:'seti-greedy-blue-resource-tail-v2',available:true,selected:net>0||realizesForecast,realizesForecast,netGain:net,blueSlot:goal.blueSlot,dataCornerId:dataCornerIds[0]||null,dataCornerIds,incomeCardId,computerPlacements,requiredNativeInputs:2*(computerPlacements+1)+dataCornerIds.length+(incomeCardId?1:0),immediateScoreGain:copy.resources.score-p.resources.score,player:copy,capital,assumption:'known blue column/resource plan, greedy data corners and one shared-native currency income choice; default V including native end-game, permanent income and held-card opportunity cost; no new owned card identity'};
 }
 function blueCompletion(input){const {player,capital,...result}=previewBlueCompletion(input,null,false);return result;}
 function previewComputerCompletion({state,seatId,goal},beforeCapital=null){
  const p=owner(state,seatId),placements=goal.targetComputerSlot-data.listComputerPlacedTokens(p).length;
  const unavailable=reason=>({available:false,selected:false,reason});
  if(!p.mainActionCompleted||placements<=0||!demand.capacity(state,seatId,goal))return unavailable('computer-prefix-not-funded');
  if(state.turn.cardTurnEventBonuses?.length||p.reservedCards.some(c=>!effects.getCardModel(c)))return unavailable('computer-prefix-needs-native-events');
  const copy=dataPreviewPlayer(p);
  for(let i=0;i<placements;i++){
   const placed=data.placeDataToComputer(copy);if(!placed.ok)return unavailable('computer-prefix-slot-unavailable');
   if(effects.collectMatchingTriggers(copy,{type:'placeData',playerId:seatId,placementKind:'computer',placementSlot:placed.placementSlot}).length)
    return unavailable('computer-prefix-observed-placement');
   for(const bonus of placed.slotBonuses||[]){
    if(!['score','publicity'].includes(bonus.type))return unavailable('computer-prefix-needs-native-choice');
    players.gainResources(copy,{[bonus.type]:bonus[bonus.type]});
   }
  }
  const score=dataScoreDelta(state,p,copy);
  const resources=Object.entries(stateValue.DEFAULT_WEIGHTS).reduce((n,[k,w])=>n+(copy.resources[k]-p.resources[k])*w,0);
  const capital={afterCapital:demand.planningCapital(state,copy),beforeCapital:beforeCapital??demand.planningCapital(state,p)};
  const net=stateValue.sumValueParts([score,resources,capital.afterCapital,-capital.beforeCapital]);
  if(!Number.isFinite(net))throw new Error('COMPUTER_PREFIX_VALUE_INVALID');
  return{policy:'seti-greedy-funded-computer-prefix-v1',available:true,selected:net>0,netGain:net,placements,requiredNativeInputs:placements*2,targetComputerSlot:goal.targetComputerSlot,
   immediateScoreGain:copy.resources.score-p.resources.score,player:copy,capital,assumption:'held data only, consecutive computer resource/score slots; shared current final score and purpose value, no income crossing or new card identity'};
 }
 // Preserve the second slot's otherwise lost publicity when an immediately
 // affordable public research leaves room for it and both allocations fit.
 function deferredComputerPublicity({state,seatId,goal,blueTail,knownTech,noAcquisition}){
  const p=owner(state,seatId),occupied=data.listComputerPlacedTokens(p).length;
  if(occupied>=2||goal.targetComputerSlot!==3||p.resources.publicity!==players.RESOURCE_LIMITS.publicity)return null;
  const bonus=data.getComputerSlotBonus(2),cost=tech.getResearchPublicityCost(p);
  const held=p.reservedCards.map(c=>{const copy=structuredClone(c);effects.ensureCardEffectState(copy);return copy;});
  const receiver={...p,reservedCards:held};
  const need=goal.targetComputerSlot-occupied+Number(blueTail);
  if(Object.values(state.aliens.aliens).some(s=>s.revealed&&s.alienId==='符文族')||state.turn.cardTurnEventBonuses?.length)return null;
  if(bonus?.type!=='publicity'||cost<bonus.publicity||p.resources.publicity<cost)return null;
  const tileId=tech.listTakeableTiles(state.tech,p.techState).find(id=>{
   const stack=state.tech.stacks[id],reward=catalog.BONUS_EFFECTS[stack?.bonusId],gain=science.getResearchDataCount(id);
   const supplied=p.resources.availableData+gain;
   return gain>0&&supplied>=need&&supplied<=players.RESOURCE_LIMITS.availableData&&knownTech(id,stack)
    &&reward&&Object.keys(reward).every(k=>['score','credits','energy','publicity'].includes(k))
    &&(reward.publicity||0)+bonus.publicity<=cost
    &&!effects.collectMatchingTriggers(receiver,{type:'researchTech',playerId:seatId,tileId:id,
      techType:stack.techType,firstTake:stack.firstTakeClaimedBy==null}).length;
  });
  if(!tileId)return null;
  const prefix=previewComputerCompletion({state,seatId,goal});
  if(!prefix.available||!prefix.selected||prefix.player.resources.publicity!==p.resources.publicity)return null;
  const placed={...state,players:{...state.players,players:state.players.players.map(v=>v===p?prefix.player:v)}};
  for(const current of [state,placed]){
   const quiet=quietEndCompletion({state:current,seatId});
   if(!quiet.available||quiet.netGain||quiet.markedTiles.length||!noAcquisition(current,current===placed?prefix.capital.afterCapital:prefix.capital.beforeCapital))return null;
  }
  return {tileId,retainedPublicity:bonus.publicity};
 }
 function computerCompletion(input){const {player,capital,...result}=previewComputerCompletion(input);return result;}
 function previewScoredAmibaDataCorner({state,seatId,cardId}){
  const p=owner(state,seatId),card=p.hand.find(c=>c.id===cardId),reward=card&&cards.getDiscardActionRewardForCard(card);
  if(card?.set!=='alien:阿米巴'||reward?.dataCount!==1||reward.gain.score!==1||Object.keys(reward.gain).length!==1)return null;
  const copy=dataPreviewPlayer(p);
  copy.hand=copy.hand.filter(c=>c!==card);copy.resources.handSize=copy.hand.length;
  players.gainResources(copy,{score:1});
  if(!data.gainData(copy,{root:{meta:structuredClone(state.meta)}}).ok)return null;
  return{...state,players:{...state.players,players:state.players.players.map(v=>v===p?copy:v)}};
 }
 // R3's Native preparation accepts the sole scored data corner even
 // though the normal scalar blue preview only prices plain data suppliers.
 // Compare both quiet endings without changing the policy that offers them.
 function computerThenScoredCurrency({state,seatId,goal,noAcquisition}){
  const p=owner(state,seatId),prefix=previewComputerCompletion({state,seatId,goal});
  if(!prefix.available||!prefix.selected||![2,3].includes(prefix.placements)||prefix.player.resources.availableData!==0)return null;
  const mid=prefix.player,replace=(q)=>({...state,players:{...state.players,players:state.players.players.map(v=>v===p?q:v)}});
  const prepared=replace(mid);
  if(!noAcquisition(prepared,prefix.capital.afterCapital))return null;
  const end=quietEndCompletion({state:prepared,seatId});
  if(!end.available||end.netGain!==0||end.markedTiles.length)return null;
  const retained=s=>{
   const ownerNow=owner(s,seatId);
   return demand.catalog({state:s,seatId,requirements:{bluePlacements:data.listBluePlacementRequirements(ownerNow)}})
     .filter(g=>g.kind!=='income'||incomeCompletion({state:s,seatId,goal:g}).selected);
  };
  const goals=retained(prepared);
  const stop=(extra={})=>({netGain:prefix.netGain,unrealizedPurposeDelta:stateValue.sumValueParts([prefix.capital.afterCapital,-prefix.capital.beforeCapital]),
    requiredNativeInputs:prefix.requiredNativeInputs+end.requiredNativeInputs,markedTiles:[],
    computerThenQuietEnd:{placements:prefix.placements,requiredPlacementInputs:prefix.requiredNativeInputs,...extra}});
  if(!goals.length)return stop();
  if(prefix.placements!==3||goals.length!==1||goals[0].kind!=='blue-data'||goals[0].targetComputerSlot>goal.targetComputerSlot)return null;
  const blue=goals[0],reward=data.getBlueBonusPlacementReward(mid,blue.blueSlot);
  if(!reward||!['credits','energy','publicity'].includes(reward.type)||Object.keys(reward).some(k=>k!=='type'&&k!==reward.type))return null;
  const candidates=mid.hand.filter(c=>(cards.getDiscardActionRewardForCard(c)?.dataCount||0)>0);
  // The ordinary post-main policy tests one greedy supplier. Two known
  // offers do not require the whole computer prefix to run again when its
  // selected currency finish is flat and the policy already excludes it.
  if(candidates.length===2){
   const alternative=previewBlueCompletion({state:prepared,seatId,goal:blue},prefix.capital.afterCapital);
   if(alternative.available&&!alternative.selected&&!alternative.realizesForecast&&alternative.netGain===0
     &&alternative.computerPlacements===0&&!alternative.incomeCardId&&alternative.dataCornerIds.length===1)
    return stop({unprofitableBlue:{blueSlot:blue.blueSlot,cardId:alternative.dataCornerIds[0],netGain:0}});
  }
  const card=candidates.length===1&&candidates[0],corner=card&&cards.getDiscardActionRewardForCard(card);
  if(card?.set!=='alien:阿米巴'||corner.dataCount!==1||corner.gain.score!==1||Object.keys(corner.gain).length!==1)return null;
  const funded=previewScoredAmibaDataCorner({state:prepared,seatId,cardId:card.id});
  if(!funded)return null;
  const paid=owner(funded,seatId);
  const placed=data.placeDataToComputer(paid,{target:data.PLACEMENT_KIND_BLUE_BONUS,blueSlot:blue.blueSlot});
  if(!placed.ok||placed.slotBonuses.length!==1||placed.slotBonuses[0].type!==reward.type)return null;
  players.gainResources(paid,{[reward.type]:reward[reward.type]});
  const after=replace(paid),afterCapital=demand.planningCapital(after,paid);
  if(!noAcquisition(after,afterCapital))return null;
  if(retained(after).length)return null;
  const final=quietEndCompletion({state:after,seatId});
  if(!final.available||final.netGain!==0||final.markedTiles.length)return null;
  const total=(s,q)=>endScoring.computePlayerFinalScore({...s,players:s.players.players,aliens:structuredClone(s.aliens),
    finalScoring:structuredClone(s.finalScoring),cardEffects:effects,getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)},q).totalScore;
  const delta=Object.entries(stateValue.DEFAULT_WEIGHTS).reduce((n,[k,w])=>n+(paid.resources[k]-mid.resources[k])*w,0);
  const purposeDelta=stateValue.sumValueParts([afterCapital,-prefix.capital.afterCapital]);
  const gain=stateValue.sumValueParts([total(after,paid),-total(prepared,mid),delta,purposeDelta]);
  const take=gain>0||gain===0&&purposeDelta<0;
  return {netGain:stateValue.sumValueParts([prefix.netGain,take?gain:0]),
    unrealizedPurposeDelta:stateValue.sumValueParts([prefix.capital.afterCapital,-prefix.capital.beforeCapital,take?purposeDelta:0]),
    requiredNativeInputs:prefix.requiredNativeInputs+(take?4:1),markedTiles:[],
    computerThenScoredBlue:{placements:prefix.placements,initialInputs:prefix.requiredNativeInputs,take,
      cornerId:card.id,blueSlot:blue.blueSlot,reward,
      end:{netGain:0,requiredNativeInputs:1},blue:{netGain:gain,unrealizedPurposeDelta:purposeDelta,requiredNativeInputs:4}}};
 }
 function quietEndCompletion({state,seatId}){
  const p=owner(state,seatId),board=state.finalScoring,minimum=Math.min(...board.thresholds);
  const reached=board.thresholds.filter(n=>Number.isSafeInteger(n)&&n<=p.resources.score);
  // A normal quiet end with no pending mark cannot change the board or its
  // purpose value. Use the original normalization path for nonstandard data.
  const tiles=Object.values(board.tiles||{});
  const alreadyClaimed=p.id&&Number.isSafeInteger(p.resources.score)&&board.thresholds.every(Number.isSafeInteger)
    &&tiles.length&&tiles.every(t=>Array.isArray(t?.marks))
    &&reached.every(n=>tiles.some(t=>t.marks.some(m=>m.playerId===p.id&&Number(m.threshold)===n)));
  if(Number.isSafeInteger(minimum)&&minimum>p.resources.score||alreadyClaimed)
   return{available:true,netGain:0,purposeDelta:0,requiredNativeInputs:1,markedTiles:[]};
  const preview={...state,meta:structuredClone(state.meta),finalScoring:structuredClone(state.finalScoring)};
  const total=s=>endScoring.computePlayerFinalScore({...s,players:s.players.players,cardEffects:effects,getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)},p).totalScore;
  const before=total(preview),markedTiles=[];
  // Each native placement consumes a different pending score threshold.
  while(finalScoring.getPendingMarksForPlayer(preview.finalScoring,p).length){
   const actions=residual.listFinalMarkChoices(preview,seatId);
   if(!actions.length)return{available:false,reason:'quiet-end-no-native-final-slot'};
   const chosen=finalMark({state:preview,seatId,actions}),tile=actions.find(a=>a.actionId===chosen.selectedActionId).target.tileId;
   if(!finalScoring.markTile(preview.finalScoring,tile,p,{root:preview}).ok)throw new Error('QUIET_END_NATIVE_FINAL_MARK_INVALID');
   markedTiles.push(tile);
  }
  const purposeDelta=markedTiles.length?stateValue.sumValueParts([demand.planningCapital(preview,p),-demand.planningCapital(state,p)]):0;
  return{available:true,netGain:stateValue.sumValueParts([total(preview)-before,purposeDelta]),purposeDelta,requiredNativeInputs:1+markedTiles.length,markedTiles};
 }
 function dataTailCompletion({state,seatId,canLeaveProbeStationary=null,trackPurposeDelta=false,firstBlueGoal=null,canContinue=null,initialIncomeGoal=null,initialIncomeTail=null,fixedDataOrdering=false,stationaryFinalData=false,exactFixedBlueTie=false,publicBlue=null,scoredFinish=null,cornerPolicy=null}){
  // With no owned probe, the shared previews cover held/paid investment and
  // future currency income exactly. No new card identity or owned technology
  // is introduced. Live-probe travel at every round still needs its movement audit.
  // Every iteration fills computer4 or consumes a distinct blue bonus slot.
  const initialOwner=owner(state,seatId);
  const liveProbe=state.pieces.rockets.some(r=>[r.playerId,r.playerColor,r.color].some(id=>id===seatId||id===initialOwner.color));
  if(liveProbe&&!firstBlueGoal&&(!canLeaveProbeStationary||!canLeaveProbeStationary(state)))return{available:false,reason:'blue-tail-live-probe-needs-native-continuation'};
  let current=state;const plans=[];let netGain=0,requiredNativeInputs=1,immediateScoreGain=0;
  let skippedFundedBlue=null;
  let sourceCapital=null,currentCapital=null,primaryOnly=false;
  // Private scalars from the selected typed preview only. Installing that same
  // player leaves all value facts unchanged; the audited callbacks are pure.
  // The acquisition and income checks below read this exact installed player.
  // No value survives this call or attaches to a mutable state/player object.
  function retainCapital(capital){
   if(!plans.length)sourceCapital=capital?.beforeCapital??null;
   currentCapital=capital?.afterCapital??null;
  }
  const prefixPurpose=()=>!plans.length?0:stateValue.sumValueParts([
   currentCapital??demand.planningCapital(current,owner(current,seatId)),
   -(sourceCapital??demand.planningCapital(state,initialOwner))]);
  function finishPublicBlue(goal,force){
   const branch=publicBlue?.({state:current,goal,capital:currentCapital});
   if(!branch)return null;
   // A public acquisition may add new card value; keep the native branch
   // if this competing close also contains a positive scored corner.
   if(scoredFinish?.(current))return null;
   const end=force?null:quietEndCompletion({state:current,seatId});
   if(end&&!end.available)return null;
   if(end&&branch.netGain===end.netGain&&branch.unrealizedPurposeDelta===end.purposeDelta
     &&branch.requiredNativeInputs===end.requiredNativeInputs)return null;
   const take=!end||branch.netGain>end.netGain||branch.netGain===end.netGain
     &&(branch.unrealizedPurposeDelta<end.purposeDelta||branch.unrealizedPurposeDelta===end.purposeDelta&&branch.requiredNativeInputs<end.requiredNativeInputs);
   const selected=take?branch:end;
   return {available:true,plans:take?[...plans,{goal,bluePublicPick:branch.bluePublicPick}]:plans,
    netGain:stateValue.sumValueParts([netGain,selected.netGain]),requiredNativeInputs:requiredNativeInputs+selected.requiredNativeInputs-1,
    immediateScoreGain,markedTiles:selected.markedTiles,...(trackPurposeDelta?{purposeDelta:stateValue.sumValueParts([prefixPurpose(),
      take?branch.unrealizedPurposeDelta:end.purposeDelta])}:{})};
  }
  // This branch already selected one native blue goal. Its exact outcome is
  // still quotable when locally unprofitable; do not replace it with ending now.
  if(firstBlueGoal){
   if(firstBlueGoal.kind!=='blue-data')throw new Error('BLUE_TAIL_FIRST_GOAL_INVALID');
   const preview=previewBlueCompletion({state:current,seatId,goal:firstBlueGoal,cornerPolicy});
   if(!preview.available)return preview.reason==='blue-tail-needs-native-choice'?finishPublicBlue(firstBlueGoal,true)||preview:preview;
   const {player,capital,...summary}=preview;retainCapital(capital);
   plans.push({goal:firstBlueGoal,...summary});netGain=stateValue.sumValueParts([netGain,preview.netGain]);requiredNativeInputs+=preview.requiredNativeInputs;immediateScoreGain+=preview.immediateScoreGain;
   current={...current,players:{...current.players,players:current.players.players.map(v=>v.id===seatId?player:v)}};
  }
  while(true){
   if(canContinue&&!canContinue(current,currentCapital))return{available:false,reason:'data-tail-new-purpose-needs-native-continuation'};
   // The caller's audited pure query must reject every intermediate plan
   // boundary that could begin a new movement objective after receiving funds.
   if(liveProbe&&(!canLeaveProbeStationary||!canLeaveProbeStationary(current)))return{available:false,reason:'data-tail-movement-needs-native-continuation'};
   const p=owner(current,seatId);
   // This source has spent its main action, no visit source and no admitted
   // acquisition. With no pool or known data corner, no placement (including
   // a different blue slot or the income prerequisite) can start.
   if(stationaryFinalData&&p.resources.availableData===0&&!p.hand.some(c=>!c.hidden&&(cards.getDiscardActionRewardForCard(c)?.dataCount||0)>0))break;
   const requirements={bluePlacements:data.listBluePlacementRequirements(p)};
   const goals=demand.catalog({state:current,seatId,requirements});
   const prefixes=goals.filter(g=>g.kind==='computer-prefix').map(goal=>({goal,preview:previewComputerCompletion({state:current,seatId,goal,cornerPolicy},currentCapital)}))
     .filter(p=>p.preview.available&&p.preview.selected).sort((a,b)=>b.preview.netGain-a.preview.netGain||a.preview.requiredNativeInputs-b.preview.requiredNativeInputs||a.goal.targetComputerSlot-b.goal.targetComputerSlot);
   // The caller has a separately audited conditional blue ordering. A new
   // partial column competing with it needs native continuation, at every
   // intermediate boundary, rather than a scalar proof for another policy.
   let orderedBlue=null;
   if(prefixes.length&&goals.some(g=>g.kind==='blue-data')){
    if(!fixedDataOrdering)return{available:false,reason:'computer-prefix-blue-order-needs-native-policy'};
    orderedBlue=previewBlueCompletion({state:current,seatId,goal:goals.find(g=>g.kind==='blue-data'),cornerPolicy},currentCapital);
    if(!orderedBlue.available&&!(publicBlue&&orderedBlue.reason==='blue-tail-needs-native-choice'))return orderedBlue;
   }
   const income=goals.find(g=>g.kind==='income');
   // The native source policy already priced this exact first income goal.
   // Reuse only at the unchanged source; every intermediate wallet requotes.
   const sameIncome=current===state&&income&&income.id===initialIncomeGoal?.id&&income.incomeCardId===initialIncomeGoal.incomeCardId;
   const reusedIncome=sameIncome&&initialIncomeTail;
   const incomeTail=income&&(reusedIncome||previewIncomeCompletion({state:current,seatId,goal:income},currentCapital));
   const forceOrderedBlue=orderedBlue?.selected&&(!incomeTail?.selected||orderedBlue.netGain>incomeTail.netGain);
   if(prefixes.length&&(!incomeTail?.selected||prefixes[0].preview.netGain>incomeTail.netGain)
     &&(!forceOrderedBlue||prefixes[0].preview.netGain>orderedBlue.netGain)){
    const {goal,preview}=prefixes[0],{player,capital,...summary}=preview;retainCapital(capital);
    plans.push({goal,...summary});netGain=stateValue.sumValueParts([netGain,preview.netGain]);requiredNativeInputs+=preview.requiredNativeInputs;immediateScoreGain+=preview.immediateScoreGain;
    current={...current,players:{...current.players,players:current.players.players.map(v=>v.id===seatId?player:v)}};continue;
   }
   if(incomeTail?.selected&&!forceOrderedBlue){
    const card=p.hand.find(c=>c.id===income.incomeCardId),gain=cards.getIncomeGainForCard(card);
    if(!gain||Object.keys(gain).some(k=>!['credits','energy'].includes(k)))return{available:false,reason:'data-tail-income-needs-native-boundary'};
    const preview=reusedIncome?demand.previewIncomeTail({state:current,seatId,goal:income}):incomeTail.preview;
    if(!preview.available)return preview;
    preview.player.resources.handSize=preview.player.hand.length;
    // The public initial policy has no trusted private capital packet. Its
    // existing quote is keyed by the complete immutable source, or recomputed
    // for a mutable source; arbitrary extra caller fields are never evidence.
    retainCapital(reusedIncome?(trackPurposeDelta?demand.incomeTailCapital({state:current,seatId,goal:income}):null):incomeTail.capital);
    const inputs=preview.placements*2+1;
    plans.push({goal:income,netGain:incomeTail.netGain,requiredNativeInputs:inputs,incomeCardId:card.id});
    netGain=stateValue.sumValueParts([netGain,incomeTail.netGain]);requiredNativeInputs+=inputs;immediateScoreGain+=preview.immediateScoreGain;
    current={...current,players:{...current.players,players:current.players.players.map(v=>v.id===seatId?preview.player:v)}};continue;
   }
   const goal=goals.find(g=>g.kind==='blue-data');if(!goal)break;
   const preview=orderedBlue||previewBlueCompletion({state:current,seatId,goal,cornerPolicy},currentCapital);
   if(!preview.available)return preview.reason==='blue-tail-needs-native-choice'?finishPublicBlue(goal,false)||preview:preview;
   if(!preview.selected){
    if(requirements.bluePlacements.length>1){
     if(!fixedDataOrdering)return{available:false,reason:'nonpositive-blue-may-fund-another-column'};
     // There is one fixed blue order. Compare stopping now to the suffix
     // beginning with that exact next slot; each recursion consumes one slot.
     const rest=dataTailCompletion({state:current,seatId,canLeaveProbeStationary,canContinue,firstBlueGoal:goal,fixedDataOrdering,trackPurposeDelta,stationaryFinalData,exactFixedBlueTie,publicBlue,scoredFinish,cornerPolicy});
     const endNow=quietEndCompletion({state:current,seatId});
     if(!rest.available||!endNow.available)return{available:false,reason:'fixed-blue-prefix-needs-native-continuation'};
     const exactTie=exactFixedBlueTie&&rest.netGain===endNow.netGain&&!rest.primaryOnly
       &&Number.isFinite(rest.purposeDelta)&&Number.isFinite(endNow.purposeDelta);
     if(rest.netGain>endNow.netGain||exactTie&&rest.purposeDelta<endNow.purposeDelta)return{...rest,plans:[...plans,...rest.plans],
       netGain:stateValue.sumValueParts([netGain,rest.netGain]),requiredNativeInputs:requiredNativeInputs+rest.requiredNativeInputs-1,
       immediateScoreGain:immediateScoreGain+rest.immediateScoreGain,
       ...(trackPurposeDelta?{purposeDelta:stateValue.sumValueParts([prefixPurpose(),rest.purposeDelta])}:{})};
     // At this stationary round-four source, the move preparation debt is
     // zero. Equal total and unrealized purpose means equal realization;
     // only then does the shorter exact end beat the fixed blue suffix.
     primaryOnly=rest.netGain===endNow.netGain&&!(exactTie&&(rest.purposeDelta>endNow.purposeDelta
       ||rest.purposeDelta===endNow.purposeDelta&&rest.requiredNativeInputs>endNow.requiredNativeInputs)
       ||stationaryFinalData&&!rest.primaryOnly&&rest.purposeDelta===endNow.purposeDelta
         &&rest.requiredNativeInputs>endNow.requiredNativeInputs);
     break;
    }
    if(canContinue){
     const after={...current,players:{...current.players,players:current.players.players.map(v=>v.id===seatId?preview.player:v)}};
     // A negative immediate quote may enable another purpose or realize a
     // final mark. Close it only when its complete fixed suffix loses strictly
     // to ending now. The blue slot is consumed before this finite recursion.
     const exactCornerTie=Boolean(cornerPolicy&&exactFixedBlueTie&&trackPurposeDelta);
     const rest=dataTailCompletion({state:after,seatId,canLeaveProbeStationary,canContinue,scoredFinish,cornerPolicy,
      ...(exactCornerTie?{fixedDataOrdering,exactFixedBlueTie,trackPurposeDelta,publicBlue,stationaryFinalData}:{})}),
      endNow=quietEndCompletion({state:current,seatId});
     if(!rest.available||!endNow.available)return{available:false,reason:'nonpositive-blue-needs-native-continuation'};
     const diff=stateValue.sumValueParts([preview.netGain,rest.netGain,-endNow.netGain]);
     const endCorner=exactCornerTie&&scoredFinish?.(current);
     const purpose=exactCornerTie&&!rest.primaryOnly?stateValue.sumValueParts([
      preview.capital.afterCapital,-preview.capital.beforeCapital,rest.purposeDelta,-endNow.purposeDelta,-(endCorner?.capital||0)]):null;
     const gain=stateValue.sumValueParts([diff,-(endCorner?.value||0)]);
     const endWins=purpose!==null&&gain===0&&(purpose>0||purpose===0
      &&preview.requiredNativeInputs+rest.requiredNativeInputs>endNow.requiredNativeInputs+Number(Boolean(endCorner)));
     if(gain>=0&&!endWins)return{available:false,reason:'nonpositive-blue-needs-native-continuation'};
     if(exactCornerTie&&!rest.plans.length&&!rest.markedTiles.length&&!endNow.markedTiles.length&&!rest.scoredFinish&&!endCorner){
      const {player,capital,...summary}=preview;
      skippedFundedBlue={goal,...summary,suffixValue:rest.netGain,gain,purpose,
       inputs:preview.requiredNativeInputs+rest.requiredNativeInputs-endNow.requiredNativeInputs};
     }
    }
    break;
   }
   const {player,capital,...summary}=preview;retainCapital(capital);
   if(data.listBlueBonusPlacedTokens(player).length!==data.listBlueBonusPlacedTokens(p).length+1)throw new Error('BLUE_TAIL_SLOT_NOT_CONSUMED');
   plans.push({goal,...summary});netGain=stateValue.sumValueParts([netGain,preview.netGain]);requiredNativeInputs+=preview.requiredNativeInputs;immediateScoreGain+=preview.immediateScoreGain;
   current={...current,players:{...current.players,players:current.players.players.map(v=>v.id===seatId?player:v)}};
  }
  const end=quietEndCompletion({state:current,seatId});if(!end.available)return end;
  const corner=scoredFinish?.(current);
  if(corner&&end.markedTiles.length)return{available:false,reason:'scored-corner-needs-native-mark'};
  return{available:true,plans,...(primaryOnly?{primaryOnly:true}:{}),
   ...(corner?{scoredFinish:corner}:{}),...(skippedFundedBlue?{skippedFundedBlue}:{}),
   netGain:stateValue.sumValueParts([netGain,end.netGain,corner?.value||0]),
   requiredNativeInputs:requiredNativeInputs+end.requiredNativeInputs-1+Number(Boolean(corner)),immediateScoreGain,markedTiles:end.markedTiles,
   ...(trackPurposeDelta?{purposeDelta:stateValue.sumValueParts([prefixPurpose(),end.purposeDelta,corner?.capital||0])}:{})};
 }
 function scanDecision(actions){return actions.some(a=>a.target?.nebulaId)&&actions.every(a=>a.target?.nebulaId||a.target?.skip||a.target?.done);}
 function sources(state,seatId,actions,session){
  const found=[...actions.filter(a=>a.target?.nebulaId)],p=owner(state,seatId);
  if(session){
   for(const e of session.queue||[]){
    if(e.ownerId!==seatId||e.type!==science.EFFECT_TYPES.SCAN_STEP)continue;const opts=e.payload?.options||{};
    found.push(...science.listScanStepChoices(state,p,opts));
   }
  }else{
   for(const e of scanEffects.buildScanEffectQueue(p,{fullScanAction:true,turn:state.turn})){
    if(e.type===scanEffects.EFFECT_TYPES.PUBLIC_CARD_SCAN)found.push(...science.listPublicScanChoices(state));
    else if(e.type===scanEffects.EFFECT_TYPES.HAND_SCAN)found.push(...science.listHandScanChoices(state,seatId));
    else if([scanEffects.EFFECT_TYPES.EARTH_SECTOR_SCAN,scanEffects.EFFECT_TYPES.IMPROVED_SECTOR_SCAN,scanEffects.EFFECT_TYPES.MERCURY_SECTOR_SCAN].includes(e.type)){
     const source=science.getPlanetScanSource(state,e.type);if(source)found.push(...science.listNebulaChoices(state,{...source,gainData:true}));
    }
   }
  }
  return found;
 }
 function scanGoals({state,seatId,actions,session,required={},launchPossible=false}){
  const ids=[...new Set(sources(state,seatId,actions,session).map(a=>a.target.nebulaId).filter(Boolean))].sort(),p=owner(state,seatId);
  const goals=ids.map(nebulaId=>({id:'scan:sector:'+nebulaId,kind:'scan-flow',nebulaId,required,purpose:'advance-or-complete-known-sector; collect its data and native reward'}));
  // Already-funded scans retain their native launch/move/skip choices. Only
  // the missing reserve needs a separate, bound preparation purpose.
  if(!session&&!p.mainActionCompleted&&launchPossible&&scanEffects.playerOwnsPurpleTech(p,4,{turn:state.turn})
    &&p.resources.energy<(required.energy||0)+scanEffects.SCAN_ACTION_4_LAUNCH_ENERGY){
   const launchCost={...required,energy:(required.energy||0)+scanEffects.SCAN_ACTION_4_LAUNCH_ENERGY};
   goals.push(...ids.map(nebulaId=>({id:'scan:sector:'+nebulaId+':launch',kind:'scan-flow',nebulaId,required:launchCost,launch:true,purpose:'scan named sector and fund purple4 native launch'})));
  }
  return goals;
 }
 function visibleAmibaDataCorner(index){
  return Number.isInteger(index)&&cards.getDiscardActionRewardForCard(aliens.amiba.createAlienCard(index,1))?.dataCount===1;
 }
 function scanStep({state,seatId,goal,actions,status,session,operation={},retainedSupply=null}){
  if(status==='stable'){
   const a=actions.find(a=>a.family==='scan');
   if(!owner(state,seatId).mainActionCompleted&&a)return{kind:'fixed',actionId:a.actionId,reason:'start-purpose-scan'};
   return goal.launch&&!operation.scanLaunchCompleted?{kind:'infeasible',reason:'scan-launch-purpose-unfulfilled'}:{kind:'complete',reason:'scan-flow-ended'};
  }
  if(goal.launch&&session?.queue?.[0]?.type===science.EFFECT_TYPES.SCAN_ACTION_4){
   const launch=actions.find(a=>a.target?.mode==='launch');
   return launch?{kind:'fixed',actionId:launch.actionId,scanLaunchCompleted:true,reason:'fixed-funded-scan-launch'}:{kind:'infeasible',reason:'funded-scan-launch-unavailable'};
  }
  if(actions.length&&actions.every(a=>a.target?.done||a.target?.skip))return{kind:'fixed',actionId:actions[0].actionId,reason:'fixed-scan-exit'};
  if(!scanDecision(actions)){
   const remains=session?.queue?.some(e=>e.ownerId===seatId&&e.type===science.EFFECT_TYPES.SCAN_STEP);
   return remains?{kind:'fallback',reason:'scan-awaits-different-rule-decision',actionIds:actions.map(a=>a.actionId)}:{kind:'complete',reason:'scan-flow-ended'};
  }
  const p=owner(state,seatId),opts=session?.queue?.[0]?.payload?.options||{},scores=[];
  if(opts.cost&&!players.canAfford(p,opts.cost)){
   const exit=actions.find(a=>a.target?.skip||a.target?.done);
   return exit?{kind:'fixed',actionId:exit.actionId,reason:'skip-unfunded-scan-cost'}:{kind:'infeasible',reason:'scan-step-cost-unfunded'};
  }
  for(const a of actions.filter(a=>a.target?.nebulaId)){
   const nebulaId=a.target.nebulaId,next=data.getNextReplaceableNebulaToken(state.data,nebulaId),tokens=data.listNebulaTokens(state.data,nebulaId);
   const empty=tokens.filter(t=>!(t.replacedByPlayerColor||t.playerColor)).length,ranking=data.getSectorRanking(state.data,nebulaId),ours=ranking.find(r=>r.playerId===seatId||r.playerColor===p.color),lead=!!ours&&ranking[0]===ours;
   const card=p.hand.find(c=>c.id===a.target.cardInstanceId),loss=card?1+(effects.getCardPrice(card)||0)*.25:0;
   const markerCost=opts.mode==='public'&&opts.selected>0 ? .5 : 0,cost=Object.entries(opts.cost||{}).reduce((n,[k,v])=>n+v*({credits:1,energy:1,publicity:.5}[k]||0),0);
   const gain=(next&&a.payload?.gainData!==false&&p.resources.availableData<players.RESOURCE_LIMITS.availableData ? .5 : 0)+(next?data.getNebulaSlotScoreReward(nebulaId,next.slotIndex):0);
   const progress=empty>0?1/empty:lead?0:1,target=nebulaId===goal.nebulaId;
   const score=(target&&progress>0?10+progress:0)+gain-loss-markerCost-cost;
   scores.push({actionId:a.actionId,nebulaId,score,cardId:card?.id||null,loss,progress,gain,target,
    ...(retainedSupply?{usesRetainedSupply:target&&a.target.cardInstanceId===retainedSupply}: {})});
  }
  scores.sort((a,b)=>b.score-a.score||a.loss-b.loss||Number(Boolean(a.usesRetainedSupply))-Number(Boolean(b.usesRetainedSupply))||tie(a,b));const skip=actions.find(a=>a.target?.done||a.target?.skip),chosen=scores[0];
  const id=skip&&(!chosen||chosen.score<=0)?skip.actionId:chosen?.actionId||skip?.actionId;
  if(!id)throw new Error('SCAN_PURPOSE_NO_LEGAL_STEP');
  return{kind:'fixed',actionId:id,reason:skip?.actionId===id?'scan-purpose-not-worth-extra-cost':'fixed-scan-card-and-sector',scores};
 }
 return Object.freeze({VERSION,finalMark,passDiscard,blueResearch,pureOptional,previewFinalPositiveTaskClaim,previewFinalPositiveEndTask,previewChongTransportQuick,previewQuietChongTraceSkip,previewLastPlainPinkTrace:residual.previewLastPlainPinkTrace,previewPinkTraceFossilMenu:residual.previewPinkTraceFossilMenu,previewPinkTraceBeforeRefill:residual.previewPinkTraceBeforeRefill,previewQuietAmibaYellowLanding:residual.previewQuietAmibaYellowLanding,previewEmptyAmibaResearchTrigger:residual.previewEmptyAmibaResearchTrigger,residualCardChoices:residual.cardDecisionChoices,augmentEffectResult:residual.augmentEffectResult,previewQuietResourceCorner:residual.previewQuietResourceCorner,previewChongTraceMenu,chongTaskFossilChoices,previewQuietChongEndPrelude,previewQuietQueuedChongTask,previewFinalEndPrelude,hasPendingFossilArrival:residual.hasPendingFossilArrival,finalEndTaskChoices,sectorPublicityReward,knownSectorPublicityTask,canDeferSectorPublicityTask,previewCappedSectorClaim,deferredSectorPublicityQuote,researchDataPurpose,quoteResearchDataPurpose,deferredComputerIncomeSource,quoteDeferredComputerIncome,researchScanPurpose,quoteResearchScanPurpose,quoteFundedSector,quoteFundedChongSector,previewMatchedAnalysisScan,matchedAnalysisScanSignature,quoteResearchIncomeScan,quoteReadyAnalysisFunding,scanTimingSource,quoteScanTiming,amibaRegionFollowup,quoteAmibaRegionFollowup,preparedRegionPurpose,quotePreparedRegionAnalysis,previewAnalysisPreparation,previewReversedAnalysisPreparation,previewPickupAnalysisForCargo,quoteLateAnalysisIncome,quoteLatePublicDataPick,lateIncomePayment,preserveResearchInThreeCornerIncome,previewAnalysisSwapSupply,blueCashCard,knownBlueCashOffers,quoteBlueCashAnalysis,quoteAnalysisLaunchPick,quoteDeferredCargo,knownDeliveredCargo,previewKnownCargoClaim,scoredEndCorner,pinkScoreBeforeUnknownFossil,previewQuietPinkTrace,reorganization,incomeCompletion,blueCompletion,previewBlueCompletion,computerCompletion,previewComputerCompletion,deferredComputerPublicity,previewScoredAmibaDataCorner,computerThenScoredCurrency,dataTailCompletion,quietEndCompletion,scanDecision,scanGoals,scanStep,visibleAmibaDataCorner});
});
