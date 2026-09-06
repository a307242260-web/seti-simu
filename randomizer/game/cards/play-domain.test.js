"use strict";

const assert = require("node:assert/strict");
const playDomain = require("./play-domain");
const scienceSession = require("../effects/science-session");
const residualDomain = require("../effects/residual-domain-session");
const cardEffects = require("./effects");
const standardAction = require("../actions/standard-action");
const stateStoreApi = require("../state/state-store");
const effectRuntimeApi = require("../effects/session-runtime");
const { createRuleComposition } = require("../rule-composition");
const data = require("../data");
const players = require("../players");
const tech = require("../tech");
const aliens = require("../aliens");
const solar = require("../../solar-system/core");
const rockets = require("../rockets");

assert.equal(playDomain.REACHABLE_PLAY_EFFECT_TYPES.length, 45);
assert.deepEqual(
  playDomain.OWNED_PLAY_EFFECT_TYPES,
  playDomain.REACHABLE_RECURSIVE_EFFECT_TYPES,
  "Production Card Play owner 必须一次覆盖实际牌库递归 effect 闭包",
);
assert.equal(
  playDomain.REACHABLE_RECURSIVE_EFFECT_TYPES.length,
  46,
  "182 张牌的递归 effect 闭包必须包含 45 个顶层类型与嵌套探测器计数奖励",
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
  for (const stack of Object.values(techGameState.stacks)) {
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
    tech: techGameState,
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

function createIntegratedComposition(cardId, extra = {}) {
  const initialState = toCommitted(extra.state || createCanonicalState(cardId));
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
      if (extra.residual) {
        for (const definition of residualDomain.createActionDefinitions()) registry.register(definition);
      }
      return registry;
    },
    effectDomains: [
      ...(extra.residual ? [{
        id: residualDomain.DOMAIN_ID,
        families: residualDomain.ACTION_FAMILIES,
        create: residualDomain.createResidualDomain,
      }] : []),
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
  assert.equal(result.journal.effects.length, 5);
  assert.equal(
    result.journal.effects.filter((entry) => entry.type === scienceSession.EFFECT_TYPES.SETTLE).length,
    1,
    "固定星云卡牌扫描两次同属一个卡牌扫描流，串尾 SCAN_FINALIZE 统一触发一次扇区结算",
  );
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
  const incomeChoice = decision.choices[0];
  assert.equal(incomeChoice.schemaVersion, standardAction.SCHEMA_VERSION);
  assert.equal(incomeChoice.actorId, decision.ownerId);
  assert.equal(incomeChoice.phase, "conditional");
  assert.ok(incomeChoice.actionId.startsWith("choose_card:"));
  assert.ok(Number.isInteger(incomeChoice.stateVersion));
  assert.ok(Number.isInteger(incomeChoice.decisionVersion));
  const savedIncome = composition.lifecycle.save();
  assert.equal(savedIncome.ok, true);
  const restoredIncome = createIntegratedComposition("dlc_34.png").composition;
  assert.equal(restoredIncome.lifecycle.restore(savedIncome.envelope, { silent: true }).ok, true);
  assert.deepEqual(restoredIncome.inspect().session.decision.choices, decision.choices,
    "恢复重新枚举同一正式收入选择，身份保持稳定");
  const wrongOwner = composition.inputPort.submitDecision({ decisionId: decision.decisionId,
    decisionVersion: decision.decisionVersion, ownerId: "wrong-owner", choice: incomeChoice });
  assert.equal(wrongOwner.ok, false);
  assert.deepEqual(composition.inspect().session.decision.choices, decision.choices,
    "错误owner不得消费收入选择或改变其身份");
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

function runScanCompletesSectorSettlement() {
  // 室女座61（sector-4-a，容量 6）预填 5 个已替换 token，打 b_1（repeat 2 固定扫描该扇区）
  // 第 1 次扫描即补满最后一个槽 → 必须触发扇区结算
  const root = createCanonicalState("b_1.webp");
  const tokens = root.data.nebulae["sector-4-a"].tokens;
  assert.equal(tokens.length, 6, "室女座61 容量必须为 6");
  for (const token of tokens.slice(0, tokens.length - 1)) {
    token.replacedByPlayerId = "p1";
    token.replacedByPlayerColor = "brown";
    token.replacementOrder = 1;
  }
  const { composition } = createIntegratedComposition("b_1.webp", { state: root });
  const result = composition.inputPort.submitAction(getOnlyPlayAction(composition));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.ok(
    result.journal.events.some((event) => event.type === "sectorCompleted"),
    "卡牌扫描补满扇区后必须产生扇区结算事件",
  );
  const committed = composition.stateSourcePort.getSnapshot();
  assert.equal(
    committed.data.sectorSettlements?.sectors?.["sector-4-a"]?.settlementCount,
    1,
    "扇区结算后 settlementCount 必须为 1",
  );
  composition.dispose();
}

function runReturnPlayedCardToHandWhenProbeAdjacentEarth() {
  // dlc_5（维护任务）：1 数据 + 1 移动 + 若自己有探测器在地球相邻位置则本卡回手
  const root = createCanonicalState("dlc_5.png");
  const earthX = solar.createSolarSnapshot(root.solarSystem).planetLocations
    .find((planet) => planet.planetId === "earth").x;
  root.pieces.rockets.push({
    id: "rocket-1",
    playerId: "p1",
    color: "brown",
    sectorX: solar.mod8(earthX + 2),
    sectorY: 0,
  });
  const { composition } = createIntegratedComposition("dlc_5.png", { state: root });
  let result = composition.inputPort.submitAction(getOnlyPlayAction(composition));
  assert.equal(result.ok, true, JSON.stringify(result));
  let guard = 0;
  while (result.ok && composition.inspect().phase === "awaiting_input") {
    const decision = composition.inspect().session.decision;
    const choice = decision.choices.find((candidate) => (
      candidate.target.choiceId === "rocket-1:-1:0"
    )) || decision.choices[0];
    result = composition.inputPort.submitDecision({
      decisionId: decision.decisionId,
      decisionVersion: decision.decisionVersion,
      ownerId: decision.ownerId,
      choice,
    });
    guard += 1;
    assert.ok(guard < 20, `dlc_5 Decision 链异常: ${JSON.stringify(
      decision.choices.map((candidate) => candidate.target.choiceId),
    )}`);
  }
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.phase, "completed");
  const committed = composition.stateSourcePort.getSnapshot();
  const player = committed.players.players[0];
  assert.equal(committed.pieces.rockets[0].sectorX, solar.mod8(earthX + 1), "火箭应移动到地球相邻扇区");
  assert.ok(
    player.hand.some((card) => String(card.cardId) === "dlc_5.png"),
    "探测器移动到地球相邻位置后 dlc_5 必须回到手牌",
  );
  composition.dispose();
}

function runReturnPlayedCardToHandWhenProbeRadiallyAdjacent() {
  // 用户存档场景：地球 (x=1,y=1)，探测器移动到 (x=1,y=2)（径向相邻，y 差 1）
  const root = createCanonicalState("dlc_5.png");
  const earth = solar.createSolarSnapshot(root.solarSystem).planetLocations
    .find((planet) => planet.planetId === "earth");
  root.pieces.rockets.push({
    id: "rocket-1",
    playerId: "p1",
    color: "brown",
    sectorX: earth.x,
    sectorY: earth.y + 2,
  });
  const { composition } = createIntegratedComposition("dlc_5.png", { state: root });
  let result = composition.inputPort.submitAction(getOnlyPlayAction(composition));
  assert.equal(result.ok, true, JSON.stringify(result));
  let guard = 0;
  while (result.ok && composition.inspect().phase === "awaiting_input") {
    const decision = composition.inspect().session.decision;
    // 向内移动（deltaY:-1）→ (x, y+1)，与地球径向相邻
    const choice = decision.choices.find((candidate) => (
      candidate.target.choiceId === "rocket-1:0:-1"
    )) || decision.choices[0];
    result = composition.inputPort.submitDecision({
      decisionId: decision.decisionId,
      decisionVersion: decision.decisionVersion,
      ownerId: decision.ownerId,
      choice,
    });
    guard += 1;
    assert.ok(guard < 20, `dlc_5 径向 Decision 链异常: ${JSON.stringify(
      decision.choices.map((candidate) => candidate.target.choiceId),
    )}`);
  }
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.phase, "completed");
  const committed = composition.stateSourcePort.getSnapshot();
  const player = committed.players.players[0];
  assert.equal(committed.pieces.rockets[0].sectorY, earth.y + 1, "火箭应移动到地球径向相邻扇区");
  assert.ok(
    player.hand.some((card) => String(card.cardId) === "dlc_5.png"),
    "探测器径向相邻地球后 dlc_5 必须回到手牌",
  );
  composition.dispose();
}

function runCardLandGrantsStandardPlanetRewards() {
  // dlc_6（现场着陆直播）：打牌登陆木星必须结算标准行星奖励（7分 + 1黄色外星人痕迹）
  const root = createCanonicalState("dlc_6.png");
  const jupiter = solar.createSolarSnapshot(root.solarSystem).planetLocations
    .find((planet) => planet.planetId === "jupiter");
  assert.ok(jupiter, "测试状态必须存在木星");
  root.pieces.rockets.push({
    id: "rocket-1",
    playerId: "p1",
    color: "brown",
    sectorX: jupiter.x,
    sectorY: jupiter.y,
    slotIndex: 1,
    launchGrid: { x: jupiter.x, y: jupiter.y },
  });
  const { composition } = createIntegratedComposition("dlc_6.png", { state: root });
  let result = composition.inputPort.submitAction(getOnlyPlayAction(composition));
  assert.equal(result.ok, true, JSON.stringify(result));
  let guard = 0;
  let alienTraceSeen = false;
  while (result.ok && composition.inspect().phase === "awaiting_input") {
    const decision = composition.inspect().session.decision;
    const choices = decision.choices;
    if (choices.some((candidate) => candidate.target?.traceType === "yellow")) {
      alienTraceSeen = true;
    }
    const choice = choices.find((candidate) => candidate.target?.skip === true)
      || choices.find((candidate) => String(candidate.target?.planetId) === "jupiter")
      || choices.find((candidate) => candidate.target?.traceType === "yellow")
      || choices[0];
    result = composition.inputPort.submitDecision({
      decisionId: decision.decisionId,
      decisionVersion: decision.decisionVersion,
      ownerId: decision.ownerId,
      choice,
    });
    guard += 1;
    assert.ok(guard < 40, `dlc_6 Decision 链异常: ${JSON.stringify(
      choices.map((candidate) => JSON.stringify(candidate.target)),
    )}`);
  }
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.phase, "completed");
  assert.equal(alienTraceSeen, true, "打牌登陆木星必须出现黄色外星人痕迹决策（标准行星奖励）");
  const committed = composition.stateSourcePort.getSnapshot();
  const player = committed.players.players[0];
  assert.ok(Number(player.resources.score) >= 7, `打牌登陆木星必须给 7 分，实际 ${player.resources.score}`);
  const slot1 = committed.aliens.aliens["1"];
  assert.equal(
    slot1?.traces?.yellow?.firstPlaced,
    true,
    "打牌登陆木星后槽位1黄色痕迹必须已放置",
  );
  composition.dispose();
}

