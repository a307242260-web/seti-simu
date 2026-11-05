(function (root, factory) {
  "use strict";
  const common = typeof module === "object" && module.exports;
  const api = factory(common ? require("../cards/effects") : root.SetiCardEffects,
    common ? require("../data/placement") : root.SetiDataPlacement,
    common ? require("../tech/catalog") : root.SetiTechCatalog,
    common ? require("../abilities/planet") : root.SetiAbilityPlanet,
    common ? require("../actions/scan-effects") : root.SetiScanEffects,
    common ? require("./probe-capital") : root.SetiProbeCapital,
    common ? require("./ready-analysis-capital") : root.SetiReadyAnalysisCapital,
    common ? require("./research-income-capital") : root.SetiResearchIncomeCapital,
    common ? require("./sector-card-capital") : root.SetiSectorCardCapital,
    common ? require("./value-arithmetic") : root.SetiValueArithmetic,
    common ? require("./known-movement-capital") : root.SetiKnownMovementCapital,
    common ? require("../end-game-scoring") : root.SetiEndGameScoring,
    common ? require("./research-trigger-capital") : root.SetiResearchTriggerCapital,
    common ? require("./known-symbol-capital") : root.SetiKnownSymbolCapital);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SetiStateValue = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (cardEffects, dataPlacement, techCatalog, planetAbility, scanEffects, probeCapital, readyAnalysis, researchIncome, sectorCard, arithmetic, movementTool, endScoring, researchTriggers, symbolCard) {
  "use strict";

  const MODEL_VERSION = "seti-purpose-capital-state-value-v37";
  // 首版比较刻度，属于估值假设，不是规则兑换率或可用于证明剪枝的收益上界。
  const DEFAULT_WEIGHTS = arithmetic.DEFAULT_WEIGHTS;
  const evaluatorWeights = new WeakMap(), trustedWeights = new WeakSet([DEFAULT_WEIGHTS]);

  function number(value, path) {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`VALUE_NUMBER_INVALID: ${path}`);
    return value;
  }

  function valueWeights(options) {
    if (options.weights && trustedWeights.has(options.weights)) return options.weights;
    const weights = { ...DEFAULT_WEIGHTS, ...options.weights };
    for (const [key, value] of Object.entries(weights)) {
      if (!Object.hasOwn(DEFAULT_WEIGHTS, key)) throw new TypeError(`VALUE_WEIGHT_UNKNOWN: ${key}`);
      if (number(value, `weights.${key}`) < 0) throw new TypeError(`VALUE_WEIGHT_NEGATIVE: ${key}`);
    }
    return weights;
  }

  // Forecast hypotheses, not guaranteed rewards or admissible search bounds.
  // The current turn is executed natively; only later-round usage is forecast.
  // Teacher transport activity: 13 useful purple4 uses in later rounds2-4.
  // Floor the historical mean to4. Later history is a training estimate,
  // not current-rule reachability or a guaranteed pruning bound.
  const FORECAST = Object.freeze({ computerCyclesPerLaterRound: 1, usefulScansPerLaterRound: 4,
    landingsPerLaterRound: 1 });
  function technologyCapital(techState, round, weights = DEFAULT_WEIGHTS) {
    const later = Math.max(0, 4 - round), owned = techState?.ownedTiles || {}, disabled = techState?.disabledTiles || {};
    let total = 0;
    for (const id of Object.keys(owned)) {
      if (!owned[id] || disabled[id]) continue;
      const bonus = dataPlacement.getBlueTileDataBonus(id);
      if (bonus && Number.isInteger(techState.blueBoardSlots?.[id])) {
        const reward = bonus.type === "choose_card" ? weights.handSize
          : Object.entries(weights).reduce((n, [key, w]) => n + (bonus[key] || 0) * w, 0);
        total += FORECAST.computerCyclesPerLaterRound * later * (dataPlacement.getBlueColumnScoreBonus().score
          + Math.max(0, reward - weights.availableData));
      } else if (id === "purple4") {
        // A useful one-point move replaces one paid ordinary movement point.
        // Launch tempo and flexible scan targets are not assigned invented scores.
        total += FORECAST.usefulScansPerLaterRound * later * scanEffects.SCAN_ACTION_4_MOVE_POINTS * weights.energy;
      } else if (id === "orange3") {
        total += FORECAST.landingsPerLaterRound * later * planetAbility.ORANGE3_LAND_DISCOUNT * weights.energy;
      }
    }
    return total;
  }
  const targetQuotes = new Map(), immutableTargetQuotes = new WeakMap();
  function immutableTargets(techState, supply, weights) {
    if (!techState || !supply || !Object.isFrozen(techState) || !Object.isFrozen(techState.ownedTiles)
      || !Object.isFrozen(techState.disabledTiles) || !Object.isFrozen(techState.blueBoardSlots)
      || !Object.isFrozen(supply) || !supply.stacks || !Object.isFrozen(supply.stacks)
      || !Object.values(supply.stacks).every(Object.isFrozen) || !Object.isFrozen(weights)) return null;
    let bySupply = immutableTargetQuotes.get(techState);
    if (!bySupply) { bySupply = new WeakMap(); immutableTargetQuotes.set(techState, bySupply); }
    let byWeights = bySupply.get(supply);
    if (!byWeights) { byWeights = new WeakMap(); bySupply.set(supply, byWeights); }
    let byRound = byWeights.get(weights);
    if (!byRound) { byRound = new Map(); byWeights.set(weights, byRound); }
    return byRound;
  }
  function researchTargets(techState, supply, round, weights) {
    const memo = immutableTargets(techState, supply, weights);
    if (memo?.has(round)) return memo.get(round);
    const key = JSON.stringify([techState?.ownedTiles, techState?.disabledTiles, techState?.blueBoardSlots,
      round, weights, Object.entries(supply?.stacks || {}).map(([id, stack]) =>
        [id, stack.remaining, stack.firstTakeClaimedBy, stack.bonusHidden, stack.bonusId])]);
    if (targetQuotes.has(key)) {
      const result = targetQuotes.get(key); memo?.set(round, result); return result;
    }
    const owned = techState?.ownedTiles || {}, current = technologyCapital(techState, round, weights);
    const currentByRound = [0, 1, 2, 3].map(r => r ? technologyCapital(techState, r, weights) : 0);
    const occupied = new Set(Object.values(techState?.blueBoardSlots || {}));
    const blueSlot = [1, 2, 3, 4].find(slot => !occupied.has(slot));
    const result = Object.entries(supply?.stacks || {}).flatMap(([id, stack]) => {
      const type = techCatalog.getTechType(id);
      if (!type || owned[id] || !(stack.remaining > 0) || type === "blue" && blueSlot == null) return [];
      const next = { ...techState, ownedTiles: { ...owned, [id]: true },
        blueBoardSlots: { ...techState?.blueBoardSlots, ...(type === "blue" ? { [id]: blueSlot } : {}) } };
      const first = stack.firstTakeClaimedBy == null ? techCatalog.FIRST_TAKE_TYPE_SCORE : 0;
      const bonus = !stack.bonusHidden && techCatalog.BONUS_EFFECTS[stack.bonusId];
      const bonusValue = bonus ? Object.entries(bonus).reduce((n, [key, amount]) => n + amount *
        (key === "score" ? 1 : key === "cardSelection" ? weights.handSize : weights[key] || 0), 0) : 0;
      return [Object.freeze({ id, type, capability: technologyCapital(next, round, weights) - current,
        capabilityByRound: Object.freeze([0, 1, 2, 3].map(r => r ? technologyCapital(next, r, weights) - currentByRound[r] : 0)), first, bonusValue })];
    });
    if (targetQuotes.size >= 64) targetQuotes.delete(targetQuotes.keys().next().value);
    targetQuotes.set(key, Object.freeze(result)); memo?.set(round, result);
    return result;
  }
  const researchModels = new WeakMap();
  function supportedResearch(card) {
    if (!card?.cardId || card.hidden) return null;
    const model = cardEffects.getCardModel(card);
    if (!model) return null;
    if (researchModels.has(model)) return researchModels.get(model);
    const play = cardEffects.buildPlayEffects(card);
    const supported = play.length === 1 && play[0].type === "card_research_tech" && play[0].options?.skipCost
      && !play[0].options.afterResearchReward && !play[0].options.requireCondition
      && !play[0].options.researchedByOthersOnly && !play[0].options.skipBonus ? play[0] : null;
    if (Object.isFrozen(model) && Object.isFrozen(model.playEffects)
      && (model.playEffects || []).every(effect => Object.isFrozen(effect) && Object.isFrozen(effect.options))) {
      researchModels.set(model, supported);
    }
    return supported;
  }
  const NO_RESEARCH_MARKS = Object.freeze([]);
  function newResearchMark(facts,funding,trigger) {
    const opportunity=facts.nextFinalMark,score=funding?.resources?.score;
    if(!(trigger.available||trigger.reason==='no-active-research-trigger')||!facts.uncontestedRound||facts.terminal||facts.passing||facts.round>=4||facts.pendingNativeEffects
      ||!Array.isArray(facts.pendingCardTriggers)||facts.pendingCardTriggers.length||!opportunity?.valuationSafe
      ||opportunity.playerId!==facts.player.id||score!==facts.player.score||!Number.isFinite(score)||opportunity.currentScore>score||!(score<opportunity.threshold))return null;
    const needed=[1,2,3,4].filter(slot=>!facts.computerSlots?.includes(slot)).length;
    if(!facts.computerSlots?.includes(4)&&!(facts.player.availableData<needed))return null;
    const scores=Object.fromEntries(Object.entries(facts.supply?.stacks||{}).filter(([id,stack])=>!facts.player.techState.ownedTiles[id]&&stack.remaining>0).map(([id,stack])=>[id,
      (stack.firstTakeClaimedBy==null?techCatalog.FIRST_TAKE_TYPE_SCORE:0)+(!stack.bonusHidden?techCatalog.BONUS_EFFECTS[stack.bonusId]?.score||0:0)]));
    const currentValue=Math.max(0,...opportunity.options.map(option=>option.currentValue));
    return score+2*Math.max(0,...Object.values(scores))>=opportunity.threshold&&currentValue>0
      ?{currentScore:score,threshold:opportunity.threshold,currentValue,scoreGains:scores,availableData:funding.resources.availableData,neededData:needed,incomeUsed:facts.computerSlots.includes(4)}:null;
  }
  function researchFunding(facts, funding, publicity = funding?.resources?.publicity) {
    const board=facts.board?.finalScoring,mark=board?.tiles?.d?.marks?.find(m=>m.playerId===facts.player.id);
    let result=funding;
    if(mark){const formulaId=endScoring.getFormulaId('d',board.tileVariants.d);
      result={...funding,researchMarks:[{formulaId,multiplier:endScoring.getSlotMultiplier(formulaId,mark.slotIndex)}]};
    }else if(funding?.researchMarks?.length)result={...funding,researchMarks:NO_RESEARCH_MARKS};
    const trigger=researchTriggers.describe(facts,funding,publicity);
    result={...result,newFinalMark:newResearchMark(facts,funding,trigger)};
    return trigger.available?{...result,researchTriggers:trigger}:result?.researchTriggers?{...result,researchTriggers:null}:result;
  }
  const researchMarkQuotes=new Map();
  function researchPurposeGains(techState, funding, weights, paidPublicity=0) {
    const marks=funding?.researchMarks||[],opportunity=funding?.newFinalMark;
    const triggered=researchTriggers.gains(funding?.researchTriggers,weights,paidPublicity);
    if(!marks.length&&!opportunity)return triggered;
    const value=tech=>marks.reduce((n,m)=>n+endScoring.getFormulaBaseValue(m.formulaId,{techState:tech},{})*m.multiplier,0);
    const add=(tech,id)=>({...tech,ownedTiles:{...tech.ownedTiles,[id]:true}}),quotes=new Map();
    // Cache only raw formal point differences. Full technology/mark facts are
    // serialized anew per quote; funding, triggers and new marks stay local.
    const markKey=marks.length?JSON.stringify([techState,marks]):null;
    let markQuotes=markKey===null?null:researchMarkQuotes.get(markKey);
    if(markKey!==null&&!markQuotes){if(researchMarkQuotes.size>=64)researchMarkQuotes.delete(researchMarkQuotes.keys().next().value);markQuotes=new Map();researchMarkQuotes.set(markKey,markQuotes);}
    const markGain=(id,prior)=>{
      if(!markQuotes)return 0;const key=JSON.stringify([prior,id]);if(markQuotes.has(key))return markQuotes.get(key);
      const before=prior?add(techState,prior):techState,gain=value(add(before,id))-value(before);markQuotes.set(key,gain);return gain;
    };
    const newMark=ids=>opportunity&&(opportunity.incomeUsed||opportunity.availableData+triggered.outcome(ids).dataGain<opportunity.neededData)
      &&opportunity.currentScore+ids.reduce((n,id)=>n+(opportunity.scoreGains[id]||0),0)>=opportunity.threshold?opportunity.currentValue:0;
    return(id,prior=null,currentFunded=true)=>{
      const key=JSON.stringify([prior,id,currentFunded]);
      if(quotes.has(key))return quotes.get(key);
      const gain=arithmetic.sum([markGain(id,prior),triggered(id,prior),
        currentFunded?newMark(prior?[prior,id]:[id])-newMark(prior?[prior]:[]):0],weights);
      quotes.set(key,gain);return gain;
    };
  }
  function cardResearchOptions(card, targets, round, weights, funding = null, markerGain = () => 0) {
    if (round >= 4) return [];
    const research = supportedResearch(card);
    if (!research) return [];
    // This forecast covers unconditional research with the ordinary reward.
    // Conditional cards remain legal native plans; their future prerequisites
    // and altered rewards are not proven by the held-card capital model.
    const types = research.options.techTypes || techCatalog.TECH_TYPES;
    const cost = cardEffects.getCardPlayCost(card);
    if (Object.keys(cost).some(key => !['credits', 'energy'].includes(key))) throw new TypeError('VALUE_HELD_COST_UNSUPPORTED');
    // An abstract query without a wallet remains the unconstrained quote used
    // by default-model upper bounds. Production values always supply funding.
    let windows = [{ round, payment: Object.entries(cost).reduce((n, [key, amount]) => n + amount * weights[key], 0) }];
    if (funding) {
      const credits = number(funding.resources.credits, 'heldFunding.credits'), energy = number(funding.resources.energy, 'heldFunding.energy');
      const creditIncome = number(funding.income.credits, 'heldFunding.income.credits'), energyIncome = number(funding.income.energy, 'heldFunding.income.energy');
      windows = [];
      for (let at = round; at < 4; at++) {
        const payments = (funding.startingIncome || 0) + at - round;
        const payment = probeCapital.funding({ credits: credits + payments * creditIncome, energy: energy + payments * energyIncome }, cost, weights);
        if (payment) {
          windows.push({ round: at, payment: payment.value });
          // Later technology capability cannot increase. Once payment reaches
          // the unconstrained2-to1 exchange minimum, later windows are dominated.
          const minimum=(cost.credits||0)*Math.min(weights.credits,2*weights.energy)+(cost.energy||0)*Math.min(weights.energy,2*weights.credits);
          if(payment.value===minimum)break;
        }
      }
    }
    // Only already-known currency income can advance the payment round. No
    // guessed blind card, future reward or fabricated successor funds the card.
    if(!windows.length)return[];
    return targets.filter(t => types.includes(t.type)).flatMap(t => {
      const choices=windows.map(period=>{
        const baseValue=t.capabilityByRound[period.round]+t.first+t.bonusValue-period.payment-weights.handSize;
        const currentFunded=period.round===round&&!(funding?.startingIncome||0);
        return{id:t.id,baseValue,currentFunded,value:Math.max(0,baseValue+markerGain(t.id,null,currentFunded))};
      }).sort((a,b)=>b.value-a.value||b.baseValue-a.baseValue);
      return choices;
    });
  }
  function knownCardCapital(card, techState, supply, round, weights = DEFAULT_WEIGHTS, funding = null) {
    if (round >= 4 || !supportedResearch(card)) return 0;
    return Math.max(0, ...cardResearchOptions(card, researchTargets(techState, supply, round, weights), round, weights, funding, researchPurposeGains(techState,funding,weights)).map(o => o.value));
  }
  function handOptions(hand, targets, round, weights, funding = null, markerGain = () => 0) {
    const byTarget = new Map();
    for (const card of hand) for (const option of cardResearchOptions(card, targets, round, weights, funding, markerGain)) {
      const key=JSON.stringify([option.id,option.currentFunded]);
      if(!byTarget.has(key)||option.value>byTarget.get(key).value)byTarget.set(key,option);
    }
    return [...byTarget.values()];
  }
  function handCapital(hand, techState, supply, round, weights = DEFAULT_WEIGHTS, funding = null) {
    if (round >= 4 || !hand.length) return 0;
    const eligible = hand.filter(supportedResearch);
    if (!eligible.length) return 0;
    return Math.max(0, ...handOptions(eligible, researchTargets(techState, supply, round, weights), round, weights, funding, researchPurposeGains(techState,funding,weights)).map(o => o.value));
  }
  function researchCapital({ hand, techState, supply, round, publicity, researchCost, passed = false, funding = null }, weights = DEFAULT_WEIGHTS) {
    const planningRound = round + Number(passed);
    if (planningRound >= 4 || !Object.keys(supply?.stacks || {}).length) return 0;
    number(researchCost, "player.researchPublicityCost");
    if (!Number.isSafeInteger(researchCost) || researchCost < 0) throw new TypeError("VALUE_RESEARCH_COST_INVALID");
    if (publicity < researchCost) return 0;
    const targets = researchTargets(techState, supply, planningRound, weights);
    const markerGain=researchPurposeGains(techState,funding,weights);
    const held = handOptions(hand, targets, planningRound, weights, funding, markerGain);
    const currentHand = Math.max(0, ...held.map(o => o.value));
    const paidGain=funding?.researchTriggers?.available?researchPurposeGains(techState,funding,weights,researchCost):markerGain;
    return Math.max(0, ...targets.map(t => t.capability + t.first + t.bonusValue + paidGain(t.id) - researchCost * weights.publicity
      + Math.max(0, ...held.filter(o => o.id !== t.id).map(o => o.baseValue+paidGain(o.id,t.id,o.currentFunded))) - currentHand));
  }
  function researchCapitalCeiling({ techState, supply, round, researchCost }, weights = DEFAULT_WEIGHTS) {
    if (round >= 4) return 0;
    return Math.max(0, ...researchTargets(techState, supply, round, weights)
      .map(t => t.capability + t.first + t.bonusValue - researchCost * weights.publicity));
  }

  function probePotential(observation, seatId, weights = DEFAULT_WEIGHTS) {
    const pub=observation.publicState,player=pub.players.find(p=>p.playerId===seatId);
    return basePurposeCapital({...probeCapital.factsFromObservation(observation,seatId),
      supply:pub.board.techSupply,researchCost:player.researchPublicityCost,analyzeEnergyCost:readyAnalysis.energyCost(player.industryAbilityId),
      reservedCards:observation.selfState.reservedCards},weights).probePotential;
  }

  function investmentFor(facts,weights) {
    const player=facts.player,round=facts.round,passing=facts.passing,supply=facts.supply;
    return(hand,publicity,funding)=>{
      // Neither held nor paid research can consume this wallet. Preserve the
      // original validation path for missing/non-finite funding inputs.
      if(Number.isFinite(publicity)&&Number.isFinite(funding?.resources?.availableData)
        &&Number.isSafeInteger(facts.researchCost)&&facts.researchCost>=0
        &&publicity<facts.researchCost&&!hand.some(supportedResearch))return 0;
      funding=researchFunding(facts,funding,publicity);
      return handCapital(hand,player.techState,supply,round+Number(passing),weights,funding)
        +researchCapital({hand,techState:player.techState,supply,round,publicity,researchCost:facts.researchCost,passed:passing,funding},weights);
    };
  }
  function dataInvestmentFor(facts,weights){
    const investment=investmentFor(facts,weights);
    return(hand,publicity,funding,progress={})=>arithmetic.sum([investment(hand,publicity,funding),readyAnalysis.prepaidCapital({
      ...facts,...progress,player:{...facts.player,...funding.resources,publicity,income:funding.income},
      board:progress.traceSlots?{...facts.board,aliens:{slots:progress.traceSlots}}:facts.board},weights)],weights);
  }
  const NO_INCOME_ALLOCATION=Object.freeze({total:0,knownSwapPlan:null});
  function incomeAllocationCapital(facts,weights=DEFAULT_WEIGHTS) {
    if(!facts.blueSlots?.some(b=>b.slot<=2&&["blue1","blue2","blue4"].includes(b.tileId)))return NO_INCOME_ALLOCATION;
    const investment=dataInvestmentFor(facts,weights),funding={resources:facts.player,income:facts.player.income,startingIncome:Number(facts.passing)};
    const base=investment(facts.hand,facts.player.publicity,funding);
    return researchIncome.incomeOptions({facts,investment,baseCapital:base},weights);
  }
  function incomePreparationCapital(facts,weights=DEFAULT_WEIGHTS) {
    const allocation=incomeAllocationCapital(facts,weights);
    if(allocation.total)return allocation.total;
    return dataInvestmentFor(facts,weights)(facts.hand,facts.player.publicity,{resources:facts.player,income:facts.player.income,startingIncome:Number(facts.passing)});
  }
  function basePurposeCapital(facts, weights) {
    const player=facts.player,round=facts.round,passing=facts.passing,supply=facts.supply;
    const investment=dataInvestmentFor(facts,weights),computer=readyAnalysis.prepaidCapital(facts,weights);
    const funding=researchFunding(facts,{resources:player,income:player.income,startingIncome:Number(passing)});
    const held=handCapital(facts.hand,player.techState,supply,round+Number(passing),weights,funding);
    const paid=researchCapital({hand:facts.hand,techState:player.techState,supply,round,publicity:player.publicity,researchCost:facts.researchCost,passed:passing,funding},weights);
    const mission=probeCapital.quote({...facts,investment,
      dataContinuation:context=>researchIncome.missionDataContinuation({...context,facts,investment:context.traceSlots?dataInvestmentFor({...facts,board:{...facts.board,aliens:{slots:context.traceSlots}}},weights):investment},weights)},weights).value;
    const finalMarkPotential=probeCapital.pendingFinalMarkCapital(facts);
    return{handPotential:held,researchPotential:paid,probePotential:mission,computerPotential:computer,finalMarkPotential,total:arithmetic.sum([held,paid,mission,computer,finalMarkPotential],weights)};
  }
  function capitalWithoutSector(facts, weights = DEFAULT_WEIGHTS) {
    const base=basePurposeCapital(facts,weights),portfolio=next=>basePurposeCapital(next,weights).total;
    const analysisPortfolio=(wallet,slots,progress={})=>{
      const {aliens,ordinaryDrawCount,...updates}=progress;
      return portfolio({...facts,...updates,player:wallet,board:{...facts.board,
        ...(ordinaryDrawCount===undefined?{}:{ordinaryDrawCount}),aliens:aliens||{...facts.board.aliens,slots}}});
    };
    // This base portfolio observes ordinary held cards only as income sources.
    // Preserve every research card identity and every different income vector.
    analysisPortfolio.incomeRemovalClass=card=>supportedResearch(card)?null:'ordinary-income';
    const analysis=readyAnalysis.quote(facts,weights,analysisPortfolio,base.total);
    const income=researchIncome.quote(facts,weights,portfolio,base.total,technologyCapital);
    const current=arithmetic.sum([base.total,analysis.value,income.value],weights),dataPlan=incomeAllocationCapital(facts,weights),dataPotential=arithmetic.normalize(Math.max(0,dataPlan.total-current),weights);
    return{...base,analysisPotential:arithmetic.sum([base.computerPotential,analysis.value],weights),analysisPlan:analysis,researchIncomePotential:income.value,researchIncomePlan:income,dataPotential,dataPlan,total:arithmetic.sum([current,dataPotential],weights)};
  }
  function purposeCapitalWithoutSymbols(facts, weights = DEFAULT_WEIGHTS) {
    const base=capitalWithoutSector(facts,weights),sector=sectorCard.quote(facts,weights,next=>capitalWithoutSector(next,weights).total,base.total);
    return{...base,handPotential:arithmetic.sum([base.handPotential,sector.value],weights),sectorCardPlan:sector,total:arithmetic.sum([base.total,sector.value],weights)};
  }

  function purposeCapitalWithoutTools(facts, weights = DEFAULT_WEIGHTS) {
    const base=purposeCapitalWithoutSymbols(facts,weights),symbol=symbolCard.quote(facts,weights,next=>purposeCapitalWithoutSymbols(next,weights).total,base.total);
    return{...base,handPotential:arithmetic.sum([base.handPotential,symbol.value],weights),symbolCardPlan:symbol,total:arithmetic.sum([base.total,symbol.value],weights)};
  }

  function purposeCapital(facts, weights = DEFAULT_WEIGHTS) {
    const base=purposeCapitalWithoutTools(facts,weights),tool=movementTool.quote(facts,weights,next=>purposeCapitalWithoutTools(next,weights).total);
    return {...base,handPotential:arithmetic.sum([base.handPotential,tool.value],weights),toolPlan:tool,
      total:arithmetic.sum([base.total,tool.value],weights)};
  }

  function evaluateStateValue(observation, seatId, options = {}) {
    const player = observation?.publicState?.players?.find(player => player.playerId === seatId);
    if (!player) throw new TypeError(`VALUE_PLAYER_MISSING: ${seatId}`);
    if (observation.selfState?.playerId !== seatId) throw new TypeError("VALUE_VIEWER_MISMATCH");
    if (!Array.isArray(observation.selfState.hand)) throw new TypeError("VALUE_HAND_MISSING");
    const terminal = observation.terminal ?? observation.outcomeProjection?.terminal;
    if (typeof terminal !== "boolean") throw new TypeError("VALUE_TERMINAL_MISSING");
    const realizedScore = number(player.score, "player.score");
    const currentTotal = number(player.finalScore, "player.finalScore");
    if (terminal) return Object.freeze({ modelVersion: MODEL_VERSION, total: currentTotal, purposePreparationDebt:0,
      components: Object.freeze({ realizedScore, currentEndGameBonus: currentTotal - realizedScore,
        resources: 0, hand: 0, income: 0, technologyPotential: 0, handPotential: 0, researchPotential: 0, probePotential: 0, analysisPotential: 0, researchIncomePotential: 0, dataPotential: 0, finalMarkPotential:0 }), terminal: true });

    const weights = valueWeights(options);
    const round = number(observation.publicState.roundNumber, "roundNumber");
    if (!Number.isInteger(round) || round < 1 || round > 4) throw new TypeError("VALUE_ROUND_INVALID");
    if (!Array.isArray(observation.publicState.passingPlayerIds)) throw new TypeError("VALUE_PASSING_PLAYERS_MISSING");
    const passing = observation.publicState.passingPlayerIds.includes(seatId);
    if (!player.income || typeof player.income !== "object") throw new TypeError("VALUE_INCOME_MISSING");
    let resources = 0;
    let income = 0;
    for (const key of Object.keys(weights)) {
      if (key !== "handSize") resources += number(player[key], `player.${key}`) * weights[key];
      // 正式轮初收入发生于第2/3/4轮；插收入的立即奖励已进入当前资源，不能重复加。
      income += number(player.income[key], `income.${key}`) * weights[key] * (4 - round);
    }
    const hand = observation.selfState.hand.length * weights.handSize;
    const facts={...probeCapital.factsFromObservation(observation,seatId),supply:observation.publicState.board?.techSupply,
      researchCost:player.researchPublicityCost,computerSlots:player.dataProgress?.computerSlots,
      analyzeEnergyCost:readyAnalysis.energyCost(player.industryAbilityId),reservedCards:observation.selfState.reservedCards};
    const capital=purposeCapital(facts,weights);
    const components = Object.freeze({ realizedScore, currentEndGameBonus: currentTotal - realizedScore,
      resources, hand, income, technologyPotential: technologyCapital(player.techState, round, weights),
      handPotential:capital.handPotential,researchPotential:capital.researchPotential,
      probePotential:capital.probePotential,analysisPotential:capital.analysisPotential,researchIncomePotential:capital.researchIncomePotential,dataPotential:capital.dataPotential,finalMarkPotential:capital.finalMarkPotential });
    const total = arithmetic.sum(Object.values(components),weights);
    number(total, "total");
    return Object.freeze({ modelVersion: MODEL_VERSION, total, components, terminal: false,
      purposePreparationDebt:capital.toolPlan.value>0?capital.toolPlan.selected.preparationDebt:0 });
  }

  function createStateValueEvaluator(seatId, options = {}) {
    if (typeof seatId !== "string" || !seatId) throw new TypeError("VALUE_VIEWER_INVALID");
    const weights = Object.freeze(valueWeights(options));
    trustedWeights.add(weights);
    const details = observation => {
      const result = evaluateStateValue(observation, seatId, { weights }), c = result.components;
      return Object.freeze({ value: result.total, purposePreparationDebt:result.purposePreparationDebt, unrealizedPurposeValue: arithmetic.sum([
        c.handPotential,c.researchPotential,c.probePotential,c.analysisPotential,c.researchIncomePotential,c.dataPotential,c.finalMarkPotential],weights) });
    };
    const evaluate = observation => details(observation).value;
    Object.defineProperties(evaluate, {
      modelKey: { value: JSON.stringify({ version: MODEL_VERSION, seatId, weights }) },
      seatId: { value: seatId },
      details: { value: details },
    });
    evaluatorWeights.set(evaluate, weights);
    return Object.freeze(evaluate);
  }

  function evaluateHandCountDelta(evaluate, observation, delta) {
    if (!evaluatorWeights.has(evaluate)) throw new TypeError("VALUE_EVALUATOR_UNKNOWN");
    if (![-1, 1].includes(delta)) throw new TypeError("VALUE_HAND_DELTA_INVALID");
    if ((observation?.terminal ?? observation?.outcomeProjection?.terminal) !== false) {
      throw new TypeError("VALUE_BOUND_NONTERMINAL_REQUIRED");
    }
    if (!Array.isArray(observation.selfState?.hand)) throw new TypeError("VALUE_HAND_MISSING");
    const hand = observation.selfState.hand.slice();
    if (delta === -1 && !hand.length) throw new TypeError("VALUE_HAND_DELTA_INVALID");
    if (delta === -1) hand.pop();
    else hand.push({ hidden: true });
    // 仅计算数值界，不是规则后继。重算相同求和顺序，避免 base+delta 的浮点误差低估上界。
    return evaluate({ ...observation, selfState: { ...observation.selfState, hand } });
  }

  return Object.freeze({ MODEL_VERSION, DEFAULT_WEIGHTS, FORECAST, valueScale:arithmetic.scale, normalizeValue:arithmetic.normalize, sumValueParts:arithmetic.sum, technologyCapital, knownCardCapital, handCapital, researchFunding, researchCapital, researchCapitalCeiling, probePotential, purposeCapital, incomePreparationCapital, incomeAllocationCapital, prepaidComputerCapital:readyAnalysis.prepaidCapital, hasKnownSectorTool:cards=>cards.some(card=>sectorCard.supported(card)), hasKnownMovementTool:cards=>cards.some(movementTool.supported), readyAnalysisUpperBound:(slots,progress)=>readyAnalysis.upperBound(slots,DEFAULT_WEIGHTS,progress),
    researchIncomeUpperBound:facts=>researchIncome.upperBound(facts,DEFAULT_WEIGHTS,technologyCapital),
    supportsLegacyValueProof: observation => observation.publicState.roundNumber === 4, evaluateStateValue, createStateValueEvaluator,
    evaluateHandCountDelta, isStateValueEvaluator: evaluate => evaluatorWeights.has(evaluate),
    isDefaultStateValueEvaluator: evaluate => {
      const weights = evaluatorWeights.get(evaluate);
      return Boolean(weights && Object.keys(DEFAULT_WEIGHTS).every(key => weights[key] === DEFAULT_WEIGHTS[key]));
    },
    isMoneyMonotoneEvaluator: evaluate => {
      const weights = evaluatorWeights.get(evaluate);
      return Boolean(weights && weights.credits > 0 && weights.energy > 0);
    } });
});
