(function(root,factory){
  'use strict';
  const common=typeof module==='object'&&module.exports;
  const api=factory(common?require('../cards/deck'):root.SetiCards,common?require('../cards/effects'):root.SetiCardEffects,
    common?require('../data'):root.SetiData,common?require('../tech/resolver'):root.SetiTechResolver,
    common?require('./resource-demand'):root.SetiResourceDemand,common?require('../players'):root.SetiPlayers,
    common?require('../actions/quick-trades'):root.SetiQuickTrades);
  if(common)module.exports=api;else root.SetiCardPickPlanning=api;
})(typeof globalThis!=='undefined'?globalThis:window,function(cards,effects,data,tech,demand,players,trades){
  'use strict';
  const VERSION='seti-purpose-card-pick-policy-v6';
  const TRADE_IDS=new Set(['credits-for-card','energy-for-card','publicity-for-card','cards-for-pick-card']);
  const isTrade=a=>a.family==='quick_trade'&&TRADE_IDS.has(a.target?.tradeId);
  const isOffer=a=>a.family==='choose_card'&&!a.target?.nebulaId&&(a.target?.source==='public'||a.target?.source==='blind'
    ||Number.isInteger(a.target?.publicSlotIndex)&&a.target?.choiceId?.startsWith('pick:'));
  function facts(card){
    const move=cards.getDiscardActionMoveRewardForCard(card),corner=cards.getDiscardActionRewardForCard(card);
    const model=effects.getCardModel(card),play=effects.buildPlayEffects(card),cost=effects.getCardPlayCost(card);
    // This is a deliberately narrow, known unconditional payoff; unknown effects never qualify as an exceptional buy.
    const certain=play.length&&play.every(e=>e.type==='gain_resources'&&Object.keys(e.options?.gain||{}).every(k=>k==='score'));
    const net=certain?play.reduce((n,e)=>n+(e.options.gain.score||0),0)-Object.values(cost).reduce((n,v)=>n+v,0)-1:0;
    return{id:card.id,cardId:card.cardId,price:card.price,income:cards.getIncomeCodeForCard(card),
      move:move?.movementPoints||0,data:corner?.dataCount||0,net,cost,model};
  }
  const creditTrade=trades.TRADE_ACTIONS.find(a=>a.id==='energy-for-credit'),energyTrade=trades.TRADE_ACTIONS.find(a=>a.id==='credits-for-energy');
  function moneyFundingGap(resources,required){
    const credits=resources.credits,energy=resources.energy,c=required.credits||0,e=required.energy||0;
    // Reserve the beneficiary's costs before converting a surplus. The same
    // currency cannot both pay the card and fund its exchange.
    return Math.max(0,c-credits-Math.floor(Math.max(0,energy-e)/creditTrade.cost.energy)*creditTrade.gain.credits)
      +Math.max(0,e-energy-Math.floor(Math.max(0,credits-c)/energyTrade.cost.credits)*energyTrade.gain.energy);
  }
  function createCardPickPlanner(){
    const cache=new Map();let hits=0,misses=0,rankedCards=0;
    function select(state,seatId,goal,offered,blind){
      const p=state.players.players.find(p=>p.id===seatId);
      const known=offered.map(card=>{
        const f=facts(card);if(!['queued-income','ready-income'].includes(goal.kind))return f;
        const withCard={...state,players:{...state.players,players:state.players.players.map(v=>v===p?{...p,hand:[...p.hand,card]}:v)}};
        const gain=cards.getIncomeGainForCard(card);
        let after;
        if(goal.kind==='ready-income'){
          const preview=demand.previewIncomeTail({state:withCard,seatId,goal:{kind:'income',targetComputerSlot:4,incomeCardId:card.id,required:{}}});
          if(!preview.available)throw new Error('CARD_PICK_READY_INCOME_UNAVAILABLE');after=preview.player;
        }else{after=structuredClone(p);players.gainIncome(after,gain,{blindDraw:()=>{}});}
        const fundingReduction=moneyFundingGap(p.resources,goal.required||{})-moneyFundingGap(after.resources,goal.required||{});
        return{...f,incomeValue:demand.incomeCardValue(withCard,seatId,card),fundingReduction};
      }).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
      const key=JSON.stringify([VERSION,state.turn.roundNumber,goal.kind,goal.amount||1,goal.cardId||null,known,blind]);
      if(cache.has(key)){hits++;return{...cache.get(key),cache:'hit'};}
      misses++;rankedCards+=known.length;
      const eligible=known.filter(c=>(!goal.cardId||goal.cardId===c.id)&&(goal.kind==='move'?c.move>=(goal.amount||1):goal.kind==='data'?c.data>=(goal.amount||1)
        :['income','queued-income','ready-income'].includes(goal.kind)?[0,1,2].includes(c.income):true));
      eligible.sort((a,b)=>(['queued-income','ready-income'].includes(goal.kind)?b.incomeValue-a.incomeValue||b.fundingReduction-a.fundingReduction:0)||(goal.kind==='income'?a.net-b.net:b.net-a.net)
        ||(goal.kind==='move'?b.move-a.move:goal.kind==='data'?b.data-a.data:0)||(a.id<b.id?-1:a.id>b.id?1:0));
      const result={cardId:eligible[0]?.id||null,blind:!eligible.length&&blind&&['income','queued-income','ready-income','committed-pick','free-reward'].includes(goal.kind)};
      if(cache.size>=64)cache.delete(cache.keys().next().value);cache.set(key,result);
      return{...result,cache:'miss'};
    }
    function goals(state,seatId,endpoints){
      const p=state.players.players.find(p=>p.id===seatId),hand=p.hand.map(facts),out=[];
      const placed=data.listComputerPlacedTokens(p).length,pool=p.resources.availableData;
      const protectedMain=!p.mainActionCompleted&&hand.length===1&&effects.buildPlayEffects(p.hand[0]).length
        &&Object.entries(hand[0].cost).every(([k,v])=>p.resources[k]>=v)?hand[0].id:null;
      if(placed<4&&pool>=4-placed&&p.hand.length-(protectedMain?1:0)===0)
        out.push({kind:'income',id:'income:computer:4',amount:1,priority:5,protectedCardId:protectedMain});
      if(!p.mainActionCompleted){
        for(const card of p.hand){
          const types=effects.buildPlayEffects(card).map(e=>e.type);
          if(!types.some(t=>['card_research_tech','card_income','card_tuck_played_card_to_income','card_discard_any_for_income'].includes(t)))continue;
          const target={kind:'play_card',cardId:card.id,required:effects.getCardPlayCost(card)};
          if(demand.capacity(state,seatId,target)||demand.incomeFunding(state,seatId,target))continue;
          for(const offer of state.cards.publicCards.filter(Boolean)){
            const withOffer={...state,players:{...state.players,players:state.players.players.map(v=>v.id===seatId?{...p,hand:[...p.hand,offer]}:v)}};
            const funding=demand.incomeFunding(withOffer,seatId,target);
            if(funding?.incomeCardId===offer.id)out.push({kind:'income',id:`income:fund-card:${card.id}:${offer.id}`,cardId:offer.id,protectedCardId:card.id,fundsCardId:card.id,required:target.required,priority:6});
          }
        }
        const stock=pool+hand.reduce((n,c)=>n+c.data,0);
        if(placed+stock===5&&p.resources.energy>=data.ANALYZE_ENERGY_COST)out.push({kind:'data',id:'data:analyze:6',amount:1,priority:4});
        const movement=p.resources.energy+hand.reduce((n,c)=>n+c.move,0);
        for(const target of (state.cards.publicCards.some(c=>c&&(cards.getDiscardActionMoveRewardForCard(c)?.movementPoints||0)>0)?endpoints():[]))if(target.required.energy-movement===1&&target.required.credits<=p.resources.credits
          &&target.targetBenefit.score>target.required.energy+target.required.credits)
          out.push({kind:'move',id:target.requirementId,amount:1,priority:4,required:target.required});
      }
      const bestHand=Math.max(0,...hand.map(c=>c.net));
      for(const card of state.cards.publicCards.filter(Boolean).map(facts))if(card.net>bestHand&&card.net>0)
        out.push({kind:'exceptional-card',id:`card:${card.id}`,cardId:card.id,net:card.net,bestHand,priority:3});
      const publicityScoring=p.reservedCards.some(c=>{const s=effects.getCardModel(c)?.endGameScoring;return s?.kind==='remainingResource'&&s.resource==='publicity';});
      if(!tech.listTakeableTiles(state.tech,p.techState).length&&!publicityScoring&&p.hand.length<4)
        out.push({kind:'unused-publicity',id:'publicity:no-takeable-tech',priority:1});
      return out.sort((a,b)=>b.priority-a.priority||(b.net||0)-(a.net||0)||(a.id<b.id?-1:a.id>b.id?1:0));
    }
    function paid(state,seatId,actions,endpoints){
      const p=state.players.players.find(p=>p.id===seatId),offers=state.cards.publicCards.filter(Boolean),trades=actions.filter(isTrade);
      for(const goal of goals(state,seatId,endpoints)){
        const selection=goal.cardId?{cardId:goal.cardId,blind:false,cache:'goal-fixed'}:select(state,seatId,goal,offers,false);
        if(!selection.cardId)continue;
        const picked=facts(offers.find(c=>c.id===selection.cardId)),funded=[];
        for(const action of trades){
          const cost=action.payload?.cost||{},handCost=cost.handSize||0;
          if(goal.kind==='unused-publicity'&&action.target.tradeId!=='publicity-for-card')continue;
          const choices=p.hand.map(facts).filter(c=>c.id!==goal.protectedCardId)
            .sort((a,b)=>a.net-b.net||(goal.kind==='data'?a.data-b.data:a.move-b.move)||(goal.kind==='data'?a.move-b.move:a.data-b.data)||(a.id<b.id?-1:1));
          if(choices.length<handCost)continue;const discarded=choices.slice(0,handCost),remaining=p.hand.map(facts).filter(c=>!discarded.some(d=>d.id===c.id));
          const wallet={...p.resources};for(const[k,v]of Object.entries(cost))if(k!=='handSize')wallet[k]-=v;
          if(Object.values(wallet).some(v=>v<0))continue;
          const price=(cost.credits||0)+(cost.energy||0)+(cost.publicity||0)*.5+handCost;
          if(goal.kind==='income'&&remaining.length-(goal.protectedCardId?1:0)!==0)continue;
          if(goal.fundsCardId){
            const gain=cards.getIncomeGainForCard(offers.find(c=>c.id===selection.cardId))||{};
            if(Object.entries(goal.required).some(([k,v])=>wallet[k]+(gain[k]||0)<v)
              ||data.listComputerPlacedTokens(p).length+wallet.availableData+remaining.filter(c=>c.id!==goal.fundsCardId).reduce((n,c)=>n+c.data,0)<4)continue;
          }
          if(goal.kind==='move'&&(wallet.credits<goal.required.credits||wallet.energy+remaining.reduce((n,c)=>n+c.move,0)+picked.move<goal.required.energy))continue;
          if(goal.kind==='data'&&(placedStock(p,remaining)+picked.data<6||wallet.energy<data.ANALYZE_ENERGY_COST))continue;
          if(goal.kind==='exceptional-card'&&(picked.net<=goal.bestHand+price
            ||Object.entries(picked.cost).some(([k,v])=>wallet[k]<v)))continue;
          funded.push({action,price,discardIds:discarded.map(c=>c.id)});
        }
        funded.sort((a,b)=>a.price-b.price||(a.action.actionId<b.action.actionId?-1:1));
        const funding=funded[0];if(funding)return{goal,selection,...funding};
      }
      return null;
    }
    const placedStock=(p,hand)=>data.listComputerPlacedTokens(p).length+p.resources.availableData+hand.reduce((n,c)=>n+c.data,0);
    function readyIncomeGoal(state,seatId){
      const p=state.players.players.find(p=>p.id===seatId),placed=data.listComputerPlacedTokens(p).length,card=p.hand.length===1&&p.hand[0];
      if(!card||placed>=4||p.resources.availableData<4-placed||demand.cardOpportunityCost(state,seatId,card)<=0)return null;
      const required=effects.getCardPlayCost(card);
      if(Object.keys(required).some(k=>!['credits','energy'].includes(k))||moneyFundingGap(p.resources,required)<=0)return null;
      return{kind:'ready-income',id:'income:ready:preserve-known-purpose',fundsCardId:card.id,protectedCardId:card.id,required};
    }
    function queuedIncomeGoal(session,seatId,state){
      if(session?.queue?.[0]?.type!=='science_domain_pick_card'||session.queue[0].ownerId!==seatId)return null;
      const p=state.players.players.find(p=>p.id===seatId);
      const future=p.hand.filter(card=>effects.buildPlayEffects(card).some(e=>['card_research_tech','card_income','card_tuck_played_card_to_income','card_discard_any_for_income'].includes(e.type))
        &&Object.entries(effects.getCardPlayCost(card)).some(([k,v])=>p.resources[k]<v)).sort((a,b)=>a.id<b.id?-1:1)[0];
      const goal={kind:'queued-income',id:'committed-own-income',...(future?{fundsCardId:future.id,required:effects.getCardPlayCost(future)}:{})};
      // Only this native, unconditional reward sequence is audited. Do not
      // infer income through unknown effects, optional branches or another owner.
      for(const entry of session.queue.slice(1)){
        if(entry.ownerId!==seatId)break;
        if(entry.type==='science_domain_income')return goal;
        const reward=entry.type==='probe_turn_reward'&&entry.payload?.reward;
        if(!reward||reward.options?.targetPlayerId&&reward.options.targetPlayerId!==seatId)break;
        if(reward.type==='income'&&reward.options?.count===1)return goal;
        if(reward.type!=='scan_planet_sector')break;
      }
      return null;
    }
    function plan({state,seatId,actions,status,session,endpoints=()=>[]}){
      const source=session?.journal?.actions?.[0]?.action,head=session?.queue?.[0],pending=head?.payload?.decisionContext;
      const tradePending=pending?.type==='trade'&&TRADE_IDS.has(pending.tradeId)&&['discard','card_selection'].includes(pending.kind);
      if(status==='decision'&&head?.payload?.step==='swap_hand'&&actions.length>0&&actions.every(a=>a.family==='choose_card'&&a.target?.choiceId?.startsWith('hand:')&&state.players.players.find(p=>p.id===seatId).hand.some(c=>c.id===a.target.cardInstanceId))){
        const hand=state.players.players.find(p=>p.id===seatId).hand;
        const utility=card=>{
          const f=facts(card),income=Object.entries(cards.getIncomeGainForCard(card)||{}).reduce((n,[k,v])=>n+v*({credits:1,energy:1,handSize:1,publicity:.5,availableData:.5}[k]||0),0);
          return (effects.getCardPrice(card)||0)+income*Math.max(0,4-state.turn.roundNumber)+(f.data+f.move)*.5;
        };
        const ranked=actions.map(action=>({action,value:utility(hand.find(c=>c.id===action.target.cardInstanceId))}))
          .sort((a,b)=>a.value-b.value||(a.action.target.cardInstanceId<b.action.target.cardInstanceId?-1:1));
        return {...fixed(ranked[0].action,{kind:'company-swap',id:'committed-company-swap'},null,[ranked[0].action.target.cardInstanceId],actions,'fixed-swap-outgoing'),
          knownCardValues:ranked.map(r=>({cardId:r.action.target.cardInstanceId,value:r.value})),assumption:'greedy known price, remaining income and corner utility; does not prove interchangeable card identities'};
      }
      if(status==='stable'){
        const trades=actions.filter(isTrade);if(!trades.length)return null;
        const chosen=paid(state,seatId,actions,endpoints),selected=chosen?.action;
        return{policy:VERSION,isEquivalence:false,kind:'card-acquisition-plan',goal:chosen?.goal||null,
          selectedActionId:selected?.actionId||null,selection:chosen?.selection||null,discardIds:chosen?.discardIds||[],
          retainedActionIds:actions.filter(a=>!isTrade(a)||a===selected).map(a=>a.actionId),excludedActionIds:trades.filter(a=>a!==selected).map(a=>a.actionId),
          reason:chosen?'explicit-pick-purpose':'no-pick-purpose'};
      }
      // DeepSpace's committed swap offers public cards without source/pick fields.
      // Match its exact native menu; income/corner company rewards need their own purpose.
      const companySwap=head?.payload?.step==='swap_public'&&actions.length>0&&actions.every(a=>a.family==='choose_card'
        &&!a.target?.nebulaId&&Number.isInteger(a.target?.slotIndex)&&a.target?.choiceId?.startsWith('public:')
        &&state.cards.publicCards[a.target.slotIndex]?.id===a.target.cardInstanceId);
      if(!tradePending&&!companySwap&&!actions.every(isOffer))return null;
      let committed;
      if(tradePending&&source&&session.baseState)committed=paid(session.baseState,seatId,[source],()=>endpoints(session.baseState));
      const outgoing=companySwap&&head.payload.handCardInstanceId;
      const purposeState=outgoing?{...state,players:{...state.players,players:state.players.players.map(p=>p.id===seatId?{...p,resources:{...p.resources,handSize:p.hand.length-1},hand:p.hand.filter(c=>c.id!==outgoing)}:p)}}:state;
      const availableGoals=!tradePending?goals(purposeState,seatId,()=>endpoints(purposeState)):[];
      const inferred=availableGoals.find(g=>g.kind==='income'||g.kind==='move'&&state.cards.publicCards.some(c=>c&&facts(c).move>=g.amount)||g.kind==='data'&&state.cards.publicCards.some(c=>c&&facts(c).data>=g.amount)||g.kind==='exceptional-card');
      const goal=committed?.goal||(!tradePending&&!companySwap&&(queuedIncomeGoal(session,seatId,state)||readyIncomeGoal(state,seatId)))||inferred||{kind:tradePending?'committed-pick':'free-reward',id:tradePending?`committed:${pending.tradeId}`:'free-card-reward'};
      if(pending?.kind==='discard'){
        const ids=committed?.discardIds||state.players.players.find(p=>p.id===seatId).hand.map(facts)
          .sort((a,b)=>a.net-b.net||(a.id<b.id?-1:1)).slice(0,pending.count).map(c=>c.id);
        const selected=pending.selected||[],remove=selected.find(id=>!ids.includes(id)),add=ids.find(id=>!selected.includes(id));
        const action=actions.find(a=>remove||add?a.target?.cardInstanceId===(remove||add):a.target?.confirm);
        if(!action)throw new Error('CARD_PICK_FIXED_PAYMENT_UNAVAILABLE');
        return fixed(action,goal,null,ids,actions,'fixed-pick-payment');
      }
      const available=state.cards.publicCards.filter(card=>card&&actions.some(a=>(a.target?.cardInstanceId||a.payload?.cardInstanceId)===card.id
        ||(a.target?.slotIndex??a.target?.publicSlotIndex)===state.cards.publicCards.indexOf(card)));
      const selection=committed?.selection||select(state,seatId,goal,available,actions.some(a=>a.target?.source==='blind'));
      const action=actions.find(a=>selection.blind?a.target?.source==='blind':(a.target?.cardInstanceId||a.payload?.cardInstanceId)===selection.cardId
        ||state.cards.publicCards[a.target?.slotIndex??a.target?.publicSlotIndex]?.id===selection.cardId);
      if(!action)throw new Error('CARD_PICK_FIXED_CARD_UNAVAILABLE');
      return fixed(action,goal,selection,[],actions,'fixed-card-pick');
    }
    function fixed(action,goal,selection,discardIds,actions,reason){return{policy:VERSION,isEquivalence:false,kind:'fixed-card-plan',fixed:true,
      goal,selection,discardIds,selectedActionId:action.actionId,retainedActionIds:[action.actionId],excludedActionIds:actions.filter(a=>a!==action).map(a=>a.actionId),reason};}
    return Object.freeze({plan,getDiagnostics:()=>({rankingCacheEntries:cache.size,maxRankingCacheEntries:64,rankingCacheHits:hits,rankingCacheMisses:misses,rankedCards})});
  }
  return Object.freeze({VERSION,isTrade,isOffer,createCardPickPlanner});
});