function setAmibaSymbolLayout(root, slots) {
  root.aliens.amiba.symbolSlots = slots;
  root.aliens.amiba.symbolsById = Object.fromEntries(Object.entries(slots).map(([slotId, symbolId]) => (
    [symbolId, { ...root.aliens.amiba.symbolsById[symbolId], symbolId, slotId }]
  )));
}

function runAmibaSingleSymbolReward() {
  // 单细胞器图标必须保留选择，不能变成区域全部奖励。
  const root = createCanonicalState("amiba_0.webp");
  const amibaCard = aliens.amiba.createAlienCard(0, 1);
  amibaCard.id = "instance:amiba_0.webp";
  root.players.players[0].hand = [amibaCard];
  root.players.players[0].resources.handSize = 1;
  // 揭示阿米巴（槽位1）：初始 symbol 槽含 blue_3
  const initialized = aliens.amiba.initializeAmibaReveal(
    root.aliens,
    1,
    root.players.players[0],
    () => 0.5,
  );
  assert.equal(initialized.ok, true);
  setAmibaSymbolLayout(root, { blue_1: "symbol_3", blue_2: "symbol_5" });
  const { composition } = createIntegratedComposition("amiba_0.webp", { state: root });
  let result = composition.inputPort.submitAction(getOnlyPlayAction(composition));
  assert.equal(result.ok, true, JSON.stringify(result));
  let guard = 0;
  let symbolChoices = 0;
  while (result.ok && composition.inspect().phase === "awaiting_input") {
    const decision = composition.inspect().session.decision;
    const choices = decision.choices;
    if (choices.some((candidate) => candidate.target.symbolId)) {
      symbolChoices += 1;
      assert.deepEqual(choices.map((candidate) => candidate.target.symbolId), ["symbol_3", "symbol_5"]);
      const legacyEnvelope = structuredClone(composition.lifecycle.save().envelope);
      legacyEnvelope.session.session.queue[0].payload.maxSettles = 3;
      const restored = createIntegratedComposition("amiba_0.webp").composition;
      assert.equal(restored.lifecycle.restore(legacyEnvelope, { silent: true }).ok, true);
      const rejected = restored.inputPort.submitDecision({
        decisionId: decision.decisionId, decisionVersion: decision.decisionVersion,
        ownerId: decision.ownerId, choice: choices[0],
      });
      assert.equal(rejected.ok, false);
      assert.match(rejected.failure.message, /AMIBA_LEGACY_REGION_DECISION/);
      restored.dispose();
    }
    result = composition.inputPort.submitDecision({
      decisionId: decision.decisionId,
      decisionVersion: decision.decisionVersion,
      ownerId: decision.ownerId,
      choice: choices[0],
    });
    guard += 1;
    assert.ok(guard < 30, `amiba_0 Decision 链异常: ${JSON.stringify(
      choices.map((candidate) => JSON.stringify(candidate.target)),
    )}`);
  }
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.phase, "completed");
  const committed = composition.stateSourcePort.getSnapshot();
  const player = committed.players.players[0];
  assert.ok(
    Number(player.resources.availableData) + Number(player.resources.placedData || 0) >= 3,
    "amiba_0 必须给 3 个数据",
  );
  assert.equal(symbolChoices, 1);
  assert.equal(player.resources.score, 4);
  assert.deepEqual(committed.aliens.amiba.symbolSlots, { blue_2: "symbol_5", red_1: "symbol_3" });
  composition.dispose();
}

