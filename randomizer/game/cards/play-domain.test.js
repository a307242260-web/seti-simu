"use strict";

const assert = require("node:assert/strict");
const playDomain = require("./play-domain");
const scienceSession = require("../effects/science-session");
const residualDomain = require("../effects/residual-domain-session");
const cardEffects = require("./effects");
const cards = require("./deck");
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

// 共享扫描转换覆盖完整有限目录；非扫描不接管，probe回手仍交正式卡牌执行器。
for (const [name, mode] of [
  ["PUBLIC_SCAN", "public"], ["SCAN_ACTION", null], ["SCAN_NEBULA", "specified"],
  ["ANY_SECTOR_SCAN", "any"], ["SCAN_COLOR_CHOICE", "color"],
  ["PLANET_SECTOR_SCAN", "planet"], ["LANDING_SECTOR_SCAN", "landing"],
  ["PROBE_SECTOR_SCAN", "probe"], ["CONDITIONAL_SECTOR_SCAN", "conditional"],
]) {
  const input = { id: "scan-proof", type: cardEffects.EFFECT_TYPES[name], label: "扫描奖励",
    options: { repeat: 2, nebulaId: "sector-1-a", color: "blue", planetId: "mars",
      gainData: false, returnToHandIfSignalCount: 2, condition: { type: "proof-condition" } } };
  const before = structuredClone(input);
  const node = playDomain.createScienceScanEffect(input, "p1", "card-instance");
  assert.equal(node.priority, "direct");
  assert.equal(node.effect.ownerId, "p1");
  assert.equal(node.effect.payload.cardInstanceId, "card-instance");
  assert.deepEqual(node.effect.payload.cardEffect, input);
  assert.equal(node.effect.type, mode ? scienceSession.EFFECT_TYPES.SCAN_STEP : scienceSession.EFFECT_TYPES.EXECUTE);
  if (mode) assert.equal(node.effect.payload.options.mode, mode);
  if (name === "PROBE_SECTOR_SCAN") {
    const next = node.effect.payload.afterProbeScan;
    assert.equal(next.effect.type, "card_play_domain_effect:effect:card_return_played_card_to_hand_if");
    assert.equal(next.effect.payload.cardInstanceId, "card-instance");
    assert.equal(next.effect.payload.cardEffect.options.condition.count, 2);
  }
  node.effect.payload.cardEffect.options.repeat = 99;
  assert.deepEqual(input, before, "转换产物与输入独立");
}
assert.equal(playDomain.createScienceScanEffect({ type: "gain_resources" }, "p1", "c1"), null);

{
  const scan = playDomain.createScienceScanEffect({ type: cardEffects.EFFECT_TYPES.SCAN_COLOR_CHOICE,
    options: { color: "yellow" } }, "p1", "c1");
  const batch = [scan, structuredClone(scan)];
  const before = structuredClone(batch);
  for (const priority of ["direct", "trigger"]) {
    const chained = playDomain.chainScanFinalize(batch, "p1", priority);
    assert.deepEqual(chained.slice(0, -1), before, "扫描顺序不变");
    assert.deepEqual(chained.at(-1), { priority,
      effect: { type: scienceSession.EFFECT_TYPES.SCAN_FINALIZE, ownerId: "p1" } });
    assert.equal(chained.length, 3, "同批两个扫描只追加一次收尾");
  }
  assert.deepEqual(batch, before, "组链不修改输入");
  assert.equal(playDomain.chainScanFinalize(batch, "p1").at(-1).priority, "direct");
  const action = [playDomain.createScienceScanEffect({ type: cardEffects.EFFECT_TYPES.SCAN_ACTION,
    options: {} }, "p1", "c1")];
  assert.deepEqual(playDomain.chainScanFinalize(action, "p1"), action, "主扫描自带收尾，不重复追加");
  assert.deepEqual(playDomain.chainScanFinalize([], "p1"), []);
}

