(function(root,factory){
 'use strict';const common=typeof module==='object'&&module.exports;
 const api=factory(common?require('../final-scoring'):root.SetiFinalScoring,common?require('../end-game-scoring'):root.SetiEndGameScoring,
  common?require('../cards/deck'):root.SetiCards,common?require('../cards/effects'):root.SetiCardEffects,
  common?require('../data'):root.SetiData,common?require('../players'):root.SetiPlayers,
  common?require('../actions/scan-effects'):root.SetiScanEffects,common?require('../effects/science-session'):root.SetiScienceSession,common?require('./resource-demand'):root.SetiResourceDemand,common?require('../effects/residual-domain-session'):root.SetiResidualDomainSession,common?require('./state-value'):root.SetiStateValue,common?require('./income-card-order'):root.SetiIncomeCardOrder,common?require('../tech/resolver'):root.SetiTechResolver,common?require('../tech/catalog'):root.SetiTechCatalog,common?require('../data/placement'):root.SetiDataPlacement,common?require('../aliens'):root.SetiAliens);
 if(common)module.exports=api;else root.SetiLocalDecisionPlans=api;
})(typeof globalThis!=='undefined'?globalThis:window,function(finalScoring,endScoring,cards,effects,data,players,scanEffects,science,demand,residual,stateValue,incomeOrder,tech,catalog,placement,aliens){
 'use strict';
 const VERSION='seti-local-mark-and-scan-purpose-v10';
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
 function quoteKnownSector({state,seatId,p,paid,knownCards,details,followup=null}){
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
  const alienId=Object.keys(q.aliens.aliens).find(id=>q.aliens.aliens[id].revealed&&q.aliens.aliens[id].alienId==='阿米巴');
  const rewards=data.buildSectorRewardDescriptors(settlement).filter(r=>r.owner.playerId===seatId);
  const traces=rewards.filter(r=>r.kind==='alien_trace');
  if(!alienId||traces.length!==1||rewards.some(r=>!['alien_trace','resource'].includes(r.kind)))return null;
  for(const r of rewards)if(r.kind==='resource')players.gainResources(paid,r.gain);
  const traceType=traces[0].traceType,quotes=[];
  const total=(s,actor)=>endScoring.computePlayerFinalScore({...s,players:s.players.players,currentPlayer:actor,
   finalScoring:structuredClone(s.finalScoring),aliens:structuredClone(s.aliens),
   cardEffects:effects,getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)},actor).totalScore;
  const base=total(state,p),baseCapital=demand.planningCapital(state,p);
  const event={type:'alienTrace',traceType,playerId:seatId,alienSlotId:Number(alienId)};
  for(const position of aliens.amiba.TRACE_POSITIONS){
   const root={...q,meta:structuredClone(q.meta),aliens:structuredClone(q.aliens)},copy=dataPreviewPlayer(paid);
   root.players={...q.players,players:q.players.players.map(v=>v.id===seatId?copy:v)};
   if(!aliens.amiba.canPlaceAmibaTrace(root.aliens,alienId,traceType,position).ok)continue;
   const placed=aliens.amiba.placeAmibaTrace(root.aliens,alienId,traceType,position,copy,{sequence:root.meta.sequences.alienEntity});
   if(!placed.ok)continue;
   const apply=r=>{
    if(!r||r.pickAlienCard||r.pickCard||r.drawCards)return false;
    players.gainResources(copy,r.gain||{});
    for(let i=0;i<(r.dataCount||0);i++){const added=data.gainData(copy,{root});if(!added.ok&&!added.discarded)return false;}
    return true;
   };
   if(!apply(placed.reward))continue;
   if(placed.reward.region){
    const symbols=aliens.amiba.listSymbolsInRegion(root.aliens,placed.reward.region);
    if(!symbols.every(symbol=>apply(symbol.reward))||!aliens.amiba.resolveRegionReward(root.aliens,placed.reward.region).ok)continue;
   }
   copy.reservedCards=structuredClone(copy.reservedCards);
   const traceEvent={...event,region:placed.reward.region},matches=effects.collectMatchingTriggers(copy,traceEvent);
   if(matches.length){
    if(matches.length!==1)continue;
    const {card,trigger}=matches[0],settled=residual.queryCardSettlement(root,seatId,{kind:'trigger',cardInstanceId:card.id,ruleId:trigger.id,event:traceEvent});
    if(settled?.effects.length!==1||settled.effects[0].type!=='gain_data'||settled.effects[0].options?.count!==1||(settled.effects[0].options?.repeat??1)!==1)continue;
    const consumed=structuredClone(card);
    if(!effects.consumeTrigger(consumed,trigger.id)||effects.areAllTriggersConsumed(consumed)||!data.gainData(copy,{root}).ok)continue;
    copy.reservedCards=copy.reservedCards.map(c=>c.id===consumed.id?consumed:c);
   }
   // Crossing a mark or creating an unproved trigger must remain Native.
   if(state.finalScoring.thresholds.some(n=>n>p.resources.score&&n<=copy.resources.score))continue;
   const weights=stateValue.DEFAULT_WEIGHTS,linear=Object.entries(weights).reduce((n,[k,w])=>n+(copy.resources[k]-p.resources[k])*w,0);
   const capital=demand.planningCapital(root,copy),score=total(root,copy);
   const scanValue=stateValue.sumValueParts([score,-base,linear,capital,-baseCapital]);
   const continuation=followup?.(root,copy,score,capital);
   if(followup&&!continuation)continue;
   const value=continuation?stateValue.sumValueParts([scanValue,continuation.value]):scanValue;
   if(value>0)quotes.push({value,sectorId:id,publicCardId:card.target.cardInstanceId,traceType,tracePosition:position,
    scoreGain:copy.resources.score-p.resources.score,dataGain:copy.resources.availableData-p.resources.availableData,...details,
    ...(continuation?{scanValue,research:continuation}:{})});
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
 function quoteAmibaRegionFollowup({state,seatId,purpose,continueKnownSwap=null}){
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
   const value=stateValue.sumValueParts([direct,Math.max(0,swap?.value||0)]);
   if(value>0)rows.push({value,direct,cardId:card.id,traceType:choice.traceType,position:choice.position,region:choice.region,
    symbols:symbols.map(x=>x.symbolId),score:copy.resources.score-p.resources.score,data:copy.resources.availableData-p.resources.availableData,
    ...(anonymous?{anonymousDrawCount:anonymous}:{}),...(swap?.value>0?{companySwap:swap}:{})});
  }
  return rows.sort((a,b)=>b.value-a.value||a.traceType.localeCompare(b.traceType)||a.position-b.position)[0]||null;
 }
 function deferredPublicityTask({state,seatId,actions,session,payload}){
  const p=owner(state,seatId),turn=state.turn,advance=session.queue[1];
  if(actions.length!==2||session.queue.length!==2||advance?.type!=='probe_turn_advance'
    ||advance.ownerId!==seatId||advance.payload?.didPass!==false||!p.mainActionCompleted||p.passCompletionPending
    ||turn.currentPlayerId!==seatId||!turn.activePlayerIds?.length
    ||!turn.activePlayerIds.every(id=>id===seatId||turn.passedPlayerIds.includes(id)))return null;
  const card=p.reservedCards.find(c=>c.id===payload.cardInstanceId),entry=sectorPublicityReward(card);
  if(entry?.task.id!==payload.ruleId)return null;
  const {task,gain}=entry;
  const publicity=p.resources.publicity,limit=players.RESOURCE_LIMITS.publicity,cost=tech.getResearchPublicityCost(p);
  if(publicity<cost||publicity+gain.publicity<=limit||publicity-cost+gain.publicity>limit
    ||!tech.listTakeableTiles(state.tech,p.techState).length)return null;
  const skip=actions.find(a=>a.target?.choiceId===`skip:task:${card.id}:${task.id}`);
  const confirm=actions.some(a=>a.target?.choiceId===`confirm:task:${card.id}:${task.id}`);
  if(!skip||!confirm)return null;
  return fixedChoice(actions,skip,'fixed-defer-overflow-task',{reason:'claim-after-funded-research',
    overflow:publicity+gain.publicity-limit,researchCost:cost,taskId:task.id,
    assumption:'already affordable research; a persistent held sector task is still manually claimable next turn'});
 }
 function pureOptional({state,seatId,actions,session}){
  if(!actions.length||!actions.every(a=>a.family==='accept_optional_effect'))return null;
  const payload=session?.queue?.[0]?.payload;
  if(payload?.kind==='task')return deferredPublicityTask({state,seatId,actions,session,payload});
  if(payload?.kind!=='trigger')return null;
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
  if(beforeCapital!==null||!Object.isFrozen(state)||!standardBlueGoal(goal)||!demand.immutableCapitalInput(state))
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
 function computeBlueCompletion({state,seatId,goal},beforeCapital=null){
  const p=owner(state,seatId),copy=dataPreviewPlayer(p);const dataCornerIds=[];let incomeCardId=null;
  const required=data.getRequiredComputerSlotForBlueBonus(goal.blueSlot),occupied=new Set(data.listComputerPlacedTokens(p).map(t=>t.placementSlot));
  const computerPlacements=occupied.has(required)?0:Object.keys(data.COMPUTER_DATA_SLOTS).map(Number).filter(n=>n<=required&&!occupied.has(n)).length;

  // Every iteration consumes one card or fills one prerequisite. A full pool
  // first places data, matching native preparation without exceeding capacity.
  let remaining=computerPlacements;const previewRoot={meta:structuredClone(state.meta)};
  while(remaining>0||copy.resources.availableData<1){
   if(copy.resources.availableData<remaining+1&&copy.resources.availableData<players.RESOURCE_LIMITS.availableData){
    const current={...state,players:{...state.players,players:state.players.players.map(v=>v.id===seatId?copy:v)}};
    const choice=demand.dataCornerCards({state:current,seatId,goal,selectionOnly:true})[0],candidate=choice?.card;
    if(!candidate)return{available:false,reason:'blue-tail-needs-preparation'};
    dataCornerIds.push(candidate.id);copy.hand=copy.hand.filter(c=>c.id!==candidate.id);copy.resources.handSize=copy.hand.length;
    if(choice.score)players.gainResources(copy,{score:choice.score});
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
  const context={...state,players:state.players.players.map(v=>v.id===seatId?copy:v),aliens:structuredClone(state.aliens),finalScoring:structuredClone(state.finalScoring),cardEffects:effects,getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)};
  const score=endScoring.computePlayerFinalScore(context,copy).totalScore-endScoring.computePlayerFinalScore({...context,players:state.players.players},p).totalScore;
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
  const context={...state,players:state.players.players.map(v=>v.id===seatId?copy:v),aliens:structuredClone(state.aliens),finalScoring:structuredClone(state.finalScoring),cardEffects:effects,getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)};
  const score=endScoring.computePlayerFinalScore(context,copy).totalScore-endScoring.computePlayerFinalScore({...context,players:state.players.players},p).totalScore;
  const resources=Object.entries(stateValue.DEFAULT_WEIGHTS).reduce((n,[k,w])=>n+(copy.resources[k]-p.resources[k])*w,0);
  const capital={afterCapital:demand.planningCapital(state,copy),beforeCapital:beforeCapital??demand.planningCapital(state,p)};
  const net=stateValue.sumValueParts([score,resources,capital.afterCapital,-capital.beforeCapital]);
  if(!Number.isFinite(net))throw new Error('COMPUTER_PREFIX_VALUE_INVALID');
  return{policy:'seti-greedy-funded-computer-prefix-v1',available:true,selected:net>0,netGain:net,placements,requiredNativeInputs:placements*2,targetComputerSlot:goal.targetComputerSlot,
   immediateScoreGain:copy.resources.score-p.resources.score,player:copy,capital,assumption:'held data only, consecutive computer resource/score slots; shared current final score and purpose value, no income crossing or new card identity'};
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
  if(!prefix.available||!prefix.selected||prefix.placements!==3||prefix.player.resources.availableData!==0)return null;
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
  if(!goals.length){
    return {netGain:prefix.netGain,unrealizedPurposeDelta:stateValue.sumValueParts([prefix.capital.afterCapital,-prefix.capital.beforeCapital]),
      requiredNativeInputs:prefix.requiredNativeInputs+end.requiredNativeInputs,markedTiles:[],
      computerThenQuietEnd:{placements:prefix.placements,requiredPlacementInputs:prefix.requiredNativeInputs}};
  }
  if(goals.length!==1||goals[0].kind!=='blue-data'||goals[0].targetComputerSlot>goal.targetComputerSlot)return null;
  const blue=goals[0],reward=data.getBlueBonusPlacementReward(mid,blue.blueSlot);
  if(!reward||!['credits','energy','publicity'].includes(reward.type)||Object.keys(reward).some(k=>k!=='type'&&k!==reward.type))return null;
  const candidates=mid.hand.filter(c=>(cards.getDiscardActionRewardForCard(c)?.dataCount||0)>0);
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
  const p=owner(state,seatId),minimum=Math.min(...state.finalScoring.thresholds);
  if(Number.isSafeInteger(minimum)&&minimum>p.resources.score)return{available:true,netGain:0,purposeDelta:0,requiredNativeInputs:1,markedTiles:[]};
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
 function dataTailCompletion({state,seatId,canLeaveProbeStationary=null,trackPurposeDelta=false,firstBlueGoal=null,canContinue=null,initialIncomeGoal=null,initialIncomeTail=null,fixedDataOrdering=false,stationaryFinalData=false,exactFixedBlueTie=false}){
  // With no owned probe, the shared previews cover held/paid investment and
  // future currency income exactly. No new card identity or owned technology
  // is introduced. Live-probe travel at every round still needs its movement audit.
  // Every iteration fills computer4 or consumes a distinct blue bonus slot.
  const initialOwner=owner(state,seatId);
  const liveProbe=state.pieces.rockets.some(r=>[r.playerId,r.playerColor,r.color].some(id=>id===seatId||id===initialOwner.color));
  if(liveProbe&&!firstBlueGoal&&(!canLeaveProbeStationary||!canLeaveProbeStationary(state)))return{available:false,reason:'blue-tail-live-probe-needs-native-continuation'};
  let current=state;const plans=[];let netGain=0,requiredNativeInputs=1,immediateScoreGain=0;
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
  // This branch already selected one native blue goal. Its exact outcome is
  // still quotable when locally unprofitable; do not replace it with ending now.
  if(firstBlueGoal){
   if(firstBlueGoal.kind!=='blue-data')throw new Error('BLUE_TAIL_FIRST_GOAL_INVALID');
   const preview=previewBlueCompletion({state:current,seatId,goal:firstBlueGoal});if(!preview.available)return preview;
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
   const prefixes=goals.filter(g=>g.kind==='computer-prefix').map(goal=>({goal,preview:previewComputerCompletion({state:current,seatId,goal},currentCapital)}))
     .filter(p=>p.preview.available&&p.preview.selected).sort((a,b)=>b.preview.netGain-a.preview.netGain||a.preview.requiredNativeInputs-b.preview.requiredNativeInputs||a.goal.targetComputerSlot-b.goal.targetComputerSlot);
   // The caller has a separately audited conditional blue ordering. A new
   // partial column competing with it needs native continuation, at every
   // intermediate boundary, rather than a scalar proof for another policy.
   let orderedBlue=null;
   if(prefixes.length&&goals.some(g=>g.kind==='blue-data')){
    if(!fixedDataOrdering)return{available:false,reason:'computer-prefix-blue-order-needs-native-policy'};
    orderedBlue=previewBlueCompletion({state:current,seatId,goal:goals.find(g=>g.kind==='blue-data')},currentCapital);
    if(!orderedBlue.available)return orderedBlue;
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
   const preview=orderedBlue||previewBlueCompletion({state:current,seatId,goal},currentCapital);
   if(!preview.available)return preview;
   if(!preview.selected){
    if(requirements.bluePlacements.length>1){
     if(!fixedDataOrdering)return{available:false,reason:'nonpositive-blue-may-fund-another-column'};
     // There is one fixed blue order. Compare stopping now to the suffix
     // beginning with that exact next slot; each recursion consumes one slot.
     const rest=dataTailCompletion({state:current,seatId,canLeaveProbeStationary,canContinue,firstBlueGoal:goal,fixedDataOrdering,trackPurposeDelta,stationaryFinalData,exactFixedBlueTie});
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
     const rest=dataTailCompletion({state:after,seatId,canLeaveProbeStationary,canContinue}),endNow=quietEndCompletion({state:current,seatId});
     if(!rest.available||!endNow.available||stateValue.sumValueParts([preview.netGain,rest.netGain,-endNow.netGain])>=0)
      return{available:false,reason:'nonpositive-blue-needs-native-continuation'};
    }
    break;
   }
   const {player,capital,...summary}=preview;retainCapital(capital);
   if(data.listBlueBonusPlacedTokens(player).length!==data.listBlueBonusPlacedTokens(p).length+1)throw new Error('BLUE_TAIL_SLOT_NOT_CONSUMED');
   plans.push({goal,...summary});netGain=stateValue.sumValueParts([netGain,preview.netGain]);requiredNativeInputs+=preview.requiredNativeInputs;immediateScoreGain+=preview.immediateScoreGain;
   current={...current,players:{...current.players,players:current.players.players.map(v=>v.id===seatId?player:v)}};
  }
  const end=quietEndCompletion({state:current,seatId});if(!end.available)return end;
  return{available:true,plans,...(primaryOnly?{primaryOnly:true}:{}),netGain:stateValue.sumValueParts([netGain,end.netGain]),requiredNativeInputs:requiredNativeInputs+end.requiredNativeInputs-1,immediateScoreGain,markedTiles:end.markedTiles,
   ...(trackPurposeDelta?{purposeDelta:stateValue.sumValueParts([prefixPurpose(),end.purposeDelta])}:{})};
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
 function scanStep({state,seatId,goal,actions,status,session,operation={}}){
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
   scores.push({actionId:a.actionId,nebulaId,score,cardId:card?.id||null,loss,progress,gain,target});
  }
  scores.sort((a,b)=>b.score-a.score||a.loss-b.loss||tie(a,b));const skip=actions.find(a=>a.target?.done||a.target?.skip),chosen=scores[0];
  const id=skip&&(!chosen||chosen.score<=0)?skip.actionId:chosen?.actionId||skip?.actionId;
  if(!id)throw new Error('SCAN_PURPOSE_NO_LEGAL_STEP');
  return{kind:'fixed',actionId:id,reason:skip?.actionId===id?'scan-purpose-not-worth-extra-cost':'fixed-scan-card-and-sector',scores};
 }
 return Object.freeze({VERSION,finalMark,passDiscard,blueResearch,pureOptional,sectorPublicityReward,previewCappedSectorClaim,deferredSectorPublicityQuote,researchDataPurpose,quoteResearchDataPurpose,deferredComputerIncomeSource,quoteDeferredComputerIncome,researchScanPurpose,quoteResearchScanPurpose,scanTimingSource,quoteScanTiming,amibaRegionFollowup,quoteAmibaRegionFollowup,reorganization,incomeCompletion,blueCompletion,previewBlueCompletion,computerCompletion,previewScoredAmibaDataCorner,computerThenScoredCurrency,dataTailCompletion,quietEndCompletion,scanDecision,scanGoals,scanStep});
});
