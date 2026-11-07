(function (root, factory) {
  "use strict";
  const common = typeof module === "object" && module.exports;
  const api = factory(common ? require("../cards/deck") : root.SetiCards,
    common ? require("../data") : root.SetiData,
    common ? require("../effects/science-session") : root.SetiScienceSession,
    common ? require("../aliens/state") : root.SetiAlienState,
    common ? require("../actions/quick-trades") : root.SetiQuickTrades,
    common ? require("../actions/shared") : root.SetiActionShared,
    common ? require("../abilities/planet") : root.SetiAbilityPlanet,
    common ? require("../actions/planet-rewards") : root.SetiPlanetRewards,
    common ? require("../../solar-system/core") : root.SetiSolarSystem,
    common ? require("../players") : root.SetiPlayers,
    common ? require("../rockets") : root.SetiRocketActions,
    common ? require("../abilities/rocket") : root.SetiAbilityRocket,
    common ? require("../industry/catalog") : root.SetiIndustryCatalog,
    common ? require("./value-arithmetic") : root.SetiValueArithmetic,
    common ? require("../cards/effects") : root.SetiCardEffects,
    common ? require("../aliens/amiba") : root.SetiAlienAmiba,
    common ? require("../end-game-scoring") : root.SetiEndGameScoring,common?require('./income-card-order'):root.SetiIncomeCardOrder);
  if (common) module.exports = api;
  else root.SetiProbeCapital = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (cards, data, science, alienState, trades, shared, planetAbility, rewards, solar, players, rockets, rocketAbility, industryCatalog, arithmetic, cardEffects, amiba, endScoring,incomeOrder) {
  "use strict";
  const ordinary = new Set(shared.NON_EARTH_PLANET_IDS.filter(id=>id!=="aomomo"));
  const cToE = trades.TRADE_ACTIONS.find(t => t.id === "credits-for-energy");
  const eToC = trades.TRADE_ACTIONS.find(t => t.id === "energy-for-credit");
  const zero = () => ({ value: 0, selected: null, candidates: [] });

  function ownedProbes(rockets, player) {
    return (rockets || []).filter(r => r.surface === "solar-board"
      && (r.kind || "standard") === "standard" && r.fossilId == null && r.playerId === player.id);
  }

  // A bounded geometry cache contains only public topology and permanent
  // terrain costs. Wallets, rewards and mission funding are always requoted.
  const routeCache = new Map(), requirementCache = new Map();
  function routes(facts, actor, ship) {
    const pieces = { rockets: facts.board.rockets }, solarSystem = facts.board.solarSystem;
    const key = JSON.stringify([solarSystem, pieces.rockets, ship.id,
      Boolean(actor.techState?.ownedTiles?.orange2 && !actor.techState?.disabledTiles?.orange2)]);
    if (routeCache.has(key)) return routeCache.get(key);
    const context = { solarSystem, turn: { roundNumber: facts.round } };
    const canMove = rockets.createStaticCoordinateMoveQuery(pieces, ship.id);
    const best = new Map(), queue = [{ coordinate: { ...rockets.getRocketSectorCoordinate(ship) }, cost: 0, path: [] }];
    while (queue.length) {
      queue.sort((a, b) => a.cost - b.cost || a.path.length - b.path.length);
      const next = queue.shift(), id = `${next.coordinate.x},${next.coordinate.y}`;
      if (best.has(id)) continue;
      Object.freeze(next.coordinate);
      next.path.forEach(Object.freeze); Object.freeze(next.path); Object.freeze(next);
      best.set(id, next);
      const cost = rocketAbility.getRequiredMovePointsFromCoordinate(context, actor, next.coordinate);
      if (!Number.isSafeInteger(cost) || cost < 1) throw new Error('PROBE_CAPITAL_ROUTE_COST_INVALID');
      for (const direction of rocketAbility.MOVE_DIRECTIONS) {
        const move = canMove(next.coordinate, direction.deltaX, direction.deltaY);
        if (!move.ok || best.has(`${move.to.x},${move.to.y}`)) continue;
        queue.push({ coordinate: move.to, cost: next.cost + cost,
          path: [...next.path, { deltaX: direction.deltaX, deltaY: direction.deltaY, requiredMovePoints: cost }] });
      }
    }
    if (routeCache.size >= 64) routeCache.delete(routeCache.keys().next().value);
    routeCache.set(key, best);
    return best;
  }

  // Read-only native Ability queries at named destination coordinates are
  // requirement quotes, never fabricated successor observations or game nodes.
  function requirements(facts) {
    const p = facts.player, actor = { id: p.id, color: p.color, resources: p, techState: p.techState };
    const key = JSON.stringify([facts.board.solarSystem, facts.board.rockets, facts.board.planets,
      p.id, p.color, ['orange2', 'orange3', 'orange4'].map(id =>
        Boolean(p.techState?.ownedTiles?.[id] && !p.techState?.disabledTiles?.[id]))]);
    if (requirementCache.has(key)) return requirementCache.get(key);
    const context = { players: { players: [actor] }, turn: { currentPlayerId: p.id, roundNumber: facts.round },
      planets: facts.board.planets, solarSystem: facts.board.solarSystem, pieces: { rockets: facts.board.rockets } };
    const locations = solar.collectPlanetLocations(facts.board.solarSystem);
    const result = ownedProbes(facts.board.rockets, p).flatMap(ship => {
      const reachable = routes(facts, actor, ship);
      return locations.flatMap(planet => {
        if (!ordinary.has(planet.planetId)) return [];
        const route = reachable.get(`${planet.x},${planet.y}`);
        if (!route) return [];
        const placement = { rocket: ship, planet, currentPlayer: actor, sectorCoordinate: route.coordinate };
        return [...planetAbility.listOrbitRequirementsAt(context, placement), ...planetAbility.listLandRequirementsAt(context, placement)].map(choice => ({
          requirementId: `${ship.id}:${choice.actionType}:${choice.planetId}:${choice.target?.satelliteId || 'planet'}`,
          endpointFamily: choice.actionType, planetId: choice.planetId, route,
          endpointFacts: { cost: choice.cost, rewards: choice.actionType === 'orbit'
            ? rewards.buildOrbitRewardEffects(choice.planetId, choice.markerSequence)
            : choice.target?.type === 'satellite' ? rewards.buildSatelliteLandRewardEffects(choice.target.satelliteId)
              : rewards.buildPlanetLandRewardEffects(choice.planetId, choice.rewardMarkerSequence ?? choice.markerSequence) },
        }));
      });
    });
    if (requirementCache.size >= 64) requirementCache.delete(requirementCache.keys().next().value);
    requirementCache.set(key, result);
    return result;
  }

  function quote(facts, weights) {
    const player = facts.player, seatId = player.id, planningRound = facts.round + Number(facts.passing);
    if (facts.terminal || planningRound >= 4 && !(facts.round === 4 && !facts.passing)
      || !ownedProbes(facts.board?.rockets, player).length) return zero();
    for (const key of ['planets', 'data', 'solarSystem', 'publicCards', 'aliens']) {
      if (facts.board[key] == null) throw new Error(`PROBE_CAPITAL_PUBLIC_FACTS_MISSING: ${key}`);
    }
    if (!Array.isArray(facts.board.aliens.slots)) throw new Error('PROBE_CAPITAL_ALIEN_SLOTS_MISSING');
    // All supported ordinary endpoints still cost at least one energy, or
    // both orbit currencies. With no energy, fewer than two credits cannot
    // fund even that lower bound; route/mission construction is unnecessary.
    if (planetAbility.BASE_LAND_ENERGY_COST - 1 - planetAbility.ORANGE3_LAND_DISCOUNT > 0
      && planetAbility.DEFAULT_ORBIT_COST.energy > 0
      && player.energy === 0 && player.credits < cToE.cost.credits) return zero();
    const goals = requirements(facts);
    if (!goals.length) return zero();
    const knownHand = facts.hand.filter(c => !c.hidden && c.cardId);
    const capitalValues = new Map();
    const capital = (hand, wallet, income, traceSlots = null, knownCurrentValue) => {
      const key = JSON.stringify([wallet.credits, wallet.energy, wallet.publicity, wallet.availableData, income.credits, income.energy, hand.map(card => card.id), traceSlots?.map(s=>[s.slotId,s.revealed,...["blue","pink","yellow"].map(t=>s.traces[t].firstPlaced)])]);
      if (!capitalValues.has(key)) capitalValues.set(key, knownCurrentValue===undefined
        ? facts.investment(hand, wallet.publicity, { resources: wallet, income, startingIncome: Number(facts.passing) },{traceSlots}) : knownCurrentValue);
      return capitalValues.get(key);
    };
    // Only the same source portfolio can supply this already-computed scalar.
    // Every changed mission wallet/hand still runs the investment callback.
    if(facts.initialInvestmentCapital!==undefined&&!Number.isFinite(facts.initialInvestmentCapital))throw TypeError('PROBE_CAPITAL_INITIAL_INVESTMENT_INVALID');
    const initialCapital = capital(knownHand, player, player.income, null, facts.initialInvestmentCapital);
    const root = { data: facts.board.data, solarSystem: facts.board.solarSystem };
    const actor = { id: seatId, color: player.color };
    const candidates = [];
    for (const goal of goals) {
      const totalCost = { ...goal.endpointFacts.cost, energy: (goal.endpointFacts.cost.energy || 0) + goal.route.cost };
      const payment = funding(player, totalCost, weights);
      if (!payment) { candidates.push({ id: goal.requirementId, funded: false, value: 0 }); continue; }
      const hand = knownHand.slice(), publicCards = (facts.board.publicCards || []).filter(c => c && !c.hidden && c.cardId);
      const wallet = { credits: player.credits - payment.spend.credits, energy: player.energy - payment.spend.energy,
        publicity: player.publicity, availableData: player.availableData };
      const income = { ...player.income };
      let delta = -payment.value, unknownCount = facts.hand.length - hand.length + facts.extraUnknownCount, supported = true;
      let traceSlots = null;
      const usedTokens = new Set(), effects = goal.endpointFacts.rewards, ledger = [];
      const weighted = gain => Object.entries(gain).reduce((n, [k, amount]) => n + amount * (k === 'score' ? 1 : weights[k] || 0), 0);
      const incomePurpose = (card, availableHand, projectedData=0) => {
        const gain=cards.getIncomeGainForCard(card),immediate={...gain},nextWallet={...wallet,availableData:Math.min(players.RESOURCE_LIMITS.availableData,wallet.availableData+projectedData)},nextIncome={...income};
        if(immediate.publicity)immediate.publicity=Math.min(immediate.publicity,players.RESOURCE_LIMITS.publicity-wallet.publicity);
        if(immediate.availableData)immediate.availableData=Math.min(immediate.availableData,players.RESOURCE_LIMITS.availableData-wallet.availableData);
        for(const [key,amount]of Object.entries(immediate))if(key!=='handSize')nextWallet[key]=(nextWallet[key]||0)+amount;
        for(const [key,amount]of Object.entries(gain))nextIncome[key]=(nextIncome[key]||0)+amount;
        const after=capital(availableHand.filter(c=>c!==card),nextWallet,nextIncome,traceSlots);
        const linear=weighted(immediate)+weighted(gain)*(4-planningRound)-weights.handSize;
        const following=facts.dataContinuation?facts.dataContinuation({hand:availableHand.filter(c=>c!==card),wallet:nextWallet,income:nextIncome,traceSlots}):null;
        return{card,gain,wallet:nextWallet,income:nextIncome,after,linear,value:arithmetic.sum([linear,after,following?.value||0,-capital(availableHand,wallet,income,traceSlots)],weights)};
      };
      for (let index = 0; index < effects.length && supported; index++) {
        const effect = effects[index], options = effect.options || {};
        if (effect.type === 'gain_resources') {
          const gain = { ...options.gain };
          if (gain.publicity) gain.publicity = Math.min(gain.publicity, players.RESOURCE_LIMITS.publicity - wallet.publicity);
          if (gain.availableData) gain.availableData = Math.min(gain.availableData, players.RESOURCE_LIMITS.availableData - wallet.availableData);
          for (const [k, amount] of Object.entries(gain)) if (k !== 'score') wallet[k] = (wallet[k] || 0) + amount;
          const value = weighted(gain); delta += value; ledger.push({ type: effect.type, gain, value });
        } else if (effect.type === 'gain_data') {
          const count = Math.min(options.count || 1, players.RESOURCE_LIMITS.availableData - wallet.availableData), value = count * weights.availableData;
          wallet.availableData += count; delta += value; ledger.push({ type: effect.type, count, value });
        } else if (effect.type === 'draw_cards') {
          const count = options.count || 1, value = count * weights.handSize;
          unknownCount += count; delta += value; ledger.push({ type: effect.type, count, value, identityKnown: false });
        } else if (effect.type === 'pick_card') {
          if ((options.count || 1) !== 1) { supported = false; break; }
          const following=effects.slice(index+1),incomeAt=following.findIndex(e=>e.type==='income'),incomeLater=incomeAt>=0;
          const projectedData=incomeLater?knownScanData(root,actor,following.slice(0,incomeAt),usedTokens):0;
          const ranked = publicCards.map(card => ({ card, value: incomeLater ? incomePurpose(card, [...hand, card],projectedData).value
            : arithmetic.sum([capital([...hand, card], wallet, income,traceSlots),-capital(hand, wallet, income,traceSlots)],weights) }))
            .sort((a, b) => b.value - a.value || a.card.id.localeCompare(b.card.id));
          const picked = ranked[0]?.card;
          if (picked) { hand.push(picked); publicCards.splice(publicCards.indexOf(picked), 1); } else unknownCount++;
          delta += weights.handSize; ledger.push({ type: effect.type, cardId: picked?.cardId || null, value: weights.handSize,
            policy: 'one fixed known income or held-purpose quote; not a claim of native card identity equivalence' });
        } else if (effect.type === 'income') {
          if ((options.count || 1) !== 1) { supported = false; break; }
          const before = capital(hand, wallet, income,traceSlots);
          const ranked = hand.filter(card=>cards.getIncomeGainForCard(card)).map(card=>incomePurpose(card,hand))
            .sort((a, b) => b.value - a.value || a.card.id.localeCompare(b.card.id));
          if (!ranked.length) {
            // A final ordinary income reward may consume one anonymous card.
            // Charge its complete hand value and forecast none of its gains.
            // This narrow resource-only mission cannot spend an unknown grant
            // or deplete the counted ordinary deck before a possible redraw.
            const anonymousFloor=unknownCount>0&&index===effects.length-1
              &&effects.slice(0,index).every(e=>e.type==='gain_resources')
              &&Number.isSafeInteger(facts.board.ordinaryDrawCount)&&facts.board.ordinaryDrawCount>0;
            if(anonymousFloor){unknownCount--;delta-=weights.handSize;
              ledger.push({type:effect.type,value:-weights.handSize,anonymousCardsConsumed:1,
                policy:'known-final-income-consumption-floor',excluded:'all unknown immediate and permanent income gains; no funding from this reward'});
            }else{
              if (unknownCount) supported = false;
              ledger.push({ type: effect.type, value: 0, unresolvedUnknownIncome: unknownCount > 0 });
            }
            continue;
          }
          const chosen = ranked[0]; hand.splice(hand.indexOf(chosen.card), 1);
          unknownCount += chosen.gain.handSize || 0;
          Object.assign(wallet,chosen.wallet);Object.assign(income,chosen.income);
          const linear = chosen.linear;
          delta += linear; ledger.push({ type: effect.type, cardId: chosen.card.cardId, gain: chosen.gain, value: linear,
            handPurposeCost: arithmetic.sum([before,-capital(hand, wallet, income,traceSlots)],weights) });
        } else if (['scan_planet_sector', 'choose_nebula_scan', 'choose_colored_nebula_scan'].includes(effect.type)) {
          const opts = effect.type === 'scan_planet_sector' ? { mode: 'planet', planetId: options.planetId }
            : effect.type === 'choose_colored_nebula_scan' ? { mode: 'color', color: options.color }
              : { mode: 'specified', nebulaIds: options.nebulaIds };
          const quotes = science.listScanStepChoices(root, actor, { ...opts, gainData: true }).flatMap(action => {
            const id = action.target.nebulaId, bucket = root.data.nebulae[id];
            const available = { ...root.data, nebulae: { ...root.data.nebulae,
              [id]: { ...bucket, tokens: bucket.tokens.filter(t => !usedTokens.has(t.id)) } } };
            const token = data.getNextReplaceableNebulaToken(available, id);
            if (!token) return []; // No forecast of refilled/hidden replacement tokens.
            const score = data.getNebulaSlotScoreReward(id, token.slotIndex) || 0;
            return [{ id, tokenId: token.id, value: score + Number(wallet.availableData < players.RESOURCE_LIMITS.availableData) * weights.availableData,
              score, data: Number(wallet.availableData < players.RESOURCE_LIMITS.availableData) }];
          }).sort((a, b) => b.value - a.value || a.id.localeCompare(b.id));
          const selected = quotes[0];
          if (selected) { usedTokens.add(selected.tokenId); wallet.availableData += selected.data; delta += selected.value; }
          ledger.push({ type: effect.type, selected, value: selected?.value || 0,
            excluded: 'sector completion, triggered rewards, new identities and additional technology movement' });
        } else if (effect.type === 'alien_trace') {
          traceSlots ||= structuredClone(facts.board.aliens.slots);
          for (let n = 0; n < (options.count || 1); n++) {
            const types = options.traceType ? [options.traceType] : ['yellow', 'pink', 'blue'];
            const choices = traceSlots.flatMap(slot => types.flatMap(type => {
              const first = !slot.traces?.[type]?.firstPlaced;
              if (slot.revealed && first) return [];
              const gain = { ...(first ? alienState.getFirstTraceRewardForSlot(slot.slotId) : alienState.getExtraTraceReward()).gain };
              if (gain.publicity) gain.publicity = Math.min(gain.publicity, players.RESOURCE_LIMITS.publicity - wallet.publicity);
              return [{ slot, type, first, gain, value: weighted(gain) }];
            })).sort((a, b) => b.value - a.value || a.slot.slotId - b.slot.slotId || a.type.localeCompare(b.type));
            const chosen = choices[0];
            if (!chosen) { supported = false; break; }
            const { slot, type, first, gain, value } = chosen;
            slot.traces[type] = { ...slot.traces[type], firstPlaced: true };
            wallet.publicity += gain.publicity || 0; delta += value;
            ledger.push({ type: effect.type, slotId: slot.slotId, traceType: type, first, gain, value,
              excluded: 'revealed-species effects and future discovery' });
          }
        } else { supported = false; ledger.push({ type: effect.type, unsupported: true }); }
      }
      const capitalDelta = arithmetic.sum([capital(hand, wallet, income, traceSlots),-initialCapital],weights);
      // One fixed, existing-data continuation belongs to this mission's
      // shared wallet. It is an optional forecast, never a native node/bound.
      const dataContinuation = supported && facts.dataContinuation
        ? facts.dataContinuation({ hand, wallet, income, traceSlots }) : null;
      candidates.push({ id: goal.requirementId, family: goal.endpointFamily, planet: goal.planetId, funded: true,
        supported, payment, route: goal.route, ledger, capitalDelta, dataContinuation,
        value: supported ? Math.max(0, arithmetic.sum([delta,capitalDelta,dataContinuation?.value||0],weights)) : 0 });
    }
    const ranked = candidates.filter(c => c.funded && c.supported).sort((a, b) => b.value - a.value || a.id.localeCompare(b.id));
    return { value: ranked[0]?.value || 0, selected: ranked[0] || null, candidates,
      scope: 'One current-wallet-funded ordinary mission with its complete paid geometric route and optional fixed existing-data tail; maximum, not sum. No future income, card moves, arrival triggers or opponent changes. Forecast hypothesis, never an admissible bound.' };
  }

  // One income-funded replacement option for an existing Earth probe. The
  // income principal is already booked elsewhere; only net use is priced.
  function nextIncomeLaunchReplacement(facts,weights,currentMissionValue,incomeCardCost) {
    const none=reason=>({value:0,selected:null,reason});
    if(facts.terminal||facts.round!==3||!facts.uncontestedRound
      ||facts.companyState?.abilityId!=='deepspace_swap_cards'
      ||facts.pendingNativeEffects&&!facts.passing
      ||!Array.isArray(facts.pendingCardTriggers)||facts.pendingCardTriggers.length
      ||!Array.isArray(facts.pendingHandCardTriggers)||facts.pendingHandCardTriggers.length
      ||facts.turnCardBonusCount!==0)return none('outside-known-next-income-probe-window');
    const launch=rocketAbility.DEFAULT_LAUNCH_COST;
    if(Object.keys(launch).length!==1||!Number.isSafeInteger(launch.credits)||launch.credits<0)throw Error('PROBE_REPLACEMENT_LAUNCH_COST_UNSUPPORTED');
    const ceiling=launch.credits*Math.min(weights.credits,eToC.cost.energy/eToC.gain.credits*weights.energy);
    if(!(ceiling>0)||currentMissionValue>=ceiling)return none('current-mission-already-covers-launch');
    const ships=ownedProbes(facts.board.rockets,facts.player);
    if(ships.length!==1)return none('next-income-needs-one-earth-probe');
    const earth=solar.collectPlanetLocations(facts.board.solarSystem).find(p=>p.planetId==='earth'),at=rockets.getRocketSectorCoordinate(ships[0]);
    if(!earth||earth.x!==at.x||earth.y!==at.y)return none('next-income-probe-not-at-earth');
    const wallet={credits:facts.player.income.credits,energy:facts.player.income.energy};
    if(Object.values(wallet).some(n=>!Number.isSafeInteger(n)||n<0))throw TypeError('PROBE_NEXT_INCOME_INVALID');
    if(!wallet.credits&&!wallet.energy)return none('no-known-next-currency-income');
    const complexSource=card=>Number((cardEffects.getCardModel(card)?.playEffects||[])
      .some(effect=>!['gain_resources','gain_data'].includes(effect.type)));
    const sources=facts.hand.filter(c=>c.id&&c.cardId&&!c.hidden&&cards.getIncomeGainForCard(c))
      .sort((a,b)=>complexSource(a)-complexSource(b)||(cardEffects.getCardPrice(a)||0)-(cardEffects.getCardPrice(b)||0)||a.id.localeCompare(b.id));
    const incomeCosts=new Map();
    const sufficientIncome=(score,paymentValue)=>{
      if(typeof incomeCardCost!=='function')throw TypeError('PROBE_INCOME_OPPORTUNITY_QUOTE_REQUIRED');
      let best=null;
      for(const card of sources){
        if(!incomeCosts.has(card)){const cost=incomeCardCost(card);if(!Number.isFinite(cost))throw TypeError('PROBE_INCOME_OPPORTUNITY_INVALID');incomeCosts.set(card,{cardId:card.id,cost});}
        const source=incomeCosts.get(card);
        if(!best||source.cost<best.cost||source.cost===best.cost&&source.cardId.localeCompare(best.cardId)<0)best=source;
        if(arithmetic.sum([score,-paymentValue,-best.cost],weights)>=ceiling)return best;
      }
      return best;
    };
    const fundedGoals=[];
    for(const goal of requirements(facts)){
      if(goal.endpointFamily!=='orbit')continue;
      let score=0,incomes=0,supported=true;
      for(const effect of goal.endpointFacts.rewards){
        if(effect.type==='gain_resources'&&Object.values(effect.options.gain).every(n=>Number.isFinite(n)&&n>=0))score+=effect.options.gain.score||0;
        else if(effect.type==='income'&&(effect.options?.count||1)===1)incomes++;
        else{supported=false;break;}
      }
      if(!supported||!score||incomes>1)continue;
      const payment=funding(wallet,{...goal.endpointFacts.cost,energy:(goal.endpointFacts.cost.energy||0)+goal.route.cost},weights);
      if(!payment||score-payment.value<=0)continue;
      fundedGoals.push({goal,score,incomes,payment});
    }
    fundedGoals.sort((a,b)=>(b.score-b.payment.value)-(a.score-a.payment.value)||a.goal.requirementId.localeCompare(b.goal.requirementId));
    let best=null;
    for(const {goal,score,incomes,payment}of fundedGoals){
      const supplier=incomes?sufficientIncome(score,payment.value):null;if(incomes&&!supplier)continue;
      const net=arithmetic.sum([score,-payment.value,-(supplier?.cost||0)],weights),value=Math.min(ceiling,Math.max(0,net));
      if(value>0&&(!best||value>best.value||value===best.value&&goal.requirementId.localeCompare(best.goalId)<0))best={value,goalId:goal.requirementId,planetId:goal.planetId,
        scoreFloor:score,payment,knownIncomeCardId:supplier?.cardId||null,incomeCardOpportunityCost:supplier?.cost||0,netScoreFloor:net,replacementCeiling:ceiling,nextIncomeBudget:{...wallet}};
      // A complete known supplier has reached the universal replacement cap;
      // no unpriced source or later target can raise this scalar forecast.
      if(value>=ceiling)break;
    }
    return{value:best?.value||0,selected:best,reason:best?'known-income-funded-earth-probe-replacement':'no-funded-positive-next-orbit',
      scope:'One ordinary orbit paid from known next-round currency income alone, no current wallet/new card/landing/trace/data. Existing known income-card opportunity cost; positive score floor capped by standard launch replacement cost. Alternative to current mission capital, never a Native successor or admissible bound.'};
  }

  // A single known ordinary scan before queued income. No guessed refill,
  // settlement reward, optional effect or other owner supplies this data.
  function knownScanData(root,actor,effects,usedTokens=new Set()) {
    if(effects.length!==1||effects[0].type!=="scan_planet_sector")return 0;
    const options=effects[0].options||{};
    return Number(science.listScanStepChoices(root,actor,{mode:"planet",planetId:options.planetId,gainData:true}).some(a=>{
      const id=a.target.nebulaId,bucket=root.data.nebulae[id];
      const available={...root.data,nebulae:{...root.data.nebulae,[id]:{...bucket,tokens:bucket.tokens.filter(t=>!usedTokens.has(t.id))}}};
      return !!data.getNextReplaceableNebulaToken(available,id);
    }));
  }

  function funding(wallet, cost, weights) {
    if (cToE.gain.energy !== 1 || eToC.gain.credits !== 1) throw Error('PROBE_CAPITAL_EXCHANGE_CONTRACT_UNSUPPORTED');
    const c = cost.credits || 0, e = cost.energy || 0, a = cToE.cost.credits, b = eToC.cost.energy;
    if (!Number.isSafeInteger(c) || c < 0 || !Number.isSafeInteger(e) || e < 0) throw Error('PROBE_CAPITAL_ENDPOINT_COST_UNSUPPORTED');
    const choices = [];
    // One case per required credit (ordinary missions need at most one). Reserve costs before trades;
    // the energy-funding interval has a linear weighted cost, so use its end.
    for (let x = 0; x <= c; x++) {
      const lower = Math.max(0, e + b * x - wallet.energy);
      const upper = Math.min(e + b * x, Math.floor((wallet.credits - c + x) / a));
      if (lower > upper) continue;
      const y = a * weights.credits - weights.energy < 0 ? upper : lower;
      const spend = { credits: c - x + a * y, energy: e - y + b * x };
      choices.push({ spend, energyPurchases: y, creditPurchases: x,
        value: spend.credits * weights.credits + spend.energy * weights.energy });
    }
    choices.sort((a, b) => a.value - b.value || a.energyPurchases + a.creditPurchases - b.energyPurchases - b.creditPurchases);
    return choices[0] || null;
  }

  function pendingFinalMarkOption(facts) {
    const mark=facts.nextFinalMark;
    if(facts.terminal||!mark?.valuationSafe||mark.playerId!==facts.player.id||!Number.isFinite(facts.player.score)||facts.player.score<mark.threshold)return null;
    const placed=facts.computerSlots?.length||0;
    const incomeCard=placed<4&&facts.player.availableData>=4-placed?facts.hand.filter(c=>cards.getIncomeGainForCard(c)).sort((a,b)=>{
      const value=c=>Object.entries(cards.getIncomeGainForCard(c)).reduce((n,[k,v])=>n+v*({credits:1,energy:1,handSize:1,publicity:.5,availableData:.5}[k]||0),0);
      return value(b)-value(a)||incomeOrder.compare(a,b);
    })[0]:null;
    const projected={income:{...facts.player.income},companyBaseIncome:facts.player.companyBaseIncome};
    for(const[k,v]of Object.entries(incomeCard?cards.getIncomeGainForCard(incomeCard):{}))projected.income[k]=(projected.income[k]||0)+v;
    const options=mark.options.map(option=>({...option,forecast:incomeCard&&['a1','a2'].includes(option.formulaId)
      ?endScoring.getFormulaBaseValue(option.formulaId,projected,{})*option.multiplier:option.currentValue}))
      .sort((a,b)=>b.forecast-a.forecast||b.currentValue-a.currentValue);
    return options[0]||null;
  }
  function pendingFinalMarkCapital(facts) {
    return Math.max(0,pendingFinalMarkOption(facts)?.currentValue||0);
  }

  function factsFromObservation(observation, seatId) {
    const pub = observation.publicState, player = pub.players.find(p => p.playerId === seatId);
    if (!player || observation.selfState?.playerId !== seatId) throw new Error('PROBE_CAPITAL_VIEWER_MISMATCH');
    const facts={ player: { ...player, id: seatId }, board: pub.board, hand: observation.selfState.hand,
      nextFinalMark:observation.selfState.nextFinalMark,traceCounts:observation.selfState.traceCounts,
      uncontestedRound:Array.isArray(pub.activePlayerIds)&&pub.activePlayerIds.length>0&&pub.activePlayerIds.filter(id=>id!==seatId).every(id=>pub.passingPlayerIds.includes(id)),
      reservedCards: observation.selfState.reservedCards, pendingCardTriggers: observation.selfState.pendingCardTriggers,
      pendingHandCardTriggers: observation.selfState.pendingHandCardTriggers,
      pendingNativeEffects: observation.selfState.pendingNativeEffects,
      turnCardBonusCount: observation.selfState.turnCardBonusCount,
      researchSymbols: pub.board?.aliens?.amiba, amibaTraces: pub.board?.aliens?.amibaTraces,
      companyState: player.dataProgress?.blueSlots?.some(b=>b.slot<=2&&["blue1","blue2","blue4"].includes(b.tileId))&&observation.selfState.companyState ? { abilityId: observation.selfState.companyState.abilityId, roundMarkRound: observation.selfState.companyState.roundMarkRound, roundMarkTurn: observation.selfState.companyState.roundMarkTurn } : null,
      extraUnknownCount: 0, round: pub.roundNumber, passing: pub.passingPlayerIds.includes(seatId),
      terminal: observation.terminal ?? observation.outcomeProjection?.terminal,
      computerSlots: player.dataProgress?.computerSlots, blueSlots: player.dataProgress?.blueSlots };
    return{...facts,sourcePendingFinalMarkChoice:facts.amibaTraces&&facts.companyState?.abilityId==='deepspace_swap_cards'?pendingFinalMarkOption(facts):null};
  }

  // Only the selected player's public resources/owned technology and known
  // hand are used. Hidden alien identities and replacement cards are omitted.
  function researchFactsFromState(state, player) {
    return {reservedCards:player.reservedCards,pendingCardTriggers:cardEffects.listPendingTriggerKeys(player,state.turn),
      pendingHandCardTriggers:cardEffects.listPendingTriggerKeys({...player,reservedCards:player.hand||[]},state.turn),
      pendingNativeEffects:(state.pendingEffectOwnerIds||[]).includes(player.id),turnCardBonusCount:(state.turn.cardTurnEventBonuses||[]).length,researchSymbols:amiba.getPublicSymbolState(state.aliens,{readOnly:true}),amibaTraces:amiba.getPublicTraceState(state.aliens,{readOnly:true})};
  }
  function factsFromState(state, player) {
    const slots = Object.entries(state.aliens?.aliens || {}).map(([slotId, slot]) => ({
      slotId: Number(slotId), revealed: Boolean(slot.revealed), alienId:slot.revealed?(slot.alienId||slot.assignedAlienId||null):null, traces: slot.traces,
    }));
    const computerSlots=data.listComputerPlacedTokens(player).map(t=>t.placementSlot),usedBlue=data.listBlueBonusPlacedTokens(player);
    const blueSlots=Object.entries(player.techState?.blueBoardSlots||{}).filter(([id])=>player.techState.ownedTiles[id]&&!player.techState.disabledTiles[id]).map(([tileId,slot])=>({tileId,slot:Number(slot),
      occupied:usedBlue.some(t=>Number(t.blueSlot)===Number(slot)),unlocked:computerSlots.includes(data.getRequiredComputerSlotForBlueBonus(slot))})).sort((a,b)=>a.slot-b.slot);
    const unknown=state.cards?.unknownPublicSlotIndices,publicCards=unknown?.length?state.cards.publicCards.map((card,index)=>card||(unknown.includes(index)?{hidden:true,faceUp:false}:null)):state.cards?.publicCards;
    const nextFinalMark=endScoring.describeNextFinalMark({...state,cardEffects,getCardTypeCode:card=>cardEffects.getRuntimeCardTypeCode(card,cardEffects.getCardModel(card)?.cardType)},player);
    const active=state.turn.activePlayerIds,passed=state.passingPlayerIds||state.turn.passedPlayerIds||[];
    const facts={ ...researchFactsFromState(state,player),nextFinalMark,traceCounts:endScoring.getPlayerTraceCounts(player,state.aliens),uncontestedRound:Array.isArray(active)&&active.length>0&&active.filter(id=>id!==player.id).every(id=>passed.includes(id)),player: { ...player.resources, id: player.id, color: player.color, techState: player.techState, income: player.income,completedTaskCount:player.completedTaskCount,companyBaseIncome:endScoring.getPlayerCompanyBaseIncome(player) },
      board: { rockets: state.pieces?.rockets, planets: state.planets, data: state.data, solarSystem: state.solarSystem, finalScoring: state.finalScoring,
        publicCards, ordinaryDrawCount:Array.isArray(state.cards?.drawPileCardIds)?state.cards.drawPileCardIds.length:null, aliens: { slots } }, hand: player.hand,
      companyState: blueSlots.some(b=>b.slot<=2&&["blue1","blue2","blue4"].includes(b.tileId))?{ abilityId: industryCatalog.getPlayerIndustryDefinition(player)?.activeAbilityId ?? null, roundMarkRound: Number(player.industryRoundMarkRound) || 0, roundMarkTurn: Number(player.industryRoundMarkTurn) || 0 }:null,
      extraUnknownCount: Math.max(0, (player.resources.handSize || 0) - player.hand.length), round: state.turn.roundNumber,
      passing: (state.passingPlayerIds || state.turn.passedPlayerIds).includes(player.id) || player.passCompletionPending === true,
      terminal: state.turn.gameEnded === true,
      computerSlots,blueSlots };
    return{...facts,sourcePendingFinalMarkChoice:facts.amibaTraces&&facts.companyState?.abilityId==='deepspace_swap_cards'?pendingFinalMarkOption(facts):null};
  }

  function fromObservation(observation,seatId,weights,investment){return quote({...factsFromObservation(observation,seatId),investment},weights);}
  function fromState(state,player,weights,investment){return quote({...factsFromState(state,player),investment},weights);}
  return Object.freeze({ pendingFinalMarkOption,pendingFinalMarkCapital,ownedProbes, requirements, funding, nextIncomeLaunchReplacement, knownScanData, quote, factsFromObservation, factsFromState, researchFactsFromState, fromObservation, fromState });
});
