"use strict";

const assert = require("node:assert/strict");
const playDomain = require("./play-domain");
const scienceSession = require("../effects/science-session");
const cardEffects = require("./effects");
const standardAction = require("../actions/standard-action");
const stateStoreApi = require("../state/state-store");
const effectRuntimeApi = require("../effects/session-runtime");
const { createRuleComposition } = require("../rule-composition");
const data = require("../data");
const players = require("../players");
const tech = require("../tech");
const solar = require("../../solar-system/core");
const rockets = require("../rockets");

assert.equal(playDomain.REACHABLE_PLAY_EFFECT_TYPES.length, 46);
assert.deepEqual(
  playDomain.OWNED_PLAY_EFFECT_TYPES,
  playDomain.REACHABLE_RECURSIVE_EFFECT_TYPES,
  "Production Card Play owner 必须一次覆盖实际牌库递归 effect 闭包",
);
assert.equal(
  playDomain.REACHABLE_RECURSIVE_EFFECT_TYPES.length,
  47,
  "182 张牌的递归 effect 闭包必须包含 46 个顶层类型与嵌套探测器计数奖励",
);
assert.ok(
  playDomain.REACHABLE_RECURSIVE_EFFECT_TYPES.includes(
    cardEffects.EFFECT_TYPES.COUNT_ROCKETS_REWARD,
  ),
  "嵌套 card_count_rockets_reward 必须属于 Production Card Play owner",
);

function createCanonicalState(cardId) {
  const card = {
    id: `instance:${cardId}`,
    cardId,
    price: 2,
    cardTypeCode: cardEffects.getRuntimeCardTypeCode({ cardId }),
  };
  const meta = {
    stateVersion: 0,
    gameId: `card-play:${cardId}`,
    rulesetVersion: "test-v1",
    seed: 158,
    rngState: {},
    sequences: {
      card: 100,
      dataToken: 200,
      finalMark: 1,
      nebulaToken: 1,
      nebulaReplacement: 1,
      rocket: 1,
    },
  };
  const dataState = data.createDefaultNebulaDataState();
  const techGameState = tech.createState(() => 0);
  for (const stack of Object.values(techGameState.board.stacks)) {
    stack.bonusQueue[stack.bonusIndex] = "bonus_3f";
    stack.bonusId = "bonus_3f";
  }
  for (const nebulaId of new Set(Object.values(cardEffects.NEBULA_IDS_BY_COLOR).flat())) {
    for (let index = 0; index < 4; index += 1) {
      data.fillNebulaData(dataState, nebulaId, { source: "test", root: { meta } });
    }
  }
  const extraHand = cardId === "b_41.webp" || cardId === "dlc_34.png"
    ? [{ id: "income-energy-card", cardId: "b_2.webp", incomeCode: 1 }]
    : cardId === "dlc_32.png"
      ? [
        { id: "discard-a", cardId: "b_2.webp", incomeCode: 1 },
        { id: "discard-b", cardId: "b_3.webp", incomeCode: 0 },
      ]
      : [];
  const root = {
    meta,
    players: {
      players: [{
        id: "p1",
        color: "brown",
        resources: {
          credits: 10, energy: 10, publicity: 0, score: 0,
          availableData: 0, computerCapacity: 5, handSize: 1,
        },
        income: cardId === "b_42.webp" ? { energy: 3 } : {},
        hand: [card, ...extraHand],
        reservedCards: [],
        techState: cardId === "dlc_34.png"
          ? players.normalizePlayerTechState({
            ownedTiles: { blue1: true, blue2: true, orange1: true },
          })
          : players.normalizePlayerTechState(null),
        mainActionCompleted: false,
      }],
    },
    cards: { discardPile: [], publicCards: [] },
    pieces: rockets.createRocketState(),
    solarSystem: solar.createBaselineState(),
    data: dataState,
    planets: {},
    tech: techGameState.board,
    aliens: {},
    turn: { currentPlayerId: "p1" },
    match: { decisionVersion: 0 },
  };
  root.players.players[0].resources.handSize = root.players.players[0].hand.length;
  return root;
}

function toCommitted(root, stateVersion = root.meta?.stateVersion ?? 0) {
  return stateStoreApi.createCommittedGameState({
    stateVersion,
    gameId: root.meta.gameId,
    rulesetVersion: root.meta.rulesetVersion,
    seed: root.meta.seed,
    rngState: root.meta.rngState,
    sequences: root.meta.sequences,
    match: root.match,
    turn: root.turn,
    players: root.players,
    solarSystem: root.solarSystem,
    pieces: root.pieces,
    planets: root.planets,
    data: root.data,
    cards: root.cards,
    tech: root.tech,
    aliens: root.aliens,
    finalScoring: {},
  });
}

