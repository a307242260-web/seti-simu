"use strict";

const assert = require("node:assert/strict");
const standardAction = require("../game/actions/standard-action");
const quickTrades = require("../game/actions/quick-trades");
const cards = require("../game/cards/deck");
const cardEffects = require("../game/cards/effects");
const players = require("../game/players");
const { createSimulationEnv } = require("../app/simulation-env");
const { createSimulationRuleComposition } = require("./simulation-rule-composition");

function createSeededRandom(seed) {
  let state = [...String(seed)].reduce(
    (hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0,
    2166136261,
  ) || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

function finishOpening(kernel) {
  assert.equal(kernel.composition.inputPort.beginDrain().ok, true);
  for (let step = 0; step < 30 && kernel.composition.inspect().phase === "awaiting_input"; step += 1) {
    const decision = kernel.composition.inspect().session.decision;
    const submitted = kernel.composition.inputPort.submitDecision({
      decisionId: decision.decisionId,
      decisionVersion: decision.decisionVersion,
      choice: decision.choices[0],
    });
    assert.equal(submitted.ok, true, `opening Decision ${step} 必须可提交`);
  }
  assert.equal(kernel.composition.inspect().phase, "idle");
}

function createCard(cardInput) {
  const card = cards.createCardInstance(cards.getCatalogEntryByInput(cardInput), 0);
  delete card.cardName;
  delete card.src;
  return card;
}

function restoreScenario(kernel, mutate) {
  const saved = kernel.composition.lifecycle.save().envelope;
  const state = JSON.parse(saved.committedState);
  delete state.match.pendingDecision;
  delete state.match.initialIncomeQueue;
  mutate(state, state.players.players.find((player) => player.id === state.turn.currentPlayerId));
  const restored = kernel.composition.lifecycle.restore({
    ...saved,
    committedState: JSON.stringify(state),
    session: null,
  });
  assert.equal(restored.ok, true, JSON.stringify(restored));
  return state;
}

function identityView(actions) {
  return actions.map((action) => ({
    family: action.family,
    actionId: action.actionId,
    actorId: action.actorId,
    stateVersion: action.stateVersion,
    decisionVersion: action.decisionVersion,
    target: action.target,
    payload: action.payload,
  }));
}

function submitActionToCompletion(composition, action, quick = false) {
  let result = quick
    ? composition.inputPort.submitQuickAction(action)
    : composition.inputPort.submitAction(action);
  assert.equal(result.ok, true, `${action.family}/${action.target?.tradeId || action.actionId} 必须可提交`);
  for (let step = 0; step < 10 && composition.inspect().phase === "awaiting_input"; step += 1) {
    const decision = composition.inspect().session.decision;
    assert.ok(decision.choices.length, `${decision.decisionKind} 必须有合法选择`);
    result = composition.inputPort.submitDecision({
      decisionId: decision.decisionId,
      decisionVersion: decision.decisionVersion,
      choice: decision.choices[0],
    });
    assert.equal(result.ok, true);
  }
  assert.notEqual(composition.inspect().phase, "awaiting_input", "代表行动不得遗留未完成 Decision");
  return result;
}

function enumerateBrowserProductionPort(state, family) {
  const context = {
    playerState: {
      currentPlayerId: state.turn.currentPlayerId,
      players: structuredClone(state.players.players),
    },
    cardState: structuredClone(state.cards),
  };
  const registry = standardAction.createRegistry({
    getAuthority: () => ({
      actorId: state.turn.currentPlayerId,
      stateVersion: state.meta.stateVersion,
      decisionVersion: state.match.decisionVersion,
    }),
  });
  registry.register(standardAction.createOptionDefinition(
    "quick_trade",
    standardAction.createQuickTradeProvider({ quickTrades }),
  ));
  registry.register(standardAction.createOptionDefinition(
    "play_card",
    standardAction.createPlayCardProvider({
      players,
      cards,
      getCardPlayCost: cardEffects.getCardPlayCost,
    }),
  ));
  return registry.enumerate(context, { family });
}

const config = {
  seed: "seti-140-production-standard-action",
  activePlayerCount: 4,
  aiDifficulty: "weak_start",
};
const kernel = createSimulationRuleComposition({
  ...config,
  random: createSeededRandom(config.seed),
});

assert.deepEqual(
  kernel.actionContract.coverage().map(({ family, registered }) => ({ family, registered })),
  standardAction.ALL_FAMILIES.map((family) => ({ family, registered: true })),
  "生产 Simulation composition 必须唯一注册全部 22 个 Standard Action family",
);
for (const entry of kernel.actionContract.coverage()) {
  assert.equal(entry.phase, standardAction.PHASE_BY_FAMILY[entry.family]);
  assert.match(entry.obligation, /\S/, `${entry.family} 必须声明生产 obligation`);
  if (entry.status === "unavailable") {
    assert.match(entry.unavailableReason, /\S/, `${entry.family} 不可合法时必须声明原因`);
  } else {
    assert.equal(entry.status, "supported");
    assert.equal(entry.unavailableReason, null);
  }
}

assert.equal(kernel.newGame(config).ok, true);
assert.equal(kernel.composition.inputPort.beginDrain().ok, true);
const inspection = kernel.composition.inspect();
const openingAction = inspection.session.decision.choices.find(
  (choice) => choice.family === "choose_payment",
);
assert.ok(openingAction, "生产 opening 状态必须产生真实 choose_payment Standard Action");
const before = kernel.composition.stateSourcePort.read().state;
const submitted = kernel.composition.inputPort.submitDecision({
  decisionId: inspection.session.decision.decisionId,
  decisionVersion: inspection.session.decision.decisionVersion,
  choice: openingAction,
});
assert.equal(submitted.ok, true, "生产 composition 必须正式执行已注册 Standard Action");
const after = kernel.composition.stateSourcePort.read().state;
assert.notDeepEqual(after.match.initialIncomeQueue, before.match.initialIncomeQueue);

const stale = kernel.composition.inputPort.submitDecision({
  decisionId: inspection.session.decision.decisionId,
  decisionVersion: inspection.session.decision.decisionVersion,
  choice: openingAction,
});
assert.equal(stale.ok, false, "过期 Decision 必须在 handler 前拒绝");

kernel.composition.dispose();

{
  const parityConfig = {
    seed: "seti-158-quick-trade-parity",
    activePlayerCount: 4,
    aiDifficulty: "weak_start",
  };
  const parityKernel = createSimulationRuleComposition({
    ...parityConfig,
    random: createSeededRandom(parityConfig.seed),
  });
  assert.equal(parityKernel.newGame(parityConfig).ok, true);
  finishOpening(parityKernel);
  const scenario = restoreScenario(parityKernel, (_state, player) => {
    player.resources.credits = 11;
    player.resources.energy = 3;
    player.resources.publicity = 3;
    player.mainActionCompleted = false;
  });
  const simulationTrades = parityKernel.composition.inputPort.enumerateActions({ family: "quick_trade" });
  assert.deepEqual(
    simulationTrades.map((action) => action.target.tradeId),
    quickTrades.TRADE_ACTIONS.map((trade) => trade.id),
    "富资源代表状态必须枚举全部生产快速交易",
  );
  assert.deepEqual(
    identityView(simulationTrades),
    identityView(enumerateBrowserProductionPort(scenario, "quick_trade")),
    "Browser/Simulation 必须共用 quick_trade descriptor identity",
  );
  const richEnvelope = parityKernel.composition.lifecycle.save().envelope;
  for (const trade of quickTrades.TRADE_ACTIONS) {
    assert.equal(parityKernel.composition.lifecycle.restore(richEnvelope).ok, true);
    const action = parityKernel.composition.inputPort.enumerateActions({ family: "quick_trade" })
      .find((candidate) => candidate.target.tradeId === trade.id);
    assert.ok(action, `${trade.id} 必须保持生产可枚举`);
    const completed = submitActionToCompletion(parityKernel.composition, action, true);
    assert.equal(completed.phase, "completed", `${trade.id} 必须经 Effect Session 提交`);
    assert.equal(completed.journal.actions[0].action.actionId, action.actionId);
  }
  assert.equal(parityKernel.composition.lifecycle.restore(richEnvelope).ok, true);
  const routeBefore = parityKernel.composition.stateSourcePort.read().state
    .probeRouteRequirements.candidates.find((candidate) => candidate.gap.energy > 0);
  assert.ok(routeBefore, "11 信用 3 能源代表状态必须存在缺能源路线");
  const energyTrade = simulationTrades.find((action) => action.target.tradeId === "credits-for-energy");
  const tradeResult = parityKernel.composition.inputPort.submitQuickAction(energyTrade);
  assert.equal(tradeResult.ok, true);
  assert.equal(tradeResult.journal.actions.length, 1);
  assert.ok(tradeResult.journal.effects.length >= 1);
  const tradePlayer = parityKernel.composition.stateSourcePort.read().state.players.players
    .find((player) => player.id === scenario.turn.currentPlayerId);
  assert.equal(tradePlayer.resources.credits, 9);
  assert.equal(tradePlayer.resources.energy, 4);
  const routeAfter = parityKernel.composition.stateSourcePort.read().state
    .probeRouteRequirements.candidates.find((candidate) => candidate.requirementId === routeBefore.requirementId);
  assert.equal(routeAfter.gap.energy, routeBefore.gap.energy - 1,
    "2 信用→1 能源后同一探测器路线缺口必须下降");
  const committedAfterTrade = parityKernel.composition.stateSourcePort.read().state;
  assert.equal(parityKernel.composition.inputPort.submitQuickAction(energyTrade).ok, false,
    "stale 快速交易不得重复提交");
  assert.deepEqual(parityKernel.composition.stateSourcePort.read().state, committedAfterTrade,
    "stale 快速交易不得污染 committed state");
  parityKernel.composition.dispose();
}

{
  const cardConfig = {
    seed: "seti-158-play-card-parity",
    activePlayerCount: 4,
    aiDifficulty: "weak_start",
  };
  const cardKernel = createSimulationRuleComposition({
    ...cardConfig,
    random: createSeededRandom(cardConfig.seed),
  });
  assert.equal(cardKernel.newGame(cardConfig).ok, true);
  finishOpening(cardKernel);
  const directCard = createCard("dlc_10");
  const directScenario = restoreScenario(cardKernel, (_state, player) => {
    player.resources.credits = 20;
    player.resources.publicity = 0;
    player.hand = [directCard];
    player.resources.handSize = 1;
    player.mainActionCompleted = false;
  });
  const directActions = cardKernel.composition.inputPort.enumerateActions({ family: "play_card" });
  assert.deepEqual(
    identityView(directActions),
    identityView(enumerateBrowserProductionPort(directScenario, "play_card")),
    "Browser/Simulation 必须共用 play_card descriptor identity",
  );
  const directResult = cardKernel.composition.inputPort.submitAction(directActions[0]);
  assert.equal(directResult.ok, true);
  assert.equal(directResult.journal.actions.length, 1);
  assert.ok(directResult.journal.events.some((event) => event.effectType === "gain_resources"));
  const directPlayer = cardKernel.composition.stateSourcePort.read().state.players.players
    .find((player) => player.id === directScenario.turn.currentPlayerId);
  assert.equal(directPlayer.resources.credits, 16, "真实 4 费必须支付");
  assert.equal(directPlayer.resources.publicity, 10, "直接卡牌效果必须执行");
  assert.equal(directPlayer.hand.some((card) => card.id === directCard.id), false, "实体必须离开手牌");
  assert.equal(directPlayer.reservedCards.some((card) => card.id === directCard.id), true,
    "3 型牌实体必须进入保留区");

  const decisionCard = createCard("dlc_2");
  const cornerCard = createCard("b_3");
  const decisionScenario = restoreScenario(cardKernel, (_state, player) => {
    player.resources.credits = 20;
    player.hand = [decisionCard, cornerCard];
    player.reservedCards = [];
    player.resources.handSize = 2;
    player.mainActionCompleted = false;
  });
  const decisionAction = cardKernel.composition.inputPort.enumerateActions({ family: "play_card" })
    .find((action) => action.target.cardInstanceId === decisionCard.id);
  const opened = cardKernel.composition.inputPort.submitAction(decisionAction);
  assert.equal(opened.ok, true);
  assert.equal(cardKernel.composition.inspect().phase, "awaiting_input");
  const decision = cardKernel.composition.inspect().session.decision;
  assert.equal(decision.ownerId, decisionScenario.turn.currentPlayerId);
  assert.equal(decision.decisionKind, "choose_reward");
  assert.equal(decision.choices.length, 1);
  const committedBeforeInvalid = cardKernel.composition.stateSourcePort.read().state;
  const illegal = structuredClone(decision.choices[0]);
  illegal.actionId = `${illegal.actionId}:unknown`;
  illegal.actorId = "player-unknown";
  const invalid = cardKernel.composition.inputPort.submitDecision({
    decisionId: decision.decisionId,
    decisionVersion: decision.decisionVersion,
    choice: illegal,
  });
  assert.equal(invalid.ok, false, "未知/错 owner choice 必须 fail-closed");
  assert.deepEqual(cardKernel.composition.stateSourcePort.read().state, committedBeforeInvalid,
    "非法 Decision 不得提前提交 working card mutation");
  const resolved = cardKernel.composition.inputPort.submitDecision({
    decisionId: decision.decisionId,
    decisionVersion: decision.decisionVersion,
    choice: decision.choices[0],
  });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.journal.decisions.length, 1);
  assert.ok(resolved.journal.events.some((event) => event.type === "card_effect_choice"));
  const resolvedPlayer = cardKernel.composition.stateSourcePort.read().state.players.players
    .find((player) => player.id === decisionScenario.turn.currentPlayerId);
  assert.equal(resolvedPlayer.resources.credits, 19);
  assert.equal(resolvedPlayer.hand.some((card) => card.id === decisionCard.id), false);
  assert.ok(cardKernel.composition.stateSourcePort.read().state.cards.discardPile
    .some((card) => card.id === decisionCard.id), "0 型牌实体必须进入弃牌堆");
  cardKernel.composition.dispose();
}

{
  const env = createSimulationEnv();
  let researchExecuted = false;
  try {
    env.reset({ seed: "research-seed-7", activePlayerCount: 4 });
    for (let step = 0; step < 40 && !researchExecuted; step += 1) {
      const actions = env.legalActions();
      const action = actions.find((candidate) => candidate.family === "research_tech")
        || actions.find((candidate) => candidate.family === "pass")
        || actions.find((candidate) => candidate.family === "end_turn")
        || actions[0];
      assert.ok(action, `生产 composition 第 ${step} 步必须有合法行动`);
      const result = env.step(action);
      assert.equal(result.ok, true, `${action.family} 生产 handler 不得因缺 composition context 失败`);
      researchExecuted = action.family === "research_tech";
    }
  } finally {
    env.dispose();
  }
  assert.equal(researchExecuted, true, "生产 Standard Action 回归必须实际执行 research_tech");
}

console.log("simulation production Standard Action composition tests passed");
