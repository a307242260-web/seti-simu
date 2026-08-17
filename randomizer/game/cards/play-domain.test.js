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

function runAmibaCardTriggersRegionReward() {
  // amiba_0（3 数据 + 蓝色区域 symbol 奖励）：打出阿米巴牌必须触发蓝色区域结算
  const root = createCanonicalState("amiba_0.webp");
  const amibaCard = aliens.amiba.createAlienCard(0, 1);
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
  assert.ok(
    aliens.amiba.getSymbolEntry(root.aliens, "blue_3")?.symbolId,
    "阿米巴揭示后 blue_3 槽位必须有 symbol",
  );
  const { composition } = createIntegratedComposition("amiba_0.webp", { state: root });
  let result = composition.inputPort.submitAction(getOnlyPlayAction(composition));
  assert.equal(result.ok, true, JSON.stringify(result));
  let guard = 0;
  let blueRewardSeen = false;
  while (result.ok && composition.inspect().phase === "awaiting_input") {
    const decision = composition.inspect().session.decision;
    const choices = decision.choices;
    if (choices.some((candidate) => /蓝色|blue|symbol/i.test(String(candidate.summary || "")))) {
      blueRewardSeen = true;
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
  // 蓝色区域结算后 blue_3 的 symbol 应被消费/移动
  const blueSlotEntry = aliens.amiba.getSymbolEntry(committed.aliens, "blue_3");
  assert.ok(
    !blueSlotEntry || blueSlotEntry.symbolId == null || blueRewardSeen,
    "amiba_0 蓝色区域 symbol 奖励必须被触发",
  );
  composition.dispose();
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
