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
    common ? require("./sector-card-capital") : root.SetiSectorCardCapital);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SetiStateValue = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (cardEffects, dataPlacement, techCatalog, planetAbility, scanEffects, probeCapital, readyAnalysis, researchIncome, sectorCard) {
  "use strict";

  const MODEL_VERSION = "seti-purpose-capital-state-value-v17";
  // 首版比较刻度，属于估值假设，不是规则兑换率或可用于证明剪枝的收益上界。
  const DEFAULT_WEIGHTS = Object.freeze({
    credits: 1, energy: 1, publicity: 0.5, availableData: 0.5, additionalPublicScan: 0.5, handSize: 1,
  });
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
  function cardResearchOptions(card, targets, round, weights, funding = null) {
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
    return targets.filter(t => types.includes(t.type)).map(t => ({ id: t.id,
      value: Math.max(0, ...windows.map(period => t.capabilityByRound[period.round] + t.first + t.bonusValue - period.payment - weights.handSize)) }));
  }
  function knownCardCapital(card, techState, supply, round, weights = DEFAULT_WEIGHTS, funding = null) {
    if (round >= 4 || !supportedResearch(card)) return 0;
    return Math.max(0, ...cardResearchOptions(card, researchTargets(techState, supply, round, weights), round, weights, funding).map(o => o.value));
  }
  function handOptions(hand, targets, round, weights, funding = null) {
    const byTarget = new Map();
    for (const card of hand) for (const option of cardResearchOptions(card, targets, round, weights, funding)) {
      byTarget.set(option.id, Math.max(byTarget.get(option.id) || 0, option.value));
    }
    return [...byTarget].map(([id, value]) => ({ id, value }));
  }
  function handCapital(hand, techState, supply, round, weights = DEFAULT_WEIGHTS, funding = null) {
    if (round >= 4 || !hand.length) return 0;
    const eligible = hand.filter(supportedResearch);
    if (!eligible.length) return 0;
    return Math.max(0, ...handOptions(eligible, researchTargets(techState, supply, round, weights), round, weights, funding).map(o => o.value));
  }
  function researchCapital({ hand, techState, supply, round, publicity, researchCost, passed = false, funding = null }, weights = DEFAULT_WEIGHTS) {
    const planningRound = round + Number(passed);
    if (planningRound >= 4 || !Object.keys(supply?.stacks || {}).length) return 0;
    number(researchCost, "player.researchPublicityCost");
    if (!Number.isSafeInteger(researchCost) || researchCost < 0) throw new TypeError("VALUE_RESEARCH_COST_INVALID");
    if (publicity < researchCost) return 0;
    const targets = researchTargets(techState, supply, planningRound, weights);
    const held = handOptions(hand, targets, planningRound, weights, funding);
    const currentHand = Math.max(0, ...held.map(o => o.value));
    return Math.max(0, ...targets.map(t => t.capability + t.first + t.bonusValue - researchCost * weights.publicity
      + Math.max(0, ...held.filter(o => o.id !== t.id).map(o => o.value)) - currentHand));
  }
  function researchCapitalCeiling({ techState, supply, round, researchCost }, weights = DEFAULT_WEIGHTS) {
    if (round >= 4) return 0;
    return Math.max(0, ...researchTargets(techState, supply, round, weights)
      .map(t => t.capability + t.first + t.bonusValue - researchCost * weights.publicity));
  }

  function probePotential(observation, seatId, weights = DEFAULT_WEIGHTS) {
    const pub=observation.publicState,player=pub.players.find(p=>p.playerId===seatId);
    return basePurposeCapital({...probeCapital.factsFromObservation(observation,seatId),
      supply:pub.board.techSupply,researchCost:player.researchPublicityCost,
      reservedCards:observation.selfState.reservedCards},weights).probePotential;
  }

  function investmentFor(facts,weights) {
    const player=facts.player,round=facts.round,passing=facts.passing,supply=facts.supply;
    return(hand,publicity,funding)=>handCapital(hand,player.techState,supply,round+Number(passing),weights,funding)
      +researchCapital({hand,techState:player.techState,supply,round,publicity,researchCost:facts.researchCost,passed:passing,funding},weights);
  }
  const NO_INCOME_ALLOCATION=Object.freeze({total:0,knownSwapPlan:null});
  function incomeAllocationCapital(facts,weights=DEFAULT_WEIGHTS) {
    if(!facts.blueSlots?.some(b=>b.slot<=2&&["blue1","blue2","blue4"].includes(b.tileId)))return NO_INCOME_ALLOCATION;
    const investment=investmentFor(facts,weights),funding={resources:facts.player,income:facts.player.income,startingIncome:Number(facts.passing)};
    const base=investment(facts.hand,facts.player.publicity,funding);
    return researchIncome.incomeOptions({facts,investment,baseCapital:base},weights);
  }
  function incomePreparationCapital(facts,weights=DEFAULT_WEIGHTS) {
    const allocation=incomeAllocationCapital(facts,weights);
    if(allocation.total)return allocation.total;
    return investmentFor(facts,weights)(facts.hand,facts.player.publicity,{resources:facts.player,income:facts.player.income,startingIncome:Number(facts.passing)});
  }
  function basePurposeCapital(facts, weights) {
    const player=facts.player,round=facts.round,passing=facts.passing,supply=facts.supply;
    const investment=investmentFor(facts,weights);
    const funding={resources:player,income:player.income,startingIncome:Number(passing)};
    const held=handCapital(facts.hand,player.techState,supply,round+Number(passing),weights,funding);
    const paid=researchCapital({hand:facts.hand,techState:player.techState,supply,round,publicity:player.publicity,researchCost:facts.researchCost,passed:passing,funding},weights);
    const mission=probeCapital.quote({...facts,investment,
      dataContinuation:context=>researchIncome.missionDataContinuation({...context,facts,investment},weights)},weights).value;
    return{handPotential:held,researchPotential:paid,probePotential:mission,total:held+paid+mission};
  }
  function capitalWithoutMission(facts,weights){
    const investment=investmentFor(facts,weights),base=investment(facts.hand,facts.player.publicity,{resources:facts.player,income:facts.player.income,startingIncome:Number(facts.passing)});
    const analysis=readyAnalysis.quote(facts,weights,(wallet,slots,progress={})=>investmentFor({...facts,...progress,player:wallet,board:{...facts.board,aliens:{slots}}},weights)(facts.hand,wallet.publicity,{resources:wallet,income:wallet.income,startingIncome:Number(facts.passing)}),base);
    return base+analysis.value;
  }
  function purposeCapital(facts, weights = DEFAULT_WEIGHTS) {
    const base=basePurposeCapital(facts,weights),portfolio=next=>basePurposeCapital(next,weights).total;
    const analysis=readyAnalysis.quote(facts,weights,(wallet,slots,progress={})=>portfolio({...facts,...progress,player:wallet,board:{...facts.board,aliens:{slots}}}),base.total);
    const income=researchIncome.quote(facts,weights,portfolio,base.total,technologyCapital);
    const current=base.total+analysis.value+income.value,dataPlan=incomeAllocationCapital(facts,weights),dataPotential=Math.max(0,dataPlan.total-current);
    const sector=sectorCard.quote(facts,weights,next=>capitalWithoutMission(next,weights),current+dataPotential);
    return{...base,handPotential:base.handPotential+sector.value,sectorCardPlan:sector,analysisPotential:analysis.value,analysisPlan:analysis,researchIncomePotential:income.value,researchIncomePlan:income,dataPotential,dataPlan,total:current+dataPotential+sector.value};
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
    if (terminal) return Object.freeze({ modelVersion: MODEL_VERSION, total: currentTotal,
      components: Object.freeze({ realizedScore, currentEndGameBonus: currentTotal - realizedScore,
        resources: 0, hand: 0, income: 0, technologyPotential: 0, handPotential: 0, researchPotential: 0, probePotential: 0, analysisPotential: 0, researchIncomePotential: 0, dataPotential: 0 }), terminal: true });

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
      probePotential:capital.probePotential,analysisPotential:capital.analysisPotential,researchIncomePotential:capital.researchIncomePotential,dataPotential:capital.dataPotential });
    const total = Object.values(components).reduce((sum, value) => sum + value, 0);
    number(total, "total");
    return Object.freeze({ modelVersion: MODEL_VERSION, total, components, terminal: false });
  }

  function createStateValueEvaluator(seatId, options = {}) {
    if (typeof seatId !== "string" || !seatId) throw new TypeError("VALUE_VIEWER_INVALID");
    const weights = Object.freeze(valueWeights(options));
    trustedWeights.add(weights);
    const evaluate = observation => evaluateStateValue(observation, seatId, { weights }).total;
    Object.defineProperties(evaluate, {
      modelKey: { value: JSON.stringify({ version: MODEL_VERSION, seatId, weights }) },
      seatId: { value: seatId },
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

  return Object.freeze({ MODEL_VERSION, DEFAULT_WEIGHTS, FORECAST, technologyCapital, knownCardCapital, handCapital, researchCapital, researchCapitalCeiling, probePotential, purposeCapital, incomePreparationCapital, incomeAllocationCapital, hasKnownSectorTool:cards=>cards.some(card=>sectorCard.supported(card)), readyAnalysisUpperBound:(slots,progress)=>readyAnalysis.upperBound(slots,DEFAULT_WEIGHTS,progress),
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
