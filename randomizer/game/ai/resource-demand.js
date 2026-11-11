(function(root,factory){
  'use strict';const common=typeof module==='object'&&module.exports;
  const api=factory(common?require('../cards/deck'):root.SetiCards,common?require('../cards/effects'):root.SetiCardEffects,
    common?require('../data'):root.SetiData,common?require('../players'):root.SetiPlayers,
    common?require('../abilities/rocket'):root.SetiAbilityRocket,common?require('../rockets'):root.SetiRocketActions,common?require('../industry'):root.SetiIndustry,common?require('./state-value'):root.SetiStateValue,common?require('../tech/resolver'):root.SetiTechResolver,common?require('./probe-capital'):root.SetiProbeCapital,common?require('./income-card-order'):root.SetiIncomeCardOrder,common?require('./scan-analysis-income-utility'):root.SetiScanAnalysisIncomeUtility,common?require('../tech/catalog'):root.SetiTechCatalog,common?require('../aliens/chong'):root.SetiAlienChong);
  if(common)module.exports=api;else root.SetiResourceDemand=api;
})(typeof globalThis!=='undefined'?globalThis:window,function(cards,effects,data,players,rocketAbility,rockets,industry,stateValue,techResolver,probeCapital,incomeOrder,scanIncome,techCatalog,chong){
  'use strict';
  const VERSION='seti-goal-resource-preparation-v27';
  const MONEY=new Set(['credits-for-energy','energy-for-credit','cards-for-credit','cards-for-energy']);
  const isPreparation=a=>a.family==='card_corner'||a.family==='place_data'||a.family==='quick_trade'&&MONEY.has(a.target?.tradeId);
  const owner=(s,id)=>s.players.players.find(p=>p.id===id);
  const placed=p=>data.listComputerPlacedTokens(p).length;
  const movePoints=c=>cards.getDiscardActionMoveRewardForCard(c)?.movementPoints||0;
  const cornerData=c=>cards.getDiscardActionRewardForCard(c)?.dataCount||0;
  const weight={credits:2,energy:2,publicity:1,handSize:2};
  function currentGoal(state,goal){
    if(!['route','held-landing-route'].includes(goal.kind))return goal;
    const probe=state.pieces.rockets.find(r=>r.id===goal.rocketId);if(!probe)return goal;
    const at=rockets.getRocketSectorCoordinate(probe);if(at.x===goal.coordinate.x&&at.y===goal.coordinate.y)return{...goal,path:[],movementPoints:0};
    const index=goal.path.findIndex(s=>s.from.x===at.x&&s.from.y===at.y);
    if(index<0)return goal;const path=goal.path.slice(index);return{...goal,path,movementPoints:path.reduce((n,s)=>n+s.requiredMovePoints,0)};
  }
  function bluePrerequisites(p,slot){
    const required=data.getRequiredComputerSlotForBlueBonus(slot),occupied=new Set(data.listComputerPlacedTokens(p).map(t=>t.placementSlot));
    return occupied.has(required)?0:Object.keys(data.COMPUTER_DATA_SLOTS).map(Number).filter(n=>n<=required&&!occupied.has(n)).length;
  }
  function needs(state,seatId,goal){
    goal=currentGoal(state,goal);
    const p=owner(state,seatId),required={...(goal.required||{})};
    if(goal.kind==='route')required.energy=(goal.endpointCost.energy||0)+Math.max(0,goal.movementPoints-p.hand.reduce((n,c)=>n+movePoints(c),0));
    if(goal.kind==='held-landing-route')required.energy=goal.directTransport?0:goal.embeddedMove?(goal.path.length>1&&!goal.movementCardId?1:0):goal.movementPoints;
    const target=targetSlot(p,goal);
    const d={credits:Math.max(0,(required.credits||0)-p.resources.credits),energy:Math.max(0,(required.energy||0)-p.resources.energy),
      publicity:Math.max(0,(required.publicity||0)-p.resources.publicity),data:Math.max(0,(goal.kind==='blue-data'?bluePrerequisites(p,goal.blueSlot)+1:target?Math.max(0,target-placed(p)):0)-p.resources.availableData)};
    return d;
  }
  const protectedCard=(c,g)=>!c.id||c.id===g.cardId||c.id===g.incomeCardId||c.id===g.continuationCardId||c.id===g.retainedResearchCardId;
  const targetSlot=(p,g)=>g.publicityData&&p.resources.publicity>=(g.required.publicity||0)?0:g.targetComputerSlot||0;
  const deficit=d=>Object.values(d).reduce((n,v)=>n+v,0);
  function capacity(state,seatId,goal,allowBlue=true){
    const p=owner(state,seatId);
    if(goal.kind==='computer-prefix'){
      const slots=data.listComputerPlacedTokens(p).map(t=>t.placementSlot).sort((a,b)=>a-b),target=goal.targetComputerSlot;
      return Number.isInteger(target)&&target>=1&&target<=6&&slots.every((s,i)=>s===i+1)
        &&!(slots.length<4&&target>=4)&&p.resources.availableData===p.dataState.poolTokens.length
        &&p.resources.availableData>=Math.max(0,target-slots.length);
    }
    const d=needs(state,seatId,goal);
    // No source is needed once the current wallet funds every obligation.
    // Otherwise calculate only the bounds that an actual deficit can use.
    if(!d.credits&&!d.energy&&!d.publicity&&!d.data)return true;
    const spare=p.hand.filter(c=>!protectedCard(c,goal));
    const publicityComputer=d.publicity?placed(p):2;
    const multiplier=d.publicity||d.data||state.turn.roundNumber===3
      ?(industry.shouldDoubleDiscardCornerRewards?.(p)?2:1):1;
    const cornerDataMax=d.data||publicityComputer<2?spare.reduce((n,c)=>n+cornerData(c)*multiplier,0):0;
    const publicityMax=d.publicity?p.resources.publicity+spare.reduce((n,c)=>n+(cards.getDiscardActionRewardForCard(c)?.gain?.publicity||0)*multiplier,0)
      +(publicityComputer<2&&publicityComputer+p.resources.availableData+cornerDataMax>=2?1:0):0;
    const required=goal.required||{},funding=goal.incomeFunding&&placed(p)<4&&p.hand.find(c=>c.id===goal.incomeCardId);
    const income=funding?cards.getIncomeGainForCard(funding)||{}:{};
    // Named scans reserve money and energy together. Conversion burns one
    // total unit, and two discarded cards give at most one unit. Count all
    // pure corner currency as well as the same cards' pair capacity, an
    // optimistic upper bound. Keep observer paths and the typed blue plan.
    const soloScan=['scan','scan-flow'].includes(goal.kind)&&state.turn.roundNumber===3
      &&industry.getPlayerIndustryDefinition(p)?.activeAbilityId==='deepspace_swap_cards'
      &&state.turn.activePlayerIds?.includes(seatId)&&state.turn.activePlayerIds.every(id=>id===seatId||state.turn.passedPlayerIds.includes(id))
      &&Object.keys(required).every(key=>['credits','energy'].includes(key))
      &&[required.credits||0,required.energy||0,p.resources.credits,p.resources.energy].every(n=>Number.isSafeInteger(n)&&n>=0)
      &&!['cardCorner','quick_trade_payment','quick_trade_discard_selection'].some(event=>observes(state,seatId,event));
    const wallet=p.resources.credits+p.resources.energy+(income.credits||0)+(income.energy||0);
    const corners=soloScan?spare.reduce((n,c)=>{
      const gain=cards.getDiscardActionRewardForCard(c)?.gain;
      return n+Math.max(0,gain?.credits||0)*multiplier+Math.max(0,gain?.energy||0)*multiplier;
    },0):0;
    if(soloScan&&(required.credits||0)+(required.energy||0)>wallet+Math.floor(spare.length/2)+corners)
      return allowBlue&&Boolean(blueFunding(state,seatId,goal));
    const direct=(!d.credits||p.resources.credits+(income.credits||0)+Math.floor(p.resources.energy/2)+Math.floor(spare.length/2)>=(required.credits||0))
      &&(!d.energy||p.resources.energy+(income.energy||0)+Math.floor(p.resources.credits/2)+Math.floor(spare.length/2)+(goal.kind==='route'?spare.reduce((n,c)=>n+movePoints(c),0):0)>=(goal.kind==='route'?(goal.endpointCost.energy||0)+goal.movementPoints:required.energy||0))
      &&(!d.publicity||publicityMax+(income.publicity||0)>=required.publicity)
      &&(!d.data||cornerDataMax>=d.data);
    return direct||allowBlue&&Boolean(blueFunding(state,seatId,goal));
  }
  function blueFunding(state,seatId,goal){
    if(goal.kind==='blue-data')return null;
    const p=owner(state,seatId),d=needs(state,seatId,goal);
    const soloScan=goal.kind==='scan'&&state.turn.roundNumber===3&&state.turn.activePlayerIds?.includes(seatId)
      &&state.turn.activePlayerIds.every(id=>id===seatId||state.turn.passedPlayerIds.includes(id));
    // A landing-pair formula only reads landing counts. This scan funding
    // puts data under existing tech and pays currency; it cannot change them.
    if(!d.credits&&!d.energy&&!d.publicity||p.reservedCards.some(c=>{
      const scoring=effects.getCardModel(c)?.endGameScoring;
      return scoring&&!(soloScan&&scoring.kind==='planetLandingPairs');
    }))return null;
    const choices=[];
    for(const slot of Object.keys(data.BLUE_BONUS_DATA_SLOTS).map(Number)){
      if(!data.hasBlueTechInBoardSlot(p,slot)||data.listBlueBonusPlacedTokens(p).some(t=>t.blueSlot===slot))continue;
      const reward=data.getBlueBonusPlacementReward(p,slot),required=data.getRequiredComputerSlotForBlueBonus(slot);
      if(!reward||!['credits','energy','publicity'].includes(reward.type))continue;
      // A known currency reward can also meet the other currency's deficit
      // through the ordinary2:1 trade. Reserve both costs in one wallet.
      const cost={credits:goal.required?.credits||0,energy:goal.required?.energy||0};
      const indirect=goal.kind!=='route'&&['credits','energy'].includes(reward.type)
        &&!probeCapital.funding(p.resources,cost,stateValue.DEFAULT_WEIGHTS);
      if(!(d[reward.type]>0)&&!indirect)continue;
      const remaining=bluePrerequisites(p,slot);
      // Crossing slot4 would require an additional native income-card choice;
      // leave that case to its existing explicit goal instead of guessing it.
      if(placed(p)<4&&required>=4||p.resources.availableData<remaining+1)continue;
      const copy=structuredClone(p);let valid=true;
      for(let i=0;i<remaining;i++){
        const r=data.placeDataToComputer(copy);if(!r.ok){valid=false;break;}
        for(const b of r.slotBonuses||[]){if(!['score','publicity'].includes(b.type)){valid=false;break;}players.gainResources(copy,{[b.type]:b[b.type]});}
      }
      if(!valid)continue;
      const placedBlue=data.placeDataToComputer(copy,{target:data.PLACEMENT_KIND_BLUE_BONUS,blueSlot:slot});
      if(!placedBlue.ok)continue;
      for(const b of placedBlue.slotBonuses||[])players.gainResources(copy,{[b.type]:b[b.type]});
      const next={...state,players:{...state.players,players:state.players.players.map(v=>v.id===seatId?copy:v)}};
      if(!capacity(next,seatId,goal,false))continue;
      const reduction=deficit(d)-deficit(needs(next,seatId,goal));
      const conversionFunded=indirect&&Boolean(probeCapital.funding(copy.resources,cost,stateValue.DEFAULT_WEIGHTS));
      if(reduction>0||conversionFunded)choices.push({blueSlot:slot,remainingComputerPlacements:remaining,reduction:Math.max(reduction,Number(conversionFunded))});
    }
    choices.sort((a,b)=>b.reduction-a.reduction||a.remainingComputerPlacements-b.remainingComputerPlacements||a.blueSlot-b.blueSlot);
    return choices[0]||null;
  }
  // One concrete, known income source may fund a protected card. Its own
  // reward cannot fund the data needed to reach it; no hand subset is searched.
  function incomeFunding(state,seatId,goal){
    const p=owner(state,seatId);
    if(!['play_card','effect-purpose'].includes(goal.kind)||!goal.cardId||goal.incomeCardId||placed(p)>=4)return null;
    const multiplier=industry.shouldDoubleDiscardCornerRewards?.(p)?2:1;
    const choices=p.hand.filter(c=>c.id!==goal.cardId).map(card=>({card,gain:cards.getIncomeGainForCard(card)})).filter(({card,gain})=>gain
      &&Object.entries(goal.required||{}).every(([key,n])=>p.resources[key]+(gain[key]||0)>=n)
      &&p.resources.availableData+p.hand.filter(c=>c.id!==goal.cardId&&c.id!==card.id).reduce((n,c)=>n+cornerData(c)*multiplier,0)>=4-placed(p));
    const value=gain=>Object.entries(gain).reduce((n,[k,v])=>n+v*({credits:1,energy:1,handSize:1,publicity:.5,availableData:.5}[k]||0),0);
    choices.sort((a,b)=>value(b.gain)-value(a.gain)||incomeOrder.compare(a.card,b.card));
    const card=choices[0]?.card;
    return card?{...goal,targetComputerSlot:4,incomeCardId:card.id,incomeFunding:true}:null;
  }
  // Pay a known pickup with the next computer income when the normal
  // two-card exchange would consume both known movement tools. Keep a
  // single fixed payment for this goal, without making the two wallets
  // equivalent or removing exchanges for other goals.
  function pickupIncomePayment(state,seatId,goal,requirements,actions){
    if(goal.kind!=='play_card'||goal.required?.credits!==1||Object.keys(goal.required).length!==1)return null;
    const p=owner(state,seatId),t=state.turn;
    if(t.roundNumber!==3||t.currentPlayerId!==seatId
      ||!t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id))
      ||p.resources.credits||p.resources.energy||placed(p)!==3||p.resources.availableData<1
      ||p.hand.length!==3||p.hand.some(c=>!c.id||!c.cardId||c.hidden)
      ||!actions.some(a=>a.family==='place_data'))return null;
    const card=p.hand.find(c=>c.id===goal.cardId),payers=p.hand.filter(c=>c!==card);
    if(!card||!payers.every(c=>movePoints(c)===1))return null;
    const types=effects.buildPlayEffects(card).map(e=>e.type);
    if(types.join(',')!=='card_move,chong_land_for_pickup,chong_pickup_fossil'
      ||!requirements.probeCandidates?.some(c=>!c.launchRequired&&c.rocketId!=null&&c.endpointFamily==='land'
        &&(c.planetId==='jupiter'||c.planetId==='saturn')&&c.path.length===0))return null;
    const funding=incomeFunding(state,seatId,goal);
    if(!funding)return null;
    const gain=cards.getIncomeGainForCard(payers.find(c=>c.id===funding.incomeCardId));
    return gain?.credits===1&&Object.keys(gain).length===1?{...funding,id:goal.id+':income:'+funding.incomeCardId}:null;
  }
  function heldAndResearchCapital(state,p){
    const passing=(state.passingPlayerIds||state.turn.passedPlayerIds).includes(p.id)||p.passCompletionPending===true;
    const funding=stateValue.researchFunding(valueFacts(state,p),
      {resources:p.resources,income:p.income,startingIncome:Number(passing)});
    return stateValue.handCapital(p.hand,p.techState,state.tech,state.turn.roundNumber+Number(passing),stateValue.DEFAULT_WEIGHTS,funding)
      +stateValue.researchCapital({hand:p.hand,techState:p.techState,supply:state.tech,round:state.turn.roundNumber,
        publicity:p.resources.publicity,researchCost:techResolver.getResearchPublicityCost(p),passed:passing,funding});
  }
  const immutableCapitalInputs=new WeakSet(),planningCapitalQuotes=new WeakMap();
  function immutableCapitalInput(value){
    if(!value||typeof value!=='object')return true;
    if(immutableCapitalInputs.has(value))return true;
    if(!Object.isFrozen(value))return false;
    const prototype=Object.getPrototypeOf(value);
    if(!Array.isArray(value)&&prototype!==Object.prototype&&prototype!==null)return false;
    if(!Object.values(value).every(immutableCapitalInput))return false;
    immutableCapitalInputs.add(value);return true;
  }
  const immutableValueFacts=new WeakMap();
  function valueFacts(state,p){
    const immutable=Object.isFrozen(state)&&Object.isFrozen(p)&&immutableCapitalInput(state)&&immutableCapitalInput(p);
    let owners=immutable?immutableValueFacts.get(state):null;
    if(owners?.has(p))return owners.get(p);
    const facts={...probeCapital.factsFromState(state,p),supply:state.tech,researchCost:techResolver.getResearchPublicityCost(p),
      reservedCards:p.reservedCards,analyzeEnergyCost:industry.canAnalyzeWithoutEnergy(p)?0:data.ANALYZE_ENERGY_COST};
    if(immutable){if(!owners){owners=new WeakMap();immutableValueFacts.set(state,owners);}owners.set(p,facts);}
    return facts;
  }
  function planningCapitalDetails(state,p){
    // Only fully immutable source/player pairs can share this value. Mutable
    // previews compute directly; there is no serialized-key invalidation cost.
    const immutable=Object.isFrozen(p)&&Object.isFrozen(state)&&immutableCapitalInput(p)&&immutableCapitalInput(state);
    let quotes=immutable?planningCapitalQuotes.get(state):null;
    if(quotes?.has(p))return quotes.get(p);
    const facts=valueFacts(state,p);
    const value=stateValue.purposeCapital(facts);
    if(immutable){if(!quotes){quotes=new WeakMap();planningCapitalQuotes.set(state,quotes);}quotes.set(p,value);}
    return value;
  }
  function noFinalRoundMarkCapital(state,p){
    const board=state.finalScoring, score=p.resources.score;
    if(state.turn.roundNumber!==4||!Number.isSafeInteger(score)||!Array.isArray(board?.thresholds)||!board.tiles)return false;
    const tiles=Object.values(board.tiles);
    return board.thresholds.every(threshold=>Number.isSafeInteger(threshold)&&(threshold>score
      ||tiles.some(tile=>tile.marks?.some(mark=>mark.playerId===p.id&&Number(mark.threshold)===threshold))));
  }
  function planningCapital(state,p){
    // Round four keeps only current probe missions and earned final marks.
    if(noFinalRoundMarkCapital(state,p)){
      if(!probeCapital.ownedProbes(state.pieces?.rockets,p).length)return 0;
      const mission=probeCapital.prepareFinalRoundSwapMission(state,p);
      return mission.quote(p.hand,state.cards.publicCards);
    }
    return Object.isFrozen(state)&&Object.isFrozen(p)?planningCapitalDetails(state,p).total
      :stateValue.purposeCapital(valueFacts(state,p)).total;
  }
  function planningAnalysisCapital(state,p){return planningCapitalDetails(state,p).analysisPotential;}
  const knownDirectSwapEffects=new Set(['card_research_tech','card_pick_card_corner_reward','card_income','card_tuck_played_card_to_income','card_discard_any_for_income']);
  function purePublicityCorner(card){
    if(!card?.id||!card.cardId||card.hidden)return 0;
    const reward=cards.getDiscardActionRewardForCard(card);
    return reward&&!reward.dataCount&&Object.keys(reward.gain||{}).every(k=>k==='publicity')?reward.gain.publicity||0:0;
  }
  function hasDistinctSwapPurpose(card,ignoreDeferredPick=false){
    const model=effects.getCardModel(card);if(!model)return true;
    const body=model.playEffects||[];
    const direct=body.some(e=>knownDirectSwapEffects.has(e.type));
    const deferredPick=ignoreDeferredPick&&body.length===1&&body[0].type==='card_pick_card_corner_reward'
      &&body[0].options?.allowBlindDraw===false&&Object.keys(body[0].options).length===1;
    return direct&&!deferredPick
      ||stateValue.hasKnownSymbolTool([card])||stateValue.hasKnownSectorTool([card])
      ||stateValue.hasKnownMovementTool([card])||Boolean(probeCapital.heldLandingCost(card));
  }
  function keepSwapPortfolioOffer(outgoingCorner,card,settledIncome=null){
    const corner=purePublicityCorner(card);
    if(outgoingCorner&&corner===outgoingCorner)return hasDistinctSwapPurpose(card);
    if(!settledIncome||!corner||corner>outgoingCorner)return true;
    const code=cards.getIncomeCodeForCard(card);
    if(code!==settledIncome.code&&(code!==2||!settledIncome.hasSpareCards))return true;
    // The existing concrete acquisition checks have already run. This
    // fallback does not price a weaker corner with the same printed income,
    // or replace funded currency with an anonymous card on a stocked hand,
    // unless the offered card opens a distinct modeled purpose.
    // A paid future public-corner play is not a current concrete purpose
    // by itself when this exchange otherwise keeps the same currency and
    // gives away publicity. Explicit funding and known acquisitions already ran.
    return hasDistinctSwapPurpose(card,code===settledIncome.code);
  }
  function knownSwapPortfolioQuotes({state,seatId,outgoing,offered},knownSourceCapital=null){
    // This is the exceptional-card fallback, after the caller has checked a
    // funded income swap and concrete income/data/move/card purposes. An
    // offer with the same publicity corner still needs a distinct known
    // play purpose here. This is a greedy policy, not Native equivalence.
    if(state.turn.roundNumber===3){
      const corner=purePublicityCorner(outgoing),p=owner(state,seatId),code=cards.getIncomeCodeForCard(outgoing);
      const settledIncome=corner&&[0,1].includes(code)&&p.mainActionCompleted
        &&state.turn.activePlayerIds.every(id=>id===seatId||state.turn.passedPlayerIds.includes(id))
        &&state.aliens.amiba?.revealInitialized===true
        ?{code,hasSpareCards:p.hand.length>=3}:null;
      offered=offered.filter(card=>keepSwapPortfolioOffer(corner,card,settledIncome));
    }
    if(!offered.length)return[];
    const p=owner(state,seatId);
    if(noFinalRoundMarkCapital(state,p)){
      const mission=probeCapital.prepareFinalRoundSwapMission(state,p);
      const publicCards=state.cards.publicCards;
      // Round four's only surviving purpose here is the current mission.
      // If it cannot consume income, all exchanges have the same value.
      if(!mission.sensitive){
        const gain=knownSourceCapital===null?0:mission.quote(p.hand,publicCards)-knownSourceCapital;
        return offered.map(card=>({card,gain}));
      }
      const before=knownSourceCapital??mission.quote(p.hand,publicCards);
      return offered.map(card=>({card,gain:mission.quote(p.hand.map(c=>c.id===outgoing.id?card:c),
        publicCards.map(c=>c?.id===card.id?outgoing:c))-before}));
    }
    const source=valueFacts(state,p),before=knownSourceCapital??planningCapital(state,p);
    // The fixed public exchange spends the company mark. Do not price
    // the replacement as if a second exchange were available this round.
    const companyState=source.companyState?.abilityId==='deepspace_swap_cards'
      ?{...source.companyState,roundMarkRound:state.turn.roundNumber,roundMarkTurn:state.turn.turnNumber}
      :source.companyState;
    return offered.map(incoming=>{
      const hand=source.hand.map(c=>c.id===outgoing.id?incoming:c);
      const preview={...source,hand,companyState,
        board:{...source.board,publicCards:source.board.publicCards.map(c=>c?.id===incoming.id?outgoing:c)},
        pendingHandCardTriggers:effects.listPendingTriggerKeys({...p,reservedCards:hand},state.turn)};
      preview.sourcePendingFinalMarkChoice=source.amibaTraces&&source.companyState?.abilityId==='deepspace_swap_cards'
        ?probeCapital.pendingFinalMarkOption(preview):null;
      return{card:incoming,gain:stateValue.purposeCapital(preview).total-before};
    });
  }
  function movementToolPlan(state,p){return planningCapitalDetails(state,p).toolPlan;}
  function forecastDataPlan(state,p){
    if(!Object.entries(p.techState.blueBoardSlots).some(([id,slot])=>slot<=2&&p.techState.ownedTiles[id]&&!p.techState.disabledTiles[id]&&['blue1','blue2','blue4'].includes(id)))return null;
    const capital=planningCapitalDetails(state,p);
    const analysis=capital.analysisPlan;
    // A funded computer4 income can be flat because the same fixed analysis
    // already includes its reward. Preserve that exact supplier, without
    // treating a post-analysis blue slot as a current-turn blue purpose.
    if(analysis?.value>0&&analysis.selected?.incomeCardId)return{fixed:{selected:{incomeCardId:analysis.selected.incomeCardId}},
      reason:'realize-funded-analysis-income'};
    return capital.dataPotential>0?capital.dataPlan:null;
  }
  function incomeSwapPlan(state,p,committed=false){
    // The public income bridge stops in R4; the older typed fallback stops
    // when an alien is revealed. A spent company mark cannot change either.
    if(state.turn.roundNumber>=4&&Object.values(state.aliens?.aliens||{}).some(slot=>slot.revealed))return null;
    const exact=!committed&&planningCapitalQuotes.get(state)?.get(p);
    let facts=valueFacts(state,p);
    // In a native pending swap the mark is already spent by this very flow.
    // Quote its remaining selection with the live wallet, without refunding
    // the mark in any native state or admitting a second company action.
    if(committed&&facts.companyState?.abilityId==='deepspace_swap_cards'){
      // This call is made only for the exact Native swap_hand/public menus.
      // Exchange has no other pending reward; do not synthesize a live action.
      facts={...facts,companyState:{...facts.companyState,roundMarkRound:0},pendingNativeEffects:false};
    }
    // Most states cannot use this option. Decline before computing the whole
    // portfolio, rather than repricing it at every unrelated card menu.
    const planned=exact?exact.knownPublicIncomeSwapPlan:stateValue.knownPublicIncomeSwapPlan(facts);
    // Anonymous quantity can fund a forecast, never an executable selection.
    if(planned?.outgoingCardId)return planned;
    // The older typed continuation rejects this board for every currency.
    if(facts.board.aliens.slots.some(s=>s.revealed))return null;
    return stateValue.incomeAllocationCapital(facts).knownSwapPlan;
  }
  const immutableRemovalCapital=new WeakMap();
  function incomeOpportunityCost(state,p,card,beforeCapital=planningCapital(state,p)){
    // Different goals repeatedly remove the very same card from one complete
    // immutable Native source. Share only that pure remaining-capital scalar;
    // callers may supply a different baseline (for example income preparation).
    const immutable=card&&Object.isFrozen(state)&&Object.isFrozen(p)&&Object.isFrozen(card)
      &&immutableCapitalInput(state)&&immutableCapitalInput(p)&&immutableCapitalInput(card);
    let owners=immutable?immutableRemovalCapital.get(state):null,quotes=owners?.get(p),after;
    if(quotes?.has(card))after=quotes.get(card);
    else{
      const hand=p.hand.filter(c=>c.id!==card.id);
      after=planningCapital(state,{...p,hand,resources:{...p.resources,handSize:Math.max(0,p.resources.handSize-1)}});
      if(immutable){if(!owners){owners=new WeakMap();immutableRemovalCapital.set(state,owners);}if(!quotes){quotes=new WeakMap();owners.set(p,quotes);}quotes.set(card,after);}
    }
    return stateValue.sumValueParts([beforeCapital,-after]);
  }
  const immutableIncomePreparationQuotes=new WeakMap();
  function incomePreparationCapital(state,p,projectedData=0,knownCapital=null){
    const current=knownCapital??planningCapital(state,p);
    // Both future income preparation and its scan bridge are closed in R4.
    if(state.turn.roundNumber===4)return current;
    if(!Object.entries(p.techState.blueBoardSlots).some(([id,slot])=>slot<=2&&p.techState.ownedTiles[id]&&!p.techState.disabledTiles[id]
      &&["blue1","blue2","blue4"].includes(id)))return current;
    const immutable=Object.isFrozen(state)&&Object.isFrozen(p)&&immutableCapitalInput(state)&&immutableCapitalInput(p);
    let owners=immutable?immutableIncomePreparationQuotes.get(state):null,quotes=owners?.get(p),prepared;
    if(quotes?.has(projectedData))prepared=quotes.get(projectedData);
    else{
      const facts=valueFacts(state,p);
      const player={...facts.player,availableData:Math.min(players.RESOURCE_LIMITS.availableData,facts.player.availableData+projectedData)};
      prepared=stateValue.incomePreparationCapital({...facts,player});
      // Ranking only: an already-priced purpose keeps its existing capital.
      // This fixed known scan cannot become a Native tail/pruning certificate.
      if(!current&&!prepared&&!projectedData)prepared=scanIncome.quote({state,player:p,weights:stateValue.DEFAULT_WEIGHTS}).value;
      if(immutable){if(!owners){owners=new WeakMap();immutableIncomePreparationQuotes.set(state,owners);}if(!quotes){quotes=new Map();owners.set(p,quotes);}quotes.set(projectedData,prepared);}
    }
    // Current mission and immediate fixed-data preparation are alternatives,
    // never two uses of the same wallet. This is a greedy ranking utility.
    return Math.max(current,prepared);
  }
  function incomeCardValue(state,seatId,card){
    const p=owner(state,seatId);return incomeValueWithCapital(state,p,card,incomePreparationCapital(state,p));
  }
  function computerIncomeValue(state,seatId,card){
    const quote=incomeTailEndpoint({state,seatId,goal:{incomeCardId:card.id}});
    // The fourth-slot choice happens after its data and column rewards.
    // Quote that real fixed endpoint, so it cannot collect computer4 twice.
    return quote.available?quote.netGain+quote.preparedCapital:null;
  }
  const immutableIncomeTailQuotes=new WeakMap();
  function incomeTailEndpoint({state,seatId,goal},knownPreview=null){
    const p=owner(state,seatId),card=p.hand.find(c=>c.id===goal.incomeCardId);
    // Store scalars only, keyed by the complete immutable native source and
    // the exact owner/card objects. Mutable previews never share this cache.
    const immutable=card&&Object.isFrozen(state)&&Object.isFrozen(p)&&Object.isFrozen(card)
      &&immutableCapitalInput(state)&&immutableCapitalInput(p);
    let owners=immutable?immutableIncomeTailQuotes.get(state):null,quotes=owners?.get(p);
    if(quotes?.has(card))return quotes.get(card);
    const preview=knownPreview??computeIncomeTailPreview({state,seatId,goal},true);
    const after=preview.available?planningCapital(state,preview.player):null;
    const quote=Object.freeze(preview.available?{available:true,netGain:preview.netGain,afterCapital:after,
      preparedCapital:incomePreparationCapital(state,preview.player,0,after)}:{available:false,reason:preview.reason});
    if(immutable){if(!owners){owners=new WeakMap();immutableIncomeTailQuotes.set(state,owners);}if(!quotes){quotes=new WeakMap();owners.set(p,quotes);}quotes.set(card,quote);}
    return quote;
  }
  function incomeTailCapital(input){return quoteIncomeTail(input);}
  function quoteIncomeTail(input,knownPreview=null,knownSourceCapital=null){
    const endpoint=incomeTailEndpoint(input,knownPreview);
    if(!endpoint.available)return endpoint;
    // Candidate ranking needs only net gain and prepared endpoint capital.
    // The source quote belongs to the selected relative proof, not every card.
    const {state,seatId}=input,{available,netGain,afterCapital,preparedCapital}=endpoint;
    return Object.freeze({available,netGain,beforeCapital:knownSourceCapital??planningCapital(state,owner(state,seatId)),afterCapital,preparedCapital});
  }
  function incomeTailWithPreview(input,knownSourceCapital=null){
    const preview=previewIncomeTail(input);
    return{preview,capital:preview.available?quoteIncomeTail(input,preview,knownSourceCapital):null};
  }
  // Scalar facts at the actual unknown-card boundary, not a native successor.
  // The draw consumes one public deck count; its identity never enters funding.
  function blindIncomeBoundaryCapital({state,seatId,goal}){
    const p=owner(state,seatId),card=p.hand.find(c=>c.id===goal.incomeCardId),gain=card&&cards.getIncomeGainForCard(card);
    const count=state.cards.drawPileCardIds?.length;
    if(gain?.handSize!==1||Object.keys(gain).length!==1||!Number.isSafeInteger(count)||count<1)return null;
    const preview=computeIncomeTailPreview({state,seatId,goal},true);if(!preview.available)return null;
    const facts=valueFacts(state,preview.player),after=stateValue.purposeCapital({...facts,board:{...facts.board,ordinaryDrawCount:count-1}}).total;
    const old=incomeTailCapital({state,seatId,goal});
    return{beforeCapital:old.beforeCapital,originalAfterCapital:old.afterCapital,afterCapital:after,ordinaryDrawCountBefore:count,ordinaryDrawCountAfter:count-1};
  }
  function incomeOfferValue(state,seatId,card,projectedData=0){
    // Public offers share the pre-pick baseline. Do not subtract the newly
    // acquired card's own different preparation value while ranking offers.
    return incomeValueWithCapital(state,owner(state,seatId),card,0,projectedData);
  }
  const immutableIncomeCardQuotes=new WeakMap();
  function incomeValueWithCapital(state,p,card,beforeCapital,projectedData=0){
    const immutable=card&&Object.isFrozen(state)&&Object.isFrozen(p)&&Object.isFrozen(card)
      &&immutableCapitalInput(state)&&immutableCapitalInput(p)&&immutableCapitalInput(card);
    let owners=immutable?immutableIncomeCardQuotes.get(state):null,cardsByOwner=owners?.get(p),quotes=cardsByOwner?.get(card);
    if(quotes?.has(projectedData))return stateValue.sumValueParts([quotes.get(projectedData),-beforeCapital]);
    const gain=cards.getIncomeGainForCard(card);
    const next={...p,hand:p.hand.filter(c=>c.id!==card.id),resources:{...p.resources,handSize:p.resources.handSize-1},income:{...p.income},
      dataState:{...p.dataState,poolTokens:[...p.dataState.poolTokens]}};
    let previewRoot=null;
    players.gainIncome(next,gain,{blindDraw:target=>target.resources.handSize++,
      gainData:target=>data.gainData(target,{root:previewRoot||(previewRoot={meta:structuredClone(state.meta)})})});
    const linear=Object.entries(gain).reduce((n,[k,v])=>n+v*({credits:1,energy:1,handSize:1,publicity:.5,availableData:.5}[k]||0),0)*(5-state.turn.roundNumber);
    const overflow=(gain.publicity?gain.publicity-next.resources.publicity+p.resources.publicity:0)*.5
      +(gain.availableData?gain.availableData-next.resources.availableData+p.resources.availableData:0)*.5;
    const after=stateValue.sumValueParts([linear,-overflow,incomePreparationCapital(state,next,projectedData)]);
    if(immutable){if(!owners){owners=new WeakMap();immutableIncomeCardQuotes.set(state,owners);}if(!cardsByOwner){cardsByOwner=new WeakMap();owners.set(p,cardsByOwner);}if(!quotes){quotes=new Map();cardsByOwner.set(card,quotes);}quotes.set(projectedData,after);}
    return stateValue.sumValueParts([after,-beforeCapital]);
  }
  // Keep the main rank intact. When its leading currency choices tie,
  // compare the same known landing paid from the one remaining salary plus
  // the immediate income reward. No new route or value is added to search.
  function rankIncomeChoices(state,p,rows){
    rows.sort((a,b)=>b.value-a.value||incomeOrder.compare(a.card,b.card));
    const t=state.turn;
    if(rows.length<2||rows[0].value!==rows[1].value||t.roundNumber!==3||!p.mainActionCompleted
      ||p.resources.credits!==0||p.resources.energy!==0||p.passCompletionPending
      ||industry.getPlayerIndustryDefinition(p)?.activeAbilityId!=='deepspace_swap_cards'
      ||!t.activePlayerIds?.includes(p.id)||t.activePlayerIds.some(id=>id!==p.id&&!t.passedPlayerIds.includes(id))
      ||p.hand.some(c=>c.hidden||movePoints(c))||t.cardTurnEventBonuses?.length||observes(state,p.id,'move'))return rows[0];
    const tied=rows.filter(row=>row.value===rows[0].value);
    const currency=c=>{
      const gain=cards.getIncomeGainForCard(c),k=Object.keys(gain||{});
      return k.length===1&&['credits','energy'].includes(k[0])&&gain[k[0]]===1?k[0]:null;
    };
    const types=tied.map(row=>currency(row.card));
    if(types.includes(null)||new Set(types).size!==2)return rows[0];
    const facts=valueFacts(state,p);
    if(probeCapital.ownedProbes(facts.board.rockets,facts.player).length!==1)return rows[0];
    const wallet={credits:p.income.credits,energy:p.income.energy},score={credits:0,energy:0};
    for(const goal of probeCapital.requirements(facts)){
      if(goal.endpointFamily!=='land')continue;
      const cost={...goal.endpointFacts.cost,energy:(goal.endpointFacts.cost.energy||0)+goal.route.cost};
      const floor=goal.endpointFacts.rewards.reduce((n,x)=>n+(x.type==='gain_resources'?(x.options?.gain?.score||0):0),0);
      const net=k=>{const payment=probeCapital.funding({...wallet,[k]:wallet[k]+2},cost,stateValue.DEFAULT_WEIGHTS);
        return payment?Math.max(0,floor-payment.value):0;};
      const c=net('credits'),e=net('energy');
      if(c>e)score.credits++;
      if(e>c)score.energy++;
    }
    if(Boolean(score.credits)===Boolean(score.energy))return rows[0];
    return tied.find((row,i)=>types[i]===(score.energy?'energy':'credits'));
  }
  function cardOpportunityCost(state,seatId,card){return incomeOpportunityCost(state,owner(state,seatId),card);}
  function scoredBlueCornerWindow(state,p,goal){
    return goal.kind==='blue-data'&&goal.targetComputerSlot<=3&&state.turn.roundNumber===4&&p.mainActionCompleted
      &&!p.passCompletionPending&&industry.getPlayerIndustryDefinition(p)?.activeAbilityId==='deepspace_swap_cards'
      &&Array.isArray(state.pieces?.rockets)&&!state.pieces.rockets.some(r=>[r.playerId,r.playerColor,r.color].some(id=>id===p.id||id===p.color))
      &&!observes(state,p.id,'cardCorner');
  }
  function ordinaryDataCornerCards({state,seatId,goal,selectionOnly=false}){
    const p=owner(state,seatId);
    const eligible=p.hand.filter(c=>!protectedCard(c,goal)&&cornerData(c)===1&&!Object.keys(cards.getDiscardActionRewardForCard(c).gain||{}).length);
    if(!eligible.length)return[];
    if(selectionOnly&&eligible.length===1)return[{card:eligible[0],loss:null}];
    const beforeCapital=incomePreparationCapital(state,p);
    return eligible.map(card=>({card,loss:incomeOpportunityCost(state,p,card,beforeCapital)}))
      .sort((a,b)=>a.loss-b.loss||(a.card.id<b.card.id?-1:a.card.id>b.card.id?1:0));
  }
  function dataCornerCards({state,seatId,goal,selectionOnly=false}){
    if(state.turn.roundNumber!==4)return ordinaryDataCornerCards({state,seatId,goal,selectionOnly});
    const p=owner(state,seatId);
    if(!scoredBlueCornerWindow(state,p,goal))return ordinaryDataCornerCards({state,seatId,goal,selectionOnly});
    const eligible=p.hand.flatMap(card=>{
      if(protectedCard(card,goal)||card.hidden)return[];
      const reward=cards.getDiscardActionRewardForCard(card);if(reward?.dataCount!==1)return[];
      const keys=Object.keys(reward.gain||{});
      return !keys.length||keys.length===1&&keys[0]==='score'&&Number.isSafeInteger(reward.gain.score)&&reward.gain.score>0
        ?[{card,score:reward.gain?.score||0}]:[];
    });
    if(!eligible.length)return[];
    if(selectionOnly&&eligible.length===1)return[{card:eligible[0].card,...(eligible[0].score?{score:eligible[0].score}:{}),loss:null}];
    const beforeCapital=incomePreparationCapital(state,p);
    return eligible.map(({card,score})=>({card,...(score?{score}:{}),loss:incomeOpportunityCost(state,p,card,beforeCapital)-score}))
      .sort((a,b)=>a.loss-b.loss||(a.card.id<b.card.id?-1:a.card.id>b.card.id?1:0));
  }
  function catalog({state,seatId,requirements,actions=[]}){
    const p=owner(state,seatId),goals=[],requested=[],add=g=>{
      requested.push(g);
      if(g.required?.publicity>p.resources.publicity){
        const multiplier=industry.shouldDoubleDiscardCornerRewards?.(p)?2:1;
        const directPub=p.hand.reduce((n,c)=>n+(c.id===g.cardId?0:(cards.getDiscardActionRewardForCard(c)?.gain?.publicity||0)*multiplier),p.resources.publicity);
        if(g.required.publicity>directPub&&g.required.publicity<=directPub+1&&placed(p)<2)g={...g,publicityData:true,targetComputerSlot:2};
      }
      const ordinary=capacity(state,seatId,g);
      const funded=ordinary?pickupIncomePayment(state,seatId,g,requirements,actions):incomeFunding(state,seatId,g);
      if(funded&&capacity(state,seatId,funded))goals.push(funded);
      else if(ordinary)goals.push(g);
    };
    if(!p||state.match.initialSetup||p.passCompletionPending)return goals;
    const analysisFunding=analysisPublicityFunding({state,seatId,actions});
    if(analysisFunding)goals.push(analysisFunding);
    if(!p.mainActionCompleted){
      for(const card of p.hand){
        const cost=effects.getCardPlayCost(card);
        if(Object.entries(cost).some(([k,v])=>p.resources[k]<v))add({id:`play:${card.id}`,kind:'play_card',cardId:card.id,required:cost});
        const paid=paidBudget({state,seatId,card,actions});
        if(paid)add({id:`play:${card.id}:paid-reward:${paid.amount}`,kind:'play_card',cardId:card.id,
          required:{...cost,credits:(cost.credits||0)+paid.amount},paidRewardBudget:paid.amount,paidRewardPolicy:paid});
      }
      if(Object.entries(requirements.scanCost).some(([k,v])=>p.resources[k]<v))add({id:'scan:standard',kind:'scan',required:requirements.scanCost});
      if(requirements.launchPossible&&Object.entries(requirements.launchCost).some(([k,v])=>p.resources[k]<v))add({id:'launch:earth',kind:'launch',required:requirements.launchCost});
      const researchContinuation=p.resources.publicity<techResolver.getResearchPublicityCost(p)&&stateValue.hasKnownSymbolTool(p.hand)
        ?planningCapitalDetails(state,p).researchSymbolPlan:null;
      for(const t of greedyTechPlans({state,seatId,plans:requirements.techPlans})){
        const continuation=researchContinuation?.candidates.find(c=>c.tileId===t.tileId);
        add({id:t.planId,kind:'research_tech',tileId:t.tileId,blueSlot:t.blueSlot,required:t.required,
          ...(continuation?{continuationCardId:continuation.beneficiaryCardId,publicityCornerCardId:continuation.cornerCardId}:{})});
      }
      for(const c of requirements.probeCandidates.filter(c=>!c.launchRequired&&c.rocketId!=null)){
        const probe=state.pieces.rockets.find(r=>r.id===c.rocketId);if(!probe)continue;
        let at=rockets.getRocketSectorCoordinate(probe),path=[],points=0;
        for(const step of c.path){const move=rockets.canMoveFromCoordinate(state.pieces,at,step.deltaX,step.deltaY,c.rocketId);if(!move.ok)throw new Error('RESOURCE_ROUTE_INVALID');
          const cost=rocketAbility.getRequiredMovePointsFromCoordinate({...state,state},p,at);path.push({from:at,to:move.to,deltaX:step.deltaX,deltaY:step.deltaY,requiredMovePoints:cost});points+=cost;at=move.to;}
        add({id:c.requirementId,kind:'route',family:c.endpointFamily,rocketId:c.rocketId,planetId:c.planetId,endpointTarget:c.endpointTarget,
          endpointCost:c.endpointFacts.cost,benefit:c.targetBenefit,coordinate:at,path,movementPoints:points,required:{credits:c.endpointFacts.cost.credits||0}});
      }
      if(placed(p)<6||Object.entries(requirements.analyzeCost).some(([k,v])=>p.resources[k]<v))
        add({id:'data:analyze:6',kind:'analyze',targetComputerSlot:6,required:requirements.analyzeCost});
    }
    // Income and free/card-sourced research enter as purpose plans too. The native
    // effect queue still determines costs and every distinct research tile choice.
    if(!p.mainActionCompleted)for(const card of p.hand){
      const types=effects.buildPlayEffects(card).map(e=>e.type);
      const purpose=types.includes('card_research_tech')?'tech':types.some(t=>['card_income','card_tuck_played_card_to_income','card_discard_any_for_income'].includes(t))?'income':null;
      if(purpose)add({id:`effect:${purpose}:card:${card.id}`,kind:'effect-purpose',purpose,cardId:card.id,sourceFamily:'play_card',required:effects.getCardPlayCost(card)});
    }
    for(const action of actions){
      if(action.family==='industry'&&action.target?.abilityId==='mission_publicity_pick_income'){
        add({id:`effect:income:industry:${action.target.abilityId}`,kind:'effect-purpose',purpose:'income',abilityId:action.target.abilityId,sourceFamily:'industry',required:{}});
      }
    }
    // A cold pending placement has already begun. Finishing its income must
    // release the main-action choice, not silently bind it to later analysis.
    const committedData=actions.length===1&&actions[0].family==='place_data';
    const incomeDeficits=!p.mainActionCompleted&&!committedData&&placed(p)<4?requested.map(g=>needs(state,seatId,g)):[];
    const helpsIncome=gain=>Object.entries(gain||{}).some(([key,n])=>n>0&&incomeDeficits.some(d=>d[key==='availableData'?'data':key]>0));
    const incomeNeeded=p.mainActionCompleted||committedData||p.hand.some(card=>helpsIncome(cards.getIncomeGainForCard(card)));
    if(incomeNeeded&&placed(p)<4&&p.hand.some(c=>cards.getIncomeGainForCard(c))){
      // Reject unneeded currency suppliers before ranking, so a tied credit
      // card cannot hide a needed energy source (or the reverse).
      // Quote each supplier once, using the same post-income wallet as the
      // native choice. Sorting must not repeatedly simulate an unchanged source.
      const suppliers=p.hand.filter(c=>{const gain=cards.getIncomeGainForCard(c);return gain&&(p.mainActionCompleted||committedData||!Object.keys(gain).every(k=>['credits','energy'].includes(k))||helpsIncome(gain));})
        .filter(card=>capacity(state,seatId,{kind:'income',targetComputerSlot:4,incomeCardId:card.id,required:{}}));
      let beforeCapital;
      const incomeCard=suppliers.length<2?suppliers[0]:rankIncomeChoices(state,p,suppliers.map(card=>({card,value:computerIncomeValue(state,seatId,card)
        ??incomeValueWithCapital(state,p,card,beforeCapital??=incomePreparationCapital(state,p))})))?.card;
      if(incomeCard){
        const gain=cards.getIncomeGainForCard(incomeCard),currencyOnly=Object.keys(gain).every(k=>['credits','energy'].includes(k));
        // Currency income with no current purpose deficit belongs after the
        // main action. Its fixed data flow must not open another ordering tree.
        // Keep actual funding needs and information-bearing income unchanged.
        const needed=helpsIncome(gain);
        if(p.mainActionCompleted||committedData||!currencyOnly||needed)
          add({id:'data:income:4',kind:'income',targetComputerSlot:4,incomeCardId:incomeCard.id,incomeBefore:Object.values(p.income).reduce((a,b)=>a+b,0),required:{}});
      }
    }
    const blue=[...requirements.bluePlacements].sort((a,b)=>blueValue(p,b.blueSlot)-blueValue(p,a.blueSlot)||a.blueSlot-b.blueSlot)[0];
    if(blue){
      const reward=data.getBlueBonusPlacementReward(p,blue.blueSlot);
      const needed=requested.some(g=>Object.entries(reward||{}).some(([key,n])=>n>0&&needs(state,seatId,g)[key]>0));
      // Pure blue resource payoffs are fixed tails, not independent pre-main
      // ordering branches. Keep a pre-main source only for an actual requested
      // purpose deficit; card picks retain their separate known-card purpose.
      if(p.mainActionCompleted||needed&&!requested.some(g=>blueFunding(state,seatId,g)?.blueSlot===blue.blueSlot)||reward?.type==='choose_card')
        add({id:`data:blue:${blue.blueSlot}`,kind:'blue-data',blueSlot:blue.blueSlot,targetComputerSlot:blue.requiredComputerSlot,required:{}});
    }
    // A funded partial column can pay off before computer4 or a blue reward
    // is reachable. The caller ranks these typed prefixes once and keeps one;
    // their native slot selections remain fixed and never acquire more data.
    if(p.mainActionCompleted&&p.resources.availableData>0){
      const from=placed(p),through=Math.min(from<4?3:6,from+p.resources.availableData);
      for(let target=from+1;target<=through;target++){
        const column=data.getBlueBoardSlotForComputerSlot(target);
        if(data.getComputerSlotBonus(target)?.type==='publicity'||column!=null&&data.hasBlueTechInBoardSlot(p,column))
          add({id:`data:computer-prefix:${target}`,kind:'computer-prefix',targetComputerSlot:target,required:{}});
      }
    }
    // Future travel has one fixed destination. At-location orbit/landing are
    // distinct main purposes and must survive even when another endpoint wins that estimate.
    const routes=goals.filter(g=>g.kind==='route').map(g=>({goal:g,net:g.benefit.score+g.benefit.dataCount*.5+g.benefit.incomeCount*(4-state.turn.roundNumber)
      -(g.endpointCost.credits||0)-(g.endpointCost.energy||0)-g.movementPoints})).filter(x=>x.net>0)
      .sort((a,b)=>b.net-a.net||a.goal.movementPoints-b.goal.movementPoints||a.goal.path.length-b.goal.path.length||(a.goal.id<b.goal.id?-1:1));
    const chosen=routes[0]?.goal;
    return goals.filter(g=>(g.kind!=='route'||g.movementPoints===0||g===chosen)&&!(g.kind==='play_card'&&!g.paidRewardPolicy&&goals.some(p=>p.kind==='effect-purpose'&&p.cardId===g.cardId))).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  }
  const localWeights={score:1,credits:1,energy:1,publicity:.5,availableData:.5,additionalPublicScan:.5};
  const resourceValue=p=>Object.entries(localWeights).reduce((n,[k,w])=>n+(p.resources[k]||0)*w,0)+p.hand.length;
  function analysisPublicityFunding({state,seatId,actions}){
    // The analysis portfolio is closed in the final round.
    if(state.turn.roundNumber===4)return null;
    const p=owner(state,seatId);
    if(!p.mainActionCompleted||p.resources.availableData<6-placed(p)||observes(state,seatId,'cardCorner'))return null;
    const sources=actions.filter(a=>{
      if(a.family!=='card_corner'||a.payload?.kind!=='resource')return false;
      const card=p.hand.find(c=>c.id===a.target.cardInstanceId);if(!card||card.hidden)return false;
      const reward=cards.getDiscardActionRewardForCard(card);
      return reward?.gain?.publicity>0&&Object.keys(reward.gain).every(k=>k==='publicity')&&!reward.dataCount;
    });
    if(!sources.length)return null;
    const base=planningCapitalDetails(state,p),analysis=base.analysisPlan,endpoint=analysis?.selected?.endpoint?.resources;
    if(!(analysis?.value>0)||!Number.isSafeInteger(endpoint?.publicity))return null;
    const missing=techResolver.getResearchPublicityCost(p)-endpoint.publicity;
    if(missing<=0)return null;
    const target=p.resources.publicity+missing;
    if(target>players.RESOURCE_LIMITS.publicity)return null;
    const goal={id:'analysis:publicity:'+target,kind:'analysis-publicity',required:{publicity:target},
      ...(analysis.selected.incomeCardId?{incomeCardId:analysis.selected.incomeCardId}:{})};
    let current=state;const ids=[];
    // One greedy known source sequence, never subsets. Future analysis gains
    // determine the deficit; they cannot pay for these current preparations.
    while(owner(current,seatId).resources.publicity<target){
      const legal=sources.filter(a=>owner(current,seatId).hand.some(c=>c.id===a.target.cardInstanceId));
      const source=preparations({state:current,seatId,goal,actions:legal,selectionOnly:true}).find(c=>!c.observer);
      if(!source)return null;
      const action=legal.find(a=>a.actionId===source.actionId),next=project(current,seatId,action,source.discardIds);
      if(!next||owner(next,seatId).resources.publicity<=owner(current,seatId).resources.publicity)return null;
      ids.push(action.target.cardInstanceId);current=next;
    }
    const after=owner(current,seatId),netGain=stateValue.sumValueParts([resourceValue(after)-resourceValue(p),planningCapital(current,after),-base.total]);
    return netGain>0?{...goal,publicityCornerCardIds:ids,fundingNetGain:netGain}:null;
  }
  function positiveResourceGain(effect){
    const gain=effect?.options?.gain;
    return effect?.type==='gain_resources'&&gain&&Object.keys(gain).length&&Object.entries(gain).every(([k,v])=>k in localWeights&&Number.isFinite(v)&&v>=0)?gain:null;
  }
  // These pure currency previews write only the wallet, hand container and
  // blue-wallet attribution. Card models and technologies remain read-only.
  function resourcePreview(p){return{...p,resources:{...p.resources},hand:[...p.hand]};}
  function paidChoice({state,seatId,actions,session}){
    if(!actions.length||!actions.every(a=>a.family==='choose_reward'&&(a.target?.pay||a.target?.skip)))return null;
    const effect=session?.queue?.[0]?.payload?.cardEffect;
    if(effect?.type!=='card_pay_credits_for_reward')return null;
    const gain=positiveResourceGain(effect.options?.reward);if(!gain||gain.credits||gain.energy)return null;
    const p=owner(state,seatId),copy=resourcePreview(p),before=resourceValue(copy);
    const paid=players.spendResources(copy,{credits:1});if(paid.ok)players.gainResources(copy,gain);
    const net=paid.ok?resourceValue(copy)-before:0;
    const a=actions.find(a=>net>0?a.target?.pay:a.target?.skip);
    return a?{kind:'fixed',actionId:a.actionId,reason:'fixed-positive-paid-repeat',netGain:net}:null;
  }
  function paidBudget({state,seatId,card,actions}){
    const list=effects.buildPlayEffects(card),effect=list.length===1&&list[0];
    if(effect?.type!=='card_pay_credits_for_reward')return null;
    const gain=positiveResourceGain(effect.options?.reward),cost=effects.getCardPlayCost(card);
    if(!gain||gain.credits||gain.energy||!players.canAfford(owner(state,seatId),cost))return null;
    let current={...state,players:{...state.players,players:state.players.players.map(p=>p.id===seatId?resourcePreview(p):p)}};
    if(!players.spendResources(owner(current,seatId),cost).ok)return null;
    let amount=0,net=0;
    while(true){
      const before=resourceValue(owner(current,seatId));let next=current;
      if(owner(next,seatId).resources.credits<1){
        const goal={kind:'play_card',cardId:card.id,required:{credits:1}};
        const choice=preparations({state:next,seatId,goal,actions,selectionOnly:true}).find(c=>!c.observer);
        if(!choice)break;
        next=project(next,seatId,actions.find(a=>a.actionId===choice.actionId),choice.discardIds);
        if(!next||owner(next,seatId).resources.credits<1)break;
      }
      const p=resourcePreview(owner(next,seatId));if(!players.spendResources(p,{credits:1}).ok)break;
      players.gainResources(p,gain);const delta=resourceValue(p)-before;if(!(delta>0))break;
      current={...next,players:{...next.players,players:next.players.players.map(v=>v.id===seatId?p:v)}};amount++;net+=delta;
    }
    return{policy:'seti-greedy-paid-budget-v1',amount,netGain:net,assumption:'positive known resource reward; greedy funding; beneficiary card preserved'};
  }
  function paymentCards(state,seatId,goal,count){
    const p=owner(state,seatId),spare=p.hand.filter(c=>!protectedCard(c,goal));
    const utility=c=>(cornerData(c)>0?1:0)+(goal.kind==='route'?movePoints(c)*2:0)+(effects.getCardPrice(c)||0);
    spare.sort((a,b)=>utility(a)-utility(b)||(a.id<b.id?-1:a.id>b.id?1:0));
    return spare.length>=count?spare.slice(0,count).map(c=>c.id):null;
  }
  function observes(state,seatId,type){
    const p=owner(state,seatId);
    return p.reservedCards.some(c=>(effects.getCardModel(c)?.triggers||[]).some(t=>(t.event.types||[t.event.type]).includes(type)))
      ||(state.turn.cardTurnEventBonuses||[]).some(b=>(b.eventType||b.event?.type)===type);
  }
  function project(state,seatId,action,discardIds,carryDataSequence=false){
    const source=owner(state,seatId),p={...resourcePreview(source),dataState:{...source.dataState,
      poolTokens:[...source.dataState.poolTokens],placedTokens:[...source.dataState.placedTokens]}};
    let meta=state.meta;
    if(discardIds?.length)p.hand=p.hand.filter(c=>!discardIds.includes(c.id));
    if(action.family==='quick_trade'){
      const cost={...action.payload.cost};delete cost.handSize;if(!players.spendResources(p,cost).ok)return null;
      const gain={...action.payload.gain};delete gain.handSize;players.gainResources(p,gain);
    }else{
      p.hand=p.hand.filter(c=>c.id!==action.target.cardInstanceId);const card=owner(state,seatId).hand.find(c=>c.id===action.target.cardInstanceId);
      const reward=cards.getDiscardActionRewardForCard(card);if(!reward)return null;const multiplier=action.payload.multiplier||1;
      players.gainResources(p,Object.fromEntries(Object.entries(reward.gain).map(([k,v])=>[k,v*multiplier])));
      const previewRoot={meta:structuredClone(state.meta)};
      for(let i=0;i<reward.dataCount*multiplier;i++)data.gainData(p,{root:previewRoot});
      if(carryDataSequence)meta=previewRoot.meta;
    }
    p.resources.handSize=p.hand.length;
    return{...state,meta,players:{...state.players,players:state.players.players.map(v=>v.id===seatId?p:v)}};
  }
  // Price the actual data deficit with existing greedy suppliers. No
  // alternate discard or income-card combinations are evaluated.
  function dataIncomeFunding({state,seatId,goal,actions,maxCorners=1}){
    const p=owner(state,seatId),need=needs(state,seatId,goal),card=p.hand.find(c=>c.id===goal.incomeCardId),gain=card&&cards.getIncomeGainForCard(card);
    if(goal.kind!=='income'||need.data<1||need.data>maxCorners||need.credits||need.energy||need.publicity
      ||!gain||Object.keys(gain).length!==1||!(gain.credits===1||gain.energy===1))return null;
    let next=state,q=p;const corners=[];
    for(let i=0;i<need.data;i++){
      const menu=i===0?actions:actions.filter(a=>a.family==='card_corner'&&q.hand.some(c=>c.id===a.target.cardInstanceId));
      const selected=preparations({state:next,seatId,goal,actions:menu}).find(c=>!c.observer);
      const action=menu.find(a=>a.actionId===selected?.actionId),source=q.hand.find(c=>c.id===action?.target?.cardInstanceId);
      const reward=source&&cards.getDiscardActionRewardForCard(source);
      if(action?.family!=='card_corner'||selected.discardIds?.length!==1||!source||source.hidden
        ||(action.payload.multiplier??1)!==1||reward?.dataCount!==1
        ||Object.keys(reward.gain).some(k=>k!=='score')||reward.gain.score&&source.set!=='alien:阿米巴')return null;
      const funded=project(next,seatId,action,selected.discardIds,true),after=funded&&owner(funded,seatId);
      if(!after||after.resources.availableData!==q.resources.availableData+1||needs(funded,seatId,goal).data!==need.data-i-1)return null;
      corners.push({cardId:source.id,actionId:action.actionId});
      next=funded;q=after;
    }
    return {state:next,...corners[0],corners,resourceDelta:resourceValue(q)-resourceValue(p)};
  }
  // Compare the complete known payment, not the cheapest first discarded
  // card. If the smaller source cannot replace the mandatory one, the only
  // distinction is whether buying its surplus publicity is worth the card.
  function exactPublicityResearchPayment(state,seatId,goal,actions,out,need){
    const p=owner(state,seatId),t=state.turn;
    if(t.roundNumber!==3||t.currentPlayerId!==seatId||p.mainActionCompleted||p.passCompletionPending
      ||goal.kind!=='research_tech'||!/^orange[1-4]$/.test(goal.tileId)||goal.publicityCornerCardId
      ||need.publicity<=0||need.credits||need.energy||need.data||out.length!==2||out.some(c=>c.observer||c.greedyFailed)
      ||p.resources.availableData!==0||placed(p)!==4||p.hand.some(c=>c.hidden||!c.id||!c.cardId||cornerData(c)>0)
      ||industry.getPlayerIndustryDefinition(p)?.activeAbilityId!=='deepspace_swap_cards'
      ||state.pieces.rockets.some(r=>r.playerId===seatId||r.color===p.color)
      ||!t.activePlayerIds?.includes(seatId)||t.activePlayerIds.some(id=>id!==seatId&&!t.passedPlayerIds.includes(id))
      ||t.cardTurnEventBonuses?.length||observes(state,seatId,'researchTech')
      ||Object.values(state.aliens.aliens).some(s=>s.revealed&&s.alienId!=='阿米巴')
      ||actions.some(a=>a.family==='complete_task')
      ||state.finalScoring.thresholds.some(n=>!Object.values(state.finalScoring.tiles).some(tile=>tile.marks.some(m=>m.playerId===seatId&&m.threshold===n))))return null;
    const stack=state.tech.stacks[goal.tileId],bonus=techCatalog.BONUS_EFFECTS[stack?.bonusId];
    if(!stack||stack.bonusHidden||!bonus||Object.keys(bonus).some(k=>!['credits','energy','publicity','score'].includes(k)))return null;
    const items=out.map(candidate=>{
      const action=actions.find(a=>a.actionId===candidate.actionId),card=p.hand.find(c=>c.id===action?.target?.cardInstanceId);
      return {candidate,action,card,gain:action?.family==='card_corner'&&purePublicityCorner(card)};
    });
    if(items.some(x=>!x.gain||(x.action.payload.multiplier??1)!==1))return null;
    const mandatory=items.find(x=>x.gain===need.publicity),extra=items.find(x=>x.gain<need.publicity);
    if(!mandatory||!extra||p.resources.publicity+mandatory.gain+extra.gain>players.RESOURCE_LIMITS.publicity)return null;
    const scope={...state,tech:{...state.tech,stacks:{...state.tech.stacks,[goal.tileId]:{...stack,
      bonusQueue:[],bonusIndex:stack.bonusIndex+1,bonusId:null,bonusHidden:true,remaining:stack.remaining-1,
      depleted:stack.remaining===1,firstTakeClaimedBy:stack.firstTakeClaimedBy??seatId}}}};
    const value=surplus=>{
      const copy=resourcePreview(p);
      copy.hand=copy.hand.filter(c=>c!==mandatory.card&&(!surplus||c!==extra.card));
      copy.resources.handSize=copy.hand.length;
      players.gainResources(copy,{publicity:mandatory.gain+(surplus?extra.gain:0)});
      if(!players.spendResources(copy,{publicity:goal.required.publicity}).ok)return null;
      copy.techState={...copy.techState,ownedTiles:{...copy.techState.ownedTiles,[goal.tileId]:true}};
      players.gainResources(copy,bonus);
      if(stack.firstTakeClaimedBy==null)players.gainResources(copy,{score:techCatalog.FIRST_TAKE_TYPE_SCORE});
      const next={...scope,players:{...scope.players,players:scope.players.players.map(v=>v===p?copy:v)}};
      const linear=Object.entries(stateValue.DEFAULT_WEIGHTS).reduce((n,[k,w])=>n+copy.resources[k]*w,0);
      return stateValue.sumValueParts([linear,planningCapital(next,copy)]);
    };
    const retained=value(false),both=value(true);
    return Number.isFinite(retained)&&Number.isFinite(both)&&retained>=both?{
      actionId:mandatory.action.actionId,savedCardId:extra.card.id,gain:stateValue.sumValueParts([retained,-both])}:null;
  }
  function exactBlueCashPublicityPayment(state,seatId,goal,actions,out,need){
    const p=owner(state,seatId),t=state.turn;
    if(t.roundNumber!==3||t.currentPlayerId!==seatId||p.mainActionCompleted||p.passCompletionPending
      ||goal.kind!=='research_tech'||goal.tileId!=='blue1'||!goal.blueSlot||goal.publicityCornerCardId
      ||!need.publicity||need.credits||need.energy||need.data||p.resources.credits||p.resources.energy
      ||p.resources.availableData!==1||placed(p)!==6||p.hand.length!==4||out.length!==3
      ||t.cardTurnEventBonuses?.length||!t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id))
      ||p.industryRoundMarkRound===t.roundNumber||industry.getPlayerIndustryDefinition(p)?.activeAbilityId!=='deepspace_swap_cards'
      ||!state.pieces.rockets.some(r=>r.playerId===seatId&&r.surface==='solar-board'&&!r.fossilId)
      ||p.hand.some(c=>c.hidden||!c.id||!c.cardId)||out.some(c=>c.observer||c.greedyFailed))return null;
    const offers=out.map(candidate=>{
      const action=actions.find(a=>a.actionId===candidate.actionId),card=p.hand.find(c=>c.id===action?.target?.cardInstanceId);
      const amount=action?.family==='card_corner'&&(action.payload.multiplier??1)===1&&purePublicityCorner(card);
      return {action,card,amount};
    });
    const exact=offers.filter(x=>x.amount===need.publicity),partial=offers.filter(x=>x.amount>0&&x.amount<need.publicity);
    if(exact.length!==1||partial.length!==2||partial[0].amount+partial[1].amount!==need.publicity)return null;
    const income=(c,k)=>{const gain=cards.getIncomeGainForCard(c);return gain?.[k]===1&&Object.keys(gain).length===1;};
    if(!partial.some(x=>income(x.card,'energy'))||!partial.some(x=>income(x.card,'credits')))return null;
    const future=p.hand.find(c=>!offers.some(o=>o.card===c)),cost=effects.getCardPlayCost(future),play=effects.buildPlayEffects(future);
    if(cost.credits!==1||Object.keys(cost).length!==1||play.length!==2
      ||play[0].type!=='pick_card'||play[0].options?.count!==1||play[1].type!=='amiba_choose_symbol_reward')return null;
    return {actionId:exact[0].action.actionId,savedCardIds:partial.map(x=>x.card.id),proof:'one-exact-corner-preserves-known-income-and-exchange'};
  }
  function preparations({state,seatId,goal,actions,selectionOnly=false}){
    const before=needs(state,seatId,goal),out=[];
    const actor=owner(state,seatId);
    for(const action of actions.filter(isPreparation)){
      if(action.family==='place_data'||action.family==='card_corner'&&(action.payload.kind!=='resource'||protectedCard({id:action.target.cardInstanceId},goal)))continue;
      // The preparation must strictly shrink a current deficit. Discarding
      // cards cannot add movement points and these pure previews do not
      // move a probe, fire an observer, or advance a computer/blue slot.
      if(action.family==='card_corner'){
        const card=actor.hand.find(c=>c.id===action.target.cardInstanceId),reward=card&&cards.getDiscardActionRewardForCard(card);
        const multiplier=action.payload.multiplier||1;
        if(reward&&multiplier>0&&!((before.credits&&reward.gain.credits>0)
          ||(before.energy&&reward.gain.energy>0)||(before.publicity&&reward.gain.publicity>0)
          ||(before.data&&(reward.dataCount>0||reward.gain.availableData>0))))continue;
      }else{
        const {cost,gain}=action.payload;
        if(cost&&gain&&Object.values(cost).every(v=>v>=0)
          &&!((before.credits&&gain.credits>0)||(before.energy&&gain.energy>0)
            ||(before.publicity&&gain.publicity>0)||(before.data&&gain.availableData>0)))continue;
      }
      const discarded=action.family==='quick_trade'?paymentCards(state,seatId,goal,action.payload.cost.handSize||0):[action.target.cardInstanceId];
      if(!discarded)continue;const after=project(state,seatId,action,discarded);if(!after)continue;const d=needs(after,seatId,goal);
      if(Object.keys(before).some(k=>d[k]>before[k])||deficit(d)>=deficit(before))continue;
      const greedyFailed=!capacity(after,seatId,goal);if(greedyFailed&&!(action.payload.cost?.handSize>0))continue;
      out.push({actionId:action.actionId,discardIds:greedyFailed?null:discarded,reduction:deficit(before)-deficit(d),loss:null,inputs:action.family==='quick_trade'&&discarded.length?discarded.length+2:1,
        greedyFailed,observer:greedyFailed|| (action.family==='card_corner'?observes(state,seatId,'cardCorner'):observes(state,seatId,'quick_trade_payment')||observes(state,seatId,'quick_trade_discard_selection'))});
    }
    if(selectionOnly&&out.length===1)return out;
    if(state.turn.roundNumber===4&&scoredBlueCornerWindow(state,owner(state,seatId),goal)){
      const p=owner(state,seatId);
      for(const candidate of out){
        const action=actions.find(a=>a.actionId===candidate.actionId);
        if(action.family==='quick_trade')candidate.loss=Object.entries(action.payload.cost).reduce((n,[k,v])=>n+v*(weight[k]||0),0)-Object.entries(action.payload.gain).reduce((n,[k,v])=>n+v*(weight[k]||0),0);
        else{
          const card=p.hand.find(c=>c.id===action.target.cardInstanceId),reward=cards.getDiscardActionRewardForCard(card);
          const score=reward?.dataCount===1&&Object.keys(reward.gain||{}).every(k=>k==='score')&&Number.isSafeInteger(reward.gain?.score)&&reward.gain.score>0
            &&(action.payload.multiplier??1)===1?reward.gain.score:0;
          candidate.loss=2+2*(incomeOpportunityCost(state,p,card)-score);
        }
      }
    }else{
      for(const candidate of out){
        const action=actions.find(a=>a.actionId===candidate.actionId);
        candidate.loss=action.family==='quick_trade'?Object.entries(action.payload.cost).reduce((n,[k,v])=>n+v*(weight[k]||0),0)-Object.entries(action.payload.gain).reduce((n,[k,v])=>n+v*(weight[k]||0),0):2+2*incomeOpportunityCost(state,owner(state,seatId),owner(state,seatId).hand.find(c=>c.id===action.target.cardInstanceId));
      }
    }
    let dataOrder=null;
    const rank=c=>{
      const action=actions.find(a=>a.actionId===c.actionId);if(action?.family!=='card_corner')return null;
      if(!dataOrder)dataOrder=new Map(dataCornerCards({state,seatId,goal,selectionOnly:true}).map((x,i)=>[x.card.id,i]));
      return dataOrder.get(action.target?.cardInstanceId);
    };
    // A quoted research continuation consumes its known publicity supplier,
    // preserving the symbol card whose later value funded that same plan.
    const payment=exactBlueCashPublicityPayment(state,seatId,goal,actions,out,before)
      ||exactPublicityResearchPayment(state,seatId,goal,actions,out,before);
    const preferred=c=>payment?.actionId===c.actionId?1:before.publicity>0&&goal.publicityCornerCardId
      &&actions.find(a=>a.actionId===c.actionId)?.target?.cardInstanceId===goal.publicityCornerCardId?1:0;
    out.sort((a,b)=>preferred(b)-preferred(a)||a.loss*b.reduction-b.loss*a.reduction||a.inputs-b.inputs
      ||(rank(a)!=null&&rank(b)!=null?rank(a)-rank(b):0)||(a.actionId<b.actionId?-1:a.actionId>b.actionId?1:0));
    if(payment)out.find(c=>c.actionId===payment.actionId).exactPublicityPayment=payment;
    return out;
  }
  function fixedPayment({state,seatId,goal,actions,session,discardIds}){
    const pending=session?.queue?.[0]?.payload?.decisionContext;
    if(pending?.kind!=='discard')return null;
    const base=session.baseState||state,source=session?.journal?.actions?.[0]?.action;
    const selected=pending.selected||[],ids=discardIds||paymentCards(base,seatId,goal,pending.count);
    const feasible=set=>!set.some(id=>protectedCard({id},goal))&&(!source||capacity(project(base,seatId,source,set),seatId,goal));
    const alternatives=actions.filter(a=>a.target?.confirm?selected.length===pending.count&&feasible(selected):!protectedCard({id:a.target?.cardInstanceId},goal)||selected.includes(a.target.cardInstanceId)).map(a=>a.actionId);
    if(observes(state,seatId,'quick_trade_payment')||observes(state,seatId,'quick_trade_discard_selection'))
      return{kind:'fallback',reason:'identity-sensitive-payment',actionIds:alternatives};
    if(!ids)return{kind:'infeasible',reason:'protected-card-payment'};
    if(!feasible(ids)){
      const confirm=actions.find(a=>a.target?.confirm&&selected.length===pending.count&&feasible(selected));
      return confirm?{kind:'fixed',actionId:confirm.actionId,reason:'feasible-fallback-payment'}:{kind:'fallback',reason:'greedy-payment-cannot-preserve-goal',actionIds:alternatives};
    }
    const remove=selected.find(id=>!ids.includes(id)),add=ids.find(id=>!selected.includes(id));
    const a=actions.find(a=>remove||add?a.target?.cardInstanceId===(remove||add):a.target?.confirm);
    if(!a)throw new Error('RESOURCE_PAYMENT_ACTION_MISSING');return{kind:'fixed',actionId:a.actionId,discardIds:ids,reason:'greedy-fixed-payment'};
  }
  function incomeChoice({state,seatId,goal,actions}){
    const p=owner(state,seatId),choices=actions.filter(a=>a.family==='choose_card'&&a.target?.choiceId?.startsWith('income:'));
    if(choices.length!==actions.length)return null;
    const eligible=choices.filter(a=>a.target.cardInstanceId!==goal.cardId&&(!goal.incomeCardId||a.target.cardInstanceId===goal.incomeCardId)).map(a=>{
      const card=p.hand.find(c=>c.id===a.target.cardInstanceId),gain=cards.getIncomeGainForCard(card);
      if(!card||card.hidden)throw new Error('RESOURCE_INCOME_CARD_NOT_KNOWN');
      const next={...state,players:{...state.players,players:state.players.players.map(v=>v.id===seatId?{...p,resources:{...p.resources},hand:p.hand.filter(c=>c!==card)}:v)}};
      if(goal.incomeFunding&&card.id===goal.incomeCardId)players.gainResources(owner(next,seatId),gain);
      return{action:a,card,feasible:capacity(next,seatId,goal)};
    }).filter(x=>x.feasible);
    if(eligible.length<2)return eligible[0]?{kind:'fixed',actionId:eligible[0].action.actionId,reason:'greedy-income-for-goal'}:{kind:'infeasible',reason:'income-would-consume-goal-card'};
    const beforeCapital=incomePreparationCapital(state,p),scored=rankIncomeChoices(state,p,eligible.map(candidate=>({...candidate,value:incomeValueWithCapital(state,p,candidate.card,beforeCapital)})));
    return scored?{kind:'fixed',actionId:scored.action.actionId,reason:'greedy-income-for-goal'}:{kind:'infeasible',reason:'income-would-consume-goal-card'};
  }
  function greedyTechPlans({state,seatId,plans}){
    const p=owner(state,seatId),computer=new Set(data.listComputerPlacedTokens(p).map(t=>t.placementSlot)),byTile=new Map();
    const rank=plan=>{const required=data.getComputerSlotForBlueBoardSlot(plan.blueSlot);return{covered:computer.has(required),distance:Math.max(0,required-placed(p)),slot:plan.blueSlot};};
    for(const plan of plans){
      if(plan.blueSlot==null){byTile.set(plan.tileId,plan);continue;}
      const prior=byTile.get(plan.tileId),a=rank(plan),b=prior&&rank(prior);
      if(!prior||Number(a.covered)>Number(b.covered)||a.covered===b.covered&&(a.distance<b.distance||a.distance===b.distance&&a.slot<b.slot))byTile.set(plan.tileId,plan);
    }
    return [...byTile.values()];
  }
  const incomeTailPrefixes=new WeakMap();
  function incomeTailPrefix(original,remaining){
    const p={...original,resources:{...original.resources},dataState:structuredClone(original.dataState)};
    for(let i=0;i<remaining;i++){
      const result=data.placeDataToComputer(p);if(!result.ok)return null;
      for(const bonus of result.slotBonuses||[]){if(bonus.type==='publicity')players.gainResources(p,{publicity:bonus.publicity});else if(bonus.type==='score')players.gainResources(p,{score:bonus.score});}
    }
    return {remaining,resources:p.resources,dataState:p.dataState};
  }
  function previewIncomeTail(input){return computeIncomeTailPreview(input,false);}
  function computeIncomeTailPreview({state,seatId,goal},scalarOnly){
    const original=owner(state,seatId),card=original.hand.find(c=>c.id===goal.incomeCardId);
    if(!card)return{available:false,reason:'income-tail-needs-additional-funding'};
    const gain=cards.getIncomeGainForCard(card);
    // The computer placements and slot rewards depend only on this player,
    // before the supplier is consumed. Share the ledger only with read-only
    // quotes; callers that can add data or return the player get their own.
    const canShare=scalarOnly&&!gain?.availableData;
    let prefix=canShare?incomeTailPrefixes.get(original):undefined;
    const remaining=prefix?.remaining??Math.max(0,4-placed(original));
    if(original.resources.availableData<remaining)return{available:false,reason:'income-tail-needs-additional-funding'};
    if(prefix===undefined){
      prefix=incomeTailPrefix(original,remaining);
      if(prefix&&canShare&&Array.isArray(prefix.dataState?.poolTokens)&&Array.isArray(prefix.dataState.placedTokens)&&immutableCapitalInput(original)){
        for(const tokens of [prefix.dataState.poolTokens,prefix.dataState.placedTokens]){
          for(const token of tokens)Object.freeze(token);
          Object.freeze(tokens);
        }
        Object.freeze(prefix.dataState);
        incomeTailPrefixes.set(original,prefix);
      }
    }
    if(!prefix)return{available:false,reason:'income-tail-slot-unavailable'};
    const p={...original,resources:{...prefix.resources},dataState:prefix.dataState,income:{...original.income},hand:original.hand.filter(c=>c.id!==card.id)};
    let blindHandValue=0,previewRoot=null;
    players.gainIncome(p,gain,{blindDraw:()=>{blindHandValue++;},
      gainData:target=>data.gainData(target,{root:previewRoot||(previewRoot={meta:structuredClone(state.meta)})})});
    p.resources.handSize=p.hand.length+blindHandValue;
    const future=Object.entries(gain).reduce((n,[k,v])=>n+v*({credits:1,energy:1,publicity:.5,availableData:.5,additionalPublicScan:.5,handSize:1}[k]||0),0)*(4-state.turn.roundNumber);
    return{available:true,player:p,netGain:resourceValue(p)-resourceValue(original)+blindHandValue+future,
      immediateScoreGain:p.resources.score-original.resources.score,placements:remaining,assumption:'known income reward and remaining official income rounds; unknown drawn identities excluded'};
  }
  function blueValue(p,slot){
    const bonus=data.getBlueBonusPlacementReward({...p},slot);
    if(!bonus)return 0;
    return (bonus.score||0)+(bonus.credits||0)+(bonus.energy||0)+(bonus.publicity||0)*.5+(bonus.type==='choose_card'?1:0);
  }
  function fixedDataChoice({state,seatId,actions,goal={required:{}}}){
    if(!actions.length)return null;
    const income=incomeChoice({state,seatId,goal,actions});
    if(income)return income.kind==='fixed'?income:null;
    if(!actions.every(a=>a.family==='choose_target'&&['computer','blueBonus'].includes(a.target?.target)))return null;
    const p=owner(state,seatId),ranked=[...actions].sort((a,b)=>{
      const score=a=>a.target.target==='computer'?100:blueValue(p,a.target.blueSlot);
      return score(b)-score(a)||(a.actionId<b.actionId?-1:1);
    });
    const chosen=goal.kind==='blue-data'?ranked.find(a=>bluePrerequisites(p,goal.blueSlot)===0?a.target.blueSlot===goal.blueSlot:a.target.target==='computer'):ranked[0];
    return chosen?{kind:'fixed',actionId:chosen.actionId,reason:'greedy-data-placement'}:null;
  }
  // Quote the entire known mission from the same wallet. The Native
  // directory gives one path per target; the only timing assumption is
  // the existing one-rotation comparison, never a prediction of an opponent.
  function publicLandingSupplier(state){
    return probeCapital.heldLandingCard({hand:state.cards.publicCards.filter(Boolean),round:state.turn.roundNumber},stateValue.DEFAULT_WEIGHTS);
  }
  // A known landing supplier can use a ready blue reward without spending
  // the company exchange. This is a Native option, not a pruning proof.
  function blueLandingSupplyGoal({state,seatId,candidates,compareTiming}){
    const p=owner(state,seatId),turn=state.turn,weights=stateValue.DEFAULT_WEIGHTS;
    if(!p||turn.roundNumber!==3||!p.mainActionCompleted||p.passCompletionPending||turn.currentPlayerId!==seatId
      ||p.industryRoundMarkRound===turn.roundNumber||industry.getPlayerIndustryDefinition(p)?.activeAbilityId!=='deepspace_swap_cards'
      ||p.hand.some(c=>!c.id||!c.cardId||c.hidden)||p.dataState.poolTokens.length!==p.resources.availableData)return null;
    const computer=data.listComputerPlacedTokens(p).map(t=>t.placementSlot).sort((a,b)=>a-b);
    if(computer.length>3||computer.some((n,i)=>n!==i+1))return null;
    const remaining=3-computer.length,pool=p.resources.availableData;
    // Only extend the existing supplier goal when all computer placements
    // are already funded, leaving exactly one known corner for the blue slot.
    // No income slot, new choice, or hidden supply enters the prefix.
    if(remaining?(p.hand.length!==2||pool!==remaining):(p.hand.length+pool!==2||pool>1))return null;
    const ready=data.listBluePlacementRequirements(p).filter(({blueSlot})=>bluePrerequisites(p,blueSlot)===remaining
      &&data.getBlueBonusPlacementReward(p,blueSlot)?.type==='choose_card');
    if(ready.length!==1)return null;
    const useCorner=pool===remaining;
    const corner=useCorner&&p.hand.find(c=>{
      const gain=cards.getDiscardActionRewardForCard(c);
      return gain?.dataCount===1&&!Object.keys(gain.gain||{}).length;
    });
    if(useCorner&&(!corner||industry.shouldDoubleDiscardCornerRewards?.(p)||observes(state,seatId,'cardCorner')))return null;
    const rest=p.hand.filter(c=>c!==corner);
    if(rest.length!==1||cards.getIncomeGainForCard(rest[0])?.handSize!==1)return null;
    const supplier=publicLandingSupplier(state);
    if(!supplier||p.resources.credits<supplier.cost.credits)return null;
    const next=deferredLandingRoute({p,supplier,candidates,compareTiming});if(!next)return null;
    return {kind:'blue-landing-supply',id:'blue-landing:'+supplier.card.id+':'+next.c.requirementId,
      blueSlot:ready[0].blueSlot,cardId:supplier.card.id,cornerId:corner?.id||null,protectedIncomeCardId:rest[0].id,
      required:{},landing:{planetId:next.c.planetId,rocketId:next.c.rocketId,fee:supplier.cost.credits,points:next.points}};
  }
  function deferredLandingRoute({p,supplier,candidates,compareTiming}){
    const weights=stateValue.DEFAULT_WEIGHTS;
    const feasible=candidates().flatMap(c=>{
      if(c.launchRequired||c.endpointFamily!=='land'||c.endpointTarget?.type!=='planet'||c.path.length!==1)return [];
      const points=c.required.paidMovementPoints, ordinary={...c.endpointFacts.cost,energy:(c.endpointFacts.cost.energy||0)+points};
      if(probeCapital.funding(p.resources,ordinary,weights))return [];
      const payment=probeCapital.funding(p.resources,{...supplier.cost,energy:points},weights);
      if(!payment||payment.creditPurchases||c.targetBenefit.grossEquivalentValue<=payment.value+weights.handSize)return [];
      const timing=compareTiming(c.requirementId,c.path.map(step=>({...step,rocketId:c.rocketId})),0);
      if(!timing.comparable||timing.bestPrefixLength!==0||timing.waitPaidPoints>points)return [];
      return [{c,points,payment}];
    }).sort((a,b)=>b.c.targetBenefit.grossEquivalentValue-b.payment.value-(a.c.targetBenefit.grossEquivalentValue-a.payment.value)
      ||a.c.requirementId.localeCompare(b.c.requirementId));
    return feasible[0]||null;
  }
  function blueLandingWait({state,seatId,candidates,compareTiming}){
    const p=owner(state,seatId),turn=state.turn;
    if(!p||turn.roundNumber!==3||!p.mainActionCompleted||p.passCompletionPending||turn.currentPlayerId!==seatId
      ||p.industryRoundMarkRound===turn.roundNumber||p.resources.availableData!==0||placed(p)!==3||p.hand.length!==2
      ||industry.getPlayerIndustryDefinition(p)?.activeAbilityId!=='deepspace_swap_cards')return null;
    const supplier=probeCapital.heldLandingCard({hand:p.hand,round:turn.roundNumber},stateValue.DEFAULT_WEIGHTS);
    if(!supplier||supplier.card.blueBonusOwnerId!==seatId||!p.hand.some(c=>c.id!==supplier.card.id&&!c.hidden&&cards.getIncomeGainForCard(c)?.handSize===1))return null;
    if(!data.listBlueBonusPlacedTokens(p).some(t=>data.getBlueBonusPlacementReward(p,t.blueSlot)?.type==='choose_card'))return null;
    return deferredLandingRoute({p,supplier,candidates,compareTiming})?.c.requirementId||null;
  }
  function blueLandingSupplyStep({state,seatId,goal,actions,status}){
    const p=owner(state,seatId);
    if(status==='stable'&&p.hand.some(c=>c.id===goal.cardId))return {kind:'complete',reason:'known-blue-landing-supplier-acquired'};
    const find=(predicate,reason)=>{const a=actions.find(predicate);return a?{kind:'fixed',actionId:a.actionId,reason}:{kind:'infeasible',reason};};
    if(status==='decision'){
      if(actions.every(a=>a.family==='choose_target'&&['computer','blueBonus'].includes(a.target?.target)))
        return bluePrerequisites(p,goal.blueSlot)>0
          ?find(a=>a.target.target==='computer','prepare-computer-for-known-landing')
          :find(a=>a.target.blueSlot===goal.blueSlot,'place-data-for-known-landing');
      return find(a=>a.family==='choose_card'&&a.target?.choiceId?.startsWith('pick:')&&a.target.cardInstanceId===goal.cardId,'take-known-landing-supplier');
    }
    if(p.resources.availableData>0)return find(a=>a.family==='place_data','start-known-landing-blue-reward');
    return find(a=>a.family==='card_corner'&&a.target?.cardInstanceId===goal.cornerId&&a.payload?.kind==='resource','fund-known-landing-blue-reward');
  }
  // A known card can pay for the final step of a named landing. Keep the
  // prerequisite to one exact external step paid with energy or one known corner.
  // Cargo identity and landing rewards remain Native observations.
  function heldTransportGoal({state,seatId,p,candidates}){
    const turn=state.turn,weights=stateValue.DEFAULT_WEIGHTS;
    if(turn.roundNumber!==3||p.mainActionCompleted||p.passCompletionPending||turn.currentPlayerId!==seatId
      ||!turn.activePlayerIds.every(id=>id===seatId||turn.passedPlayerIds.includes(id))
      ||p.hand.some(c=>!c.id||!c.cardId||c.hidden))return null;
    const suppliers=p.hand.filter(card=>{
      const m=effects.getCardModel(card),list=m?.playEffects||[];
      return m?.cardType===2&&!m.triggers?.length&&list.length===3
        &&list[0].type==='card_move'&&list[0].options?.movementPoints===1
        &&list[1].type==='chong_land_for_pickup'&&list[2].type==='chong_pickup_fossil'
        &&!list[1].options?.allowSatellite&&!list[2].options?.allowSatellite
        &&list[1].options?.cardIndex===list[2].options?.cardIndex;
    });
    if(suppliers.length!==1)return directTransportGoal({state,seatId,p,candidates});
    const [card]=suppliers,cost=effects.getCardPlayCost(card);
    if(Object.keys(cost).length!==1||!Number.isSafeInteger(cost.credits)||cost.credits<=0||p.resources.credits<cost.credits)return null;
    const energyPayment=p.resources.energy>=1;
    const payers=energyPayment?[]:p.hand.filter(c=>c.id!==card.id&&movePoints(c)===1);
    let payment=payers.length===1?payers[0]:null;
    if(!energyPayment&&!payment&&payers.length>1){
      // Keep a held substitute landing or paid research card when one
      // plain move corner supplies the same Native payment. Other ties
      // have no established order and do not get a fixed plan.
      const plain=payers.filter(c=>!Object.keys(cards.getDiscardActionMoveRewardForCard(c).gain).length);
      const distinctUse=c=>(effects.getCardModel(c)?.playEffects||[]).some(e=>
        e.type==='chong_land_for_pickup'||e.type==='card_research_tech'&&e.options?.skipCost);
      if(plain.length===1&&payers.every(c=>c===plain[0]||distinctUse(c)))payment=plain[0];
    }
    if(!energyPayment&&!payment)return null;
    const options=[];
    for(const c of candidates()){
      if(c.launchRequired||c.endpointFamily!=='land'||c.endpointTarget?.type!=='planet'||!['jupiter','saturn'].includes(c.planetId)
        ||c.required.paidMovementPoints!==2||c.path.length!==2)continue;
      const probe=state.pieces.rockets.find(r=>r.id===c.rocketId);
      if(!probe)continue;
      let at=rockets.getRocketSectorCoordinate(probe);
      const path=c.path.map(step=>{
        const {deltaX,deltaY}=step,move=rockets.canMoveFromCoordinate(state.pieces,at,deltaX,deltaY,c.rocketId);
        if(!move.ok)throw Error('HELD_TRANSPORT_ROUTE_INVALID');
        const requiredMovePoints=rocketAbility.getRequiredMovePointsFromCoordinate({...state,state},p,at);
        const result={from:at,to:move.to,deltaX,deltaY,requiredMovePoints};at=move.to;return result;
      });
      if(!path.every(s=>s.requiredMovePoints===1))continue;
      const value=c.targetBenefit.grossEquivalentValue-cost.credits*weights.credits-weights.handSize-(energyPayment?weights.energy:weights.handSize);
      if(value>0)options.push({id:c.requirementId+':held-transport:'+card.id+':'+(payment?.id||'energy'),kind:'held-landing-route',
        rocketId:c.rocketId,planetId:c.planetId,endpointTarget:c.endpointTarget,cardId:card.id,movementCardId:payment?.id||null,
        coordinate:path[1].to,path,movementPoints:2,embeddedMove:path[1],required:cost,prefixOnly:false,value});
    }
    return options.sort((a,b)=>b.value-a.value||a.id.localeCompare(b.id))[0]||null;
  }

  // A direct pickup card supplies the landing, but none of the movement.
  // Admit one named route only when its fee and every step have disjoint
  // known payments. This plan does not speculate about which cargo appears.
  function directTransportGoal({state,seatId,p,candidates}){
    const transport=p.hand.filter(card=>{
      const model=effects.getCardModel(card),list=model?.playEffects||[];
      return model?.cardType===2&&!model.triggers?.length&&list.length===2
        &&list[0].type==='chong_land_for_pickup'&&list[1].type==='chong_pickup_fossil'
        &&list[0].options?.cardIndex===list[1].options?.cardIndex;
    });
    if(transport.length!==1||p.resources.energy!==0)return null;
    const [card]=transport,required=effects.getCardPlayCost(card),short=required.credits-p.resources.credits;
    if(Object.keys(required).length!==1||!Number.isSafeInteger(required.credits)||required.credits<=0||short>1)return null;
    const others=p.hand.filter(c=>c!==card);
    const movers=others.filter(c=>movePoints(c)===1);
    if(!movers.length||movers.length>2||others.some(c=>movePoints(c)>1))return null;
    const donors=short===1?others.filter(c=>!movePoints(c)).map(c=>c.id):[];
    if(short===1&&(donors.length!==2||observes(state,seatId,'quick_trade_payment')
      ||observes(state,seatId,'quick_trade_discard_selection')))return null;
    const options=[],weights=stateValue.DEFAULT_WEIGHTS;
    for(const c of candidates()){
      if(c.launchRequired||c.endpointFamily!=='land'||c.endpointTarget?.type!=='planet'||!['jupiter','saturn'].includes(c.planetId)
        ||!c.path.length||c.path.length!==movers.length||c.required.paidMovementPoints!==movers.length
        ||chong.getRemainingPlanetFossilCount(state.aliens,c.planetId)===0)continue;
      const probe=state.pieces.rockets.find(r=>r.id===c.rocketId);
      if(!probe||probe.fossilId)continue;
      let at=rockets.getRocketSectorCoordinate(probe);
      const path=c.path.map(({deltaX,deltaY},i)=>{
        const move=rockets.canMoveFromCoordinate(state.pieces,at,deltaX,deltaY,c.rocketId);
        if(!move.ok)throw Error('DIRECT_TRANSPORT_ROUTE_INVALID');
        const requiredMovePoints=rocketAbility.getRequiredMovePointsFromCoordinate({...state,state},p,at);
        const step={from:at,to:move.to,deltaX,deltaY,requiredMovePoints,paymentCardId:movers[i].id};
        at=move.to;return step;
      });
      if(!path.every(s=>s.requiredMovePoints===1))continue;
      const value=c.targetBenefit.grossEquivalentValue-required.credits*weights.credits
        -(1+movers.length+donors.length)*weights.handSize;
      options.push({id:c.requirementId+':direct-transport:'+card.id,kind:'held-landing-route',rocketId:c.rocketId,
        planetId:c.planetId,endpointTarget:c.endpointTarget,cardId:card.id,coordinate:at,path,
        movementPoints:path.length,required,prefixOnly:false,value,directTransport:true,creditPaymentIds:donors});
    }
    return options.sort((a,b)=>b.value-a.value||a.id.localeCompare(b.id))[0]||null;
  }

  function heldLandingGoal({state,seatId,candidates,compareTiming}){
    const p=owner(state,seatId),turn=state.turn,weights=stateValue.DEFAULT_WEIGHTS;
    const supplier=probeCapital.heldLandingCard({hand:p.hand,round:turn.roundNumber,passing:p.passCompletionPending},weights);
    if(!supplier||p.resources.credits<supplier.cost.credits)return heldTransportGoal({state,seatId,p,candidates});
    if(p.mainActionCompleted&&turn.activePlayerIds.every(id=>id===seatId||turn.passedPlayerIds.includes(id)))return null;
    const options=[];
    for(const c of candidates()){
      if(c.endpointFamily!=='land'||c.endpointTarget?.type!=='planet'||!c.path.length)continue;
      const probe=state.pieces.rockets.find(r=>r.id===c.rocketId);if(!probe)continue;
      const cost=c.endpointFacts.cost,energy=c.required.paidMovementPoints;
      if(probeCapital.funding(p.resources,{...cost,energy:(cost.energy||0)+energy},weights))continue;
      // Timing is comparatively expensive. Only compare candidates payable
      // today; a route which gets cheaper by waiting needs no advance macro.
      const payment=probeCapital.funding(p.resources,{...supplier.cost,energy},weights);
      if(!payment||payment.creditPurchases)continue;
      let at=rockets.getRocketSectorCoordinate(probe),points=0;
      const full=c.path.map(s=>{
        const move=rockets.canMoveFromCoordinate(state.pieces,at,s.deltaX,s.deltaY,c.rocketId);
        if(!move.ok)throw new Error('HELD_LANDING_ROUTE_INVALID');
        const requiredMovePoints=rocketAbility.getRequiredMovePointsFromCoordinate({...state,state},p,at);
        const step={from:at,to:move.to,deltaX:s.deltaX,deltaY:s.deltaY,requiredMovePoints};
        points+=requiredMovePoints;at=move.to;return step;
      });
      if(points!==energy)throw new Error('HELD_LANDING_ROUTE_COST_MISMATCH');
      let path=full,spend=payment;
      if(p.mainActionCompleted){
        const timing=compareTiming(c.requirementId,full.map(s=>({...s,rocketId:c.rocketId})),0);
        if(!timing.comparable||!timing.bestPrefixLength)continue;
        const prefix=timing.alternatives.find(t=>t.prefixLength===timing.bestPrefixLength);
        spend=probeCapital.funding(p.resources,{...supplier.cost,energy:prefix.totalPaidPoints},weights);
        if(!spend||spend.creditPurchases)continue;
        path=full.slice(0,prefix.prefixLength);points=prefix.prefixMovementPoints;
      }
      const value=c.targetBenefit.grossEquivalentValue-spend.value-weights.handSize;
      if(value<=0)continue;
      options.push({id:c.requirementId+':held-card:'+supplier.card.id,kind:'held-landing-route',rocketId:c.rocketId,
        planetId:c.planetId,endpointTarget:c.endpointTarget,cardId:supplier.card.id,coordinate:path[path.length-1].to,
        path,movementPoints:points,required:supplier.cost,prefixOnly:p.mainActionCompleted,value});
    }
    return options.sort((a,b)=>b.value-a.value||a.movementPoints-b.movementPoints||(a.id<b.id?-1:1))[0]||heldTransportGoal({state,seatId,p,candidates});
  }

  function heldLandingStep({state,seatId,goal,actions,status,session,operation}){
    const p=owner(state,seatId),find=(test,reason,kind='fixed')=>{
      const a=actions.find(test);return a?{kind,actionId:a.actionId,reason}:{kind:'infeasible',reason};
    };
    if(operation.targetStarted){
      if(status==='stable')return{kind:'complete',reason:'held-landing-settled'};
      if(goal.embeddedMove&&actions.some(a=>Number.isInteger(a.target?.deltaX)&&Number.isInteger(a.target?.rocketId))){
        const s=goal.embeddedMove,rocket=state.pieces.rockets.find(r=>r.id===goal.rocketId),at=rocket&&rockets.getRocketSectorCoordinate(rocket);
        if(!at||at.x!==s.from.x||at.y!==s.from.y)return{kind:'infeasible',reason:'held-transport-free-step-origin'};
        return find(a=>a.target.rocketId===goal.rocketId&&a.target.deltaX===s.deltaX&&a.target.deltaY===s.deltaY,'held-transport-native-free-step');
      }
      const land=actions.some(a=>a.target?.actionType==='land');
      if(land)return find(a=>a.target?.rocketId===goal.rocketId&&a.target?.planetId===goal.planetId
        &&a.target?.landTarget?.type===goal.endpointTarget.type,'held-landing-native-target',goal.embeddedMove||goal.directTransport?'fixed':'target');
      return{kind:'fallback',reason:'held-landing-native-effect',actionIds:actions.map(a=>a.actionId)};
    }
    if(status==='decision'){
      if(goal.directTransport){
        const source=session?.journal?.actions?.[0]?.action;
        if(source?.target?.tradeId==='cards-for-credit'&&goal.creditPaymentIds.length){
          const pending=session?.queue?.[0]?.payload?.decisionContext,selected=pending?.selected||[];
          if(pending?.kind!=='discard'||pending.count!==2||selected.some(id=>!goal.creditPaymentIds.includes(id)))
            return{kind:'infeasible',reason:'direct-transport-credit-payment-changed'};
          const next=goal.creditPaymentIds.find(id=>!selected.includes(id));
          return find(a=>next?a.target.cardInstanceId===next:a.target.confirm,'direct-transport-fixed-credit-payment');
        }
        const payer=goal.path[0]?.paymentCardId;
        return payer?find(a=>a.target?.kind==='move-payment'&&a.target.cardIds?.length===1&&a.target.cardIds[0]===payer,
          'direct-transport-fixed-movement-payment'):{kind:'infeasible',reason:'direct-transport-movement-payment-changed'};
      }
      if(actions.some(a=>a.target?.kind==='move-payment'))return find(a=>a.target?.kind==='move-payment'
        &&(goal.embeddedMove&&goal.movementCardId?a.target.cardIds?.length===1&&a.target.cardIds[0]===goal.movementCardId
          :a.target.choiceId==='energy'&&!a.target.cardIds?.length),goal.embeddedMove&&goal.movementCardId?'held-transport-pay-exact-corner':'held-landing-pay-exact-energy');
      return{kind:'fallback',reason:'held-landing-native-preparation-effect',actionIds:actions.map(a=>a.actionId)};
    }
    if(goal.directTransport&&p.resources.credits<goal.required.credits){
      if(goal.required.credits-p.resources.credits!==1||goal.creditPaymentIds.length!==2
        ||!goal.creditPaymentIds.every(id=>p.hand.some(c=>c.id===id)))
        return{kind:'infeasible',reason:'direct-transport-fee-changed'};
      return find(a=>a.family==='quick_trade'&&a.target.tradeId==='cards-for-credit','direct-transport-fund-fee');
    }
    if(!p.hand.some(c=>c.id===goal.cardId)||p.resources.credits<goal.required.credits)
      return{kind:'infeasible',reason:'held-landing-card-or-fee-unavailable'};
    if(!goal.path.length||goal.embeddedMove&&goal.path.length===1){
      if(goal.prefixOnly)return{kind:'complete',reason:'held-landing-prefix-completed'};
      return find(a=>a.family==='play_card'&&a.target.cardInstanceId===goal.cardId,'held-landing-play-known-card','start-target');
    }
    if(goal.embeddedMove&&(goal.movementCardId?!p.hand.some(c=>c.id===goal.movementCardId):p.resources.energy<1))
      return{kind:'infeasible',reason:'held-transport-movement-payment-unavailable'};
    if(!goal.embeddedMove&&!goal.directTransport&&p.resources.energy<goal.movementPoints){
      const funding=probeCapital.funding(p.resources,{...goal.required,energy:goal.movementPoints},stateValue.DEFAULT_WEIGHTS);
      if(!funding||funding.creditPurchases)return{kind:'infeasible',reason:'held-landing-currency-lower-bound'};
      return find(a=>a.family==='quick_trade'&&a.target.tradeId==='credits-for-energy','held-landing-fund-energy');
    }
    const next=goal.path[0];
    if(goal.directTransport&&!p.hand.some(c=>c.id===next.paymentCardId))return{kind:'infeasible',reason:'direct-transport-payer-unavailable'};
    return find(a=>a.family==='move'&&a.target.rocketId===goal.rocketId&&a.target.deltaX===next.deltaX&&a.target.deltaY===next.deltaY,
      'held-landing-fixed-direction');
  }
  function step({state,seatId,goal,actions,status,session,operation={}}){
    goal=currentGoal(state,goal);
    if(goal.kind==='blue-landing-supply')return blueLandingSupplyStep({state,seatId,goal,actions,status});
    if(goal.kind==='held-landing-route')return heldLandingStep({state,seatId,goal,actions,status,session,operation});
    if(goal.kind==='route'&&operation.targetStarted&&status==='stable')
      return{kind:'complete',reason:'route-endpoint-completed'};
    if(goal.kind==='effect-purpose'&&operation.targetStarted){
      return status==='stable'?{kind:'complete',reason:'purpose-effect-completed'}
        :{kind:'fallback',reason:'purpose-effect-native-choice',actionIds:actions.map(a=>a.actionId)};
    }
    const p=owner(state,seatId),d=needs(state,seatId,goal);
    if(goal.kind==='analysis-publicity'&&status==='stable'){
      if(!d.publicity)return{kind:'complete',reason:'analysis-publicity-funded'};
      const id=goal.publicityCornerCardIds.find(id=>p.hand.some(c=>c.id===id));
      const action=actions.find(a=>a.family==='card_corner'&&a.target?.cardInstanceId===id);
      return action?{kind:'fixed',actionId:action.actionId,reason:'known-analysis-publicity-source'}:{kind:'infeasible',reason:'analysis-publicity-source-unavailable'};
    }
    if(goal.kind==='blue-data'&&data.listBlueBonusPlacedTokens(p).some(t=>t.blueSlot===goal.blueSlot))return{kind:'complete',reason:'blue-data-target-reached'};
    if(goal.kind==='computer-prefix'&&status==='stable'&&placed(p)>=goal.targetComputerSlot)return{kind:'complete',reason:'computer-prefix-target-reached'};
    if(status==='decision'){
      if(goal.kind==='route'){
        const payment=actions.filter(a=>a.target?.kind==='move-payment');
        if(payment.length){const a=payment.filter(a=>p.resources.energy-(a.payload.energyCost||0)>=(goal.endpointCost.energy||0))
          .sort((a,b)=>(a.target.cardIds?.length||0)-(b.target.cardIds?.length||0)||(a.actionId<b.actionId?-1:1))[0];
          return a?{kind:'fixed',actionId:a.actionId,reason:'fixed-route-payment'}:{kind:'infeasible',reason:'route-payment-cannot-preserve-endpoint'};
        }
        if(actions.some(a=>Number.isInteger(a.target?.deltaX))){const next=goal.path[0],a=next&&actions.find(a=>a.target?.rocketId===goal.rocketId&&a.target.deltaX===next.deltaX&&a.target.deltaY===next.deltaY)
          ||actions.find(a=>a.target?.skip||a.target?.mode==='skip');return a?{kind:'fixed',actionId:a.actionId,reason:'fixed-goal-route-step'}:{kind:'infeasible',reason:'goal-route-step-unavailable'};}
      }

      const pay=fixedPayment({state,seatId,goal,actions,session,discardIds:operation.discardIds});if(pay)return pay;
      const income=incomeChoice({state,seatId,goal,actions});if(income)return income;
      if(operation.placing&&operation.resourceBlueSlot){
        const a=actions.find(a=>a.family==='choose_target'&&a.target?.target===(operation.finalResourceBlue?'blueBonus':'computer')
          &&(!operation.finalResourceBlue||a.target.blueSlot===operation.resourceBlueSlot));
        if(!a)return{kind:'infeasible',reason:'bound-blue-resource-choice-unavailable'};
        return{kind:'fixed',actionId:a.actionId,placing:false,resourceBlueSlot:null,reason:'fixed-blue-resource-preparation'};
      }
      if(operation.placing){const finishBlue=goal.kind==='blue-data'&&bluePrerequisites(p,goal.blueSlot)===0;
        const a=actions.find(a=>a.family==='choose_target'&&a.target?.target===(finishBlue?'blueBonus':'computer')
          &&(!finishBlue||a.target.blueSlot===goal.blueSlot));
        if(a)return{kind:finishBlue?'target':'fixed',actionId:a.actionId,reason:'fixed-goal-data-slot',placing:false};
      }
      if(operation.targetStarted){
        const a=actions.find(a=>goal.kind==='research_tech'?a.target?.tileId===goal.tileId&&(a.target.blueSlot??null)===goal.blueSlot:goal.kind==='route'?a.target?.rocketId===goal.rocketId&&a.target?.planetId===goal.planetId&&(goal.family!=='land'||a.target.landTarget?.type===goal.endpointTarget.type&&a.target.landTarget?.satelliteId===goal.endpointTarget.satelliteId):false);
        if(a)return{kind:'target',actionId:a.actionId,reason:'fixed-goal-target'};
        return{kind:'complete',reason:'target-started'};
      }
      return{kind:'fallback',reason:'non-equivalent-resource-effect-choice',actionIds:actions.map(a=>a.actionId)};
    }
    if(!capacity(state,seatId,goal))return{kind:'infeasible',reason:'resource-capacity-lower-bound'};
    if(goal.incomeFunding&&placed(p)<4&&p.hand.some(c=>c.id===goal.incomeCardId)&&!d.data){
      const a=actions.find(a=>a.family==='place_data');
      if(a)return{kind:'fixed',actionId:a.actionId,placing:true,reason:'fund-protected-card-via-income',demand:d};
    }
    if(goal.kind==='blue-data'&&d.data>0&&p.resources.availableData===players.RESOURCE_LIMITS.availableData&&bluePrerequisites(p,goal.blueSlot)>0){
      const a=actions.find(a=>a.family==='place_data');
      if(a)return{kind:'fixed',actionId:a.actionId,placing:true,reason:'make-room-for-goal-data',demand:d};
    }
    if(deficit(d)>0){
      const blue=blueFunding(state,seatId,goal),place=actions.find(a=>a.family==='place_data');
      if(blue&&place)return{kind:'fixed',actionId:place.actionId,placing:true,resourceBlueSlot:blue.blueSlot,
        finalResourceBlue:blue.remainingComputerPlacements===0,reason:'blue-resource-for-purpose',demand:d};
      const candidates=preparations({state,seatId,goal,actions,selectionOnly:true});
      if(candidates.length){
        const safe=candidates.find(c=>!c.observer);
        if(!safe)return{kind:'fallback',reason:candidates.some(c=>c.greedyFailed)?'greedy-payment-cannot-preserve-goal':'observed-resource-preparation',actionIds:candidates.map(c=>c.actionId),candidates};
        return{kind:'fixed',...safe,reason:safe.exactPublicityPayment?'complete-known-publicity-payment':'greedy-resource-deficit',demand:d};
      }
      // The second computer slot is a concrete publicity source; do not place unrelated data.
      if(d.publicity>0&&placed(p)<2&&p.resources.availableData>=2-placed(p)){
        const a=actions.find(a=>a.family==='place_data');if(a)return{kind:'fixed',actionId:a.actionId,placing:true,reason:'fund-publicity-at-computer-slot-2',demand:d};
      }
      return{kind:'infeasible',reason:'no-deficit-reducing-source',demand:d};
    }
    if(targetSlot(p,goal)&&placed(p)<targetSlot(p,goal)||goal.kind==='blue-data'){
      const a=actions.find(a=>a.family==='place_data');if(a)return{kind:'fixed',actionId:a.actionId,placing:true,finalPlacement:goal.kind==='blue-data'&&bluePrerequisites(p,goal.blueSlot)===0,reason:'data-placement-for-goal'};
      return{kind:'infeasible',reason:'goal-data-slot-unavailable'};
    }
    if(goal.kind==='income')return Object.values(p.income).reduce((a,b)=>a+b,0)>goal.incomeBefore?{kind:'complete',reason:'income-target-reached'}:{kind:'infeasible',reason:'income-not-collected'};
    if(goal.kind==='route'){
      const next=goal.path[0];
      const a=next?actions.find(a=>a.family==='move'&&a.target?.rocketId===goal.rocketId&&a.target.deltaX===next.deltaX&&a.target.deltaY===next.deltaY)
        :actions.find(a=>a.family===goal.family&&(a.target.rocketId==null||a.target.rocketId===goal.rocketId)&&(a.target.planetId==null||a.target.planetId===goal.planetId));
      return a?{kind:next?'fixed':'start-target',actionId:a.actionId,reason:next?'fixed-goal-route-step':'funded-route-endpoint'}:{kind:'infeasible',reason:'goal-route-action-unavailable'};
    }
    if(goal.kind==='effect-purpose'){
      const a=actions.find(a=>a.family===goal.sourceFamily&&(goal.cardId?a.target?.cardInstanceId===goal.cardId:a.target?.abilityId===goal.abilityId));
      return a?{kind:'start-target',actionId:a.actionId,reason:'start-bound-'+goal.purpose}:{kind:'infeasible',reason:'purpose-source-unavailable'};
    }
    const a=actions.find(a=>a.family===goal.kind&&(goal.kind!=='play_card'||a.target.cardInstanceId===goal.cardId));
    if(!a)return{kind:'infeasible',reason:'funded-target-unavailable'};
    return{kind:goal.kind==='research_tech'?'start-target':'target',actionId:a.actionId,reason:'funded-goal-action'};
  }
  return Object.freeze({VERSION,MONEY,isPreparation,positiveResourceGain,paidBudget,paidChoice,greedyTechPlans,previewIncomeTail,incomeTailCapital,incomeTailWithPreview,blindIncomeBoundaryCapital,publicLandingSupplier,blueLandingSupplyGoal,blueLandingWait,heldLandingGoal,fixedDataChoice,incomeFunding,blueFunding,catalog,currentGoal,needs,capacity,preparations,dataIncomeFunding,paymentCards,step,incomeChoice,incomeCardValue,incomeOfferValue,computerIncomeValue,cardOpportunityCost,heldAndResearchCapital,planningCapital,planningAnalysisCapital,immutableCapitalInput,knownSwapPortfolioQuotes,incomeSwapPlan,forecastDataPlan,movementToolPlan,dataCornerCards});
});
