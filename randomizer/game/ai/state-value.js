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
    common ? require("./known-symbol-capital") : root.SetiKnownSymbolCapital,
    common ? require("../cards/deck") : root.SetiCards,
    common ? require("./research-symbol-capital") : root.SetiResearchSymbolCapital,
    common ? require("./analysis-publicity-capital") : root.SetiAnalysisPublicityCapital);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SetiStateValue = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (cardEffects, dataPlacement, techCatalog, planetAbility, scanEffects, probeCapital, readyAnalysis, researchIncome, sectorCard, arithmetic, movementTool, endScoring, researchTriggers, symbolCard, cards, researchSymbol, publicityPreparation) {
  "use strict";

  const MODEL_VERSION = "seti-purpose-capital-state-value-v70";
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
    // Formal previews and observed states use the same canonical default
    // value domain. A numerically identical private copy must not disable
    // the default-only known-landing and read-only investment contracts.
    return arithmetic.isDefault(weights) ? DEFAULT_WEIGHTS : weights;
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
    const completionMarks=trigger.completionGroups?.length?opportunity.options.filter(o=>o.formulaId==='c1').map(o=>({currentValue:o.currentValue,multiplier:o.multiplier})):[];
    return score+2*Math.max(0,...Object.values(scores))+(trigger.maximumScoreGain||0)>=opportunity.threshold&&(currentValue>0||completionMarks.length)
      ?{currentScore:score,threshold:opportunity.threshold,currentValue,completionMarks,scoreGains:scores,availableData:funding.resources.availableData,neededData:needed,incomeUsed:facts.computerSlots.includes(4)}:null;
  }
  const derivedResearchFunding = new WeakMap(), orderedResearchQuotes = new Map();
  const researchTileIndices = new Map(techCatalog.TECH_TILE_IDS.map((id, index) => [id, index + 1]));
  const researchTileStride = researchTileIndices.size + 1;
  const __researchQuoteWork = {hits:0, misses:0, contexts:0, factories:0, symbolPartBuilds:0, symbolPartHits:0, symbolKeyFallbacks:0};
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
  function internalResearchFunding(facts, funding, publicity = funding?.resources?.publicity) {
    const derived=researchFunding(facts,funding,publicity);
    const o=derived.newFinalMark, marks=derived.researchMarks||[], owned=facts.player.techState?.ownedTiles;
    if(marks.every(m=>["d1","d2"].includes(m.formulaId)&&Number.isFinite(m.multiplier))
      &&(!o||[o.currentScore,o.threshold,o.currentValue,o.availableData,o.neededData,...Object.values(o.scoreGains)]
        .every(Number.isFinite)&&typeof o.incomeUsed==="boolean"
        &&o.completionMarks.every(m=>Number.isFinite(m.currentValue)&&Number.isFinite(m.multiplier)))) {
      // Capture only actual boolean ownership of the named native tile set.
      // Missing and false are identical for the native d1/d2 count formula.
      let mask=0;
      if(owned&&(Object.getPrototypeOf(owned)===Object.prototype||Object.getPrototypeOf(owned)===null)){
        for(const id of Object.keys(owned)){
          const index=researchTileIndices.get(id),desc=Object.getOwnPropertyDescriptor(owned,id);
          if(index===undefined||typeof desc.value!=="boolean"){mask=-1;break;}
          if(desc.value)mask|=1<<(index-1);
        }
        if(mask>=0)derivedResearchFunding.set(derived,{owned,mask});
      }
    }
    return derived;
  }
  const researchMarkQuotes=new Map();
  const researchSymbolBytes=new WeakMap();
  function immutableSymbolPart(value,active){
    if(value==null||["string","number","boolean"].includes(typeof value))return true;
    if(typeof value!=="object"||!Object.isFrozen(value)||active.has(value)
      ||Object.hasOwn(value,"toJSON")||Object.getPrototypeOf(value)!==Object.prototype)return false;
    if(researchSymbolBytes.has(value))return true;
    active.add(value);
    for(const key of Object.keys(value)){
      const d=Object.getOwnPropertyDescriptor(value,key);
      if(!Object.hasOwn(d,"value")||!immutableSymbolPart(d.value,active)){active.delete(value);return false;}
    }
    active.delete(value);return true;
  }
  function symbolPartKey(value){
    if(!value||typeof value!=="object")return null;
    let json=researchSymbolBytes.get(value);
    if(json!==undefined){__researchQuoteWork.symbolPartHits++;return json;}
    if(!immutableSymbolPart(value,new Set()))return null;
    json=JSON.stringify(value);researchSymbolBytes.set(value,json);__researchQuoteWork.symbolPartBuilds++;
    return json;
  }
  const researchLayoutTokens=new Map();let nextResearchLayoutToken=0;
  function researchLayoutToken(slots,entries){
    let byEntries=researchLayoutTokens.get(slots);
    if(!byEntries){
      if(researchLayoutTokens.size>=16)researchLayoutTokens.delete(researchLayoutTokens.keys().next().value);
      byEntries=new Map();researchLayoutTokens.set(slots,byEntries);
    }
    if(byEntries.has(entries))return byEntries.get(entries);
    if(byEntries.size>=16)byEntries.delete(byEntries.keys().next().value);
    const token=++nextResearchLayoutToken;
    byEntries.set(entries,token);return token;
  }
  const researchLayoutPairs=new WeakMap();
  const RESEARCH_SYMBOL_FIELDS=["revealInitialized","revealedSlotId","symbolSlots","symbolsById"];
  function hasResearchSymbolFields(symbols) {
    for(const field of RESEARCH_SYMBOL_FIELDS){
      const d=Object.getOwnPropertyDescriptor(symbols,field);
      if(d?.enumerable!==true||!Object.hasOwn(d,"value"))return false;
    }
    return true;
  }
  function researchLayoutForPair(slots,entries){
    const pair=researchLayoutPairs.get(slots);
    if(pair&&pair.entries===entries)return pair.token;
    const slotBytes=symbolPartKey(slots),entryBytes=symbolPartKey(entries);
    if(slotBytes===null||entryBytes===null)return null;
    const token=researchLayoutToken(slotBytes,entryBytes);
    // Both complete maps were recursively proved immutable. A re-interned
    // byte layout may get a new token; an old token is never reassigned.
    researchLayoutPairs.set(slots,{entries,token});
    return token;
  }
  function orderedResearchSignature(mask,marks,opportunity,trigger,paidPublicity,paymentAfterFirst){
    const symbols=trigger?.symbols;
    if(symbols && symbols.revealInitialized===true && Number.isSafeInteger(symbols.revealedSlotId)
      && Object.keys(symbols).length===4 && Object.keys(trigger).length===8
      && !Object.hasOwn(symbols,"toJSON")
      && (Object.getPrototypeOf(symbols)===Object.prototype||Object.getPrototypeOf(symbols)===null)
      && hasResearchSymbolFields(symbols)){
      const token=researchLayoutForPair(symbols.symbolSlots,symbols.symbolsById);
      if(token!==null){
        // Preserve the complete dynamic funding, payment and trigger facts.
        return "layout:"+JSON.stringify([mask,marks,opportunity??null,paidPublicity,paymentAfterFirst,trigger.available,
          trigger.rules,trigger.completionGroups,trigger.maximumScoreGain,trigger.maximumSingleScoreGain,trigger.wallet,
          trigger.reason,symbols.revealInitialized,symbols.revealedSlotId,token]);
      }
    }
    __researchQuoteWork.symbolKeyFallbacks++;
    return JSON.stringify([mask,marks,opportunity??null,trigger??null,paidPublicity,paymentAfterFirst]);
  }
  function researchPurposeGains(techState, funding, weights, paidPublicity=0,makePreparedGain=null,paymentAfterFirst=false) {
    const marks=funding?.researchMarks||[],opportunity=funding?.newFinalMark;
    const makeTrigger = () => makePreparedGain?.() || researchTriggers.gains(funding?.researchTriggers,weights,paidPublicity,paymentAfterFirst);
    if(!marks.length&&!opportunity)return makeTrigger();
    const authority=derivedResearchFunding.get(funding);
    if(weights!==DEFAULT_WEIGHTS || !authority || authority.owned!==techState?.ownedTiles
      || !Number.isSafeInteger(paidPublicity) || paidPublicity<0) {
      return calculateResearchPurposeGains(techState,funding,weights,makeTrigger());
    }
    // These two native mark formulas read only ownedTiles; the rest of
    // the key is the exact existing trigger and first-mark input. Store
    // scalars only. Payment order and native tile order are independent.
    const key=orderedResearchSignature(authority.mask,marks,opportunity,funding.researchTriggers,paidPublicity,paymentAfterFirst);
    let quotes=orderedResearchQuotes.get(key);
    if(!quotes){
      if(orderedResearchQuotes.size>=256)orderedResearchQuotes.delete(orderedResearchQuotes.keys().next().value);
      quotes=new Map();orderedResearchQuotes.set(key,quotes);__researchQuoteWork.contexts++;
    }
    let evaluate;
    return (id,prior=null,currentFunded=true)=>{
      const first=prior===null?0:researchTileIndices.get(prior),next=researchTileIndices.get(id);
      if(first===undefined||next===undefined||typeof currentFunded!=="boolean"){
        evaluate??=calculateResearchPurposeGains(techState,funding,weights,makeTrigger());
        return evaluate(id,prior,currentFunded);
      }
      const pair=2*(first*researchTileStride+next)+Number(currentFunded);
      const hit=quotes.get(pair);
      if(hit!==undefined){__researchQuoteWork.hits++;return hit;}
      __researchQuoteWork.misses++;
      evaluate??=calculateResearchPurposeGains(techState,funding,weights,makeTrigger());
      const value=evaluate(id,prior,currentFunded);quotes.set(pair,value);return value;
    };
  }
  function calculateResearchPurposeGains(techState, funding, weights, triggered) {
    __researchQuoteWork.factories++;
    const marks=funding?.researchMarks||[],opportunity=funding?.newFinalMark;
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
    let singleScoreCeiling=null;
    if(opportunity){
      const context=funding?.researchTriggers,single=context?.available?context.maximumSingleScoreGain:0;
      if(Number.isFinite(single)&&single>=0&&(!context?.available||Array.isArray(context.rules)&&context.rules.length
        &&Number.isFinite(context.maximumScoreGain)&&context.maximumScoreGain>=0
        &&single*Math.min(2,context.rules.length)>=context.maximumScoreGain))singleScoreCeiling=single;
    }
    const newMark=ids=>{
      if(!opportunity)return 0;
      for(let count=1;count<=ids.length;count++){
        let prefixScore=0;for(let n=0;n<count;n++)prefixScore+=opportunity.scoreGains[ids[n]]||0;
        const score=opportunity.currentScore+prefixScore;
        // One supported color rule can claim at most one public symbol.
        // Strictly unreachable prefixes cannot choose a threshold mark.
        if(singleScoreCeiling!==null&&score+count*singleScoreCeiling<opportunity.threshold)continue;
        const key="mark-prefix:"+(count===1?ids[0]:ids.slice(0,count).join(":"));
        let award=quotes.get(key);
        if(award===undefined){
          const prefix=ids.slice(0,count),development=triggered.development(prefix);
          award=score+development.scoreGain<opportunity.threshold?null
            :!opportunity.incomeUsed&&opportunity.availableData+triggered.outcome(prefix).dataGain>=opportunity.neededData?0
            :Math.max(opportunity.currentValue,...(opportunity.completionMarks||[]).map(o=>o.currentValue+development.completedTaskGain*o.multiplier));
          quotes.set(key,award);
        }
        // Null has not crossed. Zero has crossed outside this value domain;
        // a later completion cannot replace that first mark or claim it again.
        if(award!==null)return award;
      }
      return 0;
    };
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
    if(windows.length===1){
      const period=windows[0],currentFunded=period.round===round&&!(funding?.startingIncome||0);
      return targets.filter(t=>types.includes(t.type)).map(t=>{
        const baseValue=t.capabilityByRound[period.round]+t.first+t.bonusValue-period.payment-weights.handSize;
        return{id:t.id,baseValue,currentFunded,value:Math.max(0,baseValue+markerGain(t.id,null,currentFunded))};
      });
    }
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
      const key=(option.currentFunded?"current:":"future:")+option.id;
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
    const hasHeld=hand.some(supportedResearch),hasTrigger=funding?.researchTriggers?.available;
    let prepared;
    const preparedTriggers=hasHeld&&hasTrigger?(...args)=>(prepared??=researchTriggers.prepareGains(funding.researchTriggers,weights))(...args):null;
    const markerGain=hasHeld||!hasTrigger?researchPurposeGains(techState,funding,weights,0,preparedTriggers?()=>preparedTriggers(0):null):null;
    const held = handOptions(hand, targets, planningRound, weights, funding, markerGain);
    const currentHand = Math.max(0, ...held.map(o => o.value));
    return paidResearchFromHeld(techState,targets,held,currentHand,markerGain,funding,researchCost,weights,preparedTriggers);
  }
  function paidResearchFromHeld(techState,targets,held,currentHand,markerGain,funding,researchCost,weights,preparedTriggers=null){
    const paidGain=funding?.researchTriggers?.available?researchPurposeGains(techState,funding,weights,researchCost,preparedTriggers?()=>preparedTriggers(researchCost):null):markerGain;
    const paidLast=funding?.researchTriggers?.available&&held.some(o=>o.currentFunded)
      ?researchPurposeGains(techState,funding,weights,researchCost,preparedTriggers?()=>preparedTriggers(researchCost,true):null,true):null;
    let value=0;
    for(const target of targets){
      const single=paidGain(target.id);let combined=single;
      for(const option of held){
        if(option.id===target.id)continue;
        combined=Math.max(combined,
          option.baseValue+single+paidGain(option.id,target.id,option.currentFunded),
          paidLast&&option.currentFunded?option.baseValue+paidLast(option.id)+paidLast(target.id,option.id):-Infinity);
      }
      value=Math.max(value,target.capability+target.first+target.bonusValue-researchCost*weights.publicity+combined-currentHand);
    }
    return value;
  }
  // The joint portfolio needs the same held-card options both as an asset and
  // as the opportunity cost of paid research. Build that local array once.
  function jointResearchCapital({hand,techState,supply,round,publicity,researchCost,passed=false,funding=null},weights){
    const planningRound=round+Number(passed);
    if(planningRound>=4||!Object.keys(supply?.stacks||{}).length)return{held:0,paid:0};
    number(researchCost,"player.researchPublicityCost");
    if(!Number.isSafeInteger(researchCost)||researchCost<0)throw new TypeError("VALUE_RESEARCH_COST_INVALID");
    const eligible=hand.filter(supportedResearch);
    if(publicity<researchCost&&!eligible.length)return{held:0,paid:0};
    const targets=researchTargets(techState,supply,planningRound,weights),hasTrigger=funding?.researchTriggers?.available;
    // An absent held research card has no held-side trigger quote. Prepare
    // shared input only when both the held and paid sides will consume it.
    let prepared;
    const preparedTriggers=eligible.length&&publicity>=researchCost&&hasTrigger
      ?(...args)=>(prepared??=researchTriggers.prepareGains(funding.researchTriggers,weights))(...args):null;
    const markerGain=eligible.length||!hasTrigger?researchPurposeGains(techState,funding,weights,0,preparedTriggers?()=>preparedTriggers(0):null):null;
    const options=handOptions(eligible,targets,planningRound,weights,funding,markerGain),held=Math.max(0,...options.map(o=>o.value));
    const paid=publicity<researchCost?0:paidResearchFromHeld(techState,targets,options,held,markerGain,funding,researchCost,weights,preparedTriggers);
    return{held,paid};
  }
  function researchCapitalCeiling({ techState, supply, round, researchCost }, weights = DEFAULT_WEIGHTS) {
    if (round >= 4) return 0;
    return Math.max(0, ...researchTargets(techState, supply, round, weights)
      .map(t => t.capability + t.first + t.bonusValue - researchCost * weights.publicity));
  }

  function probePotential(observation, seatId, weights = DEFAULT_WEIGHTS) {
    const pub=observation.publicState,player=pub.players.find(p=>p.playerId===seatId);
    return purposeCapital({...probeCapital.factsFromObservation(observation,seatId),
      supply:pub.board.techSupply,researchCost:player.researchPublicityCost,analyzeEnergyCost:readyAnalysis.energyCost(player.industryAbilityId),
      reservedCards:observation.selfState.reservedCards},weights).probePotential;
  }

  function investmentFor(facts,weights) {
    const player=facts.player,round=facts.round,passing=facts.passing,supply=facts.supply;
    let paidOnly;
    return(hand,publicity,funding)=>{
      // No held research means money/income cannot change the paid path.
      // For this one fixed portfolio, keep data, publicity, and whether the
      // wallet is still at the exact source score (the new-mark guard).
      const stock=funding?.resources?.availableData,cost=facts.researchCost;
      let key=-1;
      if(Number.isFinite(publicity)&&Number.isFinite(stock)&&Number.isSafeInteger(cost)&&cost>=0){
        if(publicity<cost){if(!hand.some(supportedResearch))return 0;}
        else if(weights===DEFAULT_WEIGHTS&&Number.isInteger(publicity)&&publicity>=0&&publicity<=10
          &&Number.isInteger(stock)&&stock>=0&&stock<=6&&Number.isFinite(player.score)
          &&!funding.researchMarks&&!funding.researchTriggers&&!hand.some(supportedResearch)){
          key=2*(7*publicity+stock)+Number(funding.resources.score===player.score);
          const hit=paidOnly?.[key];if(hit!==undefined)return hit;
        }
      }
      funding=internalResearchFunding(facts,funding,publicity);
      const joint=jointResearchCapital({hand,techState:player.techState,supply,round,publicity,researchCost:cost,passed:passing,funding},weights);
      const result=joint.held+joint.paid;
      if(key>=0)(paidOnly??=[])[key]=result;
      return result;
    };
  }
  function dataInvestmentFor(facts,weights,fixedPrepaid){
    const investment=investmentFor(facts,weights);
    return(hand,publicity,funding,progress={})=>{
      const research=investment(hand,publicity,funding);
      const score=Object.prototype.propertyIsEnumerable.call(funding.resources||{},"score")?funding.resources.score:facts.player.score;
      const changes=Object.keys(progress);
      // The typed mission changes only traces. Keep the already validated
      // computer and reservations; quote its actual replacement trace slots.
      const fixed=Number.isFinite(score)&&Number.isFinite(publicity)
        &&(!changes.length||changes.length===1&&changes[0]==="traceSlots");
      const prepaid=fixed?(fixedPrepaid??=readyAnalysis.preparePrepaidCapital(facts,weights))(score,publicity,progress.traceSlots)
        :readyAnalysis.prepaidCapital({...facts,...progress,player:{...facts.player,...funding.resources,publicity,income:funding.income},
          board:progress.traceSlots?{...facts.board,aliens:{slots:progress.traceSlots}}:facts.board},weights);
      return arithmetic.sum([research,prepaid],weights);
    };
  }
  const NO_INCOME_ALLOCATION=Object.freeze({total:0,knownSwapPlan:null});
  function incomeAllocationCapital(facts,weights=DEFAULT_WEIGHTS,initialInvestmentCapital) {
    if(!facts.blueSlots?.some(b=>b.slot<=2&&["blue1","blue2","blue4"].includes(b.tileId)))return NO_INCOME_ALLOCATION;
    const investment=dataInvestmentFor(facts,weights),funding={resources:facts.player,income:facts.player.income,startingIncome:Number(facts.passing)};
    if(initialInvestmentCapital!==undefined&&!Number.isFinite(initialInvestmentCapital))throw TypeError('VALUE_INITIAL_INVESTMENT_INVALID');
    const base=initialInvestmentCapital===undefined?investment(facts.hand,facts.player.publicity,funding):initialInvestmentCapital;
    return researchIncome.incomeOptions({facts,investment,baseCapital:base},weights);
  }
  function incomePreparationCapital(facts,weights=DEFAULT_WEIGHTS) {
    if(facts.round===4)return 0;
    const allocation=incomeAllocationCapital(facts,weights);
    if(allocation.total)return allocation.total;
    return dataInvestmentFor(facts,weights)(facts.hand,facts.player.publicity,{resources:facts.player,income:facts.player.income,startingIncome:Number(facts.passing)});
  }
  const ZERO_JOINT_RESEARCH=Object.freeze({held:0,paid:0});
  function basePurposeCapital(facts, weights) {
    if(facts.round===4){
      const mission=probeCapital.quoteFinalRoundValue(facts,weights),finalMarkPotential=probeCapital.pendingFinalMarkCapital(facts);
      return {handPotential:0,researchPotential:0,probePotential:mission,computerPotential:0,finalMarkPotential,
        total:arithmetic.sum([mission,finalMarkPotential],weights)};
    }
    const player=facts.player,round=facts.round,passing=facts.passing,supply=facts.supply;
    const prepared=Number.isFinite(player.score)&&Number.isFinite(player.publicity)?readyAnalysis.preparePrepaidCapital(facts,weights):undefined;
    const computer=prepared?prepared(player.score,player.publicity):readyAnalysis.prepaidCapital(facts,weights);
    const investment=dataInvestmentFor(facts,weights,prepared);
    const unfunded=Number.isFinite(player.publicity)&&Number.isSafeInteger(facts.researchCost)&&facts.researchCost>=0
      &&player.publicity<facts.researchCost&&!facts.hand.some(supportedResearch);
    const funding=unfunded?null:internalResearchFunding(facts,{resources:player,income:player.income,startingIncome:Number(passing)});
    const {held,paid}=unfunded?ZERO_JOINT_RESEARCH:jointResearchCapital({hand:facts.hand,techState:player.techState,supply,round,publicity:player.publicity,researchCost:facts.researchCost,passed:passing,funding},weights);
    // The typed data tail rejects any revealed alien. A mission reward can
    // mark a trace in a local copy, but it cannot undo an existing reveal.
    const dataContinuation=facts.passing||facts.round>=4
      ||(Array.isArray(facts.board?.aliens?.slots)&&facts.board.aliens.slots.some(s=>s?.revealed))
      ?undefined:context=>researchIncome.missionDataContinuation({...context,facts,investment:context.traceSlots?dataInvestmentFor({...facts,board:{...facts.board,aliens:{slots:context.traceSlots}}},weights):investment},weights);
    const mission=probeCapital.quoteReadOnlyPortfolio({...facts,investment,initialInvestmentCapital:arithmetic.sum([held+paid,computer],weights),dataContinuation},weights);
    const finalMarkPotential=probeCapital.pendingFinalMarkCapital(facts);
    return{handPotential:held,researchPotential:paid,probePotential:mission,computerPotential:computer,finalMarkPotential,total:arithmetic.sum([held,paid,mission,computer,finalMarkPotential],weights)};
  }
  function capitalWithoutIncomeSwap(facts, weights = DEFAULT_WEIGHTS) {
    const base=basePurposeCapital(facts,weights),portfolio=next=>basePurposeCapital(next,weights).total;
    const publicityPortfolio=next=>basePurposeCapital(next,weights);
    // With no mission probe or pending earned mark, this lower portfolio
    // observes hand identities only through supported free research cards.
    // Removing an ordinary publicity source changes no lower scalar yet.
    publicityPortfolio.removalIsInert=(current,card)=>!supportedResearch(card)
      &&!probeCapital.ownedProbes(current.board?.rockets,current.player).length
      &&!(current.nextFinalMark?.valuationSafe&&current.player.score>=current.nextFinalMark.threshold);
    const analysisPortfolio=(wallet,slots,progress={})=>{
      const {aliens,ordinaryDrawCount,...updates}=progress;
      const next={...facts,...updates,player:wallet,board:{...facts.board,
        ...(ordinaryDrawCount===undefined?{}:{ordinaryDrawCount}),aliens:aliens||{...facts.board.aliens,slots}}};
      const lower=basePurposeCapital(next,weights),preparation=publicityPreparation.quote(next,weights,
        publicityPortfolio,lower);
      return arithmetic.sum([lower.total,preparation.value],weights);
    };
    // Income removal also changes the remaining known publicity suppliers.
    // If even their total cannot fund research, every such removal retains
    // the original ordinary-income equivalence; otherwise preserve its gain.
    const publicityGain=card=>{
      if(!card.id||!card.cardId||card.hidden)return 0;
      const reward=cards.getDiscardActionRewardForCard(card);
      return reward&&!reward.dataCount&&Object.keys(reward.gain).every(k=>k==='publicity')?reward.gain.publicity||0:0;
    };
    let knownPublicityCapacity, probeObservesLandingRemoval;
    analysisPortfolio.incomeRemovalClass=card=>{
      if(supportedResearch(card))return null;
      // Identical immediate income and corner publicity do not make a held
      // landing tool interchangeable. Removing one of two suppliers may
      // also activate the supported single-card quote for the other.
      if((probeObservesLandingRemoval??=weights===DEFAULT_WEIGHTS&&!facts.passing&&facts.round<4
        &&!facts.pendingNativeEffects&&probeCapital.ownedProbes(facts.board.rockets,facts.player).length>0)
        &&probeCapital.heldLandingCost(card))return null;
      const missing=facts.researchCost-facts.player.publicity;if(missing<=0)return 'ordinary-income';
      const publicity=publicityGain(card);
      knownPublicityCapacity??=facts.hand.reduce((total,source)=>total+publicityGain(source),0);
      if(knownPublicityCapacity-publicity<missing)return 'ordinary-income:publicity-unfunded';
      return 'ordinary-income:publicity:'+publicity;
    };
    const analysis=readyAnalysis.quote(facts,weights,analysisPortfolio,base.total);
    const income=researchIncome.quote(facts,weights,portfolio,base.total,technologyCapital);
    // Both callers need this same current-wallet subportfolio. Its held/paid
    // research and prepaid computer parts were computed together above; the
    // probe, final mark and other alternative purposes cannot seed it.
    const current=arithmetic.sum([base.total,analysis.value,income.value],weights),dataPlan=incomeAllocationCapital(facts,weights,
      arithmetic.sum([base.handPotential+base.researchPotential,base.computerPotential],weights)),dataPotential=arithmetic.normalize(Math.max(0,dataPlan.total-current),weights);
    return{...base,analysisPotential:arithmetic.sum([base.computerPotential,analysis.value],weights),analysisPlan:analysis,researchIncomePotential:income.value,researchIncomePlan:income,dataPotential,dataPlan,total:arithmetic.sum([current,dataPotential],weights)};
  }
  function publicIncomeSwapEligible(facts) {
    return !(facts.terminal||facts.passing||facts.round>=4||facts.pendingNativeEffects
      ||!facts.amibaTraces||!facts.researchSymbols?.revealInitialized
      ||!Array.isArray(facts.pendingCardTriggers)||facts.pendingCardTriggers.length
      ||!Array.isArray(facts.pendingHandCardTriggers)||facts.pendingHandCardTriggers.length
      ||facts.companyState?.abilityId!=="deepspace_swap_cards"||facts.companyState.roundMarkRound===facts.round
      ||facts.computerSlots.length!==3||facts.computerSlots.some((s,i)=>s!==i+1)||facts.player.availableData<3);
  }
  const incomeSwapTravelTypes=new Set(["card_land","card_orbit","card_move","card_launch","card_scan"]);
  function ordinaryIncomeSwapCard(card) {
    // Native expansion only repeats the same printed type. Ordinary-income
    // eligibility observes its presence, not labels, cloned effects or count.
    return !supportedResearch(card)&&!sectorCard.supported(card)&&!symbolCard.supported(card)&&!movementTool.supported(card)
      &&!(cardEffects.getCardModel(card)?.playEffects||[]).some(e=>incomeSwapTravelTypes.has(e.type));
  }
  function publicIncomeSwapInputs(facts,weights) {
    if(!publicIncomeSwapEligible(facts))return null;
    // The lower portfolio can price ordinary income sources, but supported
    // tools remain in their higher shared-wallet portfolios and cannot supply
    // this exchange. Hidden metadata is never inspected.
    const ordinary=ordinaryIncomeSwapCard;
    const hidden=facts.hand.findIndex(c=>c.hidden===true),counted=facts.extraUnknownCount>0;
    // Already known currency income has its existing direct preparation and
    // positive-purpose swap policy. This added forecast supplies a missing
    // known currency source; it does not requote every currency conversion.
    const known=!counted&&hidden<0?facts.hand.filter(c=>c.cardId&&!c.hidden&&ordinary(c)
      &&!['credits','energy'].some(k=>cards.getIncomeGainForCard(c)?.[k])).map(card=>({card,
      value:(cardEffects.getCardPrice(card)||0)+Object.entries(cards.getIncomeGainForCard(card)||{}).reduce((n,[k,v])=>n+v*(weights[k]||0)*(4-facts.round),0)
        +((cards.getDiscardActionRewardForCard(card)?.dataCount||0)+(cards.getDiscardActionMoveRewardForCard(card)?.movementPoints||0))*.5
    })).sort((a,b)=>a.value-b.value||a.card.id.localeCompare(b.card.id))[0]?.card:null;
    if(!counted&&hidden<0&&!known)return null;
    // Select one stable representative per known currency category. This is
    // a fixed income purpose, never combinations of outgoing hand cards.
    const offers=new Map();
    // Offer-value previews can already hold this public card. It cannot be
    // acquired again by exchanging another hand card for the same entity.
    for(const card of (facts.board.publicCards||[]).filter(c=>c&&!c.hidden&&c.cardId
      &&!facts.hand.some(held=>!held.hidden&&held.id===c.id)&&ordinary(c)).sort((a,b)=>a.id.localeCompare(b.id))){
      const gain=cards.getIncomeGainForCard(card),keys=Object.keys(gain||{});
      if(keys.length===1&&["credits","energy"].includes(keys[0])&&gain[keys[0]]===1&&!offers.has(keys[0]))offers.set(keys[0],card);
    }
    return offers.size?{hidden,counted,known,offers}:null;
  }
  function publicIncomeSwap(facts, weights, base, inputs) {
    const none={value:0,plan:null};
    if(inputs===null||inputs===undefined&&!publicIncomeSwapEligible(facts))return none;
    // This new forecast fills a missing/valuable income source. A ready
    // ordinary supplier already funds this exact analysis; extra stock for
    // another later income remains in the existing positive-purpose policy.
    const current=facts.hand.find(c=>!c.hidden&&c.id===base.analysisPlan.selected?.incomeCardId);
    if(current&&ordinaryIncomeSwapCard(current))return none;
    const prepared=inputs??publicIncomeSwapInputs(facts,weights);
    if(!prepared)return none;
    const {hidden,counted,known,offers}=prepared;
    let best=none;
    for(const incoming of offers.values()){
      const hand=facts.hand.slice();if(counted)hand.push(incoming);else hand[hidden>=0?hidden:hand.indexOf(known)]=incoming;
      const next={...facts,hand,extraUnknownCount:facts.extraUnknownCount-Number(counted),
        companyState:{...facts.companyState,roundMarkRound:facts.round},board:{...facts.board,
          publicCards:facts.board.publicCards.map(c=>c===incoming?(known||{hidden:true,faceUp:false}):c)}};
      const after=capitalWithoutIncomeSwap(next,weights);
      // Only a plan actually consuming the incoming card as income qualifies.
      if(after.analysisPlan.selected?.incomeCardId!==incoming.id)continue;
      const net=arithmetic.sum([after.total,-base.total],weights);
      if(net>best.value)best={value:net,plan:{outgoingCardId:known?.id||null,incomingCardId:incoming.id,netGain:net,
        continuation:after.analysisPlan.selected,anonymousSupplier:!known}};
    }
    return best;
  }
  function knownPublicIncomeSwapPlan(facts,weights=DEFAULT_WEIGHTS) {
    const inputs=publicIncomeSwapInputs(facts,weights);if(!inputs)return null;
    return publicIncomeSwap(facts,weights,capitalWithoutIncomeSwap(facts,weights),inputs).plan;
  }
  function capitalWithoutSector(facts, weights = DEFAULT_WEIGHTS) {
    const base=capitalWithoutIncomeSwap(facts,weights),swap=publicIncomeSwap(facts,weights,base);
    return{...base,knownPublicIncomeSwapPlan:swap.plan,dataPotential:arithmetic.sum([base.dataPotential,swap.value],weights),
      total:arithmetic.sum([base.total,swap.value],weights)};
  }
  function purposeCapitalWithoutSymbols(facts, weights = DEFAULT_WEIGHTS) {
    const base=capitalWithoutSector(facts,weights),sector=sectorCard.quote(facts,weights,next=>capitalWithoutSector(next,weights).total,base.total);
    return{...base,handPotential:arithmetic.sum([base.handPotential,sector.value],weights),sectorCardPlan:sector,total:arithmetic.sum([base.total,sector.value],weights)};
  }

  function purposeCapitalWithoutTools(facts, weights = DEFAULT_WEIGHTS) {
    const base=purposeCapitalWithoutSymbols(facts,weights),symbol=symbolCard.quote(facts,weights,next=>purposeCapitalWithoutSymbols(next,weights).total,base.total,true);
    return{...base,handPotential:arithmetic.sum([base.handPotential,symbol.value],weights),symbolCardPlan:symbol,total:arithmetic.sum([base.total,symbol.value],weights)};
  }

  function purposeCapitalWithoutPublicityPreparation(facts, weights = DEFAULT_WEIGHTS) {
    const lower=purposeCapitalWithoutTools(facts,weights),research=researchSymbol.quote(facts,weights,next=>purposeCapitalWithoutTools(next,weights).total,lower.total,technologyCapital);
    const base={...lower,researchPotential:arithmetic.sum([lower.researchPotential,research.value],weights),researchSymbolPlan:research,total:arithmetic.sum([lower.total,research.value],weights)},tool=movementTool.quote(facts,weights,next=>purposeCapitalWithoutTools(next,weights).total);
    return {...base,handPotential:arithmetic.sum([base.handPotential,tool.value],weights),toolPlan:tool,
      total:arithmetic.sum([base.total,tool.value],weights)};
  }

  function purposeCapitalWithoutFutureProbe(facts, weights = DEFAULT_WEIGHTS) {
    const base=purposeCapitalWithoutPublicityPreparation(facts,weights);
    const preparation=publicityPreparation.quote(facts,weights,next=>purposeCapitalWithoutPublicityPreparation(next,weights),base);
    return{...base,analysisPublicityPlan:preparation,
      researchPotential:arithmetic.sum([base.researchPotential,preparation.value],weights),
      total:arithmetic.sum([base.total,preparation.value],weights)};
  }

  function purposeCapital(facts, weights = DEFAULT_WEIGHTS) {
    const base=purposeCapitalWithoutFutureProbe(facts,weights);
    const future=probeCapital.nextIncomeLaunchReplacement(facts,weights,base.probePotential,card=>{
      const hand=facts.hand.filter(c=>c.id!==card.id),after=purposeCapitalWithoutFutureProbe({...facts,hand,
        player:{...facts.player,handSize:facts.player.handSize-1}},weights);
      return arithmetic.sum([weights.handSize,base.total,-base.probePotential,-after.total,after.probePotential],weights);
    });
    if(!(future.value>base.probePotential))return base;
    // A current analysis/income/card composition may already price the same
    // probe after its own funding. Measure that whole shared contribution,
    // rather than adding a second use to the current-mission component alone.
    const ships=probeCapital.ownedProbes(facts.board.rockets,facts.player),ids=new Set(ships.map(ship=>ship.id));
    const withoutProbe=purposeCapitalWithoutFutureProbe({...facts,board:{...facts.board,
      rockets:facts.board.rockets.filter(ship=>!ids.has(ship.id))}},weights);
    const existingContribution=Math.max(0,arithmetic.sum([base.total,-withoutProbe.total],weights)),
      increase=Math.max(0,arithmetic.sum([future.value,-existingContribution],weights));
    if(!increase)return base;
    return{...base,probePotential:arithmetic.sum([base.probePotential,increase],weights),nextIncomeProbePlan:{...future,existingContribution,increase},
      total:arithmetic.sum([base.total,increase],weights)};
  }

  // Scalar-only quotes may repeat across mutable planning wrappers. Encode
  // every input field anew; reference tokens require recursive immutability.
  // No native node, plan, successor or caller-owned object is stored here.
  const scalarCapitalQuotes=new Map(),capitalInputRefs=new WeakMap(),capitalKeyStrings=new Map();
  const unsupportedCapitalInput=Object.freeze({});let nextCapitalInputRef=0;
  function capitalKeyString(value){
    if(capitalKeyStrings.has(value))return capitalKeyStrings.get(value);
    const result=JSON.stringify(value);if(capitalKeyStrings.size>=1024)capitalKeyStrings.delete(capitalKeyStrings.keys().next().value);
    capitalKeyStrings.set(value,result);return result;
  }
  function scalarCapitalKey(input){
    const active=new Set();
    function encode(value){
      if(value===null)return["null",true];
      if(typeof value==="undefined")return["undefined",true];
      if(typeof value==="string")return["s"+capitalKeyString(value),true];
      if(typeof value==="boolean")return[value?"true":"false",true];
      if(typeof value==="number"){
        if(!Number.isFinite(value))throw unsupportedCapitalInput;
        return["n"+(Object.is(value,-0)?"-0":value),true];
      }
      if(typeof value!=="object")throw unsupportedCapitalInput;
      if(capitalInputRefs.has(value))return["r"+capitalInputRefs.get(value),true];
      if(active.has(value))throw unsupportedCapitalInput;
      const array=Array.isArray(value),prototype=Object.getPrototypeOf(value),names=Reflect.ownKeys(value);
      if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)throw unsupportedCapitalInput;
      if(names.some(key=>typeof key!=="string"))throw unsupportedCapitalInput;
      active.add(value);let immutable=Object.isFrozen(value),result=array?"array{":prototype===null?"null-object{":"object{";
      // Enumeration order is part of the input: custom arithmetic and greedy
      // tie order must not acquire a canonical ordering from this cache.
      for(const name of names){
        const descriptor=Object.getOwnPropertyDescriptor(value,name);if(!Object.hasOwn(descriptor,"value"))throw unsupportedCapitalInput;
        const [key,frozen]=encode(descriptor.value);immutable=immutable&&frozen;result+=capitalKeyString(name)+":"+key+";";
      }
      active.delete(value);result+="}";
      if(immutable){const id=++nextCapitalInputRef;capitalInputRefs.set(value,id);return["r"+id,true];}
      return[result,false];
    }
    try{return encode(input)[0];}catch(error){if(error!==unsupportedCapitalInput)throw error;return null;}
  }
  function purposeCapitalValue(facts,weights=DEFAULT_WEIGHTS){
    const key=scalarCapitalKey([facts,weights]);
    if(key!==null&&scalarCapitalQuotes.has(key))return scalarCapitalQuotes.get(key);
    const value=purposeCapital(facts,weights).total;
    if(key!==null&&Number.isFinite(value)){
      if(scalarCapitalQuotes.size>=256)scalarCapitalQuotes.delete(scalarCapitalQuotes.keys().next().value);
      scalarCapitalQuotes.set(key,value);
    }
    return value;
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
    // A committed last-round PASS leaves no own actions to spend the wallet.
    // Keep the official score projection (including any resource-based scoring).
    const finalPass = observation.publicState.roundNumber === 4
      && observation.publicState.passedPlayerIds?.includes(seatId);
    if (terminal || finalPass) return Object.freeze({ modelVersion: MODEL_VERSION, total: currentTotal, purposePreparationDebt:0,
      components: Object.freeze({ realizedScore, currentEndGameBonus: currentTotal - realizedScore,
        resources: 0, hand: 0, income: 0, technologyPotential: 0, handPotential: 0, researchPotential: 0, probePotential: 0, analysisPotential: 0, researchIncomePotential: 0, dataPotential: 0, finalMarkPotential:0 }), terminal });

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
    let capital;
    if(round===4&&!probeCapital.ownedProbes(observation.publicState.board?.rockets,{id:seatId}).length){
      // In the last round, all salary, research, analysis and other future
      // purposes are closed. Without an ordinary probe, only an already
      // earned final mark can retain purpose value. Its native forecast can
      // still depend on which known income card is immediately fundable.
      const finalMarkPotential=probeCapital.pendingFinalMarkCapital({
        nextFinalMark:observation.selfState.nextFinalMark,player:{...player,id:seatId},
        computerSlots:player.dataProgress?.computerSlots,hand:observation.selfState.hand,
      });
      capital={handPotential:0,researchPotential:0,probePotential:0,analysisPotential:0,
        researchIncomePotential:0,dataPotential:0,finalMarkPotential,toolPlan:{value:0}};
    }else{
      const facts={...probeCapital.factsFromObservation(observation,seatId),supply:observation.publicState.board?.techSupply,
        researchCost:player.researchPublicityCost,computerSlots:player.dataProgress?.computerSlots,
        analyzeEnergyCost:readyAnalysis.energyCost(player.industryAbilityId),reservedCards:observation.selfState.reservedCards};
      capital=purposeCapital(facts,weights);
    }
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

  return Object.freeze({ diagnosticOrderedResearchQuotes:()=>({...__researchQuoteWork,entries:orderedResearchQuotes.size}), MODEL_VERSION, DEFAULT_WEIGHTS, FORECAST, valueScale:arithmetic.scale, normalizeValue:arithmetic.normalize, sumValueParts:arithmetic.sum, technologyCapital, knownCardCapital, handCapital, researchFunding, researchCapital, researchCapitalCeiling, probePotential, purposeCapital, purposeCapitalValue, knownPublicIncomeSwapPlan, incomePreparationCapital, incomeAllocationCapital, prepaidComputerCapital:readyAnalysis.prepaidCapital, hasKnownSymbolTool:cards=>cards.some(card=>symbolCard.supported(card)), hasKnownSectorTool:cards=>cards.some(card=>sectorCard.supported(card)), hasKnownMovementTool:cards=>cards.some(movementTool.supported), readyAnalysisUpperBound:(slots,progress)=>readyAnalysis.upperBound(slots,DEFAULT_WEIGHTS,progress),
    researchIncomeUpperBound:facts=>researchIncome.upperBound(facts,DEFAULT_WEIGHTS,technologyCapital),
    supportsLegacyValueProof: observation => observation.publicState.roundNumber === 4
      && !probeCapital.ownedProbes(observation.publicState.board?.rockets,{id:observation.selfState?.playerId}).length, evaluateStateValue, createStateValueEvaluator,
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
