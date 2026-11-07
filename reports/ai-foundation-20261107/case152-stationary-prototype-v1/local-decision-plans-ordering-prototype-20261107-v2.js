(function(root,factory){
 'use strict';const common=typeof module==='object'&&module.exports;
 const api=factory(common?require('../final-scoring'):root.SetiFinalScoring,common?require('../end-game-scoring'):root.SetiEndGameScoring,
  common?require('../cards/deck'):root.SetiCards,common?require('../cards/effects'):root.SetiCardEffects,
  common?require('../data'):root.SetiData,common?require('../players'):root.SetiPlayers,
  common?require('../actions/scan-effects'):root.SetiScanEffects,common?require('../effects/science-session'):root.SetiScienceSession,common?require('./resource-demand'):root.SetiResourceDemand,common?require('../effects/residual-domain-session'):root.SetiResidualDomainSession,common?require('./state-value'):root.SetiStateValue,common?require('./income-card-order'):root.SetiIncomeCardOrder);
 if(common)module.exports=api;else root.SetiLocalDecisionPlans=api;
})(typeof globalThis!=='undefined'?globalThis:window,function(finalScoring,endScoring,cards,effects,data,players,scanEffects,science,demand,residual,stateValue,incomeOrder){
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
  const context={...state,aliens:structuredClone(state.aliens),data:structuredClone(state.data)},helpers={getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)};
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
 function pureOptional({state,seatId,actions,session}){
  if(!actions.length||!actions.every(a=>a.family==='accept_optional_effect'))return null;
  const payload=session?.queue?.[0]?.payload;if(payload?.kind!=='trigger')return null;
  const confirms=actions.filter(a=>a.target?.choiceId?.startsWith('confirm:')),skip=actions.find(a=>a.target?.choiceId?.startsWith('skip:'));
  if(!confirms.length||!skip)return null;
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
  const context={...state,aliens:structuredClone(state.aliens),data:structuredClone(state.data),finalScoring:structuredClone(state.finalScoring),cardEffects:effects,getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)};
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
 function previewIncomeCompletion({state,seatId,goal}){
  const preview=demand.previewIncomeTail({state,seatId,goal});if(!preview.available)return{...preview,selected:false};
  const p=owner(state,seatId),context={...state,players:state.players.players,aliens:structuredClone(state.aliens),data:structuredClone(state.data),finalScoring:structuredClone(state.finalScoring),cardEffects:effects,getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)};
  const delta=endScoring.computePlayerFinalScore(context,preview.player).totalScore-endScoring.computePlayerFinalScore(context,p).totalScore;
  const capital=demand.incomeTailCapital({state,seatId,goal});
  const net=stateValue.sumValueParts([preview.netGain,delta,-preview.immediateScoreGain,capital.afterCapital,-capital.beforeCapital]);
  const realizesForecast=net===0&&demand.forecastDataPlan(state,p)?.fixed?.selected?.incomeCardId===goal.incomeCardId;
  return{policy:'seti-greedy-income-tail-v2',selected:net>0||realizesForecast,realizesForecast,netGain:net,placements:preview.placements,assumption:preview.assumption,capital};
 }
 function incomeCompletion(input){const {capital,...result}=previewIncomeCompletion(input);return result;}
 // Data plans write only these player fields. Existing card/technology
 // entities remain read-only, just as in resourceDemand.previewIncomeTail.
 function dataPreviewPlayer(p){return{...p,resources:{...p.resources},income:{...p.income},hand:[...p.hand],dataState:structuredClone(p.dataState)};}
 function previewBlueCompletion({state,seatId,goal},beforeCapital=null){
  const p=owner(state,seatId),copy=dataPreviewPlayer(p);const dataCornerIds=[];let incomeCardId=null;
  const required=data.getRequiredComputerSlotForBlueBonus(goal.blueSlot),occupied=new Set(data.listComputerPlacedTokens(p).map(t=>t.placementSlot));
  const computerPlacements=occupied.has(required)?0:Object.keys(data.COMPUTER_DATA_SLOTS).map(Number).filter(n=>n<=required&&!occupied.has(n)).length;

  // Every iteration consumes one card or fills one prerequisite. A full pool
  // first places data, matching native preparation without exceeding capacity.
  let remaining=computerPlacements;const previewRoot={meta:structuredClone(state.meta)};
  while(remaining>0||copy.resources.availableData<1){
   if(copy.resources.availableData<remaining+1&&copy.resources.availableData<players.RESOURCE_LIMITS.availableData){
    const current={...state,players:{...state.players,players:state.players.players.map(v=>v.id===seatId?copy:v)}};
    const candidate=demand.dataCornerCards({state:current,seatId,goal,selectionOnly:true})[0]?.card;
    if(!candidate)return{available:false,reason:'blue-tail-needs-preparation'};
    dataCornerIds.push(candidate.id);copy.hand=copy.hand.filter(c=>c.id!==candidate.id);copy.resources.handSize=copy.hand.length;
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
  const context={...state,players:state.players.players.map(v=>v.id===seatId?copy:v),aliens:structuredClone(state.aliens),data:structuredClone(state.data),finalScoring:structuredClone(state.finalScoring),cardEffects:effects,getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)};
  const score=endScoring.computePlayerFinalScore(context,copy).totalScore-endScoring.computePlayerFinalScore({...context,players:state.players.players},p).totalScore;
  const resource=Object.entries(stateValue.DEFAULT_WEIGHTS).reduce((n,[k,w])=>n+((copy.resources[k]||0)-(p.resources[k]||0))*w,0);
  const capital={afterCapital:demand.planningCapital(state,copy),beforeCapital:beforeCapital??demand.planningCapital(state,p)};
  const option=capital.afterCapital-capital.beforeCapital;
  const income=Object.entries(stateValue.DEFAULT_WEIGHTS).reduce((n,[k,w])=>n+((copy.income[k]||0)-(p.income[k]||0))*w,0)*(4-state.turn.roundNumber);
  const net=stateValue.sumValueParts([score,resource,option,income]);if(!Number.isFinite(net))throw new Error('BLUE_TAIL_VALUE_INVALID');
  const realizesForecast=net===0&&demand.forecastDataPlan(state,p)?.fixed?.selected?.blueSlot===goal.blueSlot;
  return{policy:'seti-greedy-blue-resource-tail-v2',available:true,selected:net>0||realizesForecast,realizesForecast,netGain:net,blueSlot:goal.blueSlot,dataCornerId:dataCornerIds[0]||null,dataCornerIds,incomeCardId,computerPlacements,requiredNativeInputs:2*(computerPlacements+1)+dataCornerIds.length+(incomeCardId?1:0),immediateScoreGain:copy.resources.score-p.resources.score,player:copy,capital,assumption:'known blue column/resource plan, greedy data corners and one shared-native currency income choice; default V including native end-game, permanent income and held-card opportunity cost; no new owned card identity'};
 }
 function blueCompletion(input){const {player,capital,...result}=previewBlueCompletion(input);return result;}
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
  const context={...state,players:state.players.players.map(v=>v.id===seatId?copy:v),aliens:structuredClone(state.aliens),data:structuredClone(state.data),finalScoring:structuredClone(state.finalScoring),cardEffects:effects,getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)};
  const score=endScoring.computePlayerFinalScore(context,copy).totalScore-endScoring.computePlayerFinalScore({...context,players:state.players.players},p).totalScore;
  const resources=Object.entries(stateValue.DEFAULT_WEIGHTS).reduce((n,[k,w])=>n+(copy.resources[k]-p.resources[k])*w,0);
  const capital={afterCapital:demand.planningCapital(state,copy),beforeCapital:beforeCapital??demand.planningCapital(state,p)};
  const net=stateValue.sumValueParts([score,resources,capital.afterCapital,-capital.beforeCapital]);
  if(!Number.isFinite(net))throw new Error('COMPUTER_PREFIX_VALUE_INVALID');
  return{policy:'seti-greedy-funded-computer-prefix-v1',available:true,selected:net>0,netGain:net,placements,requiredNativeInputs:placements*2,targetComputerSlot:goal.targetComputerSlot,
   immediateScoreGain:copy.resources.score-p.resources.score,player:copy,capital,assumption:'held data only, consecutive computer resource/score slots; shared current final score and purpose value, no income crossing or new card identity'};
 }
 function computerCompletion(input){const {player,capital,...result}=previewComputerCompletion(input);return result;}
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
 function dataTailCompletion({state,seatId,canLeaveProbeStationary=null,trackPurposeDelta=false,firstBlueGoal=null,canContinue=null,initialIncomeGoal=null,initialIncomeTail=null,fixedDataOrdering=false}){
  // With no owned probe, the shared previews cover held/paid investment and
  // future currency income exactly. No new card identity or owned technology
  // is introduced. Live-probe travel at every round still needs its movement audit.
  // Every iteration fills computer4 or consumes a distinct blue bonus slot.
  const initialOwner=owner(state,seatId);
  const liveProbe=state.pieces.rockets.some(r=>[r.playerId,r.playerColor,r.color].some(id=>id===seatId||id===initialOwner.color));
  if(liveProbe&&!firstBlueGoal&&(!canLeaveProbeStationary||!canLeaveProbeStationary(state)))return{available:false,reason:'blue-tail-live-probe-needs-native-continuation'};
  let current=state;const plans=[];let netGain=0,requiredNativeInputs=1,immediateScoreGain=0;
  let sourceCapital=null,currentCapital=null;
  // Private scalars from the selected typed preview only. Installing that same
  // player leaves all value facts unchanged; the audited callbacks are pure.
  // No value survives this call or attaches to a mutable state/player object.
  function retainCapital(capital){
   if(!plans.length)sourceCapital=capital?.beforeCapital??null;
   currentCapital=capital?.afterCapital??null;
  }
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
   if(canContinue&&!canContinue(current))return{available:false,reason:'data-tail-new-purpose-needs-native-continuation'};
   // The caller's audited pure query must reject every intermediate plan
   // boundary that could begin a new movement objective after receiving funds.
   if(liveProbe&&(!canLeaveProbeStationary||!canLeaveProbeStationary(current)))return{available:false,reason:'data-tail-movement-needs-native-continuation'};
   const p=owner(current,seatId),requirements={bluePlacements:data.listBluePlacementRequirements(p)};
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
   const incomeTail=income&&(reusedIncome||previewIncomeCompletion({state:current,seatId,goal:income}));
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
    const preview=demand.previewIncomeTail({state:current,seatId,goal:income});if(!preview.available)return preview;
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
    if(requirements.bluePlacements.length>1)return{available:false,reason:'nonpositive-blue-may-fund-another-column'};
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
  return{available:true,plans,netGain:stateValue.sumValueParts([netGain,end.netGain]),requiredNativeInputs:requiredNativeInputs+end.requiredNativeInputs-1,immediateScoreGain,markedTiles:end.markedTiles,
   ...(trackPurposeDelta?{purposeDelta:!plans.length?end.purposeDelta:stateValue.sumValueParts([currentCapital??demand.planningCapital(current,owner(current,seatId)),-(sourceCapital??demand.planningCapital(state,initialOwner)),end.purposeDelta])}:{})};
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
 return Object.freeze({VERSION,finalMark,passDiscard,blueResearch,pureOptional,reorganization,incomeCompletion,blueCompletion,computerCompletion,dataTailCompletion,quietEndCompletion,scanDecision,scanGoals,scanStep});
});