function createActionContext(root) {
  return {
    state: root,
    players: root.players,
    cards: root.cards,
    pieces: root.pieces,
    solarSystem: root.solarSystem,
    data: root.data,
    planets: root.planets,
    tech: root.tech,
    aliens: root.aliens,
    turn: root.turn,
    match: root.match,
    standardActionAuthority: {
      actorId: root.turn.currentPlayerId,
      stateVersion: root.meta.stateVersion,
      decisionVersion: root.match.decisionVersion,
    },
  };
}

function semanticState(state) {
  const player = state.players.players[0];
  return {
    stateVersion: state.meta.stateVersion,
    player: {
      credits: player.resources.credits,
      energy: player.resources.energy,
      publicity: player.resources.publicity,
      availableData: player.resources.availableData,
      hand: player.hand.map((card) => card.id),
      reserved: player.reservedCards.map((card) => card.id),
      mainActionCompleted: player.mainActionCompleted,
      income: structuredClone(player.income || {}),
    },
    discard: (state.cards.discardPile || []).map((card) => card.id),
    sequences: structuredClone(state.meta.sequences),
    cardRandom: structuredClone(state.meta.rngState.cardPlay || null),
    dataTokens: (player.dataState?.poolTokens || []).map((token) => ({
      id: token.id,
      index: token.index,
      slotIndex: token.slotIndex,
    })),
    scans: ["sector-4-a", "sector-3-a"].map((nebulaId) => ({
      nebulaId,
      tokens: data.listNebulaTokens(state.data, nebulaId).map((token) => ({
        slotIndex: token.slotIndex,
        replacedByPlayerId: token.replacedByPlayerId || null,
      })),
    })),
    rockets: (state.pieces.rockets || []).map((rocket) => ({
      id: rocket.id,
      playerId: rocket.playerId,
      sectorX: rocket.sectorX,
      sectorY: rocket.sectorY,
    })),
  };
}

function createIntegratedComposition(cardId) {
  const initialState = toCommitted(createCanonicalState(cardId));
  const counters = { compareAndCommit: 0 };
  const instrumentedStateStoreApi = {
    createStateStore(initialState, options) {
      const store = stateStoreApi.createStateStore(initialState, options);
      return Object.freeze({
        ...store,
        compareAndCommit(baseVersion, candidate, metadata) {
          counters.compareAndCommit += 1;
          return store.compareAndCommit(baseVersion, candidate, metadata);
        },
      });
    },
  };
  const provider = playDomain.createPlayCardProvider();
  const options = {
    stateStoreApi: instrumentedStateStoreApi,
    effectRuntimeApi,
    createInitialState() { return structuredClone(initialState); },
    createActionContext,
    createActionRegistry() {
      const registry = standardAction.createRegistry({
        getAuthority: (context) => context.standardActionAuthority,
      });
      registry.register(standardAction.createOptionDefinition("play_card", provider));
      return registry;
    },
    effectDomains: [
      {
        id: "card_play_test_boundary",
        families: ["play_card"],
        create: playDomain.createExperimentalCardPlayDomain,
      },
      {
        id: scienceSession.DOMAIN_ID,
        families: scienceSession.ACTION_FAMILIES,
        create: scienceSession.createScienceDomain,
      },
    ],
    projectState: semanticState,
  };
  const composition = createRuleComposition(options);
  return { composition, counters };
}

function getOnlyPlayAction(composition) {
  const actions = composition.inputPort.enumerateActions({ family: "play_card" });
  assert.ok(actions.length >= 1);
  const action = actions.find((candidate) => (
    String(candidate.target.cardInstanceId).startsWith("instance:")
  ));
  assert.ok(action);
  assert.equal(action.schemaVersion, standardAction.SCHEMA_VERSION);
  assert.equal(action.family, "play_card");
  assert.equal(action.actorId, "p1");
  assert.equal(action.stateVersion, 0);
  assert.equal(action.decisionVersion, 0);
  return action;
}