function runAmibaRemoveTraceRegionReward() {
  for (const [traceType, region, nextOuter, nextInner] of [
    ["yellow", "orange", "blue_1", "red_3"],
    ["blue", "blue", "red_1", "orange_3"],
    ["pink", "red", "orange_1", "blue_3"],
  ]) {
    for (const empty of [false, true]) {
      const root = createCanonicalState("amiba_3.webp");
      const actor = root.players.players[0];
      actor.hand = [{ ...aliens.amiba.createAlienCard(3, 1), id: "instance:amiba_3.webp" }];
      root.aliens.aliens = { 1: { revealed: true, alienId: aliens.amiba.ALIEN_ID, traces: {} } };
      aliens.amiba.initializeAmibaReveal(root.aliens, 1, actor, () => 0.5);
      assert.equal(aliens.amiba.placeAmibaTrace(root.aliens, 1, traceType, 2, actor, { sequence: 1 }).ok, true);
      setAmibaSymbolLayout(root, empty ? {} : {
        [`${region}_1`]: "symbol_3", [`${region}_2`]: "symbol_5", [`${region}_3`]: "symbol_1",
      });
      const { composition } = createIntegratedComposition("amiba_3.webp", { state: root });
      let result = composition.inputPort.submitAction(getOnlyPlayAction(composition));
      assert.equal(result.ok, true, JSON.stringify(result));
      const decision = composition.inspect().session.decision;
      const choice = decision.choices.find((entry) => entry.target.traceType === traceType && entry.target.position === 2);
      assert.ok(choice, "移除痕迹保留真实目标选择");
      result = composition.inputPort.submitDecision({
        decisionId: decision.decisionId, decisionVersion: decision.decisionVersion,
        ownerId: decision.ownerId, choice,
      });
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.phase, "completed", "区域奖励不得追加细胞器选择");
      const committed = composition.stateSourcePort.getSnapshot();
      assert.equal(committed.players.players[0].resources.score, empty ? 0 : 6);
      assert.equal(committed.players.players[0].resources.publicity, empty ? 0 : 1);
      assert.equal(aliens.amiba.countTraceMarkers(committed.aliens, actor, traceType), 0);
      assert.deepEqual(committed.aliens.amiba.symbolSlots, empty ? {} : {
        [`${region}_2`]: "symbol_3", [nextOuter]: "symbol_5", [nextInner]: "symbol_1",
      });
      composition.dispose();
    }
  }
}

