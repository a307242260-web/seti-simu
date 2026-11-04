'use strict';
// Independent purpose quote. This is not loaded by Production, does not create
// observations/search nodes and cannot supply a pruning or equivalence proof.
const players = require('../randomizer/game/players');
const data = require('../randomizer/game/data');
const cards = require('../randomizer/game/cards/deck');
const effects = require('../randomizer/game/cards/effects');
const tech = require('../randomizer/game/tech');
const turnFlow = require('../randomizer/game/turn-flow');
const demand = require('../randomizer/game/ai/resource-demand');
const values = require('../randomizer/game/ai/state-value');
const end = require('../randomizer/game/end-game-scoring');
const owner = (s, id) => s.players.players.find(p => p.id === id);
const quiet = p => (p.reservedCards || []).every(c => {
  const m = effects.getCardModel(c);
  return m && !m.endGameScoring && !m.triggers?.length && !m.temporaryTasks?.length;
});
const weights = values.DEFAULT_WEIGHTS;
function score(state, player) {
  return end.computePlayerFinalScore({ ...state, players: state.players.players,
    cardEffects: effects, getCardTypeCode: c => effects.getRuntimeCardTypeCode(c, effects.getCardModel(c)?.cardType) }, player).totalScore;
}
function valueParts(state, player) {
  return {
    score: score(state, player),
    resources: Object.entries(weights).reduce((n, [k, w]) => n + (k === 'handSize' ? 0 : player.resources[k] * w), 0),
    hand: player.resources.handSize * weights.handSize,
    income: Object.entries(player.income).reduce((n, [k, v]) => n + v * (weights[k] || 0), 0) * (4 - state.turn.roundNumber),
    technology: values.technologyCapital(player.techState, state.turn.roundNumber),
    purpose: demand.planningCapital(state, player),
  };
}
const total = parts => Object.values(parts).reduce((n, v) => n + v, 0);
function researchIncomeCapital(state, seatId) {
  const player = owner(state, seatId), round = state.turn.roundNumber;
  const zero = reason => ({ available: false, reason, netGain: 0, plans: [] });
  if (state.turn.gameEnded || round >= 4 || state.turn.passedPlayerIds.includes(seatId) || player.passCompletionPending) return zero('research-window-closed');
  if (!quiet(player)) return zero('reserved-card-needs-native-value');
  const placed = data.listComputerPlacedTokens(player).map(t => t.placementSlot);
  if (placed.includes(4)) return zero('income-already-used');
  const needed = [1, 2, 3, 4].filter(slot => !placed.includes(slot)).length;
  if (player.resources.availableData < needed) return zero('existing-data-insufficient');
  const cost = tech.resolver.getResearchPublicityCost(player);
  if (player.resources.publicity < cost) return zero('research-not-funded');
  const known = state.cards.publicCards.filter(c => c?.cardId && !c.hidden && cards.getIncomeGainForCard(c));
  if (!known.length) return zero('known-income-card-missing');
  const legal = tech.listTakeableTiles(state.tech, player.techState).filter(tileId => {
    const stack = state.tech.stacks[tileId];
    return !stack.bonusHidden && stack.bonusId === 'bonus_1c';
  });
  const targets = demand.greedyTechPlans({ state, seatId, plans: legal.flatMap(tileId => tech.getTechType(tileId) === 'blue'
    ? tech.getAvailableBlueSlots(player.techState).map(blueSlot => ({ tileId, blueSlot }))
    : [{ tileId, blueSlot: null }]) });
  if (!targets.length) return zero('known-selection-reward-missing');
  const before = valueParts(state, player), plans = [];
  for (const target of targets) for (const card of known) {
    const next = structuredClone(state), p = owner(next, seatId);
    const rotation = turnFlow.rotateSolarSystem(next, 1, seatId, { captureSnapshots: false });
    if (!rotation.ok) throw new Error('RESEARCH_INCOME_ROTATION_FAILED: ' + rotation.message);
    if (!players.spendResources(p, { publicity: cost }).ok) throw new Error('RESEARCH_INCOME_PAYMENT_FAILED');
    const taken = tech.resolver.takeSelectedTechTile({ ...next, turn: { ...next.turn, currentPlayerId: seatId } }, target);
    if (!taken.ok || taken.bonusId !== 'bonus_1c') throw new Error('RESEARCH_INCOME_TAKE_FAILED: ' + taken.message);
    if (taken.firstTake) players.gainResources(p, { score: tech.FIRST_TAKE_TYPE_SCORE });
    // Never quote a replacement card or the newly uncovered supply bonus.
    next.tech.stacks[target.tileId].bonusHidden = true;
    next.tech.stacks[target.tileId].bonusId = null;
    next.cards.publicCards = next.cards.publicCards.map(c => c?.id === card.id ? null : c);
    p.hand.push(structuredClone(card));
    p.resources.handSize++;
    let actualPlacements = 0;
    while (!data.listComputerPlacedTokens(p).some(t => t.placementSlot === 4)) {
      const r = data.placeDataToComputer(p);
      if (!r.ok) throw new Error('RESEARCH_INCOME_DATA_FAILED: ' + r.message);
      actualPlacements++;
      for (const bonus of r.slotBonuses || []) {
        if (bonus.type === 'income') continue;
        if (!['score', 'publicity'].includes(bonus.type)) throw new Error('RESEARCH_INCOME_BONUS_UNSUPPORTED');
        players.gainResources(p, { [bonus.type]: bonus[bonus.type] });
      }
    }
    const gain = cards.getIncomeGainForCard(card);
    p.hand = p.hand.filter(c => c.id !== card.id);
    let unknownDraws = 0;
    players.gainIncome(p, gain, {
      blindDraw: () => { unknownDraws++; },
      gainData: actor => data.gainData(actor, { root: next }),
    });
    p.resources.handSize = p.hand.length + unknownDraws + Math.max(0, player.resources.handSize - player.hand.length);
    const after = valueParts(next, p), netGain = total(after) - total(before);
    plans.push({ ...target, incomeCardId: card.id, incomeCardIdentity: card.cardId,
      gain, netGain, before, after, placements: actualPlacements,
      nativeInputLowerBound: 2 + 1 + 2 * actualPlacements + 1,
      assets: { resources: p.resources, income: p.income, tech: p.techState,
        computerSlots: data.listComputerPlacedTokens(p).map(t => t.placementSlot) } });
  }
  plans.sort((a, b) => b.netGain - a.netGain || a.tileId.localeCompare(b.tileId) || a.incomeCardId.localeCompare(b.incomeCardId));
  return { available: true, netGain: Math.max(0, plans[0].netGain), selected: plans[0], plans,
    scope: 'One current-funded research with a visible card-selection reward, its already public income card and existing data through computer4. Private native-rule containers only; new card/bonus identities omitted. Forecast hypothesis, no search or pruning guarantee.' };
}
module.exports = { researchIncomeCapital, valueParts, total };
