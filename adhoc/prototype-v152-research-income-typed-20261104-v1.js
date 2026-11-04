'use strict';
// Typed scalar version, independent of canonical hidden state and V observations.
const placement = require('../randomizer/game/data/placement');
const cards = require('../randomizer/game/cards/deck');
const effects = require('../randomizer/game/cards/effects');
const players = require('../randomizer/game/players');
const tech = require('../randomizer/game/tech/catalog');
const solar = require('../randomizer/solar-system/core');
const rocketAbility = require('../randomizer/game/abilities/rocket');
const zero = reason => ({ value: 0, selected: null, reason });
const quiet = cards => (cards || []).every(c => {
  const m = effects.getCardModel(c);
  return m && !m.endGameScoring && !m.triggers?.length && !m.temporaryTasks?.length;
});
function blueSlotFor(techState, slots) {
  const occupied = new Set(Object.values(techState.blueBoardSlots));
  const available = [1, 2, 3, 4].filter(slot => !occupied.has(slot));
  return available.sort((a, b) => {
    const x = placement.getRequiredComputerSlotForBlueBonus(a), y = placement.getRequiredComputerSlotForBlueBonus(b);
    return Number(slots.includes(y)) - Number(slots.includes(x)) || Math.max(0, x - slots.length) - Math.max(0, y - slots.length) || a - b;
  })[0];
}
function quote(facts, weights, portfolio, baseValue, technologyCapital) {
  if (facts.terminal || facts.passing || facts.round >= 4) return zero('research-window-closed');
  if (!quiet(facts.reservedCards)) return zero('reserved-card-needs-native-value');
  if (facts.computerSlots.includes(4)) return zero('income-already-used');
  const needed = [1, 2, 3, 4].filter(slot => !facts.computerSlots.includes(slot));
  if (facts.player.availableData < needed.length) return zero('existing-data-insufficient');
  if (facts.player.publicity < facts.researchCost) return zero('research-not-funded');
  const known = facts.board.publicCards.filter(c => c?.cardId && !c.hidden && cards.getIncomeGainForCard(c));
  if (!known.length) return zero('known-income-card-missing');
  const oldTech = facts.player.techState, blueSlot = blueSlotFor(oldTech, facts.computerSlots);
  const targets = Object.entries(facts.supply.stacks).filter(([id, stack]) => !oldTech.ownedTiles[id]
    && stack.remaining > 0 && !stack.bonusHidden && stack.bonusId === 'bonus_1c'
    && (tech.getTechType(id) !== 'blue' || blueSlot != null));
  if (!targets.length) return zero('known-selection-reward-missing');
  // Rotate only public geometry, using the native rule query on private data.
  // Other players' resource rewards do not enter our scalar; their piece slots
  // still rotate and reserve destinations in the native order.
  const rotated = { ...facts.player }, actor = { id: rotated.id, color: rotated.color,
    resources: rotated, techState: oldTech };
  const context = { players: { players: [actor] }, pieces: { rockets: structuredClone(facts.board.rockets) },
    solarSystem: structuredClone(facts.board.solarSystem), turn: { currentPlayerId: actor.id, roundNumber: facts.round } };
  const beforeRotation = context.solarSystem.rotation;
  context.solarSystem.rotation = solar.applySolarOrbitRotation(beforeRotation, 1);
  const rotation = rocketAbility.settleRocketsAfterSolarRotation(context, beforeRotation, context.solarSystem.rotation, { captureSnapshots: false });
  if (!rotation.ok) throw new Error('RESEARCH_INCOME_ROTATION_FAILED: ' + rotation.message);
  const oldCapability = technologyCapital(oldTech, facts.round, weights), candidates = [];
  for (const [tileId, stack] of targets) {
    const type = tech.getTechType(tileId), nextTech = { ...oldTech,
      ownedTiles: { ...oldTech.ownedTiles, [tileId]: true },
      blueBoardSlots: { ...oldTech.blueBoardSlots, ...(type === 'blue' ? { [tileId]: blueSlot } : {}) } };
    const supply = { ...facts.supply, stacks: { ...facts.supply.stacks,
      [tileId]: { ...stack, remaining: stack.remaining - 1, firstTakeClaimedBy: stack.firstTakeClaimedBy ?? facts.player.id, bonusId: null, bonusHidden: true } } };
    const prepared = { ...rotated, publicity: rotated.publicity - facts.researchCost,
      availableData: rotated.availableData - needed.length, techState: nextTech };
    const columns = Object.entries(nextTech.blueBoardSlots).filter(([id, slot]) => nextTech.ownedTiles[id]
      && !nextTech.disabledTiles[id] && needed.includes(placement.getRequiredComputerSlotForBlueBonus(slot))).length;
    players.gainResources({ resources: prepared }, { score: (stack.firstTakeClaimedBy == null ? tech.FIRST_TAKE_TYPE_SCORE : 0)
      + columns * placement.getBlueColumnScoreBonus().score,
      publicity: needed.includes(2) ? placement.getComputerSlotBonus(2).publicity : 0 });
    for (const card of known) {
      const gain = cards.getIncomeGainForCard(card), income = { ...facts.player.income }, wallet = { ...prepared, income };
      const { handSize = 0, ...resourceGain } = gain;
      players.gainResources({ resources: wallet }, resourceGain);
      for (const [key, amount] of Object.entries(gain)) income[key] += amount;
      wallet.handSize = facts.player.handSize + handSize;
      const board = { ...facts.board, rockets: context.pieces.rockets, solarSystem: context.solarSystem,
        publicCards: facts.board.publicCards.map(c => c?.id === card.id ? null : c) };
      const after = { ...facts, player: wallet, supply, board,
        computerSlots: [1, 2, 3, 4], extraUnknownCount: facts.extraUnknownCount + handSize };
      const resourceDelta = Object.entries(weights).reduce((n, [key, w]) => n + (key === 'handSize' ? handSize : wallet[key] - facts.player[key]) * w, 0);
      const incomeValue = Object.entries(gain).reduce((n, [key, amount]) => n + amount * (weights[key] || 0), 0) * (4 - facts.round);
      const linear = wallet.score - facts.player.score + resourceDelta + incomeValue
        + technologyCapital(nextTech, facts.round, weights) - oldCapability;
      const afterValue = portfolio(after), netGain = linear + afterValue - baseValue;
      candidates.push({ tileId, blueSlot: type === 'blue' ? blueSlot : null,
        incomeCardId: card.id, incomeCardIdentity: card.cardId, gain, linear, afterValue, netGain,
        wallet, computerSlots: after.computerSlots });
    }
  }
  candidates.sort((a, b) => b.netGain - a.netGain || a.tileId.localeCompare(b.tileId) || a.incomeCardId.localeCompare(b.incomeCardId));
  return { value: Math.max(0, candidates[0].netGain), selected: candidates[0], candidates,
    reason: candidates[0].netGain > 0 ? 'funded-research-income' : 'research-income-not-profitable',
    scope: 'One funded visible-selection research and known public income via existing data; joint wallet and native public rotation, no replacement card/bonus identity, no observation, search or pruning guarantee.' };
}
module.exports = { quote };
