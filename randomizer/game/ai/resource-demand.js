(function(root,factory){
  'use strict';const common=typeof module==='object'&&module.exports;
  const api=factory(common?require('../cards/deck'):root.SetiCards,common?require('../cards/effects'):root.SetiCardEffects,
    common?require('../data'):root.SetiData,common?require('../players'):root.SetiPlayers,
    common?require('../abilities/rocket'):root.SetiAbilityRocket,common?require('../rockets'):root.SetiRocketActions,common?require('../industry'):root.SetiIndustry,common?require('./state-value'):root.SetiStateValue,common?require('../tech/resolver'):root.SetiTechResolver);
  if(common)module.exports=api;else root.SetiResourceDemand=api;
})(typeof globalThis!=='undefined'?globalThis:window,function(cards,effects,data,players,rocketAbility,rockets,industry,stateValue,techResolver){
  'use strict';
  const VERSION='seti-goal-resource-preparation-v3';
  const MONEY=new Set(['credits-for-energy','energy-for-credit','cards-for-credit','cards-for-energy']);
  const isPreparation=a=>a.family==='card_corner'||a.family==='place_data'||a.family==='quick_trade'&&MONEY.has(a.target?.tradeId);
  const owner=(s,id)=>s.players.players.find(p=>p.id===id);
  const placed=p=>data.listComputerPlacedTokens(p).length;
  const movePoints=c=>cards.getDiscardActionMoveRewardForCard(c)?.movementPoints||0;
  const cornerData=c=>cards.getDiscardActionRewardForCard(c)?.dataCount||0;
  const weight={credits:2,energy:2,publicity:1,handSize:2};
  function currentGoal(state,goal){
    if(goal.kind!=='route')return goal;
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
    const target=targetSlot(p,goal);
    const d={credits:Math.max(0,(required.credits||0)-p.resources.credits),energy:Math.max(0,(required.energy||0)-p.resources.energy),
      publicity:Math.max(0,(required.publicity||0)-p.resources.publicity),data:Math.max(0,(goal.kind==='blue-data'?bluePrerequisites(p,goal.blueSlot)+1:Math.max(0,target-placed(p)))-p.resources.availableData)};
    return d;
  }
  const protectedCard=(c,g)=>c.id===g.cardId||c.id===g.incomeCardId;
  const targetSlot=(p,g)=>g.publicityData&&p.resources.publicity>=(g.required.publicity||0)?0:g.targetComputerSlot||0;
  const deficit=d=>Object.values(d).reduce((n,v)=>n+v,0);
  function capacity(state,seatId,goal,allowBlue=true){
    const p=owner(state,seatId),spare=p.hand.filter(c=>!protectedCard(c,goal)),d=needs(state,seatId,goal);
    const multiplier=industry.shouldDoubleDiscardCornerRewards?.(p)?2:1;
    const dataMax=p.resources.availableData+spare.reduce((n,c)=>n+cornerData(c)*multiplier,0);
    const publicityMax=p.resources.publicity+spare.reduce((n,c)=>n+(cards.getDiscardActionRewardForCard(c)?.gain?.publicity||0)*multiplier,0)
      +(placed(p)<2&&placed(p)+dataMax>=2?1:0);
    const required=goal.required||{},funding=goal.incomeFunding&&placed(p)<4&&p.hand.find(c=>c.id===goal.incomeCardId);
    const income=funding?cards.getIncomeGainForCard(funding)||{}:{};
    const direct=(!d.credits||p.resources.credits+(income.credits||0)+Math.floor(p.resources.energy/2)+Math.floor(spare.length/2)>=(required.credits||0))
      &&(!d.energy||p.resources.energy+(income.energy||0)+Math.floor(p.resources.credits/2)+Math.floor(spare.length/2)+(goal.kind==='route'?spare.reduce((n,c)=>n+movePoints(c),0):0)>=(goal.kind==='route'?(goal.endpointCost.energy||0)+goal.movementPoints:required.energy||0))
      &&(!d.publicity||publicityMax+(income.publicity||0)>=required.publicity)
      &&(goal.kind==='blue-data'||!targetSlot(p,goal)||placed(p)+dataMax>=targetSlot(p,goal))
      &&(goal.kind!=='blue-data'||dataMax>=bluePrerequisites(p,goal.blueSlot)+1);
    return direct||allowBlue&&Boolean(blueFunding(state,seatId,goal));
  }
  function blueFunding(state,seatId,goal){
    if(goal.kind==='blue-data')return null;
    const p=owner(state,seatId),d=needs(state,seatId,goal);
    if(!d.credits&&!d.energy&&!d.publicity||p.reservedCards.some(c=>effects.getCardModel(c)?.endGameScoring))return null;
    const choices=[];
    for(const slot of Object.keys(data.BLUE_BONUS_DATA_SLOTS).map(Number)){
      if(!data.hasBlueTechInBoardSlot(p,slot)||data.listBlueBonusPlacedTokens(p).some(t=>t.blueSlot===slot))continue;
      const reward=data.getBlueBonusPlacementReward(p,slot),required=data.getRequiredComputerSlotForBlueBonus(slot);
      if(!reward||!['credits','energy','publicity'].includes(reward.type)||!(d[reward.type]>0))continue;
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
      if(reduction>0)choices.push({blueSlot:slot,remainingComputerPlacements:remaining,reduction});
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
    choices.sort((a,b)=>value(b.gain)-value(a.gain)||(a.card.id<b.card.id?-1:1));
    const card=choices[0]?.card;
    return card?{...goal,targetComputerSlot:4,incomeCardId:card.id,incomeFunding:true}:null;
  }
  function heldAndResearchCapital(state,p){
    const passing=(state.passingPlayerIds||state.turn.passedPlayerIds).includes(p.id)||p.passCompletionPending===true;
    return stateValue.handCapital(p.hand,p.techState,state.tech,state.turn.roundNumber+Number(passing))
      +stateValue.researchCapital({hand:p.hand,techState:p.techState,supply:state.tech,round:state.turn.roundNumber,
        publicity:p.resources.publicity,researchCost:techResolver.getResearchPublicityCost(p),passed:passing});
  }
  function incomeOpportunityCost(state,p,card){
    return heldAndResearchCapital(state,p)-heldAndResearchCapital(state,{...p,hand:p.hand.filter(c=>c.id!==card.id)});
  }
  function incomeCardValue(state,seatId,card){
    const p=owner(state,seatId),gain=cards.getIncomeGainForCard(card);
    return Object.entries(gain).reduce((n,[k,v])=>n+v*({credits:1,energy:1,handSize:1,publicity:.5,availableData:.5}[k]||0),0)*(5-state.turn.roundNumber)-incomeOpportunityCost(state,p,card);
  }
  function cardOpportunityCost(state,seatId,card){return incomeOpportunityCost(state,owner(state,seatId),card);}
  function dataCornerCards({state,seatId,goal}){
    const p=owner(state,seatId);
    return p.hand.filter(c=>!protectedCard(c,goal)&&cornerData(c)===1&&!Object.keys(cards.getDiscardActionRewardForCard(c).gain||{}).length)
      .map(card=>({card,loss:incomeOpportunityCost(state,p,card)}))
      .sort((a,b)=>a.loss-b.loss||(a.card.id<b.card.id?-1:a.card.id>b.card.id?1:0));
  }
  function catalog({state,seatId,requirements,actions=[]}){
    const p=owner(state,seatId),goals=[],requested=[],add=g=>{
      requested.push(g);
      const directPub=p.resources.publicity+p.hand.filter(c=>c.id!==g.cardId).reduce((n,c)=>n+(cards.getDiscardActionRewardForCard(c)?.gain?.publicity||0)*(industry.shouldDoubleDiscardCornerRewards?.(p)?2:1),0);
      if(g.required?.publicity>directPub&&g.required.publicity<=directPub+1&&placed(p)<2)g={...g,publicityData:true,targetComputerSlot:2};
      if(capacity(state,seatId,g))goals.push(g);
      else{const funded=incomeFunding(state,seatId,g);if(funded&&capacity(state,seatId,funded))goals.push(funded);}
    };
    if(!p||state.match.initialSetup||p.passCompletionPending)return goals;
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
      for(const t of greedyTechPlans({state,seatId,plans:requirements.techPlans}))add({id:t.planId,kind:'research_tech',tileId:t.tileId,blueSlot:t.blueSlot,required:t.required});
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
    if(placed(p)<4&&p.hand.some(c=>cards.getIncomeGainForCard(c))){
      const incomeCard=p.hand.filter(c=>cards.getIncomeGainForCard(c)).sort((a,b)=>{
        const value=c=>Object.entries(cards.getIncomeGainForCard(c)||{}).reduce((n,[k,v])=>n+v*({credits:1,energy:1,handSize:1,publicity:.5,availableData:.5}[k]||0),0);
        return (value(b)*(5-state.turn.roundNumber)-incomeOpportunityCost(state,p,b))
          -(value(a)*(5-state.turn.roundNumber)-incomeOpportunityCost(state,p,a))||(a.id<b.id?-1:1);
      }).find(c=>capacity(state,seatId,{kind:'income',targetComputerSlot:4,incomeCardId:c.id,required:{}}));
      if(incomeCard)add({id:'data:income:4',kind:'income',targetComputerSlot:4,incomeCardId:incomeCard.id,incomeBefore:Object.values(p.income).reduce((a,b)=>a+b,0),required:{}});
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
  function positiveResourceGain(effect){
    const gain=effect?.options?.gain;
    return effect?.type==='gain_resources'&&gain&&Object.keys(gain).length&&Object.entries(gain).every(([k,v])=>k in localWeights&&Number.isFinite(v)&&v>=0)?gain:null;
  }
  function paidChoice({state,seatId,actions,session}){
    if(!actions.length||!actions.every(a=>a.family==='choose_reward'&&(a.target?.pay||a.target?.skip)))return null;
    const effect=session?.queue?.[0]?.payload?.cardEffect;
    if(effect?.type!=='card_pay_credits_for_reward')return null;
    const gain=positiveResourceGain(effect.options?.reward);if(!gain||gain.credits||gain.energy)return null;
    const p=owner(state,seatId),copy=structuredClone(p),before=resourceValue(copy);
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
    let current={...state,players:{...state.players,players:state.players.players.map(p=>p.id===seatId?structuredClone(p):p)}};
    if(!players.spendResources(owner(current,seatId),cost).ok)return null;
    let amount=0,net=0;
    while(true){
      const before=resourceValue(owner(current,seatId));let next=current;
      if(owner(next,seatId).resources.credits<1){
        const goal={kind:'play_card',cardId:card.id,required:{credits:1}};
        const choice=preparations({state:next,seatId,goal,actions}).find(c=>!c.observer);
        if(!choice)break;
        next=project(next,seatId,actions.find(a=>a.actionId===choice.actionId),choice.discardIds);
        if(!next||owner(next,seatId).resources.credits<1)break;
      }
      const p=structuredClone(owner(next,seatId));if(!players.spendResources(p,{credits:1}).ok)break;
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
  function project(state,seatId,action,discardIds){
    const p=structuredClone(owner(state,seatId));
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
    }
    p.resources.handSize=p.hand.length;
    return{...state,players:{...state.players,players:state.players.players.map(v=>v.id===seatId?p:v)}};
  }
  function preparations({state,seatId,goal,actions}){
    const before=needs(state,seatId,goal),out=[];
    for(const action of actions.filter(isPreparation)){
      if(action.family==='place_data'||action.family==='card_corner'&&(action.payload.kind!=='resource'||protectedCard({id:action.target.cardInstanceId},goal)))continue;
      const discarded=action.family==='quick_trade'?paymentCards(state,seatId,goal,action.payload.cost.handSize||0):[action.target.cardInstanceId];
      if(!discarded)continue;const after=project(state,seatId,action,discarded);if(!after)continue;const d=needs(after,seatId,goal);
      if(Object.keys(before).some(k=>d[k]>before[k])||deficit(d)>=deficit(before))continue;
      const greedyFailed=!capacity(after,seatId,goal);if(greedyFailed&&!(action.payload.cost?.handSize>0))continue;
      const loss=action.family==='quick_trade'?Object.entries(action.payload.cost).reduce((n,[k,v])=>n+v*(weight[k]||0),0)-Object.entries(action.payload.gain).reduce((n,[k,v])=>n+v*(weight[k]||0),0):2+2*incomeOpportunityCost(state,owner(state,seatId),owner(state,seatId).hand.find(c=>c.id===action.target.cardInstanceId));
      out.push({actionId:action.actionId,discardIds:greedyFailed?null:discarded,reduction:deficit(before)-deficit(d),loss,inputs:action.family==='quick_trade'&&discarded.length?discarded.length+2:1,
        greedyFailed,observer:greedyFailed|| (action.family==='card_corner'?observes(state,seatId,'cardCorner'):observes(state,seatId,'quick_trade_payment')||observes(state,seatId,'quick_trade_discard_selection'))});
    }
    let dataOrder=null;
    const rank=c=>{
      const action=actions.find(a=>a.actionId===c.actionId);if(action?.family!=='card_corner')return null;
      if(!dataOrder)dataOrder=new Map(dataCornerCards({state,seatId,goal}).map((x,i)=>[x.card.id,i]));
      return dataOrder.get(action.target?.cardInstanceId);
    };
    out.sort((a,b)=>a.loss*b.reduction-b.loss*a.reduction||a.inputs-b.inputs
      ||(rank(a)!=null&&rank(b)!=null?rank(a)-rank(b):0)||(a.actionId<b.actionId?-1:a.actionId>b.actionId?1:0));
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
    const scored=choices.filter(a=>a.target.cardInstanceId!==goal.cardId&&(!goal.incomeCardId||a.target.cardInstanceId===goal.incomeCardId)).map(a=>{
      const card=p.hand.find(c=>c.id===a.target.cardInstanceId),gain=cards.getIncomeGainForCard(card);
      const next={...state,players:{...state.players,players:state.players.players.map(v=>v.id===seatId?{...p,resources:{...p.resources},hand:p.hand.filter(c=>c!==card)}:v)}};
      if(goal.incomeFunding&&card.id===goal.incomeCardId)players.gainResources(owner(next,seatId),gain);
      return{action:a,value:incomeCardValue(state,seatId,card),feasible:capacity(next,seatId,goal)};
    }).filter(x=>x.feasible).sort((a,b)=>b.value-a.value||(a.action.actionId<b.action.actionId?-1:1));
    return scored[0]?{kind:'fixed',actionId:scored[0].action.actionId,reason:'greedy-income-for-goal'}:{kind:'infeasible',reason:'income-would-consume-goal-card'};
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
  function previewIncomeTail({state,seatId,goal}){
    const original=owner(state,seatId),p=structuredClone(original),card=p.hand.find(c=>c.id===goal.incomeCardId);
    const remaining=Math.max(0,4-placed(p));
    if(!card||p.resources.availableData<remaining)return{available:false,reason:'income-tail-needs-additional-funding'};
    for(let i=0;i<remaining;i++){
      const result=data.placeDataToComputer(p);if(!result.ok)return{available:false,reason:'income-tail-slot-unavailable'};
      for(const bonus of result.slotBonuses||[]){if(bonus.type==='publicity')players.gainResources(p,{publicity:bonus.publicity});else if(bonus.type==='score')players.gainResources(p,{score:bonus.score});}
    }
    p.hand=p.hand.filter(c=>c.id!==card.id);const gain=cards.getIncomeGainForCard(card);let blindHandValue=0;
    players.gainIncome(p,gain,{blindDraw:()=>{blindHandValue++;},gainData:target=>data.gainData(target)});
    const future=Object.entries(gain).reduce((n,[k,v])=>n+v*({credits:1,energy:1,publicity:.5,availableData:.5,additionalPublicScan:.5,handSize:1}[k]||0),0)*(4-state.turn.roundNumber);
    return{available:true,player:p,netGain:resourceValue(p)-resourceValue(original)+blindHandValue+future,
      immediateScoreGain:p.resources.score-original.resources.score,placements:remaining,assumption:'known income reward and remaining official income rounds; unknown drawn identities excluded'};
  }
  function blueValue(p,slot){
    const bonus=data.getBlueBonusPlacementReward(structuredClone(p),slot);
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
  function step({state,seatId,goal,actions,status,session,operation={}}){
    goal=currentGoal(state,goal);
    if(goal.kind==='effect-purpose'&&operation.targetStarted){
      return status==='stable'?{kind:'complete',reason:'purpose-effect-completed'}
        :{kind:'fallback',reason:'purpose-effect-native-choice',actionIds:actions.map(a=>a.actionId)};
    }
    const p=owner(state,seatId),d=needs(state,seatId,goal);
    if(goal.kind==='blue-data'&&data.listBlueBonusPlacedTokens(p).some(t=>t.blueSlot===goal.blueSlot))return{kind:'complete',reason:'blue-data-target-reached'};
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
      const candidates=preparations({state,seatId,goal,actions});
      if(candidates.length){
        const safe=candidates.find(c=>!c.observer);
        if(!safe)return{kind:'fallback',reason:candidates.some(c=>c.greedyFailed)?'greedy-payment-cannot-preserve-goal':'observed-resource-preparation',actionIds:candidates.map(c=>c.actionId),candidates};
        return{kind:'fixed',...safe,reason:'greedy-resource-deficit',demand:d};
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
  return Object.freeze({VERSION,MONEY,isPreparation,positiveResourceGain,paidBudget,paidChoice,greedyTechPlans,previewIncomeTail,fixedDataChoice,incomeFunding,blueFunding,catalog,currentGoal,needs,capacity,preparations,paymentCards,step,incomeChoice,incomeCardValue,cardOpportunityCost,heldAndResearchCapital,dataCornerCards});
});