function runFixedScan() {
  const { composition, counters } = createIntegratedComposition("b_1.webp");
  const action = getOnlyPlayAction(composition);
  const wrongOwner = composition.inputPort.submitAction({ ...action, actorId: "p2" });
  assert.equal(wrongOwner.ok, false);
  assert.equal(wrongOwner.code, "STANDARD_ACTION_ACTOR_MISMATCH");
  assert.equal(composition.stateSourcePort.getSnapshot().meta.stateVersion, 0);
  assert.equal(counters.compareAndCommit, 0);

  const result = composition.inputPort.submitAction(action);
  assert.equal(result.ok, true);
  assert.equal(result.phase, "completed");
  assert.equal(result.stateVersion, 1);
  assert.equal(counters.compareAndCommit, 1, "费用、迁牌与两个扫描 Effect 只能整体 CAS 一次");
  assert.equal(result.journal.actions.length, 1);
  assert.equal(result.journal.effects.length, 3);
  assert.equal(result.journal.events.filter((event) => event.type === "signalMarked").length, 2);
  const committed = composition.stateSourcePort.getSnapshot();
  assert.equal(committed.players.players[0].resources.credits, 8);
  assert.equal(committed.players.players[0].hand.length, 0);
  assert.equal(committed.players.players[0].reservedCards.length, 1);
  return semanticState(committed);
}

function runColorDecisions() {
  const { composition, counters } = createIntegratedComposition("b_3.webp");
  const opened = composition.inputPort.submitAction(getOnlyPlayAction(composition));
  assert.equal(opened.ok, true);
  assert.equal(composition.inspect().phase, "awaiting_input");
  assert.equal(counters.compareAndCommit, 0, "Decision 未完成前不得提交费用或手牌迁移");

  const first = composition.inspect().session.decision;
  assert.equal(first.ownerId, "p1");
  assert.deepEqual(first.choices.map((choice) => choice.target.nebulaId), ["sector-4-a", "sector-3-a"]);
  const beforeInvalid = composition.stateSourcePort.getSnapshot();
  const stale = composition.inputPort.submitDecision({
    decisionId: first.decisionId,
    decisionVersion: first.decisionVersion + 1,
    ownerId: first.ownerId,
    choice: first.choices[0],
  });
  assert.equal(stale.code, "EFFECT_DECISION_STALE");
  const wrongOwner = composition.inputPort.submitDecision({
    decisionId: first.decisionId,
    decisionVersion: first.decisionVersion,
    ownerId: "p2",
    choice: first.choices[0],
  });
  assert.equal(wrongOwner.code, "EFFECT_DECISION_OWNER_MISMATCH");
  const unknownChoice = composition.inputPort.submitDecision({
    decisionId: first.decisionId,
    decisionVersion: first.decisionVersion,
    ownerId: first.ownerId,
    choice: { family: "choose_target", target: { choiceId: "unknown", nebulaId: "unknown" }, payload: {} },
  });
  assert.equal(unknownChoice.code, "EFFECT_DECISION_NOT_LEGAL");
  assert.deepEqual(composition.stateSourcePort.getSnapshot(), beforeInvalid);
  assert.equal(counters.compareAndCommit, 0);

  let terminal = null;
  for (let index = 0; index < 4; index += 1) {
    const decision = composition.inspect().session.decision;
    terminal = composition.inputPort.submitDecision({
      decisionId: decision.decisionId,
      decisionVersion: decision.decisionVersion,
      ownerId: decision.ownerId,
      choice: decision.choices[index % decision.choices.length],
    });
    assert.equal(terminal.ok, true, JSON.stringify(terminal));
  }
  assert.equal(terminal.phase, "completed");
  assert.equal(terminal.stateVersion, 1);
  assert.equal(terminal.journal.decisions.length, 4);
  assert.equal(terminal.journal.replay.filter((step) => step.kind === "decision").length, 4);
  assert.equal(counters.compareAndCommit, 1);
  return semanticState(composition.stateSourcePort.getSnapshot());
}

function runDirectRewards() {
  const { composition, counters } = createIntegratedComposition("b_74.webp");
  const result = composition.inputPort.submitAction(getOnlyPlayAction(composition));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.phase, "completed");
  assert.equal(result.stateVersion, 1);
  assert.equal(counters.compareAndCommit, 1);
  assert.equal(result.journal.effects.length, 3);
  assert.deepEqual(
    result.journal.events.filter((event) => event.type === "card_effect")
      .map((event) => event.effectType),
    [cardEffects.REWARD_TYPES.GAIN_RESOURCES, cardEffects.REWARD_TYPES.GAIN_DATA],
  );
  const committed = composition.stateSourcePort.getSnapshot();
  const player = committed.players.players[0];
  assert.equal(player.resources.credits, 8);
  assert.equal(player.resources.publicity, 1);
  assert.equal(player.resources.availableData, 2);
  assert.deepEqual(
    player.dataState.poolTokens.map((token) => token.id),
    ["data-token-200", "data-token-201"],
  );
  assert.equal(committed.meta.sequences.dataToken, 202);
  const saved = composition.lifecycle.save();
  assert.equal(saved.ok, true, JSON.stringify(saved));
  const restoredComposition = createIntegratedComposition("b_74.webp").composition;
  const restored = restoredComposition.lifecycle.restore(saved.envelope, { silent: true });
  assert.equal(restored.ok, true, JSON.stringify(restored));
  assert.deepEqual(
    restoredComposition.stateSourcePort.getSnapshot(),
    committed,
    "Card Play committed data entity 必须在 save/restore 后逐字段一致",
  );
  return { semantic: semanticState(committed), committed };
}