assert.equal(playDomain.REACHABLE_PLAY_EFFECT_TYPES.length, 66);
assert.deepEqual(
  playDomain.OWNED_PLAY_EFFECT_TYPES,
  playDomain.REACHABLE_RECURSIVE_EFFECT_TYPES,
  "Production Card Play owner 必须一次覆盖实际牌库递归 effect 闭包",
);
assert.equal(
  playDomain.REACHABLE_RECURSIVE_EFFECT_TYPES.length,
  52,
  "全部242模型须包含异常点六种专属类型与嵌套探测器计数奖励",
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

function runLaunchLimitSettlement() {
  for (const [cardId, count, orange1, launches] of [
    ["b_138.webp", 1, false, 0],
    ["b_138.webp", 0, false, 1],
    ["b_138.webp", 1, true, 1],
    ["b_138.webp", 2, true, 0],
    ["b_37.webp", 1, false, 2],
    ["b_21.webp", 1, false, 0],
  ]) {
    const root = createCanonicalState(cardId);
    root.players.players[0].techState = players.normalizePlayerTechState({ ownedTiles: { orange1 } });
    for (let index = 0; index < count; index += 1) {
      assert.equal(rockets.launchRocketAtSector(root.pieces, { x: index, y: 2 }, {
        playerId: "p1", color: "brown", root,
      }).ok, true);
    }
    const beforePieces = structuredClone(root.pieces), beforeSequence = root.meta.sequences.rocket;
    const { composition } = createIntegratedComposition(cardId, { state: root });
    const opened = composition.inputPort.submitAction(getOnlyPlayAction(composition));
    assert.equal(opened.ok, true, `${cardId}满额效果须按规则结算：${JSON.stringify(opened)}`);
    let result = opened;
    if (cardId === "b_21.webp") {
      const decision = composition.inspect().session.decision;
      const choice = decision.choices.find(c => c.target.choiceId === "blind");
      assert.ok(choice, "跳过发射后仍须继续拿牌选择");
      const saved = composition.lifecycle.save().envelope;
      const submission = { decisionId: decision.decisionId, decisionVersion: decision.decisionVersion,
        ownerId: decision.ownerId, choice };
      result = composition.inputPort.submitDecision(submission);
      assert.equal(result.ok, true, JSON.stringify(result));
      const after = composition.lifecycle.save().envelope;
      assert.equal(composition.lifecycle.restore(saved, { silent: true }).ok, true);
      assert.equal(composition.inputPort.submitDecision(submission).ok, true);
      assert.deepEqual(composition.lifecycle.save().envelope, after, "跳过后奖励恢复重放保持RNG/实体/状态一致");
    }
    assert.equal(result.phase, "completed");
    const state = composition.stateSourcePort.getSnapshot();
    assert.equal(state.pieces.rockets.length, count + launches);
    assert.equal(state.meta.sequences.rocket, beforeSequence + launches);
    assert.equal(result.journal.events.filter(e => e.type === "launch").length, launches);
    const skipped = result.journal.events.filter(e => e.type === "card_effect" && e.reason === "rocket_limit");
    assert.equal(skipped.length, launches === 0 ? 1 : 0);
    if (launches === 0) {
      assert.equal(skipped[0].skipped, true);
      assert.deepEqual(state.pieces, beforePieces, "跳过发射不改变已有探测器或当前探测器");
      assert.ok(result.journal.history.some(h => h.reason === "rocket_limit" && h.skipped === true));
    }
    assert.equal(state.players.players[0].resources.credits, 8, "只支付牌面费用，跳过不撤销打牌费用");
    if (cardId === "b_21.webp") assert.equal(state.players.players[0].hand.length, 1);
    if (cardId === "b_37.webp") assert.equal(state.players.players[0].resources.publicity, 1);
    composition.dispose();
  }
}

runLaunchLimitSettlement();

function runProbeLocationConditions() {
  const root = createCanonicalState("dlc_11.png");
  const player = root.players.players[0];
  const contextFor = (state) => {
    const observed = rockets.buildProbeLocationData(state);
    return { probeLocations: observed.index, probeLocationDetails: observed.details };
  };
  const meets = (condition, context, owner = player) => cardEffects.taskConditionMet({ condition }, owner, context);
  const place = (state, coordinate, owner = player) => {
    const result = rockets.launchRocketAtSector(state.pieces, coordinate, {
      playerId: owner.id, color: owner.color, root: state,
    });
    assert.equal(result.ok, true);
  };
  const freeze = (value) => {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  // 每个输入只有一个探测器；遍历显示格和一次旋转，不制造超上限盘面。
  const kinds = new Set();
  for (const rotation of [root.solarSystem.rotation, solar.applySolarOrbitRotation(root.solarSystem.rotation)]) {
    for (let y = 1; y <= 4; y += 1) for (let x = 0; x < 8; x += 1) {
      const state = structuredClone(root);
      state.solarSystem.rotation = rotation;
      place(state, { x, y });
      freeze(state);
      const before = JSON.stringify(state), context = contextFor(state);
      const content = solar.resolveVisibleContent(x, y, state.solarSystem).content;
      const earth = solar.createSolarSnapshot(state.solarSystem).planetLocations.find(p => p.planetId === "earth");
      const distance = Math.min((x - earth.x + 8) % 8, (earth.x - x + 8) % 8) + Math.abs(y - earth.y);
      kinds.add(content.kind);
      assert.equal(meets({ type: "probeLocation", locationType: content.kind }, context), true);
      assert.equal(meets({ type: "probeDistanceFromEarth", minDistance: 5 }, context), distance >= 5);
      assert.equal(meets({ type: "probeAdjacentEarth" }, context), distance === 1);
      assert.equal(meets({ type: "probeAdjacentEarthAsteroid" }, context), distance === 1 && content.kind === "asteroid");
      assert.equal(meets({ type: "otherProbeAtPlanet", planetId: "earth" }, context, { id: "p2", color: "blue" }), content.planetId === "earth");
      assert.equal(meets({ type: "otherProbeAtPlanet", planetId: "earth" }, context), false);
      assert.equal(context.probeLocationDetails[0].distanceFromEarth, distance);
      assert.equal(context.probeLocationDetails[0].planetId, content.kind === "planet" ? content.planetId : null);
      assert.equal(JSON.stringify(state), before, "位置读取不改变状态/RNG/序号");
    }
  }
  for (const kind of ["planet", "asteroid", "comet", "empty_space"]) assert.ok(kinds.has(kind));
  const planets = solar.createSolarSnapshot(root.solarSystem).planetLocations;
  const mars = planets.find(p => p.planetId === "mars"), venus = planets.find(p => p.planetId === "venus");
  player.techState = players.normalizePlayerTechState({ ownedTiles: { orange1: true } });
  place(root, mars);
  place(root, venus);
  assert.equal(meets({ type: "probesOnDifferentPlanets", count: 2, excludePlanetIds: ["earth"] }, contextFor(root)), true);
  root.pieces.rockets[1].playerId = "p2";
  root.pieces.rockets[1].color = "blue";
  assert.equal(meets({ type: "probesOnDifferentPlanets", count: 2 }, contextFor(root)), false, "不能借用对手探测器满足自己的任务");
  const polarOnly = structuredClone(root);
  for (const rocket of polarOnly.pieces.rockets) {
    delete rocket.sectorX;
    delete rocket.sectorY;
  }
  assert.deepEqual(contextFor(polarOnly), contextFor(root), "正式极坐标探测器也需读取同一位置");
  const missing = structuredClone(polarOnly);
  delete missing.pieces.rockets[0].radius;
  delete missing.pieces.rockets[0].angleDegrees;
  assert.throws(() => contextFor(missing), /缺少太阳系位置/, "必需位置缺失不得静默返回无任务");
  root.pieces.rockets[0].kind = rockets.ROCKET_KIND.CHONG_FOSSIL;
  root.pieces.rockets[1].surface = "planet-reference";
  assert.deepEqual(rockets.buildProbeLocationData(root), { details: [], index: {} }, "化石与参考图标记不属于这些探测器条件");
}

function runAsteroidTaskSettlement() {
  for (const kind of ["asteroid", "empty_space"]) {
    const root = createCanonicalState("dlc_11.png");
    const coordinate = solar.collectVisibleCoordinateContents(root.solarSystem).find(c => c.content.kind === kind);
    assert.ok(coordinate);
    assert.equal(rockets.launchRocketAtSector(root.pieces, coordinate, { playerId: "p1", color: "brown", root }).ok, true);
    const { composition } = createIntegratedComposition("dlc_11.png", { state: root, residual: true });
    const played = composition.inputPort.submitAction(getOnlyPlayAction(composition));
    assert.equal(played.ok, true, JSON.stringify(played));
    assert.equal(played.phase, "completed");
    assert.equal(composition.stateSourcePort.getSnapshot().players.players[0].resources.score, 0, "任务不能自动领取");
    const actions = composition.inputPort.enumerateActions({ family: "complete_task" });
    assert.equal(actions.length, kind === "asteroid" ? 1 : 0, "正式任务合法集应识别小行星位置");
    if (kind === "asteroid") {
      const saved = composition.lifecycle.save().envelope;
      const settled = composition.inputPort.submitAction(actions[0]);
      assert.equal(settled.ok, true, JSON.stringify(settled));
      const player = composition.stateSourcePort.getSnapshot().players.players[0];
      assert.equal(player.resources.score, 3);
      assert.equal(player.resources.energy, 12);
      assert.equal(player.completedTaskCount, 1);
      assert.equal(player.reservedCards.length, 0);
      assert.equal(composition.inputPort.enumerateActions({ family: "complete_task" }).length, 0, "任务不可重复领取");
      const after = composition.lifecycle.save().envelope;
      assert.equal(composition.lifecycle.restore(saved, { silent: true }).ok, true);
      assert.equal(composition.inputPort.submitAction(actions[0]).ok, true);
      assert.deepEqual(composition.lifecycle.save().envelope, after, "位置任务保存恢复重放一致");
    }
    composition.dispose();
  }
}

runAsteroidTaskSettlement();
runProbeLocationConditions();

function runProbeLocationDataReward() {
  for (const [x, y, expected, pool] of [[1, 1, 0, 0], [6, 1, 2, 0], [7, 2, 4, 0], [0, 1, 1, 0], [7, 2, 4, 5]]) {
    const root = createCanonicalState("b_89.webp"), player = root.players.players[0];
    data.ensurePlayerDataState(player);
    for (let index = 0; index < pool; index += 1) assert.equal(data.gainData(player, { root }).ok, true);
    assert.equal(rockets.launchRocketAtSector(root.pieces, { x, y }, { playerId: player.id, color: player.color, root }).ok, true);
    const rocketId = root.pieces.rockets[0].id;
    player.techState = players.normalizePlayerTechState({ ownedTiles: { orange1: true } });
    assert.equal(rockets.launchRocketAtSector(root.pieces, { x: 7, y: 3 }, { playerId: player.id, color: player.color, root }).ok, true);
    const ownIds = root.pieces.rockets.map(r => r.id);
    // 对手探测器、化石搬运棋子与参考图标记不是本卡的候选。
    root.pieces.rockets.push(
      { ...root.pieces.rockets[1], id: "other-owner", playerId: "p2" },
      { ...root.pieces.rockets[1], id: "fossil", kind: rockets.ROCKET_KIND.CHONG_FOSSIL, fossilId: "fossil-1" },
      { ...root.pieces.rockets[1], id: "reference", surface: "planet-reference" },
    );
    const { composition } = createIntegratedComposition("b_89.webp", { state: root });
    assert.equal(composition.inputPort.submitAction(getOnlyPlayAction(composition)).ok, true);
    const decision = composition.inspect().session.decision;
    assert.deepEqual(decision.choices.map(c => c.target.rocketId).sort(), ownIds.sort());
    const choice = decision.choices.find(c => c.target.rocketId === rocketId);
    assert.ok(choice);
    const saved = composition.lifecycle.save().envelope;
    const submission = { decisionId: decision.decisionId, decisionVersion: decision.decisionVersion,
      ownerId: decision.ownerId, choice };
    const result = composition.inputPort.submitDecision(submission);
    assert.equal(result.ok, true, JSON.stringify(result));
    const after = composition.stateSourcePort.getSnapshot().players.players[0];
    assert.equal(after.resources.availableData, Math.min(6, pool + expected), `(${x},${y})所在和每个相邻小行星数据必须累加`);
    assert.equal(after.dataState.discardedCount, Math.max(0, pool + expected - 6));
    const event = result.journal.events.find(e => e.type === "card_effect"
      && e.effectType === cardEffects.EFFECT_TYPES.PROBE_LOCATION_REWARD && e.rocketId === rocketId);
    assert.ok(event, "必须记录选中探测器的正式结算事件");
    assert.equal(event.amount, expected);
    assert.equal(event.gainedCount + event.discardedCount, expected);
    const finalSave = composition.lifecycle.save().envelope;
    assert.equal(composition.lifecycle.restore(saved, { silent: true }).ok, true);
    assert.equal(composition.inputPort.submitDecision(submission).ok, true);
    assert.deepEqual(composition.lifecycle.save().envelope, finalSave, "位置数据奖励恢复后实体序号/弃置数/状态一致");
    composition.dispose();
  }
}

runProbeLocationDataReward();

function runProbeLocationDataRead() {
  const baseline = createCanonicalState("b_89.webp");
  const options = { asteroidData: 2, adjacentAsteroidData: 1 };
  const freeze = (value) => {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  for (const rotation of [baseline.solarSystem.rotation, solar.applySolarOrbitRotation(baseline.solarSystem.rotation)]) {
    for (let y = 1; y <= 4; y += 1) for (let x = 0; x < 8; x += 1) {
      const root = structuredClone(baseline);
      root.solarSystem.rotation = rotation;
      assert.equal(rockets.launchRocketAtSector(root.pieces, { x, y }, { playerId: "p1", color: "brown", root }).ok, true);
      const asteroids = solar.collectVisibleCoordinateContents(root.solarSystem).filter(c => c.content.kind === "asteroid");
      const expected = asteroids.reduce((total, c) => {
        const distance = Math.min(Math.abs(c.x - x), 8 - Math.abs(c.x - x)) + Math.abs(c.y - y);
        return total + (distance === 0 ? 2 : distance === 1 ? 1 : 0);
      }, 0);
      const before = JSON.stringify(root);
      freeze(root);
      const reward = playDomain.getProbeLocationReward(root, root.pieces.rockets[0], options);
      assert.equal(reward.amount, expected, `旋转后(${x},${y})按实际可见小行星结算`);
      assert.equal(JSON.stringify(root), before, "奖励预读不得改变盘面或序号");
    }
  }
}

runProbeLocationDataRead();

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
  [...new Set(Object.keys(cardEffects.CARD_REFERENCE_MAP).flatMap(cardId =>
    cardEffects.buildPlayEffects({ cardId }).map(effect => effect.type)))].sort(),
  "本组182张参考牌的逐张composition证据只证明该组，不外推全部外星人模型",
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

// 异常点计分读取全部异常扇区己方信号，不发放标记奖励；奖励函数成功契约完整。
{
  const executors = new Map();
  playDomain.createExperimentalCardPlayDomain({ runtime: { registerExecutor(type, executor) {
    executors.set(type, executor);
  } }, commitWorkingState() { return {}; } });
  const root = createCanonicalState("yichangdian_0.webp"), actor = root.players.players[0];
  const sectors = [0, 1, 2].map(x => solar.getNebulaAtCoordinate(x, 5, root.solarSystem.sectorBySlot).id);
  root.aliens.yichangdian = { anomalies: [{ sectorX: 0, markerId: "a_2" }, { sectorX: 1, markerId: "c_2" }] };
  for (const [nebulaId, owner] of [[sectors[0], actor], [sectors[0], actor], [sectors[1], actor],
    [sectors[1], { id: "other", color: "blue", resources: {} }], [sectors[2], actor]]) {
    assert.equal(data.replaceNextNebulaDataToken(root.data, nebulaId, owner, { root }).ok, true);
  }
  const type = cardEffects.EFFECT_TYPES.YICHANGDIAN_ANOMALY_SIGNAL_SCORE;
  const fn = executors.get(`card_play_domain_effect:effect:${type}`);
  const before = actor.resources.score;
  const result = fn(root, { ownerId: actor.id, payload: { cardInstanceId: "source", cardEffect: { type } } }, { state: root });
  assert.equal(result.ok, true);
  assert.equal(actor.resources.score - before, 3);
  assert.equal(result.spawnedEffects.length, 0, "按信号计分不发异常奖励");
  const earth = solar.collectPlanetLocations(root.solarSystem).find(p => p.planetId === "earth");
  root.aliens.yichangdian.anomalies = [{ sectorX: solar.mod8(earth.x - 1), markerId: "c_2" }];
  const rewardType = cardEffects.EFFECT_TYPES.YICHANGDIAN_NEXT_ANOMALY_REWARD;
  const reward = executors.get(`card_play_domain_effect:effect:${rewardType}`)(root,
    { ownerId: actor.id, payload: { cardInstanceId: "reward-source", cardEffect: { type: rewardType } } }, { state: root });
  assert.equal(reward.ok, true, "发放奖励后必须返回完整成功契约");
  const drawType = cardEffects.EFFECT_TYPES.YICHANGDIAN_DRAW_THEN_TWO_CORNERS;
  const drawDecision = executors.get(`card_play_domain_effect:decision:${drawType}`);
  for (const incomeCode of [0, 1, 2]) {
    const incomeRoot = createCanonicalState("b_1.webp"), target = incomeRoot.players.players[0];
    target.hand.push({ id: "drawn-income", cardId: "b_2.webp", incomeCode },
      { id: "drawn-keep", cardId: "b_3.webp", incomeCode: 0 });
    target.resources.handSize = target.hand.length;
    const originalIncome = structuredClone(target.income), beforeResources = { ...target.resources };
    const stage = { ownerId: target.id, payload: { cardInstanceId: "y8-source",
      cardEffect: { type: drawType }, stage: "income", drawnCardIds: ["drawn-income", "drawn-keep"] } };
    const choices = drawDecision.getLegalChoices(incomeRoot, stage, { state: incomeRoot });
    assert.deepEqual(choices.map(c => c.target.cardInstanceId).sort(), ["drawn-income", "drawn-keep"]);
    const beforeWrongChoice = structuredClone(incomeRoot);
    assert.equal(drawDecision.resolveDecision(incomeRoot, stage,
      { target: { cardInstanceId: target.hand[0].id } }, { state: incomeRoot }).ok, false);
    assert.deepEqual(incomeRoot, beforeWrongChoice, "原手牌不能代替新抽牌且拒绝不得改变状态");
    const resolved = drawDecision.resolveDecision(incomeRoot, stage, choices.find(c => c.target.cardInstanceId === "drawn-income"), { state: incomeRoot });
    assert.equal(resolved.ok, true);
    for (const spawned of resolved.spawnedEffects) {
      const executor = executors.get(spawned.effect.type);
      const applied = (typeof executor === "function" ? executor : executor.execute)(incomeRoot, spawned.effect, { state: incomeRoot });
      assert.equal(applied.ok, true, JSON.stringify(applied));
    }
    assert.deepEqual(target.income, originalIncome);
    assert.equal(target.resources.credits - beforeResources.credits, incomeCode === 0 ? 1 : 0);
    assert.equal(target.resources.energy - beforeResources.energy, incomeCode === 1 ? 1 : 0);
    assert.equal(target.hand.length, incomeCode === 2 ? 3 : 2);
    assert(incomeRoot.cards.discardPile.some(c => c.id === "drawn-income"));
    assert(target.hand.some(c => c.id === "drawn-keep"));
  }
  const launchType = cardEffects.EFFECT_TYPES.YICHANGDIAN_LAUNCH_ANOMALY_MOVE;
  const launchFollowup = executors.get(`card_play_domain_effect:effect:${launchType}`);
  const missing = launchFollowup(root, { ownerId: actor.id,
    payload: { cardInstanceId: "current-card", cardEffect: { type: launchType } } }, { state: root });
  assert.equal(missing.ok, false, "没有本卡发射事实不能从地球位置推断奖励");
}
{
  const state = createCanonicalState("b_124.webp");
  const asteroid = Array.from({ length: 32 }, (_, i) => ({ x: i % 8, y: Math.floor(i / 8) + 1 }))
    .find(at => solar.resolveVisibleContent(at.x, at.y, state.solarSystem).content.kind === "asteroid");
  assert.ok(asteroid);
  assert.equal(rockets.launchRocketAtSector(state.pieces, asteroid, {
    playerId: "p1", color: "brown", root: state,
  }).ok, true);
  const { composition } = createIntegratedComposition("b_124.webp", { state });
  try {
    assert.equal(composition.inputPort.submitAction(getOnlyPlayAction(composition)).ok, true);
    const first = composition.inspect().session.decision;
    const move = first.choices.find(c => c.target.rocketId != null);
    assert.ok(move);
    assert.equal(move.payload.requiredMovePoints, 1, "穿越小行星带生效后首步只扣1点移动力");
    const before = composition.lifecycle.save().envelope;
    const input = { decisionId: first.decisionId, decisionVersion: first.decisionVersion,
      ownerId: first.ownerId, choice: move };
    assert.equal(composition.inputPort.submitDecision(input).ok, true);
    assert.equal(composition.inspect().session.currentEffect.payload.remaining, 1,
      "原2点移动力离开小行星后仍须剩余1点");
    const after = composition.lifecycle.save().envelope;
    assert.equal(composition.lifecycle.restore(before).ok, true);
    assert.equal(composition.inputPort.submitDecision(input).ok, true);
    assert.deepEqual(composition.lifecycle.save().envelope, after);
  } finally { composition.dispose(); }
}
for (const mode of ["all", "partial", "zero", "empty"]) {
  const state = createCanonicalState("dlc_28.png");
  const actor = state.players.players[0];
  actor.income = { credits: 4, energy: 2, handSize: 2 };
  const codes = mode === "empty" ? [] : [2, 0, 1, 3, 4, -1];
  actor.hand.push(...codes.map(code => ({ id: `reorganization:${code}`, cardId: "b_2.webp", incomeCode: code })));
  actor.resources.handSize = actor.hand.length;
  const { composition, counters } = createIntegratedComposition("dlc_28.png", { state });
  try {
    const play = getOnlyPlayAction(composition);
    assert.equal(composition.inputPort.submitAction(play).ok, true);
    const choose = id => {
      const decision = composition.inspect().session.decision;
      const choice = decision.choices.find(entry => entry.target.choiceId === id);
      assert.ok(choice, `重组缺少选择${id}`);
      const result = composition.inputPort.submitDecision({ decisionId: decision.decisionId,
        decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice });
      assert.equal(result.ok, true, JSON.stringify(result));
      return result;
    };
    const selectsCards = mode === "all" || mode === "partial";
    if (selectsCards) {
      choose("reorganization:2");
      assert.deepEqual(composition.inspect().session.decision.choices.map(entry => entry.target.choiceId),
        [...codes.slice(1).map(code => `reorganization:${code}`), "done"],
        "重组必须先完成弃牌，不能提前抽牌并把新牌加入同一次选择");
      assert.equal(counters.compareAndCommit, 0, "弃牌选择未完成不得提前提交");
    }
    const pending = composition.lifecycle.save().envelope;
    const decision = composition.inspect().session.decision;
    for (const invalid of [{ ownerId: "p2" }, { decisionVersion: decision.decisionVersion + 1 }]) {
      assert.equal(composition.inputPort.submitDecision({ decisionId: decision.decisionId,
        decisionVersion: decision.decisionVersion, ownerId: decision.ownerId,
        choice: decision.choices[0], ...invalid }).ok, false);
      assert.deepEqual(composition.lifecycle.save().envelope, pending);
    }
    const finish = () => {
      let result;
      if (mode === "all") for (const code of codes.slice(1)) result = choose(`reorganization:${code}`);
      else {
        if (mode === "partial") choose("reorganization:1");
        result = choose("done");
      }
      assert.equal(result.phase, "completed");
      return result;
    };
    const result = finish();
    assert.equal(counters.compareAndCommit, 1, "弃牌及奖励整体只提交一次");
    const final = composition.stateSourcePort.getSnapshot();
    const player = final.players.players[0];
    assert.deepEqual(player.income, actor.income, "重组只发一次性资源，不增加永久收入");
    assert.equal(player.resources.credits, 10 - (play.payload.cost.credits || 0) + (mode === "all" ? 1 : 0));
    assert.equal(player.resources.energy, 10 - (play.payload.cost.energy || 0) + (selectsCards ? 1 : 0));
    assert.equal(player.resources.publicity, mode === "all" ? 1 : 0);
    assert.equal(player.resources.availableData, mode === "all" ? 1 : 0);
    const drawn = player.hand.filter(card => !card.id.startsWith("reorganization:"));
    assert.equal(drawn.length, selectsCards ? 1 : 0);
    assert.equal(result.journal.rng.length, selectsCards ? 1 : 0, "盲抽必须走正式RNG记账");
    const after = composition.lifecycle.save().envelope;
    assert.equal(composition.lifecycle.restore(pending, { silent: true }).ok, true);
    finish();
    assert.deepEqual(composition.lifecycle.save().envelope, after,
      "重组中途恢复须保持累计资源、抽牌、实体、RNG与journal一致");
  } finally { composition.dispose(); }
}
// 数量移动按正式展示一次性授予；展示不弃牌，后续Decision、恢复和skip不补额度。
for (const count of [0, 2]) {
  const root = createCanonicalState("b_98.webp");
  const actor = root.players.players[0];
  actor.hand.push(...cards.CARD_CATALOG.filter((card) => card.discard_action_code === 2)
    .slice(0, count).map((card, index) => ({ id: `move-count:${index}`, cardId: card.card_id,
      discardActionCode: card.discard_action_code })));
  actor.resources.handSize = actor.hand.length;
  const { composition } = createIntegratedComposition("b_98.webp", { state: root });
  try {
    let result = composition.inputPort.submitAction(getOnlyPlayAction(composition));
    assert.equal(result.ok, true);
    let decision = composition.inspect().session?.decision;
    if (decision?.choices.every((choice) => String(choice.target.choiceId).startsWith("launch:"))) {
      result = composition.inputPort.submitDecision({ decisionId: decision.decisionId,
        decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice: decision.choices[0] });
      assert.equal(result.ok, true);
    }
    const revealStart = composition.lifecycle.save().envelope;
    const revealAll = () => {
      for (let index = 0; index < count; index += 1) {
        const inspection = composition.inspect();
        decision = inspection.session.decision;
        assert.equal(playDomain.getMovementAllowance(inspection.session.currentEffect), 0);
        const choice = decision.choices.find(entry => entry.target.cardInstanceId === `move-count:${index}`);
        assert.ok(choice);
        const saved = composition.lifecycle.save().envelope;
        assert.equal(composition.inputPort.submitDecision({ decisionId: decision.decisionId,
          decisionVersion: decision.decisionVersion, ownerId: "p2", choice }).ok, false);
        assert.deepEqual(composition.lifecycle.save().envelope, saved);
        result = composition.inputPort.submitDecision({ decisionId: decision.decisionId,
          decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice });
        assert.equal(result.ok, true);
        const afterReveal = composition.inspect();
        assert.ok(!afterReveal.session.decision.choices.some(entry => entry.target.cardInstanceId === choice.target.cardInstanceId));
        assert.equal(composition.inputPort.submitDecision({ decisionId: decision.decisionId,
          decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice }).ok, false);
        if (index === 0) {
          const partial = composition.lifecycle.save().envelope;
          const next = afterReveal.session.decision;
          const finish = next.choices.find(entry => entry.target.finish);
          assert.equal(composition.inputPort.submitDecision({ decisionId: next.decisionId,
            decisionVersion: next.decisionVersion, ownerId: next.ownerId, choice: finish }).ok, true);
          assert.equal(playDomain.getMovementAllowance(composition.inspect().session.currentEffect), 1,
            "可结束部分展示，未展示牌不能计入额度");
          assert.equal(composition.lifecycle.restore(partial, { silent: true }).ok, true);
          assert.deepEqual(composition.inspect(), afterReveal);
        }
      }
      decision = composition.inspect().session.decision;
      assert.ok(decision.choices.some(entry => entry.target.finish), "零牌也必须经过结束展示");
      result = composition.inputPort.submitDecision({ decisionId: decision.decisionId,
        decisionVersion: decision.decisionVersion, ownerId: decision.ownerId,
        choice: decision.choices.find(entry => entry.target.finish) });
      assert.equal(result.ok, true);
      return composition.lifecycle.save().envelope;
    };
    const revealed = revealAll();
    assert.equal(composition.lifecycle.restore(revealStart, { silent: true }).ok, true);
    assert.deepEqual(revealAll(), revealed, "展示恢复重放保持完整规则状态和journal一致");
    if (count === 0) {
      assert.equal(result.phase, "completed", "无移动角标不得额外给1移动");
      assert.ok(result.journal.events.some((event) => event.revealFinished && event.revealedCount === 0));
      assert.equal(JSON.parse(revealed.committedState).players.players[0].hand.length, 0);
      continue;
    }
    const initial = composition.lifecycle.save().envelope;
    const runMoves = () => {
      for (const expected of [2, 1]) {
        const inspection = composition.inspect();
        assert.equal(playDomain.getMovementAllowance(inspection.session.currentEffect), expected);
        assert.equal(inspection.session.currentEffect.payload.remaining, expected);
        const saved = composition.lifecycle.save().envelope;
        decision = inspection.session.decision;
        const choice = decision.choices.find((entry) => entry.payload.requiredMovePoints === 1 && !entry.target.skip);
        assert.ok(choice);
        for (const invalid of [{ ownerId: "p2" }, { decisionVersion: decision.decisionVersion + 1 }]) {
          assert.equal(composition.inputPort.submitDecision({ decisionId: decision.decisionId,
            decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice, ...invalid }).ok, false);
          assert.deepEqual(composition.lifecycle.save().envelope, saved);
        }
        const skip = decision.choices.find((entry) => entry.target.skip);
        assert.ok(skip);
        const skipped = composition.inputPort.submitDecision({ decisionId: decision.decisionId,
          decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice: skip });
        assert.equal(skipped.ok, true); assert.equal(skipped.phase, "completed");
        assert.equal(composition.lifecycle.restore(saved, { silent: true }).ok, true);
        assert.deepEqual(composition.inspect(), inspection, "恢复不改变剩余点或合法选择");
        result = composition.inputPort.submitDecision({ decisionId: decision.decisionId,
          decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice });
        assert.equal(result.ok, true);
      }
      assert.equal(result.phase, "completed");
      assert.equal(result.journal.events.filter((event) => event.type === "move").length, 2);
      return composition.lifecycle.save().envelope;
    };
    const after = runMoves();
    assert.equal(JSON.parse(after.committedState).players.players[0].hand.length, count,
      "展示不弃牌，移动完成后展示过的手牌仍在手中");
    assert.equal(composition.lifecycle.restore(initial, { silent: true }).ok, true);
    assert.deepEqual(runMoves(), after, "重放保持实体、RNG、journal和正式终态一致");
  } finally { composition.dispose(); }
}
// 符文奖励读取实际黑圈位置；重复符号重复发奖，不发放符号本体。
for (const branchIndex of [0, 1]) {
  for (const placed of [false, true]) {
    const root = createCanonicalState("runezu_1.webp");
    aliens.runezu.gainPlayerSymbol(root.players.players[0], "symbol_1", 2);
    const symbolsBefore = aliens.runezu.getPlayerSymbolCounts(root.players.players[0]);
    root.aliens.runezu = aliens.runezu.createRunezuState();
    if (placed) root.aliens.runezu.faceSymbolSlots = {
      1: { position: 1, symbolId: "symbol_2", playerId: "p1" },
      3: { position: 3, symbolId: "symbol_6", playerId: "p1" },
      5: { position: 5, symbolId: "symbol_7", playerId: "p1" },
      7: { position: 7, symbolId: "symbol_3", playerId: "p1" },
    };
    const { composition } = createIntegratedComposition("runezu_1.webp", { state: root });
    try {
      const opened = composition.inputPort.submitAction(getOnlyPlayAction(composition));
      assert.equal(opened.ok, true);
      const decision = composition.inspect().session.decision;
      assert.equal(decision.choices.length, 2);
      const saved = composition.lifecycle.save().envelope;
      const input = { decisionId: decision.decisionId, decisionVersion: decision.decisionVersion,
        ownerId: decision.ownerId, choice: decision.choices[branchIndex] };
      assert.equal(composition.inputPort.submitDecision({ ...input, ownerId: "p2" }).ok, false);
      assert.deepEqual(composition.lifecycle.save().envelope, saved);
      const resolved = composition.inputPort.submitDecision(input);
      assert.equal(resolved.ok, true); assert.equal(resolved.phase, "completed");
      const player = composition.stateSourcePort.getSnapshot().players.players[0];
      assert.equal(player.resources.energy, 10 + (placed && branchIndex === 0 ? 2 : 0));
      assert.equal(player.resources.credits, 8 + (placed && branchIndex === 0 ? 1 : 0));
      assert.equal(player.resources.score, placed && branchIndex === 1 ? 6 : 0);
      assert.equal(player.resources.publicity, placed && branchIndex === 1 ? 1 : 0);
      assert.deepEqual(aliens.runezu.getPlayerSymbolCounts(player), symbolsBefore);
      const after = composition.lifecycle.save().envelope;
      assert.equal(composition.lifecycle.restore(saved, { silent: true }).ok, true);
      assert.equal(composition.inputPort.submitDecision(input).ok, true);
      assert.deepEqual(composition.lifecycle.save().envelope, after, "符文分支恢复后状态与journal一致");
    } finally { composition.dispose(); }
  }
}
{
  const root = createCanonicalState("runezu_0.webp");
  root.aliens.runezu = aliens.runezu.createRunezuState();
  root.aliens.runezu.faceSymbolSlots = {
    4: { position: 4, symbolId: "symbol_4", playerId: "p1" },
    2: { position: 2, symbolId: "symbol_7", playerId: "p1" },
  };
  const { composition } = createIntegratedComposition("runezu_0.webp", { state: root });
  try {
    assert.equal(composition.inputPort.submitAction(getOnlyPlayAction(composition)).ok, true);
    const decision = composition.inspect().session.decision;
    const saved = composition.lifecycle.save().envelope;
    const input = { decisionId: decision.decisionId, decisionVersion: decision.decisionVersion,
      ownerId: decision.ownerId, choice: decision.choices[0] };
    const resolved = composition.inputPort.submitDecision(input);
    assert.equal(resolved.ok, true); assert.equal(resolved.phase, "completed");
    const committed = composition.stateSourcePort.getSnapshot(), player = committed.players.players[0];
    assert.equal(player.hand.length, 1, "符号4所在位置奖励盲抽一张");
    assert.equal(player.resources.additionalPublicScan, 1, "符号7所在位置奖励扫描标记而非立即扫描");
    assert.equal(committed.meta.sequences.card, 101);
    assert.equal(resolved.journal.rng.length, 1);
    assert.equal(resolved.journal.events.filter(e => e.type === "signalMarked").length, 0);
    const after = composition.lifecycle.save().envelope;
    assert.equal(composition.lifecycle.restore(saved, { silent: true }).ok, true);
    assert.equal(composition.inputPort.submitDecision(input).ok, true);
    assert.deepEqual(composition.lifecycle.save().envelope, after, "盲抽恢复保持牌实体、RNG和日志一致");
  } finally { composition.dispose(); }
}
console.log("card play domain production composition tests passed");
