'use strict';
// Unadmitted value hypothesis. Only public native facts are consumed; this
// does not execute actions or manufacture an observation/successor envelope.
const cards = require('../randomizer/game/cards/deck');
const data = require('../randomizer/game/data');
const science = require('../randomizer/game/effects/science-session');
const alienState = require('../randomizer/game/aliens/state');
const values = require('../randomizer/game/ai/state-value');
const trades = require('../randomizer/game/actions/quick-trades');
const ordinary = new Set(['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
const cToE = trades.TRADE_ACTIONS.find(t => t.id === 'credits-for-energy');
const eToC = trades.TRADE_ACTIONS.find(t => t.id === 'energy-for-credit');

function funding(wallet, cost, weights) {
  if (cToE.gain.energy !== 1 || eToC.gain.credits !== 1) throw Error('PROTOTYPE_EXCHANGE_CONTRACT_UNSUPPORTED');
  const c = cost.credits || 0, e = cost.energy || 0, a = cToE.cost.credits, b = eToC.cost.energy;
  if (!Number.isSafeInteger(c) || c < 0 || c > 1 || !Number.isSafeInteger(e) || e < 0) throw Error('PROTOTYPE_ENDPOINT_COST_UNSUPPORTED');
  const choices = [];
  // At most two credit-funding cases. Reserve endpoint costs before trades;
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

function atPlanetCapital(observation, seatId, weights = values.DEFAULT_WEIGHTS) {
  const pub = observation.publicState, player = pub.players.find(p => p.playerId === seatId);
  const planningRound = pub.roundNumber + Number(pub.passingPlayerIds.includes(seatId));
  const probes = (pub.board.rockets || []).filter(r => r.surface === 'solar-board'
    && (r.kind || 'standard') === 'standard' && r.fossilId == null
    && (r.playerId === seatId || !r.playerId && [r.playerColor, r.color].includes(player.color)));
  if (observation.terminal || planningRound >= 4 || !probes.length) return { value: 0, candidates: [], selected: null };
  if (observation.probeRouteRequirements?.playerId !== seatId) throw Error('PROTOTYPE_NATIVE_ROUTES_MISSING');
  if (!pub.board.data || !pub.board.solarSystem) throw Error('PROTOTYPE_PUBLIC_SCAN_FACTS_MISSING');
  const knownHand = observation.selfState.hand.filter(c => !c.hidden && c.cardId);
  const capital = (hand, publicity) => values.handCapital(hand, player.techState, pub.board.techSupply, planningRound, weights)
    + values.researchCapital({ hand, techState: player.techState, supply: pub.board.techSupply,
      round: planningRound, publicity, researchCost: player.researchPublicityCost }, weights);
  const initialCapital = capital(knownHand, player.publicity);
  const root = { data: pub.board.data, solarSystem: pub.board.solarSystem };
  const actor = { id: seatId, color: player.color };
  const candidates = [];
  for (const goal of observation.probeRouteRequirements.candidates) {
    if (goal.launchRequired || !probes.some(r => r.id === goal.rocketId) || !ordinary.has(goal.planetId)
      || goal.required.movementSteps !== 0) continue;
    const payment = funding(player, goal.endpointFacts.cost, weights);
    if (!payment) { candidates.push({ id: goal.requirementId, funded: false, value: 0 }); continue; }
    const hand = knownHand.slice(), publicCards = (pub.board.publicCards || []).filter(c => c && !c.hidden && c.cardId);
    const wallet = { credits: player.credits - payment.spend.credits, energy: player.energy - payment.spend.energy,
      publicity: player.publicity, availableData: player.availableData };
    let delta = -payment.value, unknownCount = observation.selfState.hand.length - hand.length, supported = true;
    const firstYellow = new Set((pub.board.aliens.slots || []).filter(s => !s.revealed && !s.traces?.yellow?.firstPlaced).map(s => s.slotId));
    const usedTokens = new Set(), effects = goal.endpointFacts.rewards, ledger = [];
    const weighted = gain => Object.entries(gain).reduce((n, [k, amount]) => n + amount * (k === 'score' ? 1 : weights[k] || 0), 0);
    const incomeValue = card => weighted(cards.getIncomeGainForCard(card) || {}) * (5 - planningRound);
    for (let index = 0; index < effects.length && supported; index++) {
      const effect = effects[index], options = effect.options || {};
      if (effect.type === 'gain_resources') {
        const gain = { ...options.gain };
        if (gain.publicity) gain.publicity = Math.min(gain.publicity, 10 - wallet.publicity);
        for (const [k, amount] of Object.entries(gain)) if (k !== 'score') wallet[k] = (wallet[k] || 0) + amount;
        const value = weighted(gain); delta += value; ledger.push({ type: effect.type, gain, value });
      } else if (effect.type === 'gain_data') {
        const count = Math.min(options.count || 1, 6 - wallet.availableData), value = count * weights.availableData;
        wallet.availableData += count; delta += value; ledger.push({ type: effect.type, count, value });
      } else if (effect.type === 'draw_cards') {
        const count = options.count || 1, value = count * weights.handSize;
        unknownCount += count; delta += value; ledger.push({ type: effect.type, count, value, identityKnown: false });
      } else if (effect.type === 'pick_card') {
        if ((options.count || 1) !== 1) { supported = false; break; }
        const incomeLater = effects.slice(index + 1).some(e => e.type === 'income');
        const ranked = publicCards.map(card => ({ card, value: incomeLater ? incomeValue(card)
          : capital([...hand, card], wallet.publicity) - capital(hand, wallet.publicity) }))
          .sort((a, b) => b.value - a.value || a.card.id.localeCompare(b.card.id));
        const picked = ranked[0]?.card;
        if (picked) { hand.push(picked); publicCards.splice(publicCards.indexOf(picked), 1); } else unknownCount++;
        delta += weights.handSize; ledger.push({ type: effect.type, cardId: picked?.cardId || null, value: weights.handSize,
          policy: 'one fixed known income or held-purpose quote; not a claim of native card identity equivalence' });
      } else if (effect.type === 'income') {
        if ((options.count || 1) !== 1) { supported = false; break; }
        const before = capital(hand, wallet.publicity);
        const ranked = hand.map(card => ({ card, gain: cards.getIncomeGainForCard(card), value: incomeValue(card) - weights.handSize
          + capital(hand.filter(c => c !== card), wallet.publicity) - before }))
          .filter(r => r.gain).sort((a, b) => b.value - a.value || a.card.id.localeCompare(b.card.id));
        if (!ranked.length) {
          if (unknownCount) supported = false;
          ledger.push({ type: effect.type, value: 0, unresolvedUnknownIncome: unknownCount > 0 });
          continue;
        }
        const chosen = ranked[0]; hand.splice(hand.indexOf(chosen.card), 1);
        unknownCount += chosen.gain.handSize || 0;
        const linear = incomeValue(chosen.card) - weights.handSize;
        delta += linear; ledger.push({ type: effect.type, cardId: chosen.card.cardId, gain: chosen.gain, value: linear,
          handPurposeCost: before - capital(hand, wallet.publicity) });
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
          return [{ id, tokenId: token.id, value: score + Number(wallet.availableData < 6) * weights.availableData,
            score, data: Number(wallet.availableData < 6) }];
        }).sort((a, b) => b.value - a.value || a.id.localeCompare(b.id));
        const selected = quotes[0];
        if (selected) { usedTokens.add(selected.tokenId); wallet.availableData += selected.data; delta += selected.value; }
        ledger.push({ type: effect.type, selected, value: selected?.value || 0,
          excluded: 'sector completion, triggered rewards, new identities and additional technology movement' });
      } else if (effect.type === 'alien_trace' && options.traceType === 'yellow') {
        for (let n = 0; n < (options.count || 1); n++) {
          const choices = [...firstYellow].map(slotId => ({ slotId, gain: alienState.getFirstTraceRewardForSlot(slotId).gain }));
          if ((pub.board.aliens.slots || []).some(s => s.traces?.yellow?.firstPlaced) || ledger.some(e => e.type === 'alien_trace'))
            choices.push({ slotId: null, gain: alienState.getExtraTraceReward().gain });
          const ranked = choices.map(c => ({ ...c, gain: { ...c.gain,
            ...(c.gain.publicity ? { publicity: Math.min(c.gain.publicity, 10 - wallet.publicity) } : {}) } }))
            .map(c => ({ ...c, value: weighted(c.gain) })).sort((a, b) => b.value - a.value || (a.slotId || 9) - (b.slotId || 9));
          const selected = ranked[0];
          if (!selected) { supported = false; break; }
          firstYellow.delete(selected.slotId); wallet.publicity += selected.gain.publicity || 0; delta += selected.value;
          ledger.push({ type: effect.type, firstYellowSlot: selected.slotId, gain: selected.gain, value: selected.value,
            excluded: 'revealed-species effects, score-threshold neutral traces and future discovery' });
        }
      } else { supported = false; ledger.push({ type: effect.type, unsupported: true }); }
    }
    const capitalDelta = capital(hand, wallet.publicity) - initialCapital;
    candidates.push({ id: goal.requirementId, family: goal.endpointFamily, planet: goal.planetId, funded: true,
      supported, payment, ledger, capitalDelta, value: supported ? Math.max(0, delta + capitalDelta) : 0 });
  }
  const ranked = candidates.filter(c => c.funded && c.supported).sort((a, b) => b.value - a.value || a.id.localeCompare(b.id));
  return { value: ranked[0]?.value || 0, selected: ranked[0] || null, candidates,
    scope: 'One currently funded at-planet ordinary mission, max not sum. Public known reward-chain hypothesis only; no production use or admissible-bound claim.' };
}
module.exports = { atPlanetCapital, funding };