function runProbeSectorScanDependency() {
  const root = createCanonicalState("b_53.webp");
  for (const [playerId, x] of [["p1", 0], ["p1", 2], ["p2", 4]]) {
    assert.equal(rockets.launchRocketAtSector(root.pieces, { x, y: 2 }, {
      playerId, color: playerId === "p1" ? "brown" : "blue", root,
    }).ok, true);
  }
  const expected = [0, 2].map(x => solar.getNebulaAtCoordinate(x, 5, root.solarSystem.sectorBySlot).id).sort();
  const { composition } = createIntegratedComposition("b_53.webp", { state: root });
  const result = composition.inputPort.submitAction(getOnlyPlayAction(composition));
  assert.equal(result.ok, true, JSON.stringify(result));
  const decision = composition.inspect().session.decision;
  assert.deepEqual(decision.choices.map(c => c.target.nebulaId).sort(), expected);
  const saved = composition.lifecycle.save().envelope;
  const submission = { decisionId: decision.decisionId, decisionVersion: decision.decisionVersion,
    ownerId: decision.ownerId, choice: decision.choices[0] };
  const selectedNebula = decision.choices[0].target.nebulaId;
  assert.equal(composition.inputPort.submitDecision(submission).ok, true);
  const after = composition.lifecycle.save().envelope;
  const state = composition.stateSourcePort.getSnapshot();
  assert.ok(data.listNebulaTokens(state.data, selectedNebula).some(t => t.replacedByPlayerId === "p1"));
  assert.equal(composition.lifecycle.restore(saved, { silent: true }).ok, true);
  assert.equal(composition.inputPort.submitDecision(submission).ok, true);
  assert.deepEqual(composition.lifecycle.save().envelope, after);
  composition.dispose();
}

