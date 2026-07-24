"use strict";

const assert = require("node:assert/strict");
const playDomain = require("./play-domain");
const cardEffects = require("./effects");
const standardAction = require("../actions/standard-action");
const stateStoreApi = require("../state/state-store");
const effectRuntimeApi = require("../effects/session-runtime");
const { createRuleComposition } = require("../rule-composition");
const data = require("../data");

assert.equal(playDomain.REACHABLE_PLAY_EFFECT_TYPES.length, 46);
assert.deepEqual(playDomain.SLICE_EFFECT_TYPES, [
  cardEffects.EFFECT_TYPES.SCAN_NEBULA,
  cardEffects.EFFECT_TYPES.SCAN_COLOR_CHOICE,
]);

function createLegacyRoot(cardId) {
  const card = {
    id: `instance:${cardId}`,
    cardId,
    price: 2,
    cardTypeCode: cardEffects.getRuntimeCardTypeCode({ cardId }),
  };
  const nebulaDataState = data.createDefaultNebulaDataState();
  for (const nebulaId of new Set(Object.values(cardEffects.NEBULA_IDS_BY_COLOR).flat())) {
    for (let index = 0; index < 4; index += 1) {
      data.fillNebulaData(nebulaDataState, nebulaId, { source: "test" });
    }
  }
  return {
    meta: {
      stateVersion: 0,
      gameId: `card-play:${cardId}`,
      rulesetVersion: "test-v1",
      seed: 158,
      rngState: {},
      sequences: {},
    },
    playerState: {
      currentPlayerId: "p1",
      players: [{
        id: "p1",
        color: "brown",
        resources: {
          credits: 10, energy: 10, publicity: 0, score: 0,
          availableData: 0, computerCapacity: 5, handSize: 1,
        },
        income: {},
        hand: [card],
        reservedCards: [],
        mainActionCompleted: false,
      }],
    },
    cardState: { discardPile: [], publicCards: [] },
    rocketState: {},
    solarState: { sectorBySlot: {} },
    nebulaDataState,
    planetStatsState: {},
    techGameState: {},
    alienGameState: {},
    turnState: { currentPlayerId: "p1" },
    match: { decisionVersion: 0 },
  };
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
    turn: root.turnState,
    players: root.playerState,
    solarSystem: root.solarState,
    pieces: root.rocketState,
    planets: root.planetStatsState,
    data: root.nebulaDataState,
    cards: root.cardState,
    tech: root.techGameState,
    aliens: root.alienGameState,
    finalScoring: {},
  });
}

function fromCommitted(state) {
  return {
    meta: structuredClone(state.meta),
    playerState: structuredClone(state.players),
    cardState: structuredClone(state.cards),
    rocketState: structuredClone(state.pieces),
    solarState: structuredClone(state.solarSystem),
    nebulaDataState: structuredClone(state.data),
    planetStatsState: structuredClone(state.planets),
    techGameState: structuredClone(state.tech),
    alienGameState: structuredClone(state.aliens),
    turnState: structuredClone(state.turn),
    match: structuredClone(state.match),
  };
}

function restoreObject(target, source) {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, structuredClone(source));
}

function createActionContext(root) {
  const playerState = root.playerState || root.players;
  return {
    workingRoot: root,
    playerState,
    cardState: root.cardState || root.cards,
    rocketState: root.rocketState || root.pieces,
    solarState: root.solarState || root.solarSystem,
    nebulaDataState: root.nebulaDataState || root.data,
    planetStatsState: root.planetStatsState || root.planets,
    techGameState: root.techGameState || root.tech,
    alienGameState: root.alienGameState || root.aliens,
    turnState: root.turnState || root.turn,
    match: root.match,
    standardActionAuthority: {
      actorId: playerState.currentPlayerId,
      stateVersion: root.meta.stateVersion,
      decisionVersion: root.match.decisionVersion,
    },
  };
}

function semanticState(state) {
  const root = state.playerState ? state : fromCommitted(state);
  const player = root.playerState.players[0];
  return {
    stateVersion: root.meta.stateVersion,
    player: {
      credits: player.resources.credits,
      availableData: player.resources.availableData,
      hand: player.hand.map((card) => card.id),
      reserved: player.reservedCards.map((card) => card.id),
      mainActionCompleted: player.mainActionCompleted,
    },
    scans: ["sector-4-a", "sector-3-a"].map((nebulaId) => ({
      nebulaId,
      tokens: data.listNebulaTokens(root.nebulaDataState, nebulaId).map((token) => ({
        slotIndex: token.slotIndex,
        replacedByPlayerId: token.replacedByPlayerId || null,
      })),
    })),
  };
}

function createIntegratedComposition(cardId, browserShape) {
  const initialLegacy = createLegacyRoot(cardId);
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
    createInitialState(_options, workingState) {
      return browserShape ? toCommitted(workingState) : toCommitted(initialLegacy);
    },
    createActionContext,
    createActionRegistry() {
      const registry = standardAction.createRegistry({
        getAuthority: (context) => context.standardActionAuthority,
      });
      registry.register(standardAction.createOptionDefinition("play_card", provider));
      return registry;
    },
    effectDomains: [{
      id: "card_play_test_boundary",
      families: ["play_card"],
      create: playDomain.createExperimentalCardPlayDomain,
    }],
    projectState: semanticState,
  };
  if (browserShape) {
    options.projectWorkingState = true;
    options.stateAdapter = {
      createWorkingState: () => structuredClone(initialLegacy),
      createCommittedState(workingState, committedState) {
        return toCommitted(workingState, committedState.meta.stateVersion);
      },
      restoreWorkingState(workingState, source) {
        restoreObject(
          workingState,
          source.playerState ? source : fromCommitted(source),
        );
      },
      createProjectionState: (workingState) => structuredClone(workingState),
      onCommitted(workingState, committedState) {
        workingState.meta.stateVersion = committedState.meta.stateVersion;
      },
    };
  }
  const composition = createRuleComposition(options);
  return { composition, counters };
}

function getOnlyPlayAction(composition) {
  const actions = composition.inputPort.enumerateActions({ family: "play_card" });
  assert.equal(actions.length, 1);
  const action = actions[0];
  assert.equal(action.schemaVersion, standardAction.SCHEMA_VERSION);
  assert.equal(action.family, "play_card");
  assert.equal(action.actorId, "p1");
  assert.equal(action.stateVersion, 0);
  assert.equal(action.decisionVersion, 0);
  return action;
}

function runFixedScan(browserShape) {
  const { composition, counters } = createIntegratedComposition("b_1.webp", browserShape);
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

function runColorDecisions(browserShape) {
  const { composition, counters } = createIntegratedComposition("b_3.webp", browserShape);
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

assert.deepEqual(
  runFixedScan(true),
  runFixedScan(false),
  "Browser working root 与 Simulation committed root 必须经同一 owner 产生同根结果",
);
assert.deepEqual(
  runColorDecisions(true),
  runColorDecisions(false),
  "Browser 与 Simulation 的标准 Card Decision 提交结果必须一致",
);

{
  const { composition, counters } = createIntegratedComposition("dlc_2.png", false);
  const before = composition.stateSourcePort.getSnapshot();
  const result = composition.inputPort.submitAction(getOnlyPlayAction(composition));
  assert.equal(result.ok, false);
  assert.equal(result.failure.code, "CARD_PLAY_SLICE_UNSUPPORTED");
  assert.deepEqual(composition.stateSourcePort.getSnapshot(), before);
  assert.equal(counters.compareAndCommit, 0, "未覆盖类型必须在费用和实体迁移提交前 fail-closed");
}

console.log("card play domain production composition slice tests passed");
