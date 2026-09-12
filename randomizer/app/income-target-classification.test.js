"use strict";
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("./simulation-env");
const cards = require("../game/cards/deck");
const effects = require("../game/cards/effects");
function drainOpeningDecisions(environment) {
  const selectionProgress = new Map();
  let guard = 0;
  while (environment.legalActions()[0]?.family?.startsWith("choose_")) {
    const actions = environment.legalActions();
    const actorId = actions[0].actorId;
    const progress = selectionProgress.get(actorId) || { industry: false, initialIds: new Set() };
    let action = actions.find((candidate) => candidate.target?.kind === "start_initial_setup")
      || actions.find((candidate) => candidate.target?.kind === "confirm_initial_setup");
    if (!action && !progress.industry) {
      action = actions.find((candidate) => (
        candidate.target?.kind === "select_initial_card"
        && candidate.target?.selectionKind === "industry"
      ));
      if (action) progress.industry = true;
    }
    if (!action && progress.initialIds.size < 2) {
      action = actions.find((candidate) => (
        candidate.target?.kind === "select_initial_card"
        && candidate.target?.selectionKind === "initial"
        && !progress.initialIds.has(candidate.target.cardId)
      ));
      if (action) progress.initialIds.add(action.target.cardId);
    }
    action = action || actions[0];
    selectionProgress.set(actorId, progress);
    assert.equal(environment.step(action).ok, true);
    guard += 1;
    assert.ok(guard < 50, "opening Decision 必须经标准初始选择与收入链有限结束");
  }
}
const env = createSimulationEnv();
try {
  env.reset({ seed: "income-target-classification", activePlayerCount: 4 });
  drainOpeningDecisions(env);
  const checkpoint = structuredClone(env.createCheckpoint());
  const types = [effects.EFFECT_TYPES.DISCARD_ANY_FOR_INCOME,
    effects.EFFECT_TYPES.INCOME, effects.EFFECT_TYPES.TUCK_PLAYED_CARD_TO_INCOME];
  const hand = types.map((type, index) => {
    const entry = cards.CARD_CATALOG.find(c => effects.buildPlayEffects(cards.createCardInstance(c, 900 + index))
      .some(effect => effect.type === type));
    assert(entry, `缺少正式牌样本 ${type}`);
    const { cardName, src, ...committedCard } = cards.createCardInstance(entry, 900 + index);
    return committedCard;
  });
  let seat;
  for (const owner of [checkpoint.coreState, checkpoint.coreState.compositionEnvelope]) {
    const state = JSON.parse(owner.committedState);
    const selectedIds = new Set(hand.map(c => c.cardId));
    const keep = card => !selectedIds.has(card?.cardId);
    for (const p of state.players.players) {
      p.hand = p.hand.filter(keep);
      p.reservedCards = p.reservedCards.filter(keep);
      p.resources.handSize = p.hand.length;
    }
    state.cards.publicCards = state.cards.publicCards.map(c => keep(c) ? c : null);
    state.cards.discardPile = state.cards.discardPile.filter(keep);
    for (const key of Object.keys(state.cards.passReservePiles)) {
      state.cards.passReservePiles[key] = state.cards.passReservePiles[key].filter(keep);
    }
    state.cards.drawPileCardIds = state.cards.drawPileCardIds.filter(id => !selectedIds.has(id));
    state.meta.sequences.card = Math.max(state.meta.sequences.card, 903);
    seat = state.turn.currentPlayerId;
    const player = state.players.players.find(p => p.id === seat);
    player.hand = structuredClone(hand);
    player.resources.handSize = hand.length;
    owner.committedState = JSON.stringify(state);
  }
  // 使用已构造的状态；保留开局replay会走重放分支并重新生成原来的手牌。
  checkpoint.replaySteps = null;
  env.loadCheckpoint(checkpoint);
  const observation = env.observe(seat);
  assert.deepEqual(observation.selfState.hand.map(c => c.id), hand.map(c => c.id));
  const plans = observation.incomeGainRequirements.plans.filter(p => p.kind === "card");
  assert(!plans.some(p => p.cardInstanceId === hand[0].id), "一次性收入角资源不得绑定永久收入目标");
  for (const card of hand.slice(1)) assert(plans.some(p => p.cardInstanceId === card.id), "真正增加收入的牌必须保留");
  console.log("income target classification tests passed");
} finally { env.dispose(); }
