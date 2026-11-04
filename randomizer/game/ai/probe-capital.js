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
    common ? require("../abilities/rocket") : root.SetiAbilityRocket);
  if (common) module.exports = api;
  else root.SetiProbeCapital = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (cards, data, science, alienState, trades, shared, planetAbility, rewards, solar, players, rockets, rocketAbility) {
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
        const move = rockets.canMoveFromCoordinate(pieces, next.coordinate, direction.deltaX, direction.deltaY, ship.id);
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
    if (facts.terminal || planningRound >= 4 || !ownedProbes(facts.board?.rockets, player).length) return zero();
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
    const capital = (hand, wallet, income) => {
      const key = JSON.stringify([wallet.credits, wallet.energy, wallet.publicity, income.credits, income.energy, hand.map(card => card.id)]);
      if (!capitalValues.has(key)) capitalValues.set(key, facts.investment(hand, wallet.publicity, { resources: wallet, income, startingIncome: Number(facts.passing) }));
      return capitalValues.get(key);
    };
    const initialCapital = capital(knownHand, player, player.income);
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
      const incomePurpose = (card, availableHand) => {
        const gain=cards.getIncomeGainForCard(card),immediate={...gain},nextWallet={...wallet},nextIncome={...income};
        if(immediate.publicity)immediate.publicity=Math.min(immediate.publicity,players.RESOURCE_LIMITS.publicity-wallet.publicity);
        if(immediate.availableData)immediate.availableData=Math.min(immediate.availableData,players.RESOURCE_LIMITS.availableData-wallet.availableData);
        for(const [key,amount]of Object.entries(immediate))if(key!=='handSize')nextWallet[key]=(nextWallet[key]||0)+amount;
        for(const [key,amount]of Object.entries(gain))nextIncome[key]=(nextIncome[key]||0)+amount;
        const after=capital(availableHand.filter(c=>c!==card),nextWallet,nextIncome);
        const linear=weighted(immediate)+weighted(gain)*(4-planningRound)-weights.handSize;
        return{card,gain,wallet:nextWallet,income:nextIncome,after,linear,value:linear+after-capital(availableHand,wallet,income)};
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
          const incomeLater = effects.slice(index + 1).some(e => e.type === 'income');
          const ranked = publicCards.map(card => ({ card, value: incomeLater ? incomePurpose(card, [...hand, card]).value
            : capital([...hand, card], wallet, income) - capital(hand, wallet, income) }))
            .sort((a, b) => b.value - a.value || a.card.id.localeCompare(b.card.id));
          const picked = ranked[0]?.card;
          if (picked) { hand.push(picked); publicCards.splice(publicCards.indexOf(picked), 1); } else unknownCount++;
          delta += weights.handSize; ledger.push({ type: effect.type, cardId: picked?.cardId || null, value: weights.handSize,
            policy: 'one fixed known income or held-purpose quote; not a claim of native card identity equivalence' });
        } else if (effect.type === 'income') {
          if ((options.count || 1) !== 1) { supported = false; break; }
          const before = capital(hand, wallet, income);
          const ranked = hand.filter(card=>cards.getIncomeGainForCard(card)).map(card=>incomePurpose(card,hand))
            .sort((a, b) => b.value - a.value || a.card.id.localeCompare(b.card.id));
          if (!ranked.length) {
            if (unknownCount) supported = false;
            ledger.push({ type: effect.type, value: 0, unresolvedUnknownIncome: unknownCount > 0 });
            continue;
          }
          const chosen = ranked[0]; hand.splice(hand.indexOf(chosen.card), 1);
          unknownCount += chosen.gain.handSize || 0;
          Object.assign(wallet,chosen.wallet);Object.assign(income,chosen.income);
          const linear = chosen.linear;
          delta += linear; ledger.push({ type: effect.type, cardId: chosen.card.cardId, gain: chosen.gain, value: linear,
            handPurposeCost: before - capital(hand, wallet, income) });
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
      const capitalDelta = capital(hand, wallet, income) - initialCapital;
      candidates.push({ id: goal.requirementId, family: goal.endpointFamily, planet: goal.planetId, funded: true,
        supported, payment, route: goal.route, ledger, capitalDelta, value: supported ? Math.max(0, delta + capitalDelta) : 0 });
    }
    const ranked = candidates.filter(c => c.funded && c.supported).sort((a, b) => b.value - a.value || a.id.localeCompare(b.id));
    return { value: ranked[0]?.value || 0, selected: ranked[0] || null, candidates,
      scope: 'One current-wallet-funded ordinary mission with its complete paid geometric route; maximum, not sum. No future income, card moves, arrival triggers or opponent changes. Forecast hypothesis, never an admissible bound.' };
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

  function fromObservation(observation, seatId, weights, investment) {
    const pub = observation.publicState, player = pub.players.find(p => p.playerId === seatId);
    if (!player || observation.selfState?.playerId !== seatId) throw new Error('PROBE_CAPITAL_VIEWER_MISMATCH');
    return quote({ player: { ...player, id: seatId }, board: pub.board, hand: observation.selfState.hand,
      extraUnknownCount: 0, round: pub.roundNumber, passing: pub.passingPlayerIds.includes(seatId),
      terminal: observation.terminal ?? observation.outcomeProjection?.terminal, investment }, weights);
  }

  // Only the selected player's public resources/owned technology and known
  // hand are used. Hidden alien identities and replacement cards are omitted.
  function fromState(state, player, weights, investment) {
    const slots = Object.entries(state.aliens?.aliens || {}).map(([slotId, slot]) => ({
      slotId: Number(slotId), revealed: Boolean(slot.revealed), traces: slot.traces,
    }));
    return quote({ player: { ...player.resources, id: player.id, color: player.color, techState: player.techState, income: player.income },
      board: { rockets: state.pieces?.rockets, planets: state.planets, data: state.data, solarSystem: state.solarSystem,
        publicCards: state.cards?.publicCards, aliens: { slots } }, hand: player.hand,
      extraUnknownCount: Math.max(0, (player.resources.handSize || 0) - player.hand.length), round: state.turn.roundNumber,
      passing: (state.passingPlayerIds || state.turn.passedPlayerIds).includes(player.id) || player.passCompletionPending === true,
      terminal: state.turn.gameEnded === true, investment }, weights);
  }

  return Object.freeze({ ownedProbes, funding, fromObservation, fromState });
});