function submitTraceChoice(composition, predicate) {
  const decision = composition.inspect().session.decision;
  const choice = decision.choices.find(predicate);
  assert.ok(choice, JSON.stringify(decision.choices));
  const result = composition.inputPort.submitDecision({
    decisionId: decision.decisionId, decisionVersion: decision.decisionVersion,
    ownerId: decision.ownerId, choice,
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  return result;
}

function runCardTraceRestrictions() {
  for (const [cardId, traceType] of [["b_27.webp", "pink"], ["b_32.webp", "yellow"], ["b_35.webp", "blue"]]) {
    for (const hasOwnTrace of [false, true]) {
      const root = createCanonicalState(cardId);
      root.aliens = aliens.createDefaultAlienState();
      // 槽2只有其他玩家的同色痕迹，不能成为本人的合法目标。
      assert.equal(aliens.placeFirstTrace(root.aliens, 2, traceType, "white").ok, true);
      if (hasOwnTrace) assert.equal(aliens.placeFirstTrace(root.aliens, 1, traceType, "brown").ok, true);
      const { composition } = createIntegratedComposition(cardId, { state: root });
      const result = composition.inputPort.submitAction(getOnlyPlayAction(composition));
      assert.equal(result.ok, true, JSON.stringify(result));
      if (hasOwnTrace) {
        const decision = composition.inspect().session.decision;
        assert.equal(decision.choices.length, 1);
        assert.equal(decision.choices[0].target.traceType, traceType);
        assert.equal(decision.choices[0].target.alienSlotId, 1);
        submitTraceChoice(composition, () => true);
        assert.equal(composition.stateSourcePort.getSnapshot().players.players[0].resources.score, 3);
      } else {
        assert.equal(result.phase, "completed", "无合法目标不得停在空Decision");
        assert.deepEqual(composition.stateSourcePort.getSnapshot().aliens, root.aliens);
      }
      composition.dispose();
    }
  }
}

function runCardTraceRegionAndRecovery(initialData = 0) {
  const root = createCanonicalState("b_32.webp");
  const actor = root.players.players[0];
  for (let index = 0; index < initialData; index++) assert.equal(data.gainData(actor, { root }).ok, true);
  const dataSequenceBefore = root.meta.sequences.dataToken;
  root.meta.sequences.alienEntity = 14;
  root.aliens = aliens.createDefaultAlienState();
  for (const type of aliens.TRACE_TYPES) assert.equal(aliens.placeFirstTrace(root.aliens, 1, type, "brown").ok, true);
  Object.assign(root.aliens.aliens[1], { revealed: true, alienId: aliens.amiba.ALIEN_ID });
  assert.equal(aliens.amiba.initializeAmibaReveal(root.aliens, 1, actor, () => 0.5).ok, true);
  setAmibaSymbolLayout(root, { orange_1: "symbol_2", orange_2: "symbol_4" });
  root.cards.drawPile = [{ id: "trace-blind-card", cardId: "b_2.webp" }];
  const { composition } = createIntegratedComposition("b_32.webp", { state: root });
  assert.equal(composition.inputPort.submitAction(getOnlyPlayAction(composition)).ok, true);
  const decision = composition.inspect().session.decision;
  assert.ok(decision.choices.some(c => c.target.stateExtra), "已揭示槽的state额外位仍是合法真实选择");
  assert.ok(decision.choices.every(c => c.target.traceType === "yellow" && c.target.alienSlotId === 1));
  const saved = composition.lifecycle.save().envelope;
  const choice = decision.choices.find(c => c.target.position === 2);
  assert.ok(choice);
  const submission = { decisionId: decision.decisionId, decisionVersion: decision.decisionVersion,
    ownerId: decision.ownerId, choice };
  assert.equal(composition.inputPort.submitDecision({ ...submission, ownerId: "p2" }).ok, false);
  assert.equal(composition.inputPort.submitDecision({ ...submission, decisionVersion: decision.decisionVersion - 1 }).ok, false);
  assert.equal(composition.inputPort.submitDecision({ ...submission,
    choice: { ...choice, target: { ...choice.target, traceType: "pink" } } }).ok, false);
  assert.deepEqual(composition.lifecycle.save().envelope, saved, "拒绝错误输入不得改动状态或pending");
  const submitted = composition.inputPort.submitDecision(submission);
  assert.equal(submitted.ok, true);
  const after = composition.lifecycle.save().envelope;
  const state = composition.stateSourcePort.getSnapshot();
  assert.equal(state.meta.sequences.alienEntity, 15, "一次正面放置只消费一次正式序号");
  assert.equal(state.players.players[0].resources.score, 1, "位置奖励不能遗漏或重复");
  assert.equal(state.players.players[0].resources.availableData, Math.min(6, initialData + 1));
  assert.equal(state.players.players[0].dataState.discardedCount, initialData === 6 ? 1 : 0);
  assert.equal(state.meta.sequences.dataToken, dataSequenceBefore + (initialData === 6 ? 0 : 1));
  const overflowEvents = submitted.journal.events.filter(event => event.type === "amiba_data_discarded");
  assert.equal(overflowEvents.length, initialData === 6 ? 1 : 0);
  assert.equal(state.players.players[0].hand.length, 1, "区域盲抽必须实际发牌");
  assert.deepEqual(state.aliens.amiba.symbolSlots, { orange_2: "symbol_2", blue_1: "symbol_4" });
  assert.equal(composition.lifecycle.restore(saved, { silent: true }).ok, true);
  assert.deepEqual(composition.inspect().session.decision.choices, decision.choices);
  assert.equal(composition.inputPort.submitDecision(submission).ok, true);
  assert.deepEqual(composition.lifecycle.save().envelope, after, "奖励、RNG、实体和journal完整恢复重放一致");
  // 旧pending不允许恢复到已删除的卡牌专用痕迹解析器。
  const legacy = structuredClone(saved);
  legacy.session.session.queue[0].type = "card_play_domain_effect:decision:alien_trace";
  const restored = composition.lifecycle.restore(legacy, { silent: true });
  const rejected = restored.ok ? composition.inputPort.submitDecision(submission) : restored;
  assert.equal(rejected.ok, false);
  assert.match(JSON.stringify(rejected), /EFFECT_DECISION_EXECUTOR_MISSING/);
  composition.dispose();
}

function runCardTraceColorScoreAndNested() {
  for (const [traceType, beforeCount] of [["pink", 1], ["yellow", 2], ["blue", 3]]) {
    const root = createCanonicalState("b_36.webp");
    root.aliens = aliens.createDefaultAlienState();
    for (const [type, count] of [["pink", 1], ["yellow", 2], ["blue", 3]]) {
      root.aliens.aliens[1].traces[type] = { firstPlaced: true, ownerPlayerColor: "brown", extraCount: count - 1 };
    }
    const { composition } = createIntegratedComposition("b_36.webp", { state: root });
    assert.equal(composition.inputPort.submitAction(getOnlyPlayAction(composition)).ok, true);
    submitTraceChoice(composition, c => c.target.traceType === traceType && c.target.alienSlotId === 1);
    assert.equal(composition.stateSourcePort.getSnapshot().players.players[0].resources.score, 3 + beforeCount + 1,
      "额外位3分与放置后的所选颜色计数奖励均须结算");
    composition.dispose();
  }
  const root = createCanonicalState("b_112.webp");
  root.players.players[0].resources.publicity = 8;
  root.aliens = aliens.createDefaultAlienState();
  for (const slotId of aliens.ALIEN_SLOT_IDS) assert.equal(aliens.placeFirstTrace(root.aliens, slotId, "pink", "brown").ok, true);
  const { composition } = createIntegratedComposition("b_112.webp", { state: root });
  assert.equal(composition.inputPort.submitAction(getOnlyPlayAction(composition)).ok, true);
  assert.ok(composition.inspect().session.decision.choices.every(c => c.target.traceType === "pink"));
  submitTraceChoice(composition, c => c.target.alienSlotId === 1);
  assert.equal(composition.stateSourcePort.getSnapshot().players.players[0].resources.score, 3);
  composition.dispose();
}

function runTaskTraceTarget() {
  const root = createCanonicalState("b_67.webp");
  root.aliens = aliens.createDefaultAlienState();
  const actor = root.players.players[0];
  actor.reservedCards = actor.hand;
  actor.hand = [];
  actor.resources.handSize = 0;
  for (const type of aliens.TRACE_TYPES) assert.equal(aliens.placeFirstTrace(root.aliens, 1, type, "brown").ok, true);
  root.aliens.aliens[2].traces.yellow = { firstPlaced: true, ownerPlayerColor: "brown", extraCount: 2 };
  const { composition } = createIntegratedComposition("b_67.webp", { state: root, residual: true });
  const task = composition.inputPort.enumerateActions({ family: "complete_task" })[0];
  assert.ok(task);
  const result = composition.inputPort.submitAction(task);
  assert.equal(result.ok, true, JSON.stringify(result));
  const decision = composition.inspect().session.decision;
  assert.equal(decision.choices.length, 3);
  assert.ok(decision.choices.every(c => c.target.alienSlotId === 1), "任务奖励不能放到另一未集齐三色的物种");
  submitTraceChoice(composition, c => c.target.traceType === "pink");
  const state = composition.stateSourcePort.getSnapshot();
  assert.equal(state.players.players[0].resources.score, 3);
  assert.equal(state.players.players[0].reservedCards.length, 0);
  composition.dispose();
}

function runAlienCardTraceAndDeferredScore() {
  const alienRoot = createCanonicalState("yichangdian_7.webp");
  alienRoot.aliens = aliens.createDefaultAlienState();
  alienRoot.players.players[0].hand = [{ ...aliens.yichangdian.createAlienCard(7, 1), id: "instance:yichangdian_7.webp" }];
  const alienComposition = createIntegratedComposition("yichangdian_7.webp", { state: alienRoot }).composition;
  assert.equal(alienComposition.inputPort.submitAction(getOnlyPlayAction(alienComposition)).ok, true);
  assert.equal(alienComposition.inspect().session.decision.choices.length, 6);
  submitTraceChoice(alienComposition, c => c.target.alienSlotId === 2 && c.target.traceType === "blue");
  assert.equal(alienComposition.stateSourcePort.getSnapshot().players.players[0].resources.score, 3);
  alienComposition.dispose();

  const root = createCanonicalState("b_36.webp");
  root.meta.sequences.alienEntity = 14;
  root.aliens = aliens.createDefaultAlienState();
  const actor = root.players.players[0];
  for (const type of aliens.TRACE_TYPES) assert.equal(aliens.placeFirstTrace(root.aliens, 1, type, "brown").ok, true);
  Object.assign(root.aliens.aliens[1], { revealed: true, alienId: aliens.amiba.ALIEN_ID });
  assert.equal(aliens.amiba.initializeAmibaReveal(root.aliens, 1, actor, () => 0.5).ok, true);
  setAmibaSymbolLayout(root, {});
  const { composition } = createIntegratedComposition("b_36.webp", { state: root, residual: true });
  assert.equal(composition.inputPort.submitAction(getOnlyPlayAction(composition)).ok, true);
  submitTraceChoice(composition, c => c.target.traceType === "yellow" && c.target.position === 3);
  const saved = composition.lifecycle.save().envelope;
  assert.equal(saved.session.session.workingState.players.players[0].resources.score, 0,
    "位置选牌未结束时不能提前结算卡牌后续分数");
  const pick = composition.inspect().session.decision;
  assert.equal(pick.decisionKind, "choose_card");
  submitTraceChoice(composition, () => true);
  const state = composition.stateSourcePort.getSnapshot();
  assert.equal(state.players.players[0].resources.score, 2, "位置选牌之后计入本次黄色痕迹");
  assert.equal(state.players.players[0].hand.length, 1);
  const after = composition.lifecycle.save().envelope;
  assert.equal(composition.lifecycle.restore(saved, { silent: true }).ok, true);
  submitTraceChoice(composition, () => true);
  assert.deepEqual(composition.lifecycle.save().envelope, after, "跨选牌边界仍保持后计分及隐藏信息恢复一致");
  composition.dispose();
}

runCardTraceRestrictions();
runCardTraceRegionAndRecovery();
runCardTraceRegionAndRecovery(5);
runCardTraceRegionAndRecovery(6);
runCardTraceColorScoreAndNested();
runTaskTraceTarget();
runAlienCardTraceAndDeferredScore();
runProbeSectorScanDependency();
runAmibaSingleSymbolReward();
runAmibaRemoveTraceRegionReward();

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

// —— 哨兵探测网络「打牌后结算弃牌角标」——
// 武装状态下打牌：打牌效果链末尾追加 industry_sentinel_corner 节点（不弃牌），
// 由 residual 执行器经统一角标奖励转换（applyCornerReward）结算。
function createSentinelComposition() {
  const root = createCanonicalState("b_1.webp");
  const player = root.players.players[0];
  player.hand[0].discardActionCode = 0; // 弃牌角标：1 宣传
  root.turn.roundNumber = 1;
  root.turn.turnNumber = 1;
  player.industrySentinelArmedRound = 1;
  player.industrySentinelArmedTurn = 1;
  player.industryRoundMarkRound = 1; // 本轮已标记公司 1x（哨兵武装前置）
  const initialState = toCommitted(root);
  return createRuleComposition({
    stateStoreApi,
    effectRuntimeApi,
    createInitialState() { return structuredClone(initialState); },
    createActionContext,
    createActionRegistry() {
      const registry = standardAction.createRegistry({
        getAuthority: (context) => context.standardActionAuthority,
      });
      registry.register(standardAction.createOptionDefinition(
        "play_card",
        playDomain.createPlayCardProvider(),
      ));
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
      {
        id: residualDomain.DOMAIN_ID,
        families: residualDomain.ACTION_FAMILIES,
        create: residualDomain.createResidualDomain,
      },
    ],
    projectState: (state) => state,
  });
}

function runSentinelCornerOnPlay() {
  const composition = createSentinelComposition();
  const action = getOnlyPlayAction(composition);
  const result = composition.inputPort.submitAction(action);
  assert.equal(result.ok, true, "哨兵武装下打牌必须可执行");
  assert.equal(
    composition.inspect().phase,
    "idle",
    "哨兵角标节点必须在打牌流程内结算完成",
  );

  // 打牌效果链末尾追加并结算了哨兵角标：获得 1 宣传（不弃牌）。
  const committed = composition.stateSourcePort.getSnapshot();
  const player = committed.players.players[0];
  assert.equal(player.resources.publicity, 1, "哨兵角标必须结算 1 宣传");
  assert.equal(player.hand.length, 0, "打牌弃掉手牌，哨兵角标不再额外弃牌");

  // 打牌记录写入（供「打牌后才武装哨兵」补开使用）。
  assert.equal(player.industryPlayedCardThisRound, true, "本轮打牌记录必须写入");
  assert.equal(player.industryPlayedCardRound, 1);
  assert.equal(player.industryPlayedCardTurn, 1);
  assert.equal(
    player.industryLastPlayedCardThisRound?.cardId,
    "b_1.webp",
    "最近打出牌快照必须记录",
  );

  // journal 必须包含 industry_sentinel_corner 效果。
  const effectTypes = (result.journal?.effects || []).map((entry) => entry.type);
  assert.ok(
    effectTypes.includes("industry_sentinel_corner"),
    "打牌效果链必须追加 industry_sentinel_corner 节点",
  );
  const cornerIndex = effectTypes.indexOf("industry_sentinel_corner");
  assert.ok(
    cornerIndex > effectTypes.indexOf(playDomain.EFFECT_TYPES.PLAY),
    "哨兵角标节点必须在 PLAY 之后结算",
  );
  composition.dispose();
}

runSentinelCornerOnPlay();

// —— 公司打牌被动（迁移 8963b38 丢失，重建接线）——
// 任务中继站：打出 1/2 型任务牌 +1 宣传；宇宙战略集团：打牌后按扫描角标
// 追加奖励槽节点（放置 token 领奖 / 跳过）。
function createPassiveComposition(companyLabel, cardOverrides = {}) {
  const root = createCanonicalState("b_1.webp"); // cardType 2（任务牌）
  const player = root.players.players[0];
  player.initialSelection = { industry: { label: companyLabel } };
  root.turn.roundNumber = 1;
  root.turn.turnNumber = 1;
  Object.assign(player.hand[0], cardOverrides);
  const initialState = toCommitted(root);
  return createRuleComposition({
    stateStoreApi,
    effectRuntimeApi,
    createInitialState() { return structuredClone(initialState); },
    createActionContext,
    createActionRegistry() {
      const registry = standardAction.createRegistry({
        getAuthority: (context) => context.standardActionAuthority,
      });
      registry.register(standardAction.createOptionDefinition(
        "play_card",
        playDomain.createPlayCardProvider(),
      ));
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
      {
        id: residualDomain.DOMAIN_ID,
        families: residualDomain.ACTION_FAMILIES,
        create: residualDomain.createResidualDomain,
      },
    ],
    projectState: (state) => state,
  });
}

function runCompanyPassivesOnPlay() {
  // 任务中继站被动：打出 2 型任务牌 +1 宣传。
  const missionComp = createPassiveComposition("任务中继站");
  const missionAction = getOnlyPlayAction(missionComp);
  const missionResult = missionComp.inputPort.submitAction(missionAction);
  assert.equal(missionResult.ok, true);
  assert.equal(missionComp.inspect().phase, "idle");
  assert.equal(
    missionComp.stateSourcePort.getSnapshot().players.players[0].resources.publicity,
    1,
    "任务中继站被动：打出 1/2 型任务牌 +1 宣传",
  );
  missionComp.dispose();

  // 宇宙战略集团被动：打牌后按扫描角标（scanActionCode 1 → 黄槽）追加奖励槽节点。
  const strategyComp = createPassiveComposition("宇宙战略集团", { scanActionCode: 0 }); // 0 → 黄槽
  const strategyAction = getOnlyPlayAction(strategyComp);
  const strategyOpened = strategyComp.inputPort.submitAction(strategyAction);
  assert.equal(strategyOpened.ok, true);
  assert.equal(
    strategyComp.inspect().phase,
    "awaiting_input",
    "宇宙战略奖励槽节点必须作为决策弹出",
  );
  const decision = strategyComp.inspect().session.decision;
  const slotChoice = decision.choices.find((entry) => entry.target?.slotId != null);
  assert.ok(slotChoice, "必须提供奖励槽选择");
  const submitted = strategyComp.inputPort.submitDecision({
    decisionId: decision.decisionId,
    decisionVersion: decision.decisionVersion,
    ownerId: decision.ownerId,
    choice: slotChoice,
  });
  assert.equal(submitted.ok, true);
  assert.equal(strategyComp.inspect().phase, "idle");
  const strategyPlayer = strategyComp.stateSourcePort.getSnapshot().players.players[0];
  assert.equal(
    strategyPlayer.industryStrategyPassiveSlots?.yellow,
    true,
    "宇宙战略被动：放置 token 到黄奖励槽",
  );
  strategyComp.dispose();

  // 跳过路径：不放置 token、不占用槽位。
  const skipComp = createPassiveComposition("宇宙战略集团", { scanActionCode: 0 });
  const skipAction = getOnlyPlayAction(skipComp);
  skipComp.inputPort.submitAction(skipAction);
  const skipDecision = skipComp.inspect().session.decision;
  const skipChoice = skipDecision.choices.find((entry) => entry.target?.skip === true);
  assert.ok(skipChoice, "奖励槽决策必须提供跳过选项");
  const skipped = skipComp.inputPort.submitDecision({
    decisionId: skipDecision.decisionId,
    decisionVersion: skipDecision.decisionVersion,
    ownerId: skipDecision.ownerId,
    choice: skipChoice,
  });
  assert.equal(skipped.ok, true);
  const skipPlayer = skipComp.stateSourcePort.getSnapshot().players.players[0];
  assert.equal(
    Boolean(skipPlayer.industryStrategyPassiveSlots?.yellow),
    false,
    "跳过不放置 token、不占用槽位",
  );
  skipComp.dispose();
}

runCompanyPassivesOnPlay();

console.log("card play domain production composition tests passed");