function runDrawCards() {
  const { composition, counters } = createIntegratedComposition("b_83.webp");
  const result = composition.inputPort.submitAction(getOnlyPlayAction(composition));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.phase, "completed");
  assert.equal(counters.compareAndCommit, 1);
  assert.equal(result.journal.effects.length, 2);
  assert.equal(result.journal.rng.length, 1);
  const committed = composition.stateSourcePort.getSnapshot();
  const player = committed.players.players[0];
  assert.equal(player.hand.length, 3);
  assert.deepEqual(player.hand.map((card) => card.id), ["card-100-0", "card-101-0", "card-102-0"]);
  assert.equal(committed.meta.sequences.card, 103);
  assert.equal(committed.meta.rngState.cardPlay.cursor, 3);
  return semanticState(committed);
}

function runPickCard() {
  const { composition, counters } = createIntegratedComposition("b_122.webp");
  const opened = composition.inputPort.submitAction(getOnlyPlayAction(composition));
  assert.equal(opened.ok, true, JSON.stringify(opened));
  assert.equal(composition.inspect().phase, "awaiting_input");
  const decision = composition.inspect().session.decision;
  assert.deepEqual(decision.choices.map((choice) => choice.target.choiceId), ["blind"]);
  const result = composition.inputPort.submitDecision({
    decisionId: decision.decisionId,
    decisionVersion: decision.decisionVersion,
    ownerId: decision.ownerId,
    choice: decision.choices[0],
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.phase, "completed");
  assert.equal(counters.compareAndCommit, 1);
  assert.equal(result.journal.decisions.length, 1);
  const committed = composition.stateSourcePort.getSnapshot();
  assert.deepEqual(committed.players.players[0].hand.map((card) => card.id), ["card-100-0"]);
  assert.equal(committed.meta.sequences.card, 101);
  return semanticState(committed);
}

function runDerivedRewards(cardId) {
  const { composition, counters } = createIntegratedComposition(cardId);
  const result = composition.inputPort.submitAction(getOnlyPlayAction(composition));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.phase, "completed");
  assert.equal(counters.compareAndCommit, 1);
  return {
    state: semanticState(composition.stateSourcePort.getSnapshot()),
    result,
    committed: composition.stateSourcePort.getSnapshot(),
  };
}

function runIncomeAndTechCount() {
  const { composition, counters } = createIntegratedComposition("dlc_34.png");
  const opened = composition.inputPort.submitAction(getOnlyPlayAction(composition));
  assert.equal(opened.ok, true, JSON.stringify(opened));
  assert.equal(composition.inspect().phase, "awaiting_input");
  const decision = composition.inspect().session.decision;
  assert.deepEqual(decision.choices.map((choice) => choice.target.cardInstanceId), ["income-energy-card"]);
  const result = composition.inputPort.submitDecision({
    decisionId: decision.decisionId,
    decisionVersion: decision.decisionVersion,
    ownerId: decision.ownerId,
    choice: decision.choices[0],
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.phase, "completed");
  assert.equal(counters.compareAndCommit, 1);
  const committed = composition.stateSourcePort.getSnapshot();
  const player = committed.players.players[0];
  assert.equal(player.income.energy, 1);
  assert.equal(player.resources.energy, 11);
  assert.equal(player.hand.length, 2);
  assert.equal(committed.meta.sequences.card, 102);
  assert.equal(result.journal.decisions.length, 1);
  return semanticState(committed);
}

function runResearchTech() {
  const { composition, counters } = createIntegratedComposition("b_4.webp");
  const opened = composition.inputPort.submitAction(getOnlyPlayAction(composition));
  assert.equal(opened.ok, true, JSON.stringify(opened));
  assert.equal(composition.inspect().phase, "awaiting_input");
  const decision = composition.inspect().session.decision;
  assert.ok(decision.choices.length > 0);
  assert.ok(decision.choices.every((choice) => choice.target.tileId.startsWith("blue")));
  const result = composition.inputPort.submitDecision({
    decisionId: decision.decisionId,
    decisionVersion: decision.decisionVersion,
    ownerId: decision.ownerId,
    choice: decision.choices[0],
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.phase, "completed");
  assert.equal(counters.compareAndCommit, 1);
  const committed = composition.stateSourcePort.getSnapshot();
  const player = committed.players.players[0];
  assert.equal(player.techState.ownedTiles[decision.choices[0].target.tileId], true);
  assert.equal(result.journal.decisions.length, 1);
  return semanticState(committed);
}

function runLaunchAndPick() {
  const { composition, counters } = createIntegratedComposition("b_21.webp");
  const opened = composition.inputPort.submitAction(getOnlyPlayAction(composition));
  assert.equal(opened.ok, true, JSON.stringify(opened));
  assert.equal(composition.inspect().phase, "awaiting_input");
  const decision = composition.inspect().session.decision;
  const result = composition.inputPort.submitDecision({
    decisionId: decision.decisionId,
    decisionVersion: decision.decisionVersion,
    ownerId: decision.ownerId,
    choice: decision.choices.find((choice) => choice.target.choiceId === "blind"),
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.phase, "completed");
  assert.equal(counters.compareAndCommit, 1);
  const committed = composition.stateSourcePort.getSnapshot();
  assert.equal(committed.pieces.rockets.length, 1);
  assert.equal(committed.players.players[0].hand.length, 1);
  assert.ok(result.journal.events.some((event) => event.type === "launch"));
  return semanticState(committed);
}

runFixedScan();
runColorDecisions();
runDirectRewards();
runDrawCards();
runPickCard();
for (const cardId of ["b_41.webp", "b_42.webp", "b_139.webp", "dlc_32.png"]) {
  const browser = runDerivedRewards(cardId);
  if (cardId === "b_41.webp") {
    assert.equal(browser.committed.players.players[0].resources.energy, 11);
  } else if (cardId === "b_42.webp") {
    const player = browser.committed.players.players[0];
    assert.equal(player.resources.energy, 14);
    assert.equal(player.income.energy, 4);
    assert.equal(browser.committed.cards.discardPile.length, 0);
  } else if (cardId === "b_139.webp") {
    assert.deepEqual(
      browser.committed.players.players[0].reservedCards[0].cardEffectState.pluto,
      { orbitDone: false, landDone: false },
    );
  } else if (cardId === "dlc_32.png") {
    const player = browser.committed.players.players[0];
    assert.equal(player.resources.publicity, 1);
    assert.equal(player.hand.length, 2);
    assert.equal(browser.committed.cards.discardPile.length, 3);
    assert.equal(browser.committed.meta.sequences.card, 102);
  }
}
runIncomeAndTechCount();
runResearchTech();
runLaunchAndPick();

const exhaustiveCardIds = Object.keys(cardEffects.CARD_REFERENCE_MAP).sort();
const exhaustiveEffectTypes = new Set();
for (const cardId of exhaustiveCardIds) {
  const { composition, counters } = createIntegratedComposition(cardId);
  let result = composition.inputPort.submitAction(getOnlyPlayAction(composition));
  let guard = 0;
  while (result.ok && composition.inspect().phase === "awaiting_input") {
    const decision = composition.inspect().session.decision;
    assert.ok(decision.choices.length > 0, `${cardId} 不得产生空 Decision`);
    result = composition.inputPort.submitDecision({
      decisionId: decision.decisionId,
      decisionVersion: decision.decisionVersion,
      ownerId: decision.ownerId,
      choice: decision.choices[0],
    });
    guard += 1;
    assert.ok(guard < 100, `${cardId} Decision 链不得无限循环`);
  }
  assert.equal(result.ok, true, `${cardId}: ${JSON.stringify(result)}`);
  assert.equal(result.phase, "completed", `${cardId} 必须完成完整 Card Play Session`);
  assert.equal(counters.compareAndCommit, 1, `${cardId} 必须且只能 CAS 一次`);
  for (const effect of cardEffects.buildPlayEffects({ cardId })) {
    exhaustiveEffectTypes.add(effect.type);
  }
  composition.dispose();
}
assert.equal(exhaustiveCardIds.length, 182, "基础牌与 DLC 牌必须逐张进入正式 composition");
assert.deepEqual(
  [...exhaustiveEffectTypes].sort(),
  [...playDomain.REACHABLE_PLAY_EFFECT_TYPES].sort(),
  "逐张 composition 证明必须覆盖 46/46 可达 top-level effect type",
);

console.log("card play domain production composition tests passed");
